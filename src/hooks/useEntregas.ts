import { useAuth } from '@/contexts/AuthContext';
import { PAGINATION } from '@/lib/constants/pagination';
import { handleSupabaseError } from '@/utils/supabaseErrorHandler';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { CACHE_KEYS, CACHE_TIMES, useSupabaseQuery } from '../lib/supabaseCache';


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
  cliente_nome?: string;
  cliente_endereco?: string;
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


export interface UseEntregasReturn {
  data: any[];
  isLoading: boolean;
  error: Error | null;
  count?: number | null;
  totalCount: number;
  totalPages: number;
  currentPage: number;
  refetch: () => void;
}


export const useEntregas = (options?: {
  enabled?: boolean;
  status?: string;
  vendedor_id?: string;
  data_inicio?: string;
  data_fim?: string;
  administrador_id?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}): UseEntregasReturn => {
  const { adminId } = useAuth();
  const targetAdminId = options?.administrador_id || adminId;
  const page = options?.page || 0;
  const pageSize = options?.pageSize || 50;
  const from = page * pageSize;
  const to = from + pageSize - 1;

  const queryFn = async () => {
    let vendedorIds: string[] = [];

    if (targetAdminId) {
      const { data: vendedores, error: vErr } = await supabase
        .from('vendedores')
        .select('id')
        .eq('administrador_id', targetAdminId);

      if (vErr) throw vErr;
      vendedorIds = vendedores?.map(v => v.id) || [];

      if (vendedorIds.length === 0) {
        return { data: [], count: 0 };
      }
    }

    let query = supabase
      .from('entregas')
      .select(`
        id, data_entrega, cliente_id, vendedor_id, valor, status_entrega, status_pagamento,
        cliente:clientes(id, nome, sobrenome, telefone, endereco, numero, "Bairro", "Cidade", "Estado", cep, complemento, cpf),
        vendedor:vendedores(id, nome, administrador_id)
      `, { count: 'exact' })
      .order('data_entrega', { ascending: false })
      .range(from, to);

    if (targetAdminId) {
      query = query.in('vendedor_id', vendedorIds);
    }

    if (options?.status) {
      query = query.or(`status_entrega.eq.${options.status},status_pagamento.eq.${options.status}`);
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

    if (options?.search) {
      const search = options.search;
      if (/^[0-9a-f]{8}-/i.test(search)) {
        query = query.eq('id', search);
      } else {
        query = query.or(`status_entrega.ilike.%${search}%,status_pagamento.ilike.%${search}%`);
      }
    }

    const { data, error, count } = await query;
    if (error) throw error;

    return { data: data || [], count };
  };

  const queryResult = useQuery({
    queryKey: [
      CACHE_KEYS.ENTREGAS,
      targetAdminId,
      {
        status: options?.status,
        vendedor_id: options?.vendedor_id,
        data_inicio: options?.data_inicio,
        data_fim: options?.data_fim,
        search: options?.search,
        page,
        pageSize
      }
    ],
    queryFn,
    enabled: options?.enabled,
    staleTime: CACHE_TIMES.ENTREGAS ? CACHE_TIMES.ENTREGAS.staleTime : 5 * 60 * 1000,
  });

  const totalCount = queryResult.data?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  return {
    data: queryResult.data?.data ?? [],
    isLoading: queryResult.isLoading,
    error: queryResult.error as Error | null,
    totalCount,
    totalPages,
    currentPage: page,
    refetch: queryResult.refetch,
  };
};


export const useEntrega = (id: string, options?: { enabled?: boolean }) => {
  const queryFn = async () => {
    const { data, error } = await supabase
      .from('entregas')
      .select(`
        *,
        cliente:clientes(id, nome, telefone, endereco, numero, "Bairro", "Cidade", "Estado", cep, complemento, cpf),
        vendedor:vendedores(id, nome),
        itens:itens_entrega(
          id,
          quantidade,
          preco_unitario,
          produto:produtos_cadastrado(id, nome:produto_nome)
        )
      `)
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  };

  return useQuery({
    queryKey: [CACHE_KEYS.ENTREGAS, id],
    queryFn,
    enabled: options?.enabled && !!id,
    staleTime: CACHE_TIMES.ENTREGAS?.staleTime || 5 * 60 * 1000,
  });
};


export const useEntregasPorVendedor = (
  vendedor_id: string,
  options?: {
    enabled?: boolean;
    status?: string;
    limit?: number;
  }
) => {
  const queryFn = async () => {
    let query = supabase
      .from('entregas')
      .select(`
        *,
        cliente:clientes(id, nome, telefone, endereco, numero, "Bairro", "Cidade", "Estado", cep, complemento)
      `)
      .eq('vendedor_id', vendedor_id)
      .order('data_entrega', { ascending: false });

    if (options?.status) {
      query = query.or(`status_entrega.eq.${options.status},status_pagamento.eq.${options.status}`);
    }

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
  };

  return useQuery({
    queryKey: [CACHE_KEYS.ENTREGAS, vendedor_id, { status: options?.status, limit: options?.limit }],
    queryFn,
    enabled: options?.enabled && !!vendedor_id,
    staleTime: CACHE_TIMES.ENTREGAS?.staleTime || 5 * 60 * 1000,
  });
};


export const useEntregasPorCliente = (
  cliente_id: string,
  options?: { enabled?: boolean; limit?: number }
) => {
  const queryFn = async () => {
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

    const { data, error } = await query;
    if (error) throw error;
    return data;
  };

  return useQuery({
    queryKey: [CACHE_KEYS.ENTREGAS, 'cliente', cliente_id, { limit: options?.limit }],
    queryFn,
    enabled: options?.enabled && !!cliente_id,
    staleTime: CACHE_TIMES.ENTREGAS?.staleTime || 5 * 60 * 1000,
  });
};


export const useCreateEntrega = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (entrega: Omit<Entrega, 'id'>) => {
      const { data, error } = await supabase
        .from('entregas')
        .insert(entrega)
        .select()
        .single();

      if (error) throw new Error(handleSupabaseError(error));

      return data as Entrega;
    },
    // ✅ CORRIGIDO — 6 invalidações agrupadas em Promise.all
    onSuccess: () => {
      Promise.all([
        queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.ENTREGAS] }),
        queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.CLIENTES] }),
        queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.VENDEDORES] }),
        queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.PAGAMENTOS] }),
        queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.MOVIMENTACOES_ESTOQUE] }),
        queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.PRODUTOS] }),
      ]);
    }
  });
};


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

      if (error) throw new Error(handleSupabaseError(error));

      return data as Entrega;
    },
    // ✅ CORRIGIDO — 4 invalidações agrupadas em Promise.all
    onSuccess: () => {
      Promise.all([
        queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.ENTREGAS] }),
        queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.CLIENTES] }),
        queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.VENDEDORES] }),
        queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.PAGAMENTOS] }),
      ]);
    }
  });
};


