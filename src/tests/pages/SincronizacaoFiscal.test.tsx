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
import { supabase } from '../../lib/supabase';

const mockRpc = (supabase as unknown as { rpc: ReturnType<typeof vi.fn> }).rpc;
const mockFrom = (supabase as unknown as { from: ReturnType<typeof vi.fn> }).from;

function validacaoOk(overrides: Record<string, unknown> = {}) {
  return {
    sucesso: true,
    pode_gravar: true,
    total_validos: 1,
    total_bloqueados: 0,
    total_avisos: 0,
    itens: [
      {
        referencia_id: 'ref-novo-1',
        sucesso: true,
        status: 'valido',
      },
    ],
    ...overrides,
  };
}

function gravacaoOk(overrides: Record<string, unknown> = {}) {
  return {
    sucesso: true,
    repeticao_idempotente: false,
    importacao_id: 'lote-importacao-1',
    total_criados: 1,
    itens: [
      {
        referencia_id: 'ref-novo-1',
        produto_id: 'produto-criado-1',
        descricao: 'Produto Novo Válido',
        sucesso: true,
      },
    ],
    ...overrides,
  };
}

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

function comparacaoComCandidatos() {
  const valido = {
    ...REFERENCIA,
    id: 'ref-novo-1',
    linha_origem: 101,
    descricao: 'Produto Novo Válido',
    codigo: '000123',
    codigo_barras: '0001234567890',
    ncm: '010063021',
    cest: '1704400',
    cfop_padrao: '5102',
    cst_icms: '0102',
    estoque: 7,
    preco1: 9.9,
    custo: 5,
    custo_compra: 4.5,
  };
  const quantidadeNegativa = {
    ...REFERENCIA,
    id: 'ref-novo-2',
    linha_origem: 102,
    descricao: 'Produto Quantidade Negativa',
    estoque: -2,
  };
  const semPreco = {
    ...REFERENCIA,
    id: 'ref-novo-3',
    linha_origem: 103,
    descricao: 'Produto Sem Preço',
    preco1: 0,
  };

  const candidato = (referencia: typeof REFERENCIA) => ({
    referencia,
    produto: null,
    tipo: 'nao_encontrada' as const,
    motivo: 'Produto não encontrado no catálogo.',
    estoque_atual: null,
    quantidade_planilha: referencia.estoque,
    estoque_proposto: null,
    estoque_invalido: false,
    divergencia_descricao: false,
    diferencas_fiscais: [],
  });

  return {
    referencia: [valido, quantidadeNegativa, semPreco],
    produtos: [],
    comparacao: [
      candidato(valido),
      candidato(quantidadeNegativa),
      candidato(semPreco),
    ],
    resumo: {
      total_referencias: 3,
      total_produtos_cadastrados: 0,
      total_correspondencias: 0,
      total_novos_produtos: 3,
      total_divergencias_fiscais: 0,
      total_bloqueados: 0,
      total_duplicados: 0,
      total_colisoes_descricao: 0,
    },
    avisos: [] as string[],
  };
}

function comparacaoComMuitosCandidatos(quantidade: number) {
  const referencias = Array.from({ length: quantidade }, (_, indice) => ({
    ...REFERENCIA,
    id: `ref-muitos-${indice + 1}`,
    linha_origem: 1000 + indice,
    descricao: `Produto Muitos ${indice + 1}`,
    codigo: `COD-${String(indice + 1).padStart(4, '0')}`,
    codigo_barras: `78900000${String(indice + 1).padStart(5, '0')}`,
    estoque: 2,
    preco1: 5,
    custo: 2,
    custo_compra: 1.5,
  }));

  return {
    referencia: referencias,
    produtos: [],
    comparacao: referencias.map((referencia) => ({
      referencia,
      produto: null,
      tipo: 'nao_encontrada' as const,
      motivo: 'Produto não encontrado no catálogo.',
      estoque_atual: null,
      quantidade_planilha: referencia.estoque,
      estoque_proposto: null,
      estoque_invalido: false,
      divergencia_descricao: false,
      diferencas_fiscais: [],
    })),
    resumo: {
      total_referencias: quantidade,
      total_produtos_cadastrados: 0,
      total_correspondencias: 0,
      total_novos_produtos: quantidade,
      total_divergencias_fiscais: 0,
      total_bloqueados: 0,
      total_duplicados: 0,
      total_colisoes_descricao: 0,
    },
    avisos: [] as string[],
  };
}

