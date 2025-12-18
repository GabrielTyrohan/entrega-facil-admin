import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { CACHE_KEYS, CACHE_TIMES } from '../lib/cache/cacheConfig';

export const useClientes = (vendedorId: string) => {
  return useQuery({
    queryKey: [CACHE_KEYS.CLIENTES, vendedorId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clientes')
        .select('*')
        .eq('vendedor_id', vendedorId)
        .eq('ativo', true)
        .order('nome');

      if (error) throw error;
      return data;
    },
    ...CACHE_TIMES.CLIENTES,
  });
};

export const useCreateCliente = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (novoCliente: any) => {
      const { data, error } = await supabase
        .from('clientes')
        .insert(novoCliente)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [CACHE_KEYS.CLIENTES]
      });
    },
  });
};
