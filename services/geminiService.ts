
// ... existing imports ...
import { GoogleGenAI, HarmCategory, HarmBlockThreshold, Type, GenerateContentResponse } from "@google/genai";
import { NovelSettings, Project, MindMapNode, CharacterRelationship, CharacterProfile, WorldItem, ChapterOutline, StoryDetails, ChatMessage, SavedStory, RefinedSynopsisCard, DEFAULT_SETTINGS } from "../types.ts";
import { 
    AI_PROMPTS, 
    getGeneralSynopsisPrompt, 
    getMatureSynopsisPrompt, 
    getReferenceAnalysisPrompt,
    getRawStoryIdeaAnalysisPrompt,
    getManuscriptAnalysisPrompt,
    getProjectContextAnalysisPrompt,
    getWritingStyleAnalysisPrompt,
    getMatureStyleAnalysisPrompt,
    MATURE_SYSTEM_PROMPT,
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
let currentGeminiApiKey: string | undefined;

export const setGeminiApiKey = (key: string | undefined) => {
    currentGeminiApiKey = key;
};

const getAiClient = () => {
    const key = currentGeminiApiKey || process.env.GEMINI_API_KEY;
    if (!key) throw new Error("Gemini API Key is missing. Please register it in settings.");
    return new GoogleGenAI({ apiKey: key });
};

// Re-export AI_PROMPTS for components to use
export { AI_PROMPTS };


const SAFETY_SETTINGS = [
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE }
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

export const GEMINI_MODELS = [
    { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash' },
    { id: 'gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro' },
];

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
    const effectiveApiKey = apiKey || DEFAULT_SETTINGS.grokApiKey || '';
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

// --- Synopsis Refiner (Hybrid: Gemini/Grok based on isMature) ---
export const refineSynopsisWithContext = async (
  rawSynopsis: string,
  project: Project | null,
  recentStories: SavedStory[],
  preAnalyzedContext?: string,
  styleGuide?: string,
  isMatureOverride: boolean = false,
  grokOptions?: { apiKey: string, model: string },
  targetChapterCount: number = 1,
  model: string = 'gemini-3-flash-preview'
): Promise<RefinedSynopsisCard[]> => {
  
  const isMature = isMatureOverride || project?.settings?.isMature || (styleGuide && styleGuide.includes("19+"));

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

  const prompt = isMature 
    ? getMatureSynopsisPrompt(rawSynopsis, contextData, structureInstruction, styleGuide)
    : getGeneralSynopsisPrompt(rawSynopsis, contextData, structureInstruction, styleGuide);

  try {
    const ai = getAiClient();
    notifyModelUsage(isMature ? 'xAI Grok' : 'Gemini', isMature ? (grokOptions?.model || 'grok-3') : model);
    if (isMature) {
        const grokResponse = await callGrokAPI(
            [{role: 'user', content: prompt}],
            grokOptions?.model || DEFAULT_SETTINGS.grokModel || 'grok-3',
            grokOptions?.apiKey || DEFAULT_SETTINGS.grokApiKey || ''
        );
        return JSON.parse(cleanJson(grokResponse)) as RefinedSynopsisCard[];
    } else {
        const response = await ai.models.generateContent({
          model: model,
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          config: {
            responseMimeType: 'application/json',
            safetySettings: SAFETY_SETTINGS
          }
        });
        if (response.text) return JSON.parse(cleanJson(response.text)) as RefinedSynopsisCard[];
        return [];
    }
  } catch (e) { handleApiError(e); 
    console.error("Synopsis refinement failed", e);
    return [];
  }
};

export const analyzeSynopsisReference = async (text: string, isMature: boolean): Promise<string> => {
  const prompt = getReferenceAnalysisPrompt(text, isMature);

  try {
      const ai = getAiClient();
      notifyModelUsage('Gemini', 'gemini-3-flash-preview');
      const response = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: [{ role: 'user', parts: [{ text: prompt }] }]
      ,
            config: { safetySettings: SAFETY_SETTINGS }});
      return response.text || "";
  } catch (e) { handleApiError(e); 
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
    storyAnalysis?: string
): Promise<string> => {
    // Only set isMature for Grok if toggle is ON or style is strictly 'mature'. 
    // Mixed style should use Gemini unless user forces 19+ mode.
    const isMature = settings.isMature || (settings.activeStyle === 'mature');
    
    const promptContext = getNovelContextPrompt(
        project, 
        settings, 
        structuralGuide, 
        contextAnalysis, 
        storyAnalysis, 
        previousContent
    );

    const systemPrompt = isMature ? MATURE_SYSTEM_PROMPT : GENERAL_SYSTEM_PROMPT;
    
    // Choose Provider
    const geminiModel = settings.geminiModel || 'gemini-3-flash-preview';
    notifyModelUsage(isMature ? 'xAI Grok' : 'Gemini', isMature ? (settings.grokModel || 'grok-3') : geminiModel);
    
    if (isMature) {
        // Use Grok for Mature
        return await callGrokAPI(
            [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: promptContext }
            ],
            settings.grokModel || 'grok-3',
            settings.grokApiKey || DEFAULT_SETTINGS.grokApiKey || '',
            onChunk
        );
    } else {
        // Use Gemini for General
    try {
        const ai = getAiClient();
        const response = await ai.models.generateContentStream({
            model: geminiModel,
            contents: [
                { role: 'user', parts: [{ text: systemPrompt + "\n\n" + promptContext }] }
            ],
            config: { safetySettings: SAFETY_SETTINGS,
                maxOutputTokens: 8192,
            }
        });
        
        let fullText = "";
        for await (const chunk of response) {
            const text = chunk.text; // Access property, do not call as method
            if (text) {
                fullText += text;
                if (onChunk) onChunk(text);
            }
        }
        return fullText;
    } catch (e: any) { handleApiError(e); 
        console.error(`Gemini generation failed with model ${geminiModel}:`, e);
        
        // Fallback logic for 403/404 or other errors
        if (e.message?.includes('403') || e.message?.includes('404') || e.message?.includes('not found')) {
            console.warn(`Falling back to gemini-3-flash-preview due to error with ${geminiModel}`);
            notifyModelUsage('Gemini', 'gemini-3-flash-preview (Fallback)');
            
            const ai = getAiClient();
            const fallbackResponse = await ai.models.generateContentStream({
                model: 'gemini-3-flash-preview',
                contents: [
                    { role: 'user', parts: [{ text: systemPrompt + "\n\n" + promptContext }] }
                ],
                config: { safetySettings: SAFETY_SETTINGS,
                    maxOutputTokens: 8192,
                }
            });
            
            let fullText = "";
            for await (const chunk of fallbackResponse) {
                const text = chunk.text;
                if (text) {
                    fullText += text;
                    if (onChunk) onChunk(text);
                }
            }
            return fullText;
        }
        throw e;
    }
    }
};

