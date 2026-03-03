/**
 * Health Check Controller
 * 
 * Simple health check endpoint for monitoring and load balancers
 */

import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { config } from '../config/environment';
import { logger } from '../utils/logger';

interface HealthStatus {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  uptime: number;
  version: string;
  environment: string;
  checks: {
    database: {
      status: 'healthy' | 'unhealthy';
      responseTime?: number;
      error?: string;
    };
    memory: {
      status: 'healthy' | 'unhealthy';
      usage: {
        rss: number;
        heapUsed: number;
        heapTotal: number;
        external: number;
      };
    };
    ai: {
      status: 'healthy' | 'unhealthy' | 'degraded';
      provider?: string;
      available?: boolean;
      error?: string;
    };
  };
}

export class HealthController {
  /**
   * GET /health
   * Basic health check endpoint
   */
  async healthCheck(req: Request, res: Response): Promise<void> {
    try {
      const healthStatus = await this.getHealthStatus();
      
      const statusCode = healthStatus.status === 'healthy' ? 200 : 
                        healthStatus.status === 'degraded' ? 200 : 503;
      
      res.status(statusCode).json(healthStatus);
    } catch (error) {
      logger.error('Health check failed', { error });
      res.status(503).json({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: 'Health check failed'
      });
    }
  }

  /**
   * GET /health/ready
   * Readiness probe (for Kubernetes)
   */
  async readinessCheck(req: Request, res: Response): Promise<void> {
    try {
      const healthStatus = await this.getHealthStatus();
      
      // Only return healthy if all critical checks pass
      const isReady = healthStatus.status === 'healthy' && 
                     healthStatus.checks.database.status === 'healthy';
      
      const statusCode = isReady ? 200 : 503;
      
      res.status(statusCode).json({
        status: isReady ? 'ready' : 'not-ready',
        timestamp: new Date().toISOString(),
        checks: healthStatus.checks
      });
    } catch (error) {
      logger.error('Readiness check failed', { error });
      res.status(503).json({
        status: 'not-ready',
        timestamp: new Date().toISOString(),
        error: 'Readiness check failed'
      });
    }
  }

  /**
   * GET /health/live
   * Liveness probe (for Kubernetes)
   */
  async livenessCheck(req: Request, res: Response): Promise<void> {
    // Simple liveness check - if we can respond, we're alive
    res.status(200).json({
      status: 'alive',
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    });
  }

  /**
   * GET /health/detailed
   * Detailed health information for debugging
   */
  async detailedHealthCheck(req: Request, res: Response): Promise<void> {
    try {
      const healthStatus = await this.getHealthStatus();
      
      // Add additional detailed information
      const detailedStatus = {
        ...healthStatus,
        system: {
          nodeVersion: process.version,
          platform: process.platform,
          arch: process.arch,
          pid: process.pid,
        },
        config: {
          env: config.env,
          port: config.port,
          nodeEnv: process.env.NODE_ENV,
        },
        dependencies: {
          mongodb: mongoose.version,
          express: require('express/package.json').version,
        }
      };
      
      res.status(200).json(detailedStatus);
    } catch (error) {
      logger.error('Detailed health check failed', { error });
      res.status(503).json({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: 'Detailed health check failed'
      });
    }
  }

  /**
   * Get comprehensive health status
   */
  private async getHealthStatus(): Promise<HealthStatus> {
    const startTime = Date.now();
    
    // Check database connectivity
    const dbCheck = await this.checkDatabase();
    
    // Check memory usage
    const memCheck = this.checkMemory();
    
    // Check AI service availability
    const aiCheck = await this.checkAIService();
    
    // Determine overall status
    let overallStatus: 'healthy' | 'unhealthy' | 'degraded' = 'healthy';
    
    if (dbCheck.status === 'unhealthy' || memCheck.status === 'unhealthy') {
      overallStatus = 'unhealthy';
    } else if (aiCheck.status === 'unhealthy' || aiCheck.status === 'degraded') {
      overallStatus = 'degraded';
    }
    
    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0',
      environment: config.env,
      checks: {
        database: dbCheck,
        memory: memCheck,
        ai: aiCheck
      }
    };
  }

  /**
   * Check database connectivity
   */
  private async checkDatabase(): Promise<{
    status: 'healthy' | 'unhealthy';
    responseTime?: number;
    error?: string;
  }> {
    try {
      const startTime = Date.now();
      
      // Simple ping to database
      await mongoose.connection.db.admin().ping();
      
      const responseTime = Date.now() - startTime;
      
      return {
        status: 'healthy',
        responseTime
      };
    } catch (error) {
      logger.error('Database health check failed', { error });
      return {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown database error'
      };
    }
  }

  /**
   * Check memory usage
   */
  private checkMemory(): {
    status: 'healthy' | 'unhealthy';
    usage: {
      rss: number;
      heapUsed: number;
      heapTotal: number;
      external: number;
    };
  } {
    const memUsage = process.memoryUsage();
    const heapUsedMB = memUsage.heapUsed / 1024 / 1024;
    const heapTotalMB = memUsage.heapTotal / 1024 / 1024;
    
    // Consider unhealthy if heap usage is > 90% of available heap
    const isHealthy = heapUsedMB < (heapTotalMB * 0.9);
    
    return {
      status: isHealthy ? 'healthy' : 'unhealthy',
      usage: {
        rss: Math.round(memUsage.rss / 1024 / 1024), // MB
        heapUsed: Math.round(heapUsedMB), // MB
        heapTotal: Math.round(heapTotalMB), // MB
        external: Math.round(memUsage.external / 1024 / 1024) // MB
      }
    };
  }

  /**
   * Check AI service availability
   */
  private async checkAIService(): Promise<{
    status: 'healthy' | 'unhealthy' | 'degraded';
    provider?: string;
    available?: boolean;
    error?: string;
  }> {
    try {
      // Check if Gemini API key is configured
      if (!config.gemini.apiKey) {
        return {
          status: 'degraded',
          provider: 'gemini',
          available: false,
          error: 'Gemini API key not configured'
        };
      }
      
      // Simple check - in a real implementation, you might want to
      // make a lightweight API call to verify connectivity
      return {
        status: 'healthy',
        provider: 'gemini',
        available: true
      };
    } catch (error) {
      logger.error('AI service health check failed', { error });
      return {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown AI service error'
      };
    }
  }
}

// Export singleton instance
export const healthController = new HealthController();
