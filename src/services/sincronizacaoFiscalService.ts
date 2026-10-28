// src/services/sincronizacaoFiscalService.ts
// Serviço de consulta para a tela de Prévia da Sincronização Fiscal.
// Lê dados de `produtos_fiscal_referencia` (tabela de referência histórica
// importada do TMP_PROD.ods) e de `produtos_cadastrado` (catálogo ativo).
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
  cfop_padrao?: string | null;
  cst_icms: string | null;
  aliquota_icms: number | null;
  icms?: number | null;
  cst_pis: string | null;
  aliquota_pis: number | null;
  cst_pis_saida?: string | null;
  aliquota_pis_saida?: number | null;
  cst_cofins: string | null;
  aliquota_cofins: number | null;
  cst_cofins_saida?: string | null;
  aliquota_cofins_saida?: number | null;
  nfe_cfop?: string | null;
  cfop_descricao?: string | null;
  origem_mercadoria?: number | null;
  kit?: boolean | null;
  custo_compra?: number | null;
  custo?: number | null;
  estoque: number | null;
  valor_estoque: number | null;
  preco1: number | null;
  created_at?: string;
}

/** Critério que produziu a correspondência entre a referência e o catálogo. */
export type CriterioCorrespondencia = 'codigo_barras' | 'codigo' | 'descricao';

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
  /**
   * Critério usado para encontrar o produto.
   * Ausente quando nenhuma correspondência foi encontrada.
   */
  criterio_correspondencia?: CriterioCorrespondencia;
  /**
   * true quando a correspondência foi barrada/reportada por colisão de
   * descrições distintas na normalização (nunca há proposta automática).
   */
  colisao_descricao?: boolean;
  /**
   * Estoque atual do produto cadastrado.
   * `null` quando o produto não foi encontrado (não existe estoque a exibir),
   * quando o cadastro não tem estoque válido ou quando a correspondência é
   * ambígua (não se pode atribuir estoque a um produto não identificado).
   */
  estoque_atual: number | null;
  /** Quantidade da planilha de referência (null quando a base não trouxe o valor). */
  quantidade_planilha: number | null;
  /**
   * Estoque proposto = estoque_atual + quantidade_planilha.
   * `null` quando o produto não foi encontrado, quando a correspondência é
   * ambígua ou quando o estoque involved é inválido (nunca "0" como
   * substituto de um valor inexistente).
   */
  estoque_proposto: number | null;
  /**
   * Indica que um produto ENCONTRADO no catálogo ficou bloqueado por estoque:
   * a quantidade da referência ou o estoque atual é inválido, portanto não há
   * proposta automática de estoque. Referências "não encontrada" NÃO são
   * bloqueadas por estoque (ficam na categoria de produtos não encontrados).
   */
  estoque_invalido: boolean;
  /** Motivo da invalidade do estoque (ausência de proposta automática). */
  estoque_motivo?: string;
  /** Descrição da referência difere da descrição do produto correspondente. */
  divergencia_descricao: boolean;
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
  /**
   * Referências cuja correspondência foi barrada por colisão de descrições
   * distintas na normalização.
   */
  total_colisoes_descricao?: number;
}

/**
 * Diagnóstico da leitura paginada de uma tabela.
 *
 * A deduplicação NUNCA descarta linhas em silêncio: registros repetidos e
 * lacunas entre páginas são detectados e reportados aqui.
 */
export interface RelatorioPaginacao {
  /** Quantidade de páginas lidas via `range()`. */
  paginas_lidas: number;
  /** Total de linhas devolvidas pelo servidor (somando todas as páginas). */
  linhas_recebidas: number;
  /** Total de linhas únicas mantidas (após descartar as repetidas). */
  linhas_unicas: number;
  /** Total exato informado pelo servidor para o mesmo filtro (null se indisponível). */
  total_esperado: number | null;
  /** Identificadores lidos em mais de uma página (amostra). */
  registros_repetidos: string[];
  /** Total de registros repetidos (podem ser mais que a amostra). */
  registros_repetidos_total: number;
  /** Linhas devolvidas sem `id` (não foi possível detectar repetição nelas). */
  registros_sem_identificador: number;
  /** Linhas faltantes em relação ao total informado pelo servidor. */
  linhas_faltantes: number;
  /** true quando a ordenação deixou de ser crescente entre as páginas. */
  ordenacao_quebrada: boolean;
  /** Avisos legíveis sobre a integridade da paginação. */
  avisos: string[];
}

