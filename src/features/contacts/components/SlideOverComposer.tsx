import { useState, useEffect, useCallback, useRef } from "react";
import { Send, Paperclip, Loader2, ChevronDown } from "lucide-react";
import type { DbContact } from "@features/contacts/db/contacts";
import { Button } from "@shared/components/ui/Button";
import { SlidePanel } from "@shared/components/ui/SlidePanel";

interface SlideOverComposerProps {
  isOpen: boolean;
  onClose: () => void;
  contact: DbContact | null;
  accountId: string;
}

/**
 * SlideOverComposer — non-blocking side panel for composing emails.
 * Replaces the modal-based SendEmailModal. Works while the user can still
 * see the contact context behind it.
 *
 * Backend: invokes `db_send_email` to actually send. The actual send payload
 * is wired in a follow-up; for now this collects the message and surfaces
 * a "ready to send" state.
 */
export function SlideOverComposer({
  isOpen,
  onClose,
  contact,
  accountId: _accountId,
}: SlideOverComposerProps) {
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  const bodyRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (isOpen && contact) {
      setTo(contact.email);
      setSubject("");
      setBody("");
      // Focus the subject for fast keyboard composition
      setTimeout(() => {
        const el = document.getElementById("slide-over-subject");
        el?.focus();
      }, 200);
    }
  }, [isOpen, contact]);

  const handleSend = useCallback(async () => {
    if (!to.trim() || !subject.trim()) return;
    setSending(true);
    try {
      // Placeholder: actual Tauri send command lands in a follow-up.
      // For now we simulate and close.
      await new Promise((r) => setTimeout(r, 500));
      onClose();
    } finally {
      setSending(false);
    }
  }, [to, subject, onClose]);

  // Cmd/Ctrl+Enter sends (Escape → close is handled by SlidePanel)
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        void handleSend();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, handleSend]);

  if (!isOpen) return null;

  return (
    <SlidePanel isOpen={isOpen} onClose={onClose} title="New message">
      {/* Form fields */}
      <div className="border-b border-border-primary">
        <div className="flex items-center px-4 py-2 gap-2 border-b border-border-primary/50">
          <span className="text-xs text-text-tertiary w-12 shrink-0">To</span>
          <input
            type="email"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="flex-1 bg-transparent text-sm text-text-primary outline-none"
            aria-label="To"
          />
          <button
            type="button"
            className="text-xs text-text-tertiary hover:text-accent flex items-center gap-0.5"
            aria-label="Toggle Cc/Bcc"
          >
            Cc/Bcc <ChevronDown size={10} />
          </button>
        </div>
        <div className="flex items-center px-4 py-2 gap-2">
          <span className="text-xs text-text-tertiary w-12 shrink-0">
            Subject
          </span>
          <input
            id="slide-over-subject"
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Subject…"
            className="flex-1 bg-transparent text-sm text-text-primary outline-none"
            aria-label="Subject"
          />
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4">
        <textarea
          ref={bodyRef}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Write your message…"
          className="w-full h-full min-h-[200px] bg-transparent text-sm text-text-primary outline-none resize-none placeholder:text-text-tertiary"
          aria-label="Message body"
        />
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-border-primary flex items-center gap-2">
        <Button
          variant="primary"
          size="sm"
          icon={sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
          onClick={handleSend}
          disabled={sending || !to.trim() || !subject.trim()}
        >
          {sending ? "Sending…" : "Send"}
        </Button>
        <button
          type="button"
          className="p-2 rounded text-text-tertiary hover:text-accent hover:bg-bg-hover min-w-[44px] min-h-[44px] inline-flex items-center justify-center"
          aria-label="Attach file"
          title="Attach file"
        >
          <Paperclip size={16} />
        </button>
        <div className="flex-1" />
        <button
          type="button"
          onClick={onClose}
          className="text-xs text-text-tertiary hover:text-text-primary px-2 py-1"
        >
          Discard
        </button>
      </div>
    </SlidePanel>
  );
}
