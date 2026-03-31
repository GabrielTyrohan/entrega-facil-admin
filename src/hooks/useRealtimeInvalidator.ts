import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

const TABLE_QUERY_MAP: Record<string, string[]> = {
  entregas:                 ['dashboard_stats', 'dashboard_entregas_hoje', 'dashboard_grafico'],
  entregas_cestas_vendedor: ['dashboard_stats', 'dashboard_top_produtos', 'dashboard_grafico'],
  pagamentos:               ['dashboard_stats', 'dashboard_inadimplencia'],
  movimentacoes_estoque:    ['dashboard_estoque'],
  estoque_vendedor:         ['dashboard_estoque'],
  vendedores:               ['dashboard_stats'],
  cestas_base_itens:        ['dashboard_top_produtos'],
};

export const useRealtimeInvalidator = () => {
  const queryClient = useQueryClient();
  const { adminId } = useAuth();

  useEffect(() => {
    if (!adminId) {
      return;
    }

    const channel = supabase
      .channel(`dashboard-realtime-${adminId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'entregas' },
        () => {
          TABLE_QUERY_MAP['entregas'].forEach(key => {
            queryClient.invalidateQueries({ queryKey: [key] });
          });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'entregas_cestas_vendedor' },
        () => {
          TABLE_QUERY_MAP['entregas_cestas_vendedor'].forEach(key => {
            queryClient.invalidateQueries({ queryKey: [key] });
          });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'pagamentos' },
        () => {
          TABLE_QUERY_MAP['pagamentos'].forEach(key => {
            queryClient.invalidateQueries({ queryKey: [key] });
          });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'movimentacoes_estoque' },
        () => {
          TABLE_QUERY_MAP['movimentacoes_estoque'].forEach(key => {
            queryClient.invalidateQueries({ queryKey: [key] });
          });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'estoque_vendedor' },
        () => {
          TABLE_QUERY_MAP['estoque_vendedor'].forEach(key => {
            queryClient.invalidateQueries({ queryKey: [key] });
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [adminId, queryClient]);
};