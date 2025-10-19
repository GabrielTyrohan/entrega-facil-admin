import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useSupabaseQuery, useSupabaseMutation, CACHE_KEYS } from '../lib/supabaseCache';

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
  updated_at: string;
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

  return useSupabaseQuery('VENDEDORES', query, {
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

  return useSupabaseQuery('VENDEDORES', query, {
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

  return useSupabaseQuery('VENDEDORES', query, {
    enabled: options?.enabled && !!administrador_id,
  }) as { data: Vendedor[]; isLoading: boolean; error: any };
};

// Hook para criar vendedor
export const useCreateVendedor = (options?: {
  onSuccess?: (vendedor: Vendedor) => void;
  onError?: (error: any) => void;
}) => {
  return useSupabaseMutation('VENDEDORES', 'insert', {
    onSuccess: options?.onSuccess,
    onError: options?.onError,
    // Invalidar cache relacionado (entregas e pagamentos)
    invalidateRelated: ['ENTREGAS', 'PAGAMENTOS'],
  });
};

// Hook para atualizar vendedor
export const useUpdateVendedor = (options?: {
  onSuccess?: (vendedor: Vendedor) => void;
  onError?: (error: any) => void;
}) => {
  return useSupabaseMutation('VENDEDORES', 'update', {
    onSuccess: options?.onSuccess,
    onError: options?.onError,
    // Invalidar cache relacionado
    invalidateRelated: ['ENTREGAS', 'PAGAMENTOS'],
  });
};

// Hook para deletar vendedor
export const useDeleteVendedor = (options?: {
  onSuccess?: () => void;
  onError?: (error: any) => void;
}) => {
  return useSupabaseMutation('VENDEDORES', 'delete', {
    onSuccess: options?.onSuccess,
    onError: options?.onError,
    // Invalidar cache relacionado
    invalidateRelated: ['ENTREGAS', 'PAGAMENTOS'],
    // Atualização otimista para remoção
    optimisticUpdate: {
      updateFn: (oldData: Vendedor[], variables: { id: string }) => {
        return oldData.filter(vendedor => vendedor.id !== variables.id);
      },
      rollbackFn: (oldData: Vendedor[]) => oldData, // Restaurar dados originais
    },
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

  return useSupabaseQuery('VENDEDORES', query, {
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

  return useSupabaseQuery('VENDEDORES', query, {
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

  return useSupabaseQuery('VENDEDORES', query, {
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
