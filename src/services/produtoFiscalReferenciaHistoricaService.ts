// src/services/produtoFiscalReferenciaHistoricaService.ts
//
// Serviço de LEITURA para dados fiscais históricos de produtos importados.
//
// Regras:
// - Somente leitura. Nenhuma gravação.
// - Para produtos com importacao_id não nulo, busca o registro correspondente
//   em `itens_importacao_produtos_fiscal` usando produto_id e o contexto do
//   administrador autenticado.
// - O snapshot_referencia contém os dados fiscais da referência histórica.
// - Valores nulos são preservados (não convertidos para zero).
// - Erros de leitura são propagados (não silenciados).

import { supabase } from '@/lib/supabase';

/** Campos fiscais disponíveis no snapshot de referência. */
export interface SnapshotFiscalReferencia {
  ncm?: string | null;
  cest?: string | null;
  cfop_padrao?: string | null;
  cfop_descricao?: string | null;
  cst_icms?: string | null;
  aliquota_icms?: number | null;
  cst_pis?: string | null;
  aliquota_pis?: number | null;
  cst_pis_saida?: string | null;
  aliquota_pis_saida?: number | null;
  cst_cofins?: string | null;
  aliquota_cofins?: number | null;
  cst_cofins_saida?: string | null;
  aliquota_cofins_saida?: number | null;
  nfe_cfop?: string | null;
  origem_mercadoria?: number | null;
  codigo?: string | null;
  codigo_barras?: string | null;
  descricao?: string | null;
  estoque?: number | null;
  preco1?: number | null;
  custo?: number | null;
  custo_compra?: number | null;
  kit?: boolean | null;
  [key: string]: unknown;
}

/** Registro de item de importação fiscal. */
export interface ItemImportacaoFiscalHistorico {
  id: string;
  importacao_id: string;
  produto_id: string | null;
  referencia_id: string | null;
  administrador_id: string;
  snapshot_referencia: SnapshotFiscalReferencia | null;
  sucesso: boolean | null;
  bloqueado: boolean | null;
  avisos: string[] | null;
  erros: string[] | null;
  created_at: string | null;
}

/**
 * Busca o item de importação fiscal correspondente a um produto.
 * Retorna null se não houver registro (produto não veio de importação).
 * Lança erro em caso de falha de leitura (não silencia).
 */
export async function buscarHistoricoFiscalProduto(
  produtoId: string,
  adminId: string,
): Promise<ItemImportacaoFiscalHistorico | null> {
  if (!produtoId || !adminId) {
    throw new Error('produtoId e adminId são obrigatórios para buscar histórico fiscal.');
  }

  const { data, error } = await supabase
    .from('itens_importacao_produtos_fiscal')
    .select('*')
    .eq('produto_id', produtoId)
    .eq('administrador_id', adminId)
    .maybeSingle();

  if (error) {
    throw new Error(
      `Falha ao buscar histórico fiscal do produto: ${error.message}`,
    );
  }

  if (!data) return null;

  return {
    id: data.id,
    importacao_id: data.importacao_id,
    produto_id: data.produto_id,
    referencia_id: data.referencia_id,
    administrador_id: data.administrador_id,
    snapshot_referencia: data.snapshot_referencia ?? null,
    sucesso: data.sucesso ?? null,
    bloqueado: data.bloqueado ?? null,
    avisos: data.avisos ?? null,
    erros: data.erros ?? null,
    created_at: data.created_at ?? null,
  };
}

/**
 * Verifica se um produto veio de importação fiscal (tem importacao_id).
 */
export function produtoVeioDeImportacao(produto: { importacao_id?: string | null } | null): boolean {
  return !!produto?.importacao_id;
}

/**
 * Mapeia campos do snapshot_referencia para os campos editáveis do formulário.
 *
 * Regras de preenchimento:
 * - Somente preenche quando o valor do snapshot não é null/undefined.
 * - `origem_mercadoria` NÃO é mapeada (a referência não contém este campo).
 * - Valores numéricos zero são preservados (não confundidos com ausência).
 * - Não modifica valores já presentes no formulário (deixar para o chamador decidir sobre sobrescrita).
 */
export interface CamposFiscalEditaveis {
  ncm?: string | null;
  cest?: string | null;
  cfop_padrao?: string | null;
  cst_icms?: string | null;
  aliquota_icms?: number | null;
  cst_pis?: string | null;
  aliquota_pis?: number | null;
  cst_cofins?: string | null;
  aliquota_cofins?: number | null;
}

