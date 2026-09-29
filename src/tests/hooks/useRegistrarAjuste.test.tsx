import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

const mockFrom = vi.fn();
const mockRegistrar = vi.fn();

const { mockUseAuth } = vi.hoisted(() => ({ mockUseAuth: vi.fn() }));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: (...args: unknown[]) => mockUseAuth(...args),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

vi.mock('@/services/ajusteEstoqueService', () => ({
  registrarAjusteEstoqueSeguro: (...args: unknown[]) => mockRegistrar(...args),
}));

import { useMovimentacoesEstoque } from '../../hooks/useMovimentacoesEstoque';

function Wrapper({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

describe('useMovimentacoesEstoque.registrarMovimentacao', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Sem adminId: leitura desabilitada; mutação não depende de sessão local.
    mockUseAuth.mockReturnValue({
      userProfile: null,
      userType: null,
    });
    mockRegistrar.mockResolvedValue({ success: true });
  });

  it('9. delega ao service com só dados de negócio', async () => {
    const { result } = renderHook(() => useMovimentacoesEstoque(), { wrapper: Wrapper });
    await act(async () => {
      await result.current.registrarMovimentacao({
        produto_id: 'prod-1',
        tipo_movimentacao: 'saida_perda',
        quantidade: 3,
        motivo: 'Perda/Quebra',
        observacoes: 'obs',
        lote: 'L1',
        fornecedor: 'Forn',
      });
    });
    expect(mockRegistrar).toHaveBeenCalledTimes(1);
    expect(mockRegistrar).toHaveBeenCalledWith({
      produtoId: 'prod-1',
      tipoMovimentacao: 'saida_perda',
      quantidade: 3,
      motivo: 'Perda/Quebra',
      observacoes: 'obs',
      lote: 'L1',
      fornecedor: 'Forn',
    });
  });

  it('10/11. sem quantidade_anterior/nova no cliente', async () => {
    const { result } = renderHook(() => useMovimentacoesEstoque(), { wrapper: Wrapper });
    await act(async () => {
      await result.current.registrarMovimentacao({
        produto_id: 'prod-1',
        tipo_movimentacao: 'entrada_ajuste',
        quantidade: 2,
        motivo: 'Inventário',
      });
    });
    const arg = mockRegistrar.mock.calls[0][0] as Record<string, unknown>;
    expect(arg).not.toHaveProperty('quantidade_anterior');
    expect(arg).not.toHaveProperty('quantidade_nova');
    expect(arg).not.toHaveProperty('administrador_id');
    expect(Object.keys(arg).sort()).toEqual(
      ['fornecedor', 'lote', 'motivo', 'observacoes', 'produtoId', 'quantidade', 'tipoMovimentacao'].sort(),
    );
  });

  it('12. mutação não busca estoque para fins de autoridade', async () => {
    const { result } = renderHook(() => useMovimentacoesEstoque(), { wrapper: Wrapper });
    await act(async () => {
      await result.current.registrarMovimentacao({
        produto_id: 'prod-1',
        tipo_movimentacao: 'entrada_ajuste',
        quantidade: 1,
        motivo: 'Inventário',
      });
    });
    // Nenhuma leitura de estoque para fins de autoridade durante o ajuste.
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('20. leitura de movimentações continua funcionando', async () => {
    mockUseAuth.mockReturnValue({
      userProfile: { id: 'admin-1', nome: 'Admin' },
      userType: 'admin',
    });
    // Cadeia thenable como o builder real do supabase.
    const chain: Record<string, unknown> = {};
    chain.then = (resolve: (v: unknown) => void) =>
      resolve({ data: [], error: null });
    chain.eq = vi.fn(() => chain);
    chain.order = vi.fn(() => chain);
    mockFrom.mockReturnValue({ select: vi.fn(() => chain) });

    const { result } = renderHook(() => useMovimentacoesEstoque(), { wrapper: Wrapper });
    await waitFor(() => expect(mockFrom).toHaveBeenCalledWith('movimentacoes_estoque'));
    await waitFor(() => expect(result.current.movimentacoes).toEqual([]));
  });
});
