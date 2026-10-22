import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const mockCriarComparacao = vi.fn();
const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();

const { mockUseAuth } = vi.hoisted(() => ({ mockUseAuth: vi.fn() }));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: (...args: unknown[]) => mockUseAuth(...args),
}));

vi.mock('../../services/sincronizacaoFiscalService', () => ({
  carregarComparacaoFiscal: (...args: unknown[]) => mockCriarComparacao(...args),
}));

vi.mock('../../utils/toast', () => ({
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
  },
}));

import SincronizacaoFiscal from '../../pages/SincronizacaoFiscal';

const REFERENCIA = {
  id: 'ref-1',
  administrador_id: 'admin-1',
  linha_origem: 1,
  codigo: 'PROD-001',
  codigo_barras: '7891234567890',
  descricao: 'Arroz Tio João 5kg',
  ncm: '10063021',
  cest: '1704400',
  cfop_padrao: '5102',
  cst_icms: '102',
  aliquota_icms: 18,
  cst_pis: '01',
  aliquota_pis: 1.65,
  cst_cofins: '01',
  aliquota_cofins: 3.0,
  estoque: 10,
  valor_estoque: 50.0,
  preco1: 12.9,
};

const PRODUTO = {
  id: 'prod-1',
  administrador_id: 'admin-1',
  produto_nome: 'Arroz Tio João 5kg',
  produto_cod: 'PROD-001',
  categoria: 'Alimentos',
  qtd_estoque: 5,
  preco_unt: 12.9,
  codigo_barras: '7891234567890',
  ncm: '10063021',
  cest: '1704400',
  cfop_padrao: '5102',
  cst_icms: '102',
  aliquota_icms: 18,
  cst_pis: '01',
  aliquota_pis: 1.65,
  cst_cofins: '01',
  aliquota_cofins: 3.0,
  origem_mercadoria: 0,
  categoria_fiscal: 'Alimento',
  ativo: true,
};

function comparacaoValida() {
  return {
    referencia: [REFERENCIA],
    produtos: [PRODUTO],
    comparacao: [
      {
        referencia: REFERENCIA,
        produto: PRODUTO,
        tipo: 'encontrada' as const,
        criterio_correspondencia: 'codigo_barras' as const,
        estoque_atual: 5,
        quantidade_planilha: 10,
        estoque_proposto: 15,
        estoque_invalido: false,
        divergencia_descricao: false,
        diferencas_fiscais: [],
      },
    ],
    resumo: {
      total_referencias: 1,
      total_produtos_cadastrados: 1,
      total_correspondencias: 1,
      total_novos_produtos: 0,
      total_divergencias_fiscais: 0,
      total_bloqueados: 0,
      total_duplicados: 0,
      total_colisoes_descricao: 0,
    },
    avisos: [] as string[],
  };
}

