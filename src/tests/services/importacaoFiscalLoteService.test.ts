import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockRpc = vi.fn();
const mockFrom = vi.fn();

vi.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: (...args: unknown[]) => mockRpc(...args),
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

import {
  chamarImportacaoFiscalLote,
  criarEscolhaComercialInicial,
  gerarChaveIdempotenciaImportacaoFiscal,
  LIMITE_ITENS_IMPORTACAO_FISCAL,
  montarItemImportacaoFiscal,
  normalizarRespostaImportacaoFiscal,
  UNIDADES_MEDIDA_IMPORTACAO_FISCAL,
  validarEscolhaComercialImportacao,
} from '../../services/importacaoFiscalLoteService';

const ESCOLHA = {
  categoria: 'Alimentos',
  unidade_medida: 'UN',
  ativo: false,
  confirmar_descricao_duplicada: false,
};

const UUID_VALIDO = '7f8d1c2a-1234-4abc-8def-1234567890ab';

function respostaValidacaoOk() {
  return {
    sucesso: true,
    pode_gravar: true,
    total_validos: 1,
    total_bloqueados: 0,
    total_avisos: 0,
    itens: [
      {
        referencia_id: 'ref-1',
        sucesso: true,
        status: 'valido',
      },
    ],
  };
}

function respostaGravacaoOk() {
  return {
    sucesso: true,
    repeticao_idempotente: false,
    importacao_id: 'lote-1',
    total_criados: 1,
    itens: [
      {
        referencia_id: 'ref-1',
        produto_id: 'produto-1',
        descricao: 'Produto Teste',
        sucesso: true,
      },
    ],
  };
}

