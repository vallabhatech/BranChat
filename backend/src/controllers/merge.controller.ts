import { Request, Response } from 'express';
import { Subchat } from '../models/Subchat';
import { SubchatMessage } from '../models/SubchatMessage';
import { Message } from '../models/Message';
import { Conversation } from '../models/Conversation';
import { User } from '../models/User';
import { llmService, SummaryResult } from '../services/llm.service';
import { memoryService } from '../services/memory.service';
import { logger } from '../utils/logger';

export class MergeController {
  /**
   * POST /api/subchats/:id/merge
   * Merge a sub-chat back into the parent conversation with summarization
   */
  async mergeSubchat(req: Request, res: Response): Promise<void> {
    try {
      const { id: subchatId } = req.params;
      // Ensure user is authenticated (middleware should handle this)
      if (!req.user?.userId) {
        res.status(401).json({
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required',
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] as string,
          },
        });
        return;
      }

      const userId = req.user.userId;

      logger.info('Starting subchat merge process', {
        subchatId,
        userId,
      });

      // Find the subchat and verify ownership
      const subchat = await Subchat.findOne({
        _id: subchatId,
        userId: userId === 'guest' ? 'guest' : userId,
      }).populate('conversationId');

      if (!subchat) {
        res.status(404).json({
          error: {
            code: 'SUBCHAT_NOT_FOUND',
            message: 'Sub-chat not found or access denied',
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] as string,
          },
        });
        return;
      }

      // Check if subchat is already resolved
      if (subchat.status === 'resolved') {
        res.status(400).json({
          error: {
            code: 'SUBCHAT_ALREADY_RESOLVED',
            message: 'Sub-chat has already been resolved',
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] as string,
          },
        });
        return;
      }

      // Check if subchat is cancelled
      if (subchat.status === 'cancelled') {
        res.status(400).json({
          error: {
            code: 'SUBCHAT_CANCELLED',
            message: 'Cannot merge a cancelled sub-chat',
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] as string,
          },
        });
        return;
      }

      // Generate transcript from subchat messages
      const transcript = await this.generateTranscript(subchatId);
      
      if (!transcript || transcript.trim().length === 0) {
        res.status(400).json({
          error: {
            code: 'EMPTY_TRANSCRIPT',
            message: 'Cannot merge sub-chat with no messages',
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] as string,
          },
        });
        return;
      }

      logger.info('Generated transcript for subchat', {
        subchatId,
        transcriptLength: transcript.length,
      });

      // Generate summary using LLM
      let summaryResult: SummaryResult;
      try {
        summaryResult = await llmService.summarizeText(transcript);
        
        logger.info('Generated summary for subchat', {
          subchatId,
          summaryLength: summaryResult.summary.length,
          actionsCount: summaryResult.actions.length,
          artifactsCount: summaryResult.artifacts.length,
          keywordsCount: summaryResult.keywords.length,
        });
      } catch (summaryError) {
        logger.error('Failed to generate summary', {
          subchatId,
          error: summaryError,
        });
        
        res.status(500).json({
          error: {
            code: 'SUMMARY_GENERATION_FAILED',
            message: 'Failed to generate summary from sub-chat transcript',
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] as string,
          },
        });
        return;
      }

      // Update subchat status and store summary
      subchat.status = 'resolved';
      subchat.summary = summaryResult.summary;
      subchat.resolvedAt = new Date();
      await subchat.save();

      logger.info('Updated subchat status to resolved', {
        subchatId,
        resolvedAt: subchat.resolvedAt,
      });

      // Create injected message in parent conversation
      const injectedMessage = await this.createInjectedMessage(
        subchat.conversationId.toString(),
        summaryResult,
        subchatId
      );

      logger.info('Created injected message in parent conversation', {
        subchatId,
        conversationId: subchat.conversationId,
        messageId: injectedMessage.id,
      });

      // Store in memory if user has opted in and subchat is marked for memory inclusion
      let memoryStored = false;
      if (subchat.includeInMemory) {
        try {
          const user = await User.findById(userId);
          if (user && user.memoryOptIn && memoryService.isAvailable()) {
            await memoryService.storeMemory({
              subchatId: subchatId,
              conversationId: subchat.conversationId.toString(),
              userId: userId,
              summary: summaryResult.summary,
              keywords: summaryResult.keywords,
              actions: summaryResult.actions,
              artifacts: summaryResult.artifacts,
              createdAt: subchat.createdAt,
              mergedAt: subchat.resolvedAt!,
            });
            
            memoryStored = true;
            logger.info('Stored subchat summary in memory', {
              subchatId,
              userId,
            });
          } else {
            logger.info('Memory storage skipped', {
              subchatId,
              userId,
              userMemoryOptIn: user?.memoryOptIn,
              memoryServiceAvailable: memoryService.isAvailable(),
            });
          }
        } catch (memoryError) {
          logger.warn('Failed to store in memory, continuing with merge', {
            subchatId,
            error: memoryError,
          });
          // Don't fail the merge if memory storage fails
        }
      }

      // Update conversation's last message timestamp
      await Conversation.findByIdAndUpdate(
        subchat.conversationId,
        { 
          lastMessageAt: new Date(),
          $inc: { messageCount: 1 }
        }
      );

      // Return success response
      res.status(200).json({
        success: true,
        data: {
          subchat: {
            id: subchat.id,
            status: subchat.status,
            summary: subchat.summary,
            resolvedAt: subchat.resolvedAt,
          },
          summary: summaryResult,
          injectedMessage: {
            id: injectedMessage.id,
            content: injectedMessage.content,
            createdAt: injectedMessage.createdAt,
          },
          memoryStored,
        },
        timestamp: new Date().toISOString(),
      });

      logger.info('Subchat merge completed successfully', {
        subchatId,
        userId,
        memoryStored,
      });

    } catch (error) {
      logger.error('Subchat merge failed', {
        subchatId: req.params.id,
        userId: req.user?.userId,
        error,
      });

      res.status(500).json({
        error: {
          code: 'MERGE_FAILED',
          message: 'Failed to merge sub-chat',
          details: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string,
        },
      });
    }
  }

  /**
   * Generate a formatted transcript from subchat messages
   */
  private async generateTranscript(subchatId: string): Promise<string> {
    try {
      const messages = await SubchatMessage.find({ subchatId })
        .sort({ createdAt: 1 })
        .select('role content createdAt')
        .lean();

      if (!messages || messages.length === 0) {
        return '';
      }

      return messages.map((msg: any) => {
        const timestamp = msg.createdAt.toISOString();
        const roleLabel = msg.role.charAt(0).toUpperCase() + msg.role.slice(1);
        return `[${timestamp}] ${roleLabel}: ${msg.content}`;
      }).join('\n\n');

    } catch (error) {
      logger.error('Failed to generate transcript', {
        subchatId,
        error,
      });
      throw new Error('Failed to generate transcript from subchat messages');
    }
  }

  /**
   * Create an injected assistant message in the parent conversation
   */
  private async createInjectedMessage(
    conversationId: string,
    summaryResult: SummaryResult,
    subchatId: string
  ): Promise<any> {
    try {
      // Format the summary content for injection
      const content = this.formatSummaryForInjection(summaryResult);

      const injectedMessage = new Message({
        conversationId,
        role: 'assistant',
        content,
        metadata: {
          fromSubchat: true,
          subchatId,
          tokens: content.length / 4, // Rough token estimate
        },
      });

      await injectedMessage.save();
      return injectedMessage;

    } catch (error) {
      logger.error('Failed to create injected message', {
        conversationId,
        subchatId,
        error,
      });
      throw new Error('Failed to create injected message in parent conversation');
    }
  }

  /**
   * Format summary result for injection into parent conversation
   */
  private formatSummaryForInjection(summaryResult: SummaryResult): string {
    let content = `## Sub-chat Summary\n\n${summaryResult.summary}`;

    if (summaryResult.actions && summaryResult.actions.length > 0) {
      content += `\n\n### Actions Taken\n`;
      summaryResult.actions.forEach((action, index) => {
        content += `${index + 1}. ${action}\n`;
      });
    }

    if (summaryResult.artifacts && summaryResult.artifacts.length > 0) {
      content += `\n\n### Artifacts Created\n`;
      summaryResult.artifacts.forEach((artifact, index) => {
        content += `${index + 1}. ${artifact}\n`;
      });
    }

    if (summaryResult.keywords && summaryResult.keywords.length > 0) {
      content += `\n\n### Key Topics\n`;
      content += summaryResult.keywords.join(', ');
    }

    return content;
  }
}

// Export singleton instance
export const mergeController = new MergeController();