import { Request, Response } from 'express';
import { Subchat } from '../models/Subchat';
import { SubchatMessage } from '../models/SubchatMessage';
import { Conversation } from '../models/Conversation';
import { Message } from '../models/Message';
import { llmService } from '../services/llm.service';
import { streamingService } from '../services/streaming.service';
import { logger } from '../utils/logger';
import { ApiResponse, PaginatedResponse, LLMMessage } from '../types';
import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

export class SubchatsController {
  /**
   * Create a new sub-chat with context seeding
   * POST /api/subchats
   */
  async createSubchat(req: Request, res: Response): Promise<void> {
    try {
      const { conversationId, parentMessageId, contextMessage, title, includeInMemory = true, autoSend = false } = req.body;
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

      // Validate required fields
      if (!conversationId || !mongoose.Types.ObjectId.isValid(conversationId)) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_CONVERSATION_ID',
            message: 'Valid conversation ID is required',
            timestamp: new Date().toISOString(),
          },
        } as ApiResponse);
        return;
      }

      // Verify conversation exists and user has access
      const conversation = await Conversation.findOne({
        _id: conversationId,
        userId: userId === 'guest' ? 'guest' : new mongoose.Types.ObjectId(userId),
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

      // Validate parent message if provided
      let parentMessage = null;
      if (parentMessageId) {
        if (!mongoose.Types.ObjectId.isValid(parentMessageId)) {
          res.status(400).json({
            success: false,
            error: {
              code: 'INVALID_PARENT_MESSAGE_ID',
              message: 'Invalid parent message ID format',
              timestamp: new Date().toISOString(),
            },
          } as ApiResponse);
          return;
        }

        parentMessage = await Message.findOne({
          _id: parentMessageId,
          conversationId: new mongoose.Types.ObjectId(conversationId),
        });

        if (!parentMessage) {
          res.status(404).json({
            success: false,
            error: {
              code: 'PARENT_MESSAGE_NOT_FOUND',
              message: 'Parent message not found in the specified conversation',
              timestamp: new Date().toISOString(),
            },
          } as ApiResponse);
          return;
        }
      }

      // Create new subchat
      const subchat = new Subchat({
        conversationId: new mongoose.Types.ObjectId(conversationId),
        userId: userId === 'guest' ? 'guest' : new mongoose.Types.ObjectId(userId),
        title: title || 'New Sub-chat',
        contextMessage: contextMessage || parentMessage?.content || '',
        includeInMemory: Boolean(includeInMemory),
        autoSend: Boolean(autoSend),
        status: 'active',
      });

      await subchat.save();

      // Seed with context if provided
      if (contextMessage || parentMessage) {
        const seedContent = contextMessage || parentMessage?.content || '';
        
        // Create system message with context
        const systemMessage = new SubchatMessage({
          subchatId: subchat._id,
          role: 'system',
          content: `Context from parent conversation: ${seedContent}`,
        });

        await systemMessage.save();
        await subchat.incrementMessageCount();

        // Generate title from context if not provided
        if (!title) {
          await subchat.generateTitle(seedContent);
        }
      }

      logger.info('Subchat created', {
        subchatId: subchat.id,
        conversationId,
        userId,
        hasContext: !!(contextMessage || parentMessage),
        includeInMemory,
        autoSend,
      });

      res.status(201).json({
        success: true,
        data: {
          id: subchat.id,
          conversationId: subchat.conversationId,
          title: subchat.title,
          status: subchat.status,
          contextMessage: subchat.contextMessage,
          includeInMemory: subchat.includeInMemory,
          autoSend: subchat.autoSend,
          messageCount: subchat.messageCount,
          createdAt: subchat.createdAt,
          updatedAt: subchat.updatedAt,
        },
      } as ApiResponse);
    } catch (error) {
      logger.error('Failed to create subchat', { error, userId: req.user?.userId });
      res.status(500).json({
        success: false,
        error: {
          code: 'SUBCHAT_CREATION_FAILED',
          message: 'Failed to create sub-chat',
          timestamp: new Date().toISOString(),
        },
      } as ApiResponse);
    }
  }

  /**
   * Get sub-chat by ID with metadata and messages
   * GET /api/subchats/:id
   */
  async getSubchat(req: Request, res: Response): Promise<void> {
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

      // Validate subchat ID
      if (!mongoose.Types.ObjectId.isValid(id)) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_SUBCHAT_ID',
            message: 'Invalid sub-chat ID format',
            timestamp: new Date().toISOString(),
          },
        } as ApiResponse);
        return;
      }

      // Find subchat and verify ownership
      const subchat = await Subchat.findOne({
        _id: id,
        userId: userId === 'guest' ? 'guest' : new mongoose.Types.ObjectId(userId),
      }).populate('conversationId', 'title');

      if (!subchat) {
        res.status(404).json({
          success: false,
          error: {
            code: 'SUBCHAT_NOT_FOUND',
            message: 'Sub-chat not found or access denied',
            timestamp: new Date().toISOString(),
          },
        } as ApiResponse);
        return;
      }

      // Get messages with pagination
      const pageNum = Math.max(1, parseInt(page as string) || 1);
      const limitNum = Math.min(100, Math.max(1, parseInt(limit as string) || 50));

      const messages = await SubchatMessage.findBySubchatId(id, {
        page: pageNum,
        limit: limitNum,
        sortOrder: sortOrder as 'asc' | 'desc',
      });

      // Get total message count for pagination
      const totalMessages = await SubchatMessage.countDocuments({ subchatId: id });
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

      logger.info('Subchat retrieved', {
        subchatId: id,
        userId,
        messageCount: messages.length,
        page: pageNum,
        status: subchat.status,
      });

      res.json({
        success: true,
        data: {
          subchat: {
            id: subchat.id,
            conversationId: subchat.conversationId,
            title: subchat.title,
            status: subchat.status,
            contextMessage: subchat.contextMessage,
            summary: subchat.summary,
            includeInMemory: subchat.includeInMemory,
            autoSend: subchat.autoSend,
            messageCount: subchat.messageCount,
            createdAt: subchat.createdAt,
            updatedAt: subchat.updatedAt,
            resolvedAt: subchat.resolvedAt,
          },
          messages: paginatedMessages,
        },
      } as ApiResponse);
    } catch (error) {
      logger.error('Failed to get subchat', { error, subchatId: req.params.id, userId: req.user?.userId });
      res.status(500).json({
        success: false,
        error: {
          code: 'SUBCHAT_RETRIEVAL_FAILED',
          message: 'Failed to retrieve sub-chat',
          timestamp: new Date().toISOString(),
        },
      } as ApiResponse);
    }
  }

  /**
   * Add a message to sub-chat and get LLM response
   * POST /api/subchats/:id/messages
   */
  async addMessage(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { content, role = 'user' } = req.body;
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
            code: 'INVALID_SUBCHAT_ID',
            message: 'Invalid sub-chat ID format',
            timestamp: new Date().toISOString(),
          },
        } as ApiResponse);
        return;
      }

      // Find subchat and verify ownership
      const subchat = await Subchat.findOne({
        _id: id,
        userId: userId === 'guest' ? 'guest' : new mongoose.Types.ObjectId(userId),
      });

      if (!subchat) {
        res.status(404).json({
          success: false,
          error: {
            code: 'SUBCHAT_NOT_FOUND',
            message: 'Sub-chat not found or access denied',
            timestamp: new Date().toISOString(),
          },
        } as ApiResponse);
        return;
      }

      // Check if subchat is active
      if (!subchat.isActive()) {
        res.status(400).json({
          success: false,
          error: {
            code: 'SUBCHAT_NOT_ACTIVE',
            message: 'Cannot add messages to a resolved or cancelled sub-chat',
            timestamp: new Date().toISOString(),
          },
        } as ApiResponse);
        return;
      }

      // Create user message
      const userMessage = new SubchatMessage({
        subchatId: new mongoose.Types.ObjectId(id),
        role: role as 'user' | 'assistant' | 'system',
        content: content.trim(),
      });

      await userMessage.save();
      await subchat.incrementMessageCount();

      // Generate title from first user message if needed
      if (subchat.messageCount === 1 && role === 'user') {
        await subchat.generateTitle(content);
      }

      let assistantMessage = null;

      // Generate LLM response for user messages
      if (role === 'user') {
        try {
          // Get subchat history for context
          const recentMessages = await SubchatMessage.find({ subchatId: id })
            .sort({ createdAt: -1 })
            .limit(20)
            .lean();

          // Reverse to get chronological order
          const contextMessages: LLMMessage[] = recentMessages
            .reverse()
            .map(msg => ({
              role: msg.role as 'user' | 'assistant' | 'system',
              content: msg.content,
            }));

          const startTime = Date.now();
          const llmResponse = await llmService.chatCompletion(contextMessages, {
            temperature: 0.7,
            maxTokens: 2000,
          });
          const processingTime = Date.now() - startTime;

          // Create assistant message
          assistantMessage = new SubchatMessage({
            subchatId: new mongoose.Types.ObjectId(id),
            role: 'assistant',
            content: llmResponse,
            metadata: {
              model: 'gpt-3.5-turbo', // This should come from the LLM service
              processingTime,
              tokens: Math.ceil(llmResponse.length / 4), // Rough token estimate
            },
          });

          await assistantMessage.save();
          await subchat.incrementMessageCount();

          logger.info('LLM response generated for subchat', {
            subchatId: id,
            userId,
            processingTime,
            responseLength: llmResponse.length,
          });
        } catch (llmError) {
          logger.error('Failed to generate LLM response for subchat', {
            error: llmError,
            subchatId: id,
            userId,
          });
          
          // Don't fail the entire request if LLM fails
          // The user message was still saved successfully
        }
      }

      logger.info('Message added to subchat', {
        subchatId: id,
        userId,
        messageRole: role,
        hasLLMResponse: !!assistantMessage,
        messageCount: subchat.messageCount,
      });

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
          subchat: {
            id: subchat.id,
            title: subchat.title,
            messageCount: subchat.messageCount,
            status: subchat.status,
          },
        },
      } as ApiResponse);
    } catch (error) {
      logger.error('Failed to add message to subchat', { error, subchatId: req.params.id, userId: req.user?.userId });
      res.status(500).json({
        success: false,
        error: {
          code: 'SUBCHAT_MESSAGE_CREATION_FAILED',
          message: 'Failed to add message to sub-chat',
          timestamp: new Date().toISOString(),
        },
      } as ApiResponse);
    }
  }

  /**
   * Stream LLM response for sub-chat using SSE
   * GET /api/subchats/:id/stream
   */
  async streamResponse(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { message, role = 'user' } = req.query as any;
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

      // Validate subchat ID
      if (!mongoose.Types.ObjectId.isValid(id)) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_SUBCHAT_ID',
            message: 'Invalid sub-chat ID format',
            timestamp: new Date().toISOString(),
          },
        } as ApiResponse);
        return;
      }

      // Validate message content
      if (!message || typeof message !== 'string' || message.trim().length === 0) {
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

      // Find subchat and verify ownership
      const subchat = await Subchat.findOne({
        _id: id,
        userId: userId === 'guest' ? 'guest' : new mongoose.Types.ObjectId(userId),
      });

      if (!subchat) {
        res.status(404).json({
          success: false,
          error: {
            code: 'SUBCHAT_NOT_FOUND',
            message: 'Sub-chat not found or access denied',
            timestamp: new Date().toISOString(),
          },
        } as ApiResponse);
        return;
      }

      // Check if subchat is active
      if (!subchat.isActive()) {
        res.status(400).json({
          success: false,
          error: {
            code: 'SUBCHAT_NOT_ACTIVE',
            message: 'Cannot stream responses for a resolved or cancelled sub-chat',
            timestamp: new Date().toISOString(),
          },
        } as ApiResponse);
        return;
      }

      // Generate unique client ID for this streaming session
      const clientId = `subchat_${id}_${uuidv4()}`;

      // Initialize SSE connection
      streamingService.initializeSSEConnection(clientId, res);

      try {
        // Save user message first
        const userMessage = new SubchatMessage({
          subchatId: new mongoose.Types.ObjectId(id),
          role: role as 'user' | 'assistant' | 'system',
          content: message.trim(),
          metadata: {
            isStreaming: true,
          },
        });

        await userMessage.save();
        await subchat.incrementMessageCount();

        // Generate title from first user message if needed
        if (subchat.messageCount === 1 && role === 'user') {
          await subchat.generateTitle(message);
        }

        // Send user message event
        streamingService.sendCustomEvent(clientId, 'user_message', {
          id: userMessage.id,
          role: userMessage.role,
          content: userMessage.content,
          createdAt: userMessage.createdAt,
        });

        // Get subchat history for context
        const recentMessages = await SubchatMessage.find({ subchatId: id })
          .sort({ createdAt: -1 })
          .limit(20)
          .lean();

        // Reverse to get chronological order
        const contextMessages: LLMMessage[] = recentMessages
          .reverse()
          .map(msg => ({
            role: msg.role as 'user' | 'assistant' | 'system',
            content: msg.content,
          }));

        // Track the full response for saving
        let fullResponse = '';
        let tokenCount = 0;
        let assistantMessageId: string | null = null;
        const startTime = Date.now();

        // Create streaming request with proper structure
        const streamingRequest = {
          messages: contextMessages,
          options: {
            temperature: 0.7,
            maxTokens: 2000,
            onToken: (token: string) => {
              fullResponse += token;
              tokenCount++;
            },
            onComplete: async (response: string) => {
              const processingTime = Date.now() - startTime;
              
              try {
                // Save assistant message
                const assistantMessage = new SubchatMessage({
                  subchatId: new mongoose.Types.ObjectId(id),
                  role: 'assistant',
                  content: response,
                  metadata: {
                    model: 'gpt-3.5-turbo', // This should come from the LLM service
                    processingTime,
                    tokens: tokenCount,
                    isStreaming: true,
                  },
                });

                await assistantMessage.save();
                await subchat.incrementMessageCount();
                assistantMessageId = assistantMessage.id;

                // Send completion event with message metadata
                streamingService.sendCustomEvent(clientId, 'assistant_message_complete', {
                  id: assistantMessage.id,
                  role: assistantMessage.role,
                  content: assistantMessage.content,
                  metadata: assistantMessage.metadata,
                  createdAt: assistantMessage.createdAt,
                  subchat: {
                    id: subchat.id,
                    messageCount: subchat.messageCount,
                  },
                });

                logger.info('Streaming LLM response completed for subchat', {
                  subchatId: id,
                  userId,
                  clientId,
                  processingTime,
                  tokenCount,
                  responseLength: response.length,
                });
              } catch (saveError) {
                logger.error('Failed to save streamed assistant message', {
                  subchatId: id,
                  userId,
                  clientId,
                  error: saveError,
                });
                
                streamingService.sendCustomEvent(clientId, 'save_error', {
                  error: 'Failed to save assistant message',
                  timestamp: new Date().toISOString(),
                });
              }
            },
            onError: (error: Error) => {
              logger.error('Streaming error for subchat', {
                subchatId: id,
                userId,
                clientId,
                error: error.message,
              });
            },
          },
        };

        // Start the streaming
        await streamingService.streamLLMResponse(clientId, streamingRequest);

        logger.info('Subchat streaming session started', {
          subchatId: id,
          userId,
          clientId,
          messageLength: message.length,
        });

      } catch (streamError) {
        logger.error('Failed to start subchat streaming', {
          subchatId: id,
          userId,
          clientId,
          error: streamError,
        });

        // Send error event to client
        if (streamingService.isClientConnected(clientId)) {
          streamingService.sendCustomEvent(clientId, 'stream_error', {
            error: streamError instanceof Error ? streamError.message : 'Unknown streaming error',
            timestamp: new Date().toISOString(),
          });
        }

        // Disconnect client
        streamingService.disconnectClient(clientId);
      }

    } catch (error) {
      logger.error('Failed to initialize subchat streaming', { 
        error, 
        subchatId: req.params.id, 
        userId: req.user?.userId 
      });
      
      // If we haven't started SSE yet, send JSON error
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          error: {
            code: 'SUBCHAT_STREAMING_FAILED',
            message: 'Failed to initialize sub-chat streaming',
            timestamp: new Date().toISOString(),
          },
        } as ApiResponse);
      }
    }
  }
}

export const subchatsController = new SubchatsController();