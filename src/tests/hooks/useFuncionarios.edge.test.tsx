import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

const mockFrom = vi.fn();
const mockRpc = vi.fn();
const mockCreateClient = vi.fn();

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
    rpc: (...args: unknown[]) => mockRpc(...args),
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
    },
  },
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: (...args: unknown[]) => mockCreateClient(...args),
}));

const mockCriar = vi.fn();
const mockAtualizar = vi.fn();
const mockStatus = vi.fn();
const mockReset = vi.fn();

vi.mock('@/services/funcionarioAdminService', () => ({
  criarFuncionarioSeguro: (...args: unknown[]) => mockCriar(...args),
  atualizarFuncionarioSeguro: (...args: unknown[]) => mockAtualizar(...args),
  alterarStatusFuncionarioSeguro: (...args: unknown[]) => mockStatus(...args),
  redefinirSenhaFuncionarioSeguro: (...args: unknown[]) => mockReset(...args),
}));

import {
  useCreateFuncionario,
  useResetFuncionarioPassword,
  useToggleFuncionarioStatus,
  useUpdateFuncionario,
} from '../../hooks/useFuncionarios';

function Wrapper({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

const PERMISSOES = {
  orcamentos_pj: false,
  vendas_atacado: false,
  notas_fiscais: false,
  caixa: false,
  acertos: false,
  relatorios: false,
  vendedores: true,
  produtos: false,
  expedicao: false,
};

describe('useFuncionarios — via Edge Function gerenciar-funcionario', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCriar.mockResolvedValue({ success: true });
    mockAtualizar.mockResolvedValue({ success: true });
    mockStatus.mockResolvedValue({ success: true });
    mockReset.mockResolvedValue({ success: true });
  });

  it('13. useCreateFuncionario não usa auth.signUp nem insert direto', async () => {
    const { result } = renderHook(() => useCreateFuncionario(), { wrapper: Wrapper });
    await act(async () => {
      await result.current.mutateAsync({
        nome: 'João',
        email: 'joao@empresa.com',
        senha: 'SenhaSegura123',
        telefone: null,
        cargo: null,
        permissoes: PERMISSOES,
      });
    });
    expect(mockCriar).toHaveBeenCalledTimes(1);
    expect(mockCreateClient).not.toHaveBeenCalled();
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('14. useCreateFuncionario não insere diretamente em funcionarios', async () => {
    const { result } = renderHook(() => useCreateFuncionario(), { wrapper: Wrapper });
    await act(async () => {
      await result.current.mutateAsync({
        nome: 'João',
        email: 'joao@empresa.com',
        senha: 'SenhaSegura123',
        telefone: null,
        cargo: null,
        permissoes: PERMISSOES,
      });
    });
    expect(mockFrom).not.toHaveBeenCalled();
    expect(mockCriar).toHaveBeenCalledWith(
      expect.not.objectContaining({ administrador_id: expect.anything() }),
    );
  });

  it('15. useUpdateFuncionario não faz update direto', async () => {
    const { result } = renderHook(() => useUpdateFuncionario(), { wrapper: Wrapper });
    await act(async () => {
      await result.current.mutateAsync({
        id: 'func-1',
        nome: 'João',
        email: 'joao@empresa.com',
        telefone: null,
        cargo: null,
        permissoes: PERMISSOES,
      });
    });
    expect(mockAtualizar).toHaveBeenCalledTimes(1);
    expect(mockAtualizar).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'func-1', nome: 'João' }),
    );
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('16. useToggleFuncionarioStatus não faz update direto', async () => {
    const { result } = renderHook(() => useToggleFuncionarioStatus(), { wrapper: Wrapper });
    await act(async () => {
      await result.current.mutateAsync({ id: 'func-1', ativo: false });
    });
    expect(mockStatus).toHaveBeenCalledWith('func-1', false);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('17. useResetFuncionarioPassword não chama redefinir_senha_funcionario', async () => {
    const { result } = renderHook(() => useResetFuncionarioPassword(), { wrapper: Wrapper });
    await act(async () => {
      await result.current.mutateAsync({ id: 'func-1', senha: 'NovaSenha123' });
    });
    expect(mockReset).toHaveBeenCalledWith('func-1', 'NovaSenha123');
    expect(mockRpc).not.toHaveBeenCalled();
    expect(mockFrom).not.toHaveBeenCalled();
  });
});
