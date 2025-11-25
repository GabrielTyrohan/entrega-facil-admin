import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useSupabaseQuery, useSupabaseMutation, CACHE_KEYS } from '../lib/supabaseCache';

export interface Entrega {
  id: string;
  cliente_id: string;
  vendedor_id: string;
  produto_id: string;
  data_entrega: string;
  valor: number;
  pago: boolean;
  sincronizado: boolean;
  mes_cobranca?: string;
  status_pagamento: string;
  dataRetorno?: string;
  created_at: string;
  updated_at: string;
  // Propriedades adicionais do banco de dados
  cliente_nome?: string;
  cliente_endereco?: string;
  // Relacionamentos
  cliente?: {
    id: string;
    nome: string;
    sobrenome?: string;
    telefone?: string;
    endereco?: string;
    numero?: string;
    Bairro?: string;
    Cidade?: string;
    Estado?: string;
    bairro?: string;
    cidade?: string;
    estado?: string;
    cpf?: string;
    cep?: string;
    complemento?: string;
  };
  vendedor?: {
    id: string;
    nome: string;
  };
  produto?: {
    id: string;
    nome: string;
  };
}

export interface EntregaItem {
  id: string;
  entrega_id: string;
  produto_id: string;
  quantidade: number;
  preco_unitario: number;
  produto?: {
    id: string;
    nome: string;
  };
}

// Hook para listar todas as entregas
export const useEntregas = (options?: {
  enabled?: boolean;
  status?: string;
  vendedor_id?: string;
  data_inicio?: string;
  data_fim?: string;
  administrador_id?: string;
}) => {
  let query = supabase
    .from('entregas')
    .select(`
      *,
      cliente:clientes(id, nome, sobrenome, telefone, endereco, numero, "Bairro", "Cidade", "Estado", cep, complemento, cpf),
      vendedor:vendedores!inner(id, nome, administrador_id),
      produto:produtos(id, nome)
    `)
    .order('data_entrega', { ascending: false });

  // Filtro por administrador (obrigatório para segurança)
  if (options?.administrador_id) {
    query = query.eq('vendedor.administrador_id', options.administrador_id);
  }

  // Filtros opcionais
  if (options?.status) {
    query = query.eq('status', options.status);
  }
  
  if (options?.vendedor_id) {
    query = query.eq('vendedor_id', options.vendedor_id);
  }

  if (options?.data_inicio) {
    query = query.gte('data_entrega', options.data_inicio);
  }

  if (options?.data_fim) {
    query = query.lte('data_entrega', options.data_fim);
  }

  return useSupabaseQuery('ENTREGAS', query, {
    enabled: options?.enabled,
  });
};

// Hook para buscar entrega por ID com itens
export const useEntrega = (id: string, options?: { enabled?: boolean }) => {
  const query = supabase
    .from('entregas')
    .select(`
      *,
      cliente:clientes(id, nome, telefone, endereco, numero, "Bairro", "Cidade", "Estado", cep, complemento, cpf),
      vendedor:vendedores(id, nome),
      itens:entrega_itens(
        id,
        quantidade,
        preco_unitario,
        produto:produtos(id, nome)
      )
    `)
    .eq('id', id)
    .single();

  return useSupabaseQuery('ENTREGAS', query, {
    enabled: options?.enabled && !!id,
  });
};

// Hook para entregas por vendedor
export const useEntregasPorVendedor = (
  vendedor_id: string,
  options?: { 
    enabled?: boolean;
    status?: string;
    limit?: number;
  }
) => {
  let query = supabase
    .from('entregas')
    .select(`
      *,
      cliente:clientes(id, nome, telefone, endereco, numero, "Bairro", "Cidade", "Estado", cep, complemento)
    `)
    .eq('vendedor_id', vendedor_id)
    .order('data_entrega', { ascending: false });

  if (options?.status) {
    query = query.eq('status', options.status);
  }

  if (options?.limit) {
    query = query.limit(options.limit);
  }

  return useSupabaseQuery('ENTREGAS', query, {
    enabled: options?.enabled && !!vendedor_id,
  });
};

// Hook para entregas por cliente
export const useEntregasPorCliente = (
  cliente_id: string,
  options?: { enabled?: boolean; limit?: number }
) => {
  let query = supabase
    .from('entregas')
    .select(`
      *,
      vendedor:vendedores(id, nome)
    `)
    .eq('cliente_id', cliente_id)
    .order('data_entrega', { ascending: false });

  if (options?.limit) {
    query = query.limit(options.limit);
  }

  return useSupabaseQuery('ENTREGAS', query, {
    enabled: options?.enabled && !!cliente_id,
  });
};

