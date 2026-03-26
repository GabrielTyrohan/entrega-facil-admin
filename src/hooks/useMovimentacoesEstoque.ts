import { useAuth } from '@/contexts/AuthContext';
import { CACHE_KEYS, CACHE_TIMES } from '@/lib/constants/queryKeys';
import { movimentarEstoque } from '@/utils/movimentarEstoque';
import type { MovimentacaoEstoque, RegistrarMovimentacaoParams } from '@/types/estoque';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export function useMovimentacoesEstoque(produtoId?: string) { 
  const { userProfile, userType } = useAuth(); 
  const queryClient = useQueryClient(); 
  
  // Determinar o ID do administrador corretamente com base no tipo de usuário
  const adminId = userType === 'admin' 
    ? userProfile?.id 
    : (userProfile as any)?.administrador_id;

  const query = useQuery({ 
    queryKey: [CACHE_KEYS.MOVIMENTACOES_ESTOQUE, adminId, produtoId], 
    queryFn: async () => { 
      if (!adminId) throw new Error('Admin ID não encontrado'); 

      let queryBuilder = supabase 
        .from('movimentacoes_estoque') 
        .select('*') 
        .eq('administrador_id', adminId) 
        .order('created_at', { ascending: false }); 

      if (produtoId) { 
        queryBuilder = queryBuilder.eq('produto_cadastrado_id', produtoId); 
      } 

      const { data, error } = await queryBuilder; 
      if (error) throw error; 
      return data as MovimentacaoEstoque[]; 
    }, 
    enabled: !!adminId, 
    staleTime: CACHE_TIMES.ESTOQUE.staleTime, 
    gcTime: CACHE_TIMES.ESTOQUE.gcTime, 
  }); 

  const registrarMovimentacao = useMutation({ 
    mutationFn: async (params: RegistrarMovimentacaoParams) => { 
      if (!adminId) throw new Error('Admin ID não encontrado'); 
      if (!userProfile) throw new Error('Usuário não autenticado'); 

      // Usa função centralizada — apenas INSERT em movimentacoes_estoque
      // A TRIGGER no Supabase atualiza qtd_estoque automaticamente
      await movimentarEstoque({
        adminId,
        produtoId: params.produto_id,
        quantidade: params.quantidade,
        tipoMovimentacao: params.tipo_movimentacao,
        referenciaTipo: 'ajuste_manual',
        usuarioId: userProfile.id,
        usuarioTipo: (userProfile as any).tipo || 'admin',
        usuarioNome: userProfile.nome,
        motivo: params.motivo,
        observacoes: params.observacoes,
        lote: params.lote,
        fornecedor: params.fornecedor,
      });
    }, 
    onSuccess: () => { 
      queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.MOVIMENTACOES_ESTOQUE] }); 
      queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.PRODUTOS] }); 
    }, 
  }); 

  return { 
    movimentacoes: query.data, 
    isLoading: query.isLoading, 
    error: query.error, 
    registrarMovimentacao: registrarMovimentacao.mutateAsync, 
    isRegistrando: registrarMovimentacao.isPending, 
  }; 
} 
