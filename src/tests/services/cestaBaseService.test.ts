import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockRpc = vi.fn();

vi.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: (...args: unknown[]) => mockRpc(...args),
  },
}));

import { CestaBaseService } from '../../services/cestaBaseService';
import { CestaService } from '../../services/cestaService';

describe('cestaBaseService.distribuirParaVendedor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRpc.mockResolvedValue({ data: 'nova-cesta-id', error: null });
  });

  it('1. não recebe adminId obrigatório (só cesta + vendedor exigidos)', () => {
    expect(CestaBaseService.distribuirParaVendedor.length).toBe(2);
  });

  it('2. payload não contém p_administrador_id', async () => {
    await CestaBaseService.distribuirParaVendedor('cesta-1', 'vend-1', 2);
    expect(mockRpc).toHaveBeenCalledTimes(1);
    const [, payload] = mockRpc.mock.calls[0] as [string, Record<string, unknown>];
    expect(payload).not.toHaveProperty('p_administrador_id');
  });

  it('3/4/5. payload contém p_cesta_base_id, p_vendedor_id e p_quantidade', async () => {
    await CestaBaseService.distribuirParaVendedor('cesta-1', 'vend-1', 3);
    const [rpc, payload] = mockRpc.mock.calls[0] as [string, Record<string, unknown>];
    expect(rpc).toBe('distribuir_cesta_para_vendedor');
    expect(payload).toEqual({
      p_cesta_base_id: 'cesta-1',
      p_vendedor_id: 'vend-1',
      p_quantidade: 3,
    });
  });

  it('6. default de quantidade preserva 1 quando omitida', async () => {
    await CestaBaseService.distribuirParaVendedor('cesta-1', 'vend-1');
    const [, payload] = mockRpc.mock.calls[0] as [string, Record<string, unknown>];
    expect(payload.p_quantidade).toBe(1);
  });
});

describe('cestaService.deleteCesta', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRpc.mockResolvedValue({ data: null, error: null });
  });

  it('12. excluir_cesta permanece enviando somente p_cesta_id', async () => {
    await CestaService.deleteCesta('cesta-9');
    expect(mockRpc).toHaveBeenCalledTimes(1);
    const [rpc, payload] = mockRpc.mock.calls[0] as [string, Record<string, unknown>];
    expect(rpc).toBe('excluir_cesta');
    expect(payload).toEqual({ p_cesta_id: 'cesta-9' });
  });
});
