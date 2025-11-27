import React from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { user, loading, paymentExpired } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  // Se não há usuário, redireciona para login imediatamente,
  // mesmo que esteja em estado de loading (ex.: during logout)
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center space-y-3">
          <div>Carregando...</div>
          <button
            onClick={() => navigate('/login', { replace: true })}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
          >
            Ir para Login
          </button>
        </div>
      </div>
    );
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
