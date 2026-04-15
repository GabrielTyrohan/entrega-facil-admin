import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

const TABLE_QUERY_MAP: Record<string, string[]> = {
  entregas: [
    'dashboard_core',
    'dashboard_entregas_hoje',
    'dashboard_faturamento_mensal',
    'dashboard_top_vendedores',
    'dashboard_top_produtos',
    'dashboard_inadimplencia',
  ],
  entregas_cestas_vendedor: [
    'dashboard_core',
    'dashboard_top_produtos',
    'dashboard_faturamento_mensal',
  ],
  pagamentos: [
    'dashboard_core',
    'dashboard_inadimplencia',
    'dashboard_faturamento_mensal',
  ],
  movimentacoes_estoque:    ['dashboard_estoque_alerts'],
  estoque_vendedor:         ['dashboard_estoque_alerts'],
  vendedores:               ['dashboard_core', 'dashboard_top_vendedores'],
  cestas_base_itens:        ['dashboard_top_produtos'],
  clientes:                 ['dashboard_core'],
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
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'clientes' },
        () => {
          TABLE_QUERY_MAP['clientes'].forEach(key => {
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