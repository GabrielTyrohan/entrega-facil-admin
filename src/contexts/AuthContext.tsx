import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { toast } from '@/utils/toast';
// Removido import de tipo SupabaseUser não utilizado

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
  signIn: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<void>;
  logout: () => void;
  loading: boolean;
  paymentExpired: boolean;
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
  const [paymentExpired] = useState(false);
  const [manualLogout, setManualLogout] = useState(false);
  
  // Função central para validar permissões via RPC segura
  const loadUserData = async (userId: string) => {
    try {
      setLoading(true);
      // Referência explícita para evitar warning de parâmetro não utilizado
      void userId;

      const { data, error } = await supabase.rpc('validar_login_admin');

      if (error) {
        console.error('Erro ao validar admin:', error);
        await supabase.auth.signOut();
        setUser(null);
        setLoading(false);
        return;
      }

      if (!data || !data.success) {
        const errorMsg = (data as any)?.error || 'Acesso negado';

        if (errorMsg.includes('não tem permissão')) {
          toast.error('Você não tem permissão de administrador');
        } else if (errorMsg.includes('cancelada')) {
          toast.error('Sua assinatura está cancelada');
        } else if (errorMsg.includes('não encontrado')) {
          toast.error('Conta não encontrada');
        } else {
          toast.error(errorMsg);
        }

        await supabase.auth.signOut();
        setUser(null);
        setLoading(false);
        return;
      }

      const admin: any = (data as any).admin;
      admin.role = 'admin';

      setUser(admin as User);
      setLoading(false);

    } catch (err) {
      console.error('Erro:', err);
      await supabase.auth.signOut();
      setUser(null);
      setLoading(false);
    }
  };

  // Observa sessão inicial e mudanças de autenticação
  useEffect(() => {
    // Verificar sessão inicial
    supabase.auth.getSession().then(async ({ data: { session }, error }) => {
      if (error) {
        toast.error('Sessão expirada. Faça login novamente');
        await supabase.auth.signOut();
        setUser(null);
        setLoading(false);
        return;
      }
      if (session?.user) {
        loadUserData(session.user.id);
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    // Observar mudanças de autenticação
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'TOKEN_REFRESHED') {
          return;
        }
        if (session?.user) {
          await loadUserData(session.user.id);
        } else {
          if (event === 'SIGNED_OUT' && !manualLogout) {
            toast.error('Sessão expirada. Faça login novamente');
          }
          setUser(null);
          setLoading(false);
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) throw error;

      if (!data.user) {
        throw new Error('Usuário não encontrado');
      }

      // Carregar e validar dados do admin
      await loadUserData(data.user.id);

      return { success: true };

    } catch (error: any) {
      console.error('Erro no login:', error);
      return {
        success: false,
        error: error.message || 'Erro ao fazer login'
      };
    } finally {
      setLoading(false);
    }
  };

  const login = async (email: string, password: string): Promise<boolean> => {
    const result = await signIn(email, password);
    return result.success;
  };

  const signOut = async () => {
    setLoading(true);
    try {
      setManualLogout(true);
      const { error } = await supabase.auth.signOut();
      if (error) {
      } else {
      }
      setUser(null);
    } catch {
    } finally {
      setManualLogout(false);
      setLoading(false);
    }
  };

  const logout = async () => {
    await signOut();
  };

  return (
    <AuthContext.Provider value={{ user, login, signIn, signOut, logout, loading, paymentExpired }}>
      {children}
    </AuthContext.Provider>
  );
};
