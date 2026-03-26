import { useEffect } from 'react';
import { Navigate, Route, HashRouter as Router, Routes, useLocation } from 'react-router-dom';
import ErrorBoundary from './components/ErrorBoundary';
import MainLayout from './components/layout/MainLayout';
import PaymentStatusAutoChecker from './components/PaymentStatusAutoChecker';
import ProtectedRoute from './components/ProtectedRoute';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import CestasVendedor from './pages/CestasVendedor';
import ChangePasswordPage from './pages/ChangePasswordPage';
import Clientes from './pages/Clientes';
import Configuracoes from './pages/Configuracoes';
import Dashboard from './pages/Dashboard';
import Devedores from './pages/Devedores';
import EditarVendedor from './pages/EditarVendedor';
import EntregaAvulsa from './pages/EntregaAvulsa';
import Entregas from './pages/Entregas';
import MovimentacoesEstoque from './pages/Estoque/MovimentacoesEstoque';
import RelatorioEstoque from './pages/Estoque/RelatorioEstoque';
import NovaEntrega from './pages/NovaEntrega';

import DetalheAcerto from './pages/AcertosDiarios/DetalhesAcerto';
import CestasBase from './pages/CestasBase';
import EditarCesta from './pages/EditarCesta';
import EditarCestaBase from './pages/EditarCestaBase';
import LoginPage from './pages/LoginPage';
import NovaCesta from './pages/NovaCesta';
import NovaCestaBase from './pages/NovaCestaBase';
import NovoProduto from './pages/NovoProduto';
import NovoVendedor from './pages/NovoVendedor';
import Pagamentos from './pages/Pagamentos';
import Produtos from './pages/Produtos';
import Relatorios from './pages/Relatorios';
import Suporte from './pages/Suporte';
import Vendedores from './pages/Vendedores';

import { Toaster } from 'sonner';
import RequirePermission, { isRotaExpedicaoPermitida } from './components/Permissoes/RequirePermission';
import ListaAcertos from './pages/AcertosDiarios/ListaAcertos';
import NovoAcerto from './pages/AcertosDiarios/NovoAcerto';
import FluxoCaixa from './pages/Caixa/FluxoCaixa';
import NovoLancamento from './pages/Caixa/NovoLancamento';
import ConfiguracoesFiscais from './pages/ConfiguracoesFiscais';
import FuncionarioConfig from './pages/FuncionarioConfig';
import Funcionarios from './pages/Funcionarios';
import DetalhesOrcamento from './pages/orcamentos/DetalhesOrcamento';
import ListaOrcamentos from './pages/orcamentos/ListaOrcamentos';
import NovoOrcamento from './pages/orcamentos/NovoOrcamento';
import TabelaAtacado from './pages/TabelaPrecos/TabelaAtacado';
import DetalhesVendaAtacado from './pages/VendasAtacado/DetalhesVendaAtacado';
import ListaVendas from './pages/VendasAtacado/ListaVendas';
import NovaVendaAtacado from './pages/VendasAtacado/NovaVendaAtacado';