export interface ResultadoComparacaoFiscal {
  referencia: ReferenciaFiscalItem[];
  produtos: ProdutoCadastrado[];
  comparacao: ComparacaoFiscalItem[];
  resumo: ResumoSincronizacao;
  /** Diagnóstico da paginação de cada tabela lida. */
  paginacao?: {
    referencias: RelatorioPaginacao;
    produtos: RelatorioPaginacao;
  };
  /** Avisos consolidados (paginação + colisões de descrição). */
  avisos?: string[];
}

/**
 * Tamanho das páginas de leitura.
 * O PostgREST devolve no máximo 1.000 linhas por requisição, então toda
 * leitura da prévia é feita em páginas explícitas via `range()`.
 */
const TAMANHO_PAGINA = 1000;

/**
 * Teto de páginas por leitura (protege contra laço infinito caso o servidor
 * ignore o `range()`).
 */
const MAXIMO_PAGINAS = 1000;

/** Quantidade máxima de identificadores repetidos listados no relatório. */
const MAXIMO_REPETIDOS_LISTADOS = 20;

/**
 * Normaliza descrição para comparação exata:
 * remove acentos, converte para minúsculas e remove todo espaçamento.
 * Assim "SAL REFINADO CISNE 1KG" e "SAL REFINADO CISNE1KG" geram a mesma chave.
 * Não é fuzzy matching: continua sendo igualdade exata entre as chaves
 * normalizadas (regra determinística).
 *
 * ATENÇÃO: como todos os espaços são removidos, descrições DIFERENTES que só
 * diferem na separação das palavras podem gerar a MESMA chave. Por isso toda
 * chave com mais de uma descrição distinta é tratada como COLISÃO e nunca
 * gera correspondência automática (ver `gerarAssinaturaDescricao`).
 */
export const normalizarDescricaoParaComparacao = (
  v: string | null | undefined,
): string => {
  if (!v) return '';
  return String(v)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, '')
    .trim();
};

/**
 * Assinatura da descrição: normaliza acentos e caixa, mas PRESERVA as
 * fronteiras das palavras (espaços consecutivos viram um espaço).
 *
 * Serve para distinguir descrições que são de fato diferentes
 * ("SAL REFINADO CISNE 1KG" x "SAL REFINADO CISNE1KG") mesmo quando a
 * normalização de comparação as reduz à mesma chave.
 */
export const gerarAssinaturaDescricao = (
  v: string | null | undefined,
): string => {
  if (!v) return '';
  return String(v)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
};

/** Normaliza descrição para comparação: remove acentos, minúsculo, remove espaços. */
const normalizarDescricao = (v: string | null | undefined): string =>
  normalizarDescricaoParaComparacao(v);

/** Verifica se um valor numérico é inválido para estoque (nulo, negativo ou fracionário). */
const ehQuantidadeInvalida = (v: number | null | undefined): boolean => {
  if (v === null || v === undefined) return true;
  if (!Number.isFinite(v)) return true;
  if (v < 0) return true;
  if (!Number.isInteger(v)) return true;
  return false;
};

/** Explica por que a quantidade da planilha não pode virar proposta de estoque. */
const motivoQuantidadeInvalida = (v: number | null | undefined): string => {
  if (v === null || v === undefined) {
    return 'Quantidade de estoque ausente na base de referência.';
  }
  if (!Number.isFinite(v)) {
    return 'Quantidade de estoque inválida na base de referência.';
  }
  if (v < 0) {
    return 'Quantidade de estoque negativa na base de referência.';
  }
  return 'Quantidade de estoque fracionária na base de referência.';
};

