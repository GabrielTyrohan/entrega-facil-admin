import { useSupabaseQuery } from '../lib/supabaseCache';
import { supabase } from '../lib/supabase';

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

  return useSupabaseQuery('CLIENTES', query, {
    enabled: options?.enabled && !!cliente_id,
  });
};
