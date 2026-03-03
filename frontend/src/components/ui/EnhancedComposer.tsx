/**
 * Enhanced Message Composer
 * 
 * Improved composer with loading states, error handling, and UX enhancements
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Paperclip, X, Quote, Loader2 } from 'lucide-react';
import { useChat } from '../../contexts/ChatContext';
import { useAIProvider } from '../../contexts/AIProviderContext';

interface EnhancedComposerProps {
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
  allowAttachments?: boolean;
  maxCharacters?: number;
}

export function EnhancedComposer({ 
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
  onFocus,
  allowAttachments = false,
  maxCharacters = 4000,
}: EnhancedComposerProps) {
  const { isSending, canSendMessage } = useChat();
  const { isAvailable: aiAvailable } = useAIProvider();
  
  const [message, setMessage] = useState(initialValue);
  const [isSearching, setIsSearching] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [charCount, setCharCount] = useState(0);
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-resize textarea
  const adjustTextareaHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  }, []);

  // Handle message input
  const handleMessageChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setMessage(value);
    setCharCount(value.length);
    setError(null);
    adjustTextareaHeight();
  }, [adjustTextareaHeight]);

  // Handle form submission
  const handleSubmit = useCallback(async (e?: React.FormEvent) => {
    e?.preventDefault();
    
    const trimmedMessage = message.trim();
    
    if (!trimmedMessage) {
      setError('Message cannot be empty');
      return;
    }
    
    if (trimmedMessage.length > maxCharacters) {
      setError(`Message cannot exceed ${maxCharacters} characters`);
      return;
    }
    
    if (!canSendMessage) {
      setError('Cannot send message in current state');
      return;
    }

    if (isSearchMode && onSearch) {
      setIsSearching(true);
      try {
        const result = await onSearch(trimmedMessage);
        setMessage(result);
        onAutoSendComplete?.();
      } catch (error) {
        setError('Search failed. Please try again.');
      } finally {
        setIsSearching(false);
      }
    } else {
      setIsSubmitting(true);
      try {
        await onSend(trimmedMessage);
        setMessage('');
        setCharCount(0);
        adjustTextareaHeight();
        setError(null);
      } catch (error) {
        setError('Failed to send message. Please try again.');
      } finally {
        setIsSubmitting(false);
      }
    }
  }, [message, isSearchMode, onSearch, onSend, onAutoSendComplete, canSendMessage, maxCharacters, adjustTextareaHeight]);

  // Handle keyboard shortcuts
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    } else if (e.key === 'Escape' && selectedContext) {
      onClearContext?.();
    }
  }, [handleSubmit, selectedContext, onClearContext]);

  // Handle file attachment
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      // Handle image attachment
      console.log('Image attachment:', file);
    }
  }, []);

  // Handle paste events
  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (const item of items) {
      if (item.type === 'text/plain') {
        const text = e.clipboardData.getData('text/plain');
        if (text) {
          const currentMessage = message + text;
          setMessage(currentMessage);
          setCharCount(currentMessage.length);
          adjustTextareaHeight();
        }
        break;
      }
    }
  }, [message, adjustTextareaHeight]);

  // Auto-focus when initialValue changes
  useEffect(() => {
    if (initialValue && textareaRef.current) {
      // If there's selected context, extract just the question part
      if (selectedContext && initialValue.includes('Question: ')) {
        const questionPart = initialValue.split('Question: ')[1] || '';
        setMessage(questionPart);
        setCharCount(questionPart.length);
      } else {
        setMessage(initialValue);
        setCharCount(initialValue.length);
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
      }, 100);
    }
  }, [initialValue, selectedContext]);

  // Auto-send when autoSend is true
  useEffect(() => {
    if (autoSend && initialValue && !isSubmitting && canSendMessage) {
      setTimeout(() => {
        handleSubmit();
      }, 500);
    }
  }, [autoSend, initialValue, isSubmitting, canSendMessage, handleSubmit]);

  // Focus when requested
  useEffect(() => {
    if (onFocus && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [onFocus]);

  // Smooth scroll to bottom when messages change
  const scrollToBottom = useCallback(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, []);

  // Character count indicator color
  const getCharCountColor = () => {
    if (charCount > maxCharacters * 0.9) return 'text-red-500';
    if (charCount > maxCharacters * 0.7) return 'text-yellow-500';
    return 'text-gray-500';
  };

  const isSubmitDisabled = disabled || !canSendMessage || isSubmitting || isSearching || 
    (!message.trim() && !selectedContext) || 
    (message.trim().length > maxCharacters);

  return (
    <div className="border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-[#1a1a1a] focus-within:ring-2 focus-within:ring-blue-500 focus-within:ring-offset-0">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center space-x-2">
          {selectedContext && (
            <div className="flex items-center space-x-2 px-2 py-1 bg-blue-50 dark:bg-blue-900/20 rounded">
              <Quote className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span className="text-xs text-blue-600 dark:text-blue-400">
                Context Selected
              </span>
              <button
                onClick={onClearContext}
                className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}
          
          {error && (
            <div className="flex items-center space-x-2 px-2 py-1 bg-red-50 dark:bg-red-900/20 rounded">
              <span className="text-xs text-red-600 dark:text-red-400">
                {error}
              </span>
              <button
                onClick={() => setError(null)}
                className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
        
        <div className="flex items-center space-x-2">
          {allowAttachments && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              title="Attach file"
            >
              <Paperclip className="w-4 h-4" />
            </button>
          )}
          
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
          />
          
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {charCount}/{maxCharacters}
          </div>
        </div>
      </div>

      {/* Textarea */}
      <div className="relative">
        <textarea
          ref={textareaRef}
          value={message}
          onChange={handleMessageChange}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          onFocus={onFocus}
          placeholder={selectedContext ? "Continue with your question..." : placeholder}
          disabled={disabled}
          className="w-full px-3 py-2 bg-transparent resize-none focus:outline-none focus:ring-0 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
          rows={1}
          style={{ minHeight: '44px', maxHeight: '200px' }}
        />
        
        {/* Character count indicator */}
        <div className={`absolute bottom-2 right-2 text-xs ${getCharCountColor()}`}>
          {charCount}
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-3 py-2 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center space-x-2">
          {isSearchMode && (
            <span className="text-xs text-gray-500 dark:text-gray-400">
              Search Mode
            </span>
          )}
          
          {!aiAvailable && (
            <span className="text-xs text-orange-500 dark:text-orange-400">
              Server Fallback
            </span>
          )}
        </div>
        
        <div className="flex items-center space-x-2">
          {message.trim() && (
            <button
              type="button"
              onClick={() => setMessage('')}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              title="Clear message"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          
          <button
            type="submit"
            onClick={handleSubmit}
            disabled={isSubmitDisabled}
            className={`px-4 py-2 rounded-md font-medium text-white transition-colors ${
              isSubmitDisabled
                ? 'bg-gray-300 dark:bg-gray-600 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-700'
            }`}
          >
            {(isSubmitting || isSearching) ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>
      
      {/* Messages end reference for auto-scroll */}
      <div ref={messagesEndRef} />
    </div>
  );
}

/**
 * Enhanced composer with streaming support
 */
export function StreamingComposer(props: EnhancedComposerProps) {
  return (
    <EnhancedComposer
      {...props}
      disabled={props.disabled || props.isSending}
      placeholder={props.isSending ? "AI is responding..." : props.placeholder}
    />
  );
}
