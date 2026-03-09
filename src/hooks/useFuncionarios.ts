import { CACHE_KEYS } from '@/lib/constants/queryKeys';
import { supabase } from '@/lib/supabase';
import { useSupabaseQuery } from '@/lib/supabaseCache';
import { useMutation, useQueryClient } from '@tanstack/react-query';

export interface Funcionario {
  id: string;
  administrador_id: string;
  auth_user_id?: string;
  nome: string;
  email: string;
  telefone?: string;
  cargo?: string;
  permissoes: {
    orcamentos_pj: boolean;
    vendas_atacado: boolean;
    notas_fiscais: boolean;
    caixa: boolean;
    acertos: boolean;
    relatorios: boolean;
    [key: string]: boolean;
  };
  ativo: boolean;
  created_at: string;
}

export const useFuncionarios = (adminId?: string) => {
  let query = supabase
    .from('funcionarios')
    .select('*')
    .eq('administrador_id', adminId)
    .order('nome');

  return useSupabaseQuery(
    'FUNCIONARIOS',
    query,
    [CACHE_KEYS.FUNCIONARIOS, { adminId }],
    { enabled: !!adminId }
  );
};

export const useCreateFuncionario = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: any) => {
      // Usa um cliente separado (sem persistir sessão) para não derrubar a sessão do admin
      const { createClient } = await import('@supabase/supabase-js');
      const tempClient = createClient(
        import.meta.env.VITE_SUPABASE_URL,
        import.meta.env.VITE_SUPABASE_ANON_KEY,
        { auth: { persistSession: false, autoRefreshToken: false } }
      );

      // 1. Cria o usuário no Supabase Auth
      const { data: authData, error: authError } = await tempClient.auth.signUp({
        email: data.email,
        password: data.senha,
        options: {
          data: { nome: data.nome, role: 'funcionario' }
        }
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error('Falha ao criar usuário de autenticação');

      // 2. Insere na tabela funcionarios vinculado ao auth_user_id
      const { error: dbError } = await supabase
        .from('funcionarios')
        .insert({
          administrador_id: data.administrador_id,
          auth_user_id: authData.user.id,
          nome: data.nome,
          email: data.email,
          telefone: data.telefone || null,
          cargo: data.cargo || null,
          permissoes: data.permissoes,
          ativo: true,
          nome_empresa: data.nome_empresa || null
        });

      if (dbError) throw dbError;

      return { success: true, email: data.email };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.FUNCIONARIOS] });
    }
  });
};

export const useResetFuncionarioPassword = () => {
  return useMutation({
    mutationFn: async ({ id, senha }: { id: string; senha: string }) => {
      const { data, error } = await supabase.rpc('redefinir_senha_funcionario', {
        p_funcionario_id: id,
        p_nova_senha: senha
      });
      
      if (error) throw error;
      return data;
    }
  });
};

export const useUpdateFuncionario = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<Funcionario> & { id: string }) => {
      const { data: result, error } = await supabase
        .from('funcionarios')
        .update(data)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.FUNCIONARIOS] });
    }
  });
};

export const useToggleFuncionarioStatus = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { data, error } = await supabase
        .from('funcionarios')
        .update({ ativo })
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.FUNCIONARIOS] });
    }
  });
};
