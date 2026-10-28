// src/services/importacaoFiscalLoteService.ts
// Integração com a RPC segura de importação fiscal em lote.
//
// Regras deste serviço:
// - a ÚNICA operação de escrita/validação é a RPC
//   `importar_produtos_fiscal_lote_seguro`;
// - nenhuma tabela é acessada diretamente;
// - o payload de cada item contém somente referencia_id, categoria,
//   unidade_medida, ativo e confirmar_descricao_duplicada;
// - nenhum dado fiscal, preço, custo, estoque, código ou identificador de
//   autoridade (administrador/usuário) é enviado pelo frontend;
// - a resposta da RPC é lida de forma defensiva, pois o JSON pode variar sem
//   exigir uma alteração de contrato no cliente.
import { supabase } from '@/lib/supabase';

export const RPC_IMPORTACAO_FISCAL_LOTE =
  'importar_produtos_fiscal_lote_seguro';

/** A RPC aceita lotes de 1 a 100 itens. */
export const LIMITE_ITENS_IMPORTACAO_FISCAL = 100;

/**
 * Unidades comerciais aceitas pela RPC.
 * A unidade NUNCA é inferida pela descrição: é uma escolha explícita.
 */
export const UNIDADES_MEDIDA_IMPORTACAO_FISCAL = [
  'UN',
  'KG',
  'G',
  'MG',
  'L',
  'ML',
  'CX',
  'PCT',
  'FD',
  'SC',
  'PAR',
  'DZ',
  'BDJ',
  'LT',
  'M',
  'MT',
  'RL',
  'ROLO',
  'TB',
  'GL',
  'PC',
  'MIL',
  'KIT',
  'FR',
  'BIS',
  'AMP',
  'BL',
  'FARDO',
] as const;

export type UnidadeMedidaImportacaoFiscal =
  (typeof UNIDADES_MEDIDA_IMPORTACAO_FISCAL)[number];

export type ModoImportacaoFiscalLote = 'validar' | 'gravar';

/** Escolhas comerciais feitas pelo usuário para um candidato. */
export interface EscolhaComercialImportacaoFiscal {
  categoria: string;
  unidade_medida: string;
  /** Sempre booleano. Inativo (`false`) é o valor inicial recomendado. */
  ativo: boolean;
  /** Inicialmente falso; o usuário confirma apenas quando necessário. */
  confirmar_descricao_duplicada: boolean;
}

/** Payload exato aceito pela RPC para cada referência. */
export interface ItemImportacaoFiscalLote {
  referencia_id: string;
  categoria: string;
  unidade_medida: string;
  ativo: boolean;
  confirmar_descricao_duplicada: boolean;
}

export interface ItemRespostaImportacaoFiscal {
  referenciaId: string | null;
  produtoId: string | null;
  descricao: string | null;
  sucesso: boolean | null;
  bloqueado: boolean;
  avisos: string[];
  erros: string[];
  bruto: Record<string, unknown>;
}

/**
 * Resposta normalizada da RPC.
 *
 * `sucesso` reflete SOMENTE confirmação explícita do servidor. `podeGravar`
 * também exige `pode_gravar === true`; qualquer ausência mantém a confirmação
 * bloqueada.
 */
export interface RespostaImportacaoFiscalLote {
  modo: ModoImportacaoFiscalLote;
  sucesso: boolean;
  podeGravar: boolean;
  repeticaoIdempotente: boolean;
  importacaoId: string | null;
  totalCriados: number;
  totalValidos: number;
  totalBloqueados: number;
  totalAvisos: number;
  itens: ItemRespostaImportacaoFiscal[];
  avisos: string[];
  erros: string[];
  mensagem: string | null;
  bruto: Record<string, unknown>;
}

type Registro = Record<string, unknown>;

const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function criarEscolhaComercialInicial(): EscolhaComercialImportacaoFiscal {
  return {
    categoria: '',
    unidade_medida: '',
    // Inativo é o valor inicial recomendado para o piloto. O campo continua
    // explícito no payload e pode ser alterado antes da confirmação.
    ativo: false,
    confirmar_descricao_duplicada: false,
  };
}

export function ehUnidadeMedidaImportacaoFiscal(
  valor: string,
): valor is UnidadeMedidaImportacaoFiscal {
  return (UNIDADES_MEDIDA_IMPORTACAO_FISCAL as readonly string[]).includes(
    valor,
  );
}

