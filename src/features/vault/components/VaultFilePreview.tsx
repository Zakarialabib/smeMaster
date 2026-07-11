import { useState, useEffect, useCallback, useRef } from "react";
import {
  X,
  Download,
  Maximize2,
  Minimize2,
  AlertCircle,
  RefreshCw,
  FileQuestion,
  Loader2,
} from "lucide-react";
import { readVaultFile, copyVaultToDownloads } from "@shared/services/vault/vaultService";

interface VaultFilePreviewProps {
  filePath: string;
  fileName: string;
  onClose: () => void;
}

type PreviewState = "loading" | "ready" | "error" | "unsupported";

const TEXT_EXTENSIONS = new Set([
  ".txt", ".md", ".csv", ".json", ".xml", ".html", ".css", ".js", ".ts",
  ".yaml", ".yml", ".toml", ".ini", ".cfg", ".log", ".env", ".sh", ".bat",
  ".sql", ".svg",
]);

const IMAGE_EXTENSIONS = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp", ".ico",
]);

function getExtension(name: string): string {
  const idx = name.lastIndexOf(".");
  return idx === -1 ? "" : name.slice(idx).toLowerCase();
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function VaultFilePreview({ filePath, fileName, onClose }: VaultFilePreviewProps) {
  const ext = getExtension(fileName);
  const [previewState, setPreviewState] = useState<PreviewState>("loading");
  const [content, setContent] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [fileSize, setFileSize] = useState<number | null>(null);
  const [downloading, setDownloading] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  const isImage = IMAGE_EXTENSIONS.has(ext);
  const isText = TEXT_EXTENSIONS.has(ext);
  const isPdf = ext === ".pdf";

  const loadPreview = useCallback(async () => {
    setPreviewState("loading");
    setErrorMsg(null);
    try {
      const b64 = await readVaultFile(filePath);
      setContent(b64);
      // Estimate file size from base64 length
      setFileSize(Math.round((b64.length * 3) / 4));
      setPreviewState("ready");
    } catch (e) {
      setPreviewState("error");
      setErrorMsg(e instanceof Error ? e.message : "Failed to load file");
    }
  }, [filePath]);

  useEffect(() => {
    if (isImage || isText || isPdf) {
      loadPreview();
    } else {
      setPreviewState("unsupported");
      // Try to at least get file size
      loadPreview().catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filePath, fileName]);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      await copyVaultToDownloads(filePath);
    } catch (e) {
      console.error("Download failed:", e);
    } finally {
      setDownloading(false);
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      if (fullscreen) setFullscreen(false);
      else onClose();
    }
  };

  // ── Render helpers ──────────────────────────────────────────

  const renderLoading = () => (
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      <Loader2 size={36} className="text-accent animate-spin" />
      <p className="text-sm text-text-tertiary">Loading preview...</p>
    </div>
  );

  const renderError = () => (
    <div className="flex flex-col items-center justify-center py-16 gap-3 px-4">
      <AlertCircle size={40} className="text-danger-text opacity-60" />
      <p className="text-sm font-medium text-text-primary">Failed to load preview</p>
      {errorMsg && (
        <p className="text-xs text-text-tertiary text-center max-w-md break-all">{errorMsg}</p>
      )}
      <button
        onClick={loadPreview}
        className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-accent hover:bg-accent-hover rounded-md transition-colors"
      >
        <RefreshCw size={13} />
        Retry
      </button>
    </div>
  );

  const renderUnsupported = () => (
    <div className="flex flex-col items-center justify-center py-16 gap-3 px-4">
      <FileQuestion size={48} className="text-text-tertiary opacity-40" />
      <p className="text-sm font-medium text-text-primary">Preview not available</p>
      <p className="text-xs text-text-tertiary text-center">
        <span className="font-mono">{fileName}</span>
        {fileSize !== null && <> &middot; {formatFileSize(fileSize)}</>}
      </p>
    </div>
  );

  const renderImage = () => {
    if (!content) return null;
    return (
      <div className="flex items-center justify-center p-2 min-h-[200px]">
        <img
          src={`data:image/${ext.slice(1)};base64,${content}`}
          alt={fileName}
          className="max-w-full max-h-[70vh] object-contain rounded"
        />
      </div>
    );
  };

  const renderText = () => {
    if (!content) return null;
    try {
      const decoded = atob(content);
      return (
        <pre className="p-4 text-xs leading-relaxed font-mono text-text-primary bg-bg-secondary overflow-auto max-h-[70vh] whitespace-pre-wrap break-all rounded">
          {decoded}
        </pre>
      );
    } catch {
      return renderError();
    }
  };

  const renderPdf = () => {
    if (!content) return null;
    // Use data URI for the iframe
    const dataUri = `data:application/pdf;base64,${content}`;
    return (
      <div className="w-full min-h-[400px] h-[70vh]">
        <iframe
          src={dataUri}
          title={fileName}
          className="w-full h-full rounded border-0"
          sandbox="allow-scripts allow-same-origin"
        />
      </div>
    );
  };

  const renderPreview = () => {
    switch (previewState) {
      case "loading":
        return renderLoading();
      case "error":
        return renderError();
      case "unsupported":
        return renderUnsupported();
      case "ready":
        if (isImage) return renderImage();
        if (isText) return renderText();
        if (isPdf) return renderPdf();
        return renderUnsupported();
    }
  };

  // ── Main render ─────────────────────────────────────────────

  const modalContent = (
    <div
      className={`
        flex flex-col bg-bg-primary
        ${fullscreen
          ? "fixed inset-0 z-[100] rounded-none"
          : "relative max-w-4xl w-full mx-2 rounded-xl shadow-2xl max-h-[90vh]"
        }
      `}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border-secondary shrink-0">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{fileName}</p>
          {fileSize !== null && (
            <p className="text-xs text-text-tertiary">{formatFileSize(fileSize)}</p>
          )}
        </div>

        {/* Fullscreen toggle */}
        <button
          onClick={() => setFullscreen(!fullscreen)}
          className="p-1.5 text-text-tertiary hover:text-text-primary hover:bg-bg-hover rounded transition-colors"
          title={fullscreen ? "Exit fullscreen" : "Fullscreen"}
        >
          {fullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
        </button>

        {/* Download */}
        <button
          onClick={handleDownload}
          disabled={downloading}
          className="p-1.5 text-text-tertiary hover:text-text-primary hover:bg-bg-hover rounded transition-colors disabled:opacity-40"
          title="Download"
        >
          <Download size={16} className={downloading ? "animate-pulse" : ""} />
        </button>

        {/* Close */}
        <button
          onClick={onClose}
          className="p-1.5 text-text-tertiary hover:text-danger-text hover:bg-danger-bg/10 rounded transition-colors"
          title="Close"
        >
          <X size={18} />
        </button>
      </div>

      {/* Content */}
      <div ref={contentRef} className="flex-1 overflow-auto">
        {renderPreview()}
      </div>
    </div>
  );

  if (fullscreen) {
    return (
      <div
        className="fixed inset-0 z-[99] flex items-center justify-center bg-black/80"
        onClick={handleBackdropClick}
        onKeyDown={handleKeyDown}
        tabIndex={-1}
      >
        {modalContent}
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-[99] flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-sm"
      onClick={handleBackdropClick}
      onKeyDown={handleKeyDown}
      tabIndex={-1}
    >
      {modalContent}
    </div>
  );
}
