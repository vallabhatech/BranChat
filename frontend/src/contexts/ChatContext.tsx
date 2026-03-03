/**
 * Chat Context Provider
 * 
 * Centralized state management for chat functionality
 * Reduces prop drilling and provides consistent state across components
 */

import { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import { Message, Conversation, Summary } from '../types';
import { conversationStorage, messageStorage } from '../lib/conversationStorage';

// State interface
interface ChatState {
  // Current conversation
  currentConversationId: string | undefined;
  conversation: Conversation | null;
  messages: Message[];
  summaries: Summary[];
  
  // Loading states
  isLoading: boolean;
  isSending: boolean;
  isSearching: boolean;
  
  // Search functionality
  searchQuery: string;
  searchResults: Message[];
  
  // UI state
  showNewChatModal: boolean;
  hasConversationHistory: boolean;
  
  // Error handling
  error: string | null;
}

// Action types
type ChatAction =
  | { type: 'SET_CURRENT_CONVERSATION'; payload: string | undefined }
  | { type: 'SET_CONVERSATION'; payload: Conversation | null }
  | { type: 'SET_MESSAGES'; payload: Message[] }
  | { type: 'ADD_MESSAGE'; payload: Message }
  | { type: 'SET_SUMMARIES'; payload: Summary[] }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_SENDING'; payload: boolean }
  | { type: 'SET_SEARCHING'; payload: boolean }
  | { type: 'SET_SEARCH_QUERY'; payload: string }
  | { type: 'SET_SEARCH_RESULTS'; payload: Message[] }
  | { type: 'TOGGLE_NEW_CHAT_MODAL' }
  | { type: 'SET_CONVERSATION_HISTORY'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'CLEAR_ERROR' }
  | { type: 'RESET_STATE' };

// Initial state
const initialState: ChatState = {
  currentConversationId: undefined,
  conversation: null,
  messages: [],
  summaries: [],
  isLoading: false,
  isSending: false,
  isSearching: false,
  searchQuery: '',
  searchResults: [],
  showNewChatModal: false,
  hasConversationHistory: false,
  error: null,
};

// Reducer function
function chatReducer(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case 'SET_CURRENT_CONVERSATION':
      return {
        ...state,
        currentConversationId: action.payload,
        error: null,
      };
    
    case 'SET_CONVERSATION':
      return {
        ...state,
        conversation: action.payload,
        error: null,
      };
    
    case 'SET_MESSAGES':
      return {
        ...state,
        messages: action.payload,
        error: null,
      };
    
    case 'ADD_MESSAGE':
      return {
        ...state,
        messages: [...state.messages, action.payload],
        error: null,
      };
    
    case 'SET_SUMMARIES':
      return {
        ...state,
        summaries: action.payload,
        error: null,
      };
    
    case 'SET_LOADING':
      return {
        ...state,
        isLoading: action.payload,
      };
    
    case 'SET_SENDING':
      return {
        ...state,
        isSending: action.payload,
      };
    
    case 'SET_SEARCHING':
      return {
        ...state,
        isSearching: action.payload,
      };
    
    case 'SET_SEARCH_QUERY':
      return {
        ...state,
        searchQuery: action.payload,
        error: null,
      };
    
    case 'SET_SEARCH_RESULTS':
      return {
        ...state,
        searchResults: action.payload,
        error: null,
      };
    
    case 'TOGGLE_NEW_CHAT_MODAL':
      return {
        ...state,
        showNewChatModal: !state.showNewChatModal,
      };
    
    case 'SET_CONVERSATION_HISTORY':
      return {
        ...state,
        hasConversationHistory: action.payload,
      };
    
    case 'SET_ERROR':
      return {
        ...state,
        error: action.payload,
      };
    
    case 'CLEAR_ERROR':
      return {
        ...state,
        error: null,
      };
    
    case 'RESET_STATE':
      return {
        ...initialState,
        currentConversationId: state.currentConversationId, // Preserve current conversation
      };
    
    default:
      return state;
  }
}

// Context interface
interface ChatContextType {
  state: ChatState;
  // Actions
  setCurrentConversation: (id: string | undefined) => void;
  setConversation: (conversation: Conversation | null) => void;
  setMessages: (messages: Message[]) => void;
  addMessage: (message: Message) => void;
  setSummaries: (summaries: Summary[]) => void;
  setLoading: (loading: boolean) => void;
  setSending: (sending: boolean) => void;
  setSearching: (searching: boolean) => void;
  setSearchQuery: (query: string) => void;
  setSearchResults: (results: Message[]) => void;
  toggleNewChatModal: () => void;
  setConversationHistory: (hasHistory: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
  resetState: () => void;
  
  // Computed values
  hasMessages: boolean;
  canSendMessage: boolean;
  isSearchActive: boolean;
}

// Create context
const ChatContext = createContext<ChatContextType | undefined>(undefined);

// Provider component
export function ChatProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(chatReducer, initialState);

