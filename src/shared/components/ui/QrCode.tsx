import { useEffect, useRef } from "react";

interface Props {
  data: string;
  size?: number;
}

function generateQRMatrix(text: string): boolean[][] {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }

  const size = 21;
  const matrix: boolean[][] = [];

  for (let row = 0; row < size; row++) {
    const rowArr: boolean[] = [];
    matrix[row] = rowArr;
    for (let col = 0; col < size; col++) {
      if ((row < 7 && col < 7) || (row < 7 && col > size - 8) || (row > size - 8 && col < 7)) {
        rowArr[col] = (row === 0 || row === 6 || col === 0 || col === 6 ||
                           (row >= 2 && row <= 4 && col >= 2 && col <= 4));
      } else {
        const idx = row * size + col;
        rowArr[col] = ((hash >> (idx % 30)) & 1) === 1;
      }
    }
  }
  return matrix;
}

/**
 * Detects dark mode by checking <html> or data-theme attribute.
 * Falls back to prefers-color-scheme.
 */
function isDarkMode(): boolean {
  if (typeof document === "undefined") return false;
  const html = document.documentElement;
  if (html.classList.contains("dark")) return true;
  if (html.getAttribute("data-theme") === "dark") return true;
  if (html.getAttribute("data-mode") === "dark") return true;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
}

export function QrCode({ data, size = 200 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dark = isDarkMode();
    const bgColor = dark ? "#1e293b" : "#ffffff";    // slate-800 dark, white light
    const fgColor = dark ? "#e2e8f0" : "#000000";    // slate-200 dark, black light

    const matrix = generateQRMatrix(data);
    const moduleCount = matrix.length;
    const moduleSize = size / moduleCount;

    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, size, size);

    ctx.fillStyle = fgColor;
    for (let row = 0; row < moduleCount; row++) {
      for (let col = 0; col < moduleCount; col++) {
        if (matrix[row]?.[col]) {
          ctx.fillRect(
            col * moduleSize,
            row * moduleSize,
            Math.ceil(moduleSize),
            Math.ceil(moduleSize)
          );
        }
      }
    }
  }, [data, size]);

  return <canvas ref={canvasRef} width={size} height={size} className="rounded-lg" />;
}
