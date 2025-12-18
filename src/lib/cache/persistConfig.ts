import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';

// Configurar persistência no LocalStorage (adaptado para Web)
export const localStoragePersister = createSyncStoragePersister({
  storage: window.localStorage,
  throttleTime: 1000, // Salva no máximo a cada 1 segundo
});

// Configuração de persistência
export const persistOptions = {
  persister: localStoragePersister,
  maxAge: 1000 * 60 * 60 * 24, // 24 horas
  buster: 'v1', // Versão do cache (mude para limpar cache antigo)
};
