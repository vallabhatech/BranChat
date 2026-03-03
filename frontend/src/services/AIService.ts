/**
 * AI Service - Frontend
 * 
 * Unified AI service using the provider abstraction pattern
 * Automatically selects the best available provider
 * Handles fallback logic transparently
 */

import { aiProviderFactory } from './providers/AIProviderFactory';
import { 
  AIProvider,
  AIMessage,
  AIResponse,
  AISummaryOptions,
  AIWriteOptions,
  AIStreamOptions,
  AISummaryResult
} from './types/ai-provider.interface';

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
      throw new Error('No AI provider available');
    }

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
      return await this.currentProvider.generateResponse(messages, options);
    } catch (error) {
      // Try fallback provider
      const fallbackProvider = await this.getFallbackProvider();
      if (fallbackProvider && fallbackProvider !== this.currentProvider) {
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
      // Try fallback provider
      const fallbackProvider = await this.getFallbackProvider();
      if (fallbackProvider && fallbackProvider !== this.currentProvider) {
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
      return await this.currentProvider.summarize(text, options);
    } catch (error) {
      // Try fallback provider
      const fallbackProvider = await this.getFallbackProvider();
      if (fallbackProvider && fallbackProvider !== this.currentProvider) {
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
      return await this.currentProvider.write(prompt, options);
    } catch (error) {
      // Try fallback provider
      const fallbackProvider = await this.getFallbackProvider();
      if (fallbackProvider && fallbackProvider !== this.currentProvider) {
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
      return await this.currentProvider.createEmbedding(text);
    } catch (error) {
      // Try fallback provider
      const fallbackProvider = await this.getFallbackProvider();
      if (fallbackProvider && 
          fallbackProvider !== this.currentProvider && 
          fallbackProvider.createEmbedding) {
        this.currentProvider = fallbackProvider;
        return await fallbackProvider.createEmbedding(text);
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
  }> {
    return await aiProviderFactory.getStatus();
  }

  /**
   * Switch to a specific provider
   */
  async switchProvider(providerName: string): Promise<boolean> {
    const provider = aiProviderFactory.getProviderByName(providerName);
    if (!provider) {
      return false;
    }

    const available = await provider.isAvailable();
    if (!available) {
      return false;
    }

    this.currentProvider = provider;
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
      this.currentProvider = await aiProviderFactory.getProvider();
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
  }
}

// Export singleton instance
export const aiService = new AIService();
