import { supabase } from '@/lib/supabase';
import { EstoqueAtual } from '@/types/estoque';
import { useQuery } from '@tanstack/react-query';

export const useEstoque = (options?: { enabled?: boolean }) => {
  return useQuery({
    queryKey: ['estoque_atual'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');
      
      // Se não for admin, buscar quem é o admin da empresa
      
      const { data: profile } = await supabase
        .from('profiles')
        .select('administrador_id')
        .eq('id', user.id)
        .single();
        
      const targetAdminId = profile?.administrador_id || user.id;

      const { data, error } = await supabase
        .from('view_estoque_atual')
        .select('*')
        .eq('administrador_id', targetAdminId)
        .order('produto_nome', { ascending: true });

      if (error) throw error;
      
      return data as EstoqueAtual[];
    },
    staleTime: 1000 * 60 * 5, // 5 minutos
    ...options
  });
};
