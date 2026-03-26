import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

export type PermissaoKey =
  | 'orcamentos_pj' | 'vendas_atacado' | 'notas_fiscais'
  | 'caixa' | 'acertos' | 'relatorios' | 'funcionarios'
  | 'vendedores' | 'configuracoes' | 'configuracoes_fiscais'
  | 'expedicao';

export const ROTAS_EXPEDICAO = [
  '/dashboard',
  '/produtos/cestas', '/produtos/cestas/nova',
  '/entregas/avulsas', '/funcionario-config',
];

export function isRotaExpedicaoPermitida(pathname: string): boolean {
  return ROTAS_EXPEDICAO.some(
    (rota) => pathname === rota ||
    pathname.startsWith('/produtos/cestas/editar/')
  );
}

interface RequirePermissionProps {
  permission: PermissaoKey;
  children: React.ReactNode;
  redirectTo?: string;
}

export default function RequirePermission({
  permission, children, redirectTo = '/dashboard',
}: RequirePermissionProps) {
  const { userType, permissions } = useAuth();
  const location = useLocation();

  if (userType === 'admin') return <>{children}</>;

  if (permissions?.expedicao) {
    if (!isRotaExpedicaoPermitida(location.pathname))
      return <Navigate to='/produtos/cestas' replace />;
    return <>{children}</>;
  }

  const temPermissao = permissions?.[permission as keyof typeof permissions];
  if (!temPermissao) return <Navigate to={redirectTo} replace />;
  return <>{children}</>;
}
