import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import ProtectedRoute from './components/ProtectedRoute';
import ErrorBoundary from './components/ErrorBoundary';
import PaymentStatusAutoChecker from './components/PaymentStatusAutoChecker';
// import PaymentVerification from './components/PaymentVerification'; // Removido para evitar logout automático
import LoginPage from './pages/LoginPage';
import MainLayout from './components/layout/MainLayout';
import Dashboard from './pages/Dashboard';
import Vendedores from './pages/Vendedores';
import NovoVendedor from './pages/NovoVendedor';
import EditarVendedor from './pages/EditarVendedor';
import NovoProduto from './pages/NovoProduto';
import CestasVendedor from './pages/CestasVendedor';
import NovaCesta from './pages/NovaCesta';
import Clientes from './pages/Clientes';
import Entregas from './pages/Entregas';
import Pagamentos from './pages/Pagamentos';
import Devedores from './pages/Devedores';
import Produtos from './pages/Produtos';
import Relatorios from './pages/Relatorios';
import Suporte from './pages/Suporte';
import Configuracoes from './pages/Configuracoes';
import ChangePasswordPage from './pages/ChangePasswordPage';
import { initializeConsoleOverride } from './utils/consoleOverride';
import { initializeDevToolsDetector } from './utils/devToolsDetector';
import { useEffect } from 'react';

function App() {
  // Initialize security measures
  useEffect(() => {
    initializeConsoleOverride();
    initializeDevToolsDetector();
  }, []);

  // Migração para IndexedDB e limpeza de cache antigo do LocalStorage
  useEffect(() => {
    try {
      // Verificação defensiva se localStorage está disponível
      if (typeof window !== 'undefined' && window.localStorage) {
        const MIGRATION_KEY = 'migrated-to-idb';
        const isMigrated = localStorage.getItem(MIGRATION_KEY);

        if (!isMigrated) {
          console.log('Iniciando migração de cache para IndexedDB...');

          // 1. Limpar chave principal do React Query no localStorage
          // Isso força o React Query a começar com um cache limpo no IndexedDB
          localStorage.removeItem('REACT_QUERY_OFFLINE_CACHE');

          // 2. Limpar outras chaves relacionadas ao React Query para evitar conflitos e liberar espaço
          Object.keys(localStorage).forEach((key) => {
            if (key.startsWith('REACT_QUERY')) {
              localStorage.removeItem(key);
            }
          });

          // 3. Marcar como migrado para não executar novamente
          localStorage.setItem(MIGRATION_KEY, 'true');
          
          // O cache-buster foi atualizado para 'v2' no arquivo src/lib/cache/indexedDBPersister.ts
          // Isso garante que qualquer resquício de cache antigo seja invalidado pelo PersistQueryClient
          
          console.log('Migração para IndexedDB concluída com sucesso. Cache antigo do localStorage limpo.');
        } else {
          // Já migrado, não faz nada
        }
      }
    } catch (error) {
      console.error('Erro crítico durante migração para IndexedDB:', error);
      // Não bloqueia a renderização do app mesmo com erro na migração
    }
  }, []);

  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <PaymentStatusAutoChecker />
          <Router>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route
                path="/*"
                element={
                  <ProtectedRoute>
                    <MainLayout>
                      <Routes>
                        <Route path="/" element={<Navigate to="/dashboard" replace />} />
                        <Route path="/dashboard" element={<Dashboard />} />
                        <Route path="/vendedores" element={<Vendedores />} />
                        <Route path="/vendedores/novo" element={<NovoVendedor />} />
                        <Route path="/vendedores/editar/:id" element={<EditarVendedor />} />
                        <Route path="/produtos/novo" element={<NovoProduto />} />
                        <Route path="/produtos/cestas" element={<CestasVendedor />} />
                      <Route path="/produtos/cestas/nova" element={<NovaCesta />} />
                      <Route path="/clientes" element={<Clientes />} />
                      <Route path="/entregas" element={<Entregas />} />
                      <Route path="/pagamentos" element={<Pagamentos />} />
                      <Route path="/devedores" element={<Devedores />} />
                      <Route path="/produtos" element={<Produtos />} />
                      <Route path="/relatorios" element={<Relatorios />} />
                        <Route path="/suporte" element={<Suporte />} />
                        <Route path="/configuracoes" element={<Configuracoes />} />
                        <Route path="/alterar-senha" element={<ChangePasswordPage />} />
                      </Routes>
                  </MainLayout>
                </ProtectedRoute>
              }
            />
          </Routes>
        </Router>
      </AuthProvider>
    </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
