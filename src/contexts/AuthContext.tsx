import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { User as SupabaseUser } from '@supabase/supabase-js';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  // Informações de pagamento
  valor_assinatura?: number;
  status_pagamento?: string;
  data_vencimento?: string;
  mp_preapproval_id?: string;
  mp_payer_email?: string;
  ultima_cobranca?: string;
  // Dados pessoais
  nome?: string;
  sobrenome?: string;
  telefone?: string;
  telefone_secundario?: string;
  avatar_url?: string;
  // Dados da empresa
  nome_empresa?: string;
  tipo_pessoa?: string;
  cpf_cnpj?: string;
  inscricao_estadual?: string;
  // Endereço
  cep?: string;
  endereco?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  estado?: string;
  pais?: string;
  // Outros
  aceite_termos?: boolean;
  created_at?: string;
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<boolean>;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  logout: () => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkUser = async () => {
      try {
        const { data: { user: supabaseUser } } = await supabase.auth.getUser();
        
        if (supabaseUser) {
          // Usar a mesma lógica do signIn para carregar dados completos
          const { data: adminData, error: adminError } = await supabase
            .from('administradores')
            .select('*')
            .eq('id', supabaseUser.id)
            .single();

          if (!adminError && adminData) {
            const userData: User = {
              id: adminData.id,
              name: adminData.nome || supabaseUser.email?.split('@')[0] || 'Admin',
              email: adminData.email || supabaseUser.email || '',
              role: 'admin',
              // Informações de pagamento
              valor_assinatura: adminData.valor_assinatura,
              status_pagamento: adminData.status_pagamento,
              data_vencimento: adminData.data_vencimento,
              mp_preapproval_id: adminData.mp_preapproval_id,
              mp_payer_email: adminData.mp_payer_email,
              ultima_cobranca: adminData.ultima_cobranca,
              // Dados pessoais
              nome: adminData.nome,
              sobrenome: adminData.sobrenome,
              telefone: adminData.telefone,
              telefone_secundario: adminData.telefone_secundario,
              avatar_url: adminData.avatar_url,
              // Dados da empresa
              nome_empresa: adminData.nome_empresa,
              tipo_pessoa: adminData.tipo_pessoa,
              cpf_cnpj: adminData.cpf_cnpj,
              inscricao_estadual: adminData.inscricao_estadual,
              // Endereço
              cep: adminData.cep,
              endereco: adminData.endereco,
              numero: adminData.numero,
              complemento: adminData.complemento,
              bairro: adminData.bairro,
              cidade: adminData.cidade,
              estado: adminData.estado,
              pais: adminData.pais,
              // Outros
              aceite_termos: adminData.aceite_termos,
              created_at: adminData.created_at
            };
            setUser(userData);
          } else {
            // Fallback para usuário básico se não encontrar dados
            const basicUser: User = {
              id: supabaseUser.id,
              name: supabaseUser.email?.split('@')[0] || 'Admin',
              email: supabaseUser.email || '',
              role: 'admin'
            };
            setUser(basicUser);
          }
        }
        
        setLoading(false);
      } catch (error) {
        console.error('Erro ao verificar usuário:', error);
        setLoading(false);
      }
    };

    checkUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event) => {
        if (event === 'SIGNED_OUT') {
          setUser(null);
          setLoading(false);
        } else if (event === 'TOKEN_REFRESHED') {
          // Não fazer nada especial no refresh do token
        } else if (event === 'SIGNED_IN') {
          // IMPORTANTE: NÃO fazer nada aqui para evitar interferência com o signIn
          // O signIn já faz toda a verificação necessária
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []); // Remover dependência do user para evitar re-criação do listener

  const loadUserData = async (supabaseUser: SupabaseUser) => {
    try {
      
      // Adicionar timeout para evitar travamento
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Timeout na consulta')), 10000);
      });
      
      const queryPromise = supabase
        .from('administradores')
        .select('*')
        .eq('id', supabaseUser.id)
        .single();
      
      const { data: adminData, error } = await Promise.race([queryPromise, timeoutPromise]) as any;

      if (error) {
        // Se não encontrar na tabela administradores, criar usuário básico
        const basicUser: User = {
          id: supabaseUser.id,
          name: supabaseUser.email?.split('@')[0] || 'Admin',
          email: supabaseUser.email || '',
          role: 'admin'
        };
        setUser(basicUser);
        return;
      }

      if (adminData) {
        const userData: User = {
          id: adminData.id,
          name: adminData.nome || supabaseUser.email?.split('@')[0] || 'Admin',
          email: adminData.email || supabaseUser.email || '',
          role: 'admin',
          // Informações de pagamento
          valor_assinatura: adminData.valor_assinatura,
          status_pagamento: adminData.status_pagamento,
          data_vencimento: adminData.data_vencimento,
          mp_preapproval_id: adminData.mp_preapproval_id,
          mp_payer_email: adminData.mp_payer_email,
          ultima_cobranca: adminData.ultima_cobranca,
          // Dados pessoais
          nome: adminData.nome,
          sobrenome: adminData.sobrenome,
          telefone: adminData.telefone,
          telefone_secundario: adminData.telefone_secundario,
          avatar_url: adminData.avatar_url,
          // Dados da empresa
          nome_empresa: adminData.nome_empresa,
          tipo_pessoa: adminData.tipo_pessoa,
          cpf_cnpj: adminData.cpf_cnpj,
          inscricao_estadual: adminData.inscricao_estadual,
          // Endereço
          cep: adminData.cep,
          endereco: adminData.endereco,
          numero: adminData.numero,
          complemento: adminData.complemento,
          bairro: adminData.bairro,
          cidade: adminData.cidade,
          estado: adminData.estado,
          pais: adminData.pais,
          // Outros
          aceite_termos: adminData.aceite_termos,
          created_at: adminData.created_at
        };
        setUser(userData);
      } else {
        // Criar usuário básico se não encontrar dados
        const basicUser: User = {
          id: supabaseUser.id,
          name: supabaseUser.email?.split('@')[0] || 'Admin',
          email: supabaseUser.email || '',
          role: 'admin'
        };
        setUser(basicUser);
      }
    } catch (error) {
      // Em caso de erro, criar usuário básico para não travar
      const basicUser: User = {
        id: supabaseUser.id,
        name: supabaseUser.email?.split('@')[0] || 'Admin',
        email: supabaseUser.email || '',
        role: 'admin'
      };
      setUser(basicUser);
    }
  };

  const signIn = async (email: string, password: string): Promise<{ error?: string }> => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        let errorMessage = 'Erro ao fazer login';
        
        if (error.message.includes('Invalid login credentials')) {
          errorMessage = 'Email ou senha incorretos';
        } else if (error.message.includes('Email not confirmed')) {
          errorMessage = 'Email não confirmado';
        } else if (error.message.includes('Too many requests')) {
          errorMessage = 'Muitas tentativas. Tente novamente em alguns minutos';
        }
        
        return { error: errorMessage };
      }

      if (data.user) {
        
        // PRIMEIRO: Verificar status de pagamento ANTES de definir o user
        const { data: adminData, error: adminError } = await supabase
          .from('administradores')
          .select('*')
          .eq('id', data.user.id)
          .single();

        if (adminError) {
          // Se não conseguir verificar, permite o login (para não bloquear usuários válidos)
          await loadUserData(data.user);
          return {};
        }

        // Verificar status de pagamento - BLOQUEIA apenas se status for "vencido"
        if (adminData && adminData.status_pagamento === 'vencido') {
          // Não fazer logout aqui pois o usuário ainda não foi definido no sistema
          // O Supabase automaticamente limpa a sessão se não definirmos o user
          return { 
            error: 'Acesso bloqueado por falta de pagamento. Para ter acesso, formalize a assinatura.' 
          };
        }
        
        // Definir o usuário diretamente aqui, sem chamar loadUserData
        const userData: User = {
          id: data.user.id,
          name: adminData?.nome || data.user.email?.split('@')[0] || 'Admin',
          email: adminData?.email || data.user.email || '',
          role: 'admin',
          // Informações de pagamento
          valor_assinatura: adminData?.valor_assinatura,
          status_pagamento: adminData?.status_pagamento,
          data_vencimento: adminData?.data_vencimento,
          mp_preapproval_id: adminData?.mp_preapproval_id,
          mp_payer_email: adminData?.mp_payer_email,
          ultima_cobranca: adminData?.ultima_cobranca,
          // Dados pessoais
          nome: adminData?.nome,
          sobrenome: adminData?.sobrenome,
          telefone: adminData?.telefone,
          telefone_secundario: adminData?.telefone_secundario,
          avatar_url: adminData?.avatar_url,
          // Dados da empresa
          nome_empresa: adminData?.nome_empresa,
          tipo_pessoa: adminData?.tipo_pessoa,
          cpf_cnpj: adminData?.cpf_cnpj,
          inscricao_estadual: adminData?.inscricao_estadual,
          // Endereço
          cep: adminData?.cep,
          endereco: adminData?.endereco,
          numero: adminData?.numero,
          complemento: adminData?.complemento,
          bairro: adminData?.bairro,
          cidade: adminData?.cidade,
          estado: adminData?.estado,
          pais: adminData?.pais,
          // Outros
          aceite_termos: adminData?.aceite_termos,
          created_at: adminData?.created_at
        };
        
        setUser(userData);
        return {};
      }

      return { error: 'Falha na autenticação' };
    } catch (error) {
      return { error: 'Erro inesperado. Tente novamente' };
    } finally {
      setLoading(false);
    }
  };

  const login = async (email: string, password: string): Promise<boolean> => {
    const result = await signIn(email, password);
    return !result.error;
  };

  const signOut = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
      } else {
      }
      setUser(null);
    } catch {
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    await signOut();
  };

  return (
    <AuthContext.Provider value={{ user, login, signIn, signOut, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};
