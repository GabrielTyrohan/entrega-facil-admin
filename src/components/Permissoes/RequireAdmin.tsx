import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

interface RequireAdminProps {
  children: React.ReactNode;
}

/**
 * Guarda de frontend para rotas ADMIN ONLY.
 * Usa apenas o estado já derivado pelo AuthContext (userType/isLoading/permissions):
 * - enquanto carrega, não redireciona (evita redirect prematuro);
 * - admin renderiza o conteúdo;
 * - perfil de expedição volta para '/produtos/cestas';
 * - demais usuários vão para '/dashboard'.
 * Não consulta localStorage, query param nem Supabase.
 */
export default function RequireAdmin({ children }: RequireAdminProps) {
  const { userType, isLoading, permissions } = useAuth();

  if (isLoading) return null;

  if (userType === 'admin') return <>{children}</>;

  if (permissions?.expedicao) return <Navigate to="/produtos/cestas" replace />;

  return <Navigate to="/dashboard" replace />;
}
