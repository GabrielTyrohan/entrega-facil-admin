import { get, set, del } from 'idb-keyval';

export interface IndexedDBStatus {
  available: boolean;
  working: boolean;
  error?: string;
}

/**
 * Valida se o IndexedDB está disponível e funcionando corretamente.
 * Realiza um ciclo completo de escrita, leitura e remoção de um valor de teste.
 * 
 * @returns Promise com o status da validação
 */
export async function validateIndexedDB(): Promise<IndexedDBStatus> {
  // 1. Verificar disponibilidade da API no navegador
  if (typeof window === 'undefined' || !window.indexedDB) {
    return {
      available: false,
      working: false,
      error: 'IndexedDB API não está disponível neste navegador.'
    };
  }

  const TEST_KEY = 'idb-validation-test';
  const TEST_VALUE = { timestamp: Date.now(), status: 'ok' };

  try {
    // 2. Tentar escrever um valor de teste
    await set(TEST_KEY, TEST_VALUE);

    // 3. Tentar ler o valor de teste
    const value = await get(TEST_KEY);

    // Verificar integridade dos dados
    if (!value || value.timestamp !== TEST_VALUE.timestamp) {
      throw new Error('Falha na verificação de integridade dos dados (valor lido difere do gravado).');
    }

    // 4. Remover o valor de teste (limpeza)
    await del(TEST_KEY);

    return {
      available: true,
      working: true
    };

  } catch (error) {
    console.error('Falha na validação do IndexedDB:', error);
    
    // Tenta limpar em caso de erro parcial para não deixar lixo
    try { await del(TEST_KEY); } catch (e) { /* ignorar erro de limpeza */ }

    return {
      available: true,
      working: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido durante teste de leitura/escrita no IndexedDB.'
    };
  }
}