function ExpedicaoGuard({ children }: { children: React.ReactNode }) {
  const { userType, permissions } = useAuth();
  const location = useLocation();
  if (userType !== 'admin' && permissions?.expedicao) {
    if (!isRotaExpedicaoPermitida(location.pathname))
      return <Navigate to='/produtos/cestas' replace />;
  }
  return <>{children}</>;
}

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
    <>
     <Toaster position="top-right" richColors />
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
                        <Route path="*" element={<Navigate to="/dashboard" replace />} />

                        {/* Rotas SEM guard extra (apenas autenticação) */}
                        <Route path="/funcionario-config" element={<FuncionarioConfig />} />
                        <Route path="/change-password" element={<ChangePasswordPage />} />
                        <Route path="/suporte" element={<Suporte />} />
                        <Route path="/produtos/cestas" element={<CestasVendedor />} />
                        <Route path="/produtos/cestas/nova" element={<NovaCesta />} />
                        <Route path="/produtos/cestas/editar/:id" element={<EditarCesta />} />
                        <Route path="/entregas/avulsas" element={<EntregaAvulsa />} />

                        {/* Rotas com <ExpedicaoGuard> */}
                        <Route path="/dashboard" element={<ExpedicaoGuard><Dashboard /></ExpedicaoGuard>} />
                        
                        <Route path="/vendedores" element={<ExpedicaoGuard><Vendedores /></ExpedicaoGuard>} />
                        <Route path="/vendedores/novo" element={<ExpedicaoGuard><NovoVendedor /></ExpedicaoGuard>} />
                        <Route path="/vendedores/editar/:id" element={<ExpedicaoGuard><EditarVendedor /></ExpedicaoGuard>} />
                        
                        <Route path="/clientes" element={<ExpedicaoGuard><Clientes /></ExpedicaoGuard>} />
                        <Route path="/devedores" element={<ExpedicaoGuard><Devedores /></ExpedicaoGuard>} />
                        
                        <Route path="/produtos" element={<ExpedicaoGuard><Produtos /></ExpedicaoGuard>} />
                        <Route path="/produtos/novo" element={<ExpedicaoGuard><NovoProduto /></ExpedicaoGuard>} />
                        
                        <Route path="/produtos/cestas-base" element={<ExpedicaoGuard><CestasBase /></ExpedicaoGuard>} />
                        <Route path="/produtos/cestas-base/nova" element={<ExpedicaoGuard><NovaCestaBase /></ExpedicaoGuard>} />
                        <Route path="/produtos/cestas-base/editar/:id" element={<ExpedicaoGuard><EditarCestaBase /></ExpedicaoGuard>} />
                        
                        <Route path="/entregas" element={<ExpedicaoGuard><Entregas /></ExpedicaoGuard>} />
                        <Route path="/entregas/nova" element={<ExpedicaoGuard><NovaEntrega /></ExpedicaoGuard>} />
                        
                        <Route path="/pagamentos" element={<ExpedicaoGuard><Pagamentos /></ExpedicaoGuard>} />
                        <Route path="/configuracoes" element={<ExpedicaoGuard><Configuracoes /></ExpedicaoGuard>} />
                        <Route path="/funcionarios" element={<ExpedicaoGuard><Funcionarios /></ExpedicaoGuard>} />

                        {/* Rotas com <ExpedicaoGuard> + <RequirePermission> */}
                        <Route path="/configuracoes-fiscais" element={
                          <ExpedicaoGuard>
                            <RequirePermission permission="configuracoes_fiscais">
                              <ConfiguracoesFiscais />
                            </RequirePermission>
                          </ExpedicaoGuard>
                        } />

                        <Route path="/relatorios" element={
                          <ExpedicaoGuard>
                            <RequirePermission permission="relatorios">
                              <Relatorios />
                            </RequirePermission>
                          </ExpedicaoGuard>
                        } />

                        <Route path="/orcamentos-pj" element={
                          <ExpedicaoGuard>
                            <RequirePermission permission="orcamentos_pj">
                              <ListaOrcamentos />
                            </RequirePermission>
                          </ExpedicaoGuard>
                        } />
                        <Route path="/orcamentos-pj/novo" element={
                          <ExpedicaoGuard>
                            <RequirePermission permission="orcamentos_pj">
                              <NovoOrcamento />
                            </RequirePermission>
                          </ExpedicaoGuard>
                        } />
                        <Route path="/orcamentos-pj/:id" element={
                          <ExpedicaoGuard>
                            <RequirePermission permission="orcamentos_pj">
                              <DetalhesOrcamento />
                            </RequirePermission>
                          </ExpedicaoGuard>
                        } />

                        <Route path="/vendas-atacado" element={
                          <ExpedicaoGuard>
                            <RequirePermission permission="vendas_atacado">
                              <ListaVendas />
                            </RequirePermission>
                          </ExpedicaoGuard>
                        } />
                        <Route path="/vendas-atacado/nova" element={
                          <ExpedicaoGuard>
                            <RequirePermission permission="vendas_atacado">
                              <NovaVendaAtacado />
                            </RequirePermission>
                          </ExpedicaoGuard>
                        } />
                        <Route path="/vendas-atacado/:id" element={
                          <ExpedicaoGuard>
                            <RequirePermission permission="vendas_atacado">
                              <DetalhesVendaAtacado />
                            </RequirePermission>
                          </ExpedicaoGuard>
                        } />

                        <Route path="/tabela-precos" element={
                          <ExpedicaoGuard>
                            <RequirePermission permission="vendas_atacado">
                              <TabelaAtacado />
                            </RequirePermission>
                          </ExpedicaoGuard>
                        } />

                        <Route path="/acertos-diarios" element={
                          <ExpedicaoGuard>
                            <RequirePermission permission="acertos">
                              <ListaAcertos />
                            </RequirePermission>
                          </ExpedicaoGuard>
                        } />
                        <Route path="/acertos-diarios/novo" element={
                          <ExpedicaoGuard>
                            <RequirePermission permission="acertos">
                              <NovoAcerto />
                            </RequirePermission>
                          </ExpedicaoGuard>
                        } />
                        <Route path="/acertos-diarios/:id" element={
                          <ExpedicaoGuard>
                            <RequirePermission permission="acertos">
                              <DetalheAcerto />
                            </RequirePermission>
                          </ExpedicaoGuard>
                        } />

                        <Route path="/caixa" element={
                          <ExpedicaoGuard>
                            <RequirePermission permission="caixa">
                              <FluxoCaixa />
                            </RequirePermission>
                          </ExpedicaoGuard>
                        } />
                        <Route path="/caixa/lancamento" element={
                          <ExpedicaoGuard>
                            <RequirePermission permission="caixa">
                              <NovoLancamento />
                            </RequirePermission>
                          </ExpedicaoGuard>
                        } />

                        <Route path="/estoque/movimentacoes" element={
                          <ExpedicaoGuard>
                            <RequirePermission permission="caixa">
                              <MovimentacoesEstoque />
                            </RequirePermission>
                          </ExpedicaoGuard>
                        } />
                        <Route path="/estoque/relatorio" element={
                          <ExpedicaoGuard>
                            <RequirePermission permission="caixa">
                              <RelatorioEstoque />
                            </RequirePermission>
                          </ExpedicaoGuard>
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
    </>
  );
}

export default App;
