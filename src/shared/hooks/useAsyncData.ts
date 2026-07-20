import { useQuery, QueryKey } from '@tanstack/react-query';

interface UseAsyncDataOptions<T, TQueryFnData = T, TError = Error> {
  queryKey: QueryKey;
  queryFn: () => Promise<TQueryFnData>;
  initialData?: TQueryFnData;
  enabled?: boolean;
  staleTime?: number;
  cacheTime?: number;
  onSuccess?: (data: TQueryFnData) => void;
  onError?: (error: TError) => void;
  meta?: Record<string, any>;
}

export const useAsyncData = <T, TError = Error>(
  options: UseAsyncDataOptions<T, T, TError>
) => {
  return useQuery<T, TError>({
    ...options,
    meta: { domain: 'async-data', ...options.meta }
  });
};
