
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Copy, Download, RefreshCw, Save, Sparkles, Wand2, AlertTriangle, FileText, Home, PanelRightClose, Play, RotateCcw, Check, AlignLeft, Eraser, ArrowLeft, Edit3, Link2, Maximize2, Flame, Undo2, Redo2 } from 'lucide-react';
import { refineText } from '../services/geminiService.ts';
import { AI_PROMPTS, DEFAULT_AI_PRESETS } from '../services/prompts.ts';
import { EditorPreferences, NovelSettings, AiPreset } from '../types.ts';
import AiRefinePanel from './AiRefinePanel.tsx';

interface NovelViewerProps {
  title: string;
  setTitle: (title: string) => void;
  content: string;
  setContent: (text: string) => void;
  isLoading: boolean;
  error: string | null;
  onSaveAs: () => void;
  onUpdate: () => void;
  onContinue?: () => void; 
  onRetry?: () => void;
  onReset?: () => void; // New Reset Prop
  isExistingStory: boolean;
  goHome: () => void;
  onToggleMobileMenu?: () => void;
  lastSavedTime?: number | null;
  editorPrefs?: EditorPreferences;
  isMature?: boolean;
  isMobile?: boolean;
  presets?: AiPreset[]; // Pass presets
}

const NovelViewer: React.FC<NovelViewerProps> = ({ 
  title,
  setTitle,
  content, 
  setContent, 
  isLoading, 
  error, 
  onSaveAs,
  onUpdate,
  onContinue,
  onRetry,
  onReset,
  isExistingStory,
  goHome,
  onToggleMobileMenu,
  lastSavedTime,
  editorPrefs,
  isMature = false,
  isMobile = false,
  presets = DEFAULT_AI_PRESETS
}) => {
  const bottomRef = useRef<HTMLDivElement>(null);
  const [isRefining, setIsRefining] = useState(false);
  const [showTools, setShowTools] = useState(false); 
  
  // Mobile Edit State
  const [mobileEditMode, setMobileEditMode] = useState(false);

  // --- HISTORY STACK FOR UNDO/REDO (Fix: Single State Object) ---
  const [historyState, setHistoryState] = useState<{stack: string[], index: number}>({ stack: [], index: -1 });

  // Initialize history with initial content
  useEffect(() => {
      // Only set initial history if empty and content exists
      if (historyState.stack.length === 0 && content) {
          setHistoryState({ stack: [content], index: 0 });
      }
  }, []); // Run once on mount

  // Helper to push new state
  const pushHistory = (newContent: string) => {
      setHistoryState(prev => {
          const { stack, index } = prev;
          // Ignore if identical to current head
          if (index >= 0 && stack[index] === newContent) return prev;
          
          const newStack = stack.slice(0, index + 1);
          newStack.push(newContent);
          
          // Limit history size
          if (newStack.length > 50) newStack.shift();
          
          return {
              stack: newStack,
              index: newStack.length - 1
          };
      });
  };

  const handleUndo = () => {
      const { stack, index } = historyState;
      if (index > 0) {
          const newIndex = index - 1;
          const prevContent = stack[newIndex];
          setContent(prevContent);
          setHistoryState(prev => ({ ...prev, index: newIndex }));
      }
  };

  const handleRedo = () => {
      const { stack, index } = historyState;
      if (index < stack.length - 1) {
          const newIndex = index + 1;
          const nextContent = stack[newIndex];
          setContent(nextContent);
          setHistoryState(prev => ({ ...prev, index: newIndex }));
      }
  };

  useEffect(() => {
    if (isLoading && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [content, isLoading]);

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    alert("원고가 복사되었습니다.");
  };

  const handleRefine = async (instruction: string) => {
    if (!instruction.trim() || !content) return;
    
    // 1. Snapshot BEFORE (Current Manual State)
    pushHistory(content); 

    setIsRefining(true);
    try {
      const refined = await refineText(content, instruction, isMature);
      
      // 2. Update Content
      setContent(refined);
      
      // 3. Snapshot AFTER (AI Result State)
      pushHistory(refined); 
      
    } catch (e) {
      alert("AI 수정 중 오류가 발생했습니다.");
    } finally {
      setIsRefining(false);
    }
  };

  const handleMobileSave = () => {
      onUpdate();
      setMobileEditMode(false);
  };

  // --- Helper to check for cut-off text ---
  const isTextCutOff = (text: string): boolean => {
      if (!text || text.trim().length === 0) return false;
      const trimmed = text.trim();
      const lastChar = trimmed.slice(-1);
      const strictTerminators = ['.', '!', '?', '"', '”', '…'];
      return !strictTerminators.includes(lastChar);
  };

  const isCutOff = isTextCutOff(content);

  // --- Styling ---
  const isSeparated = editorPrefs?.colorSeparation ?? true;
  const maxWidth = isMobile ? '100%' : (editorPrefs?.editorWidth ? `${editorPrefs.editorWidth}px` : '600px');
  const lineHeight = editorPrefs?.paragraphSpacing ? `${editorPrefs.paragraphSpacing}` : '1.8'; 
  const fontSize = isMobile ? '18px' : (editorPrefs?.fontSize ? `${editorPrefs.fontSize}px` : '16px');

  const bgClass = 'bg-[#121212]'; 
  const textClass = 'text-gray-200';
  
  const paperClass = (isSeparated && !isMobile)
      ? 'bg-[#1e1e1e] text-gray-100 shadow-2xl border border-gray-800' 
      : 'bg-transparent border-none shadow-none text-gray-200';

  if (error) {
    return (
      <div className={`flex flex-col items-center justify-center h-full p-8 text-center ${bgClass}`}>
        <AlertTriangle size={48} className="text-red-500 mb-4" />
        <h3 className="text-xl font-bold mb-2 text-gray-200">오류</h3>
        <p className="mb-6 max-w-md text-gray-400">{error}</p>
        <button onClick={goHome} className="px-6 py-3 bg-red-600 text-white rounded-lg">돌아가기</button>
      </div>
    );
  }

  return (
    <div className={`flex h-full relative overflow-hidden transition-colors duration-300 ${bgClass}`}>
      
      {/* Left/Center Column: Editor */}
      <div className="flex-1 flex flex-col min-w-0 relative border-r-0 md:border-r border-gray-800">
        
        {/* Toolbar - Completely HIDDEN on Mobile */}
        {!isMobile && (
            <div className="h-16 border-b flex items-center justify-between px-4 md:px-6 shrink-0 gap-2 transition-colors bg-[#1c1c1c] border-gray-800">
            <div className="w-8 md:hidden shrink-0"></div>
            <div className="flex-1 min-w-0 flex flex-col justify-center">
                <input 
                    className="w-full bg-transparent text-lg font-bold outline-none truncate transition-colors text-white placeholder-gray-600"
                    placeholder="제목 없음"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                />
                {isExistingStory && (
                    <div className="text-[10px] flex items-center gap-1 h-3">
                        {lastSavedTime ? (
                            <span className="text-gray-500 flex items-center gap-1"><Check size={10} /> 저장됨 ({new Date(lastSavedTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})})</span>
                        ) : null}
                    </div>
                )}
            </div>
            
            <div className="flex items-center gap-1 md:gap-2">
                <div className="hidden md:flex items-center gap-2">
                    {/* UNDO / REDO (Improved Visibility) */}
                    <div className="flex bg-gray-800 rounded-lg p-1 mr-2 gap-1">
                        <button 
                            onClick={handleUndo} 
                            disabled={historyState.index <= 0}
                            className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-md disabled:opacity-30 disabled:cursor-not-allowed transition-all font-bold flex items-center gap-1.5 active:scale-95"
                            title="실행 취소 (Undo)"
                        >
                            <Undo2 size={16}/>
                            <span className="text-xs">이전</span>
                        </button>
                        <button 
                            onClick={handleRedo} 
                            disabled={historyState.index >= historyState.stack.length - 1}
                            className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-md disabled:opacity-30 disabled:cursor-not-allowed transition-all font-bold flex items-center gap-1.5 active:scale-95"
                            title="다시 실행 (Redo)"
                        >
                            <span className="text-xs">다음</span>
                            <Redo2 size={16}/>
                        </button>
                    </div>

                    {isExistingStory && (
                        <button onClick={onUpdate} className="flex items-center gap-2 px-3 py-2 bg-[#2a2a2a] hover:bg-[#3a3a3a] text-gray-200 border border-gray-700 text-xs font-bold rounded-lg">
                        <Save size={14} /> 저장
                        </button>
                    )}
                    <button onClick={onSaveAs} className={`flex items-center gap-2 px-3 py-2 text-xs font-bold rounded-lg transition-all ${!isExistingStory ? 'bg-purple-600 hover:bg-purple-500 text-white' : 'bg-gray-800 hover:bg-gray-700 text-gray-300'}`}>
                        <Save size={14} /> {isExistingStory ? "다른 이름으로" : "저장"}
                    </button>
                    
                    {/* RESET BUTTON */}
                    {onReset && !isLoading && (
                        <button onClick={onReset} disabled={isLoading} className="p-2 rounded transition-colors text-gray-400 hover:text-red-400 hover:bg-gray-800" title="초기화 (비우기)">
                            <Eraser size={16} />
                        </button>
                    )}

                    <div className="w-px h-4 mx-2 bg-gray-700"></div>
                    <button onClick={handleCopy} className="p-2 rounded transition-colors text-gray-400 hover:bg-gray-700"><Copy size={16}/></button>
                </div>
                
                <div className="flex md:hidden items-center gap-1">
                    <button onClick={isExistingStory ? onUpdate : onSaveAs} className="p-2 bg-[#2a2a2a] border border-gray-700 text-white rounded-lg">
                        <Save size={18} />
                    </button>
                    <button onClick={() => setShowTools(!showTools)} className={`p-2 rounded-lg ${showTools ? 'bg-gray-800' : 'text-gray-400'}`}>
                        <Sparkles size={18} />
                    </button>
                </div>
            </div>
            </div>
        )}

        {/* Editor Content Area */}
        <div className={`flex-1 relative overflow-hidden flex flex-col ${bgClass}`}>
           {/* On Mobile: Add extra padding and cleaner layout */}
           <div className={`flex-1 overflow-y-auto custom-scrollbar flex justify-center ${isMobile ? 'px-6 pt-8 pb-24' : 'p-8'}`}>
              
              {/* Paper / Text Container */}
              <div 
                  className={`transition-all duration-300 ease-in-out ${paperClass}`}
                  style={{ 
                      width: '100%',
                      maxWidth: maxWidth,
                      minHeight: (isSeparated && !isMobile) ? '80vh' : 'auto',
                      padding: (isSeparated && !isMobile) ? '3rem 3rem 5rem 3rem' : '0',
                      borderRadius: (isSeparated && !isMobile) ? '4px' : '0'
                  }}
              >
                  {isMobile && mobileEditMode && (
                      <input
                          className="w-full bg-transparent text-2xl font-bold text-gray-100 mb-6 outline-none border-b border-gray-800 pb-2 placeholder-gray-600"
                          value={title}
                          onChange={(e) => setTitle(e.target.value)}
                          placeholder="제목을 입력하세요"
                      />
                  )}

                  <textarea
                    className={`w-full h-full bg-transparent resize-none outline-none block ${textClass}`}
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    readOnly={isMobile && !mobileEditMode}
                    placeholder="여기에 내용을 작성하거나 AI로 생성하세요..."
                    spellCheck={false}
                    style={{ 
                        fontSize: fontSize,
                        lineHeight: lineHeight,
                        minHeight: isMobile ? '80vh' : '60vh',
                        fontFamily: "'Merriweather', 'Noto Sans KR', serif"
                    }}
                  />
                  <div ref={bottomRef} />
              </div>
           </div>
           
           {isMobile && (
               <div className="fixed bottom-6 left-1/2 -translate-x-1/2 flex gap-3 z-50 w-max max-w-[90%] justify-center">
                    {onReset && (
                        <button onClick={onReset} className="flex items-center gap-1.5 px-3 py-2 bg-red-900/50 text-red-200 rounded-full shadow-lg border border-red-700 backdrop-blur-md font-medium text-xs active:scale-95 transition-transform whitespace-nowrap">
                            <Eraser size={14}/>
                        </button>
                    )}
                    <button
                       onClick={handleCopy}
                       className="flex items-center gap-1.5 px-3 py-2 bg-gray-800 text-gray-200 rounded-full shadow-lg border border-gray-700 backdrop-blur-md font-medium text-xs active:scale-95 transition-transform whitespace-nowrap"
                    >
                       <Copy size={14} /> 전체 복사
                    </button>
                    {mobileEditMode ? (
                        <button
                           onClick={handleMobileSave}
                           className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 text-white rounded-full shadow-lg shadow-indigo-500/30 font-bold text-xs active:scale-95 transition-transform whitespace-nowrap"
                        >
                           <Save size={14} /> 저장 완료
                        </button>
                    ) : (
                        <button
                           onClick={() => setMobileEditMode(true)}
                           className="flex items-center gap-1.5 px-3 py-2 bg-gray-800 text-gray-200 rounded-full shadow-lg border border-gray-700 backdrop-blur-md font-medium text-xs active:scale-95 transition-transform whitespace-nowrap"
                        >
                           <Edit3 size={14} /> 원고 편집
                        </button>
                    )}
               </div>
           )}
           
           {isLoading && (
             <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-3 bg-[#2a2a2a] px-6 py-3 rounded-full shadow-2xl border border-gray-700 z-10 items-center whitespace-nowrap">
                <span className="text-sm font-medium text-gray-300">작성 중...</span>
             </div>
           )}
        </div>
      </div>

      {/* Right Column: AI Tools (Drawer) - UPGRADED UI */}
      {!isMobile && (
        <div className={`
            fixed inset-y-0 right-0 z-30 w-[350px] flex flex-col shadow-2xl transition-transform duration-300 ease-in-out
            md:relative md:translate-x-0 md:shadow-none 
            bg-[#1c1c1c] border-l border-gray-800 backdrop-blur
            ${showTools ? 'translate-x-0' : 'translate-x-full'}
        `}>
            <div className="p-4 border-b font-bold flex items-center justify-between text-sm uppercase tracking-wider h-16 shrink-0 border-gray-800 text-gray-400 bg-[#252525]">
                <div className="flex items-center gap-2">
                    <Sparkles size={16} className="text-purple-500"/> AI 편집 도구
                </div>
                <button onClick={() => setShowTools(false)} className="md:hidden p-1">
                    <PanelRightClose size={20} />
                </button>
            </div>
            
            <div className="p-4 space-y-6 overflow-y-auto custom-scrollbar flex-1 bg-[#1c1c1c]">
                
                {/* Reusable AiRefinePanel Component */}
                <AiRefinePanel
                    currentText={content}
                    onRefine={handleRefine}
                    isRefining={isRefining}
                    isMature={isMature}
                    disabled={isLoading}
                    presets={presets}
                />

                <div className="pt-4 border-t border-gray-800 space-y-2 md:hidden">
                    <button onClick={onSaveAs} className="w-full py-3 bg-gray-800 rounded-lg text-sm flex items-center justify-center gap-2 text-gray-300">
                        <Save size={16} /> 다른 이름으로 저장
                    </button>
                    <button onClick={handleCopy} className="w-full py-3 bg-gray-800 rounded-lg text-sm flex items-center justify-center gap-2 text-gray-300">
                        <Copy size={16} /> 전체 복사
                    </button>
                </div>
            </div>
        </div>
      )}
      
      {showTools && (
        <div className="fixed inset-0 bg-black/50 z-20 md:hidden" onClick={() => setShowTools(false)}></div>
      )}
    </div>
  );
};

export default NovelViewer;
