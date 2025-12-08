import { mongoService } from '../services/mongo.service';
import { logger } from '../utils/logger';

/**
 * Initialize all database connections
 */
export async function initializeDatabases(): Promise<void> {
  logger.info('Initializing database connections...');

  try {
    // Initialize MongoDB connection
    await mongoService.connect();
    
    logger.info('All database connections initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize database connections', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

/**
 * Close all database connections
 */
export async function closeDatabases(): Promise<void> {
  logger.info('Closing database connections...');

  try {
    await mongoService.disconnect();
    logger.info('All database connections closed successfully');
  } catch (error) {
    logger.error('Error closing database connections', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

/**
 * Get health status of all databases
 */
export async function getDatabaseHealth(): Promise<{
  mongodb: Awaited<ReturnType<typeof mongoService.healthCheck>>;
  overall: 'healthy' | 'degraded' | 'unhealthy';
}> {
  const mongodb = await mongoService.healthCheck();
  
  let overall: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
  
  if (!mongodb.connected) {
    overall = 'unhealthy';
  }
  
  return {
    mongodb,
    overall,
  };
}