type ResultadoPagina<T> = {
  data: T[] | null;
  error: { message: string } | null;
  count?: number | null;
};

type ResultadoContagem = {
  count: number | null;
  error: { message: string } | null;
};

/**
 * Lê todas as linhas de uma tabela em páginas explícitas (`range`),
 * contornando o limite de 1.000 linhas do PostgREST.
 *
 * Garantias:
 * - nenhuma linha é perdida entre as páginas;
 * - a ordenação definida pelo chamador é mantida em todas as páginas;
 * - nenhuma escrita é executada (apenas `select`);
 * - a deduplicação NUNCA oculta falha de paginação: registros repetidos e
 *   lacunas (linhas faltantes em relação ao total do servidor) são
 *   detectados e reportados em `RelatorioPaginacao`;
 * - o total da tabela é confirmado com uma consulta de contagem (`head`),
 *   somente leitura, para que a integridade da leitura possa ser auditada.
 */
async function lerTodasAsLinhas<T extends { id?: string | null }>(
  montarConsulta: (
    de: number,
    ate: number,
  ) => PromiseLike<ResultadoPagina<T>>,
  contarTotal: () => PromiseLike<ResultadoContagem>,
  extrairChaveOrdenacao: (linha: T) => number | null,
  mensagemErro: string,
  rotulo: string,
): Promise<{ linhas: T[]; relatorio: RelatorioPaginacao }> {
  // Contagem antes da leitura: se a base mudar durante a leitura, a
  // divergência entre o total e as linhas coletadas é reportada.
  let totalEsperado: number | null = null;
  let erroContagem: string | null = null;
  try {
    const contagem = await contarTotal();
    totalEsperado = typeof contagem.count === 'number' ? contagem.count : null;
    erroContagem = contagem.error ? contagem.error.message : null;
  } catch (erro) {
    erroContagem = erro instanceof Error ? erro.message : 'erro desconhecido';
  }

  const linhas: T[] = [];
  const chaves = new Set<string>();
  const repetidos: string[] = [];
  const repetidosVistos = new Set<string>();
  let repetidosTotal = 0;
  let semIdentificador = 0;
  let paginasLidas = 0;
  let linhasRecebidas = 0;
  let inicio = 0;
  let chaveOrdenacaoAnterior: number | null = null;
  let ordenacaoQuebrada = false;

  for (;;) {
    if (paginasLidas >= MAXIMO_PAGINAS) {
      throw new Error(
        `Leitura paginada de ${rotulo} excedeu o limite de ${MAXIMO_PAGINAS} páginas.`,
      );
    }

    const { data, error } = await montarConsulta(
      inicio,
      inicio + TAMANHO_PAGINA - 1,
    );

    if (error) throw new Error(error.message || mensagemErro);

    const pagina = data ?? [];
    paginasLidas += 1;
    linhasRecebidas += pagina.length;

    for (const linha of pagina) {
      // Ordenação: precisa continuar crescente entre as páginas.
      const chaveOrdenacao = extrairChaveOrdenacao(linha);
      if (chaveOrdenacao !== null && chaveOrdenacaoAnterior !== null) {
        if (chaveOrdenacao < chaveOrdenacaoAnterior) ordenacaoQuebrada = true;
      }
      if (chaveOrdenacao !== null) chaveOrdenacaoAnterior = chaveOrdenacao;

      const identificador = linha?.id ?? null;
      if (identificador === null || identificador === '') {
        // Sem id não há como detectar repetição: mantém a linha e reporta.
        semIdentificador += 1;
        linhas.push(linha);
        continue;
      }

      const chave = `id:${identificador}`;
      if (chaves.has(chave)) {
        // Registro repetido (mesma linha lida em páginas diferentes):
        // a linha duplicada é descartada, mas a OCORRÊNCIA é reportada.
        repetidosTotal += 1;
        if (!repetidosVistos.has(chave) && repetidos.length < MAXIMO_REPETIDOS_LISTADOS) {
          repetidosVistos.add(chave);
          repetidos.push(identificador);
        }
        continue;
      }

      chaves.add(chave);
      linhas.push(linha);
    }

    // Página incompleta (ou vazia): não há mais nada a buscar.
    if (pagina.length < TAMANHO_PAGINA) break;

    inicio += TAMANHO_PAGINA;
  }

  const linhasFaltantes =
    totalEsperado === null ? 0 : Math.max(0, totalEsperado - linhas.length);
  const linhasExcedentes =
    totalEsperado === null ? 0 : Math.max(0, linhas.length - totalEsperado);

  const avisos: string[] = [];

  if (erroContagem) {
    avisos.push(
      `Não foi possível confirmar o total de linhas de ${rotulo} (${erroContagem}). A integridade da paginação não pôde ser verificada.`,
    );
  }
  if (repetidosTotal > 0) {
    const amostra = repetidos.join(', ');
    avisos.push(
      `${rotulo}: ${repetidosTotal} registro(s) repetido(s) lido(s) em páginas diferentes — possível falha de paginação. Identificadores: ${amostra}${
        repetidosTotal > repetidos.length ? '…' : ''
      }.`,
    );
  }
  if (linhasFaltantes > 0) {
    avisos.push(
      `${rotulo}: faltaram ${linhasFaltantes} linha(s) — a paginação não devolveu a base completa (${linhas.length} de ${totalEsperado}).`,
    );
  }
  if (linhasExcedentes > 0) {
    avisos.push(
      `${rotulo}: foram lidas ${linhas.length} linhas, mais que o total do servidor (${totalEsperado}) — a base mudou durante a leitura.`,
    );
  }
  if (ordenacaoQuebrada) {
    avisos.push(
      `${rotulo}: a ordenação não foi preservada entre as páginas (ordem crescente quebrada).`,
    );
  }
  if (semIdentificador > 0) {
    avisos.push(
      `${rotulo}: ${semIdentificador} linha(s) vieram sem identificador (id) — não foi possível detectar repetição nessas linhas.`,
    );
  }

  return {
    linhas,
    relatorio: {
      paginas_lidas: paginasLidas,
      linhas_recebidas: linhasRecebidas,
      linhas_unicas: linhas.length,
      total_esperado: totalEsperado,
      registros_repetidos: repetidos,
      registros_repetidos_total: repetidosTotal,
      registros_sem_identificador: semIdentificador,
      linhas_faltantes: linhasFaltantes,
      ordenacao_quebrada: ordenacaoQuebrada,
      avisos,
    },
  };
}

