import { PersistedClient, Persister } from '@tanstack/react-query-persist-client'; 
import { get, set, del } from 'idb-keyval'; 

let isIndexedDBAvailable = true; 

// Testar se IndexedDB funciona 
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

// Inicializar teste 
testIndexedDB().then(result => { 
  isIndexedDBAvailable = result; 
}); 

// CORREÇÃO: Usar createSyncStoragePersister ou custom persister 
export const indexedDBPersister: Persister = { 
  persistClient: async (client: PersistedClient) => { 
    if (!isIndexedDBAvailable) return; 
    try { 
      await set('tanstack-query-cache', client); 
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
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 dias
  buster: 'v2',
};
