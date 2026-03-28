
import React, { useRef, useState, useMemo, useEffect } from 'react';
import { Upload, AlertTriangle, Settings2, Book, Hash, X, Plus, Paperclip, CheckCircle2, FileText, BrainCircuit, Play, ChevronDown, ChevronUp, RefreshCcw, ArrowRight, AlignLeft, Wand2, Layout, PenTool, RotateCcw, ArrowRightCircle, Download, BookOpenCheck, MessageSquare, Info, Flame, Combine, Forward, Link2, Sparkles, Maximize2, Eraser, RefreshCw, Cpu } from 'lucide-react';
import { NovelSettings, POV, Project, SavedStory, SavedStyle, AiPreset } from '../types.ts';
import { analyzeProjectContext, generateNovelStep, continueStoryStream, analyzeRawStoryIdea, refineText, AI_MODELS } from '../services/geminiService.ts';
import { AI_PROMPTS } from '../services/prompts.ts';
import AiRefinePanel from './AiRefinePanel.tsx';

interface ControlsProps {
  settings: NovelSettings;
  setSettings: React.Dispatch<React.SetStateAction<NovelSettings>>;
  onGenerate: (structuralGuide?: string, contextAnalysis?: string) => void; 
  onRetry: () => void;
  onContinue: () => void;
  onRefine: (instruction: string) => void;
  isLoading: boolean;
  projects: Project[];
  activeProjectId: string | null;
  setActiveProjectId: (id: string | null) => void;
  stories: SavedStory[];
  generatedContent?: string; 
  onFinish?: (content?: string) => void; 
  onSave?: (content: string) => void; // New onSave Prop
  savedStyles?: SavedStyle[];
  onUpdateProject?: (project: Project) => void;
  presets?: AiPreset[];
}

