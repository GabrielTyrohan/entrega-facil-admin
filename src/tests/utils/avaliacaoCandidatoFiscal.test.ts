import { describe, expect, it } from 'vitest';
import {
  avaliarCandidatoFiscal,
  classeBadgeStatusCandidato,
  motivosDoCandidato,
  obterCustoReferencia,
  obterPrecoReferencia,
  quantidadeInvalidaParaEstoque,
  rotuloStatusCandidato,
} from '../../utils/avaliacaoCandidatoFiscal';
import type {
  ComparacaoFiscalItem,
  ReferenciaFiscalItem,
} from '../../services/sincronizacaoFiscalService';

const REFERENCIA_BASE: ReferenciaFiscalItem = {
  id: 'ref-1',
  administrador_id: 'admin-1',
  linha_origem: 10,
  codigo: '00123',
  codigo_barras: '0001234567890',
  descricao: 'Produto Teste',
  ncm: '010063021',
  cest: '1704400',
  cfop_padrao: '5102',
  cst_icms: '0102',
  aliquota_icms: 18,
  cst_pis: '01',
  aliquota_pis: 1.65,
  cst_cofins: '01',
  aliquota_cofins: 3,
  custo: 8.5,
  custo_compra: 8,
  estoque: 10,
  valor_estoque: 85,
  preco1: 12.9,
};

function criarItem(
  overrides: Partial<ReferenciaFiscalItem> = {},
): ComparacaoFiscalItem {
  const referencia = { ...REFERENCIA_BASE, ...overrides };
  return {
    referencia,
    produto: null,
    tipo: 'nao_encontrada',
    motivo: 'Produto não encontrado no catálogo.',
    estoque_atual: null,
    quantidade_planilha: referencia.estoque,
    estoque_proposto: null,
    estoque_invalido: false,
    divergencia_descricao: false,
    diferencas_fiscais: [],
  };
}

