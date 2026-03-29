import React, { useState } from 'react';
import { Project } from '../types.ts';
import { X, Save, FolderPlus, Lightbulb } from 'lucide-react';

interface SaveDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (title: string, projectId: string, category: 'manuscript' | 'synopsis') => void;
  projects: Project[];
  onCreateProject: (name: string) => string; // Returns new project ID
  category?: 'manuscript' | 'synopsis';
}

const SaveDialog: React.FC<SaveDialogProps> = ({ 
  isOpen, 
  onClose, 
  onSave, 
  projects, 
  onCreateProject,
  category = 'manuscript'
}) => {
  const [title, setTitle] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState(projects[0]?.id || '');
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');

  if (!isOpen) return null;

  const handleSave = () => {
    if (!title.trim()) return alert("제목을 입력해주세요.");
    if (!selectedProjectId && !newProjectName) return alert("프로젝트를 선택하거나 생성해주세요.");

    let targetProjectId = selectedProjectId;

    if (isCreatingProject) {
        if(!newProjectName.trim()) return alert("새 프로젝트 이름을 입력해주세요.");
        targetProjectId = onCreateProject(newProjectName);
    }

    onSave(title, targetProjectId, category);
    setTitle('');
    setNewProjectName('');
    setIsCreatingProject(false);
    onClose();
  };

  const isSynopsis = category === 'synopsis';

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gray-800 border border-gray-700 rounded-xl w-full max-w-md shadow-2xl animate-in fade-in zoom-in duration-200">
        <div className="flex justify-between items-center p-4 border-b border-gray-700">
          <h3 className={`text-lg font-bold flex items-center gap-2 ${isSynopsis ? 'text-cyan-400' : 'text-white'}`}>
            {isSynopsis ? <Lightbulb size={20} /> : <Save className="text-indigo-400" size={20} />}
            {isSynopsis ? '시놉시스 저장하기' : '원고 저장하기'}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
                {isSynopsis ? '시놉시스 제목' : '원고 제목'}
            </label>
            <input
              type="text"
              className={`w-full bg-gray-900 border rounded-lg p-3 text-gray-100 outline-none transition-colors ${isSynopsis ? 'border-gray-700 focus:border-cyan-500' : 'border-gray-700 focus:border-indigo-500'}`}
              placeholder={isSynopsis ? "예: 아이디어 스케치" : "예: 1화 - 각성"}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">저장할 프로젝트</label>
            
            {!isCreatingProject ? (
              <div className="flex gap-2">
                <select
                  className={`flex-1 bg-gray-900 border rounded-lg p-3 text-gray-100 outline-none ${isSynopsis ? 'border-gray-700 focus:border-cyan-500' : 'border-gray-700 focus:border-indigo-500'}`}
                  value={selectedProjectId}
                  onChange={(e) => setSelectedProjectId(e.target.value)}
                >
                  <option value="" disabled>프로젝트 선택</option>
                  {(Array.isArray(projects) ? projects : []).map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                <button 
                  onClick={() => setIsCreatingProject(true)}
                  className="bg-gray-700 hover:bg-gray-600 p-3 rounded-lg text-gray-200 transition-colors"
                  title="새 프로젝트 만들기"
                >
                  <FolderPlus size={20} />
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <input
                  type="text"
                  className={`flex-1 bg-gray-900 border rounded-lg p-3 text-gray-100 outline-none ${isSynopsis ? 'border-cyan-500' : 'border-indigo-500'}`}
                  placeholder="새 프로젝트 이름"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                />
                 <button 
                  onClick={() => setIsCreatingProject(false)}
                  className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg text-sm text-gray-200 transition-colors"
                >
                  취소
                </button>
              </div>
            )}
            {!isCreatingProject && projects.length === 0 && (
              <p className="text-xs text-yellow-500 mt-2">저장할 프로젝트를 먼저 생성해주세요.</p>
            )}
          </div>
        </div>

        <div className="p-4 bg-gray-900/50 border-t border-gray-700 flex justify-end gap-2 rounded-b-xl">
          <button 
            onClick={onClose}
            className="px-4 py-2 text-gray-300 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
          >
            취소
          </button>
          <button 
            onClick={handleSave}
            className={`px-6 py-2 text-white font-medium rounded-lg transition-colors shadow-lg flex items-center gap-2 ${isSynopsis ? 'bg-cyan-600 hover:bg-cyan-500 shadow-cyan-500/20' : 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-500/20'}`}
          >
            {isSynopsis ? <Lightbulb size={16} /> : <Save size={16} />}
            저장 완료
          </button>
        </div>
      </div>
    </div>
  );
};

export default SaveDialog;