// Lê o XML de uma NF-e de compra (nota que o mercado emite para a empresa)
// e devolve fornecedor, dados da nota e itens. Roda no navegador (DOMParser),
// nada é enviado para fora: só o resultado vai para registrar_compra.

export interface ItemNotaCompra {
  numero: number;
  codigo_fornecedor: string;
  ean: string | null;
  descricao: string;
  ncm: string | null;
  unidade: string;
  quantidade: number;
  valor_unitario: number;
  valor_total: number;
}

export interface NotaCompra {
  chave_acesso: string | null;
  numero_nota: string | null;
  serie: string | null;
  data_emissao: string | null; // YYYY-MM-DD
  fornecedor_nome: string;
  fornecedor_cnpj: string | null;
  destinatario_documento: string | null;
  valor_total: number;
  itens: ItemNotaCompra[];
}

/** Busca o primeiro filho com o nome local informado (ignora namespace). */
function filho(el: Element | Document | null, nome: string): Element | null {
  if (!el) return null;
  const lista = el.getElementsByTagNameNS('*', nome);
  return lista.length > 0 ? lista[0] : null;
}

function texto(el: Element | Document | null, nome: string): string | null {
  const v = filho(el, nome)?.textContent?.trim();
  return v ? v : null;
}

function numero(v: string | null): number {
  const n = Number((v ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

/** EAN válido (GTIN-8/12/13/14); "SEM GTIN" e vazios viram null. */
function eanValido(v: string | null): string | null {
  const s = (v ?? '').replace(/\D/g, '');
  return [8, 12, 13, 14].includes(s.length) ? s : null;
}

export function lerXmlNfeCompra(xml: string): NotaCompra {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length > 0) {
    throw new Error('Arquivo não é um XML válido.');
  }

  const infNFe = filho(doc, 'infNFe');
  if (!infNFe) {
    throw new Error('O arquivo não parece ser o XML de uma NF-e (falta infNFe).');
  }

  const ide = filho(infNFe, 'ide');
  const emit = filho(infNFe, 'emit');
  const dest = filho(infNFe, 'dest');
  const total = filho(infNFe, 'ICMSTot');

  const idAttr = infNFe.getAttribute('Id') ?? '';
  const chaveId = idAttr.replace(/\D/g, '');
  const chaveProt = (texto(doc, 'chNFe') ?? '').replace(/\D/g, '');
  const chave = chaveProt.length === 44 ? chaveProt : chaveId.length === 44 ? chaveId : null;

  const dataRaw = texto(ide, 'dhEmi') ?? texto(ide, 'dEmi');

  const fornecedor = texto(emit, 'xNome');
  if (!fornecedor) throw new Error('Não encontrei o nome do fornecedor (emitente) na nota.');

  const dets = Array.from(infNFe.getElementsByTagNameNS('*', 'det'));
  const itens: ItemNotaCompra[] = dets.map((det, idx) => {
    const prod = filho(det, 'prod');
    const qCom = numero(texto(prod, 'qCom'));
    const vProd = numero(texto(prod, 'vProd'));
    const vDesc = numero(texto(prod, 'vDesc'));
    return {
      numero: Number(det.getAttribute('nItem')) || idx + 1,
      codigo_fornecedor: texto(prod, 'cProd') ?? '',
      ean: eanValido(texto(prod, 'cEAN')) ?? eanValido(texto(prod, 'cEANTrib')),
      descricao: texto(prod, 'xProd') ?? '',
      ncm: texto(prod, 'NCM'),
      unidade: (texto(prod, 'uCom') ?? 'UN').toUpperCase(),
      quantidade: qCom,
      valor_unitario: numero(texto(prod, 'vUnCom')),
      // Valor pago pelo item: produto menos desconto do item
      valor_total: Math.round((vProd - vDesc) * 100) / 100,
    };
  });

  if (itens.length === 0) throw new Error('A nota não tem itens.');

  return {
    chave_acesso: chave,
    numero_nota: texto(ide, 'nNF'),
    serie: texto(ide, 'serie'),
    data_emissao: dataRaw ? dataRaw.slice(0, 10) : null,
    fornecedor_nome: fornecedor,
    fornecedor_cnpj: (texto(emit, 'CNPJ') ?? texto(emit, 'CPF'))?.replace(/\D/g, '') ?? null,
    destinatario_documento: (texto(dest, 'CNPJ') ?? texto(dest, 'CPF'))?.replace(/\D/g, '') ?? null,
    valor_total: numero(texto(total, 'vNF')),
    itens,
  };
}
