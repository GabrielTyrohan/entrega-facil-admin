import { toast } from '@/utils/toast';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CACHE_KEYS } from '../lib/constants/queryKeys';
import { supabase } from '../lib/supabase';
import { useSupabaseQuery } from '../lib/supabaseCache';

export interface Lancamento {
  id: string;
  administrador_id: string;
  lancado_por?: string;
  tipo: 'entrada' | 'saida';
  categoria: string;
  descricao: string;
  valor: number;
  data_lancamento: string;
  data_vencimento?: string | null;
  forma_pagamento: string;
  status: 'pendente' | 'pago' | 'cancelado';
  anexo_url?: string | null;
  referencia_id?: string | null;
  referencia_tipo?: string | null;
  created_at?: string;
}

export interface UseFluxoCaixaOptions {
  startDate?: string;
  endDate?: string;
  tipo?: string;
  status?: string;
  page?: number;
  pageSize?: number;
  enabled?: boolean;
}

export const useFluxoCaixa = (adminId: string, options?: UseFluxoCaixaOptions) => {
  const page = options?.page || 0;
  const pageSize = options?.pageSize || 20;
  const from = page * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from('lancamentos_caixa')
    .select('*', { count: 'exact' })
    .eq('administrador_id', adminId)
    .order('data_lancamento', { ascending: false })
    .order('created_at', { ascending: false })
    .range(from, to);

  if (options?.startDate) query = query.gte('data_lancamento', options.startDate);
  if (options?.endDate) query = query.lte('data_lancamento', options.endDate);
  if (options?.tipo && options.tipo !== 'todos') query = query.eq('tipo', options.tipo);
  if (options?.status && options.status !== 'todos') query = query.eq('status', options.status);

  const queryResult = useSupabaseQuery<Lancamento>(
    'FLUXO_CAIXA',
    query,
    [CACHE_KEYS.FLUXO_CAIXA, { ...options, adminId }],
    { enabled: options?.enabled !== false && !!adminId }
  );

  const totalCount = queryResult.count || 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  return {
    data: Array.isArray(queryResult.data) ? queryResult.data : [],
    isLoading: queryResult.isLoading,
    error: queryResult.error,
    totalCount,
    totalPages,
    currentPage: page,
    refetch: queryResult.refetch,
  };
};

export const useFluxoCaixaStats = (adminId: string, startDate?: string, endDate?: string) => {
  let query = supabase
    .from('lancamentos_caixa')
    .select('tipo, valor, status, data_lancamento')
    .eq('administrador_id', adminId);

  if (startDate) query = query.gte('data_lancamento', startDate);
  if (endDate) query = query.lte('data_lancamento', endDate);

  const queryResult = useSupabaseQuery<Pick<Lancamento, 'tipo' | 'valor' | 'status' | 'data_lancamento'>>(
    'FLUXO_CAIXA_STATS',
    query,
    [CACHE_KEYS.FLUXO_CAIXA, 'STATS', { adminId, startDate, endDate }],
    { enabled: !!adminId }
  );

  const stats = {
    totalEntradas: 0,
    totalSaidas: 0,
    saldo: 0,
    contasAPagar: 0,
    graphData: [] as any[]
  };

  const data = Array.isArray(queryResult.data) ? queryResult.data : [];

  if (data.length > 0) {
    const dailyData: Record<string, { entradas: number; saidas: number }> = {};

    (data as Array<{ data_lancamento: string; tipo: string; valor: number; status: string }>).forEach((item) => {
      const valor = Number(item.valor);
      
      if (item.status !== 'cancelado') {
        if (item.tipo === 'entrada') {
          stats.totalEntradas += valor;
        } else {
          stats.totalSaidas += valor;
          if (item.status === 'pendente') {
            stats.contasAPagar += valor;
          }
        }

        // Graph Data Processing
        const date = item.data_lancamento;
        if (!dailyData[date]) {
          dailyData[date] = { entradas: 0, saidas: 0 };
        }
        if (item.tipo === 'entrada') {
          dailyData[date].entradas += valor;
        } else {
          dailyData[date].saidas += valor;
        }
      }
    });

    stats.saldo = stats.totalEntradas - stats.totalSaidas;
    
    // Sort dates and format for graph
    stats.graphData = Object.keys(dailyData)
      .sort()
      .map(date => ({
        date: date.split('-').reverse().slice(0, 2).join('/'), // DD/MM
        entradas: dailyData[date].entradas,
        saidas: dailyData[date].saidas
      }));
  }

  return {
    data: stats,
    isLoading: queryResult.isLoading
  };
};

export const useCreateLancamento = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (lancamento: Omit<Lancamento, 'id' | 'created_at'>) => {
      const { data, error } = await supabase
        .from('lancamentos_caixa')
        .insert(lancamento)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.FLUXO_CAIXA] });
      toast.success('Lançamento registrado com sucesso!');
    },
    onError: (error: any) => {
      console.error('Erro ao criar lançamento:', error);
      toast.error('Erro ao registrar lançamento');
    }
  });
};

export const useUpdateLancamento = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Lancamento> & { id: string }) => {
      const { data, error } = await supabase
        .from('lancamentos_caixa')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.FLUXO_CAIXA] });
      toast.success('Lançamento atualizado!');
    },
    onError: (error: any) => {
      console.error('Erro ao atualizar lançamento:', error);
      toast.error('Erro ao atualizar lançamento');
    }
  });
};

export const useDeleteLancamento = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('lancamentos_caixa')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.FLUXO_CAIXA] });
      toast.success('Lançamento removido!');
    },
    onError: (error: any) => {
      console.error('Erro ao remover lançamento:', error);
      toast.error('Erro ao remover lançamento');
    }
  });
};

export const useUploadComprovante = () => {
  return useMutation({
    mutationFn: async ({ file, path }: { file: File, path: string }) => {
      const { data, error } = await supabase.storage
        .from('comprovantes')
        .upload(path, file, {
          cacheControl: '3600',
          upsert: true
        });

      if (error) throw error;
      
      const { data: publicUrl } = supabase.storage
        .from('comprovantes')
        .getPublicUrl(data.path);
        
      return publicUrl.publicUrl;
    }
  });
};
