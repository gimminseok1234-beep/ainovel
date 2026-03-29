


import React, { useState } from 'react';
import { AlignLeft, Eraser, Maximize2, Flame, Wand2, RefreshCw, Star } from 'lucide-react';
import { AiPreset } from '../types.ts';
import { DEFAULT_AI_PRESETS } from '../services/prompts.ts';

interface AiRefinePanelProps {
  currentText: string;
  onRefine: (instruction: string) => Promise<void>;
  isRefining: boolean;
  disabled?: boolean;
  className?: string;
  presets?: AiPreset[]; // Optional, falls back to defaults if not provided
}

const AiRefinePanel: React.FC<AiRefinePanelProps> = ({
  currentText,
  onRefine,
  isRefining,
  disabled = false,
  className = "",
  presets = DEFAULT_AI_PRESETS
}) => {
  const [instruction, setInstruction] = useState('');

  const handleRefineClick = async () => {
    if (!instruction.trim() || !currentText) return;
    await onRefine(instruction);
    alert("완료되었습니다.");
    setInstruction(''); 
  };

  const isDisabled = disabled || isRefining || !currentText;

  // Use passed presets or default if empty/undefined (though default is in props)
  const activePresets = presets && presets.length > 0 ? presets : DEFAULT_AI_PRESETS;

  // Helper to choose icon based on label or id keywords
  const getIcon = (item: AiPreset) => {
      const lower = (item.label + item.id).toLowerCase();
      if (lower.includes('가독성') || lower.includes('readability')) return <AlignLeft size={12} />;
      if (lower.includes('삭제') || lower.includes('erase') || lower.includes('remove')) return <Eraser size={12} />;
      if (lower.includes('늘리기') || lower.includes('expand') || lower.includes('분량')) return <Maximize2 size={12} />;
      if (lower.includes('수위') || lower.includes('19')) return <Flame size={12} />;
      return <Star size={12} />;
  };

  return (
    <div className={`space-y-3 ${className}`}>
      <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex justify-between items-center">
        AI 지시사항 (문장 수정)
        <span className="text-[10px] bg-gray-800 px-2 py-0.5 rounded text-gray-400">Custom Presets</span>
      </h4>

      <textarea
        className="w-full h-24 bg-[#252525] border border-gray-700 rounded-lg p-3 text-sm text-gray-200 outline-none resize-none focus:border-purple-500 custom-scrollbar placeholder-gray-600"
        placeholder="AI에게 수정 요청 (예: 묘사를 더 구체적으로...)"
        value={instruction}
        onChange={(e) => setInstruction(e.target.value)}
        disabled={disabled}
      />

      <div className="grid grid-cols-2 gap-2">
        {(Array.isArray(activePresets) ? activePresets : []).map((preset) => (
            <button
                key={preset.id}
                onClick={() => setInstruction(preset.prompt)}
                disabled={isDisabled}
                className="py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-[10px] flex items-center justify-center gap-1 border border-gray-700 transition-colors"
                title={preset.prompt}
            >
                {getIcon(preset)}
                <span className="truncate max-w-[100px]">{preset.label}</span>
            </button>
        ))}
      </div>

      <button
        onClick={handleRefineClick}
        disabled={isDisabled || !instruction.trim()}
        className="w-full py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg font-bold text-xs flex items-center justify-center gap-2 transition-all"
      >
        {isRefining ? <RefreshCw className="animate-spin" size={14} /> : <Wand2 size={14} />}
        수정 요청 실행
      </button>
    </div>
  );
};

export default AiRefinePanel;
