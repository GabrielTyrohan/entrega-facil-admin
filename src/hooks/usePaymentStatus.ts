import { useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';

export const usePaymentStatus = () => {
  const { user, signOut } = useAuth();

  const checkPaymentStatus = useCallback(async () => {
    // DESATIVADO: Verificação automática removida para evitar logout após login
    console.log('usePaymentStatus: Verificação automática desativada');
    return;
  }, [user?.id, signOut]);

  return { checkPaymentStatus };
};
