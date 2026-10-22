import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockFrom,
  mockSelect,
  mockEq,
  mockOrder,
  mockRange,
  mockInsert,
  mockUpdate,
  mockUpsert,
  mockDelete,
  mockRpc,
  dadosPorTabela,
  erroPorTabela,
  erroContagemPorTabela,
  opcoesPaginacaoPorTabela,
} = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockSelect: vi.fn(),
  mockEq: vi.fn(),
  mockOrder: vi.fn(),
  mockRange: vi.fn(),
  mockInsert: vi.fn(),
  mockUpdate: vi.fn(),
  mockUpsert: vi.fn(),
  mockDelete: vi.fn(),
  mockRpc: vi.fn(),
  dadosPorTabela: new Map<string, unknown[]>(),
  erroPorTabela: new Map<string, { message: string }>(),
  erroContagemPorTabela: new Map<string, { message: string }>(),
  opcoesPaginacaoPorTabela: new Map<string, OpcoesPaginacaoMock>(),
}));

type ResultadoConsulta = {
  data: unknown[] | null;
  error: { message: string } | null;
  count?: number | null;
};

/**
 * Simula falhas de paginação do servidor:
 * - `totalInformado`: total devolvido pela contagem (pode divergir das linhas
 *   realmente lidas — é assim que uma lacuna é detectada);
 * - `sobrepor`: repete a última linha da página anterior (registro repetido);
 * - `maximoLinhasPorPagina`: devolve páginas incompletas a partir da segunda.
 */
type OpcoesPaginacaoMock = {
  totalInformado?: number;
  sobrepor?: boolean;
  maximoLinhasPorPagina?: number;
};

/**
 * Query builder do Supabase: `select`, `eq`, `order` e `range` devolvem o
 * próprio builder (encadeamento) e o builder é "thenable", então `await`
 * resolve `{ data, error }` como no client real.
 *
 * O `range(de, ate)` recorta os dados da tabela mockada, reproduzindo o
 * limite de 1.000 linhas do PostgREST.
 *
 * `select(colunas, { head: true, count: 'exact' })` devolve somente a
 * contagem (`data: null`), como acontece na consulta de conferência do total.
 */
function criarBuilder(tabela: string) {
  let faixa: { de: number; ate: number } | null = null;
  let somenteContagem = false;

  const builder = {
    select: (...args: unknown[]) => {
      mockSelect(tabela, ...args);
      const opcoes = args[1] as { head?: boolean } | undefined;
      somenteContagem = Boolean(opcoes?.head);
      return builder;
    },
    eq: (...args: unknown[]) => {
      mockEq(tabela, ...args);
      return builder;
    },
    order: (...args: unknown[]) => {
      mockOrder(tabela, ...args);
      return builder;
    },
    range: (de: number, ate: number) => {
      mockRange(tabela, de, ate);
      faixa = { de, ate };
      return builder;
    },
    limit: (...args: unknown[]) => {
      mockOrder(tabela, 'limit', ...args);
      return builder;
    },
    insert: (...args: unknown[]) => {
      mockInsert(tabela, ...args);
      return builder;
    },
    update: (...args: unknown[]) => {
      mockUpdate(tabela, ...args);
      return builder;
    },
    upsert: (...args: unknown[]) => {
      mockUpsert(tabela, ...args);
      return builder;
    },
    delete: (...args: unknown[]) => {
      mockDelete(tabela, ...args);
      return builder;
    },
    then: (
      onFulfilled?: (resultado: ResultadoConsulta) => unknown,
      onRejected?: (erro: unknown) => unknown,
    ) => {
      const erro = erroPorTabela.get(tabela) ?? null;
      const erroContagem = erroContagemPorTabela.get(tabela) ?? null;
      const todas = dadosPorTabela.get(tabela) ?? [];
      const opcoes = opcoesPaginacaoPorTabela.get(tabela) ?? {};
      const total = opcoes.totalInformado ?? todas.length;

      if (somenteContagem) {
        const resultado: ResultadoConsulta = {
          data: null,
          error: erro ?? erroContagem,
          count: erro ?? erroContagem ? null : total,
        };
        return Promise.resolve(resultado).then(onFulfilled, onRejected);
      }

      let pagina: unknown[];
      if (faixa) {
        const inicio = opcoes.sobrepor && faixa.de > 0 ? faixa.de - 1 : faixa.de;
        pagina = todas.slice(inicio, faixa.ate + 1);
        if (opcoes.maximoLinhasPorPagina !== undefined && faixa.de > 0) {
          pagina = pagina.slice(0, opcoes.maximoLinhasPorPagina);
        }
      } else {
        pagina = todas;
      }

      const resultado: ResultadoConsulta = {
        data: erro ? null : pagina,
        error: erro,
        count: total,
      };
      return Promise.resolve(resultado).then(onFulfilled, onRejected);
    },
  };
  return builder;
}

vi.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: (...args: unknown[]) => mockRpc(...args),
    from: (...args: unknown[]) => {
      mockFrom(...args);
      return criarBuilder(args[0] as string);
    },
  },
}));

import {
  carregarComparacaoFiscal,
  buscarProdutosCadastrados,
  buscarReferenciasFiscais,
  buscarReferenciasFiscaisComRelatorio,
  ehQuantidadeInvalidaParaEstoque,
  gerarAssinaturaDescricao,
  normalizarDescricaoParaComparacao,
} from '../../services/sincronizacaoFiscalService';

const TABELA_REFERENCIA = 'produtos_fiscal_referencia';
const TABELA_PRODUTOS = 'produtos_cadastrado';

const REFERENCIA_VALIDA = {
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
  preco1: 12.90,
};

