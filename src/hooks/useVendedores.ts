import { useQueryClient, useMutation } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useSupabaseQuery, CACHE_KEYS } from '../lib/supabaseCache';
import { handleSupabaseError } from '@/utils/supabaseErrorHandler';

export interface Vendedor {
  id: string;
  nome: string;
  email?: string;
  telefone?: string;
  admin_id: string;
  administrador_id: string;
  ativo: boolean;
  comissao_percentual?: number;
  percentual_minimo?: number;
  created_at: string;
  updated_at?: string;
}

// Hook para listar todos os vendedores
export const useVendedores = (options?: {
  enabled?: boolean;
  ativo?: boolean;
  administrador_id?: string;
}) => {
  let query = supabase
    .from('vendedores')
    .select('*')
    .order('nome');

  // Filtros opcionais
  if (options?.ativo !== undefined) {
    query = query.eq('ativo', options.ativo);
  }

  if (options?.administrador_id) {
    query = query.eq('administrador_id', options.administrador_id);
  }

  return useSupabaseQuery('VENDEDORES', query, [CACHE_KEYS.VENDEDORES, options?.administrador_id, { ativo: options?.ativo }], {
    enabled: options?.enabled,
  });
};

// Hook para buscar vendedor por ID
export const useVendedor = (id: string, options?: { enabled?: boolean }) => {
  const query = supabase
    .from('vendedores')
    .select('*')
    .eq('id', id)
    .single();

  return useSupabaseQuery('VENDEDORES', query, [CACHE_KEYS.VENDEDORES, id], {
    enabled: options?.enabled && !!id,
  });
};

// Hook para buscar vendedores por admin
export const useVendedoresByAdmin = (administrador_id: string, options?: { enabled?: boolean }) => {
  const query = supabase
    .from('vendedores')
    .select('*')
    .eq('administrador_id', administrador_id)
    .eq('ativo', true)
    .order('nome');

  return useSupabaseQuery('VENDEDORES', query, [CACHE_KEYS.VENDEDORES, administrador_id, 'list'], {
    enabled: options?.enabled && !!administrador_id,
  }) as { data: Vendedor[]; isLoading: boolean; error: any };
};

// Hook para criar vendedor
export const useCreateVendedor = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (vendedor: Omit<Vendedor, 'id'>) => {
      const { data, error } = await supabase
        .from('vendedores')
        .insert(vendedor)
        .select()
        .single();
      
      if (error) {
        throw new Error(handleSupabaseError(error));
      }
      
      return data as Vendedor;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.VENDEDORES] });
    },
    onError: (error) => {
      console.error('Erro ao criar vendedor:', error);
    }
  });
};

// Hook para atualizar vendedor
export const useUpdateVendedor = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Vendedor> & { id: string }) => {
      const { data, error } = await supabase
        .from('vendedores')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) {
        throw new Error(handleSupabaseError(error));
      }
      
      return data as Vendedor;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.VENDEDORES] });
    }
  });
};

// Hook para deletar vendedor
export const useDeleteVendedor = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      const { error } = await supabase
        .from('vendedores')
        .delete()
        .eq('id', id);
      
      if (error) {
        throw new Error(handleSupabaseError(error));
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.VENDEDORES] });
    }
  });
};

// Hook para estatísticas de vendedores
export const useEstatisticasVendedores = (
  administrador_id?: string,
  options?: { enabled?: boolean }
) => {
  let query = supabase
    .from('vendedores')
    .select('id, nome, created_at')
    .eq('ativo', true);

  if (administrador_id) {
    query = query.eq('administrador_id', administrador_id);
  }

  return useSupabaseQuery('VENDEDORES', query, [CACHE_KEYS.VENDEDORES, 'stats', administrador_id], {
    enabled: options?.enabled,
  });
};

// Hook para vendedores com performance (entregas e vendas)
export const useVendedoresComPerformance = (
  administrador_id?: string,
  options?: { enabled?: boolean }
) => {
  let query = supabase
    .from('vendedores')
    .select(`
      id,
      nome,
      email,
      telefone,
      comissao_percentual,
      created_at
    `)
    .eq('ativo', true);

  if (administrador_id) {
    query = query.eq('administrador_id', administrador_id || '');
  }

  return useSupabaseQuery('VENDEDORES', query, [CACHE_KEYS.VENDEDORES, 'performance', administrador_id], {
    enabled: options?.enabled && !!administrador_id,
  });
};

// Hook para vendedores com paginação
export const useVendedoresPaginados = (
  page: number = 1,
  limit: number = 10,
  options?: {
    enabled?: boolean;
    ativo?: boolean;
    administrador_id?: string;
    search?: string;
  }
) => {
  let query = supabase
    .from('vendedores')
    .select('*', { count: 'exact' })
    .order('nome');

  // Filtros
  if (options?.ativo !== undefined) {
    query = query.eq('ativo', options.ativo);
  }

  // SEMPRE filtrar por administrador_id se fornecido
  if (options?.administrador_id) {
    query = query.eq('administrador_id', options.administrador_id);
  }

  if (options?.search) {
    // SOLUÇÃO: Usar apenas filtros da tabela principal (vendedores)
    // Todas as colunas (nome, email) são da tabela vendedores
    const searchFilter = `nome.ilike.%${options.search}%,email.ilike.%${options.search}%`;
    query = query.or(searchFilter);
  }

  // Paginação
  const from = (page - 1) * limit;
  const to = from + limit - 1;
  query = query.range(from, to);

  return useSupabaseQuery('VENDEDORES', query, [CACHE_KEYS.VENDEDORES, 'paginated', page, limit, options], {
    enabled: options?.enabled && !!options?.administrador_id,
  });
};

// Função utilitária para invalidar cache de vendedores
export const useInvalidateVendedores = () => {
  const queryClient = useQueryClient();
  
  return () => {
    queryClient.invalidateQueries({
      queryKey: [CACHE_KEYS.VENDEDORES],
    });
  };
};

// Função utilitária para pré-carregar vendedor
export const usePrefetchVendedor = () => {
  const queryClient = useQueryClient();
  
  return (id: string) => {
    queryClient.prefetchQuery({
      queryKey: [CACHE_KEYS.VENDEDORES, id],
      queryFn: () => 
        supabase
          .from('vendedores')
          .select('*')
          .eq('id', id)
          .single()
          .then(({ data }) => data),
      staleTime: 5 * 60 * 1000, // 5 minutos
    });
  };
};