export const analyzeRawStoryIdea = async (
    idea: string, 
    chapterCount: number, 
    pov: string, 
    isMature: boolean,
    grokOptions?: { apiKey: string, model: string }
): Promise<string> => {
    const prompt = getRawStoryIdeaAnalysisPrompt(idea, chapterCount, pov, isMature);

    notifyModelUsage(isMature ? 'xAI Grok' : 'Gemini', isMature ? (grokOptions?.model || 'grok-3') : 'gemini-3-flash-preview');
    if (isMature) {
        return await callGrokAPI(
            [{ role: 'user', content: prompt }],
            grokOptions?.model || 'grok-3',
            grokOptions?.apiKey || DEFAULT_SETTINGS.grokApiKey || ''
        );
    } else {
        const ai = getAiClient();
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: [{ role: 'user', parts: [{ text: prompt }] }]
        ,
            config: { safetySettings: SAFETY_SETTINGS }});
        return response.text || "";
    }
};

export const generateStoryArch = async (
    idea: string, 
    chapterCount: number, 
    isMature: boolean, 
    analysisContext?: string, 
    preserveSynopsis: boolean = false,
    grokOptions?: { apiKey: string, model: string }
): Promise<StoryDetails | null> => {
    const prompt = getStoryArchPrompt(idea, analysisContext, preserveSynopsis, chapterCount);

    try {
        const ai = getAiClient();
        notifyModelUsage(isMature ? 'xAI Grok' : 'Gemini', isMature ? (grokOptions?.model || 'grok-3') : 'gemini-3-flash-preview');
        if (isMature) {
             const resp = await callGrokAPI(
                [{ role: 'user', content: prompt }],
                grokOptions?.model || 'grok-3',
                grokOptions?.apiKey || DEFAULT_SETTINGS.grokApiKey || ''
            );
            return JSON.parse(cleanJson(resp));
        } else {
            const response = await ai.models.generateContent({
                model: 'gemini-3-flash-preview', // Updated to 3 Flash
                contents: [{ role: 'user', parts: [{ text: prompt }] }],
                config: { safetySettings: SAFETY_SETTINGS, responseMimeType: 'application/json' }
            });
            if (response.text) return JSON.parse(cleanJson(response.text));
        }
        return null;
    } catch (e) { handleApiError(e); 
        console.error("Story Arch Gen Failed", e);
        return null;
    }
};