/**
 * Valida as escolhas comerciais no cliente. O servidor continua sendo a
 * autoridade final; esta função apenas evita enviar um lote obviamente
 * incompleto.
 */
export function validarEscolhaComercialImportacao(
  escolha: EscolhaComercialImportacaoFiscal,
): string[] {
  const problemas: string[] = [];

  if (!escolha.categoria || !escolha.categoria.trim()) {
    problemas.push('Informe a categoria comercial.');
  }

  if (!escolha.unidade_medida) {
    problemas.push('Selecione a unidade comercial.');
  } else if (!ehUnidadeMedidaImportacaoFiscal(escolha.unidade_medida)) {
    problemas.push('Selecione uma unidade comercial válida.');
  }

  if (typeof escolha.ativo !== 'boolean') {
    problemas.push('Defina explicitamente se o produto ficará ativo ou inativo.');
  }

  return problemas;
}

/** Monta um item com os únicos campos permitidos pela RPC. */
export function montarItemImportacaoFiscal(
  referenciaId: string,
  escolha: EscolhaComercialImportacaoFiscal,
): ItemImportacaoFiscalLote {
  return {
    referencia_id: referenciaId,
    categoria: escolha.categoria.trim(),
    unidade_medida: escolha.unidade_medida.trim(),
    ativo: escolha.ativo,
    confirmar_descricao_duplicada:
      escolha.confirmar_descricao_duplicada === true,
  };
}