export const useDeleteEntrega = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      const { error } = await supabase
        .from('entregas')
        .delete()
        .eq('id', id);

      if (error) throw new Error(handleSupabaseError(error));
    },
    // ✅ CORRIGIDO — 3 invalidações agrupadas em Promise.all
    onSuccess: () => {
      Promise.all([
        queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.ENTREGAS] }),
        queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.PAGAMENTOS] }),
        queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.CESTAS] }),
      ]);
    }
  });
};


export const useEstatisticasEntregas = (
  vendedor_id?: string,
  options?: { enabled?: boolean }
) => {
  const { adminId } = useAuth();
  let query = supabase
    .from('entregas')
    .select('id, status, valor, data_entrega');

  if (vendedor_id) {
    query = query.eq('vendedor_id', vendedor_id);
  }

  return useSupabaseQuery('ENTREGAS', query, [CACHE_KEYS.ENTREGAS, 'stats', vendedor_id], {
    enabled: options?.enabled && !!adminId,
  });
};


export const useEntregasPaginadas = (
  page: number = 1,
  limit: number = PAGINATION.BACKEND_PAGE_SIZE,
  options?: {
    enabled?: boolean;
    status?: string;
    vendedor_id?: string;
    search?: string;
    administrador_id?: string;
  }
) => {
  const { from, to } = PAGINATION.calculateRange(page - 1, limit);

  const queryFn = async () => {
    let vendedorIds: string[] = [];

    if (options?.administrador_id) {
      const { data: vendedores, error: vErr } = await supabase
        .from('vendedores')
        .select('id')
        .eq('administrador_id', options.administrador_id);

      if (vErr) throw vErr;
      vendedorIds = vendedores?.map(v => v.id) || [];

      if (vendedorIds.length === 0) {
        return { data: [], count: 0 };
      }
    }

    let query = supabase
      .from('entregas')
      .select(`
        id,
        data_entrega,
        status_entrega,
        status_pagamento,
        valor,
        cliente_id,
        vendedor_id,
        created_at,
        updated_at,
        cliente:clientes(id, nome, telefone, endereco, numero, "Bairro", "Cidade", "Estado", cep, complemento),
        vendedor:vendedores(id, nome, administrador_id),
        itens:itens_entrega(
          produto:produtos_cadastrado(id, nome:produto_nome)
        )
      `, { count: 'exact' })
      .order('data_entrega', { ascending: false })
      .range(from, to);

    if (options?.administrador_id) {
      query = query.in('vendedor_id', vendedorIds);
    }

    if (options?.status) {
      query = query.or(`status_entrega.eq.${options.status},status_pagamento.eq.${options.status}`);
    }

    if (options?.vendedor_id) {
      query = query.eq('vendedor_id', options.vendedor_id);
    }

    if (options?.search) {
      query = query.ilike('id', `%${options.search}%`);
    }

    const { data, error, count } = await query;
    if (error) throw error;

    const formattedData = data?.map(item => ({
      ...item,
      produto: item.itens?.[0]?.produto || null
    })) || [];

    return { data: formattedData, count };
  };

  const result = useQuery({
    queryKey: [CACHE_KEYS.ENTREGAS, 'paginated', page, limit, options],
    queryFn,
    enabled: options?.enabled && !!options?.administrador_id,
  });

  return {
    ...result,
    data: result.data?.data ?? [],
    count: result.data?.count ?? 0,
  } as any;
};


