// ============================================
// ARQUIVO: src/lib/cache/limparCache.ts
// Apaga os dados guardados (memória do React Query e cópia no IndexedDB).
// Usado ao sair e quando outra pessoa entra no mesmo computador, para ninguém ver
// dados de quem usou antes.
// ============================================

import type { QueryClient } from '@tanstack/react-query';
import { indexedDBPersister } from './indexedDBPersister';

const CHAVE_DONO_DO_CACHE = 'cache_usuario_id';

export async function limparCache(queryClient: QueryClient) {
  queryClient.cancelQueries();
  queryClient.clear();
  await indexedDBPersister.removeClient();
}

/**
 * Confere se o cache guardado é deste usuário. Se for de outra pessoa (ou não se sabe de quem é),
 * apaga tudo antes de usar. Devolve true quando limpou.
 */
export async function garantirCacheDoUsuario(queryClient: QueryClient, userId: string): Promise<boolean> {
  let dono: string | null = null;
  try {
    dono = localStorage.getItem(CHAVE_DONO_DO_CACHE);
  } catch {
    /* sem localStorage: trata como desconhecido */
  }
  if (dono === userId) return false;
  await limparCache(queryClient);
  try {
    localStorage.setItem(CHAVE_DONO_DO_CACHE, userId);
  } catch {
    /* ignora */
  }
  return true;
}

export function esquecerDonoDoCache() {
  try {
    localStorage.removeItem(CHAVE_DONO_DO_CACHE);
  } catch {
    /* ignora */
  }
}
