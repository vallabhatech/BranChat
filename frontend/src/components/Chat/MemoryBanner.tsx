import { useState } from 'react';
import { Brain, ChevronDown, ChevronUp, X } from 'lucide-react';
import { Summary } from '../../types';

interface MemoryBannerProps {
  summaries: Summary[];
  onToggleSummary: (summaryId: string, isActive: boolean) => void;
}

export function MemoryBanner({ summaries, onToggleSummary }: MemoryBannerProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  const activeSummaries = summaries.filter(s => s.is_active);

  if (isDismissed || activeSummaries.length === 0) {
    return null;
  }

  return (
    <div className="border-b border-gray-200 dark:border-gray-600 bg-[#f0f9ff] dark:bg-[#1e3a8a]/10">
      <div className="max-w-3xl mx-auto px-4 py-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex-shrink-0 p-1 rounded bg-blue-100 dark:bg-blue-900/40">
              <Brain size={14} className="text-blue-600 dark:text-blue-400" />
            </div>
            <div className="flex-1">
              <div className="text-sm text-blue-900 dark:text-blue-200">
                Using {activeSummaries.length} past {activeSummaries.length === 1 ? 'summary' : 'summaries'}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1 rounded hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors text-blue-600 dark:text-blue-400"
              title={isExpanded ? 'Hide summaries' : 'Show summaries'}
            >
              {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
            <button
              onClick={() => setIsDismissed(true)}
              className="p-1 rounded hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors text-blue-600 dark:text-blue-400"
              title="Dismiss"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {isExpanded && (
          <div className="mt-2 space-y-1">
            {activeSummaries.map((summary) => (
              <div
                key={summary.id}
                className="p-2 bg-white dark:bg-[#2f2f2f] rounded border border-blue-200 dark:border-blue-800"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-gray-900 dark:text-gray-100 mb-1">
                      {summary.content.length > 100 
                        ? summary.content.substring(0, 100) + '...' 
                        : summary.content
                      }
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {new Date(summary.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <button
                    onClick={() => onToggleSummary(summary.id, false)}
                    className="flex-shrink-0 p-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                    title="Remove from context"
                  >
                    <X size={12} className="text-gray-500 dark:text-gray-400" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
