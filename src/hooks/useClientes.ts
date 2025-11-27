import { useQueryClient, useMutation } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useSupabaseQuery, CACHE_KEYS } from '../lib/supabaseCache';
import { handleSupabaseError } from '@/utils/supabaseErrorHandler';

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
}

// Hook para listar todos os clientes
export const useClientes = (options?: {
  enabled?: boolean;
  ativo?: boolean;
  search?: string;
}) => {
  let query = supabase
    .from('clientes')
    .select('*')
    .order('nome');

  // Filtros opcionais
  if (options?.ativo !== undefined) {
    query = query.eq('ativo', options.ativo);
  }

  if (options?.search) {
    const orFilter = `nome.ilike.%${options.search}%,email.ilike.%${options.search}%,telefone.ilike.%${options.search}%`;
    query = query.or(orFilter);
  }

  return useSupabaseQuery('CLIENTES', query, {
    enabled: options?.enabled,
  });
};

// Hook para listar clientes do administrador logado
export const useClientesByAdmin = (administradorId: string, options?: {
  enabled?: boolean;
  ativo?: boolean;
  search?: string;
}) => {
  let query = supabase
    .from('clientes')
    .select(`
      *,
      vendedores!inner(
        id,
        nome,
        administrador_id
      )
    `)
    .eq('vendedores.administrador_id', administradorId)
    .order('nome');

  // Filtros opcionais
  if (options?.ativo !== undefined) {
    query = query.eq('ativo', options.ativo);
  }

  if (options?.search) {
    // SOLUÇÃO: Usar apenas filtros da tabela principal (clientes)
    // Todas as colunas (nome, email, telefone) são da tabela clientes
    const orFilter = `nome.ilike.%${options.search}%,email.ilike.%${options.search}%,telefone.ilike.%${options.search}%`;
    query = query.or(orFilter);
  }

  return useSupabaseQuery('CLIENTES', query, {
    enabled: options?.enabled && !!administradorId,
  });
};

// Hook para buscar cliente por ID
export const useCliente = (id: string, options?: { enabled?: boolean }) => {
  const query = supabase
    .from('clientes')
    .select('*')
    .eq('id', id)
    .single();

  return useSupabaseQuery('CLIENTES', query, {
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

  return useSupabaseQuery('CLIENTES', query, {
    enabled: options?.enabled && !!cidade,
  });
};

// Hook para criar cliente
export const useCreateCliente = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (cliente: Omit<Cliente, 'id'>) => {
      const { data, error } = await supabase
        .from('clientes')
        .insert(cliente)
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
    }
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
    }
  });
};

// Hook para buscar cidades únicas
export const useCidadesClientes = (options?: { enabled?: boolean }) => {
  const query = supabase
    .from('clientes')
    .select('cidade')
    .eq('ativo', true);

  return useSupabaseQuery('CLIENTES', query, {
    enabled: options?.enabled,
  });
};

// Hook para estatísticas de clientes
export const useEstatisticasClientes = (options?: { enabled?: boolean }) => {
  const query = supabase
    .from('clientes')
    .select('id, ativo, cidade, created_at');

  return useSupabaseQuery('CLIENTES', query, {
    enabled: options?.enabled,
  });
};

// Hook para buscar clientes com paginação
export const useClientesPaginados = (
  page: number = 1,
  limit: number = 10,
  options?: {
    enabled?: boolean;
    ativo?: boolean;
    search?: string;
    administrador_id?: string;
  }
) => {
  const offset = (page - 1) * limit;
  
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
    .range(offset, offset + limit - 1);

  // Filtros opcionais
  if (options?.ativo !== undefined) {
    query = query.eq('ativo', options.ativo);
  }

  // SEMPRE filtrar por administrador_id através do vendedor se fornecido
  if (options?.administrador_id) {
    query = query.eq('vendedores.administrador_id', options.administrador_id);
  }

  if (options?.search) {
    // SOLUÇÃO: Usar apenas filtros da tabela principal (clientes)
    // Todas as colunas (nome, email, telefone) são da tabela clientes
    const orFilter = `nome.ilike.%${options.search}%,email.ilike.%${options.search}%,telefone.ilike.%${options.search}%`;
    query = query.or(orFilter);
  }

  return useSupabaseQuery('CLIENTES', query, {
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
      staleTime: 5 * 60 * 1000, // 5 minutos
    });
  };
};

// Aliases para compatibilidade com nomes usados nas páginas
export const useClientesByCity = useClientesPorCidade;
export const useClienteCities = useCidadesClientes;
