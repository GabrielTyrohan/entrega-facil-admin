import { toast } from '@/utils/toast';
import React, { useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { Permissoes, useAuth } from '../../contexts/AuthContext';

interface Props {
  permission: keyof Permissoes;
  children: React.ReactNode;
  fallback?: React.ReactNode;
  redirectTo?: string;
}

export const RequirePermission: React.FC<Props> = ({ permission, children, fallback = null, redirectTo }) => {
  const { permissions, userType, isLoading } = useAuth();
  const hasPermission = userType === 'admin' || (permissions && permissions[permission]);

  useEffect(() => {
    if (!isLoading && !hasPermission && redirectTo) {
       toast.error('Você não tem permissão para acessar esta área.');
    }
  }, [isLoading, hasPermission, redirectTo]);

  if (isLoading) {
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
