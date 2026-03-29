


import React, { useState, useEffect } from 'react';
import { Project, SavedStory } from '../types.ts';
import { FolderPlus, Trash2, FileText, ChevronRight, ChevronDown, FolderOpen, Settings, ArrowLeft, Book, Plus, PlusCircle, Lightbulb, Lock, Unlock, ArrowUpDown } from 'lucide-react';
import InputDialog from './InputDialog.tsx';

interface LibraryProps {
  projects: Project[];
  stories: SavedStory[];
  activeProjectId: string | null;
  setActiveProjectId: (id: string | null) => void;
  onCreateProject: (name: string) => void;
  onDeleteProject: (id: string) => void;
  onDeleteStory: (id: string) => void;
  onSelectStory: (story: SavedStory) => void;
  onOpenProjectSettings: (project: Project) => void;
  onManualCreate?: () => void;
  libraryViewMode?: 'selection' | 'manuscript' | 'synopsis';
  setLibraryViewMode?: (mode: 'selection' | 'manuscript' | 'synopsis') => void;
  onResetEditor: () => void;
  onOpenTrash?: () => void; // New prop
}

const Library: React.FC<LibraryProps> = ({
  projects,
  stories,
  activeProjectId,
  setActiveProjectId,
  onCreateProject,
  onDeleteProject,
  onDeleteStory,
  onSelectStory,
  onOpenProjectSettings,
  onManualCreate,
  libraryViewMode = 'selection',
  setLibraryViewMode,
  onResetEditor,
  onOpenTrash
}) => {
  const [newProjectName, setNewProjectName] = useState('');
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const [sortOrder, setSortOrder] = useState<'name' | 'date'>('name');
  
  // Lock Logic
  const [pinDialog, setPinDialog] = useState<{isOpen: boolean, projectId: string, action: 'unlock' | 'lock', onSuccess: () => void}>({
      isOpen: false, projectId: '', action: 'unlock', onSuccess: () => {}
  });

  // Ensure the active project is expanded when it changes
  useEffect(() => {
    if (activeProjectId) {
      setExpandedProjects(prev => new Set(prev).add(activeProjectId));
    }
  }, [activeProjectId]);

  const handleCreate = () => {
    if (newProjectName.trim()) {
      onCreateProject(newProjectName);
      setNewProjectName('');
    }
  };

  const toggleProject = (project: Project) => {
    if (project.isLocked && !expandedProjects.has(project.id)) {
        // Prompt for PIN to unlock/expand
        setPinDialog({
            isOpen: true,
            projectId: project.id,
            action: 'unlock',
            onSuccess: () => {
                setExpandedProjects(prev => new Set(prev).add(project.id));
            }
        });
        return;
    }

    const newExpanded = new Set(expandedProjects);
    if (newExpanded.has(project.id)) {
      newExpanded.delete(project.id);
    } else {
      newExpanded.add(project.id);
    }
    setExpandedProjects(newExpanded);
  };

  const handlePinSubmit = (pin: string) => {
      // Simple hash for demo (In real app use a library)
      const hashed = btoa(pin + "salt"); 
      
      if (pinDialog.action === 'unlock') {
          const project = projects.find(p => p.id === pinDialog.projectId);
          if (project && project.pin === hashed) {
              pinDialog.onSuccess();
              setPinDialog(prev => ({...prev, isOpen: false}));
          } else {
              alert("PIN 번호가 일치하지 않습니다.");
          }
      }
  };

  // Sorting Function
  const sortStories = (list: SavedStory[]) => {
      return [...list].sort((a, b) => {
          if (sortOrder === 'date') {
              // Latest first (Modified or Created)
              const timeA = a.updatedAt || a.createdAt;
              const timeB = b.updatedAt || b.createdAt;
              return timeB - timeA; 
          } else {
              // Name Ascending (Natural Sort for "1화", "2화", "10화")
              return a.title.localeCompare(b.title, undefined, { numeric: true, sensitivity: 'base' });
          }
      });
  };

  const renderStoryList = (storyList: SavedStory[], type: 'manuscript' | 'synopsis') => {
      const sortedList = sortStories(storyList);

      if (sortedList.length === 0) {
          return (
            <div className="text-center py-10 text-gray-500 mx-1 border-dashed border border-gray-700/50 rounded-xl bg-gray-800/20">
                <div className="mb-2 flex justify-center opacity-50">
                    {type === 'manuscript' ? <FileText size={24} /> : <Lightbulb size={24} />}
                </div>
                <p className="text-xs">저장된 {type === 'manuscript' ? '원고' : '시놉시스'}가 없습니다.</p>
            </div>
          );
      }
      return sortedList.map((story) => {
        const charCount = story.content.replace(/\s/g, '').length;
        
        return (
        <div 
            key={story.id} 
            className={`group flex items-center justify-between p-3 border rounded-lg cursor-pointer transition-all mx-1 mb-2
            ${type === 'synopsis' 
                ? 'bg-gray-800/30 hover:bg-gray-800 border-cyan-900/30 hover:border-cyan-500/50' 
                : 'bg-gray-800/50 hover:bg-gray-800 border-gray-700/50 hover:border-indigo-500/50'
            }`}
            onClick={() => onSelectStory(story)}
        >
            <div className="flex items-center gap-3 overflow-hidden">
                <div className={`p-1.5 rounded shrink-0 ${type === 'synopsis' ? 'bg-cyan-900/30 text-cyan-400' : 'bg-gray-700/50 text-indigo-400'}`}>
                    {type === 'synopsis' ? <Lightbulb size={16} /> : <FileText size={16} />}
                </div>
                <div className="flex flex-col overflow-hidden">
                    <span className="text-sm font-medium text-gray-200 truncate group-hover:text-white">{story.title}</span>
                    <div className="flex items-center gap-1 text-[10px] text-gray-500">
                         <span>{new Date(story.updatedAt || story.createdAt).toLocaleDateString()}</span>
                         <span>•</span>
                         <span>{charCount.toLocaleString()}자</span>
                    </div>
                </div>
            </div>
            <button
                onClick={(e) => { e.stopPropagation(); onDeleteStory(story.id); }}
                className="text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 hover:bg-gray-700 rounded"
                title="삭제"
            >
                <Trash2 size={14} />
            </button>
        </div>
        );
      });
  };

  // If a project is active, we show the specialized view based on `libraryViewMode`
  if (activeProjectId) {
      const project = projects.find(p => p.id === activeProjectId);
      const projectStories = stories.filter(s => s.projectId === activeProjectId);
      const manuscripts = projectStories.filter(s => s.category !== 'synopsis');
      const synopses = projectStories.filter(s => s.category === 'synopsis');

      if (project) {
          return (
              <div className="flex flex-col h-full animate-in fade-in slide-in-from-right duration-300">
                  {/* Header for Active Project */}
                  <div className="flex items-center gap-2 mb-4 p-3 bg-indigo-900/30 border border-indigo-500/30 rounded-lg shrink-0">
                      <button 
                        onClick={() => {
                            if (libraryViewMode !== 'selection' && setLibraryViewMode) {
                                setLibraryViewMode('selection');
                            } else {
                                setActiveProjectId(null);
                            }
                        }}
                        className="p-1.5 hover:bg-indigo-800 rounded-full text-indigo-200 transition-colors"
                        title="뒤로 가기"
                      >
                          <ArrowLeft size={16} />
                      </button>
                      <div className="flex-1 overflow-hidden">
                          <div className="text-xs text-indigo-300 font-medium">현재 프로젝트</div>
                          <div className="font-bold text-indigo-100 truncate">{project.name}</div>
                      </div>
                      <button
                        onClick={() => onOpenProjectSettings(project)}
                        className="p-1.5 hover:bg-indigo-800 rounded-full text-indigo-300"
                        title="프로젝트 설정"
                      >
                          <Settings size={16} />
                      </button>
                  </div>
                  
                  {/* VIEW 1: SELECTION CARDS */}
                  {libraryViewMode === 'selection' && setLibraryViewMode && (
                      <div className="flex flex-col gap-4 mt-4">
                          <button 
                            onClick={() => { setLibraryViewMode('manuscript'); onResetEditor(); }}
                            className="flex flex-col items-center justify-center p-8 bg-gray-800 border border-gray-700 hover:border-indigo-500 rounded-2xl transition-all hover:bg-gray-700 group text-center"
                          >
                              <div className="w-12 h-12 bg-indigo-900/50 rounded-full flex items-center justify-center text-indigo-400 mb-3 group-hover:scale-110 transition-transform">
                                  <Book size={24} />
                              </div>
                              <h3 className="font-bold text-white text-lg">원고 보관함</h3>
                              <p className="text-xs text-gray-500 mt-1">정식 연재 원고 관리 및 작성</p>
                          </button>

                          <button 
                            onClick={() => { setLibraryViewMode('synopsis'); onResetEditor(); }}
                            className="flex flex-col items-center justify-center p-8 bg-gray-800 border border-gray-700 hover:border-cyan-500 rounded-2xl transition-all hover:bg-gray-700 group text-center"
                          >
                              <div className="w-12 h-12 bg-cyan-900/50 rounded-full flex items-center justify-center text-cyan-400 mb-3 group-hover:scale-110 transition-transform">
                                  <Lightbulb size={24} />
                              </div>
                              <h3 className="font-bold text-white text-lg">시놉시스 보관함</h3>
                              <p className="text-xs text-gray-500 mt-1">아이디어 및 시놉시스 초안 관리</p>
                          </button>
                      </div>
                  )}

                  {/* VIEW 2: MANUSCRIPTS LIST */}
                  {libraryViewMode === 'manuscript' && (
                      <div className="flex-1 overflow-y-auto pb-20 custom-scrollbar px-2">
                         <div className="flex items-center justify-between mb-3 px-1">
                            <div className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                                <Book size={12} /> 원고 목록
                            </div>
                            <button 
                                onClick={() => setSortOrder(prev => prev === 'name' ? 'date' : 'name')}
                                className="text-[10px] flex items-center gap-1 bg-gray-800 hover:bg-gray-700 px-2 py-1 rounded text-gray-400 hover:text-white transition-colors"
                            >
                                <ArrowUpDown size={10} />
                                {sortOrder === 'name' ? "이름순" : "최신순"}
                            </button>
                        </div>
                        
                         {/* Manual Write Button (Manuscript) */}
                         <div className="px-1">
                             <button 
                                onClick={() => { onManualCreate?.(); }}
                                className="group w-full flex items-center gap-3 p-3 mb-3 border border-dashed border-gray-600 hover:border-indigo-500 bg-gray-800/30 hover:bg-gray-800/80 text-gray-400 hover:text-indigo-300 rounded-lg transition-all text-sm"
                            >
                                <div className="bg-gray-700/50 group-hover:bg-indigo-900/50 p-1.5 rounded text-gray-500 group-hover:text-indigo-400 shrink-0 transition-colors">
                                    <Plus size={16} />
                                </div>
                                <div className="flex flex-col items-start">
                                    <span className="font-bold">직접 집필 (새 원고)</span>
                                    <span className="text-[10px] text-gray-500">AI 없이 빈 페이지에서 시작합니다.</span>
                                </div>
                            </button>
                         </div>

                        {renderStoryList(manuscripts, 'manuscript')}
                      </div>
                  )}

                  {/* VIEW 3: SYNOPSES LIST */}
                  {libraryViewMode === 'synopsis' && (
                      <div className="flex-1 overflow-y-auto pb-20 custom-scrollbar px-2">
                         <div className="flex items-center justify-between mb-3 px-1">
                            <div className="text-xs font-bold text-cyan-600 uppercase tracking-wider flex items-center gap-1">
                                <Lightbulb size={12} /> 시놉시스 보관함
                            </div>
                            <button 
                                onClick={() => setSortOrder(prev => prev === 'name' ? 'date' : 'name')}
                                className="text-[10px] flex items-center gap-1 bg-gray-800 hover:bg-gray-700 px-2 py-1 rounded text-gray-400 hover:text-white transition-colors"
                            >
                                <ArrowUpDown size={10} />
                                {sortOrder === 'name' ? "이름순" : "최신순"}
                            </button>
                        </div>

                        {/* Manual Write Button (Synopsis) - NEW */}
                        <div className="px-1">
                             <button 
                                onClick={() => { onManualCreate?.(); }}
                                className="group w-full flex items-center gap-3 p-3 mb-3 border border-dashed border-gray-600 hover:border-cyan-500 bg-gray-800/30 hover:bg-gray-800/80 text-gray-400 hover:text-cyan-300 rounded-lg transition-all text-sm"
                            >
                                <div className="bg-gray-700/50 group-hover:bg-cyan-900/50 p-1.5 rounded text-gray-500 group-hover:text-cyan-400 shrink-0 transition-colors">
                                    <Plus size={16} />
                                </div>
                                <div className="flex flex-col items-start">
                                    <span className="font-bold">새 시놉시스 추가</span>
                                    <span className="text-[10px] text-gray-500">빈 페이지에서 시놉시스를 작성합니다.</span>
                                </div>
                            </button>
                         </div>

                        {renderStoryList(synopses, 'synopsis')}
                      </div>
                  )}
              </div>
          );
      }
  }

  // Default View: All Projects (Accordion)
  return (
    <div className="flex flex-col h-full">
      {/* Create Project */}
      <div className="flex gap-2 mb-6">
        <input
          type="text"
          placeholder="새 프로젝트 이름"
          className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 outline-none focus:ring-2 focus:ring-indigo-500"
          value={newProjectName}
          onChange={(e) => setNewProjectName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
        />
        <button
          onClick={handleCreate}
          className="bg-gray-700 hover:bg-gray-600 text-white p-2 rounded-lg transition-colors"
          title="프로젝트 생성"
        >
          <FolderPlus size={20} />
        </button>
      </div>

      {/* Project List */}
      <div className="flex-1 overflow-y-auto space-y-2 custom-scrollbar">
        {projects.length === 0 && (
          <div className="text-center text-gray-500 py-8 text-sm">
            <FolderOpen size={32} className="mx-auto mb-2 opacity-30" />
            <p>생성된 프로젝트가 없습니다.</p>
          </div>
        )}

        {(Array.isArray(projects) ? projects : []).map((project) => {
          const projectStories = stories.filter(s => s.projectId === project.id);
          const isExpanded = expandedProjects.has(project.id);
          const sortedStories = sortStories(projectStories);

          return (
            <div key={project.id} className="bg-gray-900/50 rounded-lg overflow-hidden border border-gray-700/50">
              <div 
                className="flex items-center justify-between p-3 hover:bg-gray-800 cursor-pointer group transition-colors"
                onClick={() => toggleProject(project)}
              >
                <div className="flex items-center gap-2 text-gray-200 overflow-hidden">
                  {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  <FolderOpen size={18} className="text-indigo-400 flex-shrink-0" />
                  <span className="font-medium text-sm truncate">{project.name}</span>
                  {project.isLocked && <Lock size={12} className="text-gray-500" />}
                  <span className="text-xs text-gray-500">({projectStories.length})</span>
                </div>
                
                <div className="flex items-center gap-1">
                  <button
                    onClick={(e) => { 
                        e.stopPropagation();
                        if(project.isLocked && !expandedProjects.has(project.id)) {
                            setPinDialog({ isOpen: true, projectId: project.id, action: 'unlock', onSuccess: () => {
                                setActiveProjectId(project.id); 
                                if (setLibraryViewMode) setLibraryViewMode('selection');
                            }});
                        } else {
                            setActiveProjectId(project.id); 
                            if (setLibraryViewMode) setLibraryViewMode('selection');
                        }
                    }}
                    className="text-gray-400 hover:text-indigo-400 p-1.5 rounded hover:bg-gray-700 transition-colors"
                    title="이 프로젝트 입장"
                  >
                    <ArrowLeft size={14} className="rotate-180" />
                  </button>
                </div>
              </div>

              {/* Stories List (Accordion Content) */}
              {isExpanded && (
                <div className="bg-gray-950/30 border-t border-gray-800">
                  {/* Manual Write Shortcut in Accordion */}
                  <div className="flex justify-between items-center p-2 pl-9 pr-2 bg-gray-900/50 border-b border-gray-800/50">
                      <button 
                          onClick={(e) => { 
                              e.stopPropagation();
                              setActiveProjectId(project.id); // Ensure project is active
                              if(setLibraryViewMode) setLibraryViewMode('manuscript'); // Ensure manuscript mode
                              if(onManualCreate) onManualCreate();
                          }}
                          className="flex items-center gap-2 text-xs text-gray-400 hover:text-indigo-300 transition-colors group"
                      >
                          <PlusCircle size={12} /> 직접 집필하기
                      </button>
                      
                      <button 
                         onClick={(e) => {
                             e.stopPropagation();
                             setSortOrder(prev => prev === 'name' ? 'date' : 'name');
                         }}
                         className="flex items-center gap-1 text-[10px] text-gray-500 hover:text-white"
                      >
                         <ArrowUpDown size={10} /> {sortOrder === 'name' ? "이름순" : "최신순"}
                      </button>
                  </div>

                  {sortedStories.length === 0 ? (
                    <p className="text-xs text-gray-500 p-3 pl-9">저장된 원고가 없습니다.</p>
                  ) : (
                    (Array.isArray(sortedStories) ? sortedStories : []).map((story) => (
                      <div 
                        key={story.id} 
                        className="flex items-center justify-between p-2 pl-9 hover:bg-gray-800/50 cursor-pointer group border-b border-gray-800/50 last:border-0"
                        onClick={() => onSelectStory(story)}
                      >
                        <div className="flex items-center gap-2 overflow-hidden flex-1">
                          {story.category === 'synopsis' ? (
                             <Lightbulb size={14} className="text-cyan-600 flex-shrink-0" />
                          ) : (
                             <FileText size={14} className="text-gray-500 flex-shrink-0" />
                          )}
                          <span className={`text-sm truncate ${story.category === 'synopsis' ? 'text-gray-400 italic' : 'text-gray-300'}`}>{story.title}</span>
                          <span className="text-[10px] text-gray-500 ml-1 shrink-0">
                             ({story.content.replace(/\s/g, '').length.toLocaleString()}자)
                          </span>
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); onDeleteStory(story.id); }}
                          className="text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity p-1"
                          title="삭제"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {onOpenTrash && (
          <div className="pt-4 border-t border-gray-800 mt-2">
              <button 
                onClick={onOpenTrash} 
                className="flex items-center justify-center gap-2 w-full py-2 bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-gray-200 rounded-lg text-xs font-bold transition-colors"
              >
                  <Trash2 size={14} /> 휴지통 열기
              </button>
          </div>
      )}

      <InputDialog 
        isOpen={pinDialog.isOpen}
        title="PIN 입력"
        placeholder="4자리 PIN"
        onConfirm={handlePinSubmit}
        onClose={() => setPinDialog(prev => ({...prev, isOpen: false}))}
        confirmText="확인"
      />
    </div>
  );
};

export default Library;