import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';

const { mockUseAuth } = vi.hoisted(() => ({ mockUseAuth: vi.fn() }));
const mockUpdate = vi.fn();
const mockRpc = vi.fn();
const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: (...args: unknown[]) => mockUseAuth(...args),
}));

vi.mock('../../hooks/useProdutos', () => ({
  useUpdateProduto: () => ({ mutateAsync: mockUpdate, isPending: false }),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: (...args: unknown[]) => mockRpc(...args),
  },
}));

vi.mock('@/utils/toast', () => ({
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
  },
}));

import RevisaoFiscalModal from '../../components/RevisaoFiscalModal';

const PRODUTO = {
  id: 'prod-1',
  administrador_id: 'admin-1',
  produto_nome: 'Arroz 5kg',
  produto_cod: 'ALI-123456',
  codigo_barras: '7891000100103',
  categoria: 'Alimentos',
  qtd_estoque: 10,
  preco_unt: 25,
  unidade_medida: 'PCT',
  ncm: '10063021',
  cest: '1704400',
  cfop_padrao: '5102',
  origem_mercadoria: 0,
  cst_icms: '102',
  aliquota_icms: 0,
  cst_pis: '07',
  aliquota_pis: 0,
  cst_cofins: '07',
  aliquota_cofins: 0,
  categoria_fiscal: 'Cesta básica',
  fiscal_status: 'pendente_revisao',
};

function authAdmin() {
  mockUseAuth.mockReturnValue({ userType: 'admin', permissions: { produtos: true } });
}

function renderModal(props: Partial<React.ComponentProps<typeof RevisaoFiscalModal>> = {}) {
  const onClose = vi.fn();
  const onStatusChange = vi.fn();
  render(
    <RevisaoFiscalModal produto={PRODUTO as never} isOpen onClose={onClose} onStatusChange={onStatusChange} {...props} />,
  );
  return { onClose, onStatusChange };
}

describe('RevisaoFiscalModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authAdmin();
    mockUpdate.mockResolvedValue({ ...PRODUTO });
    mockRpc.mockResolvedValue({ data: { success: true }, error: null });
  });

  it('3. abre e exibe identificação + campos fiscais', () => {
    renderModal();
    expect(screen.getByText(/Arroz 5kg/)).toBeInTheDocument();
    expect(screen.getByText(/ALI-123456/)).toBeInTheDocument();
    expect(screen.getByText(/7891000100103/)).toBeInTheDocument();
    expect(screen.getByLabelText('NCM')).toHaveValue('10063021');
    expect(screen.getByLabelText('CEST (quando aplicável)')).toHaveValue('1704400');
    expect(screen.getByLabelText('CFOP sugerido')).toHaveValue('5102');
    expect(screen.getByLabelText('Categoria fiscal')).toHaveValue('Cesta básica');
  });

  it('5. validar chama a RPC e confirma sucesso', async () => {
    const { onClose, onStatusChange } = renderModal();
    fireEvent.click(screen.getByRole('button', { name: /validar classificação fiscal/i }));
    // Janela de revisão com aviso.
    expect(
      screen.getByText(/pessoa autorizada conferiu esta classificação/i),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));
    await waitFor(() => expect(mockRpc).toHaveBeenCalledWith('definir_status_fiscal_produto', {
      p_produto_id: 'prod-1',
      p_status: 'validado',
    }));
    expect(mockToastSuccess).toHaveBeenCalledWith('Classificação fiscal validada.');
    expect(onStatusChange).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('6. sem NCM válido não permite validar', () => {
    renderModal({ produto: { ...PRODUTO, ncm: '' } as never });
    expect(
      screen.getByRole('button', { name: /validar classificação fiscal/i }),
    ).toBeDisabled();
    expect(screen.getByText(/Pendências para validar/i)).toBeInTheDocument();
  });

  it('7. falha na RPC mostra erro sem fechar nem sucesso falso', async () => {
    const { onClose } = renderModal();
    mockRpc.mockResolvedValue({ data: null, error: { message: 'Negado pela RLS' } });
    fireEvent.click(screen.getByRole('button', { name: /validar classificação fiscal/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));
    await waitFor(() => expect(mockToastError).toHaveBeenCalledWith('Negado pela RLS'));
    expect(mockToastSuccess).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('8. sem permissão não valida (só visualiza)', () => {
    mockUseAuth.mockReturnValue({ userType: 'funcionario', permissions: { produtos: false } });
    renderModal();
    expect(
      screen.getByText(/não tem permissão para revisar ou validar/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /validar classificação fiscal/i }),
    ).not.toBeInTheDocument();
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('9. salvar campos não valida automaticamente nem toca em fiscal_status', async () => {
    renderModal();
    fireEvent.click(screen.getByRole('button', { name: /salvar campos fiscais/i }));
    await waitFor(() => expect(mockUpdate).toHaveBeenCalledTimes(1));
    const payload = mockUpdate.mock.calls[0][0] as Record<string, unknown>;
    expect(payload).not.toHaveProperty('fiscal_status');
    expect(payload).not.toHaveProperty('fiscal_validado_em');
    expect(mockRpc).not.toHaveBeenCalled();
    expect(mockToastSuccess).toHaveBeenCalledWith(
      'Campos fiscais salvos. O status continua pendente de validação.',
    );
  });

  it('edição não salva bloqueia a confirmação até salvar (caso NCM 17019900)', async () => {
    renderModal();
    // Digita outro NCM válido — requisitos locais passam, mas nada foi gravado.
    fireEvent.change(screen.getByLabelText('NCM'), { target: { value: '17019900' } });
    fireEvent.click(screen.getByRole('button', { name: /validar classificação fiscal/i }));
    expect(screen.getByText(/há alterações não salvas neste formulário/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Confirmar' })).toBeDisabled();
    expect(mockRpc).not.toHaveBeenCalled();

    // Fecha o diálogo, salva, e aí sim a confirmação libera.
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    fireEvent.click(screen.getByRole('button', { name: /salvar campos fiscais/i }));
    await waitFor(() => expect(mockUpdate).toHaveBeenCalledTimes(1));
    expect(mockUpdate.mock.calls[0][0]).toMatchObject({ ncm: '17019900' });

    fireEvent.click(screen.getByRole('button', { name: /validar classificação fiscal/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));
    await waitFor(() => expect(mockRpc).toHaveBeenCalledWith('definir_status_fiscal_produto', {
      p_produto_id: 'prod-1',
      p_status: 'validado',
    }));
  });

  it('devolver e bloquear usam a mesma RPC', async () => {
    renderModal({ produto: { ...PRODUTO, fiscal_status: 'validado' } as never });
    fireEvent.click(screen.getByRole('button', { name: /bloquear/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));
    await waitFor(() => expect(mockRpc).toHaveBeenCalledWith('definir_status_fiscal_produto', {
      p_produto_id: 'prod-1',
      p_status: 'bloqueado',
    }));
  });
});
