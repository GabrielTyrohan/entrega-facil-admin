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
      console.warn('⚠️ [Realtime] adminId não disponível, canal não iniciado.');
      return;
    }

    console.log('🔌 [Realtime] Iniciando canal para adminId:', adminId);

    const channel = supabase
      .channel(`dashboard-realtime-${adminId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'entregas' },
        (payload) => {
          console.log('📦 [Realtime] Mudança em entregas:', payload);
          TABLE_QUERY_MAP['entregas'].forEach(key => {
            console.log(`🔄 [Realtime] Invalidando queryKey: [${key}]`);
            queryClient.invalidateQueries({ queryKey: [key] });
          });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'entregas_cestas_vendedor' },
        (payload) => {
          console.log('📦 [Realtime] Mudança em entregas_cestas_vendedor:', payload);
          TABLE_QUERY_MAP['entregas_cestas_vendedor'].forEach(key => {
            console.log(`🔄 [Realtime] Invalidando queryKey: [${key}]`);
            queryClient.invalidateQueries({ queryKey: [key] });
          });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'pagamentos' },
        (payload) => {
          console.log('📦 [Realtime] Mudança em pagamentos:', payload);
          TABLE_QUERY_MAP['pagamentos'].forEach(key => {
            console.log(`🔄 [Realtime] Invalidando queryKey: [${key}]`);
            queryClient.invalidateQueries({ queryKey: [key] });
          });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'movimentacoes_estoque' },
        (payload) => {
          console.log('📦 [Realtime] Mudança em movimentacoes_estoque:', payload);
          TABLE_QUERY_MAP['movimentacoes_estoque'].forEach(key => {
            console.log(`🔄 [Realtime] Invalidando queryKey: [${key}]`);
            queryClient.invalidateQueries({ queryKey: [key] });
          });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'estoque_vendedor' },
        (payload) => {
          console.log('📦 [Realtime] Mudança em estoque_vendedor:', payload);
          TABLE_QUERY_MAP['estoque_vendedor'].forEach(key => {
            console.log(`🔄 [Realtime] Invalidando queryKey: [${key}]`);
            queryClient.invalidateQueries({ queryKey: [key] });
          });
        }
      )
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          console.log('✅ [Realtime] Canal conectado com sucesso!');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ [Realtime] Erro no canal:', err);
        } else if (status === 'TIMED_OUT') {
          console.error('⏱️ [Realtime] Canal expirou (timeout)');
        } else if (status === 'CLOSED') {
          console.warn('🔒 [Realtime] Canal fechado');
        } else {
          console.log('ℹ️ [Realtime] Status:', status);
        }
      });

    return () => {
      console.log('🗑️ [Realtime] Removendo canal dashboard-realtime-' + adminId);
      supabase.removeChannel(channel);
    };
  }, [adminId, queryClient]);
};