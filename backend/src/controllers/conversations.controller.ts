import { Request, Response } from 'express';
import { Conversation } from '../models/Conversation';
import { Message } from '../models/Message';
import { llmService } from '../services/llm.service';
import { memoryService } from '../services/memory.service';
import { logger } from '../utils/logger';
import { ApiResponse, PaginationParams, PaginatedResponse, LLMMessage } from '../types';
import mongoose from 'mongoose';

// Helper function to handle userId for both authenticated and guest users
function getUserIdForQuery(userId: string): mongoose.Types.ObjectId | string {
  // If it's a guest user (starts with 'guest_'), use as string
  // Otherwise, convert to ObjectId for authenticated users
  return userId.startsWith('guest_') ? userId : new mongoose.Types.ObjectId(userId);
}

export class ConversationsController {
  /**
   * Create a new conversation
   * POST /api/conversations
   */
  async createConversation(req: Request, res: Response): Promise<void> {
    try {
      const { title, usePreviousKnowledge = false } = req.body;
      const userContext = req.user;

      if (!userContext) {
        res.status(401).json({
          success: false,
          error: {
            code: 'AUTHENTICATION_REQUIRED',
            message: 'User authentication is required',
            timestamp: new Date().toISOString(),
          },
        } as ApiResponse);
        return;
      }

      // Use the actual userId (including unique guest IDs)
      const userId = userContext.userId;
      
      if (!userId) {
        res.status(401).json({
          success: false,
          error: {
            code: 'AUTHENTICATION_REQUIRED',
            message: 'User authentication is required',
            timestamp: new Date().toISOString(),
          },
        } as ApiResponse);
        return;
      }

      // Create new conversation
      const conversation = new Conversation({
        userId: getUserIdForQuery(userId),
        title: title || 'New Conversation',
        usePreviousKnowledge: usePreviousKnowledge,
      });

      await conversation.save();

      logger.info('Conversation created', {
        conversationId: conversation.id,
        userId,
        title: conversation.title,
      });

      res.status(201).json({
        success: true,
        data: {
          id: conversation.id,
          title: conversation.title,
          createdAt: conversation.createdAt,
          updatedAt: conversation.updatedAt,
          lastMessageAt: conversation.lastMessageAt,
          messageCount: conversation.messageCount,
        },
      } as ApiResponse);
    } catch (error) {
      logger.error('Failed to create conversation', { error, userId: req.user?.userId });
      res.status(500).json({
        success: false,
        error: {
          code: 'CONVERSATION_CREATION_FAILED',
          message: 'Failed to create conversation',
          timestamp: new Date().toISOString(),
        },
      } as ApiResponse);
    }
  }