const PRODUTO_VALIDO = {
  id: 'prod-1',
  administrador_id: 'admin-1',
  produto_nome: 'Arroz Tio João 5kg',
  produto_cod: 'PROD-001',
  categoria: 'Alimentos',
  qtd_estoque: 5,
  preco_unt: 12.90,
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
  estoque_minimo: 1,
  estoque_maximo: 100,
  ativo: true,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

function configurarTabelas(
  referencias: unknown[] = [],
  produtos: unknown[] = [],
): void {
  dadosPorTabela.set(TABELA_REFERENCIA, referencias);
  dadosPorTabela.set(TABELA_PRODUTOS, produtos);
}

/** Gera referências determinísticas para exercitar a paginação. */
function gerarReferencias(quantidade: number): Record<string, unknown>[] {
  return Array.from({ length: quantidade }, (_, indice) => ({
    ...REFERENCIA_VALIDA,
    id: `ref-${indice + 1}`,
    linha_origem: indice + 1,
    codigo: `COD-${indice + 1}`,
    codigo_barras: `78${String(indice).padStart(11, '0')}`,
    descricao: `Produto da linha ${indice + 1}`,
  }));
}

const REFERENCIA_SAL = {
  ...REFERENCIA_VALIDA,
  id: 'ref-sal',
  codigo: null,
  codigo_barras: null,
  descricao: 'SAL REFINADO CISNE 1KG',
  estoque: 50,
};

const PRODUTO_SAL = {
  ...PRODUTO_VALIDO,
  id: 'prod-sal',
  produto_nome: 'SAL REFINADO CISNE1KG',
  produto_cod: 'SAL-001',
  codigo_barras: '7899999999999',
  qtd_estoque: 220,
};

describe('sincronizacaoFiscalService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dadosPorTabela.clear();
    erroPorTabela.clear();
    erroContagemPorTabela.clear();
    opcoesPaginacaoPorTabela.clear();
    mockRpc.mockResolvedValue({ data: [], error: null });
    configurarTabelas();
  });

  describe('consultas ao Supabase', () => {
    it('lê as duas tabelas da prévia usando apenas select/eq/order', async () => {
      await carregarComparacaoFiscal('admin-1');

      expect(mockFrom).toHaveBeenCalledWith(TABELA_REFERENCIA);
      expect(mockFrom).toHaveBeenCalledWith(TABELA_PRODUTOS);
      expect(mockSelect).toHaveBeenCalledWith(TABELA_REFERENCIA, '*');
      expect(mockSelect).toHaveBeenCalledWith(TABELA_PRODUTOS, '*');
    });

    it('pagina explicitamente as leituras com range para fugir do limite de 1.000 linhas', async () => {
      await carregarComparacaoFiscal('admin-1');

      expect(mockRange).toHaveBeenCalledWith(TABELA_REFERENCIA, 0, 999);
      expect(mockRange).toHaveBeenCalledWith(TABELA_PRODUTOS, 0, 999);
    });

    it('respeita o administrador_id nas duas consultas', async () => {
      await carregarComparacaoFiscal('admin-1');

      expect(mockEq).toHaveBeenCalledWith(TABELA_REFERENCIA, 'administrador_id', 'admin-1');
      expect(mockEq).toHaveBeenCalledWith(TABELA_PRODUTOS, 'administrador_id', 'admin-1');
    });

    it('mantém o filtro de ativo apenas no catálogo de produtos', async () => {
      await carregarComparacaoFiscal('admin-1');

      expect(mockEq).toHaveBeenCalledWith(TABELA_PRODUTOS, 'ativo', true);
      expect(mockEq).not.toHaveBeenCalledWith(TABELA_REFERENCIA, 'ativo', true);
      expect(mockEq).not.toHaveBeenCalledWith(TABELA_REFERENCIA, 'ativo', false);
    });

    it('ordena a referência por linha de origem e o catálogo por nome', async () => {
      await carregarComparacaoFiscal('admin-1');

      expect(mockOrder).toHaveBeenCalledWith(TABELA_REFERENCIA, 'linha_origem', {
        ascending: true,
      });
      expect(mockOrder).toHaveBeenCalledWith(TABELA_PRODUTOS, 'produto_nome');
    });

    it('devolve os dados da tabela correspondente para cada consulta', async () => {
      configurarTabelas([REFERENCIA_VALIDA], [PRODUTO_VALIDO]);

      const referencias = await buscarReferenciasFiscais('admin-1');
      const produtos = await buscarProdutosCadastrados('admin-1');

      expect(referencias).toHaveLength(1);
      expect(referencias[0]).toMatchObject({ id: 'ref-1', codigo_barras: '7891234567890' });
      expect(produtos).toHaveLength(1);
      expect(produtos[0]).toMatchObject({ id: 'prod-1', produto_nome: 'Arroz Tio João 5kg' });
    });

    it('propaga o erro devolvido pelo Supabase na base fiscal', async () => {
      erroPorTabela.set(TABELA_REFERENCIA, { message: 'Falha ao ler base fiscal' });

      await expect(buscarReferenciasFiscais('admin-1')).rejects.toThrow(
        'Falha ao ler base fiscal',
      );
    });

    it('propaga o erro devolvido pelo Supabase no catálogo de produtos', async () => {
      erroPorTabela.set(TABELA_PRODUTOS, { message: 'Falha ao ler produtos' });

      await expect(buscarProdutosCadastrados('admin-1')).rejects.toThrow(
        'Falha ao ler produtos',
      );
    });

    it('propaga o erro quando a prévia carrega as duas tabelas', async () => {
      erroPorTabela.set(TABELA_REFERENCIA, { message: 'Falha ao ler base fiscal' });

      await expect(carregarComparacaoFiscal('admin-1')).rejects.toThrow(
        'Falha ao ler base fiscal',
      );
    });
  });

  describe('paginação das referências fiscais', () => {
    it('busca todas as 1.277 referências mesmo com o limite de 1.000 linhas do PostgREST', async () => {
      const referencias = gerarReferencias(1277);
      configurarTabelas(referencias, []);

      const resultado = await buscarReferenciasFiscais('admin-1');

      expect(resultado).toHaveLength(1277);
      expect(mockRange).toHaveBeenCalledWith(TABELA_REFERENCIA, 0, 999);
      expect(mockRange).toHaveBeenCalledWith(TABELA_REFERENCIA, 1000, 1999);
    });

    it('não perde nenhuma referência entre as páginas', async () => {
      const referencias = gerarReferencias(1277);
      configurarTabelas(referencias, []);

      const resultado = await buscarReferenciasFiscais('admin-1');

      expect(resultado.map((r) => r.id)).toEqual(referencias.map((r) => r.id));
      // as linhas depois da 1.000 continuam presentes
      expect(resultado.map((r) => r.id)).toContain('ref-1001');
      expect(resultado.map((r) => r.id)).toContain('ref-1200');
      expect(resultado.map((r) => r.id)).toContain('ref-1277');
    });

    it('não duplica referências ao paginar', async () => {
      const referencias = gerarReferencias(1277);
      configurarTabelas(referencias, []);

      const resultado = await buscarReferenciasFiscais('admin-1');

      const ids = resultado.map((r) => r.id);
      expect(new Set(ids).size).toBe(1277);
      expect(resultado).toHaveLength(1277);
    });

    it('funciona quando existem exatamente 1.000 referências', async () => {
      const referencias = gerarReferencias(1000);
      configurarTabelas(referencias, []);

      const resultado = await buscarReferenciasFiscais('admin-1');

      expect(resultado).toHaveLength(1000);
      expect(new Set(resultado.map((r) => r.id)).size).toBe(1000);
    });

    it('funciona quando existem exatamente 2.000 referências', async () => {
      const referencias = gerarReferencias(2000);
      configurarTabelas(referencias, []);

      const resultado = await buscarReferenciasFiscais('admin-1');

      expect(resultado).toHaveLength(2000);
      expect(new Set(resultado.map((r) => r.id)).size).toBe(2000);
    });

    it('mantém administrador_id e a ordenação por linha_origem em todas as páginas', async () => {
      const referencias = gerarReferencias(1277);
      configurarTabelas(referencias, []);

      const resultado = await buscarReferenciasFiscais('admin-1');

      expect(resultado.every((r) => r.administrador_id === 'admin-1')).toBe(true);
      const linhas = resultado.map((r) => r.linha_origem);
      expect(linhas).toEqual([...linhas].sort((a, b) => a - b));
      expect(mockOrder).toHaveBeenCalledWith(TABELA_REFERENCIA, 'linha_origem', {
        ascending: true,
      });
    });

    it('compara todas as 1.277 referências na prévia', async () => {
      const referencias = gerarReferencias(1277);
      configurarTabelas(referencias, []);

      const resultado = await carregarComparacaoFiscal('admin-1');

      expect(resultado.referencia).toHaveLength(1277);
      expect(resultado.comparacao).toHaveLength(1277);
      expect(resultado.resumo.total_referencias).toBe(1277);
      expect(resultado.resumo.total_novos_produtos).toBe(1277);
    });

    it('não executa nenhuma escrita ao paginar as referências', async () => {
      configurarTabelas(gerarReferencias(1277), []);

      await carregarComparacaoFiscal('admin-1');

      expect(mockInsert).not.toHaveBeenCalled();
      expect(mockUpdate).not.toHaveBeenCalled();
      expect(mockUpsert).not.toHaveBeenCalled();
      expect(mockDelete).not.toHaveBeenCalled();
      expect(mockRpc).not.toHaveBeenCalled();
    });
  });

  describe('integridade da paginação', () => {
    it('aplica range, filtro e ordenação em todas as páginas', async () => {
      configurarTabelas(gerarReferencias(1277), []);

      await buscarReferenciasFiscais('admin-1');

      // a leitura termina na primeira página incompleta (277 linhas)
      const paginas = mockRange.mock.calls.filter(
        (call) => call[0] === TABELA_REFERENCIA,
      );
      expect(paginas).toEqual([
        [TABELA_REFERENCIA, 0, 999],
        [TABELA_REFERENCIA, 1000, 1999],
      ]);

      // o filtro de administrador vale para a contagem e para cada página
      const filtros = mockEq.mock.calls.filter(
        (call) => call[0] === TABELA_REFERENCIA,
      );
      expect(filtros.length).toBeGreaterThanOrEqual(paginas.length);
      filtros.forEach((chamada) => {
        expect(chamada[1]).toBe('administrador_id');
        expect(chamada[2]).toBe('admin-1');
      });

      // a ordenação é reaplicada em cada página
      const ordenacoes = mockOrder.mock.calls.filter(
        (call) => call[0] === TABELA_REFERENCIA,
      );
      expect(ordenacoes.length).toBe(paginas.length);
      ordenacoes.forEach((chamada) => {
        expect(chamada[1]).toBe('linha_origem');
        expect(chamada[2]).toEqual({ ascending: true });
      });
    });

    it('encerra a leitura na primeira página incompleta', async () => {
      configurarTabelas(gerarReferencias(37), []);

      await buscarReferenciasFiscais('admin-1');

      const paginas = mockRange.mock.calls.filter(
        (call) => call[0] === TABELA_REFERENCIA,
      );
      expect(paginas).toEqual([[TABELA_REFERENCIA, 0, 999]]);
    });

    it('confirma o total de linhas com uma consulta de contagem somente leitura', async () => {
      configurarTabelas(gerarReferencias(1277), []);

      const { relatorio } = await buscarReferenciasFiscaisComRelatorio('admin-1');

      expect(relatorio.total_esperado).toBe(1277);
      expect(relatorio.linhas_unicas).toBe(1277);
      expect(relatorio.paginas_lidas).toBe(2);
      expect(relatorio.avisos).toEqual([]);
    });

    it('detecta e reporta registros repetidos entre páginas em vez de descartá-los em silêncio', async () => {
      configurarTabelas(gerarReferencias(1277), []);
      opcoesPaginacaoPorTabela.set(TABELA_REFERENCIA, { sobrepor: true });

      const { linhas, relatorio } = await buscarReferenciasFiscaisComRelatorio(
        'admin-1',
      );

      // a linha repetida não duplica o resultado…
      expect(linhas).toHaveLength(1277);
      expect(new Set(linhas.map((r) => r.id)).size).toBe(1277);
      // …mas a repetição é reportada
      expect(relatorio.registros_repetidos_total).toBeGreaterThan(0);
      expect(relatorio.registros_repetidos.length).toBeGreaterThan(0);
      expect(relatorio.linhas_recebidas).toBeGreaterThan(1277);
      expect(relatorio.avisos.join(' ')).toMatch(/repetido/i);
    });

    it('detecta e reporta lacunas quando faltam linhas em relação ao total do servidor', async () => {
      configurarTabelas(gerarReferencias(1277), []);
      opcoesPaginacaoPorTabela.set(TABELA_REFERENCIA, { totalInformado: 1300 });

      const { relatorio } = await buscarReferenciasFiscaisComRelatorio('admin-1');

      expect(relatorio.total_esperado).toBe(1300);
      expect(relatorio.linhas_faltantes).toBe(23);
      expect(relatorio.avisos.join(' ')).toMatch(/faltaram 23 linha/i);
    });

    it('detecta lacuna quando uma página volta incompleta', async () => {
      configurarTabelas(gerarReferencias(2000), []);
      opcoesPaginacaoPorTabela.set(TABELA_REFERENCIA, {
        maximoLinhasPorPagina: 500,
      });

      const { linhas, relatorio } = await buscarReferenciasFiscaisComRelatorio(
        'admin-1',
      );

      expect(linhas).toHaveLength(1500);
      expect(relatorio.linhas_faltantes).toBe(500);
      expect(relatorio.avisos.join(' ')).toMatch(/faltaram 500 linha/i);
    });

    it('reporta quando o total não pode ser confirmado', async () => {
      configurarTabelas(gerarReferencias(10), []);
      erroContagemPorTabela.set(TABELA_REFERENCIA, {
        message: 'sem permissão de contagem',
      });

      const { relatorio } = await buscarReferenciasFiscaisComRelatorio('admin-1');

      expect(relatorio.total_esperado).toBeNull();
      expect(relatorio.avisos.join(' ')).toMatch(/não foi possível confirmar o total/i);
    });

    it('expõe o diagnóstico da paginação e os avisos na prévia', async () => {
      configurarTabelas(gerarReferencias(1277), []);
      opcoesPaginacaoPorTabela.set(TABELA_REFERENCIA, { totalInformado: 1300 });

      const resultado = await carregarComparacaoFiscal('admin-1');

      expect(resultado.paginacao?.referencias.linhas_faltantes).toBe(23);
      expect(resultado.paginacao?.produtos.total_esperado).toBe(0);
      expect(resultado.avisos?.join(' ')).toMatch(/faltaram 23 linha/i);
    });
  });

  describe('normalização da descrição', () => {
    it('mantém a mesma chave para a diferença de espaçamento conhecida (SAL REFINADO CISNE 1KG)', () => {
      expect(normalizarDescricaoParaComparacao('SAL REFINADO CISNE 1KG')).toBe(
        normalizarDescricaoParaComparacao('SAL REFINADO CISNE1KG'),
      );
      expect(normalizarDescricaoParaComparacao('SAL REFINADO CISNE 1KG')).toBe(
        'salrefinadocisne1kg',
      );
    });

    it('mantém a normalização de acentos, caixa e espaços na chave de comparação', () => {
      expect(normalizarDescricaoParaComparacao('Açúcar Cristal 1kg')).toBe(
        normalizarDescricaoParaComparacao('ACUCAR CRISTAL1KG'),
      );
      expect(normalizarDescricaoParaComparacao('  Pão   Francês ')).toBe(
        normalizarDescricaoParaComparacao('PAOFRANCES'),
      );
      expect(normalizarDescricaoParaComparacao(null)).toBe('');
      expect(normalizarDescricaoParaComparacao(undefined)).toBe('');
    });

    it('não remove dígitos, pontuação ou letras na normalização', () => {
      expect(normalizarDescricaoParaComparacao('ARROZ 5KG')).not.toBe(
        normalizarDescricaoParaComparacao('ARROZ 10KG'),
      );
      expect(normalizarDescricaoParaComparacao('VINHO 750ML')).not.toBe(
        normalizarDescricaoParaComparacao('VINHO 7500ML'),
      );
      expect(normalizarDescricaoParaComparacao('OLEO 1/2')).not.toBe(
        normalizarDescricaoParaComparacao('OLEO 12'),
      );
      expect(normalizarDescricaoParaComparacao('ARROZ-5KG')).not.toBe(
        normalizarDescricaoParaComparacao('ARROZ 5KG'),
      );
    });

    it('gera assinaturas diferentes para descrições que colidem na chave', () => {
      expect(gerarAssinaturaDescricao('SAL REFINADO CISNE 1KG')).not.toBe(
        gerarAssinaturaDescricao('SAL REFINADO CISNE1KG'),
      );
      expect(gerarAssinaturaDescricao('SAL REFINADO CISNE 1KG')).toBe(
        gerarAssinaturaDescricao('SAL  REFINADO CISNE 1KG'),
      );
    });
  });

  describe('correspondência de produtos', () => {
    it('encontra o produto pelo código de barras', async () => {
      configurarTabelas([REFERENCIA_VALIDA], [PRODUTO_VALIDO]);

      const resultado = await carregarComparacaoFiscal('admin-1');

      expect(resultado.comparacao).toHaveLength(1);
      expect(resultado.comparacao[0].tipo).toBe('encontrada');
      expect(resultado.comparacao[0].produto).toMatchObject({ id: 'prod-1' });
      expect(resultado.comparacao[0].motivo).toBeUndefined();
      expect(resultado.comparacao[0].criterio_correspondencia).toBe('codigo_barras');
    });

    it('prioriza o código de barras sobre o código do produto', async () => {
      const referencia = { ...REFERENCIA_VALIDA, codigo: 'PROD-002' };
      const produtoPorCodigo = {
        ...PRODUTO_VALIDO,
        id: 'prod-2',
        produto_cod: 'PROD-002',
        codigo_barras: '1111111111111',
      };
      configurarTabelas([referencia], [PRODUTO_VALIDO, produtoPorCodigo]);

      const resultado = await carregarComparacaoFiscal('admin-1');

      expect(resultado.comparacao[0].tipo).toBe('encontrada');
      expect(resultado.comparacao[0].produto).toMatchObject({ id: 'prod-1' });
    });

    it('usa o código do produto quando a referência não tem código de barras', async () => {
      const referencia = { ...REFERENCIA_VALIDA, codigo_barras: null };
      const produtoPorCodigo = {
        ...PRODUTO_VALIDO,
        id: 'prod-2',
        produto_cod: 'PROD-002',
        codigo_barras: '1111111111111',
      };
      configurarTabelas([referencia], [produtoPorCodigo]);

      const resultado = await carregarComparacaoFiscal('admin-1');

      expect(resultado.comparacao[0].tipo).toBe('encontrada');
      expect(resultado.comparacao[0].produto).toMatchObject({ id: 'prod-2' });
    });

    it('usa o código do produto como critério quando a descrição não bate', async () => {
      const referencia = {
        ...REFERENCIA_VALIDA,
        codigo: 'PROD-002',
        codigo_barras: null,
        descricao: 'Outro produto qualquer',
      };
      const produtoPorCodigo = {
        ...PRODUTO_VALIDO,
        id: 'prod-2',
        produto_cod: 'PROD-002',
        codigo_barras: '1111111111111',
      };
      configurarTabelas([referencia], [produtoPorCodigo]);

      const resultado = await carregarComparacaoFiscal('admin-1');

      expect(resultado.comparacao[0].tipo).toBe('encontrada');
      expect(resultado.comparacao[0].produto).toMatchObject({ id: 'prod-2' });
      expect(resultado.comparacao[0].criterio_correspondencia).toBe('codigo');
    });

    it('usa a descrição normalizada quando não há código', async () => {
      const referencia = { ...REFERENCIA_VALIDA, codigo: null, codigo_barras: null };
      const produto = {
        ...PRODUTO_VALIDO,
        produto_nome: 'ARROZ TIO JOAO 5KG',
        codigo_barras: '1111111111111',
        produto_cod: 'OUTRO',
      };
      configurarTabelas([referencia], [produto]);

      const resultado = await carregarComparacaoFiscal('admin-1');

      expect(resultado.comparacao[0].tipo).toBe('encontrada');
      expect(resultado.comparacao[0].produto).toMatchObject({ id: 'prod-1' });
      expect(resultado.comparacao[0].criterio_correspondencia).toBe('descricao');
    });

    it('marca como ambígua quando vários produtos correspondem', async () => {
      const segundo = {
        ...PRODUTO_VALIDO,
        id: 'prod-2',
        produto_nome: 'Arroz Tio João 5kg (2)',
      };
      configurarTabelas([REFERENCIA_VALIDA], [PRODUTO_VALIDO, segundo]);

      const resultado = await carregarComparacaoFiscal('admin-1');

      expect(resultado.comparacao[0].tipo).toBe('ambigua');
      expect(resultado.comparacao[0].motivo).toBe(
        'Vários produtos correspondem a esta referência.',
      );
    });

    it('não propõe estoque quando a correspondência é ambígua', async () => {
      const segundo = {
        ...PRODUTO_VALIDO,
        id: 'prod-2',
        produto_nome: 'Arroz Tio João 5kg (2)',
      };
      configurarTabelas([REFERENCIA_VALIDA], [PRODUTO_VALIDO, segundo]);

      const resultado = await carregarComparacaoFiscal('admin-1');

      expect(resultado.comparacao[0].tipo).toBe('ambigua');
      expect(resultado.comparacao[0].estoque_atual).toBeNull();
      expect(resultado.comparacao[0].estoque_proposto).toBeNull();
      expect(resultado.comparacao[0].estoque_invalido).toBe(false);
    });

    it('não encontra quando nenhum critério coincide', async () => {
      const referencia = { ...REFERENCIA_VALIDA, codigo: 'PROD-002' };
      configurarTabelas([referencia], []);

      const resultado = await carregarComparacaoFiscal('admin-1');

      expect(resultado.comparacao[0].tipo).toBe('nao_encontrada');
      expect(resultado.comparacao[0].produto).toBeNull();
      expect(resultado.comparacao[0].motivo).toBe('Produto não encontrado no catálogo.');
    });

    it('identifica divergência de descrição quando a correspondência é por código', async () => {
      const produto = { ...PRODUTO_VALIDO, produto_nome: 'Arroz Tio João 5kg Pack' };
      configurarTabelas([REFERENCIA_VALIDA], [produto]);

      const resultado = await carregarComparacaoFiscal('admin-1');

      expect(resultado.comparacao[0].tipo).toBe('encontrada');
      expect(resultado.comparacao[0].divergencia_descricao).toBe(true);
    });

    it('não aponta divergência de descrição quando as descrições só diferem em acento/caixa', async () => {
      const produto = { ...PRODUTO_VALIDO, produto_nome: 'ARROZ TIO JOAO 5KG' };
      configurarTabelas([REFERENCIA_VALIDA], [produto]);

      const resultado = await carregarComparacaoFiscal('admin-1');

      expect(resultado.comparacao[0].divergencia_descricao).toBe(false);
    });

    it('encontra o produto quando a descrição só difere no espaçamento (SAL REFINADO CISNE 1KG)', async () => {
      configurarTabelas([REFERENCIA_SAL], [PRODUTO_SAL]);

      const resultado = await carregarComparacaoFiscal('admin-1');

      expect(resultado.comparacao[0].tipo).toBe('encontrada');
      expect(resultado.comparacao[0].produto).toMatchObject({ id: 'prod-sal' });
      expect(resultado.comparacao[0].divergencia_descricao).toBe(false);
      expect(resultado.resumo.total_correspondencias).toBe(1);
    });
  });

  describe('descrições distintas não podem se confundir após a normalização', () => {
    it('não corresponde descrições que diferem na medida', async () => {
      const referencia = {
        ...REFERENCIA_VALIDA,
        codigo: null,
        codigo_barras: null,
        descricao: 'SAL REFINADO CISNE 2KG',
      };
      const produto = { ...PRODUTO_SAL, id: 'prod-1kg' };
      configurarTabelas([referencia], [produto]);

      const resultado = await carregarComparacaoFiscal('admin-1');

      expect(resultado.comparacao[0].tipo).toBe('nao_encontrada');
      expect(resultado.comparacao[0].produto).toBeNull();
      expect(resultado.comparacao[0].estoque_proposto).toBeNull();
    });

    it('não corresponde descrições que diferem no teor do produto', async () => {
      const referencia = {
        ...REFERENCIA_VALIDA,
        codigo: null,
        codigo_barras: null,
        descricao: 'VINHO TINTO DOCE 750ML',
      };
      const produto = {
        ...PRODUTO_VALIDO,
        produto_nome: 'VINHO TINTO SECO 750ML',
        codigo_barras: '111',
        produto_cod: 'VIN-001',
      };
      configurarTabelas([referencia], [produto]);

      const resultado = await carregarComparacaoFiscal('admin-1');

      expect(resultado.comparacao[0].tipo).toBe('nao_encontrada');
    });

    it('não corresponde descrições que só diferem em dígitos', async () => {
      const referencia = {
        ...REFERENCIA_VALIDA,
        codigo: null,
        codigo_barras: null,
        descricao: 'ARROZ TIO JOAO 10KG',
      };
      const produto = {
        ...PRODUTO_VALIDO,
        produto_nome: 'ARROZ TIO JOAO 5KG',
        codigo_barras: '111',
        produto_cod: 'ARR-001',
      };
      configurarTabelas([referencia], [produto]);

      const resultado = await carregarComparacaoFiscal('admin-1');

      expect(resultado.comparacao[0].tipo).toBe('nao_encontrada');
    });

    it('não funde dois produtos distintos que não têm identificador', async () => {
      const referencia = {
        ...REFERENCIA_VALIDA,
        codigo: null,
        codigo_barras: null,
        descricao: 'ARROZ TIO JOAO 5KG',
      };
      const primeiro = {
        ...PRODUTO_VALIDO,
        id: undefined as unknown as string,
        produto_nome: 'ARROZ TIO JOAO 5KG',
        codigo_barras: '111',
        produto_cod: 'ARR-001',
      };
      const segundo = {
        ...PRODUTO_VALIDO,
        id: undefined as unknown as string,
        produto_nome: 'ARROZ TIO JOAO 5KG',
        codigo_barras: '222',
        produto_cod: 'ARR-002',
      };
      configurarTabelas([referencia], [primeiro, segundo]);

      const resultado = await carregarComparacaoFiscal('admin-1');

      // dois produtos distintos com a mesma descrição: a correspondência é
      // ambígua e NENHUM é escolhido automaticamente.
      expect(resultado.comparacao[0].tipo).toBe('ambigua');
      expect(resultado.comparacao[0].estoque_proposto).toBeNull();
    });
  });

  describe('colisão de descrições na normalização', () => {
    it('não faz correspondência automática quando descrições distintas colidem na chave', async () => {
      const referencia = {
        ...REFERENCIA_VALIDA,
        codigo: null,
        codigo_barras: null,
        descricao: 'SAL REFINADO CISNE 1KG',
      };
      const primeiro = {
        ...PRODUTO_VALIDO,
        id: 'prod-1',
        produto_nome: 'SAL REFINADO CISNE 1KG',
        codigo_barras: '111',
        produto_cod: 'SAL-001',
      };
      const segundo = {
        ...PRODUTO_VALIDO,
        id: 'prod-2',
        produto_nome: 'SAL REFINADO CISNE1 KG',
        codigo_barras: '222',
        produto_cod: 'SAL-002',
      };
      configurarTabelas([referencia], [primeiro, segundo]);

      const resultado = await carregarComparacaoFiscal('admin-1');

      expect(resultado.comparacao[0].tipo).toBe('ambigua');
      expect(resultado.comparacao[0].colisao_descricao).toBe(true);
      expect(resultado.comparacao[0].motivo).toMatch(/colidem na normalização/i);
      expect(resultado.comparacao[0].estoque_proposto).toBeNull();
      expect(resultado.comparacao[0].estoque_atual).toBeNull();
      expect(resultado.resumo.total_colisoes_descricao).toBe(1);
      expect(resultado.avisos?.join(' ')).toMatch(/colisão/i);
    });

    it('não faz correspondência automática quando duas linhas da base colidem no mesmo produto', async () => {
      const primeira = {
        ...REFERENCIA_SAL,
        id: 'ref-1',
        linha_origem: 1,
        descricao: 'SAL REFINADO CISNE 1KG',
      };
      const segunda = {
        ...REFERENCIA_SAL,
        id: 'ref-2',
        linha_origem: 2,
        descricao: 'SAL REFINADO CISNE1KG',
      };
      const produto = {
        ...PRODUTO_VALIDO,
        id: 'prod-sal',
        produto_nome: 'SAL REFINADO CISNE 1KG',
        codigo_barras: '7899999999999',
        produto_cod: 'SAL-001',
      };
      configurarTabelas([primeira, segunda], [produto]);

      const resultado = await carregarComparacaoFiscal('admin-1');

      expect(resultado.comparacao[0].tipo).toBe('ambigua');
      expect(resultado.comparacao[1].tipo).toBe('ambigua');
      expect(resultado.comparacao[0].colisao_descricao).toBe(true);
      expect(resultado.comparacao[0].motivo).toMatch(/descrição distinta/i);
      expect(resultado.comparacao[0].estoque_proposto).toBeNull();
      expect(resultado.comparacao[1].estoque_proposto).toBeNull();
      expect(resultado.resumo.total_colisoes_descricao).toBe(2);
      expect(resultado.avisos?.join(' ')).toMatch(/descrições diferentes/i);
    });

    it('reporta linhas duplicadas da base que repetem a mesma descrição e o mesmo produto', async () => {
      const primeira = { ...REFERENCIA_SAL, id: 'ref-1', linha_origem: 1 };
      const segunda = { ...REFERENCIA_SAL, id: 'ref-2', linha_origem: 2 };
      const produto = {
        ...PRODUTO_VALIDO,
        id: 'prod-sal',
        produto_nome: 'SAL REFINADO CISNE 1KG',
        codigo_barras: '7899999999999',
        produto_cod: 'SAL-001',
      };
      configurarTabelas([primeira, segunda], [produto]);

      const resultado = await carregarComparacaoFiscal('admin-1');

      expect(resultado.comparacao[0].tipo).toBe('encontrada');
      expect(resultado.comparacao[1].tipo).toBe('encontrada');
      expect(resultado.avisos?.join(' ')).toMatch(/repetem a mesma descrição/i);
    });

    it('mantém a correspondência exata quando não há colisão', async () => {
      const referencia = {
        ...REFERENCIA_VALIDA,
        codigo: null,
        codigo_barras: null,
        descricao: 'SAL REFINADO CISNE 1KG',
      };
      const produto = {
        ...PRODUTO_VALIDO,
        id: 'prod-sal',
        produto_nome: 'SAL REFINADO CISNE1KG',
        codigo_barras: '111',
        produto_cod: 'SAL-001',
      };
      configurarTabelas([referencia], [produto]);

      const resultado = await carregarComparacaoFiscal('admin-1');

      expect(resultado.comparacao[0].tipo).toBe('encontrada');
      expect(resultado.comparacao[0].colisao_descricao).toBeUndefined();
      expect(resultado.comparacao[0].estoque_proposto).toBe(15);
    });
  });

  describe('estoque', () => {
    it('soma o estoque da planilha ao estoque atual', async () => {
      const referencia = { ...REFERENCIA_VALIDA, estoque: 50 };
      configurarTabelas([referencia], [PRODUTO_VALIDO]);

      const resultado = await carregarComparacaoFiscal('admin-1');

      expect(resultado.comparacao[0]).toMatchObject({
        produto: expect.objectContaining({ id: 'prod-1' }),
        estoque_atual: 5,
        quantidade_planilha: 50,
        estoque_proposto: 55,
        estoque_invalido: false,
      });
      expect(resultado.comparacao[0].estoque_motivo).toBeUndefined();
    });

    it('aceita quantidade zero como válida (não confunde com ausência)', async () => {
      const referencia = { ...REFERENCIA_VALIDA, estoque: 0 };
      configurarTabelas([referencia], [PRODUTO_VALIDO]);

      const resultado = await carregarComparacaoFiscal('admin-1');

      expect(resultado.comparacao[0].estoque_invalido).toBe(false);
      expect(resultado.comparacao[0].quantidade_planilha).toBe(0);
      expect(resultado.comparacao[0].estoque_proposto).toBe(5);
    });

    it('sinaliza estoque nulo na planilha e não propõe soma', async () => {
      const referencia = { ...REFERENCIA_VALIDA, estoque: null };
      configurarTabelas([referencia], [PRODUTO_VALIDO]);

      const resultado = await carregarComparacaoFiscal('admin-1');

      expect(resultado.comparacao[0].estoque_invalido).toBe(true);
      expect(resultado.comparacao[0].quantidade_planilha).toBeNull();
      expect(resultado.comparacao[0].estoque_proposto).toBeNull();
      expect(resultado.comparacao[0].estoque_motivo).toMatch(/ausente/i);
      expect(resultado.resumo.total_bloqueados).toBe(1);
    });

    it('sinaliza estoque negativo na planilha e não propõe soma', async () => {
      const referencia = { ...REFERENCIA_VALIDA, estoque: -5 };
      configurarTabelas([referencia], [PRODUTO_VALIDO]);

      const resultado = await carregarComparacaoFiscal('admin-1');

      expect(resultado.comparacao[0].estoque_invalido).toBe(true);
      expect(resultado.comparacao[0].quantidade_planilha).toBe(-5);
      expect(resultado.comparacao[0].estoque_proposto).toBeNull();
      expect(resultado.comparacao[0].estoque_motivo).toMatch(/negativa/i);
    });

    it('sinaliza estoque fracionário na planilha e não propõe soma', async () => {
      const referencia = { ...REFERENCIA_VALIDA, estoque: 5.5 };
      configurarTabelas([referencia], [PRODUTO_VALIDO]);

      const resultado = await carregarComparacaoFiscal('admin-1');

      expect(resultado.comparacao[0].estoque_invalido).toBe(true);
      expect(resultado.comparacao[0].estoque_proposto).toBeNull();
      expect(resultado.comparacao[0].estoque_motivo).toMatch(/fracionária/i);
    });

    it('sinaliza estoque inválido (não numérico) na planilha', async () => {
      const referencia = { ...REFERENCIA_VALIDA, estoque: Number.NaN };
      configurarTabelas([referencia], [PRODUTO_VALIDO]);

      const resultado = await carregarComparacaoFiscal('admin-1');

      expect(resultado.comparacao[0].estoque_invalido).toBe(true);
      expect(resultado.comparacao[0].estoque_proposto).toBeNull();
      expect(resultado.comparacao[0].estoque_motivo).toMatch(/inválida/i);
    });

    it('bloqueia a proposta quando o estoque atual do cadastro é inválido', async () => {
      const produto = { ...PRODUTO_VALIDO, qtd_estoque: null as unknown as number };
      configurarTabelas([REFERENCIA_VALIDA], [produto]);

      const resultado = await carregarComparacaoFiscal('admin-1');

      expect(resultado.comparacao[0].estoque_invalido).toBe(true);
      expect(resultado.comparacao[0].estoque_atual).toBeNull();
      expect(resultado.comparacao[0].estoque_proposto).toBeNull();
      expect(resultado.comparacao[0].estoque_motivo).toMatch(/estoque atual/i);
    });

    it('classifica as quantidades inválidas pela regra de estoque', () => {
      expect(ehQuantidadeInvalidaParaEstoque(null)).toBe(true);
      expect(ehQuantidadeInvalidaParaEstoque(undefined)).toBe(true);
      expect(ehQuantidadeInvalidaParaEstoque(-1)).toBe(true);
      expect(ehQuantidadeInvalidaParaEstoque(1.5)).toBe(true);
      expect(ehQuantidadeInvalidaParaEstoque(Number.NaN)).toBe(true);
      expect(ehQuantidadeInvalidaParaEstoque(Number.POSITIVE_INFINITY)).toBe(true);
      expect(ehQuantidadeInvalidaParaEstoque(0)).toBe(false);
      expect(ehQuantidadeInvalidaParaEstoque(10)).toBe(false);
    });

    it('calcula o estoque do SAL como 220 + 50 = 270', async () => {
      configurarTabelas([REFERENCIA_SAL], [PRODUTO_SAL]);

      const resultado = await carregarComparacaoFiscal('admin-1');

      expect(resultado.comparacao[0]).toMatchObject({
        produto: expect.objectContaining({ id: 'prod-sal' }),
        estoque_atual: 220,
        quantidade_planilha: 50,
        estoque_proposto: 270,
        estoque_invalido: false,
      });
      expect(resultado.comparacao[0].estoque_motivo).toBeUndefined();
    });

    it('não encontra produto: estoque atual e estoque proposto ficam inexistentes', async () => {
      const referencia = {
        ...REFERENCIA_VALIDA,
        id: 'ref-inexistente',
        codigo: 'PROD-999',
        codigo_barras: '0000000000000',
        descricao: 'Produto Inexistente',
        estoque: 885,
      };
      configurarTabelas([referencia], []);

      const resultado = await carregarComparacaoFiscal('admin-1');

      expect(resultado.comparacao[0].tipo).toBe('nao_encontrada');
      expect(resultado.comparacao[0].produto).toBeNull();
      expect(resultado.comparacao[0].estoque_atual).toBeNull();
      expect(resultado.comparacao[0].estoque_proposto).toBeNull();
    });

    it('mantém a quantidade da referência disponível separadamente quando o produto não é encontrado', async () => {
      const referencia = {
        ...REFERENCIA_VALIDA,
        id: 'ref-inexistente',
        codigo: 'PROD-999',
        codigo_barras: '0000000000000',
        descricao: 'Produto Inexistente',
        estoque: 885,
      };
      configurarTabelas([referencia], []);

      const resultado = await carregarComparacaoFiscal('admin-1');

      expect(resultado.comparacao[0].quantidade_planilha).toBe(885);
      expect(resultado.comparacao[0].estoque_proposto).not.toBe(885);
    });

    it('não conta referência não encontrada como bloqueada por estoque', async () => {
      const naoEncontrada = {
        ...REFERENCIA_VALIDA,
        id: 'ref-2',
        codigo: 'PROD-999',
        codigo_barras: '0000000000000',
        descricao: 'Produto Inexistente',
        estoque: null,
      };
      const encontrada = {
        ...REFERENCIA_VALIDA,
        id: 'ref-3',
        codigo_barras: '7891234567890',
        descricao: 'Arroz Tio João 5kg',
        estoque: 10,
      };
      configurarTabelas([naoEncontrada, encontrada], [PRODUTO_VALIDO]);

      const resultado = await carregarComparacaoFiscal('admin-1');

      expect(resultado.comparacao[0].tipo).toBe('nao_encontrada');
      expect(resultado.comparacao[0].estoque_invalido).toBe(false);
      expect(resultado.comparacao[1].tipo).toBe('encontrada');
      expect(resultado.comparacao[1].estoque_invalido).toBe(false);
      expect(resultado.resumo.total_bloqueados).toBe(0);
      expect(resultado.resumo.total_novos_produtos).toBe(1);
    });

    it('mantém produto encontrado com estoque inválido como bloqueado por estoque', async () => {
      const encontradaComEstoqueInvalido = {
        ...REFERENCIA_VALIDA,
        id: 'ref-3',
        codigo_barras: '7891234567890',
        descricao: 'Arroz Tio João 5kg',
        estoque: null,
      };
      const naoEncontrada = {
        ...REFERENCIA_VALIDA,
        id: 'ref-2',
        codigo: 'PROD-999',
        codigo_barras: '0000000000000',
        descricao: 'Produto Inexistente',
        estoque: 885,
      };
      configurarTabelas([naoEncontrada, encontradaComEstoqueInvalido], [PRODUTO_VALIDO]);

      const resultado = await carregarComparacaoFiscal('admin-1');

      expect(resultado.comparacao[0].tipo).toBe('nao_encontrada');
      expect(resultado.comparacao[1].tipo).toBe('encontrada');
      expect(resultado.comparacao[1].estoque_invalido).toBe(true);
      expect(resultado.comparacao[1].estoque_proposto).toBeNull();
      expect(resultado.resumo.total_bloqueados).toBe(1);
    });
  });

  describe('diferenças fiscais', () => {
    it('detecta diferença de NCM entre a base e o cadastro', async () => {
      const referencia = { ...REFERENCIA_VALIDA, ncm: '10063099' };
      configurarTabelas([referencia], [PRODUTO_VALIDO]);

      const resultado = await carregarComparacaoFiscal('admin-1');

      const diferenca = resultado.comparacao[0].diferencas_fiscais.find(
        (d) => d.campo === 'NCM',
      );
      expect(diferenca).toBeDefined();
      expect(diferenca?.valor_atual).toBe('10063021');
      expect(diferenca?.valor_referencia).toBe('10063099');
    });

    it('detecta diferenças de CST e alíquotas', async () => {
      const referencia = {
        ...REFERENCIA_VALIDA,
        cst_icms: '103',
        aliquota_icms: 12,
        cst_pis: '02',
        aliquota_pis: 1.5,
        cst_cofins: '02',
        aliquota_cofins: 2.5,
      };
      configurarTabelas([referencia], [PRODUTO_VALIDO]);

      const resultado = await carregarComparacaoFiscal('admin-1');
      const campos = resultado.comparacao[0].diferencas_fiscais.map((d) => d.campo);

      expect(campos).toContain('CST ICMS');
      expect(campos).toContain('Alíquota ICMS');
      expect(campos).toContain('CST PIS');
      expect(campos).toContain('Alíquota PIS');
      expect(campos).toContain('CST COFINS');
      expect(campos).toContain('Alíquota COFINS');
      expect(resultado.resumo.total_divergencias_fiscais).toBe(1);
    });

    it('detecta diferença de CEST', async () => {
      const referencia = { ...REFERENCIA_VALIDA, cest: '9999999' };
      configurarTabelas([referencia], [PRODUTO_VALIDO]);

      const resultado = await carregarComparacaoFiscal('admin-1');
      const diferenca = resultado.comparacao[0].diferencas_fiscais.find(
        (d) => d.campo === 'CEST',
      );

      expect(diferenca).toBeDefined();
      expect(diferenca?.valor_atual).toBe('1704400');
      expect(diferenca?.valor_referencia).toBe('9999999');
    });

    it('não reporta diferença quando os campos fiscais são iguais', async () => {
      configurarTabelas([REFERENCIA_VALIDA], [PRODUTO_VALIDO]);

      const resultado = await carregarComparacaoFiscal('admin-1');

      expect(resultado.comparacao[0].diferencas_fiscais).toEqual([]);
      expect(resultado.resumo.total_divergencias_fiscais).toBe(0);
    });

    it('não inventa divergência quando a base de referência não traz o campo', async () => {
      const referencia = { ...REFERENCIA_VALIDA, ncm: null, cfop_padrao: null };
      configurarTabelas([referencia], [PRODUTO_VALIDO]);

      const resultado = await carregarComparacaoFiscal('admin-1');

      expect(resultado.comparacao[0].diferencas_fiscais).toEqual([]);
    });

    it('reporta campo ausente no cadastro quando a base traz o valor', async () => {
      const produto = { ...PRODUTO_VALIDO, ncm: null };
      configurarTabelas([REFERENCIA_VALIDA], [produto]);

      const resultado = await carregarComparacaoFiscal('admin-1');
      const diferenca = resultado.comparacao[0].diferencas_fiscais.find(
        (d) => d.campo === 'NCM',
      );

      expect(diferenca).toBeDefined();
      expect(diferenca?.valor_atual).toBeNull();
      expect(diferenca?.valor_referencia).toBe('10063021');
    });
  });

  describe('resumo', () => {
    it('devolve o resumo com os totais corretos', async () => {
      configurarTabelas([REFERENCIA_VALIDA], [PRODUTO_VALIDO]);

      const resultado = await carregarComparacaoFiscal('admin-1');

      expect(resultado.resumo).toEqual({
        total_referencias: 1,
        total_produtos_cadastrados: 1,
        total_correspondencias: 1,
        total_novos_produtos: 0,
        total_divergencias_fiscais: 0,
        total_bloqueados: 0,
        total_duplicados: 0,
        total_colisoes_descricao: 0,
      });
    });

    it('conta novos produtos, duplicados e bloqueados', async () => {
      const novo = {
        ...REFERENCIA_VALIDA,
        id: 'ref-2',
        codigo: 'PROD-999',
        codigo_barras: '000',
        descricao: 'Produto Inexistente',
      };
      const invalido = {
        ...REFERENCIA_VALIDA,
        id: 'ref-3',
        codigo_barras: '555',
        descricao: 'Outro Arroz',
        estoque: null,
      };
      const segundo = {
        ...PRODUTO_VALIDO,
        id: 'prod-2',
        produto_cod: 'PROD-002',
        produto_nome: 'Arroz Tio João 5kg (2)',
      };
      configurarTabelas([REFERENCIA_VALIDA, novo, invalido], [PRODUTO_VALIDO, segundo]);

      const resultado = await carregarComparacaoFiscal('admin-1');

      expect(resultado.resumo.total_referencias).toBe(3);
      expect(resultado.resumo.total_produtos_cadastrados).toBe(2);
      // ref-1 é ambígua (dois produtos com o mesmo código de barras)
      expect(resultado.resumo.total_correspondencias).toBe(1);
      expect(resultado.resumo.total_duplicados).toBe(1);
      expect(resultado.resumo.total_novos_produtos).toBe(1);
      // ref-3 corresponde por código, mas com estoque inválido na base
      expect(resultado.resumo.total_bloqueados).toBe(1);
      expect(resultado.comparacao[2].tipo).toBe('encontrada');
      expect(resultado.comparacao[2].estoque_invalido).toBe(true);
    });
  });

  describe('segurança da prévia (somente leitura)', () => {
    it('não executa insert, update, upsert nem delete', async () => {
      configurarTabelas([REFERENCIA_VALIDA], [PRODUTO_VALIDO]);

      await carregarComparacaoFiscal('admin-1');

      expect(mockInsert).not.toHaveBeenCalled();
      expect(mockUpdate).not.toHaveBeenCalled();
      expect(mockUpsert).not.toHaveBeenCalled();
      expect(mockDelete).not.toHaveBeenCalled();
    });

    it('não chama RPC de importação nem de escrita', async () => {
      configurarTabelas([REFERENCIA_VALIDA], [PRODUTO_VALIDO]);

      await carregarComparacaoFiscal('admin-1');

      expect(mockRpc).not.toHaveBeenCalled();
    });

    it('consulta somente as tabelas de leitura da prévia', async () => {
      configurarTabelas([REFERENCIA_VALIDA], [PRODUTO_VALIDO]);

      await carregarComparacaoFiscal('admin-1');

      const tabelasConsultadas = mockFrom.mock.calls.map((call) => call[0]);
      expect(new Set(tabelasConsultadas)).toEqual(
        new Set([TABELA_REFERENCIA, TABELA_PRODUTOS]),
      );
    });

    it('não altera os produtos cadastrados lidos', async () => {
      const produtos = [{ ...PRODUTO_VALIDO }];
      const copia = JSON.parse(JSON.stringify(produtos));
      configurarTabelas([REFERENCIA_VALIDA], produtos);

      const resultado = await carregarComparacaoFiscal('admin-1');

      expect(produtos).toEqual(copia);
      expect(resultado.produtos).toEqual(copia);
    });
  });
});
