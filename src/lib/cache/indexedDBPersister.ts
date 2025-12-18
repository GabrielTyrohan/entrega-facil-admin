import { get, set, del } from 'idb-keyval';
import { PersistedClient, Persister } from '@tanstack/react-query-persist-client';

const IDB_KEY = 'reactQuery';

/**
 * Persister customizado para IndexedDB usando idb-keyval.
 * Implementa a interface Persister diretamente para garantir compatibilidade
 * e performance (evitando dupla serialização JSON).
 */
export const indexedDBPersister: Persister = {
  persistClient: async (client: PersistedClient) => {
    try {
      await set(IDB_KEY, client);
    } catch (error) {
      console.warn('Erro ao salvar no IndexedDB, tentando LocalStorage:', error);
      try {
        localStorage.setItem(IDB_KEY, JSON.stringify(client));
      } catch (lsError) {
        console.error('Erro ao salvar no LocalStorage (fallback):', lsError);
      }
    }
  },

  restoreClient: async () => {
    try {
      const client = await get<PersistedClient>(IDB_KEY);
      if (client) {
        return client;
      }
      // Se não achar no IDB, tenta no LocalStorage (pode ser a primeira migração ou fallback anterior)
      const lsValue = localStorage.getItem(IDB_KEY);
      if (lsValue) {
        try {
          return JSON.parse(lsValue) as PersistedClient;
        } catch {
          localStorage.removeItem(IDB_KEY); // Remove dados corrompidos
        }
      }
      return undefined;
    } catch (error) {
      console.warn('Erro ao ler do IndexedDB, tentando LocalStorage:', error);
      try {
        const lsValue = localStorage.getItem(IDB_KEY);
        return lsValue ? JSON.parse(lsValue) as PersistedClient : undefined;
      } catch (lsError) {
        console.error('Erro ao ler do LocalStorage (fallback):', lsError);
        return undefined;
      }
    }
  },

  removeClient: async () => {
    try {
      await del(IDB_KEY);
    } catch (error) {
      console.warn('Erro ao remover do IndexedDB:', error);
    }
    // Sempre tenta limpar o LocalStorage também para garantir consistência
    try {
      localStorage.removeItem(IDB_KEY);
    } catch (lsError) {
      console.error('Erro ao remover do LocalStorage:', lsError);
    }
  },
};

/**
 * Opções de persistência para serem usadas no PersistQueryClientProvider.
 * Mantém maxAge de 24h e buster v1 conforme solicitado.
 */
export const persistOptions = {
  persister: indexedDBPersister,
  maxAge: 1000 * 60 * 60 * 24, // 24 horas
  buster: 'v2', // Versão do cache para invalidação forçada (atualizado para migração IDB)
};
