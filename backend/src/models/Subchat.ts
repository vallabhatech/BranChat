import mongoose, { Document, Schema } from 'mongoose';

export type SubchatStatus = 'active' | 'resolved' | 'cancelled';

export interface ISubchat extends Document {
  _id: mongoose.Types.ObjectId;
  conversationId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId | string;
  title: string;
  status: SubchatStatus;
  contextMessage?: string; // The message that triggered the subchat
  summary?: string; // Generated summary when resolved
  includeInMemory: boolean;
  autoSend: boolean;
  createdAt: Date;
  updatedAt: Date;
  resolvedAt?: Date;
  messageCount: number;
  
  // Virtual properties
  id: string;
  
  // Instance methods
  isActive(): boolean;
  isResolved(): boolean;
  resolve(summary?: string): Promise<ISubchat>;
  cancel(): Promise<ISubchat>;
  incrementMessageCount(): Promise<ISubchat>;
  generateTitle(firstMessage: string): Promise<ISubchat>;
}

export interface ISubchatModel extends mongoose.Model<ISubchat> {
  findByConversationId(conversationId: string, options?: any): Promise<ISubchat[]>;
  findActiveByUserId(userId: string): Promise<ISubchat[]>;
  getResolvedWithSummaries(userId: string, limit?: number): Promise<ISubchat[]>;
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
  
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200,
    default: 'New Sub-chat',
  },
  
  status: {
    type: String,
    enum: ['active', 'resolved', 'cancelled'],
    default: 'active',
    required: true,
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
  
  resolvedAt: {
    type: Date,
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

// Indexes
subchatSchema.index({ conversationId: 1, status: 1 });
subchatSchema.index({ userId: 1, status: 1 });
subchatSchema.index({ userId: 1, createdAt: -1 });
subchatSchema.index({ status: 1, createdAt: -1 });

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

subchatSchema.methods.incrementMessageCount = function() {
  this.messageCount += 1;
  return this.save();
};

subchatSchema.methods.generateTitle = function(firstMessage: string) {
  // Generate a title from the first message or context
  const source = firstMessage || this.contextMessage || 'Sub-chat';
  const title = source
    .replace(/\n/g, ' ')
    .trim()
    .substring(0, 50);
  
  this.title = title + (source.length > 50 ? '...' : '');
  return this.save();
};

// Static methods
subchatSchema.statics.findByConversationId = function(
  conversationId: string,
  options: {
    status?: SubchatStatus;
    page?: number;
    limit?: number;
    sortOrder?: 'asc' | 'desc';
  } = {}
) {
  const {
    status,
    page = 1,
    limit = 20,
    sortOrder = 'desc'
  } = options;
  
  const skip = (page - 1) * limit;
  const sort = { createdAt: sortOrder === 'desc' ? -1 : 1 };
  
  const query: any = { conversationId };
  if (status) {
    query.status = status;
  }
  
  return this.find(query)
    .sort(sort)
    .skip(skip)
    .limit(limit)
    .populate('userId', 'email isGuest');
};

subchatSchema.statics.findActiveByUserId = function(userId: string) {
  return this.find({ 
    userId, 
    status: 'active' 
  })
    .sort({ createdAt: -1 })
    .populate('conversationId', 'title');
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
    .select('title summary resolvedAt includeInMemory conversationId');
};

// Pre-save middleware
subchatSchema.pre('save', function(next) {
  // Set resolvedAt when status changes to resolved
  if (this.isModified('status') && this.status === 'resolved' && !this.resolvedAt) {
    this.resolvedAt = new Date();
  }
  
  // Clear resolvedAt if status is not resolved
  if (this.status !== 'resolved') {
    this.resolvedAt = undefined;
  }
  
  next();
});

export const Subchat = mongoose.model<ISubchat, ISubchatModel>('Subchat', subchatSchema);