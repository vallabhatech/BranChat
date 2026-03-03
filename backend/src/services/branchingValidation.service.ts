/**
 * Branching Validation Service
 * 
 * Comprehensive validation for branching conversations:
 * - Branch ownership validation
 * - Circular reference detection
 * - Edge case handling
 * - Data integrity checks
 */

import { Subchat } from '../models/Subchat';
import { SubchatMessage } from '../models/SubchatMessage';
import { Conversation } from '../models/Conversation';
import { Message } from '../models/Message';
import { logger } from '../utils/logger';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  metadata: {
    branchDepth: number;
    messageCount: number;
    hasParent: boolean;
    hasChildren: boolean;
    isCircular: boolean;
    parentStatus?: string;
    childCount: number;
    conversationExists: boolean;
    userOwnsConversation: boolean;
  };
}

export interface BranchIntegrityReport {
  subchatId: string;
  isValid: boolean;
  issues: Array<{
    type: 'error' | 'warning' | 'info';
    message: string;
    code: string;
    severity: 'high' | 'medium' | 'low';
  }>;
  metadata: {
    branchDepth: number;
    messageCount: number;
    parentChain: string[];
    childBranches: string[];
    circularPath: string[];
  };
}

export class BranchingValidationService {
  /**
   * Validate branch ownership and permissions
   */
  async validateBranchOwnership(
    subchatId: string,
    userId: string
  ): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const metadata = {
      branchDepth: 0,
      messageCount: 0,
      hasParent: false,
      hasChildren: false,
      isCircular: false,
      childCount: 0,
      conversationExists: false,
      userOwnsConversation: false
    };

