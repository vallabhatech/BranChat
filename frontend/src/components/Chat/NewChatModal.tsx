import { useState, useEffect } from 'react';
import { X, Sparkles, FileText, Info } from 'lucide-react';

interface NewChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateChat: (usePreviousKnowledge: boolean) => void;
  isKnowledgeToggle?: boolean;
  hasConversationHistory?: boolean;
}

export function NewChatModal({ isOpen, onClose, onCreateChat, isKnowledgeToggle = false, hasConversationHistory = false }: NewChatModalProps) {
  const [selected, setSelected] = useState<'knowledge' | 'fresh' | null>(null);
  const [showTooltip, setShowTooltip] = useState<string | null>(null);

  // No longer auto-select based on conversation history - let users choose
  useEffect(() => {
    console.log('🔄 NewChatModal: hasConversationHistory changed to:', hasConversationHistory);
    console.log('🔄 NewChatModal: Both options always enabled - no auto-selection');
    // Reset selection when modal opens so users can choose
    setSelected(null);
  }, [hasConversationHistory]);

  if (!isOpen) return null;

  // Debug log when modal opens
  console.log('🔍 NewChatModal opened with:', { 
    hasConversationHistory, 
    selected, 
    isKnowledgeToggle 
  });

  const handleOptionSelect = (option: 'knowledge' | 'fresh') => {
    setSelected(option);
    // Automatically create chat when option is selected
    onCreateChat(option === 'knowledge');
    onClose();
    setSelected(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white dark:bg-[#2f2f2f] rounded-lg shadow-xl max-w-md w-full animate-in fade-in-0 zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-600">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Start a new chat
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
          >
            <X size={16} className="text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        <div className="p-4">
          <p className="text-gray-600 dark:text-gray-400 mb-4 text-sm">
            Choose how you want to start your conversation. Selecting an option will immediately create your new chat.
          </p>

          <div className="space-y-3 mb-4">
            {/* Use previous knowledge option - Always enabled */}
            <div className="relative">
              <button
                onClick={() => handleOptionSelect('knowledge')}
                className={`w-full p-3 rounded-lg border text-left transition-all ${
                  selected === 'knowledge'
                    ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                    : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 p-1.5 rounded bg-purple-100 dark:bg-purple-900/30">
                    <Sparkles size={16} className="text-purple-600 dark:text-purple-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                        Use previous knowledge
                      </h3>
                      <button
                        onMouseEnter={() => setShowTooltip('knowledge')}
                        onMouseLeave={() => setShowTooltip(null)}
                        className="p-0.5 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                      >
                        <Info size={12} className="text-gray-500 dark:text-gray-400" />
                      </button>
                    </div>
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      {hasConversationHistory 
                        ? "Access to all your previous conversation histories"
                        : "I'll learn from this conversation for future chats"
                      }
                    </p>
                  </div>
                </div>
              </button>

              {/* Tooltip */}
              {showTooltip === 'knowledge' && (
                <div className="absolute top-full left-4 mt-1 w-56 p-2 bg-gray-900 dark:bg-gray-700 text-white text-xs rounded shadow-lg z-10">
                  {hasConversationHistory 
                    ? "I'll have access to all your previous conversations and can reference past discussions, build upon previous learning, and provide personalized responses."
                    : "Even though you don't have previous conversations yet, I'll remember this conversation and use it to provide better responses in future chats."
                  }
                  <div className="absolute -top-1 left-4 w-2 h-2 bg-gray-900 dark:bg-gray-700 rotate-45"></div>
                </div>
              )}
            </div>

            {/* Start fresh option */}
            <div className="relative">
              <button
                onClick={() => handleOptionSelect('fresh')}
                className={`w-full p-3 rounded-lg border text-left transition-all ${
                  selected === 'fresh'
                    ? 'border-[#1a73e8] bg-[#1a73e8]/5 dark:bg-[#1a73e8]/10'
                    : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 p-1.5 rounded bg-blue-100 dark:bg-blue-900/30">
                    <FileText size={16} className="text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                        Start fresh
                      </h3>
                      <button
                        onMouseEnter={() => setShowTooltip('fresh')}
                        onMouseLeave={() => setShowTooltip(null)}
                        className="p-0.5 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                      >
                        <Info size={12} className="text-gray-500 dark:text-gray-400" />
                      </button>
                    </div>
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      Treat this chat as a completely new task
                    </p>
                  </div>
                </div>
              </button>

              {/* Tooltip */}
              {showTooltip === 'fresh' && (
                <div className="absolute top-full left-4 mt-1 w-56 p-2 bg-gray-900 dark:bg-gray-700 text-white text-xs rounded shadow-lg z-10">
                  Start with a clean slate. I won't reference any previous conversations or context.
                  <div className="absolute -top-1 left-4 w-2 h-2 bg-gray-900 dark:bg-gray-700 rotate-45"></div>
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-center pt-3 border-t border-gray-200 dark:border-gray-600">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
