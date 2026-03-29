
import { GoogleGenAI } from "@google/genai";
import { OpenRouter } from '@openrouter/sdk';
import { NovelSettings, Project, MindMapNode, CharacterRelationship, CharacterProfile, WorldItem, ChapterOutline, StoryDetails, ChatMessage, SavedStory, RefinedSynopsisCard, DEFAULT_SETTINGS } from "../types.ts";

const HarmCategory = {
    HARM_CATEGORY_HATE_SPEECH: 'HARM_CATEGORY_HATE_SPEECH',
    HARM_CATEGORY_DANGEROUS_CONTENT: 'HARM_CATEGORY_DANGEROUS_CONTENT',
    HARM_CATEGORY_SEXUALLY_EXPLICIT: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
    HARM_CATEGORY_HARASSMENT: 'HARM_CATEGORY_HARASSMENT'
};

const HarmBlockThreshold = {
    BLOCK_NONE: 'BLOCK_NONE',
    BLOCK_ONLY_HIGH: 'BLOCK_ONLY_HIGH',
    BLOCK_MEDIUM_AND_ABOVE: 'BLOCK_MEDIUM_AND_ABOVE',
    BLOCK_LOW_AND_ABOVE: 'BLOCK_LOW_AND_ABOVE'
};
import { 
    AI_PROMPTS, 
    getGeneralSynopsisPrompt, 
    getReferenceAnalysisPrompt,
    getRawStoryIdeaAnalysisPrompt,
    getManuscriptAnalysisPrompt,
    getProjectContextAnalysisPrompt,
    getWritingStyleAnalysisPrompt,
    GENERAL_SYSTEM_PROMPT,
    getNovelContextPrompt,
    getStoryArchPrompt,
    getEpisodeOutlinePrompt,
    getContinueStoryPrompt,
    getRefineTextPrompt,
    getCharacterProfilePrompt,
    getRelationshipMapPrompt,
    getStoryArchitectChatPrompt,
    getIdeaPartnerSystemPrompt,
    getSynopsisOptionsPrompt,
    getExpandDetailedSynopsisPrompt,
    getOrganizeWorldviewPrompt,
    getExtractCharacterPrompt,
    getProjectAssistantPrompt,
    getStreamingSynopsisPrompt
} from "./prompts.ts";

// Initialize client helper
let currentGlobalModel: string = 'gemini-2.0-flash';

export const setGlobalModel = (model: string) => {
    currentGlobalModel = model;
};

// Re-export AI_PROMPTS for components to use
export { AI_PROMPTS };


const SAFETY_SETTINGS = [
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH }
];


let lastErrorTime = 0;
export const handleApiError = (e: any) => {
    const msg = e?.message || String(e);
    const now = Date.now();
    
    if (msg.includes('leaked') || msg.includes('Leaked')) {
        if (now - lastErrorTime > 5000) {
            lastErrorTime = now;
            alert(`[보안 경고] API 키가 유출된 것으로 보고되었습니다.\n\n해당 API 키는 구글에 의해 비활성화되었습니다. 다음 단계를 따라주세요:\n1. Google AI Studio(aistudio.google.com)에서 새로운 API 키를 생성하세요.\n2. 앱 설정 메뉴에서 새로운 API 키로 업데이트하세요.\n3. 기존 유출된 키는 삭제하거나 비활성화하세요.`);
        }
        return;
    }

    if (msg.includes('403') || msg.includes('PERMISSION_DENIED') || msg.includes('forbidden') || msg.includes('Forbidden')) {
        if (now - lastErrorTime > 5000) {
            lastErrorTime = now;
            alert(`API 접근 권한 오류(403)가 발생했습니다.\n\n[안내사항]\n1. 입력하신 API 키가 유효한지 확인해주세요.\n2. 해당 API 키에 필요한 권한이 부여되어 있는지 확인해주세요.\n3. 무료 할당량을 초과했거나 결제 정보가 필요한 상태일 수 있습니다.\n4. 특정 국가/지역에서는 API 접근이 제한될 수 있습니다.\n\n상세 오류: ${msg}`);
        }
    }
};

