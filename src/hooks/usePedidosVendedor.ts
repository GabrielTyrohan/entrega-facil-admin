import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/utils/toast';
import { CACHE_KEYS } from '@/lib/constants/queryKeys';

export type StatusPedido = 'pendente' | 'aprovado' | 'parcial' | 'recusado' | 'cancelado';

export interface PedidoVendedorItem {
  id: string;
  tipo: 'cesta' | 'avulso';
  descricao: string;
  quantidade_solicitada: number;
  quantidade_atendida: number;
  cesta_id: string | null;
  produto_cadastrado_id: string | null;
}

export interface PedidoVendedor {
  id: string;
  numero: number;
  vendedor_id: string;
  status: StatusPedido;
  observacao: string | null;
  resposta: string | null;
  atendido_por_nome: string | null;
  atendido_em: string | null;
  /** Revendedor: a venda PJ criada ao atender o pedido. */
  venda_atacado_id?: string | null;
  created_at: string;
  vendedor?: { nome: string; modelo_venda?: string | null; cliente_pj_id?: string | null } | null;
  itens: PedidoVendedorItem[];
}

export const PEDIDOS_QUERY_KEY = 'pedidos_vendedor';

/** Pedidos dos vendedores da empresa (somente leitura; escrita é por RPC). */
export function usePedidosVendedor(status: StatusPedido | 'todos' = 'pendente') {
  const { adminId } = useAuth();

  return useQuery({
    queryKey: [PEDIDOS_QUERY_KEY, adminId, status],
    enabled: !!adminId,
    queryFn: async (): Promise<PedidoVendedor[]> => {
      let query = supabase
        .from('pedidos_vendedor')
        .select(
          'id, numero, vendedor_id, status, observacao, resposta, atendido_por_nome, atendido_em, venda_atacado_id, created_at, ' +
          'vendedor:vendedores(nome, modelo_venda, cliente_pj_id), ' +
          'itens:pedidos_vendedor_itens(id, tipo, descricao, quantidade_solicitada, quantidade_atendida, cesta_id, produto_cadastrado_id)'
        )
        .eq('administrador_id', adminId!)
        .order('created_at', { ascending: status === 'pendente' })
        .limit(100);

      if (status !== 'todos') query = query.eq('status', status);

      const { data, error } = await query;
      if (error) throw error;
      return ((data ?? []) as unknown as PedidoVendedor[]).map((p) => ({
        ...p,
        itens: (p.itens ?? []).map((i) => ({
          ...i,
          quantidade_solicitada: Number(i.quantidade_solicitada),
          quantidade_atendida: Number(i.quantidade_atendida),
        })),
      }));
    },
  });
}

/** Quantidade de pedidos aguardando (badge do menu). */
export function usePedidosPendentesCount(enabled = true) {
  const { adminId } = useAuth();
  return useQuery({
    queryKey: [PEDIDOS_QUERY_KEY, adminId, 'contagem'],
    enabled: enabled && !!adminId,
    staleTime: 30_000,
    queryFn: async () => {
      const { count, error } = await supabase
        .from('pedidos_vendedor')
        .select('id', { count: 'exact', head: true })
        .eq('administrador_id', adminId!)
        .eq('status', 'pendente');
      if (error) throw error;
      return count ?? 0;
    },
  });
}

/** Avisa e atualiza as listas quando um vendedor envia pedido novo. */
export function usePedidosRealtime(enabled = true) {
  const { adminId } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled || !adminId) return;
    const channel = supabase
      .channel(`pedidos-vendedor-${adminId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'pedidos_vendedor', filter: `administrador_id=eq.${adminId}` },
        (payload) => {
          queryClient.invalidateQueries({ queryKey: [PEDIDOS_QUERY_KEY] });
          if (payload.eventType === 'INSERT') {
            const numero = (payload.new as { numero?: number })?.numero;
            toast.info(`Novo pedido de vendedor${numero ? ` #${numero}` : ''}`);
          }
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [enabled, adminId, queryClient]);
}

function invalidarDepoisDeAtender(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: [PEDIDOS_QUERY_KEY] });
  // Atender move estoque e cria entregas de cestas/avulsos
  queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.PRODUTOS] });
  queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.MOVIMENTACOES_ESTOQUE] });
  queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.VIEW_ESTOQUE_ATUAL] });
}

export function useAtenderPedido() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { pedidoId: string; itens: { item_id: string; quantidade: number }[]; resposta?: string }) => {
      const { data, error } = await supabase.rpc('atender_pedido_vendedor', {
        p_pedido_id: vars.pedidoId,
        p_itens: vars.itens,
        p_resposta: vars.resposta ?? null,
      });
      if (error) throw error;
      return data as { id: string; status: StatusPedido };
    },
    onSuccess: () => invalidarDepoisDeAtender(queryClient),
  });
}

export function useRecusarPedido() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { pedidoId: string; motivo: string }) => {
      const { data, error } = await supabase.rpc('recusar_pedido_vendedor', {
        p_pedido_id: vars.pedidoId,
        p_motivo: vars.motivo,
      });
      if (error) throw error;
      return data as { id: string; status: StatusPedido };
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [PEDIDOS_QUERY_KEY] }),
  });
}
