import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    auth: {
      signInWithPassword: vi.fn(),
      signOut: vi.fn(),
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
    },
    channel: vi.fn().mockReturnValue({
      subscribe: vi.fn(),
      track: vi.fn(),
      untrack: vi.fn(),
    }),
    removeChannel: vi.fn(),
  },
}));

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: null,
    userProfile: null,
    isLoading: false,
    signIn: vi.fn(),
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import LoginPage from '../../pages/LoginPage';

function renderLoginPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('LoginPage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('deve renderizar o formulário de login', () => {
    renderLoginPage();
    expect(screen.getByText('Entrar')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('seu@email.com')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('••••••••')).toBeInTheDocument();
  });

  it('deve exibir mensagem de pagamento inativo quando PAGAMENTO_INATIVO no localStorage', () => {
    localStorage.setItem('loginErrorMsg', 'PAGAMENTO_INATIVO');
    renderLoginPage();
    expect(screen.getByText('Conta bloqueada por falta de pagamento. Regularize sua assinatura.')).toBeInTheDocument();
  });

  it('deve exibir mensagem de sistema indisponível quando PAGAMENTO_INATIVO_FUNCIONARIO no localStorage', () => {
    localStorage.setItem('loginErrorMsg', 'PAGAMENTO_INATIVO_FUNCIONARIO');
    renderLoginPage();
    expect(screen.getByText('Sistema indisponível. Entre em contato com o administrador.')).toBeInTheDocument();
  });

  it('deve exibir mensagem de acesso desativado quando ACESSO_DESATIVADO no localStorage', () => {
    localStorage.setItem('loginErrorMsg', 'ACESSO_DESATIVADO');
    renderLoginPage();
    expect(screen.getByText('Seu acesso foi desativado. Entre em contato com o administrador.')).toBeInTheDocument();
  });

  it('deve limpar o loginErrorMsg do localStorage após exibir o erro', () => {
    localStorage.setItem('loginErrorMsg', 'PAGAMENTO_INATIVO');
    renderLoginPage();
    expect(localStorage.getItem('loginErrorMsg')).toBeNull();
  });

  it('deve bloquear o botão após 5 tentativas falhas', () => {
    localStorage.setItem('loginFailedAttempts', '5');
    localStorage.setItem('loginBlockEndTime', String(Date.now() + 60000));
    renderLoginPage();
    const button = screen.getByRole('button', { name: /bloqueado/i });
    expect(button).toBeDisabled();
  });
});
