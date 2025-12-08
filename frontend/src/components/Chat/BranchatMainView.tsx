import { useState, useEffect, useCallback, useRef } from 'react';
import { Menu, ChevronDown, User, LogOut } from 'lucide-react';
import { BranchatMessageList } from './BranchatMessageList';
import { BranchatComposer } from './BranchatComposer';

import { BranchatSubChat } from './BranchatSubChat';
import { MemoryBanner } from './MemoryBanner';
import { LoginModal } from '../LoginModal';
import { NewChatModal } from './NewChatModal';
import { UserSettingsDropdown } from '../UserSettingsDropdown';
import { UserProfileModal } from '../Settings/UserProfileModal';
import { SecurityModal } from '../Settings/SecurityModal';
import { GeneralSettingsModal } from '../Settings/GeneralSettingsModal';
import { DeleteAccountModal } from '../Settings/DeleteAccountModal';
import { showToast } from '../Toast';
import { useAuth } from '../../contexts/AuthContext';
import { conversationStorage, messageStorage } from '../../lib/conversationStorage';
import { Message, Conversation, Summary } from '../../types';

interface BranchatMainViewProps {
  conversationId?: string;
  onConversationChange: () => void;
  onToggleLeftSidebar: () => void;
  justDeletedConversation?: boolean;
  onNewChatRequest?: () => void;
  onSwitchToConversation?: (id: string) => void;
}