  // Actions
  const setCurrentConversation = (id: string | undefined) => {
    dispatch({ type: 'SET_CURRENT_CONVERSATION', payload: id });
  };

  const setConversation = (conversation: Conversation | null) => {
    dispatch({ type: 'SET_CONVERSATION', payload: conversation });
  };

  const setMessages = (messages: Message[]) => {
    dispatch({ type: 'SET_MESSAGES', payload: messages });
  };

  const addMessage = (message: Message) => {
    dispatch({ type: 'ADD_MESSAGE', payload: message });
  };

  const setSummaries = (summaries: Summary[]) => {
    dispatch({ type: 'SET_SUMMARIES', payload: summaries });
  };

  const setLoading = (loading: boolean) => {
    dispatch({ type: 'SET_LOADING', payload: loading });
  };

  const setSending = (sending: boolean) => {
    dispatch({ type: 'SET_SENDING', payload: sending });
  };

  const setSearching = (searching: boolean) => {
    dispatch({ type: 'SET_SEARCHING', payload: searching });
  };

  const setSearchQuery = (query: string) => {
    dispatch({ type: 'SET_SEARCH_QUERY', payload: query });
  };

  const setSearchResults = (results: Message[]) => {
    dispatch({ type: 'SET_SEARCH_RESULTS', payload: results });
  };

  const toggleNewChatModal = () => {
    dispatch({ type: 'TOGGLE_NEW_CHAT_MODAL' });
  };

  const setConversationHistory = (hasHistory: boolean) => {
    dispatch({ type: 'SET_CONVERSATION_HISTORY', payload: hasHistory });
  };

  const setError = (error: string | null) => {
    dispatch({ type: 'SET_ERROR', payload: error });
  };

  const clearError = () => {
    dispatch({ type: 'CLEAR_ERROR' });
  };

  const resetState = () => {
    dispatch({ type: 'RESET_STATE' });
  };

  // Computed values
  const hasMessages = state.messages.length > 0;
  const canSendMessage = !state.isLoading && !state.isSending && !!state.currentConversationId;
  const isSearchActive = state.searchQuery.length > 0 || state.searchResults.length > 0;

  // Load conversation when ID changes
  useEffect(() => {
    if (state.currentConversationId) {
      loadConversation(state.currentConversationId);
    } else {
      // Clear state when no conversation
      setConversation(null);
      setMessages([]);
      setSummaries([]);
    }
  }, [state.currentConversationId]);

  // Load conversation data
  const loadConversation = async (conversationId: string) => {
    try {
      setLoading(true);
      clearError();

      // Load conversation
      const conversation = await conversationStorage.getConversation(conversationId);
      if (!conversation) {
        setError('Conversation not found');
        return;
      }

      setConversation(conversation);

      // Load messages
      const messages = await messageStorage.getMessages(conversationId);
      setMessages(messages);

      // Load summaries
      const summaries = await messageStorage.getSummaries(conversationId);
      setSummaries(summaries);

    } catch (error) {
      console.error('Failed to load conversation:', error);
      setError('Failed to load conversation');
    } finally {
      setLoading(false);
    }
  };

  const value: ChatContextType = {
    state,
    setCurrentConversation,
    setConversation,
    setMessages,
    addMessage,
    setSummaries,
    setLoading,
    setSending,
    setSearching,
    setSearchQuery,
    setSearchResults,
    toggleNewChatModal,
    setConversationHistory,
    setError,
    clearError,
    resetState,
    hasMessages,
    canSendMessage,
    isSearchActive,
  };

  return (
    <ChatContext.Provider value={value}>
      {children}
    </ChatContext.Provider>
  );
}

// Hook to use chat context
export function useChat() {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
}

// Selective hooks for specific state slices
export function useChatState() {
  const { state } = useChat();
  return state;
}

export function useChatActions() {
  const {
    setCurrentConversation,
    setConversation,
    setMessages,
    addMessage,
    setSummaries,
    setLoading,
    setSending,
    setSearching,
    setSearchQuery,
    setSearchResults,
    toggleNewChatModal,
    setConversationHistory,
    setError,
    clearError,
    resetState,
  } = useChat();
  
  return {
    setCurrentConversation,
    setConversation,
    setMessages,
    addMessage,
    setSummaries,
    setLoading,
    setSending,
    setSearching,
    setSearchQuery,
    setSearchResults,
    toggleNewChatModal,
    setConversationHistory,
    setError,
    clearError,
    resetState,
  };
}

export function useChatComputed() {
  const { hasMessages, canSendMessage, isSearchActive } = useChat();
  return { hasMessages, canSendMessage, isSearchActive };
}
