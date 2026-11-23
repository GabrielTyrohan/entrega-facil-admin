import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

type Handler = (payload?: { new?: Record<string, unknown> | null; old?: Record<string, unknown> | null }) => void;
const { canal, removeChannel, consultaProdutos } = vi.hoisted(() => {
  // handlers[tabela] = o de INSERT (os testes simulam inclusões); assinaturas guarda todas.
  const handlers: Record<string, Handler> = {};
  const assinaturas: { table: string; event: string; filter?: string }[] = [];
  const canal = {
    handlers,
    assinaturas,
    on: vi.fn((_tipo: string, filtro: { table: string; event: string; filter?: string }, cb: Handler) => {
      assinaturas.push({ table: filtro.table, event: filtro.event, filter: filtro.filter });
      if (filtro.event === 'INSERT') handlers[filtro.table] = cb;
      return canal;
    }),
    subscribe: vi.fn(() => canal),
  };
  const consultaProdutos = { in: vi.fn() };
  return { canal, removeChannel: vi.fn(), consultaProdutos };
});

vi.mock('@/lib/supabase', () => ({
  supabase: {
    channel: vi.fn(() => canal),
    removeChannel,
    from: vi.fn(() => ({ select: vi.fn(() => consultaProdutos) })),
  },
}));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ adminId: 'admin-1' }) }));

import { useRealtimeInvalidator } from '@/hooks/useRealtimeInvalidator';

describe('useRealtimeInvalidator', () => {
  let qc: QueryClient;
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>;

  beforeEach(() => {
    vi.useFakeTimers();
    qc = new QueryClient();
    Object.keys(canal.handlers).forEach((k) => delete canal.handlers[k]);
    canal.assinaturas.length = 0;
    consultaProdutos.in.mockReset();
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

  it('inclusões e alterações vêm filtradas pela empresa; exclusões sem filtro (o Supabase não filtra DELETE)', () => {
    renderHook(() => useRealtimeInvalidator(), { wrapper });
    const tabelas = [...new Set(canal.assinaturas.map((a) => a.table))];
    expect(tabelas).toHaveLength(7);
    for (const tabela of tabelas) {
      const daTabela = canal.assinaturas.filter((a) => a.table === tabela);
      expect(daTabela).toEqual([
        { table: tabela, event: 'INSERT', filter: 'administrador_id=eq.admin-1' },
        { table: tabela, event: 'UPDATE', filter: 'administrador_id=eq.admin-1' },
        { table: tabela, event: 'DELETE', filter: undefined },
      ]);
    }
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

  it('movimentação de estoque troca só o produto que mudou, sem baixar a lista inteira', async () => {
    consultaProdutos.in.mockResolvedValueOnce({
      data: [{ id: 'p1', produto_nome: 'Arroz', qtd_estoque: 7, custo_compra: 5 }],
      error: null,
    });
    renderHook(() => useRealtimeInvalidator(), { wrapper });
    const lista = ['produtos_cadastrado', 'admin-1', { page: 1 }];
    qc.setQueryData(lista, {
      data: [
        { id: 'p1', produto_nome: 'Arroz', qtd_estoque: 10 },
        { id: 'p2', produto_nome: 'Feijão', qtd_estoque: 4 },
      ],
      count: 2,
    });
    qc.setQueryData(['produtos_cadastrado', 'p1'], { id: 'p1', produto_nome: 'Arroz', qtd_estoque: 10, custo_compra: 4 });

    canal.handlers.movimentacoes_estoque({ new: { produto_cadastrado_id: 'p1', tipo_movimentacao: 'saida_vendedor' } });
    canal.handlers.movimentacoes_estoque({ new: { produto_cadastrado_id: 'p1', tipo_movimentacao: 'saida_vendedor' } });
    await vi.advanceTimersByTimeAsync(900);

    expect(consultaProdutos.in).toHaveBeenCalledTimes(1);
    expect(consultaProdutos.in).toHaveBeenCalledWith('id', ['p1']);
    expect(qc.getQueryState(lista)?.isInvalidated).toBe(false);
    expect(qc.getQueryData(lista)).toEqual({
      data: [
        // só os campos que a lista já tinha
        { id: 'p1', produto_nome: 'Arroz', qtd_estoque: 7 },
        { id: 'p2', produto_nome: 'Feijão', qtd_estoque: 4 },
      ],
      count: 2,
    });
    expect(qc.getQueryData(['produtos_cadastrado', 'p1'])).toEqual({ id: 'p1', produto_nome: 'Arroz', qtd_estoque: 7, custo_compra: 5 });
  });

  it('movimentação sem id do produto recarrega a lista de produtos', async () => {
    renderHook(() => useRealtimeInvalidator(), { wrapper });
    const lista = ['produtos_cadastrado', 'admin-1', { page: 1 }];
    qc.setQueryData(lista, { data: [], count: 0 });

    canal.handlers.movimentacoes_estoque({ new: {}, old: { id: 'm1' } });
    await vi.advanceTimersByTimeAsync(900);

    expect(consultaProdutos.in).not.toHaveBeenCalled();
    expect(qc.getQueryState(lista)?.isInvalidated).toBe(true);
  });

  it('se a busca dos produtos falhar, recarrega a lista', async () => {
    consultaProdutos.in.mockResolvedValueOnce({ data: null, error: { message: 'falhou' } });
    renderHook(() => useRealtimeInvalidator(), { wrapper });
    const lista = ['produtos_cadastrado', 'admin-1', { page: 1 }];
    qc.setQueryData(lista, { data: [{ id: 'p1', qtd_estoque: 1 }], count: 1 });

    canal.handlers.movimentacoes_estoque({ new: { produto_cadastrado_id: 'p1' } });
    await vi.advanceTimersByTimeAsync(900);

    expect(qc.getQueryState(lista)?.isInvalidated).toBe(true);
  });

  it('remove o canal ao sair', () => {
    const { unmount } = renderHook(() => useRealtimeInvalidator(), { wrapper });
    unmount();
    expect(removeChannel).toHaveBeenCalled();
  });
});
