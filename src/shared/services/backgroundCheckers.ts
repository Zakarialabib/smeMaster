export interface BackgroundChecker {
  start(): void;
  stop(): void;
}

export function createBackgroundChecker(
  name: string,
  checkFn: () => Promise<void>,
  intervalMs: number = 60_000,
): BackgroundChecker {
  let interval: ReturnType<typeof setInterval> | null = null;

  const run = async () => {
    try {
      await checkFn();
    } catch (err) {
      // Outside a Tauri shell (browser dev server / web build) every
      // IPC-backed check rejects with TauriUnavailableError on each
      // interval — an expected condition, not a failure. Demote it to a
      // debug line so genuine errors keep their console.error visibility.
      if (typeof err === 'object' && err !== null && 'isTauriUnavailable' in err) {
        console.debug(`[${name}] check skipped (Tauri backend unavailable)`);
        return;
      }
      console.error(`[${name}] check failed:`, err);
    }
  };

  return {
    start() {
      if (interval) return;
      run();
      interval = setInterval(run, intervalMs);
    },
    stop() {
      if (interval) {
        clearInterval(interval);
        interval = null;
      }
    },
  };
}
