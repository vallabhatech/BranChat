import mongoose, { Document, Schema } from 'mongoose';

export interface IUser extends Document {
  _id: mongoose.Types.ObjectId;
  email?: string;
  password?: string;
  name?: string;
  isGuest: boolean;
  memoryOptIn: boolean;
  apiKey?: string; // For user-provided Gemini keys
  createdAt: Date;
  updatedAt: Date;
  lastActiveAt: Date;
  
  // Virtual properties
  id: string;
  
  // Instance methods
  updateLastActive(): Promise<IUser>;
  isMemoryEnabled(): boolean;
}

export interface IUserModel extends mongoose.Model<IUser> {
  createGuestUser(): IUser;
  findByEmail(email: string): Promise<IUser | null>;
}

const userSchema = new Schema<IUser>({
  email: {
    type: String,
    unique: true,
    sparse: true, // Allow null values but enforce uniqueness when present
    lowercase: true,
    trim: true,
    validate: {
      validator: function(email: string) {
        if (!email) return true; // Allow empty for guest users
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
      },
      message: 'Invalid email format'
    }
  },
  
  password: {
    type: String,
    select: false, // Don't include in queries by default
  },
  
  name: {
    type: String,
    trim: true,
  },
  
  isGuest: {
    type: Boolean,
    default: false,
    required: true,
  },
  
  memoryOptIn: {
    type: Boolean,
    default: false,
    required: true,
  },
  
  apiKey: {
    type: String,
    select: false, // Don't include in queries by default for security
  },
  
  lastActiveAt: {
    type: Date,
    default: Date.now,
    required: true,
  },
}, {
  timestamps: true, // Adds createdAt and updatedAt
  toJSON: {
    virtuals: true,
    transform: function(_doc, ret: any) {
      delete ret._id;
      delete ret.__v;
      delete ret.password;
      delete ret.apiKey;
      return ret;
    }
  },
  toObject: {
    virtuals: true,
  }
});

// Indexes
userSchema.index({ email: 1 }, { unique: true, sparse: true });
userSchema.index({ isGuest: 1 });
userSchema.index({ createdAt: 1 });
userSchema.index({ lastActiveAt: 1 });

// Virtual for id
userSchema.virtual('id').get(function() {
  return this._id.toHexString();
});

// Instance methods
userSchema.methods.updateLastActive = function() {
  this.lastActiveAt = new Date();
  return this.save();
};

userSchema.methods.isMemoryEnabled = function() {
  return this.memoryOptIn && !this.isGuest;
};

// Static methods
userSchema.statics.createGuestUser = function() {
  return new this({
    isGuest: true,
    memoryOptIn: false,
  });
};

userSchema.statics.findByEmail = function(email: string) {
  return this.findOne({ email: email.toLowerCase() });
};

// Pre-save middleware
userSchema.pre('save', function(next) {
  // Ensure guest users don't have email or password
  if (this.isGuest) {
    this.email = undefined;
    this.password = undefined;
    this.name = undefined;
  }
  
  // Ensure non-guest users have email
  if (!this.isGuest && !this.email) {
    return next(new Error('Non-guest users must have an email'));
  }
  
  next();
});

// Validation
userSchema.pre('validate', function(next) {
  // Guest users cannot opt into memory
  if (this.isGuest && this.memoryOptIn) {
    this.memoryOptIn = false;
  }
  
  next();
});

export const User = mongoose.model<IUser, IUserModel>('User', userSchema);