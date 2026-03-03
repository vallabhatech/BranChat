/**
 * Gemini AI Provider
 * 
 * Implements AIProvider interface for Google's Gemini API
 * Provides server-side AI processing as fallback
 */

import { GoogleGenerativeAI, GenerativeModel, Content } from '@google/generative-ai';
import { config } from '../config/environment';
import { logger } from '../utils/logger';
import { metricsService } from './metrics.service';
import { 
  AIProvider, 
  AIMessage, 
  AIResponse, 
  AISummaryOptions, 
  AIWriteOptions, 
  AIStreamOptions,
  AISummaryResult
} from '../types/ai-provider.interface';

export class GeminiProvider implements AIProvider {
  readonly name = 'gemini';
  
  private client: GoogleGenerativeAI;
  private model: GenerativeModel;
  private embeddingModel: GenerativeModel;
  private defaultMaxTokens: number;
  private defaultTemperature: number;

  constructor() {
    if (!config.gemini.apiKey) {
      throw new Error('Gemini API key is required');
    }

    this.client = new GoogleGenerativeAI(config.gemini.apiKey);
    this.model = this.client.getGenerativeModel({ 
      model: config.gemini.model,
      generationConfig: {
        maxOutputTokens: config.gemini.maxTokens,
        temperature: config.gemini.temperature,
      }
    });
    this.embeddingModel = this.client.getGenerativeModel({ 
      model: config.gemini.embeddingModel 
    });
    this.defaultMaxTokens = config.gemini.maxTokens;
    this.defaultTemperature = config.gemini.temperature;
  }

  /**
   * Check if the provider is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      // Test with a simple request
      await this.model.generateContent('test');
      return true;
    } catch (error) {
      logger.warn('Gemini provider not available', { error });
      return false;
    }
  }

  /**
   * Generate a response using Gemini API
   */
  async generateResponse(
    messages: AIMessage[],
    options: Record<string, any> = {}
  ): Promise<AIResponse> {
    try {
      const geminiMessages = this.convertMessagesToGemini(messages);
      
      // For single message, use generateContent
      if (geminiMessages.length === 1) {
        const messageText = geminiMessages[0].parts[0].text;
        if (!messageText) {
          throw new Error('Empty message content');
        }
        
        const result = await this.model.generateContent(messageText);
        const response = await result.response;
        const content = response.text();

        if (!content) {
          throw new Error('No content received from Gemini');
        }

        // Log estimated token usage
        const estimatedTokens = Math.ceil((messages[0].content.length + content.length) / 4);
        this.logTokenUsage(estimatedTokens, 'chat');

        return {
          content,
          provider: this.name,
          model: config.gemini.model,
          usage: {
            totalTokens: estimatedTokens,
          },
          metadata: {
            processedOnDevice: false,
            apiType: 'gemini-api'
          }
        };
      }

      // For conversation, use startChat
      const chat = this.model.startChat({
        history: geminiMessages.slice(0, -1),
      });

      const lastMessage = geminiMessages[geminiMessages.length - 1];
      const messageText = lastMessage.parts[0].text;
      if (!messageText) {
        throw new Error('Empty message content');
      }
      
      const result = await chat.sendMessage(messageText);
      const response = await result.response;
      const content = response.text();

      if (!content) {
        throw new Error('No content received from Gemini');
      }

      // Log estimated token usage
      const totalInputLength = messages.reduce((sum, msg) => sum + msg.content.length, 0);
      const estimatedTokens = Math.ceil((totalInputLength + content.length) / 4);
      this.logTokenUsage(estimatedTokens, 'chat');

      return {
        content,
        provider: this.name,
        model: config.gemini.model,
        usage: {
          totalTokens: estimatedTokens,
        },
        metadata: {
          processedOnDevice: false,
          apiType: 'gemini-api'
        }
      };
    } catch (error) {
      logger.error('Gemini chat completion failed', { error });
      throw new Error(`Gemini chat completion failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate a streaming response
   */
  async generateResponseStream(
    messages: AIMessage[],
    options: AIStreamOptions & Record<string, any> = {}
  ): Promise<AsyncIterable<string>> {
    const self = this;
    
    return (async function* () {
      try {
        const geminiMessages = self.convertMessagesToGemini(messages);
        let result;

        if (geminiMessages.length === 1) {
          const messageText = geminiMessages[0].parts[0].text;
          if (!messageText) {
            throw new Error('Empty message content');
          }
          result = await self.model.generateContentStream(messageText);
        } else {
          const chat = self.model.startChat({
            history: geminiMessages.slice(0, -1),
          });
          const lastMessage = geminiMessages[geminiMessages.length - 1];
          const messageText = lastMessage.parts[0].text;
          if (!messageText) {
            throw new Error('Empty message content');
          }
          result = await chat.sendMessageStream(messageText);
        }

        let fullResponse = '';

        for await (const chunk of result.stream) {
          const chunkText = chunk.text();
          if (chunkText) {
            fullResponse += chunkText;
            
            if (options.onToken) {
              options.onToken(chunkText);
            }
            
            yield chunkText;
          }
        }

        if (options.onComplete) {
          options.onComplete(fullResponse);
        }

        // Log estimated token usage
        const totalInputLength = messages.reduce((sum, msg) => sum + msg.content.length, 0);
        const estimatedTokens = Math.ceil((totalInputLength + fullResponse.length) / 4);
        self.logTokenUsage(estimatedTokens, 'chat');

      } catch (error) {
        logger.error('Gemini streaming completion failed', { error });
        
        if (options.onError) {
          options.onError(error instanceof Error ? error : new Error('Unknown streaming error'));
        }
        
        throw new Error(`Gemini streaming completion failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    })();
  }

