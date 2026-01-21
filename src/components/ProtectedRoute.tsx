import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { user, loading, paymentExpired } = useAuth();
  const location = useLocation();

  if (loading) {
    // Renderiza a aplicação em estado de carregamento (skeletons) em vez de uma tela de bloqueio
    return <>{children}</>;
  }

  // Se não há usuário, redireciona para login imediatamente
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  
  // Verifica pagamento expirado
  if (paymentExpired && location.pathname !== '/pagamentos') {
    return <Navigate to="/pagamentos" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
