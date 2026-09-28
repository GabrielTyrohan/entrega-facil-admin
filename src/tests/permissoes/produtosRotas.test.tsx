import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import React from 'react';

const { mockUseAuth } = vi.hoisted(() => ({ mockUseAuth: vi.fn() }));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: (...args: unknown[]) => mockUseAuth(...args),
}));

import { ExpedicaoGuard } from '../../App';
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

// Mesma composição do App.tsx para gestão de catálogo/estoque:
// ExpedicaoGuard + RequirePermission("produtos")
function renderRotaProdutos(initialPath: string) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route
          path="*"
          element={
            <ExpedicaoGuard>
              <RequirePermission permission="produtos">
                <div>pagina-protegida</div>
              </RequirePermission>
            </ExpedicaoGuard>
          }
        />
        <Route path="/dashboard" element={<div>pagina-dashboard</div>} />
        <Route path="/produtos/cestas" element={<div>pagina-cestas</div>} />
      </Routes>
    </MemoryRouter>
  );
}

// Rotas operacionais não têm guard de permissão no App.tsx.
// Usa só "*" para não sombrear o conteúdo operacional com rota estática.
function renderRotaOperacional(initialPath: string) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="*" element={<div>pagina-operacional</div>} />
        <Route path="/dashboard" element={<div>pagina-dashboard</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('permissão produtos — rotas administrativas', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('6. admin acessa /produtos', () => {
    authComo('admin', TODAS_TRUE);
    renderRotaProdutos('/produtos');
    expect(screen.getByText('pagina-protegida')).toBeInTheDocument();
  });

  it('7. funcionário produtos=true acessa /produtos', () => {
    authComo('funcionario', { ...TODAS_FALSE, produtos: true });
    renderRotaProdutos('/produtos');
    expect(screen.getByText('pagina-protegida')).toBeInTheDocument();
  });

  it('8. funcionário produtos=false é redirecionado em /produtos', () => {
    authComo('funcionario', { ...TODAS_FALSE, produtos: false });
    renderRotaProdutos('/produtos');
    expect(screen.queryByText('pagina-protegida')).not.toBeInTheDocument();
    expect(screen.getByText('pagina-dashboard')).toBeInTheDocument();
  });

  it('9. mesma regra para /produtos/novo', () => {
    authComo('funcionario', { ...TODAS_FALSE, produtos: true });
    const { unmount } = renderRotaProdutos('/produtos/novo');
    expect(screen.getByText('pagina-protegida')).toBeInTheDocument();
    unmount();

    authComo('funcionario', { ...TODAS_FALSE, produtos: false });
    renderRotaProdutos('/produtos/novo');
    expect(screen.queryByText('pagina-protegida')).not.toBeInTheDocument();
    expect(screen.getByText('pagina-dashboard')).toBeInTheDocument();
  });

  it('10/11/12. mesma regra para cestas-base, nova e editar/:id', () => {
    for (const rota of [
      '/produtos/cestas-base',
      '/produtos/cestas-base/nova',
      '/produtos/cestas-base/editar/123',
    ]) {
      authComo('funcionario', { ...TODAS_FALSE, produtos: true });
      const ok = renderRotaProdutos(rota);
      expect(screen.getByText('pagina-protegida')).toBeInTheDocument();
      ok.unmount();

      authComo('funcionario', { ...TODAS_FALSE, produtos: false });
      const bloqueado = renderRotaProdutos(rota);
      expect(screen.queryByText('pagina-protegida')).not.toBeInTheDocument();
      expect(screen.getByText('pagina-dashboard')).toBeInTheDocument();
      bloqueado.unmount();
    }
  });

  it('13/14. mesma regra para /estoque/movimentacoes e /estoque/relatorio', () => {
    for (const rota of ['/estoque/movimentacoes', '/estoque/relatorio']) {
      authComo('funcionario', { ...TODAS_FALSE, produtos: true });
      const ok = renderRotaProdutos(rota);
      expect(screen.getByText('pagina-protegida')).toBeInTheDocument();
      ok.unmount();

      authComo('funcionario', { ...TODAS_FALSE, produtos: false });
      const bloqueado = renderRotaProdutos(rota);
      expect(screen.queryByText('pagina-protegida')).not.toBeInTheDocument();
      expect(screen.getByText('pagina-dashboard')).toBeInTheDocument();
      bloqueado.unmount();
    }
  });

  it('caixa=true + produtos=false NÃO acessa estoque administrativo', () => {
    authComo('funcionario', { ...TODAS_FALSE, caixa: true, produtos: false });
    renderRotaProdutos('/estoque/movimentacoes');
    expect(screen.queryByText('pagina-protegida')).not.toBeInTheDocument();
    expect(screen.getByText('pagina-dashboard')).toBeInTheDocument();
  });
});

describe('permissão produtos — expedição operacional intacta', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each([
    ['15. /produtos/cestas', '/produtos/cestas'],
    ['16. /produtos/cestas/nova', '/produtos/cestas/nova'],
    ['17. /produtos/cestas/editar/:id', '/produtos/cestas/editar/123'],
    ['18. /entregas/avulsas', '/entregas/avulsas'],
  ])('%s continua acessível para expedição', (_label, rota) => {
    authComo('funcionario', { ...TODAS_FALSE, expedicao: true });
    renderRotaOperacional(rota);
    expect(screen.getByText('pagina-operacional')).toBeInTheDocument();
  });

  it('19. expedição NÃO acessa /produtos (volta para cestas)', () => {
    authComo('funcionario', { ...TODAS_FALSE, expedicao: true });
    renderRotaProdutos('/produtos');
    expect(screen.queryByText('pagina-protegida')).not.toBeInTheDocument();
    expect(screen.getByText('pagina-cestas')).toBeInTheDocument();
  });

  it('20. expedição NÃO acessa /produtos/cestas-base (volta para cestas)', () => {
    authComo('funcionario', { ...TODAS_FALSE, expedicao: true });
    renderRotaProdutos('/produtos/cestas-base');
    expect(screen.queryByText('pagina-protegida')).not.toBeInTheDocument();
    expect(screen.getByText('pagina-cestas')).toBeInTheDocument();
  });

  it('funcionário sem produtos continua vendo telas operacionais', () => {
    authComo('funcionario', { ...TODAS_FALSE, produtos: false });
    renderRotaOperacional('/produtos/cestas');
    expect(screen.getByText('pagina-operacional')).toBeInTheDocument();
  });
});
