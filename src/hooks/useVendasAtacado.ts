import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useSupabaseQuery, CACHE_KEYS } from '@/lib/supabaseCache';
import { handleSupabaseError } from '@/utils/supabaseErrorHandler';

export interface VendaAtacadoItem {
  id: string;
  venda_atacado_id: string;
  produto_cadastrado_id?: string;
  descricao: string;
  quantidade: number;
  preco_unitario: number;
  subtotal: number;
  produto_nome?: string;
  sincronizado?: boolean;
  created_at?: string;
}

export interface VendaAtacado {
  id: string;
  administrador_id: string;
  numero_pedido: number;
  cliente_id: string;
  cliente_nome: string;
  vendedor_id: string;
  vendedor_nome: string;
  data_venda: string;
  data_entrega: string;
  data_pagamento: string;
  forma_pagamento: 'PIX' | 'Dinheiro' | 'Boleto 7 dias' | 'Boleto 14 dias' | 'Boleto 30 dias' | 'Cheque';
  status_pagamento: 'pendente' | 'pago' | 'atrasado' | 'cancelado';
  valor_total: number;
  itens?: VendaAtacadoItem[];
  created_at?: string;
  updated_at?: string;
}

export interface UseVendasAtacadoOptions {
  enabled?: boolean;
  status_pagamento?: string;
  vendedor_id?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  pageSize?: number;
}

// Hook to fetch sales list
export const useVendasAtacado = (adminId: string, options?: UseVendasAtacadoOptions) => {
  const page = options?.page || 0;
  const pageSize = options?.pageSize || 20;
  const from = page * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from('vendas_atacado')
    .select('*, itens:vendas_atacado_itens(*)', { count: 'exact' })
    .eq('administrador_id', adminId)
    .order('created_at', { ascending: false })
    .range(from, to);

  if (options?.status_pagamento && options.status_pagamento !== 'todos') {
    query = query.eq('status_pagamento', options.status_pagamento);
  }

  if (options?.vendedor_id && options.vendedor_id !== 'todos') {
    query = query.eq('vendedor_id', options.vendedor_id);
  }

  if (options?.startDate) {
    query = query.gte('data_venda', options.startDate);
  }

  if (options?.endDate) {
    query = query.lte('data_venda', options.endDate);
  }

  const queryResult = useSupabaseQuery<VendaAtacado>(
    'VENDAS_ATACADO',
    query,
    [CACHE_KEYS.VENDAS_ATACADO || 'VENDAS_ATACADO', { ...options, adminId }],
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

// Hook to create a new sale
export const useCreateVendaAtacado = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Partial<VendaAtacado> & { itens: VendaAtacadoItem[] }) => {
      const { itens, ...vendaData } = data;

      // 1. Create sale
      const { data: venda, error: vendaError } = await supabase
        .from('vendas_atacado')
        .insert(vendaData)
        .select()
        .single();

      if (vendaError) throw vendaError;

      // 2. Create items
      if (itens && itens.length > 0) {
        const itensComId = itens.map(item => ({
          ...item,
          venda_id: venda.id
        }));

        const { error: itensError } = await supabase
          .from('vendas_atacado_itens')
          .insert(itensComId);

        if (itensError) throw itensError;
      }

      return venda;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.VENDAS_ATACADO || 'VENDAS_ATACADO'] });
      queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.MOVIMENTACOES_ESTOQUE] });
      queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.PRODUTOS] });
    },
    onError: (error) => {
      console.error('Erro ao criar venda:', error);
      throw new Error(handleSupabaseError(error));
    }
  });
};

// Hook to get total sales by seller
export const useVendasPorVendedor = (adminId: string, options?: { startDate?: string; endDate?: string }) => {
  let query = supabase
    .from('vendas_atacado')
    .select('vendedor_id, vendedores(nome), valor_total, status_pagamento')
    .eq('administrador_id', adminId);

  if (options?.startDate) {
    query = query.gte('data_venda', options.startDate);
  }

  if (options?.endDate) {
    query = query.lte('data_venda', options.endDate);
  }

  return useSupabaseQuery(
    'VENDAS_ATACADO_STATS',
    query,
    ['VENDAS_ATACADO_STATS', adminId, options],
    { enabled: !!adminId }
  );
};