export const useInvalidateEntregas = () => {
  const queryClient = useQueryClient();

  return () => {
    queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.ENTREGAS] });
  };
};


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
            itens:itens_entrega(
              id,
              quantidade,
              preco_unitario,
              produto:produtos_cadastrado(id, nome:produto_nome)
            )
          `)
          .eq('id', id)
          .single()
          .then(({ data }) => data),
      staleTime: 2 * 60 * 1000,
    });
  };
};


export const useEntregasByVendedorData = (
  vendedor_id: string,
  data: string,
  options?: { enabled?: boolean }
) => {
  const queryFn = async () => {
    const dataInicio = `${data}T00:00:00-03:00`;
    const dataFim = `${data}T23:59:59-03:00`;

    const { data: entregas, error } = await supabase
      .from('entregas')
      .select(`
        id,
        valor,
        status_pagamento,
        data_entrega,
        cliente:clientes(id, nome, sobrenome)
      `)
      .eq('vendedor_id', vendedor_id)
      .gte('data_entrega', dataInicio)
      .lte('data_entrega', dataFim)
      .order('data_entrega', { ascending: true });

    if (error) throw error;
    return entregas || [];
  };

  return useQuery({
    queryKey: [CACHE_KEYS.ENTREGAS, 'by-vendedor-data', vendedor_id, data],
    queryFn,
    enabled: (options?.enabled ?? true) && !!vendedor_id && !!data,
    staleTime: CACHE_TIMES.ENTREGAS?.staleTime || 5 * 60 * 1000,
  });
};