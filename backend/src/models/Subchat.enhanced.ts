/**
 * Enhanced Subchat Model
 * 
 * Improved data integrity with:
 * - Full context isolation
 * - Branch ownership validation
 * - Prevent circular references
 * - Enhanced indexing for performance
 */

import mongoose, { Document, Schema } from 'mongoose';

export type SubchatStatus = 'active' | 'resolved' | 'cancelled' | 'merged';

export interface ISubchat extends Document {
  _id: mongoose.Types.ObjectId;
  conversationId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId | string;
  parentMessageId?: mongoose.Types.ObjectId;
  title: string;
  status: SubchatStatus;
  contextMessage?: string;
  summary?: string;
  fullSummary?: string;
  includeInMemory: boolean;
  autoSend: boolean;
  branchDepth: number;
  parentSubchatId?: mongoose.Types.ObjectId;
  childSubchatIds: mongoose.Types.ObjectId[];
  mergeHistory?: {
    mergedAt: Date;
    summaryId?: mongoose.Types.ObjectId;
    injectedMessageId: mongoose.Types.ObjectId;
  }[];
  
  createdAt: Date;
  updatedAt: Date;
  resolvedAt?: Date;
  mergedAt?: Date;
  messageCount: number;
  lastActivityAt: Date;
  
  // Virtual properties
  id: string;
  
  // Instance methods
  isActive(): boolean;
  isResolved(): boolean;
  isMerged(): boolean;
  canMerge(): boolean;
  resolve(summary?: string): Promise<ISubchat>;
  cancel(): Promise<ISubchat>;
  merge(summaryId?: mongoose.Types.ObjectId): Promise<ISubchat>;
  incrementMessageCount(): Promise<ISubchat>;
  generateTitle(firstMessage: string): Promise<ISubchat>;
  addChildSubchat(childId: mongoose.Types.ObjectId): Promise<void>;
  removeChildSubchat(childId: mongoose.Types.ObjectId): Promise<void>;
  validateBranchIntegrity(): Promise<boolean>;
}

export interface ISubchatModel extends mongoose.Model<ISubchat> {
  findByConversationId(conversationId: string, options?: any): Promise<ISubchat[]>;
  findActiveByUserId(userId: string): Promise<ISubchat[]>;
  getResolvedWithSummaries(userId: string, limit?: number): Promise<ISubchat[]>;
  findBranchHierarchy(subchatId: string): Promise<ISubchat[]>;
  validateBranchOwnership(subchatId: string, userId: string): Promise<boolean>;
  findCircularReferences(subchatId: string): Promise<string[]>;
  getBranchStatistics(conversationId: string): Promise<any>;
}

