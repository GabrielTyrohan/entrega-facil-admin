import { useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

export const usePaymentStatus = () => {
  const { user, logout } = useAuth();

  const checkPaymentStatus = useCallback(async () => {
    if (!user?.id) return { ok: true };

    try {
      const { data: adminData, error } = await supabase
        .from('administradores')
        .select('status_pagamento, data_vencimento')
        .eq('id', user.id)
        .single();

      if (error) {
        return { ok: false, error: 'Erro ao verificar pagamento' };
      }

      const isStatusVencido = adminData && adminData.status_pagamento === 'vencido';

      const hojeStr = new Date().toISOString().slice(0, 10);
      const normalizeDateStr = (value?: string): string | null => {
        if (!value) return null;
        try {
          return new Date(value).toISOString().slice(0, 10);
        } catch {
          return value.slice(0, 10);
        }
      };
      const vencStr = normalizeDateStr((adminData as any)?.data_vencimento);
      const isExpiredByDate = !!vencStr && vencStr <= hojeStr;

      if (isStatusVencido || isExpiredByDate) {
        await logout();
        return { ok: false, blocked: true };
      }

      return { ok: true };
    } catch (_) {
      return { ok: false, error: 'Falha inesperada na verificação' };
    }
  }, [user?.id, logout]);

  return { checkPaymentStatus };
};
