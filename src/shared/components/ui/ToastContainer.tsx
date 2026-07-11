import { useToastStore } from "@shared/stores/toastStore";

const TYPE_STYLES = {
  success: "bg-success/15 border-success/30 text-success",
  error: "bg-danger/15 border-danger/30 text-danger",
  info: "bg-accent/15 border-accent/30 text-accent",
};

const ICONS = {
  success: "✓",
  error: "✕",
  info: "ⓘ",
};

export function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);
  const remove = useToastStore((s) => s.removeToast);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] flex flex-col gap-2 w-[calc(100%-2rem)] max-w-sm pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto flex items-start gap-2.5 px-4 py-3 rounded-2xl border backdrop-blur-[20px] shadow-lg animate-[toastSlideIn_350ms_cubic-bezier(0.16,1,0.3,1)] ${TYPE_STYLES[t.type]}`}
        >
          <span className="text-sm font-bold leading-none mt-0.5 shrink-0">{ICONS[t.type]}</span>
          <p className="text-sm font-medium leading-snug flex-1">{t.message}</p>
          <button
            onClick={() => remove(t.id)}
            className="text-xs opacity-60 hover:opacity-100 transition-opacity shrink-0"
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
