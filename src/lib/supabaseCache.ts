import {
  useInsertMutation,
  useUpdateMutation,
  useDeleteMutation,
} from '@supabase-cache-helpers/postgrest-react-query';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { supabase } from './supabase';

// Configurações de cache por tabela
export const CACHE_KEYS = {
  PRODUTOS: 'produtos',
  CLIENTES: 'clientes', 
  VENDEDORES: 'vendedores',
  ENTREGAS: 'entregas',
  PAGAMENTOS: 'pagamentos',
  CESTAS: 'cestas',
  RESPONSAVEIS: 'responsaveis',
  // Dashboard specific cache keys
  DASHBOARD_STATS: 'dashboard_stats',
  VENDEDORES_ATIVOS: 'vendedores_ativos',
  ENTREGAS_DO_MES: 'entregas_do_mes',
  ENTREGAS_MES_ATUAL: 'entregas_mes_atual',
  ENTREGAS_MES_ANTERIOR: 'entregas_mes_anterior',
  FATURAMENTO_DO_MES: 'faturamento_do_mes',
  FATURAMENTO_MES_ATUAL: 'faturamento_mes_atual',
  FATURAMENTO_MES_ANTERIOR: 'faturamento_mes_anterior',
  VALORES_EM_FALTA: 'valores_em_falta',
  FATURAMENTO_MENSAL: 'faturamento_mensal',
  PAGAMENTOS_MENSAIS: 'pagamentos_mensais',
  TOP_VENDEDORES: 'top_vendedores',
  // Devedores specific cache keys
  DEVEDORES: 'devedores',
  VENDEDORES_FILTRO: 'vendedores_filtro',
  // Vendas mensais por vendedor
  VENDAS_MENSAIS_VENDEDORES: 'vendas_mensais_vendedores',
  // Total de vendas por vendedor
  TOTAL_VENDAS_VENDEDOR: 'total_vendas_vendedor',
  // Total de entregas por administrador
  TOTAL_ENTREGAS_ADMINISTRADOR: 'total_entregas_administrador',
  SUPORTE_SOLICITACOES: 'suporte_solicitacoes',
  SUPORTE_MENSAGENS: 'suporte_mensagens',
  SISTEMA_STATUS: 'sistema_status',
} as const;

