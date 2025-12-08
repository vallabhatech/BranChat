import { Message, Conversation } from '../types';

const API_BASE_URL = (import.meta.env.VITE_API_URL) + '/api';

// Get auth token
function getAuthToken(): string | null {
  return localStorage.getItem('token') || localStorage.getItem('guestToken');
}

// Get auth headers
function getAuthHeaders(): HeadersInit {
  const token = getAuthToken();
  return {
    'Content-Type': 'application/json',
    ...(token && { 'Authorization': `Bearer ${token}` })
  };
}

// Get current user ID from authentication
function getCurrentUserId(): string {
  const token = getAuthToken();
  if (!token) return 'guest_user';
  
  // Extract user ID from token (in real app, this would be decoded from JWT)
  if (token.startsWith('guest_')) return 'guest_user';
  if (token.startsWith('mock_token_')) return token.replace('mock_token_', 'user_');
  
  // For backend tokens, try to extract user info
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.userId || payload.id || payload.sub || 'user_' + Date.now();
  } catch {
    return 'user_' + Date.now();
  }
}

// Get storage key for user-specific data (fallback for offline mode)
function getUserStorageKey(dataType: string): string {
  const userId = getCurrentUserId();
  return `${dataType}_${userId}`;
}

// Conversation Storage Functions
export const conversationStorage = {
  // Get all conversations for current user from backend
  async getConversations(): Promise<Conversation[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/conversations`, {
        headers: getAuthHeaders(),
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data?.data) {
          const conversations = result.data.data.map((conv: any) => ({
            id: conv.id,
            user_id: getCurrentUserId(),
            title: conv.title,
            use_memory: false, // Default for now
            use_previous_knowledge: conv.usePreviousKnowledge || false,
            parent_conversation_id: null,
            parent_message_id: null,
            created_at: conv.createdAt,
            updated_at: conv.updatedAt,
          }));
          
          // Cache in localStorage as fallback
          const key = getUserStorageKey('conversations');
          localStorage.setItem(key, JSON.stringify(conversations));
          
          console.log('📚 Loaded conversations from backend:', conversations.length);
          return conversations;
        }
      }
      
      // Fallback to localStorage
      return this.getConversationsFromStorage();
    } catch (error) {
      console.error('Error loading conversations from backend:', error);
      return this.getConversationsFromStorage();
    }
  },

  // Fallback: Get conversations from localStorage
  getConversationsFromStorage(): Conversation[] {
    try {
      const key = getUserStorageKey('conversations');
      const stored = localStorage.getItem(key);
      if (stored) {
        const conversations = JSON.parse(stored);
        console.log('📚 Loaded conversations from storage:', conversations.length);
        return conversations;
      }
    } catch (error) {
      console.error('Error loading conversations from storage:', error);
    }
    return [];
  },

  // Create a new conversation with previous knowledge option
  async createConversation(title?: string, usePreviousKnowledge: boolean = false): Promise<Conversation | null> {
    try {
      const response = await fetch(`${API_BASE_URL}/conversations`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ 
          title: title || 'New Conversation',
          usePreviousKnowledge
        }),
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          const conversation: Conversation = {
            id: result.data.id,
            user_id: getCurrentUserId(),
            title: result.data.title,
            use_memory: false,
            use_previous_knowledge: usePreviousKnowledge,
            parent_conversation_id: null,
            parent_message_id: null,
            created_at: result.data.createdAt,
            updated_at: result.data.updatedAt,
          };
          
          console.log('✅ Created new conversation:', conversation.title);
          return conversation;
        }
      }
      
      throw new Error('Failed to create conversation');
    } catch (error) {
      console.error('Error creating conversation:', error);
      
      // Fallback: create locally
      const conversation: Conversation = {
        id: 'local_' + Date.now(),
        user_id: getCurrentUserId(),
        title: title || 'New Conversation',
        use_memory: false,
        use_previous_knowledge: usePreviousKnowledge,
        parent_conversation_id: null,
        parent_message_id: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      
      this.saveConversationToStorage(conversation);
      return conversation;
    }
  },

  // Save conversation to localStorage (fallback)
  saveConversationToStorage(conversation: Conversation): void {
    const conversations = this.getConversationsFromStorage();
    const existingIndex = conversations.findIndex((c: Conversation) => c.id === conversation.id);
    
    if (existingIndex >= 0) {
      conversations[existingIndex] = conversation;
    } else {
      conversations.unshift(conversation);
    }
    
    const key = getUserStorageKey('conversations');
    localStorage.setItem(key, JSON.stringify(conversations));
    console.log('💾 Saved conversation to storage:', conversation.title);
  },

  // Get a specific conversation
  async getConversation(conversationId: string): Promise<Conversation | null> {
    try {
      const response = await fetch(`${API_BASE_URL}/conversations/${conversationId}`, {
        headers: getAuthHeaders(),
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data?.conversation) {
          const conv = result.data.conversation;
          const conversation: Conversation = {
            id: conv.id,
            user_id: getCurrentUserId(),
            title: conv.title,
            use_memory: false,
            use_previous_knowledge: conv.usePreviousKnowledge || false,
            parent_conversation_id: null,
            parent_message_id: null,
            created_at: conv.createdAt,
            updated_at: conv.updatedAt,
          };
          
          console.log('📖 Loaded conversation from backend:', conversation.title);
          return conversation;
        }
      }
      
      // Fallback to localStorage
      const conversations = this.getConversationsFromStorage();
      return conversations.find((c: Conversation) => c.id === conversationId) || null;
    } catch (error) {
      console.error('Error loading conversation:', error);
      const conversations = this.getConversationsFromStorage();
      return conversations.find((c: Conversation) => c.id === conversationId) || null;
    }
  },

  // Get all previous conversations with messages for knowledge context
  async getAllPreviousKnowledge(excludeConversationId?: string): Promise<Array<{
    conversation: Conversation;
    messages: Message[];
  }>> {
    try {
      const conversations = await this.getConversations();
      const previousKnowledge: Array<{
        conversation: Conversation;
        messages: Message[];
      }> = [];

      for (const conversation of conversations) {
        // Skip the current conversation
        if (conversation.id === excludeConversationId) continue;
        
        // Get messages for this conversation
        const messages = await messageStorage.getMessages(conversation.id);
        
        // Only include conversations that have actual content
        if (messages.length > 0) {
          previousKnowledge.push({
            conversation,
            messages
          });
        }
      }

      console.log('📚 Loaded previous knowledge from', previousKnowledge.length, 'conversations');
      return previousKnowledge;
    } catch (error) {
      console.error('Error loading previous knowledge:', error);
      return [];
    }
  },

  // Rename a conversation
  async renameConversation(conversationId: string, newTitle: string): Promise<boolean> {
    try {
      const response = await fetch(`${API_BASE_URL}/conversations/${conversationId}`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ title: newTitle }),
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          console.log('✅ Renamed conversation:', newTitle);
          return true;
        }
      }
      
      throw new Error('Failed to rename conversation');
    } catch (error) {
      console.error('Error renaming conversation:', error);
      
      // Fallback: update locally
      const conversations = this.getConversationsFromStorage();
      const conversationIndex = conversations.findIndex((c: Conversation) => c.id === conversationId);
      
      if (conversationIndex >= 0) {
        conversations[conversationIndex].title = newTitle;
        conversations[conversationIndex].updated_at = new Date().toISOString();
        
        const key = getUserStorageKey('conversations');
        localStorage.setItem(key, JSON.stringify(conversations));
        console.log('💾 Renamed conversation locally:', newTitle);
        return true;
      }
      
      return false;
    }
  },

  // Delete a conversation
  async deleteConversation(conversationId: string): Promise<boolean> {
    try {
      const response = await fetch(`${API_BASE_URL}/conversations/${conversationId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          // Mark recent deletion to prevent auto-initialization
          localStorage.setItem('recent_conversation_deletion', Date.now().toString());
          console.log('✅ Deleted conversation:', conversationId);
          return true;
        }
      }
      
      throw new Error('Failed to delete conversation');
    } catch (error) {
      console.error('Error deleting conversation:', error);
      
      // Fallback: delete locally
      const conversations = this.getConversationsFromStorage();
      const filteredConversations = conversations.filter((c: Conversation) => c.id !== conversationId);
      
      if (filteredConversations.length !== conversations.length) {
        const key = getUserStorageKey('conversations');
        localStorage.setItem(key, JSON.stringify(filteredConversations));
        
        // Also delete messages for this conversation
        const messagesKey = getUserStorageKey('messages');
        const stored = localStorage.getItem(messagesKey) || '{}';
        const allMessages = JSON.parse(stored);
        delete allMessages[conversationId];
        localStorage.setItem(messagesKey, JSON.stringify(allMessages));
        
        // Mark recent deletion to prevent auto-initialization
        localStorage.setItem('recent_conversation_deletion', Date.now().toString());
        console.log('💾 Deleted conversation locally:', conversationId);
        return true;
      }
      
      return false;
    }
  }
};

