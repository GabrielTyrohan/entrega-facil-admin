// Ajuda a achar o NCM pelo nome do produto (busca na tabela oficial via função pesquisar-ncm).

const PALAVRAS_LIGACAO = new Set(['de', 'da', 'do', 'das', 'dos', 'com', 'sem', 'em', 'e', 'para', 'p', 'c']);
// Palavras que atrapalham a busca: embalagem, peso, tipo e marketing.
const RUIDO =
  /^(\d+([.,]\d+)?(kg|g|gr|mg|l|lt|ml|un|und|unid)?|kg|g|gr|ml|l|lt|un|und|unid|pacote|pct|pc|caixa|cx|lata|garrafa|frasco|sache|sachê|premium|tradicional|tipo|tp|fardo|embalagem|emb|refil|zero|light|diet|integral|novo|nova)$/i;

/**
 * Termos para tentar, do mais específico ao mais geral.
 * Ex.: "Pão De Forma Panco Premium Pacote 500g" → ["pão de forma panco", "pão de forma", "pão"]
 */
export function termosParaNCM(nome: string): string[] {
  const palavras = nome
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((p) => p && !RUIDO.test(p));
  const termos: string[] = [];
  for (let n = Math.min(4, palavras.length); n >= 1; n--) {
    const parte = palavras.slice(0, n);
    // Não termina em "de", "com"…
    while (parte.length && PALAVRAS_LIGACAO.has(parte[parte.length - 1])) parte.pop();
    const termo = parte.join(' ');
    if (termo.length >= 3 && !termos.includes(termo)) termos.push(termo);
  }
  return termos;
}

export interface NcmSugestao {
  codigo: string; // 8 dígitos, sem pontos
  descricao: string;
}

/** Só NCM completo (8 dígitos) e descrição sem HTML da tabela oficial. */
export function filtrarNcmCompletos(lista: { codigo: string; descricao: string }[]): NcmSugestao[] {
  const vistos = new Set<string>();
  const saida: NcmSugestao[] = [];
  for (const item of lista ?? []) {
    const codigo = String(item.codigo ?? '').replace(/\D/g, '');
    if (codigo.length !== 8 || vistos.has(codigo)) continue;
    vistos.add(codigo);
    const descricao = String(item.descricao ?? '')
      .replace(/<[^>]+>/g, '')
      .replace(/^[-\s]+/, '')
      .trim();
    saida.push({ codigo, descricao });
  }
  return saida;
}

export const formatarNcm = (c: string) => (c.length === 8 ? `${c.slice(0, 4)}.${c.slice(4, 6)}.${c.slice(6)}` : c);
