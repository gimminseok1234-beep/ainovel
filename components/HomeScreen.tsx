




// ... existing imports ...
import React, { useState, useRef } from 'react';
import { BookOpen, Globe, UserPlus, Edit3, Plus, Trash2, Settings, FileText, PenTool, MessageSquare, Zap, FolderOpen, FileSearch, RefreshCcw, Compass, X, Sliders, Info, CheckCircle, AlertTriangle, Sparkles, Save, Download, Upload, Check, Wand2, CheckCircle2, Flame, Library, LayoutTemplate, Cpu, ListPlus, Edit2, Bot } from 'lucide-react';
import { Project, SavedStory, ViewMode, NovelSettings, EditorPreferences, SavedStyle, DEFAULT_SETTINGS, AiPreset } from '../types.ts';
import { User } from '../services/firebase.ts';
import { DEFAULT_AI_PRESETS } from '../services/prompts.ts';
import { AI_MODELS } from '../services/geminiService.ts';
import UserMenu from './UserMenu.tsx';
import StyleManager from './StyleManager.tsx';
import SynopsisRefiner from './SynopsisRefiner.tsx';

// ... interface ...
interface HomeScreenProps {
  projects: Project[];
  stories: SavedStory[];
  onChangeView: (view: ViewMode) => void;
  setActiveProjectId: (id: string) => void;
  onCreateProject: (name: string) => string | void; 
  onDeleteProject: (id: string) => void;
  onUpdateProject?: (project: Project) => void; 
  onOpenProjectSettings: (project: Project) => void;
  onDeleteStory: (id: string) => void;
  onSelectStory: (story: SavedStory) => void;
  onUpdateStory: (story: SavedStory) => void;
  onExternalSave: (title: string, content: string, projectId: string, settings?: NovelSettings, category?: 'manuscript' | 'synopsis') => void;
  onOpenProject?: (project: Project) => void;
  onAnalyzeManuscript?: (text: string) => void;
  isGlobalLoading?: boolean;
  user: User | null;
  onSignIn: () => void;
  onSignOut: () => void;
  settings?: NovelSettings;
  onUpdateSettings?: (settings: NovelSettings) => void;
  editorPrefs?: EditorPreferences;
  onUpdateEditorPrefs?: (prefs: EditorPreferences) => void;
  savedStyles?: SavedStyle[];
  onSaveStyle?: (style: SavedStyle) => void;
  onDeleteStyle?: (id: string) => void;
  onOpenTrash?: () => void; // New Prop
  checkApiKey?: () => boolean;
  isSettingsOpen: boolean;
  setIsSettingsOpen: (open: boolean) => void;
}