async function abrirAbaNovosProdutos() {
  await screen.findByText('Sincronização Fiscal');
  await userEvent.click(screen.getByRole('button', { name: 'Novos produtos' }));
}

async function selecionarCandidatoValido() {
  await userEvent.click(
    screen.getByRole('checkbox', {
      name: 'Selecionar Produto Novo Válido',
    }),
  );
}

async function configurarCandidatoValido(opcoes?: {
  categoria?: string;
  unidade?: string;
  ativo?: boolean;
  confirmarDuplicada?: boolean;
}) {
  const {
    categoria = 'Alimentos',
    unidade = 'UN',
    ativo = false,
    confirmarDuplicada = false,
  } = opcoes ?? {};

  if (categoria) {
    await userEvent.type(
      screen.getByLabelText('Categoria comercial de Produto Novo Válido'),
      categoria,
    );
  }
  if (unidade) {
    await userEvent.selectOptions(
      screen.getByLabelText('Unidade comercial de Produto Novo Válido'),
      unidade,
    );
  }
  if (ativo) {
    await userEvent.click(
      screen.getByLabelText('Ativo para Produto Novo Válido'),
    );
  }
  if (confirmarDuplicada) {
    await userEvent.click(
      screen.getByLabelText(
        'Confirmar descrição duplicada de Produto Novo Válido',
      ),
    );
  }
}

