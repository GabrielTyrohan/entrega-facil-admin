import { supabase } from '@/lib/supabase';
import { CACHE_KEYS, useSupabaseQuery } from '@/lib/supabaseCache';
import { handleSupabaseError } from '@/utils/supabaseErrorHandler';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export interface VendaAtacadoItem {
  id?: string; // Opcional pois é gerado no banco
  venda_atacado_id?: string; // Opcional antes de salvar
  produto_cadastrado_id?: string;
  descricao: string;
  quantidade: number;
  preco_unitario: number;
  subtotal: number;
  produto_nome?: string; // Para compatibilidade temporária se necessário, mas idealmente usar descricao
  sincronizado?: boolean;
  created_at?: string;
}

export interface CreateVendaAtacadoPayload {
  administrador_id: string;
  cliente_id: string;
  vendedor_id: string;
  data_entrega: string;
  data_pagamento: string;
  forma_pagamento: string;
  status_pagamento: 'pendente' | 'pago' | 'cancelado' | 'atrasado';
  valor_total: number;
  pago: boolean;
  numero_produto: string[];
  itens: VendaAtacadoItem[];
  quantidade_total: number;
  nome_cliente_cache?: string;
  observacoes?: string;
}

export interface VendaAtacado {
  id: string;
  administrador_id: string;
  numero_pedido: number;
  cliente_id: string;
  cliente_nome: string;
  vendedor_id: string;
  vendedor_nome: string;
  data_venda: string;
  data_entrega: string;
  data_pagamento: string;
  forma_pagamento: 'PIX' | 'Dinheiro' | 'Boleto 7 dias' | 'Boleto 14 dias' | 'Boleto 30 dias' | 'Cheque';
  status_pagamento: 'pendente' | 'pago' | 'atrasado' | 'cancelado';
  valor_total: number;
  itens?: VendaAtacadoItem[];
  numero_produto?: string[];
  created_at?: string;
  updated_at?: string;
}

export interface UseVendasAtacadoOptions {
  enabled?: boolean;
  status_pagamento?: string;
  vendedor_id?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  pageSize?: number;
}

// Hook to fetch sales list
export const useVendasAtacado = (adminId: string, options?: UseVendasAtacadoOptions) => {
  const page = options?.page || 0;
  const pageSize = options?.pageSize || 20;
  const from = page * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from('vendas_atacado')
    .select(`
      *, 
      itens:vendas_atacado_itens(*),
      clientes:cliente_id (
        id,
        nome,
        sobrenome,
        tipo_pessoa,
        responsavel_pj_nome
      )
    `, { count: 'exact' })
    .eq('administrador_id', adminId)
    .order('created_at', { ascending: false })
    .range(from, to);

  if (options?.status_pagamento && options.status_pagamento !== 'todos') {
    query = query.eq('status_pagamento', options.status_pagamento);
  }

  if (options?.vendedor_id && options.vendedor_id !== 'todos') {
    query = query.eq('vendedor_id', options.vendedor_id);
  }

  if (options?.startDate) {
    query = query.gte('data_venda', options.startDate);
  }

  if (options?.endDate) {
    query = query.lte('data_venda', options.endDate);
  }

  const queryResult = useSupabaseQuery<VendaAtacado>(
    'VENDAS_ATACADO',
    query,
    [CACHE_KEYS.VENDAS_ATACADO || 'VENDAS_ATACADO', { ...options, adminId }],
    { enabled: options?.enabled !== false && !!adminId }
  );

  const totalCount = queryResult.count || 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  return {
    data: Array.isArray(queryResult.data) ? queryResult.data : [],
    isLoading: queryResult.isLoading,
    error: queryResult.error,
    totalCount,
    totalPages,
    currentPage: page,
    refetch: queryResult.refetch,
  };
};

// Hook to create a new sale
export const useCreateVendaAtacado = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreateVendaAtacadoPayload) => {
      const { itens, ...resto } = payload;

      // 1. Insere venda com itens no JSONB
      const { data: novaVenda, error: vendaError } = await supabase
        .from('vendas_atacado')
        .insert({ ...resto, itens })   // <-- itens vai pro JSONB também
        .select('id, numero_pedido')
        .single();

      if (vendaError) throw vendaError;
      if (!novaVenda) throw new Error('Venda não retornou dados.');

      // 2. Insere na tabela filha (para relatórios relacionais)
      if (itens && itens.length > 0) {
        const itensPayload = itens.map(item => ({
          venda_atacado_id: novaVenda.id,
          produto_cadastrado_id: item.produto_cadastrado_id || null,
          descricao: item.descricao,
          quantidade: item.quantidade,
          preco_unitario: item.preco_unitario,
          subtotal: item.subtotal,
          sincronizado: false,
        }));

        const { error: itensError } = await supabase
          .from('vendas_atacado_itens')
          .insert(itensPayload);

        if (itensError) {
          console.error('Erro ao inserir itens na tabela filha:', itensError);
        }
      }

      return novaVenda;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.VENDAS_ATACADO || 'VENDAS_ATACADO'] });
      queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.MOVIMENTACOES_ESTOQUE] });
      queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.PRODUTOS] });
    },
    onError: (error: any) => {
      // Ignorar erro PGRST204 se for apenas sobre cache de schema, pois a inserção funcionou
      if (error?.code === 'PGRST204') {
        console.warn('Aviso Supabase (PGRST204):', error.message);
        // Forçar sucesso invalidando queries mesmo com "erro"
        queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.VENDAS_ATACADO || 'VENDAS_ATACADO'] });
        return;
      }
      console.error('Erro ao criar venda:', error);
      throw new Error(handleSupabaseError(error));
    }
  });
};

