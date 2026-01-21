import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useSupabaseQuery, CACHE_KEYS } from '@/lib/supabaseCache';
import { handleSupabaseError } from '@/utils/supabaseErrorHandler';
import { useAuth } from '@/contexts/AuthContext';
import { Produto } from './useProdutos';

// Re-export Produto type for convenience
export type { Produto };

// Hook to fetch price table (products with their costs)
export const useTabelaPrecos = (adminId?: string, options?: { enabled?: boolean; search?: string }) => {
  const { user } = useAuth();
  const targetAdminId = adminId || user?.id;

  let query = supabase
    .from('produtos_cadastrado')
    .select('*')
    .order('produto_nome');

  if (targetAdminId) {
    query = query.eq('administrador_id', targetAdminId);
  }

  if (options?.search) {
    query = query.ilike('produto_nome', `%${options.search}%`);
  }

  const result = useSupabaseQuery<Produto>(
    'TABELA_PRECOS', 
    query, 
    [CACHE_KEYS.PRODUTOS, 'tabela-precos', targetAdminId, options?.search],
    { enabled: options?.enabled !== false && !!targetAdminId }
  );

  return {
    ...result,
    data: Array.isArray(result.data) ? result.data : []
  };
};

// Hook to update product cost/price
export const useUpdatePreco = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, custo_atual }: { id: string; custo_atual: number }) => {
      const { data, error } = await supabase
        .from('produtos_cadastrado')
        .update({ 
          preco_unt: custo_atual,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.PRODUTOS] });
      queryClient.invalidateQueries({ queryKey: ['TABELA_PRECOS'] });
    },
    onError: (error) => {
      console.error('Erro ao atualizar preço:', error);
      throw new Error(handleSupabaseError(error));
    }
  });
};
