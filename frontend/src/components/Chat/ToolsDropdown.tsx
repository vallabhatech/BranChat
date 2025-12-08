import { useState } from 'react';
import { ChevronDown, Settings, Zap } from 'lucide-react';

interface ToolsDropdownProps {
  onToolSelect: (tool: string) => void;
}

export function ToolsDropdown({ onToolSelect }: ToolsDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);

  const tools = [
    { id: 'standard', label: 'Standard', icon: Zap, description: 'Fast and efficient responses' },
    { id: 'advanced', label: 'Advanced', icon: Settings, description: 'Enhanced reasoning capabilities' },
  ];

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800"
      >
        <Settings size={16} />
        <span className="font-medium">Tools</span>
        <ChevronDown size={14} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <>
          <div 
            className="fixed inset-0 z-10" 
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute top-full right-0 mt-1 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg z-20">
            {tools.map((tool) => {
              const IconComponent = tool.icon;
              return (
                <button
                  key={tool.id}
                  onClick={() => {
                    onToolSelect(tool.id);
                    setIsOpen(false);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors first:rounded-t-lg last:rounded-b-lg"
                >
                  <IconComponent size={16} className="text-gray-500 dark:text-gray-400" />
                  <div>
                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {tool.label}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {tool.description}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}