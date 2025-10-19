import { useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';

export const usePaymentStatus = () => {
  const { user, signOut } = useAuth();

  const checkPaymentStatus = useCallback(async () => {
    return;
  }, [user?.id, signOut]);

  return { checkPaymentStatus };
};
