/**
 * Shared utilities for init hooks.
 *
 * Simple retry wrapper with exponential backoff for DB-dependent init phases.
 * Retries on failure up to `maxRetries` times with delays [200ms, 500ms].
 * Returns the result, the `fallbackValue` if all retries fail, or re-throws.
 */
export async function withRetry<T>(
  label: string,
  fn: () => Promise<T>,
  fallbackValue?: T,
): Promise<T | undefined> {
  const delays = [200, 500];
  for (let attempt = 0; attempt <= delays.length; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt < delays.length) {
        console.warn(
          `[init] ${label} failed (attempt ${attempt + 1}), retrying in ${delays[attempt]}ms:`,
          err,
        );
        await new Promise((resolve) => setTimeout(resolve, delays[attempt]));
      } else {
        console.warn(`[init] ${label} failed after ${delays.length + 1} attempts:`, err);
        if (fallbackValue !== undefined) return fallbackValue;
        throw err;
      }
    }
  }
  return undefined;
}