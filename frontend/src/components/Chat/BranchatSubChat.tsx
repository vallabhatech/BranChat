import { useState, useEffect } from 'react';
import { ArrowLeft, ChevronRight, Eye, CheckCircle, RotateCcw } from 'lucide-react';
import { BranchatMessageList } from './BranchatMessageList';
import { BranchatComposer } from './BranchatComposer';
import { Message } from '../../types';

interface BranchatSubChatProps {
  isOpen: boolean;
  onClose: () => void;
  messages: Message[];
  parentMessageContent: string;
  parentMessageId: string;
  selectedText?: string;
  onSendMessage: (content: string) => void;
  onMerge: () => void;
  onContinueWithoutMerge: () => void;
  onContinueChat?: () => void;
  isLoading: boolean;
  isMerging: boolean;
  isReadOnly?: boolean;
  mergedSummary?: string;
}

export function BranchatSubChat({
  isOpen,
  onClose,
  messages,
  parentMessageContent,
  parentMessageId,
  selectedText,
  onSendMessage,
  onMerge,
  onContinueWithoutMerge,
  onContinueChat,
  isLoading,
  isMerging,
  isReadOnly = false,
  mergedSummary
}: BranchatSubChatProps) {
  const [subChatTitle, setSubChatTitle] = useState('SubChat');
  const [showFullContext, setShowFullContext] = useState(false);
  const [followUpText, setFollowUpText] = useState('');
  const [selectedContext, setSelectedContext] = useState('');
  // Remove auto-summary generation - summary will be generated only when merging

  useEffect(() => {
    // Auto-generate title from parent message
    const words = parentMessageContent.split(' ').slice(0, 3);
    const title = words.join(' ') + (words.length < parentMessageContent.split(' ').length ? '...' : '');
    setSubChatTitle(`Clarify: ${title}`);
  }, [parentMessageContent]);

  // Remove automatic merge options - only show when user explicitly requests

  if (!isOpen) return null;

  // Handle follow-up by pre-filling the composer with selected text
  const handleAskFollowUp = (messageId: string, selectedText?: string) => {
    if (selectedText) {
      // Set the selected text as context and clear the input for user's question
      setSelectedContext(selectedText);
      setFollowUpText('');
    } else {
      const message = messages.find(m => m.id === messageId);
      if (message) {
        // Prefill composer with follow-up context
        setFollowUpText('Follow-up: ');
        setSelectedContext('');
      }
    }
  };

  const handleClearContext = () => {
    setSelectedContext('');
    setFollowUpText('');
  };

  const handleOpenSubChat = () => {
    // Sub-chats within sub-chats could be supported but keeping it simple for now
  };

  const handleMergeClick = () => {
    onMerge();
  };

  const handleContinueWithoutMergeClick = () => {
    onContinueWithoutMerge();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
      {/* Backdrop overlay */}
      <div 
        className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-300"
        onClick={onClose}
      />
      
      {/* SubChat Panel - Professional Card Design */}
      <div className="relative w-full max-w-5xl h-[90vh] bg-white dark:bg-gray-900 rounded-2xl shadow-2xl transform transition-all duration-300 ease-out scale-100 border border-gray-200 dark:border-gray-700" 
           style={{
             boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.05)'
           }}>
        <div className="flex flex-col h-full rounded-2xl overflow-hidden">
          {/* Header with breadcrumb - Professional */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 rounded-t-2xl">
            <div className="flex items-center gap-3">
              <button
                onClick={onClose}
                className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-gray-700 dark:text-gray-300 text-sm font-medium"
                title="Back to main chat"
              >
                <ArrowLeft size={16} />
                <span>Back to Chat</span>
              </button>
              <ChevronRight size={16} className="text-gray-400 dark:text-gray-500" />
              <div className="flex items-center gap-3">
                <h2 className="text-gray-900 dark:text-white font-semibold text-lg">
                  {subChatTitle}
                </h2>
                {isReadOnly && (
                  <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-medium rounded-full">
                    Read-only
                  </span>
                )}
              </div>
            </div>

            {/* SubChat badge */}
            <div className="flex items-center gap-3">
              <div className="px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg shadow-sm">
                SubChat
              </div>
              <span className="text-sm text-gray-500 dark:text-gray-400 font-mono">
                #{parentMessageId.slice(-6)}
              </span>
            </div>
          </div>

          {/* Messages - Professional styling with scrollable context */}
          <div className="flex-1 overflow-y-auto relative">
            <div className="relative h-full overflow-y-auto bg-white dark:bg-gray-900">
              {/* Context Banner - Now scrollable with content */}
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-blue-50 dark:bg-blue-900/10">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Selected Text - Left Side */}
                  {selectedText && (
                    <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-600 shadow-sm">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                        <span className="text-sm font-semibold text-blue-600 dark:text-blue-400">Selected Text</span>
                      </div>
                      <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                        "{(() => {
                          const words = selectedText.split(' ');
                          if (words.length <= 8) return selectedText;
                          return words.slice(0, 8).join(' ') + '...';
                        })()}"
                      </p>
                    </div>
                  )}
                  
                  {/* Message Context - Right Side */}
                  <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-600 shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        <span className="text-sm font-semibold text-green-600 dark:text-green-400">Message Context</span>
                      </div>
                      {parentMessageContent.length > 60 && (
                        <button
                          onClick={() => setShowFullContext(!showFullContext)}
                          className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors flex items-center gap-1"
                        >
                          <Eye size={14} />
                          {showFullContext ? 'Less' : 'More'}
                        </button>
                      )}
                    </div>
                    <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                      {showFullContext 
                        ? parentMessageContent 
                        : parentMessageContent.length > 60 
                          ? parentMessageContent.substring(0, 60) + '...' 
                          : parentMessageContent
                      }
                    </p>
                  </div>
                </div>
              </div>

              {/* Messages List - Now below the scrollable context */}
              <div className="px-4 py-2">
                <BranchatMessageList
                  messages={messages}
                  isLoading={isLoading}
                  onAskFollowUp={handleAskFollowUp}
                  onOpenSubChat={handleOpenSubChat}
                />
              </div>
            </div>
          </div>

          {/* Read-only merged summary display - Professional */}
          {isReadOnly && mergedSummary && (
            <div className="border-t border-gray-200 dark:border-gray-700 bg-green-50 dark:bg-green-900/10">
              <div className="px-6 py-4">
                <div className="max-w-4xl mx-auto">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <CheckCircle size={20} className="text-green-600 dark:text-green-400" />
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                        Merged SubChat Summary
                      </h3>
                    </div>
                    {onContinueChat && (
                      <button
                        onClick={onContinueChat}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-all duration-200 text-sm font-medium shadow-md hover:shadow-lg"
                        title="Continue this conversation"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                        </svg>
                        Continue Chat
                      </button>
                    )}
                  </div>
                  <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-600 shadow-sm">
                    <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                      {mergedSummary}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Composer - Hidden in read-only mode */}
          {!isReadOnly && (
            <div className="bg-gray-50 dark:bg-gray-800">
              <BranchatComposer
                onSend={(content) => {
                  onSendMessage(content);
                  handleClearContext(); // Clear context after sending
                }}
                disabled={isLoading || isMerging}
                initialValue={followUpText}
                selectedContext={selectedContext}
                onClearContext={handleClearContext}
                placeholder={selectedContext ? "Ask a question about the selected text..." : "Ask about the selected text or message context..."}
              />
            </div>
          )}

          {/* Action Buttons - Professional positioning */}
          {messages.length > 0 && !isReadOnly && (
            <div className="bg-gray-50 dark:bg-gray-800">
              <div className="px-6 py-4">
                <div className="max-w-4xl mx-auto">
                  <div className="flex justify-end gap-3">
                    <button
                      onClick={handleContinueWithoutMergeClick}
                      disabled={isMerging}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium shadow-sm"
                      title="Discard this SubChat completely - no context will be saved"
                    >
                      <RotateCcw size={16} />
                      Continue Without Merging
                    </button>
                    <button
                      onClick={handleMergeClick}
                      disabled={isMerging}
                      className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium shadow-lg hover:shadow-xl"
                      title="Save this SubChat context globally - will be available in all future conversations"
                    >
                      {isMerging ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          Merging...
                        </>
                      ) : (
                        <>
                          <CheckCircle size={16} />
                          Merge & Continue
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Merging overlay - Professional */}
          {isMerging && (
            <div className="absolute inset-0 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md flex items-center justify-center z-50 rounded-2xl">
              <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-2xl border border-gray-200 dark:border-gray-600 max-w-md mx-4">
                <div className="flex flex-col items-center gap-4">
                  <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
                  <div className="text-center">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                      Merging SubChat
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Saving context and returning to main conversation...
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}