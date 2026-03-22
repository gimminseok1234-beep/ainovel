import React, { useState } from 'react';
import { User } from '../services/firebase.ts'; // Type
import { LogIn, LogOut, User as UserIcon } from 'lucide-react';

interface UserMenuProps {
  user: User | null;
  onSignIn: () => void;
  onSignOut: () => void;
}

const UserMenu: React.FC<UserMenuProps> = ({ user, onSignIn, onSignOut }) => {
  const [isOpen, setIsOpen] = useState(false);

  if (!user) {
    return (
      <button 
        onClick={onSignIn}
        className="flex items-center gap-2 px-4 py-2 bg-white text-gray-900 rounded-full font-bold hover:bg-gray-100 transition-all shadow-lg hover:scale-105 active:scale-95 pointer-events-auto"
      >
        <img 
            src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" 
            alt="G" 
            className="w-5 h-5"
        />
        <span className="text-sm">로그인</span>
      </button>
    );
  }

  return (
    <div className="relative pointer-events-auto">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 p-1 pr-3 bg-gray-800/80 backdrop-blur border border-gray-700 rounded-full hover:bg-gray-700 transition-all shadow-lg group"
      >
        {user.photoURL ? (
            <img 
                src={user.photoURL} 
                alt={user.displayName || "User"} 
                className="w-8 h-8 rounded-full object-cover border-2 border-indigo-500"
            />
        ) : (
            <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white border-2 border-indigo-400">
                <UserIcon size={16} />
            </div>
        )}
        <span className="text-sm font-medium text-gray-200 max-w-[100px] truncate group-hover:text-white">
            {user.displayName || "사용자"}
        </span>
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-48 bg-gray-800 border border-gray-700 rounded-xl shadow-xl overflow-hidden z-50 animate-in fade-in zoom-in duration-200">
            <div className="p-3 border-b border-gray-700">
                <p className="text-xs text-gray-500">현재 계정</p>
                <p className="text-sm font-bold text-gray-200 truncate">{user.email}</p>
            </div>
            <button 
                onClick={() => {
                    onSignOut();
                    setIsOpen(false);
                }}
                className="w-full text-left px-4 py-3 text-sm text-red-400 hover:bg-gray-700/50 hover:text-red-300 flex items-center gap-2 transition-colors"
            >
                <LogOut size={16} /> 로그아웃
            </button>
        </div>
      )}
      
      {/* Backdrop to close */}
      {isOpen && (
        <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
      )}
    </div>
  );
};

export default UserMenu;