/**
 * Extrai os campos fiscais editáveis de um snapshot de referência.
 * Retorna apenas campos com valores definidos (não null/undefined).
 */
export function mapearSnapshotParaCamposFiscais(
  snapshot: SnapshotFiscalReferencia | null | undefined,
): CamposFiscalEditaveis {
  if (!snapshot) return {};

  const campos: CamposFiscalEditaveis = {};

  if (snapshot.ncm !== null && snapshot.ncm !== undefined) campos.ncm = snapshot.ncm;
  if (snapshot.cest !== null && snapshot.cest !== undefined) campos.cest = snapshot.cest;
  // cfop_descricao mapeia para cfop_padrao; cfop_padrao como fallback
  if (snapshot.cfop_descricao !== null && snapshot.cfop_descricao !== undefined) {
    campos.cfop_padrao = snapshot.cfop_descricao;
  } else if (snapshot.cfop_padrao !== null && snapshot.cfop_padrao !== undefined) {
    campos.cfop_padrao = snapshot.cfop_padrao;
  }
  if (snapshot.cst_icms !== null && snapshot.cst_icms !== undefined) campos.cst_icms = snapshot.cst_icms;
  if (snapshot.aliquota_icms !== null && snapshot.aliquota_icms !== undefined) {
    campos.aliquota_icms = snapshot.aliquota_icms;
  }
  if (snapshot.cst_pis !== null && snapshot.cst_pis !== undefined) campos.cst_pis = snapshot.cst_pis;
  if (snapshot.aliquota_pis !== null && snapshot.aliquota_pis !== undefined) {
    campos.aliquota_pis = snapshot.aliquota_pis;
  }
  if (snapshot.cst_cofins !== null && snapshot.cst_cofins !== undefined) {
    campos.cst_cofins = snapshot.cst_cofins;
  }
  if (snapshot.aliquota_cofins !== null && snapshot.aliquota_cofins !== undefined) {
    campos.aliquota_cofins = snapshot.aliquota_cofins;
  }

  return campos;
}

/**
 * Preenche campos de um formulário com valores do snapshot, somente quando
 * o campo atual está vazio (null, undefined ou string vazia).
 * Não sobrescreve valores já preenchidos.
 * `origem_mercadoria` nunca é preenchido a partir da referência.
 */
export function preencherCamposFiscaisDoHistorico<
  T extends { ncm?: string; cest?: string; cfop_padrao?: string; cst_icms?: string; aliquota_icms?: number; cst_pis?: string; aliquota_pis?: number; cst_cofins?: string; aliquota_cofins?: number },
>(
  formAtual: T,
  snapshot: SnapshotFiscalReferencia | null | undefined,
): T {
  const campos = mapearSnapshotParaCamposFiscais(snapshot);
  if (Object.keys(campos).length === 0) return formAtual;

  // Para campos numéricos (aliquota), preencher somente quando o valor atual
  // é null ou undefined. Zero é um valor válido e não deve ser sobrescrito.
  const preencherString = (
    atual: string | null | undefined,
    candidato: string | null | undefined,
  ): string => {
    if ((!atual || atual === '') && candidato !== null && candidato !== undefined) {
      return candidato;
    }
    return atual ?? '';
  };

  const preencherNumero = (
    atual: number | null | undefined,
    candidato: number | null | undefined,
  ): number => {
    if (
      (atual === null || atual === undefined) &&
      candidato !== null &&
      candidato !== undefined
    ) {
      return candidato;
    }
    return atual ?? 0;
  };

  return {
    ...formAtual,
    ncm: preencherString(formAtual.ncm, campos.ncm),
    cest: preencherString(formAtual.cest, campos.cest),
    cfop_padrao: preencherString(formAtual.cfop_padrao, campos.cfop_padrao),
    cst_icms: preencherString(formAtual.cst_icms, campos.cst_icms),
    aliquota_icms: preencherNumero(formAtual.aliquota_icms, campos.aliquota_icms),
    cst_pis: preencherString(formAtual.cst_pis, campos.cst_pis),
    aliquota_pis: preencherNumero(formAtual.aliquota_pis, campos.aliquota_pis),
    cst_cofins: preencherString(formAtual.cst_cofins, campos.cst_cofins),
    aliquota_cofins: preencherNumero(formAtual.aliquota_cofins, campos.aliquota_cofins),
  };
}
