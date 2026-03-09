// ============================================
// ARQUIVO: src/hooks/useClientes.ts
// Hook otimizado usando adminId unificado e RLS
// Mantendo compatibilidade com hooks legados
// ============================================

import { useAuth } from '@/contexts/AuthContext';
import { PAGINATION } from '@/lib/constants/pagination';
import { CACHE_KEYS, CACHE_TIMES, QUERY_KEYS } from '@/lib/constants/queryKeys';
import { supabase } from '@/lib/supabase';
import { useSupabaseQuery } from '@/lib/supabaseCache';
import { handleSupabaseError } from '@/utils/supabaseErrorHandler';
import { toast } from '@/utils/toast';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

// Interface Unificada (Mantendo campos legados para compatibilidade)
export interface Cliente {
  id: string;
  vendedor_id: string;
  nome: string;
  sobrenome?: string;
  cpf: string;
  rg?: string;
  data_nascimento?: string;
  sexo?: string;
  estado_civil?: string;
  nacionalidade?: string;
  nome_pai?: string;
  nome_mae?: string;
  telefone: string;
  email?: string;
  endereco: string;
  numero?: string;
  bairro?: string;
  cidade?: string;
  estado?: string;
  Bairro?: string;
  Cidade?: string;
  Estado?: string;
  cep?: string;
  complemento?: string;
  nome_conjuge?: string;
  renda_mensal?: number;
  ponto_referencia?: string;
  menor_idade?: boolean;
  ativo: boolean;
  sincronizado?: boolean;
  created_at: string;
  updated_at: string;
  // Novos campos
  vendedor?: {
    id: string;
    nome: string;
  };
  tipo_pessoa?: 'PF' | 'PJ';
  razao_social?: string;
  nome_fantasia?: string;
  cnpj?: string;
  inscricao_estadual?: string;
  inscricao_municipal?: string;
  responsavel_pj_nome?: string;
  responsavel_pj_cpf?: string;
  responsavel_pj_cargo?: string;
  responsavel_pj_telefone?: string;
}

// Interface de retorno legado (para manter compatibilidade)
export interface UseClientesReturn {
  data: any[];
  isLoading: boolean;
  error: Error | null;
  count?: number | null;
  totalCount: number;
  totalPages: number;
  currentPage: number;
  refetch: () => void;
}

// ===== NOVO HOOK OTIMIZADO (Principal) =====
export const useClientes = (
  vendedorId?: string,
  page: number = 0,
  search: string = ''
) => {
  const { adminId } = useAuth();

  return useQuery({
    queryKey: [QUERY_KEYS.CLIENTES, { adminId, vendedorId, page, search }],
    queryFn: async () => {
      const { from, to } = PAGINATION.calculateRange(page, 15);

      let query = supabase
        .from('clientes')
        .select(`
          *,
          vendedor:vendedores!inner(id, nome, administrador_id)
        `, { count: 'exact' })
        .eq('vendedor.administrador_id', adminId)
        .range(from, to)
        .order('created_at', { ascending: false });

      // Filtro ADICIONAL por vendedor (opcional)
      if (vendedorId) {
        query = query.eq('vendedor_id', vendedorId);
      }

      // Busca por nome, telefone ou CPF (com suporte a PJ)
      if (search) {
        // Query para PF: busca em nome, sobrenome, telefone, cpf
        const pfFilter = `and(tipo_pessoa.eq.PF,or(nome.ilike.%${search}%,sobrenome.ilike.%${search}%,telefone.ilike.%${search}%,cpf.ilike.%${search}%))`;
        
        // Query para PJ: busca em responsavel_pj_nome, telefone, cpf
        const pjFilter = `and(tipo_pessoa.eq.PJ,or(responsavel_pj_nome.ilike.%${search}%,telefone.ilike.%${search}%,cpf.ilike.%${search}%))`;
        
        query = query.or(`${pfFilter},${pjFilter}`);
      }

      const { data, error, count } = await query;
      if (error) throw error;

      return {
        clientes: (data || []) as Cliente[],
        total: count || 0,
        totalPages: PAGINATION.calculateTotalPages(count || 0, 15),
      };
    },
    enabled: !!adminId,
    staleTime: 5 * 60 * 1000,
    placeholderData: (previousData) => previousData,
  });
};

// ===== CRIAR CLIENTE (Otimizado com Toast) =====
export const useCreateCliente = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (novoCliente: Partial<Cliente>) => {
      const { data, error } = await supabase
        .from('clientes')
        .insert(novoCliente)
        .select()
        .single();

      if (error) throw error;
      return data as Cliente;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.CLIENTES] });
      // Invalidações extras legadas para garantir consistência
      queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.ENTREGAS] });
      queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.PAGAMENTOS] });
      
      toast.success('Cliente criado com sucesso!');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Erro ao criar cliente');
    },
  });
};

// ============================================
// LEGACY HOOKS (Preservados para compatibilidade)
// ============================================

