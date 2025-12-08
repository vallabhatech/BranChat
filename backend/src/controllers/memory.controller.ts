import { Request, Response } from 'express';
import Joi from 'joi';
import { memoryService } from '../services/memory.service';
import { logger } from '../utils/logger';
import { ApiResponse, PaginatedResponse } from '../types';

// Validation schemas
const retrieveMemorySchema = Joi.object({
  query: Joi.string().required().min(1).max(1000),
  topK: Joi.number().integer().min(1).max(20).optional().default(5),
  useEmbeddings: Joi.boolean().optional().default(true),
  excludeConversationId: Joi.string().optional(),
});

const listMemoriesSchema = Joi.object({
  page: Joi.number().integer().min(1).optional().default(1),
  limit: Joi.number().integer().min(1).max(50).optional().default(10),
});

export class MemoryController {
  /**
   * Retrieve memories using semantic or text search
   * POST /api/memory/retrieve
   */
  async retrieveMemories(req: Request, res: Response): Promise<void> {
    try {
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

      // Check if user has memory access
      if (isGuest) {
        res.status(403).json({
          success: false,
          error: {
            code: 'GUEST_NOT_ALLOWED',
            message: 'Guest users do not have access to memory features',
            timestamp: new Date().toISOString(),
          },
        } as ApiResponse);
        return;
      }

      if (!memoryOptIn) {
        res.status(403).json({
          success: false,
          error: {
            code: 'MEMORY_OPT_IN_REQUIRED',
            message: 'Memory opt-in is required to access memory features',
            timestamp: new Date().toISOString(),
          },
        } as ApiResponse);
        return;
      }

      // Validate request body
      const { error, value } = retrieveMemorySchema.validate(req.body);
      if (error) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: error.details[0].message,
            timestamp: new Date().toISOString(),
          },
        } as ApiResponse);
        return;
      }

      const { query, topK, useEmbeddings, excludeConversationId } = value;

      // Check if memory service is available
      if (!memoryService.isAvailable()) {
        res.status(503).json({
          success: false,
          error: {
            code: 'MEMORY_SERVICE_UNAVAILABLE',
            message: 'Memory service is currently unavailable',
            timestamp: new Date().toISOString(),
          },
        } as ApiResponse);
        return;
      }

      // Search memories
      const memories = await memoryService.searchMemories(query, userId, {
        topK,
        useEmbeddings,
        excludeConversationId,
      });

      logger.info('Memory retrieval completed', {
        userId,
        query: query.substring(0, 100),
        resultsCount: memories.length,
        useEmbeddings,
      });

      res.status(200).json({
        success: true,
        data: {
          memories: memories.map(memory => ({
            id: memory.subchatId,
            summary: memory.summary,
            keywords: memory.keywords,
            actions: memory.actions,
            artifacts: memory.artifacts,
            score: memory.score,
            createdAt: memory.createdAt,
          })),
          query,
          totalResults: memories.length,
          searchType: memoryService.supportsVectorSearch() && useEmbeddings ? 'semantic' : 'text',
          serviceStatus: {
            available: memoryService.isAvailable(),
            vectorSupport: memoryService.supportsVectorSearch(),
          },
        },
      } as ApiResponse);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Memory retrieval failed', { 
        error: errorMessage, 
        userId: req.user?.userId,
        query: req.body?.query?.substring(0, 100),
      });

      res.status(500).json({
        success: false,
        error: {
          code: 'MEMORY_RETRIEVAL_FAILED',
          message: 'Failed to retrieve memories',
          timestamp: new Date().toISOString(),
        },
      } as ApiResponse);
    }
  }

  /**
   * List user's memories with pagination
   * GET /api/memory/list
   */
  async listMemories(req: Request, res: Response): Promise<void> {
    try {
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

      // Check if user has memory access
      if (isGuest) {
        res.status(403).json({
          success: false,
          error: {
            code: 'GUEST_NOT_ALLOWED',
            message: 'Guest users do not have access to memory features',
            timestamp: new Date().toISOString(),
          },
        } as ApiResponse);
        return;
      }

      if (!memoryOptIn) {
        res.status(403).json({
          success: false,
          error: {
            code: 'MEMORY_OPT_IN_REQUIRED',
            message: 'Memory opt-in is required to access memory features',
            timestamp: new Date().toISOString(),
          },
        } as ApiResponse);
        return;
      }

      // Validate query parameters
      const { error, value } = listMemoriesSchema.validate(req.query);
      if (error) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: error.details[0].message,
            timestamp: new Date().toISOString(),
          },
        } as ApiResponse);
        return;
      }

      const { page, limit } = value;

      // Check if memory service is available
      if (!memoryService.isAvailable()) {
        res.status(503).json({
          success: false,
          error: {
            code: 'MEMORY_SERVICE_UNAVAILABLE',
            message: 'Memory service is currently unavailable',
            timestamp: new Date().toISOString(),
          },
        } as ApiResponse);
        return;
      }

      // Get user memory statistics
      const stats = await memoryService.getUserMemoryStats(userId);

      // Calculate pagination
      const totalMemories = stats.totalMemories;
      const totalPages = Math.ceil(totalMemories / limit);
      const skip = (page - 1) * limit;

      // For listing, we'll use a broad search to get all user memories
      // This is a workaround since the memory service doesn't have a direct "list all" method
      const allMemories = await memoryService.searchMemories('*', userId, {
        topK: Math.min(1000, totalMemories), // Get all memories up to a reasonable limit
        useEmbeddings: false, // Use text search for listing to get all results
      });

      // Apply pagination manually
      const paginatedMemories = allMemories
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()) // Sort by newest first
        .slice(skip, skip + limit);

      const paginatedResponse: PaginatedResponse<any> = {
        data: paginatedMemories.map(memory => ({
          id: memory.subchatId,
          summary: memory.summary,
          keywords: memory.keywords,
          actions: memory.actions,
          artifacts: memory.artifacts,
          createdAt: memory.createdAt,
        })),
        pagination: {
          page,
          limit,
          total: totalMemories,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
      };

      logger.info('Memory list retrieved', {
        userId,
        page,
        limit,
        totalMemories,
        returnedCount: paginatedMemories.length,
      });

      res.status(200).json({
        success: true,
        data: {
          memories: paginatedResponse,
          stats: {
            totalMemories: stats.totalMemories,
            oldestMemory: stats.oldestMemory,
            newestMemory: stats.newestMemory,
            averageKeywords: stats.averageKeywords,
          },
          serviceStatus: {
            available: stats.isElasticAvailable,
            vectorSupport: stats.hasVectorSupport,
          },
        },
      } as ApiResponse);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Memory list retrieval failed', { 
        error: errorMessage, 
        userId: req.user?.userId,
      });

      res.status(500).json({
        success: false,
        error: {
          code: 'MEMORY_LIST_FAILED',
          message: 'Failed to retrieve memory list',
          timestamp: new Date().toISOString(),
        },
      } as ApiResponse);
    }
  }

  /**
   * Delete a specific memory entry
   * POST /api/memory/:id/delete
   */
  async deleteMemory(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
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

      // Check if user has memory access
      if (isGuest) {
        res.status(403).json({
          success: false,
          error: {
            code: 'GUEST_NOT_ALLOWED',
            message: 'Guest users do not have access to memory features',
            timestamp: new Date().toISOString(),
          },
        } as ApiResponse);
        return;
      }

      if (!memoryOptIn) {
        res.status(403).json({
          success: false,
          error: {
            code: 'MEMORY_OPT_IN_REQUIRED',
            message: 'Memory opt-in is required to access memory features',
            timestamp: new Date().toISOString(),
          },
        } as ApiResponse);
        return;
      }

      // Validate memory ID
      if (!id || typeof id !== 'string' || id.trim().length === 0) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_MEMORY_ID',
            message: 'Valid memory ID is required',
            timestamp: new Date().toISOString(),
          },
        } as ApiResponse);
        return;
      }

      // Check if memory service is available
      if (!memoryService.isAvailable()) {
        res.status(503).json({
          success: false,
          error: {
            code: 'MEMORY_SERVICE_UNAVAILABLE',
            message: 'Memory service is currently unavailable',
            timestamp: new Date().toISOString(),
          },
        } as ApiResponse);
        return;
      }

      // Delete the memory
      await memoryService.deleteMemory(id);

      logger.info('Memory deleted successfully', {
        userId,
        memoryId: id,
      });

      res.status(200).json({
        success: true,
        data: {
          message: 'Memory deleted successfully',
          deletedId: id,
        },
      } as ApiResponse);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Memory deletion failed', { 
        error: errorMessage, 
        userId: req.user?.userId,
        memoryId: req.params.id,
      });

      // Check if it's a not found error
      if (errorMessage.includes('not found') || errorMessage.includes('404')) {
        res.status(404).json({
          success: false,
          error: {
            code: 'MEMORY_NOT_FOUND',
            message: 'Memory entry not found',
            timestamp: new Date().toISOString(),
          },
        } as ApiResponse);
        return;
      }

      res.status(500).json({
        success: false,
        error: {
          code: 'MEMORY_DELETION_FAILED',
          message: 'Failed to delete memory',
          timestamp: new Date().toISOString(),
        },
      } as ApiResponse);
    }
  }

  /**
   * Get memory service status and user statistics
   * GET /api/memory/status
   */
  async getMemoryStatus(req: Request, res: Response): Promise<void> {
    try {
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

      // Get basic service status (available to all users)
      const serviceStatus = {
        available: memoryService.isAvailable(),
        vectorSupport: memoryService.supportsVectorSearch(),
        userHasAccess: !isGuest && memoryOptIn,
        isGuest,
        memoryOptIn,
      };

      // Get user-specific stats if they have access
      let userStats = null;
      if (!isGuest && memoryOptIn && memoryService.isAvailable()) {
        try {
          userStats = await memoryService.getUserMemoryStats(userId);
        } catch (error) {
          logger.warn('Failed to get user memory stats', { userId, error });
          // Continue without user stats
        }
      }

      logger.info('Memory status retrieved', {
        userId,
        isGuest,
        memoryOptIn,
        serviceAvailable: serviceStatus.available,
      });

      res.status(200).json({
        success: true,
        data: {
          service: serviceStatus,
          userStats,
        },
      } as ApiResponse);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Memory status retrieval failed', { 
        error: errorMessage, 
        userId: req.user?.userId,
      });

      res.status(500).json({
        success: false,
        error: {
          code: 'MEMORY_STATUS_FAILED',
          message: 'Failed to retrieve memory status',
          timestamp: new Date().toISOString(),
        },
      } as ApiResponse);
    }
  }
}

export const memoryController = new MemoryController();