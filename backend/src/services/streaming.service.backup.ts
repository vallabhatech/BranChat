/**
 * Enhanced Streaming Service
 * 
 * Production-ready Server-Sent Events implementation with:
 * - Proper headers and keep-alive handling
 * - Timeout guards and graceful termination
 * - Memory leak prevention
 * - Structured error events
 * - Connection cleanup on disconnect
 */

import { Response } from 'express';
import { aiService } from './AIService';
import { logger } from '../utils/logger';
import { AIMessage, AIStreamOptions } from '../types/ai-provider.interface';

export interface SSEClient {
  id: string;
  response: Response;
  isConnected: boolean;
  lastActivity: Date;
  abortController?: AbortController;
  timeoutId?: NodeJS.Timeout;
  heartbeatInterval?: NodeJS.Timeout;
}

export interface StreamingRequest {
  messages: AIMessage[];
  options?: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
    streamTimeout?: number;
    heartbeatInterval?: number;
  };
}

export interface StreamMetrics {
  clientId: string;
  startTime: Date;
  endTime?: Date;
  tokensSent: number;
  bytesTransferred: number;
  errors: number;
  duration?: number;
}

export class StreamingService {
  private clients: Map<string, SSEClient> = new Map();
  private activeStreams: Map<string, AbortController> = new Map();
  private streamMetrics: Map<string, StreamMetrics> = new Map();
  private readonly DEFAULT_TIMEOUT = 300000; // 5 minutes
  private readonly DEFAULT_HEARTBEAT = 30000; // 30 seconds
  private readonly MAX_CLIENTS = 1000; // Prevent DoS

