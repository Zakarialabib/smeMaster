import { useEffect, useState, useCallback } from "react";
import { invokeCommand } from "@shared/services/db/invoke/command";
import { History, Download, RefreshCw, Trash2, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { formatRelativeDate } from "@shared/utils/date";
import { EmptyState } from "@shared/components/ui/EmptyState";
import { Button } from "@shared/components/ui/Button";

interface ImportHistoryRecord {
  id: string;
  account_id: string;
  file_name: string;
  row_count: number;
  imported_count: number;
  failed_count: number;
  status: "pending" | "processing" | "completed" | "failed";
  created_at: number;
  completed_at: number | null;
  error_log: string | null;
}

interface ImportHistoryTabProps {
  accountId: string;
}

/**
 * ImportHistoryTab — shows past CSV imports.
 *
 * Backend: requires a `db_list_import_history` Tauri command returning
 * `ImportHistoryRecord[]`. Falls back to a friendly empty state when the
 * command is missing or returns an error.
 */
export function ImportHistoryTab({ accountId }: ImportHistoryTabProps) {
  const [records, setRecords] = useState<ImportHistoryRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!accountId) return;
    setLoading(true);
    try {
      const list = await invokeCommand<ImportHistoryRecord[]>("db_list_import_history", {
        accountId,
      });
      setRecords(list);
    } catch {
      // Command may not exist yet (Phase 4 backend work) — show empty state
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleDownloadErrors = useCallback((rec: ImportHistoryRecord) => {
    if (!rec.error_log) return;
    const blob = new Blob([rec.error_log], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${rec.file_name}-errors.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const handleDelete = useCallback(
    async (id: string) => {
      if (!confirm("Remove this import record? Contacts already imported will remain.")) return;
      try {
        await invokeCommand("db_delete_import_history", { id });
        setRecords((prev) => prev.filter((r) => r.id !== id));
      } catch (err) {
        console.error("Failed to delete import record:", err);
      }
    },
    [],
  );

  if (loading) {
    return (
      <div className="space-y-2 p-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-2 p-2.5 animate-pulse">
            <div className="w-8 h-8 rounded bg-bg-tertiary" />
            <div className="flex-1 space-y-1">
              <div className="h-3 bg-bg-tertiary rounded w-40" />
              <div className="h-2.5 bg-bg-tertiary rounded w-24" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (records.length === 0) {
    return (
      <EmptyState
        icon={History}
        title="No import history"
        subtitle="Past CSV imports will appear here. Each record shows the file, row counts, and any errors."
        size="sm"
      />
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex justify-end">
        <Button
          variant="secondary"
          size="sm"
          icon={<RefreshCw size={12} />}
          onClick={load}
        >
          Refresh
        </Button>
      </div>
      <ul className="space-y-1" role="list">
        {records.map((rec) => (
          <li
            key={rec.id}
            className="flex items-center gap-3 p-2.5 rounded-lg border border-border-primary bg-bg-primary/40 hover:bg-bg-hover transition-colors"
          >
            {/* Status icon */}
            <div className="shrink-0">
              {rec.status === "completed" && (
                <CheckCircle2 size={16} className="text-success" />
              )}
              {rec.status === "failed" && (
                <XCircle size={16} className="text-error" />
              )}
              {(rec.status === "pending" || rec.status === "processing") && (
                <Loader2 size={16} className="text-text-tertiary animate-spin" />
              )}
            </div>

            {/* Main info */}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-text-primary truncate">
                {rec.file_name}
              </p>
              <div className="flex items-center gap-3 mt-0.5 text-[0.625rem] text-text-tertiary">
                <span>{formatRelativeDate(rec.created_at)}</span>
                <span>•</span>
                <span className="tabular-nums">
                  {rec.imported_count}/{rec.row_count} imported
                </span>
                {rec.failed_count > 0 && (
                  <>
                    <span>•</span>
                    <span className="text-error tabular-nums">
                      {rec.failed_count} failed
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1 shrink-0">
              {rec.error_log && rec.failed_count > 0 && (
                <button
                  type="button"
                  onClick={() => handleDownloadErrors(rec)}
                  className="p-1.5 rounded text-text-tertiary hover:text-accent hover:bg-bg-hover"
                  title="Download error log"
                  aria-label="Download error log"
                >
                  <Download size={12} />
                </button>
              )}
              <button
                type="button"
                onClick={() => handleDelete(rec.id)}
                className="p-1.5 rounded text-text-tertiary hover:text-error hover:bg-error/10"
                title="Delete record"
                aria-label="Delete import record"
              >
                <Trash2 size={12} />
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
