import { useAuth } from '@/contexts/AuthContext';
import { PAGINATION } from '@/lib/constants/pagination';
import { QUERY_KEYS } from '@/lib/constants/queryKeys';
import { supabase } from '@/lib/supabase';
import { CACHE_KEYS, useSupabaseQuery } from '@/lib/supabaseCache';
import { handleSupabaseError } from '@/utils/supabaseErrorHandler';
import { toast } from '@/utils/toast';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export interface Vendedor {
  id: string;
  administrador_id: string;
  nome: string;
  telefone: string | null | undefined;
  email: string | null | undefined;
  endereco: string | null | undefined;
  ativo: boolean;
  created_at: string;
  updated_at: string;
  data_inicio?: string | null;
  tipo_vinculo?: string | null;
  percentual_minimo?: number | null;
  admin_id?: string;
  comissao_percentual?: number;
}

// ===== BUSCAR VENDEDORES (com paginação) =====
export const useVendedores = (page: number = 0) => {
  const { adminId } = useAuth();

  return useQuery({
    queryKey: [QUERY_KEYS.VENDEDORES, { adminId, page }],
    queryFn: async () => {
      const { from, to } = PAGINATION.calculateRange(page, 15);

      // ✅ Filtro explícito por administrador_id como segunda camada de segurança
      // além do RLS — garante isolamento mesmo se uma política RLS falhar
      const { data, error, count } = await supabase
        .from('vendedores')
        .select('*', { count: 'exact' })
        .eq('administrador_id', adminId!)
        .range(from, to)
        .order('nome');

      if (error) throw error;

      return {
        vendedores: (data || []) as Vendedor[],
        total: count || 0,
        totalPages: PAGINATION.calculateTotalPages(count || 0, 15),
      };
    },
    enabled: !!adminId,
    staleTime: 5 * 60 * 1000,
    placeholderData: (previousData: any) => previousData,
  });
};

// ===== CRIAR VENDEDOR =====
export const useCreateVendedor = () => {
  const queryClient = useQueryClient();
  const { adminId } = useAuth();

  return useMutation({
    mutationFn: async (novoVendedor: Partial<Vendedor>) => {
      const { data, error } = await supabase
        .from('vendedores')
        .insert({
          ...novoVendedor,
          administrador_id: adminId!,
        })
        .select()
        .single();

      if (error) throw error;
      return data as Vendedor;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.VENDEDORES] });
      toast.success('Vendedor criado com sucesso!');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Erro ao criar vendedor');
    },
  });
};

// ============================================
// LEGACY HOOKS (Preserved for compatibility)
// ============================================

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

      if (error) throw new Error(handleSupabaseError(error));

      return data as Vendedor;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.VENDEDORES] });
      toast.success('Vendedor atualizado com sucesso!');
    },
  });
};

export const useDeleteVendedor = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      const { error } = await supabase
        .from('vendedores')
        .delete()
        .eq('id', id);

      if (error) throw new Error(handleSupabaseError(error));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.VENDEDORES] });
      toast.success('Vendedor removido com sucesso!');
    },
  });
};

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
    query = query.eq('administrador_id', administrador_id);
  }

  return useSupabaseQuery('VENDEDORES', query, [CACHE_KEYS.VENDEDORES, 'performance', administrador_id], {
    enabled: options?.enabled && !!administrador_id,
  });
};