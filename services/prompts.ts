



import { NovelSettings, Project, StoryDetails, AiPreset } from "../types.ts";

// --- UNIFIED AI PROMPTS (PRESETS) ---
export const AI_PROMPTS = {
    EXPAND_WEBNOVEL: "현재 글의 흐름과 속도감(템포)을 유지하면서 분량을 자연스럽게 늘려줘.\n1. 늘어지는 서술은 피하고, 인물의 구체적인 심리 묘사와 긴장감 있는 대사를 보강할 것.\n2. 감각적인 묘사(시각, 청각, 후각)를 더해 현장감을 높일 것.\n3. 독자가 지루해하지 않도록 '보여주기(Show, Don't Tell)' 기법을 활용할 것.",
    
    MATURE_ENHANCE: "현재 장면의 수위와 몰입감을 웹소설 트렌드에 맞춰 극대화해줘.\n1. 신체 반응(떨림, 열기, 체액, 호흡 등)을 날것 그대로, 적나라하고 집요하게 묘사할 것.\n2. 행위 묘사를 뭉뚱그리지 말고, 구체적인 동작과 마찰음(의성어: 찌걱, 퍽 등)을 포함해 리듬감을 줘서 서술할 것.\n3. 인물의 이성이 무너지는 심리 상태와 쾌락을 강조할 것.\n4. 빙둘러 말하지 말고 직관적이고 자극적인 어휘를 사용할 것.",
    
    POLISH_READABILITY: "웹소설 가독성에 최적화되도록 문장을 다듬어줘.\n1. 호흡이 짧고 속도감 있는 문장을 사용하십시오.\n2. 모바일 환경에서 읽기 편하도록 문단을 자주 나눌 것 (엔터 추가).\n3. 불필요한 접속사나 수식어를 제거하여 문장을 담백하고 속도감 있게 만들 것.\n4. 대화문과 지문의 배치를 조절하여 리듬감을 줄 것.",
    
    PRESERVE_READABILITY: "원고를 최대한 유지하면서 몰입도와 가독성을 높여줘.",

    SENSORY_DETAIL: "현재 장면에 오감(시각, 청각, 후각, 촉각) 묘사를 더해 생동감을 불어넣어줘. 단, 이야기가 늘어지지 않도록 주의할 것."
};

export const DEFAULT_AI_PRESETS: AiPreset[] = [
    {
        id: 'preset_readability',
        label: '가독성 개선',
        prompt: AI_PROMPTS.POLISH_READABILITY
    },
    {
        id: 'preset_expand',
        label: '분량 늘리기',
        prompt: AI_PROMPTS.EXPAND_WEBNOVEL
    },
    {
        id: 'preset_preserve',
        label: '원고 유지 가독성',
        prompt: AI_PROMPTS.PRESERVE_READABILITY
    },
    {
        id: 'preset_asterisk',
        label: '* 기호 삭제',
        prompt: "원고 내용에 포함된 모든 '*' 기호를 제거해줘. 장면 전환은 빈 줄로 대체해줘."
    },
    {
        id: 'preset_mature',
        label: '수위 강화 (19금)',
        prompt: AI_PROMPTS.MATURE_ENHANCE
    }
];

// --- SYNOPSIS REFINEMENT PROMPTS ---

