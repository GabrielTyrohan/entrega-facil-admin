import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { toast } from '@/utils/toast';
// Removido import de tipo SupabaseUser não utilizado
import { prefetchDashboardData } from '@/lib/cache/prefetch';

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

import { useQueryClient } from '@tanstack/react-query';

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
  const userRef = React.useRef<User | null>(null);
  const loadingPromiseRef = React.useRef<Promise<void> | null>(null);
  const lastLoadedUserRef = React.useRef<string | null>(null);
  const initialSessionReceivedRef = React.useRef(false);
  const [loading, setLoading] = useState(true);
  const [paymentExpired] = useState(false);
  const queryClient = useQueryClient();
  const [manualLogout, setManualLogout] = useState(false);

  // Manter ref sincronizado com state
  useEffect(() => {
    userRef.current = user;
  }, [user]);
  
  // Função central para validar permissões via RPC segura
  const loadUserData = async (userId: string, sessionUser?: any): Promise<void> => {
      // Se já houver uma carga em andamento, retorna a promessa existente
    // Mas apenas se não for uma tentativa de recarga forçada (ex: login após logout)
    if (loadingPromiseRef.current) {
        // Verifica se a promise parece estar travada ou se é de um usuário diferente
        if (lastLoadedUserRef.current !== userId) {
            console.log('[AuthContext] loadingPromiseRef existente mas parece inválida/antiga, iniciando nova carga.');
            // Não retornamos a antiga, deixamos sobrescrever
        } else {
            return loadingPromiseRef.current;
        }
    }

      let loadTaskPromise: Promise<void>;

    const loadTask = async (): Promise<void> => {
      try {
        console.log(`[AuthContext] loadUserData iniciado para ${userId}`);
        
        // Verificação rápida para evitar recarregamento
      if (lastLoadedUserRef.current === userId) {
         console.log('[AuthContext] Usuário já carregado recentemente (cache local), pulando.');
         setLoading(false);
         return;
      }

      // Verificação de cache persistente (localStorage) para evitar bloqueio no F5
      const cachedData = localStorage.getItem(`admin_data_${userId}`);
      if (cachedData) {
         try {
             const parsedAdmin = JSON.parse(cachedData);
             
             // Mescla com dados da sessão atual se disponíveis (garante email atualizado)
             if (sessionUser) {
                if (sessionUser.email) parsedAdmin.email = sessionUser.email;
                if (sessionUser.user_metadata?.full_name) parsedAdmin.name = sessionUser.user_metadata.full_name;
             }
 
             console.log('[AuthContext] Usando cache do localStorage para carregamento instantâneo.');
             
             // Limpa queries antigas que podem ter falhado ou retornado vazio
             queryClient.invalidateQueries();
             
             // Define o usuário imediatamente
             setUser(parsedAdmin);

             // Disparar prefetch em background
             prefetchDashboardData(userId).catch(err => console.error('[AuthContext] Erro no prefetch (cache):', err));
             
             // Habilitando Stale-While-Revalidate real: libera a UI imediatamente com dados do cache
             // Se a revalidação falhar (timeout), o usuário continua usando o app normalmente.
             setLoading(false);
             
             // Não retornamos aqui para permitir que a validação de rede ocorra em background (stale-while-revalidate)
             // Mas atualizamos o ref para evitar loops
             lastLoadedUserRef.current = userId;
         } catch (e) {
            console.warn('[AuthContext] Erro ao ler cache local:', e);
         }
      }

      try {
        // Apenas define loading como true se não houver usuário carregado E não tivermos usado o cache
        if (!userRef.current && !cachedData) {
          console.log('[AuthContext] Sem cache ou usuário: ativando loading...');
          setLoading(true);
        }
        
        // Tenta PRIMEIRO o método rápido (tabela direta)
      // Isso evita depender da RPC lenta que está causando timeout
      console.log('[AuthContext] Tentando carregamento otimizado via tabela...');
      
      // Reintroduzindo timeout seguro e tratamento de erro específico
      const tableTimeoutDuration = cachedData ? 10000 : 30000;
      
      let adminData, adminError;
      
      try {
         // Verificação de conectividade básica
         if (typeof navigator !== 'undefined' && !navigator.onLine) {
             throw new Error('Sem conexão com a internet (offline)');
         }

         // Tentativa 1: Leitura direta com timeout
         const tableQueryPromise = supabase
            .from('administradores')
            .select('id, nome, email, status_pagamento, valor_assinatura, data_vencimento, mp_preapproval_id, role, created_at') // Select otimizado
            .eq('id', userId)
            .single();

         const tableTimeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Timeout na leitura da tabela')), tableTimeoutDuration)
         );

         const result = await Promise.race([tableQueryPromise, tableTimeoutPromise]) as any;
            
         adminData = result.data;
         adminError = result.error;
      } catch (e: any) {
         console.warn('[AuthContext] Erro ou Timeout na leitura direta (Tentativa 1):', e);
         
         // Retry simples se for timeout ou erro de conexão
         if (e.message && (e.message.includes('Timeout') || e.message.includes('fetch') || e.message.includes('offline'))) {
              console.log('[AuthContext] Aguardando 1s antes do Retry...');
              await new Promise(resolve => setTimeout(resolve, 1000));
              
              console.log('[AuthContext] Tentando novamente a leitura da tabela (Retry)...');
               try {
                   // Adicionando timeout também no retry
                   const retryQueryPromise = supabase
                     .from('administradores')
                     .select('id, nome, email, status_pagamento, valor_assinatura, data_vencimento, mp_preapproval_id, role, created_at')
                     .eq('id', userId)
                     .single();

                   const retryTimeoutPromise = new Promise((_, reject) => 
                     setTimeout(() => reject(new Error('Timeout na leitura da tabela (Retry)')), tableTimeoutDuration)
                   );
                   
                   const retryResult = await Promise.race([retryQueryPromise, retryTimeoutPromise]) as any;
                   adminData = retryResult.data;
                   adminError = retryResult.error;
               } catch (retryError) {
                    console.warn('[AuthContext] Erro no Retry da leitura direta:', retryError);
                    adminError = retryError;
               }
         } else {
             // Tratamento específico para "message channel closed"
             if (e.message && (e.message.includes('message channel closed') || e.message.includes('closed before a response'))) {
                 console.error('[AuthContext] Erro crítico de comunicação (channel closed). Possível instabilidade de rede ou bloqueio.');
             }
             adminError = e;
         }
      }

      /* Código antigo com timeout e race condition removido temporariamente para teste
      const tableQueryPromise = supabase
        .from('administradores')
        .select('*')
        .eq('id', userId)
        .single();
        
      const tableTimeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout na leitura da tabela')), tableTimeoutDuration)
      );

      // Race condition entre query e timeout
      let adminData, adminError;
      try {
         const result = await Promise.race([tableQueryPromise, tableTimeoutPromise]) as any;
         adminData = result.data;
         adminError = result.error;
      } catch (e) {
         console.warn('[AuthContext] Timeout ou erro na leitura direta:', e);
         // Se der timeout, vamos deixar adminError ser tratado abaixo ou cair no fallback
         adminError = e; 
      }
      */

      if (!adminError && adminData) {
         // Verifica se o carregamento foi cancelado (ex: logout durante o await)
         if (loadingPromiseRef.current !== loadTaskPromise) {
             console.log('[AuthContext] Carregamento cancelado ou obsoleto (Tabela), abortando atualização de estado.');
             return;
         }

         console.log('[AuthContext] Dados carregados via tabela com sucesso!');
         
         // Validação básica de pagamento
         if (adminData.status_pagamento === 'cancelado') {
           toast.error('Sua assinatura está cancelada');
           await supabase.auth.signOut();
           setUser(null);
           lastLoadedUserRef.current = null;
           return;
         }

         const admin = { ...adminData, role: 'admin' };
         
         // Garante campos essenciais se vierem da sessão
         if (sessionUser) {
            if (!admin.email && sessionUser.email) admin.email = sessionUser.email;
            if (!admin.name && sessionUser.user_metadata?.full_name) admin.name = sessionUser.user_metadata.full_name;
            // Fallback para nome se não existir
            if (!admin.name && admin.nome) admin.name = admin.nome;
         }
         
         // Atualiza o cache local
         try {
             localStorage.setItem(`admin_data_${userId}`, JSON.stringify(admin));
             console.log('[AuthContext] Cache local atualizado com sucesso após leitura da tabela.');
         } catch (storageError) {
             console.error('[AuthContext] Falha ao gravar no localStorage:', storageError);
         }
         
         setUser(admin as User);
         lastLoadedUserRef.current = userId;

         // Disparar prefetch em background sem bloquear o login
         prefetchDashboardData(userId).catch(err => 
            console.error('[AuthContext] Erro no prefetch de dados:', err)
         );

         setLoading(false);
         return;
      }

        // Se falhar a leitura direta (ex: permissão RLS restrita), tenta a RPC como fallback
        console.log('[AuthContext] Leitura direta falhou, tentando RPC...');
        
        const rpcTimeoutDuration = cachedData ? 10000 : 40000;
        
        const rpcPromise = supabase.rpc('validar_login_admin');
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout ao validar login')), rpcTimeoutDuration)
        );

        const { data, error } = await Promise.race([rpcPromise, timeoutPromise]) as any;
        console.log('[AuthContext] RPC resposta:', { error: !!error, success: data?.success });
        
        // Verifica se o carregamento foi cancelado (ex: logout durante o await)
        if (loadingPromiseRef.current !== loadTaskPromise) {
            console.log('[AuthContext] Carregamento cancelado ou obsoleto (RPC), abortando atualização de estado.');
            return;
        }

        if (error) {
          console.error('Erro ao validar admin:', error);
          await supabase.auth.signOut();
          setUser(null);
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
          return;
        }

        const admin: any = (data as any).admin;
        admin.role = 'admin';

        // Garante campos essenciais se vierem da sessão
        if (sessionUser) {
           if (!admin.email && sessionUser.email) admin.email = sessionUser.email;
           if (!admin.name && sessionUser.user_metadata?.full_name) admin.name = sessionUser.user_metadata.full_name;
        }

        // Atualiza o cache local
        try {
            localStorage.setItem(`admin_data_${userId}`, JSON.stringify(admin));
            console.log('[AuthContext] Cache local atualizado com sucesso via RPC.');
        } catch (storageError) {
            console.error('[AuthContext] Falha ao gravar no localStorage via RPC:', storageError);
        }

        setUser(admin as User);
        lastLoadedUserRef.current = userId;

        // Disparar prefetch em background sem bloquear o login
        prefetchDashboardData(userId).catch(err => 
           console.error('[AuthContext] Erro no prefetch de dados:', err)
        );

      } catch (err: any) {
        console.error('Erro:', err);
        
        if (err.message && (err.message.includes('message channel closed') || err.message.includes('closed before a response'))) {
             console.error('[AuthContext] Erro crítico (RPC/Geral): message channel closed.');
        }
        
        // Verifica se o carregamento foi cancelado antes de tomar ações destrutivas
        if (loadingPromiseRef.current !== loadTaskPromise) {
            console.log('[AuthContext] Erro capturado em tarefa cancelada/obsoleta. Ignorando ações de limpeza.');
            return;
        }
        
        // Se tivermos dados em cache, não fazemos logout no timeout, apenas logamos o erro
        const hasCache = !!localStorage.getItem(`admin_data_${userId}`);
        const errorMsg = err instanceof Error ? err.message : '';
        const isNetworkError = errorMsg.includes('Timeout') || 
                              errorMsg.includes('fetch') || 
                              errorMsg.includes('network') ||
                              errorMsg.includes('offline') ||
                              errorMsg.includes('message channel closed');
        
        if (hasCache && isNetworkError) {
           console.warn('[AuthContext] Erro de rede na validação, mas mantendo sessão via cache.');
           // Mantemos o usuário do cache
           setLoading(false);
           return;
        }

        // Erro fatal (sem cache ou erro crítico)
        await supabase.auth.signOut();
        setUser(null);
        lastLoadedUserRef.current = null;
        localStorage.removeItem(`admin_data_${userId}`);
      }
    } catch (err) {
        console.error('Erro geral em loadTask:', err);
        throw err;
      } finally {
        // Se tivermos cache mas ainda não recebemos INITIAL_SESSION/SIGNED_IN,
        // tentamos esperar um pouco mais para evitar tela piscando ou dados vazios.
        const hasCache = !!localStorage.getItem(`admin_data_${userId}`);
        
        if (!hasCache || initialSessionReceivedRef.current) {
             setLoading(false);
        } else {
             console.log('[AuthContext] Validação concluída, aguardando evento de sessão para liberar UI...');
             // Timeout de segurança para não travar eternamente
             setTimeout(() => {
                 setLoading((current) => {
                     if (current) {
                         console.log('[AuthContext] Timeout de segurança: liberando UI mesmo sem evento explícito.');
                         return false;
                     }
                     return current;
                 });
             }, 2000);
        }
        
        // Sempre limpa o ref ao terminar, sucesso ou erro
        if (loadingPromiseRef.current === loadTaskPromise) {
             loadingPromiseRef.current = null;
        }
      }
    };

    loadTaskPromise = loadTask();
    loadingPromiseRef.current = loadTaskPromise;
    return loadingPromiseRef.current;
  };

  // Observa sessão inicial e mudanças de autenticação
  useEffect(() => {
    console.log('[AuthContext] Inicializando...');
    
    // Safety timeout removido pois o novo sistema de cache e timeout na query
    // já tratam os casos de travamento de forma mais eficiente.
    // O timeout antigo de 45s estava causando conflitos com o React em modo DEV.

    // Observar mudanças de autenticação
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log(`[AuthContext] Auth change: ${event}`);
        
        // Se estivermos fazendo logout manual, ignoramos qualquer evento de login/sessão
        if (manualLogout) {
            console.log('[AuthContext] Logout em andamento, ignorando evento:', event);
            return;
        }

        if (event === 'TOKEN_REFRESHED') {
          return;
        }

        // Se for INITIAL_SESSION, verificamos se já não estamos carregando via getSession
        // Mas para simplificar e evitar race conditions, vamos centralizar aqui.
        
        if (session?.user) {
          // Se o usuário já estiver carregado e for o mesmo, não recarrega
        // Usamos lastLoadedUserRef também para cobrir o gap entre o fim do loadUserData e a atualização do state
        if (userRef.current?.id === session.user.id || lastLoadedUserRef.current === session.user.id) {
           console.log('[AuthContext] Usuário já carregado, ignorando evento.');
           
           // FIX: Mesmo se o usuário já estiver carregado (cache), 
           // devemos garantir que os dados do dashboard sejam atualizados 
           // agora que a sessão está confirmada/restabelecida.
           if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN') {
               // Verifica se os dados estão no localStorage, se não estiverem, recarrega
               // Isso corrige o caso onde o token existe mas o cache de admin foi limpo
               const hasLocalCache = localStorage.getItem(`admin_data_${session.user.id}`);
               if (!hasLocalCache) {
                   console.log('[AuthContext] Sessão válida mas sem cache local: forçando recarregamento.');
                   await loadUserData(session.user.id, session.user);
                   return;
               }

               // Evita re-processar se já processamos a sessão inicial recentemente
               if (!initialSessionReceivedRef.current) {
                   initialSessionReceivedRef.current = true;
                   console.log('[AuthContext] Sessão confirmada, atualizando dados da interface...');
                   await queryClient.invalidateQueries();
                   setLoading(false);
               }
           }
           
           return;
        }
          await loadUserData(session.user.id, session.user);
        } else {
          if (event === 'SIGNED_OUT' && !manualLogout) {
            toast.error('Sessão expirada. Faça login novamente');
          }
          // Apenas limpa se realmente não houver sessão
          if (!session && userRef.current) {
            setUser(null);
            setLoading(false);
          } else if (!session && !userRef.current) {
             // Caso inicial onde não tem user e não tem sessão
             setLoading(false);
          }
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
      console.log('[AuthContext] Tentando login para:', email.replace(/(.{2})(.*)(@.*)/, '$1***$3')); // Log mascarado
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) throw error;

      if (!data.user) {
        throw new Error('Usuário não encontrado');
      }

      // Carregar e validar dados do admin
      await loadUserData(data.user.id, data.user);

      // Validação final: se o carregamento falhou (userRef ou lastLoadedUserRef nulos), 
      // lançamos erro para evitar que a UI redirecione para o dashboard
      if (lastLoadedUserRef.current !== data.user.id) {
           throw new Error('Falha ao carregar dados do usuário (Timeout ou erro de conexão). Tente novamente.');
      }

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
      
      // Limpa cache local do usuário atual se existir
      if (user?.id) {
          localStorage.removeItem(`admin_data_${user.id}`);
      }
      
      // Limpa query cache do React Query
      queryClient.clear();
      
      // Tenta fazer logout no Supabase com timeout de segurança
      // para evitar que a interface trave se a rede estiver ruim
      const signOutPromise = supabase.auth.signOut();
      const timeoutPromise = new Promise(resolve => setTimeout(resolve, 3000));
      
      await Promise.race([signOutPromise, timeoutPromise]);
      
      // Limpeza agressiva de tokens do Supabase no LocalStorage - APÓS o logout para evitar corromper o client atual
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('sb-') && key.endsWith('-auth-token')) {
          localStorage.removeItem(key);
        }
      });
      
      setUser(null);
      lastLoadedUserRef.current = null;
      loadingPromiseRef.current = null; // Garante que carregamentos pendentes sejam invalidados
      initialSessionReceivedRef.current = false;
      
    } catch (error) {
       console.error('Erro inesperado no logout:', error);
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
