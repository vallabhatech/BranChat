import { logger } from '../utils/logger';
import { User, Conversation, Message, Subchat, Summary } from '../models';
import { Types } from 'mongoose';

// Metrics interfaces
export interface TokenUsage {
  totalTokens: number;
  promptTokens?: number;
  completionTokens?: number;
  model: string;
  operation: 'chat' | 'summarize' | 'embedding';
  userId?: string;
  timestamp: Date;
}

export interface UsageStats {
  dateRange: {
    start: Date;
    end: Date;
  };
  totalUsers: number;
  totalConversations: number;
  totalMessages: number;
  totalSubchats: number;
  totalMerges: number;
  totalMemoryEntries: number;
  tokenUsage: {
    totalTokens: number;
    chatTokens: number;
    summarizeTokens: number;
    embeddingTokens: number;
    estimatedCost: number;
  };
  topUsers: Array<{
    userId: string;
    messageCount: number;
    subchatCount: number;
    mergeCount: number;
  }>;
}

export interface MemoryCleanupResult {
  deletedEntries: number;
  orphanedSummaries: number;
  oldEntries: number;
  totalProcessed: number;
}

class MetricsService {
  private tokenUsageLog: TokenUsage[] = [];
  private readonly MAX_LOG_SIZE = 10000; // Keep last 10k entries in memory

  /**
   * Log token usage for tracking and cost estimation
   */
  logTokenUsage(usage: Omit<TokenUsage, 'timestamp'>): void {
    const tokenUsage: TokenUsage = {
      ...usage,
      timestamp: new Date(),
    };

    // Add to in-memory log
    this.tokenUsageLog.push(tokenUsage);

    // Trim log if it gets too large
    if (this.tokenUsageLog.length > this.MAX_LOG_SIZE) {
      this.tokenUsageLog = this.tokenUsageLog.slice(-this.MAX_LOG_SIZE);
    }

    // Log for external monitoring
    logger.info('Token usage logged', {
      operation: usage.operation,
      model: usage.model,
      totalTokens: usage.totalTokens,
      userId: usage.userId,
      estimatedCost: this.estimateTokenCost(usage.totalTokens, usage.model),
    });
  }

