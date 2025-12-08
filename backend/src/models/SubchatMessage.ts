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
  };
  createdAt: Date;
  updatedAt: Date;
  
  // Virtual properties
  id: string;
}

export interface ISubchatMessageModel extends mongoose.Model<ISubchatMessage> {
  findBySubchatId(subchatId: string, options?: any): Promise<ISubchatMessage[]>;
  getSubchatHistory(subchatId: string, limit?: number): Promise<any[]>;
  generateTranscript(subchatId: string): Promise<string>;
  getTokenUsage(subchatId: string, startDate?: Date, endDate?: Date): Promise<any[]>;
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
  },
  
  content: {
    type: String,
    required: true,
    trim: true,
    maxlength: 50000,
  },
  
  metadata: {
    tokens: {
      type: Number,
      min: 0,
    },
    model: {
      type: String,
      trim: true,
    },
    temperature: {
      type: Number,
      min: 0,
      max: 2,
    },
    processingTime: {
      type: Number,
      min: 0,
    },
    isStreaming: {
      type: Boolean,
      default: false,
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

// Indexes
subchatMessageSchema.index({ subchatId: 1, createdAt: 1 });
subchatMessageSchema.index({ subchatId: 1, role: 1 });
subchatMessageSchema.index({ createdAt: -1 });

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

// Static methods
subchatMessageSchema.statics.findBySubchatId = function(
  subchatId: string,
  options: {
    page?: number;
    limit?: number;
    sortOrder?: 'asc' | 'desc';
    role?: SubchatMessageRole;
  } = {}
) {
  const {
    page = 1,
    limit = 50,
    sortOrder = 'asc',
    role
  } = options;
  
  const skip = (page - 1) * limit;
  const sort = { createdAt: sortOrder === 'desc' ? -1 : 1 };
  
  const query: any = { subchatId };
  if (role) {
    query.role = role;
  }
  
  return this.find(query)
    .sort(sort)
    .skip(skip)
    .limit(limit);
};

subchatMessageSchema.statics.getSubchatHistory = function(
  subchatId: string,
  limit: number = 20
) {
  return this.find({ subchatId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .select('role content metadata.tokens metadata.model createdAt')
    .lean();
};

subchatMessageSchema.statics.generateTranscript = function(subchatId: string) {
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

subchatMessageSchema.statics.getTokenUsage = function(
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
      }
    }
  ]);
};

export const SubchatMessage = mongoose.model<ISubchatMessage, ISubchatMessageModel>('SubchatMessage', subchatMessageSchema);