/**
 * Enhanced Logger with Structured Logging
 * 
 * Improved logging with request tracking, timing, and correlation IDs
 */

import winston from 'winston';
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config/environment';

// Enhanced log format with correlation ID
const logFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf(({ timestamp, level, message, correlationId, requestId, userId, duration, ...meta }) => {
    const logEntry = {
      timestamp,
      level,
      message,
      service: 'subchat-mvp-backend',
      environment: config.env,
      ...(correlationId && { correlationId }),
      ...(requestId && { requestId }),
      ...(userId && { userId }),
      ...(duration && { duration }),
      ...meta
    };
    return JSON.stringify(logEntry);
  })
);

// Create enhanced logger
export const logger = winston.createLogger({
  level: config.logging.level,
  format: logFormat,
  defaultMeta: { service: 'subchat-mvp-backend' },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    }),
  ],
});

// Add file transport in production
if (config.env === 'production') {
  logger.add(
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
    })
  );
  
  logger.add(
    new winston.transports.File({
      filename: 'logs/combined.log',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
    })
  );
}

// Request logging middleware
export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now();
  const requestId = uuidv4();
  
  // Add request ID to request object
  (req as any).requestId = requestId;
  
  // Log incoming request
  logger.info('Request started', {
    requestId,
    method: req.method,
    url: req.url,
    userAgent: req.get('User-Agent'),
    ip: req.ip,
    userId: (req as any).user?.userId,
  });
  
  // Override res.end to log response
  const originalEnd = res.end;
  res.end = function(chunk?: any, encoding?: any, callback?: any) {
    const duration = Date.now() - startTime;
    
    // Log response
    logger.info('Request completed', {
      requestId,
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration,
      userId: (req as any).user?.userId,
    });
    
    // Call original end
    originalEnd.call(this, chunk, encoding, callback);
  };
  
  next();
};

// Error logging middleware
export const errorLogger = (err: Error, req: Request, res: Response, next: NextFunction) => {
  const requestId = (req as any).requestId;
  
  logger.error('Request error', {
    requestId,
    method: req.method,
    url: req.url,
    error: err.message,
    stack: err.stack,
    userId: (req as any).user?.userId,
  });
  
  next(err);
};

// Performance logging
export const performanceLogger = (req: Request, res: Response, next: NextFunction) => {
  const startTime = process.hrtime.bigint();
  
  res.on('finish', () => {
    const endTime = process.hrtime.bigint();
    const duration = Number(endTime - startTime) / 1000000; // Convert to milliseconds
    
    // Log slow requests (> 1 second)
    if (duration > 1000) {
      logger.warn('Slow request detected', {
        requestId: (req as any).requestId,
        method: req.method,
        url: req.url,
        duration,
        statusCode: res.statusCode,
      });
    }
  });
  
  next();
};

// Structured logging helpers
export const logUserAction = (action: string, userId: string, details?: any) => {
  logger.info('User action', {
    action,
    userId,
    timestamp: new Date().toISOString(),
    ...details
  });
};

export const logSystemEvent = (event: string, details?: any) => {
  logger.info('System event', {
    event,
    timestamp: new Date().toISOString(),
    ...details
  });
};

export const logSecurityEvent = (event: string, details?: any) => {
  logger.warn('Security event', {
    event,
    timestamp: new Date().toISOString(),
    ...details
  });
};

export const logBusinessMetric = (metric: string, value: number, details?: any) => {
  logger.info('Business metric', {
    metric,
    value,
    timestamp: new Date().toISOString(),
    ...details
  });
};

// Database operation logging
export const logDatabaseOperation = (operation: string, collection: string, details?: any) => {
  logger.debug('Database operation', {
    operation,
    collection,
    timestamp: new Date().toISOString(),
    ...details
  });
};

// AI operation logging
export const logAIOperation = (operation: string, provider: string, details?: any) => {
  logger.info('AI operation', {
    operation,
    provider,
    timestamp: new Date().toISOString(),
    ...details
  });
};

export default logger;
