import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

const mockRegistrar = vi.fn();
const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();

vi.mock('../../hooks/useMovimentacoesEstoque', () => ({
  useMovimentacoesEstoque: () => ({
    movimentacoes: [],
    isLoading: false,
    error: null,
    registrarMovimentacao: (...args: unknown[]) => mockRegistrar(...args),
    isRegistrando: false,
  }),
}));

vi.mock('../../hooks/useProdutos', () => ({
  useProdutos: () => ({
    data: [
      {
        id: 'prod-1',
        produto_nome: 'Arroz',
        produto_cod: 'A1',
        categoria: 'Grãos',
        qtd_estoque: 50,
      },
    ],
  }),
}));

vi.mock('../../utils/toast', () => ({
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
  },
}));

import MovimentacoesEstoque from '../../pages/Estoque/MovimentacoesEstoque';

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <MovimentacoesEstoque />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

function abrirModal() {
  fireEvent.click(screen.getByText('Registrar Ajuste'));
}

function selecionarProduto() {
  fireEvent.click(screen.getByText('Selecione ou pesquise um produto...'));
  // "Arroz" existe também no <option> do filtro; o item do combobox do modal é um div.
  const opcoes = screen.getAllByText('Arroz');
  const itemModal = opcoes.find((el) => el.tagName !== 'OPTION');
  if (!itemModal) throw new Error('item do combobox não encontrado');
  fireEvent.click(itemModal);
}

function preencherQuantidadeMotivo(quantidade: string, motivo: string) {
  fireEvent.change(screen.getByRole('spinbutton'), { target: { value: quantidade } });
  const selects = screen.getAllByRole('combobox') as HTMLSelectElement[];
  const motivoSelect = selects.find((s) =>
    Array.from(s.options).some((o) => o.text === 'Inventário'),
  );
  if (!motivoSelect) throw new Error('select de motivo não encontrado');
  fireEvent.change(motivoSelect, { target: { value: motivo } });
}

function confirmar() {
  fireEvent.click(screen.getByText('Confirmar Ajuste'));
}

describe('MovimentacoesEstoque — ajuste manual', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRegistrar.mockResolvedValue({ success: true });
  });

  it('13. fluxo visual continua funcionando (produto/tipo/qtd/motivo → toast)', async () => {
    renderPage();
    abrirModal();
    selecionarProduto();
    preencherQuantidadeMotivo('5', 'Inventário');
    confirmar();
    await waitFor(() => expect(mockRegistrar).toHaveBeenCalledTimes(1));
    expect(mockRegistrar).toHaveBeenCalledWith({
      produto_id: 'prod-1',
      tipo_movimentacao: 'entrada_ajuste',
      quantidade: 5,
      motivo: 'Inventário',
      observacoes: '',
    });
    expect(mockToastSuccess).toHaveBeenCalledWith('Ajuste registrado com sucesso!');
    await waitFor(() =>
      expect(screen.queryByText('Registrar Ajuste Manual')).not.toBeInTheDocument(),
    );
  });

  it('14. quantidade <= 0 bloqueada', async () => {
    renderPage();
    abrirModal();
    selecionarProduto();
    preencherQuantidadeMotivo('', 'Inventário');
    confirmar();
    expect(mockToastError).toHaveBeenCalledWith('Quantidade inválida');
    expect(mockRegistrar).not.toHaveBeenCalled();
  });

  it('14b. produto obrigatório', async () => {
    renderPage();
    abrirModal();
    confirmar();
    expect(mockToastError).toHaveBeenCalledWith('Selecione um produto');
    expect(mockRegistrar).not.toHaveBeenCalled();
  });

  it('15. motivo vazio bloqueado', async () => {
    renderPage();
    abrirModal();
    selecionarProduto();
    preencherQuantidadeMotivo('5', '');
    confirmar();
    expect(mockToastError).toHaveBeenCalledWith('Informe o motivo');
    expect(mockRegistrar).not.toHaveBeenCalled();
  });

  it('17. erro continua tratado', async () => {
    mockRegistrar.mockRejectedValue(new Error('Falha no servidor'));
    renderPage();
    abrirModal();
    selecionarProduto();
    preencherQuantidadeMotivo('5', 'Inventário');
    confirmar();
    await waitFor(() => expect(mockToastError).toHaveBeenCalledWith('Falha no servidor'));
  });

  it('19. modal de ajuste oferece só os 4 tipos permitidos', () => {
    renderPage();
    abrirModal();
    // Tipos do modal são <button>; os mesmos rótulos existem nos <option> do filtro.
    for (const label of [
      'Entrada (Ajuste)',
      'Saída (Ajuste)',
      'Saída (Perda)',
      'Entrada (Devolução)',
    ]) {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
    }
    for (const proibido of [
      'Entrada (Compra)',
      'Entrada (Transferência)',
      'Saída (Venda)',
      'Saída (Devolução)',
      'Saída (Transferência)',
    ]) {
      expect(screen.queryByRole('button', { name: proibido })).not.toBeInTheDocument();
    }
  });
});
