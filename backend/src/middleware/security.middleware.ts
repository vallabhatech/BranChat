/**
 * Security Middleware
 * 
 * Basic security headers and protection with Helmet
 */

import { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import { logger } from '../utils/logger';

// Security middleware configuration
export const securityMiddleware = helmet({
  // Content Security Policy
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"], // Allow inline styles for Tailwind
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  
  // Cross-Origin Embedder Policy
  crossOriginEmbedderPolicy: false, // Allow embedding for development
  
  // Cross-Origin Opener Policy
  crossOriginOpenerPolicy: { policy: "same-origin" },
  
  // Cross-Origin Resource Policy
  crossOriginResourcePolicy: { policy: "cross-origin" },
  
  // DNS Prefetch Control
  dnsPrefetchControl: { allow: false },
  
  // Frame Options
  frameguard: { action: 'deny' },
  
  // Hide Powered-By Header
  hidePoweredBy: true,
  
  // HSTS (HTTP Strict Transport Security)
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: false,
  },
  
  // IE Compatibility
  ieNoOpen: true,
  
  // No Sniff
  noSniff: true,
  
  // Origin Agent Cluster
  originAgentCluster: true,
  
  // Permissions Policy
  permissionsPolicy: {
    directives: {
      camera: ["'none'"],
      microphone: ["'none'"],
      geolocation: ["'none'"],
      payment: ["'none'"],
      usb: ["'none'"],
      magnetometer: ["'none'"],
      gyroscope: ["'none'"],
      accelerometer: ["'none'"],
    },
  },
  
  // Referrer Policy
  referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  
  // X-Content-Type-Options
  xContentTypeOptions: true,
  
  // X-DNS-Prefetch-Control
  xDnsPrefetchControl: false,
  
  // X-Download-Options
  xDownloadOptions: true,
  
  // X-Frame-Options
  xFrameOptions: true,
  
  // X-Permitted-Cross-Domain-Policies
  xPermittedCrossDomainPolicies: false,
  
  // X-XSS-Protection
  xXssProtection: "1; mode=block",
});

// Additional security headers not covered by Helmet
export const additionalSecurityHeaders = (req: Request, res: Response, next: NextFunction) => {
  // Remove server information
  res.removeHeader('Server');
  res.removeHeader('X-Powered-By');
  
  // Add custom security headers
  res.setHeader('X-Request-ID', generateRequestId());
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  
  // Cache control for API endpoints
  if (req.path.startsWith('/api/')) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
  
  next();
};

// Generate unique request ID
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// IP-based rate limiting middleware
export const ipSecurityMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const clientIP = req.ip || req.connection.remoteAddress || req.socket.remoteAddress;
  
  // Log suspicious IPs
  const suspiciousPatterns = [
    /bot/i,
    /crawler/i,
    /scraper/i,
    /curl/i,
    /wget/i,
  ];
  
  const userAgent = req.get('User-Agent') || '';
  const isSuspicious = suspiciousPatterns.some(pattern => pattern.test(userAgent));
  
  if (isSuspicious) {
    logger.warn('Suspicious user agent detected', {
      ip: clientIP,
      userAgent,
      url: req.url,
      requestId: (req as any).requestId,
    });
  }
  
  next();
};

// Request size limiting
export const requestSizeLimit = (maxSize: number = 10 * 1024 * 1024) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const contentLength = req.get('Content-Length');
    
    if (contentLength && parseInt(contentLength) > maxSize) {
      logger.warn('Request size limit exceeded', {
        ip: req.ip,
        url: req.url,
        contentLength,
        maxSize,
        requestId: (req as any).requestId,
      });
      
      return res.status(413).json({
        error: {
          code: 'REQUEST_TOO_LARGE',
          message: `Request size exceeds limit of ${maxSize / 1024 / 1024}MB`,
          timestamp: new Date().toISOString(),
        }
      });
    }
    
    next();
  };
};

// HTTP method validation
export const httpMethodValidation = (req: Request, res: Response, next: NextFunction) => {
  const allowedMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'];
  
  if (!allowedMethods.includes(req.method)) {
    logger.warn('Invalid HTTP method', {
      method: req.method,
      ip: req.ip,
      url: req.url,
      requestId: (req as any).requestId,
    });
    
    return res.status(405).json({
      error: {
        code: 'METHOD_NOT_ALLOWED',
        message: 'Method not allowed',
        allowedMethods,
        timestamp: new Date().toISOString(),
      }
    });
  }
  
  next();
};

// Content type validation for POST/PUT requests
export const contentTypeValidation = (req: Request, res: Response, next: NextFunction) => {
  if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
    const contentType = req.get('Content-Type');
    
    // Allow common content types
    const allowedContentTypes = [
      'application/json',
      'application/x-www-form-urlencoded',
      'multipart/form-data',
      'text/plain',
    ];
    
    if (contentType && !allowedContentTypes.some(type => contentType.includes(type))) {
      logger.warn('Invalid content type', {
        method: req.method,
        contentType,
        ip: req.ip,
        url: req.url,
        requestId: (req as any).requestId,
      });
      
      return res.status(415).json({
        error: {
          code: 'UNSUPPORTED_MEDIA_TYPE',
          message: 'Unsupported content type',
          supportedTypes: allowedContentTypes,
          timestamp: new Date().toISOString(),
        }
      });
    }
  }
  
  next();
};

// Security event logging
export const securityEventLogger = (req: Request, res: Response, next: NextFunction) => {
  const originalSend = res.send;
  
  res.send = function(data: any) {
    // Log security events
    if (res.statusCode >= 400) {
      logger.warn('HTTP error response', {
        statusCode: res.statusCode,
        method: req.method,
        url: req.url,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        requestId: (req as any).requestId,
        userId: (req as any).user?.userId,
      });
    }
    
    return originalSend.call(this, data);
  };
  
  next();
};

// Combined security middleware
export const securityMiddlewares = [
  securityMiddleware,
  additionalSecurityHeaders,
  ipSecurityMiddleware,
  requestSizeLimit(10 * 1024 * 1024), // 10MB limit
  httpMethodValidation,
  contentTypeValidation,
  securityEventLogger,
];

export default {
  securityMiddleware,
  additionalSecurityHeaders,
  ipSecurityMiddleware,
  requestSizeLimit,
  httpMethodValidation,
  contentTypeValidation,
  securityEventLogger,
  securityMiddlewares,
};
