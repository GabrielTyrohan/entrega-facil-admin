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
        console.log('🔍 Verificando status de pagamento automaticamente...');
        
        // Busca os dados do administrador atual
        const { data: adminData, error } = await supabase
          .from('administradores')
          .select('status_pagamento, email, nome, sobrenome')
          .eq('id', user.id)
          .single();

        if (error) {
          console.error('Erro ao verificar status de pagamento:', error);
          return;
        }

        if (adminData && adminData.status_pagamento === 'vencido') {
          console.log('⚠️ Status de pagamento vencido detectado. Fazendo logout automático...');
          
          // Faz logout do usuário
          await logout();
          
          // Redireciona para a página de login (o AuthContext já faz isso automaticamente)
          console.log('✅ Usuário deslogado devido ao status de pagamento vencido');
        } else {
          console.log('✅ Status de pagamento OK');
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


    console.log('🚀 Verificação automática de pagamento iniciada (a cada 10 minutos)');

    // Cleanup function
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      clearTimeout(initialTimeout);
      console.log('🛑 Verificação automática de pagamento parada');
    };
  }, [user, logout]);

  // Este componente não renderiza nada visível
  return null;
};

export default PaymentStatusAutoChecker;