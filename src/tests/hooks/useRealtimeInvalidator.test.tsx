import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

type Handler = () => void;
const { canal, removeChannel } = vi.hoisted(() => {
  const handlers: Record<string, Handler> = {};
  const canal = {
    handlers,
    on: vi.fn((_tipo: string, filtro: { table: string }, cb: Handler) => {
      handlers[filtro.table] = cb;
      return canal;
    }),
    subscribe: vi.fn(() => canal),
  };
  return { canal, removeChannel: vi.fn() };
});

vi.mock('@/lib/supabase', () => ({ supabase: { channel: vi.fn(() => canal), removeChannel } }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ adminId: 'admin-1' }) }));

import { useRealtimeInvalidator } from '@/hooks/useRealtimeInvalidator';

describe('useRealtimeInvalidator', () => {
  let qc: QueryClient;
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>;

  beforeEach(() => {
    vi.useFakeTimers();
    qc = new QueryClient();
    Object.keys(canal.handlers).forEach((k) => delete canal.handlers[k]);
  });
  afterEach(() => vi.useRealTimers());

  it('escuta só as tabelas publicadas no realtime', () => {
    renderHook(() => useRealtimeInvalidator(), { wrapper });
    expect(Object.keys(canal.handlers).sort()).toEqual([
      'acertos_diarios',
      'entregas',
      'entregas_cestas_vendedor',
      'estoque_vendedor',
      'lancamentos_caixa',
      'movimentacoes_estoque',
      'pagamentos',
    ]);
  });

  it('um pagamento novo marca Devedores e Pagamentos como desatualizados, agrupando eventos seguidos', () => {
    const spy = vi.spyOn(qc, 'invalidateQueries');
    renderHook(() => useRealtimeInvalidator(), { wrapper });
    qc.setQueryData(['devedores', 'admin-1'], []);
    qc.setQueryData(['pagamentos', 'admin-1'], []);
    qc.setQueryData(['funcionarios', 'admin-1'], []);

    canal.handlers.pagamentos();
    canal.handlers.pagamentos();
    expect(spy).not.toHaveBeenCalled();
    vi.advanceTimersByTime(900);

    expect(spy).toHaveBeenCalledTimes(1);
    expect(qc.getQueryState(['devedores', 'admin-1'])?.isInvalidated).toBe(true);
    expect(qc.getQueryState(['pagamentos', 'admin-1'])?.isInvalidated).toBe(true);
    expect(qc.getQueryState(['funcionarios', 'admin-1'])?.isInvalidated).toBe(false);
  });

  it('remove o canal ao sair', () => {
    const { unmount } = renderHook(() => useRealtimeInvalidator(), { wrapper });
    unmount();
    expect(removeChannel).toHaveBeenCalled();
  });
});
