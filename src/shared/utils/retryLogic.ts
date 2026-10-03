import { useState, useCallback, useRef } from 'react';

interface RetryOptions {
  maxAttempts?: number;
  baseDelay?: number;
  maxDelay?: number;
  retryCondition?: (error: any) => boolean;
  onRetry?: (attempt: number, error: any) => void;
}

interface UseRetryableOperationReturn {
  execute: <T>(operation: () => Promise<T>) => Promise<T>;
  isRetrying: boolean;
  attempts: number;
  lastError: any;
  reset: () => void;
}

/** Exponential backoff with a ceiling. Module-scope so it is referentially
 * stable and can be listed as a hook dependency. */
function calculateDelay(attempt: number, baseDelay: number, maxDelay: number): number {
  return Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
}

export const useRetryableOperation = (options: RetryOptions = {}): UseRetryableOperationReturn => {
  const {
    maxAttempts = 3,
    baseDelay = 1000,
    maxDelay = 10000,
    retryCondition = () => true,
    onRetry,
  } = options;

  const [isRetrying, setIsRetrying] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [lastError, setLastError] = useState<any>(null);
  const timeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

  const execute = useCallback(
    async <T>(operation: () => Promise<T>): Promise<T> => {
      let lastAttemptError: any = null;

      for (let attempt = 0; attempt <= maxAttempts; attempt++) {
        try {
          if (attempt > 0) {
            setIsRetrying(true);
            setAttempts(attempt);

            if (onRetry) {
              onRetry(attempt, lastAttemptError);
            }

            await new Promise((resolve) => {
              timeoutRef.current = setTimeout(
                resolve,
                calculateDelay(attempt - 1, baseDelay, maxDelay),
              );
            });
          }

          const result = await operation();
          setIsRetrying(false);
          setAttempts(0);
          setLastError(null);
          return result;
        } catch (error) {
          lastAttemptError = error;
          setLastError(error);

          if (attempt === maxAttempts || !retryCondition(error)) {
            setIsRetrying(false);
            throw error;
          }
        }
      }

      throw lastAttemptError;
    },
    [maxAttempts, baseDelay, maxDelay, retryCondition, onRetry],
  );

  const reset = useCallback(() => {
    setIsRetrying(false);
    setAttempts(0);
    setLastError(null);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
  }, []);

  return {
    execute,
    isRetrying,
    attempts,
    lastError,
    reset,
  };
};
