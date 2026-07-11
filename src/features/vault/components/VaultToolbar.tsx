import { ArrowUpDown, ArrowUp, ArrowDown, LayoutGrid, List } from 'lucide-react';
import { useVaultStore, type VaultSortField } from '../stores/vaultStore';

interface VaultToolbarProps {
  className?: string;
}

const CATEGORIES = [
  { value: null as string | null, label: 'All' },
  { value: 'images', label: 'Images' },
  { value: 'documents', label: 'Documents' },
  { value: 'archives', label: 'Archives' },
  { value: 'code', label: 'Code' },
  { value: 'email', label: 'Email' },
  { value: 'other', label: 'Other' },
];

export function VaultToolbar({ className = '' }: VaultToolbarProps) {
  const {
    viewMode,
    setViewMode,
    sortField,
    setSortField,
    sortDirection,
    toggleSortDirection,
    categoryFilter,
    setCategoryFilter,
  } = useVaultStore();

  const sortOptions: { field: VaultSortField; label: string }[] = [
    { field: 'name', label: 'Name' },
    { field: 'date', label: 'Date' },
    { field: 'size', label: 'Size' },
  ];

  return (
    <>
      <div
        className={`flex items-center gap-2 ${className}`}
        role="toolbar"
        aria-label="File list controls"
      >
        {/* Sort controls */}
        <div className="flex items-center gap-1">
          {sortOptions.map((opt) => (
            <button
              key={opt.field}
              onClick={() => {
                if (sortField === opt.field) {
                  toggleSortDirection();
                } else {
                  setSortField(opt.field);
                }
              }}
              className={`
                flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors
                ${
                  sortField === opt.field
                    ? 'bg-accent/10 text-accent font-medium'
                    : 'text-text-tertiary hover:text-text-primary hover:bg-bg-hover'
                }
              `}
              aria-label={`Sort by ${opt.field}${sortField === opt.field ? `, ${sortDirection === 'asc' ? 'ascending' : 'descending'}` : ''}`}
              aria-pressed={sortField === opt.field}
            >
              {sortField === opt.field ? (
                sortDirection === 'asc' ? (
                  <ArrowUp size={12} aria-hidden="true" />
                ) : (
                  <ArrowDown size={12} aria-hidden="true" />
                )
              ) : (
                <ArrowUpDown size={12} aria-hidden="true" />
              )}
              {opt.label}
            </button>
          ))}
        </div>

        {/* View mode toggle */}
        <div
          className="flex items-center bg-bg-secondary rounded-md border border-border-primary ml-auto"
          role="radiogroup"
          aria-label="View mode"
        >
          <button
            onClick={() => setViewMode('grid')}
            className={`p-1.5 rounded-l-md transition-colors ${
              viewMode === 'grid'
                ? 'bg-accent/10 text-accent'
                : 'text-text-tertiary hover:text-text-primary'
            }`}
            role="radio"
            aria-checked={viewMode === 'grid'}
            aria-label="Grid view"
          >
            <LayoutGrid size={14} />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-1.5 rounded-r-md transition-colors ${
              viewMode === 'list'
                ? 'bg-accent/10 text-accent'
                : 'text-text-tertiary hover:text-text-primary'
            }`}
            role="radio"
            aria-checked={viewMode === 'list'}
            aria-label="List view"
          >
            <List size={14} />
          </button>
        </div>
      </div>

      {/* Category filter chips */}
      <div className={`flex gap-1.5 flex-wrap mt-2 ${className}`}>
        {CATEGORIES.map((chip) => (
          <button
            key={chip.label}
            onClick={() => setCategoryFilter(chip.value)}
            className={`px-2.5 py-0.5 text-xs rounded-full transition-colors ${
              categoryFilter === chip.value
                ? 'bg-primary text-primary-foreground font-medium'
                : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
            }`}
            aria-pressed={categoryFilter === chip.value}
            aria-label={`Filter by ${chip.label}`}
          >
            {chip.label}
          </button>
        ))}
      </div>
    </>
  );
}
