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
