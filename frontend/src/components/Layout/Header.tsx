import { Menu } from 'lucide-react';

interface HeaderProps {
  title?: string;
  onToggleSidebar?: () => void;
}

export function Header({ title = 'branchat', onToggleSidebar }: HeaderProps) {
  return (
    <header className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-[#343541]">
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleSidebar}
          className="md:hidden p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        >
          <Menu size={20} className="text-gray-700 dark:text-gray-300" />
        </button>

        <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
          {title}
        </h1>
      </div>
    </header>
  );
}
