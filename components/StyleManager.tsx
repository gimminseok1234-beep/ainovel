
import React, { useState, useRef } from 'react';
import { SavedStyle, NovelSettings, DEFAULT_SETTINGS } from '../types.ts';
import { Upload, Wand2, Trash2, X, Plus, Info, RefreshCcw, ArrowLeft } from 'lucide-react';
import { analyzeWritingStyle } from '../services/geminiService.ts';

interface StyleManagerProps {
  isOpen: boolean;
  onClose: () => void;
  savedStyles: SavedStyle[];
  onSaveStyle: (style: SavedStyle) => void;
  onDeleteStyle: (id: string) => void;
  settings?: NovelSettings; // NEW PROP
  checkApiKey?: () => boolean;
}

const StyleManager: React.FC<StyleManagerProps> = ({
  isOpen,
  onClose,
  savedStyles,
  onSaveStyle,
  onDeleteStyle,
  settings,
  checkApiKey
}) => {
  const [view, setView] = useState<'list' | 'create' | 'detail'>('list');
  const [selectedStyle, setSelectedStyle] = useState<SavedStyle | null>(null);
  const [newStyleName, setNewStyleName] = useState('');
  const [newStyleDesc, setNewStyleDesc] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (checkApiKey && !checkApiKey()) {
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
    }

    if (file.size > 5 * 1024 * 1024) {
        alert("파일이 너무 큽니다. 5MB 이하의 텍스트 파일을 사용해주세요.");
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
    }

    setIsAnalyzing(true);

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        if (!text || text.trim().length === 0) throw new Error("파일 내용이 비어있습니다.");
        
        // Prepare Grok options
        let grokOptions = undefined;
        if (settings?.grokApiKey) {
            grokOptions = {
                apiKey: settings.grokApiKey,
                model: settings.grokModel || 'grok-3'
            };
        }

        // Prepare Magnum options
        let magnumOptions = undefined;
        if (settings?.magnumApiKey) {
            magnumOptions = {
                apiKey: settings.magnumApiKey,
                model: settings.magnumModel || 'anthracite-org/magnum-v4-72b'
            };
        }

        let result = await analyzeWritingStyle(
            text, 
            settings?.primaryModel || settings?.geminiModel || 'gemini-3-flash-preview', 
            grokOptions,
            magnumOptions
        );
        
        if (!result) throw new Error("AI가 스타일을 분석하지 못했습니다.");
        setNewStyleDesc(result);
      } catch (error: any) {
          alert(`스타일 분석 오류: ${error.message}`);
      } finally {
          setIsAnalyzing(false);
          if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  const handleSave = () => {
      if (!newStyleName || !newStyleDesc) return;
      onSaveStyle({
          id: Date.now().toString(),
          name: newStyleName,
          description: newStyleDesc,
          type: 'general',
          createdAt: Date.now()
      });
      setView('list');
      setNewStyleName('');
      setNewStyleDesc('');
  };

  const openDetail = (style: SavedStyle) => {
      setSelectedStyle(style);
      setView('detail');
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-[#1e1e1e] border border-gray-700 rounded-xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex justify-between items-center p-5 border-b border-gray-800 bg-[#252525] rounded-t-xl">
          <div className="flex items-center gap-3">
             {view !== 'list' && (
                 <button onClick={() => setView('list')} className="p-1 hover:bg-gray-700 rounded text-gray-400 hover:text-white transition-colors">
                     <ArrowLeft size={20} />
                 </button>
             )}
             <h3 className="font-bold text-white flex items-center gap-2">
                <Wand2 className="text-purple-400" /> 
                {view === 'create' ? '새 문체 학습' : view === 'detail' ? selectedStyle?.name : '문체 라이브러리'}
             </h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><X size={20}/></button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
            {view === 'list' && (
                <div className="space-y-4">
                    <button 
                        onClick={() => setView('create')}
                        className="w-full py-4 border-2 border-dashed border-gray-700 rounded-xl text-gray-400 hover:text-white hover:border-purple-500 hover:bg-gray-800 transition-all flex flex-col items-center justify-center gap-2"
                    >
                        <Plus size={24} />
                        <span className="font-bold">새로운 문체 학습 및 추가</span>
                    </button>

                    {savedStyles.length === 0 ? (
                        <div className="text-center text-gray-500 py-10">저장된 문체가 없습니다.</div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {savedStyles.map(style => (
                                <div 
                                    key={style.id} 
                                    onClick={() => openDetail(style)}
                                    className="bg-gray-800 border rounded-lg p-4 relative group hover:border-purple-500 transition-colors cursor-pointer border-gray-700"
                                >
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="flex items-center gap-2">
                                            <Wand2 size={16} className="text-purple-400"/>
                                            <h4 className="font-bold text-gray-200 truncate max-w-[120px]">{style.name}</h4>
                                        </div>
                                        <button onClick={(e) => { e.stopPropagation(); onDeleteStyle(style.id); }} className="text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={16}/></button>
                                    </div>
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="text-[10px] px-2 py-0.5 rounded-full border bg-purple-900/30 border-purple-500/30 text-purple-400">
                                            일반 문체
                                        </span>
                                    </div>
                                    <p className="text-xs text-gray-400 line-clamp-3 leading-relaxed">{style.description}</p>
                                    <div className="mt-3 text-[10px] text-gray-500 text-right">클릭하여 상세보기</div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {view === 'detail' && selectedStyle && (
                <div className="space-y-6">
                    <div className="flex items-center gap-2 mb-4">
                        <span className="text-xs px-2 py-1 rounded border bg-purple-900/30 border-purple-500/30 text-purple-400">
                            TYPE: 일반 (General)
                        </span>
                        <span className="text-xs text-gray-500">{new Date(selectedStyle.createdAt).toLocaleString()}</span>
                    </div>
                    
                    <div className="bg-black/30 p-4 rounded-lg border border-gray-700">
                        <h4 className="text-sm font-bold text-gray-300 mb-2">분석된 스타일 지침</h4>
                        <div className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed max-h-[50vh] overflow-y-auto custom-scrollbar">
                            {selectedStyle.description}
                        </div>
                    </div>
                    
                    <div className="flex justify-end">
                        <button onClick={() => { onDeleteStyle(selectedStyle.id); setView('list'); }} className="px-4 py-2 bg-red-900/20 border border-red-500/50 text-red-400 hover:bg-red-900/40 rounded-lg flex items-center gap-2 text-sm">
                            <Trash2 size={14} /> 이 문체 삭제
                        </button>
                    </div>
                </div>
            )}

            {view === 'create' && (
                <div className="space-y-6">
                    {/* ... (Create Form - Same as before) ... */}
                    <div><label className="text-xs font-bold text-gray-400 mb-1 block">문체 이름</label><input className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-white outline-none focus:border-purple-500" placeholder="예: 담백하고 건조한 느와르체" value={newStyleName} onChange={(e) => setNewStyleName(e.target.value)} /></div>
                    <div><label className="text-xs font-bold text-gray-400 mb-1 block">샘플 텍스트 업로드 (분석용)</label><div className="flex gap-2"><input type="file" ref={fileInputRef} className="hidden" accept=".txt" onChange={handleFileUpload} /><button onClick={() => fileInputRef.current?.click()} disabled={isAnalyzing} className="flex-1 py-3 bg-gray-800 hover:bg-gray-700 border border-dashed border-gray-600 rounded-lg text-gray-300 flex items-center justify-center gap-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"><Upload size={16} /> 텍스트 파일 선택 (.txt)</button></div></div>
                    <div><label className="text-xs font-bold text-gray-400 mb-1 block">문체 특징 (AI 분석 결과)</label><div className="relative"><textarea className="w-full h-40 bg-gray-900 border border-gray-700 rounded-lg p-3 text-sm text-gray-300 outline-none resize-none custom-scrollbar" placeholder="파일을 업로드하면 AI가 분석한 결과가 이곳에 표시됩니다." value={newStyleDesc} onChange={(e) => setNewStyleDesc(e.target.value)} />{isAnalyzing && (<div className="absolute inset-0 bg-black/50 flex items-center justify-center text-purple-400 gap-2 rounded-lg backdrop-blur-sm"><RefreshCcw className="animate-spin" /> 분석 중...</div>)}</div></div>
                </div>
            )}
        </div>

        <div className="p-4 border-t border-gray-800 bg-[#252525] rounded-b-xl flex justify-end gap-2">
            {view === 'create' ? (
                <>
                    <button onClick={() => setView('list')} className="px-4 py-2 text-gray-400 hover:text-white">취소</button>
                    <button onClick={handleSave} disabled={!newStyleName || !newStyleDesc} className="px-6 py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-gray-700 text-white rounded-lg font-bold">저장하기</button>
                </>
            ) : (
                <button onClick={onClose} className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg">닫기</button>
            )}
        </div>
      </div>
    </div>
  );
};

export default StyleManager;
