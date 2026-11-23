import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { CACHE_KEYS } from '@/lib/constants/queryKeys';
import { PEDIDOS_QUERY_KEY, type StatusPedido } from '@/hooks/usePedidosVendedor';

/** Fase 9: consignado (modelo de sempre) ou revendedor (compra do dono e revende). */
export type ModeloVenda = 'consignado' | 'revendedor';

export const REVENDEDORES_QUERY_KEY = 'revendedores';

export interface ClientePJOpcao {
  id: string;
  razao_social: string | null;
  nome_fantasia: string | null;
  nome: string | null;
  cnpj: string | null;
  vendedor_id: string | null;
}

export interface PrecoCestaRevendedor {
  cesta_id: string;
  nome: string;
  preco_sugerido: number | null;
  preco_compra: number;
  preco_proprio: number | null;
  tem_composicao: boolean;
}

export interface PrecosCompraRevendedor {
  cestas: PrecoCestaRevendedor[];
  itens: { produto_cadastrado_id: string; preco_proprio: number }[];
}

export interface ResumoRevendedor {
  vendedor_id: string;
  nome: string;
  cliente_pj_id: string | null;
  compras_periodo: number;
  qtd_compras_periodo: number;
  saldo_devedor: number;
  vendas_clientes_periodo: number;
  qtd_entregas_periodo: number;
  recebido_clientes_periodo: number;
  estoque_cestas: number;
}

/** Cadastros PJ (com CNPJ) da empresa, para ligar ao revendedor. */
export function useClientesPJ(enabled = true) {
  const { adminId } = useAuth();
  return useQuery({
    queryKey: [REVENDEDORES_QUERY_KEY, 'clientes-pj', adminId],
    enabled: enabled && !!adminId,
    queryFn: async (): Promise<ClientePJOpcao[]> => {
      const { data, error } = await supabase
        .from('clientes')
        .select('id, razao_social, nome_fantasia, nome, cnpj, vendedor_id')
        .eq('administrador_id', adminId!)
        .eq('tipo_pessoa', 'PJ')
        .order('razao_social', { ascending: true })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as ClientePJOpcao[];
    },
  });
}

export function useDefinirModeloVendedor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { vendedorId: string; modelo: ModeloVenda; clientePjId?: string | null }) => {
      const { data, error } = await supabase.rpc('definir_modelo_vendedor', {
        p_vendedor_id: vars.vendedorId,
        p_modelo: vars.modelo,
        p_cliente_pj_id: vars.clientePjId ?? null,
      });
      if (error) throw error;
      return data as { vendedor_id: string; modelo_venda: ModeloVenda; cliente_pj_id: string | null };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [REVENDEDORES_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.VENDEDORES] });
    },
  });
}

/** Preço de compra (X) das cestas do revendedor, sugerido (Y) e preço próprio. */
export function usePrecosCompraRevendedor(vendedorId: string | null | undefined) {
  return useQuery({
    queryKey: [REVENDEDORES_QUERY_KEY, 'precos', vendedorId],
    enabled: !!vendedorId,
    queryFn: async (): Promise<PrecosCompraRevendedor> => {
      const { data, error } = await supabase.rpc('precos_compra_revendedor', { p_vendedor_id: vendedorId });
      if (error) throw error;
      const res = (data ?? { cestas: [], itens: [] }) as PrecosCompraRevendedor;
      return {
        cestas: (res.cestas ?? []).map((c) => ({
          ...c,
          preco_compra: Number(c.preco_compra) || 0,
          preco_sugerido: c.preco_sugerido == null ? null : Number(c.preco_sugerido),
          preco_proprio: c.preco_proprio == null ? null : Number(c.preco_proprio),
        })),
        itens: res.itens ?? [],
      };
    },
  });
}

/** Preço de venda (preco_unt) dos produtos avulsos, que é o preço de compra do revendedor. */
export function usePrecosProdutos(ids: string[]) {
  const chave = [...ids].sort().join(',');
  return useQuery({
    queryKey: [REVENDEDORES_QUERY_KEY, 'precos-produtos', chave],
    enabled: ids.length > 0,
    queryFn: async (): Promise<Record<string, number | null>> => {
      const { data, error } = await supabase
        .from('produtos_cadastrado')
        .select('id, preco_unt')
        .in('id', ids);
      if (error) throw error;
      return Object.fromEntries((data ?? []).map((p: { id: string; preco_unt: number | null }) => [
        p.id,
        p.preco_unt == null ? null : Number(p.preco_unt),
      ]));
    },
  });
}

export function useAtenderPedidoRevendedor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (vars: {
      pedidoId: string;
      itens: { item_id: string; quantidade: number }[];
      venda: { status_pagamento: 'pendente' | 'pago'; pago: boolean; valor_pago: number; forma_pagamento?: string | null; data_pagamento?: string | null };
      resposta?: string;
    }) => {
      const { data, error } = await supabase.rpc('atender_pedido_revendedor', {
        p_pedido_id: vars.pedidoId,
        p_itens: vars.itens,
        p_venda: vars.venda,
        p_resposta: vars.resposta ?? null,
      });
      if (error) throw error;
      return data as { id: string; status: StatusPedido; venda: { id: string; numero_pedido: number; valor_total: number } };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PEDIDOS_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: [REVENDEDORES_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.PRODUTOS] });
      queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.MOVIMENTACOES_ESTOQUE] });
      queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.VIEW_ESTOQUE_ATUAL] });
      queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.VENDAS_ATACADO || 'VENDAS_ATACADO'] });
    },
  });
}

/** Resumo por revendedor no período: compras do dono, saldo devedor e vendas dele aos clientes. */
export function useResumoRevendedores(inicio: string, fim: string) {
  const { adminId } = useAuth();
  return useQuery({
    queryKey: [REVENDEDORES_QUERY_KEY, 'resumo', adminId, inicio, fim],
    enabled: !!adminId && !!inicio && !!fim,
    queryFn: async (): Promise<ResumoRevendedor[]> => {
      const { data, error } = await supabase.rpc('resumo_revendedores', { p_inicio: inicio, p_fim: fim });
      if (error) throw error;
      return ((data ?? []) as ResumoRevendedor[]).map((r) => ({
        ...r,
        compras_periodo: Number(r.compras_periodo) || 0,
        qtd_compras_periodo: Number(r.qtd_compras_periodo) || 0,
        saldo_devedor: Number(r.saldo_devedor) || 0,
        vendas_clientes_periodo: Number(r.vendas_clientes_periodo) || 0,
        qtd_entregas_periodo: Number(r.qtd_entregas_periodo) || 0,
        recebido_clientes_periodo: Number(r.recebido_clientes_periodo) || 0,
        estoque_cestas: Number(r.estoque_cestas) || 0,
      }));
    },
  });
}

export const formatarBRL = (v: number | null | undefined) =>
  (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
