import { CACHE_KEYS } from '@/lib/constants/queryKeys';
import { supabase } from '@/lib/supabase';
import { useSupabaseQuery } from '@/lib/supabaseCache';
import {
  alterarStatusFuncionarioSeguro,
  atualizarFuncionarioSeguro,
  criarFuncionarioSeguro,
  redefinirSenhaFuncionarioSeguro,
  type CreateFuncionarioInput,
  type FuncionarioPermissions,
  type UpdateFuncionarioInput,
} from '@/services/funcionarioAdminService';
import { useMutation, useQueryClient } from '@tanstack/react-query';

export interface Funcionario {
  id: string;
  administrador_id: string;
  auth_user_id?: string;
  nome: string;
  email: string;
  telefone?: string;
  cargo?: string;
  permissoes: FuncionarioPermissions;
  ativo: boolean;
  created_at: string;
}

export const useFuncionarios = (adminId?: string) => {
  const query = supabase
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

// Criação via Edge Function `gerenciar-funcionario` (action=create).
// Não usa auth.signUp() nem INSERT direto — o backend deriva
// administrador_id/auth_user_id/nome_empresa e valida o admin.
export const useCreateFuncionario = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateFuncionarioInput) => {
      return criarFuncionarioSeguro(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.FUNCIONARIOS] });
    }
  });
};

// Redefinição via Edge Function (action=reset_password).
// A RPC `redefinir_senha_funcionario` não existe — não usar.
export const useResetFuncionarioPassword = () => {
  return useMutation({
    mutationFn: async ({ id, senha }: { id: string; senha: string }) => {
      return redefinirSenhaFuncionarioSeguro(id, senha);
    }
  });
};

// Atualização via Edge Function (action=update) com payload explícito.
// Nunca envia administrador_id/auth_user_id/ativo/nome_empresa.
export const useUpdateFuncionario = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: UpdateFuncionarioInput) => {
      return atualizarFuncionarioSeguro(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.FUNCIONARIOS] });
    }
  });
};

// Ativar/desativar via Edge Function (action=set_active).
export const useToggleFuncionarioStatus = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      return alterarStatusFuncionarioSeguro(id, ativo);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.FUNCIONARIOS] });
    }
  });
};
