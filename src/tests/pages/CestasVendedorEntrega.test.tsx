import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

const mockFrom = vi.fn();
const mockRegistrar = vi.fn();
const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();
const mockRefetch = vi.fn();

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'user-9', email: 'op@empresa.com' },
    adminId: 'admin-1',
    userProfile: { nome: 'Operador', nome_empresa: 'Empresa', telefone: '', cpf_cnpj: '' },
  }),
}));

vi.mock('../../hooks/useCestas', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../hooks/useCestas')>();
  return {
    ...actual,
    useCestas: () => ({
      data: [
        {
          id: 'cesta-1',
          vendedor_id: 'vend-1',
          vendedor_nome: 'Vendedor Um',
          cesta_nome: 'Cesta Básica',
          cesta_base_codigo: 'CB1',
          data_montagem: '2026-01-01',
          status: 'em_uso',
          total_itens: 1,
          valor_total: 10,
          entregas_realizadas: 0,
          quantidade_disponivel: 10,
          itens: [
            {
              produto: {
                id: 'prod-1',
                produto_nome: 'Arroz',
                produto_cod: 'A1',
                categoria: 'Grãos',
                qtd_estoque: 10,
                preco_unt: 5,
              },
              quantidade: 1,
            },
          ],
        },
      ],
      isLoading: false,
      error: null,
      refetch: mockRefetch,
    }),
  };
});

vi.mock('../../services/entregaCestaService', () => ({
  registrarEntregaCesta: (...args: unknown[]) => mockRegistrar(...args),
}));

vi.mock('../../utils/toast', () => ({
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
  },
}));

import CestasVendedor from '../../pages/CestasVendedor';

function chainResolve(value: unknown) {
  const chain: Record<string, unknown> = {};
  chain.select = vi.fn(() => chain);
  chain.eq = vi.fn(() => chain);
  chain.single = vi.fn(async () => value);
  return chain;
}

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <CestasVendedor />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

async function abrirLoteEConfirmarDireto() {
  // Abre seleção de vendedor e escolhe o único disponível (botão do modal,
  // não a linha da tabela).
  fireEvent.click(screen.getByText('Entregar em Lote'));
  fireEvent.click(await screen.findByRole('button', { name: 'Vendedor Um' }));
  // Aguarda o modal de lote (abertura é assíncrona), soma 1 unidade e vai
  // para a prévia; vendedor não autônomo confirma direto sem gerar nota.
  await screen.findByText('Entregar Cestas');
  fireEvent.click(screen.getAllByText('+')[0]);
  fireEvent.click(screen.getByText(/Visualizar Nota/));
}

describe('CestasVendedor — entrega em lote sem autoridade na UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRegistrar.mockResolvedValue({ success: true, id: 'entrega-xyz-123' });
    mockFrom.mockImplementation(() =>
      chainResolve({
        data: { id: 'vend-1', nome: 'Vendedor Um', tipo_vinculo: 'mensalista' },
        error: null,
      }),
    );
  });

  it('2/3/4. lote envia só negócio — sem administrador_id, usuario_id, usuario_nome', async () => {
    renderPage();
    await abrirLoteEConfirmarDireto();
    await waitFor(() => expect(mockRegistrar).toHaveBeenCalledTimes(1));
    expect(mockRegistrar).toHaveBeenCalledWith({
      vendedorId: 'vend-1',
      cestaId: 'cesta-1',
      quantidade: 1,
      observacao: '',
    });
    const arg = mockRegistrar.mock.calls[0][0] as Record<string, unknown>;
    expect(Object.keys(arg).sort()).toEqual(
      ['cestaId', 'observacao', 'quantidade', 'vendedorId'].sort(),
    );
  });

  it('9. sucesso mantém toast de entrega registrada', async () => {
    renderPage();
    await abrirLoteEConfirmarDireto();
    await waitFor(() => expect(mockToastSuccess).toHaveBeenCalledTimes(1));
    expect(mockToastSuccess.mock.calls[0][0]).toContain('Entrega registrada');
    expect(screen.queryByText('Entregar Cestas')).not.toBeInTheDocument();
  });

  it('10. erro mantém toast de falha e preserva o lote', async () => {
    mockRegistrar.mockRejectedValue(new Error('Falha no servidor'));
    renderPage();
    await abrirLoteEConfirmarDireto();
    await waitFor(() => expect(mockToastError).toHaveBeenCalledTimes(1));
    expect(mockToastError.mock.calls[0][0]).toBe('Falha no servidor');
    // Modal segue aberto para nova tentativa.
    expect(screen.getByText('Entregar Cestas')).toBeInTheDocument();
  });
});