const HomeScreen: React.FC<HomeScreenProps> = ({ 
  projects, 
  stories, 
  onChangeView, 
  setActiveProjectId,
  onCreateProject, 
  onDeleteProject,
  onUpdateProject,
  onOpenProjectSettings,
  onDeleteStory,
  onSelectStory,
  onUpdateStory,
  onExternalSave,
  onOpenProject,
  onAnalyzeManuscript,
  isGlobalLoading,
  user,
  onSignIn,
  onSignOut,
  settings,
  onUpdateSettings,
  editorPrefs,
  onUpdateEditorPrefs,
  savedStyles = [],
  onSaveStyle,
  onDeleteStyle,
  onOpenTrash,
  checkApiKey,
  isSettingsOpen,
  setIsSettingsOpen
}) => {
  // ... existing code ...
  const [isCreating, setIsCreating] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [isStyleManagerOpen, setIsStyleManagerOpen] = useState(false);
  const [isSynopsisRefinerOpen, setIsSynopsisRefinerOpen] = useState(false);

  // AI Preset State for Settings Modal
  const [editingPresetId, setEditingPresetId] = useState<string | null>(null); // Track ID being edited
  const [presetLabel, setPresetLabel] = useState('');
  const [presetPrompt, setPresetPrompt] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleCreate = () => {
    if (newProjectName.trim()) {
      onCreateProject(newProjectName);
      setNewProjectName('');
      setIsCreating(false);
    }
  };

  const handleProjectClick = (project: Project) => {
      if (onOpenProject) {
          onOpenProject(project);
      } else {
          setActiveProjectId(project.id);
          onChangeView('WRITER');
      }
  };

  const handleExportProject = (projectId: string, projectName: string) => {
    const projectStories = stories
      .filter(s => s.projectId === projectId && s.category !== 'synopsis')
      .sort((a, b) => {
          const getNum = (t: string) => {
              const match = t.match(/(\d+)/);
              return match ? parseInt(match[1]) : null;
          }
          const numA = getNum(a.title);
          const numB = getNum(b.title);
          
          if (numA !== null && numB !== null) return numA - numB;
          return a.createdAt - b.createdAt;
      });

    if (projectStories.length === 0) {
        alert("내보낼 원고가 없습니다.");
        return;
    }

    const fullText = projectStories
      .map(s => `=== ${s.title} ===\n\n${s.content}`)
      .join('\n\n' + '*'.repeat(20) + '\n\n');

    const blob = new Blob([fullText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${projectName}_full_export.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      
      const reader = new FileReader();
      reader.onload = (event) => {
          const text = event.target?.result as string;
          if (onAnalyzeManuscript) {
              onAnalyzeManuscript(text);
          }
      };
      reader.readAsText(file);
      if (fileInputRef.current) fileInputRef.current.value = '';
  };
  
  const handleCreativityChange = (value: number) => {
      if (onUpdateSettings && settings) {
          onUpdateSettings({ ...settings, creativityLevel: value });
      }
  };

  const handleGrokSettingChange = (field: keyof NovelSettings, value: any) => {
      if (onUpdateSettings && settings) {
          onUpdateSettings({ ...settings, [field]: value });
      }
  };

  const updatePref = (key: keyof EditorPreferences, value: any) => {
      if(onUpdateEditorPrefs && editorPrefs) {
          onUpdateEditorPrefs({ ...editorPrefs, [key]: value });
      }
  };

  // Determine current presets for display (Uses defaults if settings are empty)
  const currentPresets = settings?.aiPresets && settings.aiPresets.length > 0 ? settings.aiPresets : DEFAULT_AI_PRESETS;

  // AI Preset Handlers
  const handleSavePreset = () => {
      if (!presetLabel || !presetPrompt) return;
      
      if (onUpdateSettings && settings) {
          let newPresets = [...currentPresets];

          if (editingPresetId) {
              // Update existing
              newPresets = newPresets.map(p => 
                  p.id === editingPresetId 
                      ? { ...p, label: presetLabel, prompt: presetPrompt }
                      : p
              );
          } else {
              // Create new
              const newPreset: AiPreset = {
                  id: Date.now().toString(),
                  label: presetLabel,
                  prompt: presetPrompt
              };
              newPresets.push(newPreset);
          }
          
          onUpdateSettings({ ...settings, aiPresets: newPresets });
          
          // Reset form
          setEditingPresetId(null);
          setPresetLabel('');
          setPresetPrompt('');
      }
  };

  const handleEditPreset = (preset: AiPreset) => {
      setEditingPresetId(preset.id);
      setPresetLabel(preset.label);
      setPresetPrompt(preset.prompt);
  };

  const handleCancelEdit = () => {
      setEditingPresetId(null);
      setPresetLabel('');
      setPresetPrompt('');
  };

  const handleDeletePreset = (id: string) => {
      if (onUpdateSettings && settings) {
          const newPresets = currentPresets.filter(p => p.id !== id);
          onUpdateSettings({ ...settings, aiPresets: newPresets });
          
          if (editingPresetId === id) {
              handleCancelEdit();
          }
      }
  };

  const handleResetPresets = () => {
      if (confirm("모든 프리셋을 초기화하고 기본값으로 되돌리시겠습니까?") && onUpdateSettings && settings) {
          onUpdateSettings({ ...settings, aiPresets: DEFAULT_AI_PRESETS });
          handleCancelEdit();
      }
  };


  if (isGlobalLoading) {
      return (
          <div className="h-full w-full flex flex-col items-center justify-center bg-[#121212] text-white z-50">
              <div className="w-16 h-16 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mb-6"></div>
              <h2 className="text-2xl font-bold mb-2">AI 처리 중...</h2>
              <p className="text-gray-400">원고를 분석하여 프로젝트를 생성하고 있습니다.</p>
          </div>
      );
  }

  return (
    <div className="h-full w-full overflow-y-auto bg-[#121212] p-8 custom-scrollbar relative transition-colors duration-500">
      
      {/* Header Controls */}
      <div className="absolute top-6 left-6 right-6 z-30 flex items-center justify-end pointer-events-none">
         <div className="pointer-events-auto flex items-center gap-3">
             {onOpenTrash && (
                 <button 
                    onClick={onOpenTrash}
                    className="flex items-center justify-center w-10 h-10 bg-[#1e1e1e] border border-gray-800 rounded-full hover:bg-gray-800 transition-all shadow-lg text-gray-400 hover:text-white hover:border-red-500/50"
                    title="휴지통"
                 >
                    <Trash2 size={18} />
                 </button>
             )}
             {settings && onUpdateSettings && (
                 <button 
                    onClick={() => setIsSettingsOpen(true)}
                    className="flex items-center justify-center w-10 h-10 bg-[#1e1e1e] border border-gray-800 rounded-full hover:bg-gray-800 transition-all shadow-lg text-gray-400 hover:text-white"
                    title="설정"
                 >
                    <Settings size={18} />
                 </button>
             )}
             <UserMenu user={user} onSignIn={onSignIn} onSignOut={onSignOut} />
         </div>
      </div>

      {/* CONTENT SWITCH */}
      <div className="max-w-6xl mx-auto space-y-12 pb-20 pt-20">
          {/* ... existing main menu content ... */}
          <div className="text-center space-y-4 mt-0">
          <h1 className="text-5xl md:text-6xl font-bold text-purple-400 mb-2">
                NovelCraft AI
            </h1>
            <p className="text-gray-200 text-lg md:text-xl max-w-2xl mx-auto">
                세계관 구축부터 캐릭터 창조, 그리고 원고 집필까지.<br/>
                당신의 상상력을 현실로 만드는 AI 집필 보조 도구입니다.
            </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Top Row: Main Creation Tools */}
                <button 
                    onClick={() => onChangeView('WRITER')}
                    className="group relative p-6 bg-[#1e1e1e] hover:bg-gray-800 border border-gray-800 hover:border-purple-500 rounded-2xl transition-all duration-300 flex flex-col items-center text-center space-y-3 hover:shadow-2xl hover:shadow-purple-500/20 hover:-translate-y-1"
                >
                    <div className="p-3 bg-purple-900/30 rounded-full text-purple-400 group-hover:text-purple-300 group-hover:scale-110 transition-transform">
                    <Edit3 size={28} />
                    </div>
                    <h3 className="text-lg font-bold text-gray-100">AI 원고 집필</h3>
                    <p className="text-xs text-gray-400">스토리의 핵심, 원고를 작성합니다.</p>
                </button>

                <button 
                    onClick={() => onChangeView('WORLD_BUILDER')}
                    className="group relative p-6 bg-[#1e1e1e] hover:bg-gray-800 border border-gray-800 hover:border-emerald-500 rounded-2xl transition-all duration-300 flex flex-col items-center text-center space-y-3 hover:shadow-2xl hover:shadow-emerald-500/20 hover:-translate-y-1"
                >
                    <div className="p-3 bg-emerald-900/30 rounded-full text-emerald-400 group-hover:text-emerald-300 group-hover:scale-110 transition-transform">
                    <Globe size={28} />
                    </div>
                    <h3 className="text-lg font-bold text-gray-100">세계관 구축</h3>
                    <p className="text-xs text-gray-400">소설의 배경과 설정을 관리합니다.</p>
                </button>

                <button 
                    onClick={() => onChangeView('CHARACTER_LAB')}
                    className="group relative p-6 bg-[#1e1e1e] hover:bg-gray-800 border border-gray-800 hover:border-rose-500 rounded-2xl transition-all duration-300 flex flex-col items-center text-center space-y-3 hover:shadow-2xl hover:shadow-rose-500/20 hover:-translate-y-1"
                >
                    <div className="p-3 bg-rose-900/30 rounded-full text-rose-400 group-hover:text-rose-300 group-hover:scale-110 transition-transform">
                    <UserPlus size={28} />
                    </div>
                    <h3 className="text-lg font-bold text-gray-100">캐릭터 연구소</h3>
                    <p className="text-xs text-gray-400">등장인물과 관계도를 설계합니다.</p>
                </button>
                
                {/* Bottom Row: Support & Refinement Tools */}
                <button 
                    onClick={() => onChangeView('IDEA_EXPLORER')}
                    className="group relative p-6 bg-[#1e1e1e] hover:bg-gray-800 border border-gray-800 hover:border-cyan-500 rounded-2xl transition-all duration-300 flex flex-col items-center text-center space-y-3 hover:shadow-2xl hover:shadow-cyan-500/20 hover:-translate-y-1"
                >
                    <div className="p-3 bg-cyan-900/30 rounded-full text-cyan-400 group-hover:text-cyan-300 group-hover:scale-110 transition-transform">
                    <Compass size={28} />
                    </div>
                    <h3 className="text-lg font-bold text-gray-100">아이디어 탐색</h3>
                    <p className="text-xs text-gray-400">AI와 브레인스토밍하고 시놉시스를 만듭니다.</p>
                </button>

                 <button 
                    onClick={() => setIsStyleManagerOpen(true)}
                    className="group relative p-6 bg-[#1e1e1e] hover:bg-gray-800 border border-gray-800 hover:border-amber-500 rounded-2xl transition-all duration-300 flex flex-col items-center text-center space-y-3 hover:shadow-2xl hover:shadow-amber-500/20 hover:-translate-y-1"
                >
                    <div className="p-3 bg-amber-900/30 rounded-full text-amber-400 group-hover:text-amber-300 group-hover:scale-110 transition-transform">
                    <Library size={28} />
                    </div>
                    <h3 className="text-lg font-bold text-gray-100">문체 학습소</h3>
                    <p className="text-xs text-gray-500">나만의 문체를 학습시키고 관리합니다.</p>
                </button>

                <button 
                    onClick={() => setIsSynopsisRefinerOpen(true)}
                    className="group relative p-6 bg-[#1e1e1e] hover:bg-gray-800 border border-gray-800 hover:border-indigo-500 rounded-2xl transition-all duration-300 flex flex-col items-center text-center space-y-3 hover:shadow-2xl hover:shadow-indigo-500/20 hover:-translate-y-1"
                >
                    <div className="p-3 bg-indigo-900/30 rounded-full text-indigo-400 group-hover:text-indigo-300 group-hover:scale-110 transition-transform">
                    <LayoutTemplate size={28} />
                    </div>
                    <h3 className="text-lg font-bold text-gray-100">시놉시스 다듬기</h3>
                    <p className="text-xs text-gray-500">거친 줄거리를 체계적인 설계도로 변환합니다.</p>
                </button>
            </div>
            
            <div className="flex justify-center">
                 <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-2 px-6 py-3 bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white rounded-full transition-colors text-sm border border-gray-700 hover:border-gray-500"
                >
                    <FileSearch size={16} /> 기존 원고 분석하여 프로젝트 생성
                    <input 
                        type="file" 
                        ref={fileInputRef}
                        className="hidden"
                        accept=".txt"
                        onChange={handleFileUpload}
                    />
                </button>
            </div>

            <div className="space-y-6">
            <div className="flex items-center justify-between border-b border-gray-800 pb-4">
                <h2 className="text-2xl font-bold text-gray-200 flex items-center gap-3">
                <BookOpen size={24} className="text-gray-400" />
                내 프로젝트
                </h2>
                
                {!isCreating ? (
                <button 
                    onClick={() => setIsCreating(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition-colors shadow-lg shadow-purple-500/20"
                >
                    <Plus size={18} /> 새 프로젝트
                </button>
                ) : (
                <div className="flex gap-2 animate-in slide-in-from-right fade-in duration-300">
                    <input 
                    autoFocus
                    type="text"
                    placeholder="프로젝트 이름"
                    className="bg-[#1e1e1e] border border-gray-700 rounded-lg px-3 py-2 text-gray-200 outline-none focus:border-purple-500"
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                    />
                    <button onClick={handleCreate} className="px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-500">확인</button>
                    <button onClick={() => setIsCreating(false)} className="px-3 py-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600">취소</button>
                </div>
                )}
            </div>

            {projects.length === 0 ? (
                <div className="text-center py-12 bg-[#1e1e1e] rounded-2xl border border-gray-800 border-dashed">
                <p className="text-gray-500 mb-4">아직 생성된 프로젝트가 없습니다.</p>
                <button 
                    onClick={() => setIsCreating(true)}
                    className="text-purple-400 hover:text-purple-300 font-medium flex items-center justify-center gap-2"
                >
                    <Plus size={16} /> 첫 프로젝트 만들기
                </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                {projects.map(project => {
                    const projectStories = stories.filter(s => s.projectId === project.id && s.category !== 'synopsis');
                    return (
                    <div 
                      key={project.id} 
                      className="flex flex-col bg-[#1e1e1e] border border-gray-800 rounded-xl overflow-hidden hover:border-purple-500 hover:bg-[#2a2a2a] transition-all cursor-pointer group"
                      onClick={() => handleProjectClick(project)}
                    >
                        <div className="p-4 bg-[#252525] border-b border-gray-800 flex justify-between items-start">
                        <div>
                            <h3 className="font-bold text-lg text-gray-200 group-hover:text-purple-400 transition-colors truncate max-w-[200px]" title={project.name}>
                            {project.name}
                            </h3>
                            <p className="text-xs text-gray-500 mt-1">
                            {new Date(project.createdAt).toLocaleDateString()} 생성
                            </p>
                        </div>
                        <div className="flex items-center gap-1">
                            <button 
                            onClick={(e) => { e.stopPropagation(); handleExportProject(project.id, project.name); }}
                            className="p-2 text-gray-500 hover:text-green-400 hover:bg-gray-700 rounded-lg transition-colors"
                            title="프로젝트 내보내기 (TXT)"
                            >
                            <Download size={16} />
                            </button>
                            <button 
                            onClick={(e) => { e.stopPropagation(); onOpenProjectSettings(project); }}
                            className="p-2 text-gray-500 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
                            title="설정 (세계관/등장인물)"
                            >
                            <Settings size={16} />
                            </button>
                            <button 
                            onClick={(e) => { e.stopPropagation(); onDeleteProject(project.id); }}
                            className="p-2 text-gray-500 hover:text-red-400 hover:bg-gray-700 rounded-lg transition-colors"
                            title="삭제"
                            >
                            <Trash2 size={16} />
                            </button>
                        </div>
                        </div>

                        <div className="flex-1 p-4 min-h-[150px] max-h-[250px] overflow-y-auto custom-scrollbar">
                        <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1">
                            <FolderOpen size={12} /> 원고 목록
                        </h4>
                        {projectStories.length === 0 ? (
                            <p className="text-sm text-gray-600 italic py-2">아직 작성된 원고가 없습니다.</p>
                        ) : (
                            <div className="space-y-2">
                            {projectStories.map(story => (
                                <div 
                                key={story.id} 
                                className="group/item flex items-center justify-between p-2 hover:bg-gray-700/50 rounded-lg cursor-pointer transition-colors border border-transparent hover:border-gray-600"
                                onClick={(e) => { e.stopPropagation(); onSelectStory(story); }}
                                >
                                <div className="flex items-center gap-2 overflow-hidden flex-1">
                                    <FileText size={14} className="text-purple-400 flex-shrink-0" />
                                    <span className="text-sm text-gray-300 group-hover/item:text-white truncate">{story.title}</span>
                                    <span className="text-xs text-gray-500 ml-1 shrink-0">
                                       ({story.content.replace(/\s/g, '').length.toLocaleString()}자)
                                    </span>
                                </div>
                                <button 
                                    onClick={(e) => { e.stopPropagation(); onDeleteStory(story.id); }}
                                    className="opacity-0 group-hover/item:opacity-100 text-gray-500 hover:text-red-400 p-1 transition-all"
                                >
                                    <Trash2 size={12} />
                                </button>
                                </div>
                            ))}
                            </div>
                        )}
                        </div>

                        <div className="p-3 border-t border-gray-800 bg-[#252525]">
                        <button 
                            className="w-full py-2 flex items-center justify-center gap-2 text-sm font-medium text-gray-400 group-hover:text-white bg-gray-800 group-hover:bg-purple-600 rounded-lg transition-all"
                        >
                            <PenTool size={14} /> 프로젝트 열기
                        </button>
                        </div>
                    </div>
                    );
                })}
                </div>
            )}
            </div>
        </div>

      {/* Settings Dialog */}
      {isSettingsOpen && settings && editorPrefs && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="bg-[#1e1e1e] border border-gray-800 rounded-xl w-full max-w-lg shadow-2xl animate-in fade-in zoom-in duration-200 max-h-[90vh] overflow-hidden flex flex-col">
                  <div className="flex justify-between items-center p-5 border-b border-gray-800 bg-[#252525]">
                      <h3 className="text-xl font-bold text-white flex items-center gap-2">
                          <Sliders size={20} className="text-purple-400" /> 프로그램 설정
                      </h3>
                      <button onClick={() => setIsSettingsOpen(false)} className="text-gray-400 hover:text-white"><X size={20} /></button>
                  </div>
                  
                  <div className="p-6 space-y-8 overflow-y-auto custom-scrollbar flex-1">
                      {/* AI Settings */}
                      <section>
                          <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                              <Sparkles size={14}/> AI 설정
                          </h4>
                          <div className="space-y-6">
                              {/* Granular Model Selection */}
                              <div className="p-4 bg-gray-800/50 rounded-xl border border-gray-700 space-y-4">
                                  <h5 className="text-sm font-bold text-gray-200 flex items-center gap-2">
                                      <Sliders size={14} className="text-indigo-400" /> 기본 AI 모델 설정
                                  </h5>
                                  
                                  <div className="space-y-3">
                                      <div>
                                          <label className="text-[10px] font-medium text-gray-400 mb-1 block">기본 모델 (아이디어, 세계관 등)</label>
                                          <select 
                                              className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2 text-xs text-gray-200 outline-none focus:border-purple-500"
                                              value={settings.primaryModel || 'gemini-3-flash-preview'}
                                              onChange={(e) => handleGrokSettingChange('primaryModel', e.target.value)}
                                          >
                                              {AI_MODELS.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                                          </select>
                                      </div>
                                  </div>
                                  <p className="text-[10px] text-gray-500 mt-1">
                                      아이디어 탐색, 세계관 구축 등 기본 기능에 사용될 모델을 선택합니다. 원고 집필 및 시놉시스 다듬기 모델은 해당 기능 내에서 직접 선택할 수 있습니다.
                                  </p>
                              </div>

                              <div>
                                  <div className="flex justify-between items-center mb-2">
                                      <label className="text-sm font-bold text-gray-200 flex items-center gap-2">
                                          자유도 (Creativity)
                                          <span className="text-purple-400 text-xs font-normal bg-purple-900/30 px-2 py-0.5 rounded-full">Level {settings.creativityLevel || 3}</span>
                                      </label>
                                  </div>
                                  <input 
                                      type="range" 
                                      min="1" 
                                      max="10" 
                                      step="1" 
                                      value={settings.creativityLevel || 3}
                                      onChange={(e) => handleCreativityChange(parseInt(e.target.value))}
                                      className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
                                  />
                                  <div className="flex justify-between text-xs text-gray-500 mt-2">
                                      <span>엄격함 (1)</span>
                                      <span>창의적 (10)</span>
                                  </div>
                              </div>

                              {/* Magnum Settings */}
                              <div className="p-4 bg-gray-800/50 rounded-xl border border-gray-700 space-y-4">
                                  <h5 className="text-sm font-bold text-gray-200 flex items-center gap-2">
                                      <Cpu size={14} className="text-orange-400" /> Magnum (OpenRouter) 설정
                                  </h5>
                                  <p className="text-[10px] text-gray-400">
                                      OpenRouter를 통해 Magnum v4를 사용합니다. <a href="https://openrouter.ai/keys" target="_blank" rel="noreferrer" className="text-orange-400 hover:underline">여기에서 키를 발급받으세요.</a>
                                  </p>
                                  
                                  <div>
                                      <label className="text-xs font-medium text-gray-400 mb-1 block">Magnum API Key</label>
                                      <div className="relative">
                                          <input 
                                              type="password"
                                              className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2 text-sm text-gray-200 outline-none focus:border-purple-500 pr-10"
                                              placeholder={user ? "OpenRouter API 키 입력" : "로그인이 필요합니다"}
                                              disabled={!user}
                                              value={settings.magnumApiKey || ''}
                                              onChange={(e) => handleGrokSettingChange('magnumApiKey', e.target.value)}
                                          />
                                          {settings.magnumApiKey && (
                                              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-500">
                                                  <CheckCircle2 size={16} />
                                              </div>
                                          )}
                                      </div>
                                  </div>
                              </div>

                              {/* Grok Settings */}
                              <div className="p-4 bg-gray-800/50 rounded-xl border border-gray-700 space-y-4">
                                  <h5 className="text-sm font-bold text-gray-200 flex items-center gap-2">
                                      <Cpu size={14} className="text-red-400" /> Grok API 설정
                                  </h5>
                                  <p className="text-[10px] text-gray-400">
                                      xAI Grok 3를 사용하려면 API 키가 필요합니다. <a href="https://console.x.ai/" target="_blank" rel="noreferrer" className="text-red-400 hover:underline">여기에서 키를 발급받으세요.</a>
                                  </p>
                                  
                                  <div>
                                      <label className="text-xs font-medium text-gray-400 mb-1 block">Grok API Key</label>
                                      <div className="relative">
                                          <input 
                                              type="password"
                                              className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2 text-sm text-gray-200 outline-none focus:border-purple-500 pr-10"
                                              placeholder={user ? "xAI API 키 입력" : "로그인이 필요합니다"}
                                              disabled={!user}
                                              value={settings.grokApiKey || ''}
                                              onChange={(e) => handleGrokSettingChange('grokApiKey', e.target.value)}
                                          />
                                          {settings.grokApiKey && (
                                              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-500">
                                                  <CheckCircle2 size={16} />
                                              </div>
                                          )}
                                      </div>
                                  </div>
                              </div>

                              {/* Gemini Settings */}
                              <div className="p-4 bg-gray-800/50 rounded-xl border border-gray-700 space-y-4">
                                  <h5 className="text-sm font-bold text-gray-200 flex items-center gap-2">
                                      <Sparkles size={14} className="text-blue-400" /> Gemini API 설정
                                  </h5>
                                  <p className="text-[10px] text-gray-400">
                                      Gemini API 키를 등록하면 본인의 할당량을 사용할 수 있습니다. <br/>
                                      등록하지 않으면 기본 API가 사용됩니다. <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-blue-400 hover:underline">여기에서 키를 발급받으세요.</a>
                                  </p>
                                  
                                  <div>
                                      <label className="text-xs font-medium text-gray-400 mb-1 block">Gemini API Key</label>
                                      <div className="relative">
                                          <input 
                                              type="password"
                                              className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2 text-sm text-gray-200 outline-none focus:border-purple-500 pr-10"
                                              placeholder={user ? "API 키 (선택 사항 - 미입력 시 기본 API 사용)" : "로그인이 필요합니다"}
                                              disabled={!user}
                                              value={settings.geminiApiKey || ''}
                                              onChange={(e) => handleGrokSettingChange('geminiApiKey', e.target.value)}
                                          />
                                          {settings.geminiApiKey && (
                                              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-500">
                                                  <CheckCircle2 size={16} />
                                              </div>
                                          )}
                                      </div>
                                      {!user && (
                                          <p className="text-[10px] text-amber-500 mt-1 flex items-center gap-1">
                                              <AlertTriangle size={10} /> API 키 저장을 위해 구글 로그인이 필요합니다.
                                          </p>
                                      )}
                                  </div>
                              </div>
                          </div>
                      </section>

                      {/* AI Presets Manager */}
                      <section>
                          <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                              <ListPlus size={14}/> AI 프리셋 관리 (문장 수정용)
                          </h4>
                          
                          <div className="bg-gray-800/30 border border-gray-700 rounded-xl p-4 space-y-4">
                              <div className="flex gap-2">
                                  <div className="flex-1 space-y-2">
                                      <input 
                                          className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-xs text-white focus:border-purple-500 outline-none"
                                          placeholder="프리셋 이름 (예: 부드럽게)"
                                          value={presetLabel}
                                          onChange={(e) => setPresetLabel(e.target.value)}
                                      />
                                      <textarea 
                                          className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-xs text-white focus:border-purple-500 outline-none resize-none h-16"
                                          placeholder="AI 지시사항 (예: 문장을 부드럽게 다듬고 감성적인 단어를 사용해줘)"
                                          value={presetPrompt}
                                          onChange={(e) => setPresetPrompt(e.target.value)}
                                      />
                                  </div>
                                  <div className="flex flex-col gap-2 w-16">
                                      <button 
                                          onClick={handleSavePreset}
                                          disabled={!presetLabel || !presetPrompt}
                                          className={`flex-1 ${editingPresetId ? 'bg-indigo-600 hover:bg-indigo-500' : 'bg-purple-600 hover:bg-purple-500'} disabled:bg-gray-700 disabled:text-gray-500 text-white rounded text-xs font-bold flex flex-col items-center justify-center gap-1 transition-colors`}
                                      >
                                          {editingPresetId ? <Save size={16}/> : <Plus size={16}/>}
                                          {editingPresetId ? "저장" : "추가"}
                                      </button>
                                      {editingPresetId && (
                                          <button 
                                              onClick={handleCancelEdit}
                                              className="h-8 bg-gray-700 hover:bg-gray-600 text-white rounded text-xs flex items-center justify-center"
                                          >
                                              취소
                                          </button>
                                      )}
                                  </div>
                              </div>

                              <div className="space-y-2">
                                  {currentPresets.map(preset => (
                                      <div 
                                        key={preset.id} 
                                        className={`flex items-center justify-between p-2 rounded border text-xs cursor-pointer transition-all ${editingPresetId === preset.id ? 'border-purple-500 bg-purple-900/20' : 'border-gray-800 bg-gray-900 hover:bg-gray-800'}`}
                                        onClick={() => handleEditPreset(preset)}
                                      >
                                          <div className="flex-1 min-w-0 pr-2">
                                              <span className={`font-bold block truncate ${editingPresetId === preset.id ? 'text-purple-300' : 'text-gray-300'}`}>{preset.label}</span>
                                              <span className="text-gray-500 block truncate">{preset.prompt}</span>
                                          </div>
                                          <div className="flex items-center gap-1">
                                              <button 
                                                onClick={(e) => { e.stopPropagation(); handleEditPreset(preset); }} 
                                                className={`p-1.5 rounded ${editingPresetId === preset.id ? 'text-purple-300 bg-purple-900/50' : 'text-gray-500 hover:text-white hover:bg-gray-700'}`}
                                              >
                                                  <Edit2 size={12}/>
                                              </button>
                                              <button 
                                                onClick={(e) => { e.stopPropagation(); handleDeletePreset(preset.id); }} 
                                                className="text-gray-500 hover:text-red-400 p-1.5 hover:bg-gray-700 rounded"
                                              >
                                                  <Trash2 size={12}/>
                                              </button>
                                          </div>
                                      </div>
                                  ))}
                              </div>
                              
                              <button onClick={handleResetPresets} className="w-full py-1 text-[10px] text-gray-500 hover:text-white border border-transparent hover:border-gray-700 rounded flex items-center justify-center gap-1">
                                  <RefreshCcw size={10}/> 프리셋 초기화 (기본값 복구)
                              </button>
                          </div>
                      </section>

                      {/* Editor Visual Settings */}
                      <section>
                          <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                              <PenTool size={14}/> 에디터 환경 설정
                          </h4>
                          
                          <div className="space-y-6">
                              <div className="flex items-center justify-between">
                                  <div className="flex flex-col">
                                      <span className="text-sm font-medium text-gray-300">원고 영역 색 구분</span>
                                      <span className="text-xs text-gray-500">종이 질감처럼 원고 영역을 분리합니다.</span>
                                  </div>
                                  <button 
                                    onClick={() => updatePref('colorSeparation', !editorPrefs.colorSeparation)}
                                    className={`flex items-center justify-center px-3 py-1 rounded-full font-bold text-xs transition-all duration-300 ${editorPrefs.colorSeparation ? 'bg-purple-500 text-white shadow-[0_0_10px_rgba(168,85,247,0.5)]' : 'bg-gray-700 text-gray-400'}`}
                                  >
                                      {editorPrefs.colorSeparation ? 'ON' : 'OFF'}
                                  </button>
                              </div>

                              <div>
                                  <div className="flex justify-between mb-2">
                                      <span className="text-sm font-medium text-gray-300">에디터 너비</span>
                                      <span className="text-xs font-bold text-purple-400">{editorPrefs.editorWidth}px</span>
                                  </div>
                                  <input 
                                      type="range" 
                                      min="300" 
                                      max="1000" 
                                      step="10"
                                      value={editorPrefs.editorWidth}
                                      onChange={(e) => updatePref('editorWidth', parseInt(e.target.value))}
                                      className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
                                  />
                              </div>

                              <div>
                                  <div className="flex justify-between mb-2">
                                      <span className="text-sm font-medium text-gray-300">문단 간격 (Line Height)</span>
                                      <span className="text-xs font-bold text-purple-400">{editorPrefs.paragraphSpacing}em</span>
                                  </div>
                                  <input 
                                      type="range" 
                                      min="1.0" 
                                      max="3.0" 
                                      step="0.1"
                                      value={editorPrefs.paragraphSpacing}
                                      onChange={(e) => updatePref('paragraphSpacing', parseFloat(e.target.value))}
                                      className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
                                  />
                              </div>
                          </div>
                      </section>
                  </div>

                  <div className="p-5 border-t border-gray-800 bg-[#252525] rounded-b-xl flex justify-end">
                      <button onClick={() => { alert("설정이 적용되었습니다."); setIsSettingsOpen(false); }} className="px-5 py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-sm font-bold transition-colors shadow-lg">확인</button>
                  </div>
              </div>
          </div>
      )}

      {/* Style Manager Modal */}
      <StyleManager 
        isOpen={isStyleManagerOpen} 
        onClose={() => setIsStyleManagerOpen(false)}
        savedStyles={savedStyles}
        onSaveStyle={(s) => { if(onSaveStyle) onSaveStyle(s); }}
        onDeleteStyle={(id) => { if(onDeleteStyle) onDeleteStyle(id); }}
        settings={settings} // Pass settings for Grok usage
        checkApiKey={checkApiKey}
      />

      {/* Synopsis Refiner Modal */}
      <SynopsisRefiner 
        isOpen={isSynopsisRefinerOpen}
        onClose={() => setIsSynopsisRefinerOpen(false)}
        projects={projects}
        stories={stories}
        activeProjectId={null}
        onSaveCard={(title, content, instructions, projectId) => {
            onExternalSave(title, content, projectId, { ...settings, guidelines: instructions } as NovelSettings, 'synopsis');
        }}
        onUpdateProject={(project) => {
            if (onUpdateProject) onUpdateProject(project);
        }}
        onCreateProject={onCreateProject}
        settings={settings} // Pass settings for Grok usage
        checkApiKey={checkApiKey}
      />
    </div>
  );
};

export default HomeScreen;