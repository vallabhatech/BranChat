import { useEffect, useState } from 'react';
import { useChromeAI } from '../hooks/useChromeAI';
import { Sparkles, Cloud, AlertCircle } from 'lucide-react';

export function ChromeAIStatus() {
  const { isAvailable, provider, promptAPI, summarizerAPI, writerAPI } = useChromeAI();
  const [showDetails, setShowDetails] = useState(false);

  const getStatusIcon = () => {
    switch (provider) {
      case 'chrome-builtin':
        return <Sparkles className="w-4 h-4 text-green-500" />;
      case 'server-fallback':
        return <Cloud className="w-4 h-4 text-blue-500" />;
      default:
        return <AlertCircle className="w-4 h-4 text-gray-400" />;
    }
  };

  const getStatusText = () => {
    switch (provider) {
      case 'chrome-builtin':
        return 'Chrome Built-in AI';
      case 'server-fallback':
        return 'Server AI (Gemini)';
      default:
        return 'AI Unavailable';
    }
  };

  const getStatusColor = () => {
    switch (provider) {
      case 'chrome-builtin':
        return 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800';
      case 'server-fallback':
        return 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800';
      default:
        return 'bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700';
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setShowDetails(!showDetails)}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${getStatusColor()}`}
        title="Click for AI status details"
      >
        {getStatusIcon()}
        <span>{getStatusText()}</span>
      </button>

      {showDetails && (
        <div className="absolute top-full right-0 mt-2 w-64 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-4 z-50">
          <div className="space-y-3">
            <div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
                AI Provider Status
              </h3>
              <div className="flex items-center gap-2 text-sm">
                {getStatusIcon()}
                <span className="text-gray-700 dark:text-gray-300">{getStatusText()}</span>
              </div>
            </div>

            {provider === 'chrome-builtin' && (
              <div className="border-t border-gray-200 dark:border-gray-700 pt-3">
                <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Available APIs:
                </h4>
                <div className="space-y-1 text-xs">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${promptAPI ? 'bg-green-500' : 'bg-gray-300'}`} />
                    <span className="text-gray-600 dark:text-gray-400">Prompt API</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${summarizerAPI ? 'bg-green-500' : 'bg-gray-300'}`} />
                    <span className="text-gray-600 dark:text-gray-400">Summarizer API</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${writerAPI ? 'bg-green-500' : 'bg-gray-300'}`} />
                    <span className="text-gray-600 dark:text-gray-400">Writer API</span>
                  </div>
                </div>
              </div>
            )}

            {provider === 'server-fallback' && (
              <div className="border-t border-gray-200 dark:border-gray-700 pt-3">
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  Chrome Built-in AI is not available. Using server-side Gemini API as fallback.
                </p>
                <a
                  href="chrome://flags/#optimization-guide-on-device-model"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline mt-2 inline-block"
                >
                  Enable Chrome AI →
                </a>
              </div>
            )}

            <div className="border-t border-gray-200 dark:border-gray-700 pt-3">
              <p className="text-xs text-gray-500 dark:text-gray-500">
                {provider === 'chrome-builtin' 
                  ? '🔒 All processing happens on your device'
                  : '☁️ Processing happens on remote servers'}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
