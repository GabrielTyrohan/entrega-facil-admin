import { usePaymentVerification } from '../hooks/usePaymentVerification';

const PaymentVerification: React.FC = () => {
  usePaymentVerification();
  return null; // Este componente não renderiza nada, apenas executa a verificação
};

export default PaymentVerification;