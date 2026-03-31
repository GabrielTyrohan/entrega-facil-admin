import { QueryClient } from '@tanstack/react-query';
import { DEFAULT_CACHE_CONFIG } from '../constants/queryKeys';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: DEFAULT_CACHE_CONFIG.staleTime,
      gcTime: DEFAULT_CACHE_CONFIG.gcTime,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      refetchOnMount: true, // ← única mudança necessária
      retry: 1,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    },
    mutations: {
      retry: (failureCount, error: any) => {
        if (error?.status >= 400 && error?.status < 500) return false;
        return failureCount < 2;
      },
    },
  },
});

export const invalidateTableCache = (tableName: string) => {
  queryClient.invalidateQueries({ queryKey: [tableName] });
};

export const invalidateMultipleTablesCache = (tableNames: string[]) => {
  tableNames.forEach(tableName => {
    queryClient.invalidateQueries({ queryKey: [tableName] });
  });
};

export const clearAllCache = () => {
  queryClient.clear();
};

export const prefetchTableData = async (
  tableName: string,
  queryFn: () => Promise<any>,
  staleTime?: number
) => {
  await queryClient.prefetchQuery({
    queryKey: [tableName],
    queryFn,
    staleTime: staleTime || DEFAULT_CACHE_CONFIG.staleTime,
  });
};