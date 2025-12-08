import { useEffect, useState } from 'react';
import { Plus, MessageSquare, LogOut, Sun, Moon } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { supabase } from '../../lib/supabase';
import { Conversation } from '../../types';

interface SidebarProps {
  onClose?: () => void;
  onNewChat?: () => void;
  currentConversationId?: string;
  onSelectConversation?: (id: string) => void;
}

export function Sidebar({ onNewChat, currentConversationId, onSelectConversation }: SidebarProps) {
  const { signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [conversations, setConversations] = useState<Conversation[]>([]);

  useEffect(() => {
    loadConversations();
  }, []);

  const loadConversations = async () => {
    const { data, error } = await supabase
      .from('conversations')
      .select('*')
      .is('parent_conversation_id', null)
      .order('updated_at', { ascending: false });

    if (!error && data) {
      setConversations(data);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#202123] dark:bg-[#202123] text-white">
      <div className="p-2">
        <button
          onClick={onNewChat}
          className="flex items-center gap-3 w-full px-3 py-3 rounded-md border border-white/20 hover:bg-white/5 transition-colors"
        >
          <Plus size={18} />
          <span className="text-sm font-medium">New chat</span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-2">
        <div className="space-y-1 py-2">
          {conversations.map((conversation) => (
            <button
              key={conversation.id}
              onClick={() => onSelectConversation?.(conversation.id)}
              className={`flex items-center gap-3 w-full px-3 py-3 rounded-md text-left hover:bg-white/5 transition-colors ${
                currentConversationId === conversation.id ? 'bg-white/10' : ''
              }`}
            >
              <MessageSquare size={18} />
              <span className="text-sm truncate">{conversation.title}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="border-t border-white/20 p-2 space-y-1">
        <button
          onClick={toggleTheme}
          className="flex items-center gap-3 w-full px-3 py-3 rounded-md hover:bg-white/5 transition-colors"
        >
          {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
          <span className="text-sm">{theme === 'light' ? 'Dark mode' : 'Light mode'}</span>
        </button>

        <button
          onClick={signOut}
          className="flex items-center gap-3 w-full px-3 py-3 rounded-md hover:bg-white/5 transition-colors"
        >
          <LogOut size={18} />
          <span className="text-sm">Sign out</span>
        </button>
      </div>
    </div>
  );
}
