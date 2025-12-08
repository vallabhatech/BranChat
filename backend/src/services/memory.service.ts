import { elasticService, MemoryDocument, SearchResult } from './elastic.service';
import { llmService } from './llm.service';
import { logger } from '../utils/logger';
import { config } from '../config/environment';

export interface MemoryEntry {
  subchatId: string;
  conversationId: string;
  userId: string;
  summary: string;
  keywords: string[];
  actions: string[];
  artifacts: string[];
  createdAt: Date;
  mergedAt: Date;
}

export interface MemorySearchOptions {
  topK?: number;
  similarityThreshold?: number;
  excludeConversationId?: string;
  useEmbeddings?: boolean;
}

export interface MemorySearchResult {
  subchatId: string;
  score: number;
  summary: string;
  keywords: string[];
  actions: string[];
  artifacts: string[];
  createdAt: Date;
}

export class MemoryService {
  /**
   * Store a memory entry with optional embedding generation
   */
  async storeMemory(entry: MemoryEntry): Promise<void> {
    try {
      logger.info('Storing memory entry', {
        subchatId: entry.subchatId,
        userId: entry.userId,
        summaryLength: entry.summary.length,
      });

      // Prepare document for Elasticsearch
      const document: Omit<MemoryDocument, 'embedding'> = {
        summary: entry.summary,
        keywords: entry.keywords,
        conversationId: entry.conversationId,
        subchatId: entry.subchatId,
        userId: entry.userId,
        createdAt: entry.createdAt,
        mergedAt: entry.mergedAt,
      };

      let embedding: number[] | undefined;

      // Generate embedding if Elasticsearch supports vectors
      if (elasticService.supportsVectorSearch()) {
        try {
          // Create embedding from summary and keywords
          const textForEmbedding = `${entry.summary} ${entry.keywords.join(' ')}`;
          embedding = await llmService.createEmbedding(textForEmbedding);
          
          logger.info('Generated embedding for memory', {
            subchatId: entry.subchatId,
            embeddingDimensions: embedding.length,
          });
        } catch (embeddingError) {
          logger.warn('Failed to generate embedding, storing without vector search capability', {
            subchatId: entry.subchatId,
            error: embeddingError,
          });
        }
      }

      // Store in Elasticsearch
      await elasticService.upsertSummary(entry.subchatId, document, embedding);

      logger.info('Memory stored successfully', {
        subchatId: entry.subchatId,
        hasEmbedding: !!embedding,
      });
    } catch (error) {
      logger.error('Failed to store memory', {
        subchatId: entry.subchatId,
        error,
      });
      throw error;
    }
  }

  /**
   * Search memories using semantic or text search
   */
  async searchMemories(
    query: string,
    userId: string,
    options: MemorySearchOptions = {}
  ): Promise<MemorySearchResult[]> {
    const {
      topK = config.memory.topK,
      similarityThreshold = config.memory.similarityThreshold,
      excludeConversationId,
      useEmbeddings = true,
    } = options;

    try {
      logger.info('Searching memories', {
        query: query.substring(0, 100),
        userId,
        topK,
        useEmbeddings,
      });

      let embedding: number[] | undefined;

      // Generate query embedding if vector search is available and requested
      if (useEmbeddings && elasticService.supportsVectorSearch()) {
        try {
          embedding = await llmService.createEmbedding(query);
          logger.info('Generated query embedding for search', {
            embeddingDimensions: embedding.length,
          });
        } catch (embeddingError) {
          logger.warn('Failed to generate query embedding, falling back to text search', {
            error: embeddingError,
          });
        }
      }

      // Search in Elasticsearch
      const searchResults = await elasticService.search(query, userId, {
        topK,
        embedding,
        similarityThreshold,
        conversationId: excludeConversationId,
      });

      // Transform results
      const memories: MemorySearchResult[] = searchResults.map(result => ({
        subchatId: result.id,
        score: result.score,
        summary: result.document.summary,
        keywords: result.document.keywords,
        actions: [], // These would need to be stored separately or extracted from summary
        artifacts: [], // These would need to be stored separately or extracted from summary
        createdAt: result.document.createdAt,
      }));

      logger.info('Memory search completed', {
        query: query.substring(0, 100),
        userId,
        resultsCount: memories.length,
        searchType: embedding ? 'vector' : 'text',
      });

      return memories;
    } catch (error) {
      logger.error('Memory search failed', {
        query: query.substring(0, 100),
        userId,
        error,
      });
      
      // Return empty results for graceful degradation
      return [];
    }
  }

  /**
   * Get relevant memories for starting a new conversation
   */
  async getRelevantMemories(
    query: string,
    userId: string,
    excludeConversationId?: string
  ): Promise<MemorySearchResult[]> {
    return this.searchMemories(query, userId, {
      topK: config.memory.topK,
      excludeConversationId,
      useEmbeddings: true,
    });
  }

  /**
   * Delete a memory entry
   */
  async deleteMemory(subchatId: string): Promise<void> {
    try {
      await elasticService.deleteMemory(subchatId);
      logger.info('Memory deleted successfully', { subchatId });
    } catch (error) {
      logger.error('Failed to delete memory', { subchatId, error });
      throw error;
    }
  }

  /**
   * Clean up old memories for a user
   */
  async cleanupUserMemories(
    userId: string,
    options: {
      olderThanDays?: number;
      maxEntries?: number;
    } = {}
  ): Promise<{ deleted: number }> {
    try {
      const result = await elasticService.cleanupMemories({
        userId,
        ...options,
      });

      logger.info('User memory cleanup completed', {
        userId,
        deleted: result.deleted,
        ...options,
      });

      return result;
    } catch (error) {
      logger.error('Failed to cleanup user memories', { userId, error });
      throw error;
    }
  }

  /**
   * Get memory statistics for a user
   */
  async getUserMemoryStats(userId: string): Promise<{
    totalMemories: number;
    oldestMemory?: Date;
    newestMemory?: Date;
    averageKeywords: number;
    isElasticAvailable: boolean;
    hasVectorSupport: boolean;
  }> {
    try {
      const stats = await elasticService.getMemoryStats(userId);
      
      return {
        ...stats,
        isElasticAvailable: elasticService.isAvailable(),
        hasVectorSupport: elasticService.supportsVectorSearch(),
      };
    } catch (error) {
      logger.error('Failed to get user memory stats', { userId, error });
      
      return {
        totalMemories: 0,
        averageKeywords: 0,
        isElasticAvailable: false,
        hasVectorSupport: false,
      };
    }
  }

  /**
   * Check if memory service is available
   */
  isAvailable(): boolean {
    return elasticService.isAvailable();
  }

  /**
   * Check if vector search is supported
   */
  supportsVectorSearch(): boolean {
    return elasticService.supportsVectorSearch();
  }

  /**
   * Initialize the memory service
   */
  async initialize(): Promise<void> {
    try {
      await elasticService.initialize();
      logger.info('Memory service initialized successfully');
    } catch (error) {
      logger.warn('Memory service initialization failed, memory features will be disabled', {
        error,
      });
      // Don't throw - allow graceful degradation
    }
  }
}

// Export singleton instance
export const memoryService = new MemoryService();