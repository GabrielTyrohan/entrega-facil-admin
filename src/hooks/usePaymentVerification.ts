import { useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';

export const usePaymentVerification = () => {
  const { user, signOut } = useAuth();

  const checkPaymentStatus = useCallback(async () => {
    // DESATIVADO: Verificação automática removida para evitar logout após login
    console.log('usePaymentVerification: Verificação automática desativada');
    return;
  }, [user?.id, signOut]);

  return { checkPaymentStatus };
};
