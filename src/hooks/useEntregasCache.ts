import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { CACHE_KEYS, CACHE_TIMES } from '../lib/cache/cacheConfig';

// Hook para buscar entregas com cache
export const useEntregas = (vendedorId: string) => {
  return useQuery({
    queryKey: [CACHE_KEYS.ENTREGAS, vendedorId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('entregas')
        .select(`
          *,
          clientes(nome, telefone, endereco),
          produtos(nome, preco),
          vendedores(nome)
        `)
        .eq('vendedor_id', vendedorId)
        .order('data_entrega', { ascending: false });

      if (error) throw error;
      return data;
    },
    ...CACHE_TIMES.ENTREGAS,
  });
};

// Hook para criar entrega com invalidação automática
export const useCreateEntrega = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (novaEntrega: any) => {
      const { data, error } = await supabase
        .from('entregas')
        .insert(novaEntrega)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      // Invalida cache de entregas
      queryClient.invalidateQueries({
        queryKey: [CACHE_KEYS.ENTREGAS]
      });

      // Invalida stats do dashboard
      queryClient.invalidateQueries({
        queryKey: [CACHE_KEYS.STATS]
      });
    },
  });
};

// Hook para atualizar entrega
export const useUpdateEntrega = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: any }) => {
      const { data, error } = await supabase
        .from('entregas')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [CACHE_KEYS.ENTREGAS]
      });
      queryClient.invalidateQueries({
        queryKey: [CACHE_KEYS.STATS]
      });
    },
  });
};
