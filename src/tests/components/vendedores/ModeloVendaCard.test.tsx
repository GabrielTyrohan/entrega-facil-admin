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
      { id: 'pj-1', razao_social: 'Revenda Ltda', nome_fantasia: null, nome: null, cnpj: '38347228000125', vendedor_id: 'vend-1' },
    ],
    isLoading: false,
  }),
  useDefinirModeloVendedor: () => ({ mutateAsync: mockDefinir, isPending: false }),
}));

vi.mock('@/utils/toast', () => ({
  toast: { success: vi.fn(), error: mockToastError },
}));

import ModeloVendaCard, { mascaraCnpj } from '@/components/vendedores/ModeloVendaCard';

function renderCard(props: Partial<React.ComponentProps<typeof ModeloVendaCard>> = {}) {
  return render(
    <MemoryRouter>
      <ModeloVendaCard vendedorId="vend-1" modeloAtual="consignado" clientePjAtual={null} podeAlterar {...props} />
    </MemoryRouter>,
  );
}

const campoCnpj = () => screen.getByPlaceholderText('00.000.000/0000-00') as HTMLInputElement;

describe('ModeloVendaCard (Fase 9 — revendedor)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDefinir.mockResolvedValue({ vendedor_id: 'vend-1', modelo_venda: 'revendedor', cliente_pj_id: 'pj-1' });
  });

  it('formata o CNPJ enquanto digita', () => {
    expect(mascaraCnpj('38347228000125')).toBe('38.347.228/0001-25');
    expect(mascaraCnpj('3834')).toBe('38.34');
    expect(mascaraCnpj('38.347.228/0001-2599')).toBe('38.347.228/0001-25');
  });

  it('exige o CNPJ completo antes de virar revendedor', () => {
    renderCard();
    fireEvent.click(screen.getByRole('radio', { name: /Revendedor/ }));
    fireEvent.change(campoCnpj(), { target: { value: '38347' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar modelo de venda' }));
    expect(mockDefinir).not.toHaveBeenCalled();
    expect(mockToastError).toHaveBeenCalledWith('Informe o CNPJ do revendedor (14 números)');
  });

  it('preenche com o CNPJ do vendedor e manda só os números', async () => {
    const onAlterado = vi.fn();
    renderCard({ onAlterado, cnpjVendedor: '38.347.228/0001-25' });
    fireEvent.click(screen.getByRole('radio', { name: /Revendedor/ }));
    expect(campoCnpj().value).toBe('38.347.228/0001-25');
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar modelo de venda' }));
    await waitFor(() =>
      expect(mockDefinir).toHaveBeenCalledWith({ vendedorId: 'vend-1', modelo: 'revendedor', cnpj: '38347228000125' }),
    );
    expect(onAlterado).toHaveBeenCalled();
  });

  it('mostra o cadastro já ligado e não pede para salvar de novo', () => {
    renderCard({ modeloAtual: 'revendedor', clientePjAtual: 'pj-1' });
    expect(campoCnpj().value).toBe('38.347.228/0001-25');
    expect(screen.getByText('Revenda Ltda')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Confirmar modelo de venda' })).toBeNull();
  });

  it('funcionária vê o modelo mas não altera', () => {
    renderCard({ podeAlterar: false, modeloAtual: 'revendedor', clientePjAtual: 'pj-1' });
    expect(screen.getByRole('radio', { name: /Revendedor/ })).toBeDisabled();
    expect(campoCnpj()).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Confirmar modelo de venda' })).toBeNull();
    expect(screen.getByText('Só o dono da empresa pode trocar o modelo de venda.')).toBeInTheDocument();
  });
});