/**
 * Confirma o total de linhas da base fiscal para o administrador.
 * Somente leitura (`head: true` + `count: 'exact'`), nenhuma escrita.
 */
async function contarReferenciasFiscais(
  adminId: string,
): Promise<ResultadoContagem> {
  const { count, error } = await supabase
    .from('produtos_fiscal_referencia')
    .select('id', { count: 'exact', head: true })
    .eq('administrador_id', adminId);
  return {
    count: typeof count === 'number' ? count : null,
    error: error ? { message: error.message } : null,
  };
}

/**
 * Confirma o total de produtos ativos do administrador.
 * Somente leitura (`head: true` + `count: 'exact'`), nenhuma escrita.
 */
async function contarProdutosCadastrados(
  adminId: string,
): Promise<ResultadoContagem> {
  const { count, error } = await supabase
    .from('produtos_cadastrado')
    .select('id', { count: 'exact', head: true })
    .eq('administrador_id', adminId)
    .eq('ativo', true);
  return {
    count: typeof count === 'number' ? count : null,
    error: error ? { message: error.message } : null,
  };
}

/**
 * Busca TODAS as referências fiscais do administrador, paginando explicitamente.
 * Sem paginação a consulta traria apenas as 1.000 primeiras linhas
 * (limite padrão do PostgREST).
 */
