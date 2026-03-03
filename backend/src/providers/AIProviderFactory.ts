/**
 * AI Provider Factory - Backend
 * 
 * Manages server-side AI provider selection and configuration
 * Supports multiple providers with automatic fallback
 */

import { GeminiProvider } from './GeminiProvider';
import { 
  AIProvider, 
  AIProviderConfig, 
  AIProviderFactory as IAIProviderFactory
} from '../types/ai-provider.interface';

/**
 * AI Provider Factory Implementation
 */
export class AIProviderFactory implements IAIProviderFactory {
  private providers = new Map<string, AIProvider>();
  private configs = new Map<string, AIProviderConfig>();
  private initialized = false;

  constructor() {
    this.registerDefaultProviders();
  }

  /**
   * Register default providers
   */
  private registerDefaultProviders(): void {
    // Register Gemini (primary server-side provider)
    try {
      const geminiProvider = new GeminiProvider();
      this.register(geminiProvider, {
        name: geminiProvider.name,
        priority: 1,
        enabled: true,
        settings: {
          model: process.env.GEMINI_MODEL,
          temperature: parseFloat(process.env.TEMPERATURE || '0.7'),
          maxTokens: parseInt(process.env.MAX_TOKENS || '2000')
        }
      });
    } catch (error) {
      console.warn('Failed to initialize Gemini provider:', error);
    }
  }

  /**
   * Register a new provider
   */
  register(provider: AIProvider, config: AIProviderConfig): void {
    this.providers.set(config.name, provider);
    this.configs.set(config.name, config);
  }

  /**
   * Get the best available provider
   */
  async getProvider(): Promise<AIProvider | null> {
    if (!this.initialized) {
      await this.initializeProviders();
    }

    // Sort providers by priority (lower number = higher priority)
    const sortedConfigs = Array.from(this.configs.entries())
      .filter(([_, config]) => config.enabled)
      .sort(([, a], [, b]) => a.priority - b.priority);

    // Find the first available provider
    for (const [name, config] of sortedConfigs) {
      const provider = this.providers.get(name);
      if (provider && await provider.isAvailable()) {
        return provider;
      }
    }

    return null;
  }

  /**
   * Get a specific provider by name
   */
  getProviderByName(name: string): AIProvider | null {
    return this.providers.get(name) || null;
  }

  /**
   * Get all available providers
   */
  async getAvailableProviders(): Promise<AIProvider[]> {
    if (!this.initialized) {
      await this.initializeProviders();
    }

    const available: AIProvider[] = [];
    
    for (const [name, provider] of this.providers) {
      const config = this.configs.get(name);
      if (config?.enabled && await provider.isAvailable()) {
        available.push(provider);
      }
    }

    return available;
  }

  /**
   * Check provider availability
   */
  async checkAvailability(): Promise<Record<string, boolean>> {
    if (!this.initialized) {
      await this.initializeProviders();
    }

    const availability: Record<string, boolean> = {};
    
    for (const [name, provider] of this.providers) {
      try {
        availability[name] = await provider.isAvailable();
      } catch (error) {
        availability[name] = false;
      }
    }

    return availability;
  }

  /**
   * Initialize all providers
   */
  private async initializeProviders(): Promise<void> {
    // Check availability of all providers
    const availability = await this.checkAvailability();
    
    // Disable providers that are not available
    for (const [name, available] of Object.entries(availability)) {
      const config = this.configs.get(name);
      if (config && !available) {
        config.enabled = false;
      }
    }

    this.initialized = true;
  }

  /**
   * Get provider status information
   */
  async getStatus(): Promise<{
    available: string[];
    unavailable: string[];
    selected: string | null;
    total: number;
  }> {
    const availability = await this.checkAvailability();
    const available = Object.entries(availability)
      .filter(([_, available]) => available)
      .map(([name, _]) => name);
    
    const unavailable = Object.entries(availability)
      .filter(([_, available]) => !available)
      .map(([name, _]) => name);

    const selectedProvider = await this.getProvider();

    return {
      available,
      unavailable,
      selected: selectedProvider?.name || null,
      total: this.providers.size
    };
  }

  /**
   * Register additional providers (for future extensibility)
   */
  registerProvider(name: string, providerClass: new () => AIProvider, config: AIProviderConfig): void {
    try {
      const provider = new providerClass();
      this.register(provider, config);
    } catch (error) {
      console.error(`Failed to register provider ${name}:`, error);
    }
  }

  /**
   * Cleanup all providers
   */
  async cleanup(): Promise<void> {
    for (const provider of this.providers.values()) {
      if (provider.cleanup) {
        try {
          await provider.cleanup();
        } catch (error) {
          console.error(`Error cleaning up provider ${provider.name}:`, error);
        }
      }
    }
  }
}

// Export singleton instance
export const aiProviderFactory = new AIProviderFactory();
