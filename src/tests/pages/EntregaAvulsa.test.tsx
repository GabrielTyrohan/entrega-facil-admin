import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

const mockInvalidateQueries = vi.fn();
vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual('@tanstack/react-query');
  return { ...actual, useQueryClient: () => ({ invalidateQueries: mockInvalidateQueries }) };
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
    userProfile: { nome: 'Admin Teste', nome_empresa: 'Empresa Teste', telefone: '11999999999', cpf_cnpj: '00.000.000/0001-00' },
  }),
}));

const mockVendedores = [
  { id: 'vend-1', nome: 'João Autônomo' },
  { id: 'vend-2', nome: 'Maria CLT' },
];

const mockProdutos = [
  { id: 'prod-1', produto_nome: 'Arroz 5kg', produto_cod: 'ARR001', categoria: 'Alimentos', qtd_estoque: 10, preco_unt: 25.0 },
  { id: 'prod-2', produto_nome: 'Feijão 1kg', produto_cod: 'FEI001', categoria: 'Alimentos', qtd_estoque: 0, preco_unt: 8.5 },
];

vi.mock('../../hooks/useVendedores', () => ({
  useVendedoresByAdmin: () => ({ data: mockVendedores, isLoading: false }),
}));

vi.mock('../../hooks/useProdutos', () => ({
  useProdutos: () => ({ data: mockProdutos, isLoading: false }),
}));

vi.mock('../../utils/movimentarEstoque', () => ({
  movimentarEstoque: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../components/NotaPedidoAutonomo', () => ({
  default: (props: any) => (
    <div data-testid="nota-pedido-avulsa">
      <span>Nota: {props.numeroPedido}</span>
      <span>Vendedor: {props.vendedor?.nome}</span>
      {props.itens?.map((item: any, i: number) => (
        <span key={i} data-testid="nota-item">{item.descricao} - {item.unidade}</span>
      ))}
    </div>
  ),
}));

