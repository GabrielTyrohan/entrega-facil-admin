import { useSupabaseQuery, CACHE_KEYS } from '../lib/supabaseCache';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { handleSupabaseError } from '@/utils/supabaseErrorHandler';

export interface Pagamento {
  id: string;
  entrega_id: string;
  valor: number;
  data_pagamento: string;
  metodo_pagamento: string;
  observacoes?: string;
  created_at: string;
  updated_at: string;
  entregas?: {
    id: string;
    vendedor_id: string;
    cliente_id: string;
    produto_id: string;
    valor: number;
    data_entrega: string;
    vendedores?: {
      id: string;
      nome: string;
      administrador_id: string;
    };
    clientes?: {
      id: string;
      nome: string;
    };
    produtos?: {
      id: string;
      nome: string;
    };
  };
}

// Hook para listar todos os pagamentos
export const usePagamentos = (options?: {
  enabled?: boolean;
  entrega_id?: string;
  vendedor_id?: string;
  data_inicio?: string;
  data_fim?: string;
  administrador_id?: string;
}) => {
  let query = supabase
    .from('pagamentos')
    .select(`
      *,
      entregas!inner(
        id,
        vendedor_id,
        cliente_id,
        produto_id,
        valor,
        data_entrega,
        vendedores!inner(id, nome, administrador_id),
        clientes(id, nome),
        produtos(id, nome)
      )
    `)
    .order('data_pagamento', { ascending: false });

  // Filtro por administrador (obrigatório para segurança)
  if (options?.administrador_id) {
    query = query.eq('entregas.vendedores.administrador_id', options.administrador_id);
  }

  // Filtros opcionais
  if (options?.entrega_id) {
    query = query.eq('entrega_id', options.entrega_id);
  }
  
  if (options?.vendedor_id) {
    query = query.eq('entregas.vendedor_id', options.vendedor_id);
  }

  if (options?.data_inicio) {
    query = query.gte('data_pagamento', options.data_inicio);
  }

  if (options?.data_fim) {
    query = query.lte('data_pagamento', options.data_fim);
  }

  return useSupabaseQuery('PAGAMENTOS', query, [CACHE_KEYS.PAGAMENTOS, options?.administrador_id, { entrega_id: options?.entrega_id, vendedor_id: options?.vendedor_id, data_inicio: options?.data_inicio, data_fim: options?.data_fim }], {
    enabled: options?.enabled,
  });
};

// Hook para buscar pagamento por ID
export const usePagamento = (id: string, options?: { enabled?: boolean }) => {
  const query = supabase
    .from('pagamentos')
    .select(`
      *,
      entregas(
        id,
        vendedor_id,
        cliente_id,
        valor,
        data_entrega,
        vendedores(id, nome),
        clientes(id, nome)
      )
    `)
    .eq('id', id)
    .single();

  return useSupabaseQuery('PAGAMENTOS', query, [CACHE_KEYS.PAGAMENTOS, id], {
    enabled: options?.enabled && !!id,
  });
};

// Hook para pagamentos por entrega
export const usePagamentosPorEntrega = (
  entrega_id: string,
  options?: { enabled?: boolean }
) => {
  const query = supabase
    .from('pagamentos')
    .select('*')
    .eq('entrega_id', entrega_id)
    .order('data_pagamento', { ascending: false });

  return useSupabaseQuery('PAGAMENTOS', query, [CACHE_KEYS.PAGAMENTOS, 'entrega', entrega_id], {
    enabled: options?.enabled && !!entrega_id,
  });
};

// Hook para criar pagamento
export const useCreatePagamento = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (pagamento: Omit<Pagamento, 'id'>) => {
      const { data, error } = await supabase
        .from('pagamentos')
        .insert(pagamento)
        .select()
        .single();
      
      if (error) {
        throw new Error(handleSupabaseError(error));
      }
      
      return data as Pagamento;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.PAGAMENTOS] });
      queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.ENTREGAS] });
      queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.VENDEDORES] });
    }
  });
};

// Hook para atualizar pagamento
export const useUpdatePagamento = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Pagamento> & { id: string }) => {
      const { data, error } = await supabase
        .from('pagamentos')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) {
        throw new Error(handleSupabaseError(error));
      }
      
      return data as Pagamento;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.PAGAMENTOS] });
      queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.ENTREGAS] });
    }
  });
};

// Hook para deletar pagamento
export const useDeletePagamento = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      const { error } = await supabase
        .from('pagamentos')
        .delete()
        .eq('id', id);
      
      if (error) {
        throw new Error(handleSupabaseError(error));
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.PAGAMENTOS] });
      queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.ENTREGAS] });
    }
  });
};

// Hook para estatísticas de pagamentos
export const useEstatisticasPagamentos = (
  administrador_id?: string,
  options?: { enabled?: boolean }
) => {
  let query = supabase
    .from('pagamentos')
    .select(`
      id,
      valor,
      data_pagamento,
      metodo_pagamento,
      entregas!inner(
        vendedores!inner(administrador_id)
      )
    `);

  if (administrador_id) {
    query = query.eq('entregas.vendedores.administrador_id', administrador_id);
  }

  return useSupabaseQuery('PAGAMENTOS', query, [CACHE_KEYS.PAGAMENTOS, 'stats', administrador_id], {
    enabled: options?.enabled,
  });
};
