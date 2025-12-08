import { useState, useRef, useEffect, KeyboardEvent } from 'react';
import { Send } from 'lucide-react';

interface MessageComposerProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
  prefillText?: string;
}

export function MessageComposer({ onSend, disabled, placeholder = 'Send a message...', prefillText }: MessageComposerProps) {
  const [message, setMessage] = useState(prefillText || '');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (prefillText) {
      setMessage(prefillText);
    }
  }, [prefillText]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [message]);

  const handleSubmit = () => {
    if (message.trim() && !disabled) {
      onSend(message.trim());
      setMessage('');
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-[#343541] px-4 py-4">
      <div className="max-w-3xl mx-auto">
        <div className="relative flex items-end gap-3 bg-white dark:bg-[#40414f] border border-gray-300 dark:border-gray-600 rounded-xl shadow-sm focus-within:ring-1 focus-within:ring-[#1a73e8] focus-within:border-[#1a73e8]">
          <textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled}
            rows={1}
            className="flex-1 px-4 py-3 bg-transparent text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 resize-none focus:outline-none max-h-[200px] overflow-y-auto"
          />

          <button
            onClick={handleSubmit}
            disabled={disabled || !message.trim()}
            className="flex-shrink-0 mb-2 mr-2 p-2 rounded-lg bg-[#1a73e8] hover:bg-[#1557b0] disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:cursor-not-allowed text-white transition-colors"
          >
            <Send size={18} />
          </button>
        </div>

        <p className="text-xs text-center text-gray-500 dark:text-gray-400 mt-3">
          Press Enter to send, Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}