    try {
      // Find subchat with full hierarchy
      const subchat = await Subchat.findById(subchatId)
        .populate('conversationId')
        .populate('parentSubchatId')
        .populate('childSubchatIds');

      if (!subchat) {
        errors.push('Sub-chat not found');
        return { isValid: false, errors, warnings, metadata };
      }

      // Check direct ownership
      if (subchat.userId.toString() !== userId) {
        // Check if user owns the parent conversation
        const conversation = subchat.conversationId as any;
        if (!conversation || conversation.userId.toString() !== userId) {
          errors.push('Access denied: You do not own this sub-chat or its parent conversation');
          return { isValid: false, errors, warnings, metadata };
        }
        metadata.userOwnsConversation = true;
      }

      // Update metadata
      metadata.branchDepth = subchat.branchDepth;
      metadata.messageCount = subchat.messageCount;
      metadata.hasParent = !!subchat.parentSubchatId;
      metadata.hasChildren = subchat.childSubchatIds && subchat.childSubchatIds.length > 0;
      metadata.childCount = subchat.childSubchatIds ? subchat.childSubchatIds.length : 0;
      metadata.conversationExists = !!subchat.conversationId;

      // Validate parent relationship
      if (metadata.hasParent) {
        const parent = subchat.parentSubchatId as any;
        metadata.parentStatus = parent.status;
        
        if (parent.status !== 'active') {
          warnings.push('Parent sub-chat is not active');
        }
        
        if (parent.userId.toString() !== userId) {
          errors.push('Parent sub-chat belongs to different user');
          return { isValid: false, errors, warnings, metadata };
        }
      }

      // Validate child relationships
      if (metadata.hasChildren) {
        const children = subchat.childSubchatIds as any[];
        for (const child of children) {
          if (child.userId.toString() !== userId) {
            errors.push('Child sub-chat belongs to different user');
            return { isValid: false, errors, warnings, metadata };
          }
        }
      }

      // Check for circular references
      const circularRefs = await Subchat.findCircularReferences(subchatId);
      metadata.isCircular = circularRefs.length > 0;
      if (metadata.isCircular) {
        errors.push('Circular reference detected in branch hierarchy');
        return { isValid: false, errors, warnings, metadata };
      }

      // Validate branch depth
      if (metadata.branchDepth >= 10) {
        warnings.push('Branch depth is very high');
      }

      // Validate message count
      if (metadata.messageCount === 0) {
        warnings.push('Sub-chat has no messages');
      }

      return { isValid: true, errors, warnings, metadata };

    } catch (error) {
      errors.push(`Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return { isValid: false, errors, warnings, metadata };
    }
  }

  /**
   * Handle edge cases for branching
   */
  async handleEdgeCases(subchatId: string, userId: string): Promise<{
    canProceed: boolean;
    actions: string[];
    warnings: string[];
  }> {
    const actions: string[] = [];
    const warnings: string[] = [];
    let canProceed = true;

    try {
      const subchat = await Subchat.findById(subchatId)
        .populate('conversationId')
        .populate('parentSubchatId');

      if (!subchat) {
        return { canProceed: false, actions: ['Create new sub-chat'], warnings: ['Sub-chat not found'] };
      }

      // Edge case 1: Deleted parent conversation
      if (!subchat.conversationId) {
        actions.push('Restore or recreate parent conversation');
        warnings.push('Parent conversation has been deleted');
        canProceed = false;
      }

      // Edge case 2: Deleted parent subchat
      if (subchat.parentSubchatId && !subchat.parentSubchatId) {
        actions.push('Remove parent reference or restore parent');
        warnings.push('Parent sub-chat has been deleted');
        canProceed = false;
      }

      // Edge case 3: Empty branch
      if (subchat.messageCount === 0) {
        actions.push('Add messages to branch or delete empty branch');
        warnings.push('Branch is empty');
        canProceed = false;
      }

      // Edge case 4: Orphaned branch (parent conversation deleted but subchat exists)
      const conversation = await Conversation.findById(subchat.conversationId);
      if (!conversation) {
        actions.push('Delete orphaned branch or restore conversation');
        warnings.push('Branch is orphaned (parent conversation deleted)');
        canProceed = false;
      }

      // Edge case 5: Deep nesting
      if (subchat.branchDepth >= 8) {
        actions.push('Consider merging or reducing branch depth');
        warnings.push('Branch depth is very high');
      }

      // Edge case 6: Stale branch (no activity for long time)
      const daysSinceLastActivity = (Date.now() - subchat.lastActivityAt.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceLastActivity > 30) {
        actions.push('Consider merging or deleting stale branch');
        warnings.push(`Branch has been inactive for ${Math.floor(daysSinceLastActivity)} days`);
      }

      return { canProceed, actions, warnings };

    } catch (error) {
      return { 
        canProceed: false, 
        actions: ['Investigate system error'], 
        warnings: ['Validation system error'] 
      };
    }
  }

  /**
   * Comprehensive branch integrity report
   */
  async generateIntegrityReport(subchatId: string): Promise<BranchIntegrityReport> {
    const issues: Array<{
      type: 'error' | 'warning' | 'info';
      message: string;
      code: string;
      severity: 'high' | 'medium' | 'low';
    }> = [];

    const metadata = {
      branchDepth: 0,
      messageCount: 0,
      parentChain: [] as string[],
      childBranches: [] as string[],
      circularPath: [] as string[]
    };

    let isValid = true;

    try {
      const subchat = await Subchat.findById(subchatId)
        .populate('conversationId')
        .populate('parentSubchatId')
        .populate('childSubchatIds');

      if (!subchat) {
        issues.push({
          type: 'error',
          message: 'Sub-chat not found',
          code: 'SUBCHAT_NOT_FOUND',
          severity: 'high'
        });
        return {
          subchatId,
          isValid: false,
          issues,
          metadata
        };
      }

      metadata.branchDepth = subchat.branchDepth;
      metadata.messageCount = subchat.messageCount;

      // Check parent chain
      if (subchat.parentSubchatId) {
        const parentChain = await this.buildParentChain(subchatId);
        metadata.parentChain = parentChain;
        
        if (parentChain.length >= 10) {
          issues.push({
            type: 'error',
            message: 'Branch depth exceeds maximum allowed depth',
            code: 'MAX_DEPTH_EXCEEDED',
            severity: 'high'
          });
          isValid = false;
        }
      }

      // Check child branches
      if (subchat.childSubchatIds && subchat.childSubchatIds.length > 0) {
        metadata.childBranches = subchat.childSubchatIds.map((child: any) => child.id.toString());
        
        if (metadata.childBranches.length >= 20) {
          issues.push({
            type: 'warning',
            message: 'High number of child branches may impact performance',
            code: 'MANY_CHILD_BRANCHES',
            severity: 'medium'
          });
        }
      }

      // Check for circular references
      const circularRefs = await Subchat.findCircularReferences(subchatId);
      metadata.circularPath = circularRefs;
      
      if (circularRefs.length > 0) {
        issues.push({
          type: 'error',
          message: 'Circular reference detected in branch hierarchy',
          code: 'CIRCULAR_REFERENCE',
          severity: 'high'
        });
        isValid = false;
      }

      // Check message integrity
      const messageCount = await SubchatMessage.countDocuments({ subchatId });
      if (messageCount !== subchat.messageCount) {
        issues.push({
          type: 'warning',
          message: 'Message count mismatch detected',
          code: 'MESSAGE_COUNT_MISMATCH',
          severity: 'medium'
        });
        
        // Update the message count
        subchat.messageCount = messageCount;
        await subchat.save();
      }

      // Check conversation integrity
      const conversation = await Conversation.findById(subchat.conversationId);
      if (!conversation) {
        issues.push({
          type: 'error',
          message: 'Parent conversation not found',
          code: 'CONVERSATION_NOT_FOUND',
          severity: 'high'
        });
        isValid = false;
      }

      // Check for duplicate merges
      const duplicateMerges = await Message.find({
        conversationId: subchat.conversationId,
        'metadata.fromSubchat': subchatId
      });

      if (duplicateMerges.length > 0) {
        issues.push({
          type: 'warning',
          message: 'Sub-chat appears to have been merged already',
          code: 'DUPLICATE_MERGE',
          severity: 'medium'
        });
      }

      // Check for orphaned messages
      const orphanedMessages = await SubchatMessage.find({
        subchatId,
        content: { $exists: true, $ne: '' }
      });

      if (orphanedMessages.length === 0 && subchat.messageCount > 0) {
        issues.push({
          type: 'warning',
          message: 'No valid messages found despite message count > 0',
          code: 'ORPHANED_MESSAGES',
          severity: 'medium'
        });
      }

      return {
        subchatId,
        isValid,
        issues,
        metadata
      };

    } catch (error) {
      issues.push({
        type: 'error',
        message: `Integrity check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        code: 'INTEGRITY_CHECK_FAILED',
        severity: 'high'
      });
      
