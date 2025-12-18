import { useSupabaseQuery } from '../lib/supabaseCache';
import { supabase } from '../lib/supabase';
import { CACHE_KEYS } from '../lib/cache/cacheConfig';

export interface Responsavel {
  id: string;
  cliente_id: string;
  nome: string;
  cpf: string;
  telefone: string;
  parentesco: string;
}

// Hook para buscar responsáveis por cliente_id
export const useResponsaveisPorCliente = (cliente_id: string, options?: { enabled?: boolean }) => {
  const query = supabase
    .from('responsaveis')
    .select('*')
    .eq('cliente_id', cliente_id);

  return useSupabaseQuery('RESPONSAVEIS', query, [CACHE_KEYS.RESPONSAVEIS, cliente_id], {
    enabled: options?.enabled && !!cliente_id,
  });
};