export async function buscarReferenciasFiscais(
  adminId: string,
): Promise<ReferenciaFiscalItem[]> {
  const { linhas } = await buscarReferenciasFiscaisComRelatorio(adminId);
  return linhas;
}

/**
 * Igual a `buscarReferenciasFiscais`, mas devolve também o diagnóstico da
 * paginação (repetições, lacunas, total confirmado pelo servidor).
 */
export async function buscarReferenciasFiscaisComRelatorio(
  adminId: string,
): Promise<{ linhas: ReferenciaFiscalItem[]; relatorio: RelatorioPaginacao }> {
  return lerTodasAsLinhas<ReferenciaFiscalItem>(
    (de, ate) =>
      supabase
        .from('produtos_fiscal_referencia')
        .select('*')
        .eq('administrador_id', adminId)
        .order('linha_origem', { ascending: true })
        .range(de, ate),
    () => contarReferenciasFiscais(adminId),
    (linha) =>
      typeof linha?.linha_origem === 'number' ? linha.linha_origem : null,
    'Erro ao buscar referências fiscais.',
    'Base fiscal de referência',
  );
}

export async function buscarProdutosCadastrados(
  adminId: string,
): Promise<ProdutoCadastrado[]> {
  const { linhas } = await buscarProdutosCadastradosComRelatorio(adminId);
  return linhas;
}

/**
 * Igual a `buscarProdutosCadastrados`, mas devolve também o diagnóstico da
 * paginação (repetições, lacunas, total confirmado pelo servidor).
 */
export async function buscarProdutosCadastradosComRelatorio(
  adminId: string,
): Promise<{ linhas: ProdutoCadastrado[]; relatorio: RelatorioPaginacao }> {
  return lerTodasAsLinhas<ProdutoCadastrado>(
    (de, ate) =>
      supabase
        .from('produtos_cadastrado')
        .select('*')
        .eq('administrador_id', adminId)
        .eq('ativo', true)
        .order('produto_nome')
        .range(de, ate),
    () => contarProdutosCadastrados(adminId),
    // A ordenação por nome depende do collation do banco: não é possível
    // verificar a continuidade da ordem de forma confiável no cliente.
    () => null,
    'Erro ao buscar produtos cadastrados.',
    'Catálogo de produtos',
  );
}

/** Resultado intermediário da etapa de correspondência. */
interface CorrespondenciaPreliminar {
  referencia: ReferenciaFiscalItem;
  produto: ProdutoCadastrado | null;
  tipo: 'encontrada' | 'nao_encontrada' | 'ambigua';
  motivo?: string;
  criterio?: CriterioCorrespondencia;
  colisao: boolean;
}

/**
 * Compara a referência fiscal com o cadastro atual de produtos.
 * Não grava nada no banco; apenas faz leitura e cálculo em memória.
 */
