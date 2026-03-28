
// ... existing imports
import React, { useState, useEffect, useRef } from 'react';
import { Project, IdeaSession, ChatMessage, WorldItem, NovelSettings, SavedStory, CharacterProfile, SavedStyle, DEFAULT_SETTINGS } from '../types.ts';
import { Lightbulb, Plus, MessageSquare, Trash2, Edit2, Send, Compass, Save, ArrowLeft, FolderPlus, RefreshCcw, X, Bot, User, FileText, Wand2, Sparkles, BookOpenCheck, CheckCircle2, ChevronDown, ChevronUp, LayoutList, ArrowRight, Maximize2, RotateCcw, Globe, UserPlus, Flame, BrainCircuit, Paperclip, Link, AlertTriangle, Book, Cpu } from 'lucide-react';
import { chatWithIdeaPartner, refineText, analyzeProjectContext, generateSynopsisOptions, expandDetailedSynopsis, organizeWorldviewFromChat, extractCharacterFromChat, analyzeWritingStyle, AI_MODELS, isGrokModel } from '../services/geminiService.ts';
import ReactMarkdown from 'react-markdown';
import DeleteConfirmDialog from './DeleteConfirmDialog.tsx';
import InputDialog from './InputDialog.tsx';

// ... (props interface unchanged)
interface IdeaExplorerProps {
  projects: Project[];
  sessions: IdeaSession[];
  stories: SavedStory[];
  onUpdateSession: (session: IdeaSession) => void;
  onDeleteSession: (id: string) => void;
  onCreateSession: () => void;
  onUpdateProject: (project: Project) => void;
  onSaveStory: (title: string, content: string, projectId: string, settings?: NovelSettings, category?: 'manuscript' | 'synopsis') => void;
  onBack: () => void;
  onSaveStyle?: (style: SavedStyle) => void;
  savedStyles?: SavedStyle[];
  checkApiKey: () => boolean;
  settings?: NovelSettings;
}

