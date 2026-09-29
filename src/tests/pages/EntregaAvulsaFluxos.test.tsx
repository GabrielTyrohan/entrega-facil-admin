import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

const mockCriar = vi.fn();
const mockAtualizar = vi.fn();
const mockExcluir = vi.fn();
const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();
const mockSalvarPdf = vi.fn();
const insertSpy = vi.fn();
const updateSpy = vi.fn();
const deleteSpy = vi.fn();

const { notaCapturada } = vi.hoisted(() => ({ notaCapturada: { atual: null as null | Record<string, unknown> } }));

function makeChain(terminal: unknown) {
  const chain: Record<string, unknown> = {};
  chain.select = vi.fn(() => chain);
  chain.eq = vi.fn(() => chain);
  chain.order = vi.fn(() => chain);
  chain.limit = vi.fn(async () => terminal);
  chain.single = vi.fn(async () => terminal);
  chain.insert = vi.fn((...a: unknown[]) => {
    insertSpy(...a);
    return chain;
  });
  chain.update = vi.fn((...a: unknown[]) => {
    updateSpy(...a);
    return chain;
  });
  chain.delete = vi.fn((...a: unknown[]) => {
    deleteSpy(...a);
    return chain;
  });
  return chain;
}

const VENDEDOR_AUTO = {
  id: 'vend-1',
  nome: 'João Autônomo',
  tipo_vinculo: 'autonomo',
  cpf_cnpj: '',
  telefone: '',
  endereco: '',
};

const HIST = [
  {
    id: 'ent-1',
    created_at: '2026-01-01T10:00:00',
    observacao: 'obs',
    usuario_nome: 'Op',
    vendedor_id: 'vend-1',
    vendedores: { nome: 'João Autônomo' },
    entregas_avulsas_itens: [
      {
        id: 'item-1',
        quantidade: 2,
        preco_unitario: 25,
        produto_cadastrado_id: 'prod-1',
        produtos_cadastrado: { id: 'prod-1', produto_nome: 'Arroz 5kg', qtd_estoque: 10 },
      },
    ],
  },
];

let historicoAtual: unknown[] = [];

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: (tabela: string) => {
      if (tabela === 'vendedores') {
        return makeChain({ data: VENDEDOR_AUTO, error: null });
      }
      if (tabela === 'entregas_avulsas') {
        return makeChain({ data: historicoAtual, error: null });
      }
      return makeChain({ data: null, error: null });
    },
  },
}));

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'user-1', email: 'admin@test.com' },
    adminId: 'admin-1',
    userProfile: { nome: 'Admin Teste', nome_empresa: 'Empresa Teste', telefone: '', cpf_cnpj: '' },
  }),
}));

vi.mock('../../hooks/useVendedores', () => ({
  useVendedoresByAdmin: () => ({
    data: [{ id: 'vend-1', nome: 'João Autônomo' }],
    isLoading: false,
  }),
}));

vi.mock('../../hooks/useProdutos', () => ({
  useProdutos: () => ({
    data: [
      {
        id: 'prod-1',
        produto_nome: 'Arroz 5kg',
        produto_cod: 'ARR001',
        categoria: 'Alimentos',
        qtd_estoque: 10,
        preco_unt: 25.0,
      },
    ],
    isLoading: false,
  }),
}));

vi.mock('../../services/entregaAvulsaService', () => ({
  criarEntregaAvulsaSegura: (...args: unknown[]) => mockCriar(...args),
  atualizarEntregaAvulsaSegura: (...args: unknown[]) => mockAtualizar(...args),
  excluirEntregaAvulsaSegura: (...args: unknown[]) => mockExcluir(...args),
}));

vi.mock('../../utils/toast', () => ({
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
  },
}));

vi.mock('../../utils/pdfStorage', () => ({
  salvarESalvarPdf: (...args: unknown[]) => mockSalvarPdf(...args),
}));

vi.mock('../../components/NotaPedidoAutonomo', () => ({
  default: (props: Record<string, unknown>) => {
    notaCapturada.atual = props;
    return (
      <div id="nota-pedido-avulsa" data-testid="nota-pedido-avulsa">
        Nota: {String(props.numeroPedido)}
      </div>
    );
  },
}));

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

