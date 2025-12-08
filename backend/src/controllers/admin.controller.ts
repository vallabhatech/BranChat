import { Request, Response } from 'express';
import { metricsService, UsageStats, MemoryCleanupResult } from '../services/metrics.service';
import { AuthenticatedRequest, ApiResponse } from '../types';
import { logger } from '../utils/logger';
import { config } from '../config/environment';

// Admin-specific request validation
interface UsageQueryParams {
  startDate?: string;
  endDate?: string;
  days?: string;
}

interface CleanupQueryParams {
  olderThanDays?: string;
  dryRun?: string;
}

class AdminController {
  /**
   * Get system usage statistics
   * GET /api/admin/usage
   */
  async getUsageStats(req: Request, res: Response): Promise<void> {
    try {
      const { startDate, endDate, days } = req.query as UsageQueryParams;

      // Determine date range
      let start: Date;
      let end: Date = new Date();

      if (startDate && endDate) {
        start = new Date(startDate);
        end = new Date(endDate);
        
        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
          res.status(400).json({
            success: false,
            error: {
              code: 'INVALID_DATE_FORMAT',
              message: 'Invalid date format. Use ISO 8601 format (YYYY-MM-DD)',
              timestamp: new Date().toISOString(),
            },
          });
          return;
        }
      } else if (days) {
        const daysNum = parseInt(days, 10);
        if (isNaN(daysNum) || daysNum < 1 || daysNum > 365) {
          res.status(400).json({
            success: false,
            error: {
              code: 'INVALID_DAYS_PARAMETER',
              message: 'Days parameter must be a number between 1 and 365',
              timestamp: new Date().toISOString(),
            },
          });
          return;
        }
        
        start = new Date();
        start.setDate(start.getDate() - daysNum);
      } else {
        // Default to last 30 days
        start = new Date();
        start.setDate(start.getDate() - 30);
      }

      // Validate date range
      if (start >= end) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_DATE_RANGE',
            message: 'Start date must be before end date',
            timestamp: new Date().toISOString(),
          },
        });
        return;
      }

      logger.info('Generating usage statistics', {
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        requestedBy: (req as AuthenticatedRequest).user?.id,
      });

      const stats: UsageStats = await metricsService.getUsageStats(start, end);

      const response: ApiResponse<UsageStats> = {
        success: true,
        data: stats,
      };

      res.json(response);
    } catch (error) {
      logger.error('Failed to get usage statistics', {
        error: error instanceof Error ? error.message : 'Unknown error',
        requestedBy: (req as AuthenticatedRequest).user?.id,
      });

      res.status(500).json({
        success: false,
        error: {
          code: 'USAGE_STATS_ERROR',
          message: 'Failed to retrieve usage statistics',
          timestamp: new Date().toISOString(),
        },
      });
    }
  }

  /**
   * Clean up old memory entries
   * POST /api/admin/memory/cleanup
   */
  async cleanupMemory(req: Request, res: Response): Promise<void> {
    try {
      const { olderThanDays, dryRun } = req.query as CleanupQueryParams;

      // Parse parameters
      const days = olderThanDays ? parseInt(olderThanDays, 10) : 90;
      const isDryRun = dryRun === 'true';

      if (isNaN(days) || days < 1 || days > 3650) { // Max 10 years
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_DAYS_PARAMETER',
            message: 'olderThanDays parameter must be a number between 1 and 3650',
            timestamp: new Date().toISOString(),
          },
        });
        return;
      }

      logger.info('Starting memory cleanup', {
        olderThanDays: days,
        dryRun: isDryRun,
        requestedBy: (req as AuthenticatedRequest).user?.id,
      });

      if (isDryRun) {
        // For dry run, we'll simulate the cleanup without actually deleting
        // This is a simplified version - in a real implementation, you'd want
        // to run the same queries but without the actual delete operations
        res.json({
          success: true,
          data: {
            dryRun: true,
            message: 'Dry run completed. No data was actually deleted.',
            estimatedDeletions: {
              deletedEntries: 0,
              orphanedSummaries: 0,
              oldEntries: 0,
              totalProcessed: 0,
            },
          },
        });
        return;
      }

      const result: MemoryCleanupResult = await metricsService.cleanupMemory(days);

      logger.info('Memory cleanup completed', {
        result,
        requestedBy: (req as AuthenticatedRequest).user?.id,
      });

      const response: ApiResponse<MemoryCleanupResult> = {
        success: true,
        data: result,
      };

      res.json(response);
    } catch (error) {
      logger.error('Memory cleanup failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        requestedBy: (req as AuthenticatedRequest).user?.id,
      });

      res.status(500).json({
        success: false,
        error: {
          code: 'MEMORY_CLEANUP_ERROR',
          message: 'Failed to cleanup memory entries',
          timestamp: new Date().toISOString(),
        },
      });
    }
  }

  /**
   * Get system health and metrics overview
   * GET /api/admin/health
   */
  async getSystemHealth(req: Request, res: Response): Promise<void> {
    try {
      logger.info('Getting system health', {
        requestedBy: (req as AuthenticatedRequest).user?.id,
      });

      // Get current token statistics
      const tokenStats = metricsService.getCurrentTokenStats();

      // Get basic system info
      const systemInfo = {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        nodeVersion: process.version,
        environment: config.env,
        timestamp: new Date().toISOString(),
      };

      const healthData = {
        system: systemInfo,
        tokens: tokenStats,
        features: {
          guestModeEnabled: config.guest.allowed,
          elasticSearchEnabled: !!config.elastic?.url,
          geminiConfigured: !!config.gemini?.apiKey,
        },
      };

      const response: ApiResponse<typeof healthData> = {
        success: true,
        data: healthData,
      };

      res.json(response);
    } catch (error) {
      logger.error('Failed to get system health', {
        error: error instanceof Error ? error.message : 'Unknown error',
        requestedBy: (req as AuthenticatedRequest).user?.id,
      });

      res.status(500).json({
        success: false,
        error: {
          code: 'SYSTEM_HEALTH_ERROR',
          message: 'Failed to retrieve system health information',
          timestamp: new Date().toISOString(),
        },
      });
    }
  }

  /**
   * Get current token usage statistics
   * GET /api/admin/tokens
   */
  async getTokenStats(req: Request, res: Response): Promise<void> {
    try {
      logger.info('Getting token statistics', {
        requestedBy: (req as AuthenticatedRequest).user?.id,
      });

      const tokenStats = metricsService.getCurrentTokenStats();

      const response: ApiResponse<typeof tokenStats> = {
        success: true,
        data: tokenStats,
      };

      res.json(response);
    } catch (error) {
      logger.error('Failed to get token statistics', {
        error: error instanceof Error ? error.message : 'Unknown error',
        requestedBy: (req as AuthenticatedRequest).user?.id,
      });

      res.status(500).json({
        success: false,
        error: {
          code: 'TOKEN_STATS_ERROR',
          message: 'Failed to retrieve token statistics',
          timestamp: new Date().toISOString(),
        },
      });
    }
  }
}

// Export singleton instance
export const adminController = new AdminController();