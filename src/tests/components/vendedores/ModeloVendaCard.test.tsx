import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';

const { mockDefinir, mockToastError } = vi.hoisted(() => ({
  mockDefinir: vi.fn(),
  mockToastError: vi.fn(),
}));

vi.mock('@/hooks/useRevendedores', () => ({
  useClientesPJ: () => ({
    data: [
      { id: 'pj-1', razao_social: 'Revenda Ltda', nome_fantasia: null, nome: null, cnpj: '12.345.678/0001-90', vendedor_id: 'escritorio' },
      // Cadastro na carteira do próprio vendedor não pode ser escolhido
      { id: 'pj-2', razao_social: 'Da Carteira', nome_fantasia: null, nome: null, cnpj: '98.765.432/0001-10', vendedor_id: 'vend-1' },
      // Sem CNPJ também não
      { id: 'pj-3', razao_social: 'Sem CNPJ', nome_fantasia: null, nome: null, cnpj: '', vendedor_id: 'escritorio' },
    ],
    isLoading: false,
  }),
  useDefinirModeloVendedor: () => ({ mutateAsync: mockDefinir, isPending: false }),
}));

vi.mock('@/utils/toast', () => ({
  toast: { success: vi.fn(), error: mockToastError },
}));

import ModeloVendaCard from '@/components/vendedores/ModeloVendaCard';

function renderCard(props: Partial<React.ComponentProps<typeof ModeloVendaCard>> = {}) {
  return render(
    <MemoryRouter>
      <ModeloVendaCard vendedorId="vend-1" modeloAtual="consignado" clientePjAtual={null} podeAlterar {...props} />
    </MemoryRouter>,
  );
}

describe('ModeloVendaCard (Fase 9 — revendedor)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDefinir.mockResolvedValue({ vendedor_id: 'vend-1', modelo_venda: 'revendedor', cliente_pj_id: 'pj-1' });
  });

  it('só mostra cadastros PJ com CNPJ que não estão na carteira do vendedor', () => {
    renderCard();
    fireEvent.click(screen.getByRole('radio', { name: /Revendedor/ }));
    const opcoes = screen.getAllByRole('option').map((o) => o.textContent);
    expect(opcoes.some((t) => t?.includes('Revenda Ltda'))).toBe(true);
    expect(opcoes.some((t) => t?.includes('Da Carteira'))).toBe(false);
    expect(opcoes.some((t) => t?.includes('Sem CNPJ'))).toBe(false);
  });

  it('exige o CNPJ antes de virar revendedor', async () => {
    renderCard();
    fireEvent.click(screen.getByRole('radio', { name: /Revendedor/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar modelo de venda' }));
    expect(mockDefinir).not.toHaveBeenCalled();
    expect(mockToastError).toHaveBeenCalledWith('Escolha o cadastro PJ (CNPJ) do revendedor');
  });

  it('chama definir_modelo_vendedor com o CNPJ escolhido', async () => {
    const onAlterado = vi.fn();
    renderCard({ onAlterado });
    fireEvent.click(screen.getByRole('radio', { name: /Revendedor/ }));
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'pj-1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar modelo de venda' }));
    await waitFor(() =>
      expect(mockDefinir).toHaveBeenCalledWith({ vendedorId: 'vend-1', modelo: 'revendedor', clientePjId: 'pj-1' }),
    );
    expect(onAlterado).toHaveBeenCalled();
  });

  it('funcionária vê o modelo mas não altera', () => {
    renderCard({ podeAlterar: false, modeloAtual: 'revendedor', clientePjAtual: 'pj-1' });
    expect(screen.getByRole('radio', { name: /Revendedor/ })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Confirmar modelo de venda' })).toBeNull();
    expect(screen.getByText('Só o dono da empresa pode trocar o modelo de venda.')).toBeInTheDocument();
  });
});