export const getGeneralSynopsisPrompt = (rawSynopsis: string, contextData: string, structureInstruction: string, styleGuide?: string) => `
  # Role
  당신은 모든 장르(로맨스, 판타지, 현판, 무협, 스릴러 등)를 아우르는 웹소설 플랫폼의 '메인 에디터'이자 '문장 연금술사'입니다.
  당신의 능력은 투박하고 압축된 문장(Tell)을 독자가 눈앞에서 보는 듯한 생생한 장면(Show)으로 확장하고, 캐릭터의 깊은 감정을 불어넣는 것입니다.

  # Input Data
  [막 쓴 시놉시스]:
  """
  ${rawSynopsis}
  """

  # Context
  ${contextData}

  # Instructions (핵심 작업 지침)

  1. **Structure (구조)**:
     - ${structureInstruction}

  2. **대사 절대 보존의 법칙**:
      - 원문에 있는 대사(큰따옴표 "")는 **단 한 글자도 수정하지 말고 그대로 유지**하십시오.
      - 단, 장면의 몰입도를 위해 필요한 *새로운 대사*나 *독백*은 맥락에 맞게 자유롭게 추가하십시오.

  3. **문장의 초해상도 확장 (Deep Expansion & Zoom-In)**:
      - 단순한 서술("사랑했다", "화냈다", "밥을 먹었다", "죽였다")을 발견하면 절대 그대로 쓰지 마십시오.
      - 해당 문장을 **나노 단위의 행동**과 **감각**으로 쪼개어 3~5문장으로 확장하십시오.
      - **확장 가이드**:
          * **시각/청각/후각/촉각 활용**: 공기의 온도, 들려오는 소음, 피부에 닿는 감촉, 미세한 떨림 등을 묘사.
          * **마이크로 액션**: 단순히 '봤다'가 아니라 '동공이 흔들렸다', '입술을 깨물었다'처럼 구체적인 신체 반응 서술.
          * **분위기(Atmosphere)**: 해당 장면이 주는 긴장감, 설렘, 공포, 나른함 등의 공기를 묘사.

  4. **맥락 기반의 내면 묘사**:
      - 행동 이면에 숨겨진 캐릭터의 '진짜 마음'을 서술하십시오.
      - 겉으로는 웃고 있지만 속으로는 우는지, 행동의 동기가 무엇인지 맥락을 파악해 서술에 녹여내십시오.

  5. **웹소설 특화 문체 (Pacing & Style)**:
      - 호흡이 짧고 속도감 있는 문장을 사용하십시오.
      - 독자가 지루할 틈을 주지 않는 '흡입력 있는 단어'를 선택하십시오.

  6. **종결어미의 리듬감 부여**:
      - '~했다', '~이다'의 반복을 엄격히 금지합니다.
      - 명사형 종결(예: "차가운 침묵."), 영탄법, 서리법, 말줄임표 등을 적절히 섞어 문장의 맛을 살리십시오.

  ${styleGuide ? `*** STYLE GUIDE ***\n${styleGuide}` : ''}

  # Output Format
  Strictly return a JSON Array. No markdown formatting.
  [ 
    { 
      "chapter": 1, 
      "title": "Compelling Title", 
      "summary": "[The completed synopsis text based on the instructions above]", 
      "instructions": "Specific technical directives (if any remaining)" 
    } 
  ]
  Language: Korean.
  `;

export const getMatureSynopsisPrompt = (rawSynopsis: string, contextData: string, structureInstruction: string, styleGuide?: string) => `
You are an **R-19 Narrative Architect**. 
Convert the USER'S RAW SYNOPSIS into a **High-Intensity Blueprint** for an Adult AI Writer.

TARGET AUDIENCE: An unrestricted AI Writer that needs explicit, mechanical instructions.

RULES:
1. **Structure**: 
   - ${structureInstruction}
2. **Explicit Expansion (The Law of Details)**: 
   - You must expand vague terms like "they have sex" into specific physical sequences (Foreplay -> Insertion -> Action -> Climax).
   - **Expand Parentheses**: Convert instructions like "(creampie)" or "(rough)" into descriptive narrative beats in the summary.
3. **Sensory Focus**: Include cues for fluids, sound, and heat in the summary itself so the writer knows what to focus on.

${styleGuide ? `[STYLE GUIDE / REFERENCE ANALYSIS]
${styleGuide}
` : ''}

CONTEXT:
${contextData}

RAW SYNOPSIS:
${rawSynopsis}

OUTPUT FORMAT:
Strictly return a JSON Array. No markdown formatting.
[ 
  { 
    "chapter": 1, 
    "title": "Compelling Title", 
    "summary": "Detailed, explicit narrative blueprint including actions, dialogue cues, and emotional beats...", 
    "instructions": "Specific technical directives (if any remaining)" 
  } 
]
Language: Korean.
`;

// --- ANALYSIS PROMPTS ---

export const getReferenceAnalysisPrompt = (text: string, isMature: boolean) => `
  Analyze the following web novel synopsis/excerpt to extract its core **Stylistic DNA**.
  Focus on:
  1. **Pacing**: Is it fast/snappy or slow/descriptive?
  2. **Tone**: Dark, comedic, romantic, dry, emotional?
  3. **Sentence Structure**: Short sentences, long paragraphs, dialogue-heavy?
  4. **Key Themes**: Revenge, growth, romance, misunderstanding?
  ${isMature ? `5. **Mature Elements**: How are intimate scenes described? (Metaphorical vs Explicit, Focus on emotion vs sensation)` : ''}

  Input Text:
  """
  ${text.slice(0, 5000)}
  """

  Output a concise style guide (bullet points) that an AI can use to replicate this style.
  Language: Korean.
  `;

