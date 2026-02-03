import { useSupabaseQuery } from '@/lib/supabaseCache';
import { supabase } from '@/lib/supabase';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CACHE_KEYS } from '@/lib/constants/queryKeys';

export interface OrcamentoPJItem {
  id: string;
  orcamento_id: string;
  produto_cadastrado_id: string;
  descricao: string;
  quantidade: number;
  custo_unitario: number;
  margem_percentual: number;
  valor_venda_unitario: number;
  valor_total: number;
}

export interface OrcamentoPJ {
  id: string;
  administrador_id: string;
  numero_orcamento: number;
  cliente_id: string;
  cliente_nome: string;
  data_orcamento: string;
  data_saida?: string;
  hora_saida?: string;
  status: 'pendente' | 'aprovado' | 'rejeitado' | 'convertido';
  valor_total: number;
  margem_lucro_geral: number;
  itens?: OrcamentoPJItem[];
  created_at?: string;
  updated_at?: string;
}

export interface UseOrcamentosPJReturn {
  data: OrcamentoPJ[];
  isLoading: boolean;
  error: Error | null;
  count?: number | null;
  totalCount: number;
  totalPages: number;
  currentPage: number;
  refetch: () => void;
}

export const useOrcamentosPJ = (
  adminId: string,
  options?: {
    enabled?: boolean;
    status?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    pageSize?: number;
  }
): UseOrcamentosPJReturn => {
  const page = options?.page || 0;
  const pageSize = options?.pageSize || 20;
  const from = page * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from('orcamentos_pj')
    .select('*', { count: 'exact' })
    .eq('administrador_id', adminId)
    .order('created_at', { ascending: false })
    .range(from, to);

  if (options?.status && options.status !== 'todos') {
    query = query.eq('status', options.status);
  }

  if (options?.startDate) {
    query = query.gte('data_orcamento', options.startDate);
  }

  if (options?.endDate) {
    query = query.lte('data_orcamento', options.endDate);
  }

  const queryResult = useSupabaseQuery(
    'ORCAMENTOS_PJ',
    query,
    [CACHE_KEYS.ORCAMENTOS_PJ, 'list', { adminId, status: options?.status, startDate: options?.startDate, endDate: options?.endDate, page, pageSize }],
    { enabled: options?.enabled && !!adminId }
  );

  const totalCount = queryResult.count || 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  return {
    data: queryResult.data ?? [],
    isLoading: queryResult.isLoading,
    error: queryResult.error,
    totalCount,
    totalPages,
    currentPage: page,
    refetch: queryResult.refetch,
  };
};

export const useOrcamentoPJById = (id: string, options?: { enabled?: boolean }) => {
  const query = supabase
    .from('orcamentos_pj')
    .select('*, itens:orcamentos_pj_itens(*)')
    .eq('id', id)
    .single();

  return useSupabaseQuery<OrcamentoPJ>(
    'ORCAMENTOS_PJ',
    query,
    [CACHE_KEYS.ORCAMENTOS_PJ, 'detail', id],
    { enabled: options?.enabled !== false && !!id }
  );
};

export const useCreateOrcamentoPJ = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: Partial<OrcamentoPJ> & { itens?: Partial<OrcamentoPJItem>[] }) => {
      const { itens, ...orcamentoData } = data;
      
      // 1. Criar orçamento
      const { data: orcamento, error: orcamentoError } = await supabase
        .from('orcamentos_pj')
        .insert(orcamentoData)
        .select()
        .single();
        
      if (orcamentoError) throw orcamentoError;
      
      // 2. Criar itens se houver
      if (itens && itens.length > 0) {
        const itensComId = itens.map(item => ({
          ...item,
          orcamento_id: orcamento.id
        }));
        
        const { error: itensError } = await supabase
          .from('orcamentos_pj_itens')
          .insert(itensComId);
          
        if (itensError) throw itensError;
      }
      
      return orcamento;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.ORCAMENTOS_PJ] });
    }
  });
};

export const useUpdateOrcamentoPJ = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<OrcamentoPJ> }) => {
      const { data: result, error } = await supabase
        .from('orcamentos_pj')
        .update(data)
        .eq('id', id)
        .select()
        .single();
        
      if (error) throw error;
      return result;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.ORCAMENTOS_PJ] });
      queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.ORCAMENTOS_PJ, 'detail', variables.id] });
    }
  });
};
