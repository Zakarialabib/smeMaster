export type ViewMode = 'list' | 'card' | 'board' | 'calendar';

interface ViewSwitcherProps {
  activeView: ViewMode;
  onViewChange: (view: ViewMode) => void;
  availableViews?: ViewMode[];
  className?: string;
}

const VIEW_ICONS: Record<ViewMode, string> = {
  list: '☰',
  card: '⊞',
  board: '≡',
  calendar: '📅',
};

const VIEW_LABELS: Record<ViewMode, string> = {
  list: 'List',
  card: 'Cards',
  board: 'Board',
  calendar: 'Calendar',
};

export function ViewSwitcher({ activeView, onViewChange, availableViews = ['list', 'card', 'board'], className = '' }: ViewSwitcherProps) {
  return (
    <div className={`flex items-center gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-lg ${className}`}>
      {availableViews.map((view) => (
        <button
          key={view}
          onClick={() => onViewChange(view)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all min-h-[44px] ${
            activeView === view
              ? 'bg-white dark:bg-gray-700 text-accent shadow-sm'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
          }`}
          aria-label={VIEW_LABELS[view]}
        >
          <span className="text-base">{VIEW_ICONS[view]}</span>
          <span className="hidden sm:inline">{VIEW_LABELS[view]}</span>
        </button>
      ))}
    </div>
  );
}