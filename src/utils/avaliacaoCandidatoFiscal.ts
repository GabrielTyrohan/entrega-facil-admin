// src/utils/avaliacaoCandidatoFiscal.ts
// Classificação LOCAL (somente leitura) dos candidatos à importação fiscal.
// Este módulo não acessa o Supabase, não grava nada e não altera nenhum dado.
// A classificação é apenas visual: serve para a etapa de revisão da prévia.
import type {
  ComparacaoFiscalItem,
  ReferenciaFiscalItem,
} from '../services/sincronizacaoFiscalService';

export type StatusCandidatoFiscal = 'pronto' | 'revisar' | 'bloqueado';

export interface AvaliacaoCandidatoFiscal {
  status: StatusCandidatoFiscal;
  /** Somente candidatos não bloqueados podem ser selecionados. */
  selecionavel: boolean;
  /** Impedimentos que tornam o candidato não selecionável. */
  bloqueios: string[];
  /** Dados que o usuário precisa conferir/definir antes de uma futura importação. */
  pendencias: string[];
  /**
   * A base de referência fiscal não possui categoria comercial.
   * O valor permanece `null` para nunca inventar uma categoria automaticamente.
   */
  categoria_comercial: string | null;
  /** A base de referência fiscal também não possui unidade comercial. */
  unidade_comercial: string | null;
  /** Custo da referência (campo `custo`, com fallback para `custo_compra`). */
  custo: number | null;
  /** Preço de venda da referência (campo `preco1`). */
  preco: number | null;
  /** Estoque inicial proposto; `null` quando a quantidade é inválida. */
  estoque_inicial: number | null;
}

const textoPreenchido = (valor: string | null | undefined): boolean =>
  typeof valor === 'string' && valor.trim() !== '';

const numeroFinito = (valor: number | null | undefined): valor is number =>
  typeof valor === 'number' && Number.isFinite(valor);

/**
 * Mesma regra usada pelo serviço da prévia (`ehQuantidadeInvalida`):
 * quantidade ausente, não finita, negativa ou fracionária é inválida.
 */
export function quantidadeInvalidaParaEstoque(
  valor: number | null | undefined,
): boolean {
  if (valor === null || valor === undefined) return true;
  if (!Number.isFinite(valor)) return true;
  if (valor < 0) return true;
  if (!Number.isInteger(valor)) return true;
  return false;
}

/** Mesmas mensagens usadas pelo serviço da prévia para quantidade inválida. */
function motivoQuantidadeInvalida(valor: number | null | undefined): string {
  if (valor === null || valor === undefined) {
    return 'Quantidade de estoque ausente na base de referência.';
  }
  if (!Number.isFinite(valor)) {
    return 'Quantidade de estoque inválida na base de referência.';
  }
  if (valor < 0) {
    return 'Quantidade de estoque negativa na base de referência.';
  }
  return 'Quantidade de estoque fracionária na base de referência.';
}

/** Custo disponível na referência, sem inventar valor quando ausente. */
export function obterCustoReferencia(
  referencia: ReferenciaFiscalItem,
): number | null {
  if (numeroFinito(referencia.custo)) return referencia.custo;
  if (numeroFinito(referencia.custo_compra)) return referencia.custo_compra;
  return null;
}

/** Preço disponível na referência, sem inventar valor quando ausente. */
export function obterPrecoReferencia(
  referencia: ReferenciaFiscalItem,
): number | null {
  return numeroFinito(referencia.preco1) ? referencia.preco1 : null;
}

/**
 * Classifica um candidato (referência sem correspondência no catálogo).
 *
 * Critérios (verificados no código existente):
 * - BLOQUEADO: descrição ausente, quantidade ausente/negativa/fracionária ou
 *   preço ausente/inválido/zero.
 * - REVISAR: falta algum dado que o usuário precisará conferir. A referência
 *   fiscal não traz categoria comercial nem unidade comercial, por isso todo
 *   candidato com dados mínimos válidos ainda exige revisão.
 * - PRONTO: dados mínimos válidos e nenhuma pendência de revisão.
 *
 * Nenhum dado é gravado; a função apenas lê o objeto já produzido pela prévia.
 */
