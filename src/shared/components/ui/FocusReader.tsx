import { useState, useEffect, useRef, useCallback } from 'react';

interface FocusReaderAction {
  label: string;
  icon: React.ReactNode;
  onAction: () => void;
  destructive?: boolean;
}

interface FocusReaderProps {
  children: React.ReactNode;
  onBack?: () => void;
  actions?: FocusReaderAction[];
  className?: string;
  autoHideToolbar?: boolean;
}

export function FocusReader({ children, onBack, actions = [], className = '', autoHideToolbar = true }: FocusReaderProps) {
  const [showToolbar, setShowToolbar] = useState(true);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const revealToolbar = useCallback(() => {
    if (!autoHideToolbar) return;
    setShowToolbar(true);
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setShowToolbar(false), 3000);
  }, [autoHideToolbar]);

  useEffect(() => {
    revealToolbar();
    return () => clearTimeout(hideTimer.current);
  }, [revealToolbar]);

  return (
    <div
      className={`fixed inset-0 z-50 bg-white dark:bg-gray-900 flex flex-col ${className}`}
      onClick={revealToolbar}
    >
      <div
        className={`flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-800 transition-opacity duration-300 ${
          showToolbar ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        <button
          onClick={(e) => { e.stopPropagation(); onBack?.(); }}
          className="flex items-center gap-2 text-sm font-medium hover:text-accent transition-colors min-h-[44px]"
          aria-label="Back"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m15 18-6-6 6-6"/></svg>
          Back
        </button>
        <div className="flex items-center gap-1">
          {actions.map((action) => (
            <button
              key={action.label}
              onClick={(e) => { e.stopPropagation(); action.onAction(); }}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm rounded-md transition-colors min-h-[44px] ${
                action.destructive
                  ? 'text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30'
                  : 'hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
            >
              {action.icon}
              <span className="hidden sm:inline">{action.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-2">
        {children}
      </div>
    </div>
  );
}