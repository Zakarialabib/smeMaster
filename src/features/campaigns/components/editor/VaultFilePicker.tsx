import { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Search, Image as ImageIcon, FileText } from "lucide-react";
import { AdaptiveBottomSheet } from "@shared/components/ui/AdaptiveBottomSheet";
import { EmptyState } from "@shared/components/ui/EmptyState";
import { useVaultStore } from "@features/vault/stores/vaultStore";
import { readVaultFile } from "@shared/services/vault/vaultService";

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|bmp|svg|avif|heic)$/i;

export interface VaultFilePickerProps {
  isOpen: boolean;
  onClose: () => void;
  /** Called with the resolved data URL and the original vault path. */
  onPick: (dataUrl: string, path: string) => void;
}

export function VaultFilePicker({ isOpen, onClose, onPick }: VaultFilePickerProps) {
  const { t } = useTranslation();
  const entries = useVaultStore((s) => s.entries);
  const loadDir = useVaultStore((s) => s.loadDir);
  const isLoading = useVaultStore((s) => s.isLoading);
  const [query, setQuery] = useState("");
  const [resolving, setResolving] = useState<string | null>(null);

  // Load the vault root listing whenever the sheet opens.
  useEffect(() => {
    if (isOpen) {
      void loadDir("");
      setQuery("");
    }
  }, [isOpen, loadDir]);

  const images = useMemo(
    () => entries.filter((e) => !e.isDir && (e.category === "image" || IMAGE_EXT.test(e.path))),
    [entries],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return images;
    return images.filter((e) => e.name.toLowerCase().includes(q));
  }, [images, query]);

  const handlePick = async (path: string) => {
    setResolving(path);
    try {
      const dataUrl = await readVaultFile(path);
      onPick(dataUrl, path);
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // Surface the failure to the console; the sheet stays open.
      console.error("[VaultFilePicker] readVaultFile failed:", msg);
    } finally {
      setResolving(null);
    }
  };

  return (
    <AdaptiveBottomSheet isOpen={isOpen} onClose={onClose} title={t("campaign.editor.fromVault")}>
      <div className="flex flex-col gap-3 p-4">
        {/* Search */}
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("campaign.editor.fromVault")}
            className="w-full rounded-xl border border-border-primary bg-bg-secondary py-2 pl-9 pr-3 text-sm text-text-primary placeholder:text-text-tertiary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </div>

        {/* Grid */}
        {isLoading ? (
          <p className="py-8 text-center text-sm text-text-tertiary">{t("campaign.editor.fromVault")}</p>
        ) : filtered.length === 0 ? (
          <div className="py-6">
            <EmptyState
              icon={ImageIcon}
              title={t("campaign.editor.fromVault")}
              subtitle={t("campaign.editor.insertImage")}
            />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {filtered.map((file) => (
              <button
                key={file.path}
                type="button"
                disabled={resolving === file.path}
                onClick={() => void handlePick(file.path)}
                className="group flex flex-col overflow-hidden rounded-xl border border-border-primary bg-bg-secondary text-left transition-colors hover:border-accent disabled:opacity-60"
              >
                <div className="flex h-24 items-center justify-center bg-bg-primary">
                  <ImageIcon className="h-8 w-8 text-text-tertiary group-hover:text-accent" />
                </div>
                <div className="flex items-center gap-1.5 px-2 py-1.5">
                  <FileText className="h-3.5 w-3.5 shrink-0 text-text-tertiary" />
                  <span className="truncate text-xs text-text-primary" title={file.name}>
                    {file.name}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </AdaptiveBottomSheet>
  );
}

export default VaultFilePicker;