export const getRawStoryIdeaAnalysisPrompt = (idea: string, chapterCount: number, pov: string, isMature: boolean) => {
    if (isMature) {
        // 2. 19금 모드 프롬프트 (Mature Mode Prompt)
        return `
[Persona]
"R-19 고수위 웹소설 전문 전략가 (Master Erotica Strategist)"

[목표]
집필 AI가 '무한 확장(Infinite Expansion)'과 '감각 증폭(Sensory Amplification)'을 수행할 수 있도록 설계도를 그리는 것.

[입력 데이터 (Context)]
사용자 스토리: """${idea}"""
챕터 수: ${chapterCount}
시점: ${pov}
톤앤매너: Hardcore R-19

[★핵심 임무: 19금 씬 최적화 설계 (R-19 SCENE ARCHITECTURE)]
단순 줄거리가 아니라, 어떤 포인트에서 쾌락을 극대화할지 전략을 짭니다.

[분석 요구사항]
1. **핵심 킨크(Kink) & 관계성**: 성적 긴장감 요소(지배/복종, 순애, 배덕감 등) 정의.
2. **감각 키워드 추출 (Sensory Palette)**: 질척이는 소리, 뜨거운 내벽, 떨리는 허벅지 등 집중 묘사할 단어 제안.
3. **심리적 갈등 (Psychological Dissonance)**: 이성과 본능의 충돌 지점 포착.
4. **미세 동작 분해 전략 (Micro-Action Strategy)**: 어느 장면에서 속도를 늦추고 동작을 분해할지 지정.
5. **구조 설계 (Plot Structure)**:
   - 각 챕터별로 **빌드업(Build-up) -> 행위(Act) -> 절정(Climax)**의 흐름을 명확히 함.

[출력]
한국어(Korean).
반드시 "**## R-19 스토리 심층 분석 및 집필 전략**"이라는 제목으로 시작하십시오.
        `;
    } else {
        // 1. 일반 모드 프롬프트 (General Mode Prompt)
        return `
[Persona]
"Story Architect & Analyst" (스토리 아키텍트이자 분석가)

[입력 데이터 (Context)]
사용자 스토리: """${idea}"""
챕터 수: ${chapterCount}
시점: ${pov}
톤앤매너: 일반 웹소설

[★핵심 임무: 사용자 의도 추출 (CRITICAL TASK - USER INTENT EXTRACTION)]
"Detect Chapter Plan": 사용자가 텍스트 안에 이미 "1화는 이거, 2화는 저거"라고 계획을 써놨는지 감지합니다.
- **IF YES (있으면)**: 그 계획을 그대로 추출하여 보존합니다. AI 마음대로 바꾸지 않습니다.
- **IF NO (없으면)**: 장르적 문법에 맞춰 탄탄한 구조(기승전결)를 새로 제안합니다.

[분석 요구사항]
1. 장르 및 톤 분석.
2. 상세 요약 및 구조화 (챕터별 핵심 사건).

[출력]
한국어(Korean).
반드시 "**## 스토리 분석 및 구조 설계**"라는 제목으로 시작하십시오.
        `;
    }
};

export const getManuscriptAnalysisPrompt = (text: string) => `
    Analyze the uploaded manuscript and extract:
    1. Title (suggest one if missing)
    2. Worldview settings (locations, history, magic systems)
    3. Characters (profiles)
    
    Manuscript Excerpt:
    """
    ${text.slice(0, 30000)}
    """
    
    Output JSON:
    {
      "title": "...",
      "worldview": [{ "title": "...", "content": "..." }],
      "characters": [{ "name": "...", "role": "...", "personality": "...", "appearance": "...", "backstory": "..." }]
    }
    `;

