/**
 * Enhanced SubchatMessage Model
 * 
 * Improved data integrity with:
 * - Full context isolation
 * - Message metadata tracking
 * - Enhanced indexing for performance
 * - Content validation and sanitization
 */

import mongoose, { Document, Schema } from 'mongoose';

export type SubchatMessageRole = 'user' | 'assistant' | 'system';

export interface ISubchatMessage extends Document {
  _id: mongoose.Types.ObjectId;
  subchatId: mongoose.Types.ObjectId;
  role: SubchatMessageRole;
  content: string;
  metadata?: {
    tokens?: number;
    model?: string;
    temperature?: number;
    processingTime?: number;
    isStreaming?: boolean;
    provider?: string;
    contextWindow?: number;
    cost?: number;
  };
  contextSnapshot?: {
    previousMessages: mongoose.Types.ObjectId[];
    contextLength: number;
    branchDepth: number;
  };
  
  createdAt: Date;
  updatedAt: Date;
  
  // Virtual properties
  id: string;
  
  // Instance methods
  isFromUser(): boolean;
  isFromAssistant(): boolean;
  getTokenCount(): number;
  hasContext(): boolean;
  getContextSize(): number;
  validateContent(): boolean;
}

export interface ISubchatMessageModel extends mongoose.Model<ISubchatMessage> {
  findBySubchatId(subchatId: string, options?: any): Promise<ISubchatMessage[]>;
  getSubchatHistory(subchatId: string, limit?: number): Promise<any[]>;
  generateTranscript(subchatId: string): Promise<string>;
  getTokenUsage(subchatId: string, startDate?: Date, endDate?: Date): Promise<any[]>;
  getContextWindow(subchatId: string, messageId?: string): Promise<ISubchatMessage[]>;
  validateMessageContext(subchatId: string, messageContent: string): Promise<boolean>;
  getMessageStatistics(subchatId: string): Promise<any>;
}

