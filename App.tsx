


import React, { useState, useCallback, useEffect, useRef } from 'react';
import Controls from './components/Controls.tsx';
import Library from './components/Library.tsx';
import NovelViewer from './components/NovelViewer.tsx';
import SaveDialog from './components/SaveDialog.tsx';
import ProjectSettingsDialog from './components/ProjectSettingsDialog.tsx';
import DeleteConfirmDialog from './components/DeleteConfirmDialog.tsx';
import HomeScreen from './components/HomeScreen.tsx';
import WorldBuilder from './components/WorldBuilder.tsx';
import CharacterCreator from './components/CharacterCreator.tsx';
import IdeaExplorer from './components/IdeaExplorer.tsx';
import UserMenu from './components/UserMenu.tsx';
import TrashBin from './components/TrashBin.tsx';
import { generateNovelStep, analyzeManuscript, continueStoryStream, refineText, setGlobalModel } from './services/geminiService.ts';
import { DEFAULT_AI_PRESETS } from './services/prompts.ts';
import { 
  subscribeToAuthChanges, 
  signInWithGoogle, 
  signOut, 
  User,
  saveProjectToFirestore, 
  deleteProjectFromFirestore,
  restoreProjectToFirestore,
  permanentDeleteProjectFromFirestore, 
  saveStoryToFirestore, 
  deleteStoryFromFirestore,
  restoreStoryToFirestore,
  permanentDeleteStoryFromFirestore,
  subscribeToUserData,
  saveUserGlobalSettings,
  subscribeToGlobalSettings,
  subscribeToStyles,
  saveStyleToFirestore,
  deleteStyleFromFirestore,
  saveIdeaSessionToFirestore,
  deleteIdeaSessionFromFirestore,
  subscribeToIdeaSessions,
  setQuotaExceededCallback
} from './services/firebase.ts';
import { NovelSettings, DEFAULT_SETTINGS, Project, SavedStory, ViewMode, WorldItem, IdeaSession, EditorPreferences, DEFAULT_EDITOR_PREFS, SavedStyle, POV } from './types.ts';
import { BookOpen, Archive, Edit3, Home, Menu, X, ChevronRight, FileText, ArrowLeft, LogOut, FolderOpen, Loader2, Book, PenTool, ArrowUpDown, AlertTriangle, Save, Cpu } from 'lucide-react';

