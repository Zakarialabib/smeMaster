/**
 * ConflictResolutionPanel
 *
 * Animated slide-in drawer from the right that presents sync merge conflicts
 * to the user. Lists unresolved conflicts, shows a side-by-side diff view
 * for the active conflict, and offers "Keep Local", "Keep Remote", and
 * "Merge Both" resolution actions.
 *
 * Uses the shared SlidePanel component for animation, backdrop, and
 * responsive behavior (right sidebar on desktop, bottom sheet on mobile).
 */
import { useCallback, useEffect } from "react";
import {
  GitCompareArrows,
  CheckCircle2,
  AlertCircle,
  Mail,
  User,
  CheckSquare,
  Calendar,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useConflictStore } from "../stores/conflictStore";
import type { SyncConflict } from "../stores/conflictStore";
import { cn } from "@shared/utils/cn";
import { Button } from "@shared/components/ui/Button";
import { SlidePanel } from "@shared/components/ui/SlidePanel";

// ── Entity type icon map ────────────────────────────────────────────────

const ENTITY_ICONS: Record<SyncConflict["entityType"], LucideIcon> = {
  thread: Mail,
  contact: User,
  task: CheckSquare,
  calendar: Calendar,
};

// ── Helpers ──────────────────────────────────────────────────────────────

function formatEntityType(type: SyncConflict["entityType"]): string {
  return type.charAt(0).toUpperCase() + type.slice(1);
}

// ── Props ────────────────────────────────────────────────────────────────

interface ConflictResolutionPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

// ── Component ────────────────────────────────────────────────────────────

