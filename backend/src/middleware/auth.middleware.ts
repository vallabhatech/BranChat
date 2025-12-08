import { Request, Response, NextFunction } from 'express';
import { authService, AuthTokenPayload } from '../services/auth.service';
import { UserContext } from '../types';
import { logger } from '../utils/logger';

// Extend Express Request to include user context
declare global {
  namespace Express {
    interface Request {
      user?: UserContext;
      token?: string;
    }
  }
}

/**
 * Extract token from Authorization header or X-Guest-Token header
 */
function extractToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  const guestHeader = req.headers['x-guest-token'] as string;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  if (guestHeader) {
    return guestHeader;
  }

  return null;
}

/**
 * Middleware to authenticate requests and set user context
 * Supports both authenticated users and guest mode
 */
export function authenticate(req: Request, res: Response, next: NextFunction): void {
  try {
    const token = extractToken(req);

    if (!token) {
      res.status(401).json({
        success: false,
        error: {
          code: 'MISSING_TOKEN',
          message: 'Authentication token is required',
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }

    // Verify token
    const payload: AuthTokenPayload = authService.verifyToken(token);
    
    // Extract user context
    const userContext = authService.extractUserContext(payload);
    
    // Attach to request
    req.user = userContext;
    req.token = token;

    logger.debug('Request authenticated', {
      userId: userContext.userId,
      isGuest: userContext.isGuest,
      path: req.path,
    });

    next();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.debug('Authentication failed', { error: errorMessage, path: req.path });
    
    res.status(401).json({
      success: false,
      error: {
        code: 'INVALID_TOKEN',
        message: 'Invalid or expired authentication token',
        timestamp: new Date().toISOString(),
      },
    });
  }
}

/**
 * Middleware to require authenticated (non-guest) users
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({
      success: false,
      error: {
        code: 'AUTHENTICATION_REQUIRED',
        message: 'This endpoint requires authentication',
        timestamp: new Date().toISOString(),
      },
    });
    return;
  }

  if (req.user.isGuest) {
    res.status(403).json({
      success: false,
      error: {
        code: 'GUEST_NOT_ALLOWED',
        message: 'This endpoint is not available for guest users',
        timestamp: new Date().toISOString(),
      },
    });
    return;
  }

  next();
}

/**
 * Middleware to require memory opt-in for memory-related operations
 */
export function requireMemoryOptIn(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({
      success: false,
      error: {
        code: 'AUTHENTICATION_REQUIRED',
        message: 'This endpoint requires authentication',
        timestamp: new Date().toISOString(),
      },
    });
    return;
  }

  if (req.user.isGuest) {
    res.status(403).json({
      success: false,
      error: {
        code: 'MEMORY_NOT_AVAILABLE_GUEST',
        message: 'Memory features are not available for guest users',
        timestamp: new Date().toISOString(),
      },
    });
    return;
  }

  if (!req.user.memoryOptIn) {
    res.status(403).json({
      success: false,
      error: {
        code: 'MEMORY_OPT_IN_REQUIRED',
        message: 'Memory opt-in is required for this operation',
        timestamp: new Date().toISOString(),
      },
    });
    return;
  }

  next();
}

/**
 * Middleware to allow both authenticated and guest users
 * Sets user context if token is provided, but doesn't require it
 */
export function optionalAuth(req: Request, res: Response, next: NextFunction): void {
  try {
    const token = extractToken(req);

    if (token) {
      // Try to authenticate if token is provided
      const payload: AuthTokenPayload = authService.verifyToken(token);
      const userContext = authService.extractUserContext(payload);
      
      req.user = userContext;
      req.token = token;

      logger.debug('Optional auth - user authenticated', {
        userId: userContext.userId,
        isGuest: userContext.isGuest,
        path: req.path,
      });
    } else {
      logger.debug('Optional auth - no token provided', { path: req.path });
    }

    next();
  } catch (error) {
    // For optional auth, we don't fail on invalid tokens
    // Just proceed without user context
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.debug('Optional auth - token invalid, proceeding without auth', {
      error: errorMessage,
      path: req.path,
    });
    
    next();
  }
}

/**
 * Middleware to validate guest mode is enabled when guest token is used
 */
export function validateGuestMode(req: Request, res: Response, next: NextFunction): void {
  const guestHeader = req.headers['x-guest-token'] as string;
  
  if (guestHeader && !authService.validateGuestMode()) {
    res.status(403).json({
      success: false,
      error: {
        code: 'GUEST_MODE_DISABLED',
        message: 'Guest mode is not enabled on this server',
        timestamp: new Date().toISOString(),
      },
    });
    return;
  }

  next();
}

/**
 * Middleware to apply appropriate rate limiting based on user type
 */
export function applyUserBasedRateLimit(req: Request, _res: Response, next: NextFunction): void {
  // This middleware can be enhanced to apply different rate limits
  // based on user type (guest vs authenticated)
  // For now, it just passes through - rate limiting is handled by the global middleware
  
  if (req.user?.isGuest) {
    // Could apply stricter rate limits for guests here
    logger.debug('Guest user request', { path: req.path });
  }

  next();
}