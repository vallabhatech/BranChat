/**
 * Chrome Built-in AI Service
 * Provides access to Chrome's built-in AI APIs with fallback support
 * For Google Chrome Built-in AI Challenge 2025
 */

export type AIProvider = 'chrome-builtin' | 'server-fallback' | 'unavailable';

interface ChromeAIStatus {
  promptAPI: boolean;
  summarizerAPI: boolean;
  writerAPI: boolean;
  rewriterAPI: boolean;
  provider: AIProvider;
}

class ChromeAIService {
  private status: ChromeAIStatus = {
    promptAPI: false,
    summarizerAPI: false,
    writerAPI: false,
    rewriterAPI: false,
    provider: 'unavailable',
  };

  private initialized = false;
  private languageModel: any | null = null;

  /**
   * Initialize and check Chrome AI availability
   */
  async initialize(): Promise<ChromeAIStatus> {
    if (this.initialized) {
      return this.status;
    }

    // Check if Chrome AI is available
    if (!window.ai) {
      this.status.provider = 'server-fallback';
      this.initialized = true;
      return this.status;
    }

    try {
      // Check Prompt API (Language Model)
      const promptCapabilities = await window.ai.languageModel.capabilities();
      this.status.promptAPI = promptCapabilities.available !== 'no';

      // Check Summarizer API
      const summarizerCapabilities = await window.ai.summarizer.capabilities();
      this.status.summarizerAPI = summarizerCapabilities.available !== 'no';

      // Check Writer API
      const writerCapabilities = await window.ai.writer.capabilities();
      this.status.writerAPI = writerCapabilities.available !== 'no';

      // Check Rewriter API
      const rewriterCapabilities = await window.ai.rewriter.capabilities();
      this.status.rewriterAPI = rewriterCapabilities.available !== 'no';

      // Determine provider
      if (this.status.promptAPI || this.status.summarizerAPI || this.status.writerAPI) {
        this.status.provider = 'chrome-builtin';
      } else {
        this.status.provider = 'server-fallback';
      }
    } catch (error) {
      this.status.provider = 'server-fallback';
    }

    this.initialized = true;
    return this.status;
  }

  /**
   * Get current AI status
   */
  getStatus(): ChromeAIStatus {
    return { ...this.status };
  }

  /**
   * Create a language model session for conversations
   */
  async createSession(systemPrompt?: string): Promise<any | null> {
    if (!this.status.promptAPI || !window.ai) {
      return null;
    }

    try {
      this.languageModel = await window.ai.languageModel.create({
        systemPrompt: systemPrompt || 'You are a helpful AI assistant for branching conversations.',
        temperature: 0.7,
      });
      return this.languageModel;
    } catch (error) {
      return null;
    }
  }

  /**
   * Generate a response using Chrome's Prompt API
   */
  async generateResponse(prompt: string, systemPrompt?: string): Promise<string | null> {
    if (!this.status.promptAPI || !window.ai) {
      return null;
    }

    try {
      // Create a new session if needed
      if (!this.languageModel) {
        await this.createSession(systemPrompt);
      }

      if (!this.languageModel) {
        return null;
      }

      const response = await this.languageModel.prompt(prompt);
      return response;
    } catch (error) {
      return null;
    }
  }

  /**
   * Generate a streaming response using Chrome's Prompt API
   */
  async generateStreamingResponse(
    prompt: string,
    onChunk: (chunk: string) => void,
    systemPrompt?: string
  ): Promise<boolean> {
    if (!this.status.promptAPI || !window.ai) {
      return false;
    }

    try {
      // Create a new session if needed
      if (!this.languageModel) {
        await this.createSession(systemPrompt);
      }

      if (!this.languageModel) {
        return false;
      }

      const stream = this.languageModel.promptStreaming(prompt);
      const reader = stream.getReader();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = new TextDecoder().decode(value);
        onChunk(chunk);
      }

      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Summarize text using Chrome's Summarizer API
   */
  async summarize(
    text: string,
    options?: {
      type?: 'tl;dr' | 'key-points' | 'teaser' | 'headline';
      length?: 'short' | 'medium' | 'long';
    }
  ): Promise<string | null> {
    if (!this.status.summarizerAPI || !window.ai) {
      return null;
    }

    try {
      const summarizer = await window.ai.summarizer.create({
        type: options?.type || 'key-points',
        format: 'markdown',
        length: options?.length || 'medium',
      });

      const summary = await summarizer.summarize(text);
      summarizer.destroy();

      return summary;
    } catch (error) {
      return null;
    }
  }

  /**
   * Generate text using Chrome's Writer API
   */
  async write(
    prompt: string,
    options?: {
      tone?: 'formal' | 'neutral' | 'casual';
      length?: 'short' | 'medium' | 'long';
    }
  ): Promise<string | null> {
    if (!this.status.writerAPI || !window.ai) {
      return null;
    }

    try {
      const writer = await window.ai.writer.create({
        tone: options?.tone || 'neutral',
        format: 'markdown',
        length: options?.length || 'medium',
      });

      const content = await writer.write(prompt);
      writer.destroy();

      return content;
    } catch (error) {
      return null;
    }
  }

  /**
   * Rewrite text using Chrome's Rewriter API
   */
  async rewrite(
    text: string,
    options?: {
      tone?: 'as-is' | 'more-formal' | 'more-casual';
      length?: 'as-is' | 'shorter' | 'longer';
    }
  ): Promise<string | null> {
    if (!this.status.rewriterAPI || !window.ai) {
      return null;
    }

    try {
      const rewriter = await window.ai.rewriter.create({
        tone: options?.tone || 'as-is',
        format: 'as-is',
        length: options?.length || 'as-is',
      });

      const rewritten = await rewriter.rewrite(text);
      rewriter.destroy();

      return rewritten;
    } catch (error) {
      return null;
    }
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.languageModel) {
      this.languageModel.destroy();
      this.languageModel = null;
    }
  }
}

// Export singleton instance
export const chromeAI = new ChromeAIService();
