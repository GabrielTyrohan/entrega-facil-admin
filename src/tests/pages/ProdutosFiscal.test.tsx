import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

const { mockUseAuth } = vi.hoisted(() => ({ mockUseAuth: vi.fn() }));
const mockUpdate = vi.fn();
const mockRpc = vi.fn();

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: (...args: unknown[]) => mockUseAuth(...args),
}));

vi.mock('../../hooks/useProdutos', () => ({
  useProdutos: () => ({
    data: [
      { id: '1', produto_nome: 'Arroz 5kg', produto_cod: 'ALI-001', categoria: 'Alimentos', qtd_estoque: 10, preco_unt: 25, fiscal_status: 'pendente_revisao' },
      { id: '2', produto_nome: 'Feijão 1kg', produto_cod: 'ALI-002', categoria: 'Alimentos', qtd_estoque: 5, preco_unt: 8, fiscal_status: null },
      { id: '3', produto_nome: 'Sabão', produto_cod: 'LIM-001', categoria: 'Limpeza', qtd_estoque: 20, preco_unt: 12, fiscal_status: 'validado' },
      { id: '4', produto_nome: 'Detergente', produto_cod: 'LIM-002', categoria: 'Limpeza', qtd_estoque: 0, preco_unt: 3, fiscal_status: 'bloqueado' },
    ],
    count: 4,
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  }),
  useDeleteProduto: () => ({ mutateAsync: vi.fn() }),
  useUpdateProduto: () => ({ mutateAsync: mockUpdate, isPending: false }),
}));

vi.mock('../../components/ui/ProdutoModal', () => ({
  default: () => null,
  ORIGEM_MERCADORIA_OPTIONS: [{ value: 0, label: '0 - Nacional' }],
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: (...args: unknown[]) => mockRpc(...args),
  },
}));

import Produtos from '../../pages/Produtos';

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  mockUseAuth.mockReturnValue({
    isLoading: false,
    userType: 'admin',
    adminId: 'admin-1',
    user: { id: 'admin-1' },
    permissions: { produtos: true },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <Produtos />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('Produtos — status fiscal na listagem', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('1. produtos pendentes aparecem com indicador (nulo = pendente)', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Arroz 5kg')).toBeInTheDocument());
    // Nulo e pendente exibem "Pendente de revisão" (badge coluna + mobile).
    expect(screen.getAllByText('Pendente de revisão').length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText('Validado').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Bloqueado').length).toBeGreaterThanOrEqual(1);
  });

  it('2. filtro por status fiscal localiza pendentes', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Arroz 5kg')).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText('Filtrar por status fiscal'), {
      target: { value: 'pendente_revisao' },
    });
    expect(screen.getByText('Arroz 5kg')).toBeInTheDocument();
    expect(screen.getByText('Feijão 1kg')).toBeInTheDocument();
    expect(screen.queryByText('Sabão')).not.toBeInTheDocument();
    expect(screen.queryByText('Detergente')).not.toBeInTheDocument();
  });

  it('3. produto pode ser aberto para revisão a partir da lista', async () => {
    const usuario = userEvent.setup();
    renderPage();
    await waitFor(() => expect(screen.getByText('Arroz 5kg')).toBeInTheDocument());
    const linhas = screen.getAllByRole('row');
    const primeiraLinha = linhas.find((l) => within(l).queryByText('Arroz 5kg'));
    if (!primeiraLinha) throw new Error('linha do produto não encontrada');
    await usuario.click(within(primeiraLinha).getByRole('button'));
    await usuario.click(await screen.findByRole('menuitem', { name: /revisão fiscal/i }));
    expect(await screen.findByText('Revisão fiscal')).toBeInTheDocument();
  });
});
