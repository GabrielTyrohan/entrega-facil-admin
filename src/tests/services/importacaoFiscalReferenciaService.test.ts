import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockRpc = vi.fn();
const mockRead = vi.fn();
const mockSheetToJson = vi.fn();

vi.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: (...args: unknown[]) => mockRpc(...args),
  },
}));

vi.mock('xlsx-js-style', () => ({
  read: (...args: unknown[]) => mockRead(...args),
  utils: {
    sheet_to_json: (...args: unknown[]) => mockSheetToJson(...args),
  },
}));

// Mock do FileReader: readAsArrayBuffer dispara onLoad sincronicamente
let onloadCallback: ((ev: any) => void) | null = null;
const fakeBuffer = new ArrayBuffer(0);
const mockReader = {
  onerror: null as any,
  set onload(v: any) {
    onloadCallback = v;
  },
  get onload() {
    return onloadCallback;
  },
  readAsArrayBuffer: vi.fn((file: File) => {
    if (onloadCallback) onloadCallback({} as any);
  }),
  result: fakeBuffer,
};
vi.stubGlobal(
  'FileReader',
  vi.fn(function () {
    return mockReader;
  }),
);

import { importarReferenciaFiscal } from '../../services/importacaoFiscalReferenciaService';

const CABECALHO = [
  'codigo', 'codbar', 'descpro', 'ncm', 'cstpise', 'alipise', 'cstpis',
  'alipis', 'cstcofinse', 'alicofinse', 'cstcofins', 'alicofins', 'cst',
  'aliicms', 'desccfop', 'kit', 'custocom', 'estoque', 'valor_estoque',
  'custo', 'preco1', 'cest',
];

const linhaValida = [
  'C001', '0123456789012', 'Produto A', '10063021', '07', '0,00', '07', '0,00',
  '07', '0,00', '07', '0,00', '102', '0,00', 'Venda', 'SIM', '10,00', '5',
  '5,00', '8,00', '12,00', '1704400',
];

function montarLinhas(quantidade: number, linhaBase = linhaValida) {
  const linhas = [CABECALHO];
  for (let i = 0; i < quantidade; i++) {
    linhas.push([...linhaBase]);
  }
  return linhas;
}

