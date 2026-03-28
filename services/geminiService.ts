
// ... existing imports ...
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
    getProjectAssistantPrompt
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
    if (msg.includes('403') || msg.includes('PERMISSION_DENIED') || msg.includes('forbidden') || msg.includes('Forbidden')) {
        const now = Date.now();
        if (now - lastErrorTime > 5000) {
            lastErrorTime = now;
            alert(`API 접근 권한 오류(403)가 발생했습니다.\n\n[안내사항]\n1. 입력하신 API 키가 유효한지 확인해주세요.\n2. 해당 API 키에 필요한 권한이 부여되어 있는지 확인해주세요.\n3. 무료 할당량을 초과했거나 결제 정보가 필요한 상태일 수 있습니다.\n4. 특정 국가/지역에서는 API 접근이 제한될 수 있습니다.\n\n상세 오류: ${msg}`);
        }
    }
};

export const AI_MODELS = [
    { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', provider: 'gemini' },
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
  temperature: number = 0.7
): Promise<string> => {
  try {
    const effectiveApiKey = (import.meta.env.VITE_GROK_API_KEY || '').trim();
    if (!effectiveApiKey) {
      throw new Error("Grok API Key is missing. Please set VITE_GROK_API_KEY in your environment.");
    }
    const effectiveModel = model || 'grok-3';

    notifyModelUsage('xAI Grok', effectiveModel);

    const response = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${effectiveApiKey}`
      },
      body: JSON.stringify({
        messages: messages,
        model: effectiveModel,
        stream: true, 
        temperature: temperature,
        max_tokens: 8192 
      })
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Grok API Error: ${response.status} ${response.statusText} - ${errorText}`);
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
          } catch (e) { handleApiError(e); 
            // Ignore incomplete chunks
          }
        }
      }
    }
    return fullText;
  } catch (e) { handleApiError(e); 
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
    const effectiveApiKey = (import.meta.env.VITE_MAGNUM_API_KEY || '').trim();
    if (!effectiveApiKey) {
      throw new Error("Magnum API Key is missing. Please set VITE_MAGNUM_API_KEY in your environment.");
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
        },
      });

      // The SDK returns an EventStream for streaming
      // We need to check if it's an EventStream
      if ('[Symbol.asyncIterator]' in response) {
        let fullText = "";
        for await (const chunk of response) {
          const content = chunk.choices?.[0]?.delta?.content || "";
          if (content) {
            fullText += content;
            onChunk(content);
          }
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
  model: string = 'gemini-3-flash-preview'
): Promise<RefinedSynopsisCard[]> => {
  
  let contextData = "";
  if (project) {
    contextData += `=== PROJECT WORLDVIEW ===\n${parseWorldviewContext(project.worldview)}\n\n=== CHARACTERS ===\n${project.characters}\n`;
  }
  if (preAnalyzedContext) {
      contextData += `=== PROJECT STORY CONTEXT ===\n${preAnalyzedContext}\n`;
  } else if (recentStories.length > 0) {
      const sortedStories = [...recentStories].sort((a, b) => (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt)).slice(0, 5).reverse(); 
      contextData += `=== RECENT STORY FLOW ===\n${sortedStories.map((s, i) => `[Ep ${i+1}: ${s.title}]\n${s.content.slice(-2000)}`).join('\n\n')}\n`;
  }

  const structureInstruction = targetChapterCount > 1
    ? `**Structure**: You MUST split the narrative into **EXACTLY ${targetChapterCount}** distinct chapters/sequences. Expand the user's input to fill these chapters if necessary.`
    : `**Structure**: Check for user-defined chapter markers (e.g., "Chapter 1", "1화"). If the user did NOT explicitly mark chapters, you MUST return **EXACTLY ONE** chapter containing the entire story. Do NOT split it into multiple chapters arbitrarily.`;

  const prompt = getGeneralSynopsisPrompt(rawSynopsis, contextData, structureInstruction, styleGuide);

  try {
    const effectiveModel = model === 'gemini-3-flash-preview' ? currentGlobalModel : model;
    const result = await callAI(
        [{ role: 'user', content: prompt }],
        effectiveModel,
        {
            responseMimeType: 'application/json'
        }
    );
    return JSON.parse(cleanJson(result)) as RefinedSynopsisCard[];
  } catch (e) { handleApiError(e); 
    console.error("Synopsis refinement failed", e);
    return [];
  }
};

export const analyzeSynopsisReference = async (
    text: string, 
    model: string = 'gemini-3-flash-preview'
): Promise<string> => {
    const prompt = getReferenceAnalysisPrompt(text);
    try {
        const effectiveModel = model === 'gemini-3-flash-preview' ? currentGlobalModel : model;
        return await callAI(
            [{ role: 'user', content: prompt }],
            effectiveModel
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
        const effectiveModel = model === 'gemini-3-flash-preview' ? currentGlobalModel : model;
        return await callAI(
            [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: promptContext }
            ],
            effectiveModel,
            {
                onChunk,
                temperature: 0.7
            }
        );
    } catch (e: any) {
        handleApiError(e);
        console.error(`AI generation failed with model ${model}:`, e);
        
        // Fallback logic for Gemini only
        if (!isGrokModel(model) && !isMagnumModel(model) && (e.message?.includes('403') || e.message?.includes('404') || e.message?.includes('not found'))) {
            console.warn(`Falling back to gemini-3-flash-preview due to error with ${model}`);
            return await callAI(
                [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: promptContext }
                ],
                'gemini-3-flash-preview',
                { onChunk, temperature: 0.7 }
            );
        }
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
    const isStream = !!onChunk;
    const action = isStream ? "streamGenerateContent?alt=sse" : "generateContent";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:${action}${isStream ? '&' : '?'}key=${apiKey}`;

    const userMsgs = messages.filter(m => m.role !== 'system');
    const prompt = userMsgs.map(m => m.content).join("\n\n");

    const body: any = {
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
            temperature: config.temperature || 0.7,
            maxOutputTokens: config.maxOutputTokens || 8192,
            responseMimeType: config.responseMimeType
        },
        safetySettings: SAFETY_SETTINGS
    };

    if (config.systemInstruction) {
        body.systemInstruction = {
            parts: [{ text: config.systemInstruction }]
        };
    }

    notifyModelUsage('Google Gemini', model);

    const response = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gemini API Error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    if (isStream) {
        if (!response.body) throw new Error("Gemini API response body is empty");
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullText = "";
        let buffer = "";

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
                if (line.trim().startsWith("data: ")) {
                    const dataStr = line.trim().substring(6);
                    try {
                        const data = JSON.parse(dataStr);
                        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
                        if (text) {
                            fullText += text;
                            onChunk(text);
                        }
                    } catch (e) {
                        // Ignore parse errors for incomplete chunks
                    }
                }
            }
        }
        return fullText;
    } else {
        const data = await response.json();
        return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    }
};

export const callAI = async (
    messages: { role: string, content: string }[],
    model: string,
    options: {
        onChunk?: (text: string) => void,
        temperature?: number,
        responseMimeType?: string
    } = {}
): Promise<string> => {
    const isGrok = isGrokModel(model);
    const isMagnum = isMagnumModel(model);

    if (isGrok) {
        try {
            return await callGrokAPI(messages, model, '', options.onChunk, options.temperature);
        } catch (e) {
            console.error("Grok API failed, falling back to Gemini", e);
            return await callAI(messages, 'gemini-3-flash-preview', options);
        }
    } else if (isMagnum) {
        // Magnum (OpenRouter) does not fallback to Gemini as per user request
        return await callMagnumAPI(messages, model, '', options.onChunk, options.temperature);
    } else {
        const key = import.meta.env.VITE_GEMINI_API_KEY || "";
        if (!key) {
            throw new Error("Gemini API Key is missing. Please set VITE_GEMINI_API_KEY in your environment.");
        }
        
        const systemMsg = messages.find(m => m.role === 'system')?.content;
        
        const config: any = { 
            temperature: options.temperature,
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
        const effectiveModel = model === 'gemini-3-flash-preview' ? currentGlobalModel : model;
        return await callAI(
            [{ role: 'user', content: prompt }],
            effectiveModel,
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
    model: string = 'gemini-3-flash-preview'
): Promise<StoryDetails | null> => {
    const prompt = getStoryArchPrompt(idea, analysisContext, preserveSynopsis, chapterCount);

    try {
        const effectiveModel = model === 'gemini-3-flash-preview' ? currentGlobalModel : model;
        const resp = await callAI(
            [{ role: 'user', content: prompt }],
            effectiveModel,
            {
                responseMimeType: 'application/json'
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
    model: string = 'gemini-3-flash-preview'
): Promise<ChapterOutline[]> => {
    const prompt = getEpisodeOutlinePrompt(chapterCount, storyDetails);

    try {
        const effectiveModel = model === 'gemini-3-flash-preview' ? currentGlobalModel : model;
        const resp = await callAI(
            [{ role: 'user', content: prompt }],
            effectiveModel,
            {
                responseMimeType: 'application/json'
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
        const effectiveModel = model === 'gemini-3-flash-preview' ? currentGlobalModel : model;
        return await callAI(
            [{ role: 'user', content: prompt }],
            effectiveModel,
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
    model: string = 'gemini-3-flash-preview'
): Promise<string> => {
    const prompt = getRefineTextPrompt(text, instruction);
    
    try {
        const effectiveModel = model === 'gemini-3-flash-preview' ? currentGlobalModel : model;
        return await callAI(
            [{ role: 'user', content: prompt }],
            effectiveModel
        );
    } catch (e) {
        handleApiError(e);
        return text;
    }
};

export const analyzeManuscript = async (text: string, model: string = 'gemini-3-flash-preview'): Promise<{title: string, worldview: {title: string, content: string}[], characters: CharacterProfile[]} | null> => {
    const prompt = getManuscriptAnalysisPrompt(text);
    
    try {
        const effectiveModel = model === 'gemini-3-flash-preview' ? currentGlobalModel : model;
        const responseText = await callAI(
            [{ role: 'user', content: prompt }],
            effectiveModel,
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
    if (!stories || stories.length === 0) {
        return null;
    }

    // 1. Sort stories chronologically by chapter
    const sortedStories = sortStoriesByChapter(stories);

    // 2. Select the 3 most recent stories to provide context
    const recentStories = sortedStories.slice(-3);

    // 3. Extract the last 2000 characters of each story to build the context sample
    const contextSample = recentStories
        .map((story) => `[Title: ${story.title}]\nContent Segment (End):\n"...${story.content.slice(-2000)}"`)
        .join('\n\n');

    const prompt = getProjectContextAnalysisPrompt(contextSample);

    try {
        const effectiveModel = model === 'gemini-3-flash-preview' ? currentGlobalModel : model;
        const analysisText = await callAI(
            [{ role: 'user', content: prompt }],
            effectiveModel
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
    model: string = 'gemini-3.1-pro-preview'
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
                responseMimeType: 'application/json'
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
    model: string = 'gemini-3-flash-preview'
): Promise<CharacterProfile | null> => {
    const prompt = getCharacterProfilePrompt(worldview, name, role, extra);
    
    try {
        const effectiveModel = model === 'gemini-3-flash-preview' ? currentGlobalModel : model;
        const responseText = await callAI(
            [{ role: 'user', content: prompt }],
            effectiveModel,
            {
                responseMimeType: 'application/json'
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
        const effectiveModel = model === 'gemini-3-flash-preview' ? currentGlobalModel : model;
        const responseText = await callAI(
            [{ role: 'user', content: prompt }],
            effectiveModel,
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
    model: string = 'gemini-3-flash-preview'
): Promise<string> => {
    const history = messages.map(m => ({ role: m.role, content: m.text }));
    const lastMsg = history.pop();
    
    if (!lastMsg) return "";

    const systemPrompt = getIdeaPartnerSystemPrompt(project, contextAnalysis, styleDescription);
    
    try {
        const effectiveModel = model === 'gemini-3-flash-preview' ? currentGlobalModel : model;
        return await callAI(
            [
                { role: 'system', content: systemPrompt },
                ...history,
                lastMsg
            ],
            effectiveModel
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
    model: string = 'gemini-3-flash-preview'
): Promise<any[]> => {
    const prompt = getSynopsisOptionsPrompt(input, contextAnalysis);
    try {
        const effectiveModel = model === 'gemini-3-flash-preview' ? currentGlobalModel : model;
        const responseText = await callAI(
            [{ role: 'user', content: prompt }],
            effectiveModel,
            {
                responseMimeType: 'application/json'
            }
        );
        if (responseText) return JSON.parse(cleanJson(responseText));
        return [];
    } catch(e) { handleApiError(e);  return []; }
};

export const expandDetailedSynopsis = async (
    summary: string, 
    project: Project | null,
    model: string = 'gemini-3.1-pro-preview'
): Promise<string> => {
    const prompt = getExpandDetailedSynopsisPrompt(summary);
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

export const organizeWorldviewFromChat = async (
    chatText: string,
    model: string = 'gemini-3-flash-preview'
): Promise<WorldItem[]> => {
    const prompt = getOrganizeWorldviewPrompt(chatText);
    try {
        const effectiveModel = model === 'gemini-3-flash-preview' ? currentGlobalModel : model;
        const responseText = await callAI(
            [{ role: 'user', content: prompt }],
            effectiveModel,
            {
                responseMimeType: 'application/json'
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
        const effectiveModel = model === 'gemini-3-flash-preview' ? currentGlobalModel : model;
        const responseText = await callAI(
            [{ role: 'user', content: prompt }],
            effectiveModel,
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
        const effectiveModel = model === 'gemini-3-flash-preview' ? currentGlobalModel : model;
        return await callAI(
            [{ role: 'user', content: prompt }],
            effectiveModel
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
        const effectiveModel = model === 'gemini-3-flash-preview' ? currentGlobalModel : model;
        return await callAI(
            [
                { role: 'system', content: "You are a helpful writing assistant for NovelCraft." },
                ...history.map(m => ({ role: m.role === 'model' ? 'assistant' : m.role, content: m.text })),
                { role: 'user', content: prompt }
            ],
            effectiveModel
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