export function ConflictResolutionPanel({
  isOpen,
  onClose,
}: ConflictResolutionPanelProps) {
  const conflicts = useConflictStore((s) => s.conflicts);
  const activeConflictId = useConflictStore((s) => s.activeConflictId);
  const setActiveConflict = useConflictStore((s) => s.setActiveConflict);
  const resolveConflict = useConflictStore((s) => s.resolveConflict);
  const dismissAll = useConflictStore((s) => s.dismissAll);

  // Auto-select first unresolved conflict
  useEffect(() => {
    if (isOpen && !activeConflictId) {
      const unresolved = conflicts.find((c) => !c.resolved);
      if (unresolved) {
        setActiveConflict(unresolved.id);
      }
    }
  }, [isOpen, activeConflictId, conflicts, setActiveConflict]);

  const unresolvedConflicts = conflicts.filter((c) => !c.resolved);
  const activeConflict = activeConflictId
    ? conflicts.find((c) => c.id === activeConflictId)
    : null;
  const allResolved =
    conflicts.length > 0 && unresolvedConflicts.length === 0;

  const handleResolve = useCallback(
    (resolution: "local" | "remote" | "merge") => {
      if (!activeConflict) return;
      resolveConflict(activeConflict.id, resolution);
      // Move to next unresolved conflict or clear active
      const remaining = unresolvedConflicts.filter(
        (c) => c.id !== activeConflict.id,
      );
      if (remaining.length > 0) {
        setActiveConflict(remaining[0]!.id);
      } else {
        setActiveConflict(null);
      }
    },
    [activeConflict, resolveConflict, unresolvedConflicts, setActiveConflict],
  );

  return (
    <SlidePanel
      isOpen={isOpen}
      onClose={onClose}
      title="Sync Conflicts"
      headerIcon={<GitCompareArrows size={18} className="text-accent" />}
      headerChildren={
        unresolvedConflicts.length > 0 ? (
          <span className="bg-danger/15 text-danger text-[10px] font-medium px-1.5 py-0.5 rounded-full">
            {unresolvedConflicts.length}
          </span>
        ) : null
      }
      widthClass="max-w-[520px]"
    >
      {/* ── All resolved state ─────────────────────────────── */}
      {allResolved && (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6 py-12">
          <div className="p-3 rounded-full bg-success/10">
            <CheckCircle2 size={32} className="text-success" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-text-primary">
              All conflicts resolved
            </p>
            <p className="text-xs text-text-tertiary mt-1">
              Your data is in sync.
            </p>
          </div>
          <Button variant="secondary" size="sm" onClick={dismissAll}>
            Dismiss
          </Button>
        </div>
      )}

      {/* ── Empty state ────────────────────────────────────── */}
      {conflicts.length === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6 py-12">
          <div className="p-3 rounded-full bg-accent/10">
            <GitCompareArrows size={32} className="text-accent/60" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-text-primary">
              No conflicts
            </p>
            <p className="text-xs text-text-tertiary mt-1">
              All sync operations completed without conflicts.
            </p>
          </div>
        </div>
      )}

      {/* ── Conflict list + diff ───────────────────────────── */}
      {!allResolved && conflicts.length > 0 && (
        <div className="flex flex-1 min-h-0 h-full">
          {/* Conflict list sidebar */}
          <div className="w-44 shrink-0 border-r border-border-primary overflow-y-auto bg-bg-secondary/50">
            {unresolvedConflicts.map((conflict) => {
              const Icon = ENTITY_ICONS[conflict.entityType];
              const isActive = conflict.id === activeConflictId;
              return (
                <button
                  key={conflict.id}
                  onClick={() => setActiveConflict(conflict.id)}
                  className={cn(
                    "w-full flex items-center gap-2 px-3 py-2.5 text-left transition-colors border-l-2",
                    isActive
                      ? "bg-accent/8 border-l-accent text-accent font-medium"
                      : "border-l-transparent text-text-secondary hover:bg-bg-hover hover:text-text-primary",
                  )}
                >
                  <Icon size={14} className="shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs truncate">
                      {conflict.localVersion.title}
                    </p>
                    <p className="text-[10px] text-text-tertiary mt-0.5">
                      {formatEntityType(conflict.entityType)}
                    </p>
                  </div>
                  {conflict.resolved && (
                    <CheckCircle2
                      size={12}
                      className="shrink-0 text-success"
                    />
                  )}
                </button>
              );
            })}
          </div>

          {/* Diff view */}
          <div className="flex-1 flex flex-col min-h-0">
            {activeConflict ? (
              <>
                {/* Side-by-side diff */}
                <div className="flex-1 overflow-y-auto p-3 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    {/* Local version */}
                    <div className="rounded-lg border border-border-primary overflow-hidden">
                      <div className="px-3 py-1.5 bg-bg-tertiary text-[10px] font-semibold text-text-secondary uppercase tracking-wider border-b border-border-primary">
                        Local Version
                      </div>
                      <div className="p-3 space-y-2">
                        <div>
                          <p className="text-[10px] text-text-tertiary uppercase tracking-wider mb-0.5">
                            Title
                          </p>
                          <p className="text-xs font-medium text-text-primary">
                            {activeConflict.localVersion.title}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] text-text-tertiary uppercase tracking-wider mb-0.5">
                            Summary
                          </p>
                          <p className="text-xs text-text-secondary leading-relaxed">
                            {activeConflict.localVersion.summary}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] text-text-tertiary uppercase tracking-wider mb-0.5">
                            Content
                          </p>
                          <p className="text-xs text-text-secondary leading-relaxed whitespace-pre-wrap">
                            {activeConflict.localVersion.content}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Remote version */}
                    <div className="rounded-lg border border-border-primary overflow-hidden">
                      <div className="px-3 py-1.5 bg-accent/8 text-[10px] font-semibold text-accent uppercase tracking-wider border-b border-border-primary">
                        Remote Version
                      </div>
                      <div className="p-3 space-y-2">
                        <div>
                          <p className="text-[10px] text-text-tertiary uppercase tracking-wider mb-0.5">
                            Title
                          </p>
                          <p className="text-xs font-medium text-text-primary">
                            {activeConflict.remoteVersion.title}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] text-text-tertiary uppercase tracking-wider mb-0.5">
                            Summary
                          </p>
                          <p className="text-xs text-text-secondary leading-relaxed">
                            {activeConflict.remoteVersion.summary}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] text-text-tertiary uppercase tracking-wider mb-0.5">
                            Content
                          </p>
                          <p className="text-xs text-text-secondary leading-relaxed whitespace-pre-wrap">
                            {activeConflict.remoteVersion.content}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Changed fields indicator */}
                  {diffFields(activeConflict).length > 0 && (
                    <div className="rounded-lg bg-warning/5 border border-warning/15 px-3 py-2">
                      <div className="flex items-center gap-1.5 mb-1">
                        <AlertCircle size={12} className="text-warning" />
                        <span className="text-[10px] font-semibold text-warning uppercase tracking-wider">
                          Changed fields
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {diffFields(activeConflict).map((field) => (
                          <span
                            key={field}
                            className="text-[10px] bg-warning/10 text-warning/80 px-1.5 py-0.5 rounded"
                          >
                            {field}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Action buttons */}
                <div className="shrink-0 border-t border-border-primary p-3 flex gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleResolve("local")}
                    className="flex-1 text-xs"
                  >
                    Keep Local
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleResolve("remote")}
                    className="flex-1 text-xs"
                  >
                    Keep Remote
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => handleResolve("merge")}
                    className="flex-1 text-xs"
                  >
                    Merge Both
                  </Button>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-xs text-text-tertiary">
                Select a conflict to view details
              </div>
            )}
          </div>
        </div>
      )}
    </SlidePanel>
  );
}

// ── Diff helper ─────────────────────────────────────────────────────────

function diffFields(conflict: SyncConflict): string[] {
  const fields: string[] = [];
  if (conflict.localVersion.title !== conflict.remoteVersion.title) {
    fields.push("Title");
  }
  if (conflict.localVersion.summary !== conflict.remoteVersion.summary) {
    fields.push("Summary");
  }
  if (conflict.localVersion.content !== conflict.remoteVersion.content) {
    fields.push("Content");
  }
  return fields;
}
