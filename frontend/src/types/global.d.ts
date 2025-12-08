/// <reference types="react" />
/// <reference types="react-dom" />

declare module 'react' {
  export * from 'react';
}

declare module 'react-dom' {
  export * from 'react-dom';
}

declare module 'lucide-react' {
  export * from 'lucide-react';
}

// Chrome Built-in AI API Types
interface AILanguageModelCapabilities {
  available: 'readily' | 'after-download' | 'no';
  defaultTemperature?: number;
  defaultTopK?: number;
  maxTopK?: number;
}

interface AILanguageModel {
  prompt(input: string): Promise<string>;
  promptStreaming(input: string): ReadableStream;
  destroy(): void;
}

interface AILanguageModelFactory {
  capabilities(): Promise<AILanguageModelCapabilities>;
  create(options?: {
    systemPrompt?: string;
    temperature?: number;
    topK?: number;
  }): Promise<AILanguageModel>;
}

interface AISummarizerCapabilities {
  available: 'readily' | 'after-download' | 'no';
}

interface AISummarizer {
  summarize(text: string): Promise<string>;
  summarizeStreaming(text: string): ReadableStream;
  destroy(): void;
}

interface AISummarizerFactory {
  capabilities(): Promise<AISummarizerCapabilities>;
  create(options?: {
    type?: 'tl;dr' | 'key-points' | 'teaser' | 'headline';
    format?: 'plain-text' | 'markdown';
    length?: 'short' | 'medium' | 'long';
  }): Promise<AISummarizer>;
}

interface AIWriterCapabilities {
  available: 'readily' | 'after-download' | 'no';
}

interface AIWriter {
  write(prompt: string): Promise<string>;
  writeStreaming(prompt: string): ReadableStream;
  destroy(): void;
}

interface AIWriterFactory {
  capabilities(): Promise<AIWriterCapabilities>;
  create(options?: {
    tone?: 'formal' | 'neutral' | 'casual';
    format?: 'plain-text' | 'markdown';
    length?: 'short' | 'medium' | 'long';
  }): Promise<AIWriter>;
}

interface AIRewriterCapabilities {
  available: 'readily' | 'after-download' | 'no';
}

interface AIRewriter {
  rewrite(text: string): Promise<string>;
  rewriteStreaming(text: string): ReadableStream;
  destroy(): void;
}

interface AIRewriterFactory {
  capabilities(): Promise<AIRewriterCapabilities>;
  create(options?: {
    tone?: 'as-is' | 'more-formal' | 'more-casual';
    format?: 'as-is' | 'plain-text' | 'markdown';
    length?: 'as-is' | 'shorter' | 'longer';
  }): Promise<AIRewriter>;
}

interface AI {
  languageModel: AILanguageModelFactory;
  summarizer: AISummarizerFactory;
  writer: AIWriterFactory;
  rewriter: AIRewriterFactory;
}

// Global JSX namespace
declare global {
  namespace JSX {
    interface IntrinsicElements {
      [elemName: string]: any;
    }
  }

  interface Window {
    ai?: AI;
  }
}

export {};