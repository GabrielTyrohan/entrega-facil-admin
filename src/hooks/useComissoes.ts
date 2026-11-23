import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

export interface ComissaoCalculo {
  vendedor_id: string;
  periodo_inicio: string;
  periodo_fim: string;
  total_recebido: number;
  qtd_pagamentos: number;
  ajustes: number;
  qtd_ajustes: number;
  base_calculo: number;
  percentual: number;
  valor_comissao: number;
  encerrado: boolean;
  fechamento_id: string | null;
  status: 'aberto' | 'fechado' | 'pago';
}

export interface ComissaoVendedor {
  vendedor: { id: string; nome: string; comissao_percentual: number; dia_fechamento: number | null };
  atual: ComissaoCalculo;
  anterior: ComissaoCalculo;
}

export interface FechamentoVendedor {
  id: string;
  vendedor_id: string;
  periodo_inicio: string;
  periodo_fim: string;
  base_calculo: number;
  ajustes: number;
  percentual: number;
  valor_comissao: number;
  status: 'fechado' | 'pago';
  fechado_por_nome: string | null;
  fechado_em: string;
  pago_por_nome: string | null;
  pago_em: string | null;
  vendedor?: { nome: string } | null;
}

export const COMISSOES_KEY = 'comissoes_vendedor';

const numero = (c: ComissaoCalculo): ComissaoCalculo => ({
  ...c,
  total_recebido: Number(c.total_recebido),
  ajustes: Number(c.ajustes),
  base_calculo: Number(c.base_calculo),
  percentual: Number(c.percentual),
  valor_comissao: Number(c.valor_comissao),
});

/** Dia anterior a uma data YYYY-MM-DD (para consultar o período anterior). */
export function diaAnterior(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d - 1);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

/** Prévia do período atual e situação do período anterior de cada vendedor ativo. */
export function useComissoesVendedores() {
  const { adminId } = useAuth();
  return useQuery({
    queryKey: [COMISSOES_KEY, 'resumo', adminId],
    enabled: !!adminId,
    queryFn: async (): Promise<ComissaoVendedor[]> => {
      const { data: vendedores, error } = await supabase
        .from('vendedores')
        .select('id, nome, comissao_percentual, dia_fechamento')
        .eq('administrador_id', adminId!)
        .eq('ativo', true)
        // Fase 9: revendedor não tem comissão (fica com o dinheiro das vendas)
        .neq('modelo_venda', 'revendedor')
        .order('nome');
      if (error) throw error;

      return Promise.all(
        (vendedores ?? []).map(async (v) => {
          const { data: atual, error: e1 } = await supabase.rpc('calcular_comissao_vendedor', {
            p_vendedor_id: v.id,
            p_data_referencia: null,
          });
          if (e1) throw e1;
          const atualCalc = numero(atual as ComissaoCalculo);

          const { data: anterior, error: e2 } = await supabase.rpc('calcular_comissao_vendedor', {
            p_vendedor_id: v.id,
            p_data_referencia: diaAnterior(atualCalc.periodo_inicio),
          });
          if (e2) throw e2;

          return {
            vendedor: { ...v, comissao_percentual: Number(v.comissao_percentual ?? 0) },
            atual: atualCalc,
            anterior: numero(anterior as ComissaoCalculo),
          };
        })
      );
    },
  });
}

/** Histórico de fechamentos da empresa. */
export function useFechamentos() {
  const { adminId } = useAuth();
  return useQuery({
    queryKey: [COMISSOES_KEY, 'fechamentos', adminId],
    enabled: !!adminId,
    queryFn: async (): Promise<FechamentoVendedor[]> => {
      const { data, error } = await supabase
        .from('fechamentos_vendedor')
        .select(
          'id, vendedor_id, periodo_inicio, periodo_fim, base_calculo, ajustes, percentual, valor_comissao, status, ' +
          'fechado_por_nome, fechado_em, pago_por_nome, pago_em, vendedor:vendedores(nome)'
        )
        .eq('administrador_id', adminId!)
        .order('periodo_inicio', { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as unknown as FechamentoVendedor[];
    },
  });
}

export function useFecharPeriodo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { vendedorId: string; periodoInicio: string }) => {
      const { data, error } = await supabase.rpc('fechar_periodo_vendedor', {
        p_vendedor_id: vars.vendedorId,
        p_periodo_inicio: vars.periodoInicio,
        p_observacao: null,
      });
      if (error) throw error;
      return data as ComissaoCalculo;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [COMISSOES_KEY] }),
  });
}

export function useMarcarComissaoPaga() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (fechamentoId: string) => {
      const { error } = await supabase.rpc('marcar_comissao_paga', {
        p_fechamento_id: fechamentoId,
        p_observacao: null,
      });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [COMISSOES_KEY] }),
  });
}
