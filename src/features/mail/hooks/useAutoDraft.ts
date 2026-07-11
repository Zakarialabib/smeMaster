import { useCallback, useEffect, useRef, useState } from "react";
import {
  isAutoDraftEnabled,
  generateAutoDraft,
  regenerateAutoDraft,
  type AutoDraftMode,
} from "@shared/services/ai/writingStyleService";

export interface UseAutoDraftOptions {
  threadId: string;
  accountId: string;
  messages: unknown[];
  /**
   * Tiptap editor instance (or anything that exposes `.isEmpty` and
   * `.commands.setContent(string)` and an `on`/`off` event emitter). The
   * hook listens to "update" events to abort the draft when the user types.
   */
  editor: {
    isEmpty: boolean;
    commands: { setContent: (html: string) => void };
    on: (event: "update", cb: () => void) => void;
    off: (event: "update", cb: () => void) => void;
  } | null;
  /**
   * Called with the generated draft HTML. Return `true` to accept the draft
   * (the hook will set `hasDraft = true`), or `false` to ignore it.
   * Defaults to `(editor.isEmpty ? draft : null) => draft` — the inline-reply
   * convention of "only insert if the user hasn't typed yet".
   */
  acceptDraft?: (draft: string) => boolean;
}

export interface UseAutoDraftResult {
  loading: boolean;
  hasDraft: boolean;
  /** Trigger an initial auto-draft for the given mode. */
  load: (mode: AutoDraftMode) => Promise<void>;
  /** Re-generate the draft (clears the cache for the current mode). */
  regenerate: (mode: AutoDraftMode) => Promise<void>;
  /** Clear any in-flight draft and the editor content. */
  clear: () => void;
}

/**
 * useAutoDraft — wraps the "generate an AI reply draft and insert it into
 * the editor, but abort if the user has already started typing" pattern
 * used by `InlineReply`.
 *
 * Responsibilities:
 * - Calls `isAutoDraftEnabled()` to gate the feature.
 * - Calls `generateAutoDraft` / `regenerateAutoDraft` and inserts the
 *   result into the editor when the editor is still empty.
 * - Cancels in-flight fetches when the user starts typing (via the
 *   editor's `update` event) or when `clear()` is called.
 * - Exposes `loading` / `hasDraft` for UI state.
 *
 * @example
 * ```ts
 * const { loading, hasDraft, load, regenerate, clear } = useAutoDraft({
 *   threadId: thread.id,
 *   accountId,
 *   messages,
 *   editor,
 * });
 *
 * useEffect(() => {
 *   if (mode === "reply" || mode === "replyAll") load(mode);
 * }, [mode, load]);
 * ```
 */
export function useAutoDraft({
  threadId,
  accountId,
  messages,
  editor,
  acceptDraft,
}: UseAutoDraftOptions): UseAutoDraftResult {
  const [loading, setLoading] = useState(false);
  const [hasDraft, setHasDraft] = useState(false);

  // Stable ref so the abort listener always sees the latest state.
  const loadingRef = useRef(false);
  const abortRef = useRef(false);
  // Latest messages array (so we can read it inside stable callbacks).
  const messagesRef = useRef(messages);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const resetAbort = useCallback(() => {
    abortRef.current = false;
  }, []);

  const runGenerate = useCallback(
    async (
      mode: AutoDraftMode,
      generator: typeof generateAutoDraft | typeof regenerateAutoDraft,
    ): Promise<void> => {
      if (!editor) return;
      resetAbort();
      abortRef.current = false;
      loadingRef.current = true;
      setLoading(true);
      setHasDraft(false);
      try {
        const enabled = await isAutoDraftEnabled();
        if (!enabled || abortRef.current) return;

        const draft = await generator(
          threadId,
          accountId,
          messagesRef.current as never,
          mode,
        );
        if (abortRef.current || !draft) return;

        const accepted = acceptDraft
          ? acceptDraft(draft)
          : editor.isEmpty;
        if (accepted) {
          editor.commands.setContent(draft);
          setHasDraft(true);
        }
      } catch (err) {
        // Swallow — non-fatal. UI shows nothing on error.
        console.warn("Auto-draft generation failed:", err);
      } finally {
        loadingRef.current = false;
        setLoading(false);
      }
    },
    [accountId, acceptDraft, editor, resetAbort, threadId],
  );

  const load = useCallback(
    (mode: AutoDraftMode) => runGenerate(mode, generateAutoDraft),
    [runGenerate],
  );

  const regenerate = useCallback(
    (mode: AutoDraftMode) => runGenerate(mode, regenerateAutoDraft),
    [runGenerate],
  );

  const clear = useCallback(() => {
    abortRef.current = true;
    setHasDraft(false);
    editor?.commands.setContent("");
  }, [editor]);

  // Abort in-flight drafts when the user starts typing.
  useEffect(() => {
    if (!editor) return;
    const onUpdate = () => {
      if (loadingRef.current) {
        abortRef.current = true;
      }
    };
    editor.on("update", onUpdate);
    return () => {
      editor.off("update", onUpdate);
    };
  }, [editor]);

  // Always abort on unmount.
  useEffect(() => {
    return () => {
      abortRef.current = true;
    };
  }, []);

  return { loading, hasDraft, load, regenerate, clear };
}

