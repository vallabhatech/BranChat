import { Request } from 'express';

// Common types used across the application

// Extend Express Request interface to include user context
declare global {
  namespace Express {
    interface Request {
      user?: UserContext;
    }
  }
}

// Authenticated request type for controllers
export interface AuthenticatedRequest extends Request {
  user: {
    id: string;
    isGuest: boolean;
    memoryOptIn?: boolean;
  };
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    timestamp: string;
    requestId?: string;
  };
}

export interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface UserContext {
  userId?: string;
  isGuest: boolean;
  memoryOptIn?: boolean;
}

export interface LLMMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface StreamingOptions {
  onToken?: (token: string) => void;
  onComplete?: (fullResponse: string) => void;
  onError?: (error: Error) => void;
}

export interface MemoryEntry {
  id: string;
  summary: string;
  keywords: string[];
  score?: number;
  createdAt: Date;
}