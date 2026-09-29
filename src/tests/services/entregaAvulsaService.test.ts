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

import {
  atualizarEntregaAvulsaSegura,
  criarEntregaAvulsaSegura,
  excluirEntregaAvulsaSegura,
} from '../../services/entregaAvulsaService';

const ITENS = [
  { produtoId: 'prod-1', quantidade: 2 },
  { produtoId: 'prod-2', quantidade: 1 },
];

describe('entregaAvulsaService — criar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRpc.mockResolvedValue({ data: { success: true, id: 'ent-1' }, error: null });
  });

  it('1. create chama criar_entrega_avulsa_segura', async () => {
    await criarEntregaAvulsaSegura({ vendedorId: 'vend-1', itens: ITENS, observacao: null });
    expect(mockRpc).toHaveBeenCalledTimes(1);
    const [rpc] = mockRpc.mock.calls[0] as [string, Record<string, unknown>];
    expect(rpc).toBe('criar_entrega_avulsa_segura');
  });

  it('2/4/5. create envia só vendedor, itens e observação', async () => {
    await criarEntregaAvulsaSegura({ vendedorId: 'vend-1', itens: ITENS, observacao: 'obs' });
    const [, payload] = mockRpc.mock.calls[0] as [string, Record<string, unknown>];
    expect(payload).toEqual({
      p_vendedor_id: 'vend-1',
      p_itens: [
        { produtoId: 'prod-1', quantidade: 2 },
        { produtoId: 'prod-2', quantidade: 1 },
      ],
      p_observacao: 'obs',
    });
    for (const proibido of [
      'administrador_id',
      'p_administrador_id',
      'usuario_id',
      'usuario_nome',
      'usuario_tipo',
      'quantidade_anterior',
      'quantidade_nova',
    ]) {
      expect(payload).not.toHaveProperty(proibido);
    }
  });

  it('3. itens não enviam preco_unitario', async () => {
    await criarEntregaAvulsaSegura({ vendedorId: 'vend-1', itens: ITENS, observacao: null });
    const [, payload] = mockRpc.mock.calls[0] as [string, Record<string, unknown>];
    expect(JSON.stringify(payload.p_itens)).not.toMatch(/preco/i);
  });

  it('observação vazia vira null; validações bloqueiam antes do rpc', async () => {
    await criarEntregaAvulsaSegura({ vendedorId: 'vend-1', itens: ITENS, observacao: '  ' });
    const [, payload] = mockRpc.mock.calls[0] as [string, Record<string, unknown>];
    expect(payload.p_observacao).toBeNull();

    await expect(
      criarEntregaAvulsaSegura({ vendedorId: '', itens: ITENS, observacao: null }),
    ).rejects.toThrow(/vendedor/i);
    await expect(
      criarEntregaAvulsaSegura({ vendedorId: 'vend-1', itens: [], observacao: null }),
    ).rejects.toThrow(/produto/i);
    await expect(
      criarEntregaAvulsaSegura({
        vendedorId: 'vend-1',
        itens: [{ produtoId: 'prod-1', quantidade: 0 }],
        observacao: null,
      }),
    ).rejects.toThrow(/quantidade/i);
  });

  it('retorna o id da entrega criada', async () => {
    const resp = await criarEntregaAvulsaSegura({
      vendedorId: 'vend-1',
      itens: ITENS,
      observacao: null,
    });
    expect(resp.id).toBe('ent-1');
  });
});

describe('entregaAvulsaService — atualizar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRpc.mockResolvedValue({ data: { success: true }, error: null });
  });

  it('6/7. update chama atualizar_entrega_avulsa_segura com estado final', async () => {
    await atualizarEntregaAvulsaSegura({
      entregaId: 'ent-1',
      itens: ITENS,
      observacao: 'nova obs',
    });
    expect(mockRpc).toHaveBeenCalledTimes(1);
    const [rpc, payload] = mockRpc.mock.calls[0] as [string, Record<string, unknown>];
    expect(rpc).toBe('atualizar_entrega_avulsa_segura');
    expect(payload).toEqual({
      p_entrega_id: 'ent-1',
      p_itens: [
        { produtoId: 'prod-1', quantidade: 2 },
        { produtoId: 'prod-2', quantidade: 1 },
      ],
      p_observacao: 'nova obs',
    });
  });

  it('8/9. update sem diff de estoque nem preço', async () => {
    await atualizarEntregaAvulsaSegura({ entregaId: 'ent-1', itens: ITENS, observacao: null });
    const [, payload] = mockRpc.mock.calls[0] as [string, Record<string, unknown>];
    const serializado = JSON.stringify(payload);
    expect(serializado).not.toMatch(/quantidade_anterior|quantidade_nova|preco|diff/i);
    expect(payload).not.toHaveProperty('p_administrador_id');
  });

  it('update exige ao menos 1 item', async () => {
    await expect(
      atualizarEntregaAvulsaSegura({ entregaId: 'ent-1', itens: [], observacao: null }),
    ).rejects.toThrow(/pelo menos 1 produto/i);
    expect(mockRpc).not.toHaveBeenCalled();
  });
});

describe('entregaAvulsaService — excluir', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRpc.mockResolvedValue({ data: { success: true }, error: null });
  });

  it('10/11. delete chama excluir_entrega_avulsa_segura só com entregaId', async () => {
    await excluirEntregaAvulsaSegura('ent-1');
    expect(mockRpc).toHaveBeenCalledTimes(1);
    const [rpc, payload] = mockRpc.mock.calls[0] as [string, Record<string, unknown>];
    expect(rpc).toBe('excluir_entrega_avulsa_segura');
    expect(payload).toEqual({ p_entrega_id: 'ent-1' });
  });
});

describe('auditoria — sem autoridade no fluxo de entrega avulsa', () => {
  const raiz = path.resolve(__dirname, '..', '..');

  function ler(rel: string): string {
    return fs.readFileSync(path.join(raiz, rel), 'utf8');
  }

  it('25/27/30. UI não monta autoridade nem insert direto; id alimenta a nota', () => {
    const pagina = ler('pages/EntregaAvulsa.tsx');
    expect(pagina).not.toContain('movimentarEstoque');
    expect(pagina).not.toContain('p_administrador_id');
    expect(pagina).not.toContain('p_usuario_id');
    expect(pagina).not.toContain('p_usuario_nome');
    expect(pagina).not.toContain(".from('movimentacoes_estoque').insert");
    expect(pagina).toContain('criarEntregaAvulsaSegura');
    expect(pagina).toContain('atualizarEntregaAvulsaSegura');
    expect(pagina).toContain('excluirEntregaAvulsaSegura');
    // O id retornado pela RPC segue alimentando o número da nota/PDF.
    expect(pagina).toContain('entregaId.slice(0, 8)');
    expect(pagina).toContain('numeroPedido: novoId');
  });
});