export function BranchatMainView({
  conversationId,
  onConversationChange,
  onToggleLeftSidebar,
  justDeletedConversation = false,
  onNewChatRequest,
  onSwitchToConversation
}: BranchatMainViewProps) {
  const { user, signOut } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [summaries, setSummaries] = useState<Summary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchMessages, setSearchMessages] = useState<Message[]>([]);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showKnowledgeToggle, setShowKnowledgeToggle] = useState(false);
  const [pendingQuery, setPendingQuery] = useState<string>('');
  const [hasConversationHistory, setHasConversationHistory] = useState(false);
  const [isCheckingHistory, setIsCheckingHistory] = useState(false);

  // Settings modals state
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showSecurityModal, setShowSecurityModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showDeleteAccountModal, setShowDeleteAccountModal] = useState(false);

  // Sub-chat state
  const [subChatOpen, setSubChatOpen] = useState(false);
  const [subChatMessages, setSubChatMessages] = useState<Message[]>([]);
  const [subChatParentMessage, setSubChatParentMessage] = useState<Message | null>(null);
  const [currentSubChatId, setCurrentSubChatId] = useState<string | null>(null);
  const [isSubChatLoading, setIsSubChatLoading] = useState(false);
  const [isMerging, setIsMerging] = useState(false);
  const [isSubChatReadOnly, setIsSubChatReadOnly] = useState(false);
  const [subChatMergedSummary, setSubChatMergedSummary] = useState<string>('');
  const [subChatSelectedText, setSubChatSelectedText] = useState<string>('');
  const [subChatParentMessageId, setSubChatParentMessageId] = useState<string>('');

  // Track previous conversation ID to detect switches
  const prevConversationIdRef = useRef<string | undefined>(undefined);

  // Store merged SubChat histories for enhanced context
  const [mergedSubChatHistories, setMergedSubChatHistories] = useState<Array<{
    id: string;
    parentMessageId: string;
    selectedText: string;
    summary: string;
    detailedSummary: string;
    questionCount: number;
    topics: string;
    mergedAt: string;
    messages?: Message[]; // Store the actual subchat messages for reopening
  }>>([]);




  useEffect(() => {
    // Check if we're actually switching conversations (not initial load)
    const isSwitchingConversations = prevConversationIdRef.current !== undefined && 
                                      prevConversationIdRef.current !== conversationId;
    
    if (conversationId) {
      // Only reset state if we're switching between conversations
      if (isSwitchingConversations) {
        setIsLoading(false);
        setMessages([]);
      }
      
      loadConversationWithMessages();
      setSearchMessages([]);
      loadSubChatHistories(conversationId);
    } else {
      setMessages([]);
      setConversation(null);
      setSummaries([]);
      setMergedSubChatHistories([]);
      setIsLoading(false);
    }
    
    // Update the ref for next comparison
    prevConversationIdRef.current = conversationId;
  }, [conversationId]);

  // Reload SubChat histories when use_previous_knowledge setting changes
  useEffect(() => {
    if (conversationId && conversation) {
      loadSubChatHistories(conversationId);
    }
  }, [conversation?.use_previous_knowledge]);

  // Separate effect to handle sending pending query when conversation is ready
  useEffect(() => {
    if (conversationId && pendingQuery && !showKnowledgeToggle) {
      const timer = setTimeout(async () => {
        try {
          await handleSendMessage(pendingQuery);
          setPendingQuery('');
        } catch (error) {
          console.error('Error sending pending message:', error);
          setPendingQuery('');
        }
      }, 200);

      return () => clearTimeout(timer);
    }
  }, [conversationId, pendingQuery, showKnowledgeToggle]);

  // Keyboard shortcuts
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    // Ctrl/Cmd + K to focus conversation list
    if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
      event.preventDefault();
      // Future: implement conversation list focus
    }
  }, []);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Periodic cleanup of expired subchat histories
  useEffect(() => {
    // Run cleanup on component mount
    cleanupExpiredSubChatHistories();
    
    // Clean up old non-user-specific storage (migration cleanup)
    cleanupLegacyStorage();

    // Set up periodic cleanup (once per day)
    const cleanupInterval = setInterval(cleanupExpiredSubChatHistories, 24 * 60 * 60 * 1000);

    return () => clearInterval(cleanupInterval);
  }, []);

  // Clean up legacy non-user-specific storage
  const cleanupLegacyStorage = () => {
    try {
      // Remove old global storage that wasn't user-specific
      const legacyGlobalKey = 'global_subchat_histories';
      if (localStorage.getItem(legacyGlobalKey)) {
        localStorage.removeItem(legacyGlobalKey);
      }
      
      // Remove old conversation-specific storage that wasn't user-specific
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (key && key.startsWith('subchat_histories_') && !key.includes('_', 18)) {
          localStorage.removeItem(key);
        }
      }
    } catch (error) {
      console.error('❌ Error during legacy cleanup:', error);
    }
  };

  const loadConversationWithMessages = async () => {
    if (!conversationId) {
  
      return;
    }


    setIsLoading(true);

    try {
      // Load conversation and messages from backend
      const [loadedConversation, loadedMessages] = await Promise.all([
        conversationStorage.getConversation(conversationId),
        messageStorage.getMessages(conversationId)
      ]);

      if (loadedConversation) {


        setConversation(loadedConversation);

        // Filter out any subchat context messages that might have been accidentally saved
        const filteredMessages = loadedMessages.filter((message: Message) => {
          // Filter out messages that look like subchat context
          if (message.content.includes('SUBCHAT CONTEXT:') ||
            message.content.includes('=== SubChat Context') ||
            message.content.includes('SELECTED TEXT TO DISCUSS')) {

            return false;
          }
          return true;
        });

        setMessages(filteredMessages);

        if (loadedConversation.use_memory) {
          loadSummaries();
        }
      } else {

        setMessages([]);
        setConversation(null);
      }

    } catch (error) {
      console.error('Error loading conversation:', error);
      setMessages([]);
      setConversation(null);
    } finally {
      setIsLoading(false);
    }
  };

  const loadSummaries = async () => {
    try {
      // Try backend API first, fallback to mock
      const { apiService } = await import('../../lib/api');
      const result = await apiService.listMemories();
      setSummaries(result.data || []);
    } catch (error) {
      if (error instanceof Error && error.message === 'API_FALLBACK') {
        // Fallback to mock API
        const { mockApi } = await import('../../lib/mockApi');
        const result = await mockApi.getSummaries();
        setSummaries(result.data || []);
      } else {
        console.error('Error loading summaries:', error);
      }
    }
  };

  // Load persisted subchat histories for a conversation (USER-SPECIFIC HISTORIES ONLY)
  const loadSubChatHistories = (conversationId: string) => {
    try {
      // Get user ID for user-specific storage
      const userId = user?.id || user?.email || 'guest';
      if (!userId) {
        console.error('❌ Cannot load subchat histories: No user ID available');
        setMergedSubChatHistories([]);
        return;
      }
      
      let conversationHistories: typeof mergedSubChatHistories = [];
      let globalHistories: typeof mergedSubChatHistories = [];
      
      // Always load conversation-specific histories (from current conversation)
      const conversationStorageKey = `subchat_histories_${userId}_${conversationId}`;
      const conversationStored = localStorage.getItem(conversationStorageKey);
      
      if (conversationStored) {
        try {
          const data = JSON.parse(conversationStored);
          if (Array.isArray(data)) {
            conversationHistories = data.filter(history => {
              const hasRequiredFields = history.id && history.parentMessageId && history.mergedAt;
              const mergedTime = new Date(history.mergedAt).getTime();
              const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
              return hasRequiredFields && mergedTime > thirtyDaysAgo;
            });
          }
        } catch (parseError) {
          // Silent error handling
        }
      }
      
      // Only load global subchat histories if use_previous_knowledge is enabled
      if (conversation?.use_previous_knowledge) {
        const globalStorageKey = `global_subchat_histories_${userId}`;
        const globalStored = localStorage.getItem(globalStorageKey);
        
        if (globalStored) {
          try {
            const data = JSON.parse(globalStored);
            if (Array.isArray(data)) {
              globalHistories = data.filter(history => {
                const hasRequiredFields = history.id && history.mergedAt;
                const mergedTime = new Date(history.mergedAt).getTime();
                const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
                return hasRequiredFields && mergedTime > thirtyDaysAgo;
              });
            }
          } catch (parseError) {
            // Silent error handling
          }
        }
      }
      
      // Combine conversation-specific and global histories (prioritize conversation-specific)
      const combinedHistories = [...conversationHistories];
      
      // Add global histories that aren't already in conversation histories (only if use_previous_knowledge is enabled)
      if (conversation?.use_previous_knowledge) {
        globalHistories.forEach(globalHistory => {
          const existsInConversation = conversationHistories.some(convHistory => convHistory.id === globalHistory.id);
          if (!existsInConversation) {
            combinedHistories.push(globalHistory);
          }
        });
      }
      
      // Sort by merge date (most recent first) and limit to prevent overwhelming context
      combinedHistories.sort((a, b) => new Date(b.mergedAt).getTime() - new Date(a.mergedAt).getTime());
      const limitedHistories = combinedHistories.slice(0, 20); // Limit to 20 most recent
      
      setMergedSubChatHistories(limitedHistories);
      
    } catch (error) {
      console.error('❌ Error loading subchat histories:', error);
      setMergedSubChatHistories([]);
    }
  };

  // Save subchat histories to localStorage (USER-SPECIFIC storage for all conversations)
  const saveSubChatHistories = (conversationId: string, histories: typeof mergedSubChatHistories) => {
    try {
      // Get user ID for user-specific storage
      const userId = user?.id || user?.email || 'guest';
      if (!userId) {
        console.error('❌ Cannot save subchat histories: No user ID available');
        return;
      }
      
      // Save conversation-specific histories (for current conversation context)
      const conversationStorageKey = `subchat_histories_${userId}_${conversationId}`;
      const conversationDataToSave = JSON.stringify(histories);
      localStorage.setItem(conversationStorageKey, conversationDataToSave);
      
      // ALSO save to user-specific global subchat histories (for cross-conversation context)
      const globalStorageKey = `global_subchat_histories_${userId}`;
      let globalHistories: typeof mergedSubChatHistories = [];
      
      try {
        const existingGlobal = localStorage.getItem(globalStorageKey);
        if (existingGlobal) {
          globalHistories = JSON.parse(existingGlobal);
        }
      } catch (parseError) {
        console.warn('⚠️ Error parsing existing global histories, starting fresh');
        globalHistories = [];
      }
      
      // Add new histories to global storage (avoid duplicates)
      histories.forEach(newHistory => {
        const existingIndex = globalHistories.findIndex(existing => existing.id === newHistory.id);
        if (existingIndex >= 0) {
          // Update existing
          globalHistories[existingIndex] = newHistory;
        } else {
          // Add new
          globalHistories.push(newHistory);
        }
      });
      
      // Keep only recent histories (last 50 to prevent storage bloat)
      globalHistories.sort((a, b) => new Date(b.mergedAt).getTime() - new Date(a.mergedAt).getTime());
      globalHistories = globalHistories.slice(0, 50);
      
      localStorage.setItem(globalStorageKey, JSON.stringify(globalHistories));
      
      // Histories saved successfully
    } catch (error) {
      console.error('❌ Error saving subchat histories:', error);
    }
  };

  // Clean up subchat histories for a deleted conversation (user-specific)
  const cleanupSubChatHistories = (conversationId: string) => {
    try {
      const userId = user?.id || user?.email || 'guest';
      if (!userId) {
        console.error('❌ Cannot cleanup subchat histories: No user ID available');
        return;
      }
      
      const storageKey = `subchat_histories_${userId}_${conversationId}`;
      localStorage.removeItem(storageKey);
      // Cleanup completed
    } catch (error) {
      console.error('❌ Error cleaning up subchat histories:', error);
    }
  };

  // Clean up all expired subchat histories (call this periodically) - USER-SPECIFIC
  const cleanupExpiredSubChatHistories = () => {
    try {
      const userId = user?.id || user?.email || 'guest';
      if (!userId) {
  
        return;
      }
      
      const now = new Date().getTime();
      const thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000);
      let cleanedCount = 0;

      // Clean up user-specific conversation histories
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (key && key.startsWith(`subchat_histories_${userId}_`)) {
          try {
            const data = JSON.parse(localStorage.getItem(key) || '[]');
            if (Array.isArray(data)) {
              const validHistories = data.filter(history => {
                const mergedTime = new Date(history.mergedAt).getTime();
                return mergedTime > thirtyDaysAgo;
              });

              if (validHistories.length === 0) {
                localStorage.removeItem(key);
                cleanedCount++;
              } else if (validHistories.length !== data.length) {
                localStorage.setItem(key, JSON.stringify(validHistories));
              }
            }
          } catch (parseError) {
            localStorage.removeItem(key);
            cleanedCount++;
          }
        }
      }

      // Clean up user-specific global subchat histories
      const globalKey = `global_subchat_histories_${userId}`;
      try {
        const globalData = localStorage.getItem(globalKey);
        if (globalData) {
          const histories = JSON.parse(globalData);
          if (Array.isArray(histories)) {
            const validGlobalHistories = histories.filter(history => {
              const mergedTime = new Date(history.mergedAt).getTime();
              return mergedTime > thirtyDaysAgo;
            });

            if (validGlobalHistories.length === 0) {
              localStorage.removeItem(globalKey);
              cleanedCount++;
            } else if (validGlobalHistories.length !== histories.length) {
              // Keep only the 50 most recent
              validGlobalHistories.sort((a, b) => new Date(b.mergedAt).getTime() - new Date(a.mergedAt).getTime());
              const limitedHistories = validGlobalHistories.slice(0, 50);
              localStorage.setItem(globalKey, JSON.stringify(limitedHistories));
            }
          }
        }
      } catch (parseError) {
        localStorage.removeItem(globalKey);
        cleanedCount++;
      }

      // Cleanup completed
    } catch (error) {
      console.error('❌ Error during cleanup:', error);
    }
  };

  const handleSendMessage = async (content: string) => {
    if (!conversationId) {
  
      return;
    }


    setIsLoading(true);

    // Create display version of the message (truncated for UI)
    let displayContent = content;
    if (content.includes('Regarding: "') && content.includes('Question: ')) {
      const parts = content.split('\n\nQuestion: ');
      if (parts.length === 2) {
        const regardingPart = parts[0].replace('Regarding: "', '').replace('"', '');
        const questionPart = parts[1];

        // Truncate the regarding part to first 2 lines
        const lines = regardingPart.split('\n');
        const truncatedRegarding = lines.length <= 2
          ? regardingPart
          : lines.slice(0, 2).join('\n') + '...';

        displayContent = `Regarding: "${truncatedRegarding}"\n\nQuestion: ${questionPart}`;
      }
    }

    // Create user message immediately for UI responsiveness (with truncated display)
    const tempUserMessage = {
      id: `temp_user_${Date.now()}`,
      conversation_id: conversationId,
      role: 'user' as const,
      content: displayContent, // Use truncated version for display
      is_summary: false,
      summary_details: null,
      created_at: new Date().toISOString(),
    };

    // Add user message to UI immediately
    setMessages(prev => [...prev, tempUserMessage]);

    try {
      // Build enhanced context with SubChat histories
      const enhancedContext = buildEnhancedContext(messages);
      const previousKnowledgeContext = await buildPreviousKnowledgeContext();

      // Ensure we have context - try multiple methods
      let finalContext = enhancedContext;

      // If no context but we have histories, force rebuild
      if (!finalContext && mergedSubChatHistories.length > 0) {

        finalContext = buildEnhancedContext(messages);
      }

      // If still no context, try user-specific localStorage directly (only for current conversation)
      if (!finalContext && conversationId) {
        try {
          const userId = user?.id || user?.email || 'guest';
          if (userId) {
            const storageKey = `subchat_histories_${userId}_${conversationId}`;
            const stored = localStorage.getItem(storageKey);
            if (stored) {
              const histories = JSON.parse(stored);
              if (Array.isArray(histories) && histories.length > 0) {
                // Only include histories from the current conversation (those with parentMessageId that exists in current messages)
                const currentConversationHistories = histories.filter(h => 
                  messages.some(m => m.id === h.parentMessageId)
                );
                
                if (currentConversationHistories.length > 0) {
                  const contextParts = currentConversationHistories.map((h, i) =>
                    `SubChat ${i + 1}: Selected "${h.selectedText || 'text'}" - ${h.summary || 'Discussion occurred'} - Details: ${h.detailedSummary || 'No details'}`
                  );
                  finalContext = `SUBCHAT CONTEXT: Found ${currentConversationHistories.length} subchat discussion(s) from this conversation:\n${contextParts.join('\n')}\n\nUse this context to provide informed responses about these topics.`;
                }
              }
            }
          }
        } catch (error) {
          console.error('❌ Error building context from user-specific localStorage:', error);
        }
      }

      // Emergency fallback - only add generic context if use_previous_knowledge is enabled
      if (!finalContext && conversation?.use_previous_knowledge && (content.toLowerCase().includes('subchat') || content.toLowerCase().includes('discussed') || content.toLowerCase().includes('mentioned'))) {

        finalContext = 'SUBCHAT CONTEXT: The user may be referring to previous detailed discussions about specific topics. Please provide comprehensive responses that acknowledge any previous context that might be relevant.';
      }

      // Send message via the new API with both SubChat and previous knowledge context
      const result = await messageStorage.addMessage(conversationId, content, 'user', finalContext, previousKnowledgeContext);

      if (result) {


        // Replace temp message with real messages from backend
        // Use display version for user message, keep AI response as-is
        const userMessageForDisplay = {
          ...result.userMessage,
          content: displayContent // Use truncated version for display
        };

        const newMessages = [userMessageForDisplay];
        if (result.assistantMessage) {
          newMessages.push(result.assistantMessage);
        }

        setMessages(prev => {
          // Remove the temp message and add real messages
          const withoutTemp = prev.filter(m => m.id !== tempUserMessage.id);
          return [...withoutTemp, ...newMessages];
        });

        onConversationChange();
      } else {
        console.error('❌ Failed to send message');
        // Remove the temp message on error
        setMessages(prev => prev.filter(m => m.id !== tempUserMessage.id));
      }
    } catch (error) {
      console.error('❌ Error sending message:', error);
      // Remove the temp message on error
      setMessages(prev => prev.filter(m => m.id !== tempUserMessage.id));
    } finally {
      setIsLoading(false);
    }
  };

  const [followUpText, setFollowUpText] = useState('');
  const [selectedContext, setSelectedContext] = useState('');

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

  const handleOpenSubChat = async (messageId: string, selectedText?: string) => {
    // This is for creating a NEW subchat (not reopening an existing one)
    const parentMessage = messages.find(m => m.id === messageId);
    if (!parentMessage) {
      console.error('❌ Parent message not found:', messageId);
      return;
    }

    if (!conversationId) {
      console.error('❌ No conversation ID available');
      return;
    }

    try {
      // Always create a new SubChat when this function is called
      const mockSubChatId = `subchat_${Date.now()}`;

      // Reset all subchat state before opening new one
      setIsSubChatLoading(false);
      setIsMerging(false);
      setSubChatMessages([]);
      setIsSubChatReadOnly(false);
      setSubChatMergedSummary('');
      
      // Then set the new subchat data
      setCurrentSubChatId(mockSubChatId);
      setSubChatParentMessage(parentMessage);
      setSubChatParentMessageId(messageId);
      setSubChatSelectedText(selectedText || '');
      setSubChatOpen(true);

      console.log('✨ Created new SubChat:', mockSubChatId);
    } catch (error) {
      console.error('❌ Error opening SubChat:', error);
    }
  };

  const handleOpenExistingSubChat = async (subChatId: string) => {
    // This is for reopening an EXISTING merged subchat in read-only mode
    const existingSubChat = mergedSubChatHistories.find(h => h.id === subChatId);
    
    if (!existingSubChat) {
      console.error('❌ SubChat not found:', subChatId);
      return;
    }

    const parentMessage = messages.find(m => m.id === existingSubChat.parentMessageId);
    if (!parentMessage) {
      console.error('❌ Parent message not found:', existingSubChat.parentMessageId);
      return;
    }

    try {
      console.log('📖 Reopening existing SubChat in read-only mode:', subChatId);
      
      setCurrentSubChatId(existingSubChat.id);
      setSubChatParentMessage(parentMessage);
      setSubChatParentMessageId(existingSubChat.parentMessageId);
      setSubChatSelectedText(existingSubChat.selectedText || '');
      setSubChatMessages(existingSubChat.messages || []);
      setIsSubChatReadOnly(true);
      setSubChatMergedSummary(existingSubChat.summary);
      setIsSubChatLoading(false);
      setIsMerging(false);
      setSubChatOpen(true);
    } catch (error) {
      console.error('❌ Error reopening SubChat:', error);
    }
  };

  const handleContinueChat = () => {
    // Switch from read-only mode to editable mode
    console.log('✏️ Continuing SubChat:', currentSubChatId);
    setIsSubChatReadOnly(false);
    setSubChatMergedSummary('');
  };

  const handleSendSubChatMessage = async (content: string) => {
    if (!currentSubChatId || !subChatParentMessage) {
      console.error('❌ No SubChat ID or parent message available');
      return;
    }

    setIsSubChatLoading(true);

    try {
      // Create mock user message
      const userMessage: Message = {
        id: `subchat_user_${Date.now()}`,
        conversation_id: currentSubChatId,
        role: 'user',
        content,
        is_summary: false,
        summary_details: null,
        created_at: new Date().toISOString(),
      };

      // Add user message immediately
      setSubChatMessages(prev => [...prev, userMessage]);

      // Create SubChat-specific context that focuses on selected text
      const subChatContext = createSubChatContext(content, subChatSelectedText, subChatParentMessage.content, messages);

      try {
        // For SubChat, use the backend API but with a separate subchat endpoint
        // This gets AI responses without saving to the main conversation


        const { apiService } = await import('../../lib/api');

        // Try to use the subchat API if available, otherwise use search API as fallback
        let aiResponse = '';

        try {
          // Create a focused query for the AI that includes context
          const contextualQuery = `Context: "${subChatParentMessage.content.substring(0, 200)}${subChatParentMessage.content.length > 200 ? '...' : ''}"\n\nSelected text: "${subChatSelectedText}"\n\nQuestion: ${content}`;

          const searchResult = await apiService.searchQuery(contextualQuery);
          aiResponse = searchResult.response;


        } catch (searchError) {

          aiResponse = generateSubChatResponse(content, subChatSelectedText, subChatParentMessage.content, messages);
        }

        const assistantMessage: Message = {
          id: `subchat_assistant_${Date.now()}`,
          conversation_id: currentSubChatId,
          role: 'assistant',
          content: aiResponse,
          is_summary: false,
          summary_details: null,
          created_at: new Date().toISOString(),
        };

        setSubChatMessages(prev => [...prev, assistantMessage]);
      } catch (apiError) {
        // Use fallback response generation

        // Generate SubChat-focused response as fallback
        const subChatResponse = generateSubChatResponse(content, subChatSelectedText, subChatParentMessage.content, messages);

        const assistantMessage: Message = {
          id: `subchat_assistant_${Date.now()}`,
          conversation_id: currentSubChatId,
          role: 'assistant',
          content: subChatResponse,
          is_summary: false,
          summary_details: null,
          created_at: new Date().toISOString(),
        };

        setSubChatMessages(prev => [...prev, assistantMessage]);
      }

      // IMPORTANT: SubChat messages are NEVER saved to the main conversation
      // They exist only in component state and are used for context after merging

      setIsSubChatLoading(false);

    } catch (error) {
      console.error('❌ Error sending SubChat message:', error);
      setIsSubChatLoading(false);
    }
  };

  // Helper function to generate contextual responses
  const generateContextualResponse = (userQuestion: string, parentContext: string): string => {
    const lowerQuestion = userQuestion.toLowerCase();
    const lowerContext = parentContext.toLowerCase();

    // Analyze the question type and parent context to provide relevant responses
    if (lowerQuestion.includes('explain') || lowerQuestion.includes('what') || lowerQuestion.includes('how')) {
      return `Based on the original message about "${parentContext.substring(0, 80)}${parentContext.length > 80 ? '...' : ''}"\n\nRegarding your question: "${userQuestion}"\n\nLet me clarify this specific aspect. ${getExplanationResponse(lowerQuestion, lowerContext)}`;
    } else if (lowerQuestion.includes('why') || lowerQuestion.includes('reason')) {
      return `Looking at the context: "${parentContext.substring(0, 80)}${parentContext.length > 80 ? '...' : ''}"\n\nYou're asking: "${userQuestion}"\n\nThe reasoning behind this is: ${getReasoningResponse(lowerQuestion, lowerContext)}`;
    } else if (lowerQuestion.includes('example') || lowerQuestion.includes('show me')) {
      return `From the original message: "${parentContext.substring(0, 80)}${parentContext.length > 80 ? '...' : ''}"\n\nFor your request: "${userQuestion}"\n\nHere are some relevant examples: ${getExampleResponse(lowerQuestion, lowerContext)}`;
    } else {
      return `Considering the original context: "${parentContext.substring(0, 80)}${parentContext.length > 80 ? '...' : ''}"\n\nRegarding: "${userQuestion}"\n\nThis relates to the main topic in several ways. ${getGeneralResponse(lowerQuestion, lowerContext)}`;
    }
  };

  const getExplanationResponse = (question: string, context: string): string => {
    if (context.includes('react') || context.includes('component')) {
      return "In React development, this concept works by managing state and props to create dynamic user interfaces. The key is understanding how data flows through components.";
    } else if (context.includes('javascript') || context.includes('function')) {
      return "In JavaScript, this functionality operates through closures, event handling, and asynchronous operations. The execution context determines how variables are accessed.";
    } else {
      return "This concept involves understanding the underlying principles and how they apply to your specific use case. Let me break down the key components for you.";
    }
  };

  const getReasoningResponse = (question: string, context: string): string => {
    return "This approach is chosen because it provides better performance, maintainability, and follows established best practices in the field. The decision factors include scalability and user experience considerations.";
  };

  const getExampleResponse = (question: string, context: string): string => {
    if (context.includes('code') || context.includes('programming')) {
      return "Here's a practical example:\n\n```javascript\n// Example implementation\nconst example = () => {\n  // Your code here\n};\n```\n\nThis demonstrates the concept in action.";
    } else {
      return "Consider this scenario: When you apply this principle, you might see results like improved efficiency, better organization, or enhanced functionality depending on your specific context.";
    }
  };

  const getGeneralResponse = (question: string, context: string): string => {
    return "The key points to consider are the practical applications, potential challenges, and best practices. This builds upon the foundation discussed in the original message and extends it to address your specific inquiry.";
  };

  // Enhanced helper function for SubChat with conversation history
  const generateContextualResponseWithHistory = (userQuestion: string, parentContext: string, conversationHistory: string): string => {
    const lowerQuestion = userQuestion.toLowerCase();

    return `**SubChat Context**: Discussing "${parentContext.substring(0, 100)}${parentContext.length > 100 ? '...' : ''}"\n\n**Recent Conversation**:\n${conversationHistory}\n\n**Your Question**: ${userQuestion}\n\n**Response** (considering full conversation context):\n\nBased on our entire conversation history and the specific message you're asking about, ${getContextAwareResponse(lowerQuestion, parentContext)}. This builds on everything we've discussed so far in this conversation.`;
  };

  const getContextAwareResponse = (question: string, context: string): string => {
    if (question.includes('explain') || question.includes('what') || question.includes('how')) {
      return "let me provide a detailed explanation that connects to our previous discussion points and the specific context you're referencing";
    } else if (question.includes('why') || question.includes('reason')) {
      return "the reasoning becomes clearer when we consider both the immediate context and the broader conversation we've been having";
    } else if (question.includes('example') || question.includes('show me')) {
      return "here are some examples that relate to both this specific point and the overall themes we've been exploring";
    } else {
      return "this relates to several aspects of our conversation, and I can provide insights that draw from everything we've discussed";
    }
  };

  // Build enhanced context from multiple sources
  const buildEnhancedContext = (mainMessages: Message[]): string => {

    let contextSections: string[] = [];

    // Method 1: Use mergedSubChatHistories (from state/localStorage - includes global histories)
    if (mergedSubChatHistories.length > 0) {
      mergedSubChatHistories.forEach((subChatHistory, index) => {
        const parentMessage = mainMessages.find(m => m.id === subChatHistory.parentMessageId);
        
        // Determine if this is from current conversation or another conversation
        const isFromCurrentConversation = !!parentMessage;
        const contextSource = isFromCurrentConversation ? 'Current Conversation' : 'Previous Conversation';
        
        // Only include context from previous conversations if use_previous_knowledge is enabled
        if (!isFromCurrentConversation && !conversation?.use_previous_knowledge) {
          return; // Skip this SubChat history from previous conversations
        }
        
        let contextSection = '';
        
        if (isFromCurrentConversation) {
          // Context from current conversation - always include
          contextSection = `
=== SubChat Context ${index + 1} (${contextSource}) ===
Original Message: "${parentMessage.content.substring(0, 100)}${parentMessage.content.length > 100 ? '...' : ''}"
Selected Text: "${subChatHistory.selectedText || 'General discussion'}"
Detailed Discussion:
${subChatHistory.detailedSummary}
Merged At: ${new Date(subChatHistory.mergedAt).toLocaleString()}
=== End SubChat Context ${index + 1} ===`;
        } else {
          // Context from other conversations (global context) - only if use_previous_knowledge is true
          contextSection = `
=== SubChat Context ${index + 1} (${contextSource}) ===
Topic Discussed: "${subChatHistory.selectedText || 'General discussion'}"
Summary: ${subChatHistory.summary || 'Discussion occurred'}
Detailed Discussion:
${subChatHistory.detailedSummary}
Discussed On: ${new Date(subChatHistory.mergedAt).toLocaleString()}
=== End SubChat Context ${index + 1} ===`;
        }

        contextSections.push(contextSection);
      });
    }

    // Method 2: Extract subchat context from message metadata (backup method)
    const messagesWithSubchatSummaries = mainMessages.filter(m =>
      m.content.includes('📋 **SubChat Summary**:') ||
      (m.metadata && m.metadata.hasInlineSummary)
    );

    if (messagesWithSubchatSummaries.length > 0 && contextSections.length === 0) {
      messagesWithSubchatSummaries.forEach((message, index) => {
        // Extract the subchat summary from the message content
        const summaryMatch = message.content.match(/📋 \*\*SubChat Summary\*\*: (.+?)(?:\n|$)/);
        if (summaryMatch) {
          const summary = summaryMatch[1];
          const contextSection = `
=== SubChat Context ${index + 1} (from inline summary) ===
Original Message: "${message.content.substring(0, 100)}..."
Summary: ${summary}
=== End SubChat Context ${index + 1} ===`;
          contextSections.push(contextSection);
        }
      });
    }

    // Method 3: Force context if we know there should be some (emergency fallback)
    // Only use this fallback if use_previous_knowledge is enabled
    if (contextSections.length === 0 && conversation?.use_previous_knowledge) {
      // Check user-specific localStorage directly as last resort
      try {
        if (conversationId) {
          const userId = user?.id || user?.email || 'guest';
          if (userId) {
            const storageKey = `subchat_histories_${userId}_${conversationId}`;
            const stored = localStorage.getItem(storageKey);
            if (stored) {
              const histories = JSON.parse(stored);
              if (Array.isArray(histories) && histories.length > 0) {
                histories.forEach((history, index) => {
                  const contextSection = `
=== SubChat Context ${index + 1} (from user localStorage) ===
Selected Text: "${history.selectedText || 'General discussion'}"
Summary: ${history.summary || 'Discussion occurred'}
Detailed: ${history.detailedSummary || 'No details available'}
=== End SubChat Context ${index + 1} ===`;
                  contextSections.push(contextSection);
                });
              }
            }
          }
        }
      } catch (error) {
        console.error('❌ Error reading user-specific localStorage for context:', error);
      }
    }

    if (contextSections.length === 0) {
      return '';
    }

    // Count current vs previous conversation contexts
    const currentConversationContexts = contextSections.filter(section => section.includes('(Current Conversation)')).length;
    const previousConversationContexts = contextSections.filter(section => section.includes('(Previous Conversation)')).length;
    
    let contextDescription = '';
    if (currentConversationContexts > 0 && previousConversationContexts > 0) {
      contextDescription = `${currentConversationContexts} from this conversation and ${previousConversationContexts} from previous conversations`;
    } else if (currentConversationContexts > 0) {
      contextDescription = `${currentConversationContexts} from this conversation`;
    } else {
      contextDescription = `${previousConversationContexts} from previous conversations`;
    }

    const finalContext = `
SUBCHAT CONTEXT: The user has had ${contextSections.length} detailed discussion(s) (${contextDescription}) about specific topics. Use this context to provide more informed responses:

${contextSections.join('\n\n')}

IMPORTANT: 
${conversation?.use_previous_knowledge 
  ? '- This context includes knowledge from both current and previous conversations\n- When referencing information from previous conversations, you can mention "based on our previous discussions"' 
  : '- This context only includes knowledge from the current conversation\n- Do not reference any previous conversations or external context'
}
- Use this information to provide comprehensive, contextually aware responses
- Don't repeat the subchat content verbatim unless specifically asked
`;





    return finalContext;
  };

  // Helper function to build previous knowledge context from all past conversations
  const buildPreviousKnowledgeContext = async (): Promise<string> => {


    if (!conversation?.use_previous_knowledge) {

      return '';
    }

    try {

      const previousKnowledge = await conversationStorage.getAllPreviousKnowledge(conversationId);



      if (previousKnowledge.length === 0) {

        return '';
      }

      let contextSections: string[] = [];

      // Limit to most recent 5 conversations to avoid overwhelming the context
      const recentKnowledge = previousKnowledge
        .sort((a, b) => new Date(b.conversation.updated_at).getTime() - new Date(a.conversation.updated_at).getTime())
        .slice(0, 5);

      recentKnowledge.forEach((knowledge, index) => {
        const { conversation: conv, messages } = knowledge;

        // Summarize the conversation
        const userMessages = messages.filter(m => m.role === 'user');
        const assistantMessages = messages.filter(m => m.role === 'assistant');

        if (userMessages.length === 0) return;

        // Create a summary of key topics discussed
        const topics = userMessages
          .map(m => m.content.substring(0, 100))
          .join(' | ');

        const lastInteraction = messages[messages.length - 1];

        const contextSection = `
=== Previous Conversation ${index + 1}: "${conv.title}" ===
Date: ${new Date(conv.updated_at).toLocaleDateString()}
Topics Discussed: ${topics}${topics.length > 200 ? '...' : ''}
Messages: ${userMessages.length} questions, ${assistantMessages.length} responses
Last Interaction: ${lastInteraction?.content.substring(0, 150)}${lastInteraction?.content.length > 150 ? '...' : ''}
=== End Previous Conversation ${index + 1} ===`;

        contextSections.push(contextSection);
      });

      const finalContext = `
PREVIOUS KNOWLEDGE: You have access to the user's conversation history. Use this knowledge to provide more personalized and contextually aware responses:

${contextSections.join('\n\n')}

Key Guidelines:
1. Reference previous discussions when relevant
2. Build upon past learning and insights  
3. Maintain consistency with previous interactions
4. Acknowledge when drawing from previous conversations
5. Use this context to provide more personalized responses

Total Previous Conversations Available: ${previousKnowledge.length}
`;



      return finalContext;
    } catch (error) {
      console.error('🧠 Error building previous knowledge context:', error);
      return '';
    }
  };

  // Helper function to insert inline summary into parent message
  const insertInlineSummary = (parentMessageId: string, selectedText: string, summary: string): void => {
    setMessages(prev => prev.map(message => {
      if (message.id === parentMessageId) {
        let updatedContent = message.content;

        if (selectedText && selectedText.trim()) {
          // Find the selected text in the message and insert summary after it
          const selectedTextIndex = updatedContent.indexOf(selectedText);
          if (selectedTextIndex !== -1) {
            const beforeText = updatedContent.substring(0, selectedTextIndex + selectedText.length);
            const afterText = updatedContent.substring(selectedTextIndex + selectedText.length);

            // Create inline summary with visual styling
            const inlineSummary = `\n\n📋 **SubChat Summary**: ${summary}\n`;

            updatedContent = beforeText + inlineSummary + afterText;
          } else {
            // If selected text not found, append at the end
            updatedContent += `\n\n📋 **SubChat Summary**: ${summary}`;
          }
        } else {
          // No selected text, append at the end
          updatedContent += `\n\n📋 **SubChat Summary**: ${summary}`;
        }

        return {
          ...message,
          content: updatedContent,
          // Add metadata to track inline summaries
          metadata: {
            ...message.metadata,
            hasInlineSummary: true,
            inlineSummaryCount: (message.metadata?.inlineSummaryCount || 0) + 1
          }
        };
      }
      return message;
    }));
  };

  const handleMerge = async () => {
    if (!currentSubChatId || !conversationId || !subChatParentMessageId) {
      console.error('❌ Missing SubChat ID, conversation ID, or parent message ID for merge');
      return;
    }

    setIsMerging(true);

    try {
      // Simulate merge process with delay
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Generate detailed summary from SubChat messages
      const userMessages = subChatMessages.filter(m => m.role === 'user');
      const assistantMessages = subChatMessages.filter(m => m.role === 'assistant');

      let summary = '';
      let detailedSummary = '';

      if (userMessages.length === 0) {
        summary = 'SubChat was opened but no questions were asked.';
        detailedSummary = summary;
      } else if (userMessages.length === 1) {
        const question = userMessages[0].content;
        const answer = assistantMessages[0]?.content || 'No response recorded';
        summary = `Asked: "${question.length > 60 ? question.substring(0, 60) + '...' : question}" - Received detailed clarification.`;
        detailedSummary = `Question: "${question}"\nKey points from response: ${answer.substring(0, 150)}${answer.length > 150 ? '...' : ''}`;
      } else {
        const topics = userMessages.map(m => m.content.substring(0, 30) + (m.content.length > 30 ? '...' : '')).join('", "');
        summary = `Discussed: "${topics}" - Covered ${userMessages.length} questions with detailed responses.`;

        // Create a more detailed summary for context
        const keyPoints = userMessages.map((q, i) => {
          const answer = assistantMessages[i];
          return `Q${i + 1}: ${q.content.substring(0, 50)}${q.content.length > 50 ? '...' : ''}\nA${i + 1}: ${answer ? answer.content.substring(0, 100) : 'No response'}${answer && answer.content.length > 100 ? '...' : ''}`;
        }).join('\n\n');

        detailedSummary = `Multiple questions discussed:\n${keyPoints}`;
      }

      // Check if we're updating an existing subchat or creating a new one
      const existingIndex = mergedSubChatHistories.findIndex(h => h.id === currentSubChatId);
      
      // Store SubChat history for future context enhancement (summary + messages for reopening)
      const subChatHistory = {
        id: currentSubChatId,
        parentMessageId: subChatParentMessageId,
        selectedText: subChatSelectedText,
        // Store both brief summary (for UI) and detailed summary (for context)
        summary: summary,
        detailedSummary: detailedSummary,
        questionCount: userMessages.length,
        topics: userMessages.map(m => m.content.substring(0, 30)).join(', '),
        mergedAt: new Date().toISOString(),
        messages: subChatMessages // Store the actual messages so we can reopen the subchat
      };

      let updatedHistories;
      if (existingIndex >= 0) {
        // Update existing subchat
        updatedHistories = [...mergedSubChatHistories];
        updatedHistories[existingIndex] = subChatHistory;
        console.log('📝 Updated existing SubChat:', currentSubChatId);
      } else {
        // Add new subchat
        updatedHistories = [...mergedSubChatHistories, subChatHistory];
        console.log('✨ Created new SubChat history:', currentSubChatId);
      }
      
      // Persist the updated histories immediately
      if (conversationId) {
        saveSubChatHistories(conversationId, updatedHistories);
      }
      
      // Update state immediately (no delay needed)
      setMergedSubChatHistories(updatedHistories);
      
      // Context is now immediately available

      // SubChat context saved successfully
      // Summary cards will be displayed automatically via subChatHistories prop

      // Clean up SubChat state
      setSubChatOpen(false);
      setSubChatMessages([]);
      setCurrentSubChatId(null);
      setSubChatParentMessage(null);
      setSubChatParentMessageId('');
      setSubChatSelectedText('');
      setIsSubChatReadOnly(false);
      setSubChatMergedSummary('');

      showToast('SubChat merged successfully - Context saved globally for all conversations', 'success');
      onConversationChange();

      // SubChat merged successfully
    } catch (error) {
      console.error('❌ Error merging SubChat:', error);
      showToast('Failed to merge SubChat', 'error');
    } finally {
      setIsMerging(false);
    }
  };

  const handleContinueWithoutMerge = () => {
    // Clear all subchat state without saving any context
    setSubChatOpen(false);
    setSubChatMessages([]);
    setCurrentSubChatId(null);
    setSubChatParentMessage(null);
    setSubChatParentMessageId('');
    setSubChatSelectedText('');
    setIsSubChatReadOnly(false);
    setSubChatMergedSummary('');
    
    // Show confirmation that subchat was discarded
    showToast('SubChat discarded - no context saved', 'info');
  };

  const handleKnowledgeToggleChoice = async (usePreviousKnowledge: boolean) => {
    setShowKnowledgeToggle(false);

    if (!pendingQuery) {
      // If no pending query, just create the conversation and wait for user input
      try {
        const { conversationStorage } = await import('../../lib/conversationStorage');
        const title = usePreviousKnowledge ? 'New Chat (Previous Knowledge)' : 'New Chat';
        const newConversation = await conversationStorage.createConversation(title, usePreviousKnowledge);

        if (newConversation) {
          console.log('✅ Created conversation with previous knowledge:', usePreviousKnowledge);
          onSwitchToConversation?.(newConversation.id);
        }
      } catch (error) {
        console.error('Error creating conversation:', error);
      }
      return;
    }

    try {
      // Create new conversation with the chosen knowledge setting
      const { conversationStorage } = await import('../../lib/conversationStorage');
      const title = usePreviousKnowledge ? 'New Chat (Previous Knowledge)' : 'New Chat';
      const newConversation = await conversationStorage.createConversation(title, usePreviousKnowledge);

      if (newConversation) {
        console.log('✅ Created conversation with previous knowledge:', usePreviousKnowledge);
        onSwitchToConversation?.(newConversation.id);

        // The pending query will be sent automatically by the useEffect when conversationId changes
        console.log('📤 Pending query will be sent automatically:', pendingQuery);
      }
    } catch (error) {
      console.error('Error creating conversation:', error);
      setPendingQuery(''); // Clear on error
    }
  };

  const handleSearchFocus = async () => {
    try {
      console.log('🔍 Search bar focused - showing knowledge toggle');

      // Set checking state to prevent premature modal display
      setIsCheckingHistory(true);

      // Check conversation history for informational purposes and context
      const { conversationStorage } = await import('../../lib/conversationStorage');
      const conversations = await conversationStorage.getConversations();

      console.log('📊 User has', conversations.length, 'existing conversations');
      console.log('📊 Conversations:', conversations.map(c => ({ id: c.id, title: c.title })));

      // Update conversation history state (for context, not for disabling)
      const hasHistory = conversations.length > 0;
      console.log('📊 Setting hasConversationHistory to:', hasHistory, '(for context only)');

      // Update both states together
      setHasConversationHistory(hasHistory);
      setIsCheckingHistory(false);

      // Show modal - both options are always enabled for all users
      console.log('🤔 Showing knowledge toggle modal (both options enabled)');
      setShowKnowledgeToggle(true);
    } catch (error) {
      console.error('❌ Error checking conversation history:', error);
      setIsCheckingHistory(false);
      // Show modal anyway since both options are always enabled
      setShowKnowledgeToggle(true);
    }
  };

  const handleSearchQuery = async (query: string): Promise<string> => {
    try {
      console.log('🔍 Starting search query:', query);

      // For all users (guest and logged-in), store query and wait for toggle choice
      console.log('🤔 Storing query for after toggle choice');
      setPendingQuery(query);

      // Toggle should already be showing from onFocus, but ensure it's visible
      if (!showKnowledgeToggle) {
        setShowKnowledgeToggle(true);
      }
      return '';

    } catch (error) {
      console.error('❌ Error processing search query:', error);
      throw error;
    }
  };

  const executeSearch = async (query: string, usePreviousKnowledge: boolean): Promise<string> => {
    try {
      setIsLoading(true);

      // Add user message to search messages
      const userMessage: Message = {
        id: `user-${Date.now()}`,
        conversation_id: 'search',
        role: 'user',
        content: query,
        is_summary: false,
        summary_details: null,
        created_at: new Date().toISOString()
      };

      setSearchMessages(prev => [...prev, userMessage]);

      const { apiService } = await import('../../lib/api');
      const result = await apiService.searchQuery(query);
      console.log('✅ Search result received:', result);

      // Clean up any remaining markdown formatting
      const cleanResponse = result.response
        .replace(/\*\*(.*?)\*\*/g, '$1') // Remove **bold**
        .replace(/\*(.*?)\*/g, '$1') // Remove *italic*
        .replace(/#{1,6}\s+/g, '') // Remove # headers
        .replace(/`{1,3}(.*?)`{1,3}/g, '$1') // Remove `code` and ```code blocks```
        .replace(/\[(.*?)\]\(.*?\)/g, '$1') // Remove [links](url)
        .replace(/^\s*[-*+]\s+/gm, '• ') // Convert markdown bullets to bullet points
        .replace(/^\s*(\d+)\.\s+/gm, '$1. ') // Clean up numbered lists
        .replace(/\n{3,}/g, '\n\n') // Remove excessive line breaks
        .trim(); // Remove leading/trailing whitespace

      // Add AI response message to search messages
      const aiMessage: Message = {
        id: `ai-${Date.now()}`,
        conversation_id: 'search',
        role: 'assistant',
        content: cleanResponse,
        is_summary: false,
        summary_details: null,
        created_at: new Date().toISOString()
      };

      setSearchMessages(prev => [...prev, aiMessage]);
      return result.response;
    } catch (error) {
      console.error('❌ Error processing search query:', error);

      // Add error message
      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        conversation_id: 'search',
        role: 'assistant',
        content: 'Sorry, I encountered an error while processing your query. Please try again.',
        is_summary: false,
        summary_details: null,
        created_at: new Date().toISOString()
      };

      setSearchMessages(prev => [...prev, errorMessage]);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Helper function to create SubChat-specific context
  const createSubChatContext = (userQuestion: string, selectedText: string, parentMessageContent: string, conversationMessages: Message[]): string => {
    // Create a summary of the main conversation for context
    const conversationSummary = conversationMessages.slice(-3).map(m =>
      `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content.substring(0, 80)}${m.content.length > 80 ? '...' : ''}`
    ).join('\n');

    // Structure the message to focus on selected text
    return `SUBCHAT CONTEXT:
You are in a SubChat focused on discussing a specific part of a previous message. 

MAIN CONVERSATION SUMMARY (for background context only):
${conversationSummary}

SELECTED TEXT TO DISCUSS (primary focus):
"${selectedText}"

FULL PARENT MESSAGE (for additional context if needed):
"${parentMessageContent}"

USER'S QUESTION ABOUT THE SELECTED TEXT:
${userQuestion}

INSTRUCTIONS:
- Focus your response on the selected text: "${selectedText}"
- Use the conversation summary only for background context
- Answer the user's question specifically about the selected text
- Keep your response relevant to the selected portion, not the entire message`;
  };

  // Helper function to generate SubChat-focused responses
  const generateSubChatResponse = (userQuestion: string, selectedText: string, parentMessageContent: string, conversationMessages: Message[]): string => {
    const lowerQuestion = userQuestion.toLowerCase();

    // Create a more contextual response based on the selected text and question
    let response = '';

    if (selectedText && selectedText.trim()) {
      response += `Focusing on the selected text: "${selectedText.length > 100 ? selectedText.substring(0, 100) + '...' : selectedText}"\n\n`;
    }

    // Generate response based on question type
    if (lowerQuestion.includes('explain') || lowerQuestion.includes('what') || lowerQuestion.includes('clarify')) {
      response += `Let me explain this specific part in more detail:\n\n`;
      response += getSelectedTextExplanation(selectedText, userQuestion);
    } else if (lowerQuestion.includes('why') || lowerQuestion.includes('reason') || lowerQuestion.includes('because')) {
      response += `Here's the reasoning behind this:\n\n`;
      response += getReasoningForSelectedText(selectedText, userQuestion);
    } else if (lowerQuestion.includes('how') || lowerQuestion.includes('implement') || lowerQuestion.includes('do')) {
      response += `Here's how this works:\n\n`;
      response += getImplementationDetails(selectedText, userQuestion);
    } else if (lowerQuestion.includes('example') || lowerQuestion.includes('show') || lowerQuestion.includes('demonstrate')) {
      response += `Here are some examples:\n\n`;
      response += getExamplesForSelectedText(selectedText, userQuestion);
    } else {
      response += getGeneralResponseForSelectedText(selectedText, userQuestion, parentMessageContent);
    }

    // Add connection to broader context if relevant
    if (selectedText && parentMessageContent && selectedText !== parentMessageContent) {
      response += `\n\nThis relates to the broader message by providing ${getConnectionToMainMessage(selectedText, parentMessageContent)}.`;
    }

    return response;
  };

  // Helper functions for generating focused responses
  const getSelectedTextExplanation = (selectedText: string, question: string): string => {
    if (selectedText.includes('algorithm') || selectedText.includes('function') || selectedText.includes('method')) {
      return 'This refers to a computational approach or programming concept. The key aspects include how it processes data, what inputs it expects, and what outputs it produces. Understanding this helps in implementing similar solutions or debugging issues.';
    } else if (selectedText.includes('data') || selectedText.includes('structure') || selectedText.includes('array') || selectedText.includes('object')) {
      return 'This describes a data organization concept. It defines how information is stored, accessed, and manipulated. The structure determines performance characteristics and use cases.';
    } else if (selectedText.includes('error') || selectedText.includes('issue') || selectedText.includes('problem')) {
      return 'This identifies a specific problem or challenge. Understanding the root cause helps in finding appropriate solutions and preventing similar issues in the future.';
    } else if (selectedText.includes('feature') || selectedText.includes('functionality') || selectedText.includes('capability')) {
      return 'This describes a specific capability or feature. It outlines what the system can do, how users interact with it, and what benefits it provides.';
    } else {
      return 'This represents an important concept that benefits from detailed explanation. Let me break down the key components and their significance in the broader context.';
    }
  };

  const getImplementationDetails = (selectedText: string, question: string): string => {
    return `To implement or work with this concept:

1. **Understanding the Requirements**: First, identify what specific outcome you're trying to achieve
2. **Breaking Down the Components**: Analyze the individual parts and how they work together  
3. **Step-by-Step Approach**: Follow a systematic process to implement or apply this concept
4. **Testing and Validation**: Ensure the implementation works as expected
5. **Optimization**: Look for ways to improve performance or efficiency

The specific approach depends on your particular use case and constraints.`;
  };

  const getDetailedExplanation = (selectedText: string, question: string): string => {
    return `Let me break down this specific part for you. The key aspects of "${selectedText.substring(0, 30)}..." include the fundamental principles and practical applications that make this concept important in its context.`;
  };

  const getReasoningForSelectedText = (selectedText: string, question: string): string => {
    if (selectedText.includes('because') || selectedText.includes('since') || selectedText.includes('due to')) {
      return `The reasoning is built into the text itself. This approach is chosen because it provides clear cause-and-effect relationships that help in understanding the underlying logic.`;
    } else if (selectedText.includes('should') || selectedText.includes('must') || selectedText.includes('need')) {
      return `This represents a requirement or recommendation. The reasoning stems from best practices, constraints, or specific goals that need to be achieved.`;
    } else {
      return `The reasoning behind this concept involves several factors: practical considerations, theoretical foundations, and real-world constraints. It's designed to address specific challenges while maintaining efficiency and reliability.`;
    }
  };

  const getConnectionToMainMessage = (selectedText: string, parentMessage: string): string => {
    if (parentMessage.length > selectedText.length * 3) {
      return 'specific detail within a broader explanation, adding depth to the overall understanding';
    } else if (selectedText.length > parentMessage.length * 0.7) {
      return 'central theme that represents the core message being conveyed';
    } else {
      return 'supporting information that enhances and clarifies the main points discussed';
    }
  };

  const getExamplesForSelectedText = (selectedText: string, question: string): string => {
    const examples = [];

    if (selectedText.includes('code') || selectedText.includes('programming') || selectedText.includes('function')) {
      examples.push('• **Code Example**: Implementation patterns and syntax variations');
      examples.push('• **Use Cases**: Common scenarios where this approach is beneficial');
      examples.push('• **Best Practices**: Recommended ways to apply this concept');
    } else if (selectedText.includes('data') || selectedText.includes('information')) {
      examples.push('• **Data Formats**: Different ways to structure and organize this information');
      examples.push('• **Processing Methods**: Techniques for handling and manipulating the data');
      examples.push('• **Real-world Applications**: How this applies in practical situations');
    } else {
      examples.push('• **Practical Applications**: Real-world scenarios where this concept applies');
      examples.push('• **Related Concepts**: Similar ideas that build upon this foundation');
      examples.push('• **Implementation Strategies**: Different approaches to working with this concept');
    }

    return examples.join('\n');
  };

  const getGeneralResponseForSelectedText = (selectedText: string, question: string, parentMessage: string): string => {
    const textLength = selectedText.length;
    const isShortText = textLength < 50;
    const isLongText = textLength > 200;

    let response = `Regarding your question about this ${isShortText ? 'specific point' : isLongText ? 'detailed section' : 'particular aspect'}:\n\n`;

    if (isShortText) {
      response += `"${selectedText}" represents a concise but important element. `;
    } else if (isLongText) {
      response += `This section covers multiple related concepts. `;
    } else {
      response += `This part addresses a key aspect of the topic. `;
    }

    response += `It's significant because it provides specific insight that helps clarify the broader discussion. The importance lies in how it connects to the overall context and contributes to a complete understanding of the subject matter.`;

    return response;
  };

  // Don't replace the entire view, render SubChat as overlay

  return (
    <div className="flex flex-col h-full relative">
      {/* Main Chat Content - with dimming when SubChat is open */}
      <div className={`flex flex-col h-full transition-all duration-300 ${subChatOpen
        ? 'opacity-60 transform scale-[0.98] pointer-events-none'
        : 'opacity-100 transform scale-100'
        }`}>
        {/* Header - branchat style */}
        <div className="flex items-center justify-between px-6 py-3 bg-white dark:bg-[#1a1a1a]">
          <div className="flex items-center gap-4">
            <button
              onClick={onToggleLeftSidebar}
              className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors md:hidden"
              aria-label="Toggle sidebar"
            >
              <Menu size={20} className="text-gray-600 dark:text-gray-400" />
            </button>
            
            {/* Title */}
            <div className="flex items-center">
              <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                {conversation?.title || 'branchat'}
              </h1>
            </div>
            
            {/* Context Indicators */}
            {conversation && messages.length > 0 && (
              <div className="flex items-center gap-2">
                {mergedSubChatHistories.length > 0 && (
                  <div className="flex items-center gap-1 px-2 py-1 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 text-xs rounded-full">
                    <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse"></div>
                    <span className="font-medium">+Context ({mergedSubChatHistories.length})</span>
                  </div>
                )}

                {conversation?.use_previous_knowledge && (
                  <div className="flex items-center gap-1 px-2 py-1 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 text-xs rounded-full">
                    <div className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-pulse"></div>
                    <span className="font-medium">+Memory</span>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            {!user || user?.isGuest ? (
              <button
                onClick={() => setShowLoginModal(true)}
                className="bg-[#1a73e8] hover:bg-[#1557b0] text-white px-4 py-2 rounded-full font-medium text-sm transition-colors shadow-sm"
                aria-label="Login"
              >
                Sign in
              </button>
            ) : (
              <UserSettingsDropdown
                onOpenProfile={() => setShowProfileModal(true)}
                onOpenSecurity={() => setShowSecurityModal(true)}
                onOpenSettings={() => setShowSettingsModal(true)}
                onDeleteAccount={() => setShowDeleteAccountModal(true)}
              />
            )}
          </div>
        </div>

        {/* Memory Banner */}
        {conversation?.use_memory && summaries.length > 0 && (
          <MemoryBanner
            summaries={summaries}
            onToggleSummary={(id, active) => {
              setSummaries(prev =>
                prev.map(s => s.id === id ? { ...s, is_active: active } : s)
              );
            }}
          />
        )}

        {conversationId ? (
          /* When conversation exists - normal layout */
          <>
            {/* Show centered loader when loading without messages */}
            {isLoading && messages.length === 0 ? (
              <div className="flex-1 flex items-center justify-center bg-white dark:bg-[#1a1a1a]">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-8 h-8 flex items-center justify-center">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" className="text-blue-500">
                      <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M2 17L12 22L22 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M2 12L12 17L22 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <div className="flex items-center gap-1 loading-dots">
                    <div className="w-2 h-2 bg-gray-500 dark:bg-gray-400 rounded-full dot"></div>
                    <div className="w-2 h-2 bg-gray-500 dark:bg-gray-400 rounded-full dot"></div>
                    <div className="w-2 h-2 bg-gray-500 dark:bg-gray-400 rounded-full dot"></div>
                  </div>
                </div>
              </div>
            ) : (
              <>
                {/* Messages */}
                <div className="flex-1 overflow-y-auto bg-white dark:bg-[#1a1a1a]">
                  <BranchatMessageList
                    messages={messages}
                    isLoading={isLoading}
                    onAskFollowUp={handleAskFollowUp}
                    onOpenSubChat={handleOpenSubChat}
                    onOpenExistingSubChat={handleOpenExistingSubChat}
                    subChatHistories={mergedSubChatHistories}
                    onViewDetails={(messageId) => {
                      const message = messages.find(m => m.id === messageId);
                      if (message?.summary_details?.sub_chat_id) {
                        // Open sub-chat in read-only mode for review
                        setCurrentSubChatId(message.summary_details.sub_chat_id);
                        setSubChatParentMessage(message);
                        setSubChatParentMessageId(messageId);
                        setSubChatSelectedText(''); // No selected text for read-only view
                        setSubChatMessages([]); // Would load from API in real implementation
                        setIsSubChatReadOnly(true);
                        setSubChatMergedSummary(message.summary_details.summary_preview || '');
                        setSubChatOpen(true);
                      }
                    }}
                  />
                </div>

                {/* Composer at bottom */}
                <div className="bg-white dark:bg-[#1a1a1a]">
                  <BranchatComposer
                    onSend={(content) => {
                      if (conversationId) {
                        handleSendMessage(content);
                        handleClearContext(); // Clear context after sending
                      }
                    }}
                    disabled={isLoading || showKnowledgeToggle}
                    initialValue={followUpText}
                    selectedContext={selectedContext}
                    onClearContext={handleClearContext}
                    autoSend={false}
                    onAutoSendComplete={() => {
                      setFollowUpText('');
                    }}
                    placeholder={showKnowledgeToggle ? "Choose how to continue above..." : (selectedContext ? "Ask a question about the selected text..." : (messages.length > 0 ? (conversation?.use_previous_knowledge ? "Continue with full context + previous knowledge..." : (mergedSubChatHistories.length > 0 ? "Continue with full context + SubChat insights..." : "Continue the conversation (I remember everything)...")) : "Ask branchat"))}
                  />
                </div>
              </>
            )}
          </>
        ) : (
          /* When no conversation - centered layout with greeting and composer */
          <div className="flex-1 flex flex-col justify-center items-center p-8 bg-white dark:bg-[#1a1a1a]">
            <div className="text-center max-w-2xl mx-auto w-full mb-8">
              {justDeletedConversation ? (
                <>
                  <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
                    Conversation Deleted
                  </h2>
                  <p className="text-gray-600 dark:text-gray-400 mb-4">
                    Your conversation has been deleted. Choose how you'd like to start a new conversation.
                  </p>
                  <button
                    onClick={onNewChatRequest}
                    className="px-6 py-3 bg-[#1a73e8] hover:bg-[#1557b0] text-white rounded-full font-medium transition-colors shadow-md hover:shadow-lg"
                  >
                    Start New Conversation
                  </button>
                </>
              ) : (
                <>
                  <h2 className="text-5xl font-normal text-gray-900 dark:text-gray-100 mb-4">
                    Hello, {user?.name || user?.email?.split('@')[0] || 'there'}
                  </h2>
                  <p className="text-gray-600 dark:text-gray-400 text-lg mb-8">
                    What can I help you with today?
                  </p>
                </>
              )}
            </div>

            {/* Centered Composer for welcome screen */}
            {!justDeletedConversation && (
              <div className="w-full max-w-3xl">
                <BranchatComposer
                  onSend={(content) => {
                    // This will be handled by search mode
                  }}
                  onSearch={handleSearchQuery}
                  onFocus={handleSearchFocus}
                  disabled={isLoading || showKnowledgeToggle}
                  initialValue={followUpText}
                  selectedContext={selectedContext}
                  onClearContext={handleClearContext}
                  autoSend={false}
                  onAutoSendComplete={() => {
                    setFollowUpText('');
                  }}
                  isSearchMode={true}
                  placeholder={showKnowledgeToggle ? "Choose how to continue above..." : "Ask branchat"}
                />
              </div>
            )}

            {/* Search Results */}
            {searchMessages.length > 0 && (
              <div className="w-full max-w-4xl mt-8">
                <BranchatMessageList
                  messages={searchMessages}
                  isLoading={isLoading}
                  onAskFollowUp={() => { }}
                  onOpenSubChat={() => { }}
                  onViewDetails={() => { }}
                />
              </div>
            )}
          </div>
        )}

        {/* Login Modal */}
        <LoginModal
          isOpen={showLoginModal}
          onClose={() => setShowLoginModal(false)}
        />

        {/* Settings Modals */}
        <UserProfileModal
          isOpen={showProfileModal}
          onClose={() => setShowProfileModal(false)}
        />

        <SecurityModal
          isOpen={showSecurityModal}
          onClose={() => setShowSecurityModal(false)}
        />

        <GeneralSettingsModal
          isOpen={showSettingsModal}
          onClose={() => setShowSettingsModal(false)}
        />

        <DeleteAccountModal
          isOpen={showDeleteAccountModal}
          onClose={() => setShowDeleteAccountModal(false)}
        />

        {/* Knowledge Toggle Modal - only show after history check is complete */}
        <NewChatModal
          isOpen={showKnowledgeToggle && !isCheckingHistory}
          onClose={() => {
            setShowKnowledgeToggle(false);
            setPendingQuery('');
          }}
          onCreateChat={handleKnowledgeToggleChoice}
          isKnowledgeToggle={true}
          hasConversationHistory={hasConversationHistory}
        />
      </div>

      {/* SubChat Overlay */}
      {subChatOpen && subChatParentMessage && (
        <BranchatSubChat
          isOpen={subChatOpen}
          onClose={() => {
            setSubChatOpen(false);
            setSubChatMessages([]);
            setCurrentSubChatId(null);
            setSubChatParentMessage(null);
            setSubChatParentMessageId('');
            setSubChatSelectedText('');
            setIsSubChatReadOnly(false);
            setSubChatMergedSummary('');
          }}
          messages={subChatMessages}
          parentMessageContent={subChatParentMessage.content}
          parentMessageId={subChatParentMessage.id}
          selectedText={subChatSelectedText}
          onSendMessage={handleSendSubChatMessage}
          onMerge={handleMerge}
          onContinueWithoutMerge={handleContinueWithoutMerge}
          onContinueChat={handleContinueChat}
          isLoading={isSubChatLoading}
          isMerging={isMerging}
          isReadOnly={isSubChatReadOnly}
          mergedSummary={subChatMergedSummary}
        />
      )}
    </div>
  );
}