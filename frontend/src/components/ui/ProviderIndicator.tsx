/**
 * Provider Indicator Badge
 * 
 * Shows the current AI provider status and capabilities
 */

import { Brain, Cloud, Wifi, WifiOff, AlertCircle, CheckCircle } from 'lucide-react';
import { useAIProvider } from '../../contexts/AIProviderContext';

interface ProviderIndicatorProps {
  size?: 'sm' | 'md' | 'lg';
  showDetails?: boolean;
  className?: string;
}

export function ProviderIndicator({ 
  size = 'md', 
  showDetails = false,
  className = ''
}: ProviderIndicatorProps) {
  const { state, isAvailable, providerName, providerType, successRate } = useAIProvider();

  const sizeClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
  };

  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  };

  if (!state.isInitialized || state.isChecking) {
    return (
      <div className={`flex items-center space-x-2 ${className}`}>
        <div className={`${iconSizes[size]} animate-pulse bg-gray-300 dark:bg-gray-600 rounded-full`} />
        <span className={`${sizeClasses[size]} text-gray-500`}>
          Initializing...
        </span>
      </div>
    );
  }

  if (!isAvailable) {
    return (
      <div className={`flex items-center space-x-2 ${className}`}>
        <WifiOff className={`${iconSizes[size]} text-red-500`} />
        <span className={`${sizeClasses[size]} text-red-500`}>
          AI Unavailable
        </span>
        {showDetails && (
          <span className="text-xs text-gray-500">
            No AI providers available
          </span>
        )}
      </div>
    );
  }

  const getProviderIcon = () => {
    switch (providerType) {
      case 'chrome-builtin':
        return <Brain className={`${iconSizes[size]} text-blue-500`} />;
      case 'server-fallback':
        return <Cloud className={`${iconSizes[size]} text-orange-500`} />;
      default:
        return <AlertCircle className={`${iconSizes[size]} text-gray-500`} />;
    }
  };

  const getProviderColor = () => {
    switch (providerType) {
      case 'chrome-builtin':
        return 'text-blue-500';
      case 'server-fallback':
        return 'text-orange-500';
      default:
        return 'text-gray-500';
    }
  };

  const getStatusIcon = () => {
    if (successRate >= 95) {
      return <CheckCircle className="w-3 h-3 text-green-500" />;
    } else if (successRate >= 80) {
      return <AlertCircle className="w-3 h-3 text-yellow-500" />;
    } else {
      return <AlertCircle className="w-3 h-3 text-red-500" />;
    }
  };

  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      {getProviderIcon()}
      
      <div className="flex flex-col">
        <span className={`${sizeClasses[size]} font-medium ${getProviderColor()}`}>
          {providerName}
        </span>
        
        {showDetails && (
          <div className="flex items-center space-x-1">
            {getStatusIcon()}
            <span className="text-xs text-gray-500">
              {successRate.toFixed(0)}% success rate
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Compact provider indicator for inline use
 */
export function CompactProviderIndicator({ className = '' }: { className?: string }) {
  const { isAvailable, providerType } = useAIProvider();

  if (!isAvailable) {
    return (
      <div className={`flex items-center ${className}`}>
        <WifiOff className="w-3 h-3 text-red-500" />
      </div>
    );
  }

  const getProviderIcon = () => {
    switch (providerType) {
      case 'chrome-builtin':
        return <Brain className="w-3 h-3 text-blue-500" />;
      case 'server-fallback':
        return <Cloud className="w-3 h-3 text-orange-500" />;
      default:
        return <AlertCircle className="w-3 h-3 text-gray-500" />;
    }
  };

  return (
    <div className={`flex items-center ${className}`}>
      {getProviderIcon()}
    </div>
  );
}

/**
 * Detailed provider status card
 */
export function ProviderStatusCard({ className = '' }: { className?: string }) {
  const { state, isAvailable, providerName, providerType, availableProviders, totalRequests, successfulRequests, failedRequests } = useAIProvider();

  const successRate = totalRequests > 0 ? (successfulRequests / totalRequests) * 100 : 0;

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-gray-200 dark:border-gray-700 ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
          AI Provider Status
        </h3>
        <CompactProviderIndicator />
      </div>
      
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600 dark:text-gray-400">
            Current Provider:
          </span>
          <span className="text-sm font-medium text-gray-900 dark:text-white">
            {providerName}
          </span>
        </div>
        
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600 dark:text-gray-400">
            Type:
          </span>
          <span className="text-sm font-medium text-gray-900 dark:text-white capitalize">
            {providerType.replace('-', ' ')}
          </span>
        </div>
        
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600 dark:text-gray-400">
            Status:
          </span>
          <span className={`text-sm font-medium ${isAvailable ? 'text-green-600' : 'text-red-600'}`}>
            {isAvailable ? 'Available' : 'Unavailable'}
          </span>
        </div>
        
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600 dark:text-gray-400">
            Success Rate:
          </span>
          <span className={`text-sm font-medium ${
            successRate >= 95 ? 'text-green-600' : 
            successRate >= 80 ? 'text-yellow-600' : 
            'text-red-600'
          }`}>
            {successRate.toFixed(1)}%
          </span>
        </div>
        
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600 dark:text-gray-400">
            Total Requests:
          </span>
          <span className="text-sm font-medium text-gray-900 dark:text-white">
            {totalRequests}
          </span>
        </div>
        
        {availableProviders.length > 1 && (
          <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
            <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
              Available Providers
            </h4>
            <div className="space-y-1">
              {availableProviders.map((provider) => (
                <div key={provider.name} className="flex items-center justify-between text-xs">
                  <span className="text-gray-600 dark:text-gray-400">
                    {provider.name}
                  </span>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    provider.available 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {provider.available ? 'Available' : 'Unavailable'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
