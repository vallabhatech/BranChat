/**
 * Smooth Scroll Hook
 * 
 * Provides smooth scrolling functionality with various options
 */

import { useRef, useCallback, useEffect } from 'react';

interface SmoothScrollOptions {
  behavior?: ScrollBehavior;
  block?: ScrollLogicalPosition;
  inline?: ScrollInlinePosition;
}

interface SmoothScrollReturn {
  scrollToTop: () => void;
  scrollToBottom: () => void;
  scrollToElement: (element: HTMLElement, options?: SmoothScrollOptions) => void;
  scrollIntoView: (element: HTMLElement, options?: SmoothScrollOptions) => void;
}

export function useSmoothScroll(): SmoothScrollReturn {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToTop = useCallback(() => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  }, []);

  const scrollToBottom = useCallback(() => {
    window.scrollTo({
      top: document.documentElement.scrollHeight,
      behavior: 'smooth',
    });
  }, []);

  const scrollToElement = useCallback((element: HTMLElement, options: SmoothScrollOptions = {}) => {
    const elementPosition = element.getBoundingClientRect();
    const offsetPosition = elementPosition.top + window.pageYOffset;
    
    const defaultOptions: SmoothScrollOptions = {
      behavior: 'smooth',
      block: 'start',
      inline: 'nearest',
      ...options,
    };

    window.scrollTo({
      top: offsetPosition,
      ...defaultOptions,
    });
  }, []);

  const scrollIntoView = useCallback((element: HTMLElement, options: SmoothScrollOptions = {}) => {
    const defaultOptions: SmoothScrollOptions = {
      behavior: 'smooth',
      block: 'start',
      inline: 'nearest',
      ...options,
    };

    element.scrollIntoView(defaultOptions);
  }, []);

  const scrollToMessagesEnd = useCallback(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, []);

  return {
    scrollToTop,
    scrollToBottom,
    scrollToElement,
    scrollIntoView,
    scrollToMessagesEnd,
    messagesEndRef,
  };
}

/**
 * Auto-scroll hook for message lists
 */
export function useAutoScroll(messages: any[], dependencies: any[] = []) {
  const { scrollToBottom, scrollToMessagesEnd } = useSmoothScroll();

  useEffect(() => {
    scrollToBottom();
  }, [messages.length, ...dependencies]);

  return scrollToBottom;
}

/**
 * Scroll to specific message by ID
 */
export function useScrollToMessage(messageId: string, messages: any[]) {
  const { scrollToElement } = useSmoothScroll();

  useEffect(() => {
    const messageElement = document.getElementById(`message-${messageId}`);
    if (messageElement) {
      scrollToElement(messageElement);
    }
  }, [messageId, messages]);
}

/**
 * Infinite scroll hook for loading more messages
 */
export function useInfiniteScroll(
  isLoading: boolean,
  hasMore: boolean,
  onLoadMore: () => void,
  threshold = 100
) {
  const { scrollToBottom } = useSmoothScroll();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      
      if (scrollTop + clientHeight >= scrollHeight - threshold && hasMore && !isLoading) {
        onLoadMore();
      }
    };

    container.addEventListener('scroll', handleScroll);
    
    return () => {
      container.removeEventListener('scroll', handleScroll);
    };
  }, [isLoading, hasMore, onLoadMore, threshold]);

  return { containerRef, scrollToBottom };
}
