import {
  Folder,
  File,
  FileText,
  Image,
  FileType,
  Eye,
  Trash2,
  MoreVertical,
  CheckSquare,
  Square,
} from 'lucide-react';
import { Badge } from '@shared/components/ui/Badge';
import type { VaultFileItem } from '../stores/vaultStore';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'ico']);
const TEXT_EXTENSIONS = new Set([
  'txt',
  'md',
  'csv',
  'json',
  'xml',
  'html',
  'css',
  'js',
  'ts',
  'yaml',
  'yml',
  'toml',
  'ini',
  'cfg',
  'log',
  'env',
  'sh',
  'bat',
  'sql',
  'svg',
]);

function getFileIcon(name: string): typeof FileText {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  if (IMAGE_EXTENSIONS.has(ext)) return Image;
  if (TEXT_EXTENSIONS.has(ext)) return FileText;
  if (ext === 'pdf') return FileType;
  return File;
}

function getExtension(name: string): string {
  const idx = name.lastIndexOf('.');
  return idx === -1 ? '' : name.slice(idx).toLowerCase();
}

function canPreview(name: string): boolean {
  const ext = getExtension(name);
  return IMAGE_EXTENSIONS.has(ext.slice(1)) || TEXT_EXTENSIONS.has(ext.slice(1)) || ext === '.pdf';
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface VaultFileCardProps {
  entry: VaultFileItem;
  viewMode: 'grid' | 'list';
  onNavigate: (path: string) => void;
  onPreview: (entry: VaultFileItem) => void;
  onDelete: (path: string) => void;
  selectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: (path: string) => void;
  /** Index for stagger animation delay */
  index?: number;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function VaultFileCard({
  entry,
  viewMode,
  onNavigate,
  onPreview,
  onDelete,
  selectionMode = false,
  isSelected = false,
  onToggleSelect,
  index,
}: VaultFileCardProps) {
  const handleClick = () => {
    if (entry.isDir) {
      onNavigate(entry.path);
    }
  };

  const handleDoubleClick = () => {
    if (!entry.isDir && canPreview(entry.name)) {
      onPreview(entry);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (entry.isDir) {
        onNavigate(entry.path);
      } else if (canPreview(entry.name)) {
        onPreview(entry);
      }
    }
  };

  const showPreview = !entry.isDir && canPreview(entry.name);

  // ── Grid view ────────────────────────────────────────────────
  if (viewMode === 'grid') {
    return (
      <>
        <style>{`@keyframes fadeSlideIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }`}</style>
        <div
          role="button"
          tabIndex={0}
          onClick={() => {
            if (selectionMode && onToggleSelect) {
              onToggleSelect(entry.path);
            } else {
              handleClick();
            }
          }}
          onDoubleClick={!selectionMode ? handleDoubleClick : undefined}
          onKeyDown={handleKeyDown}
          className={`animate-[fadeSlideIn_200ms_ease-out] group flex flex-col items-center gap-2 p-4 rounded-lg border transition-all cursor-pointer focus:outline-none focus:ring-1 focus:ring-accent ${
            isSelected
              ? 'border-accent/40 bg-accent/5 shadow-sm'
              : 'border-border-secondary bg-bg-secondary hover:border-accent/25 hover:shadow-md'
          }`}
          style={{ animationDelay: `${(index ?? 0) * 30}ms` }}
          aria-label={entry.isDir ? `Folder: ${entry.name}` : `File: ${entry.name}`}
        >
          {/* Selection checkbox */}
          {selectionMode && onToggleSelect && (
            <div className="self-start -mt-1 -ml-1" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={() => onToggleSelect(entry.path)}
                className="p-0.5 text-text-tertiary hover:text-accent transition-colors"
                aria-label={isSelected ? `Deselect ${entry.name}` : `Select ${entry.name}`}
              >
                {isSelected ? (
                  <CheckSquare size={16} className="text-accent" />
                ) : (
                  <Square size={16} />
                )}
              </button>
            </div>
          )}

          <div className="relative">
            {entry.isDir ? (
              <Folder size={36} className="text-accent shrink-0" aria-hidden="true" />
            ) : (
              (() => {
                const Icon = getFileIcon(entry.name);
                return (
                  <Icon size={36} className="text-text-tertiary shrink-0" aria-hidden="true" />
                );
              })()
            )}
          </div>

          <span className="text-xs text-center text-text-primary truncate w-full max-w-[120px]">
            {entry.name}
          </span>

          {entry.category && entry.category !== 'other' && entry.category !== 'folder' && (
            <Badge variant="info" size="sm" className="mt-1">
              {entry.category}
            </Badge>
          )}

          {/* Hover actions (hidden in selection mode) */}
          {!selectionMode && (
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              {showPreview && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onPreview(entry);
                  }}
                  className="p-1 text-text-tertiary hover:text-text-primary hover:bg-bg-hover rounded transition-colors"
                  title="Preview"
                  aria-label={`Preview ${entry.name}`}
                >
                  <Eye size={14} />
                </button>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(entry.path);
                }}
                className="p-1 text-text-tertiary hover:text-danger-text hover:bg-danger-bg/10 rounded transition-colors"
                title="Delete"
                aria-label={`Delete ${entry.name}`}
              >
                <Trash2 size={14} />
              </button>
            </div>
          )}
        </div>
      </>
    );
  }

  // ── List view ────────────────────────────────────────────────
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => {
        if (selectionMode && onToggleSelect) {
          onToggleSelect(entry.path);
        } else {
          handleClick();
        }
      }}
      onDoubleClick={!selectionMode ? handleDoubleClick : undefined}
      onKeyDown={handleKeyDown}
      className={`animate-[fadeSlideIn_200ms_ease-out] flex items-center gap-3 px-4 py-3 border-b border-border-secondary cursor-pointer transition-colors focus:outline-none focus:ring-1 focus:ring-accent focus:ring-inset ${
        isSelected ? 'bg-accent/5 border-accent/20' : 'hover:bg-bg-hover'
      }`}
      style={{ animationDelay: `${(index ?? 0) * 30}ms` }}
      aria-label={entry.isDir ? `Folder: ${entry.name}` : `File: ${entry.name}`}
    >
      {/* Selection checkbox */}
      {selectionMode && onToggleSelect && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleSelect(entry.path);
          }}
          className="p-0.5 text-text-tertiary hover:text-accent transition-colors"
          aria-label={isSelected ? `Deselect ${entry.name}` : `Select ${entry.name}`}
        >
          {isSelected ? <CheckSquare size={16} className="text-accent" /> : <Square size={16} />}
        </button>
      )}

      {entry.isDir ? (
        <Folder size={16} className="text-accent shrink-0" aria-hidden="true" />
      ) : (
        (() => {
          const Icon = getFileIcon(entry.name);
          return <Icon size={16} className="text-text-tertiary shrink-0" aria-hidden="true" />;
        })()
      )}

      <span className="flex-1 text-sm truncate flex items-center gap-2">
        {entry.name}
        {entry.category && entry.category !== 'other' && entry.category !== 'folder' && (
          <Badge variant="info" size="sm" className="shrink-0">
            {entry.category}
          </Badge>
        )}
      </span>

      {!selectionMode && (
        <div className="flex items-center gap-1 shrink-0">
          {showPreview && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onPreview(entry);
              }}
              className="p-1.5 text-text-tertiary hover:text-text-primary hover:bg-bg-hover rounded transition-colors"
              title="Preview"
              aria-label={`Preview ${entry.name}`}
            >
              <Eye size={14} />
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(entry.path);
            }}
            className="p-1.5 text-text-tertiary hover:text-danger-text hover:bg-danger-bg/10 rounded transition-colors"
            title="Delete"
            aria-label={`Delete ${entry.name}`}
          >
            <Trash2 size={14} />
          </button>
          <button
            onClick={(e) => e.stopPropagation()}
            className="p-1.5 text-text-tertiary hover:text-text-primary hover:bg-bg-hover rounded transition-colors"
            title="More options"
            aria-label={`More options for ${entry.name}`}
          >
            <MoreVertical size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
