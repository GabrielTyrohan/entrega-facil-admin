import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const { mockFechar, mockPagar, mockResumo, mockFechamentos } = vi.hoisted(() => ({
  mockFechar: vi.fn(),
  mockPagar: vi.fn(),
  mockResumo: { current: [] as unknown[] },
  mockFechamentos: { current: [] as unknown[] },
}));

vi.mock('@/hooks/useComissoes', () => ({
  useComissoesVendedores: () => ({ data: mockResumo.current, isLoading: false, error: null }),
  useFechamentos: () => ({ data: mockFechamentos.current }),
  useFecharPeriodo: () => ({ mutateAsync: mockFechar, isPending: false }),
  useMarcarComissaoPaga: () => ({ mutateAsync: mockPagar, isPending: false }),
}));

vi.mock('@/utils/toast', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));

import Comissoes from '../../pages/Comissoes';

const calc = (over: Record<string, unknown>) => ({
  vendedor_id: 'v1',
  periodo_inicio: '2026-10-10',
  periodo_fim: '2026-11-09',
  total_recebido: 1000,
  qtd_pagamentos: 10,
  ajustes: 0,
  qtd_ajustes: 0,
  base_calculo: 1000,
  percentual: 5,
  valor_comissao: 50,
  encerrado: true,
  fechamento_id: null,
  status: 'aberto',
  ...over,
});

describe('Comissoes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    mockFechamentos.current = [];
  });

  it('período anterior encerrado e aberto mostra "Fechar período" e envia o início da janela', async () => {
    mockResumo.current = [{
      vendedor: { id: 'v1', nome: 'João', comissao_percentual: 5, dia_fechamento: 10 },
      anterior: calc({}),
      atual: calc({ periodo_inicio: '2026-11-10', periodo_fim: '2026-12-09', encerrado: false, valor_comissao: 10 }),
    }];
    mockFechar.mockResolvedValue({});
    render(<Comissoes />);

    expect(screen.getByText('10/10/2026 a 09/11/2026')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Fechar período/ }));
    await waitFor(() => expect(mockFechar).toHaveBeenCalledWith({ vendedorId: 'v1', periodoInicio: '2026-10-10' }));
  });

  it('período fechado mostra "Marcar paga" com o id do fechamento', async () => {
    mockResumo.current = [{
      vendedor: { id: 'v1', nome: 'João', comissao_percentual: 5, dia_fechamento: 10 },
      anterior: calc({ status: 'fechado', fechamento_id: 'f1' }),
      atual: calc({ periodo_inicio: '2026-11-10', periodo_fim: '2026-12-09', encerrado: false }),
    }];
    mockPagar.mockResolvedValue(undefined);
    render(<Comissoes />);

    expect(screen.queryByRole('button', { name: /Fechar período/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Marcar paga/ }));
    await waitFor(() => expect(mockPagar).toHaveBeenCalledWith('f1'));
  });

  it('período em andamento não permite fechar', () => {
    mockResumo.current = [{
      vendedor: { id: 'v1', nome: 'João', comissao_percentual: 5, dia_fechamento: 10 },
      anterior: calc({ encerrado: false }),
      atual: calc({ encerrado: false }),
    }];
    render(<Comissoes />);
    expect(screen.queryByRole('button', { name: /Fechar período/ })).not.toBeInTheDocument();
  });
});
