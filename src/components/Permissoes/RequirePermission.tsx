import React, { useEffect } from 'react';
import { useAuth, Permissoes } from '../../contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { toast } from '@/utils/toast';

interface Props {
  permission: keyof Permissoes;
  children: React.ReactNode;
  fallback?: React.ReactNode;
  redirectTo?: string;
}

export const RequirePermission: React.FC<Props> = ({ permission, children, fallback = null, redirectTo }) => {
  const { permissions, userType, loading } = useAuth();
  const hasPermission = userType === 'admin' || (permissions && permissions[permission]);

  useEffect(() => {
    if (!loading && !hasPermission && redirectTo) {
       toast.error('Você não tem permissão para acessar esta área.');
    }
  }, [loading, hasPermission, redirectTo]);

  if (loading) {
      return null;
  }

  if (hasPermission) {
    return <>{children}</>;
  }

  if (redirectTo) {
      return <Navigate to={redirectTo} replace />;
  }

  return <>{fallback}</>;
};
