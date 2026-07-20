import { useState } from 'react';

interface AsyncError {
  message: string;
  code?: string;
  details?: any;
}

interface UseAsyncErrorReturn {
  error: AsyncError | null;
  setError: (error: AsyncError | null) => void;
  clearError: () => void;
  withErrorHandling: <T>(operation: () => Promise<T>) => Promise<T>;
}

export const useAsyncError = (): UseAsyncErrorReturn => {
  const [error, setErrorState] = useState<AsyncError | null>(null);

  const setError = (error: AsyncError | null) => {
    setErrorState(error);
    if (error) {
      console.error('Async error:', error);
    }
  };

  const clearError = () => {
    setErrorState(null);
  };

  const withErrorHandling = async <T>(operation: () => Promise<T>): Promise<T> => {
    clearError();
    try {
      return await operation();
    } catch (err) {
      const error: AsyncError = {
        message: err instanceof Error ? err.message : 'An unknown error occurred',
        code: err instanceof Error ? err.name : 'UNKNOWN_ERROR',
        details: err
      };
      setError(error);
      throw error;
    }
  };

  return {
    error,
    setError,
    clearError,
    withErrorHandling
  };
};
