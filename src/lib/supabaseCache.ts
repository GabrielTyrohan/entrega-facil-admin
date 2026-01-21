import {
  useInsertMutation,
  useUpdateMutation,
  useDeleteMutation,
} from '@supabase-cache-helpers/postgrest-react-query';
import { useQueryClient, useQuery, UseQueryResult } from '@tanstack/react-query';
import { supabase } from './supabase';
import { CACHE_KEYS, CACHE_TIMES } from './constants/queryKeys';

// Re-export constants for backward compatibility if needed, 
// but preferred usage is direct import from constants
export { CACHE_KEYS, CACHE_TIMES };

// Hook genérico para queries com cache otimizado
export const useSupabaseQuery = <TData = any>(
  tableName: keyof typeof CACHE_KEYS,
  queryBuilder: any,
  queryKey: any[],
  options?: {
    enabled?: boolean;
    staleTime?: number;
    gcTime?: number;
  }
): UseQueryResult<TData, Error> & { count?: number | null } => {
  const cacheConfig = CACHE_TIMES[tableName as keyof typeof CACHE_TIMES];
  
  // Função helper para executar a query
  const queryFn = async () => {
    const { data, error, count } = await queryBuilder;
    if (error) throw error;
    return { 
      data, 
      count: count ?? null 
    };
  };

  const queryOptions = {
    queryKey,
    queryFn,
    enabled: options?.enabled !== false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    staleTime: options?.staleTime || (cacheConfig ? cacheConfig.staleTime : 5 * 60 * 1000),
    gcTime: options?.gcTime || (cacheConfig ? cacheConfig.gcTime : 30 * 60 * 1000),
  };
  
  const queryResult = useQuery(queryOptions);

  return {
    ...queryResult,
    data: (queryResult.data as any)?.data as TData,
    count: (queryResult.data as any)?.count,
  } as UseQueryResult<TData, Error> & { count?: number | null };
};

// Hook para mutações com invalidação automática de cache e atualizações otimistas
export const useSupabaseMutation = (
  tableName: keyof typeof CACHE_KEYS,
  mutationType: 'insert' | 'update' | 'delete',
  options?: {
    onSuccess?: (data: any) => void;
    onError?: (error: any) => void;
    invalidateRelated?: (keyof typeof CACHE_KEYS)[];
    optimisticUpdate?: {
      updateFn: (oldData: any, variables: any) => any;
      rollbackFn?: (oldData: any, error: any, variables: any) => any;
    };
  }
) => {
  const queryClient = useQueryClient();
  
  const invalidateCache = (relatedTables?: (keyof typeof CACHE_KEYS)[]) => {
    // Invalidar cache da tabela principal
    queryClient.invalidateQueries({
      queryKey: [CACHE_KEYS[tableName]],
    });
    
    // Invalidar cache de tabelas relacionadas
    if (relatedTables) {
      relatedTables.forEach(table => {
        queryClient.invalidateQueries({
          queryKey: [CACHE_KEYS[table]],
        });
      });
    }
  };

  const baseOptions = {
    onMutate: options?.optimisticUpdate ? async (variables: any) => {
      // Cancelar queries em andamento para evitar conflitos
      await queryClient.cancelQueries({ queryKey: [CACHE_KEYS[tableName]] });
      
      // Snapshot do estado anterior
      const previousData = queryClient.getQueryData([CACHE_KEYS[tableName]]);
      
      // Aplicar atualização otimista
      if (previousData && options.optimisticUpdate) {
        queryClient.setQueryData(
          [CACHE_KEYS[tableName]], 
          options.optimisticUpdate.updateFn(previousData, variables)
        );
      }
      
      // Retornar contexto para rollback se necessário
      return { previousData };
    } : undefined,
    
    onError: options?.optimisticUpdate ? (error: any, variables: any, context: any) => {
      // Rollback em caso de erro
      if (context?.previousData) {
        queryClient.setQueryData([CACHE_KEYS[tableName]], context.previousData);
      }
      
      // Executar função de rollback customizada se fornecida
      if (options.optimisticUpdate?.rollbackFn && context?.previousData) {
        const rolledBackData = options.optimisticUpdate.rollbackFn(
          context.previousData, 
          error, 
          variables
        );
        queryClient.setQueryData([CACHE_KEYS[tableName]], rolledBackData);
      }
      
      options?.onError?.(error);
    } : options?.onError,
    
    onSuccess: (data: any) => {
      invalidateCache(options?.invalidateRelated);
      options?.onSuccess?.(data);
    },
    
    onSettled: () => {
      // Sempre revalidar após a mutação para garantir consistência
      queryClient.invalidateQueries({ queryKey: [CACHE_KEYS[tableName]] });
    },
  };

  switch (mutationType) {
    case 'insert':
      return useInsertMutation(
        supabase.from(CACHE_KEYS[tableName]) as any,
        ['id'],
        null,
        baseOptions
      );
    
    case 'update':
      return useUpdateMutation(
        supabase.from(CACHE_KEYS[tableName]) as any,
        ['id'],
        null,
        baseOptions
      );
    
    case 'delete':
      return useDeleteMutation(
        supabase.from(CACHE_KEYS[tableName]) as any,
        ['id'],
        null,
        baseOptions
      );
    
    default:
      throw new Error(`Tipo de mutação não suportado: ${mutationType}`);
  }
};

// Função para invalidar cache relacionado após mutações
export const invalidateRelatedCache = (
  queryClient: ReturnType<typeof useQueryClient>,
  mainTable: keyof typeof CACHE_KEYS,
  relatedTables: (keyof typeof CACHE_KEYS)[] = []
) => {
  // Invalidar tabela principal
  queryClient.invalidateQueries({
    queryKey: [CACHE_KEYS[mainTable]],
  });
  
  // Invalidar tabelas relacionadas
  relatedTables.forEach(table => {
    queryClient.invalidateQueries({
      queryKey: [CACHE_KEYS[table]],
    });
  });
};

// Função para pré-carregar dados relacionados
export const prefetchRelatedData = async (
  queryClient: ReturnType<typeof useQueryClient>,
  tableName: keyof typeof CACHE_KEYS,
  queryFn: () => Promise<any>
) => {
  const cacheConfig = CACHE_TIMES[tableName as keyof typeof CACHE_TIMES];
  
  await queryClient.prefetchQuery({
    queryKey: [CACHE_KEYS[tableName]],
    queryFn,
    staleTime: cacheConfig?.staleTime || 5 * 60 * 1000,
  });
};

// Configuração de sincronização em tempo real (opcional)
export const setupRealtimeSync = (
  queryClient: ReturnType<typeof useQueryClient>,
  tableName: keyof typeof CACHE_KEYS
) => {
  const channel = supabase
    .channel(`${CACHE_KEYS[tableName]}_changes`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: CACHE_KEYS[tableName],
      },
      () => {
        // Invalidar cache quando há mudanças na tabela
        queryClient.invalidateQueries({
          queryKey: [CACHE_KEYS[tableName]],
        });
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
};
