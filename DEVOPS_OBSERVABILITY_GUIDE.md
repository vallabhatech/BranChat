# DevOps & Observability Guide

## Overview

This guide covers the observability and DevOps improvements added to the BranChat backend, including structured logging, health checks, rate limiting, security headers, and monitoring capabilities.

## 🔍 Observability Stack

### 1. Structured Logging

#### Enhanced Logger Features
- **JSON Format**: Structured logs with correlation IDs
- **Request Tracking**: Automatic request ID generation and tracking
- **Performance Metrics**: Request duration and timing information
- **Error Context**: Detailed error information with stack traces
- **Environment Awareness**: Different logging levels for development/production

#### Log Levels
```typescript
// Error - Critical errors that need immediate attention
logger.error('Database connection failed', { error, requestId });

// Warn - Warning messages that don't require immediate action
logger.warn('Rate limit exceeded', { ip, url, requestId });

// Info - General information about system events
logger.info('User action completed', { action: 'login', userId });

// Debug - Detailed debugging information
logger.debug('Database query executed', { query, duration });
```

#### Log Structure
```json
{
  "timestamp": "2024-03-03T12:00:00.000Z",
  "level": "info",
  "message": "Request completed",
  "service": "subchat-mvp-backend",
  "environment": "production",
  "requestId": "req_1709452800000_abc123",
  "userId": "user_123",
  "duration": 150,
  "method": "POST",
  "url": "/api/conversations",
  "statusCode": 200
}
```

### 2. Health Check Endpoints

#### Health Check Types
- **Basic Health**: `/health` - Service availability and basic metrics
- **Readiness Probe**: `/health/ready` - Database connectivity check
- **Liveness Probe**: `/health/live` - Process health check
- **Detailed Health**: `/health/detailed` - Comprehensive system information

#### Health Check Response
```json
{
  "status": "healthy",
  "timestamp": "2024-03-03T12:00:00.000Z",
  "uptime": 3600,
  "version": "1.0.0",
  "environment": "production",
  "checks": {
    "database": {
      "status": "healthy",
      "responseTime": 25
    },
    "memory": {
      "status": "healthy",
      "usage": {
        "rss": 150,
        "heapUsed": 80,
        "heapTotal": 100,
        "external": 20
      }
    },
    "ai": {
      "status": "healthy",
      "provider": "gemini",
      "available": true
    }
  }
}
```

### 3. Rate Limiting

#### Rate Limit Configurations
```typescript
// General API: 100 requests per 15 minutes
generalRateLimit = {
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests from this IP, please try again later.'
}

// Authentication: 5 attempts per 15 minutes
authRateLimit = {
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Too many authentication attempts, please try again later.'
}

// AI Endpoints: 20 requests per minute
aiRateLimit = {
  windowMs: 1 * 60 * 1000,
  max: 20,
  message: 'Too many AI requests, please try again later.'
}

// Streaming: 5 connections per minute
streamingRateLimit = {
  windowMs: 1 * 60 * 1000,
  max: 5,
  message: 'Too many streaming connections, please try again later.'
}
```

#### Rate Limit Headers
```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1709452800000
Retry-After: 60
```

### 4. Security Headers

#### Helmet Configuration
```typescript
// Content Security Policy
contentSecurityPolicy: {
  directives: {
    defaultSrc: ["'self'"],
    styleSrc: ["'self'", "'unsafe-inline'"],
    scriptSrc: ["'self'"],
    imgSrc: ["'self'", "data:", "https:"],
    connectSrc: ["'self'"],
    fontSrc: ["'self'"],
    objectSrc: ["'none'"],
    mediaSrc: ["'self'"],
    frameSrc: ["'none'"]
  }
}

// Additional Security Headers
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: "1; mode=block"
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
```

## 🚀 Deployment Configuration

### Environment Variables
```bash
# Production Configuration
NODE_ENV=production
PORT=3001

# Logging
LOG_LEVEL=info
LOG_FILE_PATH=./logs

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Security
ENABLE_SECURITY_HEADERS=true
ENABLE_CORS=true
CORS_ORIGIN=https://yourdomain.com

# Health Checks
ENABLE_HEALTH_CHECKS=true
HEALTH_CHECK_INTERVAL=30000
```

### Docker Configuration
```dockerfile
# Dockerfile
FROM node:18-alpine

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Create logs directory
RUN mkdir -p logs

# Copy source code
COPY . .

# Build application
RUN npm run build

# Create non-root user
RUN addgroup -g appuser && adduser -S -G appuser appuser
USER appuser

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3001/health || exit 1

# Start application
CMD ["npm", "start"]
```