// Message Storage Functions
export const messageStorage = {
  // Get messages for a specific conversation from backend
  async getMessages(conversationId: string): Promise<Message[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/conversations/${conversationId}`, {
        headers: getAuthHeaders(),
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data?.messages?.data) {
          const messages = result.data.messages.data.map((msg: any) => ({
            id: msg.id,
            conversation_id: conversationId,
            role: msg.role,
            content: msg.content,
            is_summary: false,
            summary_details: null,
            created_at: msg.createdAt,
          }));
          
          // Cache in localStorage as fallback
          this.saveMessagesToStorage(conversationId, messages);
          
          console.log('💬 Loaded messages from backend:', messages.length);
          return messages;
        }
      }
      
      // Fallback to localStorage
      return this.getMessagesFromStorage(conversationId);
    } catch (error) {
      console.error('Error loading messages from backend:', error);
      return this.getMessagesFromStorage(conversationId);
    }
  },

  // Fallback: Get messages from localStorage
  getMessagesFromStorage(conversationId: string): Message[] {
    try {
      const key = getUserStorageKey('messages');
      const stored = localStorage.getItem(key);
      if (stored) {
        const allMessages = JSON.parse(stored);
        const messages = allMessages[conversationId] || [];
        console.log('💬 Loaded messages from storage:', messages.length);
        return messages;
      }
    } catch (error) {
      console.error('Error loading messages from storage:', error);
    }
    return [];
  },

  // Save messages to localStorage (fallback)
  saveMessagesToStorage(conversationId: string, messages: Message[]): void {
    try {
      const key = getUserStorageKey('messages');
      const stored = localStorage.getItem(key) || '{}';
      const allMessages = JSON.parse(stored);
      allMessages[conversationId] = messages;
      localStorage.setItem(key, JSON.stringify(allMessages));
      console.log('💾 Saved messages to storage:', messages.length);
    } catch (error) {
      console.error('Error saving messages to storage:', error);
    }
  },

  // Add a message to conversation via backend with optional SubChat context and previous knowledge
  async addMessage(conversationId: string, content: string, role: 'user' | 'assistant' | 'system' = 'user', subChatContext?: string, previousKnowledgeContext?: string): Promise<{ userMessage: Message; assistantMessage?: Message } | null> {
    try {
      const response = await fetch(`${API_BASE_URL}/conversations/${conversationId}/messages`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ 
          content, 
          role,
          subChatContext: subChatContext || null,
          previousKnowledgeContext: previousKnowledgeContext || null
        }),
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          const userMessage: Message = {
            id: result.data.userMessage.id,
            conversation_id: conversationId,
            role: result.data.userMessage.role,
            content: result.data.userMessage.content,
            is_summary: false,
            summary_details: null,
            created_at: result.data.userMessage.createdAt,
          };

          let assistantMessage: Message | undefined;
          if (result.data.assistantMessage) {
            assistantMessage = {
              id: result.data.assistantMessage.id,
              conversation_id: conversationId,
              role: result.data.assistantMessage.role,
              content: result.data.assistantMessage.content,
              is_summary: false,
              summary_details: null,
              created_at: result.data.assistantMessage.createdAt,
            };
          }

          console.log('✅ Added message via backend');
          return { userMessage, assistantMessage };
        }
      }
      
      throw new Error('Failed to add message');
    } catch (error) {
      console.error('Error adding message:', error);
      
      // Fallback: add locally
      const message: Message = {
        id: 'local_' + Date.now(),
        conversation_id: conversationId,
        role,
        content,
        is_summary: false,
        summary_details: null,
        created_at: new Date().toISOString(),
      };
      
      const messages = this.getMessagesFromStorage(conversationId);
      messages.push(message);
      this.saveMessagesToStorage(conversationId, messages);
      
      return { userMessage: message };
    }
  }
};

// User Management Functions
export const userStorage = {
  // Get current user info
  getCurrentUser(): { id: string; isGuest: boolean } {
    const userId = getCurrentUserId();
    return {
      id: userId,
      isGuest: userId === 'guest_user' || userId.startsWith('guest_')
    };
  },

  // Clear all data for current user (logout)
  clearUserData(): void {
    const userId = getCurrentUserId();
    const keys = Object.keys(localStorage).filter(key => key.endsWith(`_${userId}`));
    keys.forEach(key => localStorage.removeItem(key));
    console.log('🗑️ Cleared data for user:', userId, keys.length, 'items');
  },

  // Switch user context (when logging in/out)
  switchUser(): void {
    // This will be called after token changes to refresh user context
    console.log('🔄 Switched to user:', getCurrentUserId());
  }
};

// Initialize default data for new users
export async function initializeUserData(force = false): Promise<void> {
  try {
    const conversations = await conversationStorage.getConversations();
    
    // Check if user recently deleted conversations (within last 10 seconds)
    const recentDeletionKey = 'recent_conversation_deletion';
    const recentDeletion = localStorage.getItem(recentDeletionKey);
    const now = Date.now();
    
    if (recentDeletion && !force) {
      const deletionTime = parseInt(recentDeletion);
      if (now - deletionTime < 10000) { // 10 seconds
        console.log('🚫 Skipping initialization - recent deletion detected');
        return;
      } else {
        // Clean up old deletion marker
        localStorage.removeItem(recentDeletionKey);
      }
    }
    
    // Only initialize if explicitly forced - don't auto-create conversations for new users
    if (force && conversations.length === 0) {
      const welcomeConversation = await conversationStorage.createConversation('Welcome to SubChat!');
      
      if (welcomeConversation) {
        // Add welcome message
        await messageStorage.addMessage(
          welcomeConversation.id,
          'Welcome to SubChat! I\'m here to help you with any questions you have. You can:\n\n• Ask me anything\n• Start new conversations\n• Continue previous chats\n\nWhat would you like to talk about?',
          'assistant'
        );
        
        console.log('🆕 Initialized welcome conversation for new user (forced)');
      }
    } else if (conversations.length === 0) {
      console.log('📭 New user detected, but not creating welcome conversation (use force=true if needed)');
    }
  } catch (error) {
    console.error('Error initializing user data:', error);
  }
}