import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';

const { mockCreate, mockUpdate } = vi.hoisted(() => ({
  mockCreate: vi.fn(),
  mockUpdate: vi.fn(),
}));

vi.mock('../../hooks/useFuncionarios', () => ({
  useCreateFuncionario: () => ({ mutateAsync: mockCreate, isPending: false }),
  useUpdateFuncionario: () => ({ mutateAsync: mockUpdate, isPending: false }),
}));

import FuncionarioModal from '../../components/FuncionarioModal';
import type { FuncionarioPermissions } from '../../services/funcionarioAdminService';

function renderModalCriacao(onClose = vi.fn()) {
  return render(
    <FuncionarioModal isOpen onClose={onClose} funcionarioToEdit={null} />,
  );
}

function preencherObrigatorios() {
  fireEvent.change(screen.getByPlaceholderText('Ex: João da Silva'), {
    target: { value: 'João da Silva' },
  });
  fireEvent.change(screen.getByPlaceholderText('Ex: joao@empresa.com'), {
    target: { value: 'joao@empresa.com' },
  });
}

describe('permissão produtos — tipos e modal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreate.mockResolvedValue({ success: true });
    mockUpdate.mockResolvedValue({ success: true });
  });

  it('1. FuncionarioPermissions inclui produtos', () => {
    const permissoes: FuncionarioPermissions = {
      orcamentos_pj: false,
      vendas_atacado: false,
      notas_fiscais: false,
      caixa: false,
      acertos: false,
      relatorios: false,
      vendedores: false,
      produtos: true,
      expedicao: false,
    };
    expect(permissoes.produtos).toBe(true);
    expect('produtos' in permissoes).toBe(true);
  });

  it('2. DEFAULT_PERMISSIONS contém produtos=false (payload padrão)', async () => {
    renderModalCriacao();
    preencherObrigatorios();
    fireEvent.click(screen.getByRole('button', { name: 'Criar Funcionário' }));
    await waitFor(() => expect(mockCreate).toHaveBeenCalledTimes(1));
    const payload = mockCreate.mock.calls[0][0] as {
      permissoes: Record<string, boolean>;
    };
    expect(payload.permissoes.produtos).toBe(false);
  });

  it('3. checkbox Produtos aparece', () => {
    renderModalCriacao();
    expect(screen.getByText('produtos')).toBeInTheDocument();
  });

  it('4. produtos=true é enviado no create', async () => {
    renderModalCriacao();
    preencherObrigatorios();
    fireEvent.click(screen.getByRole('checkbox', { name: 'produtos' }));
    fireEvent.click(screen.getByRole('button', { name: 'Criar Funcionário' }));
    await waitFor(() => expect(mockCreate).toHaveBeenCalledTimes(1));
    const payload = mockCreate.mock.calls[0][0] as {
      permissoes: Record<string, boolean>;
    };
    expect(payload.permissoes.produtos).toBe(true);
  });

  it('5. expedicao=true força produtos=false', async () => {
    renderModalCriacao();
    preencherObrigatorios();
    fireEvent.click(screen.getByRole('checkbox', { name: 'produtos' }));
    const caixas = screen.getAllByRole('checkbox');
    fireEvent.click(caixas[0]); // toggle de expedição (primeiro checkbox do card)
    fireEvent.click(screen.getByRole('button', { name: 'Criar Funcionário' }));
    await waitFor(() => expect(mockCreate).toHaveBeenCalledTimes(1));
    const payload = mockCreate.mock.calls[0][0] as {
      permissoes: Record<string, boolean>;
    };
    expect(payload.permissoes.expedicao).toBe(true);
    expect(payload.permissoes.produtos).toBe(false);
    expect(payload.permissoes.vendedores).toBe(false);
  });
});
