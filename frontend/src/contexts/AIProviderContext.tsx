/**
 * AI Provider Context
 * 
 * Manages AI provider state and provider switching
 * Provides unified interface for Chrome AI and server fallback
 */

import { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import { aiService } from '../services/AIService';
import { AIProvider, AIResponse } from '../types/ai-provider.interface';

// Provider types
export type ProviderType = 'chrome-builtin' | 'server-fallback' | 'unavailable';

// Provider status
interface ProviderStatus {
  name: string;
  type: ProviderType;
  available: boolean;
  capabilities: {
    promptAPI: boolean;
    summarizerAPI: boolean;
    writerAPI: boolean;
    rewriterAPI: boolean;
  };
  lastChecked: Date;
  error?: string;
}

// State interface
interface AIProviderState {
  // Current provider
  currentProvider: ProviderStatus | null;
  availableProviders: ProviderStatus[];
  
  // Status
  isInitialized: boolean;
  isChecking: boolean;
  
  // Last response
  lastResponse: AIResponse | null;
  
  // Error handling
  error: string | null;
  
  // Metrics
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
}

// Action types
type AIProviderAction =
  | { type: 'SET_INITIALIZED'; payload: boolean }
  | { type: 'SET_CHECKING'; payload: boolean }
  | { type: 'SET_CURRENT_PROVIDER'; payload: ProviderStatus | null }
  | { type: 'SET_AVAILABLE_PROVIDERS'; payload: ProviderStatus[] }
  | { type: 'SET_LAST_RESPONSE'; payload: AIResponse | null }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'CLEAR_ERROR' }
  | { type: 'INCREMENT_REQUEST' }
  | { type: 'INCREMENT_SUCCESS' }
  | { type: 'INCREMENT_FAILURE' }
  | { type: 'RESET_METRICS' };

// Initial state
const initialState: AIProviderState = {
  currentProvider: null,
  availableProviders: [],
  isInitialized: false,
  isChecking: false,
  lastResponse: null,
  error: null,
  totalRequests: 0,
  successfulRequests: 0,
  failedRequests: 0,
};