function chamadasRpcDoModo(modo: 'validar' | 'gravar') {
  return mockRpc.mock.calls.filter(
    (chamada) =>
      (chamada[1] as { p_modo?: string } | undefined)?.p_modo === modo,
  );
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
    mockRpc.mockReset();
    mockRpc.mockImplementation(
      (_nome: string, parametros: { p_modo?: string } | undefined) => {
        if (parametros?.p_modo === 'gravar') {
          return Promise.resolve({ data: gravacaoOk(), error: null });
        }
        return Promise.resolve({ data: validacaoOk(), error: null });
      },
    );
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

  it('seleciona somente candidatos elegíveis e mantém os bloqueados desmarcados', async () => {
    mockCriarComparacao.mockResolvedValue(comparacaoComCandidatos());

    renderPage();

    await screen.findByText('Sincronização Fiscal');
    await userEvent.click(screen.getByRole('button', { name: 'Novos produtos' }));

    const checkboxValido = screen.getByRole('checkbox', {
      name: 'Selecionar Produto Novo Válido',
    });
    const checkboxNegativo = screen.getByRole('checkbox', {
      name: 'Selecionar Produto Quantidade Negativa',
    });
    const checkboxSemPreco = screen.getByRole('checkbox', {
      name: 'Selecionar Produto Sem Preço',
    });

    expect(checkboxValido).toBeEnabled();
    expect(checkboxNegativo).toBeDisabled();
    expect(checkboxSemPreco).toBeDisabled();

    const linhaValida = screen.getByText('Produto Novo Válido').closest('tr');
    expect(linhaValida).not.toBeNull();
    expect(
      within(linhaValida as HTMLElement).getByText('Revisar', {
        selector: 'span',
      }),
    ).toBeInTheDocument();

    const linhaNegativa = screen
      .getByText('Produto Quantidade Negativa')
      .closest('tr');
    expect(linhaNegativa).not.toBeNull();
    expect(within(linhaNegativa as HTMLElement).getByText('-2')).toBeInTheDocument();
    expect(
      within(linhaNegativa as HTMLElement).getByText('Bloqueado', {
        selector: 'span',
      }),
    ).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole('button', { name: 'Selecionar todos os elegíveis' }),
    );

    expect(checkboxValido).toBeChecked();
    expect(checkboxNegativo).not.toBeChecked();
    expect(checkboxSemPreco).not.toBeChecked();
    expect(screen.getByText(/1 selecionado/)).toBeInTheDocument();

    const cardProntos = screen.getByText('Prontos').closest('div');
    const cardRevisao = screen.getByText('Em revisão').closest('div');
    const cardBloqueados = screen
      .getByText('Bloqueados (não selecionáveis)')
      .closest('div');
    expect(within(cardProntos as HTMLElement).getByText('0')).toBeInTheDocument();
    expect(within(cardRevisao as HTMLElement).getByText('1')).toBeInTheDocument();
    expect(
      within(cardBloqueados as HTMLElement).getByText('2'),
    ).toBeInTheDocument();

    expect(
      screen.getByRole('button', { name: /Importar selecionados/ }),
    ).toBeDisabled();
    expect(
      screen.getByText(/A validação não grava dados/),
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Desmarcar todos' }));
    expect(checkboxValido).not.toBeChecked();
    expect(screen.getByText(/0 selecionados/)).toBeInTheDocument();
  });

  it('abre o painel de revisão com dados comerciais, fiscais e pendências', async () => {
    mockCriarComparacao.mockResolvedValue(comparacaoComCandidatos());

    renderPage();

    await screen.findByText('Sincronização Fiscal');
    await userEvent.click(screen.getByRole('button', { name: 'Novos produtos' }));
    await userEvent.click(
      screen.getByRole('button', { name: 'Revisar Produto Novo Válido' }),
    );

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('Dados comerciais')).toBeInTheDocument();
    expect(
      within(dialog).getByText('Dados fiscais da referência'),
    ).toBeInTheDocument();
    expect(within(dialog).getByText('Categoria comercial')).toBeInTheDocument();
    expect(within(dialog).getAllByText('pendente de definição')).toHaveLength(2);
    expect(within(dialog).getByText('010063021')).toBeInTheDocument();
    expect(within(dialog).getByText('0102')).toBeInTheDocument();
    expect(
      within(dialog).getByText(/fiscal_status = validado/),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText(/Nenhuma alteração foi feita no banco de dados/),
    ).toBeInTheDocument();

    const botaoSelecionar = within(dialog).getByRole('button', {
      name: 'Selecionar candidato',
    });
    expect(botaoSelecionar).toBeEnabled();
    await userEvent.click(botaoSelecionar);
    expect(
      within(dialog).getByRole('button', { name: 'Remover seleção' }),
    ).toBeInTheDocument();

    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Fechar' }),
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('mostra os bloqueios no painel e impede a seleção do candidato bloqueado', async () => {
    mockCriarComparacao.mockResolvedValue(comparacaoComCandidatos());

    renderPage();

    await screen.findByText('Sincronização Fiscal');
    await userEvent.click(screen.getByRole('button', { name: 'Novos produtos' }));
    await userEvent.click(
      screen.getByRole('button', {
        name: 'Revisar Produto Quantidade Negativa',
      }),
    );

    const dialog = screen.getByRole('dialog');
    expect(
      within(dialog).getByText(
        'Quantidade de estoque negativa na base de referência.',
      ),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole('button', {
        name: 'Bloqueado — não selecionável',
      }),
    ).toBeDisabled();
  });

  describe('importação fiscal em lote com validação e confirmação', () => {
    beforeEach(() => {
      mockCriarComparacao.mockResolvedValue(comparacaoComCandidatos());
    });

    it('1. não permite selecionar nem enviar candidatos bloqueados', async () => {
      renderPage();
      await abrirAbaNovosProdutos();

      const bloqueadoNegativo = screen.getByRole('checkbox', {
        name: 'Selecionar Produto Quantidade Negativa',
      });
      const bloqueadoSemPreco = screen.getByRole('checkbox', {
        name: 'Selecionar Produto Sem Preço',
      });
      expect(bloqueadoNegativo).toBeDisabled();
      expect(bloqueadoSemPreco).toBeDisabled();

      await userEvent.click(
        screen.getByRole('button', { name: 'Selecionar todos os elegíveis' }),
      );
      expect(bloqueadoNegativo).not.toBeChecked();
      expect(bloqueadoSemPreco).not.toBeChecked();

      await configurarCandidatoValido();
      await userEvent.click(
        screen.getByRole('button', { name: 'Validar selecionados' }),
      );

      await waitFor(() =>
        expect(chamadasRpcDoModo('validar')).toHaveLength(1),
      );
      const parametros = chamadasRpcDoModo('validar')[0][1] as {
        p_itens: Array<{ referencia_id: string }>;
      };
      expect(parametros.p_itens.map((item) => item.referencia_id)).toEqual([
        'ref-novo-1',
      ]);
    });

    it('2. bloqueia a validação quando a categoria comercial está ausente', async () => {
      renderPage();
      await abrirAbaNovosProdutos();
      await selecionarCandidatoValido();
      await configurarCandidatoValido({ categoria: '', unidade: 'UN' });

      await userEvent.click(
        screen.getByRole('button', { name: 'Validar selecionados' }),
      );

      expect(
        await screen.findByText(/Informe a categoria comercial/),
      ).toBeInTheDocument();
      expect(mockRpc).not.toHaveBeenCalled();
    });

    it('3. bloqueia a validação quando a unidade comercial está ausente', async () => {
      renderPage();
      await abrirAbaNovosProdutos();
      await selecionarCandidatoValido();
      await configurarCandidatoValido({ categoria: 'Alimentos', unidade: '' });

      await userEvent.click(
        screen.getByRole('button', { name: 'Validar selecionados' }),
      );

      expect(
        await screen.findByText(/Selecione a unidade comercial/),
      ).toBeInTheDocument();
      expect(mockRpc).not.toHaveBeenCalled();
    });

    it('4. envia o estado ativo explícito, iniciando como inativo e permitindo ativo', async () => {
      renderPage();
      await abrirAbaNovosProdutos();
      await selecionarCandidatoValido();
      await configurarCandidatoValido();

      expect(
        screen.getByLabelText('Inativo para Produto Novo Válido'),
      ).toBeChecked();
      expect(
        screen.getByLabelText('Ativo para Produto Novo Válido'),
      ).not.toBeChecked();

      await userEvent.click(
        screen.getByRole('button', { name: 'Validar selecionados' }),
      );
      await waitFor(() =>
        expect(chamadasRpcDoModo('validar')).toHaveLength(1),
      );
      expect(
        (
          chamadasRpcDoModo('validar')[0][1] as {
            p_itens: Array<{ ativo: boolean }>;
          }
        ).p_itens[0].ativo,
      ).toBe(false);

      await userEvent.click(
        screen.getByLabelText('Ativo para Produto Novo Válido'),
      );
      await userEvent.click(
        screen.getByRole('button', { name: 'Validar selecionados' }),
      );
      await waitFor(() =>
        expect(chamadasRpcDoModo('validar')).toHaveLength(2),
      );
      expect(
        (
          chamadasRpcDoModo('validar')[1][1] as {
            p_itens: Array<{ ativo: boolean }>;
          }
        ).p_itens[0].ativo,
      ).toBe(true);
    });

    it('5. impede enviar mais de 100 itens e informa o limite', async () => {
      mockCriarComparacao.mockResolvedValue(
        comparacaoComMuitosCandidatos(101),
      );

      renderPage();
      await abrirAbaNovosProdutos();
      await userEvent.click(
        screen.getByRole('button', { name: 'Selecionar todos os elegíveis' }),
      );

      const alertaLimite = screen.getByRole('alert');
      expect(alertaLimite).toHaveTextContent(
        /A RPC aceita no máximo 100 por lote/,
      );
      expect(
        screen.getByRole('button', { name: 'Validar selecionados' }),
      ).toBeDisabled();
      expect(mockRpc).not.toHaveBeenCalled();
    });

    it('6. valida com p_modo validar e p_idempotency_key nulo', async () => {
      renderPage();
      await abrirAbaNovosProdutos();
      await selecionarCandidatoValido();
      await configurarCandidatoValido();

      await userEvent.click(
        screen.getByRole('button', { name: 'Validar selecionados' }),
      );
      await waitFor(() =>
        expect(chamadasRpcDoModo('validar')).toHaveLength(1),
      );

      const [nome, parametros] = chamadasRpcDoModo('validar')[0] as [
        string,
        Record<string, unknown>,
      ];
      expect(nome).toBe('importar_produtos_fiscal_lote_seguro');
      expect(parametros.p_modo).toBe('validar');
      expect(parametros.p_idempotency_key).toBeNull();
      expect(parametros.p_itens).toHaveLength(1);
    });

    it('7. a validação não executa escrita direta em tabelas', async () => {
      renderPage();
      await abrirAbaNovosProdutos();
      await selecionarCandidatoValido();
      await configurarCandidatoValido();

      await userEvent.click(
        screen.getByRole('button', { name: 'Validar selecionados' }),
      );
      await waitFor(() =>
        expect(chamadasRpcDoModo('validar')).toHaveLength(1),
      );

      expect(mockFrom).not.toHaveBeenCalled();
      expect(chamadasRpcDoModo('gravar')).toHaveLength(0);
    });

    it('8. mantém a importação desabilitada quando pode_gravar não é true', async () => {
      mockRpc.mockImplementation((_nome: string, parametros: { p_modo?: string }) => {
        if (parametros.p_modo === 'validar') {
          return Promise.resolve({
            data: validacaoOk({
              pode_gravar: false,
              total_validos: 0,
              total_bloqueados: 1,
              itens: [
                {
                  referencia_id: 'ref-novo-1',
                  sucesso: false,
                  status: 'bloqueado',
                  erro: 'Descrição duplicada exige confirmação.',
                },
              ],
            }),
            error: null,
          });
        }
        return Promise.resolve({ data: gravacaoOk(), error: null });
      });

      renderPage();
      await abrirAbaNovosProdutos();
      await selecionarCandidatoValido();
      await configurarCandidatoValido();

      await userEvent.click(
        screen.getByRole('button', { name: 'Validar selecionados' }),
      );

      expect(
        await screen.findByText('Confirmação bloqueada'),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: 'Importar selecionados' }),
      ).toBeDisabled();
      expect(chamadasRpcDoModo('gravar')).toHaveLength(0);
    });

    it('9. exige confirmação explícita e não grava ao validar', async () => {
      renderPage();
      await abrirAbaNovosProdutos();
      await selecionarCandidatoValido();
      await configurarCandidatoValido();

      await userEvent.click(
        screen.getByRole('button', { name: 'Validar selecionados' }),
      );
      await waitFor(() =>
        expect(chamadasRpcDoModo('validar')).toHaveLength(1),
      );
      expect(chamadasRpcDoModo('gravar')).toHaveLength(0);

      await userEvent.click(
        screen.getByRole('button', { name: 'Importar selecionados' }),
      );
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(chamadasRpcDoModo('gravar')).toHaveLength(0);

      await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(chamadasRpcDoModo('gravar')).toHaveLength(0);
    });

    it('10. grava com p_modo gravar e UUID somente após confirmar', async () => {
      renderPage();
      await abrirAbaNovosProdutos();
      await selecionarCandidatoValido();
      await configurarCandidatoValido();

      await userEvent.click(
        screen.getByRole('button', { name: 'Validar selecionados' }),
      );
      await waitFor(() =>
        expect(chamadasRpcDoModo('validar')).toHaveLength(1),
      );
      await userEvent.click(
        screen.getByRole('button', { name: 'Importar selecionados' }),
      );
      await userEvent.click(
        screen.getByRole('button', { name: 'Confirmar e importar' }),
      );

      expect(
        await screen.findByText('Importação concluída'),
      ).toBeInTheDocument();
      const [nome, parametros] = chamadasRpcDoModo('gravar')[0] as [
        string,
        Record<string, unknown>,
      ];
      expect(nome).toBe('importar_produtos_fiscal_lote_seguro');
      expect(parametros.p_modo).toBe('gravar');
      expect(parametros.p_idempotency_key).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );
      expect(parametros.p_itens).toEqual([
        {
          referencia_id: 'ref-novo-1',
          categoria: 'Alimentos',
          unidade_medida: 'UN',
          ativo: false,
          confirmar_descricao_duplicada: false,
        },
      ]);
    });

    it('11. reutiliza a mesma chave UUID em retry da mesma operação', async () => {
      let tentativasGravacao = 0;
      mockRpc.mockImplementation(
        (_nome: string, parametros: { p_modo?: string }) => {
          if (parametros.p_modo === 'validar') {
            return Promise.resolve({ data: validacaoOk(), error: null });
          }
          tentativasGravacao += 1;
          if (tentativasGravacao === 1) {
            return Promise.resolve({
              data: null,
              error: { message: 'Falha temporária de rede' },
            });
          }
          return Promise.resolve({ data: gravacaoOk(), error: null });
        },
      );

      renderPage();
      await abrirAbaNovosProdutos();
      await selecionarCandidatoValido();
      await configurarCandidatoValido();
      await userEvent.click(
        screen.getByRole('button', { name: 'Validar selecionados' }),
      );
      await waitFor(() =>
        expect(chamadasRpcDoModo('validar')).toHaveLength(1),
      );
      await userEvent.click(
        screen.getByRole('button', { name: 'Importar selecionados' }),
      );
      await userEvent.click(
        screen.getByRole('button', { name: 'Confirmar e importar' }),
      );

      expect(
        await screen.findByText('A importação não foi confirmada'),
      ).toBeInTheDocument();
      expect(screen.queryByText('Importação concluída')).not.toBeInTheDocument();

      await userEvent.click(
        screen.getByRole('button', { name: 'Confirmar e importar' }),
      );
      expect(
        await screen.findByText('Importação concluída'),
      ).toBeInTheDocument();

      const gravacoes = chamadasRpcDoModo('gravar');
      expect(gravacoes).toHaveLength(2);
      const primeiraChave = (gravacoes[0][1] as { p_idempotency_key: string })
        .p_idempotency_key;
      const segundaChave = (gravacoes[1][1] as { p_idempotency_key: string })
        .p_idempotency_key;
      expect(primeiraChave).toBe(segundaChave);
    });

    it('12. não declara sucesso quando a RPC de gravação falha', async () => {
      mockRpc.mockImplementation(
        (_nome: string, parametros: { p_modo?: string }) => {
          if (parametros.p_modo === 'validar') {
            return Promise.resolve({ data: validacaoOk(), error: null });
          }
          return Promise.resolve({
            data: null,
            error: { message: 'Falha de rede ao gravar' },
          });
        },
      );

      renderPage();
      await abrirAbaNovosProdutos();
      await selecionarCandidatoValido();
      await configurarCandidatoValido();
      await userEvent.click(
        screen.getByRole('button', { name: 'Validar selecionados' }),
      );
      await waitFor(() =>
        expect(chamadasRpcDoModo('validar')).toHaveLength(1),
      );
      await userEvent.click(
        screen.getByRole('button', { name: 'Importar selecionados' }),
      );
      await userEvent.click(
        screen.getByRole('button', { name: 'Confirmar e importar' }),
      );

      expect(
        await screen.findByText('A importação não foi confirmada'),
      ).toBeInTheDocument();
      expect(screen.getByText('Falha de rede ao gravar')).toBeInTheDocument();
      expect(screen.queryByText('Importação concluída')).not.toBeInTheDocument();
      expect(chamadasRpcDoModo('gravar')).toHaveLength(1);
    });

    it('13. trata repetição idempotente sem declarar duplicação', async () => {
      mockRpc.mockImplementation(
        (_nome: string, parametros: { p_modo?: string }) => {
          if (parametros.p_modo === 'validar') {
            return Promise.resolve({ data: validacaoOk(), error: null });
          }
          return Promise.resolve({
            data: gravacaoOk({
              repeticao_idempotente: true,
              total_criados: 0,
            }),
            error: null,
          });
        },
      );

      renderPage();
      await abrirAbaNovosProdutos();
      await selecionarCandidatoValido();
      await configurarCandidatoValido();
      await userEvent.click(
        screen.getByRole('button', { name: 'Validar selecionados' }),
      );
      await waitFor(() =>
        expect(chamadasRpcDoModo('validar')).toHaveLength(1),
      );
      await userEvent.click(
        screen.getByRole('button', { name: 'Importar selecionados' }),
      );
      await userEvent.click(
        screen.getByRole('button', { name: 'Confirmar e importar' }),
      );

      expect(
        await screen.findByText('Lote já importado anteriormente'),
      ).toBeInTheDocument();
      expect(
        screen.getByText(/Nenhum produto foi duplicado/),
      ).toBeInTheDocument();
    });

    it('14. exibe o ID do lote e os IDs dos produtos retornados', async () => {
      mockRpc.mockImplementation(
        (_nome: string, parametros: { p_modo?: string }) => {
          if (parametros.p_modo === 'validar') {
            return Promise.resolve({ data: validacaoOk(), error: null });
          }
          return Promise.resolve({
            data: gravacaoOk({
              importacao_id: 'lote-abc-123',
              itens: [
                {
                  referencia_id: 'ref-novo-1',
                  produto_id: 'produto-xyz-789',
                  descricao: 'Produto Novo Válido',
                  sucesso: true,
                },
              ],
            }),
            error: null,
          });
        },
      );

      renderPage();
      await abrirAbaNovosProdutos();
      await selecionarCandidatoValido();
      await configurarCandidatoValido();
      await userEvent.click(
        screen.getByRole('button', { name: 'Validar selecionados' }),
      );
      await waitFor(() =>
        expect(chamadasRpcDoModo('validar')).toHaveLength(1),
      );
      await userEvent.click(
        screen.getByRole('button', { name: 'Importar selecionados' }),
      );
      await userEvent.click(
        screen.getByRole('button', { name: 'Confirmar e importar' }),
      );

      expect(await screen.findByText('lote-abc-123')).toBeInTheDocument();
      expect(screen.getByText('produto-xyz-789')).toBeInTheDocument();
      expect(screen.getByText('Importação concluída')).toBeInTheDocument();
    });

    it('15. envia somente os cinco campos comerciais permitidos', async () => {
      renderPage();
      await abrirAbaNovosProdutos();
      await selecionarCandidatoValido();
      await configurarCandidatoValido({ confirmarDuplicada: true });

      await userEvent.click(
        screen.getByRole('button', { name: 'Validar selecionados' }),
      );
      await waitFor(() =>
        expect(chamadasRpcDoModo('validar')).toHaveLength(1),
      );

      const item = (
        chamadasRpcDoModo('validar')[0][1] as {
          p_itens: Array<Record<string, unknown>>;
        }
      ).p_itens[0];
      expect(item).toEqual({
        referencia_id: 'ref-novo-1',
        categoria: 'Alimentos',
        unidade_medida: 'UN',
        ativo: false,
        confirmar_descricao_duplicada: true,
      });
      expect(Object.keys(item).sort()).toEqual(
        [
          'ativo',
          'categoria',
          'confirmar_descricao_duplicada',
          'referencia_id',
          'unidade_medida',
        ].sort(),
      );
      expect(item).not.toHaveProperty('ncm');
      expect(item).not.toHaveProperty('cest');
      expect(item).not.toHaveProperty('preco');
      expect(item).not.toHaveProperty('custo');
      expect(item).not.toHaveProperty('estoque');
      expect(item).not.toHaveProperty('codigo');
      expect(item).not.toHaveProperty('codigo_barras');
      expect(item).not.toHaveProperty('administrador_id');
    });

    it('16. mantém as demais abas e o cadastro manual intactos', async () => {
      mockCriarComparacao.mockResolvedValue(comparacaoValida());
      renderPage();

      await screen.findByText('Sincronização Fiscal');
      await userEvent.click(
        screen.getByRole('button', { name: 'Correspondências' }),
      );
      expect(screen.getByText('Arroz Tio João 5kg')).toBeInTheDocument();
      await userEvent.click(
        screen.getByRole('button', { name: 'Novos produtos' }),
      );
      expect(screen.getByText('Nenhum registro encontrado.')).toBeInTheDocument();
      await userEvent.click(
        screen.getByRole('button', { name: 'Comparação fiscal' }),
      );
      expect(screen.getByText('Arroz Tio João 5kg')).toBeInTheDocument();

      const fs = await import('node:fs');
      const path = await import('node:path');
      const novoProduto = fs.readFileSync(
        path.resolve(process.cwd(), 'src/pages/NovoProduto.tsx'),
        'utf8',
      );
      expect(novoProduto).toContain("functions.invoke('cadastrar-produto'");
      expect(novoProduto).not.toContain(
        'importar_produtos_fiscal_lote_seguro',
      );
    });
  });
});