describe('importacaoFiscalLoteService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRpc.mockResolvedValue({ data: respostaValidacaoOk(), error: null });
  });

  it('1. usa exclusivamente a RPC segura, sem acesso direto a tabelas', async () => {
    await chamarImportacaoFiscalLote({
      modo: 'validar',
      itens: [montarItemImportacaoFiscal('ref-1', ESCOLHA)],
    });

    expect(mockRpc).toHaveBeenCalledTimes(1);
    expect(mockRpc.mock.calls[0][0]).toBe(
      'importar_produtos_fiscal_lote_seguro',
    );
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('2. valida com p_idempotency_key nulo e p_modo validar', async () => {
    await chamarImportacaoFiscalLote({
      modo: 'validar',
      idempotencyKey: UUID_VALIDO,
      itens: [montarItemImportacaoFiscal('ref-1', ESCOLHA)],
    });

    expect(mockRpc.mock.calls[0][1]).toMatchObject({
      p_idempotency_key: null,
      p_modo: 'validar',
    });
  });

  it('3. envia exatamente os cinco campos permitidos por item', async () => {
    await chamarImportacaoFiscalLote({
      modo: 'validar',
      itens: [montarItemImportacaoFiscal('ref-1', ESCOLHA)],
    });

    const payload = mockRpc.mock.calls[0][1] as {
      p_itens: Array<Record<string, unknown>>;
    };
    expect(payload.p_itens).toEqual([
      {
        referencia_id: 'ref-1',
        categoria: 'Alimentos',
        unidade_medida: 'UN',
        ativo: false,
        confirmar_descricao_duplicada: false,
      },
    ]);
    expect(Object.keys(payload.p_itens[0]).sort()).toEqual(
      [
        'ativo',
        'categoria',
        'confirmar_descricao_duplicada',
        'referencia_id',
        'unidade_medida',
      ].sort(),
    );
  });

  it('4. não envia dados fiscais, preço, custo, código, EAN, estoque nem administrador', async () => {
    await chamarImportacaoFiscalLote({
      modo: 'validar',
      itens: [
        {
          referencia_id: 'ref-1',
          categoria: 'Alimentos',
          unidade_medida: 'UN',
          ativo: false,
          confirmar_descricao_duplicada: false,
          // Campos extras simulam um payload indevido; devem ser descartados.
          ncm: '12345678',
          preco: 10,
          custo: 5,
          codigo: 'COD-1',
          codigo_barras: '789',
          estoque: 10,
          administrador_id: 'admin-1',
        } as never,
      ],
    });

    const payload = mockRpc.mock.calls[0][1] as Record<string, unknown>;
    expect(payload).not.toHaveProperty('administrador_id');
    const item = (payload.p_itens as Array<Record<string, unknown>>)[0];
    expect(item).not.toHaveProperty('ncm');
    expect(item).not.toHaveProperty('preco');
    expect(item).not.toHaveProperty('custo');
    expect(item).not.toHaveProperty('codigo');
    expect(item).not.toHaveProperty('codigo_barras');
    expect(item).not.toHaveProperty('estoque');
  });

  it('5. grava com UUID e modo gravar', async () => {
    mockRpc.mockResolvedValue({ data: respostaGravacaoOk(), error: null });

    await chamarImportacaoFiscalLote({
      modo: 'gravar',
      idempotencyKey: UUID_VALIDO,
      itens: [montarItemImportacaoFiscal('ref-1', ESCOLHA)],
    });

    expect(mockRpc.mock.calls[0][1]).toMatchObject({
      p_idempotency_key: UUID_VALIDO,
      p_modo: 'gravar',
    });
  });

  it('6. recusa gravação sem chave de idempotência válida', async () => {
    await expect(
      chamarImportacaoFiscalLote({
        modo: 'gravar',
        idempotencyKey: 'chave-invalida',
        itens: [montarItemImportacaoFiscal('ref-1', ESCOLHA)],
      }),
    ).rejects.toThrow(/Chave de idempotência inválida/);

    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('7. aceita de 1 a 100 itens e rejeita lote vazio ou acima do limite', async () => {
    const item = montarItemImportacaoFiscal('ref-1', ESCOLHA);

    await expect(
      chamarImportacaoFiscalLote({ modo: 'validar', itens: [] }),
    ).rejects.toThrow(/ao menos um/i);

    await expect(
      chamarImportacaoFiscalLote({
        modo: 'validar',
        itens: Array.from(
          { length: LIMITE_ITENS_IMPORTACAO_FISCAL + 1 },
          (_, indice) =>
            montarItemImportacaoFiscal(`ref-${indice + 1}`, ESCOLHA),
        ),
      }),
    ).rejects.toThrow(/máximo 100/i);

    expect(mockRpc).not.toHaveBeenCalled();

    mockRpc.mockResolvedValue({ data: respostaValidacaoOk(), error: null });
    await chamarImportacaoFiscalLote({ modo: 'validar', itens: [item] });
    expect(mockRpc).toHaveBeenCalledTimes(1);
  });

  it('8. exige categoria, unidade válida e estado ativo booleano', () => {
    expect(
      validarEscolhaComercialImportacao({
        ...ESCOLHA,
        categoria: '   ',
      }),
    ).toContain('Informe a categoria comercial.');

    expect(
      validarEscolhaComercialImportacao({
        ...ESCOLHA,
        unidade_medida: 'XPTO',
      }),
    ).toContain('Selecione uma unidade comercial válida.');

    expect(
      validarEscolhaComercialImportacao({
        ...ESCOLHA,
        ativo: undefined as unknown as boolean,
      }),
    ).toContain(
      'Defina explicitamente se o produto ficará ativo ou inativo.',
    );

    expect(validarEscolhaComercialImportacao(ESCOLHA)).toEqual([]);
  });

  it('9. mantém a unidade explícita e não infere a partir da descrição', () => {
    const item = montarItemImportacaoFiscal('ref-1', {
      ...ESCOLHA,
      categoria: '  Alimentos  ',
      unidade_medida: 'FARDO',
    });

    expect(item.categoria).toBe('Alimentos');
    expect(item.unidade_medida).toBe('FARDO');
    expect(UNIDADES_MEDIDA_IMPORTACAO_FISCAL).toContain('FARDO');
    expect(UNIDADES_MEDIDA_IMPORTACAO_FISCAL).toHaveLength(28);
  });

  it('10. inicia ativo como false e permite alteração explícita', () => {
    expect(criarEscolhaComercialInicial().ativo).toBe(false);
    expect(
      montarItemImportacaoFiscal('ref-1', criarEscolhaComercialInicial()).ativo,
    ).toBe(false);
    expect(
      montarItemImportacaoFiscal('ref-1', { ...ESCOLHA, ativo: true }).ativo,
    ).toBe(true);
  });

  it('11. normaliza validação autorizada e bloqueada sem inferir sucesso', () => {
    const autorizada = normalizarRespostaImportacaoFiscal(
      respostaValidacaoOk(),
      'validar',
    );
    expect(autorizada.podeGravar).toBe(true);
    expect(autorizada.sucesso).toBe(true);
    expect(autorizada.totalValidos).toBe(1);

    const bloqueada = normalizarRespostaImportacaoFiscal(
      {
        sucesso: true,
        pode_gravar: false,
        total_validos: 0,
        total_bloqueados: 1,
        itens: [
          {
            referencia_id: 'ref-1',
            sucesso: false,
            status: 'bloqueado',
            erro: 'Descrição ambígua.',
          },
        ],
      },
      'validar',
    );
    expect(bloqueada.podeGravar).toBe(false);
    expect(bloqueada.totalBloqueados).toBe(1);
    expect(bloqueada.itens[0].bloqueado).toBe(true);
    expect(bloqueada.itens[0].erros).toContain('Descrição ambígua.');
  });

  it('12. não declara sucesso quando a RPC retorna erro ou resposta inconclusiva', async () => {
    mockRpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'Falha de rede' },
    });

    await expect(
      chamarImportacaoFiscalLote({
        modo: 'gravar',
        idempotencyKey: UUID_VALIDO,
        itens: [montarItemImportacaoFiscal('ref-1', ESCOLHA)],
      }),
    ).rejects.toThrow('Falha de rede');

    expect(() =>
      normalizarRespostaImportacaoFiscal(null, 'gravar'),
    ).toThrow(/inconclusiva/);

    const semSucesso = normalizarRespostaImportacaoFiscal(
      { importacao_id: 'lote-1', total_criados: 1 },
      'gravar',
    );
    expect(semSucesso.sucesso).toBe(false);
  });

  it('13. normaliza repetição idempotente, ID do lote e total criado', () => {
    const resposta = normalizarRespostaImportacaoFiscal(
      {
        ...respostaGravacaoOk(),
        repeticao_idempotente: true,
        total_criados: 0,
      },
      'gravar',
    );

    expect(resposta.repeticaoIdempotente).toBe(true);
    expect(resposta.importacaoId).toBe('lote-1');
    expect(resposta.totalCriados).toBe(0);
    expect(resposta.sucesso).toBe(true);
    expect(resposta.itens[0].produtoId).toBe('produto-1');
  });

  it('14. exige pode_gravar estritamente true e sucesso estritamente booleano', () => {
    const resposta = normalizarRespostaImportacaoFiscal(
      {
        success: true,
        pode_gravar: 'true',
        itens: [],
      },
      'validar',
    );
    expect(resposta.sucesso).toBe(true);
    expect(resposta.podeGravar).toBe(false);
  });

  it('15. gera UUIDs válidos e diferentes', () => {
    const primeira = gerarChaveIdempotenciaImportacaoFiscal();
    const segunda = gerarChaveIdempotenciaImportacaoFiscal();

    expect(primeira).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(segunda).not.toBe(primeira);
  });

  it('16. o código do serviço não contém inserts, upserts, updates ou Edge Function de cadastro', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const arquivo = fs.readFileSync(
      path.resolve(
        process.cwd(),
        'src/services/importacaoFiscalLoteService.ts',
      ),
      'utf8',
    );

    expect(arquivo).not.toMatch(/\.insert\s*\(/);
    expect(arquivo).not.toMatch(/\.upsert\s*\(/);
    expect(arquivo).not.toMatch(/\.update\s*\(/);
    expect(arquivo).not.toMatch(/\.delete\s*\(/);
    expect(arquivo).not.toMatch(/cadastrar-produto/);
    expect(arquivo).not.toMatch(/functions\.invoke/);
    expect(arquivo).not.toMatch(/supabase\s*\.\s*from\s*\(/);
    expect(arquivo).toContain('importar_produtos_fiscal_lote_seguro');
  });
});
