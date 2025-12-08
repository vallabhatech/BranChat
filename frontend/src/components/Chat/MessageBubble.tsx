import { useState } from 'react';
import { Copy, Check, MoreVertical, GitBranch } from 'lucide-react';
import { Message } from '../../types';

interface MessageBubbleProps {
  message: Message;
  onOpenSubChat?: (messageId: string) => void;
  onAskFollowUp?: (messageId: string) => void;
}

export function MessageBubble({ message, onOpenSubChat, onAskFollowUp }: MessageBubbleProps) {
  const [copied, setCopied] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isUser = message.role === 'user';

  return (
    <div
      className={`group relative py-6 px-4 ${
        isUser ? 'bg-white dark:bg-[#343541]' : 'bg-gray-50 dark:bg-[#444654]'
      }`}
      onMouseEnter={() => setShowMenu(true)}
      onMouseLeave={() => setShowMenu(false)}
    >
      <div className="max-w-3xl mx-auto">
        {isUser ? (
          // User message - right aligned, no label
          <div className="flex justify-end">
            <div className="max-w-[min(42rem,calc(100vw-8rem))]">
              <div className="prose dark:prose-invert max-w-none">
                <p className="text-gray-900 dark:text-gray-100 whitespace-pre-wrap leading-7">
                  {message.content}
                </p>
              </div>
            </div>
          </div>
        ) : (
          // AI message - left aligned with icon
          <div className="flex gap-3">
            <div className="flex-shrink-0 mt-1">
              <div className="w-6 h-6 flex items-center justify-center">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-blue-500">
                  <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M2 17L12 22L22 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M2 12L12 17L22 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="prose dark:prose-invert max-w-none">
                <p className="text-gray-900 dark:text-gray-100 whitespace-pre-wrap leading-7">
                  {message.content}
                </p>
              </div>

              {message.is_summary && message.summary_details && (
                <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md">
                  <p className="text-sm text-blue-900 dark:text-blue-200">
                    Summary of sub-chat discussion
                  </p>
                  {message.summary_details.summary_preview && (
                    <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">
                      {message.summary_details.summary_preview}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {showMenu && !isUser && (
          <div className="flex-shrink-0 flex items-start gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={handleCopy}
              className="p-1.5 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              title="Copy"
            >
              {copied ? (
                <Check size={16} className="text-green-600 dark:text-green-400" />
              ) : (
                <Copy size={16} className="text-gray-600 dark:text-gray-400" />
              )}
            </button>

            <div className="relative">
              <button
                className="p-1.5 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                title="More"
              >
                <MoreVertical size={16} className="text-gray-600 dark:text-gray-400" />
              </button>
            </div>

            <button
              onClick={() => onOpenSubChat?.(message.id)}
              className="p-1.5 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              title="Open sub-chat"
            >
              <GitBranch size={16} className="text-gray-600 dark:text-gray-400" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
