import { Message, Conversation } from '../types';

// In-memory storage for user data (not localStorage)
class UserDataStore {
  private userConversations: { [userId: string]: Conversation[] } = {};
  private userMessages: { [userId: string]: { [conversationId: string]: Message[] } } = {};

  // Get current user ID from token
  private getCurrentUserId(): string {
    const token = localStorage.getItem('token') || localStorage.getItem('guestToken');
    if (!token) return 'guest_user';

    if (token.startsWith('guest_')) return 'guest_user';
    if (token.startsWith('mock_token_')) return token.replace('mock_token_', 'user_');

    // For real backend tokens, try to decode
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.userId || payload.id || payload.sub || 'user_' + Date.now();
    } catch {
      return 'user_' + Date.now();
    }
  }

  // Initialize user data if not exists
  private initializeUser(userId: string): void {
    if (!this.userConversations[userId]) {
      this.userConversations[userId] = [];
      console.log('🆕 Initialized conversations for user:', userId);
    }
    if (!this.userMessages[userId]) {
      this.userMessages[userId] = {};
      console.log('🆕 Initialized messages for user:', userId);
    }
  }

  // Conversation methods
  getConversations(): Conversation[] {
    const userId = this.getCurrentUserId();
    this.initializeUser(userId);
    const conversations = this.userConversations[userId] || [];
    console.log('📚 Getting conversations for user:', userId, conversations.length);
    return conversations;
  }

  saveConversation(conversation: Conversation): void {
    const userId = this.getCurrentUserId();
    this.initializeUser(userId);

    const conversations = this.userConversations[userId];
    const existingIndex = conversations.findIndex(c => c.id === conversation.id);

    if (existingIndex >= 0) {
      conversations[existingIndex] = conversation;
      console.log('📝 Updated conversation for user:', userId, conversation.title);
    } else {
      conversations.unshift(conversation);
      console.log('📝 Added new conversation for user:', userId, conversation.title);
    }
  }

  getConversation(conversationId: string): Conversation | null {
    const userId = this.getCurrentUserId();
    this.initializeUser(userId);

    const conversation = this.userConversations[userId].find(c => c.id === conversationId) || null;
    console.log('🔍 Getting conversation for user:', userId, conversation ? conversation.title : 'NOT FOUND');
    return conversation;
  }

  // Message methods
  getMessages(conversationId: string): Message[] {
    const userId = this.getCurrentUserId();
    this.initializeUser(userId);

    const messages = this.userMessages[userId][conversationId] || [];
    console.log('💬 Getting messages for user:', userId, 'conversation:', conversationId, messages.length);
    return messages;
  }

  saveMessages(conversationId: string, messages: Message[]): void {
    const userId = this.getCurrentUserId();
    this.initializeUser(userId);

    this.userMessages[userId][conversationId] = messages;
    console.log('💾 Saved messages for user:', userId, 'conversation:', conversationId, messages.length);
  }

  addMessage(conversationId: string, message: Message): void {
    const userId = this.getCurrentUserId();
    this.initializeUser(userId);

    if (!this.userMessages[userId][conversationId]) {
      this.userMessages[userId][conversationId] = [];
    }

    this.userMessages[userId][conversationId].push(message);
    console.log('➕ Added message for user:', userId, 'conversation:', conversationId);
  }

  addMessages(conversationId: string, newMessages: Message[]): void {
    const userId = this.getCurrentUserId();
    this.initializeUser(userId);

    if (!this.userMessages[userId][conversationId]) {
      this.userMessages[userId][conversationId] = [];
    }

    this.userMessages[userId][conversationId].push(...newMessages);
    console.log('➕ Added messages for user:', userId, 'conversation:', conversationId, newMessages.length);
  }

  // User management
  clearUserData(): void {
    const userId = this.getCurrentUserId();
    delete this.userConversations[userId];
    delete this.userMessages[userId];
    console.log('🗑️ Cleared data for user:', userId);
  }

  // Create sample data for testing
  createSampleData(): void {
    const userId = this.getCurrentUserId();
    console.log('🧪 Creating sample data for user:', userId);

    // Create sample conversations
    const sampleConversations: Conversation[] = [
      {
        id: 'sample_conv_1',
        user_id: userId,
        title: 'React Development Chat',
        use_memory: false,
        use_previous_knowledge: false,
        parent_conversation_id: null,
        parent_message_id: null,
        created_at: new Date(Date.now() - 86400000).toISOString(),
        updated_at: new Date(Date.now() - 3600000).toISOString(),
      },
      {
        id: 'sample_conv_2',
        user_id: userId,
        title: 'JavaScript Questions',
        use_memory: false,
        use_previous_knowledge: false,
        parent_conversation_id: null,
        parent_message_id: null,
        created_at: new Date(Date.now() - 172800000).toISOString(),
        updated_at: new Date(Date.now() - 7200000).toISOString(),
      }
    ];

    // Create sample messages
    const sampleMessages = {
      'sample_conv_1': [
        {
          id: 'sample_msg_1',
          conversation_id: 'sample_conv_1',
          role: 'user' as const,
          content: 'Can you help me understand React hooks?',
          is_summary: false,
          summary_details: null,
          created_at: new Date(Date.now() - 3600000).toISOString(),
        },
        {
          id: 'sample_msg_2',
          conversation_id: 'sample_conv_1',
          role: 'assistant' as const,
          content: 'Absolutely! React hooks are functions that let you use state and other React features in functional components. The most common hooks are:\n\n• useState - for managing component state\n• useEffect - for side effects and lifecycle events\n• useContext - for consuming context values\n\nWould you like me to show you examples of any specific hooks?',
          is_summary: false,
          summary_details: null,
          created_at: new Date(Date.now() - 3500000).toISOString(),
        },
        {
          id: 'sample_msg_3',
          conversation_id: 'sample_conv_1',
          role: 'user' as const,
          content: 'Yes, can you show me a useState example?',
          is_summary: false,
          summary_details: null,
          created_at: new Date(Date.now() - 3000000).toISOString(),
        },
        {
          id: 'sample_msg_4',
          conversation_id: 'sample_conv_1',
          role: 'assistant' as const,
          content: 'Here\'s a simple useState example:\n\n```javascript\nimport React, { useState } from \'react\';\n\nfunction Counter() {\n  const [count, setCount] = useState(0);\n\n  return (\n    <div>\n      <p>Count: {count}</p>\n      <button onClick={() => setCount(count + 1)}>\n        Increment\n      </button>\n    </div>\n  );\n}\n```\n\nThis creates a counter that starts at 0 and increments when you click the button!',
          is_summary: false,
          summary_details: null,
          created_at: new Date(Date.now() - 2500000).toISOString(),
        }
      ],
      'sample_conv_2': [
        {
          id: 'sample_msg_5',
          conversation_id: 'sample_conv_2',
          role: 'user' as const,
          content: 'What\'s the difference between let and const in JavaScript?',
          is_summary: false,
          summary_details: null,
          created_at: new Date(Date.now() - 7200000).toISOString(),
        },
        {
          id: 'sample_msg_6',
          conversation_id: 'sample_conv_2',
          role: 'assistant' as const,
          content: 'Great question! Here are the key differences:\n\n**const:**\n• Cannot be reassigned after declaration\n• Must be initialized when declared\n• Block-scoped\n• Use for values that won\'t change\n\n**let:**\n• Can be reassigned\n• Can be declared without initialization\n• Block-scoped\n• Use for values that will change\n\nExample:\n```javascript\nconst name = "John"; // Cannot change\nlet age = 25; // Can change\nage = 26; // This works\n// name = "Jane"; // This would cause an error\n```',
          is_summary: false,
          summary_details: null,
          created_at: new Date(Date.now() - 7100000).toISOString(),
        }
      ]
    };

    // Store sample data
    this.userConversations[userId] = sampleConversations;
    this.userMessages[userId] = sampleMessages;

    console.log('✅ Created sample data for user:', userId);
    console.log('✅ Sample conversations:', sampleConversations.length);
    console.log('✅ Sample messages:', Object.keys(sampleMessages).length, 'conversations');
  }

  // Debug method to show current state
  debugUserData(): void {
    const userId = this.getCurrentUserId();
    console.log('🔍 Debug data for user:', userId);
    console.log('🔍 Conversations:', this.userConversations[userId]?.length || 0);
    console.log('🔍 Message conversations:', Object.keys(this.userMessages[userId] || {}).length);

    if (this.userConversations[userId]) {
      this.userConversations[userId].forEach(conv => {
        const messageCount = this.userMessages[userId]?.[conv.id]?.length || 0;
        console.log(`🔍 - ${conv.title}: ${messageCount} messages`);
      });
    }
  }
}

// Export singleton instance
export const userDataStore = new UserDataStore();

// Initialize sample data for testing
export function initializeSampleData(): void {
  const conversations = userDataStore.getConversations();
  if (conversations.length === 0) {
    userDataStore.createSampleData();
  }
}