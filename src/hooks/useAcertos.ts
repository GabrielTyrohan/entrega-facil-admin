import { supabase } from '@/lib/supabase';
import { CACHE_KEYS } from '@/lib/supabaseCache';
import { handleSupabaseError } from '@/utils/supabaseErrorHandler';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';


export interface Acerto {
  id: string;
  administrador_id: string;
  vendedor_id: string;
  vendedor_nome?: string;
  data_acerto: string;
  valor_pix: number;
  valor_deposito: number;
  valor_debito: number;
  valor_credito: number;
  valor_cheque: number;
  valor_dinheiro: number;
  valor_cartao: number;
  valor_gasolina: number;
  valor_borracharia: number;
  valor_pedagio: number;
  valor_mecanico: number;
  valor_outras_despesas: number;
  valor_total_vendas: number;
  valor_total_recebido?: number;
  valor_total_despesas?: number;
  saldo_liquido?: number;
  // Campos da view consolidada
  adicional_recebido?: number;
  adicional_despesas?: number;
  total_recebido_real?: number;
  total_despesas_real?: number;
  saldo_real?: number;
  vendas?: string;
  status: 'pendente' | 'conferido' | 'aprovado' | 'divergente';
  observacoes?: string;
  conferido_por?: string;
  created_at?: string;
  updated_at?: string;
}


export interface LancamentoAdicional {
  id: string;
  acerto_id: string;
  tipo: 'recebimento' | 'despesa';
  forma: string;
  valor: number;
  observacao?: string;
  criado_por_id: string;
  criado_por_nome: string;
  criado_por_tipo: 'admin' | 'funcionario';
  created_at: string;
}


export interface UseAcertosOptions {
  enabled?: boolean;
  startDate?: string;
  endDate?: string;
  vendedor_id?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}


// ============================================
// LISTAGEM — usa a view consolidada
// ============================================

export const useAcertos = (adminId: string | undefined, options?: UseAcertosOptions) => {
  const page = options?.page || 0;
  const pageSize = options?.pageSize || 20;
  const from = page * pageSize;
  const to = from + pageSize - 1;

  const queryResult = useQuery({
    queryKey: [CACHE_KEYS.ACERTOS_DIARIOS, { ...options, adminId }],
    enabled: options?.enabled !== false && !!adminId,
    staleTime: 2 * 60 * 1000,
    queryFn: async () => {
      let query = supabase
        .from('acertos_diarios_consolidado')
        .select('*', { count: 'exact' })
        .eq('administrador_id', adminId!)
        .order('data_acerto', { ascending: false })
        .range(from, to);

      if (options?.startDate) query = query.gte('data_acerto', options.startDate);
      if (options?.endDate)   query = query.lte('data_acerto', options.endDate);
      if (options?.vendedor_id && options.vendedor_id !== 'todos')
        query = query.eq('vendedor_id', options.vendedor_id);
      if (options?.status && options.status !== 'todos')
        query = query.eq('status', options.status);

      const { data, error, count } = await query;
      if (error) throw error;
      return { data, count };
    }
  });

  const rawData = Array.isArray(queryResult.data?.data) ? queryResult.data.data : [];
  const totalCount = queryResult.data?.count || 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  return {
    data: rawData as Acerto[],
    isLoading: queryResult.isLoading,
    error: queryResult.error,
    totalCount,
    totalPages,
    currentPage: page,
    refetch: queryResult.refetch,
  };
};


// ============================================
// DETALHE — usa a view consolidada (single)
// ============================================

export const useAcerto = (id: string, options?: { enabled?: boolean }) => {
  return useQuery({
    queryKey: [CACHE_KEYS.ACERTOS_DIARIOS, 'detalhe', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('acertos_diarios_consolidado')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw new Error(handleSupabaseError(error));
      return data as Acerto;
    },
    enabled: (options?.enabled ?? true) && !!id,
    staleTime: 1 * 60 * 1000,
  });
};


// ============================================
// VERIFICAR ACERTO EXISTENTE NA DATA
// ============================================

export const useAcertoPorData = (vendedorId: string, dataAcerto: string) => {
  return useQuery({
    queryKey: [CACHE_KEYS.ACERTOS_DIARIOS, 'check', vendedorId, dataAcerto],
    enabled: !!vendedorId && !!dataAcerto,
    staleTime: 30 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('acertos_diarios')
        .select('id')
        .eq('vendedor_id', vendedorId)
        .eq('data_acerto', dataAcerto)
        .maybeSingle();

      if (error) throw error;
      return data;
    }
  });
};


// ============================================
// CRIAR ACERTO
// ============================================

