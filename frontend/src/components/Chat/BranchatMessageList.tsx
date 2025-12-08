import { useEffect, useRef } from 'react';
import { BranchatMessageBubble } from './BranchatMessageBubble';
import { Message } from '../../types';
import { useAuth } from '../../contexts/AuthContext';

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

interface BranchatMessageListProps {
  messages: Message[];
  isLoading: boolean;
  onAskFollowUp: (messageId: string, selectedText?: string) => void;
  onOpenSubChat: (messageId: string, selectedText?: string) => void;
  onOpenExistingSubChat?: (subChatId: string) => void;
  onViewDetails?: (messageId: string) => void;
  subChatHistories?: SubChatHistory[];
}

export function BranchatMessageList({
  messages,
  isLoading,
  onAskFollowUp,
  onOpenSubChat,
  onOpenExistingSubChat,
  onViewDetails,
  subChatHistories = []
}: BranchatMessageListProps) {
  const { user } = useAuth();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (messages.length === 0 && !isLoading) {
    return (
      <div className="flex-1 flex justify-center bg-white dark:bg-[#1a1a1a]" style={{alignItems: 'center', paddingTop: '20vh'}}>
        <div className="text-center max-w-2xl mx-auto px-8">
          <h2 className="text-5xl font-normal text-gray-900 dark:text-gray-100 mb-4">
            Hello, {user?.name || user?.email?.split('@')[0] || 'there'}
          </h2>
          <p className="text-gray-600 dark:text-gray-400 text-lg">
            What can I help you with today?
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-4xl mx-auto px-4">
        {Array.isArray(messages) && messages.map((message, index) => (
          <BranchatMessageBubble
            key={message.id}
            message={message}
            onAskFollowUp={onAskFollowUp}
            onOpenSubChat={onOpenSubChat}
            onOpenExistingSubChat={onOpenExistingSubChat}
            onViewDetails={onViewDetails}
            isLast={index === messages.length - 1}
            subChatHistories={subChatHistories}
          />
        ))}

        {isLoading && (
          <div className="bg-white dark:bg-[#1a1a1a] py-6">
            <div className="max-w-4xl mx-auto px-4 flex gap-3">
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
                <div className="flex items-center gap-1 loading-dots">
                  <div className="w-2 h-2 bg-gray-500 dark:bg-gray-400 rounded-full dot"></div>
                  <div className="w-2 h-2 bg-gray-500 dark:bg-gray-400 rounded-full dot"></div>
                  <div className="w-2 h-2 bg-gray-500 dark:bg-gray-400 rounded-full dot"></div>
                </div>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>
    </div>
  );
}