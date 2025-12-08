import mongoose, { Document, Schema } from 'mongoose';

export interface ISummary extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  subchatId: mongoose.Types.ObjectId;
  conversationId: mongoose.Types.ObjectId;
  title: string;
  content: string;
  keywords: string[];
  embedding?: number[]; // Vector embedding for semantic search
  elasticId?: string; // Corresponding Elastic Search document ID
  syncedAt?: Date; // Last sync with Elastic Search
  createdAt: Date;
  updatedAt: Date;
  
  // Virtual properties
  id: string;
}

const summarySchema = new Schema<ISummary>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  
  subchatId: {
    type: Schema.Types.ObjectId,
    ref: 'Subchat',
    required: true,
    unique: true, // One summary per subchat
  },
  
  conversationId: {
    type: Schema.Types.ObjectId,
    ref: 'Conversation',
    required: true,
    index: true,
  },
  
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200,
  },
  
  content: {
    type: String,
    required: true,
    trim: true,
    maxlength: 5000,
  },
  
  keywords: [{
    type: String,
    trim: true,
    lowercase: true,
    maxlength: 50,
  }],
  
  embedding: [{
    type: Number,
  }],
  
  elasticId: {
    type: String,
    trim: true,
    index: true,
    sparse: true,
  },
  
  syncedAt: {
    type: Date,
  },
}, {
  timestamps: true,
  toJSON: {
    virtuals: true,
    transform: function(_doc, ret: any) {
      delete ret._id;
      delete ret.__v;
      delete ret.embedding; // Don't expose embeddings in JSON
      return ret;
    }
  },
  toObject: {
    virtuals: true,
  }
});

// Indexes
summarySchema.index({ userId: 1, createdAt: -1 });
summarySchema.index({ conversationId: 1 });
summarySchema.index({ subchatId: 1 }, { unique: true });
summarySchema.index({ elasticId: 1 }, { sparse: true });
summarySchema.index({ keywords: 1 });
summarySchema.index({ syncedAt: 1 });

// Text search index for content and keywords
summarySchema.index({
  title: 'text',
  content: 'text',
  keywords: 'text'
}, {
  weights: {
    title: 10,
    keywords: 5,
    content: 1
  }
});

// Virtual for id
summarySchema.virtual('id').get(function() {
  return this._id.toHexString();
});

// Instance methods
summarySchema.methods.isSynced = function() {
  return this.elasticId && this.syncedAt;
};

summarySchema.methods.markSynced = function(elasticId: string) {
  this.elasticId = elasticId;
  this.syncedAt = new Date();
  return this.save();
};

summarySchema.methods.needsSync = function() {
  return !this.syncedAt || this.updatedAt > this.syncedAt;
};

summarySchema.methods.extractKeywords = function() {
  // Simple keyword extraction from content
  const words = this.content
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter((word: string) => word.length > 3)
    .filter((word: string) => !['this', 'that', 'with', 'have', 'will', 'been', 'from', 'they', 'know', 'want', 'been', 'good', 'much', 'some', 'time', 'very', 'when', 'come', 'here', 'just', 'like', 'long', 'make', 'many', 'over', 'such', 'take', 'than', 'them', 'well', 'were'].includes(word));
  
  // Get unique words and limit to top 10
  const uniqueWords = [...new Set(words)];
  this.keywords = uniqueWords.slice(0, 10);
  
  return this.keywords;
};

// Static methods
summarySchema.statics.findByUserId = function(
  userId: string,
  options: {
    page?: number;
    limit?: number;
    sortOrder?: 'asc' | 'desc';
    synced?: boolean;
  } = {}
) {
  const {
    page = 1,
    limit = 20,
    sortOrder = 'desc',
    synced
  } = options;
  
  const skip = (page - 1) * limit;
  const sort = { createdAt: sortOrder === 'desc' ? -1 : 1 };
  
  const query: any = { userId };
  if (synced !== undefined) {
    if (synced) {
      query.elasticId = { $exists: true };
      query.syncedAt = { $exists: true };
    } else {
      query.$or = [
        { elasticId: { $exists: false } },
        { syncedAt: { $exists: false } }
      ];
    }
  }
  
  return this.find(query)
    .sort(sort)
    .skip(skip)
    .limit(limit)
    .populate('subchatId', 'title status')
    .populate('conversationId', 'title');
};

summarySchema.statics.findUnsyncedSummaries = function(limit: number = 100) {
  return this.find({
    $or: [
      { elasticId: { $exists: false } },
      { syncedAt: { $exists: false } },
      { $expr: { $gt: ['$updatedAt', '$syncedAt'] } }
    ]
  })
    .limit(limit)
    .populate('userId', 'memoryOptIn');
};

summarySchema.statics.searchByText = function(
  userId: string,
  searchText: string,
  limit: number = 10
) {
  return this.find({
    userId,
    $text: { $search: searchText }
  }, {
    score: { $meta: 'textScore' }
  })
    .sort({ score: { $meta: 'textScore' } })
    .limit(limit)
    .populate('subchatId', 'title')
    .populate('conversationId', 'title');
};

summarySchema.statics.findByKeywords = function(
  userId: string,
  keywords: string[],
  limit: number = 10
) {
  return this.find({
    userId,
    keywords: { $in: keywords.map(k => k.toLowerCase()) }
  })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('subchatId', 'title')
    .populate('conversationId', 'title');
};

// Pre-save middleware
summarySchema.pre('save', function(next) {
  // Auto-extract keywords if not provided
  if (this.isModified('content') && (!this.keywords || this.keywords.length === 0)) {
    (this as any).extractKeywords();
  }
  
  // Mark as needing sync if content changed
  if (this.isModified('content') || this.isModified('title')) {
    this.syncedAt = undefined;
  }
  
  next();
});

export const Summary = mongoose.model<ISummary>('Summary', summarySchema);