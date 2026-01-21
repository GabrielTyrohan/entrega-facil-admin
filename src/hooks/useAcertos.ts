import { supabase } from '@/lib/supabase';
import { CACHE_KEYS, useSupabaseQuery } from '@/lib/supabaseCache';
import { handleSupabaseError } from '@/utils/supabaseErrorHandler';
import { useMutation, useQueryClient } from '@tanstack/react-query';

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
  valor_gasolina: number;
  valor_cartao: number;
  valor_borracharia: number;
  valor_pedagio: number;
  valor_mecanico: number;
  valor_outras_despesas: number;
  valor_total_vendas: number;
  vendas?: string;
  status: 'pendente' | 'conferido' | 'aprovado' | 'divergente';
  observacoes?: string;
  conferido_por?: string;
  created_at?: string;
  updated_at?: string;
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

export const useAcertos = (adminId: string | undefined, options?: UseAcertosOptions) => {
  const page = options?.page || 0;
  const pageSize = options?.pageSize || 20;
  const from = page * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from('acertos_diarios')
    .select('*, vendedores(nome)', { count: 'exact' })
    .eq('administrador_id', adminId || '')
    .order('data_acerto', { ascending: false })
    .range(from, to);

  if (options?.startDate) query = query.gte('data_acerto', options.startDate);
  if (options?.endDate) query = query.lte('data_acerto', options.endDate);
  if (options?.vendedor_id && options.vendedor_id !== 'todos') query = query.eq('vendedor_id', options.vendedor_id);
  if (options?.status && options.status !== 'todos') query = query.eq('status', options.status);

  const queryResult = useSupabaseQuery<Acerto>(
    'ACERTOS_DIARIOS',
    query,
    [CACHE_KEYS.ACERTOS_DIARIOS, { ...options, adminId }],
    { enabled: options?.enabled !== false && !!adminId }
  );
  
  const rawData = Array.isArray(queryResult.data) ? queryResult.data : [];
  
  const data = rawData.map((item: any) => ({
      ...item,
      vendedor_nome: item.vendedores?.nome
  }));

  const totalCount = queryResult.count || 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  return {
    data,
    isLoading: queryResult.isLoading,
    error: queryResult.error,
    totalCount,
    totalPages,
    currentPage: page,
    refetch: queryResult.refetch,
  };
};

export const useAcertoPorData = (vendedorId: string, dataAcerto: string) => {
  const query = supabase
    .from('acertos_diarios')
    .select('id')
    .eq('vendedor_id', vendedorId)
    .eq('data_acerto', dataAcerto)
    .maybeSingle();

  return useSupabaseQuery<{id: string}>(
    'ACERTOS_DIARIOS',
    query,
    [CACHE_KEYS.ACERTOS_DIARIOS, 'check', vendedorId, dataAcerto],
    { enabled: !!vendedorId && !!dataAcerto }
  );
};

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

export const useUpdateAcertoStatus = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, status, conferido_por, observacoes }: { id: string, status: string, conferido_por: string, observacoes?: string }) => {
      const updateData: any = { status, conferido_por, updated_at: new Date().toISOString() };
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
