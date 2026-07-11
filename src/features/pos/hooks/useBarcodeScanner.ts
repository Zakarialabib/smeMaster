import { useEffect, useRef } from 'react';

export function useBarcodeScanner(onScan: (barcode: string) => void) {
  const buffer = useRef<string>('');
  const lastKeyTime = useRef<number>(0);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const now = Date.now();

      // Scanners usually type very fast (< 50ms between keys)
      if (now - lastKeyTime.current > 100) {
        buffer.current = '';
      }

      lastKeyTime.current = now;

      if (e.key === 'Enter') {
        if (buffer.current.length > 3) {
          onScan(buffer.current);
        }
        buffer.current = '';
      } else if (e.key.length === 1) {
        buffer.current += e.key;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onScan]);
}