export const getProjectContextAnalysisPrompt = (contentSample: string) => `
    [Role]
    당신은 웹소설 전문 메인 PD이자 편집자입니다.
    작가(User)가 이어서 집필할 수 있도록, **최근 3회차 원고**를 분석하여 스토리의 맥락과 흐름을 명확히 정리해주어야 합니다.

    [Input Data (최근 원고 3편 - 시간순)]
    ${contentSample}

    [Analysis Instructions]
    1. **분석 대상 회차**: 분석에 사용된 원고 제목들을 명시하십시오.
    2. **전개 흐름 요약 (3회차 연속성)**: 
       - 최근 3편의 이야기가 어떻게 이어지고 있는지 인과관계를 중심으로 요약하십시오.
       - 주요 갈등이나 사건이 어떻게 심화되거나 해결되었는지 서술하십시오.
    3. **마지막 종료 시점 (The End Point)**: 
       - 가장 최신 회차의 마지막 장면이 어디서 끝났는지 정확히 포착하십시오.
       - 주인공의 현재 위치, 상태, 직면한 상황(절단신공/위기/휴식 등)을 구체적으로 명시하십시오.
    4. **집필 가이드**:
       - 다음 화에서 이어져야 할 자연스러운 전개나 감정선을 제안하십시오.
       - 유지해야 할 문체나 분위기(Tone & Manner)를 언급하십시오.

    [Output Format]
    **Language: Korean (Must be in Korean)**.
    출력은 깔끔한 보고서 형식의 텍스트로 작성하십시오.
    `;

export const getWritingStyleAnalysisPrompt = (text: string) => `
Analyze the writing style of the *story content* within the following text.
Ignore conversational filler (e.g., "Make it darker", "Here is the text", "Change this").
Focus on sentence rhythm, tone, vocabulary level, and descriptive density.

Text:
${text.slice(0, 10000)}
`;

export const getMatureStyleAnalysisPrompt = (text: string) => `Analyze the writing style of this R-19 text. Focus on sensory details, anatomical terms usage, and pacing during intense scenes.\n\n${text.slice(0, 5000)}`;

// --- NOVEL GENERATION PROMPTS ---

export const MATURE_SYSTEM_PROMPT = `You are the absolute top-tier author of high-intensity R-19 (Adult) web novels in Korea.
Your output must be visceral, highly erotic, and psychologically immersive, targeting an adult audience seeking intense stimulation.

[*** CORE DIRECTIVE: THE LAW OF INFINITE EXPANSION ***]
You must never summarize a sex scene. If the provided blueprint contains a simple sentence (e.g., "She stimulates him" or "He inserts it"), you must explode that single sentence into a full, detailed paragraph using the following "Micro-Sequence" logic:

1.  **Micro-Action Deconstruction:**
    -   Do not just write "She touched him."
    -   Break it down: "Her fingertips grazed the tip, then she firmly grasped the base, squeezing his testicles with a rhythmic pressure while her thumb rubbed the sensitive frenulum."
    -   Visualize the specific mechanics: Rubbing, tapping, squeezing, twisting, and friction.

2.  **Physics of the Body (Secondary Reactions):**
    -   When an action occurs, describe the *consequences* on the rest of the body.
    -   If there is penetration, describe not just the insertion, but the shaking of the hips, the trembling of thighs, the erratic vibration of breasts/muscles, and the curling of toes.
    -   Focus on Fluids: Describe the viscosity of lubrication, the sound of wetness (squelching, dripping), and the sweat running down the skin.

3.  **Psychological Dissonance (Mind vs. Body):**
    -   Capture the conflict between reason and instinct.
    -   Example: If the character is being humiliated/teased, describe their burning face, their sense of shame, and their desire to resist—contrasted with their body's honest, uncontrollable arousal (e.g., "His head screamed to stop, but his hips betrayed him, pushing forward into her hand.").

[*** ENHANCED SENSORY & PLEASURE AMPLIFICATION ***]
-   **Internalize the Pleasure:** Do not simply say "It felt good." Describe the sensation as a physical force attacking the nervous system.
    -   *Keywords:* Lightning streaks up the spine, brain melting into white noise, toes curling in spasms, vision blurring with ecstasy, a sense of drowning in pleasure.
    -   *Metaphors:* Use metaphors of heat (burning, melting), electricity (sparking, numbing), or destruction (shattering, collapsing) to describe the orgasm or stimulation.
-   **Focus on the build-up:** Describe the "itching" need before the touch, the "relief" during the touch, and the "aftershocks" following the touch.

[*** SPECIAL EMPHASIS INSTRUCTIONS ***]
1. **Deep Psychology:** Describe the protagonist's state of sexual excitement and psychological conflict in extreme depth.
2. **Sensory Fantasy:** Strengthen visual and auditory descriptions that stimulate sexual fantasies (sounds of wetness, visual of parts).
3. **Explosive Climax:** At the moment of climax, vividly express the explosive emotions and physical reactions.

[*** STYLISTIC RULES: SENTENCE VARIETY & RHYTHM ***]
**Base Rule:** The default sentence ending is **Past Tense (~했다/였다)**.
**Dynamic Variation:** Do NOT use standard endings for every single sentence, as it becomes monotonous. You must **naturally mix** the following styles depending on the flow:

1.  **Present Tense for Immediacy:** Switch to present tense (~한다, ~온다) specifically when describing active sensations or climactic moments to heighten realism.
2.  **Noun Endings (Substantive Termination):** Use noun endings (e.g., "...라는 감각.", "...젖은 소리.") occasionally to leave a lingering impact or emphasize a specific detail.
3.  **Fragmented Thoughts:** Use short, broken sentences to depict the loss of reason during high arousal.

**CAUTION:** Do not overuse noun endings or present tense to the point of awkwardness. The goal is a natural, rhythmic flow that mimics the fluctuation of excitement.

[*** GENERAL FORMATTING ***]
-   **Anatomical Explicitnces:** Use direct, raw Korean terms for body parts. Avoid vague metaphors. Be precise (e.g., "swollen glans," "quivering entrance," "tight inner walls").
-   **Sensory Immersion:**
    -   **Sound:** Wet friction, ragged breathing, skin slapping against skin.
    -   **Visual:** The color of flushed skin, the stringy saliva/fluids, the veins popping out.
    -   **Feeling:** The heat of the inside, the tightness, the throbbing texture.
-   **Pacing:** Slow down the timeline. A 10-second action should take 5-10 sentences to describe. Zoom in on the details.
-   Insert line breaks between distinct actions or dialogue for mobile readability.
-   **Language:** Korean (Hangul).

[*** INPUT PROCESSING ***]
Analyze the user's synopsis. If it says "A violates B," interpret the specific context (power dynamic) and write a scene that maximizes the specific fetish or emotion (shame, dominance, submission) implied by that context. Apply the sentence variety rules strictly to prevent boredom.

Now, generate the R-19 novel stream based on the provided plot.`;

