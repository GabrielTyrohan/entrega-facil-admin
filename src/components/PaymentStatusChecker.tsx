import { useEffect } from 'react';
import { usePaymentStatus } from '../hooks/usePaymentStatus';

export const PaymentStatusChecker: React.FC = () => {
  const { checkPaymentStatus } = usePaymentStatus();

  useEffect(() => {
    // DESATIVADO: Verificação automática removida para evitar logout após login
    console.log('PaymentStatusChecker: Componente desativado - verificação acontece apenas no login');
    return;

    // ... existing code ...
  }, [checkPaymentStatus]);

  return null; // Componente invisível
};