const subchatSchema = new Schema<ISubchat>({
  conversationId: {
    type: Schema.Types.ObjectId,
    ref: 'Conversation',
    required: true,
    index: true,
  },
  
  userId: {
    type: Schema.Types.Mixed, // Allow both ObjectId and string for guest users
    required: true,
    index: true,
  },
  
  parentMessageId: {
    type: Schema.Types.ObjectId,
    ref: 'Message',
    index: true,
    validate: {
      validator: function(this: any, value: any) {
        // If parentMessageId is provided, ensure it exists in the conversation
        if (value && this.conversationId) {
          // This will be validated in the pre-save hook
          return true;
        }
        return true;
      },
      message: 'Parent message must belong to the same conversation'
    }
  },
  
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200,
    default: 'New Sub-chat',
  },
  
  status: {
    type: String,
    enum: ['active', 'resolved', 'cancelled', 'merged'],
    default: 'active',
    required: true,
    index: true,
  },
  
  contextMessage: {
    type: String,
    trim: true,
    maxlength: 10000,
  },
  
  summary: {
    type: String,
    trim: true,
    maxlength: 5000,
  },
  
  fullSummary: {
    type: String,
    trim: true,
    maxlength: 10000,
  },
  
  includeInMemory: {
    type: Boolean,
    default: true,
    required: true,
  },
  
  autoSend: {
    type: Boolean,
    default: false,
    required: true,
  },
  
  // Branch hierarchy tracking
  branchDepth: {
    type: Number,
    default: 0,
    min: 0,
    max: 10, // Prevent infinite branching
    required: true,
  },
  
  parentSubchatId: {
    type: Schema.Types.ObjectId,
    ref: 'Subchat',
    index: true,
    default: null,
  },
  
  childSubchatIds: [{
    type: Schema.Types.ObjectId,
    ref: 'Subchat'
  }],
  
  mergeHistory: [{
    mergedAt: {
      type: Date,
      required: true,
    },
    summaryId: {
      type: Schema.Types.ObjectId,
      ref: 'Summary',
    },
    injectedMessageId: {
      type: Schema.Types.ObjectId,
      ref: 'Message',
      required: true,
    }
  }],
  
  lastActivityAt: {
    type: Date,
    default: Date.now,
    index: true,
  },
  
  messageCount: {
    type: Number,
    default: 0,
    min: 0,
  },
}, {
  timestamps: true,
  toJSON: {
    virtuals: true,
    transform: function(_doc, ret: any) {
      delete ret._id;
      delete ret.__v;
      return ret;
    }
  },
  toObject: {
    virtuals: true,
  }
});

// Enhanced indexes for performance
subchatSchema.index({ conversationId: 1, status: 1, branchDepth: 1 });
subchatSchema.index({ userId: 1, status: 1, lastActivityAt: -1 });
subchatSchema.index({ userId: 1, createdAt: -1 });
subchatSchema.index({ status: 1, createdAt: -1 });
subchatSchema.index({ parentSubchatId: 1 }); // For branch hierarchy
subchatSchema.index({ parentMessageId: 1 }); // For parent message validation
subchatSchema.index({ lastActivityAt: 1 }); // For cleanup
subchatSchema.index({ branchDepth: 1 }); // For depth validation

// Compound indexes for complex queries
subchatSchema.index({ conversationId: 1, userId: 1, status: 1 });
subchatSchema.index({ parentSubchatId: 1, status: 1 });

// Virtual for id
subchatSchema.virtual('id').get(function() {
  return this._id.toHexString();
});

// Instance methods
subchatSchema.methods.isActive = function() {
  return this.status === 'active';
};

subchatSchema.methods.isResolved = function() {
  return this.status === 'resolved';
};

subchat.methods.isMerged = function() {
  return this.status === 'merged';
};

subchatSchema.methods.canMerge = function() {
  return this.isActive() && this.messageCount > 0;
};

subchatSchema.methods.resolve = function(summary?: string) {
  this.status = 'resolved';
  this.resolvedAt = new Date();
  if (summary) {
    this.summary = summary;
  }
  return this.save();
};

subchatSchema.methods.cancel = function() {
  this.status = 'cancelled';
  return this.save();
};

subchatSchema.methods.merge = function(summaryId?: mongoose.Types.ObjectId) {
  this.status = 'merged';
  this.mergedAt = new Date();
  
  // Add to merge history
  if (!this.mergeHistory) {
    this.mergeHistory = [];
  }
  
  this.mergeHistory.push({
    mergedAt: new Date(),
    summaryId,
    injectedMessageId: null // Will be set when message is created
  });
  
  return this.save();
};

subchatSchema.methods.incrementMessageCount = function() {
  this.messageCount += 1;
  this.lastActivityAt = new Date();
  return this.save();
};

subchatMethods.generateTitle = function(firstMessage: string) {
  // Generate a title from the first message or context
  const source = firstMessage || this.contextMessage || 'Sub-chat';
  const title = source
    .replace(/\n/g, ' ')
    .trim()
    .substring(0, 50);
  
  this.title = title + (source.length > 50 ? '...' : '');
  return this.save();
};