function App() {
  // --- Mobile Detection ---
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // --- AI Model Notification State ---
  const [aiNotification, setAiNotification] = useState<{provider: string, model: string, visible: boolean}>({
      provider: '', model: '', visible: false
  });

  useEffect(() => {
      const handleAiEvent = (e: any) => {
          const { provider, model } = e.detail;
          setAiNotification({ provider, model, visible: true });
          
          // Auto hide after 3 seconds
          setTimeout(() => {
              setAiNotification(prev => ({...prev, visible: false}));
          }, 3000);
      };

      window.addEventListener('ai-model-used', handleAiEvent);
      return () => window.removeEventListener('ai-model-used', handleAiEvent);
  }, []);

  // --- Mobile Navigation State ---
  const [mobilePath, setMobilePath] = useState<'projects' | 'stories' | 'reader'>('projects');
  const [mobileSelectedProject, setMobileSelectedProject] = useState<string | null>(null);
  const [mobileSortOrder, setMobileSortOrder] = useState<'name' | 'date'>('name');

  // --- View State (Desktop) ---
  const [currentView, setCurrentView] = useState<ViewMode>('HOME');

  // --- Auth State ---
  const [user, setUser] = useState<User | null>(null);
  const [isAuthChecking, setIsAuthChecking] = useState(true);

  // --- Data State ---
  const [projects, setProjects] = useState<Project[]>([]);
  const [savedStories, setSavedStories] = useState<SavedStory[]>([]);
  const [savedStyles, setSavedStyles] = useState<SavedStyle[]>([]);
  
  // Computed Lists (Active vs Deleted)
  const activeProjects = (Array.isArray(projects) ? projects : []).filter(p => !p.deletedAt);
  const deletedProjects = (Array.isArray(projects) ? projects : []).filter(p => !!p.deletedAt);
  
  const activeStories = (Array.isArray(savedStories) ? savedStories : []).filter(s => !s.deletedAt);
  const deletedStories = (Array.isArray(savedStories) ? savedStories : []).filter(s => !!s.deletedAt);

  // Idea Explorer
  const [ideaSessions, setIdeaSessions] = useState<IdeaSession[]>(() => {
      const saved = localStorage.getItem('nc_idea_sessions');
      return saved ? JSON.parse(saved) : [];
  });
  
  // Novel State
  // Initialize Global Settings from LocalStorage if available (Persist for Guest / Quick Load)
  const [globalSettings, setGlobalSettings] = useState<NovelSettings>(() => {
      const saved = localStorage.getItem('nc_global_settings');
      return saved ? JSON.parse(saved) : DEFAULT_SETTINGS;
  });

  // Settings for current context (initialized with global defaults)
  const [settings, setSettings] = useState<NovelSettings>(() => {
      const saved = localStorage.getItem('nc_global_settings');
      return saved ? JSON.parse(saved) : DEFAULT_SETTINGS;
  });

  const [generatedContent, setGeneratedContent] = useState<string>("");
  const [editingTitle, setEditingTitle] = useState<string>(""); 
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Editor Preferences
  const [editorPrefs, setEditorPrefs] = useState<EditorPreferences>(() => {
      const saved = localStorage.getItem('nc_editor_prefs');
      return saved ? JSON.parse(saved) : DEFAULT_EDITOR_PREFS;
  });

  // Edit Tracking
  const [editingStoryId, setEditingStoryId] = useState<string | null>(null);

  // Save State
  const [lastSavedTime, setLastSavedTime] = useState<number | null>(null);
  
  // Quota Error State
  const [isQuotaExceeded, setIsQuotaExceeded] = useState(false);

  // Dirty Check Ref
  const lastSavedSnapshot = useRef<{title: string, content: string}>({ title: '', content: '' });

  // Unsaved Changes Dialog State
  const [unsavedDialog, setUnsavedDialog] = useState<{
    isOpen: boolean;
    onConfirm: () => void;
    onDiscard: () => void;
  }>({ isOpen: false, onConfirm: () => {}, onDiscard: () => {} });

  // Trash Bin Dialog State
  const [isTrashOpen, setIsTrashOpen] = useState(false);

  // Fix: Create a ref for savedStories to break the dependency cycle
  const savedStoriesRef = useRef(savedStories);
  useEffect(() => {
    savedStoriesRef.current = savedStories;
  }, [savedStories]);
  
  // --- Quota Monitor ---
  useEffect(() => {
    setQuotaExceededCallback(() => {
        setIsQuotaExceeded(true);
    });
  }, []);

  // --- Dirty Check Logic ---
  const checkUnsavedChanges = (nextAction: () => void) => {
    // Only check if we are in editing mode and have an active story
    if (!editingStoryId) {
        nextAction();
        return;
    }

    const isDirty = 
      generatedContent !== lastSavedSnapshot.current.content || 
      editingTitle !== lastSavedSnapshot.current.title;

    if (isDirty) {
      setUnsavedDialog({
        isOpen: true,
        onConfirm: async () => {
             try {
                 // Save Logic
                 const story = savedStoriesRef.current.find(s => s.id === editingStoryId);
                 if (story) {
                    const updated: SavedStory = { 
                        ...story, 
                        title: editingTitle, 
                        content: generatedContent,
                        settings: { ...settings }, // Sync current settings
                        updatedAt: Date.now() 
                    };
                    
                    // Update Firestore/Local
                    if (user) {
                        await saveStoryToFirestore(user.uid, updated);
                    } else {
                        setSavedStories(prev => prev.map(s => s.id === updated.id ? updated : s));
                    }
                    
                    // Update Snapshot
                    lastSavedSnapshot.current = { title: editingTitle, content: generatedContent };
                    setLastSavedTime(Date.now());
                 } else {
                    console.warn("Could not find story to save, proceeding anyway.");
                 }
                 
                 setUnsavedDialog(prev => ({ ...prev, isOpen: false }));
                 nextAction();
             } catch (e: any) {
                 console.error("Save failed during navigation", e);
                 
                 if (e.code === 'resource-exhausted' || e.message?.includes('Quota')) {
                     alert("⚠️ 일일 저장 용량을 초과했습니다.\n\n클라우드에 저장할 수 없습니다. 내용을 복사하여 백업한 후 '저장 안 함'을 선택하거나 잠시 후 다시 시도해주세요.");
                 } else {
                     alert("저장에 실패했습니다. 내용을 확인해주세요.");
                 }
                 // Do not call nextAction() to prevent data loss
             }
        },
        onDiscard: () => {
            // Just proceed without saving
            setUnsavedDialog(prev => ({ ...prev, isOpen: false }));
            nextAction();
        }
      });
    } else {
      nextAction();
    }
  };

  // Retries
  // const [lastStructuralGuide, setLastStructuralGuide] = useState<string | undefined>(undefined); // REMOVED
  const [lastContextAnalysis, setLastContextAnalysis] = useState<string | undefined>(undefined);

  // Desktop UI State
  const [activeTab, setActiveTab] = useState<'write' | 'library'>('library');
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [isProjectSettingsOpen, setIsProjectSettingsOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [libraryViewMode, setLibraryViewMode] = useState<'selection' | 'manuscript' | 'synopsis'>('selection');

  // Dialogs
  const [deleteDialog, setDeleteDialog] = useState<{
    isOpen: boolean;
    message: string;
    onConfirm: () => void;
  }>({ isOpen: false, message: '', onConfirm: () => {} });

  // Active Project Context
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);

  // Ref to track which project's settings we last loaded to avoid overwriting user edits with background syncs
  const lastLoadedProjectId = useRef<string | null>(null);

  // --- Reset Logic (Context Switching & Settings Sync) ---
  useEffect(() => {
      // 1. Home Mode (No Active Project)
      if (!activeProjectId) {
          if (lastLoadedProjectId.current !== null) {
              // Only load global settings if we just switched FROM a project
              setSettings({ ...DEFAULT_SETTINGS, ...globalSettings });
              lastLoadedProjectId.current = null;
          }
          // If we are already in Home mode, don't overwrite local settings with global updates constantly
          return;
      }

      // 2. Project Mode
      // Only load settings if we are switching to a NEW project (or first load of that project)
      // This prevents background updates (from auto-save) from clobbering local state while typing.
      if (activeProjectId !== lastLoadedProjectId.current) {
          const project = activeProjects.find(p => p.id === activeProjectId);
          if (project) {
              // Merge with defaults to ensure safety
              const merged = { ...DEFAULT_SETTINGS, ...project.settings };
              
              // CRITICAL: Ensure no fields are undefined to prevent "uncontrolled input" errors
              const safeSettings: NovelSettings = {
                  ...merged,
                  synopsis: merged.synopsis || "",
                  previousStoryContent: merged.previousStoryContent || "",
                  referenceText: merged.referenceText || "",
                  styleDescription: merged.styleDescription || "",
                  guidelines: merged.guidelines || "",
                  activeStyleId: merged.activeStyleId || undefined
              };
              
              setSettings(safeSettings);
              if (safeSettings.model) setGlobalModel(safeSettings.model);
              lastLoadedProjectId.current = activeProjectId;
          }
      }
  }, [activeProjectId, projects, globalSettings]); 

  // --- Persistence for Settings (Debounced) ---
  useEffect(() => {
    const saveData = async () => {
      // Logic for saving settings
      if (activeProjectId) {
          // Case 1: Active Project -> Save to Project Document
          if (user) {
              const projectIndex = activeProjects.findIndex(p => p.id === activeProjectId);
              if (projectIndex !== -1 && JSON.stringify(activeProjects[projectIndex].settings) !== JSON.stringify(settings)) {
                  const updatedProject = { ...activeProjects[projectIndex], settings: settings };
                  saveProjectToFirestore(user.uid, updatedProject);
                  if (settings.model) setGlobalModel(settings.model);
              }
          }
      } else {
          // Case 2: No Active Project (Home Screen) -> Save to Global Settings
          // Check if changed
          if (JSON.stringify(globalSettings) !== JSON.stringify(settings)) {
              // 1. Save to LocalStorage (Always, for Guest/Offline/Faster Load)
              localStorage.setItem('nc_global_settings', JSON.stringify(settings));
              
              // 2. Save to Firestore (If logged in)
              if (user) {
                  saveUserGlobalSettings(user.uid, settings);
              }
              if (settings.model) setGlobalModel(settings.model);
              
              // 3. Update local globalSettings ref to prevent loop
              setGlobalSettings(settings);
          }
      }
    };

    // Debounce the save operation (1000ms)
    const timeoutId = setTimeout(saveData, 1000);

    return () => clearTimeout(timeoutId);
  }, [settings, activeProjectId, user, projects, globalSettings]);

  useEffect(() => {
      localStorage.setItem('nc_editor_prefs', JSON.stringify(editorPrefs));
  }, [editorPrefs]);

  // --- AUTH & DATA SYNC OPTIMIZATION ---
  const handleSignIn = async () => {
    try {
      setIsAuthChecking(true); 
      await signInWithGoogle();
      // NOTE: Data loading is handled by the Auth Subscription below.
    } catch (e) {
      console.error("Login failed", e);
      alert("로그인에 실패했습니다.");
      setIsAuthChecking(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      setProjects([]);
      setSavedStories([]);
      setSavedStyles([]);
      setIdeaSessions([]);
      setUser(null);
      setMobilePath('projects');
      setMobileSelectedProject(null);
      // Revert to LocalStorage Global Settings or Default
      const localGlobal = localStorage.getItem('nc_global_settings');
      setGlobalSettings(localGlobal ? JSON.parse(localGlobal) : DEFAULT_SETTINGS);
      setSettings(localGlobal ? JSON.parse(localGlobal) : DEFAULT_SETTINGS);
    } catch (e) {
      console.error("Logout failed", e);
    }
  };

  // --- DATA LOADING STRATEGY (Waterfall Fix) ---
  useEffect(() => {
    let unsubscribeFirestore: (() => void) | undefined;
    let unsubscribeGlobalSettings: (() => void) | undefined;
    let unsubscribeStyles: (() => void) | undefined;
    let unsubscribeIdeaSessions: (() => void) | undefined;

    const unsubscribeAuth = subscribeToAuthChanges((currentUser) => {
      setUser(currentUser);

      if (currentUser) {
        // 1. Stop the global loading spinner immediately.
        setIsAuthChecking(false);

        // 2. Start the Firestore listener for User Data (Projects/Stories)
        unsubscribeFirestore = subscribeToUserData(
          currentUser.uid,
          (cloudProjects) => {
             setProjects(cloudProjects);
          },
          (cloudStories) => {
             setSavedStories(cloudStories);
          }
        );
        
        // 3. Start listener for Global Settings
        unsubscribeGlobalSettings = subscribeToGlobalSettings(currentUser.uid, (gSettings) => {
            setGlobalSettings(gSettings);
            if (gSettings?.model) setGlobalModel(gSettings.model);
            // If on Home, sync settings with cloud (initial sync)
            if (!activeProjectId) {
                // To avoid overwriting user edits in progress, maybe only do this on initial load?
                // For now, trusting the cloud as source of truth for global settings on login
                setSettings(gSettings);
                // Also update local cache
                localStorage.setItem('nc_global_settings', JSON.stringify(gSettings));
            }
        });

        // 4. Start listener for Saved Styles
        unsubscribeStyles = subscribeToStyles(currentUser.uid, (styles) => {
           setSavedStyles(styles);
        });

        // 5. Start listener for Idea Sessions (NEW)
        unsubscribeIdeaSessions = subscribeToIdeaSessions(currentUser.uid, (sessions) => {
            setIdeaSessions(sessions);
        });

      } else {
        // Guest Mode fallback
        const savedProjects = localStorage.getItem('nc_projects');
        const parsedProjects = savedProjects ? JSON.parse(savedProjects) : [];
        setProjects(Array.isArray(parsedProjects) ? parsedProjects : []);
        
        const savedStories = localStorage.getItem('nc_stories');
        const parsedStories = savedStories ? JSON.parse(savedStories) : [];
        setSavedStories(Array.isArray(parsedStories) ? parsedStories : []);

        const savedStylesLocal = localStorage.getItem('nc_styles');
        const parsedStyles = savedStylesLocal ? JSON.parse(savedStylesLocal) : [];
        setSavedStyles(Array.isArray(parsedStyles) ? parsedStyles : []);
        
        const savedSessions = localStorage.getItem('nc_idea_sessions');
        const parsedSessions = savedSessions ? JSON.parse(savedSessions) : [];
        setIdeaSessions(Array.isArray(parsedSessions) ? parsedSessions : []);
        
        // Ensure Global Settings are loaded for guest
        const savedGlobal = localStorage.getItem('nc_global_settings');
        if (savedGlobal) {
            const parsed = JSON.parse(savedGlobal);
            setGlobalSettings(parsed);
            if (!activeProjectId) setSettings(parsed);
        }

        setIsAuthChecking(false); 
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeFirestore) unsubscribeFirestore();
      if (unsubscribeGlobalSettings) unsubscribeGlobalSettings();
      if (unsubscribeStyles) unsubscribeStyles();
      if (unsubscribeIdeaSessions) unsubscribeIdeaSessions();
    };
  }, [activeProjectId]); 

  // --- Local Storage Sync (Guest Mode Only) ---
  useEffect(() => {
    if (!user) {
      localStorage.setItem('nc_projects', JSON.stringify(projects));
    }
  }, [projects, user]);

  useEffect(() => {
    if (!user) {
      localStorage.setItem('nc_stories', JSON.stringify(savedStories));
    }
  }, [savedStories, user]);

  useEffect(() => {
    if (!user) {
      localStorage.setItem('nc_styles', JSON.stringify(savedStyles));
    }
  }, [savedStyles, user]);

  useEffect(() => {
    if (!user) {
      localStorage.setItem('nc_idea_sessions', JSON.stringify(ideaSessions));
    }
  }, [ideaSessions, user]);

  // --- Style Management ---
  const handleSaveStyle = (style: SavedStyle) => {
      if (user) {
          saveStyleToFirestore(user.uid, style);
      } else {
          setSavedStyles(prev => [...prev, style]);
      }
  };

  const handleDeleteStyle = (styleId: string) => {
      if (user) {
          deleteStyleFromFirestore(user.uid, styleId);
      } else {
          setSavedStyles(prev => prev.filter(s => s.id !== styleId));
      }
  };

  // --- Idea Session Management ---
  const handleUpdateSession = (session: IdeaSession) => {
      if (user) {
          saveIdeaSessionToFirestore(user.uid, session);
      } else {
          setIdeaSessions(prev => prev.map(x => x.id === session.id ? session : x));
      }
  };

  const handleDeleteSession = (sessionId: string) => {
      if (user) {
          deleteIdeaSessionFromFirestore(user.uid, sessionId);
      } else {
          setIdeaSessions(prev => prev.filter(x => x.id !== sessionId));
      }
  };

  const handleCreateSession = () => {
      const newSession: IdeaSession = {
          id: Date.now().toString(), 
          title: "새 아이디어", 
          createdAt: Date.now(), 
          updatedAt: Date.now(), 
          messages: [], 
          projectId: activeProjectId 
      };
      if (user) {
          saveIdeaSessionToFirestore(user.uid, newSession);
      } else {
          setIdeaSessions(prev => [newSession, ...prev]);
      }
  };


  // --- Sorting Helper ---
  const sortStories = (stories: SavedStory[], order: 'name' | 'date') => {
      return [...stories].sort((a, b) => {
          if (order === 'date') {
              const timeA = a.updatedAt || a.createdAt;
              const timeB = b.updatedAt || b.createdAt;
              return timeB - timeA; // Newest first
          } else {
              return a.title.localeCompare(b.title, undefined, { numeric: true, sensitivity: 'base' });
          }
      });
  };

  // --- Handlers ---

  const handleGenerate = useCallback(async (structuralGuide?: string, contextAnalysis?: string) => {
    if (!settings.synopsis) return;
    setIsLoading(true);
    setError(null);
    setGeneratedContent(""); 
    setEditingStoryId(null); 
    setEditingTitle("새 원고 (작성 중)"); 
    lastSavedSnapshot.current = { title: "새 원고 (작성 중)", content: "" };
    // setLastStructuralGuide(structuralGuide); // REMOVED
    setLastContextAnalysis(contextAnalysis);
    setIsMobileMenuOpen(false);
    const projectContext = activeProjectId ? projects.find(p => p.id === activeProjectId) || null : null;
    try {
      const model = settings.selectedModel || settings.geminiModel || 'gemini-3-flash-preview';
      
      // FIX: Use generateNovelStep with correct arguments (single shot generation: 1/1)
      await generateNovelStep(
          1, 1, settings, projectContext, "", 
          undefined, // structuralGuide removed
          contextAnalysis, 
          (chunk) => {
            setGeneratedContent((prev) => prev + chunk);
          },
          undefined, // storyAnalysis
          model
      );
    } catch (err) {
      setError("오류 발생");
    } finally {
      setIsLoading(false);
    }
  }, [settings, activeProjectId, projects]);

  const handleFinishGeneration = (content?: string) => {
      if (content) setGeneratedContent(content);
      setCurrentView('WRITER');
  };

  // New handler for saving directly from AI Writer without closing it
  const handleAiWriterSave = (content: string) => {
      setGeneratedContent(content);
      setIsSaveModalOpen(true);
      // We don't change view here, so the user stays in AI_WRITER
  };

  const handleRetry = useCallback(async () => {
      if (confirm("다시 작성하시겠습니까?")) handleGenerate(undefined, lastContextAnalysis);
  }, [handleGenerate, lastContextAnalysis]);

  const handleContinueGenerate = useCallback(async () => {
    if (!generatedContent) return;
    setIsLoading(true);
    try {
      const level = settings.creativityLevel || 7;
      const temp = level / 10;
      const model = settings.selectedModel || settings.geminiModel || 'gemini-3-flash-preview';
      
      await continueStoryStream(generatedContent, (chunk) => setGeneratedContent((prev) => prev + chunk), temp, model);
    } catch (err) { setError("오류 발생"); } finally { setIsLoading(false); }
  }, [generatedContent, settings.creativityLevel, settings.selectedModel, settings.geminiModel]);

  const handleRefineGenContent = useCallback(async (instruction: string) => {
    if (!generatedContent) return;
    setIsLoading(true);
    try {
      const model = settings.selectedModel || settings.geminiModel || 'gemini-3-flash-preview';
      const refined = await refineText(generatedContent, instruction, model, settings.creativityLevel || 7);
      setGeneratedContent(refined);
    } catch (e) { setError("오류 발생"); } finally { setIsLoading(false); }
  }, [generatedContent, settings.selectedModel, settings.geminiModel]);

  const createProject = (name: string) => {
    const newProject: Project = { 
        id: Date.now().toString(), 
        name, 
        createdAt: Date.now(), 
        worldview: '', 
        characters: '', 
        settings: { ...settings } 
    };
    if (user) saveProjectToFirestore(user.uid, newProject);
    else setProjects(prev => [...prev, newProject]);
    return newProject.id;
  };

  const deleteProject = (id: string) => {
    setDeleteDialog({
      isOpen: true,
      message: "프로젝트를 삭제하시겠습니까? (휴지통으로 이동)",
      onConfirm: async () => {
        if (user) {
            await deleteProjectFromFirestore(user.uid, id);
            // Soft delete associated stories
            savedStories.filter(s => s.projectId === id).forEach(s => deleteStoryFromFirestore(user.uid, s.id));
        } else {
            // Guest mode soft delete
            setProjects(prev => prev.map(p => p.id === id ? { ...p, deletedAt: Date.now() } : p));
            setSavedStories(prev => prev.map(s => s.projectId === id ? { ...s, deletedAt: Date.now() } : s));
        }
        if (activeProjectId === id) setActiveProjectId(null);
      }
    });
  };

  // Restore & Hard Delete Handlers
  const restoreProject = async (id: string) => {
      if (user) await restoreProjectToFirestore(user.uid, id);
      else setProjects(prev => prev.map(p => p.id === id ? { ...p, deletedAt: undefined } : p));
  };

  const hardDeleteProject = async (id: string) => {
      if (user) {
          await permanentDeleteProjectFromFirestore(user.uid, id);
          // Hard delete associated stories
          // NOTE: In Firestore we'd ideally query and batch delete, but simple loop is ok for small scale
          const storiesToDelete = savedStories.filter(s => s.projectId === id);
          for (const s of storiesToDelete) {
              await permanentDeleteStoryFromFirestore(user.uid, s.id);
          }
      } else {
          setProjects(prev => prev.filter(p => p.id !== id));
          setSavedStories(prev => prev.filter(s => s.projectId !== id));
      }
  };

  const restoreStory = async (id: string) => {
      if (user) await restoreStoryToFirestore(user.uid, id);
      else setSavedStories(prev => prev.map(s => s.id === id ? { ...s, deletedAt: undefined } : s));
  };

  const hardDeleteStory = async (id: string) => {
      if (user) await permanentDeleteStoryFromFirestore(user.uid, id);
      else setSavedStories(prev => prev.filter(s => s.id !== id));
  };

  const updateProject = (updatedProject: Project) => {
    if (user) saveProjectToFirestore(user.uid, updatedProject);
    else setProjects(prev => prev.map(p => p.id === updatedProject.id ? updatedProject : p));
  };

  const deleteStory = (id: string) => {
    setDeleteDialog({
      isOpen: true,
      message: "원고를 삭제하시겠습니까? (휴지통으로 이동)",
      onConfirm: async () => {
        if (user) await deleteStoryFromFirestore(user.uid, id);
        else setSavedStories(prev => prev.map(s => s.id === id ? { ...s, deletedAt: Date.now() } : s));
        
        if (editingStoryId === id) {
            setEditingStoryId(null);
            setGeneratedContent("");
            setEditingTitle("");
            if (isMobile && mobilePath === 'reader') setMobilePath('stories');
        }
      }
    });
  };

  const updateStory = (updatedStory: SavedStory) => {
     if (user) saveStoryToFirestore(user.uid, updatedStory);
     else setSavedStories(prev => prev.map(s => s.id === updatedStory.id ? updatedStory : s));
  };

  const saveStory = (title: string, projectId: string, category: 'manuscript' | 'synopsis') => {
    const newStory: SavedStory = {
      id: Date.now().toString(), projectId, title, content: generatedContent, createdAt: Date.now(), updatedAt: Date.now(), settings: { ...settings }, category
    };
    if (user) saveStoryToFirestore(user.uid, newStory);
    else setSavedStories(prev => [newStory, ...prev]);
    setEditingStoryId(newStory.id); 
    setEditingTitle(title);
    lastSavedSnapshot.current = { title, content: generatedContent };
    setLastSavedTime(Date.now());
    
    // Only switch views if we are NOT in AI Writer mode to preserve the "Write -> Save -> Continue Writing" flow
    // If we are in AI_WRITER, saving is just a background action + notification
    if (currentView !== 'AI_WRITER') {
        setActiveProjectId(projectId); 
        setLibraryViewMode(category);
    } else {
        alert("저장되었습니다!");
    }
  };

  const handleExternalSave = (title: string, content: string, projectId: string, settings?: NovelSettings, category: 'manuscript' | 'synopsis' = 'manuscript') => {
      const newStory: SavedStory = {
          id: Date.now().toString() + Math.random().toString(36).substr(2,5), 
          projectId, 
          title, 
          content, 
          createdAt: Date.now(), 
          updatedAt: Date.now(), 
          settings: settings ? { ...settings } : DEFAULT_SETTINGS, 
          category
      };
      if (user) saveStoryToFirestore(user.uid, newStory);
      else setSavedStories(prev => [newStory, ...prev]);
      return newStory.id;
  };

  const loadStory = (story: SavedStory) => {
    // Intercept loading with dirty check
    checkUnsavedChanges(() => {
        setSettings(story.settings);
        setGeneratedContent(story.content);
        setEditingTitle(story.title); 
        lastSavedSnapshot.current = { title: story.title, content: story.content };
        setLastSavedTime(story.updatedAt || story.createdAt);
        setActiveProjectId(story.projectId);
        setEditingStoryId(story.id);
        
        if (isMobile) {
            setMobilePath('reader');
        } else {
            setActiveTab('library'); 
            setCurrentView('WRITER'); 
            setIsMobileMenuOpen(false);
            setLibraryViewMode(story.category === 'manuscript' ? 'manuscript' : 'synopsis');
        }
    });
  };

  const handleManualCreate = async () => {
    // Intercept creation with dirty check
    checkUnsavedChanges(async () => {
        if (!activeProjectId) {
            alert("프로젝트를 선택해주세요.");
            return;
        }
        
        const isSynopsis = libraryViewMode === 'synopsis';
        const newTitle = isSynopsis ? "새 시놉시스" : "새 원고";
        const newStory: SavedStory = {
            id: Date.now().toString(),
            projectId: activeProjectId,
            title: newTitle,
            content: "",
            createdAt: Date.now(),
            updatedAt: Date.now(),
            settings: { ...settings },
            category: isSynopsis ? 'synopsis' : 'manuscript'
        };

        if (user) {
            await saveStoryToFirestore(user.uid, newStory);
        } else {
            setSavedStories(prev => [newStory, ...prev]);
        }

        setEditingStoryId(newStory.id);
        setEditingTitle(newTitle);
        setGeneratedContent("");
        lastSavedSnapshot.current = { title: newTitle, content: "" };
        setLastSavedTime(null);
        setCurrentView('WRITER');
        
        if (isMobile) {
            setMobilePath('reader');
        }
    });
  };

  const handleResetViewer = () => {
      if (confirm("현재 에디터의 내용을 모두 비우시겠습니까?")) {
          setGeneratedContent("");
      }
  };

  // --- MOBILE NAVIGATION HANDLERS ---
  const handleMobileProjectSelect = (projectId: string) => {
      setMobileSelectedProject(projectId);
      setMobilePath('stories');
  };

  const handleMobileBack = () => {
      // Intercept Back with dirty check if in reader
      if (mobilePath === 'reader') {
          checkUnsavedChanges(() => {
              setMobilePath('stories');
          });
      } else if (mobilePath === 'stories') {
          setMobilePath('projects');
          setMobileSelectedProject(null);
          // Important: Clear active project when going back to list to ensure global context is restored
          setActiveProjectId(null);
      }
  };

  // ---------------------------------------------
  // RENDER: GLOBAL LOADING (Initial Only)
  // ---------------------------------------------
  if (isAuthChecking) {
      return (
          <div className="h-screen w-screen bg-[#121212] flex flex-col items-center justify-center text-white">
              <Loader2 size={48} className="animate-spin text-indigo-500 mb-4" />
              <p className="text-gray-400">데이터를 불러오는 중...</p>
          </div>
      );
  }

  // ---------------------------------------------
  // RENDER: DESKTOP & MOBILE WRAPPER
  // ---------------------------------------------
  return (
    <div className="h-screen w-screen bg-[#121212] text-gray-200 relative overflow-hidden">
      {/* AI Model Notification Toast */}
      {aiNotification.visible && (
          <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[150] bg-gray-900/90 border border-gray-700 backdrop-blur-md text-white px-4 py-2 rounded-full shadow-2xl flex items-center gap-2 animate-in slide-in-from-top-5 fade-in">
              <Cpu size={14} className="text-purple-400" />
              <span className="text-xs font-bold text-gray-300">AI 사용됨:</span>
              <span className="text-xs font-medium text-white">{aiNotification.provider} - {aiNotification.model}</span>
          </div>
      )}

      {/* Quota Exceeded Warning Banner */}
      {isQuotaExceeded && (
          <div className="fixed top-0 left-0 right-0 z-[100] bg-red-600/90 backdrop-blur-md text-white px-4 py-3 shadow-2xl flex items-center justify-center animate-in slide-in-from-top duration-500 border-b border-red-500/50">
              <div className="flex items-center gap-4 max-w-4xl w-full">
                  <div className="p-2 bg-red-800/50 rounded-full shrink-0 animate-pulse">
                     <AlertTriangle className="text-white" size={24} />
                  </div>
                  <div className="flex-1 min-w-0">
                      <p className="font-bold text-base md:text-lg leading-tight">저장 공간(Quota)이 초과되었습니다!</p>
                      <p className="text-xs md:text-sm text-red-100 mt-1 opacity-90 truncate">
                          데이터가 클라우드에 저장되지 않고 있습니다. 잠시 후 다시 시도하거나, 사용량을 확인해주세요.
                      </p>
                  </div>
                  <button 
                    onClick={() => setIsQuotaExceeded(false)} 
                    className="p-2 hover:bg-red-700 rounded-full transition-colors shrink-0"
                    title="닫기"
                  >
                      <X size={20}/>
                  </button>
              </div>
          </div>
      )}

      {isMobile ? (
        // MOBILE RENDER (Existing logic preserved)
        <div className="h-full w-full flex flex-col overflow-hidden font-sans">
              <div className="h-14 border-b border-gray-800 bg-[#1c1c1c] flex items-center justify-between px-4 shrink-0 z-20 shadow-md">
                  {mobilePath !== 'projects' ? (
                      <button onClick={handleMobileBack} className="p-2 -ml-2 text-gray-400 hover:text-white">
                          <ArrowLeft size={24} />
                      </button>
                  ) : (
                      <div className="flex items-center gap-2">
                           <Book size={20} className="text-indigo-500"/>
                           <h1 className="font-bold text-lg">내 서재</h1>
                      </div>
                  )}
                  
                  <div className="font-medium text-base truncate max-w-[120px] text-center">
                      {mobilePath === 'stories' && projects.find(p => p.id === mobileSelectedProject)?.name}
                      {mobilePath === 'reader' && editingTitle}
                  </div>

                  {mobilePath === 'stories' ? (
                      <button 
                         onClick={() => setMobileSortOrder(prev => prev === 'name' ? 'date' : 'name')}
                         className="flex items-center gap-1 text-xs px-2 py-1 bg-gray-800 rounded border border-gray-700 text-gray-300"
                      >
                         <ArrowUpDown size={12} />
                         {mobileSortOrder === 'name' ? "이름순" : "최신순"}
                      </button>
                  ) : mobilePath === 'projects' ? (
                      <div className="w-10 flex justify-end">
                          {user ? (
                              <button onClick={handleSignOut} className="text-gray-400 p-2"><LogOut size={20}/></button>
                          ) : (
                              <button onClick={handleSignIn} className="text-indigo-400 font-bold text-sm">로그인</button>
                          )}
                      </div>
                  ) : (
                      <div className="w-10" />
                  )}
              </div>

              <div className="flex-1 overflow-y-auto bg-[#121212] custom-scrollbar relative">
                  {mobilePath === 'projects' && (
                      <div className="p-4 space-y-3">
                          <div className="text-xs text-gray-500 mb-2 px-1">프로젝트를 선택하여 원고를 열람하세요.</div>
                          {activeProjects.length === 0 ? (
                              <div className="text-center py-20 text-gray-600 flex flex-col items-center">
                                  <FolderOpen size={64} className="mb-4 opacity-20"/>
                                  <p className="text-lg font-medium">프로젝트가 없습니다.</p>
                                  <p className="text-sm mt-2 opacity-60">PC 버전에서 프로젝트를 생성해주세요.</p>
                                  {!user && <button onClick={handleSignIn} className="mt-6 px-6 py-3 bg-indigo-600 text-white rounded-lg font-bold">로그인하여 불러오기</button>}
                              </div>
                          ) : (
                              activeProjects.map(project => {
                                  const count = activeStories.filter(s => s.projectId === project.id).length;
                                  return (
                                      <div 
                                          key={project.id}
                                          onClick={() => handleMobileProjectSelect(project.id)}
                                          className="bg-[#1e1e1e] border border-gray-800 p-5 rounded-xl active:bg-[#2a2a2a] active:scale-95 transition-all shadow-lg flex items-center justify-between"
                                      >
                                          <div>
                                              <h3 className="font-bold text-lg text-gray-100 mb-1">{project.name}</h3>
                                              <div className="flex items-center gap-2 text-xs text-gray-500">
                                                  <span>{new Date(project.createdAt).toLocaleDateString()}</span>
                                                  <span>•</span>
                                                  <span className="text-indigo-400 font-medium">{count}개의 원고</span>
                                              </div>
                                          </div>
                                          <ChevronRight size={20} className="text-gray-600" />
                                      </div>
                                  )
                              })
                          )}
                      </div>
                  )}

                  {mobilePath === 'stories' && (
                       <div className="p-4 space-y-3">
                           {activeStories.filter(s => s.projectId === mobileSelectedProject).length === 0 ? (
                               <div className="text-center py-20 text-gray-600 flex flex-col items-center">
                                   <FileText size={64} className="mb-4 opacity-20"/>
                                   <p className="text-lg">이 프로젝트에는 원고가 없습니다.</p>
                               </div>
                           ) : (
                               sortStories(activeStories.filter(s => s.projectId === mobileSelectedProject), mobileSortOrder).map(story => (
                                   <div 
                                       key={story.id} 
                                       onClick={() => loadStory(story)}
                                       className="bg-[#1e1e1e] border border-gray-800 p-4 rounded-xl active:bg-[#2a2a2a] active:scale-95 transition-all shadow-sm flex gap-4 items-center"
                                   >
                                       <div className={`p-3 rounded-lg shrink-0 ${story.category === 'synopsis' ? 'bg-cyan-900/30 text-cyan-400' : 'bg-indigo-900/30 text-indigo-400'}`}>
                                           {story.category === 'synopsis' ? <BookOpen size={20} /> : <FileText size={20} />}
                                       </div>
                                       <div className="flex-1 min-w-0">
                                           <h4 className="font-bold text-base text-gray-100 truncate mb-1">{story.title}</h4>
                                           <p className="text-xs text-gray-500 flex items-center gap-2">
                                               {new Date(story.updatedAt || story.createdAt).toLocaleDateString()} 
                                               <span className="w-1 h-1 bg-gray-600 rounded-full"></span>
                                               {story.content.length.toLocaleString()}자
                                           </p>
                                       </div>
                                   </div>
                               ))
                           )}
                           
                           <button 
                                onClick={handleManualCreate}
                                className="w-full mt-4 py-3 bg-indigo-900/30 border border-indigo-500/50 hover:bg-indigo-800/30 text-indigo-300 rounded-xl font-bold flex items-center justify-center gap-2"
                           >
                                <Edit3 size={18} /> 새 원고 작성
                           </button>
                       </div>
                  )}

                  {mobilePath === 'reader' && (
                       <NovelViewer 
                          title={editingTitle}
                          setTitle={setEditingTitle}
                          content={generatedContent}
                          setContent={setGeneratedContent}
                          isLoading={false}
                          error={null}
                          onSaveAs={() => setIsSaveModalOpen(true)}
                          onUpdate={() => {
                              if (editingStoryId) {
                                  const story = savedStories.find(s => s.id === editingStoryId);
                                  if (story) {
                                      lastSavedSnapshot.current = { title: editingTitle, content: generatedContent };
                                      setLastSavedTime(Date.now());
                                      const updated = { ...story, title: editingTitle, content: generatedContent, settings: {...settings}, updatedAt: Date.now() };
                                      if(user) saveStoryToFirestore(user.uid, updated);
                                      else setSavedStories(prev => prev.map(s => s.id === updated.id ? updated : s));
                                      alert("저장되었습니다.");
                                  }
                              }
                          }}
                          onReset={handleResetViewer}
                          isExistingStory={true}
                          goHome={handleMobileBack}
                          isMobile={true} 
                          lastSavedTime={lastSavedTime}
                          presets={globalSettings?.aiPresets && globalSettings.aiPresets.length > 0 ? globalSettings.aiPresets : DEFAULT_AI_PRESETS}
                          model={settings.geminiModel}
                       />
                  )}
              </div>
          </div>
      ) : (
        // DESKTOP RENDER
        (() => {
          switch (currentView) {
            case 'HOME':
              return (
                <HomeScreen 
                  user={user}
                  onSignIn={handleSignIn}
                  onSignOut={handleSignOut}
                  projects={activeProjects} 
                  stories={activeStories}
                  savedStyles={savedStyles}
                  onChangeView={(view) => {
                      if(view === 'WRITER') {
                          // When going to Writer directly (New), reset mode
                          setLibraryViewMode('manuscript'); // FORCE MANUSCRIPT MODE for new
                          setCurrentView('AI_WRITER');
                      }
                      else setCurrentView(view);
                  }}
                  setActiveProjectId={setActiveProjectId}
                  onCreateProject={createProject}
                  onDeleteProject={deleteProject}
                  onUpdateProject={updateProject} 
                  onOpenProjectSettings={(p) => { setEditingProject(p); setIsProjectSettingsOpen(true); }}
                  onDeleteStory={deleteStory}
                  onSelectStory={loadStory}
                  onUpdateStory={(updated) => {
                       if (user) saveStoryToFirestore(user.uid, updated);
                       else setSavedStories(prev => prev.map(s => s.id === updated.id ? updated : s));
                  }}
                  onExternalSave={handleExternalSave}
                  onOpenProject={(p) => {
                      checkUnsavedChanges(() => {
                        setActiveProjectId(p.id);
                        setLibraryViewMode('selection'); 
                        setActiveTab('library'); 
                        setCurrentView('WRITER'); 
                        setGeneratedContent("");
                        setEditingTitle("");
                        setEditingStoryId(null);
                        lastSavedSnapshot.current = { title: "", content: "" };
                      });
                  }}
                  onAnalyzeManuscript={async (text) => {
                      setIsLoading(true);
                      try {
                        const analyzedData = await analyzeManuscript(text);
                        if (analyzedData) {
                          const worldItems: WorldItem[] = (Array.isArray(analyzedData.worldview) ? analyzedData.worldview : []).map((wv) => ({
                              id: Date.now().toString() + Math.random().toString(36).substr(2, 5), type: 'note', title: wv.title, content: wv.content, parentId: null, createdAt: Date.now()
                          }));
                          const newProject: Project = {
                            id: Date.now().toString(), name: analyzedData.title || "분석된 프로젝트", createdAt: Date.now(), worldview: JSON.stringify(worldItems), characters: JSON.stringify(analyzedData.characters), settings: DEFAULT_SETTINGS
                          };
                          if (user) await saveProjectToFirestore(user.uid, newProject);
                          else setProjects(prev => [newProject, ...prev]);
                          alert(`'${newProject.name}' 프로젝트 생성 완료! 세계관 구축 화면으로 이동합니다.`);
                          setActiveProjectId(newProject.id);
                          setCurrentView('WORLD_BUILDER');
                        }
                      } catch (e) { alert("오류 발생"); } finally { setIsLoading(false); }
                  }}
                  isGlobalLoading={isLoading}
                  settings={settings}
                  onUpdateSettings={setSettings}
                  editorPrefs={editorPrefs}
                  onUpdateEditorPrefs={setEditorPrefs}
                  onSaveStyle={handleSaveStyle}
                  onDeleteStyle={handleDeleteStyle}
                  onOpenTrash={() => setIsTrashOpen(true)}
                  isSettingsOpen={isSettingsOpen}
                  setIsSettingsOpen={setIsSettingsOpen}
                />
              );
            case 'WORLD_BUILDER': return <WorldBuilder projects={activeProjects} stories={activeStories} activeProjectId={activeProjectId} setActiveProjectId={setActiveProjectId} onUpdateProject={updateProject} onBack={() => checkUnsavedChanges(() => { setActiveProjectId(null); setCurrentView('HOME'); })} settings={settings} selectedModel={settings.selectedModel || settings.geminiModel || 'gemini-3-flash-preview'} />;
            case 'CHARACTER_LAB': return <CharacterCreator projects={activeProjects} activeProjectId={activeProjectId} setActiveProjectId={setActiveProjectId} onUpdateProject={updateProject} onBack={() => checkUnsavedChanges(() => { setActiveProjectId(null); setCurrentView('HOME'); })} settings={settings} selectedModel={settings.selectedModel || settings.geminiModel || 'gemini-3-flash-preview'} />;
            case 'IDEA_EXPLORER': 
                return <IdeaExplorer 
                    projects={activeProjects} 
                    sessions={ideaSessions} 
                    stories={activeStories} 
                    onUpdateSession={handleUpdateSession} 
                    onDeleteSession={handleDeleteSession} 
                    onCreateSession={handleCreateSession} 
                    onUpdateProject={updateProject} 
                    onSaveStory={handleExternalSave} 
                    onBack={() => checkUnsavedChanges(() => { setActiveProjectId(null); setCurrentView('HOME'); })} 
                    onSaveStyle={handleSaveStyle} 
                    settings={settings}
                />;
            case 'AI_WRITER':
                return (
                    <div className="w-full h-full bg-[#121212] text-gray-100 overflow-y-auto custom-scrollbar relative">
                        <button onClick={() => checkUnsavedChanges(() => { setActiveProjectId(null); setCurrentView('HOME'); })} className="fixed top-6 left-6 z-50 p-2 bg-[#1e1e1e] rounded-full text-gray-400 hover:text-white hover:bg-gray-700 border border-gray-800"><Home size={20} /></button>
                        <Controls 
                            settings={settings} 
                            setSettings={setSettings} 
                            onGenerate={handleGenerate} 
                            onRetry={handleRetry} 
                            onContinue={handleContinueGenerate} 
                            onRefine={handleRefineGenContent} 
                            isLoading={isLoading} 
                            projects={activeProjects} 
                            activeProjectId={activeProjectId} 
                            setActiveProjectId={setActiveProjectId} 
                            stories={activeStories} 
                            generatedContent={generatedContent} 
                            onFinish={handleFinishGeneration} 
                            onSave={handleAiWriterSave} // New Handler
                            savedStyles={savedStyles} 
                            onUpdateProject={(p) => { if(user) saveProjectToFirestore(user.uid, p); }}
                            presets={globalSettings?.aiPresets && globalSettings.aiPresets.length > 0 ? globalSettings.aiPresets : DEFAULT_AI_PRESETS}
                        />
                    </div>
                );
            case 'WRITER':
              return (
                <div className="flex h-full w-full overflow-hidden bg-[#121212] text-gray-100 font-inter relative">
                  <aside className="relative flex flex-col w-[360px] border-r border-gray-800 bg-[#1c1c1c]">
                    <div className="p-4 flex items-center justify-between bg-[#1c1c1c] border-b border-gray-800">
                      <button onClick={() => checkUnsavedChanges(() => { setActiveProjectId(null); setCurrentView('HOME'); })} className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg flex items-center gap-2 text-sm"><Home size={16} /> 홈으로</button>
                      <h2 className="text-lg font-bold text-white flex items-center gap-2"><BookOpen className="text-purple-400" size={18} /> NovelCraft</h2>
                    </div>
                    <div className="flex border-b border-gray-800 bg-[#1c1c1c]">
                        <button onClick={() => setActiveTab('library')} className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors flex items-center justify-center gap-2 ${activeTab === 'library' ? 'border-purple-500 text-white bg-[#252525]' : 'border-transparent text-gray-500'}`}><Archive size={16} />{activeProjectId ? '보관함' : '모든 프로젝트'}</button>
                        <button 
                            onClick={() => checkUnsavedChanges(() => {
                                setLibraryViewMode('manuscript'); // FORCE MANUSCRIPT MODE for new
                                setCurrentView('AI_WRITER');
                            })} 
                            className="flex-1 py-3 text-sm font-medium border-b-2 border-transparent text-gray-500 hover:text-gray-300 hover:bg-[#252525] flex items-center justify-center gap-2"
                        >
                            <Edit3 size={16} /> 새 원고
                        </button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-[#1c1c1c]">
                        <Library 
                          projects={activeProjects} 
                          stories={activeStories} 
                          activeProjectId={activeProjectId} 
                          setActiveProjectId={setActiveProjectId} 
                          onCreateProject={createProject} 
                          onDeleteProject={deleteProject} 
                          onDeleteStory={deleteStory} 
                          onSelectStory={loadStory} 
                          onOpenProjectSettings={(p) => { setEditingProject(p); setIsProjectSettingsOpen(true); }} 
                          onManualCreate={handleManualCreate} 
                          libraryViewMode={libraryViewMode} 
                          setLibraryViewMode={setLibraryViewMode} 
                          onResetEditor={() => { checkUnsavedChanges(() => { setGeneratedContent(""); setEditingTitle(""); setEditingStoryId(null); lastSavedSnapshot.current = { title: "", content: "" }; }); }} 
                          onOpenTrash={() => setIsTrashOpen(true)}
                        />
                    </div>
                  </aside>
                  <main className="flex-1 h-full relative min-w-0 w-full bg-[#121212]">
                    <NovelViewer 
                      title={editingTitle} setTitle={setEditingTitle} content={generatedContent} setContent={setGeneratedContent} isLoading={isLoading} error={error} onSaveAs={() => setIsSaveModalOpen(true)} 
                      onUpdate={() => { 
                        if (editingStoryId) {
                            const story = savedStories.find(s => s.id === editingStoryId);
                            if (story) {
                                // Update snapshot explicitly to sync manual save
                                lastSavedSnapshot.current = { title: editingTitle, content: generatedContent };
                                setLastSavedTime(Date.now());
                                
                                const updated = {
                                    ...story,
                                    title: editingTitle,
                                    content: generatedContent,
                                    settings: { ...settings },
                                    updatedAt: Date.now()
                                };
                                
                                if (user) saveStoryToFirestore(user.uid, updated)
                                    .then(() => alert("저장되었습니다."))
                                    .catch((e) => {
                                        console.error("Update failed", e);
                                        if(e.code === 'resource-exhausted' || e.message?.includes('Quota')) {
                                            alert("⚠️ 일일 저장 용량 초과!\n\n저장에 실패했습니다. 내용을 복사하여 백업하세요.");
                                        } else {
                                            alert("저장 실패. 내용을 확인해주세요.");
                                        }
                                    });
                                else {
                                    setSavedStories(prev => prev.map(s => s.id === updated.id ? updated : s));
                                    alert("저장되었습니다.");
                                }
                            }
                        }
                      }} 
                      onContinue={handleContinueGenerate} onRetry={handleRetry} onReset={handleResetViewer} isExistingStory={!!editingStoryId} goHome={() => checkUnsavedChanges(() => { setActiveProjectId(null); setCurrentView('HOME'); })} lastSavedTime={lastSavedTime} editorPrefs={editorPrefs} isMobile={false}
                      presets={globalSettings?.aiPresets && globalSettings.aiPresets.length > 0 ? globalSettings.aiPresets : DEFAULT_AI_PRESETS}
                      model={settings.geminiModel}
                    />
                  </main>
                </div>
              );
          }
        })()
      )}
      
      {/* Dialogs */}
      <SaveDialog 
        isOpen={isSaveModalOpen} 
        onClose={() => setIsSaveModalOpen(false)} 
        onSave={saveStory} 
        projects={activeProjects} 
        onCreateProject={createProject} 
        category={(currentView === 'AI_WRITER') ? 'manuscript' : (libraryViewMode === 'synopsis' ? 'synopsis' : 'manuscript')} 
      />
      <ProjectSettingsDialog isOpen={isProjectSettingsOpen} onClose={() => setIsProjectSettingsOpen(false)} project={editingProject} onSave={updateProject} />
      <DeleteConfirmDialog isOpen={deleteDialog.isOpen} onClose={() => setDeleteDialog(prev => ({ ...prev, isOpen: false }))} onConfirm={() => { deleteDialog.onConfirm(); setDeleteDialog(prev => ({ ...prev, isOpen: false })); }} message={deleteDialog.message} />
      <TrashBin 
        isOpen={isTrashOpen} 
        onClose={() => setIsTrashOpen(false)}
        deletedProjects={deletedProjects}
        deletedStories={deletedStories}
        onRestoreProject={restoreProject}
        onRestoreStory={restoreStory}
        onHardDeleteProject={hardDeleteProject}
        onHardDeleteStory={hardDeleteStory}
      />
    
      {/* Unsaved Changes Dialog */}
      {unsavedDialog.isOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-gray-800 border border-gray-700 rounded-xl w-full max-w-sm shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center p-4 border-b border-gray-700">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <AlertTriangle className="text-yellow-500" size={20} />
                저장되지 않은 변경사항
              </h3>
              <button onClick={() => setUnsavedDialog(prev => ({ ...prev, isOpen: false }))} className="text-gray-400 hover:text-white">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6">
              <p className="text-gray-300 leading-relaxed">
                작성 중인 내용이 변경되었습니다.<br/>
                저장하시겠습니까?
              </p>
            </div>

            <div className="p-4 bg-gray-900/50 border-t border-gray-700 flex justify-end gap-2 rounded-b-xl">
              <button 
                onClick={unsavedDialog.onDiscard}
                className="px-4 py-2 text-gray-300 hover:text-white hover:bg-gray-700 rounded-lg transition-colors text-sm"
              >
                아니오 (저장 안 함)
              </button>
              <button 
                onClick={unsavedDialog.onConfirm}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg transition-colors shadow-lg shadow-indigo-500/20 text-sm flex items-center gap-2"
              >
                <Save size={16} />
                예 (저장)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;