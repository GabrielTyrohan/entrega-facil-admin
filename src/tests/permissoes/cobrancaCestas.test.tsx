import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import React from 'react';

const { mockUseAuth } = vi.hoisted(() => ({ mockUseAuth: vi.fn() }));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: (...args: unknown[]) => mockUseAuth(...args),
}));

import Sidebar from '../../components/layout/Sidebar';
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
  cobranca: false,
  cestas_vendedor: false,
};

function funcionario(permissions: Partial<Permissoes>) {
  mockUseAuth.mockReturnValue({
    userType: 'funcionario',
    isAdmin: false,
    permissions: { ...TODAS_FALSE, ...permissions },
    signOut: vi.fn(),
  });
}

function renderSidebar() {
  return render(
    <MemoryRouter initialEntries={['/dashboard']}>
      <Sidebar isOpen onClose={() => undefined} />
    </MemoryRouter>
  );
}

function renderRota(path: string, permission: Parameters<typeof RequirePermission>[0]['permission']) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path={path} element={<RequirePermission permission={permission}><p>CONTEUDO</p></RequirePermission>} />
        <Route path="/dashboard" element={<p>DASHBOARD</p>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('Permissão cobranca (clientes, entregas, pagamentos, devedores)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('cobranca=false oculta Clientes, Entregas, Pagamentos e Devedores do menu', () => {
    funcionario({ caixa: true, acertos: true, relatorios: true });
    renderSidebar();
    expect(screen.queryByText('Clientes')).not.toBeInTheDocument();
    expect(screen.queryByText('Entregas')).not.toBeInTheDocument();
    expect(screen.queryByText('Pagamentos')).not.toBeInTheDocument();
    expect(screen.queryByText('Devedores')).not.toBeInTheDocument();
  });

  it('cobranca=true mostra os quatro itens, mesmo sem permissões financeiras', () => {
    funcionario({ cobranca: true });
    renderSidebar();
    expect(screen.getByText('Clientes')).toBeInTheDocument();
    expect(screen.getByText('Entregas')).toBeInTheDocument();
    expect(screen.getByText('Pagamentos')).toBeInTheDocument();
    expect(screen.getByText('Devedores')).toBeInTheDocument();
  });

  it('rota de cobrança sem a permissão redireciona para o dashboard', () => {
    funcionario({});
    renderRota('/pagamentos', 'cobranca');
    expect(screen.getByText('DASHBOARD')).toBeInTheDocument();
  });
});

describe('Permissão cestas_vendedor (liberar cestas e avulsos)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('sem cestas_vendedor e sem produtos oculta Entregar Cesta e Entregas Avulsas', () => {
    funcionario({ cobranca: true });
    renderSidebar();
    expect(screen.queryByText('Entregar Cesta')).not.toBeInTheDocument();
    expect(screen.queryByText('Entregas Avulsas')).not.toBeInTheDocument();
  });

  it('cestas_vendedor=true mostra os dois itens sem liberar o cadastro de produtos', () => {
    funcionario({ cestas_vendedor: true });
    renderSidebar();
    expect(screen.getByText('Entregar Cesta')).toBeInTheDocument();
    expect(screen.getByText('Entregas Avulsas')).toBeInTheDocument();
    expect(screen.queryByText('Cadastrar Cestas')).not.toBeInTheDocument();
  });

  it('rota aceita qualquer uma das permissões da lista', () => {
    funcionario({ produtos: true });
    renderRota('/produtos/cestas', ['cestas_vendedor', 'produtos']);
    expect(screen.getByText('CONTEUDO')).toBeInTheDocument();
  });

  it('rota sem nenhuma permissão da lista redireciona', () => {
    funcionario({ cobranca: true });
    renderRota('/entregas/avulsas', ['cestas_vendedor', 'produtos']);
    expect(screen.getByText('DASHBOARD')).toBeInTheDocument();
  });
});
