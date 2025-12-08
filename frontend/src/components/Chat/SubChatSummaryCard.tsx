import { MessageSquare, Clock, ChevronRight } from 'lucide-react';

interface SubChatSummaryCardProps {
  subChatId: string;
  summary: string;
  selectedText: string;
  questionCount: number;
  mergedAt: string;
  onClick: (subChatId: string) => void;
}

export function SubChatSummaryCard({
  subChatId,
  summary,
  selectedText,
  questionCount,
  mergedAt,
  onClick
}: SubChatSummaryCardProps) {
  const timeAgo = getTimeAgo(mergedAt);

  return (
    <div
      onClick={() => onClick(subChatId)}
      className="my-2 p-2.5 bg-blue-50/80 dark:bg-blue-900/10 border border-blue-200/60 dark:border-blue-800/40 rounded-lg cursor-pointer hover:bg-blue-100/80 dark:hover:bg-blue-900/20 hover:border-blue-300 dark:hover:border-blue-700 transition-all duration-150 group"
      title="Click to view SubChat conversation"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {/* Icon */}
          <MessageSquare size={14} className="text-blue-600 dark:text-blue-400 flex-shrink-0" />
          
          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-xs font-medium text-blue-700 dark:text-blue-300">
                SubChat Summary
              </span>
              <span className="text-[10px] text-blue-500/70 dark:text-blue-400/70 flex items-center gap-0.5">
                <Clock size={10} />
                {timeAgo}
              </span>
            </div>
            
            {/* Summary text - compact */}
            <p className="text-xs text-gray-700 dark:text-gray-300 line-clamp-1">
              {selectedText && (
                <span className="text-blue-600 dark:text-blue-400 font-medium">
                  "{selectedText.length > 40 ? selectedText.substring(0, 40) + '...' : selectedText}"
                </span>
              )}
              {selectedText && ' - '}
              {summary.length > 60 ? summary.substring(0, 60) + '...' : summary}
            </p>
            
            {/* Question count - inline */}
            <span className="text-[10px] text-blue-600/70 dark:text-blue-400/70 mt-0.5 inline-block">
              {questionCount} {questionCount === 1 ? 'question' : 'questions'}
            </span>
          </div>
        </div>

        {/* Arrow Icon */}
        <ChevronRight 
          size={16} 
          className="text-blue-400 dark:text-blue-500 group-hover:text-blue-600 dark:group-hover:text-blue-300 group-hover:translate-x-0.5 transition-all duration-150 flex-shrink-0" 
        />
      </div>
    </div>
  );
}

function getTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}