export function avaliarCandidatoFiscal(
  item: ComparacaoFiscalItem,
): AvaliacaoCandidatoFiscal {
  const referencia = item.referencia;
  const bloqueios: string[] = [];
  const pendencias: string[] = [];

  if (!textoPreenchido(referencia.descricao)) {
    bloqueios.push('Descrição ausente na referência fiscal.');
  }

  if (quantidadeInvalidaParaEstoque(referencia.estoque)) {
    bloqueios.push(motivoQuantidadeInvalida(referencia.estoque));
  }

  const preco = obterPrecoReferencia(referencia);
  if (referencia.preco1 === null || referencia.preco1 === undefined) {
    bloqueios.push('Preço não informado na referência fiscal.');
  } else if (!Number.isFinite(referencia.preco1)) {
    bloqueios.push('Preço inválido na referência fiscal.');
  } else if (referencia.preco1 <= 0) {
    bloqueios.push('Preço inválido: deve ser maior que zero.');
  }

  // Categoria e unidade comerciais não existem na base de referência.
  // Nunca são inventadas ou derivadas automaticamente.
  pendencias.push('Categoria comercial pendente de definição.');
  pendencias.push('Unidade comercial pendente de definição.');

  if (!textoPreenchido(referencia.codigo)) {
    pendencias.push('Código do produto não informado.');
  }
  if (!textoPreenchido(referencia.codigo_barras)) {
    pendencias.push('Código de barras (EAN) não informado.');
  }

  const custo = obterCustoReferencia(referencia);
  if (custo === null) {
    pendencias.push('Custo não informado na referência fiscal.');
  } else if (custo <= 0) {
    pendencias.push('Custo zerado ou negativo na referência fiscal.');
  }

  const cfop = referencia.nfe_cfop ?? referencia.cfop_padrao ?? null;
  const camposFiscaisAusentes: string[] = [];
  if (!textoPreenchido(referencia.ncm)) camposFiscaisAusentes.push('NCM');
  if (!textoPreenchido(referencia.cest)) camposFiscaisAusentes.push('CEST');
  if (!textoPreenchido(cfop)) camposFiscaisAusentes.push('CFOP');
  if (!textoPreenchido(referencia.cst_icms)) camposFiscaisAusentes.push('CST ICMS');
  if (!textoPreenchido(referencia.cst_pis)) camposFiscaisAusentes.push('CST PIS');
  if (!textoPreenchido(referencia.cst_cofins)) {
    camposFiscaisAusentes.push('CST COFINS');
  }
  if (camposFiscaisAusentes.length > 0) {
    pendencias.push(
      `Dados fiscais incompletos na referência: ${camposFiscaisAusentes.join(', ')}.`,
    );
  }

  const status: StatusCandidatoFiscal =
    bloqueios.length > 0
      ? 'bloqueado'
      : pendencias.length > 0
        ? 'revisar'
        : 'pronto';

  return {
    status,
    selecionavel: status !== 'bloqueado',
    bloqueios,
    pendencias,
    categoria_comercial: null,
    unidade_comercial: null,
    custo,
    preco,
    estoque_inicial: quantidadeInvalidaParaEstoque(referencia.estoque)
      ? null
      : referencia.estoque,
  };
}

export function rotuloStatusCandidato(status: StatusCandidatoFiscal): string {
  if (status === 'pronto') return 'Pronto para revisão';
  if (status === 'revisar') return 'Revisar';
  return 'Bloqueado';
}

export function classeBadgeStatusCandidato(
  status: StatusCandidatoFiscal,
): string {
  if (status === 'pronto') {
    return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400';
  }
  if (status === 'revisar') {
    return 'bg-amber-100 text-amber-800 dark:bg-amber-900/20 dark:text-amber-400';
  }
  return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400';
}

/** Lista completa de motivos: bloqueios primeiro, depois pendências. */
export function motivosDoCandidato(
  avaliacao: AvaliacaoCandidatoFiscal,
): string[] {
  return [...avaliacao.bloqueios, ...avaliacao.pendencias];
}
