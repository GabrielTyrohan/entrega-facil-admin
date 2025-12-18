import React from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import LoadingScreen from './ui/LoadingScreen';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { user, loading, paymentExpired, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleCancelLoading = async () => {
    console.log('Cancelando carregamento e fazendo logout...');
    try {
      await signOut();
      console.log('Logout concluído, navegando para login...');
      navigate('/login', { replace: true });
    } catch (error) {
      console.error('Erro ao cancelar:', error);
      // Força navegação mesmo com erro
      navigate('/login', { replace: true });
    }
  };

  if (loading) {
    return (
      <LoadingScreen 
        onCancel={handleCancelLoading}
        cancelText="Demorando muito? Voltar para Login"
      />
    );
  }

  // Se não há usuário, redireciona para login imediatamente
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.role !== 'admin') {
    console.error('Acesso negado: role inválido');
    return <Navigate to="/login" replace />;
  }

  if (paymentExpired && location.pathname !== '/pagamentos') {
    return <Navigate to="/pagamentos" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
