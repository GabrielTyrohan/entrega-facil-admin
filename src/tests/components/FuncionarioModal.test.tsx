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

async function enviar() {
  fireEvent.click(screen.getByRole('button', { name: 'Criar Funcionário' }));
  await waitFor(() => expect(mockCreate).toHaveBeenCalledTimes(1));
}

describe('FuncionarioModal — payload via Edge Function', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreate.mockResolvedValue({ success: true });
    mockUpdate.mockResolvedValue({ success: true });
  });

  it('18/19. payload de criação não contém administrador_id nem nome_empresa', async () => {
    renderModalCriacao();
    preencherObrigatorios();
    await enviar();
    const payload = mockCreate.mock.calls[0][0] as Record<string, unknown>;
    expect(payload).not.toHaveProperty('administrador_id');
    expect(payload).not.toHaveProperty('nome_empresa');
    expect(payload).not.toHaveProperty('auth_user_id');
    expect(Object.keys(payload).sort()).toEqual(
      ['cargo', 'email', 'nome', 'permissoes', 'senha', 'telefone'].sort(),
    );
  });

  it('20. permissão vendedores aparece no modal', () => {
    renderModalCriacao();
    expect(screen.getByText('vendedores')).toBeInTheDocument();
  });

  it('21. vendedores=true é enviado corretamente', async () => {
    renderModalCriacao();
    preencherObrigatorios();
    fireEvent.click(screen.getByRole('checkbox', { name: 'vendedores' }));
    await enviar();
    const payload = mockCreate.mock.calls[0][0] as {
      permissoes: Record<string, boolean>;
    };
    expect(payload.permissoes.vendedores).toBe(true);
  });

  it('22. expedicao=true força vendedores=false (e demais permissões)', async () => {
    renderModalCriacao();
    preencherObrigatorios();
    // Primeiro marca vendedores, depois ativa expedição: tudo deve zerar.
    fireEvent.click(screen.getByRole('checkbox', { name: 'vendedores' }));
    const caixas = screen.getAllByRole('checkbox');
    fireEvent.click(caixas[0]); // toggle de expedição (primeiro checkbox do card)
    await enviar();
    const payload = mockCreate.mock.calls[0][0] as {
      permissoes: Record<string, boolean>;
    };
    expect(payload.permissoes.expedicao).toBe(true);
    for (const chave of [
      'orcamentos_pj',
      'vendas_atacado',
      'notas_fiscais',
      'caixa',
      'acertos',
      'relatorios',
      'vendedores',
    ]) {
      expect(payload.permissoes[chave]).toBe(false);
    }
  });

  it('23. senha é limpa após sucesso/fechamento', async () => {
    const onClose = vi.fn();
    renderModalCriacao(onClose);
    preencherObrigatorios();
    const campoSenha = screen.getByPlaceholderText(
      'Crie uma senha segura',
    ) as HTMLInputElement;
    expect(campoSenha.value.length).toBeGreaterThanOrEqual(8);
    await enviar();
    expect(onClose).toHaveBeenCalled();
    await waitFor(() =>
      expect(
        (screen.getByPlaceholderText('Crie uma senha segura') as HTMLInputElement).value,
      ).toBe(''),
    );
  });
});
