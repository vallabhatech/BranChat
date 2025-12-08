import { Image, PenTool, Code, Search, Video, ChevronDown } from 'lucide-react';

interface ActionButtonsProps {
  onActionClick: (action: string) => void;
}

export function ActionButtons({ onActionClick }: ActionButtonsProps) {
  const actions = [
    { id: 'image', label: 'Create Image', icon: Image },
    { id: 'write', label: 'Write', icon: PenTool },
    { id: 'build', label: 'Build', icon: Code },
    { id: 'research', label: 'Deep Research', icon: Search },
    { id: 'video', label: 'Create video', icon: Video },
  ];

  return (
    <div className="flex flex-wrap gap-3 justify-center mb-12 max-w-2xl mx-auto">
      {actions.map((action) => {
        const IconComponent = action.icon;
        return (
          <button
            key={action.id}
            onClick={() => onActionClick(action.id)}
            className="flex items-center gap-3 px-4 py-3 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-all duration-200 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600 hover:shadow-sm hover:border-gray-300 dark:hover:border-gray-500"
          >
            <IconComponent size={18} />
            <span className="text-sm font-medium">{action.label}</span>
          </button>
        );
      })}
    </div>
  );
}