// Tempos de cache específicos por tipo de dados
export const CACHE_TIMES = {
  // Dados que mudam raramente
  PRODUTOS: {
    staleTime: 10 * 60 * 1000, // 10 minutos
    gcTime: 30 * 60 * 1000,    // 30 minutos
  },
  // Dados que mudam com frequência média
  CLIENTES: {
    staleTime: 5 * 60 * 1000,  // 5 minutos
    gcTime: 15 * 60 * 1000,    // 15 minutos
  },
  VENDEDORES: {
    staleTime: 5 * 60 * 1000,  // 5 minutos
    gcTime: 15 * 60 * 1000,    // 15 minutos
  },
  // Dados que mudam frequentemente
  ENTREGAS: {
    staleTime: 2 * 60 * 1000,  // 2 minutos
    gcTime: 10 * 60 * 1000,    // 10 minutos
  },
  PAGAMENTOS: {
    staleTime: 2 * 60 * 1000,  // 2 minutos
    gcTime: 10 * 60 * 1000,    // 10 minutos
  },
  CESTAS: {
    staleTime: 3 * 60 * 1000,  // 3 minutos
    gcTime: 10 * 60 * 1000,    // 10 minutos
  },
  RESPONSAVEIS: {
    staleTime: 5 * 60 * 1000,  // 5 minutos
    gcTime: 15 * 60 * 1000,    // 15 minutos
  },
  // Dashboard cache times - dados que mudam com frequência
  DASHBOARD_STATS: {
    staleTime: 1 * 60 * 1000,  // 1 minuto
    gcTime: 5 * 60 * 1000,     // 5 minutos
  },
  VENDEDORES_ATIVOS: {
    staleTime: 5 * 60 * 1000,  // 5 minutos
    gcTime: 15 * 60 * 1000,    // 15 minutos
  },
  ENTREGAS_DO_MES: {
    staleTime: 2 * 60 * 1000,  // 2 minutos
    gcTime: 10 * 60 * 1000,    // 10 minutos
  },
  ENTREGAS_MES_ATUAL: {
    staleTime: 2 * 60 * 1000,  // 2 minutos
    gcTime: 10 * 60 * 1000,    // 10 minutos
  },
  ENTREGAS_MES_ANTERIOR: {
    staleTime: 10 * 60 * 1000, // 10 minutos (dados históricos)
    gcTime: 30 * 60 * 1000,    // 30 minutos
  },
  FATURAMENTO_DO_MES: {
    staleTime: 2 * 60 * 1000,  // 2 minutos
    gcTime: 10 * 60 * 1000,    // 10 minutos
  },
  FATURAMENTO_MES_ATUAL: {
    staleTime: 2 * 60 * 1000,  // 2 minutos
    gcTime: 10 * 60 * 1000,    // 10 minutos
  },
  FATURAMENTO_MES_ANTERIOR: {
    staleTime: 10 * 60 * 1000, // 10 minutos (dados históricos)
    gcTime: 30 * 60 * 1000,    // 30 minutos
  },
  VALORES_EM_FALTA: {
    staleTime: 3 * 60 * 1000,  // 3 minutos
    gcTime: 10 * 60 * 1000,    // 10 minutos
  },
  FATURAMENTO_MENSAL: {
    staleTime: 15 * 60 * 1000, // 15 minutos (dados históricos)
    gcTime: 60 * 60 * 1000,    // 1 hora
  },
  PAGAMENTOS_MENSAIS: {
    staleTime: 15 * 60 * 1000, // 15 minutos (dados históricos)
    gcTime: 60 * 60 * 1000,    // 1 hora
  },
  TOP_VENDEDORES: {
    staleTime: 5 * 60 * 1000,  // 5 minutos
    gcTime: 15 * 60 * 1000,    // 15 minutos
  },
  TOP_VENDEDORES_ATUAL: {
    staleTime: 0, // Sem cache para debug
    gcTime: 0,    // Sem cache para debug
  },
  TOP_VENDEDORES_ANTERIOR: {
    staleTime: 0, // Sem cache para debug
    gcTime: 0,    // Sem cache para debug
  },
  TOP_VENDEDORES_ENTREGAS_ATUAL: {
    staleTime: 0, // Sem cache para debug
    gcTime: 0,    // Sem cache para debug
  },
  TOP_VENDEDORES_ENTREGAS_ANTERIOR: {
    staleTime: 0, // Sem cache para debug
    gcTime: 0,    // Sem cache para debug
  },
  LATEST_PAYMENT: {
    staleTime: 5 * 60 * 1000,  // 5 minutos
    gcTime: 15 * 60 * 1000,    // 15 minutos
  },
  LATEST_ENTREGA: {
    staleTime: 5 * 60 * 1000,  // 5 minutos
    gcTime: 15 * 60 * 1000,    // 15 minutos
  },
  ATIVIDADES_ENTREGAS: {
    staleTime: 1 * 60 * 1000,  // 1 minuto
    gcTime: 5 * 60 * 1000,     // 5 minutos
  },
  ATIVIDADES_PAGAMENTOS: {
    staleTime: 1 * 60 * 1000,  // 1 minuto
    gcTime: 5 * 60 * 1000,     // 5 minutos
  },
  ATIVIDADES_PRODUTOS: {
    staleTime: 2 * 60 * 1000,  // 2 minutos
    gcTime: 10 * 60 * 1000,    // 10 minutos
  },
  ATIVIDADES_VENDEDORES: {
    staleTime: 5 * 60 * 1000,  // 5 minutos
    gcTime: 15 * 60 * 1000,    // 15 minutos
  },
  // Devedores cache times
  DEVEDORES: {
    staleTime: 3 * 60 * 1000,  // 3 minutos
    gcTime: 10 * 60 * 1000,    // 10 minutos
  },
  VENDEDORES_FILTRO: {
    staleTime: 5 * 60 * 1000,  // 5 minutos
    gcTime: 15 * 60 * 1000,    // 15 minutos
  },
  VENDAS_MENSAIS_VENDEDORES: {
    staleTime: 3 * 60 * 1000,  // 3 minutos
    gcTime: 10 * 60 * 1000,    // 10 minutos
  },
  TOTAL_VENDAS_VENDEDOR: {
    staleTime: 3 * 60 * 1000,  // 3 minutos
    gcTime: 10 * 60 * 1000,    // 10 minutos
  },
  TOTAL_ENTREGAS_ADMINISTRADOR: {
    staleTime: 3 * 60 * 1000,  // 3 minutos
    gcTime: 10 * 60 * 1000,    // 10 minutos
  },
  SUPORTE_SOLICITACOES: {
    staleTime: 3 * 60 * 1000,  // 3 minutos
    gcTime: 10 * 60 * 1000,    // 10 minutos
  },
  SUPORTE_MENSAGENS: {
    staleTime: 2 * 60 * 1000,  // 2 minutos
    gcTime: 10 * 60 * 1000,    // 10 minutos
  },
  SISTEMA_STATUS: {
    staleTime: 5 * 60 * 1000,  // 5 minutos
    gcTime: 15 * 60 * 1000,    // 15 minutos
  },
} as const;

// Hook genérico para queries com cache otimizado
export const useSupabaseQuery = (
  tableName: keyof typeof CACHE_KEYS,
  queryBuilder: any,
  queryKey: any[],
  options?: {
    enabled?: boolean;
    staleTime?: number;
    gcTime?: number;
  }
) => {
  const cacheConfig = CACHE_TIMES[tableName];
  
  // Verificar se a configuração de cache existe
  if (!cacheConfig) {
    console.warn(`Cache configuration not found for table: ${tableName}`);
    return useQuery({
      queryKey,
      queryFn: async () => {
        const { data, error } = await queryBuilder;
        if (error) throw error;
        return data;
      },
      staleTime: options?.staleTime || 5 * 60 * 1000, // 5 minutos como fallback
      gcTime: options?.gcTime || 15 * 60 * 1000,      // 15 minutos como fallback
      enabled: options?.enabled !== false,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    });
  }
  
  return useQuery({
    queryKey,
    queryFn: async () => {
      const { data, error } = await queryBuilder;
      if (error) throw error;
      return data;
    },
    staleTime: options?.staleTime || cacheConfig.staleTime,
    gcTime: options?.gcTime || cacheConfig.gcTime,
    enabled: options?.enabled !== false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  });
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
  const cacheConfig = CACHE_TIMES[tableName];
  
  await queryClient.prefetchQuery({
    queryKey: [CACHE_KEYS[tableName]],
    queryFn,
    staleTime: cacheConfig.staleTime,
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
