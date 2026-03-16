import { CACHE_KEYS } from '@/lib/constants/queryKeys';
import { supabase } from '@/lib/supabase';
import { useSupabaseQuery } from '@/lib/supabaseCache';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';


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
  produto?: {
    ncm: string;
    produto_cod: string;
  };
}


export interface OrcamentoPJ {
  id: string;
  administrador_id: string;
  numero_orcamento: number;
  cliente_id: string;
  cliente_nome: string;
  data_orcamento: string;
  dataSaida?: string;
  horaSaida?: string;
  status: 'pendente' | 'aprovado' | 'rejeitado' | 'convertido';
  valor_total: number;
  margem_lucro_geral: number;
  forma_pagamento?: string;
  itens?: OrcamentoPJItem[];
  created_at?: string;
  updated_at?: string;
  created_by?: string;
  criado_por_nome?: string; // ✅ campo resolvido
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
  const enabled = (options?.enabled !== false) && !!adminId;


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
    { enabled }
  );


  const orcamentos: OrcamentoPJ[] = queryResult.data ?? [];

  // ✅ Busca nomes dos criadores (funcionários ou administradores)
  const createdByIds = orcamentos
    .map(o => o.created_by)
    .filter((id): id is string => !!id);

  const { data: criadoresData } = useQuery({
    queryKey: ['orcamentos_criadores', createdByIds],
    queryFn: async () => {
      if (createdByIds.length === 0) return { funcs: [], admins: [] };

      const [{ data: funcs }, { data: admins }] = await Promise.all([
        supabase
          .from('funcionarios')
          .select('auth_user_id, nome')
          .in('auth_user_id', createdByIds),
        supabase
          .from('administradores')
          .select('id, nome')
          .in('id', createdByIds),
      ]);

      return { funcs: funcs || [], admins: admins || [] };
    },
    enabled: createdByIds.length > 0,
    staleTime: 1000 * 60 * 5, // 5 min cache
  });

  // ✅ Monta mapa de id → nome
  const mapaFuncionarios = Object.fromEntries(
    (criadoresData?.funcs || []).map(f => [f.auth_user_id, f.nome])
  );
  const mapaAdmins = Object.fromEntries(
    (criadoresData?.admins || []).map(a => [a.id, a.nome])
  );

  // ✅ Injeta criado_por_nome em cada orçamento
  const orcamentosComCriador = orcamentos.map(o => ({
    ...o,
    criado_por_nome:
      (o.created_by && (mapaFuncionarios[o.created_by] || mapaAdmins[o.created_by]))
      || 'Administrador',
  }));


  const totalCount = queryResult.count || 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));


  return {
    data: orcamentosComCriador,
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
    .select('*, itens:orcamentos_pj_itens(*, produto:produtos_cadastrado(ncm, produto_cod))')
    .eq('id', id)
    .single();


  return useSupabaseQuery<OrcamentoPJ>(
    'ORCAMENTOS_PJ',
    query,
    [CACHE_KEYS.ORCAMENTOS_PJ, 'detail', id, 'v2'],
    { enabled: options?.enabled !== false && !!id }
  );
};


export const useCreateOrcamentoPJ = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Partial<OrcamentoPJ> & { itens?: Partial<OrcamentoPJItem>[] }) => {
      const { itens, ...orcamentoData } = data;

      const { data: orcamento, error: orcamentoError } = await supabase
        .from('orcamentos_pj')
        .insert(orcamentoData)
        .select()
        .single();

      if (orcamentoError) throw orcamentoError;

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
