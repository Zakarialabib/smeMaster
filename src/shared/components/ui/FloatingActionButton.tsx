import { useState } from 'react';
import { usePlatform } from '@/shared/hooks/usePlatform';

export interface FabAction {
  id: string;
  label: string;
  icon: React.ReactNode;
  onAction: () => void;
}

interface FloatingActionButtonProps {
  actions: FabAction[];
  maxActions?: number;
  className?: string;
}

export function FloatingActionButton({ actions, maxActions = 5, className = '' }: FloatingActionButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { screen } = usePlatform();
  const isMobile = screen.category === 'phone' || screen.category === 'phone-folded';
  const isTablet = screen.category === 'tablet';

  const visibleActions = actions.slice(0, maxActions);

  if (!isMobile && !isTablet) {
    return (
      <div className={`flex items-center gap-1 ${className}`}>
        {visibleActions.map((action) => (
          <button
            key={action.id}
            onClick={action.onAction}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md hover:bg-accent/10 transition-colors min-h-[44px]"
            title={action.label}
          >
            {action.icon}
            <span className="hidden sm:inline">{action.label}</span>
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className={`fixed bottom-20 right-4 z-50 flex flex-col items-end gap-2 ${className}`}>
      {isOpen && visibleActions.map((action, i) => (
        <button
          key={action.id}
          onClick={() => { action.onAction(); setIsOpen(false); }}
          className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-gray-800 rounded-full shadow-lg border border-gray-200 dark:border-gray-700 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-all animate-fade-in min-h-[44px]"
          style={{ animationDelay: `${i * 30}ms` }}
        >
          {action.icon}
          {action.label}
        </button>
      ))}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-14 h-14 rounded-full bg-accent text-white shadow-lg hover:bg-accent/90 transition-transform active:scale-95 flex items-center justify-center"
        aria-label={isOpen ? 'Close actions' : 'Open actions'}
        style={{ transform: isOpen ? 'rotate(45deg)' : 'rotate(0deg)' }}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
      </button>
    </div>
  );
}