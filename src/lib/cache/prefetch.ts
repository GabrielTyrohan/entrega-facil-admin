import { queryClient } from './cacheConfig';
import { CACHE_KEYS } from './cacheConfig';
import { supabase } from '../supabase';

// Prefetch dados críticos ao fazer login
export const prefetchDashboardData = async (vendedorId: string) => {
  // Carrega dados em paralelo
  await Promise.all([
    // Prefetch produtos
    queryClient.prefetchQuery({
      queryKey: [CACHE_KEYS.PRODUTOS, vendedorId],
      queryFn: async () => {
        const { data } = await supabase
          .from('produtos')
          .select('*')
          .eq('vendedor_id', vendedorId)
          .eq('ativo', true);
        return data;
      },
    }),

    // Prefetch clientes
    queryClient.prefetchQuery({
      queryKey: [CACHE_KEYS.CLIENTES, vendedorId],
      queryFn: async () => {
        const { data } = await supabase
          .from('clientes')
          .select('*')
          .eq('vendedor_id', vendedorId)
          .eq('ativo', true);
        return data;
      },
    }),

    // Prefetch entregas recentes
    queryClient.prefetchQuery({
      queryKey: [CACHE_KEYS.ENTREGAS, vendedorId],
      queryFn: async () => {
        const { data } = await supabase
          .from('entregas')
          .select('*, clientes(nome), produtos(nome)')
          .eq('vendedor_id', vendedorId)
          .order('data_entrega', { ascending: false })
          .limit(50);
        return data;
      },
    }),
  ]);
};

/**
 * Configura sincronização em tempo real para tabelas críticas.
 * Escuta eventos INSERT, UPDATE e DELETE e invalida o cache correspondente.
 * 
 * @param vendedorId - ID do vendedor atual para filtrar eventos (se aplicável por RLS)
 * @returns Função de cleanup para remover as subscriptions
 */
export const setupRealtimeSync = (vendedorId: string) => {
  if (!vendedorId) return () => {};

  // Mapeamento de tabelas para chaves de cache
  const tablesToSync = [
    { table: 'entregas', cacheKey: CACHE_KEYS.ENTREGAS },
    { table: 'produtos', cacheKey: CACHE_KEYS.PRODUTOS },
    { table: 'clientes', cacheKey: CACHE_KEYS.CLIENTES },
    { table: 'pagamentos', cacheKey: CACHE_KEYS.PAGAMENTOS },
  ];

  const channels: ReturnType<typeof supabase.channel>[] = [];

  // Criar um canal para cada tabela crítica
  tablesToSync.forEach(({ table, cacheKey }) => {
    const channel = supabase
      .channel(`realtime_${table}_${vendedorId}`)
      .on(
        'postgres_changes',
        {
          event: '*', // Escuta INSERT, UPDATE e DELETE
          schema: 'public',
          table: table,
          filter: `vendedor_id=eq.${vendedorId}`, // Filtra apenas dados do vendedor atual
        },
        (payload) => {
          console.log(`[Realtime] Alteração detectada em ${table}:`, payload.eventType);
          
          // Invalidar cache específico da tabela para forçar recarregamento
          queryClient.invalidateQueries({
            queryKey: [cacheKey], // Invalida todas as queries que começam com essa chave
          });

          // Se for entrega ou pagamento, invalida também as estatísticas do dashboard
          if (table === 'entregas' || table === 'pagamentos') {
             queryClient.invalidateQueries({
              queryKey: [CACHE_KEYS.STATS],
            });
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log(`[Realtime] Sincronização ativa para: ${table}`);
        }
      });

    channels.push(channel);
  });

  // Retornar função de limpeza
  return () => {
    console.log('[Realtime] Removendo inscrições...');
    channels.forEach((channel) => supabase.removeChannel(channel));
  };
};
