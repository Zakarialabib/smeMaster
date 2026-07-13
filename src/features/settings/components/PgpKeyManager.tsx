import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useAccountStore } from "@features/accounts/stores/accountStore";
import { Button } from "@shared/components/ui/Button";
import { Modal } from "@shared/components/ui/Modal";
import { TextField } from "@shared/components/ui/TextField";
import { ConfirmDialog } from "@shared/components/ui/ConfirmDialog";
import { KeyRound, Plus, Upload, Trash2, Copy, Download, Search, AlertCircle } from "lucide-react";
import {
  generatePgpKey,
  getPgpKeyInfo,
  listPgpKeys,
  deletePgpKeyById,
  importPgpKey,
} from "@shared/services/pgp/pgpService";
import type { DbPgpKey } from "@shared/services/pgp/pgpService";

// ── Helpers ──────────────────────────────────────────────────────────────

function shortId(fp: string): string {
  return fp.length > 16 ? fp.slice(-16).toUpperCase() : fp.toUpperCase();
}

function formatDate(ts: number): string {
  try {
    return new Date(ts).toLocaleDateString(undefined, {
      year: "numeric", month: "short", day: "numeric",
    });
  } catch {
    return String(ts);
  }
}

// ── Component ────────────────────────────────────────────────────────────

