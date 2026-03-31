import { PersistedClient, Persister } from '@tanstack/react-query-persist-client';
import { del, get, set } from 'idb-keyval';

let isIndexedDBAvailable = true;

const testIndexedDB = async () => {
  try {
    await set('test-key', 'test-value');
    await get('test-key');
    await del('test-key');
    console.log('✅ IndexedDB disponível');
    return true;
  } catch (error) {
    console.warn('⚠️ IndexedDB indisponível, usando memória', error);
    return false;
  }
};

testIndexedDB().then(result => { isIndexedDBAvailable = result; });

// ─── Sanitização profunda ─────────────────────────────────────────────────────
const isPlainSerializable = (value: unknown): boolean => {
  if (value === null || value === undefined) return true;
  if (typeof value === 'function') return false;
  if (typeof value === 'symbol') return false;
  // Detecta Promise ou qualquer thenable
  if (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as any).then === 'function'
  ) return false;
  return true;
};

const deepSanitize = (obj: unknown): unknown => {
  if (!isPlainSerializable(obj)) return undefined;

  if (Array.isArray(obj)) {
    return obj.map(deepSanitize).filter(v => v !== undefined);
  }

  if (obj !== null && typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      if (!isPlainSerializable(value)) continue;
      const sanitized = deepSanitize(value);
      if (sanitized !== undefined) {
        result[key] = sanitized;
      }
    }
    return result;
  }

  return obj;
};

const sanitizeClient = (client: PersistedClient): PersistedClient => {
  return {
    ...client,
    clientState: {
      ...client.clientState,
      queries: client.clientState.queries
        .filter(q => {
          const data = q.state.data;
          if (data instanceof Promise) return false;
          if (typeof data === 'function') return false;
          // Rejeita qualquer thenable no nível raiz
          if (
            typeof data === 'object' &&
            data !== null &&
            typeof (data as any).then === 'function'
          ) return false;
          return true;
        })
        .map(q => ({
          ...q,
          state: {
            ...q.state,
            data: deepSanitize(q.state.data),
          },
        })),
    },
  };
};

export const indexedDBPersister: Persister = {
  persistClient: async (client: PersistedClient) => {
    if (!isIndexedDBAvailable) return;
    try {
      await set('tanstack-query-cache', sanitizeClient(client));
    } catch (error) {
      console.error('Erro ao salvar cache:', error);
    }
  },
  restoreClient: async () => {
    if (!isIndexedDBAvailable) return undefined;
    try {
      return await get<PersistedClient>('tanstack-query-cache');
    } catch {
      return undefined;
    }
  },
  removeClient: async () => {
    if (!isIndexedDBAvailable) return;
    try {
      await del('tanstack-query-cache');
    } catch {}
  },
};

export const persistOptions = {
  persister: indexedDBPersister,
  maxAge: 30 * 60 * 1000,
  buster: 'v5', // ← bump para limpar cache corrompido anterior
};