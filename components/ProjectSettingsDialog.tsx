import React, { useState, useEffect, useRef } from 'react';
import { Project } from '../types.ts';
import { X, Save, Upload } from 'lucide-react';

interface ProjectSettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  project: Project | null;
  onSave: (updatedProject: Project) => void;
}

const ProjectSettingsDialog: React.FC<ProjectSettingsDialogProps> = ({ isOpen, onClose, project, onSave }) => {
  const [name, setName] = useState('');
  const [worldview, setWorldview] = useState('');
  const [characters, setCharacters] = useState('');
  
  const worldviewFileRef = useRef<HTMLInputElement>(null);
  const charFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (project) {
      setName(project.name);
      setWorldview(project.worldview || '');
      setCharacters(project.characters || '');
    }
  }, [project]);

  if (!isOpen || !project) return null;

  const handleSave = () => {
    onSave({
      ...project,
      name,
      worldview,
      characters
    });
    onClose();
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, setter: React.Dispatch<React.SetStateAction<string>>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setter(prev => prev + (prev ? '\n\n' : '') + text);
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex justify-between items-center p-5 border-b border-gray-800">
          <h3 className="text-xl font-bold text-white">프로젝트 설정</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 overflow-y-auto custom-scrollbar">
          
          {/* Project Name */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">프로젝트 이름</label>
            <input
              type="text"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-gray-100 outline-none focus:ring-2 focus:ring-indigo-500"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          {/* Worldview */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-sm font-medium text-gray-300">세계관 설정 (Worldview)</label>
              <button 
                onClick={() => worldviewFileRef.current?.click()}
                className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 px-2 py-1 rounded hover:bg-gray-800 transition-colors"
              >
                <Upload size={14} /> 파일 불러오기
              </button>
              <input type="file" ref={worldviewFileRef} className="hidden" accept=".txt" onChange={(e) => handleFileUpload(e, setWorldview)} />
            </div>
            <textarea
              className="w-full h-40 bg-gray-800 border border-gray-700 rounded-lg p-3 text-sm text-gray-300 outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              placeholder="이 세계의 역사, 마법 체계, 지리, 사회 구조 등을 입력하세요. AI가 이 설정을 반영하여 소설을 작성합니다."
              value={worldview}
              onChange={(e) => setWorldview(e.target.value)}
            />
          </div>

          {/* Characters */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-sm font-medium text-gray-300">등장인물 설정 (Characters)</label>
              <button 
                onClick={() => charFileRef.current?.click()}
                className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 px-2 py-1 rounded hover:bg-gray-800 transition-colors"
              >
                <Upload size={14} /> 파일 불러오기
              </button>
              <input type="file" ref={charFileRef} className="hidden" accept=".txt" onChange={(e) => handleFileUpload(e, setCharacters)} />
            </div>
            <textarea
              className="w-full h-40 bg-gray-800 border border-gray-700 rounded-lg p-3 text-sm text-gray-300 outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              placeholder="주요 등장인물의 이름, 성격, 외모, 관계 등을 입력하세요."
              value={characters}
              onChange={(e) => setCharacters(e.target.value)}
            />
          </div>

        </div>

        {/* Footer */}
        <div className="p-5 border-t border-gray-800 bg-gray-900 rounded-b-xl flex justify-end gap-3">
          <button 
            onClick={onClose}
            className="px-5 py-2.5 text-gray-300 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
          >
            취소
          </button>
          <button 
            onClick={handleSave}
            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg transition-colors shadow-lg shadow-indigo-500/20 flex items-center gap-2"
          >
            <Save size={18} />
            설정 저장
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProjectSettingsDialog;