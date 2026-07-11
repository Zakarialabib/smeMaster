import { useBreakpoint } from '@/shared/hooks/useBreakpoint';

export interface AdaptiveColumn<T> {
  key: string;
  header: string;
  render: (item: T) => React.ReactNode;
  priority?: number;
  className?: string;
}

interface AdaptiveTableProps<T> {
  data: T[];
  columns: AdaptiveColumn<T>[];
  keyExtractor: (item: T) => string;
  onRowClick?: (item: T) => void;
  emptyState?: React.ReactNode;
  rowClassName?: string;
  cardTitle?: (item: T) => string;
}

function EmptyState() {
  return <div className="text-center py-8 text-gray-500">No items to display</div>;
}

export function AdaptiveTable<T>({ data, columns, keyExtractor, onRowClick, emptyState, rowClassName = '', cardTitle }: AdaptiveTableProps<T>) {
  const bp = useBreakpoint();
  const isMobile = bp === 'mobile';
  const isTablet = bp === 'tablet';

  if (isMobile) {
    const visibleColumns = columns.filter(c => (c.priority ?? 99) <= 3);
    return (
      <div className="space-y-2 p-2">
        {data.length === 0 && (emptyState ?? <EmptyState />)}
        {data.map((item) => (
          <button
            key={keyExtractor(item)}
            onClick={() => onRowClick?.(item)}
            className={`w-full text-left p-4 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-all active:scale-[0.98] ${rowClassName}`}
          >
            {cardTitle && (
              <div className="text-sm font-semibold mb-2 text-gray-900 dark:text-gray-100">
                {cardTitle(item)}
              </div>
            )}
            {visibleColumns.map((col) => (
              <div key={col.key} className="flex items-center gap-2 py-1">
                <span className="text-xs text-gray-500 dark:text-gray-400 w-20 shrink-0">{col.header}</span>
                <span className="text-sm truncate">{col.render(item)}</span>
              </div>
            ))}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 dark:border-gray-700">
            {columns.map((col) => (
              <th key={col.key} className={`px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400 ${isTablet && (col.priority ?? 99) > 2 ? 'hidden md:table-cell' : ''} ${col.className ?? ''}`}>
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 && (
            <tr><td colSpan={columns.length} className="py-8 text-center text-gray-500">{emptyState ?? <EmptyState />}</td></tr>
          )}
          {data.map((item) => (
            <tr
              key={keyExtractor(item)}
              onClick={() => onRowClick?.(item)}
              className={`border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer transition-colors ${rowClassName}`}
            >
              {columns.map((col) => (
                <td key={col.key} className={`px-4 py-3 ${isTablet && (col.priority ?? 99) > 2 ? 'hidden md:table-cell' : ''} ${col.className ?? ''}`}>
                  {col.render(item)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}