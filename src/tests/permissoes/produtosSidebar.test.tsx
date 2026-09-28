import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';

const { mockUseAuth } = vi.hoisted(() => ({ mockUseAuth: vi.fn() }));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: (...args: unknown[]) => mockUseAuth(...args),
}));

import Sidebar from '../../components/layout/Sidebar';
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

function renderSidebar() {
  return render(
    <MemoryRouter initialEntries={['/dashboard']}>
      <Sidebar isOpen onClose={() => undefined} />
    </MemoryRouter>
  );
}

describe('Sidebar — permissão produtos', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('21. produtos=false oculta Produtos', () => {
    mockUseAuth.mockReturnValue({
      userType: 'funcionario',
      isAdmin: false,
      permissions: { ...TODAS_FALSE, produtos: false },
      signOut: vi.fn(),
    });
    renderSidebar();
    expect(screen.queryByText('Produtos')).not.toBeInTheDocument();
  });

  it('22. produtos=true mostra Produtos', () => {
    mockUseAuth.mockReturnValue({
      userType: 'funcionario',
      isAdmin: false,
      permissions: { ...TODAS_FALSE, produtos: true },
      signOut: vi.fn(),
    });
    renderSidebar();
    expect(screen.getByText('Produtos')).toBeInTheDocument();
  });

  it('23. produtos=false oculta Cadastrar Cestas', () => {
    mockUseAuth.mockReturnValue({
      userType: 'funcionario',
      isAdmin: false,
      permissions: { ...TODAS_FALSE, produtos: false },
      signOut: vi.fn(),
    });
    renderSidebar();
    expect(screen.queryByText('Cadastrar Cestas')).not.toBeInTheDocument();
  });

  it('24. produtos=false oculta Movimentações/Relatório', () => {
    mockUseAuth.mockReturnValue({
      userType: 'funcionario',
      isAdmin: false,
      permissions: { ...TODAS_FALSE, produtos: false },
      signOut: vi.fn(),
    });
    renderSidebar();
    expect(screen.queryByText('Movimentações')).not.toBeInTheDocument();
    expect(screen.queryByText('Relatório')).not.toBeInTheDocument();
  });

  it('25. caixa=true + produtos=false NÃO mostra estoque administrativo', () => {
    mockUseAuth.mockReturnValue({
      userType: 'funcionario',
      isAdmin: false,
      permissions: { ...TODAS_FALSE, caixa: true, produtos: false },
      signOut: vi.fn(),
    });
    renderSidebar();
    expect(screen.queryByText('Movimentações')).not.toBeInTheDocument();
    expect(screen.queryByText('Relatório')).not.toBeInTheDocument();
    expect(screen.queryByText('Produtos')).not.toBeInTheDocument();
    expect(screen.queryByText('Cadastrar Cestas')).not.toBeInTheDocument();
  });

  it('26. expedição continua vendo Entregar Cesta', () => {
    mockUseAuth.mockReturnValue({
      userType: 'funcionario',
      isAdmin: false,
      permissions: { ...TODAS_FALSE, expedicao: true },
      signOut: vi.fn(),
    });
    renderSidebar();
    expect(screen.getByText('Entregar Cesta')).toBeInTheDocument();
  });

  it('27. admin vê todos', () => {
    mockUseAuth.mockReturnValue({
      userType: 'admin',
      isAdmin: true,
      permissions: TODAS_TRUE,
      signOut: vi.fn(),
    });
    renderSidebar();
    for (const item of [
      'Produtos',
      'Cadastrar Cestas',
      'Movimentações',
      'Relatório',
      'Entregar Cesta',
      'Entregas Avulsas',
    ]) {
      expect(screen.getByText(item)).toBeInTheDocument();
    }
  });
});