### Docker Compose
```yaml
# docker-compose.yml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
      - MONGODB_URI=mongodb://mongo:27017/branchat
    depends_on:
      - mongo
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3001/health"]
      interval: 30s
      timeout: 10s
      retries: 3
    restart: unless-stopped

  mongo:
    image: mongo:6.0
    ports:
      - "27017:27017"
    volumes:
      - mongo_data:/data/db
    restart: unless-stopped

volumes:
  mongo_data:
```

## 📊 Monitoring & Alerting

### Prometheus Metrics (Optional)
```typescript
// metrics.middleware.ts
import prometheus from 'prom-client';

const httpRequestDuration = new prometheus.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code']
});

const httpRequestTotal = new prometheus.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code']
});

export { httpRequestDuration, httpRequestTotal };
```

### Log Aggregation
```bash
# ELK Stack (Optional)
# Filebeat configuration for log shipping
filebeat.inputs:
- type: log
  enabled: true
  paths:
    - /app/logs/*.log
output.elasticsearch:
  hosts: ["elasticsearch:9200"]
  index: "branchat-logs"
```

### Grafana Dashboard (Optional)
- **Request Rate**: API request rate over time
- **Response Time**: Average response time by endpoint
- **Error Rate**: Error rate by status code
- **Memory Usage**: Application memory consumption
- **Database Performance**: Database query performance

## 🔧 Configuration Management

### Environment-Specific Configurations
```typescript
// config/production.ts
export const productionConfig = {
  logging: {
    level: 'info',
    format: 'json',
    file: true,
    console: false
  },
  rateLimiting: {
    general: { windowMs: 900000, max: 100 },
    auth: { windowMs: 900000, max: 5 },
    ai: { windowMs: 60000, max: 20 },
    streaming: { windowMs: 60000, max: 5 }
  },
  security: {
    helmet: true,
    cors: true,
    rateLimit: true
  }
};
```

### Configuration Validation
```typescript
// config/validation.ts
import Joi from 'joi';

const configSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').required(),
  PORT: Joi.number().port().default(3001),
  LOG_LEVEL: Joi.string().valid('error', 'warn', 'info', 'debug').default('info'),
  RATE_LIMIT_WINDOW_MS: Joi.number().default(900000),
  RATE_LIMIT_MAX_REQUESTS: Joi.number().default(100),
  ENABLE_SECURITY_HEADERS: Joi.boolean().default(true)
});

export { configSchema };
```

## 🛡️ Security Best Practices

### 1. Input Validation
```typescript
// middleware/validation.middleware.ts
import { body, validationResult } from 'express-validator';

export const validateRequest = (schema: any) => {
  return [
    body(schema),
    (req, res, next) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request data',
            details: errors.array(),
            timestamp: new Date().toISOString()
          }
        });
      }
      next();
    }
  ];
};
```

### 2. Authentication & Authorization
```typescript
// middleware/auth.middleware.ts
export const authenticateToken = (req: Request, res: Response, next: NextFunction) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({
      error: {
        code: 'AUTHENTICATION_REQUIRED',
        message: 'Authentication token required',
        timestamp: new Date().toISOString()
      }
    });
  }
  
  // Verify token logic here
  next();
};
```

### 3. Data Sanitization
```typescript
// utils/sanitization.ts
export const sanitizeInput = (input: string): string => {
  return input
    .replace(/<script[^>]*>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .trim();
};
```

## 📈 Performance Monitoring

### 1. Request Timing
```typescript
// middleware/performance.middleware.ts
export const performanceMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const startTime = process.hrtime.bigint();
  
  res.on('finish', () => {
    const endTime = process.hrtime.bigint();
    const duration = Number(endTime - startTime) / 1000000; // Convert to ms
    
    // Log slow requests
    if (duration > 1000) {
      logger.warn('Slow request detected', {
        method: req.method,
        url: req.url,
        duration,
        statusCode: res.statusCode
      });
    }
  });
  
  next();
};
```

### 2. Memory Monitoring
```typescript
// utils/memory.monitor.ts
export const getMemoryUsage = () => {
  const usage = process.memoryUsage();
  
  return {
    rss: Math.round(usage.rss / 1024 / 1024), // MB
    heapUsed: Math.round(usage.heapUsed / 1024 / 1024), // MB
    heapTotal: Math.round(usage.heapTotal / 1024 / 1024), // MB
    external: Math.round(usage.external / 1024 / 1024), // MB
    heapUsedPercent: (usage.heapUsed / usage.heapTotal) * 100
  };
};
```