describe('avaliacaoCandidatoFiscal', () => {
  describe('quantidadeInvalidaParaEstoque', () => {
    it('aceita somente inteiro maior ou igual a zero', () => {
      expect(quantidadeInvalidaParaEstoque(0)).toBe(false);
      expect(quantidadeInvalidaParaEstoque(10)).toBe(false);
      expect(quantidadeInvalidaParaEstoque(null)).toBe(true);
      expect(quantidadeInvalidaParaEstoque(undefined)).toBe(true);
      expect(quantidadeInvalidaParaEstoque(-1)).toBe(true);
      expect(quantidadeInvalidaParaEstoque(1.5)).toBe(true);
      expect(quantidadeInvalidaParaEstoque(Number.NaN)).toBe(true);
      expect(quantidadeInvalidaParaEstoque(Number.POSITIVE_INFINITY)).toBe(true);
    });
  });

  describe('dados comerciais', () => {
    it('usa o custo da referência e faz fallback para custo_compra', () => {
      expect(obterCustoReferencia(REFERENCIA_BASE)).toBe(8.5);
      expect(
        obterCustoReferencia({ ...REFERENCIA_BASE, custo: null }),
      ).toBe(8);
      expect(
        obterCustoReferencia({
          ...REFERENCIA_BASE,
          custo: null,
          custo_compra: null,
        }),
      ).toBeNull();
    });

    it('retorna o preço somente quando é um número finito', () => {
      expect(obterPrecoReferencia(REFERENCIA_BASE)).toBe(12.9);
      expect(obterPrecoReferencia({ ...REFERENCIA_BASE, preco1: null })).toBeNull();
      expect(
        obterPrecoReferencia({ ...REFERENCIA_BASE, preco1: Number.NaN }),
      ).toBeNull();
    });

    it('classifica candidato com dados mínimos válidos como "revisar"', () => {
      const avaliacao = avaliarCandidatoFiscal(criarItem());

      expect(avaliacao.status).toBe('revisar');
      expect(avaliacao.selecionavel).toBe(true);
      expect(avaliacao.bloqueios).toEqual([]);
      expect(avaliacao.pendencias).toContain(
        'Categoria comercial pendente de definição.',
      );
      expect(avaliacao.pendencias).toContain(
        'Unidade comercial pendente de definição.',
      );
      expect(avaliacao.categoria_comercial).toBeNull();
      expect(avaliacao.unidade_comercial).toBeNull();
      expect(avaliacao.custo).toBe(8.5);
      expect(avaliacao.preco).toBe(12.9);
      expect(avaliacao.estoque_inicial).toBe(10);
    });

    it('nunca inventa categoria ou unidade comercial', () => {
      const avaliacao = avaliarCandidatoFiscal(criarItem());

      expect(avaliacao.categoria_comercial).toBeNull();
      expect(avaliacao.unidade_comercial).toBeNull();
    });
  });

  describe('bloqueios', () => {
    it('bloqueia quantidade ausente', () => {
      const avaliacao = avaliarCandidatoFiscal(criarItem({ estoque: null }));

      expect(avaliacao.status).toBe('bloqueado');
      expect(avaliacao.selecionavel).toBe(false);
      expect(avaliacao.bloqueios).toContain(
        'Quantidade de estoque ausente na base de referência.',
      );
      expect(avaliacao.estoque_inicial).toBeNull();
    });

    it('bloqueia quantidade negativa', () => {
      const avaliacao = avaliarCandidatoFiscal(criarItem({ estoque: -3 }));

      expect(avaliacao.status).toBe('bloqueado');
      expect(avaliacao.bloqueios).toContain(
        'Quantidade de estoque negativa na base de referência.',
      );
      expect(avaliacao.estoque_inicial).toBeNull();
    });

    it('bloqueia quantidade fracionária', () => {
      const avaliacao = avaliarCandidatoFiscal(criarItem({ estoque: 1.5 }));

      expect(avaliacao.status).toBe('bloqueado');
      expect(avaliacao.bloqueios).toContain(
        'Quantidade de estoque fracionária na base de referência.',
      );
      expect(avaliacao.estoque_inicial).toBeNull();
    });

    it('bloqueia preço ausente', () => {
      const avaliacao = avaliarCandidatoFiscal(criarItem({ preco1: null }));

      expect(avaliacao.status).toBe('bloqueado');
      expect(avaliacao.bloqueios).toContain(
        'Preço não informado na referência fiscal.',
      );
      expect(avaliacao.preco).toBeNull();
    });

    it('bloqueia preço zero ou negativo', () => {
      expect(
        avaliarCandidatoFiscal(criarItem({ preco1: 0 })).bloqueios,
      ).toContain('Preço inválido: deve ser maior que zero.');
      expect(
        avaliarCandidatoFiscal(criarItem({ preco1: -1 })).bloqueios,
      ).toContain('Preço inválido: deve ser maior que zero.');
    });

    it('bloqueia descrição ausente', () => {
      const avaliacao = avaliarCandidatoFiscal(criarItem({ descricao: '   ' }));

      expect(avaliacao.status).toBe('bloqueado');
      expect(avaliacao.bloqueios).toContain(
        'Descrição ausente na referência fiscal.',
      );
    });
  });

  describe('pendências de revisão', () => {
    it('lista código, EAN, custo e dados fiscais ausentes', () => {
      const avaliacao = avaliarCandidatoFiscal(
        criarItem({
          codigo: null,
          codigo_barras: null,
          custo: null,
          custo_compra: null,
          ncm: null,
          cest: null,
          cfop_padrao: null,
          nfe_cfop: null,
          cst_icms: null,
          cst_pis: null,
          cst_cofins: null,
        }),
      );

      expect(avaliacao.status).toBe('revisar');
      expect(avaliacao.pendencias).toContain('Código do produto não informado.');
      expect(avaliacao.pendencias).toContain(
        'Código de barras (EAN) não informado.',
      );
      expect(avaliacao.pendencias).toContain(
        'Custo não informado na referência fiscal.',
      );
      expect(avaliacao.pendencias).toContain(
        'Dados fiscais incompletos na referência: NCM, CEST, CFOP, CST ICMS, CST PIS, CST COFINS.',
      );
    });

    it('usa nfe_cfop como CFOP quando cfop_padrao não existe', () => {
      const avaliacao = avaliarCandidatoFiscal(
        criarItem({ cfop_padrao: null, nfe_cfop: '6102' }),
      );

      expect(
        avaliacao.pendencias.some((motivo) => motivo.includes('CFOP')),
      ).toBe(false);
    });
  });

  describe('rótulos e motivos', () => {
    it('expõe rótulos e classes por status', () => {
      expect(rotuloStatusCandidato('pronto')).toBe('Pronto para revisão');
      expect(rotuloStatusCandidato('revisar')).toBe('Revisar');
      expect(rotuloStatusCandidato('bloqueado')).toBe('Bloqueado');
      expect(classeBadgeStatusCandidato('pronto')).toContain('green');
      expect(classeBadgeStatusCandidato('revisar')).toContain('amber');
      expect(classeBadgeStatusCandidato('bloqueado')).toContain('red');
    });

    it('lista bloqueios antes das pendências', () => {
      const avaliacao = avaliarCandidatoFiscal(
        criarItem({ estoque: -1, preco1: 0 }),
      );
      const motivos = motivosDoCandidato(avaliacao);

      expect(motivos[0]).toBe(
        'Quantidade de estoque negativa na base de referência.',
      );
      expect(motivos).toContain('Preço inválido: deve ser maior que zero.');
      expect(motivos[motivos.length - 1]).toBe(
        'Unidade comercial pendente de definição.',
      );
    });
  });
});
