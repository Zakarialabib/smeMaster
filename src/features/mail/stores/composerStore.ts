import { create } from "zustand";
import { initialAsyncState } from "@shared/stores/createAsyncStore";
import { createEventBusSubscription } from "@shared/stores/createEventBusSubscription";

export type ComposerMode = "new" | "reply" | "replyAll" | "forward";
export type ComposerViewMode = "modal" | "fullpage";

export interface ComposerAttachment {
  id: string;
  file: File;
  filename: string;
  mimeType: string;
  size: number;
  content: string; // base64
}

export interface ComposerState {
  isOpen: boolean;
  mode: ComposerMode;
  to: string[];
  cc: string[];
  bcc: string[];
  subject: string;
  bodyHtml: string;
  threadId: string | null;
  inReplyToMessageId: string | null;
  showCcBcc: boolean;
  draftId: string | null;
  undoSendTimer: ReturnType<typeof setTimeout> | null;
  undoSendVisible: boolean;
  /** Global undo-send window in seconds (mirrors the `undo_send_delay_seconds` setting). */
  undoSendDelay: number;
  pendingSendOpId: string | null;
  attachments: ComposerAttachment[];
  lastSavedAt: number | null;
  isSaving: boolean;
  isLoading: boolean;
  error: string | null;
  fromEmail: string | null;
  viewMode: ComposerViewMode;
  signatureHtml: string;
  signatureId: string | null;
  /** Pre-selected template ID (resolved on open) */
  templateId: string | null;
  /** Contact ID for recipient prefill & variable resolution */
  contactId: string | null;
  /** Key-value variables for template interpolation */
  prefillVariables: Record<string, string>;
  /** Auto-open AI assist with specific suggestion mode */
  aiSuggestMode: 'compose' | 'reply' | 'rewrite' | null;

  openComposer: (opts?: {
    mode?: ComposerMode;
    to?: string[];
    cc?: string[];
    bcc?: string[];
    subject?: string;
    bodyHtml?: string;
    threadId?: string | null;
    inReplyToMessageId?: string | null;
    draftId?: string | null;
    /** Pre-select a template by ID for insertion on open */
    templateId?: string | null;
    /** Prefill recipient from a contact ID (resolves name, email, etc.) */
    contactId?: string | null;
    /** Key-value variables for template body interpolation */
    prefillVariables?: Record<string, string>;
    /** Auto-open AI assist in specific mode */
    aiSuggestMode?: 'compose' | 'reply' | 'rewrite' | null;
  }) => void;
  closeComposer: () => void;
  setTo: (to: string[]) => void;
  setCc: (cc: string[]) => void;
  setBcc: (bcc: string[]) => void;
  setSubject: (subject: string) => void;
  setBodyHtml: (bodyHtml: string) => void;
  setShowCcBcc: (show: boolean) => void;
  setDraftId: (id: string | null) => void;
  setUndoSendTimer: (timer: ReturnType<typeof setTimeout> | null) => void;
  setUndoSendVisible: (visible: boolean) => void;
  setUndoSendDelay: (seconds: number) => void;
  setPendingSendOpId: (id: string | null) => void;
  setTemplateId: (id: string | null) => void;
  setContactId: (id: string | null) => void;
  setPrefillVariables: (vars: Record<string, string>) => void;
  setAiSuggestMode: (mode: 'compose' | 'reply' | 'rewrite' | null) => void;
  addAttachment: (attachment: ComposerAttachment) => void;
  removeAttachment: (id: string) => void;
  clearAttachments: () => void;
  setLastSavedAt: (ts: number | null) => void;
  setIsSaving: (saving: boolean) => void;
  setFromEmail: (email: string | null) => void;
  setViewMode: (mode: ComposerViewMode) => void;
  setSignatureHtml: (html: string) => void;
  setSignatureId: (id: string | null) => void;
  handleEvent: (eventType: string, payload: unknown) => void;
}

