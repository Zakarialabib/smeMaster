import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  Clock,
  RotateCcw,
  Repeat,
  Save,
  X,
  GripVertical,
  Pencil,
  AlertTriangle,
  Check,
  Search,
  Star,
} from "lucide-react";
import { useAccountStore } from "@features/accounts/stores/accountStore";
import {
  getSnoozePresets,
  upsertSnoozePreset,
  deleteSnoozePreset,
  type SnoozePreset,
} from "@features/calendar/db/snoozePresets";
import { TextField } from "@shared/components/ui/TextField";
import { cn } from "@shared/utils/cn";

// ─── Duration Formatter ───
const formatDuration = (minutes: number) => {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
};

// ─── Duration Bar Visual ───
const DurationBar = ({ minutes }: { minutes: number }) => {
  const maxMinutes = 480; // 8h as visual max
  const pct = Math.min(100, (minutes / maxMinutes) * 100);
  return (
    <div className="w-16 h-1.5 bg-bg-tertiary rounded-full overflow-hidden shrink-0">
      <div
        className="h-full bg-accent/60 rounded-full transition-all"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
};

// ─── Form Component ───
interface SnoozePresetFormProps {
  preset?: SnoozePreset;
  onSave: (preset: {
    id?: string;
    label: string;
    durationMinutes: number;
    isRecurring: boolean;
  }) => void;
  onCancel: () => void;
}

function SnoozePresetForm({ preset, onSave, onCancel }: SnoozePresetFormProps) {
  const { t } = useTranslation();
  const [label, setLabel] = useState(preset?.label ?? "");
  const [hours, setHours] = useState(
    preset ? Math.floor(preset.duration_minutes / 60) : 0,
  );
  const [minutes, setMinutes] = useState(
    preset ? preset.duration_minutes % 60 : 30,
  );
  const [isRecurring, setIsRecurring] = useState(
    preset ? preset.is_recurring === 1 : false,
  );

  const handleSubmit = () => {
    if (!label.trim()) return;
    onSave({
      id: preset?.id,
      label: label.trim(),
      durationMinutes: hours * 60 + minutes,
      isRecurring,
    });
  };

  const quickDurations = [
    { label: "15m", h: 0, m: 15 },
    { label: "30m", h: 0, m: 30 },
    { label: "1h", h: 1, m: 0 },
    { label: "2h", h: 2, m: 0 },
    { label: "4h", h: 4, m: 0 },
    { label: "Tomorrow", h: 24, m: 0 },
  ];

  return (
    <div className="rounded-2xl border border-accent/20 bg-accent/5 p-5 space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
      <div className="flex items-center gap-2 mb-1">
        <div className="p-1.5 rounded-lg bg-accent/10 text-accent">
          {preset ? <Pencil size={14} /> : <Plus size={14} />}
        </div>
        <h4 className="text-sm font-bold text-text-primary">
          {preset ? t("snooze.editPreset") || "Edit Preset" : t("snooze.newPreset") || "New Preset"}
        </h4>
      </div>

      <div className="space-y-3">
        <div>
          <label className="text-[10px] font-bold uppercase tracking-wider text-text-tertiary mb-1.5 block">
            Preset Name
          </label>
          <TextField
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder={t("snooze.presetName")}
            autoFocus
          />
        </div>

        <div>
          <label className="text-[10px] font-bold uppercase tracking-wider text-text-tertiary mb-1.5 block">
            Duration
          </label>
          <div className="flex items-center gap-2">
            <div className="relative">
              <input
                type="number"
                value={hours}
                onChange={(e) => setHours(Math.max(0, parseInt(e.target.value) || 0))}
                min={0}
                className="w-20 bg-bg-primary text-text-primary text-sm px-3 py-2 rounded-xl border border-border outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all text-center font-mono"
              />
              <span className="absolute end-2 top-1/2 -translate-y-1/2 text-[10px] text-text-tertiary font-medium">
                h
              </span>
            </div>
            <span className="text-text-tertiary font-bold">:</span>
            <div className="relative">
              <input
                type="number"
                value={minutes}
                onChange={(e) =>
                  setMinutes(Math.min(59, Math.max(0, parseInt(e.target.value) || 0)))
                }
                min={0}
                max={59}
                className="w-20 bg-bg-primary text-text-primary text-sm px-3 py-2 rounded-xl border border-border outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all text-center font-mono"
              />
              <span className="absolute end-2 top-1/2 -translate-y-1/2 text-[10px] text-text-tertiary font-medium">
                m
              </span>
            </div>
            <div className="h-px w-4 bg-border" />
            <span className="text-xs font-medium text-accent bg-accent/10 px-2.5 py-1.5 rounded-lg border border-accent/20">
              {formatDuration(hours * 60 + minutes)}
            </span>
          </div>

          {/* Quick picks */}
          <div className="flex flex-wrap gap-1.5 mt-2">
            {quickDurations.map((qd) => (
              <button
                key={qd.label}
                type="button"
                onClick={() => {
                  setHours(qd.h);
                  setMinutes(qd.m);
                }}
                className={cn(
                  "px-2.5 py-1 text-[10px] font-semibold rounded-lg border transition-all active:scale-95",
                  hours === qd.h && minutes === qd.m
                    ? "bg-accent text-white border-accent shadow-sm"
                    : "bg-bg-primary text-text-secondary border-border hover:border-accent/30 hover:text-accent"
                )}
              >
                {qd.label}
              </button>
            ))}
          </div>
        </div>

        <label className="flex items-center gap-3 p-3 rounded-xl bg-bg-primary border border-border/50 cursor-pointer hover:border-accent/20 transition-colors">
          <div
            className={cn(
              "w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all",
              isRecurring
                ? "bg-accent border-accent"
                : "border-border bg-bg-primary"
            )}
            onClick={() => setIsRecurring(!isRecurring)}
          >
            {isRecurring && <Check size={12} className="text-white" />}
          </div>
          <div className="flex items-center gap-2">
            <Repeat size={14} className={cn("transition-colors", isRecurring ? "text-accent" : "text-text-tertiary")} />
            <div>
              <span className="text-sm font-medium text-text-primary block leading-tight">
                {t("campaign.recurring")}
              </span>
              <span className="text-[10px] text-text-tertiary">
                Automatically re-snooze on the same schedule
              </span>
            </div>
          </div>
          <input
            type="checkbox"
            checked={isRecurring}
            onChange={(e) => setIsRecurring(e.target.checked)}
            className="sr-only"
          />
        </label>
      </div>

      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={handleSubmit}
          disabled={!label.trim()}
          className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-accent hover:bg-accent-hover rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-sm active:scale-95"
        >
          <Save size={13} />
          {preset ? t("common.update") : t("common.save")}
        </button>
        <button
          onClick={onCancel}
          className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-text-secondary hover:text-text-primary bg-bg-tertiary rounded-xl hover:bg-bg-hover transition-colors"
        >
          <X size={13} />
          {t("common.cancel")}
        </button>
      </div>
    </div>
  );
}

// ─── Main Editor ───
export function SnoozePresetsEditor() {
  const { t } = useTranslation();
  const activeAccountId = useAccountStore((s) => s.activeAccountId);
  const [presets, setPresets] = useState<SnoozePreset[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!activeAccountId) return;
    const ps = await getSnoozePresets(activeAccountId);
    setPresets(ps);
  }, [activeAccountId]);

  useEffect(() => {
    load();
  }, [load]);

  const resetForm = useCallback(() => {
    setEditingId(null);
    setShowForm(false);
  }, []);

  const handleSave = useCallback(
    async (data: {
      id?: string;
      label: string;
      durationMinutes: number;
      isRecurring: boolean;
    }) => {
      if (!activeAccountId) return;
      await upsertSnoozePreset({
        id: data.id,
        companyId: activeAccountId,
        label: data.label,
        durationMinutes: data.durationMinutes,
        isRecurring: data.isRecurring,
        sortOrder: editingId
          ? presets.find((p) => p.id === editingId)?.sort_order ?? 0
          : presets.length,
      });
      resetForm();
      await load();
    },
    [activeAccountId, editingId, presets, resetForm, load],
  );

  const handleEdit = useCallback((preset: SnoozePreset) => {
    setEditingId(preset.id);
    setShowForm(true);
  }, []);

  const handleDelete = useCallback(
    async (id: string) => {
      await deleteSnoozePreset(id);
      if (editingId === id) resetForm();
      await load();
      setDeleteConfirmId(null);
    },
    [editingId, resetForm, load],
  );

  const moveItem = useCallback(
    async (index: number, direction: -1 | 1) => {
      const target = index + direction;
      if (target < 0 || target >= presets.length) return;
      const items = [...presets];
      const a = items[index]!;
      const b = items[target]!;
      const tempOrder = a.sort_order;
      items[index] = { ...a, sort_order: b.sort_order };
      items[target] = { ...b, sort_order: tempOrder };
      setPresets(items);
      await upsertSnoozePreset({
        id: a.id,
        companyId: a.company_id,
        label: a.label,
        durationMinutes: a.duration_minutes,
        isRecurring: a.is_recurring === 1,
        sortOrder: b.sort_order,
      });
      await upsertSnoozePreset({
        id: b.id,
        companyId: b.company_id,
        label: b.label,
        durationMinutes: b.duration_minutes,
        isRecurring: b.is_recurring === 1,
        sortOrder: a.sort_order,
      });
    },
    [presets],
  );

  const filteredPresets = presets.filter((p) =>
    p.label.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-4">
      {/* ── Toolbar ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
          <input
            type="text"
            placeholder="Search presets..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="ps-10 pe-9 h-9 w-full bg-bg-primary border border-border rounded-xl text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute end-2 top-1/2 -translate-y-1/2 p-1 rounded-md hover:bg-bg-tertiary text-text-tertiary transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-accent bg-accent/5 hover:bg-accent/10 rounded-xl border border-accent/20 transition-all active:scale-95 shrink-0"
          >
            <Plus size={14} />
            {t("snooze.addPreset") || "Add Preset"}
          </button>
        )}
      </div>

      {/* ── Form ─── */}
      {showForm && (
        <SnoozePresetForm
          preset={editingId ? presets.find((p) => p.id === editingId) : undefined}
          onSave={handleSave}
          onCancel={resetForm}
        />
      )}

      {/* ── Empty State ─── */}
      {presets.length === 0 && !showForm && (
        <div className="flex flex-col items-center justify-center py-12 text-center space-y-4 rounded-2xl border border-dashed border-border bg-bg-tertiary/20">
          <div className="p-4 rounded-full bg-bg-primary border border-border/50">
            <Clock className="w-8 h-8 text-text-tertiary opacity-30" />
          </div>
          <div>
            <p className="text-sm font-semibold text-text-tertiary">No snooze presets</p>
            <p className="text-xs text-text-tertiary mt-1 max-w-[260px]">
              Create your first preset to quickly defer emails and stay focused on what matters.
            </p>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-accent bg-accent/5 hover:bg-accent/10 rounded-xl border border-accent/20 transition-all active:scale-95"
          >
            <Plus size={14} />
            Create Preset
          </button>
        </div>
      )}

      {/* ── Presets List ─── */}
      {filteredPresets.length === 0 && presets.length > 0 && (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <p className="text-sm text-text-tertiary">No presets match your search.</p>
          <button
            onClick={() => setSearchQuery("")}
            className="mt-2 text-xs text-accent hover:underline"
          >
            Clear search
          </button>
        </div>
      )}

      <div className="space-y-2">
        {filteredPresets.map((preset, idx) => {
          const isEditing = editingId === preset.id;
          const isDeleting = deleteConfirmId === preset.id;

          return (
            <div
              key={preset.id}
              className={cn(
                "group relative flex items-center gap-3 p-3 rounded-xl border transition-all",
                isEditing
                  ? "border-accent/30 bg-accent/5 ring-1 ring-accent/20"
                  : "border-border/50 bg-bg-primary hover:border-border hover:shadow-sm"
              )}
            >
              {/* Drag handle visual (non-functional, aesthetic) */}
              <div className="hidden sm:flex flex-col items-center gap-0.5 text-text-tertiary opacity-0 group-hover:opacity-50 transition-opacity cursor-grab">
                <GripVertical size={14} />
              </div>

              {/* Icon */}
              <div
                className={cn(
                  "p-2 rounded-lg shrink-0",
                  preset.is_recurring === 1
                    ? "bg-accent/10 text-accent"
                    : "bg-bg-tertiary text-text-tertiary"
                )}
              >
                {preset.is_recurring === 1 ? (
                  <Repeat size={15} />
                ) : (
                  <Clock size={15} />
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold text-text-primary">
                    {preset.label}
                  </span>
                  {preset.is_recurring === 1 && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-accent/10 text-accent text-[10px] font-bold border border-accent/20">
                      <Repeat size={9} />
                      {t("snooze.recurringLower") || "Recurring"}
                    </span>
                  )}
                  {/* Placeholder: default badge */}
                  {idx === 0 && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-warning/10 text-warning text-[10px] font-bold border border-warning/20">
                      <Star size={9} />
                      Default
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-1.5">
                  <DurationBar minutes={preset.duration_minutes} />
                  <span className="text-xs text-text-tertiary font-mono">
                    {formatDuration(preset.duration_minutes)}
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-0.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => moveItem(idx, -1)}
                  disabled={idx === 0}
                  className="p-1.5 rounded-lg text-text-tertiary hover:text-text-primary hover:bg-bg-tertiary disabled:opacity-20 transition-colors"
                  title="Move up"
                >
                  <ChevronUp size={14} />
                </button>
                <button
                  onClick={() => moveItem(idx, 1)}
                  disabled={idx === presets.length - 1}
                  className="p-1.5 rounded-lg text-text-tertiary hover:text-text-primary hover:bg-bg-tertiary disabled:opacity-20 transition-colors"
                  title="Move down"
                >
                  <ChevronDown size={14} />
                </button>
                <div className="w-px h-4 bg-border mx-0.5" />
                <button
                  onClick={() => handleEdit(preset)}
                  className={cn(
                    "p-1.5 rounded-lg transition-colors",
                    isEditing
                      ? "text-accent bg-accent/10"
                      : "text-text-tertiary hover:text-text-primary hover:bg-bg-tertiary"
                  )}
                  title="Edit"
                >
                  <Pencil size={14} />
                </button>
                <button
                  onClick={() => setDeleteConfirmId(preset.id)}
                  className="p-1.5 rounded-lg text-text-tertiary hover:text-danger hover:bg-danger/10 transition-colors"
                  title="Delete"
                >
                  <Trash2 size={14} />
                </button>
              </div>

              {/* Delete Confirmation Overlay */}
              {isDeleting && (
                <div className="absolute inset-0 rounded-xl bg-danger/5 border border-danger/30 flex items-center justify-between px-4 animate-in fade-in duration-150">
                  <div className="flex items-center gap-2 text-xs text-danger font-medium">
                    <AlertTriangle size={14} />
                    Delete this preset?
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setDeleteConfirmId(null)}
                      className="px-3 py-1.5 text-[10px] font-semibold text-text-secondary hover:text-text-primary bg-bg-primary rounded-lg border border-border transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => handleDelete(preset.id)}
                      className="px-3 py-1.5 text-[10px] font-bold text-white bg-danger rounded-lg hover:bg-danger/90 transition-colors shadow-sm"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Reset to Defaults Placeholder ─── */}
      {presets.length > 0 && !showForm && (
        <div className="flex items-center justify-center pt-2">
          <button
            onClick={() => {
              /* placeholder */
            }}
            className="flex items-center gap-2 text-[10px] font-medium text-text-tertiary hover:text-text-secondary transition-colors"
          >
            <RotateCcw size={12} />
            Reset to default presets
          </button>
        </div>
      )}
    </div>
  );
}