// Hook legado renomeado (era useClientes)
export const useClientesLegacy = (options?: {
  enabled?: boolean;
  ativo?: boolean;
  search?: string;
  page?: number;
  pageSize?: number;
}): UseClientesReturn => {
  const page = options?.page || 0;
  const pageSize = options?.pageSize || 50;
  const from = page * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from('clientes')
    .select('id, nome, telefone, endereco, ativo, created_at', { count: 'exact' })
    .order('nome')
    .range(from, to);

  // Filtros opcionais
  if (options?.ativo !== undefined) {
    query = query.eq('ativo', options.ativo);
  }

  if (options?.search) {
    const orFilter = `nome.ilike.%${options.search}%,email.ilike.%${options.search}%,telefone.ilike.%${options.search}%`;
    query = query.or(orFilter);
  }

  const queryResult = useSupabaseQuery('CLIENTES', query, [
    CACHE_KEYS.CLIENTES, 
    'list', 
    { 
      ativo: options?.ativo, 
      search: options?.search,
      page,
      pageSize
    }
  ], {
    enabled: options?.enabled,
  });

  const totalCount = queryResult.count || 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  return {
    data: queryResult.data ?? [],
    isLoading: queryResult.isLoading,
    error: queryResult.error,
    totalCount,
    totalPages,
    currentPage: page,
    refetch: queryResult.refetch,
  };
};

// Hook para listar clientes do administrador logado (MANTIDO INTACTO)
export const useClientesByAdmin = (administradorId: string, options?: {
  enabled?: boolean;
  ativo?: boolean;
  search?: string;
  vendedor_id?: string;
  page?: number;
  pageSize?: number;
}) => {
  const page = options?.page || 0;
  const pageSize = options?.pageSize || 50;
  const from = page * pageSize;
  const to = from + pageSize - 1;

  const queryFn = async () => {
    // 1. Buscar IDs dos vendedores do admin
    const { data: vendedores, error: vendedoresError } = await supabase
      .from('vendedores')
      .select('id')
      .eq('administrador_id', administradorId);
    
    if (vendedoresError) throw vendedoresError;
    
    const vendedorIds = vendedores?.map(v => v.id) || [];
    
    // Se não tiver vendedores, retornar lista vazia
    if (vendedorIds.length === 0) {
      return { data: [], count: 0 };
    }

    // 2. Construir query de clientes
    let query = supabase
      .from('clientes')
      .select('id, nome, sobrenome, telefone, endereco, ativo, created_at, vendedor_id, cpf, rg, data_nascimento, sexo, estado_civil, nacionalidade, nome_pai, nome_mae, nome_conjuge, menor_idade, updated_at, email, tipo_pessoa, responsavel_pj_nome, responsavel_pj_cpf, razao_social, nome_fantasia, cnpj, inscricao_estadual, inscricao_municipal, responsavel_pj_cargo, responsavel_pj_telefone, Bairro, Cidade, Estado, numero, complemento, cep, renda_mensal, ponto_referencia, sincronizado', { count: 'exact' })
      .in('vendedor_id', vendedorIds)
      .order('nome')
      .range(from, to);

    // Filtros opcionais
    if (options?.ativo !== undefined) {
      query = query.eq('ativo', options.ativo);
    }

    if (options?.vendedor_id) {
      query = query.eq('vendedor_id', options.vendedor_id);
    }

    if (options?.search) {
      // Lógica unificada para busca
      const search = options.search;
      // Query para PF: busca em nome, sobrenome, telefone, cpf, email
      const pfFilter = `and(tipo_pessoa.eq.PF,or(nome.ilike.%${search}%,sobrenome.ilike.%${search}%,telefone.ilike.%${search}%,cpf.ilike.%${search}%,email.ilike.%${search}%))`;
      
      // Query para PJ: busca em responsavel_pj_nome, telefone, cpf, email, razao_social, nome_fantasia, cnpj
      const pjFilter = `and(tipo_pessoa.eq.PJ,or(responsavel_pj_nome.ilike.%${search}%,telefone.ilike.%${search}%,cpf.ilike.%${search}%,email.ilike.%${search}%,razao_social.ilike.%${search}%,nome_fantasia.ilike.%${search}%,cnpj.ilike.%${search}%))`;
      
      query = query.or(`${pfFilter},${pjFilter}`);
    }

    const { data, error, count } = await query;
    if (error) throw error;
    
    return { data, count };
  };

  const queryResult = useQuery({
    queryKey: [
      CACHE_KEYS.CLIENTES, 
      administradorId, 
      'v2_with_sobrenome',
      { 
        ativo: options?.ativo, 
        search: options?.search,
        vendedor_id: options?.vendedor_id,
        page,
        pageSize
      }
    ],
    queryFn,
    enabled: options?.enabled && !!administradorId,
    staleTime: CACHE_TIMES.CLIENTES ? CACHE_TIMES.CLIENTES.staleTime : 5 * 60 * 1000,
  });

  const totalCount = queryResult.data?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  return {
    data: queryResult.data?.data ?? [],
    isLoading: queryResult.isLoading,
    error: queryResult.error as Error | null,
    count: queryResult.data?.count,
    totalCount,
    totalPages,
    currentPage: page,
    refetch: queryResult.refetch,
  };
};

