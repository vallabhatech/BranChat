/**
 * LLM Service - Server-side AI Processing
 * 
 * This service provides fallback AI capabilities using Google's Gemini API
 * when Chrome's Built-in AI is not available on the client.
 * 
 * For Google Chrome Built-in AI Challenge 2025:
 * - Primary: Chrome Built-in AI (Prompt API, Summarizer API, Writer API)
 * - Fallback: This service using Gemini API
 * 
 * This hybrid approach ensures:
 * - Privacy-first with client-side processing when available
 * - Reliability with server fallback
 * - Cross-platform support (mobile, non-Chrome browsers)
 */

import { GoogleGenerativeAI, GenerativeModel, Content } from '@google/generative-ai';
import { config } from '../config/environment';
import { logger } from '../utils/logger';
import { LLMMessage, StreamingOptions } from '../types';
import { metricsService } from './metrics.service';

// LLM Provider Interface
export interface LLMProvider {
  chatCompletion(
    messages: LLMMessage[],
    options?: ChatCompletionOptions
  ): Promise<string>;
  
  chatCompletionStream(
    messages: LLMMessage[],
    options?: ChatCompletionOptions & StreamingOptions
  ): Promise<AsyncIterable<string>>;
  
  summarizeText(text: string): Promise<SummaryResult>;
  
  createEmbedding(text: string): Promise<number[]>;
}

// Chat completion options
export interface ChatCompletionOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}

// Summary result structure
export interface SummaryResult {
  summary: string;
  actions: string[];
  artifacts: string[];
  keywords: string[];
}



// Gemini Provider Implementation
export class GeminiProvider implements LLMProvider {
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

  private convertMessagesToGemini(messages: LLMMessage[]): Content[] {
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

  async chatCompletion(
    messages: LLMMessage[],
    options: ChatCompletionOptions = {}
  ): Promise<string> {
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
        metricsService.logTokenUsage({
          totalTokens: estimatedTokens,
          model: config.gemini.model,
          operation: 'chat',
        });

        logger.info('Gemini chat completion successful', {
          model: config.gemini.model,
          estimatedTokens,
        });

        return content;
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
      metricsService.logTokenUsage({
        totalTokens: estimatedTokens,
        model: config.gemini.model,
        operation: 'chat',
      });

      logger.info('Gemini chat completion successful', {
        model: config.gemini.model,
        estimatedTokens,
      });

      return content;
    } catch (error) {
      logger.error('Gemini chat completion failed', { error });
      throw new Error(`Gemini chat completion failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async chatCompletionStream(
    messages: LLMMessage[],
    options: ChatCompletionOptions & StreamingOptions = {}
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
        metricsService.logTokenUsage({
          totalTokens: estimatedTokens,
          model: config.gemini.model,
          operation: 'chat',
        });

        logger.info('Gemini streaming completion successful', {
          model: config.gemini.model,
          responseLength: fullResponse.length,
          estimatedTokens,
        });

      } catch (error) {
        logger.error('Gemini streaming completion failed', { error });
        
        if (options.onError) {
          options.onError(error instanceof Error ? error : new Error('Unknown streaming error'));
        }
        
        throw new Error(`Gemini streaming completion failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    })();
  }

  async summarizeText(text: string): Promise<SummaryResult> {
    const prompt = `Please analyze the following conversation transcript and provide a structured summary in JSON format with the following fields:
- summary: A concise overview of the main discussion points and outcomes
- actions: An array of specific action items or decisions made
- artifacts: An array of any code, documents, or deliverables mentioned or created
- keywords: An array of important keywords and topics for future reference

Transcript:
${text}

Please respond with valid JSON only:`;

    try {
      const response = await this.chatCompletion([
        { role: 'system', content: 'You are a helpful assistant that creates structured summaries of conversations. Always respond with valid JSON.' },
        { role: 'user', content: prompt }
      ], {
        temperature: 0.3,
        maxTokens: 1000,
      });

      try {
        const parsed = JSON.parse(response) as SummaryResult;
        
        if (!parsed.summary || !Array.isArray(parsed.actions) || 
            !Array.isArray(parsed.artifacts) || !Array.isArray(parsed.keywords)) {
          throw new Error('Invalid summary structure');
        }

        const estimatedTokens = Math.ceil((text.length + response.length) / 4);
        metricsService.logTokenUsage({
          totalTokens: estimatedTokens,
          model: config.gemini.model,
          operation: 'summarize',
        });

        logger.info('Text summarization successful', {
          summaryLength: parsed.summary.length,
          actionsCount: parsed.actions.length,
          artifactsCount: parsed.artifacts.length,
          keywordsCount: parsed.keywords.length,
          estimatedTokens,
        });

        return parsed;
      } catch (parseError) {
        logger.warn('Failed to parse JSON summary, attempting fallback', { parseError, response });
        
        return {
          summary: response.substring(0, 500),
          actions: [],
          artifacts: [],
          keywords: this.extractKeywords(response),
        };
      }
    } catch (error) {
      logger.error('Text summarization failed', { error });
      throw new Error(`Text summarization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async createEmbedding(text: string): Promise<number[]> {
    try {
      const result = await this.embeddingModel.embedContent(text);
      const embedding = result.embedding.values;

      if (!embedding || embedding.length === 0) {
        throw new Error('No embedding received from Gemini');
      }

      const estimatedTokens = Math.ceil(text.length / 4);
      metricsService.logTokenUsage({
        totalTokens: estimatedTokens,
        model: config.gemini.embeddingModel,
        operation: 'embedding',
      });

      logger.info('Embedding creation successful', {
        inputLength: text.length,
        embeddingDimensions: embedding.length,
        estimatedTokens,
      });

      return embedding;
    } catch (error) {
      logger.error('Embedding creation failed', { error });
      throw new Error(`Embedding creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private extractKeywords(text: string): string[] {
    const commonWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can', 'this', 'that', 'these', 'those']);
    
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 3 && !commonWords.has(word))
      .slice(0, 10);
  }
}

// Provider Factory
export type LLMProviderType = 'gemini' | 'vertex';

export class LLMProviderFactory {
  static create(provider: LLMProviderType = 'gemini'): LLMProvider {
    switch (provider) {
      case 'vertex':
        // TODO: Implement Vertex AI provider
        throw new Error('Vertex AI provider not yet implemented');
      case 'gemini':
        return new GeminiProvider();
      default:
        throw new Error(`Unknown LLM provider: ${provider}`);
    }
  }
}

// Default LLM Service Instance - Always use Gemini
export const llmService = new GeminiProvider();