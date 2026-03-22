import React, { useState, useRef, useEffect } from 'react';
import { Project } from '../types.ts';
import { MessageSquare, Send, X, Bot, User, Loader2 } from 'lucide-react';
import { generateProjectAssistantResponse } from '../services/geminiService.ts';
import ReactMarkdown from 'react-markdown';

interface ProjectAssistantProps {
  isOpen: boolean;
  onClose: () => void;
  projects: Project[];
}

interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

const ProjectAssistant: React.FC<ProjectAssistantProps> = ({ isOpen, onClose, projects }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'model', text: "안녕하세요! NovelCraft 어시스턴트입니다. 프로젝트의 세계관이나 캐릭터에 대해 무엇이든 물어보세요." }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  if (!isOpen) return null;

  const handleSend = async () => {
    if (!input.trim()) return;
    
    const userMsg = input;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setIsLoading(true);

    try {
      const response = await generateProjectAssistantResponse(
        userMsg,
        projects,
        selectedProjectId,
        messages
      );
      setMessages(prev => [...prev, { role: 'model', text: response }]);
    } catch (e) {
      setMessages(prev => [...prev, { role: 'model', text: "죄송합니다. 답변을 생성하는 중 오류가 발생했습니다." }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 w-[400px] h-[600px] bg-gray-900 border border-gray-700 rounded-xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-10 fade-in duration-300">
      {/* Header */}
      <div className="p-4 border-b border-gray-700 bg-gray-800 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Bot className="text-indigo-400" />
          <span className="font-bold text-white">집필 도우미 챗봇</span>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-white">
          <X size={20} />
        </button>
      </div>

      {/* Project Selector */}
      <div className="p-2 bg-gray-800/50 border-b border-gray-700">
        <select 
          className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1 text-sm text-gray-200 focus:ring-1 focus:ring-indigo-500 outline-none"
          value={selectedProjectId || ''}
          onChange={(e) => setSelectedProjectId(e.target.value || null)}
        >
          <option value="">(모든 프로젝트 참조)</option>
          {projects.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-gray-900">
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div 
              className={`max-w-[85%] rounded-lg p-3 text-sm leading-relaxed ${
                msg.role === 'user' 
                  ? 'bg-indigo-600 text-white rounded-br-none' 
                  : 'bg-gray-800 text-gray-200 rounded-bl-none'
              }`}
            >
              {msg.role === 'model' ? (
                <div className="prose prose-invert prose-sm max-w-none whitespace-pre-wrap">
                   <ReactMarkdown>{msg.text}</ReactMarkdown>
                </div>
              ) : (
                <div className="whitespace-pre-wrap">{msg.text}</div>
              )}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-800 rounded-lg p-3 rounded-bl-none text-indigo-400">
              <Loader2 className="animate-spin" size={20} />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 border-t border-gray-700 bg-gray-800/50">
        <div className="relative">
          <input
            type="text"
            className="w-full bg-gray-900 border border-gray-700 rounded-full pl-4 pr-12 py-2.5 text-sm text-white focus:ring-2 focus:ring-indigo-500 outline-none"
            placeholder="질문을 입력하세요..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          />
          <button 
            onClick={handleSend}
            disabled={isLoading || !input.trim()}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProjectAssistant;