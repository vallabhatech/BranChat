import { useState, useRef, useEffect } from 'react';
import { Send, Paperclip, X, Quote } from 'lucide-react';

interface BranchatComposerProps {
  onSend: (message: string) => void;
  onSearch?: (query: string) => Promise<string>;
  disabled?: boolean;
  placeholder?: string;
  initialValue?: string;
  isSearchMode?: boolean;
  autoSend?: boolean;
  onAutoSendComplete?: () => void;
  selectedContext?: string;
  onClearContext?: () => void;
  onFocus?: () => void;
}

export function BranchatComposer({ 
  onSend, 
  onSearch,
  disabled = false, 
  placeholder = "Ask branchat",
  initialValue = "",
  isSearchMode = false,
  autoSend = false,
  onAutoSendComplete,
  selectedContext,
  onClearContext,
  onFocus
}: BranchatComposerProps) {
  const [message, setMessage] = useState(initialValue);
  const [isSearching, setIsSearching] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (initialValue) {
      // If there's selected context, extract just the question part
      if (selectedContext && initialValue.includes('Question: ')) {
        const questionPart = initialValue.split('Question: ')[1] || '';
        setMessage(questionPart);
      } else {
        setMessage(initialValue);
      }
      
      // Focus and position cursor at end
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          const messageLength = selectedContext && initialValue.includes('Question: ') 
            ? (initialValue.split('Question: ')[1] || '').length
            : initialValue.length;
          textareaRef.current.setSelectionRange(messageLength, messageLength);
        }
        
        // Auto-send if requested
        if (autoSend && initialValue.trim()) {
          setTimeout(() => {
            if (isSearchMode && onSearch) {
              setIsSearching(true);
              onSearch(initialValue.trim())
                .then(() => {
                  setMessage('');
                  onAutoSendComplete?.();
                })
                .catch((error) => {
                  console.error('Auto-search error:', error);
                  onAutoSendComplete?.();
                })
                .finally(() => {
                  setIsSearching(false);
                });
            } else {
              onSend(initialValue.trim());
              setMessage('');
              onAutoSendComplete?.();
            }
          }, 500); // Small delay for better UX
        }
      }, 100);
    }
  }, [initialValue, autoSend, isSearchMode, onSearch, onSend, onAutoSendComplete, selectedContext]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + 'px';
    }
  }, [message]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim() && !disabled && !isSearching) {
      // Combine selected context with user's message if context exists
      const fullMessage = selectedContext 
        ? `Regarding: "${selectedContext}"\n\nQuestion: ${message.trim()}`
        : message.trim();
        
      if (isSearchMode && onSearch) {
        // Handle search mode
        setIsSearching(true);
        try {
          await onSearch(fullMessage);
          setMessage('');
          onClearContext?.();
        } catch (error) {
          console.error('Search error:', error);
        } finally {
          setIsSearching(false);
        }
      } else {
        // Handle regular message sending
        onSend(fullMessage);
        setMessage('');
        onClearContext?.();
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const canSend = message.trim().length > 0 && !disabled && !isSearching;

  return (
    <div className="p-6 bg-white dark:bg-[#1a1a1a]">
      <div className="max-w-3xl mx-auto">
        {/* Selected Context Display */}
        {selectedContext && (
          <div className="mb-3 bg-gray-50 dark:bg-[#2a2a2a] border border-gray-200 dark:border-gray-600 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <Quote size={16} className="text-gray-500 dark:text-gray-400 mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Selected text:</div>
                <div className="text-sm text-gray-800 dark:text-gray-200 italic">
                  "{(() => {
                    const lines = selectedContext.split('\n');
                    if (lines.length <= 2) {
                      return selectedContext;
                    }
                    return lines.slice(0, 2).join('\n') + '...';
                  })()}"
                </div>
              </div>
              <button
                type="button"
                onClick={onClearContext}
                className="p-1 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors flex-shrink-0"
                title="Clear selected text"
              >
                <X size={14} />
              </button>
            </div>
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="relative">
          <div className="flex items-end bg-gray-50 dark:bg-[#2a2a2a] border border-gray-200 dark:border-gray-600 rounded-3xl shadow-sm focus-within:shadow-lg focus-within:border-gray-300 dark:focus-within:border-gray-500 transition-all">
            {/* Attachment button */}
            <button
              type="button"
              className="flex-shrink-0 p-5 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              disabled={disabled}
            >
              <Paperclip size={22} />
            </button>

            {/* Text input */}
            <textarea
              ref={textareaRef}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={onFocus}
              placeholder={placeholder}
              disabled={disabled}
              rows={1}
              className="flex-1 resize-none bg-transparent border-0 outline-none py-5 pr-2 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 text-lg leading-6 max-h-[200px] overflow-y-auto scrollbar-thin"
              style={{ minHeight: '32px' }}
            />

            {/* Send button */}
            <button
              type="submit"
              disabled={!canSend}
              className={`flex-shrink-0 p-4 m-2 rounded-full transition-all ${
                canSend
                  ? 'bg-[#1a73e8] hover:bg-[#1557b0] text-white shadow-md hover:shadow-lg'
                  : 'bg-gray-200 dark:bg-gray-600 text-gray-400 dark:text-gray-500 cursor-not-allowed'
              }`}
            >
              {isSearching ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Send size={20} />
              )}
            </button>
          </div>

          {/* Footer text */}
          <div className="text-xs text-gray-500 dark:text-gray-400 text-center mt-3">
            branchat can make mistakes. Check important info.
          </div>
        </form>
      </div>
    </div>
  );
}