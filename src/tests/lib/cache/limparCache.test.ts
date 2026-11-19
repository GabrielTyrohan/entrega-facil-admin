import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient } from '@tanstack/react-query';

const { removeClient } = vi.hoisted(() => ({ removeClient: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@/lib/cache/indexedDBPersister', () => ({ indexedDBPersister: { removeClient } }));

import { esquecerDonoDoCache, garantirCacheDoUsuario, limparCache } from '@/lib/cache/limparCache';

describe('limparCache', () => {
  let qc: QueryClient;
  beforeEach(() => {
    qc = new QueryClient();
    qc.setQueryData(['clientes', 'admin-1'], [{ id: 1 }]);
    removeClient.mockClear();
    localStorage.clear();
  });

  it('apaga a memória e a cópia no disco', async () => {
    await limparCache(qc);
    expect(qc.getQueryData(['clientes', 'admin-1'])).toBeUndefined();
    expect(removeClient).toHaveBeenCalledTimes(1);
  });

  it('cache de outra pessoa é apagado; do mesmo usuário é mantido', async () => {
    expect(await garantirCacheDoUsuario(qc, 'ana')).toBe(true); // dono desconhecido
    qc.setQueryData(['clientes', 'admin-1'], [{ id: 2 }]);

    expect(await garantirCacheDoUsuario(qc, 'ana')).toBe(false);
    expect(qc.getQueryData(['clientes', 'admin-1'])).toEqual([{ id: 2 }]);

    expect(await garantirCacheDoUsuario(qc, 'bruno')).toBe(true);
    expect(qc.getQueryData(['clientes', 'admin-1'])).toBeUndefined();
  });

  it('depois de sair, o próximo login começa limpo', async () => {
    await garantirCacheDoUsuario(qc, 'ana');
    esquecerDonoDoCache();
    qc.setQueryData(['clientes', 'admin-1'], [{ id: 3 }]);
    expect(await garantirCacheDoUsuario(qc, 'ana')).toBe(true);
    expect(qc.getQueryData(['clientes', 'admin-1'])).toBeUndefined();
  });
});
