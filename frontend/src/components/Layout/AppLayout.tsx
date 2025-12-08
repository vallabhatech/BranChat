import { ReactNode } from 'react';
import { Sidebar } from './Sidebar';

interface AppLayoutProps {
  children: ReactNode;
  showSidebar?: boolean;
  onToggleSidebar?: () => void;
}

export function AppLayout({ children, showSidebar = true, onToggleSidebar }: AppLayoutProps) {
  return (
    <div className="flex h-screen bg-white dark:bg-[#343541]">
      {showSidebar && (
        <div className="hidden md:flex md:w-[260px] md:flex-col">
          <Sidebar onClose={() => onToggleSidebar?.()} />
        </div>
      )}

      <div className="flex-1 flex flex-col overflow-hidden">
        {children}
      </div>
    </div>
  );
}
