import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { queryClient } from './lib/cache/cacheConfig'
import { persistOptions } from './lib/cache/indexedDBPersister'

// Dados que nunca vão para o disco (IndexedDB): precisam vir sempre frescos do servidor.
// Pelo prefixo, para valer também para chaves novas do Início ('dashboard_core', 'dashboard_top_vendedores'…).
const NAO_PERSISTIR = ['dashboard', 'view_estoque_atual', 'estoque_atual', 'pedidos_vendedor'];
const naoPersistir = (key: unknown) =>
  typeof key === 'string' && NAO_PERSISTIR.some((prefixo) => key.startsWith(prefixo));

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        ...persistOptions,
        dehydrateOptions: {
          shouldDehydrateQuery: (query) => {
            // Não persiste o Início, o estoque, os pedidos nem consultas com erro
            return !naoPersistir(query.queryKey[0]) && query.state.status === 'success';
          },
        },
      }}
    >
      <App />
      {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
    </PersistQueryClientProvider>
  </StrictMode>,
)