const IdeaExplorer: React.FC<IdeaExplorerProps> = ({
  projects,
  sessions,
  stories,
  onUpdateSession,
  onDeleteSession,
  onCreateSession,
  onUpdateProject,
  onSaveStory,
  onBack,
  onSaveStyle,
  savedStyles = [],
  checkApiKey,
  settings
}) => {
  // ... (state definitions unchanged)
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Data Refs for Async Access (Fixes Stale Closure Issues)
  const projectsRef = useRef(projects);
  const savedStylesRef = useRef(savedStyles);

  useEffect(() => {
      projectsRef.current = projects;
  }, [projects]);

  useEffect(() => {
      savedStylesRef.current = savedStyles;
  }, [savedStyles]);

  // Context Analysis State
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [isContextStale, setIsContextStale] = useState(false);

  // Style Attachment
  const [attachedStyleId, setAttachedStyleId] = useState<string>('');
  const [isStyleSelectorOpen, setIsStyleSelectorOpen] = useState(false);

  // Tools State
  const [isOrganizingWorld, setIsOrganizingWorld] = useState(false);
  const [isExtractingChar, setIsExtractingChar] = useState(false);
  const [isSavingStyle, setIsSavingStyle] = useState(false);

  // Synopsis Draft Mode
  const [isSynopsisMode, setIsSynopsisMode] = useState(false);
  
  // Model Selection
  const [selectedModel, setSelectedModel] = useState<string>(settings?.primaryModel || settings?.geminiModel || 'gemini-3-flash-preview');
  
  // Expansion Modal State
  const [expandedOption, setExpandedOption] = useState<{title: string, summary: string, appeal: string} | null>(null);

  // Dialog States
  const [deleteDialog, setDeleteDialog] = useState<{isOpen: boolean, message: string, onConfirm: () => void}>({
    isOpen: false, message: '', onConfirm: () => {}
  });
  const [renameDialog, setRenameDialog] = useState<{isOpen: boolean, sessionId: string, title: string}>({
    isOpen: false, sessionId: '', title: ''
  });
  const [styleSaveDialog, setStyleSaveDialog] = useState<{isOpen: boolean, content: string}>({
      isOpen: false, content: ''
  });

  const activeSession = sessions.find(s => s.id === activeSessionId);
  const activeProject = activeSession?.projectId ? projects.find(p => p.id === activeSession.projectId) : null;
  const attachedStyle = savedStyles.find(s => s.id === attachedStyleId);

  const contextAnalysis = activeProject?.contextAnalysis;
  const contextReferences = activeProject?.contextReferences || [];

  // ... (useEffect hooks unchanged)
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [activeSession?.messages, isLoading]);

  useEffect(() => {
      setShowAnalysis(false);
      setIsSynopsisMode(false);
      setExpandedOption(null);
      setAttachedStyleId('');
  }, [activeSessionId]);

  useEffect(() => {
    if (!activeProject) {
        setIsContextStale(false);
        return;
    }

    const projectStories = stories.filter(s => s.projectId === activeProject.id && s.category !== 'synopsis');
    
    if (!activeProject.contextSnapshot) {
        if (projectStories.length > 0 || (activeProject.worldview?.length || 0) > 20) {
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


  const sortedSessions = [...sessions].sort((a, b) => b.updatedAt - a.updatedAt);

  const handleProjectChange = (projectId: string) => {
      if (!activeSession) return;
      onUpdateSession({ ...activeSession, projectId });
  };

  const handleAnalyzeContext = async () => {
      if (!activeProject) return alert("먼저 프로젝트를 연동해주세요.");
      if (!checkApiKey()) return;
      const projectStories = stories.filter(s => s.projectId === activeProject.id && s.category !== 'synopsis');
      
      setIsAnalyzing(true);
      try {
          // Prepare Grok Options
          let grokOptions = undefined;
          const activeSettings = activeProject?.settings || projects.find(p => p.id === activeProject.id)?.settings;
          if (activeSettings?.grokApiKey) {
              grokOptions = { apiKey: activeSettings.grokApiKey };
          }

          const result = await analyzeProjectContext(
              projectStories, 
              selectedModel, 
              grokOptions,
              settings?.magnumApiKey ? { apiKey: settings.magnumApiKey } : undefined
          );
          if (result) {
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
              
              setShowAnalysis(true);
              setIsContextStale(false);
          } else {
              alert("분석 결과를 가져오지 못했습니다.");
          }
      } catch (e) {
          alert("오류가 발생했습니다.");
      } finally {
          setIsAnalyzing(false);
      }
  };

  const handleSendMessage = async () => {
    if (!input.trim() || !activeSession) return;
    if (!checkApiKey()) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      text: input,
      createdAt: Date.now()
    };

    let updatedSession = {
      ...activeSession,
      messages: [...activeSession.messages, userMsg],
      updatedAt: Date.now()
    };
    onUpdateSession(updatedSession);
    
    setInput('');
    setIsLoading(true);

    try {
      // Prepare Grok Options
      let grokOptions = undefined;
      const activeSettings = activeProject?.settings || projects.find(p => p.id === activeProject?.id)?.settings;
      const effectiveGrokKey = activeSettings?.grokApiKey || settings?.grokApiKey;
      
      if (effectiveGrokKey) {
          grokOptions = { apiKey: effectiveGrokKey };
      }

      if (isSynopsisMode) {
          const options = await generateSynopsisOptions(
              activeProject || null, 
              userMsg.text, 
              contextAnalysis || undefined, 
              selectedModel, 
              grokOptions,
              settings?.magnumApiKey ? { apiKey: settings.magnumApiKey } : undefined
          );
          const aiMsg: ChatMessage = {
              id: (Date.now() + 1).toString(),
              role: 'model',
              text: "시놉시스 초안을 생성했습니다. 마음에 드는 옵션을 선택해주세요.",
              createdAt: Date.now(),
              metadata: {
                  type: 'synopsis_options',
                  options: options
              }
          };
          updatedSession = { ...updatedSession, messages: [...updatedSession.messages, aiMsg], updatedAt: Date.now() };
          onUpdateSession(updatedSession);
      } else {
          // Normal Chat & Automatic Extraction
          const rawResponse = await chatWithIdeaPartner(
              activeProject || null, 
              updatedSession.messages, 
              contextAnalysis || undefined,
              attachedStyle?.description,
              selectedModel,
              grokOptions,
              settings?.magnumApiKey ? { apiKey: settings.magnumApiKey } : undefined
          );

          // Parse Data Blocks
          let displayText = rawResponse;
          let dataBlock = null;
          
          if (rawResponse.includes(':::DATA:::')) {
              const parts = rawResponse.split(':::DATA:::');
              displayText = parts[0].trim();
              const jsonPart = parts[1].split(':::END:::')[0];
              try {
                  dataBlock = JSON.parse(jsonPart);
              } catch (e) {
                  console.error("Failed to parse auto-extraction data", e);
              }
          }

          const aiMsg: ChatMessage = {
            id: (Date.now() + 1).toString(),
            role: 'model',
            text: displayText,
            createdAt: Date.now()
          };
          
          updatedSession = { ...updatedSession, messages: [...updatedSession.messages, aiMsg], updatedAt: Date.now() };
          onUpdateSession(updatedSession);

          // Handle Extracted Data
          if (dataBlock && activeSession.projectId) {
              const currentProject = projectsRef.current.find(p => p.id === activeSession.projectId);
              if (!currentProject) return;

              // 1. CHARACTER EXTRACTION
              if (dataBlock.type === 'character' && dataBlock.data) {
                  // Ensure defaults to prevent "empty" fields if AI misses them
                  const newChar = {
                      specs: '',
                      personality: '',
                      appearance: '',
                      backstory: '',
                      hashtags: [],
                      ...dataBlock.data
                  } as CharacterProfile;
                  
                  if (confirm(`AI가 캐릭터 '${newChar.name}' 정보를 추출했습니다. 캐릭터 연구소에 저장하시겠습니까?`)) {
                      let currentChars: CharacterProfile[] = [];
                      try { if (currentProject.characters) currentChars = JSON.parse(currentProject.characters); } catch(e) {}
                      
                      // Merge Strategy: Update if exists, Append if new
                      const existingIndex = currentChars.findIndex(c => c.name === newChar.name);
                      let updatedChars;
                      if (existingIndex >= 0) {
                          updatedChars = [...currentChars];
                          updatedChars[existingIndex] = newChar;
                          alert(`기존 캐릭터 '${newChar.name}'의 정보를 업데이트했습니다.`);
                      } else {
                          updatedChars = [...currentChars, newChar];
                          alert(`캐릭터 '${newChar.name}' 저장 완료!`);
                      }
                      
                      onUpdateProject({ ...currentProject, characters: JSON.stringify(updatedChars) });
                  }
              } 
              // 2. WORLDVIEW EXTRACTION
              else if (dataBlock.type === 'worldview' && dataBlock.data) {
                  const newSetting = {
                      id: Date.now().toString(),
                      type: 'note',
                      title: dataBlock.data.title || "새 설정",
                      content: dataBlock.data.content || "",
                      parentId: null,
                      createdAt: Date.now()
                  } as WorldItem;
                  
                  if (confirm(`AI가 세계관 설정 '${newSetting.title}'을 추출했습니다. 세계관 구축에 저장하시겠습니까?`)) {
                      let currentItems: WorldItem[] = [];
                      try { if (currentProject.worldview) currentItems = JSON.parse(currentProject.worldview); } catch (e) {}
                      
                      // Merge Strategy: Check TITLE similarity or EXACT MATCH
                      // Here we use Exact Match for simplicity, but in `handleOrganizeWorldview` we used ID preservation.
                      // For a single item, we check if title exists.
                      const existingIndex = currentItems.findIndex(i => i.title === newSetting.title && i.type === 'note');
                      let updatedItems;
                      if (existingIndex >= 0) {
                          updatedItems = [...currentItems];
                          // Preserve ID
                          updatedItems[existingIndex] = { ...newSetting, id: currentItems[existingIndex].id };
                          alert(`기존 설정 '${newSetting.title}'을 업데이트했습니다.`);
                      } else {
                          updatedItems = [...currentItems, newSetting];
                          alert(`세계관 '${newSetting.title}' 저장 완료!`);
                      }

                      onUpdateProject({ ...currentProject, worldview: JSON.stringify(updatedItems) });
                  }
              } 
              // 3. STYLE EXTRACTION
              else if (dataBlock.type === 'style' && dataBlock.data) {
                  const newStyleData = dataBlock.data;
                  if (confirm(`AI가 새로운 문체 '${newStyleData.name}'를 생성했습니다. 문체 학습소에 저장하시겠습니까?`)) {
                      if (onSaveStyle) {
                          const existingStyle = savedStylesRef.current.find(s => s.name === newStyleData.name);
                          onSaveStyle({
                              id: existingStyle ? existingStyle.id : Date.now().toString(),
                              name: newStyleData.name || "AI 생성 문체",
                              description: newStyleData.description || "",
                              type: newStyleData.type || 'general',
                              createdAt: Date.now()
                          });
                          alert(existingStyle ? `문체 '${newStyleData.name}'가 업데이트되었습니다.` : `문체 '${newStyleData.name}' 저장 완료!`);
                      } else {
                          alert("저장 오류: 저장 기능이 연결되지 않았습니다.");
                      }
                  }
              }
          }
      }

      if (activeSession.messages.length === 0) {
         const firstMsg = userMsg.text;
         const newTitle = firstMsg.length > 20 ? firstMsg.substring(0, 20) + "..." : firstMsg;
         onUpdateSession({ ...updatedSession, title: newTitle });
      }

    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegenerateSynopsis = async () => {
      if (!activeSession) return;
      if (!checkApiKey()) return;
      const lastUserMsg = [...activeSession.messages].reverse().find(m => m.role === 'user');
      const requestText = lastUserMsg ? lastUserMsg.text : "새로운 시놉시스 옵션을 제안해줘";
      setIsLoading(true);
      try {
          // Prepare Grok Options
          let grokOptions = undefined;
          const activeSettings = activeProject?.settings || projects.find(p => p.id === activeProject?.id)?.settings;
          if (activeSettings?.grokApiKey) {
              grokOptions = { apiKey: activeSettings.grokApiKey };
          }

          const options = await generateSynopsisOptions(
              activeProject || null, 
              requestText + " (이전과 다른 새로운 옵션 3가지 제안)", 
              contextAnalysis || undefined, 
              selectedModel, 
              grokOptions,
              settings?.magnumApiKey ? { apiKey: settings.magnumApiKey } : undefined
          );
          const aiMsg: ChatMessage = { id: Date.now().toString(), role: 'model', text: "새로운 시놉시스 초안을 생성했습니다.", createdAt: Date.now(), metadata: { type: 'synopsis_options', options: options } };
          onUpdateSession({ ...activeSession, messages: [...activeSession.messages, aiMsg], updatedAt: Date.now() });
      } catch(e) { alert("재생성에 실패했습니다."); } finally { setIsLoading(false); }
  };

  const handleSelectSynopsis = async (title: string, summary: string) => {
      if (!activeSession) return;
      if (!checkApiKey()) return;
      setExpandedOption(null);
      const selectionMsg: ChatMessage = { id: Date.now().toString(), role: 'user', text: `[선택함] ${title}: ${summary}`, createdAt: Date.now() };
      let updatedSession = { ...activeSession, messages: [...activeSession.messages, selectionMsg], updatedAt: Date.now() };
      onUpdateSession(updatedSession);
      setIsLoading(true);
      try {
          // Prepare Grok Options
          let grokOptions = undefined;
          const activeSettings = activeProject?.settings || projects.find(p => p.id === activeProject?.id)?.settings;
          if (activeSettings?.grokApiKey) {
              grokOptions = { apiKey: activeSettings.grokApiKey };
          }

          const detailedText = await expandDetailedSynopsis(
              summary, 
              activeProject || null, 
              selectedModel, 
              grokOptions,
              settings?.magnumApiKey ? { apiKey: settings.magnumApiKey } : undefined
          );
          const aiMsg: ChatMessage = { id: (Date.now() + 1).toString(), role: 'model', text: `**[${title}] 상세 시놉시스**\n\n${detailedText}`, createdAt: Date.now() };
          onUpdateSession({ ...updatedSession, messages: [...updatedSession.messages, aiMsg], updatedAt: Date.now() });
          setIsSynopsisMode(false);
      } catch (e) { console.error(e); } finally { setIsLoading(false); }
  };

  const handleSaveToSynopsisLibrary = (title: string, content: string) => {
      if (!activeProject) return alert("프로젝트를 선택해주세요.");
      // Use 'synopsis' category
      onSaveStory(title, content, activeProject.id, undefined, 'synopsis');
      // Alert is handled by onSaveStory logic in App.tsx or we can show one here
      alert("시놉시스 보관함에 저장되었습니다!");
  };

  const handleOrganizeWorldview = async () => {
      if (!activeSession?.projectId) return alert("프로젝트 연동이 필요합니다.");
      if (!checkApiKey()) return;
      
      const currentProject = projectsRef.current.find(p => p.id === activeSession.projectId);
      if (!currentProject) return alert("프로젝트를 찾을 수 없습니다.");

      setIsOrganizingWorld(true);
      const chatText = activeSession.messages.map(m => `${m.role}: ${m.text}`).join('\n');
      
      try {
          // Prepare Grok Options
          let grokOptions = undefined;
          const activeSettings = activeProject?.settings || projects.find(p => p.id === activeProject?.id)?.settings;
          if (activeSettings?.grokApiKey) {
              grokOptions = { apiKey: activeSettings.grokApiKey };
          }

          const newItems = await organizeWorldviewFromChat(
              chatText, 
              selectedModel, 
              grokOptions,
              settings?.magnumApiKey ? { apiKey: settings.magnumApiKey } : undefined
          );
          if (newItems.length > 0) {
              if (confirm(`${newItems.length}개의 세계관 설정 카드를 추출했습니다. 저장하시겠습니까?`)) {
                  let currentItems: WorldItem[] = [];
                  try { if (currentProject.worldview) currentItems = JSON.parse(currentProject.worldview); } catch (e) {}
                  
                  // SMART MERGE: Update if title exists (Fuzzy matching handled by ID preservation manually)
                  const updatedItems = [...currentItems];
                  let updateCount = 0;
                  let addCount = 0;

                  newItems.forEach(newItem => {
                      // Check for existing item with same Title
                      const idx = updatedItems.findIndex(existing => existing.title === newItem.title && existing.type === 'note');
                      if (idx >= 0) {
                          // Update existing item, keeping ID
                          updatedItems[idx] = { ...newItem, id: updatedItems[idx].id };
                          updateCount++;
                      } else {
                          // Append new item
                          updatedItems.push(newItem);
                          addCount++;
                      }
                  });

                  const updatedProject = { ...currentProject, worldview: JSON.stringify(updatedItems) };
                  onUpdateProject(updatedProject);
                  
                  const msgText = `✅ **세계관 설정 저장 완료**\n- 신규 추가: ${addCount}개\n- 업데이트: ${updateCount}개\n\n${newItems.map(i => `- ${i.title}`).join('\n')}`;
                  
                  const aiMsg: ChatMessage = { id: Date.now().toString(), role: 'model', text: msgText, createdAt: Date.now() };
                  onUpdateSession({ ...activeSession, messages: [...activeSession.messages, aiMsg] });
              }
          } else { alert("추출할 세계관 정보가 없습니다."); }
      } catch(e) { alert("세계관 정리에 실패했습니다."); } finally { setIsOrganizingWorld(false); }
  };

  const handleExtractCharacter = async () => {
      if (!activeSession?.projectId) return alert("프로젝트 연동이 필요합니다.");
      if (!checkApiKey()) return;
      
      const currentProject = projectsRef.current.find(p => p.id === activeSession.projectId);
      if (!currentProject) return alert("프로젝트를 찾을 수 없습니다.");

      setIsExtractingChar(true);
      // Increased context window from 10 to 50 for better inference
      const chatText = activeSession.messages.slice(-50).map(m => `${m.role}: ${m.text}`).join('\n');
      try {
          // Prepare Grok Options
          let grokOptions = undefined;
          const activeSettings = activeProject?.settings || projects.find(p => p.id === activeProject?.id)?.settings;
          if (activeSettings?.grokApiKey) {
              grokOptions = { apiKey: activeSettings.grokApiKey };
          }

          const profile = await extractCharacterFromChat(
              chatText, 
              selectedModel, 
              grokOptions,
              settings?.magnumApiKey ? { apiKey: settings.magnumApiKey } : undefined
          );
          if (profile) {
              if (confirm(`캐릭터 '${profile.name}' 프로필을 생성했습니다. 저장하시겠습니까?`)) {
                  let currentChars: CharacterProfile[] = [];
                  try { if (currentProject.characters) currentChars = JSON.parse(currentProject.characters); } catch(e) {}
                  
                  // SMART MERGE
                  const existingIndex = currentChars.findIndex(c => c.name === profile.name);
                  let updatedChars;
                  let msgPrefix = "";

                  // Ensure defaults to prevent issues in Editor
                  const safeProfile = {
                      specs: '',
                      personality: '',
                      appearance: '',
                      backstory: '',
                      hashtags: [],
                      ...profile
                  };

                  if (existingIndex >= 0) {
                      updatedChars = [...currentChars];
                      updatedChars[existingIndex] = safeProfile;
                      msgPrefix = "(기존 정보 업데이트)";
                  } else {
                      updatedChars = [...currentChars, safeProfile];
                      msgPrefix = "(신규 추가)";
                  }

                  const updatedProject = { ...currentProject, characters: JSON.stringify(updatedChars) };
                  onUpdateProject(updatedProject);
                  
                  const aiMsg: ChatMessage = { id: Date.now().toString(), role: 'model', text: `✅ **캐릭터 저장 완료 ${msgPrefix}**\n\n이름: ${profile.name}\n역할: ${profile.role}`, createdAt: Date.now() };
                  onUpdateSession({ ...activeSession, messages: [...activeSession.messages, aiMsg] });
              }
          } else { alert("캐릭터 정보를 추출하지 못했습니다."); }
      } catch(e) { alert("캐릭터 추출 실패"); } finally { setIsExtractingChar(false); }
  };

  const handleRenameSession = (id: string, newTitle: string) => {
    const session = sessions.find(s => s.id === id);
    if (session) onUpdateSession({ ...session, title: newTitle });
  };

  const handleAnalyzeStyleFromChat = async () => {
      if (!activeSession) return;
      if (!checkApiKey()) return;
      setIsSavingStyle(true);
      const chatText = activeSession.messages.map(m => m.text).join('\n');
      try {
          // Prepare Grok Options
          let grokOptions = undefined;
          const activeSettings = activeProject?.settings || projects.find(p => p.id === activeProject?.id)?.settings;
          if (activeSettings?.grokApiKey) {
              grokOptions = { apiKey: activeSettings.grokApiKey };
          }

          const result = await analyzeWritingStyle(
              chatText, 
              selectedModel, 
              grokOptions,
              settings?.magnumApiKey ? { apiKey: settings.magnumApiKey } : undefined
          );
          setStyleSaveDialog({ isOpen: true, content: result });
      } catch(e) {
          alert("스타일 분석 실패");
      } finally {
          setIsSavingStyle(false);
      }
  };

  const confirmSaveStyle = (name: string) => {
      if (onSaveStyle) {
          const existingStyle = savedStylesRef.current.find(s => s.name === name);
          onSaveStyle({
              id: existingStyle ? existingStyle.id : Date.now().toString(),
              name: name,
              description: styleSaveDialog.content,
              type: 'general',
              createdAt: Date.now()
          });
          alert(existingStyle ? "기존 문체가 업데이트되었습니다!" : "새로운 문체가 저장되었습니다!");
      }
  };

  return (
    <div className="flex h-full bg-[#121212] text-gray-100 font-sans overflow-hidden">
        {/* Left Sidebar: Sessions */}
        <div className="w-72 bg-[#1c1c1c] border-r border-gray-800 flex flex-col shrink-0">
            <div className="p-4 border-b border-gray-800 flex items-center gap-3">
                <button onClick={onBack} className="p-2 hover:bg-gray-700 rounded-full text-gray-400 hover:text-white">
                    <ArrowLeft size={20} />
                </button>
                <h2 className="font-bold text-lg text-cyan-400 flex items-center gap-2">
                    <Compass size={20} /> 아이디어 탐색
                </h2>
            </div>
            <div className="p-3">
                <button onClick={onCreateSession} className="w-full py-3 bg-cyan-900/30 hover:bg-cyan-900/50 text-cyan-400 border border-cyan-500/30 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors">
                    <Plus size={18} /> 새 아이디어 세션
                </button>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2">
                {sortedSessions.map(session => (
                    <div key={session.id} onClick={() => setActiveSessionId(session.id)} className={`group p-3 rounded-xl cursor-pointer border transition-all relative ${activeSessionId === session.id ? 'bg-cyan-900/20 border-cyan-500/50 text-white' : 'bg-[#252525] border-gray-800 text-gray-400 hover:bg-gray-800'}`}>
                        <h3 className="font-bold text-sm truncate pr-8">{session.title}</h3>
                        <p className="text-xs opacity-60 mt-1">{new Date(session.updatedAt).toLocaleDateString()}</p>
                        <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                             <button onClick={(e) => { e.stopPropagation(); setRenameDialog({isOpen: true, sessionId: session.id, title: session.title}); }} className="p-1.5 hover:bg-gray-700 rounded text-gray-300"><Edit2 size={12} /></button>
                             <button onClick={(e) => { e.stopPropagation(); setDeleteDialog({isOpen: true, message: "세션을 삭제하시겠습니까?", onConfirm: () => onDeleteSession(session.id)}); }} className="p-1.5 hover:bg-red-900/50 rounded text-gray-300 hover:text-red-400"><Trash2 size={12} /></button>
                        </div>
                    </div>
                ))}
            </div>
        </div>

        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col relative bg-[#121212]">
            {!activeSession ? (
                <div className="flex-1 flex flex-col items-center justify-center text-gray-500">
                    <Compass size={64} className="mb-6 opacity-20" />
                    <h3 className="text-xl font-bold mb-2">아이디어 탐색을 시작하세요</h3>
                    <p>새 세션을 만들거나 기존 세션을 선택하세요.</p>
                </div>
            ) : (
                <>
                    {/* PROJECT HEADER BAR */}
                    <div className="h-auto min-h-[70px] border-b border-gray-800 bg-[#1c1c1c] flex flex-col md:flex-row items-center px-6 py-3 gap-4 shrink-0 z-20 shadow-md">
                        {/* 1. Project Selector (Large) */}
                        <div className="flex-1 w-full md:w-auto">
                            <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                                <FolderPlus size={10} /> 연결된 프로젝트 (Context)
                            </div>
                            <select 
                                className="w-full bg-[#252525] border border-gray-700 rounded-lg px-3 py-2 text-white font-bold outline-none focus:border-cyan-500 transition-colors hover:bg-gray-800"
                                value={activeSession.projectId || ""}
                                onChange={(e) => handleProjectChange(e.target.value)}
                            >
                                <option value="">(프로젝트 연결 안 함 - 자유 대화)</option>
                                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                        </div>

                        {/* 2. Context Analysis Button */}
                        <div className="flex-shrink-0 flex items-end gap-2">
                             {/* Model Selection */}
                             <div className="flex flex-col items-end mr-2">
                                 <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Model</div>
                                 <div className="flex bg-[#252525] border border-gray-700 rounded-lg p-1">
                                     <button 
                                         onClick={() => setSelectedModel('gemini-3-flash-preview')}
                                         className={`px-2 py-1 text-[10px] font-bold rounded ${selectedModel === 'gemini-3-flash-preview' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-gray-300'}`}
                                     >
                                         Flash
                                     </button>
                                     <button 
                                         onClick={() => setSelectedModel('gemini-3.1-pro-preview')}
                                         className={`px-2 py-1 text-[10px] font-bold rounded ${selectedModel === 'gemini-3.1-pro-preview' ? 'bg-purple-600 text-white' : 'text-gray-500 hover:text-gray-300'}`}
                                     >
                                         Pro
                                     </button>
                                     <button 
                                         onClick={() => setSelectedModel('grok-3')}
                                         className={`px-2 py-1 text-[10px] font-bold rounded ${selectedModel === 'grok-3' ? 'bg-red-600 text-white' : 'text-gray-500 hover:text-gray-300'}`}
                                     >
                                         Grok 3
                                     </button>
                                     <button 
                                         onClick={() => setSelectedModel('anthracite-org/magnum-v4-72b')}
                                         className={`px-2 py-1 text-[10px] font-bold rounded ${selectedModel === 'anthracite-org/magnum-v4-72b' ? 'bg-orange-600 text-white' : 'text-gray-500 hover:text-gray-300'}`}
                                     >
                                         Magnum
                                     </button>
                                 </div>
                             </div>

                             {/* Stale Warning Badge */}
                             {isContextStale && (
                                <div className="text-[10px] bg-yellow-900/30 text-yellow-400 px-2 py-1 rounded border border-yellow-500/30 flex items-center gap-1 animate-pulse">
                                    <AlertTriangle size={10} />
                                    <span>변경 감지됨: 재분석 권장</span>
                                </div>
                             )}

                            <div className="flex flex-col items-end">
                                <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1 opacity-0">Status</div>
                                {contextAnalysis && !isContextStale ? (
                                    // Completed & Up-to-date State
                                    <button 
                                        onClick={() => setShowAnalysis(!showAnalysis)}
                                        className="h-[42px] px-4 rounded-lg font-bold text-sm flex items-center gap-2 transition-all shadow-sm bg-indigo-900/20 border border-indigo-500/50 text-indigo-300 hover:bg-indigo-900/50"
                                    >
                                        <CheckCircle2 size={16} /> 분석 완료
                                        {showAnalysis ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
                                    </button>
                                ) : (
                                    // Analysis Needed State
                                    <button 
                                        onClick={handleAnalyzeContext}
                                        disabled={isAnalyzing || !activeProject}
                                        className={`h-[42px] px-4 rounded-lg font-bold text-sm flex items-center gap-2 transition-all shadow-sm ${
                                            isContextStale 
                                                ? 'bg-yellow-900/20 border border-yellow-500/50 text-yellow-300 hover:bg-yellow-900/40'
                                                : 'bg-gray-800 border border-gray-700 text-gray-400 hover:text-white hover:bg-gray-700'
                                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                                    >
                                        {isAnalyzing ? <RefreshCcw className="animate-spin" size={16} /> : <BookOpenCheck size={16} />}
                                        {isContextStale ? "문맥 다시 분석하기" : "문맥 분석 실행"}
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Quick Tools Bar */}
                    <div className="h-12 border-b border-gray-800 bg-[#151515] flex items-center px-4 gap-2 overflow-x-auto no-scrollbar shrink-0">
                        <button onClick={() => setIsSynopsisMode(!isSynopsisMode)} className={`px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-1.5 transition-colors whitespace-nowrap ${isSynopsisMode ? 'bg-cyan-600 text-white' : 'text-gray-400 hover:bg-gray-800'}`}>
                            <LayoutList size={14} /> 시놉시스 모드 {isSynopsisMode ? 'ON' : 'OFF'}
                        </button>
                        <div className="w-px h-4 bg-gray-700 mx-2"></div>
                        <button onClick={handleOrganizeWorldview} disabled={isOrganizingWorld} className="px-3 py-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-md text-xs font-medium flex items-center gap-1.5 whitespace-nowrap">
                            {isOrganizingWorld ? <RefreshCcw className="animate-spin" size={14}/> : <Globe size={14}/>} 세계관 정리
                        </button>
                        <button onClick={handleExtractCharacter} disabled={isExtractingChar} className="px-3 py-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-md text-xs font-medium flex items-center gap-1.5 whitespace-nowrap">
                            {isExtractingChar ? <RefreshCcw className="animate-spin" size={14}/> : <UserPlus size={14}/>} 캐릭터 추출
                        </button>
                        <button onClick={handleAnalyzeStyleFromChat} disabled={isSavingStyle} className="px-3 py-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-md text-xs font-medium flex items-center gap-1.5 whitespace-nowrap">
                            {isSavingStyle ? <RefreshCcw className="animate-spin" size={14}/> : <Wand2 size={14}/>} 대화에서 문체 저장
                        </button>
                    </div>
                    
                    {/* Context Analysis Panel (Collapsible) */}
                    {showAnalysis && contextAnalysis && (
                        <div className="bg-indigo-900/10 border-b border-indigo-500/20 p-4 max-h-56 overflow-y-auto custom-scrollbar relative shrink-0 animate-in slide-in-from-top-2">
                             <div className="flex justify-between items-start mb-2">
                                <h4 className="text-xs font-bold text-indigo-400 flex items-center gap-1"><BrainCircuit size={14}/> 현재 프로젝트 문맥 분석 결과 (캐시됨)</h4>
                                <button onClick={() => setShowAnalysis(false)} className="text-indigo-300 hover:text-white bg-indigo-900/50 p-1 rounded"><X size={14}/></button>
                             </div>
                             
                             {/* Analyzed Episodes List */}
                             {contextReferences.length > 0 && (
                                 <div className="flex flex-wrap gap-1 mb-3">
                                     {contextReferences.map((ref, idx) => (
                                         <span key={idx} className="text-[10px] px-2 py-0.5 bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 rounded-full">
                                             {ref}
                                         </span>
                                     ))}
                                 </div>
                             )}

                             <p className="text-xs text-gray-300 whitespace-pre-wrap leading-relaxed">{contextAnalysis}</p>

                             {/* Re-analyze Button */}
                             <div className="mt-3 pt-3 border-t border-indigo-500/20 flex justify-end">
                                <button
                                    onClick={handleAnalyzeContext}
                                    disabled={isAnalyzing}
                                    className="text-xs flex items-center gap-1.5 text-indigo-400 hover:text-indigo-200 transition-colors"
                                >
                                    <RefreshCcw size={12} className={isAnalyzing ? "animate-spin" : ""} />
                                    {isAnalyzing ? "분석 중..." : "결과 재분석"}
                                </button>
                             </div>
                        </div>
                    )}

                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
                        {activeSession.messages.map((msg) => (
                            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[85%] md:max-w-[70%] rounded-2xl p-4 text-sm leading-relaxed shadow-md ${msg.role === 'user' ? 'bg-cyan-700 text-white rounded-tr-none' : 'bg-[#252525] text-gray-200 border border-gray-700 rounded-tl-none'}`}>
                                    {msg.role === 'model' ? <div className="prose prose-invert prose-sm max-w-none whitespace-pre-wrap"><ReactMarkdown>{msg.text}</ReactMarkdown></div> : <div className="whitespace-pre-wrap">{msg.text}</div>}
                                    {msg.metadata?.type === 'synopsis_options' && msg.metadata.options && (
                                        <div className="mt-4 space-y-3">
                                            {(msg.metadata.options as any[]).map((option: any, optIdx: number) => (
                                                <div key={optIdx} className="bg-black/20 border border-white/10 rounded-xl p-3 hover:bg-black/30 transition-colors">
                                                    <h4 className="font-bold text-cyan-300 mb-1">{option.title}</h4>
                                                    <p className="text-xs text-gray-300 mb-2 line-clamp-3">{option.summary}</p>
                                                    <div className="flex justify-between items-center mt-2">
                                                        <span className="text-[10px] text-gray-400 bg-black/20 px-2 py-0.5 rounded">{option.appeal}</span>
                                                        <div className="flex gap-2">
                                                            <button onClick={() => setExpandedOption(option)} className="text-xs bg-gray-700 hover:bg-gray-600 px-3 py-1.5 rounded text-white transition-colors">자세히</button>
                                                            <button onClick={() => handleSelectSynopsis(option.title, option.summary)} className="text-xs bg-cyan-600 hover:bg-cyan-500 px-3 py-1.5 rounded text-white font-bold shadow-lg transition-colors">선택</button>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                            <button onClick={handleRegenerateSynopsis} className="w-full py-2 text-xs text-gray-400 hover:text-white border border-dashed border-gray-600 rounded-lg hover:border-gray-500 transition-colors flex items-center justify-center gap-2"><RefreshCcw size={12} /> 다른 옵션 보기</button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                        {isLoading && <div className="flex justify-start"><div className="bg-[#252525] border border-gray-700 rounded-2xl rounded-tl-none p-4 text-cyan-400 flex items-center gap-2"><Bot className="animate-bounce" size={16} /> 생각 중...</div></div>}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input Area */}
                    <div className="p-4 bg-[#1c1c1c] border-t border-gray-800 relative">
                        {attachedStyle && (
                            <div className="absolute -top-10 left-4 bg-indigo-900/90 text-indigo-200 px-3 py-1.5 rounded-t-lg text-xs font-bold flex items-center gap-2 shadow-lg border-t border-x border-indigo-500/30">
                                <Link size={12} /> 
                                {attachedStyle.name} 문체 적용됨
                                <button onClick={() => setAttachedStyleId('')} className="hover:text-white ml-1"><X size={12}/></button>
                            </div>
                        )}

                        {isSynopsisMode && (
                            <div className="mb-2 text-xs text-cyan-400 flex items-center gap-2 bg-cyan-900/20 p-2 rounded border border-cyan-500/30">
                                <LayoutList size={14} /> 
                                <span>시놉시스 생성 모드 ON: 장르/소재를 입력하면 3가지 옵션을 제안합니다.</span>
                            </div>
                        )}
                        
                        <div className="relative flex items-center gap-2">
                            <div className="relative">
                                <button 
                                    onClick={() => setIsStyleSelectorOpen(!isStyleSelectorOpen)}
                                    className={`p-3 rounded-full transition-colors ${attachedStyleId ? 'bg-indigo-600 text-white' : 'bg-[#252525] text-gray-400 hover:text-white border border-gray-700'}`}
                                    title="문체 첨부"
                                >
                                    <Paperclip size={18} />
                                </button>
                                {isStyleSelectorOpen && (
                                    <div className="absolute bottom-full left-0 mb-2 w-48 bg-[#252525] border border-gray-700 rounded-xl shadow-xl overflow-hidden z-50 max-h-60 overflow-y-auto custom-scrollbar">
                                        <div className="p-2 text-xs font-bold text-gray-500 bg-black/20 border-b border-gray-700">문체 선택</div>
                                        {savedStyles.map(s => (
                                            <button 
                                                key={s.id}
                                                onClick={() => { setAttachedStyleId(s.id); setIsStyleSelectorOpen(false); }}
                                                className="w-full text-left px-3 py-2 text-xs text-gray-300 hover:bg-indigo-600 hover:text-white truncate block"
                                            >
                                                {s.name}
                                            </button>
                                        ))}
                                        {savedStyles.length === 0 && <div className="p-3 text-xs text-gray-500 text-center">저장된 문체가 없습니다.</div>}
                                    </div>
                                )}
                            </div>

                            <input
                                className={`flex-1 bg-[#252525] border border-gray-700 rounded-full pl-5 pr-12 py-3 text-white outline-none focus:border-cyan-500 transition-colors ${isLoading ? 'opacity-50' : ''}`}
                                placeholder={isSynopsisMode ? "예: 조선시대 배경의 좀비 아포칼립스물 시놉시스 써줘" : "아이디어를 입력하세요..."}
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
                                disabled={isLoading}
                            />
                            <button 
                                onClick={handleSendMessage}
                                disabled={!input.trim() || isLoading}
                                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-cyan-600 hover:bg-cyan-500 disabled:bg-gray-700 text-white rounded-full transition-colors shadow-lg"
                            >
                                <Send size={16} />
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>

        {/* Expanded Option Modal */}
        {expandedOption && (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
                <div className="bg-[#1e1e1e] border border-gray-700 rounded-xl w-full max-w-lg shadow-2xl p-6">
                    <h3 className="text-xl font-bold text-cyan-400 mb-2">{expandedOption.title}</h3>
                    <p className="text-gray-300 text-sm leading-relaxed mb-4 whitespace-pre-wrap max-h-[60vh] overflow-y-auto custom-scrollbar">
                        {expandedOption.summary}
                    </p>
                    <div className="bg-gray-800 p-3 rounded-lg text-xs text-gray-400 mb-6">
                        <strong className="text-gray-300">매력 포인트:</strong> {expandedOption.appeal}
                    </div>
                    <div className="flex justify-end gap-3">
                        <button onClick={() => setExpandedOption(null)} className="px-4 py-2 text-gray-400 hover:text-white">닫기</button>
                        <button onClick={() => handleSaveToSynopsisLibrary(expandedOption.title, expandedOption.summary)} className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white font-bold rounded-lg flex items-center gap-2"><Book size={14}/> 보관함에 저장</button>
                        <button onClick={() => handleSelectSynopsis(expandedOption.title, expandedOption.summary)} className="px-6 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-lg shadow-lg">이걸로 선택 (상세화)</button>
                    </div>
                </div>
            </div>
        )}

        <DeleteConfirmDialog isOpen={deleteDialog.isOpen} onClose={() => setDeleteDialog(prev => ({...prev, isOpen: false}))} onConfirm={deleteDialog.onConfirm} message={deleteDialog.message} />
        <InputDialog isOpen={renameDialog.isOpen} title="세션 이름 변경" onConfirm={(val) => { handleRenameSession(renameDialog.sessionId, val); setRenameDialog(prev => ({...prev, isOpen: false})); }} onClose={() => setRenameDialog(prev => ({...prev, isOpen: false}))} placeholder={renameDialog.title} />
        <InputDialog isOpen={styleSaveDialog.isOpen} title="새 문체 이름 저장" onConfirm={confirmSaveStyle} onClose={() => setStyleSaveDialog(prev => ({...prev, isOpen: false}))} placeholder="예: 아이디어 회의에서 추출한 문체" confirmText="저장" />
    </div>
  );
};

export default IdeaExplorer;
