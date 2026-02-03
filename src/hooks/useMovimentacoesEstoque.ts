import { useAuth } from '@/contexts/AuthContext';
import { CACHE_KEYS, CACHE_TIMES } from '@/lib/constants/queryKeys';
import { supabase } from '@/lib/supabase';
import type { MovimentacaoEstoque, RegistrarMovimentacaoParams } from '@/types/estoque';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

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

      const { data: produto, error: produtoError } = await supabase 
        .from('produtos_cadastrado') 
        .select('qtd_estoque') 
        .eq('id', params.produto_id) 
        .single(); 

      if (produtoError) throw produtoError; 

      const estoqueAtual = produto?.qtd_estoque || 0; 
      const isEntrada = params.tipo_movimentacao.startsWith('entrada'); 
      const novaQuantidade = isEntrada 
        ? estoqueAtual + params.quantidade 
        : estoqueAtual - params.quantidade; 

      const { data, error } = await supabase 
        .from('movimentacoes_estoque') 
        .insert({ 
          administrador_id: adminId, 
          produto_cadastrado_id: params.produto_id, 
          tipo_movimentacao: params.tipo_movimentacao, 
          quantidade: params.quantidade, 
          quantidade_anterior: estoqueAtual, 
          quantidade_nova: novaQuantidade, 
          usuario_id: userProfile.id, 
          usuario_tipo: (userProfile as any).tipo || 'admin', 
          usuario_nome: userProfile.nome, 
          motivo: params.motivo, 
          observacoes: params.observacoes, 
          lote: params.lote, 
          fornecedor: params.fornecedor, 
        }) 
        .select() 
        .single(); 

      if (error) throw error; 
      return data as MovimentacaoEstoque; 
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