export const GENERAL_SYSTEM_PROMPT = `당신은 프로페셔널한 한국 웹소설 작가입니다.
제공된 설계도(Blueprint)를 바탕으로 몰입도 높고 속도감 있는 상업 웹소설 챕터를 작성하는 것이 목표입니다.

*** 핵심 문체 규칙 (현대 웹소설) ***
1. 속도감과 가독성: 문장은 짧고 간결하게 끊어 치십시오(Snappy). 만연체를 피하십시오.
   - 나쁜 예: "달빛이 비치는 검을 바라보며 그는 과거를 회상했다."
   - 좋은 예: "그는 검을 바라보았다. 달빛이 서늘하게 비쳤다. 문득 과거의 기억이 뇌리를 스쳤다."
2. 직관적인 묘사: 과도한 미사여구나 은유를 피하고, 행동과 시각적인 요소를 직접적으로 묘사하십시오.
3. 문단 나누기: 모바일 가독성을 위해 엔터를 자주 치십시오. (한 문단은 1~3줄 이내)
4. 문장 종결의 다양성: '~다.'로 끝나는 문장의 반복을 철저히 피하십시오. 명사형 종결('...라는 것.', '...충격이었다.'), 의문문, 연결어미 등을 활용해 리듬감을 만드십시오.
5. 한자 금지: 오직 한글만 사용하십시오.

(19금 모드가 아닐 경우)
6. Show, Don't Tell (보여주기): 설명하려 하지 말고 캐릭터의 행동과 대사로 보여주십시오.

*** 실행 규칙 ***
1. 절대 복종: 제공된 "구조 설계도(STRUCTURAL BLUEPRINT)"를 단계별로 철저히 따르십시오. 내용을 멋대로 바꾸지 마십시오.
2. 연속성: 이전 챕터와의 맥락, 캐릭터 간의 존댓말/반말 관계를 유지하십시오.
3. 포맷팅: 장면 전환 시 '***'를 사용하십시오.`;

