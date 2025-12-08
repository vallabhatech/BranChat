import { Request, Response } from 'express';
import { llmService } from '../services/llm.service';
import { logger } from '../utils/logger';

export class AIController {
  /**
   * Generate content using AI
   */
  async write(req: Request, res: Response): Promise<void> {
    try {
      const { prompt, tone = 'neutral' } = req.body;

      if (!prompt) {
        res.status(400).json({ error: 'Prompt is required' });
        return;
      }

      // Create a system message based on tone
      const toneInstructions = {
        'formal': 'Write in a formal, professional tone.',
        'neutral': 'Write in a clear, neutral tone.',
        'casual': 'Write in a casual, conversational tone.'
      };

      const systemMessage = toneInstructions[tone as keyof typeof toneInstructions] || toneInstructions.neutral;

      const content = await llmService.chatCompletion([
        { role: 'system', content: systemMessage },
        { role: 'user', content: prompt }
      ], {
        temperature: 0.7,
        maxTokens: 1000
      });

      logger.info('AI content generation successful', {
        userId: req.user?.userId,
        promptLength: prompt.length,
        responseLength: content.length,
        tone
      });

      res.json({ 
        content,
        tone,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('AI content generation failed', { 
        error, 
        userId: req.user?.userId 
      });
      
      res.status(500).json({ 
        error: 'Failed to generate content',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Rewrite content using AI
   */
  async rewrite(req: Request, res: Response): Promise<void> {
    try {
      const { text, tone = 'as-is', length = 'as-is' } = req.body;

      if (!text) {
        res.status(400).json({ error: 'Text is required' });
        return;
      }

      // Build rewrite instructions
      let instructions = 'Rewrite the following text';
      
      if (tone !== 'as-is') {
        const toneMap = {
          'more-formal': 'in a more formal tone',
          'more-casual': 'in a more casual tone'
        };
        instructions += ` ${toneMap[tone as keyof typeof toneMap]}`;
      }
      
      if (length !== 'as-is') {
        const lengthMap = {
          'shorter': 'making it more concise',
          'longer': 'expanding it with more detail'
        };
        instructions += ` ${lengthMap[length as keyof typeof lengthMap]}`;
      }

      instructions += ':\n\n';

      const content = await llmService.chatCompletion([
        { role: 'system', content: 'You are a helpful writing assistant that rewrites text according to specific instructions.' },
        { role: 'user', content: instructions + text }
      ], {
        temperature: 0.5,
        maxTokens: Math.max(1000, text.length * 2) // Allow for expansion
      });

      // Analyze improvements (simple heuristic)
      const improvements = [];
      if (tone === 'more-formal' && content.includes('furthermore')) {
        improvements.push('Enhanced formality');
      }
      if (length === 'shorter' && content.length < text.length) {
        improvements.push('Reduced length');
      }
      if (length === 'longer' && content.length > text.length) {
        improvements.push('Added detail');
      }

      logger.info('AI content rewriting successful', {
        userId: req.user?.userId,
        originalLength: text.length,
        rewrittenLength: content.length,
        tone,
        length,
        improvements: improvements.length
      });

      res.json({ 
        content,
        originalLength: text.length,
        rewrittenLength: content.length,
        tone,
        length,
        improvements,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('AI content rewriting failed', { 
        error, 
        userId: req.user?.userId 
      });
      
      res.status(500).json({ 
        error: 'Failed to rewrite content',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Real-time search/query using AI
   */
  async search(req: Request, res: Response): Promise<void> {
    try {
      const { query } = req.body;

      if (!query) {
        res.status(400).json({ error: 'Query is required' });
        return;
      }

      // Generate AI response for the search query
      const response = await llmService.chatCompletion([
        { 
          role: 'system', 
          content: 'You are a helpful AI assistant. Provide clear, concise, and accurate answers to user questions in plain text format. Do not use markdown formatting like **bold**, *italic*, # headers, or bullet points with *. Use simple text with line breaks for readability. If you don\'t know something, say so honestly.' 
        },
        { role: 'user', content: query }
      ], {
        temperature: 0.7,
        maxTokens: 1000
      });

      logger.info('AI search query successful', {
        userId: req.user?.userId,
        queryLength: query.length,
        responseLength: response.length
      });

      res.json({ 
        response,
        query,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('AI search query failed', { 
        error, 
        userId: req.user?.userId 
      });
      
      res.status(500).json({ 
        error: 'Failed to process search query',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Summarize content using AI
   */
  async summarize(req: Request, res: Response): Promise<void> {
    try {
      const { text, type = 'tl;dr', format = 'text' } = req.body;

      if (!text) {
        res.status(400).json({ error: 'Text is required' });
        return;
      }

      if (format === 'json' || type === 'structured') {
        // Use the structured summarization
        const summary = await llmService.summarizeText(text);
        
        logger.info('AI structured summarization successful', {
          userId: req.user?.userId,
          textLength: text.length,
          summaryLength: summary.summary.length,
          actionsCount: summary.actions.length,
          artifactsCount: summary.artifacts.length,
          keywordsCount: summary.keywords.length
        });

        res.json({
          summary: summary.summary,
          structured: summary,
          type: 'structured',
          format: 'json',
          timestamp: new Date().toISOString()
        });
      } else {
        // Simple summarization
        const typeInstructions = {
          'tl;dr': 'Provide a brief TL;DR summary',
          'key-points': 'Extract the key points',
          'overview': 'Provide a comprehensive overview'
        };

        const instruction = typeInstructions[type as keyof typeof typeInstructions] || typeInstructions['tl;dr'];

        const summary = await llmService.chatCompletion([
          { role: 'system', content: 'You are a helpful assistant that creates clear, concise summaries.' },
          { role: 'user', content: `${instruction} of the following text:\n\n${text}` }
        ], {
          temperature: 0.3,
          maxTokens: 500
        });

        logger.info('AI summarization successful', {
          userId: req.user?.userId,
          textLength: text.length,
          summaryLength: summary.length,
          type
        });

        res.json({
          summary,
          type,
          format,
          timestamp: new Date().toISOString()
        });
      }

    } catch (error) {
      logger.error('AI summarization failed', { 
        error, 
        userId: req.user?.userId 
      });
      
      res.status(500).json({ 
        error: 'Failed to summarize content',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}

export const aiController = new AIController();