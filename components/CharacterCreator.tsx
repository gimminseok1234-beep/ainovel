


import React, { useState, useEffect, useRef } from 'react';
import { Project, CharacterRelationship, CharacterProfile } from '../types.ts';
import { UserPlus, ArrowLeft, Sparkles, User, Trash2, Users, RefreshCcw, Plus, Camera, Folder, FolderPlus, Home, ChevronRight, LayoutGrid, List, Pencil, X } from 'lucide-react';
import { generateCharacterProfile } from '../services/geminiService.ts';
import DeleteConfirmDialog from './DeleteConfirmDialog.tsx';
import InputDialog from './InputDialog.tsx';

interface CharacterCreatorProps {
  projects: Project[];
  activeProjectId: string | null;
  onUpdateProject: (project: Project) => void;
  onBack: () => void;
  setActiveProjectId: (id: string) => void;
}

// Helper to serialize objects back to JSON string
const stringifyCharacters = (profiles: CharacterProfile[]): string => {
  return JSON.stringify(profiles);
};

const CharacterCreator: React.FC<CharacterCreatorProps> = ({
  projects,
  activeProjectId,
  onUpdateProject,
  onBack,
  setActiveProjectId
}) => {
  const activeProject = projects.find(p => p.id === activeProjectId);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const isEditingRef = useRef(false);

  // View State
  const [viewMode, setViewMode] = useState<'editor' | 'generator'>('editor'); // Default to Editor
  const [layoutMode, setLayoutMode] = useState<'grid' | 'detail'>('grid'); // Within Editor

  // Folder Logic
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  
  // Data State
  const [items, setItems] = useState<CharacterProfile[]>([]);
  const [selectedCharIndex, setSelectedCharIndex] = useState<number | null>(null); // Index in the FULL list
  
  // Drag State
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  // Generator State
  const [genName, setGenName] = useState('');
  const [genRole, setGenRole] = useState('');
  const [genExtra, setGenExtra] = useState('');
  const [genProfile, setGenProfile] = useState<CharacterProfile>({
    id: '', name: '', role: '', specs: '', personality: '', appearance: '', backstory: '', hashtags: []
  });
  const [isGenerating, setIsGenerating] = useState(false);

  // Dialogs
  const [deleteDialog, setDeleteDialog] = useState<{isOpen: boolean, message: string, onConfirm: () => void}>({
    isOpen: false, message: '', onConfirm: () => {}
  });
  const [inputDialog, setInputDialog] = useState<{isOpen: boolean, title: string, onConfirm: (val: string) => void}>({
    isOpen: false, title: '', onConfirm: () => {}
  });

  // --- MIGRATION & INIT ---
  useEffect(() => {
    if (isEditingRef.current) return;

    if (activeProject) {
      let parsed: CharacterProfile[] = [];
      try {
        parsed = JSON.parse(activeProject.characters || '[]');
      } catch(e) {
        parsed = []; 
      }

      // Migration: Ensure all items have IDs and types
      let modified = false;
      const migrated = parsed.map(p => {
          if (!p.id || !p.type) {
              modified = true;
              return {
                  ...p,
                  id: p.id || Date.now().toString() + Math.random().toString(36).substr(2, 5),
                  type: p.type || 'character',
                  parentId: p.parentId || null
              };
          }
          return p;
      });

      // Update state
      if (JSON.stringify(migrated) !== JSON.stringify(items)) {
          setItems(migrated);
          // If we migrated data, save it back silently to persist structure
          if (modified && activeProject.characters) {
              onUpdateProject({ ...activeProject, characters: stringifyCharacters(migrated) });
          }
      }
    } else {
      setItems([]);
      setSelectedCharIndex(null);
    }
  }, [activeProject]);

  // --- CRUD Operations ---

  const saveItems = (newItems: CharacterProfile[]) => {
      setItems(newItems);
      if (activeProject) {
          onUpdateProject({ ...activeProject, characters: stringifyCharacters(newItems) });
      }
  };

  const createFolder = () => {
      setInputDialog({
          isOpen: true,
          title: "새 폴더 만들기",
          onConfirm: (name) => {
              const newFolder: CharacterProfile = {
                  id: Date.now().toString(),
                  type: 'folder',
                  name: name,
                  role: 'Folder', // Placeholder
                  parentId: currentFolderId,
                  specs: '', personality: '', appearance: '', backstory: '', hashtags: []
              };
              saveItems([...items, newFolder]);
          }
      });
  };

  const handleAddNewManual = () => {
    const newChar: CharacterProfile = {
      id: Date.now().toString(),
      type: 'character',
      parentId: currentFolderId,
      name: '새 캐릭터',
      role: '역할 미정',
      specs: '', personality: '', appearance: '', backstory: '', hashtags: []
    };
    const newItems = [...items, newChar];
    saveItems(newItems);
    
    // Auto-select and enter detail view
    const newIndex = newItems.length - 1;
    setSelectedCharIndex(newIndex);
    setLayoutMode('detail');
  };

  const deleteItem = (id: string) => {
      setDeleteDialog({
          isOpen: true,
          message: "정말로 삭제하시겠습니까? 폴더인 경우 내부 항목도 삭제됩니다.",
          onConfirm: () => {
              // Recursive delete logic
              const getDescendants = (parentId: string): string[] => {
                  const children = items.filter(i => i.parentId === parentId);
                  let descendants = children.map(c => c.id as string);
                  children.forEach(child => {
                      if (child.type === 'folder' && child.id) {
                          descendants = [...descendants, ...getDescendants(child.id)];
                      }
                  });
                  return descendants;
              };

              const idsToDelete = new Set([id, ...getDescendants(id)]);
              const newItems = items.filter(i => i.id && !idsToDelete.has(i.id));
              
              saveItems(newItems);
              if (selectedCharIndex !== null && items[selectedCharIndex]?.id === id) {
                  setLayoutMode('grid');
                  setSelectedCharIndex(null);
              }
          }
      });
  };

  const renameItem = (item: CharacterProfile) => {
      setInputDialog({
          isOpen: true,
          title: "이름 변경",
          onConfirm: (newName) => {
              const newItems = items.map(i => i.id === item.id ? { ...i, name: newName } : i);
              saveItems(newItems);
          }
      });
  };

  // --- Drag & Drop ---
  const handleDragStart = (e: React.DragEvent, id: string) => {
      setDraggingId(id);
      e.dataTransfer.setData('text/plain', id);
      e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, targetId?: string) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      if (targetId && targetId !== draggingId) {
          setDragOverId(targetId);
      }
  };

  const handleDragLeave = () => {
      setDragOverId(null);
  };

  const handleDropOnFolder = (e: React.DragEvent, targetId: string) => {
      e.preventDefault();
      e.stopPropagation();
      setDragOverId(null);
      const draggedId = e.dataTransfer.getData('text/plain');
      if (draggedId === targetId) return;

      const newItems = items.map(i => {
          if (i.id === draggedId) return { ...i, parentId: targetId };
          return i;
      });
      saveItems(newItems);
      setDraggingId(null);
  };

  const handleDropOnBreadcrumb = (e: React.DragEvent, targetId: string | null) => {
      e.preventDefault();
      setDragOverId(null);
      const draggedId = e.dataTransfer.getData('text/plain');
      const item = items.find(i => i.id === draggedId);
      if (item && item.parentId === targetId) return; // Same level

      const newItems = items.map(i => {
          if (i.id === draggedId) return { ...i, parentId: targetId };
          return i;
      });
      saveItems(newItems);
      setDraggingId(null);
  };

  // --- Editor Field Updates ---
  const handleUpdateLocal = (field: keyof CharacterProfile, value: any) => {
      if (selectedCharIndex === null) return;
      const newItems = [...items];
      newItems[selectedCharIndex] = { ...newItems[selectedCharIndex], [field]: value };
      setItems(newItems);
  };

  const handleHashtagAdd = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && selectedCharIndex !== null) {
          const val = (e.target as HTMLInputElement).value.trim();
          if (val) {
              const currentTags = items[selectedCharIndex].hashtags || [];
              if (!currentTags.includes(val)) {
                  handleUpdateLocal('hashtags', [...currentTags, val]);
              }
              (e.target as HTMLInputElement).value = '';
          }
      }
  };

  const handleHashtagRemove = (tagToRemove: string) => {
      if (selectedCharIndex !== null) {
          const currentTags = items[selectedCharIndex].hashtags || [];
          handleUpdateLocal('hashtags', currentTags.filter(t => t !== tagToRemove));
      }
  };

  const triggerAutoSave = () => {
      isEditingRef.current = false;
      if (activeProject) {
          onUpdateProject({ ...activeProject, characters: stringifyCharacters(items) });
      }
  };

  // --- Generator Handlers ---
  const handleGenerate = async () => {
      if (!activeProject) return alert("프로젝트를 선택해주세요.");
      setIsGenerating(true);
      try {
          const result = await generateCharacterProfile(activeProject.worldview, genName, genRole, genExtra);
          if (result) {
              setGenProfile({ 
                  ...result, 
                  id: Date.now().toString(),
                  type: 'character',
                  parentId: currentFolderId 
              });
          }
      } catch (e) { alert("오류 발생"); } finally { setIsGenerating(false); }
  };

  const handleSaveGenerated = () => {
      if (!genProfile.name) return;
      saveItems([...items, genProfile]);
      alert("저장되었습니다.");
      setGenProfile({ id:'', name:'', role:'', specs:'', personality:'', appearance:'', backstory:'', hashtags:[] });
      setGenName(''); setGenRole(''); setGenExtra('');
      setViewMode('editor');
  };

  // --- Render Helpers ---
  const currentItems = items.filter(i => i.parentId === currentFolderId);
  const getBreadcrumbs = () => {
      const crumbs = [{ id: null, title: 'Home' }];
      let curr = currentFolderId;
      const path = [];
      while (curr) {
          const folder = items.find(i => i.id === curr);
          if (folder) {
              path.unshift({ id: folder.id, title: folder.name });
              curr = folder.parentId || null;
          } else break;
      }
      return [...crumbs, ...path];
  };

  // Image Upload
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (selectedCharIndex === null) return;
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
          const newItems = [...items];
          newItems[selectedCharIndex] = { ...newItems[selectedCharIndex], imageUrl: ev.target?.result as string };
          saveItems(newItems);
      };
      reader.readAsDataURL(file);
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
                    <h2 className="text-lg md:text-xl font-bold flex items-center gap-2 text-rose-400 truncate">
                        <Users size={20} /> <span className="hidden md:inline">캐릭터 연구소</span><span className="md:hidden">캐릭터</span>
                    </h2>
                </div>
                <div className="flex bg-gray-800 rounded-lg p-1 ml-2 md:ml-4">
                    <button onClick={() => { setViewMode('editor'); setLayoutMode('grid'); }} className={`px-3 py-1.5 text-xs md:text-sm rounded-md flex items-center gap-2 transition-colors ${viewMode === 'editor' ? 'bg-rose-600 text-white' : 'text-gray-400 hover:text-white'}`}>
                        <LayoutGrid size={14} /> 관리
                    </button>
                    <button onClick={() => setViewMode('generator')} className={`px-3 py-1.5 text-xs md:text-sm rounded-md flex items-center gap-2 transition-colors ${viewMode === 'generator' ? 'bg-rose-600 text-white' : 'text-gray-400 hover:text-white'}`}>
                        <Sparkles size={14} /> 생성
                    </button>
                </div>
            </div>
            <select 
                className="w-full md:w-64 bg-[#252525] border border-gray-700 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-rose-500"
                value={activeProjectId || ''}
                onChange={(e) => setActiveProjectId(e.target.value)}
            >
                <option value="" disabled>프로젝트 선택</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
        </header>

        {/* Content */}
        <div className="flex-1 flex overflow-hidden relative">
            {!activeProject ? (
                <div className="flex-1 flex items-center justify-center text-gray-500">프로젝트를 선택해주세요.</div>
            ) : viewMode === 'generator' ? (
                // GENERATOR MODE
                <div className="w-full flex flex-col md:flex-row h-full overflow-hidden">
                    <div className="w-full md:w-1/3 border-r border-gray-800 p-6 bg-[#1c1c1c] overflow-y-auto custom-scrollbar">
                        <h3 className="font-bold text-gray-300 mb-6 flex items-center gap-2"><User size={18}/> AI 캐릭터 생성</h3>
                        <div className="space-y-4">
                            <input className="w-full bg-[#252525] border border-gray-700 rounded-lg p-3 text-sm focus:border-rose-500 outline-none" placeholder="이름 (예: 카일)" value={genName} onChange={(e) => setGenName(e.target.value)} />
                            <input className="w-full bg-[#252525] border border-gray-700 rounded-lg p-3 text-sm focus:border-rose-500 outline-none" placeholder="역할 (예: 기사단장)" value={genRole} onChange={(e) => setGenRole(e.target.value)} />
                            <textarea className="w-full h-32 bg-[#252525] border border-gray-700 rounded-lg p-3 text-sm focus:border-rose-500 outline-none resize-none" placeholder="추가 특징 (성격, 외모 등)" value={genExtra} onChange={(e) => setGenExtra(e.target.value)} />
                            <button onClick={handleGenerate} disabled={isGenerating || !genName} className="w-full py-3 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-lg shadow-lg flex items-center justify-center gap-2">
                                {isGenerating ? <RefreshCcw className="animate-spin" /> : <Sparkles />} 생성하기
                            </button>
                        </div>
                    </div>
                    <div className="flex-1 p-6 bg-[#121212] overflow-y-auto custom-scrollbar">
                        {genProfile.name && (
                            <div className="max-w-2xl mx-auto bg-rose-900/10 border border-rose-500/30 rounded-xl p-6">
                                <h2 className="text-xl font-bold text-rose-400 mb-4">생성 결과</h2>
                                <div className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <input className="bg-[#1e1e1e] border border-gray-700 rounded p-2 text-white" value={genProfile.name} onChange={(e) => setGenProfile({...genProfile, name: e.target.value})} />
                                        <input className="bg-[#1e1e1e] border border-gray-700 rounded p-2 text-white" value={genProfile.role} onChange={(e) => setGenProfile({...genProfile, role: e.target.value})} />
                                    </div>
                                    <textarea className="w-full h-24 bg-[#1e1e1e] border border-gray-700 rounded p-2 text-white resize-none" value={genProfile.personality} onChange={(e) => setGenProfile({...genProfile, personality: e.target.value})} />
                                    <textarea className="w-full h-24 bg-[#1e1e1e] border border-gray-700 rounded p-2 text-white resize-none" value={genProfile.appearance} onChange={(e) => setGenProfile({...genProfile, appearance: e.target.value})} />
                                    <textarea className="w-full h-32 bg-[#1e1e1e] border border-gray-700 rounded p-2 text-white resize-none" value={genProfile.backstory} onChange={(e) => setGenProfile({...genProfile, backstory: e.target.value})} />
                                    <button onClick={handleSaveGenerated} className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg">저장하기</button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            ) : layoutMode === 'grid' ? (
                // EDITOR: GRID VIEW (Folders & Items)
                <div className="w-full h-full flex flex-col">
                    {/* Toolbar */}
                    <div className="p-4 border-b border-gray-800 bg-[#1c1c1c] flex justify-between items-center shrink-0">
                        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar mask-gradient-right max-w-[60%]">
                            {getBreadcrumbs().map((crumb, idx) => (
                                <React.Fragment key={idx}>
                                    {idx > 0 && <ChevronRight size={14} className="text-gray-600"/>}
                                    <button 
                                        onClick={() => setCurrentFolderId(crumb.id as string)}
                                        onDragOver={handleDragOver}
                                        onDrop={(e) => handleDropOnBreadcrumb(e, crumb.id as string)}
                                        className={`flex items-center gap-1 px-2 py-1 rounded hover:bg-gray-800 transition-colors text-sm whitespace-nowrap ${crumb.id === currentFolderId ? 'text-white font-bold' : 'text-gray-400'}`}
                                    >
                                        {crumb.id === null ? <Home size={14}/> : <Folder size={14}/>} {crumb.title}
                                    </button>
                                </React.Fragment>
                            ))}
                        </div>
                        <div className="flex gap-2">
                            <button onClick={createFolder} className="p-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-gray-300 flex items-center gap-2 text-xs font-bold"><FolderPlus size={16}/> 폴더 추가</button>
                            <button onClick={handleAddNewManual} className="p-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg flex items-center gap-2 text-xs font-bold"><Plus size={16}/> 캐릭터 추가</button>
                        </div>
                    </div>

                    {/* Grid */}
                    <div className="flex-1 overflow-y-auto p-6 custom-scrollbar bg-[#121212]">
                        {currentItems.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-gray-600">
                                <UserPlus size={48} className="mb-4 opacity-20"/>
                                <p>폴더가 비어있습니다.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                                {currentItems.map((item) => (
                                    <div 
                                        key={item.id}
                                        draggable
                                        onDragStart={(e) => handleDragStart(e, item.id as string)}
                                        onDragOver={handleDragOver}
                                        onDrop={(e) => item.type === 'folder' && handleDropOnFolder(e, item.id as string)}
                                        onClick={() => {
                                            if (item.type === 'folder') setCurrentFolderId(item.id as string);
                                            else {
                                                const idx = items.findIndex(i => i.id === item.id);
                                                setSelectedCharIndex(idx);
                                                setLayoutMode('detail');
                                            }
                                        }}
                                        className={`
                                            relative group rounded-xl border p-4 cursor-pointer transition-all flex flex-col items-center gap-3 aspect-square justify-center text-center shadow-sm
                                            ${item.type === 'folder' ? 'bg-gray-800/50 border-gray-700 hover:border-indigo-500 text-yellow-500' : 'bg-[#1e1e1e] border-gray-800 hover:border-rose-500 text-rose-300'}
                                            ${draggingId === item.id ? 'opacity-50' : 'opacity-100'}
                                        `}
                                    >
                                        {item.type === 'folder' ? <Folder size={40} fill="currentColor" className="opacity-80"/> : (
                                            item.imageUrl ? <img src={item.imageUrl} className="w-16 h-16 rounded-full object-cover border-2 border-rose-500/30" /> : <User size={40} />
                                        )}
                                        <div>
                                            <span className="text-sm font-bold text-gray-200 block truncate max-w-[120px]">{item.name}</span>
                                            {item.type === 'character' && <span className="text-xs text-gray-500 truncate block max-w-[120px]">{item.role}</span>}
                                        </div>
                                        
                                        <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={(e) => { e.stopPropagation(); renameItem(item); }} className="p-1.5 bg-black/50 hover:bg-gray-700 rounded text-white"><Pencil size={12}/></button>
                                            <button onClick={(e) => { e.stopPropagation(); deleteItem(item.id as string); }} className="p-1.5 bg-black/50 hover:bg-red-600 rounded text-white"><Trash2 size={12}/></button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                // EDITOR: DETAIL VIEW
                <div className="w-full h-full flex flex-col bg-[#121212]">
                    <div className="p-4 border-b border-gray-800 bg-[#1c1c1c] flex items-center gap-4 shrink-0">
                        <button onClick={() => setLayoutMode('grid')} className="p-2 hover:bg-gray-700 rounded-full text-gray-400 hover:text-white"><ArrowLeft size={20}/></button>
                        <h3 className="text-lg font-bold text-white">캐릭터 상세 편집</h3>
                    </div>
                    {selectedCharIndex !== null && items[selectedCharIndex] && (
                        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                            <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
                                <div className="lg:col-span-4 space-y-6">
                                    <div className="flex flex-col items-center p-6 bg-[#1e1e1e] rounded-xl border border-gray-800">
                                        <div className="w-40 h-40 rounded-full bg-gray-700 overflow-hidden mb-4 relative group cursor-pointer border-4 border-gray-800" onClick={() => imageInputRef.current?.click()}>
                                            {items[selectedCharIndex].imageUrl ? <img src={items[selectedCharIndex].imageUrl} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-gray-500"><Camera size={32}/></div>}
                                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white font-medium">사진 변경</div>
                                        </div>
                                        <input type="file" ref={imageInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} />
                                    </div>
                                    <div className="bg-[#1c1c1c] p-4 rounded-xl border border-gray-800 space-y-4">
                                        <div><label className="text-xs text-rose-400 font-bold">이름</label><input className="w-full bg-[#252525] border border-gray-700 rounded p-3 text-white focus:border-rose-500 outline-none" value={items[selectedCharIndex].name} onChange={(e) => handleUpdateLocal('name', e.target.value)} onFocus={() => isEditingRef.current = true} onBlur={triggerAutoSave} /></div>
                                        <div><label className="text-xs text-rose-400 font-bold">역할</label><input className="w-full bg-[#252525] border border-gray-700 rounded p-3 text-white focus:border-rose-500 outline-none" value={items[selectedCharIndex].role} onChange={(e) => handleUpdateLocal('role', e.target.value)} onFocus={() => isEditingRef.current = true} onBlur={triggerAutoSave} /></div>
                                        <div><label className="text-xs text-rose-400 font-bold">신체정보</label><input className="w-full bg-[#252525] border border-gray-700 rounded p-3 text-white focus:border-rose-500 outline-none" value={items[selectedCharIndex].specs} onChange={(e) => handleUpdateLocal('specs', e.target.value)} onFocus={() => isEditingRef.current = true} onBlur={triggerAutoSave} /></div>
                                    </div>
                                    
                                    {/* Hashtags Section */}
                                    <div className="bg-[#1c1c1c] p-4 rounded-xl border border-gray-800">
                                        <label className="text-xs text-rose-400 font-bold mb-2 block">해시태그 (Enter로 추가)</label>
                                        <div className="flex flex-wrap gap-2 mb-2">
                                            {(items[selectedCharIndex].hashtags || []).map((tag, idx) => (
                                                <span key={idx} className="bg-rose-900/30 text-rose-300 px-2 py-1 rounded text-xs flex items-center gap-1 border border-rose-500/20">
                                                    #{tag}
                                                    <button onClick={() => handleHashtagRemove(tag)} className="hover:text-white"><X size={12}/></button>
                                                </span>
                                            ))}
                                        </div>
                                        <input 
                                            className="w-full bg-[#252525] border border-gray-700 rounded p-2 text-sm text-white focus:border-rose-500 outline-none"
                                            placeholder="태그 입력..."
                                            onKeyDown={handleHashtagAdd}
                                        />
                                    </div>
                                </div>
                                <div className="lg:col-span-8 space-y-6">
                                    <div><label className="text-xs text-rose-400 font-bold mb-1 block">성격</label><textarea className="w-full h-32 bg-[#1e1e1e] border border-gray-700 rounded p-4 text-white focus:border-rose-500 outline-none resize-none" value={items[selectedCharIndex].personality} onChange={(e) => handleUpdateLocal('personality', e.target.value)} onFocus={() => isEditingRef.current = true} onBlur={triggerAutoSave} /></div>
                                    <div><label className="text-xs text-rose-400 font-bold mb-1 block">외모 묘사</label><textarea className="w-full h-32 bg-[#1e1e1e] border border-gray-700 rounded p-4 text-white focus:border-rose-500 outline-none resize-none" value={items[selectedCharIndex].appearance} onChange={(e) => handleUpdateLocal('appearance', e.target.value)} onFocus={() => isEditingRef.current = true} onBlur={triggerAutoSave} /></div>
                                    <div><label className="text-xs text-rose-400 font-bold mb-1 block">배경 스토리</label><textarea className="w-full h-48 bg-[#1e1e1e] border border-gray-700 rounded p-4 text-white focus:border-rose-500 outline-none resize-none" value={items[selectedCharIndex].backstory} onChange={(e) => handleUpdateLocal('backstory', e.target.value)} onFocus={() => isEditingRef.current = true} onBlur={triggerAutoSave} /></div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>

        <DeleteConfirmDialog isOpen={deleteDialog.isOpen} onClose={() => setDeleteDialog(prev => ({...prev, isOpen: false}))} onConfirm={deleteDialog.onConfirm} message={deleteDialog.message} />
        <InputDialog isOpen={inputDialog.isOpen} title={inputDialog.title} onConfirm={inputDialog.onConfirm} onClose={() => setInputDialog(prev => ({...prev, isOpen: false}))} />
    </div>
  );
};

export default CharacterCreator;