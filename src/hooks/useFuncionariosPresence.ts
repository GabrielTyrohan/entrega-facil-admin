import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export interface FuncionarioOnline {
  auth_user_id: string;
  nome: string;
  online_at: string;
}

export function useFuncionariosPresence(adminId: string | undefined) {
  const [onlineUsers, setOnlineUsers] = useState<Record<string, FuncionarioOnline>>({});

  useEffect(() => {
    if (!adminId) return;

    const channel = supabase.channel(`presence:admin:${adminId}`, {
      config: { presence: { key: adminId } },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState<FuncionarioOnline>();
        const flat: Record<string, FuncionarioOnline> = {};
        Object.values(state).forEach((presences) => {
          presences.forEach((p) => {
            flat[p.auth_user_id] = p;
          });
        });
        setOnlineUsers(flat);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [adminId]);

  const isOnline = (authUserId: string | undefined): boolean => {
    if (!authUserId) return false;
    return !!onlineUsers[authUserId];
  };

  return { onlineUsers, isOnline };
}