import { useState, useCallback, useEffect } from "react";
import { Plus, Check, Pencil, Trash2 } from "lucide-react";
import { useLayoutStore } from "@shared/stores/layoutStore";
import { useActiveLabel } from "@shared/hooks/useRouteNavigation";
import { navigateToLabel } from "@/router/navigate";

export interface SavedView {
  id: string;
  name: string;
  /** Label/folder to navigate to */
  label: string;
  /** Optional category within the label */
  category?: string;
  /** Optional filter overrides */
  filters?: Record<string, string>;
  /** Optional icon override */
  icon?: string;
  /** Sort order */
  order: number;
}

const STORAGE_KEY = "smemaster-saved-views";

function loadViews(): SavedView[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as SavedView[]) : [];
  } catch {
    return [];
  }
}

function saveViews(views: SavedView[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(views));
}

const DEFAULT_VIEWS: SavedView[] = [
  { id: "all", name: "All Mail", label: "inbox", order: 0 },
  { id: "unread", name: "Unread", label: "inbox", category: "Unread", order: 1 },
  { id: "flagged", name: "Flagged", label: "starred", order: 2 },
  { id: "newsletters", name: "Newsletters", label: "inbox", category: "Newsletters", order: 4 },
];

/**
 * SavedViews — chip-based view switcher for split inbox.
 *
 * Displays saved view chips above the email list. Users can:
 * - Tap a chip to switch views
 * - Tap "+" to save the current view
 * - Long-press/right-click to edit or delete a view
 */
export function SavedViews() {
  const activeLabel = useActiveLabel();
  const inboxViewMode = useLayoutStore((s) => s.inboxViewMode);
  const setInboxViewMode = useLayoutStore((s) => s.setInboxViewMode);

  const [views, setViews] = useState<SavedView[]>(() => {
    const stored = loadViews();
    // Merge with defaults (defaults are always present, user additions supplement)
    const merged = new Map<string, SavedView>();
    for (const v of DEFAULT_VIEWS) merged.set(v.id, v);
    for (const v of stored) merged.set(v.id, v);
    return [...merged.values()].sort((a, b) => a.order - b.order);
  });

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  useEffect(() => {
    saveViews(views);
  }, [views]);

  const activeViewId = views.find(
    (v) => v.label === activeLabel || v.category === activeLabel,
  )?.id ?? "all";

  const handleSelectView = useCallback((view: SavedView) => {
    if (inboxViewMode !== "split") {
      setInboxViewMode("split");
    }
    navigateToLabel(view.label, { category: view.category });
  }, [inboxViewMode, setInboxViewMode]);

  const handleSaveCurrent = useCallback(() => {
    const newView: SavedView = {
      id: `custom-${Date.now()}`,
      name: activeLabel ?? "View",
      label: activeLabel ?? "inbox",
      order: views.length,
    };
    setViews((prev) => [...prev, newView]);
    setEditingId(newView.id);
    setEditName(newView.name);
  }, [activeLabel, views.length]);

  const handleRename = useCallback((id: string, name: string) => {
    setViews((prev) => prev.map((v) => (v.id === id ? { ...v, name } : v)));
    setEditingId(null);
  }, []);

  const handleDelete = useCallback((id: string) => {
    setViews((prev) => prev.filter((v) => v.id !== id));
  }, []);

  if (views.length <= 1) return null;

  return (
    <div className="flex items-center gap-1.5 px-3 py-2 overflow-x-auto no-scrollbar">
      {views.map((view) => (
        <div key={view.id} className="relative group shrink-0">
          {editingId === view.id ? (
            <div className="flex items-center gap-0.5">
              <input
                autoFocus
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleRename(view.id, editName);
                  if (e.key === "Escape") setEditingId(null);
                }}
                onBlur={() => handleRename(view.id, editName)}
                className="w-24 px-1.5 py-0.5 text-xs bg-bg-secondary border border-accent/30 rounded outline-none text-text-primary"
              />
              <button
                onClick={() => handleRename(view.id, editName)}
                className="p-0.5 text-accent"
              >
                <Check size={12} />
              </button>
            </div>
          ) : (
            <div
              role="button"
              tabIndex={0}
              aria-label={`Switch to ${view.name} view`}
              onClick={() => handleSelectView(view)}
              onKeyDown={(e: React.KeyboardEvent) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handleSelectView(view);
                }
              }}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                activeViewId === view.id
                  ? "bg-accent/15 text-accent border border-accent/30"
                  : "bg-bg-secondary/60 text-text-secondary border border-border-secondary/50 hover:bg-bg-hover"
              }`}
            >
              {view.id === activeViewId && <Check size={10} className="shrink-0" />}
              {view.name}
              {/* Rename/delete for custom views */}
              {view.id.startsWith("custom-") && (
                <span className="hidden group-hover:flex items-center gap-0.5 ml-1">
                  <button
                    onClick={(e) => { e.stopPropagation(); setEditingId(view.id); setEditName(view.name); }}
                    className="p-0.5 text-text-tertiary hover:text-text-primary"
                  >
                    <Pencil size={10} />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(view.id); }}
                    className="p-0.5 text-text-tertiary hover:text-danger"
                  >
                    <Trash2 size={10} />
                  </button>
                </span>
              )}
            </div>
          )}
        </div>
      ))}

      {/* Add current view */}
      <button
        onClick={handleSaveCurrent}
        className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium text-text-tertiary border border-dashed border-border-secondary hover:text-text-secondary hover:border-border-primary transition-colors shrink-0"
      >
        <Plus size={12} />
        Save view
      </button>
    </div>
  );
}