subchatSchema.methods.addChildSubchat = async function(childId: mongoose.Types.ObjectId) {
  if (!this.childSubchatIds) {
    this.childSubchatIds = [];
  }
  
  // Check if child already exists
  if (!this.childSubchatIds.includes(childId)) {
    this.childSubchatIds.push(childId);
  }
  
  return this.save();
};

subchatSchema.methods.removeChildSubchat = async function(childId: mongoose.Types.ObjectId) {
  if (this.childSubchatIds) {
    this.childSubchatIds = this.childSubchatIds.filter(id => !id.equals(childId));
  }
  
  return this.save();
};

subchatSchema.methods.validateBranchIntegrity = async function(): Promise<boolean> {
  try {
    // Check for circular references
    const circularRefs = await this.constructor.findCircularReferences(this._id.toString());
    if (circularRefs.length > 0) {
      logger.warn('Circular reference detected in branch', {
        subchatId: this._id,
        circularRefs
      });
      return false;
    }
    
    // Validate branch depth
    if (this.branchDepth > 10) {
      logger.warn('Branch depth exceeded limit', {
        subchatId: this._id,
        branchDepth: this.branchDepth
      });
      return false;
    }
    
    // Validate parent exists if specified
    if (this.parentSubchatId) {
      const parent = await this.constructor.findById(this.parentSubchatId);
      if (!parent) {
        logger.warn('Parent subchat not found', {
          subchatId: this._id,
          parentSubchatId: this.parentSubchatId
        });
        return false;
      }
    }
    
    return true;
  } catch (error) {
    logger.error('Error validating branch integrity', {
      subchatId: this._id,
      error
    });
    return false;
  }
};

// Static methods
subchatSchema.statics.findByConversationId = function(
  conversationId: string,
  options: {
    status?: SubchatStatus;
    page?: number;
    limit?: number;
    sortOrder?: 'asc' | 'desc';
    includeBranchDepth?: boolean;
  } = {}
) {
  const {
    status,
    page = 1,
    limit = 20,
    sortOrder = 'desc',
    includeBranchDepth = false
  } = options;
  
  const skip = (page - 1) * limit;
  const sort: any = { createdAt: sortOrder === 'desc' ? -1 : 1 };
  
  const query: any = { conversationId };
  if (status) {
    query.status = status;
  }
  
  let queryBuilder = this.find(query).sort(sort).skip(skip).limit(limit);
  
  if (includeBranchDepth) {
    queryBuilder = queryBuilder.populate('parentSubchatId', 'title status')
      .populate('childSubchatIds', 'title status');
  }
  
  return queryBuilder;
};

subchatSchema.statics.findActiveByUserId = function(userId: string) {
  return this.find({ 
    userId, 
    status: 'active' 
  })
    .sort({ lastActivityAt: -1 })
    .populate('conversationId', 'title')
    .populate('parentSubchatId', 'title');
};

subchatSchema.statics.getResolvedWithSummaries = function(
  userId: string,
  limit: number = 10
) {
  return this.find({
    userId,
    status: 'resolved',
    summary: { $exists: true, $ne: '' }
  })
    .sort({ resolvedAt: -1 })
    .limit(limit)
    .select('title summary fullSummary resolvedAt includeInMemory conversationId mergeHistory')
    .populate('mergeHistory.injectedMessageId', 'content createdAt');
};

subchatSchema.statics.findBranchHierarchy = function(subchatId: string) {
  return this.find({
    $or: [
      { _id: subchatId },
      { parentSubchatId: subchatId },
      { childSubchatIds: subchatId }
    ]
  })
  .sort({ branchDepth: 1, createdAt: 1 })
  .populate('parentSubchatId', 'title status')
    .populate('childSubchatIds', 'title status');
};

