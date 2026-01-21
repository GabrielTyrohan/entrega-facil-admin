import { QueryClient } from '@tanstack/react-query';
import { DEFAULT_CACHE_CONFIG } from '../constants/queryKeys';

// Configuração otimizada do QueryClient para cache eficiente
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Tempo que os dados ficam "frescos" antes de serem considerados stale
      staleTime: DEFAULT_CACHE_CONFIG.staleTime,
      
      // Tempo que os dados ficam no cache antes de serem removidos
      gcTime: DEFAULT_CACHE_CONFIG.gcTime,
      
      // Revalidar quando a janela ganha foco
      refetchOnWindowFocus: false,
      
      // Revalidar quando a conexão é restaurada
      refetchOnReconnect: true,
      
      // Retry automático em caso de erro
      retry: 1, // Reduzido para 1 tentativa conforme solicitado
      
      // Delay entre retries (exponential backoff)
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    },
    mutations: {
      // Retry para mutações em caso de erro de rede
      retry: (failureCount, error: any) => {
        // Não fazer retry para erros 4xx
        if (error?.status >= 400 && error?.status < 500) {
          return false;
        }
        // Máximo de 2 tentativas para mutações
        return failureCount < 2;
      },
    },
  },
});

// Função para invalidar cache de uma tabela específica
export const invalidateTableCache = (tableName: string) => {
  queryClient.invalidateQueries({
    queryKey: [tableName],
  });
};

// Função para invalidar cache de múltiplas tabelas
export const invalidateMultipleTablesCache = (tableNames: string[]) => {
  tableNames.forEach(tableName => {
    queryClient.invalidateQueries({
      queryKey: [tableName],
    });
  });
};

// Função para limpar todo o cache
export const clearAllCache = () => {
  queryClient.clear();
};

// Função para pré-carregar dados (prefetch)
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
