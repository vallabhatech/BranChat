import mongoose, { Document, Schema } from 'mongoose';

export interface IConversation extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId | string;
  title: string;
  usePreviousKnowledge: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastMessageAt: Date;
  messageCount: number;
  
  // Virtual properties
  id: string;
  
  // Instance methods
  updateLastMessage(): Promise<IConversation>;
  incrementMessageCount(): Promise<IConversation>;
  generateTitle(firstMessage: string): Promise<IConversation>;
}

const conversationSchema = new Schema<IConversation>({
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
    default: 'New Conversation',
  },
  
  usePreviousKnowledge: {
    type: Boolean,
    default: false,
  },
  
  lastMessageAt: {
    type: Date,
    default: Date.now,
    required: true,
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
conversationSchema.index({ userId: 1, createdAt: -1 });
conversationSchema.index({ userId: 1, lastMessageAt: -1 });
conversationSchema.index({ userId: 1, updatedAt: -1 });

// Virtual for id
conversationSchema.virtual('id').get(function() {
  return this._id.toHexString();
});

// Instance methods
conversationSchema.methods.updateLastMessage = function() {
  this.lastMessageAt = new Date();
  return this.save();
};

conversationSchema.methods.incrementMessageCount = function() {
  this.messageCount += 1;
  this.lastMessageAt = new Date();
  return this.save();
};

conversationSchema.methods.generateTitle = function(firstMessage: string) {
  // Generate a title from the first message (truncated)
  const title = firstMessage
    .replace(/\n/g, ' ')
    .trim()
    .substring(0, 50);
  
  this.title = title + (firstMessage.length > 50 ? '...' : '');
  return this.save();
};

// Static methods
conversationSchema.statics.findByUserId = function(userId: string, options: {
  page?: number;
  limit?: number;
  sortBy?: 'createdAt' | 'updatedAt' | 'lastMessageAt';
  sortOrder?: 'asc' | 'desc';
} = {}) {
  const {
    page = 1,
    limit = 20,
    sortBy = 'lastMessageAt',
    sortOrder = 'desc'
  } = options;
  
  const skip = (page - 1) * limit;
  const sort = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };
  
  // Handle both guest users (string) and authenticated users (ObjectId)
  const userIdQuery = userId.startsWith('guest_') ? userId : new mongoose.Types.ObjectId(userId);
  
  return this.find({ userId: userIdQuery })
    .sort(sort)
    .skip(skip)
    .limit(limit);
};

conversationSchema.statics.getRecentByUserId = function(userId: string, limit: number = 5) {
  return this.find({ userId })
    .sort({ lastMessageAt: -1 })
    .limit(limit)
    .select('title lastMessageAt messageCount');
};

export interface IConversationModel extends mongoose.Model<IConversation> {
  findByUserId(userId: string, options?: {
    page?: number;
    limit?: number;
    sortBy?: 'createdAt' | 'updatedAt' | 'lastMessageAt';
    sortOrder?: 'asc' | 'desc';
  }): Promise<IConversation[]>;
  getRecentByUserId(userId: string, limit?: number): Promise<IConversation[]>;
}

export const Conversation = mongoose.model<IConversation, IConversationModel>('Conversation', conversationSchema);