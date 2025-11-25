import React, { useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

const PaymentStatusAutoChecker: React.FC = () => {
  const { user, logout } = useAuth();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Só executa se houver usuário logado
    if (!user) {
      // Limpa o intervalo se não há usuário
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    // Função para verificar o status de pagamento
    const checkPaymentStatus = async () => {
      try {
        
        // Busca os dados do administrador atual
        const { data: adminData, error } = await supabase
          .from('administradores')
          .select('status_pagamento, data_vencimento, email, nome, sobrenome')
          .eq('id', user.id)
          .single();

        if (error) {
          console.error('Erro ao verificar status de pagamento:', error);
          return;
        }

        // Verificação por status explícito
        const isStatusVencido = adminData && adminData.status_pagamento === 'vencido';

        // Verificação por data de vencimento (<= hoje)
        const hojeStr = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
        const rawVencStr: string | undefined = (adminData as any)?.data_vencimento || (adminData as any)?.data_vendimento;

        const normalizeDateStr = (value?: string): string | null => {
          if (!value) return null;
          try {
            // Normaliza para YYYY-MM-DD
            const norm = new Date(value).toISOString().slice(0, 10);
            return norm;
          } catch {
            // Fallback simples caso venha apenas YYYY-MM-DD
            return value.slice(0, 10);
          }
        };

        const vencStr = normalizeDateStr(rawVencStr);
        const isExpiredByDate = !!vencStr && vencStr <= hojeStr;

        if (isStatusVencido || isExpiredByDate) {
          // Faz logout do usuário e ProtectedRoute redireciona para /login
          await logout();
        }
      } catch (error) {
        console.error('Erro na verificação automática de pagamento:', error);
      }
    };

    // Executa a primeira verificação após 1 segundo (para dar tempo do componente carregar)
    const initialTimeout = setTimeout(() => {
      checkPaymentStatus();
    }, 1000);

    // Configura verificação a cada 10 minutos (600.000 ms)
    intervalRef.current = setInterval(checkPaymentStatus, 10 * 60 * 1000);

    // Cleanup function
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      clearTimeout(initialTimeout);
    };
  }, [user, logout]);

  // Este componente não renderiza nada visível
  return null;
};

export default PaymentStatusAutoChecker;