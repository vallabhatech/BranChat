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

    console.log('🤖 Chrome AI: Initializing...');

    // Check if Chrome AI is available
    if (!window.ai) {
      console.log('❌ Chrome AI: Not available (window.ai is undefined)');
      this.status.provider = 'server-fallback';
      this.initialized = true;
      return this.status;
    }

    try {
      // Check Prompt API (Language Model)
      const promptCapabilities = await window.ai.languageModel.capabilities();
      this.status.promptAPI = promptCapabilities.available !== 'no';
      console.log('🤖 Chrome AI: Prompt API -', this.status.promptAPI ? '✅ Available' : '❌ Not available');

      // Check Summarizer API
      const summarizerCapabilities = await window.ai.summarizer.capabilities();
      this.status.summarizerAPI = summarizerCapabilities.available !== 'no';
      console.log('🤖 Chrome AI: Summarizer API -', this.status.summarizerAPI ? '✅ Available' : '❌ Not available');

      // Check Writer API
      const writerCapabilities = await window.ai.writer.capabilities();
      this.status.writerAPI = writerCapabilities.available !== 'no';
      console.log('🤖 Chrome AI: Writer API -', this.status.writerAPI ? '✅ Available' : '❌ Not available');

      // Check Rewriter API
      const rewriterCapabilities = await window.ai.rewriter.capabilities();
      this.status.rewriterAPI = rewriterCapabilities.available !== 'no';
      console.log('🤖 Chrome AI: Rewriter API -', this.status.rewriterAPI ? '✅ Available' : '❌ Not available');

      // Determine provider
      if (this.status.promptAPI || this.status.summarizerAPI || this.status.writerAPI) {
        this.status.provider = 'chrome-builtin';
        console.log('✅ Chrome AI: Using Chrome Built-in AI');
      } else {
        this.status.provider = 'server-fallback';
        console.log('⚠️ Chrome AI: Falling back to server API');
      }
    } catch (error) {
      console.error('❌ Chrome AI: Error checking capabilities:', error);
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
      console.log('⚠️ Chrome AI: Prompt API not available, use server fallback');
      return null;
    }

    try {
      this.languageModel = await window.ai.languageModel.create({
        systemPrompt: systemPrompt || 'You are a helpful AI assistant for branching conversations.',
        temperature: 0.7,
      });
      console.log('✅ Chrome AI: Language model session created');
      return this.languageModel;
    } catch (error) {
      console.error('❌ Chrome AI: Failed to create language model:', error);
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

      console.log('🤖 Chrome AI: Generating response with Prompt API...');
      const response = await this.languageModel.prompt(prompt);
      console.log('✅ Chrome AI: Response generated');
      return response;
    } catch (error) {
      console.error('❌ Chrome AI: Error generating response:', error);
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

      console.log('🤖 Chrome AI: Starting streaming response...');
      const stream = this.languageModel.promptStreaming(prompt);
      const reader = stream.getReader();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = new TextDecoder().decode(value);
        onChunk(chunk);
      }

      console.log('✅ Chrome AI: Streaming complete');
      return true;
    } catch (error) {
      console.error('❌ Chrome AI: Error in streaming response:', error);
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
      console.log('🤖 Chrome AI: Creating summarizer...');
      const summarizer = await window.ai.summarizer.create({
        type: options?.type || 'key-points',
        format: 'markdown',
        length: options?.length || 'medium',
      });

      console.log('🤖 Chrome AI: Summarizing text...');
      const summary = await summarizer.summarize(text);
      summarizer.destroy();

      console.log('✅ Chrome AI: Summary generated');
      return summary;
    } catch (error) {
      console.error('❌ Chrome AI: Error summarizing:', error);
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
      console.log('🤖 Chrome AI: Creating writer...');
      const writer = await window.ai.writer.create({
        tone: options?.tone || 'neutral',
        format: 'markdown',
        length: options?.length || 'medium',
      });

      console.log('🤖 Chrome AI: Writing content...');
      const content = await writer.write(prompt);
      writer.destroy();

      console.log('✅ Chrome AI: Content generated');
      return content;
    } catch (error) {
      console.error('❌ Chrome AI: Error writing:', error);
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
      console.log('🤖 Chrome AI: Creating rewriter...');
      const rewriter = await window.ai.rewriter.create({
        tone: options?.tone || 'as-is',
        format: 'as-is',
        length: options?.length || 'as-is',
      });

      console.log('🤖 Chrome AI: Rewriting text...');
      const rewritten = await rewriter.rewrite(text);
      rewriter.destroy();

      console.log('✅ Chrome AI: Text rewritten');
      return rewritten;
    } catch (error) {
      console.error('❌ Chrome AI: Error rewriting:', error);
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
