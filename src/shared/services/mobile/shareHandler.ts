
import { listen } from "@tauri-apps/api/event";
import { invokeCommand } from "@shared/services/db/invoke/command";
import { isAndroid } from "@shared/services/nativeBridges";
import { isAndroid } from "@shared/services/nativeBridges";
import { escapeHtml } from "@shared/utils/sanitize";
import { useComposerStore } from "@features/mail/stores/composerStore";

interface SharePayload {
  text: string;
  url?: string;
  title?: string;
}

async function handleShare(payload: SharePayload): Promise<void> {
  const { WebviewWindow } = await import("@tauri-apps/api/webviewWindow");
  const mainWindow = await WebviewWindow.getByLabel("main");
  if (mainWindow) {
    await mainWindow.show();
    await mainWindow.setFocus();
  }

  useComposerStore.getState().openComposer({
    mode: "new",
    subject: payload.title ?? "",
    bodyHtml: `<p>${escapeHtml(payload.text)}</p>`,
  });
}

export async function initShareHandler(): Promise<() => void> {
  const cleanups: Array<() => void> = [];

  try {
    const unlisten = await listen<SharePayload>("share:received", (event) => {
      handleShare(event.payload);
    });
    cleanups.push(unlisten);
  } catch (err) {
    console.error("Failed to register share handler:", err);
  }

  // Check for any pending share missed while the app was loading.
  // Rust stores the data and emits an event; if the event arrived before
  // the listener was ready, getPendingShare catches the fallback.
  // The share plugin is Android-only, so skip the IPC call on desktop/Web
  // (where the plugin doesn't exist) to avoid console errors.
  if (isAndroid()) {
    try {
      const pending = await getPendingShare();
      if (pending) {
        handleShare(pending);
      }
    } catch {
      // not in Tauri environment
    }
  }

  return () => {
    for (const cleanup of cleanups) {
      cleanup();
    }
  };
}

export async function getPendingShare(): Promise<SharePayload | null> {
  try {
    return await invokeCommand<SharePayload | null>("plugin:share|get_pending_share");
  } catch {
    return null;
  }
}
