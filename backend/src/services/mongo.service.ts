import mongoose from 'mongoose';
import { config } from '../config/environment';
import { logger } from '../utils/logger';

export class MongoService {
  private static instance: MongoService;
  private isConnected = false;
  private connectionRetries = 0;
  private readonly maxRetries = 5;
  private readonly retryDelay = 5000; // 5 seconds

  private constructor() {}

  public static getInstance(): MongoService {
    if (!MongoService.instance) {
      MongoService.instance = new MongoService();
    }
    return MongoService.instance;
  }

  /**
   * Initialize MongoDB connection with retry logic
   */
  public async connect(): Promise<void> {
    if (this.isConnected) {
      logger.info('MongoDB already connected');
      return;
    }

    try {
      // Configure mongoose options
      const options: mongoose.ConnectOptions = {
        maxPoolSize: 10, // Maintain up to 10 socket connections
        serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
        socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
      };

      // Configure mongoose settings
      mongoose.set('bufferCommands', false); // Disable mongoose buffering

      logger.info('Connecting to MongoDB...', {
        uri: this.maskConnectionString(config.database.uri),
        options: {
          maxPoolSize: options.maxPoolSize,
          serverSelectionTimeoutMS: options.serverSelectionTimeoutMS,
          socketTimeoutMS: options.socketTimeoutMS,
        },
      });

      await mongoose.connect(config.database.uri, options);
      
      this.isConnected = true;
      this.connectionRetries = 0;
      
      logger.info('MongoDB connected successfully', {
        readyState: mongoose.connection.readyState,
        host: mongoose.connection.host,
        port: mongoose.connection.port,
        name: mongoose.connection.name,
      });

      // Set up connection event listeners
      this.setupEventListeners();

    } catch (error) {
      this.isConnected = false;
      this.connectionRetries++;
      
      logger.error('MongoDB connection failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        attempt: this.connectionRetries,
        maxRetries: this.maxRetries,
      });

      if (this.connectionRetries < this.maxRetries) {
        logger.info(`Retrying MongoDB connection in ${this.retryDelay}ms...`);
        await this.delay(this.retryDelay);
        return this.connect();
      } else {
        throw new Error(`Failed to connect to MongoDB after ${this.maxRetries} attempts: ${error}`);
      }
    }
  }

  /**
   * Disconnect from MongoDB
   */
  public async disconnect(): Promise<void> {
    if (!this.isConnected) {
      logger.info('MongoDB already disconnected');
      return;
    }

    try {
      await mongoose.disconnect();
      this.isConnected = false;
      logger.info('MongoDB disconnected successfully');
    } catch (error) {
      logger.error('Error disconnecting from MongoDB', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Check if MongoDB is connected and healthy
   */
  public async healthCheck(): Promise<{
    connected: boolean;
    readyState: number;
    host?: string;
    port?: number;
    name?: string;
    error?: string;
  }> {
    try {
      const connection = mongoose.connection;
      
      if (connection.readyState !== 1) {
        return {
          connected: false,
          readyState: connection.readyState,
          error: 'Connection not ready',
        };
      }

      // Perform a simple ping to verify connection
      if (mongoose.connection.db) {
        await mongoose.connection.db.admin().ping();
      } else {
        throw new Error('Database connection not available');
      }

      return {
        connected: true,
        readyState: connection.readyState,
        host: connection.host,
        port: connection.port,
        name: connection.name,
      };
    } catch (error) {
      logger.error('MongoDB health check failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return {
        connected: false,
        readyState: mongoose.connection.readyState,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get connection status
   */
  public getConnectionStatus(): {
    isConnected: boolean;
    readyState: number;
    readyStateString: string;
  } {
    const readyStateMap = {
      0: 'disconnected',
      1: 'connected',
      2: 'connecting',
      3: 'disconnecting',
    };

    return {
      isConnected: this.isConnected,
      readyState: mongoose.connection.readyState,
      readyStateString: readyStateMap[mongoose.connection.readyState as keyof typeof readyStateMap] || 'unknown',
    };
  }

  /**
   * Set up MongoDB connection event listeners
   */
  private setupEventListeners(): void {
    mongoose.connection.on('connected', () => {
      logger.info('MongoDB connection established');
      this.isConnected = true;
    });

    mongoose.connection.on('error', (error) => {
      logger.error('MongoDB connection error', {
        error: error.message,
      });
      this.isConnected = false;
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB connection lost');
      this.isConnected = false;
    });

    mongoose.connection.on('reconnected', () => {
      logger.info('MongoDB reconnected');
      this.isConnected = true;
    });

    // Handle process termination
    process.on('SIGINT', async () => {
      logger.info('Received SIGINT, closing MongoDB connection...');
      await this.disconnect();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      logger.info('Received SIGTERM, closing MongoDB connection...');
      await this.disconnect();
      process.exit(0);
    });
  }

  /**
   * Mask sensitive information in connection string for logging
   */
  private maskConnectionString(uri: string): string {
    try {
      const url = new URL(uri);
      if (url.password) {
        url.password = '***';
      }
      return url.toString();
    } catch {
      // If URL parsing fails, just mask the entire string partially
      return uri.replace(/\/\/[^@]+@/, '//***:***@');
    }
  }

  /**
   * Utility method for delays
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Export singleton instance
export const mongoService = MongoService.getInstance();