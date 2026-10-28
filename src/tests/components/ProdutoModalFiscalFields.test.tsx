import { describe, it, expect } from 'vitest';
import {
  mapearSnapshotParaCamposFiscais,
  preencherCamposFiscaisDoHistorico,
  produtoVeioDeImportacao,
  type SnapshotFiscalReferencia,
} from '../../services/produtoFiscalReferenciaHistoricaService';

const SNAPSHOT_COMPLETO: SnapshotFiscalReferencia = {
  ncm: '18069000',
  cest: '1700600',
  cfop_descricao: '5405',
  cst_icms: '0500',
  aliquota_icms: 0,
  cst_pis: null,
  aliquota_pis: 0,
  cst_cofins: null,
  aliquota_cofins: 0,
  origem_mercadoria: null,
};

const SNAPSHOT_VAZIO: SnapshotFiscalReferencia = {
  ncm: null,
  cest: null,
  cfop_descricao: null,
  cst_icms: null,
  aliquota_icms: null,
  cst_pis: null,
  aliquota_pis: null,
  cst_cofins: null,
  aliquota_cofins: null,
  origem_mercadoria: null,
};

describe('produtoVeioDeImportacao', () => {
  it('retorna true quando importacao_id não é nulo', () => {
    expect(produtoVeioDeImportacao({ importacao_id: 'lote-1' })).toBe(true);
  });

  it('retorna false quando importacao_id é nulo', () => {
    expect(produtoVeioDeImportacao({ importacao_id: null })).toBe(false);
  });

  it('retorna false quando importacao_id é undefined', () => {
    expect(produtoVeioDeImportacao({})).toBe(false);
  });

  it('retorna false quando produto é null', () => {
    expect(produtoVeioDeImportacao(null)).toBe(false);
  });
});

describe('mapearSnapshotParaCamposFiscais', () => {
  it('mapeia todos os campos do snapshot completo', () => {
    const resultado = mapearSnapshotParaCamposFiscais(SNAPSHOT_COMPLETO);
    expect(resultado).toEqual({
      ncm: '18069000',
      cest: '1700600',
      cfop_padrao: '5405',
      cst_icms: '0500',
      aliquota_icms: 0,
      aliquota_pis: 0,
      aliquota_cofins: 0,
    });
  });

  it('não inclui campos nulos do snapshot', () => {
    const resultado = mapearSnapshotParaCamposFiscais(SNAPSHOT_VAZIO);
    expect(resultado).toEqual({});
  });

  it('usa cfop_descricao para cfop_padrao quando disponível', () => {
    const snap: SnapshotFiscalReferencia = {
      ncm: '12345678',
      cfop_descricao: '5405',
      cst_icms: '0500',
      aliquota_icms: 17,
    };
    const resultado = mapearSnapshotParaCamposFiscais(snap);
    expect(resultado.cfop_padrao).toBe('5405');
  });

  it('usa cfop_padrao como fallback quando cfop_descricao não existe', () => {
    const snap: SnapshotFiscalReferencia = {
      ncm: '12345678',
      cfop_padrao: '6102',
      cst_icms: '0500',
    };
    const resultado = mapearSnapshotParaCamposFiscais(snap);
    expect(resultado.cfop_padrao).toBe('6102');
  });

  it('retorna objeto vazio para snapshot null', () => {
    expect(mapearSnapshotParaCamposFiscais(null)).toEqual({});
  });

  it('retorna objeto vazio para snapshot undefined', () => {
    expect(mapearSnapshotParaCamposFiscais(undefined)).toEqual({});
  });
});

describe('preencherCamposFiscaisDoHistorico', () => {
  const formBase = {
    ncm: '',
    cest: '',
    cfop_padrao: '',
    cst_icms: '',
    aliquota_icms: undefined,
    cst_pis: '',
    aliquota_pis: undefined,
    cst_cofins: '',
    aliquota_cofins: undefined,
  };

  it('preenche campos vazios com valores do snapshot', () => {
    const resultado = preencherCamposFiscaisDoHistorico(formBase, SNAPSHOT_COMPLETO);
    expect(resultado.ncm).toBe('18069000');
    expect(resultado.cest).toBe('1700600');
    expect(resultado.cfop_padrao).toBe('5405');
    expect(resultado.cst_icms).toBe('0500');
    expect(resultado.aliquota_icms).toBe(0);
    expect(resultado.aliquota_pis).toBe(0);
    expect(resultado.aliquota_cofins).toBe(0);
  });

  it('não sobrescreve campos já preenchidos', () => {
    const formComValores = { ...formBase, ncm: '99999999', cest: '8888888' };
    const resultado = preencherCamposFiscaisDoHistorico(formComValores, SNAPSHOT_COMPLETO);
    expect(resultado.ncm).toBe('99999999');
    expect(resultado.cest).toBe('8888888');
    // Campos vazios ainda são preenchidos
    expect(resultado.cfop_padrao).toBe('5405');
  });

  it('não preenche origem_mercadoria', () => {
    const formComOrigem = { ...formBase, origem_mercadoria: 2 };
    const resultado = preencherCamposFiscaisDoHistorico(
      formComOrigem as any,
      SNAPSHOT_COMPLETO,
    );
    expect((resultado as any).origem_mercadoria).toBe(2);
  });

  it('preserva alíquota zero como 0', () => {
    const formComAliquotaZero = { ...formBase, aliquota_icms: 0 };
    const resultado = preencherCamposFiscaisDoHistorico(
      formComAliquotaZero,
      SNAPSHOT_COMPLETO,
    );
    expect(resultado.aliquota_icms).toBe(0);
  });

  it('não altera o formulário original', () => {
    const formOriginal = { ...formBase };
    preencherCamposFiscaisDoHistorico(formOriginal, SNAPSHOT_COMPLETO);
    expect(formOriginal.ncm).toBe('');
    expect(formOriginal.cest).toBe('');
  });

  it('retorna o mesmo formulário quando snapshot é null', () => {
    const resultado = preencherCamposFiscaisDoHistorico(formBase, null);
    expect(resultado).toBe(formBase);
  });

  it('retorna o mesmo formulário quando snapshot está vazio', () => {
    const resultado = preencherCamposFiscaisDoHistorico(formBase, SNAPSHOT_VAZIO);
    expect(resultado).toEqual(formBase);
    expect(resultado.ncm).toBe('');
  });
});

describe('integração: mapeamento + preenchimento', () => {
  it('fluxo completo de preenchimento a partir da referência', () => {
    const formVazio = {
      ncm: '',
      cest: '',
      cfop_padrao: '',
      cst_icms: '',
      aliquota_icms: undefined,
      cst_pis: '',
      aliquota_pis: undefined,
      cst_cofins: '',
      aliquota_cofins: undefined,
    };

    const campos = mapearSnapshotParaCamposFiscais(SNAPSHOT_COMPLETO);
    expect(Object.keys(campos).length).toBeGreaterThan(0);

    const preenchido = preencherCamposFiscaisDoHistorico(
      formVazio,
      SNAPSHOT_COMPLETO,
    );
    expect(preenchido.ncm).toBe('18069000');
    expect(preenchido.cest).toBe('1700600');
    expect(preenchido.cfop_padrao).toBe('5405');
    expect(preenchido.cst_icms).toBe('0500');
    expect(preenchido.aliquota_icms).toBe(0);
    expect(preenchido.cst_pis).toBe('');
    expect(preenchido.cst_cofins).toBe('');
  });
});
