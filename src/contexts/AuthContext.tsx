import { prefetchEssentialData } from '@/lib/cache/prefetch';
import { CACHE_KEYS } from '@/lib/constants/queryKeys';
import { supabase } from '@/lib/supabase';
import { toast } from '@/utils/toast';
import { User } from '@supabase/supabase-js';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';

// ===== INTERFACES =====

export interface Permissoes {
  orcamentos_pj: boolean;
  vendas_atacado: boolean;
  notas_fiscais: boolean;
  caixa: boolean;
  acertos: boolean;
  relatorios: boolean;
  funcionarios: boolean;
  vendedores: boolean;
  configuracoes: boolean;
  configuracoes_fiscais: boolean;
}

export interface AdminProfile {
  id: string;
  nome: string;
  email: string;
  avatar_url?: string;
  tipo_pessoa?: string;
  nome_empresa?: string;
  telefone?: string;
  cpf_cnpj?: string;
  sobrenome?: string;
  telefone_secundario?: string;
  cep?: string;
  endereco?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  estado?: string;
  pais?: string;
  // Payment info
  valor_assinatura?: number;
  status_pagamento?: string;
  data_vencimento?: string;
  mp_preapproval_id?: string;
  mp_payer_email?: string;
  ultima_cobranca?: string;
}

export interface FuncionarioProfile {
  id: string;
  administrador_id: string;
  auth_user_id: string;
  nome: string;
  email: string;
  cargo?: string;
  telefone?: string;
  permissoes: Permissoes;
  ativo: boolean;
  nome_empresa?: string;
}

export type UserType = 'admin' | 'funcionario' | null;

// ===== INTERFACE DO CONTEXTO =====

interface AuthContextType {
  user: User | null;
  userType: UserType;
  userProfile: AdminProfile | FuncionarioProfile | null;
  adminId: string | null; // ID do admin (próprio ou do vinculado)
  permissions: Permissoes;
  isLoading: boolean;
  isAdmin: boolean;
  isFuncionario: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

// ===== CONSTANTES =====

const ADMIN_PERMISSIONS: Permissoes = {
  orcamentos_pj: true,
  vendas_atacado: true,
  notas_fiscais: true,
  caixa: true,
  acertos: true,
  relatorios: true,
  funcionarios: true,
  vendedores: true,
  configuracoes: true,
  configuracoes_fiscais: true,
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isSessionLoading, setIsSessionLoading] = useState(true);
  const queryClient = useQueryClient();

  // ===== QUERY PARA PERFIL (com cache) ===== 
  const { data: userProfile, error: profileError } = useQuery({ 
    queryKey: [CACHE_KEYS.USER_PROFILE, user?.id], 
    queryFn: async () => { 
      if (!user) return null; 

      // 1. Tentar Admin 
      const { data: admin, error: adminError } = await supabase 
        .from('administradores') 
        .select('*') 
        .eq('id', user.id) 
        .maybeSingle(); 

      if (adminError) {
        console.error('❌ Erro ao buscar admin:', adminError);
      }

      if (admin) { 
        // Verifica se o admin está com pagamento inativo ou bloqueado
        if (admin.status_pagamento === 'inativo' || admin.status_pagamento === 'cancelado') {
          throw new Error('PAGAMENTO_INATIVO');
        }
        return { ...admin, type: 'admin' } as AdminProfile & { type: 'admin' }; 
      } 

      // 2. Tentar Funcionário — primeiro verifica se existe (independente do ativo)
      const { data: funcionarioRaw, error: funcError } = await supabase 
        .from('funcionarios') 
        .select('*') 
        .eq('auth_user_id', user.id) 
        .maybeSingle(); 

      if (funcError) {
        console.error('❌ Erro ao buscar funcionário:', funcError);
      }

      // Existe mas está desativado → erro específico
      if (funcionarioRaw && funcionarioRaw.ativo === false) {
        throw new Error('ACESSO_DESATIVADO');
      }

      // Existe e está ativo → retorna perfil
      if (funcionarioRaw && funcionarioRaw.ativo === true) {
        // O nome da empresa agora vem diretamente da tabela funcionarios (atualizado via trigger)
        return { ...funcionarioRaw, type: 'funcionario' } as FuncionarioProfile & { type: 'funcionario' }; 
      } 

      console.error('❌ Nenhum perfil encontrado para o usuário');
      throw new Error('Usuário não autorizado: Perfil não encontrado'); 
    }, 
    enabled: !!user, // SÓ executa se user existir 
    staleTime: 10 * 60 * 1000, // 10 minutos (perfil não muda frequente) 
    gcTime: 30 * 60 * 1000, 
    retry: 1, 
  }); 