async function fluxoCriarAtePreview() {
  fireEvent.click(screen.getByRole('button', { name: /nova entrega/i }));
  await waitFor(() => screen.getByText('João Autônomo'));
  fireEvent.change(screen.getByRole('combobox'), { target: { value: 'vend-1' } });
  await waitFor(() => screen.getByText('Arroz 5kg'));
  fireEvent.click(screen.getByRole('button', { name: /incluir na entrega/i }));
  fireEvent.click(screen.getByRole('button', { name: /visualizar nota/i }));
  await waitFor(() => expect(screen.getByTestId('nota-pedido-avulsa')).toBeInTheDocument());
}

describe('EntregaAvulsa — fluxos via RPCs seguras', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    historicoAtual = [];
    notaCapturada.atual = null;
    mockCriar.mockResolvedValue({ id: 'entrega-xyz-123' });
    mockAtualizar.mockResolvedValue({ success: true });
    mockExcluir.mockResolvedValue(undefined);
    (window as unknown as Record<string, unknown>).html2pdf = () => ({
      set: () => ({
        from: () => ({ outputBlob: async () => new Blob(['x'], { type: 'application/pdf' }) }),
      }),
    });
  });

  it('12/13/14/15. criação usa service, sem inserts diretos nem movimentarEstoque', async () => {
    renderPage();
    await fluxoCriarAtePreview();
    fireEvent.click(screen.getByRole('button', { name: /confirmar e gerar pdf/i }));
    await waitFor(() => expect(mockCriar).toHaveBeenCalledTimes(1));
    expect(mockCriar).toHaveBeenCalledWith({
      vendedorId: 'vend-1',
      itens: [{ produtoId: 'prod-1', quantidade: 1 }],
      observacao: null,
    });
    expect(insertSpy).not.toHaveBeenCalled();
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it('22. toast de criação permanece', async () => {
    renderPage();
    await fluxoCriarAtePreview();
    fireEvent.click(screen.getByRole('button', { name: /confirmar e gerar pdf/i }));
    await waitFor(() => expect(mockToastSuccess).toHaveBeenCalledWith(
      'Entrega confirmada! 1 produto(s) para João Autônomo.',
    ));
  });

  it('26. erro na criação é tratado', async () => {
    mockCriar.mockRejectedValue(new Error('Estoque insuficiente'));
    renderPage();
    await fluxoCriarAtePreview();
    fireEvent.click(screen.getByRole('button', { name: /confirmar e gerar pdf/i }));
    await waitFor(() => expect(mockToastError).toHaveBeenCalledWith(
      'Erro: Estoque insuficiente',
    ));
  });

  it('16/17/23. edição usa só RPC segura, sem escrita direta', async () => {
    historicoAtual = HIST;
    renderPage();
    await waitFor(() => expect(screen.getByTitle('Editar entrega')).toBeInTheDocument());
    fireEvent.click(screen.getByTitle('Editar entrega'));
    fireEvent.click(screen.getByRole('button', { name: /salvar alterações/i }));
    await waitFor(() => expect(mockAtualizar).toHaveBeenCalledTimes(1));
    expect(mockAtualizar).toHaveBeenCalledWith({
      entregaId: 'ent-1',
      itens: [{ produtoId: 'prod-1', quantidade: 2 }],
      observacao: 'obs',
    });
    expect(insertSpy).not.toHaveBeenCalled();
    expect(updateSpy).not.toHaveBeenCalled();
    expect(deleteSpy).not.toHaveBeenCalled();
    expect(mockToastSuccess).toHaveBeenCalledWith('Entrega atualizada com sucesso!');
  });

  it('19/20/21/24. exclusão usa só RPC segura, sem devolução manual', async () => {
    historicoAtual = HIST;
    renderPage();
    await waitFor(() => expect(screen.getByTitle('Excluir entrega')).toBeInTheDocument());
    fireEvent.click(screen.getByTitle('Excluir entrega'));
    fireEvent.click(screen.getByRole('button', { name: 'Excluir' }));
    await waitFor(() => expect(mockExcluir).toHaveBeenCalledTimes(1));
    expect(mockExcluir).toHaveBeenCalledWith('ent-1');
    expect(insertSpy).not.toHaveBeenCalled();
    expect(updateSpy).not.toHaveBeenCalled();
    expect(deleteSpy).not.toHaveBeenCalled();
    expect(mockToastSuccess).toHaveBeenCalledWith('Entrega excluída e estoque devolvido.');
  });
});
