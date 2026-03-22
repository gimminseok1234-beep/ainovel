
import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface DeleteConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  message: string;
}

const DeleteConfirmDialog: React.FC<DeleteConfirmDialogProps> = ({ isOpen, onClose, onConfirm, message }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-gray-800 border border-gray-700 rounded-xl w-full max-w-sm shadow-2xl animate-in fade-in zoom-in duration-200">
        <div className="flex justify-between items-center p-4 border-b border-gray-700">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <AlertTriangle className="text-red-500" size={20} />
            삭제 확인
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X size={20} />
          </button>
        </div>
        
        <div className="p-6">
          <p className="text-gray-300 leading-relaxed">{message}</p>
        </div>

        <div className="p-4 bg-gray-900/50 border-t border-gray-700 flex justify-end gap-2 rounded-b-xl">
          <button 
            onClick={onClose}
            className="px-4 py-2 text-gray-300 hover:text-white hover:bg-gray-700 rounded-lg transition-colors text-sm"
          >
            취소
          </button>
          <button 
            onClick={onConfirm}
            className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white font-medium rounded-lg transition-colors shadow-lg shadow-red-500/20 text-sm"
          >
            삭제하기
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeleteConfirmDialog;
