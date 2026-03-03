/**
 * Enhanced Merge Controller
 * 
 * Improved merging logic with:
 * - Clean summarizer integration
 * - Duplicate injection prevention
 * - Circular reference avoidance
 * - Edge case handling
 * - Data integrity validation
 */

import { Request, Response } from 'express';
import { Subchat } from '../models/Subchat';
import { SubchatMessage } from '../models/SubchatMessage';
import { Message } from '../models/Message';
import { Conversation } from '../models/Conversation';
import { User } from '../models/User';
import { aiService } from '../services/AIService';
import { memoryService } from '../services/memory.service';
import { logger } from '../utils/logger';

export interface MergeResult {
  success: boolean;
  subchat?: any;
  summary?: any;
  injectedMessage?: any;
  memoryStored?: boolean;
  error?: string;
  warnings?: string[];
}

export interface MergeValidation {
  canMerge: boolean;
  errors: string[];
  warnings: string[];
  metadata: {
    messageCount: number;
    branchDepth: number;
    hasParent: boolean;
    hasChildren: boolean;
    isCircular: boolean;
  };
}

export class EnhancedMergeController {
  /**
   * POST /api/subchats/:id/merge
   * Enhanced merge with comprehensive validation and error handling
   */
  async mergeSubchat(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();
    const { id: subchatId } = req.params;
    const userId = req.user?.userId;

    try {
      // Validate authentication
      if (!userId) {
        res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required',
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] as string,
          },
        });
        return;
      }

      logger.info('Starting enhanced subchat merge process', {
        subchatId,
        userId,
        requestId: req.headers['x-request-id']
      });

      // Step 1: Validate merge eligibility
      const validation = await this.validateMergeEligibility(subchatId, userId);
      if (!validation.canMerge) {
        res.status(400).json({
          success: false,
          error: {
            code: 'MERGE_NOT_ALLOWED',
            message: 'Sub-chat cannot be merged',
            details: validation.errors,
            warnings: validation.warnings,
            metadata: validation.metadata,
            timestamp: new Date().toISOString(),
          },
        });
        return;
      }

      // Log warnings if any
      if (validation.warnings.length > 0) {
        logger.warn('Merge warnings detected', {
          subchatId,
          warnings: validation.warnings
        });
      }

      // Step 2: Perform the merge
      const mergeResult = await this.performMerge(subchatId, userId, validation.metadata);
      
      if (!mergeResult.success) {
        res.status(500).json({
          success: false,
          error: {
            code: 'MERGE_FAILED',
            message: mergeResult.error || 'Failed to merge sub-chat',
            warnings: mergeResult.warnings,
            timestamp: new Date().toISOString(),
          },
        });
        return;
      }

      // Step 3: Update parent conversation
      await this.updateParentConversation(mergeResult.subchat.conversationId);

      const processingTime = Date.now() - startTime;

      logger.info('Enhanced subchat merge completed successfully', {
        subchatId,
        userId,
        processingTime,
        memoryStored: mergeResult.memoryStored,
        warnings: mergeResult.warnings?.length || 0
      });

      res.status(200).json({
        success: true,
        data: {
          subchat: mergeResult.subchat,
          summary: mergeResult.summary,
          injectedMessage: mergeResult.injectedMessage,
          memoryStored: mergeResult.memoryStored,
          warnings: mergeResult.warnings,
          metadata: {
            processingTime,
            validation: validation.metadata
          }
        },
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      logger.error('Enhanced subchat merge failed', {
        subchatId,
        userId,
        error,
        processingTime
      });

      res.status(500).json({
        success: false,
        error: {
          code: 'MERGE_ERROR',
          message: 'Failed to merge sub-chat',
          details: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string,
        },
      });
    }
  }

  /**
   * Comprehensive merge eligibility validation
   */
  private async validateMergeEligibility(subchatId: string, userId: string): Promise<MergeValidation> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const metadata = {
      messageCount: 0,
      branchDepth: 0,
      hasParent: false,
      hasChildren: false,
      isCircular: false
    };

    try {
      // Find subchat with full hierarchy
      const subchat = await Subchat.findById(subchatId)
        .populate('conversationId')
        .populate('parentSubchatId')
        .populate('childSubchatIds');

      if (!subchat) {
        errors.push('Sub-chat not found');
        return { canMerge: false, errors, warnings, metadata };
      }

      // Validate ownership
      const hasOwnership = await Subchat.validateBranchOwnership(subchatId, userId);
      if (!hasOwnership) {
        errors.push('Access denied: You do not own this sub-chat');
        return { canMerge: false, errors, warnings, metadata };
      }

      // Check status
      if (subchat.status !== 'active') {
        errors.push(`Cannot merge sub-chat with status: ${subchat.status}`);
        return { canMerge: false, errors, warnings, metadata };
      }

      // Check message count
      metadata.messageCount = subchat.messageCount;
      if (subchat.messageCount === 0) {
        errors.push('Cannot merge empty sub-chat');
        return { canMerge: false, errors, warnings, metadata };
      }

      // Check branch depth
      metadata.branchDepth = subchat.branchDepth;
      if (subchat.branchDepth >= 10) {
        warnings.push('Branch depth is very high, merge may take longer');
      }

      // Check for circular references
      const circularRefs = await Subchat.findCircularReferences(subchatId);
      metadata.isCircular = circularRefs.length > 0;
      if (metadata.isCircular) {
        errors.push('Circular reference detected in branch hierarchy');
        return { canMerge: false, errors, warnings, metadata };
      }

      // Check parent relationship
      metadata.hasParent = !!subchat.parentSubchatId;
      if (metadata.hasParent) {
        const parent = subchat.parentSubchatId as any;
        if (parent.status !== 'active') {
          warnings.push('Parent sub-chat is not active');
        }
      }

      // Check child relationships
      metadata.hasChildren = subchat.childSubchatIds && subchat.childSubchatIds.length > 0;
      if (metadata.hasChildren) {
        warnings.push('This sub-chat has child branches that will remain active');
      }

      // Check conversation integrity
      const conversation = subchat.conversationId as any;
      if (!conversation) {
        errors.push('Parent conversation not found');
        return { canMerge: false, errors, warnings, metadata };
      }

      // Check for duplicate merges
      const existingMerges = await Message.find({
        conversationId: conversation._id,
        'metadata.fromSubchat': subchatId
      });

      if (existingMerges.length > 0) {
        errors.push('This sub-chat has already been merged');
        return { canMerge: false, errors, warnings, metadata };
      }

      return { canMerge: true, errors, warnings, metadata };

    } catch (error) {
      errors.push(`Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return { canMerge: false, errors, warnings, metadata };
    }
  }

  /**
   * Perform the actual merge operation
   */
  private async performMerge(subchatId: string, userId: string, metadata: any): Promise<MergeResult> {
    const warnings: string[] = [];
    let subchat: any;
    let summary: any;
    let injectedMessage: any;
    let memoryStored = false;

    try {
      // Step 1: Get subchat with full details
      subchat = await Subchat.findById(subchatId).populate('conversationId');
      if (!subchat) {
        return { success: false, error: 'Sub-chat not found' };
      }

      // Step 2: Generate transcript
      const transcript = await this.generateCleanTranscript(subchatId);
      if (!transcript || transcript.trim().length === 0) {
        return { success: false, error: 'Failed to generate valid transcript' };
      }

      // Step 3: Generate summary using AI service
      try {
        summary = await aiService.summarize(transcript, {
          type: 'key-points',
          length: 'medium',
          format: 'markdown'
        });

        logger.info('Generated summary for subchat', {
          subchatId,
          summaryLength: summary.summary.length,
          actionsCount: summary.actions?.length || 0,
          artifactsCount: summary.artifacts?.length || 0,
          keywordsCount: summary.keywords?.length || 0,
        });
      } catch (summaryError) {
        logger.error('Failed to generate summary', {
          subchatId,
          error: summaryError
        });
        
        // Create fallback summary
        summary = {
          summary: transcript.substring(0, 500) + '...',
          actions: [],
          artifacts: [],
          keywords: this.extractKeywords(transcript)
        };
        
        warnings.push('Used fallback summary due to AI service error');
      }

      // Step 4: Update subchat status
      subchat.status = 'resolved';
      subchat.summary = summary.summary;
      subchat.fullSummary = summary.fullSummary || summary.summary;
      subchat.resolvedAt = new Date();
      await subchat.save();

      // Step 5: Create injected message with duplicate prevention
      try {
        injectedMessage = await this.createInjectedMessage(
          subchat.conversationId._id.toString(),
          summary,
          subchatId
        );
      } catch (injectionError) {
        logger.error('Failed to create injected message', {
          subchatId,
          error: injectionError
        });
        return { success: false, error: 'Failed to create injected message' };
      }

      // Step 6: Store in memory if applicable
      if (subchat.includeInMemory) {
        try {
          const user = await User.findById(userId);
          if (user && user.memoryOptIn && memoryService.isAvailable()) {
            await memoryService.storeMemory({
              subchatId: subchatId,
              conversationId: subchat.conversationId._id.toString(),
              userId: userId,
              summary: summary.summary,
              keywords: summary.keywords || [],
              actions: summary.actions || [],
              artifacts: summary.artifacts || [],
              createdAt: subchat.createdAt,
              mergedAt: subchat.resolvedAt!,
            });
            
            memoryStored = true;
            logger.info('Stored subchat summary in memory', { subchatId, userId });
          } else {
            warnings.push('Memory storage skipped - user opt-in or service unavailable');
          }
        } catch (memoryError) {
          logger.warn('Failed to store in memory, continuing with merge', {
            subchatId,
            error: memoryError
          });
          warnings.push('Memory storage failed but merge completed successfully');
        }
      }

      return {
        success: true,
        subchat: {
          id: subchat.id,
          status: subchat.status,
          summary: subchat.summary,
          resolvedAt: subchat.resolvedAt
        },
        summary,
        injectedMessage: {
          id: injectedMessage.id,
          content: injectedMessage.content,
          createdAt: injectedMessage.createdAt
        },
        memoryStored,
        warnings
      };

    } catch (error) {
      logger.error('Merge operation failed', {
        subchatId,
        error
      });
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Generate clean transcript with context isolation
   */
  private async generateCleanTranscript(subchatId: string): Promise<string> {
    try {
      const messages = await SubchatMessage.find({ subchatId })
        .sort({ createdAt: 1 })
        .select('role content createdAt metadata')
        .lean();

      if (!messages || messages.length === 0) {
        return '';
      }

      // Ensure context isolation by only including messages from this subchat
      return messages.map((msg: any) => {
        const timestamp = msg.createdAt.toISOString();
        const roleLabel = msg.role.charAt(0).toUpperCase() + msg.role.slice(1);
        const content = this.sanitizeContent(msg.content);
        return `[${timestamp}] ${roleLabel}: ${content}`;
      }).join('\n\n');

    } catch (error) {
      logger.error('Failed to generate transcript', {
        subchatId,
        error
      });
      throw new Error('Failed to generate transcript from subchat messages');
    }
  }

  /**
   * Sanitize content to prevent injection
   */
  private sanitizeContent(content: string): string {
    return content
      .replace(/[\x00-\x1F\x7F]/g, '') // Remove control characters
      .replace(/<script[^>]*>.*?<\/script>/gi, '') // Remove scripts
      .replace(/javascript:/gi, '') // Remove javascript URLs
      .replace(/on\w+\s*=/gi, '') // Remove event handlers
      .trim();
  }

  /**
   * Extract keywords as fallback
   */
  private extractKeywords(text: string): string[] {
    const commonWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
      'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did',
      'will', 'would', 'could', 'should', 'may', 'might', 'can', 'this', 'that', 'these', 'those'
    ]);
    
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 3 && !commonWords.has(word))
      .slice(0, 10);
  }

  /**
   * Create injected message with duplicate prevention
   */
  private async createInjectedMessage(
    conversationId: string,
    summary: any,
    subchatId: string
  ): Promise<any> {
    // Check for duplicate injections
    const existingInjection = await Message.findOne({
      conversationId,
      'metadata.fromSubchat': subchatId
    });

    if (existingInjection) {
      logger.warn('Duplicate injection detected, returning existing message', {
        subchatId,
        existingMessageId: existingInjection.id
      });
      return existingInjection;
    }

    // Format the summary content for injection
    const content = this.formatSummaryForInjection(summary);

    const injectedMessage = new Message({
      conversationId,
      role: 'assistant',
      content,
      metadata: {
        fromSubchat: true,
        subchatId,
        tokens: Math.ceil(content.length / 4),
        provider: 'merge-summary',
        mergeTimestamp: new Date().toISOString()
      },
    });

    await injectedMessage.save();
    return injectedMessage;
  }

  /**
   * Format summary for injection with clean structure
   */
  private formatSummaryForInjection(summary: any): string {
    let content = `## Branch Summary\n\n${summary.summary}`;

    if (summary.actions && summary.actions.length > 0) {
      content += `\n\n### Actions Taken\n`;
      summary.actions.forEach((action: string, index: number) => {
        content += `${index + 1}. ${action}\n`;
      });
    }

    if (summary.artifacts && summary.artifacts.length > 0) {
      content += `\n\n### Artifacts Created\n`;
      summary.artifacts.forEach((artifact: string, index: number) => {
        content += `${index + 1}. ${artifact}\n`;
      });
    }

    if (summary.keywords && summary.keywords.length > 0) {
      content += `\n\n### Key Topics\n`;
      content += summary.keywords.join(', ');
    }

    content += `\n\n---\n*Merged from branch discussion*`;

    return content;
  }

  /**
   * Update parent conversation metadata
   */
  private async updateParentConversation(conversationId: string): Promise<void> {
    try {
      await Conversation.findByIdAndUpdate(
        conversationId,
        { 
          lastMessageAt: new Date(),
          $inc: { messageCount: 1 }
        }
      );
    } catch (error) {
      logger.error('Failed to update parent conversation', {
        conversationId,
        error
      });
      // Don't fail the merge if this fails
    }
  }

  /**
   * Get merge statistics for monitoring
   */
  async getMergeStatistics(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const stats = await Subchat.aggregate([
        { $match: { userId } },
        {
          $group: {
            _id: null,
            totalBranches: { $sum: 1 },
            mergedBranches: { $sum: { $cond: [{ $eq: ['$status', 'resolved'] }, 1, 0] } },
            cancelledBranches: { $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] } },
            activeBranches: { $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] } },
            avgMessagesPerBranch: { $avg: '$messageCount' },
            maxBranchDepth: { $max: '$branchDepth' },
            totalMergesToday: {
              $sum: {
                $cond: [
                  { $gte: ['$resolvedAt', new Date(new Date().setHours(0, 0, 0, 0))] },
                  1,
                  0
                ]
              }
            }
          }
        }
      ]);

      res.json({
        success: true,
        data: stats[0] || {
          totalBranches: 0,
          mergedBranches: 0,
          cancelledBranches: 0,
          activeBranches: 0,
          avgMessagesPerBranch: 0,
          maxBranchDepth: 0,
          totalMergesToday: 0
        }
      });

    } catch (error) {
      logger.error('Failed to get merge statistics', { error });
      res.status(500).json({ error: 'Failed to get statistics' });
    }
  }
}

// Export singleton instance
export const enhancedMergeController = new EnhancedMergeController();