      return {
        subchatId,
        isValid: false,
        issues,
        metadata
      };
    }
  }

  /**
   * Build parent chain for a subchat
   */
  private async buildParentChain(subchatId: string): Promise<string[]> {
    const chain: string[] = [];
    let currentId = subchatId;
    const visited = new Set<string>();

    while (currentId && !visited.has(currentId)) {
      visited.add(currentId);
      chain.push(currentId);
      
      const subchat = await Subchat.findById(currentId).select('parentSubchatId');
      if (!subchat || !subchat.parentSubchatId) {
        break;
      }
      
      currentId = subchat.parentSubchatId.toString();
    }

    return chain;
  }

  /**
   * Validate branch creation prerequisites
   */
  async validateBranchCreation(
    conversationId: string,
    userId: string,
    parentMessageId?: string
  ): Promise<{
    canCreate: boolean;
    errors: string[];
    warnings: string[];
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Validate conversation exists and user owns it
      const conversation = await Conversation.findOne({
        _id: conversationId,
        userId: userId === 'guest' ? 'guest' : new mongoose.Types.ObjectId(userId)
      });

      if (!conversation) {
        errors.push('Conversation not found or access denied');
        return { canCreate: false, errors, warnings };
      }

      // Validate parent message if provided
      if (parentMessageId) {
        const parentMessage = await Message.findOne({
          _id: parentMessageId,
          conversationId: new mongoose.Types.ObjectId(conversationId)
        });

        if (!parentMessage) {
          errors.push('Parent message not found in conversation');
          return { canCreate: false, errors, warnings };
        }
      }

      // Check for too many active branches
      const activeBranchCount = await Subchat.countDocuments({
        conversationId: new mongoose.Types.ObjectId(conversationId),
        status: 'active',
        userId: userId === 'guest' ? 'guest' : new mongoose.Types.ObjectId(userId)
      });

      if (activeBranchCount >= 50) {
        warnings.push('High number of active branches may impact performance');
      }

      return { canCreate: true, errors, warnings };

    } catch (error) {
      errors.push(`Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return { canCreate: false, errors, warnings };
    }
  }

  /**
   * Cleanup orphaned branches
   */
  async cleanupOrphanedBranches(userId: string): Promise<{
    cleaned: number;
    errors: string[];
  }> {
    const errors: string[] = [];
    let cleaned = 0;

    try {
      // Find branches with deleted conversations
      const orphanedBranches = await Subchat.find({
        userId: userId === 'guest' ? 'guest' : new mongoose.Types.ObjectId(userId)
      }).populate('conversationId');

      for (const branch of orphanedBranches) {
        const conversation = branch.conversationId as any;
        if (!conversation) {
          // Delete orphaned branch
          await Subchat.findByIdAndDelete(branch._id);
          await SubchatMessage.deleteMany({ subchatId: branch._id });
          cleaned++;
          
          logger.info('Cleaned up orphaned branch', {
            subchatId: branch._id,
            userId
          });
        }
      }

      return { cleaned, errors };

    } catch (error) {
      errors.push(`Cleanup error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return { cleaned, errors };
    }
  }
}

// Export singleton instance
export const branchingValidationService = new BranchingValidationService();
