
import React, { useState } from 'react';
import { X } from 'lucide-react';

interface InputDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (value: string) => void;
  title: string;
  placeholder?: string;
  confirmText?: string;
}

const InputDialog: React.FC<InputDialogProps> = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title, 
  placeholder, 
  confirmText = "확인" 
}) => {
  const [value, setValue] = useState('');

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (value.trim()) {
      onConfirm(value);
      setValue('');
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-gray-800 border border-gray-700 rounded-xl w-full max-w-sm shadow-2xl animate-in fade-in zoom-in duration-200">
        <div className="flex justify-between items-center p-4 border-b border-gray-700">
          <h3 className="text-lg font-bold text-white">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X size={20} />
          </button>
        </div>
        
        <div className="p-6">
          <input
            autoFocus
            type="text"
            className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-gray-100 outline-none focus:border-indigo-500 transition-colors"
            placeholder={placeholder}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleConfirm()}
          />
        </div>

        <div className="p-4 bg-gray-900/50 border-t border-gray-700 flex justify-end gap-2 rounded-b-xl">
          <button 
            onClick={onClose}
            className="px-4 py-2 text-gray-300 hover:text-white hover:bg-gray-700 rounded-lg transition-colors text-sm"
          >
            취소
          </button>
          <button 
            onClick={handleConfirm}
            disabled={!value.trim()}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-medium rounded-lg transition-colors shadow-lg shadow-indigo-500/20 text-sm"
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default InputDialog;
