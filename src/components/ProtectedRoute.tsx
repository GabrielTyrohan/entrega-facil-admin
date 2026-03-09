import { useAuth } from '@/contexts/AuthContext';
import React from 'react';
import { Navigate } from 'react-router-dom';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { user, isLoading } = useAuth();


  if (isLoading) {
    // Renderiza a aplicação em estado de carregamento (skeletons) em vez de uma tela de bloqueio
    return <>{children}</>;
  }

  // Se não há usuário, redireciona para login imediatamente
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
