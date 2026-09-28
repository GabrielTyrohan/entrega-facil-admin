import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

const mockFrom = vi.fn();
const mockRpc = vi.fn();
const mockDistribuir = vi.fn();
const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();
const mockNavigate = vi.fn();

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
    rpc: (...args: unknown[]) => mockRpc(...args),
  },
}));

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'admin-1' }, adminId: 'admin-1' }),
}));

vi.mock('../../hooks/useVendedores', () => ({
  useVendedoresByAdmin: () => ({
    data: [
      { id: 'vend-1', nome: 'Vendedor Um', administrador_id: 'admin-1', ativo: true },
    ],
    isLoading: false,
  }),
}));

vi.mock('../../services/cestaBaseService', () => ({
  CestaBaseService: {
    distribuirParaVendedor: (...args: unknown[]) => mockDistribuir(...args),
  },
}));

vi.mock('../../utils/toast', () => ({
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
  },
}));

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => mockNavigate };
});

import NovaCesta from '../../pages/NovaCesta';

const CESTA = {
  id: 'cesta-1',
  administrador_id: 'admin-1',
  nome: 'Cesta Básica',
  descricao: '',
  preco: 100,
  ativo: true,
  cestas_base_itens: [
    {
      id: 'item-1',
      cesta_base_id: 'cesta-1',
      produto_cadastrado_id: 'prod-1',
      quantidade: 1,
      produto: { produto_nome: 'Arroz', preco_unt: 10, qtd_estoque: 100 },
    },
  ],
};

function chainResolve(value: unknown) {
  const chain: Record<string, unknown> = {};
  chain.select = vi.fn(() => chain);
  chain.eq = vi.fn(() => chain);
  chain.in = vi.fn(async () => value);
  chain.order = vi.fn(async () => value);
  return chain;
}

function renderNovaCesta() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <NovaCesta />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

async function selecionarCestaEVendedor() {
  await screen.findByText(/Cesta Básica/);
  const combos = screen.getAllByRole('combobox');
  fireEvent.change(combos[0], { target: { value: 'cesta-1' } });
  fireEvent.change(combos[1], { target: { value: 'vend-1' } });
}

describe('NovaCesta — distribuição via CestaBaseService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDistribuir.mockResolvedValue('nova-cesta-id');
    mockFrom.mockImplementation((tabela: string) => {
      if (tabela === 'cestas_base') {
        return chainResolve({ data: [CESTA], error: null });
      }
      return chainResolve({ data: [], error: null });
    });
  });

  it('7. usa o service central com cesta, vendedor e quantidade', async () => {
    renderNovaCesta();
    await selecionarCestaEVendedor();
    fireEvent.click(screen.getByRole('button', { name: /Emitir Cesta/ }));
    await waitFor(() => expect(mockDistribuir).toHaveBeenCalledTimes(1));
    expect(mockDistribuir).toHaveBeenCalledWith('cesta-1', 'vend-1', 1);
  });

  it('8. não monta RPC duplicada com administrador_id', async () => {
    renderNovaCesta();
    await selecionarCestaEVendedor();
    fireEvent.click(screen.getByRole('button', { name: /Emitir Cesta/ }));
    await waitFor(() => expect(mockDistribuir).toHaveBeenCalledTimes(1));
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('9. sucesso exibe toast e navega para /produtos/cestas', async () => {
    renderNovaCesta();
    await selecionarCestaEVendedor();
    fireEvent.click(screen.getByRole('button', { name: /Emitir Cesta/ }));
    await waitFor(() => expect(mockToastSuccess).toHaveBeenCalledTimes(1));
    expect(mockToastSuccess.mock.calls[0][0]).toContain('Cesta Básica');
    expect(mockNavigate).toHaveBeenCalledWith('/produtos/cestas');
  });

  it('10. erro genérico é exibido no banner', async () => {
    mockDistribuir.mockRejectedValue(new Error('Estoque insuficiente'));
    renderNovaCesta();
    await selecionarCestaEVendedor();
    fireEvent.click(screen.getByRole('button', { name: /Emitir Cesta/ }));
    await waitFor(() =>
      expect(screen.getByText(/Erro ao emitir cesta: Estoque insuficiente/)).toBeInTheDocument(),
    );
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('11. cesta duplicada mantém toast dedicado', async () => {
    mockDistribuir.mockRejectedValue(
      Object.assign(new Error('CESTA_JA_EXISTE:Cesta Básica'), { code: '23505' }),
    );
    renderNovaCesta();
    await selecionarCestaEVendedor();
    fireEvent.click(screen.getByRole('button', { name: /Emitir Cesta/ }));
    await waitFor(() => expect(mockToastError).toHaveBeenCalledTimes(1));
    expect(mockToastError.mock.calls[0][0]).toContain('já possui');
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
