import { Conversation, Message, Summary } from '../types';

// Helper function to get current user ID from token
function getCurrentUserId(): string {
  const token = localStorage.getItem('token') || localStorage.getItem('guestToken');
  if (!token) return 'guest_user';

  // Extract user ID from token (in real app, this would be decoded from JWT)
  if (token.startsWith('guest_')) return 'guest_user';
  if (token.startsWith('mock_token_')) return token.replace('mock_token_', 'user_');
  return 'guest_user';
}

// Helper function to get user-specific storage key
function getUserStorageKey(key: string): string {
  const userId = getCurrentUserId();
  return `${key}_${userId}`;
}

// Helper function to load conversations from localStorage
function loadConversationsFromStorage(): Conversation[] {
  const storageKey = getUserStorageKey('conversations');
  const stored = localStorage.getItem(storageKey);
  if (stored) {
    try {
      const conversations = JSON.parse(stored);
      console.log('📚 Loaded conversations from storage:', conversations.length);
      return conversations;
    } catch (error) {
      console.error('Error parsing stored conversations:', error);
    }
  }

  // Return empty array for new users - no default conversations
  console.log('📭 No conversations found for user, returning empty array');
  return [];
}

// Helper function to save conversations to localStorage
function saveConversationsToStorage(conversations: Conversation[]): void {
  const storageKey = getUserStorageKey('conversations');
  localStorage.setItem(storageKey, JSON.stringify(conversations));
}

// Helper function to load messages from localStorage
function loadMessagesFromStorage(): { [conversationId: string]: Message[] } {
  const storageKey = getUserStorageKey('messages');
  const stored = localStorage.getItem(storageKey);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch (error) {
      console.error('Error parsing stored messages:', error);
    }
  }

  // Return empty object for new users - no default messages
  console.log('📭 No messages found for user, returning empty object');
  return {};
}

// Helper function to save messages to localStorage
function saveMessagesToStorage(messages: { [conversationId: string]: Message[] }): void {
  const storageKey = getUserStorageKey('messages');
  localStorage.setItem(storageKey, JSON.stringify(messages));
}

// Initialize data from storage
let mockConversations: Conversation[] = loadConversationsFromStorage();
let mockMessages: { [conversationId: string]: Message[] } = loadMessagesFromStorage();



const mockSummaries: Summary[] = [
  {
    id: 'sum1',
    conversation_id: '1',
    content: 'Discussed React component architecture best practices including single responsibility, composition, props design, state management, and custom hooks.',
    context: 'React development patterns',
    is_active: true,
    created_at: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: 'sum2',
    conversation_id: '3',
    content: 'Covered API design patterns focusing on RESTful principles, error handling, versioning strategies, and documentation best practices.',
    context: 'API development',
    is_active: true,
    created_at: new Date(Date.now() - 172800000).toISOString(),
  },
];