### 3. Database Performance
```typescript
// utils/database.monitor.ts
export const logDatabaseQuery = (operation: string, collection: string, duration: number) => {
  logger.debug('Database operation', {
    operation,
    collection,
    duration,
    timestamp: new Date().toISOString()
  });
};
```

## 🚨 Error Handling & Recovery

### 1. Error Classification
```typescript
// utils/error.classification.ts
export enum ErrorType {
  VALIDATION = 'VALIDATION',
  AUTHENTICATION = 'AUTHENTICATION',
  AUTHORIZATION = 'AUTHORIZATION',
  NOT_FOUND = 'NOT_FOUND',
  RATE_LIMIT = 'RATE_LIMIT',
  DATABASE = 'DATABASE',
  EXTERNAL_SERVICE = 'EXTERNAL_SERVICE',
  INTERNAL = 'INTERNAL'
}

export class AppError extends Error {
  constructor(
    public type: ErrorType,
    message: string,
    public statusCode: number = 500,
    public details?: any
  ) {
    super(message);
    this.name = 'AppError';
  }
}
```

### 2. Error Reporting
```typescript
// utils/error.reporting.ts
export const reportError = (error: Error, context: any) => {
  logger.error('Application error', {
    type: error.name,
    message: error.message,
    stack: error.stack,
    context,
    timestamp: new Date().toISOString(),
    requestId: context?.requestId,
    userId: context?.userId
  });
  
  // Send to error reporting service (e.g., Sentry)
  if (process.env.SENTRY_DSN) {
    // Sentry.captureException(error, { context });
  }
};
```

### 3. Graceful Degradation
```typescript
// utils/graceful.degradation.ts
export const handleServiceFailure = (serviceName: string, fallback: () => any) => {
  logger.warn(`Service ${serviceName} failed, using fallback`, {
    service: serviceName,
    timestamp: new Date().toISOString()
  });
  
  try {
    return fallback();
  } catch (fallbackError) {
    logger.error(`Fallback for ${serviceName} also failed`, {
      service: serviceName,
      fallbackError: fallbackError.message,
      timestamp: new Date().toISOString()
    });
    
    throw new AppError(ErrorType.EXTERNAL_SERVICE, `Service ${serviceName} unavailable`);
  }
};
```

## 🔧 Development Tools

### 1. Local Development
```bash
# Start with enhanced logging
npm run dev

# Run with debug logging
DEBUG=branchat:* npm run dev

# Run with specific log level
LOG_LEVEL=debug npm run dev
```

### 2. Testing
```bash
# Run tests with coverage
npm test -- --coverage

# Run specific test file
npm test -- testFile=health.test.js

# Run integration tests
npm run test:integration
```

### 3. Linting & Formatting
```bash
# Run ESLint
npm run lint

# Run Prettier
npm run format

# Run type checking
npm run typecheck
```

## 📋 Deployment Checklist

### Pre-Deployment
- [ ] Environment variables configured
- [ ] Database connectivity verified
- [ ] Health checks passing
- [ ] Rate limiting tested
- [ ] Security headers verified
- [ ] Logging configuration tested
- [ ] Error handling tested

### Production Deployment
- [ ] Build artifacts created
- [ ] Container images built
- [ ] Health checks configured
- [ ] Monitoring setup
- [ ] Alerting configured
- [ ] Backup strategy in place
- [ ] Rollback plan prepared

### Post-Deployment
- [ ] Health checks passing
- [ ] Logs being collected
- [ ] Metrics being collected
- [ ] Alerts configured
- [ ] Performance baseline established
- [ ] Security scan completed

## 🎯 Best Practices

### 1. Logging
- Use structured logging with correlation IDs
- Log at appropriate levels (error, warn, info, debug)
- Include relevant context in log messages
- Avoid logging sensitive information
- Use log aggregation in production

### 2. Health Checks
- Implement multiple health check levels
- Include dependency health checks
- Provide detailed health information
- Use appropriate HTTP status codes
- Make health checks lightweight

### 3. Rate Limiting
- Use different limits for different endpoints
- Implement user-based rate limiting
- Provide clear error messages
- Include rate limit headers
- Monitor rate limit violations

### 4. Security
- Use security headers (Helmet)
- Implement input validation
- Use HTTPS in production
- Implement authentication & authorization
- Regular security audits

### 5. Monitoring
- Monitor application performance
- Track error rates and patterns
- Set up alerting for critical issues
- Use dashboards for visualization
- Regular performance reviews

This DevOps and observability setup provides a solid foundation for monitoring, debugging, and maintaining the BranChat application in production environments.
