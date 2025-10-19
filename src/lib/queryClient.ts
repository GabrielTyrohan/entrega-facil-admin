import { QueryClient } from '@tanstack/react-query';

// Configuração otimizada do QueryClient para cache eficiente
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Tempo que os dados ficam "frescos" antes de serem considerados stale
      staleTime: 5 * 60 * 1000, // 5 minutos
      
      // Tempo que os dados ficam no cache antes de serem removidos
      gcTime: 10 * 60 * 1000, // 10 minutos (anteriormente cacheTime)
      
      // Revalidar quando a janela ganha foco
      refetchOnWindowFocus: true,
      
      // Revalidar quando a conexão é restaurada
      refetchOnReconnect: true,
      
      // Não revalidar automaticamente ao montar o componente se os dados ainda estão frescos
      refetchOnMount: 'always',
      
      // Retry automático em caso de erro
      retry: (failureCount, error: any) => {
        // Não fazer retry para erros 4xx (client errors)
        if (error?.status >= 400 && error?.status < 500) {
          return false;
        }
        // Máximo de 3 tentativas para outros erros
        return failureCount < 3;
      },
      
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
    staleTime: staleTime || 5 * 60 * 1000, // 5 minutos por padrão
  });
};
