import { useState, useCallback, useRef, useEffect } from "react";
import { updateContactNotes } from "@features/contacts/db/contacts";

// ─── Hook ───────────────────────────────────────────────────────────────────

export interface UseContactNotesOptions {
  /** Contact email used as the save target */
  email: string;
  /** Initial notes value (e.g. from DB) */
  initialNotes?: string;
  /** Debounce delay in ms (default: 1000) */
  debounceMs?: number;
}

export interface UseContactNotesReturn {
  notes: string;
  setNotes: (value: string) => void;
  handleChange: (value: string) => void;
  handleBlur: () => void;
  isDirty: boolean;
}

/**
 * Shared hook for debounced auto-save contact notes.
 *
 * - Saves via `updateContactNotes` after a configurable debounce delay
 * - Flushes immediately on blur
 * - Tracks dirty state for UI indicators
 * - Cleans up timer on unmount
 *
 * Used by both `ContactSidebar` (mail) and `ContactDetailPage` (contacts).
 */
export function useContactNotes(
  email: string,
  initialNotes: string = "",
  debounceMs: number = 1000,
): UseContactNotesReturn {
  const [notes, setNotes] = useState(initialNotes);
  const [isDirty, setIsDirty] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync when initialNotes changes (e.g. switching contacts)
  useEffect(() => {
    setNotes(initialNotes);
  }, [initialNotes]);

  const save = useCallback(
    (value: string) => {
      updateContactNotes(email, value);
    },
    [email],
  );

  const handleChange = useCallback(
    (value: string) => {
      setNotes(value);
      setIsDirty(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        save(value);
        setIsDirty(false);
      }, debounceMs);
    },
    [save, debounceMs],
  );

  const handleBlur = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    save(notes);
    setIsDirty(false);
  }, [save, notes]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return { notes, setNotes, handleChange, handleBlur, isDirty };
}