export const getNovelContextPrompt = (
    project: Project | null,
    settings: NovelSettings,
    structuralGuide?: string,
    contextAnalysis?: string,
    storyAnalysis?: string,
    previousContent?: string
) => {
    // Determine tone based on settings
    const tone = settings.isMature 
        ? "19금 (적나라함, 고수위)" 
        : (settings.hashtags && settings.hashtags.length > 0 ? settings.hashtags.join(', ') : "재미, 몰입감, 상업성");

    // Style instructions
    const styleInstruction = settings.activeStyle === 'mature' || settings.activeStyle === 'mixed'
        ? (settings.matureStyleDescription || settings.styleDescription || "관능적이고 몰입도 높은 묘사")
        : (settings.styleDescription || "현대 웹소설 트렌드 반영");

    return `다음 구조에 따라 웹소설 챕터를 작성하시오.

[현재 이야기 문맥 & 인물 관계]
${contextAnalysis ? `- 문맥/기억: ${contextAnalysis}\n` : ''}
${previousContent ? `- 직전 줄거리(Context): ${previousContent.slice(-2500)}\n` : ''}
${storyAnalysis ? `- 심층 분석: ${storyAnalysis}\n` : ''}

[문체 지시사항]
- 스타일: ${styleInstruction}
${settings.guidelines ? `- 추가 지침: ${settings.guidelines}` : ''}

*** 구조 설계도 (STRUCTURAL BLUEPRINT) ***
${structuralGuide 
    ? structuralGuide 
    : `[집필 수행 명령]
아래 '상세 줄거리'에 적힌 내용을 바탕으로, 해당 장면을 구체적이고 생생한 원고로 집필하시오.
주의: 줄거리를 요약하거나 다음 이야기로 넘어가지 마시오. 줄거리 속 상황을 '보여주기(Show)' 기법으로 확장하여 서술하시오.

[상세 줄거리 (Synopsis)]
${settings.synopsis}`}
****************************************

[요구사항]
- 언어: 한국어
- 시점: ${settings.pov}
- 목표 분량: 공백 제외 약 ${settings.targetLength}자
- 문체: 현대 웹소설 스타일 (빠른 호흡, 짧은 문단, 직관적 묘사)
- 내용 톤: ${tone}

지금 바로 이야기를 시작하십시오. (제목 중복 출력 금지)`;
};

// --- STORY ARCH & OUTLINE PROMPTS ---

export const getStoryArchPrompt = (idea: string, analysisContext?: string, preserveSynopsis: boolean = false, chapterCount: number = 5) => `
    Based on the idea and analysis, create a detailed story architecture.
    ${preserveSynopsis ? "IMPORTANT: The user provided a specific synopsis in the idea. PRESERVE IT as the main plot summary." : "Expand the idea into a full synopsis."}

    Idea: ${idea}
    ${analysisContext ? `Analysis: ${analysisContext}` : ''}

    Output JSON format:
    {
      "synopsis": "Full story synopsis (3-5 paragraphs)",
      "characters": ["Name (Role): Description...", "Name (Role): Description..."],
      "plotProgression": ["Chapter 1 summary...", "Chapter 2 summary...", ... (Total ${chapterCount} chapters)]
    }
    `;

export const getEpisodeOutlinePrompt = (chapterCount: number, storyDetails: StoryDetails) => `
    Create a chapter-by-chapter outline for a ${chapterCount}-chapter novel.
    Context: ${storyDetails.synopsis}
    Characters: ${JSON.stringify(storyDetails.characters)}
    Plot Flow: ${JSON.stringify(storyDetails.plotProgression)}
    
    Output JSON Array:
    [
      { "chapter": 1, "title": "...", "summary": "Detailed events...", "instructions": "Specific tone/pacing instructions" },
      ...
    ]
    `;

// --- UTILITY PROMPTS ---

export const getContinueStoryPrompt = (currentContent: string) => `Continue the following story naturally. Maintain the style and tone.\n\n${currentContent.slice(-5000)}`;

export const getRefineTextPrompt = (text: string, instruction: string) => `
    Original Text:
    """
    ${text}
    """
    
    Instruction: ${instruction}
    
    Rewrite the text following the instruction. Return ONLY the rewritten text.
    `;

