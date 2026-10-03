import { useEffect, useRef, useState } from 'react';
import { Columns3, RotateCcw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useColumnConfigStore, type ColumnConfigKey } from '@shared/stores/columnConfigStore';

export interface ColumnPickerProps {
  /** Which view's column set to edit — must match a key in `columnConfigStore`. */
  configKey: ColumnConfigKey;
  /** Icon-only trigger (for dense toolbars). */
  compact?: boolean;
}

/**
 * Show/hide columns for a list view (email, tasks, contacts).
 *
 * Read/write side lives in `columnConfigStore` — `ThreadCard` (email) and
 * `TaskListView` (tasks) already honour `visible`; this is the missing
 * control. Persisted to localStorage by the store.
 */
export function ColumnPicker({ configKey, compact = false }: ColumnPickerProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const columns = useColumnConfigStore((s) => s.columnVisibility[configKey]);
  const toggleColumn = useColumnConfigStore((s) => s.toggleColumn);
  const resetColumns = useColumnConfigStore((s) => s.resetColumns);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={t('columns.title')}
        title={t('columns.title')}
        className={`flex items-center gap-1.5 rounded-lg border px-2 py-1.5 text-xs transition-colors ${
          open
            ? 'border-accent/40 bg-accent/10 text-accent'
            : 'border-border-primary text-text-tertiary hover:text-text-primary'
        }`}
      >
        <Columns3 size={14} />
        {!compact && <span className="hidden sm:inline">{t('columns.title')}</span>}
      </button>

      {open && (
        <div
          role="menu"
          aria-label={t('columns.title')}
          className="absolute end-0 z-50 mt-1 min-w-44 rounded-lg border border-border-primary bg-bg-primary p-1.5 shadow-lg"
        >
          {columns.map((col) => (
            <label
              key={col.id}
              className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs text-text-primary hover:bg-bg-secondary"
            >
              <input
                type="checkbox"
                checked={col.visible}
                onChange={() => toggleColumn(configKey, col.id)}
                className="accent-[var(--color-accent)]"
              />
              <span>{col.label || t(`columns.ids.${col.id}`)}</span>
            </label>
          ))}

          <button
            type="button"
            onClick={() => resetColumns(configKey)}
            className="mt-1 flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-text-tertiary transition-colors hover:bg-bg-secondary hover:text-text-primary"
          >
            <RotateCcw size={12} />
            {t('columns.reset')}
          </button>
        </div>
      )}
    </div>
  );
}