const Controls: React.FC<ControlsProps> = ({ 
  settings, 
  setSettings, 
  onGenerate, 
  onRetry,
  onContinue,
  onRefine,
  isLoading,
  projects,
  activeProjectId,
  setActiveProjectId,
  stories,
  generatedContent = "",
  onFinish,
  onSave, // Destructure onSave
  savedStyles = [],
  onUpdateProject,
  presets
}) => {
  const guidelineFileRef = useRef<HTMLInputElement>(null);
  const contextFileRef = useRef<HTMLInputElement>(null);
  const [hashtagInput, setHashtagInput] = useState('');
  
  // UI View State
  const [viewState, setViewState] = useState<'settings' | 'generating'>('settings');
  const [isRefining, setIsRefining] = useState(false); // Local refining state

  // Scroll to bottom
  const bottomRef = useRef<HTMLTextAreaElement>(null);

  // Deep Story/Style Learning States
  const [isAnalyzingStory, setIsAnalyzingStory] = useState(false);
  const [storyAnalysis, setStoryAnalysis] = useState<string | null>(null);
  const [showStoryAnalysis, setShowStoryAnalysis] = useState(false);

  // Context Analysis States
  const [isAnalyzingContext, setIsAnalyzingContext] = useState(false);
  const [showContextAnalysis, setShowContextAnalysis] = useState(false);

  // Story Selection
  const [selectedContextId, setSelectedContextId] = useState<string>('');

  // Generation State
  const [isGenerating, setIsGenerating] = useState(false);
  
  // Use local state for content to allow manual editing during pauses
  const [localGeneratedContent, setLocalGeneratedContent] = useState("");

  // Sync local content with prop when not generating or initially
  useEffect(() => {
      if (!isGenerating && viewState === 'settings') {
          setLocalGeneratedContent(generatedContent);
      }
  }, [generatedContent, isGenerating, viewState]);

  const activeProject = projects.find(p => p.id === activeProjectId);

  // Compute Stale State
  const projectStories = useMemo(() => {
    if (!activeProjectId) return [];
    return stories
        .filter(s => s.projectId === activeProjectId && s.category !== 'synopsis')
        .sort((a,b) => b.createdAt - a.createdAt);
  }, [stories, activeProjectId]);

  const isContextStale = useMemo(() => {
      if (!activeProject || !activeProject.contextSnapshot) return false;
      
      const snapshot = activeProject.contextSnapshot;
      const currentLastUpdate = projectStories.length > 0 
          ? Math.max(...projectStories.map(s => s.updatedAt || s.createdAt)) 
          : 0;
      const currentProjUpdate = (activeProject.worldview?.length || 0) + (activeProject.characters?.length || 0);

      return (
          projectStories.length !== snapshot.totalStories ||
          currentLastUpdate > snapshot.lastStoryUpdate ||
          Math.abs(currentProjUpdate - snapshot.projectUpdate) > 50
      );
  }, [activeProject, projectStories]);

  // --- Progress Calculation ---
  const currentLength = localGeneratedContent.replace(/\s/g, '').length;
  const targetLength = settings.targetLength || 3000;
  const progressPercent = Math.min(100, (currentLength / targetLength) * 100);

  useEffect(() => {
      if (viewState === 'generating' && isGenerating && bottomRef.current) {
          bottomRef.current.scrollTop = bottomRef.current.scrollHeight;
      }
  }, [localGeneratedContent, viewState, isGenerating]);

  // ... (Handlers)
  const handleChange = (field: keyof NovelSettings, value: any) => { setSettings(prev => ({ ...prev, [field]: value })); };
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, field: keyof NovelSettings, fileNameField?: keyof NovelSettings) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setSettings(prev => ({ ...prev, [field]: text, ...(fileNameField ? { [fileNameField]: file.name } : {}) }));
      if (field === 'previousStoryContent') setSelectedContextId('external');
    };
    reader.readAsText(file); e.target.value = '';
  };
  const addHashtag = () => { if (!hashtagInput.trim()) return; const current = settings.hashtags || []; if (!current.includes(hashtagInput.trim())) { handleChange('hashtags', [...current, hashtagInput.trim()]); } setHashtagInput(''); };
  const removeHashtag = (tag: string) => { const current = settings.hashtags || []; handleChange('hashtags', current.filter(t => t !== tag)); };
  const handleStorySelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      const val = e.target.value; setSelectedContextId(val);
      if (val === '') handleChange('previousStoryContent', '');
      else if (val === 'external') {} else { const story = projectStories.find(s => s.id === val); if (story) handleChange('previousStoryContent', story.content || ""); }
  };
  
  // --- STORY DEEP LEARNING HANDLER ---
  const handleLearnStoryDeep = async () => {
      if (!settings.synopsis) return alert("줄거리를 입력해주세요.");
      setIsAnalyzingStory(true);
      try {
          const selectedModel = settings.manuscriptModel || settings.geminiModel || 'gemini-3-flash-preview';
          const result = await analyzeRawStoryIdea(
            settings.synopsis, 
            1, 
            settings.pov, 
            selectedModel
          );
          setStoryAnalysis(result);
          setShowStoryAnalysis(true);
      } catch (e) {
          alert("스토리 심층 분석에 실패했습니다.");
      } finally {
          setIsAnalyzingStory(false);
      }
  };

  const handleAnalyzeContext = async () => { 
    if (!activeProject) return; 
    if (projectStories.length === 0) return alert("프로젝트에 저장된 원고가 없습니다."); 
    setIsAnalyzingContext(true); 
    try { 
        const selectedModel = settings.primaryModel || settings.geminiModel || 'gemini-3-flash-preview';
        const result = await analyzeProjectContext(
            projectStories, 
            selectedModel
        ); 
        if (result && onUpdateProject) { 
            const lastUpdate = projectStories.length > 0 ? Math.max(...projectStories.map(s => s.updatedAt || s.createdAt)) : 0; 
            const snapshot = { totalStories: projectStories.length, lastStoryUpdate: lastUpdate, projectUpdate: (activeProject.worldview?.length || 0) + (activeProject.characters?.length || 0) }; 
            onUpdateProject({ ...activeProject, contextAnalysis: result.analysis, contextReferences: result.references, contextSnapshot: snapshot }); 
            setShowContextAnalysis(true); 
        } else { 
            alert("분석 실패"); 
        } 
    } catch (e) { 
        alert("오류 발생"); 
    } finally { 
        setIsAnalyzingContext(false); 
    } 
  };

  // --- Generation Logic ---
  
  const handleStartGeneration = async () => {
      setViewState('generating');
      setIsGenerating(true);
      setLocalGeneratedContent(""); // Clear for new generation
      
      try {
          const projectContext = activeProject || null;
          const contextStr = activeProject?.contextAnalysis;
          const selectedModel = settings.manuscriptModel || settings.geminiModel || 'gemini-3-flash-preview';
          
          await generateNovelStep(
              1, 1, settings, projectContext, 
              settings.previousStoryContent || "", // Pass previous content here
              undefined, 
              contextStr,
              (chunk) => {
                  setLocalGeneratedContent(prev => prev + chunk);
              },
              storyAnalysis || undefined,
              selectedModel
          );
          
          setIsGenerating(false);
          
      } catch (e) {
          console.error(e);
          setIsGenerating(false);
          alert("원고 생성 중 오류가 발생했습니다.");
      }
  };

  const handleContinue = async () => {
      if(!localGeneratedContent) return;
      setIsGenerating(true);
      try {
          await continueStoryStream(
              localGeneratedContent, 
              (chunk) => {
                  setLocalGeneratedContent(prev => prev + chunk);
              },
              0.7,
              settings.manuscriptModel || settings.geminiModel || 'gemini-3-flash-preview'
          );
      } catch(e) {
          alert("이어쓰기 오류");
      } finally {
          setIsGenerating(false);
      }
  };

  // Sync back to App.tsx when finishing
  const handleFinish = () => {
      // NEW Logic: Open Save Modal without closing the writer
      if (onSave) {
          onSave(localGeneratedContent);
      } else if (onFinish) {
          onFinish(localGeneratedContent);
          setViewState('settings');
      }
  };
  
  const handleStyleSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
      const styleId = e.target.value;
      if (!styleId) { setSettings(prev => ({ ...prev, activeStyleId: undefined, styleDescription: "" })); return; }
      const selected = savedStyles.find(s => s.id === styleId);
      if (selected) { 
          setSettings(prev => ({ 
              ...prev, 
              activeStyleId: selected.id, 
              styleDescription: selected.description
          })); 
      }
  };

  const hasStyle = settings.styleDescription;

  // Helper for text cut off
  const isTextCutOff = (text: string): boolean => {
      if (!text || text.trim().length === 0) return false;
      const trimmed = text.trim();
      const lastChar = trimmed.slice(-1);
      const strictTerminators = ['.', '!', '?', '"', '”', '…'];
      return !strictTerminators.includes(lastChar);
  };
  const isCutOff = isTextCutOff(localGeneratedContent);

  // Local Refinement Logic (Replaces parent-dependent onRefine)
  const handleRefineDraft = async (instruction: string) => {
      if (!localGeneratedContent) return;
      
      setIsRefining(true);
      try {
          const selectedModel = settings.primaryModel || settings.geminiModel || 'gemini-3-flash-preview';
          const refined = await refineText(
              localGeneratedContent, 
              instruction, 
              selectedModel
          );
          setLocalGeneratedContent(refined);
      } catch(e) { 
          alert("수정 실패"); 
      } finally { 
          setIsRefining(false); 
      } 
  };

  // AI WORKSTATION UI
  if (viewState === 'generating') {
      return (
          <div className="absolute inset-0 w-full h-full flex flex-col bg-gray-950 text-white z-20 animate-in fade-in">
              {/* Top Bar */}
              <div className="h-16 border-b border-gray-800 bg-gray-900/80 backdrop-blur flex items-center justify-between px-6 shrink-0 z-30">
                  <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${isGenerating ? 'bg-yellow-500 animate-pulse' : 'bg-green-500'}`}></div>
                      <h2 className="font-bold text-lg flex items-center gap-2">
                          <Wand2 className="text-indigo-500" size={18} /> AI 집필 스튜디오
                      </h2>
                  </div>
                  
                  <div className="flex items-center gap-2">
                      <button onClick={() => { if(window.confirm("작업을 취소하고 설정 화면으로 돌아가시겠습니까?")) { setViewState('settings'); } }} className="text-sm text-gray-500 hover:text-white px-3 py-2 rounded hover:bg-gray-800">나가기</button>
                  </div>
              </div>

              {/* Main Content Area */}
              <div className="flex-1 overflow-hidden relative flex flex-col md:flex-row">
                  
                  {/* LEFT: Control Panel */}
                  <div className="w-full md:w-[480px] bg-gray-900 border-b md:border-b-0 md:border-r border-gray-800 flex flex-col shrink-0 shadow-xl z-20">
                      <div className="p-5 border-b border-gray-800">
                          <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                              <Settings2 size={14} /> 제어 패널
                          </h3>
                      </div>
                      
                      <div className="p-6 flex-1 overflow-y-auto space-y-8 custom-scrollbar">
                          {/* Status Area */}
                          <div className={`bg-gray-800/50 border rounded-xl p-5 shadow-lg transition-all duration-500 ${isGenerating ? 'border-yellow-500/30 bg-yellow-900/10' : 'border-green-500/30 bg-green-900/10'}`}>
                              <div className="flex justify-between items-center mb-4">
                                  <h4 className={`font-bold text-sm ${isGenerating ? 'text-yellow-400' : 'text-green-400'}`}>
                                      {isGenerating ? 'AI가 원고를 작성 중입니다...' : '작성 완료'}
                                  </h4>
                                  {isGenerating && <RefreshCcw className="animate-spin text-yellow-500" size={16} />}
                              </div>
                              
                              {!isGenerating && isCutOff && (
                                  <button 
                                      onClick={handleContinue}
                                      className="w-full py-3 mb-3 bg-yellow-600 hover:bg-yellow-500 text-white font-bold rounded-lg shadow-lg flex items-center justify-center gap-2 animate-pulse ring-2 ring-yellow-400/50"
                                  >
                                      이어쓰기 (문장 잇기) <Link2 fill="currentColor" size={14}/>
                                  </button>
                              )}
                              
                              {!isGenerating && (
                                  <button 
                                      onClick={() => { if(window.confirm("현재 내용을 지우고 다시 작성하시겠습니까?")) handleStartGeneration(); }}
                                      className="w-full py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg font-bold text-xs flex items-center justify-center gap-2"
                                  >
                                      <RotateCcw size={14} /> 전체 다시 작성
                                  </button>
                              )}
                          </div>

                          {/* Progress Gauge */}
                          <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4 shadow-inner">
                              <div className="flex justify-between items-end mb-2">
                                  <label className="text-xs font-bold text-gray-400 flex items-center gap-2">
                                      <AlignLeft size={14} /> 집필 진행률
                                  </label>
                                  <span className="text-sm font-bold text-indigo-400">
                                      {currentLength.toLocaleString()} / {targetLength.toLocaleString()} 자
                                  </span>
                              </div>
                              <div className="w-full bg-gray-700 h-2 rounded-full overflow-hidden">
                                  <div className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-500" style={{ width: `${progressPercent}%` }}></div>
                              </div>
                          </div>

                          {/* REUSABLE AI REFINE PANEL */}
                          <AiRefinePanel 
                              currentText={localGeneratedContent}
                              onRefine={handleRefineDraft}
                              isRefining={isRefining}
                              disabled={isGenerating}
                              presets={presets}
                          />
                      </div>

                      {/* Export Button */}
                      <div className="p-5 border-t border-gray-800 bg-gray-850">
                          <button onClick={handleFinish} className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow-lg flex items-center justify-center gap-3 transition-all hover:scale-[1.02]">
                              <ArrowRightCircle size={22} />
                              <div className="text-left"><div className="text-sm font-bold">집필 종료 및 내보내기</div><div className="text-[10px] font-normal opacity-80">프로젝트에 원고를 저장합니다</div></div>
                          </button>
                      </div>
                  </div>

                  {/* RIGHT: Central Text Viewer (Editable) */}
                  <div className="flex-1 min-w-0 h-full overflow-hidden bg-gray-950 p-4 md:p-12 flex justify-center">
                       <div className="w-full max-w-4xl h-full bg-gray-900/80 border border-gray-800 rounded-2xl p-4 md:p-8 shadow-2xl relative overflow-hidden flex flex-col">
                           {localGeneratedContent || isGenerating ? (
                               <textarea 
                                   ref={bottomRef}
                                   className="w-full h-full bg-transparent border-none outline-none text-gray-300 text-lg leading-relaxed font-serif resize-none custom-scrollbar whitespace-pre-wrap p-0 m-0 placeholder-gray-600"
                                   value={localGeneratedContent}
                                   onChange={(e) => setLocalGeneratedContent(e.target.value)}
                                   placeholder="AI가 생성한 텍스트가 여기에 표시됩니다. 직접 수정할 수도 있습니다."
                                   spellCheck={false}
                               />
                           ) : (
                               <div className="h-full flex flex-col items-center justify-center text-gray-600 py-32"><Wand2 size={64} className="mb-6 opacity-10" /><p className="text-lg font-medium">AI가 원고 집필을 시작합니다.</p><p className="text-sm mt-2 opacity-60">왼쪽 패널에서 진행 단계를 확인하세요.</p></div>
                           )}
                       </div>
                  </div>
              </div>
          </div>
      );
  }

  return (
    <div className="w-full max-w-4xl mx-auto p-6 pb-32 animate-in fade-in duration-300">
      <div className="text-center mb-8"><h2 className="text-3xl font-bold text-indigo-400 mb-2">AI 원고 집필</h2><p className="text-gray-300">프로젝트 설정, 줄거리 분석, 그리고 집필까지. 단계별로 진행하세요.</p></div>
      
      {/* AI Model Selection - MOVED TO TOP */}
      <div className="mb-6 p-4 bg-gray-800 border border-gray-700 rounded-xl shadow-lg">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
             <div className="flex items-center gap-3">
                 <div className="p-2 bg-indigo-900/30 rounded-lg text-indigo-400">
                     <Cpu size={20} />
                 </div>
                 <div>
                     <label className="text-sm font-bold text-gray-200 block">집필 AI 모델</label>
                     <p className="text-[10px] text-gray-500">이 프로젝트의 원고 집필과 스토리 학습에 사용됩니다.</p>
                 </div>
             </div>
             <select 
                 className="bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-sm text-gray-200 outline-none focus:border-indigo-500 min-w-[200px]"
                 value={settings.manuscriptModel || settings.geminiModel || 'gemini-3-flash-preview'}
                 onChange={(e) => handleChange('manuscriptModel', e.target.value)}
             >
                 {AI_MODELS.map(model => (
                     <option key={model.id} value={model.id}>{model.name}</option>
                 ))}
             </select>
          </div>
      </div>
      
      {/* 19+ Toggle - MOVED TO TOP for Visibility */}


      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-5 shadow-lg">
             <div className="flex items-center gap-2 mb-4 text-indigo-400 font-bold"><Book size={18} /> 프로젝트 선택</div>
             <select className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-gray-200 outline-none focus:border-indigo-500 mb-2" value={activeProjectId || ""} onChange={(e) => { setActiveProjectId(e.target.value || null); setSelectedContextId(''); }}><option value="">(프로젝트 선택 안 함 - 독립 원고)</option>{projects.map(p => (<option key={p.id} value={p.id}>{p.name}</option>))}</select>
             {activeProject && (<div className="text-xs text-green-500 flex items-center gap-1 bg-green-900/20 p-2 rounded"><CheckCircle2 size={12} /> 세계관 및 캐릭터 설정이 연동됩니다.</div>)}
          </div>
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-5 shadow-lg relative overflow-hidden">
             <div className="flex items-center justify-between mb-4 text-indigo-400 font-bold"><span className="flex items-center gap-2"><Paperclip size={18} /> 이어쓰기 및 문맥</span><button onClick={() => contextFileRef.current?.click()} className="text-xs bg-gray-700 hover:bg-gray-600 px-2 py-1 rounded text-gray-300 flex items-center gap-1 transition-colors"><Upload size={12} /> 파일</button><input type="file" ref={contextFileRef} className="hidden" accept=".txt" onChange={(e) => handleFileUpload(e, 'previousStoryContent')} /></div>
             <div className="space-y-3">
                <select className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-gray-200 outline-none focus:border-indigo-500 disabled:opacity-50 text-sm" onChange={handleStorySelectChange} value={selectedContextId} disabled={!activeProjectId && selectedContextId !== 'external'}><option value="">(선택 안 함 - 새로운 챕터)</option>{projectStories.slice(0, 5).map(s => (<option key={s.id} value={s.id}>{s.title}</option>))}{selectedContextId === 'external' && (<option value="external">[업로드된 외부 파일]</option>)}</select>
                {activeProject?.contextAnalysis && !isContextStale ? (<button onClick={() => setShowContextAnalysis(!showContextAnalysis)} className="w-full py-2 bg-green-900/30 hover:bg-green-800/30 border border-green-500/30 text-green-400 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-colors"><CheckCircle2 size={14} /> 분석 완료 (확인하기) {showContextAnalysis ? <ChevronUp size={12}/> : <ChevronDown size={12}/>}</button>) : (<button onClick={handleAnalyzeContext} disabled={isAnalyzingContext || !activeProjectId || projectStories.length === 0} className={`w-full py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${isContextStale ? 'bg-yellow-900/30 border border-yellow-500/30 text-yellow-300 hover:bg-yellow-900/50' : 'bg-indigo-900/50 border border-indigo-500/30 text-indigo-300 hover:bg-indigo-800/50'}`}>{isAnalyzingContext ? <RefreshCcw className="animate-spin" size={12} /> : isContextStale ? <AlertTriangle size={14}/> : <BookOpenCheck size={14} />}{isContextStale ? "문맥 변경 감지됨 (재분석 권장)" : "원고 목록 정독 및 문맥 분석"}</button>)}
             </div>
             {activeProject?.contextAnalysis && showContextAnalysis && (<div className="mt-3 p-3 bg-indigo-900/20 border border-indigo-500/30 rounded-lg animate-in fade-in slide-in-from-top-2"><div className="flex justify-between items-center mb-2"><h4 className="text-xs font-bold text-indigo-400 flex items-center gap-1"><BrainCircuit size={12} /> AI 문맥 분석 리포트</h4><button onClick={() => setShowContextAnalysis(false)} className="text-indigo-400 hover:text-white"><X size={12}/></button></div><div className="text-[11px] text-gray-300 whitespace-pre-wrap leading-relaxed max-h-40 overflow-y-auto custom-scrollbar bg-gray-900/50 p-2 rounded">{activeProject.contextAnalysis}</div><div className="mt-2 text-[10px] text-green-400 flex items-center gap-1"><CheckCircle2 size={10} /> 다음 생성 시 이 문맥(말투/관계)이 반영됩니다.</div></div>)}
          </div>
      </div>
      <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 shadow-lg mb-6 relative overflow-hidden">
          <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2"><FileText className="text-yellow-500" /> 시놉시스 / 줄거리</h3>
              <div className="flex gap-2">
                  {storyAnalysis && (<span className="px-3 py-1 bg-purple-900/30 border border-purple-500/30 text-purple-400 rounded-full text-xs font-bold flex items-center gap-1"><Sparkles size={12} /> 스토리 학습 완료</span>)}
              </div>
          </div>
          <textarea className="w-full h-64 bg-gray-900 border border-gray-700 rounded-xl p-5 text-base text-gray-200 focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 outline-none resize-none leading-relaxed mb-4 shadow-inner" placeholder="작성할 챕터의 구체적인 줄거리를 입력하세요..." value={settings.synopsis} onChange={(e) => handleChange('synopsis', e.target.value)} spellCheck={false} />
          
          {/* Analysis Button - Full Width */}
          <button onClick={handleLearnStoryDeep} disabled={isAnalyzingStory || !settings.synopsis} className={`w-full py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg text-sm ${storyAnalysis ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-purple-700 hover:bg-purple-600 text-white'} disabled:opacity-50 disabled:cursor-not-allowed`}>
              {isAnalyzingStory ? <RefreshCcw className="animate-spin" size={16} /> : <BrainCircuit size={16} />} 
              {storyAnalysis ? "스토리 심층 재학습" : "스토리 심층 학습 (AI 분석)"}
          </button>
          
          {storyAnalysis && (<button onClick={() => setShowStoryAnalysis(!showStoryAnalysis)} className="w-full mt-2 text-xs text-gray-400 hover:text-white flex justify-center items-center gap-1">{showStoryAnalysis ? "학습 결과 접기" : "학습 결과 보기"} {showStoryAnalysis ? <ChevronUp size={12}/> : <ChevronDown size={12}/>}</button>)}

          {/* Analysis Panels */}
          {storyAnalysis && showStoryAnalysis && (<div className="mt-4 p-4 bg-purple-900/20 border border-purple-500/30 rounded-xl animate-in slide-in-from-top-2 fade-in"><h4 className="text-sm font-bold text-purple-400 mb-2 flex items-center gap-2"><BrainCircuit size={14}/> 스토리 심층 학습 결과</h4><div className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed max-h-60 overflow-y-auto custom-scrollbar p-2">{storyAnalysis}</div></div>)}
      </div>
      
      <div className={`transition-all duration-500 ${storyAnalysis ? 'opacity-100 translate-y-0' : 'opacity-50 translate-y-4 pointer-events-none grayscale'}`}>
         <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 shadow-lg">
             {/* ... (Settings Inputs - same as before) ... */}
             <div className="flex items-center gap-2 mb-6 text-indigo-400 font-bold border-b border-gray-700 pb-4"><Settings2 size={18} /> 세부 설정 및 생성</div>
             
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <div className="space-y-6">
                    <div className="space-y-2"><label className="text-sm font-medium text-gray-300 flex justify-between">추가 지침 (Guidelines)<button onClick={() => guidelineFileRef.current?.click()} className="text-xs text-indigo-400 flex gap-1 items-center hover:text-indigo-300"><Upload size={12}/> 파일</button><input type="file" ref={guidelineFileRef} className="hidden" accept=".txt" onChange={(e) => handleFileUpload(e, 'guidelines')} /></label><textarea className="w-full h-24 bg-gray-900 border border-gray-700 rounded-lg p-3 text-xs text-gray-300 outline-none focus:border-indigo-500 resize-none" placeholder="대사 톤, 특정 행동 등 세부적인 지시사항" value={settings.guidelines} onChange={(e) => handleChange('guidelines', e.target.value)} /></div>
                    <div className="space-y-2"><label className="text-sm font-medium text-gray-300 flex items-center gap-2">문체 설정 (Style)</label><select className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2.5 text-sm text-gray-200 outline-none focus:border-indigo-500 mb-2" value={settings.activeStyleId || ''} onChange={handleStyleSelect}><option value="">(기본 문체)</option>{savedStyles.map(s => (<option key={s.id} value={s.id}>{s.name}</option>))}</select>{hasStyle ? (<div className="p-3 border rounded-lg text-xs flex items-center gap-2 bg-green-900/20 border-green-500/30 text-green-400"><CheckCircle2 size={14} /> <span>학습된 일반 문체가 적용됩니다.</span></div>) : (<div className="p-3 bg-gray-900 border border-gray-700 rounded-lg text-xs text-gray-500 flex items-center gap-2"><Info size={14} /> <span>저장된 문체를 선택하거나 설정에서 학습시키세요.</span></div>)}</div>
                </div>
                <div className="space-y-6">
                     <div className="space-y-2"><label className="text-xs font-medium text-gray-500 flex items-center gap-1"><Hash size={12}/>해시태그 (분위기/키워드)</label><div className="flex gap-2"><input className="flex-1 bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-xs outline-none focus:border-indigo-500" placeholder="키워드 입력 (Enter)" value={hashtagInput} onChange={(e) => setHashtagInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addHashtag()} /><button onClick={addHashtag} className="bg-gray-700 hover:bg-gray-600 px-2 rounded text-gray-300"><Plus size={14}/></button></div><div className="flex flex-wrap gap-1.5 min-h-[24px]">{settings.hashtags?.map(tag => (<span key={tag} className="px-2 py-0.5 bg-indigo-900/20 border border-indigo-500/20 text-indigo-300 text-[10px] rounded-full flex items-center gap-1">{tag} <button onClick={() => removeHashtag(tag)}><X size={8}/></button></span>))}</div></div>
                     <div className="space-y-1"><label className="text-xs font-medium text-gray-400">시점 설정</label><select className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2.5 text-sm text-gray-200 outline-none focus:border-indigo-500 transition-colors" value={settings.pov} onChange={(e) => handleChange('pov', e.target.value)}>{Object.values(POV).map(p => <option key={p} value={p}>{p}</option>)}</select></div>
                     <div className="space-y-3 bg-gray-900/50 p-4 rounded-xl border border-gray-700"><div className="flex justify-between items-end"><label className="text-sm font-medium text-gray-300 flex items-center gap-2"><AlignLeft size={16} /> 목표 분량 <span className="text-[10px] text-gray-500 font-normal">(공백 제외)</span></label><span className="text-2xl font-bold text-indigo-400">{settings.targetLength?.toLocaleString()} <span className="text-sm text-gray-500 font-normal">자</span></span></div><input type="range" min="1000" max="10000" step="500" value={settings.targetLength} onChange={(e) => handleChange('targetLength', parseInt(e.target.value))} className="w-full h-3 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-indigo-500" /><div className="flex justify-between text-xs text-gray-500"><span>짧음 (1,000)</span><span>보통 (5,000)</span><span>김 (10,000)</span></div></div>
                </div>
             </div>

             {/* START BUTTON - SINGLE SHOT FULL GENERATION */}
             <button
                onClick={handleStartGeneration}
                disabled={isLoading || isGenerating}
                className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-xl shadow-xl shadow-indigo-500/30 transition-transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-3"
             >
                 {isLoading || isGenerating ? <RefreshCw className="animate-spin" /> : <Play fill="currentColor" />}
                 소설 생성 시작 (한 번에 전체 작성)
             </button>
         </div>
      </div>
    </div>
  );
};

export default Controls;