export const useComposerStore = create<ComposerState>((set, get) => ({
  isOpen: false,
  mode: "new",
  to: [],
  cc: [],
  bcc: [],
  subject: "",
  bodyHtml: "",
  threadId: null,
  inReplyToMessageId: null,
  showCcBcc: false,
  draftId: null,
  undoSendTimer: null,
  undoSendVisible: false,
  undoSendDelay: 10,
  pendingSendOpId: null,
  attachments: [],
  viewMode: "modal",
  fromEmail: null,
  lastSavedAt: null,
  isSaving: false,
  ...initialAsyncState,
  signatureHtml: "",
  signatureId: null,
  templateId: null,
  contactId: null,
  prefillVariables: {},
  aiSuggestMode: null,

  openComposer: (opts) =>
    set({
      isOpen: true,
      mode: opts?.mode ?? "new",
      to: opts?.to ?? [],
      cc: opts?.cc ?? [],
      bcc: opts?.bcc ?? [],
      subject: opts?.subject ?? "",
      bodyHtml: opts?.bodyHtml ?? "",
      threadId: opts?.threadId ?? null,
      inReplyToMessageId: opts?.inReplyToMessageId ?? null,
      showCcBcc: (opts?.cc?.length ?? 0) > 0 || (opts?.bcc?.length ?? 0) > 0,
      draftId: opts?.draftId ?? null,
      templateId: opts?.templateId ?? null,
      contactId: opts?.contactId ?? null,
      prefillVariables: opts?.prefillVariables ?? {},
      aiSuggestMode: opts?.aiSuggestMode ?? null,
      viewMode: "modal",
      fromEmail: null,
      attachments: [],
      lastSavedAt: null,
      isSaving: false,
      ...initialAsyncState,
      signatureHtml: "",
      signatureId: null,
    }),
  closeComposer: () =>
    set({
      isOpen: false,
      mode: "new",
      to: [],
      cc: [],
      bcc: [],
      subject: "",
      bodyHtml: "",
      threadId: null,
      inReplyToMessageId: null,
      showCcBcc: false,
      draftId: null,
      templateId: null,
      contactId: null,
      prefillVariables: {},
      aiSuggestMode: null,
      viewMode: "modal",
      fromEmail: null,
      attachments: [],
      lastSavedAt: null,
      isSaving: false,
      ...initialAsyncState,
      signatureHtml: "",
      signatureId: null,
    }),
  setTo: (to) => set({ to }),
  setCc: (cc) => set({ cc }),
  setBcc: (bcc) => set({ bcc }),
  setSubject: (subject) => set({ subject }),
  setBodyHtml: (bodyHtml) => set({ bodyHtml }),
  setShowCcBcc: (showCcBcc) => set({ showCcBcc }),
  setDraftId: (draftId) => set({ draftId }),
  setUndoSendTimer: (undoSendTimer) => set({ undoSendTimer }),
  setUndoSendVisible: (undoSendVisible) => set({ undoSendVisible }),
  setUndoSendDelay: (seconds) => set({ undoSendDelay: seconds }),
  addAttachment: (attachment) =>
    set((state) => ({ attachments: [...state.attachments, attachment] })),
  removeAttachment: (id) =>
    set((state) => ({
      attachments: state.attachments.filter((a) => a.id !== id),
    })),
  clearAttachments: () => set({ attachments: [] }),
  setLastSavedAt: (lastSavedAt) => set({ lastSavedAt }),
  setIsSaving: (isSaving) => set({ isSaving }),
  setFromEmail: (fromEmail) => set({ fromEmail }),
  setViewMode: (viewMode) => set({ viewMode }),
  setSignatureHtml: (signatureHtml) => set({ signatureHtml }),
  setSignatureId: (signatureId) => set({ signatureId }),
  setPendingSendOpId: (id) => set({ pendingSendOpId: id }),
  setTemplateId: (id) => set({ templateId: id }),
  setContactId: (id) => set({ contactId: id }),
  setPrefillVariables: (vars) => set({ prefillVariables: vars }),
  setAiSuggestMode: (mode) => set({ aiSuggestMode: mode }),

  /**
   * Unified event handler called by the EventBus.
   * Routes `composer:open` to `openComposer`.
   */
  handleEvent: (eventType, payload) => {
    if (eventType === "composer:open") {
      const p = payload as {
        mode?: ComposerMode;
        templateId?: string;
        contactId?: string;
        prefillVariables?: Record<string, string>;
        aiSuggestMode?: 'compose' | 'reply' | 'rewrite';
        to?: string[];
        cc?: string[];
        bcc?: string[];
        subject?: string;
        bodyHtml?: string;
        threadId?: string;
        inReplyToMessageId?: string;
        draftId?: string;
      };
      get().openComposer({
        mode: p.mode ?? "new",
        templateId: p.templateId ?? null,
        contactId: p.contactId ?? null,
        prefillVariables: p.prefillVariables ?? {},
        aiSuggestMode: p.aiSuggestMode ?? null,
        to: p.to,
        cc: p.cc,
        bcc: p.bcc,
        subject: p.subject,
        bodyHtml: p.bodyHtml,
        threadId: p.threadId ?? null,
        inReplyToMessageId: p.inReplyToMessageId ?? null,
        draftId: p.draftId ?? null,
      });
    }
  },
}));

// ── EventBus self-subscription ────────────────────────────────────────────

/**
 * Subscribe the composer store to its owned events.
 *   - `composer:open` → opens the compose window with the given mode
 */
const composerStoreEventSub = createEventBusSubscription("composerStore", {
  "composer:open": (payload) => {
    useComposerStore.getState().handleEvent?.("composer:open", payload);
  },
});

/**
 * Initialize the composer store's EventBus subscription. Idempotent —
 * subsequent calls return the same cleanup function. Returns a cleanup
 * function that removes all registered handlers.
 */
export function initComposerStoreEvents(): () => void {
  return composerStoreEventSub.init();
}

// Eagerly initialise in browser environments (module-level side-effect).
if (typeof window !== "undefined") {
  initComposerStoreEvents();
}
