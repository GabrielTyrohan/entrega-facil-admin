import { useQueryClient, useMutation } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useSupabaseQuery, CACHE_KEYS } from '../lib/supabaseCache';
import { handleSupabaseError } from '@/utils/supabaseErrorHandler';

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

  return useSupabaseQuery('ENTREGAS', query, [CACHE_KEYS.ENTREGAS, options?.administrador_id, { status: options?.status, vendedor_id: options?.vendedor_id, data_inicio: options?.data_inicio, data_fim: options?.data_fim }], {
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

  return useSupabaseQuery('ENTREGAS', query, [CACHE_KEYS.ENTREGAS, id], {
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

  return useSupabaseQuery('ENTREGAS', query, [CACHE_KEYS.ENTREGAS, vendedor_id, { status: options?.status, limit: options?.limit }], {
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

  return useSupabaseQuery('ENTREGAS', query, [CACHE_KEYS.ENTREGAS, 'cliente', cliente_id, { limit: options?.limit }], {
    enabled: options?.enabled && !!cliente_id,
  });
};

// Hook para criar entrega
export const useCreateEntrega = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (entrega: Omit<Entrega, 'id'>) => {
      const { data, error } = await supabase
        .from('entregas')
        .insert(entrega)
        .select()
        .single();
      
      if (error) {
        throw new Error(handleSupabaseError(error));
      }
      
      return data as Entrega;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.ENTREGAS] });
      queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.CLIENTES] });
      queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.VENDEDORES] });
      queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.PAGAMENTOS] });
    }
  });
};

// Hook para atualizar entrega
export const useUpdateEntrega = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Entrega> & { id: string }) => {
      const { data, error } = await supabase
        .from('entregas')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) {
        throw new Error(handleSupabaseError(error));
      }
      
      return data as Entrega;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.ENTREGAS] });
      queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.CLIENTES] });
      queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.VENDEDORES] });
      queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.PAGAMENTOS] });
    }
  });
};

// Hook para deletar entrega
export const useDeleteEntrega = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      const { error } = await supabase
        .from('entregas')
        .delete()
        .eq('id', id);
      
      if (error) {
        throw new Error(handleSupabaseError(error));
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.ENTREGAS] });
      queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.PAGAMENTOS] });
      queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.CESTAS] });
    }
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

  return useSupabaseQuery('ENTREGAS', query, [CACHE_KEYS.ENTREGAS, 'stats', vendedor_id], {
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

  return useSupabaseQuery('ENTREGAS', query, [CACHE_KEYS.ENTREGAS, 'paginated', page, limit, options], {
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
