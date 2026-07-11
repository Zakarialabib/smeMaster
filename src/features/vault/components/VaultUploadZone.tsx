import { useCallback, useState, useRef } from "react";
import { Upload } from "lucide-react";

interface VaultUploadZoneProps {
  onUpload: (sourcePath: string, fileName: string) => void;
  className?: string;
}

export function VaultUploadZone({
  onUpload,
  className = "",
}: VaultUploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const dragCounterRef = useRef(0);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current += 1;
    if (dragCounterRef.current === 1) {
      setIsDragging(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current -= 1;
    if (dragCounterRef.current === 0) {
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounterRef.current = 0;
      setIsDragging(false);

      // Native drag-and-drop of files from OS file manager provides
      // file paths through dataTransfer. On Tauri, these are absolute paths.
      const files = e.dataTransfer.files;
      if (files.length > 0) {
        // In a Tauri context, the dropped file has a path property
        const file = files[0];
        if (file && "path" in file) {
          const sourcePath = (file as File & { path: string }).path;
          const fileName = file.name;
          onUpload(sourcePath, fileName);
        }
      }
    },
    [onUpload],
  );

  return (
    <div
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className={`
        flex items-center justify-center p-4 rounded-lg border-2 border-dashed transition-all
        ${
          isDragging
            ? "border-accent bg-accent/5 scale-[1.01]"
            : "border-border-secondary hover:border-accent/30"
        }
        ${className}
      `}
      role="region"
      aria-label="Upload zone"
    >
      <div className="flex flex-col items-center gap-2 text-center">
        <Upload
          size={24}
          className={`transition-colors ${
            isDragging ? "text-accent" : "text-text-tertiary"
          }`}
          aria-hidden="true"
        />
        <p className="text-xs text-text-tertiary">
          {isDragging
            ? "Drop to upload"
            : "Drag & drop files here"}
        </p>
      </div>
    </div>
  );
}
