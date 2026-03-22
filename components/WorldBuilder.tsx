
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Project, WorldItem, SavedStory } from '../types.ts';
import { Globe, Send, ArrowLeft, RefreshCcw, Trash2, FileText, Folder, FolderPlus, Plus, X, Home, Move, Sparkles, Save, MessageSquare, ChevronRight, Wand2, Bot, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { refineText, chatWithWorldBuilderAIAssistant, analyzeProjectContext } from '../services/geminiService.ts';
import ReactMarkdown from 'react-markdown';
import DeleteConfirmDialog from './DeleteConfirmDialog.tsx';
import InputDialog from './InputDialog.tsx';

interface WorldBuilderProps {
  projects: Project[];
  stories: SavedStory[];
  activeProjectId: string | null;
  onUpdateProject: (project: Project) => void;
  onBack: () => void;
  setActiveProjectId: (id: string) => void;
  checkApiKey: () => boolean;
}

const WorldBuilder: React.FC<WorldBuilderProps> = ({ 
  projects, 
  stories,
  activeProjectId, 
  onUpdateProject, 
  onBack,
  setActiveProjectId,
  checkApiKey
}) => {
  const activeProject = projects.find(p => p.id === activeProjectId);
  
  const projectStories = useMemo(() => {
    return stories.filter(s => s.projectId === activeProjectId);
  }, [stories, activeProjectId]);

  const needsSync = useMemo(() => {
      if (!activeProject) return false;
      if (projectStories.length === 0) return false;
      if (!activeProject.contextSnapshot || !activeProject.contextAnalysis) return true;
      
      const snapshot = activeProject.contextSnapshot;
      const currentLastUpdate = projectStories.length > 0 
          ? Math.max(...projectStories.map(s => s.updatedAt || s.createdAt)) 
          : 0;
      const currentProjUpdate = (activeProject.worldview?.length || 0) + (activeProject.characters?.length || 0);

      return (
          projectStories.length !== snapshot.totalStories ||
          currentLastUpdate !== snapshot.lastStoryUpdate ||
          currentProjUpdate !== snapshot.projectUpdate
      );
  }, [activeProject, projectStories]);

  const [isAnalyzingContext, setIsAnalyzingContext] = useState(false);

  const handleSyncContext = async () => {
      if (!activeProject) return;
      if (projectStories.length === 0) return alert("프로젝트에 저장된 원고가 없습니다.");
      
      setIsAnalyzingContext(true);
      try {
          const result = await analyzeProjectContext(projectStories, activeProject.settings.geminiModel);
          if (result && onUpdateProject) {
              const lastUpdate = projectStories.length > 0 
                  ? Math.max(...projectStories.map(s => s.updatedAt || s.createdAt)) 
                  : 0;
              const snapshot = {
                  totalStories: projectStories.length,
                  lastStoryUpdate: lastUpdate,
                  projectUpdate: (activeProject.worldview?.length || 0) + (activeProject.characters?.length || 0)
              };
              
              onUpdateProject({
                  ...activeProject,
                  contextAnalysis: result.analysis,
                  contextReferences: result.references,
                  contextSnapshot: snapshot
              });
          } else {
              alert("분석 실패");
          }
      } catch (e) {
          alert("오류 발생");
      } finally {
          setIsAnalyzingContext(false);
      }
  };
  
  const [viewMode, setViewMode] = useState<'editor' | 'assistant' | 'note'>('editor');
  
  // Card System State
  const [items, setItems] = useState<WorldItem[]>([]);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null); // null = root
  
  // Drag & Drop State
  const [draggingId, setDraggingId] = useState<string | null>(null);

  // Note View/Edit State
  const [activeNote, setActiveNote] = useState<WorldItem | null>(null);
  const [isEditingNote, setIsEditingNote] = useState(false);
  const [refineInstruction, setRefineInstruction] = useState('');
  const [isRefining, setIsRefining] = useState(false);

  // AI State
  const [inputQuery, setInputQuery] = useState('');
  const [chatHistory, setChatHistory] = useState<{role: 'user' | 'model', content: string}[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Dialog States
  const [deleteDialog, setDeleteDialog] = useState<{isOpen: boolean, message: string, onConfirm: () => void}>({
    isOpen: false, 
    message: '', 
    onConfirm: () => {}
  });

  const [inputDialog, setInputDialog] = useState<{
    isOpen: boolean;
    title: string;
    onConfirm: (value: string) => void;
  }>({ isOpen: false, title: '', onConfirm: () => {} });

  // Initialize / Migrate Data
  useEffect(() => {
    if (activeProject) {
      const currentJson = JSON.stringify(items);
      // Only parse if the project data is different from local state (avoids loops)
      if (activeProject.worldview !== currentJson) {
        if (!activeProject.worldview) {
          setItems([]);
        } else {
          try {
            const parsed = JSON.parse(activeProject.worldview);
            if (Array.isArray(parsed)) {
              setItems(parsed);
            } else {
              // Migration: Convert old plain text to a single card
              migratePlainText(activeProject.worldview);
            }
          } catch (e) {
            // Migration: Convert old plain text to a single card
            migratePlainText(activeProject.worldview);
          }
        }
      }
    } else {
      setItems([]);
    }
  }, [activeProject]);

  const migratePlainText = (text: string) => {
    const newItem: WorldItem = {
      id: Date.now().toString(),
      type: 'note',
      title: '기본 세계관 설정',
      content: text,
      parentId: null,
      createdAt: Date.now()
    };
    // We call this to save, but let the effect handle the set
    if (activeProject) {
      onUpdateProject({ ...activeProject, worldview: JSON.stringify([newItem]) });
    }
  };

  // Auto-Save Wrapper
  const updateItemsAndSave = (newItems: WorldItem[]) => {
    setItems(newItems);
    if (activeProject) {
      onUpdateProject({ ...activeProject, worldview: JSON.stringify(newItems) });
    }
  };

  // --- CRUD Operations ---

  const createFolder = () => {
    setInputDialog({
      isOpen: true,
      title: "새 폴더 만들기",
      onConfirm: (name) => {
        const newFolder: WorldItem = {
          id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
          type: 'folder',
          title: name,
          content: '',
          parentId: currentFolderId,
          createdAt: Date.now()
        };
        updateItemsAndSave([...items, newFolder]);
      }
    });
  };

  const createNote = (title: string = "새 메모", content: string = "") => {
    const newNote: WorldItem = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
      type: 'note',
      title: title,
      content: content,
      parentId: currentFolderId,
      createdAt: Date.now()
    };
    updateItemsAndSave([...items, newNote]);
    if (!content) {
       setActiveNote(newNote); // Open editor immediately if created manually
       setIsEditingNote(true);
       setViewMode('note');
    }
  };

  const deleteItem = (id: string) => {
    setDeleteDialog({
      isOpen: true,
      message: "정말로 삭제하시겠습니까? 폴더인 경우 내부 항목도 삭제됩니다.",
      onConfirm: () => {
        // Recursive function to find all descendant IDs
        const getDescendants = (parentId: string): string[] => {
          const children = items.filter(i => i.parentId === parentId);
          let descendants = children.map(c => c.id);
          children.forEach(child => {
            if (child.type === 'folder') {
              descendants = [...descendants, ...getDescendants(child.id)];
            }
          });
          return descendants;
        };

        const idsToDelete = new Set([id, ...getDescendants(id)]);
        const newItems = items.filter(i => !idsToDelete.has(i.id));
        updateItemsAndSave(newItems);
      }
    });
  };

  const handleSaveEdit = () => {
    if (!activeNote) return;
    const newItems = items.map(i => i.id === activeNote.id ? activeNote : i);
    updateItemsAndSave(newItems);
    setIsEditingNote(false);
    setRefineInstruction('');
  };

  const handleRefineText = async () => {
    if(!activeNote || !refineInstruction.trim()) return;
    if (!checkApiKey()) return;
    
    setIsRefining(true);
    try {
      const refined = await refineText(activeNote.content, refineInstruction);
      setActiveNote({...activeNote, content: refined});
      setRefineInstruction('');
    } catch(e) {
      alert("수정 중 오류가 발생했습니다.");
    } finally {
      setIsRefining(false);
    }
  }

  // --- Drag & Drop Logic ---

  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggingId(id);
    e.dataTransfer.setData('text/plain', id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault(); // Allow drop
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDropOnFolder = (e: React.DragEvent, targetFolderId: string) => {
    e.preventDefault();
    e.stopPropagation(); // Prevent dropping on background
    const draggedId = e.dataTransfer.getData('text/plain');
    
    if (draggedId === targetFolderId) return; // Can't drop on self

    const newItems = items.map(item => {
      if (item.id === draggedId) {
        return { ...item, parentId: targetFolderId };
      }
      return item;
    });
    updateItemsAndSave(newItems);
    setDraggingId(null);
  };

  const handleDropOnBreadcrumb = (e: React.DragEvent, targetFolderId: string | null) => {
    e.preventDefault();
    const draggedId = e.dataTransfer.getData('text/plain');
    
    const draggedItem = items.find(i => i.id === draggedId);
    if (draggedItem && draggedItem.parentId === targetFolderId) return;

    const newItems = items.map(item => {
      if (item.id === draggedId) {
        return { ...item, parentId: targetFolderId };
      }
      return item;
    });
    updateItemsAndSave(newItems);
    setDraggingId(null);
  };


  // --- AI Logic ---

  useEffect(() => {
    if (chatEndRef.current) {
        chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatHistory]);

  const handleSendMessage = async () => {
    if (!inputQuery.trim() || !activeProject) return;
    if (!checkApiKey()) return;

    const userMsg = inputQuery;
    setInputQuery('');
    setChatHistory(prev => [...prev, { role: 'user', content: userMsg }]);
    setIsLoading(true);

    try {
      const response = await chatWithWorldBuilderAIAssistant(
          activeProject,
          items,
          userMsg,
          chatHistory
      );

      setChatHistory(prev => [...prev, { role: 'model', content: response.reply }]);

      if (response.suggestedItem) {
          const newItem: WorldItem = {
              id: Date.now().toString(),
              title: response.suggestedItem.title,
              content: response.suggestedItem.content,
              type: response.suggestedItem.type,
              parentId: currentFolderId,
              createdAt: Date.now()
          };
          const newItems = [...items, newItem];
          setItems(newItems);
          onUpdateProject({
              ...activeProject,
              worldview: JSON.stringify(newItems)
          });
          setChatHistory(prev => [...prev, { role: 'model', content: `**[시스템]** '${response.suggestedItem?.title}' 설정이 자동으로 추가되었습니다.` }]);
      }
    } catch (e) {
      alert("AI 응답 중 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  // --- Render Helpers ---
  const currentItems = items.filter(i => i.parentId === currentFolderId);
  
  const getBreadcrumbs = () => {
    const crumbs = [{ id: null, title: 'Home' }];
    let currId = currentFolderId;
    const path = [];
    
    let safety = 0;
    while (currId && safety < 10) {
        const folder = items.find(i => i.id === currId);
        if (folder) {
            path.unshift({ id: folder.id, title: folder.title });
            currId = folder.parentId;
        } else {
            break;
        }
        safety++;
    }
    return [...crumbs, ...path];
  };

  return (
    <div className="h-full flex flex-col bg-[#121212] text-gray-100 overflow-hidden">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-center justify-between p-4 border-b border-gray-800 bg-[#1c1c1c] gap-3 shrink-0">
        <div className="flex items-center justify-between w-full md:w-auto">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="p-2 hover:bg-gray-700 rounded-full text-gray-400 hover:text-white transition-colors">
                <ArrowLeft size={20} />
            </button>
            <h2 className="text-lg md:text-xl font-bold flex items-center gap-2 text-emerald-400 truncate">
                <Globe size={20} /> <span className="hidden md:inline">AI 세계관 건축가</span><span className="md:hidden">세계관</span>
            </h2>
          </div>
          
          <div className="flex bg-gray-800 rounded-lg p-1 ml-2 md:ml-4">
            <button 
              onClick={() => setViewMode('editor')}
              className={`px-2 md:px-3 py-1.5 text-xs md:text-sm rounded-md flex items-center gap-1 md:gap-2 transition-colors ${viewMode === 'editor' ? 'bg-emerald-600 text-white' : 'text-gray-400 hover:text-white'}`}
            >
              <FileText size={14} /> 카드
            </button>
            <button 
              onClick={() => setViewMode('assistant')}
              className={`px-2 md:px-3 py-1.5 text-xs md:text-sm rounded-md flex items-center gap-1 md:gap-2 transition-colors ${viewMode === 'assistant' ? 'bg-emerald-600 text-white' : 'text-gray-400 hover:text-white'}`}
            >
              <Bot size={14} /> AI 도우미
            </button>
          </div>
        </div>
        
        <select 
          className="w-full md:w-64 bg-[#252525] border border-gray-700 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500"
          value={activeProjectId || ''}
          onChange={(e) => setActiveProjectId(e.target.value)}
        >
          <option value="" disabled>프로젝트 선택</option>
          {projects.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* --- VIEW MODE: EDITOR --- */}
        {viewMode === 'editor' && (
          <div className="w-full h-full flex flex-col md:flex-row">
            
            {/* Left/Main Column: Card Explorer */}
            <div className="flex-1 flex flex-col bg-[#121212] relative overflow-hidden">
               {/* Toolbar / Breadcrumbs */}
               <div className="p-4 border-b border-gray-800 flex items-center justify-between bg-[#1c1c1c] shrink-0">
                  <div className="flex items-center gap-2 overflow-x-auto no-scrollbar mask-gradient-right">
                     {getBreadcrumbs().map((crumb, idx) => (
                       <React.Fragment key={idx}>
                          {idx > 0 && <span className="text-gray-600"><ChevronRight size={14}/></span>}
                          <button 
                             onClick={() => setCurrentFolderId(crumb.id)}
                             onDragOver={handleDragOver}
                             onDrop={(e) => handleDropOnBreadcrumb(e, crumb.id)}
                             className={`flex items-center gap-1 px-2 py-1 rounded hover:bg-gray-800 transition-colors text-sm whitespace-nowrap
                               ${(crumb.id === currentFolderId) ? 'text-white font-bold' : 'text-gray-400'}`}
                          >
                             {crumb.id === null ? <Home size={14}/> : <Folder size={14}/>}
                             {crumb.title}
                          </button>
                       </React.Fragment>
                     ))}
                  </div>

                  <div className="flex gap-2">
                     <button onClick={createFolder} className="p-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-gray-300" title="새 폴더">
                        <FolderPlus size={18} />
                     </button>
                     <button onClick={() => createNote()} className="p-2 bg-emerald-700 hover:bg-emerald-600 text-white rounded-lg shadow-lg" title="새 메모">
                        <Plus size={18} />
                     </button>
                  </div>
               </div>

               {/* Grid Content */}
               <div className="flex-1 overflow-y-auto p-4 md:p-6 custom-scrollbar">
                  {!activeProject ? (
                    <div className="h-full flex flex-col items-center justify-center text-gray-500">
                       <Globe size={48} className="mb-4 opacity-20" />
                       <p>프로젝트를 선택해주세요.</p>
                    </div>
                  ) : currentItems.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-gray-600">
                       <FolderPlus size={48} className="mb-4 opacity-20" />
                       <p>이 폴더는 비어있습니다.</p>
                       <button onClick={() => createNote()} className="mt-4 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm transition-colors">
                          첫 메모 생성하기
                       </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                       {currentItems.map((item) => (
                          <div 
                             key={item.id}
                             draggable
                             onDragStart={(e) => handleDragStart(e, item.id)}
                             onDragOver={handleDragOver}
                             onDrop={(e) => {
                               if (item.type === 'folder') handleDropOnFolder(e, item.id);
                             }}
                             onClick={() => {
                               if (item.type === 'folder') setCurrentFolderId(item.id);
                               else {
                                 setActiveNote(item);
                                 setIsEditingNote(false);
                                 setViewMode('note');
                               }
                             }}
                             className={`
                               relative group p-4 rounded-xl border transition-all cursor-pointer flex flex-col items-center justify-center text-center gap-3 aspect-square shadow-sm
                               ${item.type === 'folder' 
                                 ? 'bg-gray-800/50 border-gray-700 hover:bg-gray-700 hover:border-gray-500 text-yellow-500' 
                                 : 'bg-[#1e1e1e] border-gray-800 hover:border-emerald-500 text-emerald-400 hover:bg-[#252525]'}
                               ${draggingId === item.id ? 'opacity-50' : 'opacity-100'}
                             `}
                          >
                             {item.type === 'folder' ? <Folder size={40} /> : <FileText size={40} />}
                             <span className="text-sm font-medium text-gray-200 line-clamp-2 leading-tight">
                                {item.title}
                             </span>
                             
                             <button 
                               onClick={(e) => { e.stopPropagation(); deleteItem(item.id); }}
                               className="absolute top-2 right-2 p-1.5 rounded-full bg-black/40 text-gray-300 hover:bg-red-600 hover:text-white opacity-0 group-hover:opacity-100 transition-all"
                             >
                                <Trash2 size={12} />
                             </button>
                          </div>
                       ))}
                    </div>
                  )}
               </div>
            </div>

            {/* Removed Right Column AI Assistant */}
          </div>
        )}

        {/* --- VIEW MODE: ASSISTANT --- */}
        {viewMode === 'assistant' && (
          <div className="w-full h-full flex flex-col bg-[#151515] overflow-hidden relative">
             <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar space-y-6">
                <div className="max-w-3xl mx-auto space-y-6">
                    <div className="bg-[#1e1e1e] border border-gray-800 rounded-xl p-6 text-center shadow-lg">
                        <Bot size={48} className="mx-auto text-emerald-500 mb-4" />
                        <h3 className="text-xl font-bold text-gray-200 mb-2">AI 세계관 도우미</h3>
                        <p className="text-gray-400 text-sm leading-relaxed mb-4">
                            프로젝트의 문맥, 세계관, 캐릭터 설정을 모두 파악하고 있습니다.<br/>
                            설정이 기억나지 않을 때 질문하거나, 새로운 아이디어를 대화하며 구체화해 보세요.<br/>
                            마음에 드는 설정이 나오면 "이 설정 추가해줘"라고 말씀하시면 자동으로 카드에 저장됩니다.
                        </p>
                        
                        {activeProject && projectStories.length > 0 && (
                            <div className="mt-4 pt-4 border-t border-gray-800 flex flex-col items-center">
                                {needsSync ? (
                                    <div className="flex flex-col items-center gap-3">
                                        <div className="flex items-center gap-2 text-yellow-500 text-sm font-medium">
                                            <AlertTriangle size={16} />
                                            <span>최신 원고나 설정이 반영되지 않았습니다. AI가 최신 내용을 알기 위해 동기화가 필요합니다.</span>
                                        </div>
                                        <button 
                                            onClick={handleSyncContext}
                                            disabled={isAnalyzingContext}
                                            className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold text-sm flex items-center gap-2 transition-colors disabled:opacity-50"
                                        >
                                            {isAnalyzingContext ? <RefreshCcw className="animate-spin" size={16} /> : <RefreshCcw size={16} />}
                                            {isAnalyzingContext ? "동기화 중..." : "최신 문맥 및 설정 동기화"}
                                        </button>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2 text-emerald-400 text-sm font-medium bg-emerald-900/20 px-4 py-2 rounded-full border border-emerald-500/30">
                                        <CheckCircle2 size={16} />
                                        <span>최신 문맥 및 설정이 동기화되었습니다.</span>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {chatHistory.map((msg, idx) => (
                        <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[85%] rounded-2xl px-5 py-4 shadow-md ${
                                msg.role === 'user' 
                                    ? 'bg-emerald-600 text-white rounded-tr-sm' 
                                    : 'bg-[#252525] border border-gray-700 text-gray-200 rounded-tl-sm'
                            }`}>
                                <div className="prose prose-invert max-w-none text-sm leading-relaxed whitespace-pre-wrap">
                                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                                </div>
                            </div>
                        </div>
                    ))}
                    {isLoading && (
                        <div className="flex justify-start">
                            <div className="bg-[#252525] border border-gray-700 rounded-2xl rounded-tl-sm px-5 py-4 shadow-md flex items-center gap-3">
                                <RefreshCcw className="animate-spin text-emerald-500" size={18} />
                                <span className="text-sm text-gray-400">AI가 세계관을 분석하며 답변을 작성 중입니다...</span>
                            </div>
                        </div>
                    )}
                    <div ref={chatEndRef} />
                </div>
             </div>

             <div className="p-4 bg-[#1c1c1c] border-t border-gray-800 shrink-0">
                <div className="max-w-3xl mx-auto relative">
                    <textarea 
                        className="w-full bg-[#252525] border border-gray-700 rounded-xl pl-4 pr-14 py-4 text-sm text-white outline-none focus:border-emerald-500 resize-none shadow-inner custom-scrollbar disabled:opacity-50 disabled:cursor-not-allowed"
                        placeholder={needsSync ? "최신 문맥 동기화가 필요합니다." : "세계관에 대해 질문하거나 새로운 설정을 제안해 보세요..."}
                        rows={3}
                        value={inputQuery}
                        disabled={needsSync}
                        onChange={(e) => setInputQuery(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSendMessage();
                            }
                        }}
                    />
                    <button 
                        onClick={handleSendMessage}
                        disabled={isLoading || !inputQuery.trim() || needsSync}
                        className="absolute right-3 bottom-3 p-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors disabled:opacity-50 shadow-md"
                    >
                        <Send size={18} />
                    </button>
                </div>
             </div>
          </div>
        )}
        {/* --- VIEW MODE: NOTE --- */}
        {viewMode === 'note' && activeNote && (
          <div className="w-full h-full flex flex-col bg-[#121212] overflow-hidden">
             {/* Header */}
             <div className="p-4 border-b border-gray-800 flex justify-between items-center bg-[#1c1c1c] shrink-0">
                <div className="flex items-center gap-4 w-full">
                   <button onClick={() => setViewMode('editor')} className="text-gray-400 hover:text-white p-2">
                      <ArrowLeft size={20} />
                   </button>
                   {isEditingNote ? (
                     <input 
                        className="bg-transparent text-lg font-bold text-white outline-none w-full"
                        value={activeNote.title}
                        onChange={(e) => setActiveNote({...activeNote, title: e.target.value})}
                        placeholder="제목 없는 메모"
                     />
                   ) : (
                     <h2 className="text-lg font-bold text-white w-full">{activeNote.title}</h2>
                   )}
                </div>
                <div className="flex items-center gap-3 shrink-0 ml-4">
                   {isEditingNote ? (
                     <>
                       <button onClick={() => {
                         // Revert changes by finding original item
                         const original = items.find(i => i.id === activeNote.id);
                         if (original) setActiveNote(original);
                         setIsEditingNote(false);
                       }} className="px-4 py-2 text-sm text-gray-400 hover:text-white">취소</button>
                       <button onClick={handleSaveEdit} className="px-4 py-2 text-sm bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg shadow-md flex items-center gap-2">
                         <Save size={14} /> 저장
                       </button>
                     </>
                   ) : (
                     <button onClick={() => setIsEditingNote(true)} className="px-4 py-2 text-sm bg-gray-700 hover:bg-gray-600 text-white font-bold rounded-lg shadow-md flex items-center gap-2">
                       <FileText size={14} /> 편집
                     </button>
                   )}
                </div>
             </div>
             
             {/* Body */}
             <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
                {/* Editor / Viewer */}
                <div className="flex-1 p-4 md:p-8 overflow-y-auto custom-scrollbar">
                   <div className="max-w-4xl w-full mx-auto min-h-full flex flex-col">
                     {isEditingNote ? (
                       <textarea 
                          className="flex-1 w-full bg-transparent text-gray-200 text-lg leading-relaxed outline-none resize-none custom-scrollbar"
                          value={activeNote.content}
                          onChange={(e) => setActiveNote({...activeNote, content: e.target.value})}
                          placeholder="내용을 입력하세요..."
                       />
                     ) : (
                       <div className="bg-[#1a1a1a] rounded-2xl p-8 md:p-12 shadow-2xl border border-gray-800/60 flex-grow flex flex-col">
                         <header className="mb-10 border-b border-gray-800/60 pb-8">
                           <h1 className="text-3xl md:text-4xl font-black text-gray-100 mb-4 tracking-tight leading-tight">{activeNote.title}</h1>
                           <div className="flex items-center gap-4 text-sm text-gray-500 font-medium">
                             <span className="flex items-center gap-1.5 bg-gray-800/50 px-2.5 py-1 rounded-md"><FileText size={14} /> 세계관 노트</span>
                             <span className="flex items-center gap-1.5">
                               {new Date(activeNote.createdAt).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}
                             </span>
                           </div>
                         </header>
                         <div className="prose prose-invert prose-lg max-w-none text-gray-300 whitespace-pre-wrap leading-relaxed font-sans">
                           <ReactMarkdown>{activeNote.content || '*내용이 없습니다.*'}</ReactMarkdown>
                         </div>
                       </div>
                     )}
                   </div>
                </div>
                
                {/* AI Tools (Only visible when editing) */}
                {isEditingNote && (
                  <div className="w-full md:w-80 border-t md:border-t-0 md:border-l border-gray-800 bg-[#1c1c1c] flex flex-col shrink-0">
                     <div className="p-4 border-b border-gray-800 font-bold text-gray-400 flex items-center gap-2">
                        <Sparkles size={16} /> AI 보조 도구
                     </div>
                     <div className="p-4 space-y-4">
                        <div>
                           <label className="text-xs font-bold text-emerald-500 mb-1 block">문장 수정/보완</label>
                           <textarea 
                              className="w-full h-24 bg-[#121212] border border-gray-700 rounded p-3 text-sm text-gray-300 outline-none resize-none focus:border-emerald-500/50 transition-colors"
                              placeholder="예: 좀 더 신비로운 톤으로 바꿔줘, 역사적 사실을 추가해줘..."
                              value={refineInstruction}
                              onChange={(e) => setRefineInstruction(e.target.value)}
                           />
                           <button 
                              onClick={handleRefineText}
                              disabled={isRefining || !refineInstruction.trim()}
                              className="w-full mt-2 py-2.5 bg-emerald-800 hover:bg-emerald-700 text-emerald-100 rounded-lg text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50 transition-colors"
                           >
                              {isRefining ? <RefreshCcw className="animate-spin" size={14}/> : <Wand2 size={14}/>}
                              수정 요청
                           </button>
                        </div>
                     </div>
                  </div>
                )}
             </div>
          </div>
        )}
      </div>

      {/* --- MODALS --- */}
      
      <DeleteConfirmDialog 
        isOpen={deleteDialog.isOpen}
        onClose={() => setDeleteDialog(prev => ({ ...prev, isOpen: false }))}
        onConfirm={() => {
          deleteDialog.onConfirm();
          setDeleteDialog(prev => ({ ...prev, isOpen: false }));
        }}
        message={deleteDialog.message}
      />

      <InputDialog 
        isOpen={inputDialog.isOpen}
        title={inputDialog.title}
        onConfirm={inputDialog.onConfirm}
        onClose={() => setInputDialog(prev => ({...prev, isOpen: false}))}
      />
    </div>
  );
};

export default WorldBuilder;