// Reducer function
function aiProviderReducer(state: AIProviderState, action: AIProviderAction): AIProviderState {
  switch (action.type) {
    case 'SET_INITIALIZED':
      return {
        ...state,
        isInitialized: action.payload,
      };
    
    case 'SET_CHECKING':
      return {
        ...state,
        isChecking: action.payload,
      };
    
    case 'SET_CURRENT_PROVIDER':
      return {
        ...state,
        currentProvider: action.payload,
        error: null,
      };
    
    case 'SET_AVAILABLE_PROVIDERS':
      return {
        ...state,
        availableProviders: action.payload,
      };
    
    case 'SET_LAST_RESPONSE':
      return {
        ...state,
        lastResponse: action.payload,
        error: null,
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
    
    case 'INCREMENT_REQUEST':
      return {
        ...state,
        totalRequests: state.totalRequests + 1,
      };
    
    case 'INCREMENT_SUCCESS':
      return {
        ...state,
        successfulRequests: state.successfulRequests + 1,
      };
    
    case 'INCREMENT_FAILURE':
      return {
        ...state,
        failedRequests: state.failedRequests + 1,
      };
    
    case 'RESET_METRICS':
      return {
        ...state,
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
      };
    
    default:
      return state;
  }
}

// Context interface
interface AIProviderContextType {
  state: AIProviderState;
  
  // Actions
  initialize: () => Promise<void>;
  checkProviders: () => Promise<void>;
  switchProvider: (providerName: string) => Promise<boolean>;
  
  // AI operations
  generateResponse: (messages: any[], options?: any) => Promise<AIResponse>;
  summarize: (text: string, options?: any) => Promise<any>;
  write: (prompt: string, options?: any) => Promise<string>;
  
  // Utility
  clearError: () => void;
  resetMetrics: () => void;
  
  // Computed values
  isAvailable: boolean;
  providerName: string;
  providerType: ProviderType;
  successRate: number;
  isChromeAI: boolean;
  isServerFallback: boolean;
}

// Create context
const AIProviderContext = createContext<AIProviderContextType | undefined>(undefined);

// Provider component
export function AIProviderProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(aiProviderReducer, initialState);

  // Initialize AI service
  const initialize = async () => {
    try {
      dispatch({ type: 'SET_CHECKING', payload: true });
      await aiService.initialize();
      dispatch({ type: 'SET_INITIALIZED', payload: true });
      await checkProviders();
    } catch (error) {
      console.error('Failed to initialize AI service:', error);
      dispatch({ type: 'SET_ERROR', payload: 'Failed to initialize AI service' });
    } finally {
      dispatch({ type: 'SET_CHECKING', payload: false });
    }
  };

  // Check available providers
  const checkProviders = async () => {
    try {
      dispatch({ type: 'SET_CHECKING', payload: true });
      
      const status = await aiService.getStatus();
      
      // Convert to provider status format
      const providers: ProviderStatus[] = status.available.map(name => ({
        name,
        type: name === 'chrome-builtin' ? 'chrome-builtin' : 'server-fallback',
        available: true,
        capabilities: {
          promptAPI: true, // Simplified for now
          summarizerAPI: true,
          writerAPI: true,
          rewriterAPI: true,
        },
        lastChecked: new Date(),
      }));

      // Add unavailable providers
      if (status.unavailable.length > 0) {
        status.unavailable.forEach(name => {
          providers.push({
            name,
            type: name === 'chrome-builtin' ? 'chrome-builtin' : 'server-fallback',
            available: false,
            capabilities: {
              promptAPI: false,
              summarizerAPI: false,
              writerAPI: false,
              rewriterAPI: false,
            },
            lastChecked: new Date(),
          });
        });
      }

      dispatch({ type: 'SET_AVAILABLE_PROVIDERS', payload: providers });
      
      // Set current provider
      if (status.selected) {
        const current = providers.find(p => p.name === status.selected);
        if (current) {
          dispatch({ type: 'SET_CURRENT_PROVIDER', payload: current });
        }
      }
    } catch (error) {
      console.error('Failed to check providers:', error);
      dispatch({ type: 'SET_ERROR', payload: 'Failed to check AI providers' });
    } finally {
      dispatch({ type: 'SET_CHECKING', payload: false });
    }
  };

  // Switch provider
  const switchProvider = async (providerName: string): Promise<boolean> => {
    try {
      const success = await aiService.switchProvider(providerName);
      if (success) {
        // Update current provider
        const provider = state.availableProviders.find(p => p.name === providerName);
        if (provider) {
          dispatch({ type: 'SET_CURRENT_PROVIDER', payload: provider });
        }
      }
      return success;
    } catch (error) {
      console.error('Failed to switch provider:', error);
      dispatch({ type: 'SET_ERROR', payload: `Failed to switch to ${providerName}` });
      return false;
    }
  };

  // AI operations
  const generateResponse = async (messages: any[], options?: any): Promise<AIResponse> => {
    try {
      dispatch({ type: 'INCREMENT_REQUEST' });
      
      const response = await aiService.generateResponse(messages, options);
      
      dispatch({ type: 'SET_LAST_RESPONSE', payload: response });
      dispatch({ type: 'INCREMENT_SUCCESS' });
      
      return response;
    } catch (error) {
      console.error('Failed to generate response:', error);
      dispatch({ type: 'INCREMENT_FAILURE' });
      dispatch({ type: 'SET_ERROR', payload: 'Failed to generate response' });
      throw error;
    }
  };

  const summarize = async (text: string, options?: any): Promise<any> => {
    try {
      dispatch({ type: 'INCREMENT_REQUEST' });
      
      const result = await aiService.summarize(text, options);
      
      dispatch({ type: 'INCREMENT_SUCCESS' });
      
      return result;
    } catch (error) {
      console.error('Failed to summarize:', error);
      dispatch({ type: 'INCREMENT_FAILURE' });
      dispatch({ type: 'SET_ERROR', payload: 'Failed to summarize text' });
      throw error;
    }
  };

  const write = async (prompt: string, options?: any): Promise<string> => {
    try {
      dispatch({ type: 'INCREMENT_REQUEST' });
      
      const result = await aiService.write(prompt, options);
      
      dispatch({ type: 'INCREMENT_SUCCESS' });
      
      return result;
    } catch (error) {
      console.error('Failed to write:', error);
      dispatch({ type: 'INCREMENT_FAILURE' });
      dispatch({ type: 'SET_ERROR', payload: 'Failed to generate content' });
      throw error;
    }
  };

  // Utility functions
  const clearError = () => {
    dispatch({ type: 'CLEAR_ERROR' });
  };

  const resetMetrics = () => {
    dispatch({ type: 'RESET_METRICS' });
  };

  // Computed values
  const isAvailable = state.currentProvider?.available || false;
  const providerName = state.currentProvider?.name || 'Unknown';
  const providerType = state.currentProvider?.type || 'unavailable';
  const successRate = state.totalRequests > 0 
    ? (state.successfulRequests / state.totalRequests) * 100 
    : 0;
  const isChromeAI = providerType === 'chrome-builtin';
  const isServerFallback = providerType === 'server-fallback';

  // Initialize on mount
  useEffect(() => {
    initialize();
  }, []);

  // Periodic provider check
  useEffect(() => {
    if (!state.isInitialized) return;

    const interval = setInterval(() => {
      checkProviders();
    }, 30000); // Check every 30 seconds

    return () => clearInterval(interval);
  }, [state.isInitialized]);

  const value: AIProviderContextType = {
    state,
    initialize,
    checkProviders,
    switchProvider,
    generateResponse,
    summarize,
    write,
    clearError,
    resetMetrics,
    isAvailable,
    providerName,
    providerType,
    successRate,
    isChromeAI,
    isServerFallback,
  };

  return (
    <AIProviderContext.Provider value={value}>
      {children}
    </AIProviderContext.Provider>
  );
}

// Hook to use AI provider context
export function useAIProvider() {
  const context = useContext(AIProviderContext);
  if (context === undefined) {
    throw new Error('useAIProvider must be used within an AIProviderProvider');
  }
  return context;
}

// Selective hooks
export function useAIProviderState() {
  const { state } = useAIProvider();
  return state;
}

export function useAIProviderActions() {
  const {
    initialize,
    checkProviders,
    switchProvider,
    generateResponse,
    summarize,
    write,
    clearError,
    resetMetrics,
  } = useAIProvider();
  
  return {
    initialize,
    checkProviders,
    switchProvider,
    generateResponse,
    summarize,
    write,
    clearError,
    resetMetrics,
  };
}

export function useAIProviderComputed() {
  const {
    isAvailable,
    providerName,
    providerType,
    successRate,
    isChromeAI,
    isServerFallback,
  } = useAIProvider();
  
  return {
    isAvailable,
    providerName,
    providerType,
    successRate,
    isChromeAI,
    isServerFallback,
  };
}
