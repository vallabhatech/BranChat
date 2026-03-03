/**
 * AI Service - Backend
 * 
 * Unified AI service using the provider abstraction pattern
 * Automatically selects the best available provider
 * Handles fallback logic transparently
 */

import { aiProviderFactory } from '../providers/AIProviderFactory';
import { logger } from '../utils/logger';
import { 
  AIProvider,
  AIMessage,
  AIResponse,
  AISummaryOptions,
  AIWriteOptions,
  AIStreamOptions,
  AISummaryResult
} from '../types/ai-provider.interface';

/**
 * AI Service Class
 * Provides a unified interface for all AI operations
 */
export class AIService {
  private currentProvider: AIProvider | null = null;
  private initialized = false;

  /**
   * Initialize the AI service
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    // Get the best available provider
    this.currentProvider = await aiProviderFactory.getProvider();
    
    if (!this.currentProvider) {
      logger.warn('No AI provider available');
      return;
    }

    logger.info(`AI Service initialized with provider: ${this.currentProvider.name}`);
    this.initialized = true;
  }

  /**
   * Get current provider information
   */
  async getProviderInfo(): Promise<{
    name: string;
    available: boolean;
  } | null> {
    if (!this.currentProvider) {
      await this.initialize();
    }

    if (!this.currentProvider) {
      return null;
    }

    return {
      name: this.currentProvider.name,
      available: await this.currentProvider.isAvailable()
    };
  }

  /**
   * Generate a response using the best available provider
   */
  async generateResponse(
    messages: AIMessage[],
    options: Record<string, any> = {}
  ): Promise<AIResponse> {
    await this.ensureProvider();

    if (!this.currentProvider) {
      throw new Error('No AI provider available');
    }

    try {
      const response = await this.currentProvider.generateResponse(messages, options);
      
      logger.info('AI response generated', {
        provider: this.currentProvider.name,
        model: response.model,
        usage: response.usage
      });

      return response;
    } catch (error) {
      logger.error('AI response generation failed', { 
        provider: this.currentProvider.name, 
        error 
      });

      // Try fallback provider
      const fallbackProvider = await this.getFallbackProvider();
      if (fallbackProvider && fallbackProvider !== this.currentProvider) {
        logger.info(`Switching to fallback provider: ${fallbackProvider.name}`);
        this.currentProvider = fallbackProvider;
        return await fallbackProvider.generateResponse(messages, options);
      }
      throw error;
    }
  }

  /**
   * Generate a streaming response
   */
  async generateResponseStream(
    messages: AIMessage[],
    options: AIStreamOptions & Record<string, any> = {}
  ): Promise<AsyncIterable<string>> {
    await this.ensureProvider();

    if (!this.currentProvider) {
      throw new Error('No AI provider available');
    }

    try {
      return await this.currentProvider.generateResponseStream(messages, options);
    } catch (error) {
      logger.error('AI streaming response failed', { 
        provider: this.currentProvider.name, 
        error 
      });

      // Try fallback provider
      const fallbackProvider = await this.getFallbackProvider();
      if (fallbackProvider && fallbackProvider !== this.currentProvider) {
        logger.info(`Switching to fallback provider for streaming: ${fallbackProvider.name}`);
        this.currentProvider = fallbackProvider;
        return await fallbackProvider.generateResponseStream(messages, options);
      }
      throw error;
    }
  }

  /**
   * Summarize text content
   */
  async summarize(
    text: string,
    options: AISummaryOptions = {}
  ): Promise<AISummaryResult> {
    await this.ensureProvider();

    if (!this.currentProvider) {
      throw new Error('No AI provider available');
    }

    try {
      const result = await this.currentProvider.summarize(text, options);
      
      logger.info('Text summarization completed', {
        provider: this.currentProvider.name,
        summaryLength: result.summary.length,
        keywordsCount: result.keywords.length
      });

      return result;
    } catch (error) {
      logger.error('Text summarization failed', { 
        provider: this.currentProvider.name, 
        error 
      });

      // Try fallback provider
      const fallbackProvider = await this.getFallbackProvider();
      if (fallbackProvider && fallbackProvider !== this.currentProvider) {
        logger.info(`Switching to fallback provider for summarization: ${fallbackProvider.name}`);
        this.currentProvider = fallbackProvider;
        return await fallbackProvider.summarize(text, options);
      }
      throw error;
    }
  }