// Hook to get total sales by seller
export const useVendasPorVendedor = (adminId: string, options?: { startDate?: string; endDate?: string }) => {
  // Opção A: Usar uma query raw customizada via RPC se o Supabase suportar
  // Opção B: Buscar todas e agregar no cliente (menos performático mas funciona sem RPC)
  
  return useQuery({
    queryKey: ['VENDAS_POR_VENDEDOR', adminId, options],
    queryFn: async () => {
      // 1. Buscar todas as vendas do período
      let query = supabase
        .from('vendas_atacado')
        .select('vendedor_id, valor_total, vendedores(nome)')
        .eq('administrador_id', adminId);

      if (options?.startDate) {
        query = query.gte('data_entrega', options.startDate); // Usar data_entrega que é mais relevante para comissão
      }

      if (options?.endDate) {
        query = query.lte('data_entrega', options.endDate);
      }

      const { data, error } = await query;
      if (error) throw error;

      // 2. Agregar dados manualmente
      const stats = (data || []).reduce((acc: any, curr: any) => {
        const vendedorId = curr.vendedor_id;
        const vendedorNome = curr.vendedores?.nome || 'Desconhecido';
        const valor = Number(curr.valor_total) || 0;

        if (!acc[vendedorId]) {
          acc[vendedorId] = {
            vendedor_id: vendedorId,
            vendedor_nome: vendedorNome,
            total_valor: 0,
            total_vendas: 0
          };
        }

        acc[vendedorId].total_valor += valor;
        acc[vendedorId].total_vendas += 1;
        return acc;
      }, {});

      return Object.values(stats).sort((a: any, b: any) => b.total_valor - a.total_valor);
    },
    enabled: !!adminId,
    staleTime: 5 * 60 * 1000 // Cache por 5 minutos
  });
};

// Hook to fetch single sale details
export const useVendaAtacadoById = (id: string, enabled = true) => {
  const query = supabase
    .from('vendas_atacado')
    .select(`
      *, 
      clientes (
        id, nome, sobrenome, cpf, cnpj, telefone, email, 
        tipo_pessoa, responsavel_pj_nome, 
        endereco, numero, Bairro, Cidade, Estado
      ),
      vendedores:vendedor_id (
        id, nome
      ),
      vendas_atacado_itens (
        id, produto_cadastrado_id, descricao, 
        quantidade, preco_unitario, subtotal
      )
    `)
    .eq('id', id)
    .maybeSingle();

  return useSupabaseQuery<VendaAtacado>(
    'VENDA_ATACADO_DETALHES',
    query,
    [CACHE_KEYS.VENDA_ATACADO_DETALHES || 'VENDA_ATACADO_DETALHES', id],
    { enabled: !!id && enabled }
  );
};

export const useRegistrarPagamento = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      vendaId,
      valorNovoPagamento,
      valorPagoAtual,
      valorTotal,
      formaPagamento,
      observacao,
    }: {
      vendaId: string;
      valorNovoPagamento: number;
      valorPagoAtual: number;
      valorTotal: number;
      formaPagamento?: string;
      observacao?: string;
    }) => {
      const novoValorPago = valorPagoAtual + valorNovoPagamento;
      const novoStatus =
        novoValorPago >= valorTotal
          ? 'pago'
          : novoValorPago > 0
          ? 'parcial'
          : 'pendente';

      // 1. Atualiza valor_pago e status na venda
      const { error: updateError } = await supabase
        .from('vendas_atacado')
        .update({
          valor_pago: novoValorPago,
          status_pagamento: novoStatus,
          pago: novoStatus === 'pago',
          updated_at: new Date().toISOString(),
        })
        .eq('id', vendaId);

      if (updateError) throw updateError;

      // 2. Registra o pagamento no histórico
      const { error: insertError } = await supabase
        .from('vendas_atacado_pagamentos')
        .insert({
          venda_id: vendaId,
          valor: valorNovoPagamento,
          forma_pagamento: formaPagamento || null,
          observacao: observacao || null,
        });

      if (insertError) throw insertError;

      return { novoValorPago, novoStatus };
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: [CACHE_KEYS.VENDA_ATACADO_DETALHES || 'VENDA_ATACADO_DETALHES', variables.vendaId],
      });
      queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.VENDAS_ATACADO || 'VENDAS_ATACADO'] });
    },
  });
};
