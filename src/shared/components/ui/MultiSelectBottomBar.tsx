export interface BulkAction {
  id: string;
  label: string;
  icon: React.ReactNode;
  onAction: (selectedIds: string[]) => void;
  destructive?: boolean;
}

interface MultiSelectBottomBarProps {
  selectedCount: number;
  actions: BulkAction[];
  onClearSelection: () => void;
  visible?: boolean;
}

export function MultiSelectBottomBar({ selectedCount, actions, onClearSelection, visible = true }: MultiSelectBottomBarProps) {
  if (!visible || selectedCount === 0) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 px-4 py-3 shadow-lg safe-area-bottom">
      <div className="flex items-center justify-between max-w-lg mx-auto">
        <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
          {selectedCount} selected
        </span>
        <div className="flex items-center gap-2">
          {actions.map((action) => (
            <button
              key={action.id}
              onClick={() => action.onAction([])}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors min-h-[44px] min-w-[44px] ${
                action.destructive
                  ? 'bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-950/30 dark:text-red-400'
                  : 'bg-accent/10 text-accent hover:bg-accent/20'
              }`}
            >
              {action.icon}
              <span className="hidden sm:inline">{action.label}</span>
            </button>
          ))}
          <button
            onClick={onClearSelection}
            className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 min-h-[44px]"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}