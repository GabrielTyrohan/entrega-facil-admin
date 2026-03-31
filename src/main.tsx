import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { queryClient } from './lib/cache/cacheConfig'
import { persistOptions } from './lib/cache/indexedDBPersister'

// Queries do dashboard nunca são persistidas no IndexedDB
// pois precisam ser sempre buscadas frescas do servidor
const DASHBOARD_KEYS = [
  'dashboard_stats',
  'dashboard_entregas_hoje',
  'dashboard_grafico',
  'dashboard_inadimplencia',
  'dashboard_top_produtos',
  'dashboard_estoque',
  'dashboard_acertos',
  'dashboard_vendedores',
  'dashboard_charts',
  'dashboard_fluxo',
]

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        ...persistOptions,
        dehydrateOptions: {
          shouldDehydrateQuery: (query) => {
            const key = query.queryKey[0] as string;
            // Não persiste queries do dashboard nem queries com erro
            return !DASHBOARD_KEYS.includes(key) && query.state.status !== 'error';
          },
        },
      }}
    >
      <App />
      {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
    </PersistQueryClientProvider>
  </StrictMode>,
)