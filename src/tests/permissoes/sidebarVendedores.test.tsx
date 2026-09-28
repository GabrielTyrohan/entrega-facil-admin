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

const ITENS_ADMIN_ONLY = [
  'Funcionários',
  'Configurações',
  'Configuração Fiscal',
  'Histórico de Notas',
];

describe('Sidebar — visibilidade de Vendedores e itens adminOnly', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('13. funcionário vendedores=false não vê "Vendedores"', () => {
    mockUseAuth.mockReturnValue({
      userType: 'funcionario',
      isAdmin: false,
      permissions: { ...TODAS_FALSE, vendedores: false },
      signOut: vi.fn(),
    });
    renderSidebar();
    expect(screen.queryByText('Vendedores')).not.toBeInTheDocument();
  });

  it('14. funcionário vendedores=true vê "Vendedores"', () => {
    mockUseAuth.mockReturnValue({
      userType: 'funcionario',
      isAdmin: false,
      permissions: { ...TODAS_FALSE, vendedores: true },
      signOut: vi.fn(),
    });
    renderSidebar();
    expect(screen.getByText('Vendedores')).toBeInTheDocument();
  });

  it('15. admin vê "Vendedores"', () => {
    mockUseAuth.mockReturnValue({
      userType: 'admin',
      isAdmin: true,
      permissions: TODAS_TRUE,
      signOut: vi.fn(),
    });
    renderSidebar();
    expect(screen.getByText('Vendedores')).toBeInTheDocument();
  });

  it('16. itens adminOnly continuam ocultos para funcionário', () => {
    mockUseAuth.mockReturnValue({
      userType: 'funcionario',
      isAdmin: false,
      permissions: TODAS_TRUE,
      signOut: vi.fn(),
    });
    renderSidebar();
    for (const item of ITENS_ADMIN_ONLY) {
      expect(screen.queryByText(item)).not.toBeInTheDocument();
    }
  });

  it('admin vê itens adminOnly', () => {
    mockUseAuth.mockReturnValue({
      userType: 'admin',
      isAdmin: true,
      permissions: TODAS_TRUE,
      signOut: vi.fn(),
    });
    renderSidebar();
    for (const item of ITENS_ADMIN_ONLY) {
      expect(screen.getByText(item)).toBeInTheDocument();
    }
  });
});