describe('importacaoFiscalReferenciaService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRead.mockReturnValue({
      SheetNames: ['Plan1'],
      Sheets: { Plan1: {} },
    });
    onloadCallback = null;
  });

  it('preserva zeros à esquerda no código de barras (texto, nunca número)', async () => {
    mockSheetToJson.mockReturnValue([
      CABECALHO,
      ['C001', '0123456789012', 'Produto A', '10063021', '07', '0,00', '07',
        '0,00', '07', '0,00', '07', '0,00', '102', '0,00', 'Venda', 'SIM',
        '10,00', '5', '5,00', '8,00', '12,00', '1704400'],
    ]);
    mockRpc.mockResolvedValue({ data: 250, error: null });

    const arquivo = new File(['x'], 'tmp_prod.ods', { type: 'application/vnd.oasis.opendocument.spreadsheet' });
    await importarReferenciaFiscal(arquivo);

    expect(mockRpc).toHaveBeenCalledTimes(1);
    const payload = mockRpc.mock.calls[0][1] as Record<string, unknown>;
    const itens = payload.p_rows as unknown[];
    expect(itens[0]).toMatchObject({
      linha_origem: 2,
      codigo_barras: '0123456789012',
      codigo: 'C001',
    });
    // código de barras enviado como string, nunca convertido para número
    expect(typeof itens[0] as any).toBe('object');
    expect(String((itens as any[])[0].codigo_barras)).toBe('0123456789012');
    // código de barras enviado como string, nunca convertido para número
    expect(typeof itens[0] as any).toBe('object');
    expect(String((itens as any[])[0].codigo_barras)).toBe('0123456789012');
  });

  it('valores vazios são enviados como null', async () => {
    const linhaVazia = [
      'C001', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '',
      '', '', '', '', '', '', '',
    ];
    mockSheetToJson.mockReturnValue([CABECALHO, linhaVazia]);
    mockRpc.mockResolvedValue({ data: 1, error: null });

    const arquivo = new File(['x'], 'tmp_prod.ods');
    await importarReferenciaFiscal(arquivo);

    const itens = (mockRpc.mock.calls[0][1] as any).p_rows;
    expect(itens[0].codigo_barras).toBeNull();
    expect(itens[0].ncm).toBeNull();
    expect(itens[0].aliquota_pis).toBeNull();
    expect(itens[0].cst_icms).toBeNull();
    expect(itens[0].estoque).toBeNull();
  });

  it('remove espaços desnecessários de textos', async () => {
    mockSheetToJson.mockReturnValue([
      CABECALHO,
      ['  C001  ', ' 0123 ', '  Produto A  ', ' 10063021 ', ' 07 ', ' 0,00 ',
        '07', '0,00', '07', '0,00', '07', '0,00', ' 102 ', '0,00', ' Venda ',
        ' SIM ', '10,00', ' 5 ', '5,00', '8,00', '12,00', ' 1704400 '],
    ]);
    mockRpc.mockResolvedValue({ data: 1, error: null });

    const arquivo = new File(['x'], 'tmp_prod.ods');
    await importarReferenciaFiscal(arquivo);

    const itens = (mockRpc.mock.calls[0][1] as any).p_rows;
    expect(itens[0].codigo).toBe('C001');
    expect(itens[0].ncm).toBe('10063021');
    expect(itens[0].cfop_descricao).toBe('Venda');
    expect(itens[0].cst_icms).toBe('102');
  });

  it('envia em lotes (não chama a RPC uma única vez gigante)', async () => {
    const linhas = montarLinhas(250); // 250 linhas de dados
    mockSheetToJson.mockReturnValue(linhas);
    mockRpc.mockResolvedValue({ data: 100, error: null });

    const arquivo = new File(['x'], 'tmp_prod.ods');
    await importarReferenciaFiscal(arquivo);

    expect(mockRpc).toHaveBeenCalledTimes(3); // 100, 100, 50
    // primeiro lote
    const lote1 = (mockRpc.mock.calls[0][1] as any).p_rows;
    expect(lote1.length).toBe(100);
    expect(lote1[0].linha_origem).toBe(2);
    expect(lote1[99].linha_origem).toBe(101);
    // segundo lote
    const lote2 = (mockRpc.mock.calls[1][1] as any).p_rows;
    expect(lote2.length).toBe(100);
    expect(lote2[0].linha_origem).toBe(102);
    // terceiro lote (resto)
    const lote3 = (mockRpc.mock.calls[2][1] as any).p_rows;
    expect(lote3.length).toBe(50);
    expect(lote3[0].linha_origem).toBe(202);
  });

  it('tratamento de erro da RPC', async () => {
    mockSheetToJson.mockReturnValue([CABECALHO, linhaValida]);
    mockRpc.mockRejectedValue(new Error('Falha na RPC de importação'));

    const arquivo = new File(['x'], 'tmp_prod.ods');
    const resumo = await importarReferenciaFiscal(arquivo);

    expect(resumo.erros.length).toBeGreaterThan(0);
    expect(resumo.erros[0]).toMatch(/Falha na RPC de importação/);
    expect(resumo.aceitos).toBe(0);
  });

  it('não toca em produtos_cadastrado (apenas RPC de referência)', async () => {
    mockSheetToJson.mockReturnValue([CABECALHO, linhaValida]);
    mockRpc.mockResolvedValue({ data: 1, error: null });

    const arquivo = new File(['x'], 'tmp_prod.ods');
    await importarReferenciaFiscal(arquivo);

    expect(mockRpc).toHaveBeenCalledTimes(1);
    expect(mockRpc).toHaveBeenCalledWith('importar_produtos_fiscal_referencia', {
      p_rows: expect.any(Array),
    });
    // Nenhuma consulta/inserção direta em produtos_cadastrado
    expect(mockRpc).not.toHaveBeenCalledWith(
      expect.stringContaining('produtos_cadastrado'),
      expect.anything(),
    );
  });

  it('resumo contém lidos, enviados, aceitos e erros', async () => {
    mockSheetToJson.mockReturnValue([CABECALHO, linhaValida]);
    mockRpc.mockResolvedValue({ data: 1, error: null });

    const arquivo = new File(['x'], 'tmp_prod.ods');
    const resumo = await importarReferenciaFiscal(arquivo);

    expect(resumo.lidos).toBe(1);
    expect(resumo.enviados).toBe(1);
    expect(resumo.aceitos).toBe(1);
    expect(resumo.erros).toEqual([]);
  });
});