  /**
   * Initialize SSE connection with enhanced error handling
   */
  initializeSSEConnection(clientId: string, response: Response): void {
    // Check client limit
    if (this.clients.size >= this.MAX_CLIENTS) {
      logger.warn('Maximum client limit reached', { clientId, currentClients: this.clients.size });
      response.writeHead(503, {
        'Content-Type': 'text/plain',
        'Retry-After': '5'
      });
      response.end('Server too busy. Please try again later.');
      return;
    }

    // Set comprehensive SSE headers
    response.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control, Content-Type',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'X-Accel-Buffering': 'no', // Disable nginx buffering
      'X-Content-Type-Options': 'nosniff', // Security headers
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block'
    });

    // Create abort controller with timeout
    const abortController = new AbortController();
    
    // Set up timeout guard
    const timeoutId = setTimeout(() => {
      logger.warn('Client connection timeout', { clientId });
      this.handleClientDisconnection(clientId, 'timeout');
    }, this.DEFAULT_TIMEOUT);

    // Set up heartbeat interval
    const heartbeatInterval = setInterval(() => {
      this.sendHeartbeat(clientId);
    }, this.DEFAULT_HEARTBEAT);

    // Store client connection
    const client: SSEClient = {
      id: clientId,
      response,
      isConnected: true,
      lastActivity: new Date(),
      abortController,
      timeoutId,
      heartbeatInterval
    };

    this.clients.set(clientId, client);
    this.initializeStreamMetrics(clientId);

    // Enhanced connection event handling
    this.setupConnectionHandlers(clientId, response);

    // Send initial connection event
    this.sendEvent(clientId, 'connected', {
      clientId,
      timestamp: new Date().toISOString(),
      serverTime: new Date().toISOString(),
      timeout: this.DEFAULT_TIMEOUT,
      heartbeatInterval: this.DEFAULT_HEARTBEAT
    });

    logger.info('SSE connection initialized', { 
      clientId, 
      totalClients: this.clients.size,
      userAgent: response.get('User-Agent')
    });
  }

  /**
   * Enhanced stream LLM response with timeout and error handling
   */
  async streamLLMResponse(clientId: string, request: StreamingRequest): Promise<void> {
    const client = this.clients.get(clientId);
    if (!client || !client.isConnected) {
      throw new Error(`Client ${clientId} not found or disconnected`);
    }

    const metrics = this.streamMetrics.get(clientId);
    if (!metrics) {
      throw new Error(`No metrics found for client ${clientId}`);
    }

    try {
      // Update stream start time
      metrics.startTime = new Date();

      // Send streaming start event with metadata
      this.sendEvent(clientId, 'stream_start', {
        timestamp: new Date().toISOString(),
        model: request.options?.model || 'default',
        timeout: request.options?.streamTimeout || this.DEFAULT_TIMEOUT,
        messageId: this.generateMessageId()
      });

      let fullResponse = '';
      let tokenCount = 0;
      let lastTokenTime = Date.now();

      // Create streaming options with enhanced callbacks
      const streamOptions: AIStreamOptions = {
        onToken: (token: string) => {
          if (!client.isConnected) return;

          try {
            tokenCount++;
            fullResponse += token;
            lastTokenTime = Date.now();

            // Update metrics
            metrics.tokensSent = tokenCount;
            metrics.bytesTransferred += Buffer.byteLength(token, 'utf8');

            // Send token with metadata
            this.sendEvent(clientId, 'token', {
              content: token,
              tokenIndex: tokenCount,
              timestamp: new Date().toISOString(),
              bytes: Buffer.byteLength(token, 'utf8')
            });

            // Update client activity
            client.lastActivity = new Date();
          } catch (error) {
            logger.error('Error sending token', { clientId, error });
            metrics.errors++;
          }
        },
        onComplete: (response: string) => {
          if (!client.isConnected) return;

          try {
            metrics.endTime = new Date();
            metrics.duration = metrics.endTime.getTime() - metrics.startTime.getTime();

            this.sendEvent(clientId, 'stream_complete', {
              fullResponse: response,
              tokenCount,
              duration: metrics.duration,
              timestamp: new Date().toISOString(),
              metrics: this.getMetricsSummary(clientId)
            });

            logger.info('Stream completed successfully', {
              clientId,
              tokenCount,
              duration: metrics.duration,
              bytesTransferred: metrics.bytesTransferred
            });
          } catch (error) {
            logger.error('Error sending completion event', { clientId, error });
            metrics.errors++;
          }
        },
        onError: (error: Error) => {
          if (!client.isConnected) return;

          metrics.errors++;
          metrics.endTime = new Date();
          metrics.duration = metrics.endTime.getTime() - metrics.startTime.getTime();

          this.sendStructuredError(clientId, 'stream_error', error, {
            tokenCount,
            bytesTransferred: metrics.bytesTransferred,
            duration: metrics.duration
          });
        }
      };

      // Start streaming from AI service
      const stream = await aiService.generateResponseStream(
        request.messages,
        {
          ...request.options,
          ...streamOptions,
        }
      );

      // Process the stream with timeout protection
      const streamTimeout = request.options?.streamTimeout || this.DEFAULT_TIMEOUT;
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Stream timeout')), streamTimeout);
      });

      // Race between stream completion and timeout
      await Promise.race([
        this.processStream(stream, clientId, () => client.isConnected),
        timeoutPromise
      ]);

    } catch (error) {
      metrics.errors++;
      metrics.endTime = new Date();
      metrics.duration = metrics.endTime.getTime() - metrics.startTime.getTime();

      this.sendStructuredError(clientId, 'stream_failed', error, {
        tokensSent: metrics.tokensSent,
        bytesTransferred: metrics.bytesTransferred,
        duration: metrics.duration
      });

      logger.error('LLM streaming failed', { clientId, error });
      throw error;
    }
  }

  /**
   * Process stream with connection monitoring
   */
  private async processStream(
    stream: AsyncIterable<string>,
    clientId: string,
    isConnectedCheck: () => boolean
  ): Promise<void> {
    for await (const chunk of stream) {
      if (!isConnectedCheck()) {
        logger.info('Client disconnected during streaming', { clientId });
        break;
      }
      // Chunk processing is handled in the onToken callback
    }
  }

  /**
   * Send structured error events
   */
  private sendStructuredError(
    clientId: string,
    eventType: string,
    error: Error,
    context?: Record<string, any>
  ): void {
    const errorData = {
      code: this.getErrorCode(error),
      message: error.message,
      timestamp: new Date().toISOString(),
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      ...context
    };

    this.sendEvent(clientId, eventType, errorData);
    
    logger.error('Stream error event sent', { clientId, eventType, error: error.message });
  }

  /**
   * Get standardized error code
   */
  private getErrorCode(error: Error): string {
    if (error.message.includes('timeout')) return 'STREAM_TIMEOUT';
    if (error.message.includes('abort')) return 'STREAM_ABORTED';
    if (error.message.includes('network')) return 'NETWORK_ERROR';
    if (error.message.includes('provider')) return 'PROVIDER_ERROR';
    return 'UNKNOWN_ERROR';
  }

  /**
   * Enhanced connection event handlers
   */
  private setupConnectionHandlers(clientId: string, response: Response): void {
    // Handle client disconnection
    response.on('close', () => {
      this.handleClientDisconnection(clientId, 'client_close');
    });

    response.on('error', (error: any) => {
      logger.error('SSE connection error', { clientId, error });
      this.sendStructuredError(clientId, 'connection_error', new Error(error.message || 'Connection error'));
      this.handleClientDisconnection(clientId, 'connection_error');
    });

    // Handle aborted requests
    response.on('aborted', () => {
      logger.info('SSE connection aborted', { clientId });
      this.handleClientDisconnection(clientId, 'connection_aborted');
    });

    // Handle premature close
    response.on('finish', () => {
      this.handleClientDisconnection(clientId, 'connection_finished');
    });
  }

  /**
   * Enhanced client disconnection handling
   */
  private handleClientDisconnection(clientId: string, reason: string): void {
    const client = this.clients.get(clientId);
    if (!client) {
      return;
    }

    // Mark client as disconnected
    client.isConnected = false;

    // Clear timeout
    if (client.timeoutId) {
      clearTimeout(client.timeoutId);
    }

    // Clear heartbeat
    if (client.heartbeatInterval) {
      clearInterval(client.heartbeatInterval);
    }

    // Abort any active streams
    if (client.abortController) {
      client.abortController.abort();
    }

    // Remove from active streams
    const streamController = this.activeStreams.get(clientId);
    if (streamController) {
      streamController.abort();
      this.activeStreams.delete(clientId);
    }

    // Finalize metrics
    const metrics = this.streamMetrics.get(clientId);
    if (metrics && !metrics.endTime) {
      metrics.endTime = new Date();
      metrics.duration = metrics.endTime.getTime() - metrics.startTime.getTime();
    }

    // Send disconnection event
    this.sendEvent(clientId, 'disconnected', {
      reason,
      timestamp: new Date().toISOString(),
      metrics: this.getMetricsSummary(clientId)
    });

    // Clean up response
    try {
      if (!client.response.destroyed) {
        client.response.end();
      }
    } catch (error) {
      logger.warn('Error closing client response', { clientId, error });
    }

    // Remove from clients map
    this.clients.delete(clientId);

    logger.info('Client disconnected and cleaned up', { 
      clientId, 
      reason, 
      duration: metrics?.duration,
      totalClients: this.clients.size 
    });
  }

  /**
   * Enhanced event sending with error handling
   */
  private sendEvent(clientId: string, eventType: string, data: any): void {
    const client = this.clients.get(clientId);
    if (!client || !client.isConnected) {
      return;
    }

    try {
      const eventData = JSON.stringify(data);
      const sseMessage = `event: ${eventType}\ndata: ${eventData}\n\n`;
      
      // Check if response is still writable
      if (client.response.writable) {
        client.response.write(sseMessage);
        
        // Update metrics
        const metrics = this.streamMetrics.get(clientId);
        if (metrics) {
          metrics.bytesTransferred += Buffer.byteLength(sseMessage, 'utf8');
        }
        
        client.lastActivity = new Date();
      } else {
        logger.warn('Response not writable, disconnecting client', { clientId });
        this.handleClientDisconnection(clientId, 'response_not_writable');
      }
    } catch (error) {
      logger.error('Failed to send SSE event', { clientId, eventType, error });
      this.handleClientDisconnection(clientId, 'send_error');
    }
  }

  /**
   * Enhanced heartbeat with connection validation
   */
  private sendHeartbeat(clientId: string): void {
    const client = this.clients.get(clientId);
    if (!client || !client.isConnected) {
      return;
    }

    // Check if client is still responsive
    const timeSinceLastActivity = Date.now() - client.lastActivity.getTime();
    if (timeSinceLastActivity > this.DEFAULT_HEARTBEAT * 2) {
      logger.warn('Client unresponsive, disconnecting', { 
        clientId, 
        timeSinceLastActivity 
      });
      this.handleClientDisconnection(clientId, 'unresponsive');
      return;
    }

    this.sendEvent(clientId, 'heartbeat', {
      timestamp: new Date().toISOString(),
      serverTime: new Date().toISOString()
    });
  }

  /**
   * Initialize stream metrics
   */
  private initializeStreamMetrics(clientId: string): void {
    this.streamMetrics.set(clientId, {
      clientId,
      startTime: new Date(),
      tokensSent: 0,
      bytesTransferred: 0,
      errors: 0
    });
  }

  /**
   * Get metrics summary
   */
  private getMetricsSummary(clientId: string): any {
    const metrics = this.streamMetrics.get(clientId);
    if (!metrics) return null;

    return {
      duration: metrics.duration,
      tokensSent: metrics.tokensSent,
      bytesTransferred: metrics.bytesTransferred,
      errors: metrics.errors,
      averageTokenSize: metrics.tokensSent > 0 ? metrics.bytesTransferred / metrics.tokensSent : 0,
      tokensPerSecond: metrics.duration && metrics.duration > 0 ? 
        (metrics.tokensSent / (metrics.duration / 1000)) : 0
    };
  }

  /**
   * Generate unique message ID
   */
  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Disconnect specific client
   */
  disconnectClient(clientId: string): void {
    this.handleClientDisconnection(clientId, 'manual_disconnect');
  }

  /**
   * Disconnect all clients with cleanup
   */
  disconnectAllClients(): void {
    const clientIds = Array.from(this.clients.keys());
    
    clientIds.forEach(clientId => {
      this.handleClientDisconnection(clientId, 'server_shutdown');
    });

    // Clear all maps
    this.clients.clear();
    this.activeStreams.clear();
    this.streamMetrics.clear();

    logger.info('All clients disconnected', { count: clientIds.length });
  }

  /**
   * Get connected client count
   */
  getConnectedClientCount(): number {
    return Array.from(this.clients.values()).filter(client => client.isConnected).length;
  }

  /**
   * Get client connection status
   */
  isClientConnected(clientId: string): boolean {
    const client = this.clients.get(clientId);
    return client ? client.isConnected : false;
  }

  /**
   * Get system health metrics
   */
  getHealthMetrics(): {
    connectedClients: number;
    totalClients: number;
    activeStreams: number;
    memoryUsage: {
      clients: number;
      streams: number;
      metrics: number;
    };
  } {
    return {
      connectedClients: this.getConnectedClientCount(),
      totalClients: this.clients.size,
      activeStreams: this.activeStreams.size,
      memoryUsage: {
        clients: this.clients.size,
        streams: this.activeStreams.size,
        metrics: this.streamMetrics.size
      }
    };
  }

  /**
   * Cleanup old metrics (prevent memory leaks)
   */
  cleanupOldMetrics(): void {
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours

    for (const [clientId, metrics] of this.streamMetrics.entries()) {
      if (metrics.endTime && (now - metrics.endTime.getTime()) > maxAge) {
        this.streamMetrics.delete(clientId);
        logger.debug('Cleaned up old metrics', { clientId });
      }
    }
  }
}

// Export singleton instance
export const streamingService = new StreamingService();

// Set up periodic cleanup
const cleanupInterval = setInterval(() => {
  streamingService.cleanupOldMetrics();
}, 60 * 60 * 1000); // Every hour

// Graceful shutdown handlers
const cleanup = () => {
  clearInterval(cleanupInterval);
  streamingService.disconnectAllClients();
};

process.on('SIGTERM', () => {
  logger.info('SIGTERM received, disconnecting all streaming clients');
  cleanup();
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, disconnecting all streaming clients');
  cleanup();
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
  logger.error('Unhandled Promise Rejection', { reason, promise });
});

// Handle uncaught exceptions
process.on('uncaughtException', (error: Error) => {
  logger.error('Uncaught Exception', { error });
  cleanup();
  process.exit(1);
});