  /**
   * Generate written content
   */
  async write(
    prompt: string,
    options: AIWriteOptions = {}
  ): Promise<string> {
    await this.ensureProvider();

    if (!this.currentProvider) {
      throw new Error('No AI provider available');
    }

    try {
      const result = await this.currentProvider.write(prompt, options);
      
      logger.info('Content generation completed', {
        provider: this.currentProvider.name,
        contentLength: result.length
      });

      return result;
    } catch (error) {
      logger.error('Content generation failed', { 
        provider: this.currentProvider.name, 
        error 
      });

      // Try fallback provider
      const fallbackProvider = await this.getFallbackProvider();
      if (fallbackProvider && fallbackProvider !== this.currentProvider) {
        logger.info(`Switching to fallback provider for writing: ${fallbackProvider.name}`);
        this.currentProvider = fallbackProvider;
        return await fallbackProvider.write(prompt, options);
      }
      throw error;
    }
  }

  /**
   * Create embeddings (if supported)
   */
  async createEmbedding(text: string): Promise<number[]> {
    await this.ensureProvider();

    if (!this.currentProvider) {
      throw new Error('No AI provider available');
    }

    if (!this.currentProvider.createEmbedding) {
      throw new Error('Current provider does not support embeddings');
    }

    try {
      const result = await this.currentProvider.createEmbedding!(text);
      
      logger.info('Embedding creation completed', {
        provider: this.currentProvider.name,
        inputLength: text.length,
        embeddingDimensions: result.length
      });

      return result;
    } catch (error) {
      logger.error('Embedding creation failed', { 
        provider: this.currentProvider.name, 
        error 
      });

      // Try fallback provider
      const fallbackProvider = await this.getFallbackProvider();
      if (fallbackProvider && 
          fallbackProvider !== this.currentProvider && 
          fallbackProvider.createEmbedding) {
        logger.info(`Switching to fallback provider for embeddings: ${fallbackProvider.name}`);
        this.currentProvider = fallbackProvider;
        return await fallbackProvider.createEmbedding!(text);
      }
      throw error;
    }
  }

  /**
   * Get status of all providers
   */
  async getStatus(): Promise<{
    available: string[];
    unavailable: string[];
    selected: string | null;
    total: number;
  }> {
    return await aiProviderFactory.getStatus();
  }

  /**
   * Switch to a specific provider
   */
  async switchProvider(providerName: string): Promise<boolean> {
    const provider = aiProviderFactory.getProviderByName(providerName);
    if (!provider) {
      logger.warn(`Provider not found: ${providerName}`);
      return false;
    }

    const available = await provider.isAvailable();
    if (!available) {
      logger.warn(`Provider not available: ${providerName}`);
      return false;
    }

    this.currentProvider = provider;
    logger.info(`Switched to provider: ${providerName}`);
    return true;
  }

  /**
   * Ensure we have an available provider
   */
  private async ensureProvider(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }

    // Check if current provider is still available
    if (this.currentProvider && !(await this.currentProvider.isAvailable())) {
      logger.warn(`Current provider ${this.currentProvider.name} is no longer available`);
      this.currentProvider = await aiProviderFactory.getProvider();
      
      if (this.currentProvider) {
        logger.info(`Switched to new provider: ${this.currentProvider.name}`);
      }
    }
  }

  /**
   * Get a fallback provider
   */
  private async getFallbackProvider(): Promise<AIProvider | null> {
    const availableProviders = await aiProviderFactory.getAvailableProviders();
    
    // Return the first available provider that's not the current one
    for (const provider of availableProviders) {
      if (provider !== this.currentProvider) {
        return provider;
      }
    }

    return null;
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    if (this.currentProvider && this.currentProvider.cleanup) {
      await this.currentProvider.cleanup();
    }

    await aiProviderFactory.cleanup();
  }
}

// Export singleton instance
export const aiService = new AIService();
