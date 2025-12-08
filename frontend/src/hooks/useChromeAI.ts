import { useState, useEffect, useCallback } from 'react';
import { chromeAI, AIProvider } from '../lib/chromeAI';

interface UseChromeAIReturn {
  isAvailable: boolean;
  provider: AIProvider;
  promptAPI: boolean;
  summarizerAPI: boolean;
  writerAPI: boolean;
  rewriterAPI: boolean;
  generateResponse: (prompt: string, systemPrompt?: string) => Promise<string | null>;
  summarize: (text: string, options?: { type?: 'tl;dr' | 'key-points' | 'teaser' | 'headline'; length?: 'short' | 'medium' | 'long' }) => Promise<string | null>;
  write: (prompt: string, options?: { tone?: 'formal' | 'neutral' | 'casual'; length?: 'short' | 'medium' | 'long' }) => Promise<string | null>;
  rewrite: (text: string, options?: { tone?: 'as-is' | 'more-formal' | 'more-casual'; length?: 'as-is' | 'shorter' | 'longer' }) => Promise<string | null>;
}

/**
 * React hook for Chrome Built-in AI APIs
 * Provides easy access to Prompt, Summarizer, Writer, and Rewriter APIs
 */
export function useChromeAI(): UseChromeAIReturn {
  const [isAvailable, setIsAvailable] = useState(false);
  const [provider, setProvider] = useState<AIProvider>('unavailable');
  const [promptAPI, setPromptAPI] = useState(false);
  const [summarizerAPI, setSummarizerAPI] = useState(false);
  const [writerAPI, setWriterAPI] = useState(false);
  const [rewriterAPI, setRewriterAPI] = useState(false);

  useEffect(() => {
    const initializeAI = async () => {
      const status = await chromeAI.initialize();
      setIsAvailable(status.provider === 'chrome-builtin');
      setProvider(status.provider);
      setPromptAPI(status.promptAPI);
      setSummarizerAPI(status.summarizerAPI);
      setWriterAPI(status.writerAPI);
      setRewriterAPI(status.rewriterAPI);
    };

    initializeAI();

    // Cleanup on unmount
    return () => {
      chromeAI.destroy();
    };
  }, []);

  const generateResponse = useCallback(
    async (prompt: string, systemPrompt?: string): Promise<string | null> => {
      return await chromeAI.generateResponse(prompt, systemPrompt);
    },
    []
  );

  const summarize = useCallback(
    async (
      text: string,
      options?: { type?: 'tl;dr' | 'key-points' | 'teaser' | 'headline'; length?: 'short' | 'medium' | 'long' }
    ): Promise<string | null> => {
      return await chromeAI.summarize(text, options);
    },
    []
  );

  const write = useCallback(
    async (
      prompt: string,
      options?: { tone?: 'formal' | 'neutral' | 'casual'; length?: 'short' | 'medium' | 'long' }
    ): Promise<string | null> => {
      return await chromeAI.write(prompt, options);
    },
    []
  );

  const rewrite = useCallback(
    async (
      text: string,
      options?: { tone?: 'as-is' | 'more-formal' | 'more-casual'; length?: 'as-is' | 'shorter' | 'longer' }
    ): Promise<string | null> => {
      return await chromeAI.rewrite(text, options);
    },
    []
  );

  return {
    isAvailable,
    provider,
    promptAPI,
    summarizerAPI,
    writerAPI,
    rewriterAPI,
    generateResponse,
    summarize,
    write,
    rewrite,
  };
}
