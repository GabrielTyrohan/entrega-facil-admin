import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import React from 'react';

const { mockUseAuth } = vi.hoisted(() => ({ mockUseAuth: vi.fn() }));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: (...args: unknown[]) => mockUseAuth(...args),
}));

import { ExpedicaoGuard } from '../../App';
import RequireAdmin from '../../components/Permissoes/RequireAdmin';
import RequirePermission from '../../components/Permissoes/RequirePermission';
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

const TODAS_TRUE: Permissoes = {
  orcamentos_pj: true,
  vendas_atacado: true,
  notas_fiscais: true,
  caixa: true,
  acertos: true,
  relatorios: true,
  funcionarios: true,
  vendedores: true,
  produtos: true,
  configuracoes: true,
  configuracoes_fiscais: true,
};

function authComo(
  userType: 'admin' | 'funcionario',
  permissions: Permissoes,
) {
  mockUseAuth.mockReturnValue({ userType, isLoading: false, permissions });
}

// Reproduz exatamente a composição declarada em App.tsx:
// vendedores -> ExpedicaoGuard + RequirePermission("vendedores")
// adminOnly  -> ExpedicaoGuard + RequireAdmin
function renderRota(initialPath: string, guarda: 'vendedores' | 'admin') {
  const conteudo =
    guarda === 'vendedores' ? (
      <ExpedicaoGuard>
        <RequirePermission permission="vendedores">
          <div>pagina-protegida</div>
        </RequirePermission>
      </ExpedicaoGuard>
    ) : (
      <ExpedicaoGuard>
        <RequireAdmin>
          <div>pagina-protegida</div>
        </RequireAdmin>
      </ExpedicaoGuard>
    );
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="*" element={conteudo} />
        <Route path="/dashboard" element={<div>pagina-dashboard</div>} />
        <Route path="/produtos/cestas" element={<div>pagina-cestas</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('guards de rota — vendedores (ExpedicaoGuard + RequirePermission)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('5. /vendedores permite funcionário com vendedores=true', () => {
    authComo('funcionario', { ...TODAS_FALSE, vendedores: true });
    renderRota('/vendedores', 'vendedores');
    expect(screen.getByText('pagina-protegida')).toBeInTheDocument();
  });

  it('5b. /vendedores permite admin', () => {
    authComo('admin', TODAS_TRUE);
    renderRota('/vendedores', 'vendedores');
    expect(screen.getByText('pagina-protegida')).toBeInTheDocument();
  });

  it('6. /vendedores bloqueia funcionário com vendedores=false', () => {
    authComo('funcionario', { ...TODAS_FALSE, vendedores: false });
    renderRota('/vendedores', 'vendedores');
    expect(screen.queryByText('pagina-protegida')).not.toBeInTheDocument();
    expect(screen.getByText('pagina-dashboard')).toBeInTheDocument();
  });

  it('7. /vendedores/novo segue a mesma regra', () => {
    authComo('funcionario', { ...TODAS_FALSE, vendedores: true });
    const { unmount } = renderRota('/vendedores/novo', 'vendedores');
    expect(screen.getByText('pagina-protegida')).toBeInTheDocument();
    unmount();

    authComo('funcionario', { ...TODAS_FALSE, vendedores: false });
    renderRota('/vendedores/novo', 'vendedores');
    expect(screen.queryByText('pagina-protegida')).not.toBeInTheDocument();
    expect(screen.getByText('pagina-dashboard')).toBeInTheDocument();
  });

  it('8. /vendedores/editar/:id segue a mesma regra', () => {
    authComo('funcionario', { ...TODAS_FALSE, vendedores: true });
    const { unmount } = renderRota('/vendedores/editar/123', 'vendedores');
    expect(screen.getByText('pagina-protegida')).toBeInTheDocument();
    unmount();

    authComo('funcionario', { ...TODAS_FALSE, vendedores: false });
    renderRota('/vendedores/editar/123', 'vendedores');
    expect(screen.queryByText('pagina-protegida')).not.toBeInTheDocument();
    expect(screen.getByText('pagina-dashboard')).toBeInTheDocument();
  });
});

describe('guards de rota — adminOnly (ExpedicaoGuard + RequireAdmin)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('admin acessa rotas adminOnly', () => {
    authComo('admin', TODAS_TRUE);
    for (const rota of [
      '/funcionarios',
      '/configuracoes',
      '/configuracoes-fiscais',
      '/historico-pdfs',
    ]) {
      const { unmount } = renderRota(rota, 'admin');
      expect(screen.getByText('pagina-protegida')).toBeInTheDocument();
      unmount();
    }
  });

  it('9. /funcionarios bloqueia funcionário (mesmo com funcionarios=true)', () => {
    authComo('funcionario', { ...TODAS_FALSE, funcionarios: true });
    renderRota('/funcionarios', 'admin');
    expect(screen.queryByText('pagina-protegida')).not.toBeInTheDocument();
    expect(screen.getByText('pagina-dashboard')).toBeInTheDocument();
  });

  it('10. /configuracoes bloqueia funcionário', () => {
    authComo('funcionario', { ...TODAS_FALSE, configuracoes: true });
    renderRota('/configuracoes', 'admin');
    expect(screen.queryByText('pagina-protegida')).not.toBeInTheDocument();
    expect(screen.getByText('pagina-dashboard')).toBeInTheDocument();
  });

  it('11. /configuracoes-fiscais bloqueia funcionário (mesmo com configuracoes_fiscais=true)', () => {
    authComo('funcionario', { ...TODAS_FALSE, configuracoes_fiscais: true });
    renderRota('/configuracoes-fiscais', 'admin');
    expect(screen.queryByText('pagina-protegida')).not.toBeInTheDocument();
    expect(screen.getByText('pagina-dashboard')).toBeInTheDocument();
  });

  it('12. /historico-pdfs bloqueia funcionário', () => {
    authComo('funcionario', TODAS_TRUE);
    renderRota('/historico-pdfs', 'admin');
    expect(screen.queryByText('pagina-protegida')).not.toBeInTheDocument();
    expect(screen.getByText('pagina-dashboard')).toBeInTheDocument();
  });
});