subchatSchema.statics.validateBranchOwnership = async function(
  subchatId: string,
  userId: string
): Promise<boolean> {
  try {
    const subchat = await this.findById(subchatId);
    if (!subchat) {
      return false;
    }
    
    // Check direct ownership
    if (subchat.userId.toString() === userId) {
      return true;
    }
    
    // Check if user owns the parent conversation
    const conversation = await mongoose.model('Conversation').findById(subchat.conversationId);
    if (!conversation) {
      return false;
    }
    
    return conversation.userId.toString() === userId;
  } catch (error) {
    logger.error('Error validating branch ownership', { subchatId, userId, error });
    return false;
  }
};

subchatSchema.statics.findCircularReferences = async function(subchatId: string): Promise<string[]> {
  const visited = new Set<string>();
  const path: string[] = [];
  
  const dfs = async (currentId: string): Promise<boolean> => {
    if (visited.has(currentId)) {
      path.push(currentId);
      return true; // Circular reference found
    }
    
    visited.add(currentId);
    path.push(currentId);
    
    const subchat = await this.findById(currentId);
    if (!subchat || !subchat.parentSubchatId) {
      path.pop();
      return false;
    }
    
    return await dfs(subchat.parentSubchatId.toString());
  };
  
  await dfs(subchatId);
  
  // Return the circular path if found
  return visited.has(subchatId) ? path : [];
};

subchatSchema.statics.getBranchStatistics = async function(conversationId: string) {
  const stats = await this.aggregate([
    { $match: { conversationId } },
    {
      $group: {
        _id: null,
        totalBranches: { $sum: 1 },
        activeBranches: {
          $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] }
        },
        resolvedBranches: {
          $sum: { $cond: [{ $eq: ['$status', 'resolved'] }, 1, 0] }
        },
        cancelledBranches: {
          $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] }
        },
        mergedBranches: {
          $sum: { $cond: [{ $eq: ['$status', 'merged'] }, 1, 0] }
        },
        maxDepth: { $max: '$branchDepth' },
        avgDepth: { $avg: '$branchDepth' },
        totalMessages: { $sum: '$messageCount' },
        avgMessages: { $avg: '$messageCount' }
      }
    }
  ]);
  
  return stats[0] || {
    totalBranches: 0,
    activeBranches: 0,
    resolvedBranches: 0,
    cancelledBranches: 0,
    mergedBranches: 0,
    maxDepth: 0,
    avgDepth: 0,
    totalMessages: 0,
    avgMessages: 0
  };
};

// Pre-save middleware
subchatSchema.pre('save', async function(next) {
  // Set resolvedAt when status changes to resolved
  if (this.isModified('status') && this.status === 'resolved' && !this.resolvedAt) {
    this.resolvedAt = new Date();
  }
  
  // Set mergedAt when status changes to merged
  if (this.isModified('status') && this.status === 'merged' && !this.mergedAt) {
    this.mergedAt = new Date();
  }
  
  // Clear timestamps when status is not resolved/merged
  if (this.status !== 'resolved') {
    this.resolvedAt = undefined;
  }
  if (this.status !== 'merged') {
    this.mergedAt = undefined;
  }
  
  // Validate parent message if provided
  if (this.isModified('parentMessageId') && this.parentMessageId) {
    const parentMessage = await mongoose.model('Message').findOne({
      _id: this.parentMessageId,
      conversationId: this.conversationId
    });
    
    if (!parentMessage) {
      throw new Error('Parent message must belong to the same conversation');
    }
  }
  
  // Validate branch integrity
  if (this.isNew() || this.isModified('parentSubchatId')) {
    const isValid = await this.validateBranchIntegrity();
    if (!isValid) {
      throw new Error('Branch integrity validation failed');
    }
  }
  
  next();
});

// Post-save middleware for cleanup
subchatSchema.post('save', async function(doc) {
  // Update lastActivityAt for parent if this is a new message
  if (doc.isModified('messageCount') && doc.parentSubchatId) {
    await this.findByIdAndUpdate(doc.parentSubchatId, {
      lastActivityAt: new Date()
    });
  }
});

export const Subchat = mongoose.model<ISubchat, ISubchatModel>('Subchat', subchatSchema);
