import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { QUERY_KEYS } from '@/lib/constants/queryKeys';
import { PAGINATION } from '@/lib/constants/pagination';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/utils/toast';
import { CACHE_KEYS, useSupabaseQuery } from '@/lib/supabaseCache';
import { handleSupabaseError } from '@/utils/supabaseErrorHandler';

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
  // Campos adicionais opcionais
  data_inicio?: string | null;
  tipo_vinculo?: string | null;
  percentual_minimo?: number | null;
  // Legacy fields (optional compatibility)
  admin_id?: string;
  comissao_percentual?: number;
}

// ============================================
// OTIMIZADO: Hooks usando RLS e AdminId Context
// ============================================

// ===== BUSCAR VENDEDORES (com paginação) =====
export const useVendedores = (page: number = 0) => {
  const { adminId } = useAuth(); // Pega adminId do contexto

  return useQuery({
    queryKey: [QUERY_KEYS.VENDEDORES, { adminId, page }],
    queryFn: async () => {
      const { from, to } = PAGINATION.calculateRange(page, 15);

      // NÃO PRECISA FILTRAR POR administrador_id!
      // O RLS do Supabase faz isso automaticamente
      const { data, error, count } = await supabase
        .from('vendedores')
        .select('*', { count: 'exact' })
        .range(from, to)
        .order('nome');

      if (error) throw error;

      return {
        vendedores: (data || []) as Vendedor[],
        total: count || 0,
        totalPages: PAGINATION.calculateTotalPages(count || 0, 15),
      };
    },
    enabled: !!adminId, // Só executa se tiver adminId
    staleTime: 5 * 60 * 1000, // Cache de 5 minutos
    placeholderData: (previousData: any) => previousData, // Keep previous data while fetching
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
          administrador_id: adminId!, // Vincula ao admin
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

// Hook para buscar vendedores por admin (Legacy - used in NovaVendaAtacado)
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
      toast.success('Vendedor atualizado com sucesso!');
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
      toast.success('Vendedor removido com sucesso!');
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
