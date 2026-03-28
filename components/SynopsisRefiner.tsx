
import React, { useState, useEffect, useRef } from 'react';
import { Project, SavedStory, RefinedSynopsisCard, NovelSettings } from '../types.ts';
import { X, Wand2, FileText, RefreshCw, Save, ArrowRight, Edit2, Check, Sparkles, Info, BookOpenCheck, AlertTriangle, CheckCircle2, RefreshCcw, FolderPlus, Upload, Flame, ToggleLeft, ToggleRight, AlignJustify, Cpu } from 'lucide-react';
import { refineSynopsisWithContext, refineText, analyzeProjectContext, analyzeSynopsisReference, AI_MODELS, isGrokModel, isMagnumModel } from '../services/geminiService.ts';
import InputDialog from './InputDialog.tsx';

interface SynopsisRefinerProps {
  isOpen: boolean;
  onClose: () => void;
  projects: Project[];
  stories: SavedStory[];
  activeProjectId: string | null;
  onSaveCard: (title: string, content: string, instructions: string, projectId: string) => void;
  onUpdateProject: (project: Project) => void;
  onCreateProject: (name: string) => string | void; // New prop
  settings?: NovelSettings; // NEW PROP to access global settings including Grok model
}

const SynopsisRefiner: React.FC<SynopsisRefinerProps> = ({
  isOpen,
  onClose,
  projects,
  stories,
  activeProjectId,
  onSaveCard,
  onUpdateProject,
  onCreateProject,
  settings
}) => {
  const [selectedProjectId, setSelectedProjectId] = useState<string>(activeProjectId || '');
  const [rawSynopsis, setRawSynopsis] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isContextAnalyzing, setIsContextAnalyzing] = useState(false);
  const [refinedCards, setRefinedCards] = useState<RefinedSynopsisCard[]>([]);
  
  // Card Edit State
  const [editingCardIndex, setEditingCardIndex] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<RefinedSynopsisCard | null>(null);
  
  // AI Refine State for individual card
  const [isCardRefining, setIsCardRefining] = useState<number | null>(null);

  // Context Stale State
  const [isContextStale, setIsContextStale] = useState(false);

  // Project Creation Dialog
  const [createProjectDialog, setCreateProjectDialog] = useState(false);

  // --- Reference Style State ---
  const [referenceAnalysis, setReferenceAnalysis] = useState('');
  const [isAnalyzingReference, setIsAnalyzingReference] = useState(false);
  const referenceFileRef = useRef<HTMLInputElement>(null);

  // --- Model Selection ---
  const [selectedModel, setSelectedModel] = useState<string>(settings?.synopsisModel || settings?.geminiModel || 'gemini-3-flash-preview');

  const activeProject = projects.find(p => p.id === selectedProjectId);

  useEffect(() => {
    if (activeProjectId) setSelectedProjectId(activeProjectId);
  }, [activeProjectId]);

  // Check for stale context whenever project or stories change
  useEffect(() => {
    if (!activeProject) {
        setIsContextStale(false);
        return;
    }

    const projectStories = stories.filter(s => s.projectId === activeProject.id && s.category !== 'synopsis');
    
    if (!activeProject.contextSnapshot) {
        // If we have stories but no analysis, suggest analysis
        if (projectStories.length > 0) {
             setIsContextStale(false); 
        }
        return;
    }

    const snapshot = activeProject.contextSnapshot;
    const currentStoryCount = projectStories.length;
    const currentLastUpdate = projectStories.length > 0 
        ? Math.max(...projectStories.map(s => s.updatedAt || s.createdAt)) 
        : 0;
    const currentProjUpdate = (activeProject.worldview?.length || 0) + (activeProject.characters?.length || 0);

    const isStale = 
        currentStoryCount !== snapshot.totalStories ||
        currentLastUpdate > snapshot.lastStoryUpdate ||
        Math.abs(currentProjUpdate - snapshot.projectUpdate) > 50; 

    setIsContextStale(isStale);

  }, [activeProject, stories]);

  if (!isOpen) return null;

  const handleReferenceUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setIsAnalyzingReference(true);
      const reader = new FileReader();
      reader.onload = async (event) => {
          const text = event.target?.result as string;
          try {
              const analysis = await analyzeSynopsisReference(text, selectedModel);
              setReferenceAnalysis(analysis);
          } catch(e) {
              alert("참조 파일 분석 실패");
          } finally {
              setIsAnalyzingReference(false);
              if(referenceFileRef.current) referenceFileRef.current.value = '';
          }
      };
      reader.readAsText(file);
  };

  const handleAnalyzeContext = async () => {
      if (!activeProject) return alert("프로젝트를 선택해주세요.");
      const projectStories = stories.filter(s => s.projectId === activeProject.id && s.category !== 'synopsis');
      if (projectStories.length === 0) return alert("분석할 원고가 없습니다.");

      setIsContextAnalyzing(true);
      try {
          const result = await analyzeProjectContext(projectStories, selectedModel);
          if (result) {
              const lastUpdate = projectStories.length > 0 
                ? Math.max(...projectStories.map(s => s.updatedAt || s.createdAt)) 
                : 0;
              
              const snapshot = {
                  totalStories: projectStories.length,
                  lastStoryUpdate: lastUpdate,
                  projectUpdate: (activeProject.worldview?.length || 0) + (activeProject.characters?.length || 0)
              };

              // Save to Project (Shared)
              onUpdateProject({
                  ...activeProject,
                  contextAnalysis: result.analysis,
                  contextReferences: result.references,
                  contextSnapshot: snapshot
              });
              setIsContextStale(false);
          } else {
              alert("분석 실패");
          }
      } catch (e) {
          alert("오류 발생");
      } finally {
          setIsContextAnalyzing(false);
      }
  };

  const handleAnalyzeSynopsis = async () => {
    if (!rawSynopsis.trim()) return alert("시놉시스 내용을 입력해주세요.");
    
    setIsAnalyzing(true);
    try {
      const recentStories = selectedProjectId 
        ? stories.filter(s => s.projectId === selectedProjectId && s.category !== 'synopsis')
        : [];
      
      // Pass the cached analysis if available
      const preAnalyzedContext = activeProject?.contextAnalysis;

      const result = await refineSynopsisWithContext(
          rawSynopsis, 
          activeProject || null, 
          recentStories, 
          preAnalyzedContext,
          "", // referenceAnalysis removed
          1, // targetChapterCount removed, default to 1
          selectedModel // Pass selected model
      );
      setRefinedCards(result);
    } catch (e) {
      console.error(e);
      alert("분석 중 오류가 발생했습니다.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleRefineCard = async (index: number, card: RefinedSynopsisCard) => {
    setIsCardRefining(index);
    try {
      // Just refine the summary as there are no instructions anymore
      const refinedSummary = await refineText(
          card.summary, 
          "Make this summary more detailed, include sensory details, and merge any technical instructions into the narrative.",
          selectedModel
      );
      
      const newCards = [...refinedCards];
      newCards[index] = { ...card, summary: refinedSummary };
      setRefinedCards(newCards);
    } catch (e) {
      alert("카드 수정 중 오류가 발생했습니다.");
    } finally {
      setIsCardRefining(null);
    }
  };

  const handleSaveToLibrary = (card: RefinedSynopsisCard, projectId: string) => {
    // Instructions are now merged into summary or empty, so just pass them through
    const content = `[Synopsis]\n${card.summary}`;
    onSaveCard(`${card.chapter}화. ${card.title} (Blueprint)`, content, "", projectId);
  };

  const handleSaveAllClick = () => {
      if (!selectedProjectId) {
          setCreateProjectDialog(true);
          return;
      }
      if (confirm(`현재 선택된 '${activeProject?.name}' 프로젝트에 ${refinedCards.length}개의 시놉시스를 저장하시겠습니까?`)) {
          refinedCards.forEach(card => handleSaveToLibrary(card, selectedProjectId));
          alert("모두 저장되었습니다.");
      }
  };

  const handleCreateAndSaveAll = (projectName: string) => {
      const newId = onCreateProject(projectName);
      if (newId && typeof newId === 'string') {
          refinedCards.forEach(card => handleSaveToLibrary(card, newId));
          alert(`새 프로젝트 '${projectName}'에 ${refinedCards.length}개의 시놉시스가 저장되었습니다.`);
          setSelectedProjectId(newId);
      }
      setCreateProjectDialog(false);
  };

  const startEditing = (index: number, card: RefinedSynopsisCard) => {
      setEditingCardIndex(index);
      setEditForm(card);
  };

  const saveEditing = () => {
      if (editingCardIndex !== null && editForm) {
          const newCards = [...refinedCards];
          newCards[editingCardIndex] = editForm;
          setRefinedCards(newCards);
          setEditingCardIndex(null);
          setEditForm(null);
      }
  };

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-[#1e1e1e] border border-gray-700 rounded-2xl w-full max-w-6xl h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="p-5 border-b border-gray-800 bg-[#252525] flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-900/30 rounded-lg text-purple-400">
               <Wand2 size={20} />
            </div>
            <div>
               <h2 className="text-xl font-bold text-white">시놉시스 다듬기 (Synopsis Refiner)</h2>
               <p className="text-xs text-gray-400">AI가 원고를 위한 완벽한 설계도로 다듬어 드립니다.</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white p-2 rounded-full hover:bg-gray-700 transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          {/* LEFT: Input Area */}
          <div className="w-full md:w-[400px] flex flex-col border-r border-gray-800 bg-[#151515] p-6 overflow-y-auto custom-scrollbar shrink-0">
             <div className="space-y-6">
                <div>
                   <label className="block text-sm font-bold text-gray-300 mb-2">프로젝트 선택</label>
                   <select 
                      className="w-full bg-[#252525] border border-gray-700 rounded-lg p-3 text-sm text-gray-200 outline-none focus:border-purple-500 transition-colors"
                      value={selectedProjectId}
                      onChange={(e) => setSelectedProjectId(e.target.value)}
                   >
                      <option value="">(프로젝트 선택 안 함)</option>
                      {projects.map(p => (
                         <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                   </select>
                   
                   {/* Context Analysis Section */}
                   {selectedProjectId && (
                       <div className="mt-3 bg-gray-800 rounded-lg p-3 border border-gray-700">
                           <div className="flex justify-between items-center mb-2">
                               <span className="text-xs font-bold text-gray-400 flex items-center gap-1">
                                   <BookOpenCheck size={12}/> 문맥 분석 상태
                               </span>
                               {activeProject?.contextAnalysis && !isContextStale ? (
                                   <span className="text-[10px] text-green-400 flex items-center gap-1"><CheckCircle2 size={10}/> 최신 상태</span>
                               ) : isContextStale ? (
                                   <span className="text-[10px] text-yellow-400 flex items-center gap-1 animate-pulse"><AlertTriangle size={10}/> 업데이트 필요</span>
                               ) : (
                                   <span className="text-[10px] text-gray-500">분석 데이터 없음</span>
                               )}
                           </div>
                           
                           <button 
                                onClick={handleAnalyzeContext}
                                disabled={isContextAnalyzing}
                                className={`w-full py-2 rounded text-xs font-bold flex items-center justify-center gap-2 transition-colors
                                    ${activeProject?.contextAnalysis && !isContextStale 
                                        ? 'bg-gray-700 text-gray-400 hover:bg-gray-600' 
                                        : 'bg-indigo-600 hover:bg-indigo-500 text-white'}
                                `}
                           >
                                {isContextAnalyzing ? <RefreshCw className="animate-spin" size={12}/> : <RefreshCcw size={12}/>}
                                {activeProject?.contextAnalysis && !isContextStale ? "다시 분석하기" : "프로젝트 문맥 분석"}
                           </button>
                       </div>
                   )}
                </div>



                {/* --- Model Selection --- */}
                <div className="bg-gray-900/50 border border-gray-700 rounded-xl p-4">
                    <label className="text-sm font-bold text-gray-300 mb-3 block flex items-center gap-2">
                        <Sparkles size={14} className="text-blue-400" /> 분석 모델 선택
                    </label>
                    <div className="grid grid-cols-1 gap-2">
                        <div className="grid grid-cols-2 gap-2">
                            <button 
                                onClick={() => setSelectedModel('gemini-3-flash-preview')}
                                className={`py-2 rounded-lg border text-xs font-bold transition-all ${selectedModel === 'gemini-3-flash-preview' ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-500/20' : 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-700'}`}
                            >
                                Gemini 3 Flash
                            </button>
                            <button 
                                onClick={() => setSelectedModel('gemini-3.1-pro-preview')}
                                className={`py-2 rounded-lg border text-xs font-bold transition-all ${selectedModel === 'gemini-3.1-pro-preview' ? 'bg-purple-600 border-purple-500 text-white shadow-lg shadow-purple-500/20' : 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-700'}`}
                            >
                                Gemini 3.1 Pro
                            </button>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <button 
                                onClick={() => setSelectedModel('grok-3')}
                                className={`py-2 rounded-lg border text-xs font-bold transition-all flex items-center justify-center gap-2 ${selectedModel === 'grok-3' ? 'bg-red-600 border-red-500 text-white shadow-lg shadow-red-500/20' : 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-700'}`}
                            >
                                <Cpu size={14} /> Grok 3
                            </button>
                            <button 
                                onClick={() => setSelectedModel('anthracite-org/magnum-v4-72b')}
                                className={`py-2 rounded-lg border text-xs font-bold transition-all flex items-center justify-center gap-2 ${selectedModel === 'anthracite-org/magnum-v4-72b' ? 'bg-orange-600 border-orange-500 text-white shadow-lg shadow-orange-500/20' : 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-700'}`}
                            >
                                <Flame size={14} /> Magnum v4
                            </button>
                        </div>
                    </div>
                    <p className="text-[10px] text-gray-500 mt-2">
                        {selectedModel === 'gemini-3-flash-preview' && "빠르고 가벼운 분석에 적합합니다."}
                        {selectedModel === 'gemini-3.1-pro-preview' && "더 깊고 정교한 논리적 분석이 가능합니다."}
                        {selectedModel === 'grok-3' && "강력한 추론 능력으로 복잡한 설정을 정교하게 다듬습니다."}
                        {selectedModel === 'anthracite-org/magnum-v4-72b' && "문학적 표현과 창의적인 묘사가 뛰어난 모델입니다."}
                    </p>
                </div>

                <div className="flex-1 flex flex-col">
                   <label className="block text-sm font-bold text-gray-300 mb-2 flex justify-between">
                      거친 시놉시스 입력
                      <span className="text-xs font-normal text-gray-500">대사, 괄호() 설명 포함 가능</span>
                   </label>
                   <textarea 
                      className="w-full min-h-[200px] flex-1 bg-[#252525] border border-gray-700 rounded-xl p-4 text-gray-200 outline-none resize-none focus:border-purple-500 transition-colors leading-relaxed text-sm placeholder-gray-600 custom-scrollbar"
                      placeholder={`예시:
1화: 주인공이 던전에서 깨어난다. (당황하는 심리 묘사). 앞에 몬스터가 나타나는데 "저리 꺼져!"라고 소리치며 검을 휘두른다.
2화: 마을로 돌아온 주인공. (사람들의 냉담한 반응). 여관 주인이 그를 알아보지 못한다.`}
                      value={rawSynopsis}
                      onChange={(e) => setRawSynopsis(e.target.value)}
                   />
                </div>

                <button 
                   onClick={handleAnalyzeSynopsis}
                   disabled={isAnalyzing || !rawSynopsis.trim()}
                   className="w-full py-4 rounded-xl font-bold shadow-lg flex items-center justify-center gap-2 transition-all hover:scale-[1.02] bg-purple-600 hover:bg-purple-500 text-white disabled:bg-gray-700 disabled:text-gray-500"
                >
                   {isAnalyzing ? <RefreshCw className="animate-spin" /> : <Sparkles fill="currentColor" />}
                   {isAnalyzing ? "AI가 분석 및 구조화 중..." : "시놉시스 다듬기 시작"}
                </button>
             </div>
          </div>

          {/* RIGHT: Output Cards */}
          <div className="flex-1 bg-[#121212] p-6 overflow-y-auto custom-scrollbar relative">
             {refinedCards.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-gray-600 opacity-50">
                   <FileText size={64} className="mb-4" />
                   <p className="text-lg">왼쪽에서 시놉시스를 입력하고 분석을 시작하세요.</p>
                </div>
             ) : (
                <div className="max-w-3xl mx-auto space-y-6 pb-20">
                   <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-bold text-gray-200 flex items-center gap-2">
                         <FileText className="text-purple-500"/> 정제된 원고 설계도 ({refinedCards.length}개)
                      </h3>
                      {/* Save All Button */}
                      <button 
                        onClick={handleSaveAllClick}
                        className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg font-bold shadow-lg flex items-center gap-2 transition-all hover:scale-105"
                      >
                          <Save size={16} /> 
                          {selectedProjectId ? "전체 저장" : "새 프로젝트에 전체 저장"}
                      </button>
                   </div>

                   {refinedCards.map((card, idx) => (
                      <div key={idx} className="bg-[#1e1e1e] border border-gray-700 rounded-xl overflow-hidden shadow-lg hover:border-purple-500/50 transition-colors group">
                         {/* Card Header */}
                         <div className="p-4 bg-[#252525] border-b border-gray-700 flex justify-between items-center">
                            {editingCardIndex === idx && editForm ? (
                                <div className="flex-1 flex gap-2 mr-4">
                                    <input 
                                        className="w-16 bg-gray-800 border border-gray-600 rounded px-2 py-1 text-sm text-white text-center"
                                        value={editForm.chapter}
                                        type="number"
                                        onChange={(e) => setEditForm({...editForm, chapter: parseInt(e.target.value)})}
                                    />
                                    <input 
                                        className="flex-1 bg-gray-800 border border-gray-600 rounded px-2 py-1 text-sm text-white font-bold"
                                        value={editForm.title}
                                        onChange={(e) => setEditForm({...editForm, title: e.target.value})}
                                    />
                                </div>
                            ) : (
                                <div>
                                    <span className="text-xs font-bold text-purple-400 uppercase tracking-wider">Chapter {card.chapter}</span>
                                    <h4 className="font-bold text-gray-100 text-lg">{card.title}</h4>
                                </div>
                            )}
                            
                            <div className="flex gap-1">
                               {editingCardIndex === idx ? (
                                   <button onClick={saveEditing} className="p-2 bg-green-600 hover:bg-green-500 text-white rounded-lg"><Check size={16}/></button>
                               ) : (
                                   <button onClick={() => startEditing(idx, card)} className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg"><Edit2 size={16}/></button>
                               )}
                            </div>
                         </div>

                         {/* Card Body */}
                         <div className="p-5 space-y-4">
                            <div>
                               <label className="text-xs font-bold text-gray-500 mb-1 block">줄거리 (Summary)</label>
                               {editingCardIndex === idx && editForm ? (
                                   <textarea 
                                      className="w-full h-40 bg-gray-800 border border-gray-600 rounded p-3 text-sm text-gray-200 outline-none resize-none custom-scrollbar"
                                      value={editForm.summary}
                                      onChange={(e) => setEditForm({...editForm, summary: e.target.value})}
                                   />
                               ) : (
                                   <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">{card.summary}</p>
                               )}
                            </div>
                            
                            {/* REMOVED INSTRUCTIONS SECTION */}
                         </div>

                         {/* Card Footer */}
                         <div className="p-3 bg-[#252525] border-t border-gray-700 flex justify-end gap-2">
                            <button 
                                onClick={() => handleRefineCard(idx, card)}
                                disabled={isCardRefining === idx || editingCardIndex === idx}
                                className="px-3 py-1.5 text-xs font-medium text-gray-300 hover:text-white bg-gray-800 hover:bg-gray-700 rounded-lg flex items-center gap-1 transition-colors disabled:opacity-50"
                            >
                                {isCardRefining === idx ? <RefreshCw className="animate-spin" size={12}/> : <Wand2 size={12}/>} AI 더 다듬기
                            </button>
                            <button 
                                onClick={() => {
                                    if(!selectedProjectId) {
                                        setCreateProjectDialog(true);
                                    } else {
                                        handleSaveToLibrary(card, selectedProjectId);
                                        alert("보관함에 저장되었습니다.");
                                    }
                                }}
                                className="px-4 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg flex items-center gap-1 transition-colors shadow-lg"
                            >
                                <Save size={12}/> 보관함 저장
                            </button>
                         </div>
                      </div>
                   ))}
                </div>
             )}
          </div>
        </div>
      </div>
      
      <InputDialog 
        isOpen={createProjectDialog}
        title="새 프로젝트(폴더) 생성"
        placeholder="시놉시스를 저장할 프로젝트 이름"
        onConfirm={handleCreateAndSaveAll}
        onClose={() => setCreateProjectDialog(false)}
        confirmText="생성 및 전체 저장"
      />
    </div>
  );
};

export default SynopsisRefiner;
