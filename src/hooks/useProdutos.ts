import { handleSupabaseError } from '@/utils/supabaseErrorHandler';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { CACHE_KEYS, useSupabaseQuery } from '../lib/supabaseCache';
import { ProdutoCadastrado } from '../services/produtoService';


export type Produto = ProdutoCadastrado;


export const useProdutos = (options?: {
  enabled?: boolean;
  categoria?: string;
  page?: number;
  pageSize?: number;
  searchTerm?: string;
}) => {
  const { adminId } = useAuth();
  const targetId = adminId;
  const page = options?.page || 1;
  const pageSize = options?.pageSize || 1000;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from('produtos_cadastrado')
    .select('*', { count: 'exact' });

  if (targetId) {
    query = query.eq('administrador_id', targetId);
  } else {
    query = query.eq('administrador_id', '00000000-0000-0000-0000-000000000000');
  }

  query = query.eq('ativo', true);

  if (options?.categoria && options.categoria !== 'Todas') {
    query = query.eq('categoria', options.categoria);
  }

  if (options?.searchTerm) {
    query = query.or(`produto_nome.ilike.%${options.searchTerm}%,produto_cod.ilike.%${options.searchTerm}%`);
  }

  query = query.order('produto_nome').range(from, to);

  return useSupabaseQuery(
    'PRODUTOS',
    query,
    [CACHE_KEYS.PRODUTOS, targetId, {
      categoria: options?.categoria,
      page,
      pageSize,
      searchTerm: options?.searchTerm
    }],
    {
      enabled: (options?.enabled ?? true) && !!targetId,
      refetchOnMount: true,
    }
  );
};


export const useProduto = (id: string, options?: { enabled?: boolean }) => {
  const { adminId } = useAuth();
  const targetId = adminId;

  if (!targetId || !id) {
    return { data: null, isLoading: false, error: null };
  }

  const query = supabase
    .from('produtos_cadastrado')
    .select('*')
    .eq('id', id)
    .eq('administrador_id', targetId)
    .single();

  return useSupabaseQuery('PRODUTOS', query, [CACHE_KEYS.PRODUTOS, id], {
    enabled: options?.enabled && !!id && !!targetId,
  });
};


export const useProdutosPorCategoria = (categoria: string, options?: { enabled?: boolean }) => {
  const { adminId } = useAuth();
  const targetId = adminId;

  if (!targetId || !categoria) {
    return { data: [], isLoading: false, error: null };
  }

  const query = supabase
    .from('produtos_cadastrado')
    .select('*')
    .eq('categoria', categoria)
    .eq('administrador_id', targetId)
    .order('produto_nome');

  return useSupabaseQuery('PRODUTOS', query, [CACHE_KEYS.PRODUTOS, targetId, 'categoria', categoria], {
    enabled: options?.enabled && !!categoria && !!targetId,
  });
};


export const useCreateProduto = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (produto: Omit<Produto, 'id'>) => {
      const { data, error } = await supabase
        .from('produtos_cadastrado')
        .insert(produto)
        .select()
        .single();

      if (error) throw new Error(handleSupabaseError(error));

      return data as Produto;
    },
    // ✅ CORRIGIDO — 2 invalidações agrupadas em Promise.all
    onSuccess: () => {
      Promise.all([
        queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.PRODUTOS] }),
        queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.CESTAS] }),
      ]);
    }
  });
};


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

      if (error) throw new Error(handleSupabaseError(error));

      return data as Produto;
    },
    // ✅ CORRIGIDO — 2 invalidações agrupadas em Promise.all
    onSuccess: () => {
      Promise.all([
        queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.PRODUTOS] }),
        queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.CESTAS] }),
      ]);
    }
  });
};


export const useDeleteProduto = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      const { error } = await supabase
        .from('produtos_cadastrado')
        .delete()
        .eq('id', id);

      if (error) throw new Error(handleSupabaseError(error));
    },
    // ✅ CORRIGIDO — 2 invalidações agrupadas em Promise.all
    onSuccess: () => {
      Promise.all([
        queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.PRODUTOS] }),
        queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.CESTAS] }),
      ]);
    }
  });
};


export const useProdutoCategories = (options?: { enabled?: boolean }) => {
  const { user, adminId } = useAuth();
  const targetId = adminId || user?.id;

  if (!targetId) {
    return { data: [], isLoading: false, error: null };
  }

  const query = supabase
    .from('produtos_cadastrado')
    .select('categoria')
    .eq('administrador_id', targetId)
    .order('categoria');

  return useSupabaseQuery('PRODUTOS', query, [CACHE_KEYS.PRODUTOS, 'categories', targetId], {
    enabled: options?.enabled && !!targetId,
  });
};


export const useEstatisticasProdutos = (options?: { enabled?: boolean }) => {
  const { adminId } = useAuth();
  const targetId = adminId;

  if (!targetId) {
    return { data: null, isLoading: false, error: null };
  }

  const query = supabase
    .from('produtos_cadastrado')
    .select('*')
    .eq('administrador_id', targetId);

  return useSupabaseQuery('PRODUTOS', query, [CACHE_KEYS.PRODUTOS, 'stats', targetId], {
    enabled: options?.enabled && !!targetId,
  });
};


export const useInvalidateProdutos = () => {
  const queryClient = useQueryClient();

  return () => {
    queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.PRODUTOS] });
  };
};


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
      staleTime: 10 * 60 * 1000,
    });
  };
};