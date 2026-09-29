import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const mockRpc = vi.fn();
const mockFrom = vi.fn();

vi.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: (...args: unknown[]) => mockRpc(...args),
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

import { registrarAjusteEstoqueSeguro } from '../../services/ajusteEstoqueService';

const INPUT = {
  produtoId: 'prod-1',
  tipoMovimentacao: 'entrada_ajuste' as const,
  quantidade: 5,
  motivo: 'Inventário',
  observacoes: 'obs',
  lote: 'L1',
  fornecedor: 'Forn',
};

describe('ajusteEstoqueService.registrarAjusteEstoqueSeguro', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRpc.mockResolvedValue({ data: { success: true }, error: null });
  });

  it('1. chama registrar_ajuste_estoque_seguro', async () => {
    await registrarAjusteEstoqueSeguro(INPUT);
    expect(mockRpc).toHaveBeenCalledTimes(1);
    const [rpc] = mockRpc.mock.calls[0] as [string, Record<string, unknown>];
    expect(rpc).toBe('registrar_ajuste_estoque_seguro');
  });

  it('2. não faz insert direto em movimentacoes_estoque', async () => {
    await registrarAjusteEstoqueSeguro(INPUT);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('3/4/5/6. payload sem autoridade (admin/usuario)', async () => {
    await registrarAjusteEstoqueSeguro(INPUT);
    const [, payload] = mockRpc.mock.calls[0] as [string, Record<string, unknown>];
    for (const proibido of [
      'administrador_id',
      'usuario_id',
      'usuario_tipo',
      'usuario_nome',
      'quantidade_anterior',
      'quantidade_nova',
      'referencia_tipo',
    ]) {
      expect(payload).not.toHaveProperty(proibido);
    }
  });

  it('7. payload contém somente campos permitidos', async () => {
    await registrarAjusteEstoqueSeguro(INPUT);
    const [, payload] = mockRpc.mock.calls[0] as [string, Record<string, unknown>];
    expect(payload).toEqual({
      p_produto_id: 'prod-1',
      p_tipo_movimentacao: 'entrada_ajuste',
      p_quantidade: 5,
      p_motivo: 'Inventário',
      p_observacoes: 'obs',
      p_lote: 'L1',
      p_fornecedor: 'Forn',
    });
  });

  it('8. campos opcionais vazios viram null', async () => {
    await registrarAjusteEstoqueSeguro({
      ...INPUT,
      observacoes: '',
      lote: undefined,
      fornecedor: '   ',
    });
    const [, payload] = mockRpc.mock.calls[0] as [string, Record<string, unknown>];
    expect(payload.p_observacoes).toBeNull();
    expect(payload.p_lote).toBeNull();
    expect(payload.p_fornecedor).toBeNull();
  });

  it('validações de UX: produto, quantidade e motivo', async () => {
    await expect(
      registrarAjusteEstoqueSeguro({ ...INPUT, produtoId: '' }),
    ).rejects.toThrow(/produto/i);
    await expect(
      registrarAjusteEstoqueSeguro({ ...INPUT, quantidade: 0 }),
    ).rejects.toThrow(/quantidade/i);
    await expect(
      registrarAjusteEstoqueSeguro({ ...INPUT, motivo: '  ' }),
    ).rejects.toThrow(/motivo/i);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('erro do backend é propagado', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'Falha rpc' } });
    await expect(registrarAjusteEstoqueSeguro(INPUT)).rejects.toThrow('Falha rpc');
  });
});

describe('auditoria — ajuste manual sem INSERT direto', () => {
  const raiz = path.resolve(__dirname, '..', '..');

  function ler(rel: string): string {
    return fs.readFileSync(path.join(raiz, rel), 'utf8');
  }

  it('18. hook de ajuste não insere direto nem calcula quantidades no cliente', () => {
    const hook = ler('hooks/useMovimentacoesEstoque.ts');
    expect(hook).toContain('registrarAjusteEstoqueSeguro');
    expect(hook).not.toContain('movimentarEstoque');
    expect(hook).not.toContain('quantidade_anterior');
    expect(hook).not.toContain('quantidade_nova');
    expect(hook).not.toContain('.insert(');
  });
});