// Hook para buscar cliente por ID
export const useCliente = (id: string, options?: { enabled?: boolean }) => {
  const query = supabase
    .from('clientes')
    .select('*')
    .eq('id', id)
    .single();

  return useSupabaseQuery('CLIENTES', query, [CACHE_KEYS.CLIENTES, id], {
    enabled: options?.enabled && !!id,
  });
};

// Hook para buscar clientes por cidade
export const useClientesPorCidade = (cidade: string, options?: { enabled?: boolean }) => {
  const query = supabase
    .from('clientes')
    .select('*')
    .eq('cidade', cidade)
    .eq('ativo', true)
    .order('nome');

  return useSupabaseQuery('CLIENTES', query, [CACHE_KEYS.CLIENTES, 'cidade', cidade], {
    enabled: options?.enabled && !!cidade,
  });
};

// Hook para atualizar cliente
export const useUpdateCliente = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Cliente> & { id: string }) => {
      const { data, error } = await supabase
        .from('clientes')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) {
        throw new Error(handleSupabaseError(error));
      }
      
      return data as Cliente;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.CLIENTES] });
      queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.ENTREGAS] });
      queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.PAGAMENTOS] });
      toast.success('Cliente atualizado com sucesso!');
    },
    onError: (error: any) => {
        toast.error(error.message || 'Erro ao atualizar cliente');
    }
  });
};

// Hook para deletar cliente
export const useDeleteCliente = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      const { error } = await supabase
        .from('clientes')
        .delete()
        .eq('id', id);
      
      if (error) {
        throw new Error(handleSupabaseError(error));
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.CLIENTES] });
      queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.ENTREGAS] });
      queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.CESTAS] });
      toast.success('Cliente excluído com sucesso!');
    },
    onError: (error: any) => {
        toast.error(error.message || 'Erro ao excluir cliente');
    }
  });
};

// Hook para buscar cidades únicas
export const useCidadesClientes = (options?: { enabled?: boolean }) => {
  const { adminId } = useAuth();
  const query = supabase
    .from('clientes')
    .select('cidade')
    .eq('ativo', true);

  return useSupabaseQuery('CLIENTES', query, [CACHE_KEYS.CLIENTES, 'cidades'], {
    enabled: options?.enabled && !!adminId,
  });
};

// Hook para estatísticas de clientes
export const useEstatisticasClientes = (options?: { enabled?: boolean }) => {
  const { adminId } = useAuth();
  const query = supabase
    .from('clientes')
    .select('id, ativo, cidade, created_at');

  return useSupabaseQuery('CLIENTES', query, [CACHE_KEYS.CLIENTES, 'stats'], {
    enabled: options?.enabled && !!adminId,
  });
};

// Hook para buscar clientes com paginação
export const useClientesPaginados = (
  page: number = 1,
  limit: number = PAGINATION.BACKEND_PAGE_SIZE,
  options?: {
    enabled?: boolean;
    ativo?: boolean;
    search?: string;
    administrador_id?: string;
  }
) => {
  const { from, to } = PAGINATION.calculateRange(page - 1, limit);
  
  let query = supabase
    .from('clientes')
    .select(`
      *,
      vendedores!inner(
        id,
        nome,
        administrador_id
      )
    `, { count: 'exact' })
    .order('nome')
    .range(from, to);

  if (options?.ativo !== undefined) {
    query = query.eq('ativo', options.ativo);
  }

  if (options?.administrador_id) {
    query = query.eq('vendedores.administrador_id', options.administrador_id);
  }

  if (options?.search) {
    const orFilter = `nome.ilike.%${options.search}%,email.ilike.%${options.search}%,telefone.ilike.%${options.search}%`;
    query = query.or(orFilter);
  }

  return useSupabaseQuery('CLIENTES', query, [CACHE_KEYS.CLIENTES, 'paginated', page, limit, options], {
    enabled: options?.enabled && !!options?.administrador_id,
  });
};

// Função utilitária para invalidar cache de clientes
export const useInvalidateClientes = () => {
  const queryClient = useQueryClient();
  
  return () => {
    queryClient.invalidateQueries({
      queryKey: [CACHE_KEYS.CLIENTES],
    });
  };
};

// Função utilitária para pré-carregar cliente
export const usePrefetchCliente = () => {
  const queryClient = useQueryClient();
  
  return (id: string) => {
    queryClient.prefetchQuery({
      queryKey: [CACHE_KEYS.CLIENTES, id],
      queryFn: () => 
        supabase
          .from('clientes')
          .select('*')
          .eq('id', id)
          .single()
          .then(({ data }) => data),
      staleTime: 5 * 60 * 1000,
    });
  };
};

// Aliases
export const useClientesByCity = useClientesPorCidade;
export const useClienteCities = useCidadesClientes;
