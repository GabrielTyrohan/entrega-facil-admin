import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const { mockAtender, mockRecusar, mockPedidos } = vi.hoisted(() => ({
  mockAtender: vi.fn(),
  mockRecusar: vi.fn(),
  mockPedidos: { current: [] as unknown[] },
}));

vi.mock('@/hooks/usePedidosVendedor', () => ({
  usePedidosVendedor: () => ({ data: mockPedidos.current, isLoading: false, error: null }),
  useAtenderPedido: () => ({ mutateAsync: mockAtender, isPending: false }),
  useRecusarPedido: () => ({ mutateAsync: mockRecusar, isPending: false }),
  usePedidosPendentesCount: () => ({ data: 1 }),
}));

vi.mock('@/utils/toast', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));

import PedidosVendedores from '../../pages/PedidosVendedores';

const PEDIDO = {
  id: 'p1',
  numero: 7,
  vendedor_id: 'v1',
  status: 'pendente',
  observacao: 'Preciso para amanhã',
  resposta: null,
  atendido_por_nome: null,
  atendido_em: null,
  created_at: '2026-11-16T10:00:00Z',
  vendedor: { nome: 'João' },
  itens: [
    { id: 'i1', tipo: 'cesta', descricao: 'Cesta P', quantidade_solicitada: 5, quantidade_atendida: 0, cesta_id: 'c1', produto_cadastrado_id: null },
    { id: 'i2', tipo: 'avulso', descricao: 'Arroz 5kg', quantidade_solicitada: 2, quantidade_atendida: 0, cesta_id: null, produto_cadastrado_id: 'a1' },
  ],
};

describe('PedidosVendedores', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPedidos.current = [PEDIDO];
  });

  it('lista o pedido aguardando com o vendedor e os itens', () => {
    render(<PedidosVendedores />);
    expect(screen.getByText('#7 · João')).toBeInTheDocument();
    expect(screen.getByText('5× Cesta P, 2× Arroz 5kg')).toBeInTheDocument();
  });

  it('liberar envia as quantidades de cada item (atendimento parcial)', async () => {
    mockAtender.mockResolvedValue({ id: 'p1', status: 'parcial' });
    render(<PedidosVendedores />);
    fireEvent.click(screen.getByText('#7 · João'));

    const inputs = screen.getAllByRole('spinbutton');
    fireEvent.change(inputs[0], { target: { value: '3' } });
    expect(screen.getByText('Será registrado como atendido em parte.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Liberar ao vendedor/ }));
    await waitFor(() =>
      expect(mockAtender).toHaveBeenCalledWith({
        pedidoId: 'p1',
        itens: [
          { item_id: 'i1', quantidade: 3 },
          { item_id: 'i2', quantidade: 2 },
        ],
        resposta: undefined,
      })
    );
  });

  it('recusar exige motivo', async () => {
    mockRecusar.mockResolvedValue({ id: 'p1', status: 'recusado' });
    render(<PedidosVendedores />);
    fireEvent.click(screen.getByText('#7 · João'));
    fireEvent.click(screen.getByRole('button', { name: 'Recusar' }));

    const confirmar = screen.getByRole('button', { name: 'Confirmar recusa' });
    expect(confirmar).toBeDisabled();

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Sem estoque de Cesta P' } });
    fireEvent.click(confirmar);
    await waitFor(() =>
      expect(mockRecusar).toHaveBeenCalledWith({ pedidoId: 'p1', motivo: 'Sem estoque de Cesta P' })
    );
  });
});
