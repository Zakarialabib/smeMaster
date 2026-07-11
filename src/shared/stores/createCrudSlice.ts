export interface CrudSliceOptions {
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export function createCrudSlice(options: CrudSliceOptions): {
  withCreate: <R>(mutate: () => Promise<R>, reload: () => Promise<void>, onError?: string) => Promise<R | undefined>;
  withDelete: <R>(mutate: () => Promise<R>, reload: () => Promise<void>, onError?: string) => Promise<R | undefined>;
} {
  const wrapMutation = async <R>(mutate: () => Promise<R>, reload: () => Promise<void>, onError?: string): Promise<R | undefined> => {
    options.setLoading(true);
    options.setError(null);
    try {
      await mutate();
      await reload();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      options.setError(message);
      if (onError) {
        console.error(onError);
      }
      return undefined;
    } finally {
      options.setLoading(false);
    }
  };

  return {
    withCreate: wrapMutation,
    withDelete: wrapMutation,
  };
}