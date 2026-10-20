import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockRpc = vi.fn();
const mockFrom = vi.fn();
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockOrder = vi.fn();

vi.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: (...args: unknown[]) => mockRpc(...args),
    from: (tableName: string) => {
      mockFrom(tableName);
      return {
        select: (...args: unknown[]) => {
          mockSelect(...args);
          return {
            eq: (...args: unknown[]) => {
              mockEq(...args);
              return {
                order: (...args: unknown[]) => {
                  mockOrder(...args);
                  return { data: [], error: null };
                },
              };
            },
          };
        },
      };
    },
  },
}));

import { carregarComparacaoFiscal } from '../../services/sincronizacaoFiscalService';

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

function montarLinhas(quantidade: number, linhaBase: unknown[] = REFERENCIA_VALIDA) {
  const linhas = [['codigo', 'codbar', 'descpro', 'ncm', 'cstpise', 'alipise', 'cstpis', 'alipis', 'cstcofinse', 'alicofinse', 'cstcofins', 'alicofinse', 'cst', 'aliicms', 'desccfop', 'kit', 'custocom', 'estoque', 'valor_estoque', 'custo', 'preco1', 'cest']];
  for (let i = 0; i < quantidade; i++) {
    linhas.push([...linhaBase]);
  }
  return linhas;
}

