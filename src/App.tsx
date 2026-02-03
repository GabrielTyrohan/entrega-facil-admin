import { useEffect } from 'react';
import { Navigate, Route, HashRouter as Router, Routes } from 'react-router-dom';
import ErrorBoundary from './components/ErrorBoundary';
import MainLayout from './components/layout/MainLayout';
import PaymentStatusAutoChecker from './components/PaymentStatusAutoChecker';
import ProtectedRoute from './components/ProtectedRoute';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import CestasVendedor from './pages/CestasVendedor';
import ChangePasswordPage from './pages/ChangePasswordPage';
import Clientes from './pages/Clientes';
import Configuracoes from './pages/Configuracoes';
import Dashboard from './pages/Dashboard';
import Devedores from './pages/Devedores';
import EditarVendedor from './pages/EditarVendedor';
import Entregas from './pages/Entregas';
import MovimentacoesEstoque from './pages/Estoque/MovimentacoesEstoque';
import RelatorioEstoque from './pages/Estoque/RelatorioEstoque';

import LoginPage from './pages/LoginPage';
import NovaCesta from './pages/NovaCesta';
import NovoProduto from './pages/NovoProduto';
import NovoVendedor from './pages/NovoVendedor';
import Pagamentos from './pages/Pagamentos';
import Produtos from './pages/Produtos';
import Relatorios from './pages/Relatorios';
import Suporte from './pages/Suporte';
import Vendedores from './pages/Vendedores';

// Novos componentes e permissões
import { RequirePermission } from './components/Permissoes/RequirePermission';
import ListaAcertos from './pages/AcertosDiarios/ListaAcertos';
import NovoAcerto from './pages/AcertosDiarios/NovoAcerto';
import FluxoCaixa from './pages/Caixa/FluxoCaixa';
import LancamentoCaixa from './pages/Caixa/LancamentoCaixa';
import FuncionarioConfig from './pages/FuncionarioConfig';
import Funcionarios from './pages/Funcionarios';
import DetalhesOrcamento from './pages/orcamentos/DetalhesOrcamento';
import ListaOrcamentos from './pages/orcamentos/ListaOrcamentos';
import NovoOrcamento from './pages/orcamentos/NovoOrcamento';
import TabelaAtacado from './pages/TabelaPrecos/TabelaAtacado';
import ListaVendas from './pages/VendasAtacado/ListaVendas';
import NovaVendaAtacado from './pages/VendasAtacado/NovaVendaAtacado';

function App() {
  // Migração para IndexedDB e limpeza de cache antigo do LocalStorage
  useEffect(() => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const MIGRATION_KEY = 'migrated-to-idb';
        const isMigrated = localStorage.getItem(MIGRATION_KEY);

        if (!isMigrated) {
          console.log('Iniciando migração de cache para IndexedDB...');
          localStorage.removeItem('REACT_QUERY_OFFLINE_CACHE');
          Object.keys(localStorage).forEach((key) => {
            if (key.startsWith('REACT_QUERY')) {
              localStorage.removeItem(key);
            }
          });
          localStorage.setItem(MIGRATION_KEY, 'true');
          console.log('Migração para IndexedDB concluída com sucesso. Cache antigo do localStorage limpo.');
        }
      }
    } catch (error) {
      console.error('Erro crítico durante migração para IndexedDB:', error);
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
                        
                        <Route path="/estoque/movimentacoes" element={
                          <RequirePermission permission="caixa" redirectTo="/dashboard">
                            <MovimentacoesEstoque />
                          </RequirePermission>
                        } />
                        <Route path="/estoque/relatorio" element={
                          <RequirePermission permission="caixa" redirectTo="/dashboard">
                            <RelatorioEstoque />
                          </RequirePermission>
                        } />

                        {/* Rota de Relatórios Protegida */}
                        <Route path="/relatorios" element={
                          <RequirePermission permission="relatorios" redirectTo="/dashboard">
                            <Relatorios />
                          </RequirePermission>
                        } />

                        <Route path="/suporte" element={<Suporte />} />
                        <Route path="/configuracoes" element={<Configuracoes />} />
                        <Route path="/funcionario-config" element={<FuncionarioConfig />} />
                        <Route path="/funcionarios" element={<Funcionarios />} />
                        <Route path="/change-password" element={<ChangePasswordPage />} />

                        {/* Novas Rotas Protegidas */}
                        <Route path="/orcamentos-pj" element={
                          <RequirePermission permission="orcamentos_pj" redirectTo="/dashboard">
                            <ListaOrcamentos />
                          </RequirePermission>
                        } />
                        <Route path="/orcamentos-pj/novo" element={
                          <RequirePermission permission="orcamentos_pj" redirectTo="/dashboard">
                            <NovoOrcamento />
                          </RequirePermission>
                        } />
                        <Route path="/orcamentos-pj/:id" element={
                          <RequirePermission permission="orcamentos_pj" redirectTo="/dashboard">
                            <DetalhesOrcamento />
                          </RequirePermission>
                        } />
                        
                        <Route path="/vendas-atacado" element={
                          <RequirePermission permission="vendas_atacado" redirectTo="/dashboard">
                            <ListaVendas />
                          </RequirePermission>
                        } />
                        <Route path="/vendas-atacado/nova" element={
                          <RequirePermission permission="vendas_atacado" redirectTo="/dashboard">
                            <NovaVendaAtacado />
                          </RequirePermission>
                        } />
                        
                        <Route path="/acertos-diarios" element={
                          <RequirePermission permission="acertos" redirectTo="/dashboard">
                            <ListaAcertos />
                          </RequirePermission>
                        } />
                        <Route path="/acertos-diarios/novo" element={
                          <RequirePermission permission="acertos" redirectTo="/dashboard">
                            <NovoAcerto />
                          </RequirePermission>
                        } />
                        
                        <Route path="/caixa" element={
                          <RequirePermission permission="caixa" redirectTo="/dashboard">
                            <FluxoCaixa />
                          </RequirePermission>
                        } />
                        <Route path="/caixa/lancamento" element={
                          <RequirePermission permission="caixa" redirectTo="/dashboard">
                            <LancamentoCaixa />
                          </RequirePermission>
                        } />
                        
                        <Route path="/tabela-precos" element={
                          <RequirePermission permission="vendas_atacado" redirectTo="/dashboard">
                            <TabelaAtacado />
                          </RequirePermission>
                        } />

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