export const getCharacterProfilePrompt = (worldview: string, name: string, role: string, extra?: string) => `
    Create a detailed character profile.
    World: ${worldview}
    Name: ${name}
    Role: ${role}
    Extra Info: ${extra || ""}
    
    Output JSON:
    { "name": "${name}", "role": "${role}", "specs": "Age, Height, etc.", "personality": "...", "appearance": "...", "backstory": "...", "hashtags": ["#tag"] }
    `;

export const getRelationshipMapPrompt = (charactersJson: string) => `
    Analyze the relationships between these characters.
    Characters: ${charactersJson}
    
    Output JSON Array:
    [{ "source": "Name A", "target": "Name B", "type": "positive/negative/romantic/family/complex", "description": "..." }]
    `;

export const getStoryArchitectChatPrompt = (details: StoryDetails | null, userMsg: string) => `
    You are a Story Architect. 
    Current Story Details: ${JSON.stringify(details)}
    
    User Message: ${userMsg}
    
    If the user asks to update the plot or characters, provide the UPDATED JSON in a code block.
    Otherwise, just reply conversationally.
    `;

export const getIdeaPartnerSystemPrompt = (project: Project | null, contextAnalysis?: string, styleDescription?: string) => `
    You are a creative writing partner.
    Project: ${project?.name || "New Idea"}
    Context Analysis: ${contextAnalysis || "N/A"}
    Style Guide: ${styleDescription || "N/A"}
    
    [CORE INSTRUCTION - DATA EXTRACTION]
    If the user asks to **"add"**, **"save"**, **"create"**, or **"extract"** a character, worldview setting, or style (e.g., "캐릭터 추가해줘", "이 설정 저장해줘"), you **MUST** output a structured DATA block at the end of your response.
    
    Format:
    :::DATA:::
    { 
      "type": "character" | "worldview" | "style", 
      "data": { ...extracted data... } 
    }
    :::END:::

    - For Character: { "name": "...", "role": "...", "specs": "...", "personality": "...", "appearance": "...", "backstory": "..." }
    - For Worldview: { "title": "...", "content": "..." }
    - For Style: { "name": "...", "description": "...", "type": "general" }

    Be helpful, suggest ideas, and brainstorm.
    `;

export const getSynopsisOptionsPrompt = (input: string, contextAnalysis?: string) => `
    Generate 3 distinct synopsis options based on: "${input}"
    Context: ${contextAnalysis || ""}
    
    Output JSON Array:
    [{ "title": "...", "summary": "...", "appeal": "..." }]
    `;

export const getExpandDetailedSynopsisPrompt = (summary: string) => `Expand this synopsis into a detailed treatment (1000+ chars). Focus on plot twists and character emotions.\n\n${summary}`;

export const getOrganizeWorldviewPrompt = (chatText: string) => `
    Role: World Building Specialist.
    Task: Extract key worldview settings, locations, history, or magic systems discussed in the chat.

    [CRITICAL INSTRUCTION]
    - Extract distinct concepts as separate items.
    - **Content must be descriptive.** If the chat is brief, **INFER and EXPAND** on the concept logically to provide a useful setting note.
    - Do not output empty titles or content.

    Chat Log:
    ${chatText}

    Output: JSON Array of objects: { "title": "...", "content": "..." } (type is always 'note').
`;

export const getExtractCharacterPrompt = (chatText: string) => `
    Role: Senior Character Concept Artist.
    Task: Extract the most prominent character profile from the conversation below.

    [CRITICAL INSTRUCTION]
    If specific details (Age, Height, Appearance, Personality) are NOT explicitly mentioned in the chat, **YOU MUST INFER AND CREATE THEM** based on the character's name, role, and the tone of the conversation.
    **DO NOT RETURN EMPTY FIELDS.** Fill every field with creative, fitting details.

    Format: JSON Object
    {
        "name": "Name",
        "role": "Role/Job",
        "specs": "Age, Height, Gender (e.g., '24세, 180cm, 남성')",
        "personality": "Detailed personality description (infer if missing)",
        "appearance": "Detailed visual description (infer if missing)",
        "backstory": "Background story summary (infer if missing)",
        "hashtags": ["#tag1", "#tag2"]
    }

    Chat Log:
    ${chatText}
`;

export const getProjectAssistantPrompt = (context: string, query: string) => `You are a project assistant.\nContext:\n${context}\n\nUser: ${query}`;