/**
 * Enhanced Server with Observability
 * 
 * Production-ready server with logging, rate limiting, security, and health checks
 */

import express from 'express';
import cors from 'cors';
import { config } from './config/environment';
import { logger, requestLogger, errorLogger, performanceLogger } from './utils/logger';
import { healthController } from './controllers/health.controller';
import { securityMiddlewares } from './middleware/security.middleware';
import { generalRateLimit, authRateLimit, aiRateLimit, streamingRateLimit } from './middleware/rateLimit.middleware';

// Import routes
import authRoutes from './routes/auth.routes';
import conversationRoutes from './routes/conversations.routes';
import subchatRoutes from './routes/subchats.routes';
import userRoutes from './routes/user.routes';

// Create Express app
const app = express();

// Trust proxy for IP detection
app.set('trust proxy', 1);

// Security middleware (applied first)
app.use(securityMiddlewares);

// CORS configuration
app.use(cors({
  origin: config.cors.origin,
  credentials: config.cors.credentials,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware
app.use(requestLogger);
app.use(performanceLogger);

// Rate limiting middleware
app.use(generalRateLimit);

// Health check endpoints (before rate limiting)
app.get('/health', healthController.healthCheck.bind(healthController));
app.get('/health/ready', healthController.readinessCheck.bind(healthController));
app.get('/health/live', healthController.livenessCheck.bind(healthController));
app.get('/health/detailed', healthController.detailedHealthCheck.bind(healthController));

// API routes with specific rate limiting
app.use('/api/auth', authRateLimit, authRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/subchats', subchatRoutes);
app.use('/api/users', userRoutes);

// AI endpoints with stricter rate limiting
app.use('/api/ai', aiRateLimit);

// Streaming endpoints with specific rate limiting
app.use('/api/stream', streamingRateLimit);

// API documentation (development only)
if (config.env === 'development') {
  app.get('/api', (req, res) => {
    res.json({
      message: 'BranChat API',
      version: '1.0.0',
      environment: config.env,
      endpoints: {
        health: '/health',
        auth: '/api/auth',
        conversations: '/api/conversations',
        subchats: '/api/subchats',
        users: '/api/users',
      },
      documentation: 'https://github.com/your-repo/branchat',
    });
  });
}

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'BranChat API Server',
    status: 'running',
    version: '1.0.0',
    environment: config.env,
    timestamp: new Date().toISOString(),
  });
});

// 404 handler
app.use('*', (req, res) => {
  logger.warn('Route not found', {
    method: req.method,
    url: req.url,
    ip: req.ip,
    requestId: (req as any).requestId,
  });
  
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: 'Route not found',
      timestamp: new Date().toISOString(),
    }
  });
});

// Error handling middleware
app.use(errorLogger);

// Global error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled error', {
    error: err.message,
    stack: err.stack,
    method: req.method,
    url: req.url,
    ip: req.ip,
    requestId: (req as any).requestId,
    userId: (req as any).user?.userId,
  });
  
  // Don't expose stack trace in production
  const stack = config.env === 'development' ? err.stack : undefined;
  
  res.status(err.status || 500).json({
    error: {
      code: err.code || 'INTERNAL_SERVER_ERROR',
      message: err.message || 'Internal server error',
      stack,
      timestamp: new Date().toISOString(),
    }
  });
});

// Graceful shutdown
let server: any;

const gracefulShutdown = (signal: string) => {
  logger.info(`Received ${signal}, starting graceful shutdown`);
  
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
  
  // Force close after 30 seconds
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 30000);
};

// Start server
const startServer = async () => {
  try {
    server = app.listen(config.port, () => {
      logger.info('Server started successfully', {
        port: config.port,
        environment: config.env,
        nodeVersion: process.version,
        pid: process.pid,
      });
      
      // Log startup metrics
      logger.info('Startup metrics', {
        memoryUsage: process.memoryUsage(),
        uptime: process.uptime(),
        platform: process.platform,
        arch: process.arch,
      });
    });
    
    // Handle graceful shutdown
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    
    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception', {
        error: error.message,
        stack: error.stack,
      });
      gracefulShutdown('uncaughtException');
    });
    
    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Promise Rejection', {
        reason,
        promise,
      });
      gracefulShutdown('unhandledRejection');
    });
    
  } catch (error) {
    logger.error('Failed to start server', { error });
    process.exit(1);
  }
};

// Start the server
startServer();

export default app;