// Mock API functions
export const mockApi = {
  // Conversations
  async getConversations(): Promise<{ data: Conversation[] }> {
    await delay(300);
    // Reload from storage to get latest data
    mockConversations = loadConversationsFromStorage();
    mockMessages = loadMessagesFromStorage();

    // Filter out conversations that have no messages (except for very recent ones)
    const conversationsWithMessages = mockConversations.filter(conv => {
      const hasMessages = mockMessages[conv.id] && mockMessages[conv.id].length > 0;
      const isRecent = new Date(conv.created_at).getTime() > Date.now() - 300000; // 5 minutes
      return hasMessages || isRecent;
    });

    console.log('📋 Mock API: Returning conversations:', conversationsWithMessages.map(c => ({ id: c.id, title: c.title, hasMessages: mockMessages[c.id]?.length || 0 })));
    return { data: conversationsWithMessages };
  },

  async getConversation(id: string): Promise<{ data: { conversation: Conversation; messages: Message[] } }> {
    await delay(400);
    console.log('🔍 Mock API: Getting conversation with ID:', id);

    // Reload from storage to get latest data
    mockConversations = loadConversationsFromStorage();
    mockMessages = loadMessagesFromStorage();

    console.log('📚 Available conversations:', mockConversations.map(c => ({ id: c.id, title: c.title })));
    console.log('💬 Available message keys:', Object.keys(mockMessages));

    const conversation = mockConversations.find(c => c.id === id);
    const messages = mockMessages[id] || [];

    console.log('🎯 Found conversation:', conversation ? conversation.title : 'NOT FOUND');
    console.log('💬 Found messages:', messages.length);

    if (!conversation) {
      console.error('❌ Conversation not found with ID:', id);
      throw new Error('Conversation not found');
    }

    const result = {
      data: {
        conversation,
        messages,
      },
    };

    console.log('✅ Mock API: Returning conversation data with structure:', {
      hasData: !!result.data,
      hasConversation: !!result.data.conversation,
      hasMessages: !!result.data.messages,
      messagesType: typeof result.data.messages,
      messagesIsArray: Array.isArray(result.data.messages),
      messagesLength: result.data.messages?.length || 'N/A'
    });
    console.log('✅ Mock API: Full result:', JSON.stringify(result, null, 2));
    return result;
  },

  async createConversation(data: { useMemory: boolean; title: string }): Promise<{ data: { conversation: Conversation } }> {
    await delay(500);

    const userId = getCurrentUserId();
    console.log('🆕 Creating new conversation for user:', userId);

    const newConversation: Conversation = {
      id: `conv_${Date.now()}`,
      user_id: userId,
      title: data.title,
      use_memory: data.useMemory,
      use_previous_knowledge: data.useMemory, // Use same value as use_memory for consistency
      parent_conversation_id: null,
      parent_message_id: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    console.log('📝 New conversation:', newConversation);

    // Load current conversations and add the new one
    mockConversations = loadConversationsFromStorage();
    mockConversations.unshift(newConversation);
    saveConversationsToStorage(mockConversations);

    console.log('💾 Saved conversations to storage, total:', mockConversations.length);

    // Load current messages and add initial messages for the new conversation
    mockMessages = loadMessagesFromStorage();
    mockMessages[newConversation.id] = [];
    saveMessagesToStorage(mockMessages);

    console.log('💬 Initialized empty messages for conversation:', newConversation.id);

    return {
      data: {
        conversation: newConversation,
      },
    };
  },

  async sendMessage(conversationId: string, content: string): Promise<{ data: { userMessage: Message; assistantMessage: Message } }> {
    await delay(800);

    const userMessage: Message = {
      id: `msg_${Date.now()}_user`,
      conversation_id: conversationId,
      role: 'user',
      content,
      is_summary: false,
      summary_details: null,
      created_at: new Date().toISOString(),
    };

    // Generate a mock assistant response
    const assistantResponse = generateMockResponse(content);
    const assistantMessage: Message = {
      id: `msg_${Date.now()}_assistant`,
      conversation_id: conversationId,
      role: 'assistant',
      content: assistantResponse,
      is_summary: false,
      summary_details: null,
      created_at: new Date(Date.now() + 1000).toISOString(),
    };

    // Load current messages, add new ones, and save
    mockMessages = loadMessagesFromStorage();
    if (!mockMessages[conversationId]) {
      mockMessages[conversationId] = [];
    }
    mockMessages[conversationId].push(userMessage, assistantMessage);
    saveMessagesToStorage(mockMessages);

    // Update conversation's updated_at timestamp
    mockConversations = loadConversationsFromStorage();
    const conversationIndex = mockConversations.findIndex(c => c.id === conversationId);
    if (conversationIndex !== -1) {
      mockConversations[conversationIndex].updated_at = new Date().toISOString();
      saveConversationsToStorage(mockConversations);
    }

    return {
      data: {
        userMessage,
        assistantMessage,
      },
    };
  },

  // Sub-chats
  async createSubChat(data: { conversationId: string; parentMessageId: string; contextMessage: string }): Promise<{ data: { id: string } }> {
    await delay(400);

    const subChatId = `subchat_${Date.now()}`;
    mockMessages[subChatId] = [];

    return {
      data: {
        id: subChatId,
      },
    };
  },

  async sendSubChatMessage(subChatId: string, content: string): Promise<{ data: { userMessage: Message; assistantMessage: Message } }> {
    await delay(600);

    const userMessage: Message = {
      id: `submsg_${Date.now()}_user`,
      conversation_id: subChatId,
      role: 'user',
      content,
      is_summary: false,
      summary_details: null,
      created_at: new Date().toISOString(),
    };

    const assistantResponse = generateMockResponse(content, true);
    const assistantMessage: Message = {
      id: `submsg_${Date.now()}_assistant`,
      conversation_id: subChatId,
      role: 'assistant',
      content: assistantResponse,
      is_summary: false,
      summary_details: null,
      created_at: new Date(Date.now() + 1000).toISOString(),
    };

    if (!mockMessages[subChatId]) {
      mockMessages[subChatId] = [];
    }

    mockMessages[subChatId].push(userMessage, assistantMessage);

    return {
      data: {
        userMessage,
        assistantMessage,
      },
    };
  },

  async mergeSubChat(subChatId: string): Promise<{ data: { summary: { summary: string }; injectedMessage: { id: string } } }> {
    await delay(1200); // Simulate summarization time

    const subChatMessages = mockMessages[subChatId] || [];
    const summary = generateMockSummary(subChatMessages);

    return {
      data: {
        summary: {
          summary,
        },
        injectedMessage: {
          id: `summary_${Date.now()}`,
        },
      },
    };
  },

  // Memory
  async getSummaries(): Promise<{ data: Summary[] }> {
    await delay(300);
    return { data: mockSummaries };
  },
};

// Helper functions
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function generateMockResponse(userMessage: string, isSubChat = false): string {
  // Check if user is asking "who are you" or greeting
  const lowerMessage = userMessage.toLowerCase();
  if (lowerMessage.includes('who are you') || lowerMessage.includes('who r u') || 
      lowerMessage === 'hey' || lowerMessage === 'hi' || lowerMessage === 'hello' ||
      lowerMessage.includes('introduce yourself')) {
    return "Hey there! I'm BranChat, your AI assistant, ready to chat. 😊";
  }

  const responses = isSubChat ? [
    "Let me dive deeper into that specific aspect. Here's what I think...",
    "That's a great follow-up question. Let me break this down further...",
    "Building on the previous context, here's a more detailed explanation...",
    "I can provide more specific guidance on this particular point...",
  ] : [
    "That's an excellent question! Let me help you with that...",
    "I'd be happy to explain this concept. Here's what you need to know...",
    "Great topic! This is something many developers encounter...",
    "Let me break this down for you step by step...",
  ];

  const randomResponse = responses[Math.floor(Math.random() * responses.length)];

  // Add some context-aware content based on keywords
  if (userMessage.toLowerCase().includes('react')) {
    return `${randomResponse}\n\nReact is a powerful library for building user interfaces. Here are some key concepts to consider:\n\n• Component lifecycle and hooks\n• State management patterns\n• Performance optimization techniques\n• Testing strategies\n\nWould you like me to elaborate on any of these areas?`;
  }

  if (userMessage.toLowerCase().includes('typescript')) {
    return `${randomResponse}\n\nTypeScript adds static typing to JavaScript, which provides several benefits:\n\n• Better IDE support and autocomplete\n• Catch errors at compile time\n• Improved code documentation\n• Enhanced refactoring capabilities\n\nIs there a specific TypeScript feature you'd like to explore?`;
  }

  return `${randomResponse}\n\nI understand you're asking about "${userMessage}". This is a complex topic that involves several considerations:\n\n• Understanding the core concepts\n• Practical implementation strategies\n• Common pitfalls to avoid\n• Best practices and patterns\n\nWhat specific aspect would you like me to focus on?`;
}

function generateMockSummary(messages: Message[]): string {
  const topics = [
    'implementation details and best practices',
    'architectural patterns and design principles',
    'performance optimization strategies',
    'error handling and debugging techniques',
    'testing approaches and methodologies',
  ];

  const randomTopic = topics[Math.floor(Math.random() * topics.length)];
  return `Explored ${randomTopic} with detailed examples and practical guidance`;
}

// Mock authentication methods
export const mockAuth = {
  async register(email: string, password: string, name?: string): Promise<{ success: boolean; data: { token: string; user: any } }> {
    await delay(800);

    const user = {
      id: `user_${Date.now()}`,
      email,
      name: name || email.split('@')[0],
      isGuest: false,
      memoryOptIn: true,
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
    };

    const token = `mock_token_${Date.now()}`;

    return {
      success: true,
      data: {
        token,
        user,
      },
    };
  },

  async login(email: string, password: string): Promise<{ success: boolean; data: { token: string; user: any } }> {
    await delay(600);

    const user = {
      id: `user_${Date.now()}`,
      email,
      name: email.split('@')[0],
      isGuest: false,
      memoryOptIn: true,
      createdAt: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
      lastActiveAt: new Date().toISOString(),
    };

    const token = `mock_token_${Date.now()}`;

    return {
      success: true,
      data: {
        token,
        user,
      },
    };
  },

  async createGuestToken(): Promise<{ success: boolean; data: { token: string; user: any } }> {
    await delay(400);

    const token = `guest_${Date.now()}`;

    return {
      success: true,
      data: {
        token,
        user: {
          id: 'guest_user',
          isGuest: true,
          memoryOptIn: false,
          createdAt: new Date().toISOString(),
        },
      },
    };
  },

  async getCurrentUser(): Promise<{ success: boolean; data: any }> {
    await delay(200);

    const token = localStorage.getItem('token');
    const guestToken = localStorage.getItem('guestToken');

    if (guestToken) {
      return {
        success: true,
        data: {
          id: 'guest_user',
          isGuest: true,
          memoryOptIn: false,
          createdAt: new Date().toISOString(),
        },
      };
    }

    if (token) {
      return {
        success: true,
        data: {
          id: 'mock_user',
          email: 'user@example.com',
          name: 'Mock User',
          isGuest: false,
          memoryOptIn: true,
          createdAt: new Date(Date.now() - 86400000).toISOString(),
          lastActiveAt: new Date().toISOString(),
        },
      };
    }

    throw new Error('No valid token found');
  },
};