export const AI_MODELS = [
    { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', provider: 'gemini' },
    { id: 'gemini-2.5-pro-preview', name: 'Gemini 2.5 Pro', provider: 'gemini' },
    { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash', provider: 'gemini' },
    { id: 'gemini-3.1-flash-preview', name: 'Gemini 3.1 Flash', provider: 'gemini' },
    { id: 'gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro', provider: 'gemini' },
    { id: 'grok-3', name: 'Grok 3', provider: 'grok' },
    { id: 'anthracite-org/magnum-v4-72b', name: 'Magnum v4 72B', provider: 'magnum' }
];

export const isGrokModel = (modelId: string) => {
    return AI_MODELS.find(m => m.id === modelId)?.provider === 'grok';
};

export const isMagnumModel = (modelId: string) => {
    return AI_MODELS.find(m => m.id === modelId)?.provider === 'magnum';
};

// --- NOTIFICATION HELPER ---
const notifyModelUsage = (provider: string, model: string) => {
    if (typeof window !== 'undefined') {
        const event = new CustomEvent('ai-model-used', { detail: { provider, model } });
        window.dispatchEvent(event);
    }
};

// HELPER: Sanitize explicit words from INPUT to prevent Safety Blocks
// Only applies when using Gemini for strict filtering.
const sanitizeForGemini = (text: string, isGrokMode: boolean = false): string => {
    if (isGrokMode || !text) return text; 
    // Minimal sanitization since we use BLOCK_NONE mostly, but kept for legacy support
    return text;
};

// --- GROK API INTEGRATION ---
const callGrokAPI = async (
  messages: any[],
  model: string,
  apiKey: string,
  onChunk?: (text: string) => void,
  temperature: number = 0.7,
  responseMimeType?: string
): Promise<string> => {
  try {
    let effectiveApiKey = (process.env.GROK_API_KEY || import.meta.env.VITE_GROK_API_KEY || '').trim();
    
    // Remove quotes if they were accidentally included
    if (effectiveApiKey.startsWith('"') && effectiveApiKey.endsWith('"')) effectiveApiKey = effectiveApiKey.slice(1, -1);
    if (effectiveApiKey.startsWith("'") && effectiveApiKey.endsWith("'")) effectiveApiKey = effectiveApiKey.slice(1, -1);

    if (!effectiveApiKey || effectiveApiKey === "YOUR_GROK_API_KEY" || effectiveApiKey === "undefined" || effectiveApiKey === "null") {
      throw new Error("Grok API Key is missing. Please set GROK_API_KEY in your environment.");
    }
    const effectiveModel = model || 'grok-3';

    notifyModelUsage('xAI Grok', effectiveModel);

    const body: any = {
      messages: messages,
      model: effectiveModel,
      stream: !!onChunk, 
      temperature: temperature,
      max_tokens: 8192 
    };

    if (responseMimeType === 'application/json') {
      body.response_format = { type: "json_object" };
    }

    const response = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${effectiveApiKey}`
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Grok API Error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    if (!onChunk) {
      const data = await response.json();
      return data.choices?.[0]?.message?.content || "";
    }

    if (!response.body) throw new Error("Grok API response body is empty");

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullText = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');
      
      for (const line of lines) {
        if (line.trim().startsWith('data: ')) {
          const data = line.slice(6).trim();
          if (data === '[DONE]') break;
          
          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content || "";
            if (content) {
              fullText += content;
              if (onChunk) onChunk(content);
            }
          } catch (e) { 
            handleApiError(e);
            // Ignore incomplete chunks
          }
        }
      }
    }
    return fullText;
  } catch (e) { 
    handleApiError(e);
    console.error("Grok API Error", e);
    throw new Error(`Grok API Error: ${e instanceof Error ? e.message : 'Unknown error'}`);
  }
};

// --- MAGNUM (OpenRouter) API INTEGRATION ---
const callMagnumAPI = async (
  messages: any[],
  model: string,
  apiKey: string,
  onChunk?: (text: string) => void,
  temperature: number = 0.7
): Promise<string> => {
  try {
    let effectiveApiKey = (process.env.MAGNUM_API_KEY || import.meta.env.VITE_MAGNUM_API_KEY || '').trim();
    
    // Remove quotes if they were accidentally included
    if (effectiveApiKey.startsWith('"') && effectiveApiKey.endsWith('"')) effectiveApiKey = effectiveApiKey.slice(1, -1);
    if (effectiveApiKey.startsWith("'") && effectiveApiKey.endsWith("'")) effectiveApiKey = effectiveApiKey.slice(1, -1);

    if (!effectiveApiKey || effectiveApiKey === "YOUR_MAGNUM_API_KEY" || effectiveApiKey === "undefined" || effectiveApiKey === "null") {
      throw new Error("Magnum API Key is missing. Please set MAGNUM_API_KEY in your environment.");
    }
    const effectiveModel = model || 'anthracite-org/magnum-v4-72b';

    notifyModelUsage('OpenRouter Magnum', effectiveModel);

    const openRouter = new OpenRouter({
      apiKey: effectiveApiKey,
      httpReferer: (typeof window !== 'undefined' && window.location.origin && window.location.origin !== 'null') ? window.location.origin : "https://novelcraft.app",
      appTitle: 'NovelCraft',
    });

    if (onChunk) {
      // Streaming mode
      const response = await openRouter.chat.send({
        chatGenerationParams: {
          model: effectiveModel,
          messages: messages,
          temperature: temperature,
          stream: true,
          maxTokens: 8192, // Ensure enough tokens for long novel generation
        },
      });

      // The SDK returns an EventStream for streaming
      // We need to check if it's an EventStream
      if ('[Symbol.asyncIterator]' in response) {
        let fullText = "";
        try {
          for await (const chunk of response) {
            const content = chunk.choices?.[0]?.delta?.content || "";
            if (content) {
              fullText += content;
              onChunk(content);
            }
          }
        } catch (streamError) {
          console.warn("Magnum Stream interrupted, returning partial text:", streamError);
          if (fullText) return fullText;
          throw streamError;
        }
        return fullText;
      } else {
        // Fallback if not streaming for some reason
        const content = (response as any).choices?.[0]?.message?.content || "";
        if (content) onChunk(content);
        return content;
      }
    } else {
      // Non-streaming mode
      const response = await openRouter.chat.send({
        chatGenerationParams: {
          model: effectiveModel,
          messages: messages,
          temperature: temperature,
          stream: false,
          maxTokens: 8192,
        },
      });
      
      // For non-streaming, it returns ChatResponse
      return (response as any).choices?.[0]?.message?.content || "";
    }
  } catch (error) {
    console.error("Magnum API Error", error);
    throw error;
  }
};

const cleanJson = (text: string): string => {
  if (!text) return "";
  
  // Find the outermost JSON structure
  const firstOpen = text.search(/[\{\[]/);
  if (firstOpen !== -1) {
    const lastClose = Math.max(text.lastIndexOf('}'), text.lastIndexOf(']'));
    if (lastClose !== -1 && lastClose > firstOpen) {
      const candidate = text.substring(firstOpen, lastClose + 1);
      // Basic validation to ensure it's likely JSON
      if (candidate.startsWith('{') && candidate.endsWith('}') || 
          candidate.startsWith('[') && candidate.endsWith(']')) {
        return candidate;
      }
    }
  }

  let cleaned = text.trim();
  if (cleaned.startsWith('```json')) cleaned = cleaned.substring(7);
  else if (cleaned.startsWith('```')) cleaned = cleaned.substring(3);
  if (cleaned.endsWith('```')) cleaned = cleaned.substring(0, cleaned.length - 3);
  return cleaned.trim();
};

const parseWorldviewContext = (worldviewRaw: string): string => {
  if (!worldviewRaw) return "";
  try {
    const items = JSON.parse(worldviewRaw);
    if (Array.isArray(items)) {
      return items.map((item: any) => {
        if (item.type === 'folder') return `[Category/Folder: ${item.title}]`;
        else return `[Setting Note: ${item.title}]\n${item.content}`;
      }).join("\n\n");
    }
  } catch (e) { handleApiError(e);  return worldviewRaw; }
  return worldviewRaw;
};

// --- Synopsis Refiner ---
export const refineSynopsisWithContext = async (
  rawSynopsis: string,
  project: Project | null,
  recentStories: SavedStory[],
  preAnalyzedContext?: string,
  styleGuide?: string,
  targetChapterCount: number = 1,
  model: string = 'gemini-3-flash-preview',
  creativityLevel: number = 7
): Promise<RefinedSynopsisCard[]> => {
  
  let contextData = "";
  if (project) {
    contextData += `=== PROJECT WORLDVIEW ===\n${parseWorldviewContext(project.worldview)}\n\n=== CHARACTERS ===\n${project.characters}\n`;
  }
  if (preAnalyzedContext) {
      contextData += `=== PROJECT STORY CONTEXT ===\n${preAnalyzedContext}\n`;
  } else if (Array.isArray(recentStories) && recentStories.length > 0) {
      const sortedStories = [...recentStories].sort((a, b) => (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt)).slice(0, 5).reverse(); 
      contextData += `=== RECENT STORY FLOW ===\n${(Array.isArray(sortedStories) ? sortedStories : []).map((s, i) => `[Ep ${i+1}: ${s.title}]\n${s.content.slice(-2000)}`).join('\n\n')}\n`;
  }

  const structureInstruction = targetChapterCount > 1
    ? `**Structure**: You MUST split the narrative into **EXACTLY ${targetChapterCount}** distinct chapters/sequences. Expand the user's input to fill these chapters if necessary.`
    : `**Structure**: Check for user-defined chapter markers (e.g., "Chapter 1", "1화"). If the user did NOT explicitly mark chapters, you MUST return **EXACTLY ONE** chapter containing the entire story. Do NOT split it into multiple chapters arbitrarily.`;

  const prompt = getGeneralSynopsisPrompt(rawSynopsis, contextData, structureInstruction, styleGuide);

  try {
    const result = await callAI(
        [{ role: 'user', content: prompt }],
        model,
        {
            responseMimeType: 'application/json',
            creativityLevel: creativityLevel
        }
    );
    return JSON.parse(cleanJson(result)) as RefinedSynopsisCard[];
  } catch (e) { handleApiError(e); 
    console.error("Synopsis refinement failed", e);
    return [];
  }
};

export const refineSynopsisStream = async (
  rawSynopsis: string,
  project: Project | null,
  recentStories: SavedStory[],
  onChunk: (text: string) => void,
  preAnalyzedContext?: string,
  styleGuide?: string,
  targetChapterCount: number = 1,
  model: string = 'gemini-3-flash-preview',
  creativityLevel: number = 7
): Promise<string> => {
  
  let contextData = "";
  if (project) {
    contextData += `=== PROJECT WORLDVIEW ===\n${parseWorldviewContext(project.worldview)}\n\n=== CHARACTERS ===\n${project.characters}\n`;
  }
  if (preAnalyzedContext) {
      contextData += `=== PROJECT STORY CONTEXT ===\n${preAnalyzedContext}\n`;
  } else if (Array.isArray(recentStories) && recentStories.length > 0) {
      const sortedStories = [...recentStories].sort((a, b) => (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt)).slice(0, 5).reverse(); 
      contextData += `=== RECENT STORY FLOW ===\n${(Array.isArray(sortedStories) ? sortedStories : []).map((s, i) => `[Ep ${i+1}: ${s.title}]\n${s.content.slice(-2000)}`).join('\n\n')}\n`;
  }

  const structureInstruction = targetChapterCount > 1
    ? `**Structure**: You MUST split the narrative into **EXACTLY ${targetChapterCount}** distinct chapters/sequences. Expand the user's input to fill these chapters if necessary.`
    : `**Structure**: Check for user-defined chapter markers (e.g., "Chapter 1", "1화"). If the user did NOT explicitly mark chapters, you MUST return **EXACTLY ONE** chapter containing the entire story. Do NOT split it into multiple chapters arbitrarily.`;

  const prompt = getStreamingSynopsisPrompt(rawSynopsis, contextData, structureInstruction, styleGuide);

  try {
    return await callAI(
        [{ role: 'user', content: prompt }],
        model,
        {
            onChunk,
            creativityLevel: creativityLevel
        }
    );
  } catch (e) { 
    handleApiError(e); 
    console.error("Synopsis streaming refinement failed", e);
    throw e;
  }
};

export const analyzeSynopsisReference = async (
    text: string, 
    model: string = 'gemini-3-flash-preview'
): Promise<string> => {
    const prompt = getReferenceAnalysisPrompt(text);
    try {
        return await callAI(
            [{ role: 'user', content: prompt }],
            model
        );
    } catch (e) {
        handleApiError(e);
        return "";
    }
};

export const generateNovelStep = async (
    currentStep: number, 
    totalSteps: number, 
    settings: NovelSettings, 
    project: Project | null, 
    previousContent: string, 
    structuralGuide?: string, 
    contextAnalysis?: string,
    onChunk?: (text: string) => void, 
    storyAnalysis?: string,
    model: string = 'gemini-3-flash-preview'
): Promise<string> => {
    
    const promptContext = getNovelContextPrompt(
        project, 
        settings, 
        structuralGuide, 
        contextAnalysis, 
        storyAnalysis, 
        previousContent
    );

    const systemPrompt = GENERAL_SYSTEM_PROMPT;
    
    try {
        return await callAI(
            [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: promptContext }
            ],
            model,
            {
                onChunk,
                creativityLevel: settings.creativityLevel || 7
            }
        );
    } catch (e: any) {
        handleApiError(e);
        console.error(`AI generation failed with model ${model}:`, e);
        throw e;
    }
};

const callGeminiAPI = async (
    messages: { role: string, content: string }[],
    model: string,
    apiKey: string,
    config: any,
    onChunk?: (text: string) => void
): Promise<string> => {
    const ai = new GoogleGenAI({ apiKey });
    
    const systemInstruction = config.systemInstruction;
    const generationConfig = {
        temperature: config.temperature || 0.7,
        maxOutputTokens: config.maxOutputTokens || 8192,
        responseMimeType: config.responseMimeType
    };

    // Filter out system messages for the 'contents' part as they go into systemInstruction
    const userMessages = messages.filter(m => m.role !== 'system');
    const prompt = userMessages.map(m => m.content).join("\n\n");

    notifyModelUsage('Google Gemini', model);

    try {
        if (onChunk) {
            const response = await ai.models.generateContentStream({
                model,
                contents: [{ role: 'user', parts: [{ text: prompt }] }],
                config: {
                    ...generationConfig,
                    systemInstruction,
                    safetySettings: SAFETY_SETTINGS as any
                }
            });

            let fullText = "";
            for await (const chunk of response) {
                const text = chunk.text;
                if (text) {
                    fullText += text;
                    onChunk(text);
                }
            }
            return fullText;
        } else {
            const response = await ai.models.generateContent({
                model,
                contents: [{ role: 'user', parts: [{ text: prompt }] }],
                config: {
                    ...generationConfig,
                    systemInstruction,
                    safetySettings: SAFETY_SETTINGS as any
                }
            });
            return response.text || "";
        }
    } catch (e: any) {
        console.error(`Gemini SDK Error with model ${model}:`, e);
        // Extract status code if possible for handleApiError
        const errorMsg = e?.message || String(e);
        if (errorMsg.includes('403') || errorMsg.includes('PERMISSION_DENIED')) {
            handleApiError(new Error(`Gemini API Error: 403 Forbidden - ${errorMsg}`));
        }
        throw e;
    }
};

export const callAI = async (
    messages: { role: string, content: string }[],
    model: string,
    options: {
        onChunk?: (text: string) => void,
        temperature?: number,
        creativityLevel?: number,
        responseMimeType?: string
    } = {}
): Promise<string> => {
    const isGrok = isGrokModel(model);
    const isMagnum = isMagnumModel(model);

    // Map creativityLevel to temperature if temperature is not provided
    const effectiveTemperature = options.temperature !== undefined 
        ? options.temperature 
        : (options.creativityLevel !== undefined ? options.creativityLevel / 10 : 0.7);

    if (isGrok) {
        return await callGrokAPI(messages, model, '', options.onChunk, effectiveTemperature, options.responseMimeType);
    } else if (isMagnum) {
        // Magnum (OpenRouter) does not fallback to Gemini as per user request
        return await callMagnumAPI(messages, model, '', options.onChunk, effectiveTemperature);
    } else {
        let key = (process.env.GEMINI_API_KEY || import.meta.env.VITE_GEMINI_API_KEY || "").trim();
        
        // Remove quotes if they were accidentally included
        if (key.startsWith('"') && key.endsWith('"')) key = key.slice(1, -1);
        if (key.startsWith("'") && key.endsWith("'")) key = key.slice(1, -1);

        if (!key || key === "YOUR_GEMINI_API_KEY" || key === "undefined" || key === "null") {
            throw new Error("Gemini API Key is missing or invalid. Please set GEMINI_API_KEY in your environment settings.");
        }
        
        const systemMsg = messages.find(m => m.role === 'system')?.content;
        
        const config: any = { 
            temperature: effectiveTemperature,
            responseMimeType: options.responseMimeType,
            maxOutputTokens: 8192,
            systemInstruction: systemMsg
        };

        return await callGeminiAPI(messages, model, key, config, options.onChunk);
    }
};

export const analyzeRawStoryIdea = async (
    idea: string, 
    chapterCount: number, 
    pov: string, 
    model: string = 'gemini-3-flash-preview'
): Promise<string> => {
    const prompt = getRawStoryIdeaAnalysisPrompt(idea, chapterCount, pov);

    try {
        return await callAI(
            [{ role: 'user', content: prompt }],
            model,
            {
                temperature: 0.8
            }
        );
    } catch (e) {
        handleApiError(e);
        throw e;
    }
};

export const generateStoryArch = async (
    idea: string, 
    chapterCount: number, 
    analysisContext?: string, 
    preserveSynopsis: boolean = false,
    model: string = 'gemini-3-flash-preview',
    creativityLevel: number = 7
): Promise<StoryDetails | null> => {
    const prompt = getStoryArchPrompt(idea, analysisContext, preserveSynopsis, chapterCount);

    try {
        const resp = await callAI(
            [{ role: 'user', content: prompt }],
            model,
            {
                responseMimeType: 'application/json',
                creativityLevel: creativityLevel
            }
        );
        return JSON.parse(cleanJson(resp));
    } catch (e) { handleApiError(e); 
        console.error("Story Arch Gen Failed", e);
        return null;
    }
};

export const generateEpisodeOutline = async (
    idea: string, 
    chapterCount: number, 
    hashtags: string[], 
    storyDetails: StoryDetails, 
    preserveSynopsis: boolean = false,
    model: string = 'gemini-3-flash-preview',
    creativityLevel: number = 7
): Promise<ChapterOutline[]> => {
    const prompt = getEpisodeOutlinePrompt(chapterCount, storyDetails);

    try {
        const resp = await callAI(
            [{ role: 'user', content: prompt }],
            model,
            {
                responseMimeType: 'application/json',
                creativityLevel: creativityLevel
            }
        );
        return JSON.parse(cleanJson(resp));
    } catch (e) { handleApiError(e);  return []; }
};

export const continueStoryStream = async (
    currentContent: string, 
    onChunk: (text: string) => void,
    temperature: number = 0.7,
    model: string = 'gemini-3-flash-preview'
): Promise<string> => {
    const prompt = getContinueStoryPrompt(currentContent);
    
    try {
        return await callAI(
            [{ role: 'user', content: prompt }],
            model,
            {
                onChunk,
                temperature
            }
        );
    } catch (e) {
        handleApiError(e);
        throw e;
    }
};

export const refineText = async (
    text: string, 
    instruction: string, 
    model: string = 'gemini-3-flash-preview',
    creativityLevel: number = 7
): Promise<string> => {
    const prompt = getRefineTextPrompt(text, instruction);
    
    try {
        return await callAI(
            [{ role: 'user', content: prompt }],
            model,
            { creativityLevel: creativityLevel }
        );
    } catch (e) {
        handleApiError(e);
        return text;
    }
};

export const analyzeManuscript = async (text: string, model: string = 'gemini-3-flash-preview'): Promise<{title: string, worldview: {title: string, content: string}[], characters: CharacterProfile[]} | null> => {
    const prompt = getManuscriptAnalysisPrompt(text);
    
    try {
        const responseText = await callAI(
            [{ role: 'user', content: prompt }],
            model,
            {
                responseMimeType: 'application/json'
            }
        );
        if (responseText) return JSON.parse(cleanJson(responseText));
        return null;
    } catch(e) { handleApiError(e);  return null; }
};

// Helper for smart chapter sorting
const extractChapterNumber = (title: string): number => {
    const match = title.match(/(\d+)/);
    return match ? parseInt(match[0]) : -1;
};

const sortStoriesByChapter = (stories: SavedStory[]) => {
    if (!Array.isArray(stories)) return [];
    return [...stories].sort((a, b) => {
        const titleA = a.title.toLowerCase();
        const titleB = b.title.toLowerCase();

        // Prologue first
        const isPrologueA = titleA.includes('prologue') || titleA.includes('프롤로그') || titleA.includes('서막');
        const isPrologueB = titleB.includes('prologue') || titleB.includes('프롤로그') || titleB.includes('서막');
        if (isPrologueA && !isPrologueB) return -1;
        if (!isPrologueA && isPrologueB) return 1;

        // Trailer last (usually)
        const isTrailerA = titleA.includes('trailer') || titleA.includes('예고편');
        const isTrailerB = titleB.includes('trailer') || titleB.includes('예고편');
        if (isTrailerA && !isTrailerB) return 1;
        if (!isTrailerA && isTrailerB) return -1;

        const numA = extractChapterNumber(titleA);
        const numB = extractChapterNumber(titleB);

        if (numA !== -1 && numB !== -1) return numA - numB;
        
        // Fallback to creation date
        return (a.createdAt || 0) - (b.createdAt || 0);
    });
};

export const analyzeProjectContext = async (
    stories: SavedStory[],
    model: string = 'gemini-3-flash-preview'
): Promise<{ analysis: string; references: string[] } | null> => {
    if (!Array.isArray(stories) || stories.length === 0) {
        return null;
    }

    // 1. Sort stories chronologically by chapter
    const sortedStories = sortStoriesByChapter(stories);

    // 2. Select the 3 most recent stories to provide context
    const recentStories = (Array.isArray(sortedStories) ? sortedStories : []).slice(-3);

    // 3. Extract the last 2000 characters of each story to build the context sample
    const contextSample = (Array.isArray(recentStories) ? recentStories : [])
        .map((story) => `[Title: ${story.title}]\nContent Segment (End):\n"...${story.content.slice(-2000)}"`)
        .join('\n\n');

    const prompt = getProjectContextAnalysisPrompt(contextSample);

    try {
        const analysisText = await callAI(
            [{ role: 'user', content: prompt }],
            model
        );
        return {
            analysis: analysisText,
            references: recentStories.map((story) => story.title)
        };
    } catch (error: any) {
        console.error(`Context analysis failed with model ${model}:`, error);
        
        // Check if the error is related to permissions or model availability
        const errorMessage = error.message?.toLowerCase() || "";
        const isFallbackEligible = 
            model !== 'gemini-3-flash-preview' && 
            ['403', '404', 'not found', 'forbidden'].some((errStr) => errorMessage.includes(errStr));

        if (isFallbackEligible) {
            console.warn('Attempting fallback to gemini-3-flash-preview for context analysis...');
            try {
                const fallbackText = await callAI(
                    [{ role: 'user', content: prompt }],
                    'gemini-3-flash-preview',
                    {}
                );
                return {
                    analysis: fallbackText,
                    references: recentStories.map((story) => story.title)
                };
            } catch (fallbackError) {
                handleApiError(fallbackError);
                return null;
            }
        }

        handleApiError(error);
        return null;
    }
};

export const chatWithWorldBuilderAIAssistant = async (
    project: any,
    worldItems: any[],
    userMsg: string,
    history: any[],
    model: string = 'gemini-3.1-pro-preview',
    creativityLevel: number = 7
): Promise<{ reply: string, suggestedItem?: { title: string, content: string, type: 'folder' | 'note' } }> => {
    const prompt = `
    You are an AI World Building Assistant for a story project.
    You know everything about the project's context, world settings, and characters.
    
    Project Details:
    Name: ${project?.name || 'Unknown'}
    Context Analysis: ${project?.contextAnalysis || 'None'}
    
    Current World Settings:
    ${JSON.stringify(worldItems, null, 2)}
    
    Characters:
    ${project?.characters || 'None'}
    
    User Message: ${userMsg}
    
    Your Tasks:
    1. Answer any questions the user has about the world, settings, or characters based on the provided context.
    2. If the user asks to expand or create a new setting, generate it.
    3. If the user explicitly asks to "add this setting", "save this", or similar intent to add a new world-building item to their project, provide a \`suggestedItem\` object in your JSON response.
    
    You MUST respond in JSON format with the following structure:
    {
        "reply": "Your conversational response here. Use markdown for formatting.",
        "suggestedItem": {
            "title": "Title of the new setting",
            "content": "Detailed content of the setting",
            "type": "note"
        } // Omit this field if the user is not asking to add/save a setting.
    }
    `;
    
    try {
        const responseText = await callAI(
            [
                ...history.map(h => ({ role: h.role === 'user' ? 'user' : 'model', content: h.content })),
                { role: 'user', content: prompt }
            ],
            model,
            {
                responseMimeType: 'application/json',
                creativityLevel: creativityLevel
            }
        );
        
        if (responseText) {
            const parsed = JSON.parse(cleanJson(responseText));
            return {
                reply: parsed.reply || "응답을 생성하지 못했습니다.",
                suggestedItem: parsed.suggestedItem
            };
        }
        return { reply: "응답을 생성하지 못했습니다." };
    } catch (e) { 
        handleApiError(e); 
        console.error("AI Assistant Error:", e);
        return { reply: "오류가 발생했습니다. 다시 시도해주세요." };
    }
};

export const generateCharacterProfile = async (
    worldview: string, 
    name: string, 
    role: string, 
    extra?: string,
    model: string = 'gemini-3-flash-preview',
    creativityLevel: number = 7
): Promise<CharacterProfile | null> => {
    const prompt = getCharacterProfilePrompt(worldview, name, role, extra);
    
    try {
        const responseText = await callAI(
            [{ role: 'user', content: prompt }],
            model,
            {
                responseMimeType: 'application/json',
                creativityLevel: creativityLevel
            }
        );
        if (responseText) return JSON.parse(cleanJson(responseText));
        return null;
    } catch(e) { handleApiError(e);  return null; }
};

export const generateRelationshipMap = async (
    charactersJson: string,
    model: string = 'gemini-3-flash-preview'
): Promise<CharacterRelationship[]> => {
    const prompt = getRelationshipMapPrompt(charactersJson);
    try {
        const responseText = await callAI(
            [{ role: 'user', content: prompt }],
            model,
            {
                responseMimeType: 'application/json'
            }
        );
        if (responseText) return JSON.parse(cleanJson(responseText));
        return [];
    } catch(e) { handleApiError(e);  return []; }
};

export const chatWithStoryArchitect = async (
    details: StoryDetails | null, 
    userMsg: string, 
    history: any[],
    model: string = 'gemini-3.1-pro-preview'
): Promise<{reply: string, updatedDetails?: StoryDetails}> => {
    const prompt = getStoryArchitectChatPrompt(details, userMsg);
    
    try {
        const responseText = await callAI(
            [
                ...history.map(h => ({ role: h.role === 'user' ? 'user' : 'model', content: h.content })),
                { role: 'user', content: prompt }
            ],
            model,
            {
                responseMimeType: 'application/json'
            }
        );
        
        if (responseText) {
            const parsed = JSON.parse(cleanJson(responseText));
            return {
                reply: parsed.reply || "응답을 생성하지 못했습니다.",
                updatedDetails: parsed.updatedDetails
            };
        }
        return { reply: "응답을 생성하지 못했습니다." };
    } catch (e) {
        handleApiError(e);
        return { reply: "오류가 발생했습니다." };
    }
};

export const chatWithIdeaPartner = async (
    project: Project | null, 
    messages: ChatMessage[], 
    contextAnalysis?: string, 
    styleDescription?: string,
    model: string = 'gemini-3-flash-preview',
    creativityLevel: number = 7
): Promise<string> => {
    const history = messages.map(m => ({ role: m.role, content: m.text }));
    const lastMsg = history.pop();
    
    if (!lastMsg) return "";

    const systemPrompt = getIdeaPartnerSystemPrompt(project, contextAnalysis, styleDescription);
    
    try {
        return await callAI(
            [
                { role: 'system', content: systemPrompt },
                ...history,
                lastMsg
            ],
            model,
            { creativityLevel: creativityLevel }
        );
    } catch (e) {
        handleApiError(e);
        return "죄송합니다. 답변을 생성하는 중에 오류가 발생했습니다.";
    }
};

export const generateSynopsisOptions = async (
    project: Project | null, 
    input: string, 
    contextAnalysis?: string,
    model: string = 'gemini-3-flash-preview',
    creativityLevel: number = 7
): Promise<any[]> => {
    const prompt = getSynopsisOptionsPrompt(input, contextAnalysis);
    try {
        const responseText = await callAI(
            [{ role: 'user', content: prompt }],
            model,
            {
                responseMimeType: 'application/json',
                creativityLevel: creativityLevel
            }
        );
        if (responseText) return JSON.parse(cleanJson(responseText));
        return [];
    } catch(e) { handleApiError(e);  return []; }
};

export const expandDetailedSynopsis = async (
    summary: string, 
    project: Project | null,
    model: string = 'gemini-3.1-pro-preview',
    creativityLevel: number = 7
): Promise<string> => {
    const prompt = getExpandDetailedSynopsisPrompt(summary);
    try {
        return await callAI(
            [{ role: 'user', content: prompt }],
            model,
            { creativityLevel: creativityLevel }
        );
    } catch (e) {
        handleApiError(e);
        throw e;
    }
};

export const organizeWorldviewFromChat = async (
    chatText: string,
    model: string = 'gemini-3-flash-preview',
    creativityLevel: number = 7
): Promise<WorldItem[]> => {
    const prompt = getOrganizeWorldviewPrompt(chatText);
    try {
        const responseText = await callAI(
            [{ role: 'user', content: prompt }],
            model,
            {
                responseMimeType: 'application/json',
                creativityLevel: creativityLevel
            }
        );
        if (responseText) {
            const items = JSON.parse(cleanJson(responseText));
            return items.map((i: any) => ({ ...i, id: Date.now().toString() + Math.random(), type: 'note', createdAt: Date.now() }));
        }
        return [];
    } catch(e) { handleApiError(e);  return []; }
};

export const extractCharacterFromChat = async (
    chatText: string,
    model: string = 'gemini-3-flash-preview'
): Promise<CharacterProfile | null> => {
    const prompt = getExtractCharacterPrompt(chatText);
    try {
        const responseText = await callAI(
            [{ role: 'user', content: prompt }],
            model,
            {
                responseMimeType: 'application/json'
            }
        );
        if (responseText) return JSON.parse(cleanJson(responseText));
        return null;
    } catch(e) { handleApiError(e);  return null; }
};

export const analyzeWritingStyle = async (
    text: string,
    model: string = 'gemini-3-flash-preview'
): Promise<string> => {
    const prompt = getWritingStyleAnalysisPrompt(text);
    try {
        return await callAI(
            [{ role: 'user', content: prompt }],
            model
        );
    } catch (e) {
        handleApiError(e);
        throw e;
    }
};

export const generateProjectAssistantResponse = async (
    query: string, 
    projects: Project[], 
    selectedProjectId: string | null, 
    history: any[],
    model: string = 'gemini-3-flash-preview'
): Promise<string> => {
    const contextProject = selectedProjectId ? projects.find(p => p.id === selectedProjectId) : null;
    const context = contextProject 
        ? `Project: ${contextProject.name}\nWorld: ${contextProject.worldview}\nChars: ${contextProject.characters}` 
        : `Projects: ${projects.map(p => p.name).join(', ')}`;
        
    const prompt = getProjectAssistantPrompt(context, query);
    
    try {
        return await callAI(
            [
                { role: 'system', content: "You are a helpful writing assistant for NovelCraft." },
                ...history.map(m => ({ role: m.role === 'model' ? 'assistant' : m.role, content: m.text })),
                { role: 'user', content: prompt }
            ],
            model
        );
    } catch (e) {
        handleApiError(e);
        console.error("Assistant response failed", e);
        return "죄송합니다. 답변을 생성하는 중에 오류가 발생했습니다.";
    }
};

export const parseRawOutline = (text: string): ChapterOutline[] => {
    // Basic parser placeholder, usually implemented with AI in generateEpisodeOutline
    return [];
};
