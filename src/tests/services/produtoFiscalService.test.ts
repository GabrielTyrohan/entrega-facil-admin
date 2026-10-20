import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockRpc = vi.fn();
const mockFrom = vi.fn();

vi.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: (...args: unknown[]) => mockRpc(...args),
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

import {
  alterarStatusFiscalProduto,
  filtrarProdutosPorStatusFiscal,
  normalizarFiscalStatus,
  verificarRequisitosValidacao,
} from '../../services/produtoFiscalService';
import { montarPayloadCadastroProduto } from '../../services/produtoService';

const PRODUTO_BASE = {
  produto_nome: 'Arroz 5kg',
  categoria: 'Alimentos',
  unidade_medida: 'PCT',
  ncm: '10063021',
  cfop_padrao: '5102',
  origem_mercadoria: 0,
};

describe('produtoFiscalService — status', () => {
  it('normaliza os 4 estados e trata ausência como pendente', () => {
    expect(normalizarFiscalStatus('pendente_revisao')).toBe('pendente_revisao');
    expect(normalizarFiscalStatus('em_revisao')).toBe('em_revisao');
    expect(normalizarFiscalStatus('validado')).toBe('validado');
    expect(normalizarFiscalStatus('bloqueado')).toBe('bloqueado');
    expect(normalizarFiscalStatus(undefined)).toBe('pendente_revisao');
    expect(normalizarFiscalStatus(null as unknown as undefined)).toBe('pendente_revisao');
  });

  it('filtra por status sem presumir pelo preenchimento', () => {
    const produtos = [
      { id: '1', fiscal_status: 'validado' as const },
      { id: '2', fiscal_status: 'pendente_revisao' as const },
      { id: '3', fiscal_status: undefined },
      { id: '4', fiscal_status: 'bloqueado' as const },
    ];
    expect(filtrarProdutosPorStatusFiscal(produtos, 'todos')).toHaveLength(4);
    expect(filtrarProdutosPorStatusFiscal(produtos, 'validado').map((p) => p.id)).toEqual(['1']);
    expect(
      filtrarProdutosPorStatusFiscal(produtos, 'pendente_revisao').map((p) => p.id),
    ).toEqual(['2', '3']);
    expect(filtrarProdutosPorStatusFiscal(produtos, 'bloqueado').map((p) => p.id)).toEqual(['4']);
    expect(filtrarProdutosPorStatusFiscal(produtos, 'em_revisao')).toHaveLength(0);
  });
});

describe('produtoFiscalService — requisitos de validação', () => {
  it('aceita produto com básicos + NCM válido', () => {
    expect(verificarRequisitosValidacao(PRODUTO_BASE)).toEqual({ ok: true, pendencias: [] });
  });

  it('NCM 17019900 (8 dígitos) passa no formato', () => {
    const r = verificarRequisitosValidacao({ ...PRODUTO_BASE, ncm: '17019900' });
    expect(r.ok).toBe(true);
    expect(r.pendencias).toEqual([]);
  });

  it('6. bloqueia produto sem NCM válido', () => {
    for (const ncm of ['', '123', '1234567', '123456789', 'ABCDEFGH', '17019A00']) {
      const r = verificarRequisitosValidacao({ ...PRODUTO_BASE, ncm });
      expect(r.ok).toBe(false);
      expect(r.pendencias.join(' ')).toMatch(/NCM/);
    }
    const nulo = verificarRequisitosValidacao({
      ...PRODUTO_BASE,
      ncm: null as unknown as string,
    });
    expect(nulo.ok).toBe(false);
  });

  it('bloqueia sem campos básicos (nome, CFOP, origem)', () => {
    expect(
      verificarRequisitosValidacao({ ...PRODUTO_BASE, produto_nome: ' ' }).ok,
    ).toBe(false);
    expect(verificarRequisitosValidacao({ ...PRODUTO_BASE, cfop_padrao: '' }).ok).toBe(false);
    expect(
      verificarRequisitosValidacao({ ...PRODUTO_BASE, origem_mercadoria: 99 }).ok,
    ).toBe(false);
  });
});

describe('produtoFiscalService — RPC definir_status_fiscal_produto', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRpc.mockResolvedValue({ data: { success: true }, error: null });
  });

  it('5. validação chama a RPC com p_produto_id e p_status', async () => {
    await alterarStatusFiscalProduto('prod-1', 'validado');
    expect(mockRpc).toHaveBeenCalledTimes(1);
    expect(mockRpc).toHaveBeenCalledWith('definir_status_fiscal_produto', {
      p_produto_id: 'prod-1',
      p_status: 'validado',
    });
    // Nunca atualiza fiscal_status direto pela tabela.
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('suporta devolver à revisão e bloquear pela mesma RPC', async () => {
    await alterarStatusFiscalProduto('prod-1', 'em_revisao');
    await alterarStatusFiscalProduto('prod-1', 'pendente_revisao');
    await alterarStatusFiscalProduto('prod-1', 'bloqueado');
    expect(mockRpc).toHaveBeenCalledTimes(3);
    expect(mockRpc.mock.calls[2]).toEqual([
      'definir_status_fiscal_produto',
      { p_produto_id: 'prod-1', p_status: 'bloqueado' },
    ]);
  });

  it('7. falha na RPC gera erro claro, sem sucesso falso', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'Permissão negada' } });
    await expect(alterarStatusFiscalProduto('prod-1', 'validado')).rejects.toThrow(
      'Permissão negada',
    );
  });
});

describe('montarPayloadCadastroProduto', () => {
  it('4. preserva campos fiscais e comerciais, sem fiscal_status', () => {
    const payload = montarPayloadCadastroProduto({
      produto_nome: 'Arroz 5kg',
      categoria: 'Alimentos',
      ncm: '10063021',
      preco_unt: 25,
      qtd_estoque: 10,
      unidade_medida: 'PCT',
      cest: '1704400',
      cfop_padrao: '5102',
      categoria_fiscal: 'Cesta básica',
      cst_icms: '102',
      aliquota_icms: 0,
      cst_pis: '07',
      aliquota_pis: 0,
      cst_cofins: '07',
      aliquota_cofins: 0,
      origem_mercadoria: 0,
    });
    expect(payload).toMatchObject({
      produto_nome: 'Arroz 5kg',
      ncm: '10063021',
      preco_unt: 25,
      cest: '1704400',
      cfop_padrao: '5102',
      categoria_fiscal: 'Cesta básica',
      cst_icms: '102',
      aliquota_icms: 0,
      cst_pis: '07',
      aliquota_pis: 0,
      cst_cofins: '07',
      aliquota_cofins: 0,
      origem_mercadoria: 0,
      unidade_medida: 'PCT',
    });
    expect(payload).not.toHaveProperty('fiscal_status');
    expect(payload).not.toHaveProperty('fiscal_validado_em');
  });
});
