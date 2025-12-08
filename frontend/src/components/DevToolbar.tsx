import { useState } from 'react';
import { Settings, Eye, EyeOff } from 'lucide-react';

interface DevToolbarProps {
  onToggleMockMemory: (enabled: boolean) => void;
  onToggleMockSummaries: (enabled: boolean) => void;
}

export function DevToolbar({ onToggleMockMemory, onToggleMockSummaries }: DevToolbarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [mockMemoryEnabled, setMockMemoryEnabled] = useState(true);
  const [mockSummariesEnabled, setMockSummariesEnabled] = useState(true);

  if (import.meta.env.PROD) {
    return null; // Hide in production
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {isOpen && (
        <div className="mb-2 p-4 bg-gray-900 text-white rounded-lg shadow-xl min-w-[280px]">
          <h3 className="text-sm font-semibold mb-3 text-gray-200">Development Tools</h3>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs text-gray-300">Mock Memory Retrieval</label>
              <button
                onClick={() => {
                  setMockMemoryEnabled(!mockMemoryEnabled);
                  onToggleMockMemory(!mockMemoryEnabled);
                }}
                className={`w-10 h-6 rounded-full transition-colors ${
                  mockMemoryEnabled ? 'bg-green-500' : 'bg-gray-600'
                } relative`}
              >
                <div
                  className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-transform ${
                    mockMemoryEnabled ? 'translate-x-5' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <label className="text-xs text-gray-300">Mock Summary Generation</label>
              <button
                onClick={() => {
                  setMockSummariesEnabled(!mockSummariesEnabled);
                  onToggleMockSummaries(!mockSummariesEnabled);
                }}
                className={`w-10 h-6 rounded-full transition-colors ${
                  mockSummariesEnabled ? 'bg-green-500' : 'bg-gray-600'
                } relative`}
              >
                <div
                  className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-transform ${
                    mockSummariesEnabled ? 'translate-x-5' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            <div className="pt-2 border-t border-gray-700">
              <p className="text-xs text-gray-400">
                Test the SubChat features:
              </p>
              <ul className="text-xs text-gray-400 mt-1 space-y-1">
                <li>• Click "New chat" to test memory options</li>
                <li>• Hover assistant messages for sub-chat menu</li>
                <li>• Use "Merge & Continue" to test summarization</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-3 bg-gray-900 text-white rounded-full shadow-lg hover:bg-gray-800 transition-colors"
        title="Development Tools"
      >
        {isOpen ? <EyeOff size={20} /> : <Settings size={20} />}
      </button>
    </div>
  );
}