export function PgpKeyManager() {
  const { t } = useTranslation();
  const activeAccountId = useAccountStore((s) => s.activeAccountId);

  // ── State ──────────────────────────────────────────────────────────────
  const [keys, setKeys] = useState<DbPgpKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Dialogs
  const [showGenerate, setShowGenerate] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DbPgpKey | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Notifications (toast-like inline)
  const [notification, setNotification] = useState<string | null>(null);
  const notifTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showNotif = useCallback((msg: string) => {
    if (notifTimer.current) clearTimeout(notifTimer.current);
    setNotification(msg);
    notifTimer.current = setTimeout(() => setNotification(null), 3000);
  }, []);

  // ── Generate form state ────────────────────────────────────────────────
  const [genForm, setGenForm] = useState({
    name: "",
    email: "",
    comment: "",
    passphrase: "",
    confirmPassphrase: "",
    keyType: "RSA4096",
  });
  const [generating, setGenerating] = useState(false);

  // ── Import form state ──────────────────────────────────────────────────
  const [importArmored, setImportArmored] = useState("");
  const [importFileName, setImportFileName] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importPreview, setImportPreview] = useState<{
    keyId: string; fingerprint: string; userId: string;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Load keys ──────────────────────────────────────────────────────────
  const loadKeys = useCallback(async () => {
    if (!activeAccountId) return;
    setLoading(true);
    setError(null);
    try {
      const result = await listPgpKeys(activeAccountId);
      setKeys(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [activeAccountId]);

  useEffect(() => {
    loadKeys();
  }, [loadKeys]);

  // ── Search filter ──────────────────────────────────────────────────────
  const filteredKeys = useMemo(() => {
    if (!searchQuery.trim()) return keys;
    const q = searchQuery.toLowerCase();
    return keys.filter(
      (k) =>
        k.key_id.toLowerCase().includes(q) ||
        (k.fingerprint ?? "").toLowerCase().includes(q) ||
        (k.user_id ?? "").toLowerCase().includes(q),
    );
  }, [keys, searchQuery]);

  // ── Generate key handlers ──────────────────────────────────────────────
  const canGenerate =
    genForm.name.trim() &&
    genForm.email.trim() &&
    genForm.passphrase.length > 0 &&
    genForm.passphrase === genForm.confirmPassphrase;

  const handleGenerate = async () => {
    if (!activeAccountId || !canGenerate) return;
    setGenerating(true);
    setError(null);
    try {
      const commentPart = genForm.comment.trim()
        ? ` (${genForm.comment.trim()})`
        : "";
      const userId = `${genForm.name.trim()}${commentPart} <${genForm.email.trim()}>`;

      const [publicArmored, privateArmored] = await generatePgpKey(userId, genForm.passphrase);
      const info = await getPgpKeyInfo(publicArmored);

      // Import into DB
      await importPgpKey(
        activeAccountId,
        publicArmored,
        privateArmored,
        undefined,
        info.user_id,
      );

      showNotif(t("pgp.generateSuccess"));
      setShowGenerate(false);
      setGenForm({
        name: "", email: "", comment: "",
        passphrase: "", confirmPassphrase: "", keyType: "RSA4096",
      });
      await loadKeys();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setGenerating(false);
    }
  };

  // ── Export handlers ────────────────────────────────────────────────────
  const handleExportClipboard = async (key: DbPgpKey) => {
    try {
      const { copyToClipboard } = await import("@shared/hooks/useClipboard");
      await copyToClipboard(key.public_key);
      showNotif(t("pgp.exportSuccess"));
    } catch {
      showNotif("Failed to copy to clipboard");
    }
  };

  const handleExportFile = (key: DbPgpKey) => {
    const blob = new Blob([key.public_key], { type: "application/pgp-keys" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pgp-key-${shortId(key.fingerprint ?? key.key_id)}.asc`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Delete handler ─────────────────────────────────────────────────────
  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setError(null);
    try {
      await deletePgpKeyById(deleteTarget.id);
      showNotif(t("pgp.deleteSuccess"));
      setDeleteTarget(null);
      await loadKeys();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setDeleting(false);
    }
  };

  // ── Import handlers ────────────────────────────────────────────────────
  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportFileName(file.name);
    try {
      const text = await file.text();
      setImportArmored(text);
      // Clear preview — user must click "preview"
      setImportPreview(null);
    } catch {
      showNotif("Failed to read file");
    }
  };

  const handleImportPreview = async () => {
    if (!importArmored.trim()) return;
    setImporting(true);
    setError(null);
    try {
      const info = await getPgpKeyInfo(importArmored.trim());
      setImportPreview({
        keyId: info.key_id,
        fingerprint: info.fingerprint,
        userId: info.user_id,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setImporting(false);
    }
  };

  const handleImportConfirm = async () => {
    if (!activeAccountId || !importArmored.trim()) return;
    setImporting(true);
    setError(null);
    try {
      const info = await getPgpKeyInfo(importArmored.trim());
      await importPgpKey(activeAccountId, importArmored.trim(), undefined, undefined, info.user_id);
      showNotif(t("pgp.importSuccess"));
      setShowImport(false);
      setImportArmored("");
      setImportFileName(null);
      setImportPreview(null);
      await loadKeys();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setImporting(false);
    }
  };

  // ── Render helpers ─────────────────────────────────────────────────────
  const renderHasPrivate = (key: DbPgpKey) => {
    if (key.private_key_encrypted) {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent">
          <KeyRound size={12} />
          {t("pgp.hasPrivateKey")}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-bg-tertiary px-2 py-0.5 text-xs text-text-tertiary">
        {t("pgp.publicOnly")}
      </span>
    );
  };

  // ── Main render ────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-text-tertiary">{t("pgp.pageDescription")}</p>
        <div className="flex items-center gap-1.5">
          <Button variant="secondary" size="sm" icon={<Plus size={14} />} onClick={() => setShowGenerate(true)}>
            {t("pgp.generateKey")}
          </Button>
          <Button variant="secondary" size="sm" icon={<Upload size={14} />} onClick={() => setShowImport(true)}>
            {t("pgp.importKey")}
          </Button>
        </div>
      </div>

      {/* Notification toast */}
      {notification && (
        <div className="rounded-md bg-accent/10 px-3 py-2 text-xs text-accent transition-opacity">
          {notification}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 rounded-md bg-danger/10 px-3 py-2 text-xs text-danger">
          <AlertCircle size={14} className="mt-0.5 shrink-0" />
          <span>{error}</span>
          <button className="ms-auto text-danger/60 hover:text-danger" onClick={() => setError(null)}>×</button>
        </div>
      )}

      {/* Search */}
      {keys.length > 0 && (
        <div className="relative">
          <Search size={14} className="absolute start-2.5 top-1/2 -translate-y-1/2 text-text-tertiary" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t("pgp.searchKeys")}
            className="w-full rounded-md border border-border-primary bg-bg-tertiary py-1.5 ps-8 pe-3 text-sm text-text-primary outline-none placeholder:text-text-tertiary focus:border-accent"
          />
        </div>
      )}

      {/* Keys list */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-accent border-t-transparent" />
        </div>
      ) : filteredKeys.length > 0 ? (
        <div className="space-y-2">
          {filteredKeys.map((key) => (
            <div
              key={key.id}
              className="flex flex-col gap-1.5 rounded-lg border border-border-primary bg-bg-secondary p-3"
            >
              {/* Top row: badges + actions */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  {renderHasPrivate(key)}
                  <span className="truncate font-mono text-xs text-text-tertiary">
                    {shortId(key.fingerprint ?? key.key_id)}
                  </span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={<Copy size={13} />}
                    iconOnly
                    onClick={() => handleExportClipboard(key)}
                    title={t("pgp.exportToClipboard")}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={<Download size={13} />}
                    iconOnly
                    onClick={() => handleExportFile(key)}
                    title={t("pgp.exportToFile")}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={<Trash2 size={13} />}
                    iconOnly
                    onClick={() => setDeleteTarget(key)}
                    title={t("pgp.deleteKey")}
                  />
                </div>
              </div>

              {/* Key details */}
              <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-text-secondary">
                {key.key_id && (
                  <span>
                    <span className="text-text-tertiary">{t("pgp.keyId")}:</span>{" "}
                    <span className="font-mono">{key.key_id}</span>
                  </span>
                )}
                <span>
                  <span className="text-text-tertiary">{t("pgp.userId")}:</span>{" "}
                  {key.user_id}
                </span>
                <span>
                  <span className="text-text-tertiary">{t("pgp.createdLabel")}:</span>{" "}
                  {formatDate(key.created_at)}
                </span>
                <span>{t("pgp.algorithms" as any)}: RSA 4096</span>
                <span>{t("pgp.noExpiry")}</span>
              </div>
            </div>
          ))}
        </div>
      ) : keys.length === 0 && !loading ? (
        /* Empty state */
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border-primary py-12 text-text-tertiary">
          <KeyRound size={40} strokeWidth={1} className="mb-3 opacity-40" />
          <p className="text-sm font-medium">{t("pgp.emptyTitle")}</p>
          <p className="mt-1 text-xs">{t("pgp.emptySubtitle")}</p>
          <div className="mt-4 flex gap-2">
            <Button variant="primary" size="sm" icon={<Plus size={14} />} onClick={() => setShowGenerate(true)}>
              {t("pgp.generateKey")}
            </Button>
            <Button variant="secondary" size="sm" icon={<Upload size={14} />} onClick={() => setShowImport(true)}>
              {t("pgp.importKey")}
            </Button>
          </div>
        </div>
      ) : null}

      {/* ── Generate Key Dialog ─────────────────────────────────────────── */}
      <Modal
        isOpen={showGenerate}
        onClose={() => setShowGenerate(false)}
        title={t("pgp.generateKeyTitle")}
        width="w-96"
      >
        <div className="space-y-3 p-4">
          <div className="grid grid-cols-2 gap-3">
            <TextField
              label={t("pgp.nameLabel")}
              placeholder="Alice"
              value={genForm.name}
              onChange={(e) => setGenForm((f) => ({ ...f, name: e.target.value }))}
            />
            <TextField
              label={t("pgp.emailLabel")}
              placeholder="alice@example.com"
              value={genForm.email}
              onChange={(e) => setGenForm((f) => ({ ...f, email: e.target.value }))}
            />
          </div>
          <TextField
            label={t("pgp.comment")}
            placeholder="Optional comment"
            value={genForm.comment}
            onChange={(e) => setGenForm((f) => ({ ...f, comment: e.target.value }))}
          />
          <div>
            <label className="mb-1.5 block text-sm text-text-secondary">
              {t("pgp.algorithm")}
            </label>
            <select
              value={genForm.keyType}
              onChange={(e) => setGenForm((f) => ({ ...f, keyType: e.target.value }))}
              className="w-full rounded-md border border-border-primary bg-bg-tertiary px-3 py-1.5 text-sm text-text-primary outline-none focus:border-accent"
            >
              <option value="RSA2048">RSA 2048</option>
              <option value="RSA4096">RSA 4096</option>
              <option value="ECC">ECC (Curve25519)</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <TextField
              label={t("pgp.passphrase")}
              type="password"
              value={genForm.passphrase}
              onChange={(e) => setGenForm((f) => ({ ...f, passphrase: e.target.value }))}
            />
            <TextField
              label={t("pgp.confirmPassphrase")}
              type="password"
              value={genForm.confirmPassphrase}
              onChange={(e) => setGenForm((f) => ({ ...f, confirmPassphrase: e.target.value }))}
              error={
                genForm.confirmPassphrase && genForm.passphrase !== genForm.confirmPassphrase
                  ? t("pgp.passphraseMismatch")
                  : undefined
              }
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" onClick={() => setShowGenerate(false)}>
              {t("pgp.cancel")}
            </Button>
            <Button
              variant="primary"
              onClick={handleGenerate}
              disabled={!canGenerate || generating}
            >
              {generating ? t("pgp.generateProgress") : t("pgp.confirmGenerate")}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Import Key Dialog ───────────────────────────────────────────── */}
      <Modal
        isOpen={showImport}
        onClose={() => { setShowImport(false); setImportArmored(""); setImportFileName(null); setImportPreview(null); }}
        title={t("pgp.importKeyTitle")}
        width="w-96"
      >
        <div className="space-y-3 p-4">
          {/* Paste area */}
          <div>
            <label className="mb-1.5 block text-sm text-text-secondary">
              {t("pgp.importPasteLabel")}
            </label>
            <textarea
              value={importArmored}
              onChange={(e) => { setImportArmored(e.target.value); setImportPreview(null); }}
              placeholder={t("pgp.importPastePlaceholder")}
              rows={5}
              className="w-full rounded-md border border-border-primary bg-bg-tertiary px-3 py-1.5 text-xs font-mono text-text-primary outline-none placeholder:text-text-tertiary focus:border-accent"
            />
          </div>

          {/* File upload */}
          <div>
            <label className="mb-1.5 block text-sm text-text-secondary">
              {t("pgp.importFileLabel")}
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".asc,.pgp,.gpg,.key"
              onChange={handleImportFile}
              className="hidden"
            />
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                icon={<Upload size={14} />}
                onClick={() => fileInputRef.current?.click()}
              >
                {importFileName ?? t("pgp.importKey")}
              </Button>
              {importFileName && (
                <span className="truncate text-xs text-text-tertiary">{importFileName}</span>
              )}
            </div>
          </div>

          {/* Preview */}
          {importPreview && (
            <div className="rounded-md bg-bg-tertiary p-2 text-xs text-text-secondary space-y-1">
              <p><span className="text-text-tertiary">{t("pgp.keyId")}:</span> {importPreview.keyId}</p>
              <p className="font-mono break-all">{t("pgp.fingerprint")}: {importPreview.fingerprint}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" onClick={() => {
              setShowImport(false);
              setImportArmored("");
              setImportFileName(null);
              setImportPreview(null);
            }}>
              {t("pgp.cancel")}
            </Button>
            {!importPreview ? (
              <Button
                variant="primary"
                onClick={handleImportPreview}
                disabled={!importArmored.trim() || importing}
              >
                {importing ? t("pgp.importParsing") : t("pgp.importKey")}
              </Button>
            ) : (
              <Button
                variant="primary"
                onClick={handleImportConfirm}
                disabled={importing}
              >
                {importing ? t("pgp.importParsing") : t("pgp.confirmImport")}
              </Button>
            )}
          </div>
        </div>
      </Modal>

      {/* ── Delete confirmation dialog ──────────────────────────────────── */}
      <ConfirmDialog
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        title={t("pgp.deleteKey")}
        message={`${t("pgp.deleteConfirm")} ${shortId(deleteTarget?.fingerprint ?? deleteTarget?.key_id ?? "")}`}
        confirmLabel={t("pgp.deleteKey")}
        variant="danger"
        loading={deleting}
      />
    </div>
  );
}
