import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

const mockRegistrar = vi.fn();

vi.mock('@/services/entregaCestaService', () => ({
  registrarEntregaCesta: (...args: unknown[]) => mockRegistrar(...args),
}));

import { useEntregarCestas } from '../../hooks/useCestas';

function Wrapper({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

describe('useEntregarCestas — delega ao service central', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRegistrar.mockResolvedValue({ success: true, id: 'entrega-abc' });
  });

  it('1. recebe apenas vendedorId, cestaId, quantidade, observacao', async () => {
    const { result } = renderHook(() => useEntregarCestas(), { wrapper: Wrapper });
    await act(async () => {
      await result.current.mutateAsync({
        vendedorId: 'vend-1',
        cestaId: 'cesta-1',
        quantidade: 2,
        observacao: 'obs',
      });
    });
    expect(mockRegistrar).toHaveBeenCalledTimes(1);
    expect(mockRegistrar).toHaveBeenCalledWith({
      vendedorId: 'vend-1',
      cestaId: 'cesta-1',
      quantidade: 2,
      observacao: 'obs',
    });
  });

  it('8/11. sucesso retorna id para o fluxo de nota/impressão', async () => {
    const { result } = renderHook(() => useEntregarCestas(), { wrapper: Wrapper });
    let retorno: unknown;
    await act(async () => {
      retorno = await result.current.mutateAsync({
        vendedorId: 'vend-1',
        cestaId: 'cesta-1',
        quantidade: 1,
      });
    });
    expect(retorno).toMatchObject({ success: true, id: 'entrega-abc' });
    expect((retorno as { id: string }).id.slice(0, 8)).toBe('entrega-');
  });
});
