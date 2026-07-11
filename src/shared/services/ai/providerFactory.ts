/**
 * Generic factory for creating singleton-cached AI provider clients.
 * Handles client caching, invalidation on key change, and cleanup.
 */
export function createProviderFactory<TClient>(
  createClient: (apiKey: string) => TClient,
): {
  getClient: (apiKey: string) => TClient;
  clear: () => void;
} {
  let instance: TClient | null = null;
  let cachedKey: string | null = null;

  return {
    getClient(apiKey: string): TClient {
      if (!instance || cachedKey !== apiKey) {
        instance = createClient(apiKey);
        cachedKey = apiKey;
      }
      return instance;
    },
    clear() {
      instance = null;
      cachedKey = null;
    },
  };
}

/**
 * Shared test helper for provider connection tests.
 * Wraps a callable and returns true on success, false on any error.
 */
export async function runTest(callable: () => Promise<unknown>): Promise<boolean> {
  try {
    await callable();
    return true;
  } catch {
    return false;
  }
}
