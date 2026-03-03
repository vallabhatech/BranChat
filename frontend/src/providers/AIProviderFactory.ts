/**
 * AI Provider Factory - Frontend
 * 
 * Manages AI provider selection and fallback logic
 * Automatically detects Chrome Built-in AI availability
 * Falls back to server-side providers when needed
 */

import { ChromeAIProvider } from './ChromeAIProvider';
import { 
  AIProvider, 
  AIProviderConfig, 
  AIProviderFactory as IAIProviderFactory,
  AIMessage,
  AIResponse,
  AISummaryOptions,
  AIWriteOptions,
  AIStreamOptions,
  AISummaryResult
} from '../types/ai-provider.interface';

/**
 * Server-side provider interface for fallback
 */
interface ServerAIProvider {
  generateResponse(messages: AIMessage[], options?: any): Promise<AIResponse>;
  summarize(text: string, options?: AISummaryOptions): Promise<AISummaryResult>;
  write(prompt: string, options?: AIWriteOptions): Promise<string>;
}

/**
 * Server Provider Implementation
 * Communicates with backend for AI processing
 */
class ServerProvider implements AIProvider {
  readonly name = 'server-fallback';
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/health`);
      return response.ok;
    } catch {
      return false;
    }
  }

  async generateResponse(
    messages: AIMessage[],
    options: Record<string, any> = {}
  ): Promise<AIResponse> {
    const lastMessage = messages[messages.length - 1];
    
    const response = await fetch(`${this.baseUrl}/api/conversations/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        content: lastMessage.content,
        role: 'user',
        ...options
      }),
    });

    if (!response.ok) {
      throw new Error(`Server request failed: ${response.statusText}`);
    }

    const data = await response.json();
    return {
      content: data.data.assistantMessage.content,
      provider: this.name,
      model: data.data.assistantMessage.metadata?.model,
      metadata: {
        processedOnDevice: false,
        apiType: 'server-api'
      }
    };
  }

  async generateResponseStream(
    messages: AIMessage[],
    options: AIStreamOptions & Record<string, any> = {}
  ): Promise<AsyncIterable<string>> {
    // Server-side streaming implementation would go here
    // For now, fall back to non-streaming
    const response = await this.generateResponse(messages, options);
    
    return (async function* () {
      yield response.content;
      if (options.onComplete) {
        options.onComplete(response.content);
      }
    })();
  }

  async summarize(
    text: string,
    options: AISummaryOptions = {}
  ): Promise<AISummaryResult> {
    const response = await fetch(`${this.baseUrl}/api/summarize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
        ...options
      }),
    });

    if (!response.ok) {
      throw new Error(`Server request failed: ${response.statusText}`);
    }

    return await response.json();
  }

  async write(
    prompt: string,
    options: AIWriteOptions = {}
  ): Promise<string> {
    const response = await fetch(`${this.baseUrl}/api/write`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt,
        ...options
      }),
    });

    if (!response.ok) {
      throw new Error(`Server request failed: ${response.statusText}`);
    }

    const data = await response.json();
    return data.content;
  }
}

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
    // Register Chrome Built-in AI (highest priority)
    const chromeProvider = new ChromeAIProvider();
    this.register(chromeProvider, {
      name: chromeProvider.name,
      priority: 1,
      enabled: true
    });

    // Register Server Fallback (lowest priority)
    const serverProvider = new ServerProvider(this.getApiUrl());
    this.register(serverProvider, {
      name: serverProvider.name,
      priority: 10,
      enabled: true
    });
  }

  /**
   * Get API URL from environment
   */
  private getApiUrl(): string {
    return import.meta.env.VITE_API_URL || 'http://localhost:3001';
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
      availability[name] = await provider.isAvailable();
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
      selected: selectedProvider?.name || null
    };
  }
}

// Export singleton instance
export const aiProviderFactory = new AIProviderFactory();