// Hook para criar entrega
export const useCreateEntrega = (options?: {
  onSuccess?: (entrega: Entrega) => void;
  onError?: (error: any) => void;
}) => {
  return useSupabaseMutation('ENTREGAS', 'insert', {
    onSuccess: options?.onSuccess,
    onError: options?.onError,
    // Invalidar cache relacionado
    invalidateRelated: ['CLIENTES', 'VENDEDORES', 'PAGAMENTOS'],
  });
};

// Hook para atualizar entrega
export const useUpdateEntrega = (options?: {
  onSuccess?: (entrega: Entrega) => void;
  onError?: (error: any) => void;
}) => {
  return useSupabaseMutation('ENTREGAS', 'update', {
    onSuccess: options?.onSuccess,
    onError: options?.onError,
    // Invalidar cache relacionado
    invalidateRelated: ['CLIENTES', 'VENDEDORES', 'PAGAMENTOS'],
  });
};

// Hook para deletar entrega
export const useDeleteEntrega = (options?: {
  onSuccess?: () => void;
  onError?: (error: any) => void;
}) => {
  return useSupabaseMutation('ENTREGAS', 'delete', {
    onSuccess: options?.onSuccess,
    onError: options?.onError,
    // Invalidar cache relacionado
    invalidateRelated: ['PAGAMENTOS', 'CESTAS'],
    // Atualização otimista para remoção
    optimisticUpdate: {
      updateFn: (oldData: Entrega[], variables: { id: string }) => {
        return oldData.filter(entrega => entrega.id !== variables.id);
      },
      rollbackFn: (oldData: Entrega[]) => oldData, // Restaurar dados originais
    },
  });
};

// Hook para estatísticas de entregas
export const useEstatisticasEntregas = (
  vendedor_id?: string,
  options?: { enabled?: boolean }
) => {
  let query = supabase
    .from('entregas')
    .select('id, status, valor_total, data_entrega');

  if (vendedor_id) {
    query = query.eq('vendedor_id', vendedor_id);
  }

  return useSupabaseQuery('ENTREGAS', query, {
    enabled: options?.enabled,
  });
};

// Hook para entregas com paginação
export const useEntregasPaginadas = (
  page: number = 1,
  limit: number = 10,
  options?: {
    enabled?: boolean;
    status?: string;
    vendedor_id?: string;
    search?: string;
    administrador_id?: string;
  }
) => {
  const offset = (page - 1) * limit;
  
  let query = supabase
    .from('entregas')
    .select(`
      id,
      data_entrega,
      status,
      valor_total,
      observacoes,
      cliente_id,
      vendedor_id,
      created_at,
      updated_at,
      cliente:clientes(id, nome, telefone, endereco, numero, "Bairro", "Cidade", "Estado", cep, complemento),
      vendedor:vendedores!inner(id, nome, administrador_id)
    `, { count: 'exact' })
    .order('data_entrega', { ascending: false })
    .range(offset, offset + limit - 1);

  // Filtros opcionais
  if (options?.status) {
    query = query.eq('status', options.status);
  }
  
  if (options?.vendedor_id) {
    query = query.eq('vendedor_id', options.vendedor_id);
  }

  // SEMPRE filtrar por administrador_id através do vendedor se fornecido
  if (options?.administrador_id) {
    query = query.eq('vendedor.administrador_id', options.administrador_id);
  }

  if (options?.search) {
    // SOLUÇÃO: Usar apenas filtros da tabela principal para evitar erro 400
    // Buscar apenas por ID da entrega (coluna da tabela principal)
    query = query.ilike('id', `%${options.search}%`);
  }

  return useSupabaseQuery('ENTREGAS', query, {
    enabled: options?.enabled && !!options?.administrador_id,
  });
};

// Função utilitária para invalidar cache de entregas
export const useInvalidateEntregas = () => {
  const queryClient = useQueryClient();
  
  return () => {
    queryClient.invalidateQueries({
      queryKey: [CACHE_KEYS.ENTREGAS],
    });
  };
};

// Função utilitária para pré-carregar entrega
export const usePrefetchEntrega = () => {
  const queryClient = useQueryClient();
  
  return (id: string) => {
    queryClient.prefetchQuery({
      queryKey: [CACHE_KEYS.ENTREGAS, id],
      queryFn: () => 
        supabase
          .from('entregas')
          .select(`
            *,
            cliente:clientes(id, nome, telefone, endereco, numero, "Bairro", "Cidade", "Estado", cep, complemento),
            vendedor:vendedores(id, nome),
            itens:entrega_itens(
              id,
              quantidade,
              preco_unitario,
              produto:produtos(id, nome)
            )
          `)
          .eq('id', id)
          .single()
          .then(({ data }) => data),
      staleTime: 2 * 60 * 1000, // 2 minutos
    });
  };
};
