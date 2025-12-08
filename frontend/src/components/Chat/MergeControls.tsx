import { GitMerge, ArrowRight } from 'lucide-react';

interface MergeControlsProps {
  onMerge: () => void;
  onContinueWithoutMerge: () => void;
}

export function MergeControls({ onMerge, onContinueWithoutMerge }: MergeControlsProps) {
  return (
    <div className="border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-[#40414f] px-4 py-4">
      <div className="max-w-3xl mx-auto">
        <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">
          What would you like to do with this sub-chat?
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={onMerge}
            className="flex items-center justify-center gap-2 flex-1 px-4 py-2.5 bg-[#1a73e8] hover:bg-[#1557b0] text-white font-medium rounded-lg transition-colors"
          >
            <GitMerge size={18} />
            Merge & Continue
          </button>
          <button
            onClick={onContinueWithoutMerge}
            className="flex items-center justify-center gap-2 flex-1 px-4 py-2.5 border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium rounded-lg transition-colors"
          >
            <ArrowRight size={18} />
            Continue without merging
          </button>
        </div>
      </div>
    </div>
  );
}
