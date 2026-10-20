// src/services/importacaoFiscalReferenciaService.ts
// Importação TEMPORÁRIA e ISOLADA da base histórica TMP_PROD.ods para a tabela
// public.produtos_fiscal_referencia via RPC segura `importar_produtos_fiscal_referencia`.
// Esta tabela representa SOMENTE referência histórica para comparação fiscal.
// NUNCA grava em produtos_cadastrado nem altera NCM, CEST, CFOP, CST, estoque,
// preço ou qualquer dado fiscal dos produtos atuais.
// Não chama definir_status_fiscal_produto nem altera fiscal_status.
import { supabase } from '@/lib/supabase';
import * as XLSX from 'xlsx-js-style';

const FUNCAO_RPC = 'importar_produtos_fiscal_referencia';
const TAMANHO_LOTE = 100;

export interface ItemFiscalReferenciaInput {
  linha_origem: number;
  codigo: string | null;
  codigo_barras: string | null;
  descricao: string | null;
  ncm: string | null;
  cst_pis: string | null;
  aliquota_pis: number | null;
  cst_pis_saida: string | null;
  aliquota_pis_saida: number | null;
  cst_cofins: string | null;
  aliquota_cofins: number | null;
  cst_cofins_saida: string | null;
  aliquota_cofins_saida: number | null;
  cst_icms: string | null;
  aliquota_icms: number | null;
  cfop_descricao: string | null;
  kit: boolean | null;
  custo_compra: number | null;
  estoque: number | null;
  valor_estoque: number | null;
  custo: number | null;
  preco1: number | null;
  cest: string | null;
}

export interface ImportacaoFiscalReferenciaResponse {
  success: boolean;
  processados?: number;
  aceitos?: number;
  message?: string;
  error?: string;
  [key: string]: unknown;
}

export interface ImportacaoResumo {
  lidos: number;
  enviados: number;
  aceitos: number;
  erros: string[];
}

// Mapeamento de colunas do arquivo TMP_PROD.ods -> colunas da tabela
// produtos_fiscal_referencia.
const MAPEAMENTO_COLUNAS: Record<string, keyof ItemFiscalReferenciaInput> = {
  codigo: 'codigo',
  codbar: 'codigo_barras',
  descpro: 'descricao',
  ncm: 'ncm',
  cstpise: 'cst_pis',
  alipise: 'aliquota_pis',
  cstpis: 'cst_pis_saida',
  alipis: 'aliquota_pis_saida',
  cstcofinse: 'cst_cofins',
  alicofinse: 'aliquota_cofins',
  cstcofins: 'cst_cofins_saida',
  alicofins: 'aliquota_cofins_saida',
  cst: 'cst_icms',
  aliicms: 'aliquota_icms',
  desccfop: 'cfop_descricao',
  kit: 'kit',
  custocom: 'custo_compra',
  estoque: 'estoque',
  valor_estoque: 'valor_estoque',
  custo: 'custo',
  preco1: 'preco1',
  cest: 'cest',
};

// Colunas numericas. Codigo de barras (codigo_barras) fica de fora propositalmente:
// permanece como TEXTO para preservar zeros a esquerda. Nunca converter para numero.
const COLUNAS_NUMERICAS = new Set([
  'aliquota_pis',
  'aliquota_pis_saida',
  'aliquota_cofins',
  'aliquota_cofins_saida',
  'aliquota_icms',
  'custo_compra',
  'estoque',
  'valor_estoque',
  'custo',
  'preco1',
]);

const COLUNA_TEXTO = 'codigo_barras';

function normalizarTexto(valor: unknown): string | null {
  if (valor === null || valor === undefined) return null;
  const texto = String(valor).trim();
  return texto === '' ? null : texto;
}

function normalizarNumero(valor: unknown): number | null {
  if (valor === null || valor === undefined) return null;
  if (typeof valor === 'boolean') return null;
  if (typeof valor === 'number') return Number.isFinite(valor) ? valor : null;
  const texto = String(valor).trim();
  if (texto === '') return null;
  const numero = Number(texto);
  return Number.isFinite(numero) ? numero : null;
}

function normalizarBooleano(valor: unknown): boolean | null {
  if (valor === null || valor === undefined) return null;
  if (typeof valor === 'boolean') return valor;
  if (typeof valor === 'number') return valor !== 0;
  const texto = String(valor).trim().toLowerCase();
  if (texto === '') return null;
  return texto === '1' || texto === 'true' || texto === 'sim' || texto === 's';
}