import { supabase } from '@/lib/supabase';
import EntregaAvulsa from '../../pages/EntregaAvulsa';

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <EntregaAvulsa />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('EntregaAvulsa', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    (supabase.from as any).mockImplementation((tabela: string) => {
      if (tabela === 'entregas_avulsas') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({ data: [], error: null }),
        };
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
      };
    });
  });

  it('deve renderizar a página corretamente', () => {
    renderPage();
    expect(screen.getByText(/Entrega Avulsa/i)).toBeInTheDocument();
  });

  it('deve exibir aba "Nova Entrega" e listar vendedores', async () => {
    renderPage();
    const btnNova = screen.getByRole('button', { name: /nova entrega/i });
    fireEvent.click(btnNova);
    await waitFor(() => {
      expect(screen.getByText('João Autônomo')).toBeInTheDocument();
      expect(screen.getByText('Maria CLT')).toBeInTheDocument();
    });
  });

  it('deve listar produtos disponíveis na nova entrega', async () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /nova entrega/i }));
    await waitFor(() => {
      expect(screen.getByText('Arroz 5kg')).toBeInTheDocument();
    });
  });

  it('deve exibir botão "Visualizar Nota →" no lugar de "Confirmar Entrega"', async () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /nova entrega/i }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /visualizar nota/i })).toBeInTheDocument();
    });
  });

  it('deve mostrar prévia da nota para vendedor autônomo', async () => {
    (supabase.from as any).mockImplementation((tabela: string) => {
      if (tabela === 'vendedores') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: { id: 'vend-1', nome: 'João Autônomo', tipo_vinculo: 'autonomo', cpf_cnpj: '123.456.789-00', telefone: '11999999999', endereco: 'Rua A, 1' },
            error: null,
          }),
        };
      }
      if (tabela === 'entregas_avulsas') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({ data: [], error: null }),
        };
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
      };
    });

    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /nova entrega/i }));
    await waitFor(() => screen.getByText('João Autônomo'));
    fireEvent.click(screen.getByText('João Autônomo'));
    await waitFor(() => screen.getByText('Arroz 5kg'));

    const btnsPlus = screen.getAllByRole('button').filter(b => b.textContent?.trim() === '+');
    if (btnsPlus.length > 0) fireEvent.click(btnsPlus[0]);

    fireEvent.click(screen.getByRole('button', { name: /visualizar nota/i }));

    await waitFor(() => {
      expect(screen.getByText(/Prévia da Nota/i)).toBeInTheDocument();
      expect(screen.getByTestId('nota-pedido-avulsa')).toBeInTheDocument();
    });
  });

  it('nota deve exibir itens com unidade UN e não CX', async () => {
    (supabase.from as any).mockImplementation((tabela: string) => {
      if (tabela === 'vendedores') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: { id: 'vend-1', nome: 'João Autônomo', tipo_vinculo: 'autonomo', cpf_cnpj: '', telefone: '', endereco: '' },
            error: null,
          }),
        };
      }
      if (tabela === 'entregas_avulsas') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({ data: [], error: null }),
        };
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
      };
    });

    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /nova entrega/i }));
    await waitFor(() => screen.getByText('João Autônomo'));
    fireEvent.click(screen.getByText('João Autônomo'));
    await waitFor(() => screen.getByText('Arroz 5kg'));

    const btnsPlus = screen.getAllByRole('button').filter(b => b.textContent?.trim() === '+');
    if (btnsPlus.length > 0) fireEvent.click(btnsPlus[0]);

    fireEvent.click(screen.getByRole('button', { name: /visualizar nota/i }));

    await waitFor(() => {
      const itens = screen.getAllByTestId('nota-item');
      itens.forEach(item => {
        expect(item.textContent).toContain('UN');
        expect(item.textContent).not.toContain('CX');
      });
    });
  });

  it('deve exibir botões "← Voltar" e "Confirmar e Gerar PDF" na prévia', async () => {
    (supabase.from as any).mockImplementation((tabela: string) => {
      if (tabela === 'vendedores') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: { id: 'vend-1', nome: 'João Autônomo', tipo_vinculo: 'autonomo', cpf_cnpj: '', telefone: '', endereco: '' },
            error: null,
          }),
        };
      }
      if (tabela === 'entregas_avulsas') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({ data: [], error: null }),
        };
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
      };
    });

    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /nova entrega/i }));
    await waitFor(() => screen.getByText('João Autônomo'));
    fireEvent.click(screen.getByText('João Autônomo'));
    await waitFor(() => screen.getByText('Arroz 5kg'));
    const btnsPlus = screen.getAllByRole('button').filter(b => b.textContent?.trim() === '+');
    if (btnsPlus.length > 0) fireEvent.click(btnsPlus[0]);
    fireEvent.click(screen.getByRole('button', { name: /visualizar nota/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /voltar/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /confirmar e gerar pdf/i })).toBeInTheDocument();
    });
  });

  it('deve voltar ao formulário ao clicar em "← Voltar"', async () => {
    (supabase.from as any).mockImplementation((tabela: string) => {
      if (tabela === 'vendedores') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: { id: 'vend-1', nome: 'João Autônomo', tipo_vinculo: 'autonomo', cpf_cnpj: '', telefone: '', endereco: '' },
            error: null,
          }),
        };
      }
      if (tabela === 'entregas_avulsas') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({ data: [], error: null }),
        };
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
      };
    });

    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /nova entrega/i }));
    await waitFor(() => screen.getByText('João Autônomo'));
    fireEvent.click(screen.getByText('João Autônomo'));
    await waitFor(() => screen.getByText('Arroz 5kg'));
    const btnsPlus = screen.getAllByRole('button').filter(b => b.textContent?.trim() === '+');
    if (btnsPlus.length > 0) fireEvent.click(btnsPlus[0]);
    fireEvent.click(screen.getByRole('button', { name: /visualizar nota/i }));
    await waitFor(() => screen.getByRole('button', { name: /voltar/i }));
    fireEvent.click(screen.getByRole('button', { name: /voltar/i }));

    await waitFor(() => {
      expect(screen.queryByTestId('nota-pedido-avulsa')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: /visualizar nota/i })).toBeInTheDocument();
    });
  });
});
