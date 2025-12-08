import app from './app';
import { config } from './config/environment';
import { logger } from './utils/logger';
import { initializeDatabases, closeDatabases } from './config/database';

// Initialize databases before starting server
async function startServer() {
  try {
    await initializeDatabases();
    
    const server = app.listen(config.port, () => {
      logger.info(`Server running on port ${config.port}`, {
        environment: config.env,
        port: config.port,
      });
    });

    return server;
  } catch (error) {
    logger.error('Failed to start server', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    process.exit(1);
  }
}

const serverPromise = startServer();

// Graceful shutdown
async function gracefulShutdown(signal: string) {
  logger.info(`${signal} received, shutting down gracefully`);
  
  try {
    const server = await serverPromise;
    
    // Close server first
    await new Promise<void>((resolve) => {
      server.close(() => {
        logger.info('HTTP server closed');
        resolve();
      });
    });
    
    // Close database connections
    await closeDatabases();
    
    logger.info('Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    logger.error('Error during graceful shutdown', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    process.exit(1);
  }
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle unhandled promise rejections
process.on('unhandledRejection', async (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  await gracefulShutdown('UNHANDLED_REJECTION');
});

// Handle uncaught exceptions
process.on('uncaughtException', async (error) => {
  logger.error('Uncaught Exception:', error);
  await gracefulShutdown('UNCAUGHT_EXCEPTION');
});

export default serverPromise;