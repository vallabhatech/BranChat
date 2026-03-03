/**
 * AI Provider Interface
 * 
 * Unified interface for all AI providers (Chrome Built-in AI, Gemini, OpenAI, etc.)
 * Follows the Open/Closed Principle for easy extensibility
 */

export interface AIMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: string;
  metadata?: Record<string, any>;
}

export interface AIResponse {
  content: string;
  provider: string;
  model?: string;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
  metadata?: Record<string, any>;
}

export interface AISummaryOptions {
  type?: 'key-points' | 'tl;dr' | 'teaser' | 'headline';
  length?: 'short' | 'medium' | 'long';
  format?: 'markdown' | 'plain';
}

export interface AIWriteOptions {
  tone?: 'formal' | 'neutral' | 'casual';
  length?: 'short' | 'medium' | 'long';
  format?: 'markdown' | 'plain';
}

export interface AIStreamOptions {
  onToken?: (token: string) => void;
  onComplete?: (fullResponse: string) => void;
  onError?: (error: Error) => void;
}

export interface AISummaryResult {
  summary: string;
  actions: string[];
  artifacts: string[];
  keywords: string[];
  fullSummary?: string;
}

/**
 * Core AI Provider Interface
 * All AI providers must implement these methods
 */
export interface AIProvider {
  /**
   * Provider name for identification
   */
  readonly name: string;

  /**
   * Check if the provider is available and ready
   */
  isAvailable(): Promise<boolean>;

  /**
   * Generate a response for the given messages
   */
  generateResponse(
    messages: AIMessage[],
    options?: Record<string, any>
  ): Promise<AIResponse>;

  /**
   * Generate a streaming response
   */
  generateResponseStream(
    messages: AIMessage[],
    options?: AIStreamOptions & Record<string, any>
  ): Promise<AsyncIterable<string>>;

  /**
   * Summarize text content
   */
  summarize(
    text: string,
    options?: AISummaryOptions
  ): Promise<AISummaryResult>;

  /**
   * Generate written content
   */
  write(
    prompt: string,
    options?: AIWriteOptions
  ): Promise<string>;

  /**
   * Optional: Create embeddings for semantic search
   */
  createEmbedding?(text: string): Promise<number[]>;

  /**
   * Optional: Cleanup resources
   */
  cleanup?(): Promise<void>;
}

/**
 * Provider Configuration Interface
 */
export interface AIProviderConfig {
  name: string;
  priority: number; // Lower number = higher priority
  enabled: boolean;
  settings?: Record<string, any>;
}

/**
 * Provider Factory Interface
 */
export interface AIProviderFactory {
  /**
   * Register a new provider
   */
  register(provider: AIProvider, config: AIProviderConfig): void;

  /**
   * Get the best available provider
   */
  getProvider(): Promise<AIProvider | null>;

  /**
   * Get a specific provider by name
   */
  getProviderByName(name: string): AIProvider | null;

  /**
   * Get all available providers
   */
  getAvailableProviders(): Promise<AIProvider[]>;

  /**
   * Check provider availability
   */
  checkAvailability(): Promise<Record<string, boolean>>;
}