describe('sincronizacaoFiscalService', () => {
  beforeEach(() => {
    mockRpc.mockResolvedValue({ data: [], error: null });
    mockFrom.mockReturnValue({
      select: (...args: unknown[]) => {
        mockSelect(...args);
        return {
          eq: (...args: unknown[]) => {
            mockEq(...args);
            return {
              order: (...args: unknown[]) => {
                mockOrder(...args);
                return { data: [], error: null };
              },
            };
          },
        };
      },
    });
  });

  it('carregarComparacaoFiscal chama RPC com parâmetros corretos', async () => {
    const { carregarComparacaoFiscal } = await import('../../services/sincronizacaoFiscalService');
    await carregarComparacaoFiscal('admin-1');

    expect(mockRpc).toHaveBeenCalledTimes(1);
    expect(mockRpc.mock.calls[0][0]).toBe('importar_produtos_fiscal_referencia');
  });

  it('busca produtos cadastrados filtrando por administrador_id e ativo', async () => {
    const { carregarComparacaoFiscal } = await import('../../services/sincronizacaoFiscalService');

    mockRpc.mockResolvedValue({ data: [], error: null });
    mockSelect.mockReturnValue({
      eq: () => ({
        order: () => ({ data: [], error: null }),
      }),
    });

    await carregarComparacaoFiscal('admin-1');

    expect(mockSelect).toHaveBeenCalledWith('*');
    expect(mockEq).toHaveBeenCalledWith('administrador_id', 'admin-1');
    expect(mockEq).toHaveBeenCalledWith('ativo', true);
  });

  it('retorna correspondência exata por código de barras', async () => {
    mockRpc.mockResolvedValue({
      data: [{ ...REFERENCIA_VALIDA, linha_origem: 1 }],
      error: null,
    });

    mockSelect.mockReturnValue({
      eq: () => ({
        order: () => ({
          data: [{ ...PRODUTO_VALIDO }],
          error: null,
        }),
      }),
    });

    const resultado = await carregarComparacaoFiscal('admin-1');

    expect(resultado.comparacao).toHaveLength(1);
    expect(resultado.comparacao[0].tipo).toBe('encontrada');
    expect(resultado.comparacao[0].produto).toMatchObject({ id: 'prod-1' });
    expect(resultado.comparacao[0].referencia.codigo_barras).toBe('7891234567890');
  });

  it('retorna não encontrado quando não há correspondência', async () => {
    mockRpc.mockResolvedValue({
      data: [{ ...REFERENCIA_VALIDA, codigo: 'PROD-002' }],
      error: null,
    });

    mockSelect.mockReturnValue({
      eq: () => ({
        order: () => ({ data: [], error: null }),
      }),
    });

    const resultado = await carregarComparacaoFiscal('admin-1');

    expect(resultado.comparacao).toHaveLength(1);
    expect(resultado.comparacao[0].tipo).toBe('nao_encontrada');
    expect(resultado.comparacao[0].produto).toBeNull();
    expect(resultado.comparacao[0].motivo).toBe('Produto não encontrado no catálogo.');
  });

  it('retorna ambiguidade quando há múltiplos produtos com mesmo código de barras', async () => {
    mockRpc.mockResolvedValue({
      data: [{ ...REFERENCIA_VALIDA, linha_origem: 1 }],
      error: null,
    });

    mockSelect.mockReturnValue({
      eq: () => ({
        order: () => ({
          data: [{ ...PRODUTO_VALIDO }, { ...PRODUTO_VALIDO, id: 'prod-2', produto_nome: 'Arroz Tio João 5kg (2)' }],
          error: null,
        }),
      }),
    });

    const resultado = await carregarComparacaoFiscal('admin-1');

    expect(resultado.comparacao).toHaveLength(1);
    expect(resultado.comparacao[0].tipo).toBe('ambigua');
    expect(resultado.comparacao[0].motivo).toBe('Vários produtos correspondem a esta referência.');
  });

  it('calcula estoque proposto corretamente', async () => {
    mockRpc.mockResolvedValue({
      data: [{ ...REFERENCIA_VALIDA, linha_origem: 1, estoque: 50 }],
      error: null,
    });

    mockSelect.mockReturnValue({
      eq: () => ({
        order: () => ({
          data: [{ ...PRODUTO_VALIDO }],
          error: null,
        }),
      }),
    });

    const resultado = await carregarComparacaoFiscal('admin-1');

    expect(resultado.comparacao[0]).toMatchObject({
      produto: expect.objectContaining({ id: 'prod-1' }),
      estoque_atual: 5,
      quantidade_planilha: 50,
      estoque_proposto: 55,
    });
  });

  it('identifica estoque inválido quando é nulo', async () => {
    mockRpc.mockResolvedValue({
      data: [{ ...REFERENCIA_VALIDA, linha_origem: 1, estoque: null }],
      error: null,
    });

    mockSelect.mockReturnValue({
      eq: () => ({
        order: () => ({
          data: [{ ...PRODUTO_VALIDO }],
          error: null,
        }),
      }),
    });

    const resultado = await carregarComparacaoFiscal('admin-1');

    expect(resultado.comparacao[0].estoque_invalido).toBe(true);
  });

  it('identifica estoque inválido quando é negativo', async () => {
    mockRpc.mockResolvedValue({
      data: [{ ...REFERENCIA_VALIDA, linha_origem: 1, estoque: -5 }],
      error: null,
    });

    mockSelect.mockReturnValue({
      eq: () => ({
        order: () => ({
          data: [{ ...PRODUTO_VALIDO }],
          error: null,
        }),
      }),
    });

    const resultado = await carregarComparacaoFiscal('admin-1');

    expect(resultado.comparacao[0].estoque_invalido).toBe(true);
  });

  it('identifica estoque inválido quando é fracionário', async () => {
    mockRpc.mockResolvedValue({
      data: [{ ...REFERENCIA_VALIDA, linha_origem: 1, estoque: 5.5 }],
      error: null,
    });

    mockSelect.mockReturnValue({
      eq: () => ({
        order: () => ({
          data: [{ ...PRODUTO_VALIDO }],
          error: null,
        }),
      }),
    });

    const resultado = await carregarComparacaoFiscal('admin-1');

    expect(resultado.comparacao[0].estoque_invalido).toBe(true);
  });

  it('identifica divergências fiscais quando há diferença', async () => {
    mockRpc.mockResolvedValue({
      data: [{ ...REFERENCIA_VALIDA, linha_origem: 1, ncm: '10063099', cst_icms: '103', aliquota_icms: 12 }],
      error: null,
    });

    mockSelect.mockReturnValue({
      eq: () => ({
        order: () => ({
          data: [{ ...PRODUTO_VALIDO }],
          error: null,
        }),
      }),
    });

    const resultado = await carregarComparacaoFiscal('admin-1');

    expect(resultado.comparacao[0].diferencas_fiscais.length).toBeGreaterThan(0);
    const difNCM = resultado.comparacao[0].diferencas_fiscais.find((d) => d.campo === 'NCM');
    expect(difNCM).toBeDefined();
    expect(difNCM.valor_atual).toBe('10063021');
    expect(difNCM.valor_referencia).toBe('10063099');
  });

  it('retorna resumo com totais corretos', async () => {
    mockRpc.mockResolvedValue({
      data: [{ ...REFERENCIA_VALIDA, linha_origem: 1 }],
      error: null,
    });

    mockSelect.mockReturnValue({
      eq: () => ({
        order: () => ({
          data: [{ ...PRODUTO_VALIDO }],
          error: null,
        }),
      }),
    });

    const resultado = await carregarComparacaoFiscal('admin-1');

    expect(resultado.resumo.total_referencias).toBe(1);
    expect(resultado.resumo.total_produtos_cadastrados).toBe(1);
    expect(resultado.resumo.total_correspondencias).toBe(1);
    expect(resultado.resumo.total_novos_produtos).toBe(0);
    expect(resultado.resumo.total_divergencias_fiscais).toBe(0);
    expect(resultado.resumo.total_bloqueados).toBe(0);
    expect(resultado.resumo.total_duplicados).toBe(0);
  });
});
