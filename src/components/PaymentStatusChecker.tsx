import { useEffect } from 'react';
import { usePaymentStatus } from '../hooks/usePaymentStatus';

export const PaymentStatusChecker: React.FC = () => {
  const { checkPaymentStatus } = usePaymentStatus();

  useEffect(() => {
    return;

    // ... existing code ...
  }, [checkPaymentStatus]);

  return null; // Componente invisível
};