function lerArquivoOds(arquivo: File): Promise<ItemFiscalReferenciaInput[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Não foi possível ler o arquivo.'));
    reader.onload = () => {
      try {
        const resultado = reader.result as ArrayBuffer;
        const workbook = XLSX.read(resultado, { type: 'array' });
        const primeiraAba = workbook.SheetNames[0];
        if (!primeiraAba) {
          throw new Error('Arquivo não contém nenhuma planilha.');
        }
        const worksheet = workbook.Sheets[primeiraAba];
        // header: 1 -> primeira linha é o cabeçalho, dados vêm como arrays
        const linhas = XLSX.utils.sheet_to_json(worksheet, {
          header: 1,
          raw: true,
        }) as unknown[][];

        if (!linhas || linhas.length < 2) {
          resolve([]);
          return;
        }

        const cabecalho = linhas[0] as unknown[];
        const itens: ItemFiscalReferenciaInput[] = [];

        for (let i = 1; i < linhas.length; i++) {
          const linha = linhas[i] as unknown[];
          if (
            !linha ||
            linha.every((c) => c === null || c === undefined || c === '')
          ) {
            continue; // ignora linha em branco
          }

          const item: ItemFiscalReferenciaInput = { linha_origem: i + 1 };

          for (let j = 0; j < cabecalho.length; j++) {
            const nomeColuna = String(cabecalho[j] ?? '').trim().toLowerCase();
            const campo = MAPEAMENTO_COLUNAS[nomeColuna];
            if (!campo) continue;

            const valorBruto = linha[j];
            if (campo === COLUNA_TEXTO) {
              // Código de barras: texto puro, preserva zeros a esquerda.
              // Nunca converter para número.
              item[campo] = normalizarTexto(valorBruto);
            } else if (COLUNAS_NUMERICAS.has(campo)) {
              item[campo] = normalizarNumero(valorBruto);
            } else if (campo === 'kit') {
              item[campo] = normalizarBooleano(valorBruto);
            } else {
              item[campo] = normalizarTexto(valorBruto);
            }
          }

          itens.push(item);
        }

        resolve(itens);
      } catch (err) {
        reject(err instanceof Error ? err : new Error('Erro ao ler arquivo.'));
      }
    };
    reader.readAsArrayBuffer(arquivo);
  });
}

async function enviarLote(
  itens: ItemFiscalReferenciaInput[],
): Promise<ImportacaoFiscalReferenciaResponse> {
  const { data, error } = await supabase.rpc(FUNCAO_RPC, {
    p_rows: itens,
  });

  if (error) {
    throw new Error(error.message || 'Erro ao importar referência fiscal.');
  }

  // A RPC retorna um integer (quantidade de linhas processadas).
  const aceitos = typeof data === 'number' ? data : 0;
  return {
    success: true,
    aceitos,
  } as ImportacaoFiscalReferenciaResponse;
}

/**
 * Importa o arquivo TMP_PROD.ods para produtos_fiscal_referencia em lotes.
 * Retorna um resumo com lidos/enviados/aceitos/erros.
 */
export async function importarReferenciaFiscal(
  arquivo: File,
): Promise<ImportacaoResumo> {
  const itens = await lerArquivoOds(arquivo);
  const lidos = itens.length;

  const erros: string[] = [];
  let enviados = 0;
  let aceitos = 0;

  // Envio em lotes para evitar chamada gigantesca.
  for (let i = 0; i < itens.length; i += TAMANHO_LOTE) {
    const lote = itens.slice(i, i + TAMANHO_LOTE);
    const numeroLote = Math.floor(i / TAMANHO_LOTE) + 1;

    try {
      const resposta = await enviarLote(lote);
      enviados += lote.length;
      aceitos += Number(
        resposta.aceitos ?? resposta.processados ?? lote.length,
      );

      if (!resposta.success && resposta.message) {
        erros.push(`Lote ${numeroLote}: ${resposta.message}`);
      }
    } catch (err) {
      const mensagem =
        err instanceof Error ? err.message : 'Erro desconhecido no lote';
      erros.push(`Lote ${numeroLote}: ${mensagem}`);
    }
  }

  return { lidos, enviados, aceitos, erros };
}