export async function carregarComparacaoFiscal(
  adminId: string,
): Promise<ResultadoComparacaoFiscal> {
  const [referencias, produtos] = await Promise.all([
    buscarReferenciasFiscaisComRelatorio(adminId),
    buscarProdutosCadastradosComRelatorio(adminId),
  ]);

  const listaReferencias = referencias.linhas;
  const listaProdutos = produtos.linhas;

  // Índices para busca rápida
  const porCodigoBarras = new Map<string, ProdutoCadastrado[]>();
  const porCodigo = new Map<string, ProdutoCadastrado[]>();
  const porDescricaoNormalizada = new Map<string, ProdutoCadastrado[]>();
  // Assinaturas (descrições distintas) por chave de comparação: permite
  // detectar colisões provocadas pela remoção de todos os espaços.
  const assinaturasPorChave = new Map<string, Set<string>>();
  const descricoesPorChave = new Map<string, string[]>();

  for (const p of listaProdutos) {
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

      const assinatura = gerarAssinaturaDescricao(p.produto_nome);
      const assinaturas = assinaturasPorChave.get(descNorm) || new Set<string>();
      assinaturas.add(assinatura);
      assinaturasPorChave.set(descNorm, assinaturas);

      const descricoes = descricoesPorChave.get(descNorm) || [];
      if (!descricoes.includes(p.produto_nome)) descricoes.push(p.produto_nome);
      descricoesPorChave.set(descNorm, descricoes);
    }
  }

  /** Chave de comparação que agrupa descrições DISTINTAS (colisão). */
  const chaveEmColisao = (chave: string): boolean =>
    (assinaturasPorChave.get(chave)?.size ?? 0) > 1;

  const listaDescricoesColidentes = (chave: string): string[] =>
    descricoesPorChave.get(chave) ?? [];

  const preliminares: CorrespondenciaPreliminar[] = [];

  for (const ref of listaReferencias) {
    const candidatos: ProdutoCadastrado[] = [];
    let criterio: CriterioCorrespondencia | undefined;
    let colisao = false;
    let chaveDescricaoUsada = '';

    // 1. Código de barras exato
    if (ref.codigo_barras) {
      const c = porCodigoBarras.get(ref.codigo_barras.trim()) || [];
      candidatos.push(...c);
      if (c.length > 0) criterio = 'codigo_barras';
    }

    // 2. Código do produto exato
    if (!candidatos.length && ref.codigo) {
      const c = porCodigo.get(ref.codigo.trim()) || [];
      candidatos.push(...c);
      if (c.length > 0) criterio = 'codigo';
    }

    // 3. Descrição normalizada exata
    if (!candidatos.length && ref.descricao) {
      const dn = normalizarDescricao(ref.descricao);
      if (dn) {
        const c = porDescricaoNormalizada.get(dn) || [];
        candidatos.push(...c);
        if (c.length > 0) {
          criterio = 'descricao';
          chaveDescricaoUsada = dn;
          // Descrições distintas que colidem na mesma chave não podem gerar
          // correspondência automática.
          colisao = chaveEmColisao(dn);
        }
      }
    }

    // Remove duplicados no array de candidatos (mesmo produto pode vir por
    // mais de uma via). A chave usa o `id` quando existe; produtos sem `id`
    // são comparados pela própria referência do objeto para que dois
    // produtos distintos NUNCA sejam fundidos em um só.
    const idsVistos = new Set<string>();
    const objetosVistos = new Set<ProdutoCadastrado>();
    const candidatosUnicos = candidatos.filter((p) => {
      if (typeof p.id === 'string' && p.id.length > 0) {
        if (idsVistos.has(p.id)) return false;
        idsVistos.add(p.id);
        return true;
      }
      if (objetosVistos.has(p)) return false;
      objetosVistos.add(p);
      return true;
    });

    let tipo: 'encontrada' | 'nao_encontrada' | 'ambigua' = 'nao_encontrada';
    let motivo: string | undefined;

    if (candidatosUnicos.length === 0) {
      motivo = 'Produto não encontrado no catálogo.';
    } else if (candidatosUnicos.length > 1) {
      tipo = 'ambigua';
      motivo = colisao
        ? motivoColisaoDescricao(listaDescricoesColidentes(chaveDescricaoUsada))
        : 'Vários produtos correspondem a esta referência.';
    } else if (colisao) {
      tipo = 'ambigua';
      motivo = motivoColisaoDescricao(listaDescricoesColidentes(chaveDescricaoUsada));
    } else {
      tipo = 'encontrada';
    }

    preliminares.push({
      referencia: ref,
      produto: candidatosUnicos[0] ?? null,
      tipo,
      motivo,
      criterio,
      colisao,
    });
  }

  // Colisão entre linhas da base de referência: duas referências com
  // descrições DISTINTAS que apontam (por descrição) para o MESMO produto.
  // Nesses casos não há correspondência automática: as duas linhas ficam
  // ambíguas e não geram proposta de estoque.
  const porProduto = new Map<ProdutoCadastrado, CorrespondenciaPreliminar[]>();
  for (const item of preliminares) {
    if (item.tipo !== 'encontrada') continue;
    if (item.criterio !== 'descricao') continue;
    if (!item.produto) continue;
    const grupo = porProduto.get(item.produto) || [];
    grupo.push(item);
    porProduto.set(item.produto, grupo);
  }

  const colisoesReferencia: string[] = [];

  for (const grupo of porProduto.values()) {
    if (grupo.length < 2) continue;
    const assinaturas = new Set(
      grupo.map((item) => gerarAssinaturaDescricao(item.referencia.descricao)),
    );
    const linhas = grupo.map((item) => `#${item.referencia.linha_origem}`).join(', ');
    if (assinaturas.size < 2) {
      // Mesma descrição apontando para o mesmo produto: duplicata da base
      // (não é colisão de normalização), mas precisa ser reportada porque
      // a mesma quantidade seria somada duas vezes no mesmo produto.
      colisoesReferencia.push(
        `Linhas da base de referência (${linhas}) repetem a mesma descrição e apontam para o mesmo produto.`,
      );
      continue;
    }
    for (const item of grupo) {
      item.tipo = 'ambigua';
      item.colisao = true;
      item.motivo =
        'Outra linha da base de referência com descrição distinta aponta para o mesmo produto. Correspondência automática não aplicada.';
    }
    colisoesReferencia.push(
      `Linhas da base de referência (${linhas}) têm descrições diferentes e apontam para o mesmo produto.`,
    );
  }

  const comparacao: ComparacaoFiscalItem[] = [];

  for (const item of preliminares) {
    const ref = item.referencia;
    const produto = item.produto;
    const ambiguo = item.tipo === 'ambigua';

    // Estoque:
    // - produto não encontrado => estoque_atual = null e estoque_proposto = null
    //   (a quantidade da planilha continua em `quantidade_planilha`);
    // - correspondência ambígua => nenhum estoque é atribuído (não se sabe
    //   qual produto é o correto) e nenhuma proposta é gerada;
    // - produto encontrado com estoque válido =>
    //   estoque_proposto = estoque_atual + quantidade_planilha;
    // - produto encontrado com estoque inválido => estoque_proposto = null
    //   e a referência fica bloqueada por estoque.
    const semProduto = produto === null;
    const estoque_atual: number | null =
      semProduto || ambiguo ? null : (produto.qtd_estoque ?? null);
    const quantidade_planilha: number | null = ref.estoque ?? null;
    const invalidaPlanilha = ehQuantidadeInvalida(ref.estoque);
    const invalidaAtual = semProduto || ambiguo ? false : ehQuantidadeInvalida(produto.qtd_estoque);
    // Somente produto encontrado no catálogo pode ficar bloqueado por estoque.
    const estoque_invalido = !semProduto && !ambiguo && (invalidaPlanilha || invalidaAtual);
    const estoque_proposto =
      semProduto || ambiguo || estoque_invalido
        ? null
        : (estoque_atual ?? 0) + (quantidade_planilha ?? 0);
    const estoque_motivo = invalidaPlanilha
      ? motivoQuantidadeInvalida(ref.estoque)
      : invalidaAtual
        ? 'Estoque atual do produto cadastrado é inválido.'
        : undefined;

    // Diferenças fiscais
    const diferencas: {
      campo: string;
      valor_atual: string | number | null;
      valor_referencia: string | number | null;
    }[] = [];

    if (produto) {
      const pares: [string, string | number | null, string | number | null][] = [
        ['NCM', produto.ncm ?? null, ref.ncm ?? null],
        ['CEST', produto.cest ?? null, ref.cest ?? null],
        ['CFOP', produto.cfop_padrao ?? null, ref.nfe_cfop ?? ref.cfop_padrao ?? null],
        ['CST ICMS', produto.cst_icms ?? null, ref.cst_icms ?? null],
        ['Alíquota ICMS', produto.aliquota_icms ?? null, ref.aliquota_icms ?? null],
        ['CST PIS', produto.cst_pis ?? null, ref.cst_pis ?? null],
        ['Alíquota PIS', produto.aliquota_pis ?? null, ref.aliquota_pis ?? null],
        ['CST COFINS', produto.cst_cofins ?? null, ref.cst_cofins ?? null],
        ['Alíquota COFINS', produto.aliquota_cofins ?? null, ref.aliquota_cofins ?? null],
      ];

      for (const [nome, atual, referencia] of pares) {
        // A base de referência é a fonte da auditoria: quando ela não traz o campo,
        // não há o que comparar (evita divergência falsa).
        if (referencia === null) continue;
        if (atual !== referencia) {
          diferencas.push({ campo: nome, valor_atual: atual, valor_referencia: referencia });
        }
      }
    }

    // Descrição da referência x descrição do cadastro
    const descricaoReferencia = normalizarDescricao(ref.descricao);
    const divergencia_descricao =
      item.tipo === 'encontrada' &&
      produto !== null &&
      descricaoReferencia !== '' &&
      descricaoReferencia !== normalizarDescricao(produto.produto_nome);

    comparacao.push({
      referencia: ref,
      produto: produto,
      tipo: item.tipo,
      motivo: item.motivo,
      criterio_correspondencia: item.criterio,
      colisao_descricao: item.colisao || undefined,
      estoque_atual,
      quantidade_planilha,
      estoque_proposto,
      estoque_invalido,
      estoque_motivo,
      divergencia_descricao,
      diferencas_fiscais: diferencas,
    });
  }

  // Contadores de resumo
  const totalCorrespondencias = comparacao.filter((c) => c.tipo === 'encontrada').length;
  const totalNovos = comparacao.filter((c) => c.tipo === 'nao_encontrada').length;
  const totalDivergencias = comparacao.filter(
    (c) => c.tipo === 'encontrada' && c.diferencas_fiscais.length > 0,
  ).length;
  // Bloqueio por estoque: somente produto ENCONTRADO no catálogo com
  // quantidade de referência/estoque atual inválida (sem proposta automática).
  // Referências "não encontrada" ficam na categoria de novos produtos.
  const totalBloqueados = comparacao.filter((c) => c.estoque_invalido).length;
  const totalDuplicados = comparacao.filter(
    (c) => c.tipo === 'ambigua',
  ).length;
  const totalColisoes = comparacao.filter((c) => c.colisao_descricao).length;

  const avisos: string[] = [
    ...referencias.relatorio.avisos,
    ...produtos.relatorio.avisos,
    ...colisoesReferencia,
  ];
  if (totalColisoes > 0) {
    avisos.push(
      `${totalColisoes} referência(s) ficaram sem correspondência automática por colisão de descrições distintas.`,
    );
  }

  return {
    referencia: listaReferencias,
    produtos: listaProdutos,
    comparacao,
    resumo: {
      total_referencias: listaReferencias.length,
      total_produtos_cadastrados: listaProdutos.length,
      total_correspondencias: totalCorrespondencias,
      total_novos_produtos: totalNovos,
      total_divergencias_fiscais: totalDivergencias,
      total_bloqueados: totalBloqueados,
      total_duplicados: totalDuplicados,
      total_colisoes_descricao: totalColisoes,
    },
    paginacao: {
      referencias: referencias.relatorio,
      produtos: produtos.relatorio,
    },
    avisos,
  };
}

/** Motivo exibido quando duas descrições distintas colidem na normalização. */
function motivoColisaoDescricao(descricoes: string[]): string {
  const lista =
    descricoes.length > 0 ? descricoes.join(' x ') : 'descrições distintas';
  return `Descrições distintas colidem na normalização (${lista}). Correspondência automática não aplicada.`;
}

/**
 * Verifica se uma quantidade é inválida para estoque (nulo, negativo ou fracionado).
 * Exposto para uso em testes.
 */
export function ehQuantidadeInvalidaParaEstoque(
  valor: number | null | undefined,
): boolean {
  return ehQuantidadeInvalida(valor);
}
