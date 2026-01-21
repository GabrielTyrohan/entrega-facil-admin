import { QueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { CACHE_KEYS } from '@/lib/constants/queryKeys';

/**
 * Realiza o prefetch de dados essenciais para o funcionamento do sistema
 * logo após o login ou recarga da página, melhorando a percepção de performance.
 */
export const prefetchEssentialData = async (
  queryClient: QueryClient,
  adminId: string
) => {
  console.log('🚀 Prefetching dados essenciais...');

  // Prefetch em paralelo (não bloqueia a UI)
  await Promise.allSettled([
    // Vendedores (usado em quase toda página)
    queryClient.prefetchQuery({
      queryKey: [CACHE_KEYS.VENDEDORES, { adminId, page: 0 }],
      queryFn: async () => {
        const { data } = await supabase
          .from('vendedores')
          .select('*')
          .eq('ativo', true)
          .eq('administrador_id', adminId) // Importante filtrar pelo admin
          .order('nome')
          .limit(15);
        return { vendedores: data || [], total: data?.length || 0 };
      },
      staleTime: 5 * 60 * 1000,
    }),

    // Produtos (usado em vendas/entregas)
    queryClient.prefetchQuery({
      queryKey: [CACHE_KEYS.PRODUTOS, adminId, { categoria: undefined }],
      queryFn: async () => {
        const { data } = await supabase
          .from('produtos_cadastrado')
          .select('*')
          .eq('ativo', true)
          .eq('administrador_id', adminId)
          .order('produto_nome')
          .limit(50);
        return data || [];
      },
      staleTime: 10 * 60 * 1000,
    }),
  ]);

  console.log('✅ Prefetch concluído');
};
