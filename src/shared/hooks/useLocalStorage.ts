/**
 * @deprecated Use `usePersistentStorage` from
 * `@shared/hooks/usePersistentStorage` instead.
 *
 * This shim remains for backwards compatibility with the old
 * `(value, setValue) => void` tuple API. Under the hood it routes
 * through the same `tauri-plugin-store` (with `localStorage` fallback)
 * so callers get cross-platform durable persistence for free.
 *
 * The setter is fire-and-forget (returns void) to match the old API,
 * but writes are awaited internally and errors are swallowed.
 */
import { useEffect, useState } from "react";
import {
  usePersistentStorage,
  type UsePersistentStorageResult,
} from "./usePersistentStorage";

export function useLocalStorage<T>(
  key: string,
  initialValue: T,
): [T, (value: T) => void] {
  const { value, setValue }: UsePersistentStorageResult<T> =
    usePersistentStorage<T>(key, initialValue);

  // Mirror `value` into local React state so the API stays synchronous
  // for legacy callers. The persistence write still goes through
  // `setValue` so the durable store is updated.
  const [localValue, setLocalValue] = useState<T>(value);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  return [
    localValue,
    (next: T) => {
      setLocalValue(next);
      void setValue(next);
    },
  ];
}