export const generateEpisodeOutline = async (
    idea: string, 
    chapterCount: number, 
    isMature: boolean, 
    hashtags: string[], 
    storyDetails: StoryDetails, 
    preserveSynopsis: boolean = false,
    grokOptions?: { apiKey: string, model: string }
): Promise<ChapterOutline[]> => {
    const prompt = getEpisodeOutlinePrompt(chapterCount, storyDetails);

    try {
        const ai = getAiClient();
        notifyModelUsage(isMature ? 'xAI Grok' : 'Gemini', isMature ? (grokOptions?.model || 'grok-3') : 'gemini-3-flash-preview');
        if (isMature) {
             const resp = await callGrokAPI(
                [{ role: 'user', content: prompt }],
                grokOptions?.model || 'grok-3',
                grokOptions?.apiKey || DEFAULT_SETTINGS.grokApiKey || ''
            );
            return JSON.parse(cleanJson(resp));
        } else {
            const response = await ai.models.generateContent({
                model: 'gemini-3-flash-preview', // Updated to 3 Flash
                contents: [{ role: 'user', parts: [{ text: prompt }] }],
                config: { safetySettings: SAFETY_SETTINGS, responseMimeType: 'application/json' }
            });
            if (response.text) return JSON.parse(cleanJson(response.text));
        }
        return [];
    } catch (e) { handleApiError(e);  return []; }
};

export const continueStoryStream = async (
    currentContent: string, 
    onChunk: (text: string) => void,
    temperature: number = 0.7
): Promise<string> => {
    const prompt = getContinueStoryPrompt(currentContent);
    const model = 'gemini-3-flash-preview';
    
    const ai = getAiClient();
    notifyModelUsage('Gemini', model);
    const response = await ai.models.generateContentStream({
        model: model,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: { safetySettings: SAFETY_SETTINGS, temperature }
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
};

export const refineText = async (
    text: string, 
    instruction: string, 
    isMature: boolean = false
): Promise<string> => {
    const prompt = getRefineTextPrompt(text, instruction);
    
    const model = 'gemini-3-flash-preview'; // Updated to gemini-3-flash-preview
    const ai = getAiClient();
    notifyModelUsage('Gemini', model);
    const response = await ai.models.generateContent({
        model: model,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: {
            safetySettings: SAFETY_SETTINGS
        }
    });
    return response.text || text;
};

export const analyzeManuscript = async (text: string): Promise<{title: string, worldview: {title: string, content: string}[], characters: CharacterProfile[]} | null> => {
    const prompt = getManuscriptAnalysisPrompt(text);
    
    try {
        const ai = getAiClient();
        notifyModelUsage('Gemini', 'gemini-3-flash-preview');
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            config: { safetySettings: SAFETY_SETTINGS, responseMimeType: 'application/json' }
        });
        if (response.text) return JSON.parse(cleanJson(response.text));
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

export const analyzeProjectContext = async (stories: SavedStory[], model: string = 'gemini-3-flash-preview'): Promise<{analysis: string, references: string[]} | null> => {
    if (stories.length === 0) return null;
    
    // 1. Smart Sort by Chapter Logic
    const sortedStories = sortStoriesByChapter(stories);
    
    // 2. Take the last 3 stories (Latest 3 in chronological order)
    const recentThree = sortedStories.slice(-3);
    
    // 3. Format for prompt
    const contentSample = recentThree.map((s) => `
[Title: ${s.title}]
Content Segment (End):
"...${s.content.slice(-2000)}" 
`).join('\n\n');
    
    const prompt = getProjectContextAnalysisPrompt(contentSample);
    
    try {
        const ai = getAiClient();
        notifyModelUsage('Gemini', model);
        const response = await ai.models.generateContent({
            model: model,
            contents: [{ role: 'user', parts: [{ text: prompt }] }]
        ,
            config: { safetySettings: SAFETY_SETTINGS }});
        return {
            analysis: response.text || "",
            references: recentThree.map(s => s.title) // Return titles of used stories
        };
    } catch(e: any) { handleApiError(e);  
        console.error(`Context analysis failed with model ${model}:`, e);
        if (model !== 'gemini-3-flash-preview' && (e.message?.includes('403') || e.message?.includes('404') || e.message?.includes('not found'))) {
             try {
                console.warn(`Falling back to gemini-3-flash-preview for context analysis`);
                notifyModelUsage('Gemini', 'gemini-3-flash-preview (Fallback)');
                const ai = getAiClient();
                const fallbackResponse = await ai.models.generateContent({
                    model: 'gemini-3-flash-preview',
                    contents: [{ role: 'user', parts: [{ text: prompt }] }]
                ,
            config: { safetySettings: SAFETY_SETTINGS }});
                return {
                    analysis: fallbackResponse.text || "",
                    references: recentThree.map(s => s.title)
                };
             } catch (fallbackError) { handleApiError(fallbackError); 
                 return null;
             }
        }
        return null; 
    }
};

export const chatWithWorldBuilderAIAssistant = async (
    project: any,
    worldItems: any[],
    userMsg: string,
    history: any[]
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
        const ai = getAiClient();
        notifyModelUsage('Gemini', 'gemini-3.1-pro-preview');
        const response = await ai.models.generateContent({
            model: 'gemini-3.1-pro-preview',
            contents: [
                ...history.map(h => ({ role: h.role === 'user' ? 'user' : 'model', parts: [{ text: h.content }] })),
                { role: 'user', parts: [{ text: prompt }] }
            ],
            config: { safetySettings: SAFETY_SETTINGS, responseMimeType: 'application/json' }
        });
        
        if (response.text) {
            const parsed = JSON.parse(cleanJson(response.text));
            return {
                reply: parsed.reply || "응답을 생성하지 못했습니다.",
                suggestedItem: parsed.suggestedItem
            };
        }
        return { reply: "응답을 생성하지 못했습니다." };
    } catch (e) { handleApiError(e); 
        console.error("AI Assistant Error:", e);
        return { reply: "오류가 발생했습니다. 다시 시도해주세요." };
    }
};

export const generateCharacterProfile = async (worldview: string, name: string, role: string, extra?: string): Promise<CharacterProfile | null> => {
    const prompt = getCharacterProfilePrompt(worldview, name, role, extra);
    
    try {
        const ai = getAiClient();
        notifyModelUsage('Gemini', 'gemini-3-flash-preview');
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            config: { safetySettings: SAFETY_SETTINGS, responseMimeType: 'application/json' }
        });
        if (response.text) return JSON.parse(cleanJson(response.text));
        return null;
    } catch(e) { handleApiError(e);  return null; }
};

