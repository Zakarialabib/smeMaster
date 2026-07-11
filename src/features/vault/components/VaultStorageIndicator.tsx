import { HardDrive } from "lucide-react";

interface VaultStorageIndicatorProps {
  usedBytes: number;
  className?: string;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
}

export function VaultStorageIndicator({
  usedBytes,
  className = "",
}: VaultStorageIndicatorProps) {
  return (
    <div
      className={`flex items-center gap-2 text-xs text-text-tertiary ${className}`}
    >
      <HardDrive size={14} className="shrink-0" aria-hidden="true" />
      <span className="font-medium">Storage:</span>
      <span>{formatBytes(usedBytes)} used</span>
    </div>
  );
}
