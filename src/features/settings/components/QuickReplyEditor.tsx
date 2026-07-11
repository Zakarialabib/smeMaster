import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Trash2, ChevronUp, ChevronDown, Zap, Pencil } from "lucide-react";
import { Button } from "@shared/components/ui/Button";
import { notify } from "@shared/services/notifications/toastHelper";
import { useAccountStore } from "@features/accounts/stores/accountStore";
import { useFeatureFlagStore } from "@features/settings/stores/featureFlagStore";
import { UpgradeBadge } from "@shared/components/ui/UpgradeBadge";
import { TextField } from "@shared/components/ui/TextField";
import {
  getQuickReplies,
  upsertQuickReply,
  deleteQuickReply,
  type DbQuickReply,
} from "@features/mail/db/quickReplies";

export function QuickReplyEditor() {
  const { t } = useTranslation();
  const activeAccountId = useAccountStore((s) => s.activeAccountId);
  const [quickReplies, setQuickReplies] = useState<DbQuickReply[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");
  const [shortcut, setShortcut] = useState("");

  const load = useCallback(async () => {
    if (!activeAccountId) return;
    const qrs = await getQuickReplies(activeAccountId);
    setQuickReplies(qrs);
  }, [activeAccountId]);

  const canCreateQuickReply = useFeatureFlagStore((s) => s.canCreate("composing", quickReplies.length));

  useEffect(() => {
    load();
  }, [load]);

  const resetForm = useCallback(() => {
    setEditingId(null);
    setShowForm(false);
    setTitle("");
    setBodyHtml("");
    setShortcut("");
  }, []);

  const handleSave = useCallback(async () => {
    if (!activeAccountId || !title.trim()) return;
    await upsertQuickReply({
      id: editingId ?? undefined,
      accountId: activeAccountId,
      title: title.trim(),
      bodyHtml,
      shortcut: shortcut.trim() || null,
      sortOrder: editingId
        ? quickReplies.find((q) => q.id === editingId)?.sort_order ?? 0
        : quickReplies.length,
    });
    resetForm();
    await load();
    notify("Quick Reply", editingId ? "Quick reply updated." : "Quick reply saved.");
  }, [activeAccountId, editingId, title, bodyHtml, shortcut, quickReplies, resetForm, load]);

  const handleEdit = useCallback((qr: DbQuickReply) => {
    setEditingId(qr.id);
    setShowForm(true);
    setTitle(qr.title);
    setBodyHtml(qr.body_html);
    setShortcut(qr.shortcut ?? "");
  }, []);

  const handleDelete = useCallback(async (id: string) => {
    await deleteQuickReply(id);
    if (editingId === id) resetForm();
    await load();
    notify("Quick Reply", "Quick reply deleted.");
  }, [editingId, resetForm, load]);

  const moveItem = useCallback(async (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= quickReplies.length) return;
    const items = [...quickReplies];
    const a = items[index]!;
    const b = items[target]!;
    const tempOrder = a.sort_order;
    items[index] = { ...a, sort_order: b.sort_order };
    items[target] = { ...b, sort_order: tempOrder };
    setQuickReplies(items);
    await upsertQuickReply({
      id: a.id,
      accountId: a.account_id,
      title: a.title,
      bodyHtml: a.body_html,
      shortcut: a.shortcut,
      sortOrder: b.sort_order,
    });
    await upsertQuickReply({
      id: b.id,
      accountId: b.account_id,
      title: b.title,
      bodyHtml: b.body_html,
      shortcut: b.shortcut,
      sortOrder: a.sort_order,
    });
    notify("Quick Reply", "Quick reply reordered.");
  }, [quickReplies]);

  return (
    <div className="space-y-3">
      {/* Usage counter */}
      <div className="flex items-center gap-2 px-1 pb-1">
        <span className="text-xs text-text-tertiary">
          {quickReplies.length}/5 quick replies used
        </span>
        <div className="flex-1 h-1 rounded-full bg-bg-tertiary overflow-hidden max-w-[100px]">
          <div
            className={`h-full rounded-full transition-all ${
              quickReplies.length >= 5 ? 'bg-danger' : quickReplies.length >= 3 ? 'bg-warning' : 'bg-accent'
            }`}
            style={{ width: `${Math.min(100, (quickReplies.length / 5) * 100)}%` }}
          />
        </div>
        {!canCreateQuickReply && quickReplies.length > 0 && (
          <UpgradeBadge variant="limit" size="sm" />
        )}
      </div>
      {quickReplies.map((qr, idx) => (
        <div
          key={qr.id}
          className="flex items-center justify-between py-2 px-3 bg-bg-secondary rounded-md"
        >
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-text-primary flex items-center gap-2">
              <Zap size={13} className="text-accent" />
              {qr.title}
              {qr.shortcut && (
                <kbd className="text-[0.625rem] bg-bg-tertiary text-text-tertiary px-1.5 py-0.5 rounded border border-border-primary font-mono">
                  {qr.shortcut}
                </kbd>
              )}
            </div>
            <div className="text-xs text-text-tertiary truncate mt-0.5">
              Used {qr.usage_count} times
            </div>
          </div>
          <div className="flex items-center gap-0.5">
            <Button
              variant="ghost"
              size="sm"
              iconOnly
              icon={<ChevronUp size={13} />}
              onClick={() => moveItem(idx, -1)}
              disabled={idx === 0}
              aria-label="Move up"
            />
            <Button
              variant="ghost"
              size="sm"
              iconOnly
              icon={<ChevronDown size={13} />}
              onClick={() => moveItem(idx, 1)}
              disabled={idx === quickReplies.length - 1}
              aria-label="Move down"
            />
            <Button
              variant="ghost"
              size="sm"
              iconOnly
              icon={<Pencil size={13} />}
              onClick={() => handleEdit(qr)}
              aria-label="Edit quick reply"
            />
            <Button
              variant="ghost"
              size="sm"
              iconOnly
              icon={<Trash2 size={13} />}
              onClick={() => handleDelete(qr.id)}
              className="hover:text-danger"
              aria-label="Delete quick reply"
            />
          </div>
        </div>
      ))}

      {showForm ? (
        <div className="border border-border-primary rounded-md p-3 space-y-3">
          <TextField
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Quick reply title"
          />
          <div>
            <label className="text-xs text-text-secondary block mb-1">{t("quickReply.body")}</label>
            <textarea
              value={bodyHtml}
              onChange={(e) => setBodyHtml(e.target.value)}
              placeholder="<p>Your quick reply HTML here...</p>"
              rows={4}
              className="w-full bg-bg-tertiary text-text-primary text-xs px-3 py-2 rounded border border-border-primary outline-none focus:border-accent resize-y font-mono"
            />
          </div>
          <TextField
            type="text"
            value={shortcut}
            onChange={(e) => setShortcut(e.target.value)}
            placeholder={t("quickReply.shortcut") + " (e.g. #thanks)"}
          />
          <div className="flex items-center gap-2">
            <Button
              variant="primary"
              onClick={handleSave}
              disabled={!title.trim()}
            >
              {editingId ? "Update" : t("common.save")}
            </Button>
            <Button
              variant="secondary"
              onClick={resetForm}
            >
              {t("common.cancel")}
            </Button>
          </div>
        </div>
      ) : (
        canCreateQuickReply ? (
          <Button
            variant="ghost"
            size="sm"
            icon={<Plus size={13} />}
            onClick={() => {
              setEditingId(null);
              setShowForm(true);
            }}
          >
            Add quick reply
          </Button>
        ) : (
          <div className="flex items-center gap-2 pt-1">
            <UpgradeBadge
              variant="limit"
              message="You've reached the maximum of 5 quick replies on the Basic plan. Upgrade to Pro for unlimited quick replies."
            />
            <span className="text-xs text-text-tertiary">Limit reached</span>
          </div>
        )
      )}
    </div>
  );
}

