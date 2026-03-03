/**
 * Chrome Built-in AI Provider
 * 
 * Implements AIProvider interface for Chrome's native AI APIs
 * Provides client-side, privacy-first AI processing
 */

import { 
  AIProvider, 
  AIMessage, 
  AIResponse, 
  AISummaryOptions, 
  AIWriteOptions, 
  AIStreamOptions,
  AISummaryResult
} from '../types/ai-provider.interface';

interface ChromeAICapabilities {
  promptAPI: boolean;
  summarizerAPI: boolean;
  writerAPI: boolean;
  rewriterAPI: boolean;
}

export class ChromeAIProvider implements AIProvider {
  readonly name = 'chrome-builtin';
  
  private capabilities: ChromeAICapabilities = {
    promptAPI: false,
    summarizerAPI: false,
    writerAPI: false,
    rewriterAPI: false,
  };
  
  private initialized = false;
  private languageModel: any = null;

  /**
   * Initialize and check Chrome AI availability
   */
  private async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    // Check if Chrome AI is available
    if (!window.ai) {
      this.initialized = true;
      return;
    }

    try {
      // Check Prompt API (Language Model)
      const promptCapabilities = await window.ai.languageModel.capabilities();
      this.capabilities.promptAPI = promptCapabilities.available !== 'no';

      // Check Summarizer API
      const summarizerCapabilities = await window.ai.summarizer.capabilities();
      this.capabilities.summarizerAPI = summarizerCapabilities.available !== 'no';

      // Check Writer API
      const writerCapabilities = await window.ai.writer.capabilities();
      this.capabilities.writerAPI = writerCapabilities.available !== 'no';

      // Check Rewriter API
      const rewriterCapabilities = await window.ai.rewriter.capabilities();
      this.capabilities.rewriterAPI = rewriterCapabilities.available !== 'no';
    } catch (error) {
      // Chrome AI not available, will use fallback
    }

    this.initialized = true;
  }

  /**
   * Check if the provider is available
   */
  async isAvailable(): Promise<boolean> {
    await this.initialize();
    return this.capabilities.promptAPI || this.capabilities.summarizerAPI || this.capabilities.writerAPI;
  }

  /**
   * Generate a response using Chrome's Prompt API
   */
  async generateResponse(
    messages: AIMessage[],
    options: Record<string, any> = {}
  ): Promise<AIResponse> {
    await this.initialize();

    if (!this.capabilities.promptAPI || !window.ai) {
      throw new Error('Chrome Prompt API not available');
    }

    try {
      // Create a new session if needed
      if (!this.languageModel) {
        this.languageModel = await window.ai.languageModel.create({
          systemPrompt: options.systemPrompt || 'You are a helpful AI assistant for branching conversations.',
          temperature: options.temperature || 0.7,
        });
      }

      // Use the last message as the prompt
      const lastMessage = messages[messages.length - 1];
      const response = await this.languageModel.prompt(lastMessage.content);

      return {
        content: response,
        provider: this.name,
        model: 'gemini-nano',
        metadata: {
          processedOnDevice: true,
          apiType: 'prompt-api'
        }
      };
    } catch (error) {
      throw new Error(`Chrome AI response generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate a streaming response
   */
  async generateResponseStream(
    messages: AIMessage[],
    options: AIStreamOptions & Record<string, any> = {}
  ): Promise<AsyncIterable<string>> {
    await this.initialize();

    if (!this.capabilities.promptAPI || !window.ai) {
      throw new Error('Chrome Prompt API not available');
    }

    const self = this;
    
    return (async function* () {
      try {
        // Create a new session if needed
        if (!self.languageModel) {
          self.languageModel = await window.ai.languageModel.create({
            systemPrompt: options.systemPrompt || 'You are a helpful AI assistant for branching conversations.',
            temperature: options.temperature || 0.7,
          });
        }

        const lastMessage = messages[messages.length - 1];
        const stream = self.languageModel.promptStreaming(lastMessage.content);
        const reader = stream.getReader();

        let fullResponse = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = new TextDecoder().decode(value);
          fullResponse += chunk;
          
          if (options.onToken) {
            options.onToken(chunk);
          }
          
          yield chunk;
        }

        if (options.onComplete) {
          options.onComplete(fullResponse);
        }
      } catch (error) {
        if (options.onError) {
          options.onError(error instanceof Error ? error : new Error('Unknown streaming error'));
        }
        throw new Error(`Chrome AI streaming failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    })();
  }

  /**
   * Summarize text using Chrome's Summarizer API
   */
  async summarize(
    text: string,
    options: AISummaryOptions = {}
  ): Promise<AISummaryResult> {
    await this.initialize();

    if (!this.capabilities.summarizerAPI || !window.ai) {
      throw new Error('Chrome Summarizer API not available');
    }

    try {
      const summarizer = await window.ai.summarizer.create({
        type: options.type || 'key-points',
        format: (options.format === 'markdown') ? 'markdown' : 'plain-text',
        length: options.length || 'medium',
      });

      const summary = await summarizer.summarize(text);
      summarizer.destroy();

      // Parse the summary to extract structured information
      return this.parseSummaryResult(summary, text);
    } catch (error) {
      throw new Error(`Chrome AI summarization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate text using Chrome's Writer API
   */
  async write(
    prompt: string,
    options: AIWriteOptions = {}
  ): Promise<string> {
    await this.initialize();

    if (!this.capabilities.writerAPI || !window.ai) {
      throw new Error('Chrome Writer API not available');
    }

    try {
      const writer = await window.ai.writer.create({
        tone: options.tone || 'neutral',
        format: (options.format === 'markdown') ? 'markdown' : 'plain-text',
        length: options.length || 'medium',
      });

      const content = await writer.write(prompt);
      writer.destroy();

      return content;
    } catch (error) {
      throw new Error(`Chrome AI writing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create embeddings (not supported by Chrome Built-in AI)
   */
  async createEmbedding(text: string): Promise<number[]> {
    // Chrome Built-in AI doesn't support embeddings
    throw new Error('Embeddings not supported by Chrome Built-in AI provider');
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    if (this.languageModel) {
      this.languageModel.destroy();
      this.languageModel = null;
    }
  }

  /**
   * Get current capabilities
   */
  getCapabilities(): ChromeAICapabilities {
    return { ...this.capabilities };
  }

  /**
   * Parse summary result into structured format
   */
  private parseSummaryResult(summary: string, originalText: string): AISummaryResult {
    // Try to extract structured information from the summary
    const lines = summary.split('\n').filter(line => line.trim());
    const keywords: string[] = [];
    const actions: string[] = [];
    const artifacts: string[] = [];

    // Extract keywords (simple heuristic)
    const words = originalText.toLowerCase().split(/\s+/);
    const commonWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by']);
    words.forEach(word => {
      if (word.length > 4 && !commonWords.has(word) && keywords.length < 10) {
        keywords.push(word);
      }
    });

    return {
      summary,
      actions,
      artifacts,
      keywords: [...new Set(keywords)], // Remove duplicates
      fullSummary: summary
    };
  }
}
