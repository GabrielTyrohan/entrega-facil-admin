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
