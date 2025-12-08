import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { config } from '../config/environment';
import { User } from '../models/User';
import { UserContext } from '../types';
import { logger } from '../utils/logger';

export interface AuthTokenPayload {
  userId: string;
  isGuest: boolean;
  memoryOptIn?: boolean;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  name?: string;
}

export class AuthService {
  private readonly JWT_SECRET = config.jwt.secret;
  private readonly JWT_EXPIRES_IN = config.jwt.expiresIn;
  private readonly GUEST_ALLOWED = config.guest.allowed;

  /**
   * Generate JWT token for authenticated user
   */
  generateToken(payload: AuthTokenPayload): string {
    return jwt.sign(payload, this.JWT_SECRET, {
      expiresIn: this.JWT_EXPIRES_IN,
    });
  }

  /**
   * Verify and decode JWT token
   */
  verifyToken(token: string): AuthTokenPayload {
    try {
      return jwt.verify(token, this.JWT_SECRET) as AuthTokenPayload;
    } catch (error) {
      logger.debug('Token verification failed', { error: error instanceof Error ? error.message : 'Unknown error' });
      throw new Error('Invalid or expired token');
    }
  }

  /**
   * Hash password for storage
   */
  async hashPassword(password: string): Promise<string> {
    const saltRounds = 12;
    return bcrypt.hash(password, saltRounds);
  }

  /**
   * Compare password with hash
   */
  async comparePassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  /**
   * Register new user
   */
  async register(data: RegisterData): Promise<{ user: any; token: string }> {
    const { email, password, name } = data;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      throw new Error('User already exists with this email');
    }

    // Hash password
    const hashedPassword = await this.hashPassword(password);

    // Create user
    const user = new User({
      email,
      password: hashedPassword,
      name,
      memoryOptIn: true, // Default to true per requirements
    });

    await user.save();

    // Generate token
    const token = this.generateToken({
      userId: user._id.toString(),
      isGuest: false,
      memoryOptIn: user.memoryOptIn,
    });

    // Return user without password
    const userResponse = {
      id: user._id,
      email: user.email,
      name: user.name,
      memoryOptIn: user.memoryOptIn,
      createdAt: user.createdAt,
    };

    logger.info('User registered successfully', { userId: user._id });

    return { user: userResponse, token };
  }

  /**
   * Login user
   */
  async login(credentials: LoginCredentials): Promise<{ user: any; token: string }> {
    const { email, password } = credentials;

    // Find user
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      throw new Error('Invalid email or password');
    }

    // Verify password
    if (!user.password) {
      throw new Error('Invalid email or password');
    }
    
    const isValidPassword = await this.comparePassword(password, user.password);
    if (!isValidPassword) {
      throw new Error('Invalid email or password');
    }

    // Update last active
    user.lastActiveAt = new Date();
    await user.save();

    // Generate token
    const token = this.generateToken({
      userId: user._id.toString(),
      isGuest: false,
      memoryOptIn: user.memoryOptIn,
    });

    // Return user without password
    const userResponse = {
      id: user._id,
      email: user.email,
      name: user.name,
      memoryOptIn: user.memoryOptIn,
      createdAt: user.createdAt,
      lastActiveAt: user.lastActiveAt,
    };

    logger.info('User logged in successfully', { userId: user._id });

    return { user: userResponse, token };
  }

  /**
   * Create guest token
   */
  createGuestToken(): string {
    if (!this.GUEST_ALLOWED) {
      throw new Error('Guest mode is not enabled');
    }

    // Create unique guest ID to ensure proper isolation
    const guestId = `guest_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;

    return this.generateToken({
      userId: guestId,
      isGuest: true,
      memoryOptIn: false, // Guests cannot use memory
    });
  }

  /**
   * Validate guest mode request
   */
  validateGuestMode(): boolean {
    return this.GUEST_ALLOWED;
  }

  /**
   * Extract user context from token payload
   */
  extractUserContext(payload: AuthTokenPayload): UserContext {
    return {
      userId: payload.userId, // Use the actual userId (including unique guest IDs)
      isGuest: payload.isGuest,
      memoryOptIn: payload.memoryOptIn || false,
    };
  }

  /**
   * Get user by ID (for authenticated users only)
   */
  async getUserById(userId: string): Promise<any> {
    if (userId.startsWith('guest_')) {
      throw new Error('Cannot retrieve guest user details');
    }

    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    return {
      id: user._id,
      email: user.email,
      name: user.name,
      memoryOptIn: user.memoryOptIn,
      createdAt: user.createdAt,
      lastActiveAt: user.lastActiveAt,
    };
  }

  /**
   * Update user memory preference
   */
  async updateMemoryOptIn(userId: string, memoryOptIn: boolean): Promise<any> {
    if (userId.startsWith('guest_')) {
      throw new Error('Guest users cannot modify memory preferences');
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { memoryOptIn },
      { new: true }
    );

    if (!user) {
      throw new Error('User not found');
    }

    logger.info('User memory preference updated', { userId, memoryOptIn });

    return {
      id: user._id,
      email: user.email,
      name: user.name,
      memoryOptIn: user.memoryOptIn,
      createdAt: user.createdAt,
      lastActiveAt: user.lastActiveAt,
    };
  }
}

export const authService = new AuthService();