export const useCreateAcerto = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Partial<Acerto>) => {
      const { data: acerto, error } = await supabase
        .from('acertos_diarios')
        .insert(data)
        .select()
        .single();

      if (error) throw new Error(handleSupabaseError(error));
      return acerto;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.ACERTOS_DIARIOS] });
    }
  });
};


// ============================================
// ATUALIZAR STATUS MANUALMENTE
// ============================================

export const useUpdateAcertoStatus = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, status, conferido_por, observacoes }: {
      id: string;
      status: string;
      conferido_por: string;
      observacoes?: string;
    }) => {
      const updateData: any = {
        status,
        conferido_por,
        updated_at: new Date().toISOString()
      };
      if (status === 'conferido' || status === 'aprovado') {
        updateData.data_conferencia = new Date().toISOString();
      }
      if (observacoes !== undefined) updateData.observacoes = observacoes;

      const { data, error } = await supabase
        .from('acertos_diarios')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw new Error(handleSupabaseError(error));
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.ACERTOS_DIARIOS] });
    }
  });
};


// ============================================
// ATUALIZAR STATUS AUTOMÁTICO PELO SALDO
// ============================================

export const useAtualizarStatusPorSaldo = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ acertoId, saldoReal, conferido_por }: {
      acertoId: string;
      saldoReal: number;
      conferido_por: string;
    }) => {
      // Regra simplificada — divergente só é definido manualmente pelo admin:
      // saldo = 0   → aprovado  (fechou certinho — automático)
      // saldo ≠ 0   → pendente  (ainda falta ou sobrou — aguardando)
      const novoStatus = saldoReal === 0 ? 'aprovado' : 'pendente';

      const { data, error } = await supabase
        .from('acertos_diarios')
        .update({
          status: novoStatus,
          conferido_por,
          // data_conferencia só registra quando aprovado
          data_conferencia: novoStatus === 'aprovado' ? new Date().toISOString() : null,
          updated_at: new Date().toISOString()
        })
        .eq('id', acertoId)
        .neq('status', 'aprovado') // nunca rebaixa acerto já aprovado
        .neq('status', 'divergente') // nunca sobrescreve divergente automático — admin decidiu
        .select()
        .single();

      if (error) throw new Error(handleSupabaseError(error));
      return { data, novoStatus };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.ACERTOS_DIARIOS] });
    }
  });
};


// ============================================
// LANÇAMENTOS ADICIONAIS
// ============================================

export const useLancamentosDoAcerto = (acertoId: string, options?: { enabled?: boolean }) => {
  return useQuery({
    queryKey: [CACHE_KEYS.ACERTOS_DIARIOS, 'lancamentos', acertoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('acertos_lancamentos_adicionais')
        .select('*')
        .eq('acerto_id', acertoId)
        .order('created_at', { ascending: true });

      if (error) throw new Error(handleSupabaseError(error));
      return (data || []) as LancamentoAdicional[];
    },
    enabled: (options?.enabled ?? true) && !!acertoId,
    staleTime: 1 * 60 * 1000,
  });
};


export const useCreateLancamentoAdicional = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (lancamento: Omit<LancamentoAdicional, 'id' | 'created_at'>) => {
      const { data, error } = await supabase
        .from('acertos_lancamentos_adicionais')
        .insert(lancamento)
        .select()
        .single();

      if (error) throw new Error(handleSupabaseError(error));
      return data as LancamentoAdicional;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: [CACHE_KEYS.ACERTOS_DIARIOS, 'lancamentos', data.acerto_id]
      });
      queryClient.invalidateQueries({
        queryKey: [CACHE_KEYS.ACERTOS_DIARIOS, 'detalhe', data.acerto_id]
      });
      queryClient.invalidateQueries({
        queryKey: [CACHE_KEYS.ACERTOS_DIARIOS]
      });
    }
  });
};


export const useDeleteLancamentoAdicional = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, acerto_id }: { id: string; acerto_id: string }) => {
      const { error } = await supabase
        .from('acertos_lancamentos_adicionais')
        .delete()
        .eq('id', id);

      if (error) throw new Error(handleSupabaseError(error));
      return { id, acerto_id };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: [CACHE_KEYS.ACERTOS_DIARIOS, 'lancamentos', data.acerto_id]
      });
      queryClient.invalidateQueries({
        queryKey: [CACHE_KEYS.ACERTOS_DIARIOS, 'detalhe', data.acerto_id]
      });
      queryClient.invalidateQueries({
        queryKey: [CACHE_KEYS.ACERTOS_DIARIOS]
      });
    }
  });
};