export const generateRelationshipMap = async (charactersJson: string): Promise<CharacterRelationship[]> => {
    const prompt = getRelationshipMapPrompt(charactersJson);
    try {
        const ai = getAiClient();
        notifyModelUsage('Gemini', 'gemini-3-flash-preview');
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            config: { safetySettings: SAFETY_SETTINGS, responseMimeType: 'application/json' }
        });
        if (response.text) return JSON.parse(cleanJson(response.text));
        return [];
    } catch(e) { handleApiError(e);  return []; }
};

export const chatWithStoryArchitect = async (details: StoryDetails | null, userMsg: string, history: any[]): Promise<{reply: string, updatedDetails?: StoryDetails}> => {
    const prompt = getStoryArchitectChatPrompt(details, userMsg);
    
    const ai = getAiClient();
    notifyModelUsage('Gemini', 'gemini-3.1-pro-preview');
    const response = await ai.models.generateContent({
        model: 'gemini-3.1-pro-preview',
        contents: [{ role: 'user', parts: [{ text: prompt }] }]
    ,
            config: { safetySettings: SAFETY_SETTINGS }});
    
    const text = response.text || "";
    let updatedDetails = undefined;
    
    if (text.includes('```json')) {
        const jsonStr = cleanJson(text.split('```json')[1].split('```')[0]);
        try { updatedDetails = JSON.parse(jsonStr); } catch(e) { handleApiError(e); }
    }
    
    return { reply: text, updatedDetails };
};

export const chatWithIdeaPartner = async (project: Project | null, messages: ChatMessage[], contextAnalysis?: string, styleDescription?: string): Promise<string> => {
    const history = messages.map(m => ({ role: m.role, parts: [{ text: m.text }] }));
    const lastMsg = history.pop();
    
    if (!lastMsg) return "";

    const systemPrompt = getIdeaPartnerSystemPrompt(project, contextAnalysis, styleDescription);
    
    const ai = getAiClient();
    notifyModelUsage('Gemini', 'gemini-3-flash-preview');
    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [
            { role: 'user', parts: [{ text: systemPrompt }] }, // Inject system prompt as first user message for context
            ...history, 
            lastMsg
        ]
    ,
            config: { safetySettings: SAFETY_SETTINGS }});
    
    return response.text || "";
};

