// src/services/sincronizacaoFiscalService.ts
// Serviço de consulta para a tela de Prévia da Sincronização Fiscal.
// Lê dados de `produtos_fiscal_referencia` (Edge Function / tabela de referência
// histórica) e de `produtos_cadastrado` (catálogo ativo).
// NUNCA grava em nenhuma tabela. Somente leitura.
import { supabase } from '@/lib/supabase';
import type { ProdutoCadastrado } from './produtoService';

/** Tipo de dado que vem da tabela de referência fiscal (histórico TMP_PROD.ods). */
export interface ReferenciaFiscalItem {
  id: string;
  administrador_id: string;
  linha_origem: number;
  codigo: string | null;
  codigo_barras: string | null;
  descricao: string | null;
  ncm: string | null;
  cest: string | null;
  cfop_padrao: string | null;
  cst_icms: string | null;
  icms?: number | null;
  cst_pis: string | null;
  aliquota_pis: number | null;
  cst_cofins: string | null;
  aliquota_cofins: number | null;
  nfe_cfop?: string | null;
  origem_mercadoria?: number | null;
  estoque: number | null;
  valor_estoque: number | null;
  preco1: number | null;
  created_at?: string;
}

/**
 * Resultado da comparação entre uma linha da referência fiscal e o
 * cadastro atual de produtos.
 */
export interface ComparacaoFiscalItem {
  referencia: ReferenciaFiscalItem;
  produto: ProdutoCadastrado | null;
  /**
   * 'encontrada' | 'nao_encontrada' | 'ambigua'
   */
  tipo: 'encontrada' | 'nao_encontrada' | 'ambigua';
  /** Motivo quando não pôde ser feita a correspondência. */
  motivo?: string;
  /** Estoque atual do produto cadastrado (ou 0 se não encontrado). */
  estoque_atual: number;
  /** Quantidade da planilha de referência. */
  quantidade_planilha: number;
  /** Estoque proposto = estoque_atual + quantidade_planilha. */
  estoque_proposto: number;
  /** Indica se o estoque plano é inválido (nulo/negativo/fracionado). */
  estoque_invalido: boolean;
  /** Diferenças de campos fiscais entre a referência e o produto cadastrado. */
  diferencas_fiscais: {
    campo: string;
    valor_atual: string | number | null;
    valor_referencia: string | number | null;
  }[];
}

export interface ResumoSincronizacao {
  total_referencias: number;
  total_produtos_cadastrados: number;
  total_correspondencias: number;
  total_novos_produtos: number;
  total_divergencias_fiscais: number;
  total_bloqueados: number;
  total_duplicados: number;
}

const normalizarTexto = (v: unknown): string | null => {
  if (v === null || v === undefined) return null;
  const t = String(v).trim();
  return t === '' ? null : t;
};

/** Normaliza descrição para comparação: remove acentos, minúsculo, colapsa espaços. */
const normalizarDescricao = (v: string | null | undefined): string => {
  if (!v) return '';
  return String(v)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
};

/** Verifica se um valor numérico é inválido para estoque (nulo, negativo ou fracionário). */
const ehQuantidadeInvalida = (v: number | null | undefined): boolean => {
  if (v === null || v === undefined) return true;
  if (!Number.isFinite(v)) return true;
  if (v < 0) return true;
  if (!Number.isInteger(v)) return true;
  return false;
};

export async function buscarReferenciasFiscais(
  adminId: string,
): Promise<ReferenciaFiscalItem[]> {
  const { data, error } = await supabase
    .from('produtos_fiscal_referencia')
    .select('*')
    .eq('administrador_id', adminId)
    .order('linha_origem', { ascending: true });

  if (error) throw new Error(error.message || 'Erro ao buscar referências fiscais.');
  return (data ?? []) as ReferenciaFiscalItem[];
}

export async function buscarProdutosCadastrados(
  adminId: string,
): Promise<ProdutoCadastrado[]> {
  const { data, error } = await supabase
    .from('produtos_cadastrado')
    .select('*')
    .eq('administrador_id', adminId)
    .eq('ativo', true)
    .order('produto_nome');

  if (error) throw new Error(error.message || 'Erro ao buscar produtos cadastrados.');
  return (data ?? []) as ProdutoCadastrado[];
}

/**
 * Compara a referência fiscal com o cadastro atual de produtos.
 * Não grava nada no banco; apenas faz leitura e cálculo em memória.
 */
