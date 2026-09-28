import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const mockRpc = vi.fn();

vi.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: (...args: unknown[]) => mockRpc(...args),
  },
}));

import { registrarEntregaCesta } from '../../services/entregaCestaService';

const INPUT = {
  vendedorId: 'vend-1',
  cestaId: 'cesta-1',
  quantidade: 2,
  observacao: 'Entrega parcial',
};

describe('entregaCestaService.registrarEntregaCesta', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRpc.mockResolvedValue({
      data: { success: true, id: 'entrega-123' },
      error: null,
    });
  });

  it('1/2. chama exatamente registrar_entrega_cestas_seguro (nunca a antiga)', async () => {
    await registrarEntregaCesta(INPUT);
    expect(mockRpc).toHaveBeenCalledTimes(1);
    const [rpc] = mockRpc.mock.calls[0] as [string, Record<string, unknown>];
    expect(rpc).toBe('registrar_entrega_cestas_seguro');
    const chamadasAntigas = mockRpc.mock.calls.filter(
      ([nome]) => nome === 'registrar_entrega_cestas',
    );
    expect(chamadasAntigas).toHaveLength(0);
  });

  it('5. recebe somente campos de negócio e monta payload sem autoridade', async () => {
    await registrarEntregaCesta(INPUT);
    expect(mockRpc).toHaveBeenCalledTimes(1);
    const [rpc, payload] = mockRpc.mock.calls[0] as [string, Record<string, unknown>];
    expect(rpc).toBe('registrar_entrega_cestas_seguro');
    expect(payload).toEqual({
      p_vendedor_id: 'vend-1',
      p_cesta_id: 'cesta-1',
      p_quantidade: 2,
      p_observacao: 'Entrega parcial',
    });
    expect(payload).not.toHaveProperty('p_administrador_id');
    expect(payload).not.toHaveProperty('p_usuario_id');
    expect(payload).not.toHaveProperty('p_usuario_nome');
  });

  it('6. quantidade < 1 não é enviada (rejeita antes do rpc)', async () => {
    await expect(
      registrarEntregaCesta({ ...INPUT, quantidade: 0 }),
    ).rejects.toThrow(/ao menos 1 cesta/i);
    await expect(
      registrarEntregaCesta({ ...INPUT, quantidade: -3 }),
    ).rejects.toThrow(/ao menos 1 cesta/i);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('7. observacao vazia vira null; texto é preservado', async () => {
    await registrarEntregaCesta({ ...INPUT, observacao: '' });
    let [, payload] = mockRpc.mock.calls[0] as [string, Record<string, unknown>];
    expect(payload.p_observacao).toBeNull();

    mockRpc.mockClear();
    await registrarEntregaCesta({ ...INPUT, observacao: undefined });
    [, payload] = mockRpc.mock.calls[0] as [string, Record<string, unknown>];
    expect(payload.p_observacao).toBeNull();
  });

  it('8. sucesso retorna id', async () => {
    const resp = await registrarEntregaCesta(INPUT);
    expect(resp.id).toBe('entrega-123');
  });

  it('erro do backend é propagado; success=false vira Error sanitizado', async () => {
    mockRpc.mockResolvedValue({
      data: { success: false, erro: 'Estoque insuficiente' },
      error: null,
    });
    await expect(registrarEntregaCesta(INPUT)).rejects.toThrow('Estoque insuficiente');

    mockRpc.mockResolvedValue({ data: null, error: { message: 'Falha rpc' } });
    await expect(registrarEntregaCesta(INPUT)).rejects.toThrow('Falha rpc');
  });
});

describe('auditoria — autoridade fora da UI de entrega', () => {
  const raiz = path.resolve(__dirname, '..', '..');

  function ler(rel: string): string {
    return fs.readFileSync(path.join(raiz, rel), 'utf8');
  }

  it('12. UI/hook de entrega não montam autoridade; só o service chama a RPC', () => {
    const pagina = ler('pages/CestasVendedor.tsx');
    const hook = ler('hooks/useCestas.ts');
    const service = ler('services/entregaCestaService.ts');

    for (const [nome, codigo] of [
      ['CestasVendedor', pagina],
      ['useCestas', hook],
    ] as Array<[string, string]>) {
      expect(codigo, `${nome} monta p_administrador_id`).not.toContain('p_administrador_id');
      expect(codigo, `${nome} monta p_usuario_id`).not.toContain('p_usuario_id');
      expect(codigo, `${nome} monta p_usuario_nome`).not.toContain('p_usuario_nome');
      expect(codigo, `${nome} chama registrar_entrega_cestas direto`).not.toContain(
        'registrar_entrega_cestas',
      );
    }

    expect(service).toContain('registrar_entrega_cestas_seguro');
    expect(service).not.toContain('p_administrador_id');
  });
});
