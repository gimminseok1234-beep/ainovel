
import React, { useState } from 'react';
import { Project, SavedStory } from '../types.ts';
import { X, Trash2, RefreshCcw, FolderOpen, FileText, AlertTriangle, Lightbulb } from 'lucide-react';

interface TrashBinProps {
  isOpen: boolean;
  onClose: () => void;
  deletedProjects: Project[];
  deletedStories: SavedStory[];
  onRestoreProject: (id: string) => void;
  onRestoreStory: (id: string) => void;
  onHardDeleteProject: (id: string) => void;
  onHardDeleteStory: (id: string) => void;
}

const TrashBin: React.FC<TrashBinProps> = ({
  isOpen,
  onClose,
  deletedProjects,
  deletedStories,
  onRestoreProject,
  onRestoreStory,
  onHardDeleteProject,
  onHardDeleteStory
}) => {
  const [activeTab, setActiveTab] = useState<'projects' | 'stories'>('projects');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-[#1e1e1e] border border-gray-700 rounded-xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[80vh]">
        <div className="flex justify-between items-center p-5 border-b border-gray-800 bg-[#252525] rounded-t-xl">
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <Trash2 size={20} className="text-red-400" /> 휴지통
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X size={20} />
          </button>
        </div>

        <div className="flex border-b border-gray-800 bg-[#1c1c1c]">
          <button 
            onClick={() => setActiveTab('projects')}
            className={`flex-1 py-3 text-sm font-bold border-b-2 transition-colors flex items-center justify-center gap-2 ${activeTab === 'projects' ? 'border-indigo-500 text-white bg-[#252525]' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
          >
            <FolderOpen size={14} /> 삭제된 프로젝트 ({deletedProjects.length})
          </button>
          <button 
            onClick={() => setActiveTab('stories')}
            className={`flex-1 py-3 text-sm font-bold border-b-2 transition-colors flex items-center justify-center gap-2 ${activeTab === 'stories' ? 'border-indigo-500 text-white bg-[#252525]' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
          >
            <FileText size={14} /> 삭제된 원고/시놉시스 ({deletedStories.length})
          </button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 bg-[#121212]">
          {activeTab === 'projects' && (
            deletedProjects.length === 0 ? (
              <div className="text-center py-20 text-gray-500">휴지통이 비었습니다.</div>
            ) : (
              <div className="space-y-2">
                {(Array.isArray(deletedProjects) ? deletedProjects : []).map(p => (
                  <div key={p.id} className="flex items-center justify-between p-3 bg-[#1e1e1e] border border-gray-800 rounded-lg group hover:border-gray-600 transition-colors">
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-gray-200">{p.name}</span>
                      <span className="text-xs text-gray-500">삭제됨: {new Date(p.deletedAt || 0).toLocaleDateString()}</span>
                    </div>
                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => onRestoreProject(p.id)}
                        className="px-3 py-1.5 bg-indigo-900/30 text-indigo-400 hover:bg-indigo-900/50 hover:text-white rounded text-xs font-bold flex items-center gap-1 border border-indigo-500/30"
                      >
                        <RefreshCcw size={12}/> 복구
                      </button>
                      <button 
                        onClick={() => { if(confirm("정말로 영구 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.")) onHardDeleteProject(p.id); }}
                        className="px-3 py-1.5 bg-red-900/30 text-red-400 hover:bg-red-900/50 hover:text-white rounded text-xs font-bold flex items-center gap-1 border border-red-500/30"
                      >
                        <Trash2 size={12}/> 영구 삭제
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}

          {activeTab === 'stories' && (
            deletedStories.length === 0 ? (
              <div className="text-center py-20 text-gray-500">휴지통이 비었습니다.</div>
            ) : (
              <div className="space-y-2">
                {(Array.isArray(deletedStories) ? deletedStories : []).map(s => (
                  <div key={s.id} className="flex items-center justify-between p-3 bg-[#1e1e1e] border border-gray-800 rounded-lg group hover:border-gray-600 transition-colors">
                    <div className="flex items-center gap-3 overflow-hidden">
                      <div className={`p-2 rounded-lg shrink-0 ${s.category === 'synopsis' ? 'bg-cyan-900/30 text-cyan-400' : 'bg-indigo-900/30 text-indigo-400'}`}>
                          {s.category === 'synopsis' ? <Lightbulb size={16}/> : <FileText size={16}/>}
                      </div>
                      <div className="flex flex-col overflow-hidden">
                        <span className="text-sm font-bold text-gray-200 truncate">{s.title}</span>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                           <span className="uppercase text-[10px] border border-gray-700 px-1 rounded">{s.category === 'synopsis' ? '시놉시스' : '원고'}</span>
                           <span>삭제: {new Date(s.deletedAt || 0).toLocaleDateString()}</span>
                           <span>• {s.content.length.toLocaleString()}자</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => onRestoreStory(s.id)}
                        className="px-3 py-1.5 bg-indigo-900/30 text-indigo-400 hover:bg-indigo-900/50 hover:text-white rounded text-xs font-bold flex items-center gap-1 border border-indigo-500/30"
                      >
                        <RefreshCcw size={12}/> 복구
                      </button>
                      <button 
                        onClick={() => { if(confirm("정말로 영구 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.")) onHardDeleteStory(s.id); }}
                        className="px-3 py-1.5 bg-red-900/30 text-red-400 hover:bg-red-900/50 hover:text-white rounded text-xs font-bold flex items-center gap-1 border border-red-500/30"
                      >
                        <Trash2 size={12}/> 영구 삭제
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </div>
        
        <div className="p-4 bg-[#252525] border-t border-gray-800 rounded-b-xl">
            <div className="flex items-center gap-2 text-xs text-yellow-500 bg-yellow-900/10 p-2 rounded border border-yellow-500/20">
                <AlertTriangle size={14} />
                <span>영구 삭제된 항목은 복구할 수 없습니다. 신중하게 결정하세요.</span>
            </div>
        </div>
      </div>
    </div>
  );
};

export default TrashBin;