/** Gera a chave UUID usada para tornar a gravação idempotente. */
export function gerarChaveIdempotenciaImportacaoFiscal(): string {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi && typeof cryptoApi.randomUUID === 'function') {
    return cryptoApi.randomUUID();
  }

  const bytes = new Uint8Array(16);
  if (cryptoApi && typeof cryptoApi.getRandomValues === 'function') {
    cryptoApi.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(
    16,
    20,
  )}-${hex.slice(20)}`;
}

function ehRegistro(valor: unknown): valor is Registro {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}

function texto(valor: unknown): string | null {
  if (typeof valor !== 'string') return null;
  const normalizado = valor.trim();
  return normalizado ? normalizado : null;
}

function textoDe(registro: Registro, chaves: string[]): string | null {
  for (const chave of chaves) {
    const valor = texto(registro[chave]);
    if (valor) return valor;
  }
  return null;
}

function numeroDe(registro: Registro, chaves: string[]): number | null {
  for (const chave of chaves) {
    const valor = registro[chave];
    if (typeof valor === 'number' && Number.isFinite(valor)) return valor;
    if (typeof valor === 'string' && valor.trim() !== '') {
      const numero = Number(valor);
      if (Number.isFinite(numero)) return numero;
    }
  }
  return null;
}

function booleanoDe(registro: Registro, chaves: string[]): boolean | null {
  for (const chave of chaves) {
    const valor = registro[chave];
    if (typeof valor === 'boolean') return valor;
  }
  return null;
}

function textosDe(registro: Registro, chaves: string[]): string[] {
  const mensagens: string[] = [];

  const adicionar = (valor: unknown): void => {
    if (valor === null || valor === undefined) return;
    if (typeof valor === 'string') {
      const normalizado = valor.trim();
      if (normalizado) mensagens.push(normalizado);
      return;
    }
    if (Array.isArray(valor)) {
      for (const item of valor) adicionar(item);
      return;
    }
    if (ehRegistro(valor)) {
      const mensagem = textoDe(valor, [
        'mensagem',
        'message',
        'motivo',
        'erro',
        'error',
        'descricao',
        'aviso',
      ]);
      if (mensagem) mensagens.push(mensagem);
    }
  };

  for (const chave of chaves) adicionar(registro[chave]);

  return Array.from(new Set(mensagens));
}

function extrairItensResposta(valor: unknown): Registro[] {
  if (Array.isArray(valor)) {
    return valor.filter(ehRegistro);
  }
  if (ehRegistro(valor)) {
    return Object.entries(valor).map(([chave, item]) => {
      if (!ehRegistro(item)) return { referencia_id: chave };
      return { referencia_id: chave, ...item };
    });
  }
  return [];
}

function normalizarItemResposta(
  item: Registro,
  indice: number,
): ItemRespostaImportacaoFiscal {
  const produto = ehRegistro(item.produto) ? item.produto : null;

  const referenciaId =
    textoDe(item, [
      'referencia_id',
      'referenciaId',
      'id_referencia',
      'referencia_fiscal_id',
    ]) ??
    (produto
      ? textoDe(produto, ['referencia_id', 'referenciaId', 'id_referencia'])
      : null);

  const produtoId =
    textoDe(item, [
      'produto_id',
      'produto_cadastrado_id',
      'id_produto',
      'produtoId',
      'idProduto',
    ]) ??
    (produto
      ? textoDe(produto, ['id', 'produto_id', 'produto_cadastrado_id'])
      : null) ??
    // Em algumas respostas o `id` do item é o ID do produto criado. Só o
    // usamos quando a referência também está identificada, evitando confundir
    // o ID da referência com o ID do produto.
    (referenciaId ? textoDe(item, ['id']) : null);

  const descricao =
    textoDe(item, [
      'descricao',
      'descrição',
      'produto_nome',
      'nome_produto',
      'nome',
      'descricao_referencia',
    ]) ??
    (produto
      ? textoDe(produto, ['produto_nome', 'nome', 'descricao'])
      : null);

  const erros = textosDe(item, [
    'erro',
    'erros',
    'error',
    'errors',
    'motivo',
    'motivos',
    'mensagem_erro',
    'mensagens_erro',
    'detalhes',
    'detalhe',
  ]);

  const avisos = textosDe(item, [
    'aviso',
    'avisos',
    'warning',
    'warnings',
    'alerta',
    'alertas',
    'advertencia',
    'advertencias',
  ]);

  const status = (
    textoDe(item, ['status', 'situacao', 'resultado']) ?? ''
  ).toLowerCase();

  const sucesso = booleanoDe(item, ['sucesso', 'success']);
  // `bloqueado: true` e `pode_gravar/valido: false` são indicadores de
  // bloqueio. `bloqueado: false` não bloqueia; por isso os campos são lidos
  // separadamente.
  const bloqueioExplicito =
    booleanoDe(item, ['bloqueado']) === true ||
    booleanoDe(item, ['pode_gravar', 'podeGravar', 'valido']) === false;

  const bloqueado =
    erros.length > 0 ||
    bloqueioExplicito ||
    (sucesso !== null && sucesso === false) ||
    /(bloq|erro|invalid|rejeit|falh)/.test(status);

  return {
    referenciaId,
    produtoId,
    descricao:
      descricao ?? `Item ${indice + 1} da resposta da RPC (sem descrição)`,
    sucesso,
    bloqueado,
    avisos,
    erros:
      erros.length > 0
        ? erros
        : bloqueado
          ? ['Item rejeitado pela validação do servidor.']
          : [],
    bruto: item,
  };
}

/**
 * Normaliza o JSON da RPC. Campos desconhecidos são preservados em `bruto`,
 * mas nunca viram sucesso por inferência: `sucesso` e `podeGravar` só são
 * verdadeiros quando o servidor devolve o booleano correspondente.
 */
export function normalizarRespostaImportacaoFiscal(
  data: unknown,
  modo: ModoImportacaoFiscalLote,
): RespostaImportacaoFiscalLote {
  let resposta = data;
  if (typeof resposta === 'string') {
    try {
      resposta = JSON.parse(resposta) as unknown;
    } catch {
      throw new Error(
        'A RPC retornou uma resposta inconclusiva (JSON inválido). A gravação não foi confirmada.',
      );
    }
  }

  if (!ehRegistro(resposta)) {
    throw new Error(
      'A RPC retornou uma resposta inconclusiva. A gravação não foi confirmada.',
    );
  }

  const bruto = resposta;
  const itensBrutos = extrairItensResposta(
    bruto.itens ?? bruto.resultados ?? bruto.produtos,
  );
  const itens = itensBrutos.map(normalizarItemResposta);

  const avisos = textosDe(bruto, [
    'avisos',
    'warnings',
    'alertas',
    'advertencias',
  ]);
  const erros = textosDe(bruto, ['erros', 'errors']);
  const mensagem = textoDe(bruto, [
    'mensagem',
    'message',
    'erro',
    'error',
    'detalhe',
  ]);

  const totalValidos =
    numeroDe(bruto, [
      'total_validos',
      'totalValidos',
      'validos',
      'total_aceitos',
      'aceitos',
    ]) ?? itens.filter((item) => !item.bloqueado).length;

  const totalBloqueados =
    numeroDe(bruto, [
      'total_bloqueados',
      'totalBloqueados',
      'bloqueados',
      'total_rejeitados',
      'rejeitados',
    ]) ?? itens.filter((item) => item.bloqueado).length;

  const totalAvisos =
    numeroDe(bruto, ['total_avisos', 'totalAvisos', 'avisos_total']) ??
    (avisos.length > 0
      ? avisos.length
      : itens.reduce((total, item) => total + item.avisos.length, 0));

  const totalCriados =
    numeroDe(bruto, [
      'total_criados',
      'totalCriados',
      'criados',
      'produtos_criados',
    ]) ??
    (modo === 'gravar'
      ? itens.filter(
          (item) => item.sucesso === true || item.produtoId !== null,
        ).length
      : 0);

  return {
    modo,
    sucesso:
      booleanoDe(bruto, ['sucesso', 'success']) === true,
    podeGravar:
      booleanoDe(bruto, ['pode_gravar', 'podeGravar']) === true,
    repeticaoIdempotente:
      booleanoDe(bruto, [
        'repeticao_idempotente',
        'repeticaoIdempotente',
      ]) === true,
    importacaoId: textoDe(bruto, [
      'importacao_id',
      'importacaoId',
      'id_importacao',
      'lote_id',
    ]),
    totalCriados,
    totalValidos,
    totalBloqueados,
    totalAvisos,
    itens,
    avisos,
    erros,
    mensagem,
    bruto,
  };
}

export interface ChamarImportacaoFiscalLoteInput {
  modo: ModoImportacaoFiscalLote;
  itens: ItemImportacaoFiscalLote[];
  idempotencyKey?: string | null;
}

/**
 * Executa exclusivamente a RPC segura.
 *
 * - `validar` envia `p_idempotency_key: null` e não grava;
 * - `gravar` exige uma chave UUID e a reutiliza em retries da mesma operação;
 * - o payload é reconstruído campo a campo para impedir campos extras.
 */
export async function chamarImportacaoFiscalLote(
  input: ChamarImportacaoFiscalLoteInput,
): Promise<RespostaImportacaoFiscalLote> {
  const { modo, itens } = input;

  if (itens.length < 1) {
    throw new Error('Selecione ao menos um candidato para a importação.');
  }
  if (itens.length > LIMITE_ITENS_IMPORTACAO_FISCAL) {
    throw new Error(
      `A RPC aceita no máximo ${LIMITE_ITENS_IMPORTACAO_FISCAL} itens por lote.`,
    );
  }

  const itensSanitizados = itens.map((item) => {
    const problemas = validarEscolhaComercialImportacao({
      categoria: item.categoria,
      unidade_medida: item.unidade_medida,
      ativo: item.ativo,
      confirmar_descricao_duplicada: item.confirmar_descricao_duplicada,
    });
    if (!item.referencia_id || !item.referencia_id.trim()) {
      problemas.unshift('Referência fiscal não informada.');
    }
    if (problemas.length > 0) {
      throw new Error(`Item inválido: ${problemas.join(' ')}`);
    }

    return {
      referencia_id: item.referencia_id,
      categoria: item.categoria.trim(),
      unidade_medida: item.unidade_medida.trim(),
      ativo: item.ativo,
      confirmar_descricao_duplicada:
        item.confirmar_descricao_duplicada === true,
    };
  });

  let chave: string | null = null;
  if (modo === 'gravar') {
    chave = input.idempotencyKey ?? null;
    if (!chave || !UUID_V4.test(chave)) {
      throw new Error(
        'Chave de idempotência inválida. A importação não foi enviada.',
      );
    }
  }

  const { data, error } = await supabase.rpc(RPC_IMPORTACAO_FISCAL_LOTE, {
    // No modo validar não há gravação nem chave de idempotência.
    p_idempotency_key: modo === 'validar' ? null : chave,
    p_modo: modo,
    p_itens: itensSanitizados,
  });

  if (error) {
    throw new Error(
      error.message || 'Não foi possível concluir a operação na RPC fiscal.',
    );
  }

  return normalizarRespostaImportacaoFiscal(data, modo);
}
