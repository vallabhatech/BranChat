/**
 * Loading Spinner Component
 * 
 * Reusable loading states for different contexts
 */

import { Loader2, Brain, Cpu, Wifi } from 'lucide-react';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'dots' | 'pulse' | 'brain' | 'network';
  text?: string;
  className?: string;
  centered?: boolean;
}

export function LoadingSpinner({ 
  size = 'md', 
  variant = 'default',
  text,
  className = '',
  centered = true
}: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-6 w-6',
    lg: 'h-8 w-8',
  };

  const containerClasses = centered 
    ? 'flex items-center justify-center'
    : 'flex items-center';

  return (
    <div className={`${containerClasses} ${className}`}>
      {variant === 'dots' && (
        <div className="flex space-x-1">
          <div className={`animate-bounce rounded-full bg-blue-500 ${sizeClasses[size]}`} />
          <div className={`animate-bounce rounded-full bg-blue-500 ${sizeClasses[size]} animation-delay-200`} />
          <div className={`animate-bounce rounded-full bg-blue-500 ${sizeClasses[size]} animation-delay-400`} />
        </div>
      )}
      
      {variant === 'pulse' && (
        <div className={`animate-pulse rounded-full bg-blue-500 ${sizeClasses[size]}`} />
      )}
      
      {variant === 'brain' && (
        <Brain className={`animate-pulse text-blue-500 ${sizeClasses[size]}`} />
      )}
      
      {variant === 'network' && (
        <Wifi className={`animate-pulse text-blue-500 ${sizeClasses[size]}`} />
      )}
      
      {variant === 'default' && (
        <Loader2 className={`animate-spin text-blue-500 ${sizeClasses[size]}`} />
      )}
      
      {text && (
        <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">
          {text}
        </span>
      )}
    </div>
  );
}

/**
 * Full page loading component
 */
export function FullPageLoading({ text = 'Loading...' }: { text?: string }) {
  return (
    <div className="min-h-screen bg-white dark:bg-[#1a1a1a] flex items-center justify-center">
      <LoadingSpinner size="lg" text={text} />
    </div>
  );
}

/**
 * Inline loading component for buttons
 */
export function InlineLoading({ size = 'sm' }: { size?: 'sm' | 'md' }) {
  return (
    <LoadingSpinner 
      size={size} 
      variant="dots" 
      centered={false}
      className="inline-flex"
    />
  );
}

/**
 * Message loading skeleton
 */
export function MessageSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="flex space-x-3">
        <div className="w-8 h-8 bg-gray-300 dark:bg-gray-600 rounded-full"></div>
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-3/4"></div>
          <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-1/2"></div>
        </div>
      </div>
    </div>
  );
}

/**
 * List of message skeletons
 */
export function MessageListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }, (_, index) => (
        <MessageSkeleton key={index} />
      ))}
    </div>
  );
}
