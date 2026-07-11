interface ZenModeProps {
  children: React.ReactNode;
  isActive: boolean;
  onExit: () => void;
  title?: string;
  onSave?: () => void;
  onSend?: () => void;
  className?: string;
}

export function ZenMode({ children, isActive, onExit, title, onSave, onSend, className = '' }: ZenModeProps) {
  if (!isActive) {
    return <>{children}</>;
  }

  return (
    <div className={`fixed inset-0 z-50 bg-white dark:bg-gray-900 flex flex-col ${className}`}>
      {/* Minimal top bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 dark:border-gray-800">
        <button
          onClick={onExit}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors min-h-[44px]"
          aria-label="Exit zen mode"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m15 18-6-6 6-6"/></svg>
          <span className="hidden sm:inline">Exit</span>
        </button>

        {title && (
          <span className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate mx-2">
            {title}
          </span>
        )}

        <div className="flex items-center gap-2">
          {onSave && (
            <button
              onClick={onSave}
              className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors min-h-[36px]"
            >
              Save
            </button>
          )}
          {onSend && (
            <button
              onClick={onSend}
              className="px-4 py-1.5 text-sm font-medium bg-accent text-white rounded-md hover:bg-accent/90 transition-colors min-h-[36px]"
            >
              Send
            </button>
          )}
        </div>
      </div>

      {/* Full-screen content area */}
      <div className="flex-1 overflow-y-auto">
        {children}
      </div>
    </div>
  );
}