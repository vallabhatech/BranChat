import { useState, useRef, useEffect } from 'react';
import { Copy, Check, MessageSquarePlus, GitBranch, ChevronDown, ChevronUp } from 'lucide-react';
import { Message } from '../../types';
import { MarkdownRenderer } from './MarkdownRenderer';
import { SubChatSummaryCard } from './SubChatSummaryCard';

interface SubChatHistory {
  id: string;
  parentMessageId: string;
  selectedText: string;
  summary: string;
  detailedSummary: string;
  questionCount: number;
  topics: string;
  mergedAt: string;
  messages?: Message[];
}

interface BranchatMessageBubbleProps {
  message: Message;
  onAskFollowUp: (messageId: string, selectedText?: string) => void;
  onOpenSubChat: (messageId: string, selectedText?: string) => void;
  onOpenExistingSubChat?: (subChatId: string) => void;
  onViewDetails?: (messageId: string) => void;
  isLast?: boolean;
  subChatHistories?: SubChatHistory[];
}

export function BranchatMessageBubble({
  message,
  onAskFollowUp,
  onOpenSubChat,
  onOpenExistingSubChat,
  onViewDetails,
  isLast = false,
  subChatHistories = []
}: BranchatMessageBubbleProps) {
  const [copied, setCopied] = useState(false);
  const [selectedText, setSelectedText] = useState('');
  const [showTextActions, setShowTextActions] = useState(false);
  const [actionPosition, setActionPosition] = useState({ x: 0, y: 0 });
  const [isCollapsed, setIsCollapsed] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const actionsRef = useRef<HTMLDivElement>(null);

  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';
  const isSummary = message.is_summary;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (actionsRef.current && !actionsRef.current.contains(event.target as Node)) {
        setShowTextActions(false);
      }
    };

    const handleSelectionChange = () => {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) {
        setShowTextActions(false);
        return;
      }

      const range = selection.getRangeAt(0);
      const selectedText = selection.toString().trim();

      // Check if selection is within this message content
      if (contentRef.current && contentRef.current.contains(range.commonAncestorContainer)) {
        if (selectedText.length > 0) {
          setSelectedText(selectedText);

          // Position popup right next to the selected text
          const rect = range.getBoundingClientRect();
          const popupWidth = 192; // w-48 = 192px
          
          // Position at the center of selection, just below it
          let x = rect.left + (rect.width / 2) - (popupWidth / 2); // Center popup on selection
          let y = rect.bottom + window.scrollY + 3; // Just 3px below selection
          
          // Simple boundary checks - keep popup on screen
          if (x < 5) {
            x = 5;
          } else if (x + popupWidth > window.innerWidth - 5) {
            x = window.innerWidth - popupWidth - 5;
          }
          
          // If selection is near bottom, show popup above
          if (rect.bottom > window.innerHeight - 100) {
            y = rect.top + window.scrollY - 85; // Show above selection
          }

          setActionPosition({ x, y });
          setShowTextActions(true);
        } else {
          setShowTextActions(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('selectionchange', handleSelectionChange);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('selectionchange', handleSelectionChange);
    };
  }, []);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleAskFollowUp = () => {
    onAskFollowUp(message.id, selectedText);
    setShowTextActions(false);
    // Clear selection
    window.getSelection()?.removeAllRanges();
  };

  const handleOpenSubChat = () => {
    onOpenSubChat(message.id, selectedText);
    setShowTextActions(false);
    // Clear selection
    window.getSelection()?.removeAllRanges();
  };

  const shouldShowCollapse = message.content.length > 1000;
  const displayContent = shouldShowCollapse && isCollapsed
    ? message.content.substring(0, 500) + '...'
    : message.content;



  if (isSystem) {
    return (
      <div className="py-2 px-4">
        <div className="max-w-3xl mx-auto">
          <div className="text-center text-sm text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 rounded-lg px-3 py-2">
            {message.content}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`group relative ${isLast ? 'pb-8' : ''} transition-colors`}
    >
      <div className="py-6">
        {isUser ? (
          // User message layout - right aligned
          <div className="flex justify-end px-4">
            <div className="max-w-[min(42rem,calc(100vw-8rem))]">
              {/* Content */}
              <div className="bg-gray-100 dark:bg-gray-700 rounded-2xl px-4 py-3 text-gray-900 dark:text-gray-100 leading-7 break-words">
                <span className="whitespace-pre-wrap">{displayContent}</span>
              </div>
            </div>
          </div>
        ) : (
          // AI message layout - left aligned
          <div className="max-w-4xl mx-auto px-4">
            <div className="flex gap-3">
              {/* branchat Icon */}
              <div className="flex-shrink-0 mt-1">
                <div className="w-6 h-6 flex items-center justify-center">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-blue-500">
                    <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M2 17L12 22L22 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M2 12L12 17L22 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="prose dark:prose-invert max-w-none bg-white dark:bg-[#1a1a1a]">
                  {isSummary ? (
                    <div className="space-y-3">
                      <div ref={contentRef} className="text-gray-900 dark:text-gray-100 leading-7">
                        <MarkdownRenderer content={displayContent} />
                      </div>
                      {message.summary_details && onViewDetails && (
                        <button
                          onClick={() => onViewDetails(message.id)}
                          className="text-sm text-[#1a73e8] hover:text-[#1557b0] underline transition-colors"
                        >
                          View details
                        </button>
                      )}
                    </div>
                  ) : (
                    <div
                      ref={contentRef}
                      className="text-gray-900 dark:text-gray-100 leading-7"
                    >
                      {isUser ? (
                        <span className="whitespace-pre-wrap">{displayContent}</span>
                      ) : (
                        <MarkdownRenderer content={displayContent} />
                      )}
                    </div>
                  )}

                  {shouldShowCollapse && (
                    <button
                      onClick={() => setIsCollapsed(!isCollapsed)}
                      className="flex items-center gap-1 mt-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
                    >
                      {isCollapsed ? (
                        <>
                          <ChevronDown size={14} />
                          Show more
                        </>
                      ) : (
                        <>
                          <ChevronUp size={14} />
                          Show less
                        </>
                      )}
                    </button>
                  )}

                  {/* SubChat Summary Cards */}
                  {subChatHistories
                    .filter(history => history.parentMessageId === message.id)
                    .map(history => (
                      <SubChatSummaryCard
                        key={history.id}
                        subChatId={history.id}
                        summary={history.summary}
                        selectedText={history.selectedText}
                        questionCount={history.questionCount}
                        mergedAt={history.mergedAt}
                        onClick={(subChatId) => onOpenExistingSubChat?.(subChatId)}
                      />
                    ))}
                </div>
              </div>

              {/* Actions - branchat style */}
              <div className="flex-shrink-0 flex items-start gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 hover:opacity-100">
                <button
                  onClick={handleCopy}
                  className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-300 dark:focus:ring-gray-500"
                  title="Copy message"
                  aria-label="Copy message to clipboard"
                >
                  {copied ? (
                    <Check size={16} className="text-green-600 dark:text-green-400" />
                  ) : (
                    <Copy size={16} className="text-gray-500 dark:text-gray-400" />
                  )}
                </button>
                <button
                  onClick={() => onOpenSubChat(message.id)}
                  className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-300 dark:focus:ring-gray-500"
                  title="Open SubChat"
                  aria-label="Open SubChat for this message"
                >
                  <GitBranch size={16} className="text-gray-500 dark:text-gray-400" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Text Selection Actions */}
      {showTextActions && !isUser && (
        <div
          ref={actionsRef}
          className="fixed bg-white dark:bg-[#2f2f2f] border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg z-50 py-1 animate-in fade-in-0 zoom-in-95 duration-200 min-w-[180px]"
          style={{
            left: `${actionPosition.x}px`,
            top: `${actionPosition.y + 5}px`
          }}
        >
          <button
            onClick={handleAskFollowUp}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors text-left whitespace-nowrap rounded-md"
            title="Ask a follow-up question about the selected text"
          >
            <MessageSquarePlus size={14} className="flex-shrink-0" />
            <span className="truncate">Ask follow-up</span>
          </button>
          <button
            onClick={handleOpenSubChat}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors text-left whitespace-nowrap rounded-md"
            title="Create a sub-chat about the selected text"
          >
            <GitBranch size={14} className="flex-shrink-0" />
            <span className="truncate">Create sub chat</span>
          </button>
        </div>
      )}
    </div>
  );
}