  // Derivar estados do userProfile usando useMemo para garantir consistência imediata
  const { userType, adminId, permissions } = useMemo(() => {
    if (!userProfile) {
      return { 
        userType: null, 
        adminId: null, 
        permissions: ADMIN_PERMISSIONS 
      };
    }

    const type = (userProfile as any).type || 
                 ('administrador_id' in userProfile ? 'funcionario' : 'admin');
    
    let derivedAdminId: string | null = null;
    let derivedPermissions = ADMIN_PERMISSIONS;

    if (type === 'admin') {
      derivedAdminId = (userProfile as AdminProfile).id;
      derivedPermissions = ADMIN_PERMISSIONS;
    } else {
      derivedAdminId = (userProfile as FuncionarioProfile).administrador_id;
      derivedPermissions = (userProfile as FuncionarioProfile).permissoes || ADMIN_PERMISSIONS;
    }

    return {
      userType: type as UserType,
      adminId: derivedAdminId,
      permissions: derivedPermissions
    };
  }, [userProfile]);

  // Log para debug
  useEffect(() => {
  }, [userType, adminId, isSessionLoading, user, userProfile, profileError]);

  const isLoading = isSessionLoading || (!!user && (!userProfile && !profileError));

  // ===== LOGIN =====
  const signIn = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;
      if (!data.user) throw new Error('Credenciais inválidas');

      // ── Verificação antecipada: funcionário desativado?
      // Checar antes de deixar o fluxo de autenticação completar.
      const { data: funcionario, error: funcError } = await supabase
        .from('funcionarios')
        .select('ativo')
        .eq('auth_user_id', data.user.id)
        .maybeSingle();

      if (!funcError && funcionario && funcionario.ativo === false) {
        // Faz sign out imediatamente para não criar sessão ativa
        await supabase.auth.signOut();
        throw new Error('ACESSO_DESATIVADO');
      }

      // O listener onAuthStateChange vai capturar o login e disparar o useQuery
      toast.success(`Bem-vindo!`);
    } catch (error: any) {
      console.error('❌ Erro no login:', error);

      // Repassar erros já formatados
      if (error.message === 'ACESSO_DESATIVADO') throw error;

      // Mensagens de erro específicas
      if (error.message.includes('Invalid login credentials')) {
        throw new Error('E-mail ou senha incorretos');
      } else if (error.message.includes('não autorizado')) {
        throw new Error('Você não tem permissão para acessar o sistema');
      }

      throw error;
    }
  };

  // ===== LOGOUT =====
  const signOut = async () => {
    try {
      await supabase.auth.signOut();
      setUser(null);
      queryClient.removeQueries({ queryKey: [CACHE_KEYS.USER_PROFILE] });
      toast.success('Logout realizado com sucesso');
    } catch (error) {
      console.error('❌ Erro no logout:', error);
      toast.error('Erro ao fazer logout');
    }
  };

  // ===== LIFECYCLE (Verificar sessão ao carregar) =====
  useEffect(() => {
    const initAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();

        if (session?.user) {
          setUser(session.user);
          // Query vai rodar automaticamente
        }
      } catch (error) {
        console.error('Erro ao verificar sessão:', error);
      } finally {
        setIsSessionLoading(false);
      }
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setUser(session?.user ?? null);
      if (!session?.user) {
        queryClient.removeQueries({ queryKey: [CACHE_KEYS.USER_PROFILE] });
      }
    });

    return () => subscription.unsubscribe();
  }, [queryClient]);

  // ===== PREFETCH AUTOMÁTICO =====
  // Executa prefetch de dados essenciais assim que o adminId estiver disponível
  // (seja após login ou reload da página)
  useEffect(() => {
    if (adminId) {
      prefetchEssentialData(queryClient, adminId).catch(console.error);
    }
  }, [adminId, queryClient]);

  // Efeito para logout em caso de erro no perfil (não autorizado/bloqueado)
  useEffect(() => {
    if (profileError) {
      console.error('❌ Erro no perfil:', profileError);
      const errorMsg = (profileError as Error).message;

      if (errorMsg === 'ACESSO_DESATIVADO') {
        toast.error('Seu acesso foi desativado. Entre em contato com o administrador.');
      } else if (errorMsg === 'PAGAMENTO_INATIVO') {
        toast.error('Assinatura inativa. Regularize seu pagamento para acessar o sistema.');
      } else {
        toast.error('Erro de autorização. Faça login novamente.');
      }

      // Salva o erro provisoriamente para o LoginPage exibir em seu formulário
      localStorage.setItem('loginErrorMsg', errorMsg);
      signOut();
    }
  }, [profileError]);

  // ===== PROVIDER =====
  return (
    <AuthContext.Provider
      value={{
        user,
        userType,
        userProfile: userProfile || null,
        adminId,
        permissions,
        isLoading,
        isAdmin: userType === 'admin',
        isFuncionario: userType === 'funcionario',
        signIn,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

// ===== HOOK CUSTOMIZADO =====
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de AuthProvider');
  }
  return context;
};
