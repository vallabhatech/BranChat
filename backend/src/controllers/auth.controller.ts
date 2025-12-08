import { Request, Response } from 'express';
import Joi from 'joi';
import { authService } from '../services/auth.service';
import { logger } from '../utils/logger';
import { ApiResponse } from '../types';

// Validation schemas
const registerSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(8).required(),
  name: Joi.string().optional().allow(''),
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
});

const updateMemorySchema = Joi.object({
  memoryOptIn: Joi.boolean().required(),
});

export class AuthController {
  /**
   * Register new user
   * POST /api/auth/register
   */
  async register(req: Request, res: Response): Promise<void> {
    try {
      // Validate request body
      const { error, value } = registerSchema.validate(req.body);
      if (error) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: error.details[0].message,
            timestamp: new Date().toISOString(),
          },
        } as ApiResponse);
        return;
      }

      const { email, password, name } = value;

      // Register user
      const result = await authService.register({ email, password, name });

      logger.info('User registered successfully', { 
        userId: result.user.id,
        email: result.user.email,
      });

      res.status(201).json({
        success: true,
        data: {
          user: result.user,
          token: result.token,
        },
      } as ApiResponse);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Registration failed', { error: errorMessage });

      if (errorMessage.includes('already exists')) {
        res.status(409).json({
          success: false,
          error: {
            code: 'USER_EXISTS',
            message: errorMessage,
            timestamp: new Date().toISOString(),
          },
        } as ApiResponse);
        return;
      }

      res.status(500).json({
        success: false,
        error: {
          code: 'REGISTRATION_FAILED',
          message: 'Failed to register user',
          timestamp: new Date().toISOString(),
        },
      } as ApiResponse);
    }
  }

  /**
   * Login user
   * POST /api/auth/login
   */
  async login(req: Request, res: Response): Promise<void> {
    try {
      // Validate request body
      const { error, value } = loginSchema.validate(req.body);
      if (error) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: error.details[0].message,
            timestamp: new Date().toISOString(),
          },
        } as ApiResponse);
        return;
      }

      const { email, password } = value;

      // Login user
      const result = await authService.login({ email, password });

      logger.info('User logged in successfully', { 
        userId: result.user.id,
        email: result.user.email,
      });

      res.status(200).json({
        success: true,
        data: {
          user: result.user,
          token: result.token,
        },
      } as ApiResponse);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Login failed', { error: errorMessage });

      if (errorMessage.includes('Invalid email or password')) {
        res.status(401).json({
          success: false,
          error: {
            code: 'INVALID_CREDENTIALS',
            message: 'Invalid email or password',
            timestamp: new Date().toISOString(),
          },
        } as ApiResponse);
        return;
      }

      res.status(500).json({
        success: false,
        error: {
          code: 'LOGIN_FAILED',
          message: 'Failed to login user',
          timestamp: new Date().toISOString(),
        },
      } as ApiResponse);
    }
  }

  /**
   * Create guest token
   * POST /api/auth/guest
   */
  async createGuestToken(_req: Request, res: Response): Promise<void> {
    try {
      // Check if guest mode is enabled
      if (!authService.validateGuestMode()) {
        res.status(403).json({
          success: false,
          error: {
            code: 'GUEST_MODE_DISABLED',
            message: 'Guest mode is not enabled on this server',
            timestamp: new Date().toISOString(),
          },
        } as ApiResponse);
        return;
      }

      const token = authService.createGuestToken();

      logger.info('Guest token created');

      res.status(200).json({
        success: true,
        data: {
          token,
          user: {
            id: 'guest',
            isGuest: true,
            memoryOptIn: false,
          },
        },
      } as ApiResponse);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Guest token creation failed', { error: errorMessage });

      res.status(500).json({
        success: false,
        error: {
          code: 'GUEST_TOKEN_FAILED',
          message: 'Failed to create guest token',
          timestamp: new Date().toISOString(),
        },
      } as ApiResponse);
    }
  }

  /**
   * Get current user profile
   * GET /api/auth/me
   */
  async getProfile(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: {
            code: 'AUTHENTICATION_REQUIRED',
            message: 'Authentication required',
            timestamp: new Date().toISOString(),
          },
        } as ApiResponse);
        return;
      }

      if (req.user.isGuest) {
        res.status(200).json({
          success: true,
          data: {
            user: {
              id: 'guest',
              isGuest: true,
              memoryOptIn: false,
            },
          },
        } as ApiResponse);
        return;
      }

      // Get full user details for authenticated users
      const user = await authService.getUserById(req.user.userId!);

      res.status(200).json({
        success: true,
        data: {
          user,
        },
      } as ApiResponse);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Get profile failed', { error: errorMessage });

      res.status(500).json({
        success: false,
        error: {
          code: 'PROFILE_FETCH_FAILED',
          message: 'Failed to fetch user profile',
          timestamp: new Date().toISOString(),
        },
      } as ApiResponse);
    }
  }

  /**
   * Update user memory preference
   * PUT /api/auth/memory-settings
   */
  async updateMemorySettings(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: {
            code: 'AUTHENTICATION_REQUIRED',
            message: 'Authentication required',
            timestamp: new Date().toISOString(),
          },
        } as ApiResponse);
        return;
      }

      if (req.user.isGuest) {
        res.status(403).json({
          success: false,
          error: {
            code: 'GUEST_NOT_ALLOWED',
            message: 'Guest users cannot modify memory settings',
            timestamp: new Date().toISOString(),
          },
        } as ApiResponse);
        return;
      }

      // Validate request body
      const { error, value } = updateMemorySchema.validate(req.body);
      if (error) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: error.details[0].message,
            timestamp: new Date().toISOString(),
          },
        } as ApiResponse);
        return;
      }

      const { memoryOptIn } = value;

      // Update memory preference
      const user = await authService.updateMemoryOptIn(req.user.userId!, memoryOptIn);

      logger.info('Memory settings updated', { 
        userId: req.user.userId,
        memoryOptIn,
      });

      res.status(200).json({
        success: true,
        data: {
          user,
        },
      } as ApiResponse);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Memory settings update failed', { error: errorMessage });

      res.status(500).json({
        success: false,
        error: {
          code: 'MEMORY_SETTINGS_UPDATE_FAILED',
          message: 'Failed to update memory settings',
          timestamp: new Date().toISOString(),
        },
      } as ApiResponse);
    }
  }

  /**
   * Logout user (client-side token removal)
   * POST /api/auth/logout
   */
  async logout(req: Request, res: Response): Promise<void> {
    try {
      // For JWT tokens, logout is handled client-side by removing the token
      // We can log the logout event for monitoring purposes
      
      if (req.user && !req.user.isGuest) {
        logger.info('User logged out', { userId: req.user.userId });
      } else if (req.user?.isGuest) {
        logger.info('Guest user session ended');
      }

      res.status(200).json({
        success: true,
        data: {
          message: 'Logged out successfully',
        },
      } as ApiResponse);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Logout failed', { error: errorMessage });

      res.status(500).json({
        success: false,
        error: {
          code: 'LOGOUT_FAILED',
          message: 'Failed to logout',
          timestamp: new Date().toISOString(),
        },
      } as ApiResponse);
    }
  }

  /**
   * Validate token endpoint
   * GET /api/auth/validate
   */
  async validateToken(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: {
            code: 'INVALID_TOKEN',
            message: 'Invalid or expired token',
            timestamp: new Date().toISOString(),
          },
        } as ApiResponse);
        return;
      }

      res.status(200).json({
        success: true,
        data: {
          valid: true,
          user: req.user.isGuest ? {
            id: 'guest',
            isGuest: true,
            memoryOptIn: false,
          } : {
            userId: req.user.userId,
            isGuest: req.user.isGuest,
            memoryOptIn: req.user.memoryOptIn,
          },
        },
      } as ApiResponse);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Token validation failed', { error: errorMessage });

      res.status(500).json({
        success: false,
        error: {
          code: 'VALIDATION_FAILED',
          message: 'Failed to validate token',
          timestamp: new Date().toISOString(),
        },
      } as ApiResponse);
    }
  }
}

export const authController = new AuthController();