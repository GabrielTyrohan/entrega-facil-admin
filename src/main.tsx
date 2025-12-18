import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import './index.css'
import App from './App.tsx'
import { queryClient } from './lib/cache/cacheConfig'
import { persistOptions } from './lib/cache/indexedDBPersister'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PersistQueryClientProvider 
      client={queryClient} 
      persistOptions={persistOptions}
    >
      <App />
      {/* DevTools apenas em desenvolvimento */}
      {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
    </PersistQueryClientProvider>
  </StrictMode>,
)