const subchatMessageSchema = new Schema<ISubchatMessage>({
  subchatId: {
    type: Schema.Types.ObjectId,
    ref: 'Subchat',
    required: true,
    index: true,
  },
  
  role: {
    type: String,
    enum: ['user', 'assistant', 'system'],
    required: true,
    index: true,
  },
  
  content: {
    type: String,
    required: true,
    trim: true,
    maxlength: 50000,
    validate: {
      validator: function(value: string) {
        // Basic content validation
        if (!value || value.trim().length === 0) {
          return false;
        }
        
        // Check for potential injection attempts
        const suspiciousPatterns = [
          /<script[^>]*>/gi,
          /javascript:/gi,
          /data:text\/html/gi,
          /on\w+\s*=/gi,
        ];
        
        for (const pattern of suspiciousPatterns) {
          if (pattern.test(value)) {
            return false;
          }
        }
        
        return true;
      },
      message: 'Content contains invalid characters or potential security risks'
    }
  },
  
  metadata: {
    tokens: {
      type: Number,
      min: 0,
      max: 10000,
    },
    model: {
      type: String,
      trim: true,
      maxlength: 100,
    },
    temperature: {
      type: Number,
      min: 0,
      max: 2,
    },
    processingTime: {
      type: Number,
      min: 0,
      max: 300000, // 5 minutes max
    },
    isStreaming: {
      type: Boolean,
      default: false,
    },
    provider: {
      type: String,
      trim: true,
      maxlength: 50,
      enum: ['chrome-builtin', 'gemini', 'openai', 'anthropic'],
    },
    contextWindow: {
      type: Number,
      min: 1,
      max: 100,
    },
    cost: {
      type: Number,
      min: 0,
      max: 1000, // $10 max per message
    },
  },
  
  contextSnapshot: {
    previousMessages: [{
      type: Schema.Types.ObjectId,
      ref: 'SubchatMessage'
    }],
    contextLength: {
      type: Number,
      min: 0,
      max: 1000000, // 1MB max context
    },
    branchDepth: {
      type: Number,
      min: 0,
      max: 10,
    },
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
subchatMessageSchema.index({ subchatId: 1, createdAt: 1 });
subchatSchema.index({ subchatId: 1, role: 1 });
subchatSchema.index({ subchatId: 1, createdAt: -1 });
subchatSchema.index({ createdAt: -1 });
subchatMessageSchema.index({ 'metadata.provider': 1, createdAt: -1 });
subchatMessageSchema.index({ 'metadata.isStreaming': 1, createdAt: -1 });

// Compound indexes for complex queries
subchatMessageSchema.index({ subchatId: 1, role: 1, createdAt: 1 });
subchatMessageSchema.index({ subchatId: 1, 'metadata.tokens': 1 });

// Virtual for id
subchatMessageSchema.virtual('id').get(function() {
  return this._id.toHexString();
});

// Instance methods
subchatMessageSchema.methods.isFromUser = function() {
  return this.role === 'user';
};

subchatMessageSchema.methods.isFromAssistant = function() {
  return this.role === 'assistant';
};

subchatMessageSchema.methods.getTokenCount = function() {
  return this.metadata?.tokens || 0;
};

subchatMessageSchema.methods.hasContext = function() {
  return !!(this.contextSnapshot?.previousMessages?.length === 0);
};

subchatMessage.methods.getContextSize = function() {
  return this.contextSnapshot?.contextLength || 0;
};

subchatMessageSchema.methods.validateContent = function() {
  // Additional content validation can be added here
  return this.content && this.content.trim().length > 0;
};

// Static methods
subchatMessageSchema.statics.findBySubchatId = function(
  subchatId: string,
  options: {
    page?: number;
    limit?: number;
    sortOrder?: 'asc' | 'desc';
    role?: SubchatMessageRole;
    includeMetadata?: boolean;
  } = {}
) {
  const {
    page = 1,
    limit = 50,
    sortOrder = 'asc',
    role,
    includeMetadata = false
  } = options;
  
  const skip = (page - 1) * limit;
  const sort = { createdAt: sortOrder === 'desc' ? -1 : 1 };
  
  const query: any = { subchatId };
  if (role) {
    query.role = role;
  }
  
  let queryBuilder = this.find(query).sort(sort).skip(skip).limit(limit);
  
  if (includeMetadata) {
    queryBuilder = queryBuilder.select('role content metadata contextSnapshot createdAt');
  } else {
    queryBuilder = queryBuilder.select('role content createdAt');
  }
  
  return queryBuilder;
};

subchatSchema.statics.getSubchatHistory = function(
  subchatId: string,
  limit: number = 20
) {
  return this.find({ subchatId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .select('role content metadata.tokens metadata.model metadata.provider createdAt')
    .lean();
};

subchatSchema.statics.generateTranscript = function(subchatId: string) {
  return this.find({ subchatId })
    .sort({ createdAt: 1 })
    .select('role content createdAt')
    .lean()
    .then((messages: any[]) => {
      return messages.map((msg: any) => {
        const timestamp = msg.createdAt.toISOString();
        const roleLabel = msg.role.charAt(0).toUpperCase() + msg.role.slice(1);
        return `[${timestamp}] ${roleLabel}: ${msg.content}`;
      }).join('\n\n');
    });
};

subchatSchema.statics.getTokenUsage = function(
  subchatId: string,
  startDate?: Date,
  endDate?: Date
) {
  const match: any = { subchatId };
  
  if (startDate || endDate) {
    match.createdAt = {};
    if (startDate) match.createdAt.$gte = startDate;
    if (endDate) match.createdAt.$lte = endDate;
  }
  
  return this.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$role',
        totalTokens: { $sum: '$metadata.tokens' },
        messageCount: { $sum: 1 },
        avgTokens: { $avg: '$metadata.tokens' },
        maxTokens: { $max: '$metadata.tokens' },
        minTokens: { $min: '$metadata.tokens' },
        providers: { $addToSet: '$metadata.provider' },
        streamingMessages: { $sum: { $cond: [{ $eq: ['$metadata.isStreaming', true] }, 1, 0] } }
      }
    },
    {
      $project: {
        _id: 0,
        role: '$_id',
        totalTokens: 1,
        messageCount: 1,
        avgTokens: { $round: ['$avgTokens', 2] },
        maxTokens: 1,
        minTokens: 1,
        providers: 1,
        streamingMessages: 1
      }
    }
  ]);
};

subchatSchema.statics.getContextWindow = function(
  subchatId: string,
  messageId?: string
) {
  try {
    // If messageId is provided, get context around that message
    if (messageId) {
      const targetMessage = await this.findById(messageId);
      if (!targetMessage) {
        throw new Error('Message not found');
      }
      
      // Get messages before and after the target
      const contextWindow = 10; // 5 messages before and after
      const messages = await this.find({
        subchatId,
        createdAt: {
          $lt: targetMessage.createdAt
        }
      })
        .sort({ createdAt: -1 })
        .limit(contextWindow)
        .select('_id createdAt content role')
        .lean();
      
      // Add the target message and messages after
      const afterMessages = await this.find({
        subchatId,
        createdAt: {
          $gt: targetMessage.createdAt
        }
      })
        .sort({ createdAt: 1 })
        .limit(contextWindow)
        .select('_id createdAt content role')
        .lean();
      
      return [...messages.reverse(), targetMessage, ...afterMessages];
    } else {
      // Get the most recent messages for context
      return this.find({ subchatId })
        .sort({ createdAt: -1 })
        .limit(20)
        .select('_id createdAt content role')
        .lean();
    }
  } catch (error) {
      throw new Error(`Failed to get context window: ${error.message}`);
    }
  };

subchatSchema.statics.validateMessageContext = async function(
  subchatId: string,
  messageContent: string
): Promise<boolean> {
  try {
    // Get the subchat to check branch depth
    const subchat = await mongoose.model('Subchat').findById(subchatId);
    if (!subchat) {
      return false;
    }
    
    // Check if branch depth is within limits
    if (subchat.branchDepth >= 10) {
      return false;
    }
    
    // Check content length
    if (messageContent.length > 50000) {
      return false;
    }
    
    // Additional context validation can be added here
    return true;
  } catch (error) {
    return false;
  }
};

subchatSchema.statics.getMessageStatistics = function(subchatId: string) {
  return this.aggregate([
    { $match: { subchatId } },
    {
      $group: {
        _id: null,
        totalMessages: { $sum: 1 },
        userMessages: {
          $sum: { $cond: [{ $eq: ['$role', 'user'] }, 1, 0] }
        },
        assistantMessages: {
          $sum: { $cond: [{ $eq: ['$role', 'assistant'] }, 1, 0] }
        },
        systemMessages: {
          $sum: { $cond: [{ $eq: ['$role', 'system'] }, 1, 0] }
        },
        totalTokens: { $sum: '$metadata.tokens' },
        avgTokens: { $avg: '$metadata.tokens' },
        maxTokens: { $max: '$metadata.tokens' },
        minTokens: { $min: '$metadata.tokens' },
        streamingMessages: {
          $sum: { $cond: [{ $eq: ['$metadata.isStreaming', true] }, 1, 0] }
        },
        providers: { $addToSet: '$metadata.provider' },
        avgProcessingTime: { $avg: '$metadata.processingTime' },
        avgContextLength: { $avg: '$contextSnapshot.contextLength' }
      }
    },
    {
      $project: {
        _id: 0,
        totalMessages: 1,
        userMessages: 1,
        assistantMessages: 1,
        systemMessages: 1,
        totalTokens: 1,
        avgTokens: { $round: ['$avgTokens', 2] },
        maxTokens: 1,
        minTokens: 1,
        streamingMessages: 1,
        providers: 1,
        avgProcessingTime: { $round: ['$avgProcessingTime', 2] },
        avgContextLength: { $round: ['$avgContextLength', 2] }
      }
    }
  ]);
};

// Pre-save middleware for validation
subchatMessageSchema.pre('save', async function(next) {
  // Validate content
  if (!this.validateContent()) {
    throw new Error('Message content validation failed');
  }
  
  // Update context snapshot if this is the first message in a while
  if (this.isNew() || this.isModified('content')) {
    try {
      const recentMessages = await this.constructor.find({
        subchatId: this.subchatId
      })
        .sort({ createdAt: -1 })
        .limit(5)
        .select('_id')
        .lean();
      
      const subchat = await mongoose.model('Subchat').findById(this.subchatId);
      
      if (recentMessages.length > 0 && subchat) {
        this.contextSnapshot = {
          previousMessages: recentMessages.map(msg => msg._id),
          contextLength: recentMessages.length,
          branchDepth: subchat.branchDepth
        };
      }
    } catch (error) {
      // Don't fail the save if context snapshot fails
      console.warn('Failed to create context snapshot:', error);
    }
  }
  
  next();
});

export const SubchatMessage = mongoose.model<ISubchatMessage, ISubchatMessageModel>('SubchatMessage', subchatMessageSchema);
