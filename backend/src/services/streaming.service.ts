import { Response } from 'express';
import { llmService } from './llm.service';
import { logger } from '../utils/logger';
import { LLMMessage, StreamingOptions } from '../types';

export interface SSEClient {
  id: string;
  response: Response;
  isConnected: boolean;
  abortController?: AbortController;
}

export interface StreamingRequest {
  messages: LLMMessage[];
  options?: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
  };
}

export class StreamingService {
  private clients: Map<string, SSEClient> = new Map();
  private activeStreams: Map<string, AbortController> = new Map();

  /**
   * Initialize SSE connection for a client
   */
  initializeSSEConnection(clientId: string, response: Response): void {
    // Set SSE headers
    response.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control',
      'X-Accel-Buffering': 'no', // Disable nginx buffering
    });

    // Create abort controller for this client
    const abortController = new AbortController();

    // Store client connection
    const client: SSEClient = {
      id: clientId,
      response,
      isConnected: true,
      abortController,
    };

    this.clients.set(clientId, client);

    // Handle client disconnection
    response.on('close', () => {
      this.handleClientDisconnection(clientId);
    });

    response.on('error', (error) => {
      logger.error('SSE connection error', { clientId, error });
      this.handleClientDisconnection(clientId);
    });

    // Send initial connection event
    this.sendEvent(clientId, 'connected', { clientId, timestamp: new Date().toISOString() });

    logger.info('SSE connection initialized', { clientId });
  }

  /**
   * Stream LLM response to client using SSE
   */
  async streamLLMResponse(clientId: string, request: StreamingRequest): Promise<void> {
    const client = this.clients.get(clientId);
    if (!client || !client.isConnected) {
      throw new Error(`Client ${clientId} not found or disconnected`);
    }

    try {
      // Send streaming start event
      this.sendEvent(clientId, 'stream_start', {
        timestamp: new Date().toISOString(),
        model: request.options?.model || 'default',
      });

      let fullResponse = '';
      let tokenCount = 0;

      // Create streaming options with callbacks
      const streamingOptions: StreamingOptions = {
        onToken: (token: string) => {
          if (client.isConnected) {
            tokenCount++;
            fullResponse += token;
            this.sendEvent(clientId, 'token', {
              content: token,
              tokenIndex: tokenCount,
            });
          }
        },
        onComplete: (response: string) => {
          if (client.isConnected) {
            this.sendEvent(clientId, 'stream_complete', {
              fullResponse: response,
              tokenCount,
              timestamp: new Date().toISOString(),
            });
          }
        },
        onError: (error: Error) => {
          if (client.isConnected) {
            this.sendEvent(clientId, 'stream_error', {
              error: error.message,
              timestamp: new Date().toISOString(),
            });
          }
        },
      };

      // Start streaming from LLM service
      const stream = await llmService.chatCompletionStream(
        request.messages,
        {
          ...request.options,
          ...streamingOptions,
        }
      );

      // Process the stream
      for await (const token of stream) {
        // Check if client is still connected
        if (!client.isConnected) {
          logger.info('Client disconnected during streaming', { clientId });
          break;
        }

        // Token is already sent via onToken callback
        // This loop ensures we consume the entire stream
      }

      logger.info('LLM streaming completed', {
        clientId,
        tokenCount,
        responseLength: fullResponse.length,
      });

    } catch (error) {
      logger.error('LLM streaming failed', { clientId, error });
      
      if (client.isConnected) {
        this.sendEvent(clientId, 'stream_error', {
          error: error instanceof Error ? error.message : 'Unknown streaming error',
          timestamp: new Date().toISOString(),
        });
      }
      
      throw error;
    }
  }

  /**
   * Send SSE event to specific client
   */
  private sendEvent(clientId: string, eventType: string, data: any): void {
    const client = this.clients.get(clientId);
    if (!client || !client.isConnected) {
      return;
    }

    try {
      const eventData = JSON.stringify(data);
      const sseMessage = `event: ${eventType}\ndata: ${eventData}\n\n`;
      
      client.response.write(sseMessage);
      
      logger.debug('SSE event sent', { clientId, eventType, dataSize: eventData.length });
    } catch (error) {
      logger.error('Failed to send SSE event', { clientId, eventType, error });
      this.handleClientDisconnection(clientId);
    }
  }

  /**
   * Send heartbeat to keep connection alive
   */
  sendHeartbeat(clientId: string): void {
    this.sendEvent(clientId, 'heartbeat', {
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Handle client disconnection and cleanup
   */
  private handleClientDisconnection(clientId: string): void {
    const client = this.clients.get(clientId);
    if (!client) {
      return;
    }

    // Mark client as disconnected
    client.isConnected = false;

    // Cancel any active LLM requests for this client
    if (client.abortController) {
      client.abortController.abort();
    }

    // Remove from active streams
    const streamController = this.activeStreams.get(clientId);
    if (streamController) {
      streamController.abort();
      this.activeStreams.delete(clientId);
    }

    // Clean up client connection
    try {
      if (!client.response.destroyed) {
        client.response.end();
      }
    } catch (error) {
      logger.warn('Error closing client response', { clientId, error });
    }

    // Remove client from map
    this.clients.delete(clientId);

    logger.info('Client disconnected and cleaned up', { clientId });
  }

  /**
   * Disconnect specific client
   */
  disconnectClient(clientId: string): void {
    this.handleClientDisconnection(clientId);
  }

  /**
   * Disconnect all clients (for shutdown)
   */
  disconnectAllClients(): void {
    const clientIds = Array.from(this.clients.keys());
    clientIds.forEach(clientId => {
      this.handleClientDisconnection(clientId);
    });
    
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
   * Send custom event to client
   */
  sendCustomEvent(clientId: string, eventType: string, data: any): void {
    this.sendEvent(clientId, eventType, data);
  }

  /**
   * Broadcast event to all connected clients
   */
  broadcastEvent(eventType: string, data: any): void {
    const connectedClients = Array.from(this.clients.values()).filter(client => client.isConnected);
    
    connectedClients.forEach(client => {
      this.sendEvent(client.id, eventType, data);
    });

    logger.info('Event broadcasted to all clients', {
      eventType,
      clientCount: connectedClients.length,
    });
  }
}

// Export singleton instance
export const streamingService = new StreamingService();

// Graceful shutdown handler
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, disconnecting all streaming clients');
  streamingService.disconnectAllClients();
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, disconnecting all streaming clients');
  streamingService.disconnectAllClients();
});