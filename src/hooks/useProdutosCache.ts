import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { CACHE_KEYS, CACHE_TIMES } from '../lib/cache/cacheConfig';

export const useProdutos = (vendedorId: string) => {
  return useQuery({
    queryKey: [CACHE_KEYS.PRODUTOS, vendedorId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('produtos')
        .select('*')
        .eq('vendedor_id', vendedorId)
        .eq('ativo', true)
        .order('nome');

      if (error) throw error;
      return data;
    },
    ...CACHE_TIMES.PRODUTOS,
  });
};
