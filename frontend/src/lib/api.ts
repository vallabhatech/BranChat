import { Conversation, Message, Summary } from '../types';
import { chromeAI } from './chromeAI';

// API service with Chrome Built-in AI integration
class ApiService {
  private baseUrl = (import.meta.env.VITE_API_URL || 'http://localhost:3001') + '/api';
  private enableChromeAI = (import.meta.env.VITE_ENABLE_CHROME_AI as string) !== 'false';

  private getToken() {
    return localStorage.getItem('token') || localStorage.getItem('guestToken');
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    const token = this.getToken();
    const headers = {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` }),
      ...options.headers,
    };

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      if (!response.ok) {
        // If backend is not available, throw fallback error
        if (response.status === 404 || response.status >= 500) {
          throw new Error('API_FALLBACK');
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      // Network errors or CORS issues indicate backend unavailable
      if (error instanceof TypeError || (error as any).name === 'NetworkError') {
        throw new Error('API_FALLBACK');
      }
      throw error;
    }
  }

  // Conversations
  async getConversations(): Promise<any> {
    try {
      return await this.request('/conversations');
    } catch (error) {
      if (error instanceof Error && error.message === 'API_FALLBACK') {
        const { mockApi } = await import('../lib/mockApi');
        return await mockApi.getConversations();
      }
      throw error;
    }
  }

  async getConversation(id: string): Promise<any> {
    try {
      return await this.request(`/conversations/${id}`);
    } catch (error) {
      if (error instanceof Error && error.message === 'API_FALLBACK') {
        const { mockApi } = await import('../lib/mockApi');
        return await mockApi.getConversation(id);
      }
      throw error;
    }
  }

  async getMessages(conversationId: string): Promise<any> {
    try {
      return await this.request(`/conversations/${conversationId}/messages`);
    } catch (error) {
      if (error instanceof Error && error.message === 'API_FALLBACK') {
        const { mockApi } = await import('../lib/mockApi');
        const mockResult = await mockApi.getConversation(conversationId);
        return mockResult.data.messages;
      }
      throw error;
    }
  }

  async startConversation(data: { useMemory: boolean; title: string }): Promise<{ data: { conversation: Conversation } }> {
    try {
      return await this.request('/conversations/start', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    } catch (error) {
      if (error instanceof Error && error.message === 'API_FALLBACK') {
        const { mockApi } = await import('../lib/mockApi');
        return await mockApi.createConversation(data);
      }
      throw error;
    }
  }

  async sendMessage(conversationId: string, content: string): Promise<{ data: { userMessage: Message; assistantMessage: Message } }> {
        
    // ============================================================
    // CHROME BUILT-IN AI - PROMPT API
    // ============================================================
    // Try Chrome's Prompt API first for privacy-first, on-device processing
    // This is the PRIMARY method for generating conversation responses
    // Benefits: Privacy (on-device), Speed (no network), Cost (free), Offline capable
    if (this.enableChromeAI) {
            const aiResponse = await chromeAI.generateResponse(content);
      
      if (aiResponse) {
                // Create message objects for Chrome AI response
        const userMessage: Message = {
          id: `user-${Date.now()}`,
          conversation_id: conversationId,
          role: 'user',
          content,
          is_summary: false,
          summary_details: null,
          created_at: new Date().toISOString(),
        };
        
        const assistantMessage: Message = {
          id: `assistant-${Date.now()}`,
          conversation_id: conversationId,
          role: 'assistant',
          content: aiResponse,
          is_summary: false,
          summary_details: null,
          created_at: new Date().toISOString(),
          metadata: {
            model: 'gemini-nano',
          },
        };
        
        return {
          data: {
            userMessage,
            assistantMessage,
          },
        };
      }
          }
    
    // Fallback to backend API
    try {
            const result = await this.request<{ data: { userMessage: Message; assistantMessage: Message } }>(`/conversations/${conversationId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ content, role: 'user' }),
      });
            return result;
    } catch (error) {
            if (error instanceof Error && error.message === 'API_FALLBACK') {
                const { mockApi } = await import('../lib/mockApi');
        const mockResult = await mockApi.sendMessage(conversationId, content);
                return mockResult;
      }
            throw error;
    }
  }

  // Sub-chats
  async createSubChat(data: { conversationId: string; parentMessageId: string; contextMessage: string; title?: string }): Promise<{ data: { id: string } }> {
    return this.request('/subchats', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async sendSubChatMessage(subChatId: string, content: string): Promise<{ data: { userMessage: Message; assistantMessage: Message } }> {
    return this.request(`/subchats/${subChatId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content, role: 'user' }),
    });
  }

  async mergeSubChat(subChatId: string): Promise<{ data: { summary: { summary: string; fullSummary?: string }; injectedMessage: { id: string } } }> {
    // ============================================================
    // CHROME BUILT-IN AI - SUMMARIZER API
    // ============================================================
    // Try Chrome's Summarizer API first for branch consolidation
    // This automatically creates key-points summaries of branch discussions
    // Benefits: Automatic (no manual work), Fast (instant), Private (on-device)
    if (this.enableChromeAI) {
            
      try {
        // Get subchat messages to summarize
        const subchatData = await this.request<{ data: { messages: Message[] } }>(`/subchats/${subChatId}`);
        const messages = subchatData.data.messages;
        
        // Combine messages into text for summarization
        const conversationText = messages
          .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
          .join('\n\n');
        
        const summary = await chromeAI.summarize(conversationText, {
          type: 'key-points',
          length: 'medium',
        });
        
        if (summary) {
                    return {
            data: {
              summary: {
                summary,
                fullSummary: summary,
              },
              injectedMessage: {
                id: `summary-${Date.now()}`,
              },
            },
          };
        }
      } catch (error) {
              }
    }
    
    // Fallback to backend API
    return this.request(`/subchats/${subChatId}/merge`, {
      method: 'POST',
    });
  }

  // Memory
  async listMemories(): Promise<{ data: Summary[] }> {
    return this.request('/memory/list');
  }

  async retrieveMemories(query: string): Promise<{ data: Summary[] }> {
    return this.request('/memory/retrieve', {
      method: 'POST',
      body: JSON.stringify({ query }),
    });
  }

  // Authentication
  async register(email: string, password: string, name?: string): Promise<{ success: boolean; data: { token: string; user: any } }> {
    try {
      return await this.request('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email, password, name }),
      });
    } catch (error) {
      if (error instanceof Error && error.message === 'API_FALLBACK') {
        const { mockAuth } = await import('../lib/mockApi');
        return await mockAuth.register(email, password, name);
      }
      throw error;
    }
  }

  async login(email: string, password: string): Promise<{ success: boolean; data: { token: string; user: any } }> {
    try {
      return await this.request('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
    } catch (error) {
      if (error instanceof Error && error.message === 'API_FALLBACK') {
        const { mockAuth } = await import('../lib/mockApi');
        return await mockAuth.login(email, password);
      }
      throw error;
    }
  }

  async createGuestToken(): Promise<{ success: boolean; data: { token: string; user: any } }> {
    try {
      return await this.request('/auth/guest', {
        method: 'POST',
      });
    } catch (error) {
      if (error instanceof Error && error.message === 'API_FALLBACK') {
        const { mockAuth } = await import('../lib/mockApi');
        return await mockAuth.createGuestToken();
      }
      throw error;
    }
  }

  async getCurrentUser(): Promise<{ success: boolean; data: any }> {
    try {
      return await this.request('/auth/me');
    } catch (error) {
      if (error instanceof Error && error.message === 'API_FALLBACK') {
        const { mockAuth } = await import('../lib/mockApi');
        return await mockAuth.getCurrentUser();
      }
      throw error;
    }
  }

  async logout(): Promise<{ success: boolean }> {
    try {
      return await this.request('/auth/logout', {
        method: 'POST',
      });
    } catch (error) {
      if (error instanceof Error && error.message === 'API_FALLBACK') {
        // For mock API, just return success
        return { success: true };
      }
      throw error;
    }
  }

  // AI Search
  async searchQuery(query: string): Promise<{ response: string; query: string; timestamp: string }> {
    try {
      // Ensure we have a token for the search request
      let token = this.getToken();

      // If no token, try to get a guest token
      if (!token) {
        try {
          const guestResponse = await this.createGuestToken();
          token = guestResponse.data.token;
          localStorage.setItem('token', token);
        } catch (guestError) {
                  }
      }

      return await this.request('/ai/search', {
        method: 'POST',
        body: JSON.stringify({ query }),
      });
    } catch (error) {
      if (error instanceof Error && error.message === 'API_FALLBACK') {
        // Fallback to mock response
        return {
          response: `This is a mock response to your query: "${query}". The backend AI service is not available, but in a real implementation, this would provide intelligent answers using Gemini AI.`,
          query,
          timestamp: new Date().toISOString()
        };
      }
      throw error;
    }
  }
}

export const apiService = new ApiService();