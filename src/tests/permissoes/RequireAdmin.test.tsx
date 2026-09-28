import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import React from 'react';

const { mockUseAuth } = vi.hoisted(() => ({ mockUseAuth: vi.fn() }));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: (...args: unknown[]) => mockUseAuth(...args),
}));

import RequireAdmin from '../../components/Permissoes/RequireAdmin';
import type { Permissoes } from '@/contexts/AuthContext';

const TODAS_FALSE: Permissoes = {
  orcamentos_pj: false,
  vendas_atacado: false,
  notas_fiscais: false,
  caixa: false,
  acertos: false,
  relatorios: false,
  funcionarios: false,
  vendedores: false,
  produtos: false,
  configuracoes: false,
  configuracoes_fiscais: false,
};

function renderAdminGuard(initialPath = '/protegida') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route
          path="/protegida"
          element={
            <RequireAdmin>
              <div>conteudo-admin</div>
            </RequireAdmin>
          }
        />
        <Route path="/dashboard" element={<div>pagina-dashboard</div>} />
        <Route path="/produtos/cestas" element={<div>pagina-cestas</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('RequireAdmin', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('1. admin renderiza children', () => {
    mockUseAuth.mockReturnValue({
      userType: 'admin',
      isLoading: false,
      permissions: { ...TODAS_FALSE, vendedores: true },
    });
    renderAdminGuard();
    expect(screen.getByText('conteudo-admin')).toBeInTheDocument();
    expect(screen.queryByText('pagina-dashboard')).not.toBeInTheDocument();
  });

  it('2. funcionário é redirecionado para /dashboard', () => {
    mockUseAuth.mockReturnValue({
      userType: 'funcionario',
      isLoading: false,
      permissions: { ...TODAS_FALSE },
    });
    renderAdminGuard();
    expect(screen.queryByText('conteudo-admin')).not.toBeInTheDocument();
    expect(screen.getByText('pagina-dashboard')).toBeInTheDocument();
  });

  it('3. funcionário com configuracoes_fiscais=true continua sem acessar adminOnly', () => {
    mockUseAuth.mockReturnValue({
      userType: 'funcionario',
      isLoading: false,
      permissions: { ...TODAS_FALSE, configuracoes_fiscais: true },
    });
    renderAdminGuard();
    expect(screen.queryByText('conteudo-admin')).not.toBeInTheDocument();
    expect(screen.getByText('pagina-dashboard')).toBeInTheDocument();
  });

  it('4. loading não causa redirect prematuro', () => {
    mockUseAuth.mockReturnValue({
      userType: null,
      isLoading: true,
      permissions: { ...TODAS_FALSE },
    });
    renderAdminGuard();
    expect(screen.queryByText('conteudo-admin')).not.toBeInTheDocument();
    expect(screen.queryByText('pagina-dashboard')).not.toBeInTheDocument();
    expect(screen.queryByText('pagina-cestas')).not.toBeInTheDocument();
  });

  it('perfil de expedição é redirecionado para /produtos/cestas', () => {
    mockUseAuth.mockReturnValue({
      userType: 'funcionario',
      isLoading: false,
      permissions: { ...TODAS_FALSE, expedicao: true },
    });
    renderAdminGuard();
    expect(screen.queryByText('conteudo-admin')).not.toBeInTheDocument();
    expect(screen.getByText('pagina-cestas')).toBeInTheDocument();
  });
});