export const generateSynopsisOptions = async (project: Project | null, input: string, contextAnalysis?: string): Promise<any[]> => {
    const prompt = getSynopsisOptionsPrompt(input, contextAnalysis);
    try {
        const ai = getAiClient();
        notifyModelUsage('Gemini', 'gemini-3-flash-preview');
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            config: { safetySettings: SAFETY_SETTINGS, responseMimeType: 'application/json' }
        });
        if (response.text) return JSON.parse(cleanJson(response.text));
        return [];
    } catch(e) { handleApiError(e);  return []; }
};

export const expandDetailedSynopsis = async (summary: string, project: Project | null): Promise<string> => {
    const prompt = getExpandDetailedSynopsisPrompt(summary);
    const ai = getAiClient();
    notifyModelUsage('Gemini', 'gemini-3.1-pro-preview');
    const response = await ai.models.generateContent({
        model: 'gemini-3.1-pro-preview',
        contents: [{ role: 'user', parts: [{ text: prompt }] }]
    ,
            config: { safetySettings: SAFETY_SETTINGS }});
    return response.text || "";
};

export const organizeWorldviewFromChat = async (chatText: string): Promise<WorldItem[]> => {
    const prompt = getOrganizeWorldviewPrompt(chatText);
    try {
        const ai = getAiClient();
        notifyModelUsage('Gemini', 'gemini-3-flash-preview');
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            config: { safetySettings: SAFETY_SETTINGS, responseMimeType: 'application/json' }
        });
        if (response.text) {
            const items = JSON.parse(cleanJson(response.text));
            return items.map((i: any) => ({ ...i, id: Date.now().toString() + Math.random(), type: 'note', createdAt: Date.now() }));
        }
        return [];
    } catch(e) { handleApiError(e);  return []; }
};

export const extractCharacterFromChat = async (chatText: string): Promise<CharacterProfile | null> => {
    const prompt = getExtractCharacterPrompt(chatText);
    try {
        const ai = getAiClient();
        notifyModelUsage('Gemini', 'gemini-3-flash-preview');
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            config: { safetySettings: SAFETY_SETTINGS, responseMimeType: 'application/json' }
        });
        if (response.text) return JSON.parse(cleanJson(response.text));
        return null;
    } catch(e) { handleApiError(e);  return null; }
};

export const analyzeWritingStyle = async (text: string): Promise<string> => {
    const prompt = getWritingStyleAnalysisPrompt(text);
    const ai = getAiClient();
    notifyModelUsage('Gemini', 'gemini-3-flash-preview');
    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [{ role: 'user', parts: [{ text: prompt }] }]
    ,
            config: { safetySettings: SAFETY_SETTINGS }});
    return response.text || "";
};

export const analyzeMatureStyle = async (text: string, grokOptions?: { apiKey: string, model: string }): Promise<string> => {
    const prompt = getMatureStyleAnalysisPrompt(text);
    if (grokOptions) {
        return await callGrokAPI([{ role: 'user', content: prompt }], grokOptions.model, grokOptions.apiKey);
    }
    return analyzeWritingStyle(text);
};

export const analyzeMixedStyle = async (text: string, grokOptions?: { apiKey: string, model: string }): Promise<string> => {
    return analyzeMatureStyle(text, grokOptions);
};

export const generateProjectAssistantResponse = async (query: string, projects: Project[], selectedProjectId: string | null, history: any[]): Promise<string> => {
    const contextProject = selectedProjectId ? projects.find(p => p.id === selectedProjectId) : null;
    const context = contextProject 
        ? `Project: ${contextProject.name}\nWorld: ${contextProject.worldview}\nChars: ${contextProject.characters}` 
        : `Projects: ${projects.map(p => p.name).join(', ')}`;
        
    const prompt = getProjectAssistantPrompt(context, query);
    
    const ai = getAiClient();
    notifyModelUsage('Gemini', 'gemini-3-flash-preview');
    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [{ role: 'user', parts: [{ text: prompt }] }]
    ,
            config: { safetySettings: SAFETY_SETTINGS }});
    return response.text || "";
};

export const parseRawOutline = (text: string): ChapterOutline[] => {
    // Basic parser placeholder, usually implemented with AI in generateEpisodeOutline
    return [];
};