  /**
   * Summarize text using Gemini API
   */
  async summarize(
    text: string,
    options: AISummaryOptions = {}
  ): Promise<AISummaryResult> {
    const prompt = `Please analyze the following conversation transcript and provide a structured summary in JSON format with the following fields:
- summary: A concise overview of main discussion points and outcomes
- actions: An array of specific action items or decisions made
- artifacts: An array of any code, documents, or deliverables mentioned or created
- keywords: An array of important keywords and topics for future reference

Transcript:
${text}

Please respond with valid JSON only:`;

    try {
      const response = await this.generateResponse([
        { role: 'system', content: 'You are a helpful assistant that creates structured summaries of conversations. Always respond with valid JSON.' },
        { role: 'user', content: prompt }
      ], {
        temperature: 0.3,
        maxTokens: 1000,
      });

      try {
        const parsed = JSON.parse(response.content) as AISummaryResult;
        
        if (!parsed.summary || !Array.isArray(parsed.actions) || 
            !Array.isArray(parsed.artifacts) || !Array.isArray(parsed.keywords)) {
          throw new Error('Invalid summary structure');
        }

        const estimatedTokens = Math.ceil((text.length + response.content.length) / 4);
        this.logTokenUsage(estimatedTokens, 'summarize');

        return {
          ...parsed,
          fullSummary: response.content
        };
      } catch (parseError) {
        logger.warn('Failed to parse JSON summary, attempting fallback', { parseError, response: response.content });
        
        return {
          summary: response.content.substring(0, 500),
          actions: [],
          artifacts: [],
          keywords: this.extractKeywords(response.content),
          fullSummary: response.content
        };
      }
    } catch (error) {
      logger.error('Text summarization failed', { error });
      throw new Error(`Text summarization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate written content using Gemini API
   */
  async write(
    prompt: string,
    options: AIWriteOptions = {}
  ): Promise<string> {
    const systemPrompt = `You are a helpful content writer. Generate content that is ${options.tone || 'neutral'} in tone and ${options.length || 'medium'} in length.`;

    try {
      const response = await this.generateResponse([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ], {
        temperature: 0.7,
        maxTokens: this.defaultMaxTokens,
      });

      const estimatedTokens = Math.ceil((prompt.length + response.content.length) / 4);
      this.logTokenUsage(estimatedTokens, 'write');

      return response.content;
    } catch (error) {
      logger.error('Content generation failed', { error });
      throw new Error(`Content generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create embeddings using Gemini API
   */
  async createEmbedding(text: string): Promise<number[]> {
    try {
      const result = await this.embeddingModel.embedContent(text);
      const embedding = result.embedding.values;

      if (!embedding || embedding.length === 0) {
        throw new Error('No embedding received from Gemini');
      }

      const estimatedTokens = Math.ceil(text.length / 4);
      this.logTokenUsage(estimatedTokens, 'embedding');

      return embedding;
    } catch (error) {
      logger.error('Embedding creation failed', { error });
      throw new Error(`Embedding creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Convert AIMessages to Gemini format
   */
  private convertMessagesToGemini(messages: AIMessage[]): Content[] {
    return messages.map(msg => {
      if (!msg.content) {
        throw new Error('Message content cannot be empty');
      }
      return {
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }]
      };
    });
  }

  /**
   * Extract keywords from text (fallback method)
   */
  private extractKeywords(text: string): string[] {
    const commonWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can', 'this', 'that', 'these', 'those']);
    
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 3 && !commonWords.has(word))
      .slice(0, 10);
  }

  /**
   * Log token usage for metrics
   */
  private logTokenUsage(tokens: number, operation: string): void {
    metricsService.logTokenUsage({
      totalTokens: tokens,
      model: config.gemini.model,
      operation,
    });

    logger.info('Gemini operation successful', {
      model: config.gemini.model,
      operation,
      estimatedTokens: tokens,
    });
  }
}