  /**
   * Get comprehensive usage statistics for a date range
   */
  async getUsageStats(startDate: Date, endDate: Date): Promise<UsageStats> {
    try {
      logger.info('Generating usage statistics', { startDate, endDate });

      // Parallel queries for better performance
      const [
        totalUsers,
        totalConversations,
        totalMessages,
        totalSubchats,
        totalMerges,
        totalMemoryEntries,
        topUsersData,
      ] = await Promise.all([
        // Total users in date range
        User.countDocuments({
          createdAt: { $gte: startDate, $lte: endDate },
        }),

        // Total conversations in date range
        Conversation.countDocuments({
          createdAt: { $gte: startDate, $lte: endDate },
        }),

        // Total messages in date range
        Message.countDocuments({
          createdAt: { $gte: startDate, $lte: endDate },
        }),

        // Total subchats in date range
        Subchat.countDocuments({
          createdAt: { $gte: startDate, $lte: endDate },
        }),

        // Total merges (resolved subchats) in date range
        Subchat.countDocuments({
          status: 'resolved',
          mergedAt: { $gte: startDate, $lte: endDate },
        }),

        // Total memory entries in date range
        Summary.countDocuments({
          createdAt: { $gte: startDate, $lte: endDate },
        }),

        // Top users by activity
        this.getTopUsers(startDate, endDate),
      ]);

      // Calculate token usage from in-memory log
      const tokenUsage = this.calculateTokenUsage(startDate, endDate);

      const stats: UsageStats = {
        dateRange: {
          start: startDate,
          end: endDate,
        },
        totalUsers,
        totalConversations,
        totalMessages,
        totalSubchats,
        totalMerges,
        totalMemoryEntries,
        tokenUsage,
        topUsers: topUsersData,
      };

      logger.info('Usage statistics generated successfully', {
        totalUsers,
        totalMessages,
        totalTokens: tokenUsage.totalTokens,
      });

      return stats;
    } catch (error) {
      logger.error('Failed to generate usage statistics', { error });
      throw new Error(`Failed to generate usage statistics: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Clean up old and orphaned memory entries
   */
  async cleanupMemory(olderThanDays: number = 90): Promise<MemoryCleanupResult> {
    try {
      logger.info('Starting memory cleanup', { olderThanDays });

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

      // Find orphaned summaries (summaries without corresponding subchats)
      const orphanedSummaries = await Summary.aggregate([
        {
          $lookup: {
            from: 'subchats',
            localField: 'subchatId',
            foreignField: '_id',
            as: 'subchat',
          },
        },
        {
          $match: {
            subchat: { $size: 0 },
          },
        },
        {
          $project: { _id: 1 },
        },
      ]);

      // Find old entries
      const oldSummaries = await Summary.find({
        createdAt: { $lt: cutoffDate },
      }).select('_id');

      // Delete orphaned summaries
      const orphanedResult = await Summary.deleteMany({
        _id: { $in: orphanedSummaries.map(s => s._id) },
      });

      // Delete old summaries
      const oldResult = await Summary.deleteMany({
        createdAt: { $lt: cutoffDate },
      });

      const result: MemoryCleanupResult = {
        deletedEntries: orphanedResult.deletedCount + oldResult.deletedCount,
        orphanedSummaries: orphanedResult.deletedCount,
        oldEntries: oldResult.deletedCount,
        totalProcessed: orphanedSummaries.length + oldSummaries.length,
      };

      logger.info('Memory cleanup completed', result);

      return result;
    } catch (error) {
      logger.error('Memory cleanup failed', { error });
      throw new Error(`Memory cleanup failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get top users by activity in date range
   */
  private async getTopUsers(startDate: Date, endDate: Date, limit: number = 10): Promise<Array<{
    userId: string;
    messageCount: number;
    subchatCount: number;
    mergeCount: number;
  }>> {
    try {
      // Aggregate user activity
      const userActivity = await Message.aggregate([
        {
          $match: {
            createdAt: { $gte: startDate, $lte: endDate },
            role: 'user', // Only count user messages
          },
        },
        {
          $lookup: {
            from: 'conversations',
            localField: 'conversationId',
            foreignField: '_id',
            as: 'conversation',
          },
        },
        {
          $unwind: '$conversation',
        },
        {
          $group: {
            _id: '$conversation.userId',
            messageCount: { $sum: 1 },
          },
        },
        {
          $lookup: {
            from: 'subchats',
            let: { userId: '$_id' },
            pipeline: [
              {
                $lookup: {
                  from: 'conversations',
                  localField: 'conversationId',
                  foreignField: '_id',
                  as: 'conversation',
                },
              },
              {
                $unwind: '$conversation',
              },
              {
                $match: {
                  $expr: { $eq: ['$conversation.userId', '$$userId'] },
                  createdAt: { $gte: startDate, $lte: endDate },
                },
              },
            ],
            as: 'subchats',
          },
        },
        {
          $lookup: {
            from: 'subchats',
            let: { userId: '$_id' },
            pipeline: [
              {
                $lookup: {
                  from: 'conversations',
                  localField: 'conversationId',
                  foreignField: '_id',
                  as: 'conversation',
                },
              },
              {
                $unwind: '$conversation',
              },
              {
                $match: {
                  $expr: { $eq: ['$conversation.userId', '$$userId'] },
                  status: 'resolved',
                  mergedAt: { $gte: startDate, $lte: endDate },
                },
              },
            ],
            as: 'merges',
          },
        },
        {
          $project: {
            userId: { $toString: '$_id' },
            messageCount: 1,
            subchatCount: { $size: '$subchats' },
            mergeCount: { $size: '$merges' },
          },
        },
        {
          $sort: { messageCount: -1 },
        },
        {
          $limit: limit,
        },
      ]);

      return userActivity;
    } catch (error) {
      logger.error('Failed to get top users', { error });
      return [];
    }
  }

  /**
   * Calculate token usage from in-memory log for date range
   */
  private calculateTokenUsage(startDate: Date, endDate: Date): {
    totalTokens: number;
    chatTokens: number;
    summarizeTokens: number;
    embeddingTokens: number;
    estimatedCost: number;
  } {
    const relevantUsage = this.tokenUsageLog.filter(
      usage => usage.timestamp >= startDate && usage.timestamp <= endDate
    );

    const chatTokens = relevantUsage
      .filter(u => u.operation === 'chat')
      .reduce((sum, u) => sum + u.totalTokens, 0);

    const summarizeTokens = relevantUsage
      .filter(u => u.operation === 'summarize')
      .reduce((sum, u) => sum + u.totalTokens, 0);

    const embeddingTokens = relevantUsage
      .filter(u => u.operation === 'embedding')
      .reduce((sum, u) => sum + u.totalTokens, 0);

    const totalTokens = chatTokens + summarizeTokens + embeddingTokens;

    // Calculate estimated cost
    const estimatedCost = relevantUsage.reduce((sum, usage) => {
      return sum + this.estimateTokenCost(usage.totalTokens, usage.model);
    }, 0);

    return {
      totalTokens,
      chatTokens,
      summarizeTokens,
      embeddingTokens,
      estimatedCost,
    };
  }

  /**
   * Estimate cost for token usage based on model
   */
  private estimateTokenCost(tokens: number, model: string): number {
    // Gemini pricing (as of 2024) - prices per 1K tokens
    const pricing: Record<string, { input: number; output: number }> = {
      'gemini-1.5-pro': { input: 0.0035, output: 0.0105 },
      'gpt-4-turbo': { input: 0.01, output: 0.03 },
      'gpt-3.5-turbo': { input: 0.0015, output: 0.002 },
      'text-embedding-ada-002': { input: 0.0001, output: 0 },
    };

    // Default to gpt-3.5-turbo pricing if model not found
    const modelPricing = pricing[model] || pricing['gpt-3.5-turbo'];
    
    // For simplicity, assume 50/50 split between input and output tokens
    const inputTokens = tokens * 0.5;
    const outputTokens = tokens * 0.5;

    return (
      (inputTokens / 1000) * modelPricing.input +
      (outputTokens / 1000) * modelPricing.output
    );
  }

  /**
   * Get current token usage statistics
   */
  getCurrentTokenStats(): {
    totalEntries: number;
    totalTokens: number;
    estimatedCost: number;
    oldestEntry?: Date;
    newestEntry?: Date;
  } {
    if (this.tokenUsageLog.length === 0) {
      return {
        totalEntries: 0,
        totalTokens: 0,
        estimatedCost: 0,
      };
    }

    const totalTokens = this.tokenUsageLog.reduce((sum, usage) => sum + usage.totalTokens, 0);
    const estimatedCost = this.tokenUsageLog.reduce((sum, usage) => {
      return sum + this.estimateTokenCost(usage.totalTokens, usage.model);
    }, 0);

    const timestamps = this.tokenUsageLog.map(u => u.timestamp);
    const oldestEntry = new Date(Math.min(...timestamps.map(t => t.getTime())));
    const newestEntry = new Date(Math.max(...timestamps.map(t => t.getTime())));

    return {
      totalEntries: this.tokenUsageLog.length,
      totalTokens,
      estimatedCost,
      oldestEntry,
      newestEntry,
    };
  }
}

// Export singleton instance
export const metricsService = new MetricsService();