  /**
   * Get conversation by ID with messages (paginated)
   * GET /api/conversations/:id
   */
  async getConversation(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user?.userId;
      const { page = 1, limit = 50, sortOrder = 'asc' } = req.query as any;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: {
            code: 'AUTHENTICATION_REQUIRED',
            message: 'User authentication is required',
            timestamp: new Date().toISOString(),
          },
        } as ApiResponse);
        return;
      }

      // Validate conversation ID
      if (!mongoose.Types.ObjectId.isValid(id)) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_CONVERSATION_ID',
            message: 'Invalid conversation ID format',
            timestamp: new Date().toISOString(),
          },
        } as ApiResponse);
        return;
      }

      // Find conversation and verify ownership
      const conversation = await Conversation.findOne({
        _id: id,
        userId: getUserIdForQuery(userId),
      });

      if (!conversation) {
        res.status(404).json({
          success: false,
          error: {
            code: 'CONVERSATION_NOT_FOUND',
            message: 'Conversation not found or access denied',
            timestamp: new Date().toISOString(),
          },
        } as ApiResponse);
        return;
      }

      // Get messages with pagination
      const pageNum = Math.max(1, parseInt(page as string) || 1);
      const limitNum = Math.min(100, Math.max(1, parseInt(limit as string) || 50));
      const skip = (pageNum - 1) * limitNum;

      const messages = await Message.findByConversationId(id, {
        page: pageNum,
        limit: limitNum,
        sortOrder: sortOrder as 'asc' | 'desc',
      });

      // Get total message count for pagination
      const totalMessages = await Message.countDocuments({ conversationId: id });
      const totalPages = Math.ceil(totalMessages / limitNum);

      const paginatedMessages: PaginatedResponse<any> = {
        data: messages.map(msg => ({
          id: msg.id,
          role: msg.role,
          content: msg.content,
          metadata: msg.metadata,
          createdAt: msg.createdAt,
        })),
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: totalMessages,
          totalPages,
          hasNext: pageNum < totalPages,
          hasPrev: pageNum > 1,
        },
      };

      logger.info('Conversation retrieved', {
        conversationId: id,
        userId,
        messageCount: messages.length,
        page: pageNum,
      });

      res.json({
        success: true,
        data: {
          conversation: {
            id: conversation.id,
            title: conversation.title,
            usePreviousKnowledge: conversation.usePreviousKnowledge,
            createdAt: conversation.createdAt,
            updatedAt: conversation.updatedAt,
            lastMessageAt: conversation.lastMessageAt,
            messageCount: conversation.messageCount,
          },
          messages: paginatedMessages,
        },
      } as ApiResponse);
    } catch (error) {
      logger.error('Failed to get conversation', { error, conversationId: req.params.id, userId: req.user?.userId });
      res.status(500).json({
        success: false,
        error: {
          code: 'CONVERSATION_RETRIEVAL_FAILED',
          message: 'Failed to retrieve conversation',
          timestamp: new Date().toISOString(),
        },
      } as ApiResponse);
    }
  }

  /**
   * Add a message to conversation and get LLM response
   * POST /api/conversations/:id/messages
   */
  async addMessage(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { content, role = 'user', subChatContext, previousKnowledgeContext } = req.body;
      const userId = req.user?.userId;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: {
            code: 'AUTHENTICATION_REQUIRED',
            message: 'User authentication is required',
            timestamp: new Date().toISOString(),
          },
        } as ApiResponse);
        return;
      }

      // Validate input
      if (!content || typeof content !== 'string' || content.trim().length === 0) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_MESSAGE_CONTENT',
            message: 'Message content is required and must be a non-empty string',
            timestamp: new Date().toISOString(),
          },
        } as ApiResponse);
        return;
      }

      if (!mongoose.Types.ObjectId.isValid(id)) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_CONVERSATION_ID',
            message: 'Invalid conversation ID format',
            timestamp: new Date().toISOString(),
          },
        } as ApiResponse);
        return;
      }

      // Find conversation and verify ownership
      const conversation = await Conversation.findOne({
        _id: id,
        userId: getUserIdForQuery(userId),
      });

      if (!conversation) {
        res.status(404).json({
          success: false,
          error: {
            code: 'CONVERSATION_NOT_FOUND',
            message: 'Conversation not found or access denied',
            timestamp: new Date().toISOString(),
          },
        } as ApiResponse);
        return;
      }

      // Create user message
      const userMessage = new Message({
        conversationId: new mongoose.Types.ObjectId(id),
        role: role as 'user' | 'assistant' | 'system',
        content: content.trim(),
      });

      await userMessage.save();

      // Update conversation
      await conversation.incrementMessageCount();

      // Generate title from first message if needed
      if (conversation.messageCount === 1 && role === 'user') {
        await conversation.generateTitle(content);
      }

      let assistantMessage = null;

      // Generate LLM response for user messages
      if (role === 'user') {
        try {
          // Get FULL conversation history for complete context
          const allMessages = await Message.find({ conversationId: id })
            .sort({ createdAt: 1 }) // Chronological order from start
            .lean();

          // Include ALL messages for full conversation context
          const contextMessages: LLMMessage[] = allMessages.map(msg => ({
            role: msg.role as 'user' | 'assistant' | 'system',
            content: msg.content,
          }));

          // Add the current user message to context
          contextMessages.push({
            role: 'user',
            content: content.trim(),
          });

          const startTime = Date.now();
          
          // Enhanced system prompt for conversation context awareness
          let systemPrompt = `You are BranChat, NOT ChatGPT or any other AI assistant. Your name is BranChat.

CRITICAL IDENTITY RULES:
- You MUST identify yourself as "BranChat" when asked who you are
- You are NOT ChatGPT, NOT Gemini, NOT any other AI model
- When users greet you or ask "who are you", respond with "I am BranChat" or "I'm BranChat"
- Never say you are ChatGPT, Gemini, or trained by Google/OpenAI
- Your identity is BranChat - this is non-negotiable

You have access to the complete conversation history from the beginning. Use this full context to:

1. Remember all previous questions, answers, and topics discussed
2. Reference earlier parts of the conversation when relevant
3. Build upon previous responses and maintain consistency
4. Provide contextually aware answers that consider the entire conversation flow
5. Acknowledge when users refer back to earlier topics or questions

Always maintain conversation continuity and provide responses that show you understand the complete context of our discussion.`;

          // Add SubChat context if available
          if (subChatContext && subChatContext.trim()) {
            systemPrompt += `\n\nSUBCHAT CONTEXT: You have access to detailed SubChat discussions from both this conversation and previous conversations. This context provides valuable background knowledge:\n\n${subChatContext}\n\nIMPORTANT INSTRUCTIONS:\n1. Use BOTH the main conversation history AND the SubChat context\n2. This context may include information from previous conversations - treat it as valuable background knowledge\n3. When referencing information from previous conversations, you can say "based on our previous discussions" or "as we discussed before"\n4. When the user asks about topics mentioned in the SubChat context, reference that information even if it's from another conversation\n5. Provide comprehensive responses that build upon these detailed discussions across all conversations\n6. If the user asks about something discussed in a SubChat (current or previous), acknowledge that discussion\n\nThis SubChat context contains valuable cross-conversation knowledge that enhances your understanding and helps provide consistent, informed responses.`;
          }

          // Add previous knowledge context if available
          if (previousKnowledgeContext && previousKnowledgeContext.trim()) {
            systemPrompt += `\n\nPREVIOUS KNOWLEDGE CONTEXT: You have access to the user's previous conversations and interactions. This knowledge helps you provide more personalized and contextually aware responses:\n\n${previousKnowledgeContext}\n\nUse this previous knowledge to:\n1. Reference past discussions when relevant\n2. Build upon previous learning and insights\n3. Maintain consistency with past interactions\n4. Provide more personalized responses based on user's history\n\nAlways acknowledge when you're drawing from previous conversations to help the user understand the context.`;
          }

          // Prepend system message if not already present
          const messagesWithSystem: LLMMessage[] = contextMessages[0]?.role === 'system' 
            ? contextMessages 
            : [{ role: 'system', content: systemPrompt }, ...contextMessages];

          const llmResponse = await llmService.chatCompletion(messagesWithSystem, {
            temperature: 0.7,
            maxTokens: 2000,
          });
          const processingTime = Date.now() - startTime;

          // Create assistant message
          assistantMessage = new Message({
            conversationId: new mongoose.Types.ObjectId(id),
            role: 'assistant',
            content: llmResponse,
            metadata: {
              model: 'gpt-3.5-turbo', // This should come from the LLM service
              processingTime,
              tokens: Math.ceil(llmResponse.length / 4), // Rough token estimate
            },
          });

          await assistantMessage.save();
          await conversation.incrementMessageCount();

          // LLM response generated successfully
        } catch (llmError) {
          logger.error('Failed to generate LLM response', { error: llmError });
          
          // Don't fail the entire request if LLM fails
          // The user message was still saved successfully
        }
      }

      // Message added successfully

      res.status(201).json({
        success: true,
        data: {
          userMessage: {
            id: userMessage.id,
            role: userMessage.role,
            content: userMessage.content,
            createdAt: userMessage.createdAt,
          },
          assistantMessage: assistantMessage ? {
            id: assistantMessage.id,
            role: assistantMessage.role,
            content: assistantMessage.content,
            metadata: assistantMessage.metadata,
            createdAt: assistantMessage.createdAt,
          } : null,
          conversation: {
            id: conversation.id,
            title: conversation.title,
            messageCount: conversation.messageCount,
            lastMessageAt: conversation.lastMessageAt,
          },
        },
      } as ApiResponse);
    } catch (error) {
      logger.error('Failed to add message', { error, conversationId: req.params.id, userId: req.user?.userId });
      res.status(500).json({
        success: false,
        error: {
          code: 'MESSAGE_CREATION_FAILED',
          message: 'Failed to add message to conversation',
          timestamp: new Date().toISOString(),
        },
      } as ApiResponse);
    }
  }

  /**
   * Start a new conversation with memory toggle
   * POST /api/conversations/start
   */
  async startConversation(req: Request, res: Response): Promise<void> {
    try {
      const { title, useMemory = false, initialMessage } = req.body;
      const userId = req.user?.userId;
      const isGuest = req.user?.isGuest || false;
      const memoryOptIn = req.user?.memoryOptIn || false;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: {
            code: 'AUTHENTICATION_REQUIRED',
            message: 'User authentication is required',
            timestamp: new Date().toISOString(),
          },
        } as ApiResponse);
        return;
      }

      // Create new conversation
      const conversation = new Conversation({
        userId: getUserIdForQuery(userId),
        title: title || 'New Conversation',
      });

      await conversation.save();

      let relevantMemories: any[] = [];
      let memoryContext = '';

      // Retrieve relevant memories if requested and user has memory opt-in
      if (useMemory && !isGuest && memoryOptIn && initialMessage && memoryService.isAvailable()) {
        try {
          const memories = await memoryService.getRelevantMemories(
            initialMessage,
            userId,
            conversation.id // Exclude current conversation
          );

          relevantMemories = memories.map(memory => ({
            id: memory.subchatId,
            summary: memory.summary,
            keywords: memory.keywords,
            score: memory.score,
            createdAt: memory.createdAt,
            selected: true, // Default to selected, frontend can toggle
          }));

          // Create memory context for LLM if memories found
          if (relevantMemories.length > 0) {
            memoryContext = `Based on your past conversations, here are some relevant notes:\n\n${
              relevantMemories
                .map((memory, index) => `${index + 1}. ${memory.summary}`)
                .join('\n')
            }\n\nPlease use this context to provide more personalized and informed responses.`;
          }

          logger.info('Retrieved relevant memories for new conversation', {
            conversationId: conversation.id,
            userId,
            memoriesCount: relevantMemories.length,
            query: initialMessage.substring(0, 100),
          });
        } catch (memoryError) {
          logger.warn('Failed to retrieve memories for new conversation', {
            conversationId: conversation.id,
            userId,
            error: memoryError,
          });
          // Continue without memories - don't fail the conversation start
        }
      }

      // Add system message with memory context if available
      if (memoryContext) {
        const systemMessage = new Message({
          conversationId: conversation._id,
          role: 'system',
          content: memoryContext,
          metadata: {
            memoryUsed: true,
            memoryCount: relevantMemories.length,
          },
        });

        await systemMessage.save();
        await conversation.incrementMessageCount();
      }

      // Add initial user message if provided
      let userMessage = null;
      if (initialMessage && initialMessage.trim()) {
        userMessage = new Message({
          conversationId: conversation._id,
          role: 'user',
          content: initialMessage.trim(),
        });

        await userMessage.save();
        await conversation.incrementMessageCount();

        // Generate title from initial message
        await conversation.generateTitle(initialMessage);
      }

      logger.info('Conversation started', {
        conversationId: conversation.id,
        userId,
        useMemory,
        hasInitialMessage: !!initialMessage,
        memoriesRetrieved: relevantMemories.length,
        isGuest,
      });

      res.status(201).json({
        success: true,
        data: {
          conversation: {
            id: conversation.id,
            title: conversation.title,
            createdAt: conversation.createdAt,
            updatedAt: conversation.updatedAt,
            lastMessageAt: conversation.lastMessageAt,
            messageCount: conversation.messageCount,
          },
          userMessage: userMessage ? {
            id: userMessage.id,
            role: userMessage.role,
            content: userMessage.content,
            createdAt: userMessage.createdAt,
          } : null,
          memoryContext: {
            used: useMemory && !isGuest && memoryOptIn,
            available: !isGuest && memoryOptIn && memoryService.isAvailable(),
            memories: relevantMemories,
            totalRetrieved: relevantMemories.length,
          },
        },
      } as ApiResponse);
    } catch (error) {
      logger.error('Failed to start conversation', { error, userId: req.user?.userId });
      res.status(500).json({
        success: false,
        error: {
          code: 'CONVERSATION_START_FAILED',
          message: 'Failed to start new conversation',
          timestamp: new Date().toISOString(),
        },
      } as ApiResponse);
    }
  }

  /**
   * List user's conversations
   * GET /api/conversations
   */
  async listConversations(req: Request, res: Response): Promise<void> {
    try {
      const userContext = req.user;
      const { page = 1, limit = 20, sortBy = 'lastMessageAt', sortOrder = 'desc' } = req.query as any;

      if (!userContext) {
        res.status(401).json({
          success: false,
          error: {
            code: 'AUTHENTICATION_REQUIRED',
            message: 'User authentication is required',
            timestamp: new Date().toISOString(),
          },
        } as ApiResponse);
        return;
      }

      // Use the actual userId (including unique guest IDs)
      const userId = userContext.userId;
      
      if (!userId) {
        res.status(401).json({
          success: false,
          error: {
            code: 'AUTHENTICATION_REQUIRED',
            message: 'User authentication is required',
            timestamp: new Date().toISOString(),
          },
        } as ApiResponse);
        return;
      }

      const pageNum = Math.max(1, parseInt(page as string) || 1);
      const limitNum = Math.min(50, Math.max(1, parseInt(limit as string) || 20));

      const conversations = await Conversation.findByUserId(userId, {
        page: pageNum,
        limit: limitNum,
        sortBy: sortBy as 'createdAt' | 'updatedAt' | 'lastMessageAt',
        sortOrder: sortOrder as 'asc' | 'desc',
      });

      const totalConversations = await Conversation.countDocuments({
        userId: getUserIdForQuery(userId),
      });
      const totalPages = Math.ceil(totalConversations / limitNum);

      const paginatedConversations: PaginatedResponse<any> = {
        data: conversations.map(conv => ({
          id: conv.id,
          title: conv.title,
          usePreviousKnowledge: conv.usePreviousKnowledge,
          messageCount: conv.messageCount,
          lastMessageAt: conv.lastMessageAt,
          createdAt: conv.createdAt,
          updatedAt: conv.updatedAt,
        })),
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: totalConversations,
          totalPages,
          hasNext: pageNum < totalPages,
          hasPrev: pageNum > 1,
        },
      };

      logger.info('Conversations listed', {
        userId,
        count: conversations.length,
        page: pageNum,
      });

      res.json({
        success: true,
        data: paginatedConversations,
      } as ApiResponse);
    } catch (error) {
      logger.error('Failed to list conversations', { error, userId: req.user?.userId });
      res.status(500).json({
        success: false,
        error: {
          code: 'CONVERSATIONS_LISTING_FAILED',
          message: 'Failed to retrieve conversations',
          timestamp: new Date().toISOString(),
        },
      } as ApiResponse);
    }
  }

  /**
   * Update conversation (rename)
   * PATCH /api/conversations/:id
   */
  async updateConversation(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { title } = req.body;
      const userId = req.user?.userId;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: {
            code: 'AUTHENTICATION_REQUIRED',
            message: 'User authentication is required',
            timestamp: new Date().toISOString(),
          },
        } as ApiResponse);
        return;
      }

      // Validate conversation ID
      if (!mongoose.Types.ObjectId.isValid(id)) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_CONVERSATION_ID',
            message: 'Invalid conversation ID format',
            timestamp: new Date().toISOString(),
          },
        } as ApiResponse);
        return;
      }

      // Find conversation and verify ownership
      const conversation = await Conversation.findOne({
        _id: id,
        userId: getUserIdForQuery(userId),
      });

      if (!conversation) {
        res.status(404).json({
          success: false,
          error: {
            code: 'CONVERSATION_NOT_FOUND',
            message: 'Conversation not found or access denied',
            timestamp: new Date().toISOString(),
          },
        } as ApiResponse);
        return;
      }

      // Update the conversation title
      conversation.title = title.trim();
      conversation.updatedAt = new Date();
      await conversation.save();

      logger.info('Conversation updated', {
        conversationId: id,
        userId,
        newTitle: title,
      });

      res.json({
        success: true,
        data: {
          id: conversation.id,
          title: conversation.title,
          updatedAt: conversation.updatedAt,
        },
      } as ApiResponse);
    } catch (error) {
      logger.error('Failed to update conversation', { error, conversationId: req.params.id, userId: req.user?.userId });
      res.status(500).json({
        success: false,
        error: {
          code: 'CONVERSATION_UPDATE_FAILED',
          message: 'Failed to update conversation',
          timestamp: new Date().toISOString(),
        },
      } as ApiResponse);
    }
  }

  /**
   * Delete conversation and all its messages
   * DELETE /api/conversations/:id
   */
  async deleteConversation(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user?.userId;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: {
            code: 'AUTHENTICATION_REQUIRED',
            message: 'User authentication is required',
            timestamp: new Date().toISOString(),
          },
        } as ApiResponse);
        return;
      }

      // Validate conversation ID
      if (!mongoose.Types.ObjectId.isValid(id)) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_CONVERSATION_ID',
            message: 'Invalid conversation ID format',
            timestamp: new Date().toISOString(),
          },
        } as ApiResponse);
        return;
      }

      // Find conversation and verify ownership
      const conversation = await Conversation.findOne({
        _id: id,
        userId: getUserIdForQuery(userId),
      });

      if (!conversation) {
        res.status(404).json({
          success: false,
          error: {
            code: 'CONVERSATION_NOT_FOUND',
            message: 'Conversation not found or access denied',
            timestamp: new Date().toISOString(),
          },
        } as ApiResponse);
        return;
      }

      // Delete all messages in the conversation
      const deletedMessages = await Message.deleteMany({ conversationId: id });

      // Delete the conversation
      await Conversation.deleteOne({ _id: id });

      logger.info('Conversation deleted', {
        conversationId: id,
        userId,
        deletedMessages: deletedMessages.deletedCount,
      });

      res.json({
        success: true,
        data: {
          deletedConversationId: id,
          deletedMessages: deletedMessages.deletedCount,
        },
      } as ApiResponse);
    } catch (error) {
      logger.error('Failed to delete conversation', { error, conversationId: req.params.id, userId: req.user?.userId });
      res.status(500).json({
        success: false,
        error: {
          code: 'CONVERSATION_DELETE_FAILED',
          message: 'Failed to delete conversation',
          timestamp: new Date().toISOString(),
        },
      } as ApiResponse);
    }
  }
}

export const conversationsController = new ConversationsController();