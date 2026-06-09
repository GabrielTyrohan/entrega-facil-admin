import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual('@tanstack/react-query');
  return { ...actual, useQueryClient: () => ({ invalidateQueries: vi.fn() }) };
});

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
    },
    channel: vi.fn().mockReturnValue({ subscribe: vi.fn() }),
    removeChannel: vi.fn(),
  },
}));

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'user-1', email: 'admin@test.com' },
    adminId: 'admin-1',
    userProfile: { nome: 'Admin', nome_empresa: 'Empresa Teste', telefone: '11999999999', cpf_cnpj: '00.000.000/0001-00' },
  }),
}));

const mockCestas = [
  { id: 'cesta-1', cesta_nome: 'Cesta Básica', cesta_id: 'cb-1', status: 'em_uso', vendedor_id: 'vend-1', vendedor_nome: 'João Autônomo', quantidade: 2 },
];

vi.mock('../../hooks/useCestas', () => ({
  useCestas: () => ({ data: mockCestas, isLoading: false, error: null, refetch: vi.fn() }),
  useCestaDetalhes: () => ({ data: null }),
  useEntregarCestas: () => ({ mutateAsync: vi.fn().mockResolvedValue({ id: 'entrega-abc-123' }), isPending: false }),
}));

vi.mock('../../components/NotaPedidoAutonomo', () => ({
  default: (props: any) => (
    <div data-testid="nota-pedido">
      <span data-testid="nota-numero">Nº {props.numeroPedido}</span>
      <span data-testid="nota-vendedor">{props.vendedor?.nome}</span>
      {props.itens?.map((item: any, i: number) => (
        <div key={i} data-testid="nota-item-lote">
          <span>{item.descricao}</span>
          <span data-testid={`unidade-${i}`}>{item.unidade}</span>
        </div>
      ))}
    </div>
  ),
}));

import { supabase } from '@/lib/supabase';
import CestasVendedor from '../../pages/CestasVendedor';

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <CestasVendedor />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('CestasVendedor — Nota de Entrega em Lote', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    (supabase.from as any).mockImplementation((tabela: string) => {
      const base = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
      };

      if (tabela === 'vendedores') {
        return {
          ...base,
          single: vi.fn().mockResolvedValue({
            data: { id: 'vend-1', nome: 'João Autônomo', tipo_vinculo: 'autonomo', cpf_cnpj: '123.456.789-00', telefone: '11999999999', endereco: 'Rua A' },
            error: null,
          }),
        };
      }
      if (tabela === 'produtos') {
        return {
          ...base,
          single: vi.fn().mockResolvedValue({
            data: { cesta_base_id: 'cb-1', cestas_base: { codigo: 1 }, preco: 50.0 },
            error: null,
          }),
        };
      }
      return base;
    });
  });

  it('deve renderizar a página de cestas', () => {
    renderPage();
    expect(screen.getByText('Cestas dos Vendedores')).toBeInTheDocument();
  });

  it('deve exibir o botão "Entregar em Lote"', () => {
    renderPage();
    expect(screen.getByRole('button', { name: /entregar em lote/i })).toBeInTheDocument();
  });

  it('deve abrir modal de entrega em lote ao clicar no botão', async () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /entregar em lote/i }));
    await waitFor(() => {
      expect(screen.getByText('Entregar Cestas')).toBeInTheDocument();
    });
  });

  it('deve exibir botão "Visualizar Nota →" na etapa 1 do modal', async () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /entregar em lote/i }));
    await waitFor(() => screen.getByText('João Autônomo'));
    fireEvent.click(screen.getByText('João Autônomo'));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /visualizar nota/i })).toBeInTheDocument();
    });
  });

  it('deve exibir prévia da nota na etapa 2 para vendedor autônomo', async () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /entregar em lote/i }));
    await waitFor(() => screen.getByText('João Autônomo'));
    fireEvent.click(screen.getByText('João Autônomo'));
    await waitFor(() => screen.getAllByText('+'));
    fireEvent.click(screen.getAllByText('+')[0]);
    fireEvent.click(screen.getByRole('button', { name: /visualizar nota/i }));
    await waitFor(() => {
      expect(screen.getByText('Prévia da Nota')).toBeInTheDocument();
      expect(screen.getByTestId('nota-pedido')).toBeInTheDocument();
    });
  });

  it('nota do lote deve usar unidade UN e não CX', async () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /entregar em lote/i }));
    await waitFor(() => screen.getByText('João Autônomo'));
    fireEvent.click(screen.getByText('João Autônomo'));
    await waitFor(() => screen.getAllByText('+'));
    fireEvent.click(screen.getAllByText('+')[0]);
    fireEvent.click(screen.getByRole('button', { name: /visualizar nota/i }));
    await waitFor(() => {
      const unidades = screen.getAllByTestId(/^unidade-/);
      unidades.forEach(el => {
        expect(el.textContent).toBe('UN');
        expect(el.textContent).not.toBe('CX');
      });
    });
  });

  it('deve exibir botões "← Voltar" e "Confirmar e Gerar PDF" na etapa 2', async () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /entregar em lote/i }));
    await waitFor(() => screen.getByText('João Autônomo'));
    fireEvent.click(screen.getByText('João Autônomo'));
    await waitFor(() => screen.getAllByText('+'));
    fireEvent.click(screen.getAllByText('+')[0]);
    fireEvent.click(screen.getByRole('button', { name: /visualizar nota/i }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /voltar/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /confirmar e gerar pdf/i })).toBeInTheDocument();
    });
  });

  it('deve voltar à etapa 1 ao clicar em "← Voltar"', async () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /entregar em lote/i }));
    await waitFor(() => screen.getByText('João Autônomo'));
    fireEvent.click(screen.getByText('João Autônomo'));
    await waitFor(() => screen.getAllByText('+'));
    fireEvent.click(screen.getAllByText('+')[0]);
    fireEvent.click(screen.getByRole('button', { name: /visualizar nota/i }));
    await waitFor(() => screen.getByRole('button', { name: /voltar/i }));
    fireEvent.click(screen.getByRole('button', { name: /voltar/i }));
    await waitFor(() => {
      expect(screen.queryByTestId('nota-pedido')).not.toBeInTheDocument();
      expect(screen.getByText('Entregar Cestas')).toBeInTheDocument();
    });
  });
});