export async function carregarComparacaoFiscal(
  adminId: string,
): Promise<{
  referencia: ReferenciaFiscalItem[];
  produtos: ProdutoCadastrado[];
  comparacao: ComparacaoFiscalItem[];
  resumo: ResumoSincronizacao;
}> {
  const [referencias, produtos] = await Promise.all([
    buscarReferenciasFiscais(adminId),
    buscarProdutosCadastrados(adminId),
  ]);

  // Índices para busca rápida
  const porCodigoBarras = new Map<string, ProdutoCadastrado[]>();
  const porCodigo = new Map<string, ProdutoCadastrado[]>();
  const porDescricaoNormalizada = new Map<string, ProdutoCadastrado[]>();

  for (const p of produtos) {
    if (p.codigo_barras) {
      const chave = p.codigo_barras.trim();
      const arr = porCodigoBarras.get(chave) || [];
      arr.push(p);
      porCodigoBarras.set(chave, arr);
    }
    if (p.produto_cod) {
      const chave = p.produto_cod.trim();
      const arr = porCodigo.get(chave) || [];
      arr.push(p);
      porCodigo.set(chave, arr);
    }
    const descNorm = normalizarDescricao(p.produto_nome);
    if (descNorm) {
      const arr = porDescricaoNormalizada.get(descNorm) || [];
      arr.push(p);
      porDescricaoNormalizada.set(descNorm, arr);
    }
  }

  const comparacao: ComparacaoFiscalItem[] = [];

  for (const ref of referencias) {
    let candidatos: ProdutoCadastrado[] = [];

    // 1. Código de barras exato
    if (ref.codigo_barras) {
      const c = porCodigoBarras.get(ref.codigo_barras.trim()) || [];
      candidatos.push(...c);
    }

    // 2. Código do produto exato
    if (!candidatos.length && ref.codigo) {
      const c = porCodigo.get(ref.codigo.trim()) || [];
      candidatos.push(...c);
    }

    // 3. Descrição normalizada exata
    if (!candidatos.length && ref.descricao) {
      const dn = normalizarDescricao(ref.descricao);
      if (dn) {
        const c = porDescricaoNormalizada.get(dn) || [];
        candidatos.push(...c);
      }
    }

    // Remove duplicados no array de candidatos (mesmo produto pode vir por mais de uma via)
    const candidatosUnicos = candidatos.filter(
      (v, i, arr) => arr.findIndex((p) => p.id === v.id) === i,
    );

    let tipo: 'encontrada' | 'nao_encontrada' | 'ambigua' = 'nao_encontrada';
    let motivo: string | undefined;

    if (candidatosUnicos.length === 0) {
      motivo = 'Produto não encontrado no catálogo.';
    } else if (candidatosUnicos.length > 1) {
      tipo = 'ambigua';
      motivo = 'Vários produtos correspondem a esta referência.';
    } else {
      tipo = 'encontrada';
    }

    const produto = candidatosUnicos[0] ?? null;

    // Estoque
    const estoque_atual = produto ? (p.qtd_estoque ?? 0) : 0;
    const quantidade_planilha = ref.estoque ?? 0;
    const estoque_proposto = estoque_atual + quantidade_planilha;
    const estoque_invalido = ehQuantidadeInvalida(ref.estoque);

    // Diferenças fiscais
    const diferencas: {
      campo: string;
      valor_atual: string | number | null;
      valor_referencia: string | number | null;
    }[] = [];

    if (produto) {
      const pares: [string, string | number | null, string | number | null][] = [
        ['NCM', p.ncm ?? null, ref.ncm ?? null],
        ['CEST', p.cest ?? null, ref.cest ?? null],
        ['CFOP', p.cfop_padrao ?? null, ref.cfop_padrao ?? null],
        ['CST ICMS', p.cst_icms ?? null, ref.cst_icms ?? null],
        ['Alíquota ICMS', p.aliquota_icms ?? null, ref.aliquota_icms ?? null],
        ['CST PIS', p.cst_pis ?? null, ref.cst_pis ?? null],
        ['Alíquota PIS', p.aliquota_pis ?? null, ref.aliquota_pis ?? null],
        ['CST COFINS', p.cst_cofins ?? null, ref.cst_cofins ?? null],
        ['Alíquota COFINS', p.aliquota_cofins ?? null, ref.aliquota_cofins ?? null],
      ];

      for (const [nome, atual, referencia] of pares) {
        if (atual !== referencia) {
          diferencas.push({ campo: nome, valor_atual: atual, valor_referencia: referencia });
        }
      }
    }

    comparacao.push({
      referencia: ref,
      produto: produto,
      tipo,
      motivo,
      estoque_atual,
      quantidade_planilha,
      estoque_proposto,
      estoque_invalido,
      diferencas_fiscais: diferencas,
    });
  }

  // Contadores de resumo
  const totalCorrespondencias = comparacao.filter((c) => c.tipo === 'encontrada').length;
  const totalNovos = comparacao.filter((c) => c.tipo === 'nao_encontrada').length;
  const totalDivergencias = comparacao.filter(
    (c) => c.tipo === 'encontrada' && c.diferencas_fiscais.length > 0,
  ).length;
  const totalBloqueados = comparacao.filter((c) => c.estoque_invalido).length;
  const totalDuplicados = comparacao.filter(
    (c) => c.tipo === 'ambigua',
  ).length;

  return {
    referencia,
    produtos,
    comparacao,
    resumo: {
      total_referencias: referencias.length,
      total_produtos_cadastrados: produtos.length,
      total_correspondencias: totalCorrespondencias,
      total_novos_produtos: totalNovos,
      total_divergencias_fiscais: totalDivergencias,
      total_bloqueados: totalBloqueados,
      total_duplicados: totalDuplicados,
    },
  };
}

/**
 * Verifica se uma quantidade é inválida para estoque (nulo, negativo ou fracionado).
 * Expósito para uso em testes.
 */
export function ehQuantidadeInvalidaParaEstoque(
  valor: number | null | undefined,
): boolean {
  return ehQuantidadeInvalida(valor);
}
