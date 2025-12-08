import { X, ChevronRight } from 'lucide-react';
import { MessageList } from './MessageList';
import { MessageComposer } from './MessageComposer';
import { MergeControls } from './MergeControls';
import { Message } from '../../types';

interface SubChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
  messages: Message[];
  parentMessageContent: string;
  onSendMessage: (message: string) => void;
  onMerge: () => void;
  onContinueWithoutMerge: () => void;
  isLoading?: boolean;
  isMerging?: boolean;
}

export function SubChatPanel({
  isOpen,
  onClose,
  messages,
  parentMessageContent,
  onSendMessage,
  onMerge,
  onContinueWithoutMerge,
  isLoading,
  isMerging,
}: SubChatPanelProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed md:relative inset-0 z-40 flex flex-col bg-white dark:bg-[#343541] md:w-1/2 md:border-l md:border-gray-200 md:dark:border-gray-700">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
          <span className="truncate max-w-[200px]">Main chat</span>
          <ChevronRight size={16} />
          <span className="font-medium text-gray-900 dark:text-white">Sub-chat</span>
        </div>
        <button
          onClick={onClose}
          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        >
          <X size={20} className="text-gray-600 dark:text-gray-400" />
        </button>
      </div>

      <div className="flex-shrink-0 px-4 py-3 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-200 dark:border-blue-800">
        <p className="text-sm text-blue-900 dark:text-blue-200 font-medium mb-1">
          Context from parent message:
        </p>
        <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-2">
          {parentMessageContent}
        </p>
      </div>

      <MessageList
        messages={messages}
        isLoading={isLoading}
      />

      {messages.length > 0 && !isMerging && (
        <MergeControls
          onMerge={onMerge}
          onContinueWithoutMerge={onContinueWithoutMerge}
        />
      )}

      {isMerging && (
        <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700">
          <div className="max-w-3xl mx-auto flex items-center gap-3">
            <div className="animate-spin rounded-full h-5 w-5 border-2 border-[#1a73e8] border-t-transparent"></div>
            <span className="text-sm text-gray-600 dark:text-gray-400">
              Merging sub-chat into main conversation...
            </span>
          </div>
        </div>
      )}

      {!isMerging && (
        <MessageComposer
          onSend={onSendMessage}
          disabled={isLoading}
          placeholder="Continue the discussion..."
        />
      )}
    </div>
  );
}
