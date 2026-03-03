/**
 * Rate Limiting Middleware
 * 
 * Simple rate limiting with Redis fallback to memory store
 */

import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { logger } from '../utils/logger';

// In-memory store for rate limiting (fallback when Redis is not available)
const memoryStore = new Map<string, { count: number; resetTime: number }>();

// Rate limit configurations
export const rateLimitConfigs = {
  // General API rate limit
  general: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // 100 requests per window
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
  },
  
  // Authentication endpoints
  auth: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 auth attempts per window
    message: 'Too many authentication attempts, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
  },
  
  // AI endpoints (more restrictive)
  ai: {
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 20, // 20 AI requests per minute
    message: 'Too many AI requests, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
  },
  
  // Streaming endpoints
  streaming: {
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 5, // 5 streaming connections per minute
    message: 'Too many streaming connections, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
  },
};

// Create rate limiters
export const generalRateLimit = rateLimit({
  ...rateLimitConfigs.general,
  keyGenerator: (req: Request) => {
    return req.ip || 'unknown';
  },
  handler: (req: Request, res: Response) => {
    logger.warn('Rate limit exceeded', {
      ip: req.ip,
      url: req.url,
      userAgent: req.get('User-Agent'),
      userId: (req as any).user?.userId,
    });
    
    res.status(429).json({
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: rateLimitConfigs.general.message,
        timestamp: new Date().toISOString(),
      }
    });
  },
});

export const authRateLimit = rateLimit({
  ...rateLimitConfigs.auth,
  keyGenerator: (req: Request) => {
    return req.ip || 'unknown';
  },
  handler: (req: Request, res: Response) => {
    logger.warn('Auth rate limit exceeded', {
      ip: req.ip,
      url: req.url,
      userAgent: req.get('User-Agent'),
    });
    
    res.status(429).json({
      error: {
        code: 'AUTH_RATE_LIMIT_EXCEEDED',
        message: rateLimitConfigs.auth.message,
        timestamp: new Date().toISOString(),
      }
    });
  },
});

export const aiRateLimit = rateLimit({
  ...rateLimitConfigs.ai,
  keyGenerator: (req: Request) => {
    // Use user ID if available, otherwise IP
    const userId = (req as any).user?.userId;
    return userId || req.ip || 'unknown';
  },
  handler: (req: Request, res: Response) => {
    logger.warn('AI rate limit exceeded', {
      ip: req.ip,
      url: req.url,
      userId: (req as any).user?.userId,
    });
    
    res.status(429).json({
      error: {
        code: 'AI_RATE_LIMIT_EXCEEDED',
        message: rateLimitConfigs.ai.message,
        timestamp: new Date().toISOString(),
      }
    });
  },
});

export const streamingRateLimit = rateLimit({
  ...rateLimitConfigs.streaming,
  keyGenerator: (req: Request) => {
    // Use user ID if available, otherwise IP
    const userId = (req as any).user?.userId;
    return userId || req.ip || 'unknown';
  },
  handler: (req: Request, res: Response) => {
    logger.warn('Streaming rate limit exceeded', {
      ip: req.ip,
      url: req.url,
      userId: (req as any).user?.userId,
    });
    
    res.status(429).json({
      error: {
        code: 'STREAMING_RATE_LIMIT_EXCEEDED',
        message: rateLimitConfigs.streaming.message,
        timestamp: new Date().toISOString(),
      }
    });
  },
});

// Custom rate limiter for specific endpoints
export const createCustomRateLimit = (options: {
  windowMs: number;
  max: number;
  message?: string;
  keyGenerator?: (req: Request) => string;
}) => {
  return rateLimit({
    windowMs: options.windowMs,
    max: options.max,
    message: options.message || 'Rate limit exceeded',
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: options.keyGenerator || ((req: Request) => req.ip || 'unknown'),
    handler: (req: Request, res: Response) => {
      logger.warn('Custom rate limit exceeded', {
        ip: req.ip,
        url: req.url,
        userId: (req as any).user?.userId,
      });
      
      res.status(429).json({
        error: {
          code: 'CUSTOM_RATE_LIMIT_EXCEEDED',
          message: options.message || 'Rate limit exceeded',
          timestamp: new Date().toISOString(),
        }
      });
    },
  });
};

// Rate limiting middleware with user-based limits
export const createUserRateLimit = (options: {
  windowMs: number;
  max: number;
  message?: string;
}) => {
  return createCustomRateLimit({
    ...options,
    keyGenerator: (req: Request) => {
      // Prioritize user ID over IP for authenticated users
      const userId = (req as any).user?.userId;
      if (userId) {
        return `user:${userId}`;
      }
      return `ip:${req.ip}`;
    },
  });
};

// Rate limiting for guest users (more restrictive)
export const guestRateLimit = createCustomRateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // 50 requests per window for guests
  message: 'Guest rate limit exceeded. Please sign up for higher limits.',
  keyGenerator: (req: Request) => {
    const userId = (req as any).user?.userId;
    if (userId && userId.startsWith('guest_')) {
      return `guest:${userId}`;
    }
    return `ip:${req.ip}`;
  },
});

// Middleware to check rate limit headers
export const checkRateLimitHeaders = (req: Request, res: Response, next: NextFunction) => {
  const rateLimitInfo = {
    limit: res.get('X-RateLimit-Limit'),
    remaining: res.get('X-RateLimit-Remaining'),
    reset: res.get('X-RateLimit-Reset'),
    retryAfter: res.get('Retry-After'),
  };
  
  // Log rate limit info for debugging
  if (rateLimitInfo.limit) {
    logger.debug('Rate limit info', {
      ip: req.ip,
      url: req.url,
      rateLimitInfo,
    });
  }
  
  next();
};

// Rate limiting for specific HTTP methods
export const createMethodRateLimit = (method: string, options: {
  windowMs: number;
  max: number;
  message?: string;
}) => {
  return createCustomRateLimit({
    ...options,
    keyGenerator: (req: Request) => {
      return `${method}:${req.ip}:${(req as any).user?.userId || 'anonymous'}`;
    },
    skip: (req: Request) => req.method.toLowerCase() !== method.toLowerCase(),
  });
};

// Rate limiting for specific user roles
export const createRoleRateLimit = (role: string, options: {
  windowMs: number;
  max: number;
  message?: string;
}) => {
  return createCustomRateLimit({
    ...options,
    keyGenerator: (req: Request) => {
      const user = (req as any).user;
      if (user && user.role === role) {
        return `role:${role}:${user.id}`;
      }
      return `ip:${req.ip}`;
    },
    skip: (req: Request) => {
      const user = (req as any).user;
      return !user || user.role !== role;
    },
  });
};

export default {
  generalRateLimit,
  authRateLimit,
  aiRateLimit,
  streamingRateLimit,
  createCustomRateLimit,
  createUserRateLimit,
  guestRateLimit,
  createMethodRateLimit,
  createRoleRateLimit,
};
