import { useQueryClient, useMutation } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useSupabaseQuery, CACHE_KEYS } from '../lib/supabaseCache';
import { useAuth } from '../contexts/AuthContext';
import { handleSupabaseError } from '@/utils/supabaseErrorHandler';

export interface Produto {
  id: string;
  administrador_id: string;
  produto_nome: string;
  produto_cod: string;
  categoria: string;
  qtd_estoque: number;
  preco_unt: number;
  created_at?: string;
  updated_at?: string;
}

// Hook para listar todos os produtos
export const useProdutos = (options?: {
  enabled?: boolean;
  categoria?: string;
}) => {
  const { user } = useAuth();
  
  if (!user?.id) {
    return { 
      data: [], 
      isLoading: false, 
      error: null, 
      refetch: () => Promise.resolve({ data: [], error: null })
    };
  }

  let query = supabase
    .from('produtos_cadastrado')
    .select('*')
    .eq('administrador_id', user.id)
    .order('produto_nome');

  // Filtros opcionais
  if (options?.categoria) {
    query = query.eq('categoria', options.categoria);
  }

  return useSupabaseQuery('PRODUTOS', query, {
    enabled: options?.enabled && !!user?.id,
  });
};

// Hook para buscar produto por ID
export const useProduto = (id: string, options?: { enabled?: boolean }) => {
  const { user } = useAuth();
  
  if (!user?.id || !id) {
    return { data: null, isLoading: false, error: null };
  }

  const query = supabase
    .from('produtos_cadastrado')
    .select('*')
    .eq('id', id)
    .eq('administrador_id', user.id)
    .single();

  return useSupabaseQuery('PRODUTOS', query, {
    enabled: options?.enabled && !!id && !!user?.id,
  });
};

// Hook para buscar produtos por categoria
export const useProdutosPorCategoria = (categoria: string, options?: { enabled?: boolean }) => {
  const { user } = useAuth();
  
  if (!user?.id || !categoria) {
    return { data: [], isLoading: false, error: null };
  }

  const query = supabase
    .from('produtos_cadastrado')
    .select('*')
    .eq('categoria', categoria)
    .eq('administrador_id', user.id)
    .order('produto_nome');

  return useSupabaseQuery('PRODUTOS', query, {
    enabled: options?.enabled && !!categoria && !!user?.id,
  });
};

// Hook para criar produto
export const useCreateProduto = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (produto: Omit<Produto, 'id'>) => {
      const { data, error } = await supabase
        .from('produtos_cadastrado')
        .insert(produto)
        .select()
        .single();
      
      if (error) {
        throw new Error(handleSupabaseError(error));
      }
      
      return data as Produto;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.PRODUTOS] });
      queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.CESTAS] });
    }
  });
};

// Hook para atualizar produto
export const useUpdateProduto = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Produto> & { id: string }) => {
      const { data, error } = await supabase
        .from('produtos_cadastrado')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) {
        throw new Error(handleSupabaseError(error));
      }
      
      return data as Produto;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.PRODUTOS] });
      queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.CESTAS] });
    }
  });
};

// Hook para deletar produto
export const useDeleteProduto = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      const { error } = await supabase
        .from('produtos_cadastrado')
        .delete()
        .eq('id', id);
      
      if (error) {
        throw new Error(handleSupabaseError(error));
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.PRODUTOS] });
      queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.CESTAS] });
    }
  });
};

// Hook para buscar categorias de produtos
export const useProdutoCategories = (options?: { enabled?: boolean }) => {
  const { user } = useAuth();
  
  if (!user?.id) {
    return { data: [], isLoading: false, error: null };
  }

  const query = supabase
    .from('produtos_cadastrado')
    .select('categoria')
    .eq('administrador_id', user.id)
    .order('categoria');

  return useSupabaseQuery('PRODUTOS', query, {
    enabled: options?.enabled && !!user?.id,
  });
};

// Hook para estatísticas de produtos
export const useEstatisticasProdutos = (options?: { enabled?: boolean }) => {
  const { user } = useAuth();
  
  if (!user?.id) {
    return { data: null, isLoading: false, error: null };
  }

  const query = supabase
    .from('produtos_cadastrado')
    .select('*')
    .eq('administrador_id', user.id);

  return useSupabaseQuery('PRODUTOS', query, {
    enabled: options?.enabled && !!user?.id,
  });
};

// Função utilitária para invalidar cache de produtos
export const useInvalidateProdutos = () => {
  const queryClient = useQueryClient();
  
  return () => {
    queryClient.invalidateQueries({
      queryKey: [CACHE_KEYS.PRODUTOS],
    });
  };
};

// Função utilitária para pré-carregar produto
export const usePrefetchProduto = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return (id: string) => {
    if (!user?.id || !id) return;
    
    queryClient.prefetchQuery({
      queryKey: [CACHE_KEYS.PRODUTOS, id],
      queryFn: () => 
        supabase
          .from('produtos_cadastrado')
          .select('*')
          .eq('id', id)
          .eq('administrador_id', user.id)
          .single()
          .then(({ data }) => data),
      staleTime: 10 * 60 * 1000, // 10 minutos
    });
  };
};
