import { useSupabaseQuery } from '@/lib/supabaseCache';
import { supabase } from '@/lib/supabase';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CACHE_KEYS } from '@/lib/constants/queryKeys';

export interface AcertoDiario {
  id: string;
  administrador_id: string;
  vendedor_id: string;
  data_acerto: string;
  valor_pix: number;
  valor_deposito: number;
  valor_debito: number;
  valor_credito: number;
  valor_cheque: number;
  valor_dinheiro: number;
  valor_gasolina: number;
  valor_total_vendas: number;
  status: 'pendente' | 'concluido' | 'divergente';
  observacoes?: string;
  vendedor?: { nome: string };
  created_at?: string;
}

export const useAcertosDiarios = (
  adminId: string,
  options?: {
    enabled?: boolean;
    vendedor_id?: string;
    data_inicio?: string;
    data_fim?: string;
  }
) => {
  let query = supabase
    .from('acertos_diarios')
    .select('*, vendedor:vendedores(nome)')
    .eq('administrador_id', adminId)
    .order('data_acerto', { ascending: false });

  if (options?.vendedor_id) {
    query = query.eq('vendedor_id', options.vendedor_id);
  }

  if (options?.data_inicio) {
    query = query.gte('data_acerto', options.data_inicio);
  }

  if (options?.data_fim) {
    query = query.lte('data_acerto', options.data_fim);
  }

  return useSupabaseQuery(
    'ACERTOS_DIARIOS',
    query,
    [CACHE_KEYS.ACERTOS_DIARIOS, 'list', { adminId, ...options }],
    { enabled: options?.enabled && !!adminId }
  );
};

export const useAcertoPorData = (
  vendedorId: string,
  data: string,
  options?: { enabled?: boolean }
) => {
  const query = supabase
    .from('acertos_diarios')
    .select('*')
    .eq('vendedor_id', vendedorId)
    .eq('data_acerto', data)
    .maybeSingle();

  return useSupabaseQuery<AcertoDiario | null>(
    'ACERTOS_DIARIOS',
    query,
    [CACHE_KEYS.ACERTOS_DIARIOS, 'check', { vendedorId, data }],
    { enabled: options?.enabled !== false && !!vendedorId && !!data }
  );
};

export const useCreateAcerto = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: Partial<AcertoDiario>) => {
      // Verificar se já existe (opcional, se o banco tiver constraint UNIQUE, vai dar erro igual)
      if (data.vendedor_id && data.data_acerto) {
        const { data: existing } = await supabase
          .from('acertos_diarios')
          .select('id')
          .eq('vendedor_id', data.vendedor_id)
          .eq('data_acerto', data.data_acerto)
          .maybeSingle();
          
        if (existing) {
          throw new Error('Já existe um acerto para este vendedor nesta data.');
        }
      }

      const { data: result, error } = await supabase
        .from('acertos_diarios')
        .insert(data)
        .select()
        .single();
        
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.ACERTOS_DIARIOS] });
    }
  });
};