function renderPage() {
  mockUseAuth.mockReturnValue({
    userType: 'admin',
    userProfile: { id: 'admin-1', nome: 'Admin', email: 'admin@test.com' },
  });
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <SincronizacaoFiscal />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('SincronizacaoFiscal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCriarComparacao.mockResolvedValue(comparacaoValida());
    mockToastSuccess.mockClear();
    mockToastError.mockClear();
  });

  it('renderiza a tela de prévia com aviso de somente leitura', async () => {
    renderPage();

    expect(await screen.findByText('Sincronização Fiscal')).toBeInTheDocument();
    expect(screen.getByText(/Somente leitura de referência/)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Atualizar prévia/ }),
    ).toBeInTheDocument();
  });

  it('carrega a comparação para o administrador logado', async () => {
    renderPage();

    await waitFor(() => expect(mockCriarComparacao).toHaveBeenCalledWith('admin-1'));
  });

  it('exibe os totais do resumo da auditoria', async () => {
    renderPage();

    await screen.findByText('Sincronização Fiscal');
    expect(screen.getAllByText('Referências fiscais').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Produtos cadastrados').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Correspondências').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Novos produtos').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Divergências fiscais').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Bloqueados por estoque').length).toBeGreaterThan(0);
  });

  it('lista a comparação com estoque atual, quantidade da referência e estoque proposto', async () => {
    renderPage();

    await screen.findByText('Sincronização Fiscal');
    await userEvent.click(screen.getByRole('button', { name: 'Comparação fiscal' }));

    expect(screen.getByText('Arroz Tio João 5kg')).toBeInTheDocument();
    expect(screen.getByText('Estoque atual')).toBeInTheDocument();
    expect(screen.getByText('Qtd referência')).toBeInTheDocument();
    expect(screen.getByText('Estoque proposto')).toBeInTheDocument();
    expect(screen.getByText('Conforme')).toBeInTheDocument();
  });

  it('mostra estoque atual e proposto inexistentes quando o produto não é encontrado', async () => {
    mockCriarComparacao.mockResolvedValue({
      ...comparacaoValida(),
      comparacao: [
        {
          ...comparacaoValida().comparacao[0],
          referencia: { ...REFERENCIA, descricao: 'SAL REFINADO CISNE 1KG', estoque: 885 },
          produto: null,
          tipo: 'nao_encontrada' as const,
          motivo: 'Produto não encontrado no catálogo.',
          estoque_atual: null,
          quantidade_planilha: 885,
          estoque_proposto: null,
          estoque_invalido: false,
        },
      ],
      resumo: {
        ...comparacaoValida().resumo,
        total_correspondencias: 0,
        total_novos_produtos: 1,
      },
    });

    renderPage();

    await screen.findByText('Sincronização Fiscal');
    await userEvent.click(screen.getByRole('button', { name: 'Comparação fiscal' }));

    expect(screen.getByText('SAL REFINADO CISNE 1KG')).toBeInTheDocument();
    expect(screen.getByText('Produto não encontrado')).toBeInTheDocument();
    expect(screen.getByText('885')).toBeInTheDocument();

    const linha = screen.getByText('Produto não encontrado').closest('tr');
    expect(linha).not.toBeNull();
    const celulas = within(linha as HTMLElement).getAllByText('—');
    expect(celulas.length).toBeGreaterThanOrEqual(2);
  });

  it('sinaliza estoque inválido sem apresentar proposta de estoque', async () => {
    mockCriarComparacao.mockResolvedValue({
      ...comparacaoValida(),
      comparacao: [
        {
          ...comparacaoValida().comparacao[0],
          quantidade_planilha: null,
          estoque_proposto: null,
          estoque_invalido: true,
          estoque_motivo: 'Quantidade de estoque ausente na base de referência.',
        },
      ],
      resumo: {
        ...comparacaoValida().resumo,
        total_bloqueados: 1,
      },
    });

    renderPage();

    await screen.findByText('Sincronização Fiscal');
    await userEvent.click(screen.getByRole('button', { name: 'Comparação fiscal' }));

    expect(screen.getByText('Estoque inválido')).toBeInTheDocument();
    expect(screen.queryByText('Conforme')).not.toBeInTheDocument();
  });

  it('permite trocar entre as abas da prévia', async () => {
    renderPage();

    await screen.findByText('Sincronização Fiscal');
    await userEvent.click(screen.getByRole('button', { name: 'Novos produtos' }));
    expect(screen.getByText('Nenhum registro encontrado.')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Comparação fiscal' }));
    expect(screen.getByText('Arroz Tio João 5kg')).toBeInTheDocument();
  });

  it('exibe os avisos de integridade da leitura', async () => {
    mockCriarComparacao.mockResolvedValue({
      ...comparacaoValida(),
      avisos: [
        'Base fiscal de referência: faltaram 23 linha(s) — a paginação não devolveu a base completa (1277 de 1300).',
      ],
    });

    renderPage();

    expect(
      await screen.findByText('A leitura encontrou inconsistências'),
    ).toBeInTheDocument();
    expect(screen.getByText(/faltaram 23 linha/i)).toBeInTheDocument();
  });

  it('mostra o motivo da correspondência ambígua na tabela', async () => {
    mockCriarComparacao.mockResolvedValue({
      ...comparacaoValida(),
      comparacao: [
        {
          ...comparacaoValida().comparacao[0],
          tipo: 'ambigua' as const,
          motivo:
            'Descrições distintas colidem na normalização (SAL REFINADO CISNE 1KG x SAL REFINADO CISNE1 KG). Correspondência automática não aplicada.',
          estoque_atual: null,
          estoque_proposto: null,
        },
      ],
    });

    renderPage();

    await screen.findByText('Sincronização Fiscal');
    await userEvent.click(screen.getByRole('button', { name: 'Comparação fiscal' }));

    expect(screen.getByText('Ambígua')).toBeInTheDocument();
    expect(screen.getByText(/colidem na normalização/i)).toBeInTheDocument();
  });

  it('exibe erro quando a prévia falha ao carregar', async () => {
    mockCriarComparacao.mockRejectedValue(new Error('Falha ao ler base fiscal'));

    renderPage();

    expect(await screen.findByText('Erro ao carregar')).toBeInTheDocument();
    expect(screen.getByText('Falha ao ler base fiscal')).toBeInTheDocument();
    expect(mockToastError).toHaveBeenCalled();
  });
});
