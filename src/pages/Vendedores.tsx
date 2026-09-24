import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Pagination } from "@/components/ui/pagination";
import { Skeleton } from "@/components/ui/Skeleton";
import VendedorModal from '@/components/ui/VendedorModal';
import { CheckCircle, Clock, Edit, Eye, MoreHorizontal, Plus, Trash2 } from 'lucide-react';
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../components/layout/PageHeader';
import { TableContainer, TableEmptyState, TableErrorState, TableToolbar } from '../components/table';
import { useAuth } from '../contexts/AuthContext';
import { useTotalEntregasPorAdministrador } from '../hooks/useDashboard';
import {
  useDeleteVendedor,
  useVendedores,
  type Vendedor
} from '../hooks/useVendedores';


const Vendedores: React.FC = () => {
  const navigate = useNavigate();
  const { user, adminId } = useAuth();
  const targetId = adminId || user?.id; // Usa adminId se for funcionário, ou user.id se for admin
  
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [selectedVendedor, setSelectedVendedor] = useState<Vendedor | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [vendedorParaExcluir, setVendedorParaExcluir] = useState<Vendedor | null>(null);

  // Debounce para busca server-side
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 450);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // React Query hooks para dados (busca server-side em todo o conjunto paginado)
  const { data, isLoading, error, refetch } = useVendedores(currentPage, debouncedSearchTerm || undefined);

  // Acessar os dados corretamente:
  const vendedores = data?.vendedores || [];
  const totalPages = data?.totalPages || 1;
  const total = data?.total || 0;

  const hasActiveSearch = searchTerm.trim() !== '';

  const clearSearch = () => {
    setSearchTerm('');
    setDebouncedSearchTerm('');
    setCurrentPage(0);
  };

  // Resetar página ao aplicar busca e evitar página inválida após filtro
  React.useEffect(() => {
    setCurrentPage(0);
  }, [debouncedSearchTerm]);

  React.useEffect(() => {
    if (totalPages > 0 && currentPage > totalPages - 1) {
      setCurrentPage(0);
    }
  }, [totalPages, currentPage]);

  const deleteVendedorMutation = useDeleteVendedor();
  
  // Hook para total de entregas por vendedor
  const { data: entregasPorVendedor = {}, isLoading: isLoadingEntregas } = useTotalEntregasPorAdministrador(targetId || '', {
    enabled: !!targetId
  });

  // Handlers para as ações do dropdown
  const handleViewVendedor = (vendedor: Vendedor) => {
    setSelectedVendedor(vendedor);
    setIsModalOpen(true);
  };

  const handleEditVendedor = (vendedor: Vendedor) => {
    navigate(`/vendedores/editar/${vendedor.id}`);
  };

  const handleDeleteVendedor = async (vendedor: Vendedor) => {
    try {
      // A API de delete espera um objeto com a chave primária
      await deleteVendedorMutation.mutateAsync({ id: vendedor.id });
    } catch {
      // Error handling without logging sensitive data
    }
  };

  // Dados já filtrados (server-side) e paginados pelo hook
  const currentVendedores = vendedores;

  // Formatação de data
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  // Formatação de percentual
  const formatPercentual = (percentual?: number | null) => {
    return percentual ? `${percentual}%` : 'N/A';
  };

  // Badge de tipo de vínculo
  const VinculoBadge = ({ tipo }: { tipo?: string | null }) => {
    const isAutonomo = tipo === 'autonomo';
    return (
      <span className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full ${
        isAutonomo
          ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
          : 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
      }`}>
        {isAutonomo ? 'Autônomo' : 'Representado'}
      </span>
    );
  };

  // Ícone de status de pagamento
  const PagamentoIcon = ({ status }: { status?: string | null }) => {
    if (status === 'pago') {
      return (
        <span title="Pagamento em dia">
          <CheckCircle className="w-4 h-4 text-green-500" />
        </span>
      );
    }
    if (status === 'pendente') {
      return (
        <span title="Aguardando pagamento" className="cursor-help">
          <Clock className="w-4 h-4 text-orange-500" />
        </span>
      );
    }
    // null = representado, admin paga — sem ícone
    return null;
  };

  // Formatação de telefone
  const formatPhone = (phone?: string | null) => {
    if (!phone) return 'N/A';
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 11) {
      return cleaned.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
    } else if (cleaned.length === 10) {
      return cleaned.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
    }
    return phone;
  };

  // Estados de loading e error do React Query
  if (isLoading) {
    return (
      <div className="space-y-4 sm:space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
          <Skeleton className="h-10 w-40 rounded-lg" />
        </div>

        {/* Filters Skeleton */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 sm:p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex flex-col space-y-3 sm:flex-row sm:space-y-0 sm:space-x-4">
            <Skeleton className="h-10 flex-1" />
          </div>
          <div className="mt-3 sm:mt-4 flex justify-between items-center">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-4 w-24" />
          </div>
        </div>

        {/* Vendedores Table Skeleton */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  {[...Array(9)].map((_, i) => (
                    <th key={i} className="px-6 py-3 text-left">
                      <Skeleton className="h-4 w-24" />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
                {[...Array(8)].map((_, i) => (
                  <tr key={i}>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-3">
                        <Skeleton className="h-8 w-8 rounded-full" />
                        <div className="space-y-1">
                          <Skeleton className="h-4 w-32" />
                          <Skeleton className="h-3 w-20" />
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 hidden sm:table-cell">
                      <div className="space-y-1">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-3 w-24" />
                      </div>
                    </td>
                    <td className="px-6 py-4 hidden md:table-cell">
                      <Skeleton className="h-6 w-20 rounded-full" />
                    </td>
                    <td className="px-6 py-4 hidden md:table-cell">
                      <Skeleton className="h-5 w-14 rounded-full" />
                    </td>
                    <td className="px-6 py-4 hidden md:table-cell">
                      <Skeleton className="h-5 w-5 rounded-full" />
                    </td>
                    <td className="px-6 py-4 hidden lg:table-cell">
                      <Skeleton className="h-5 w-10 rounded-full" />
                    </td>
                    <td className="px-6 py-4 hidden lg:table-cell">
                      <Skeleton className="h-4 w-12" />
                    </td>
                    <td className="px-6 py-4 hidden xl:table-cell">
                      <Skeleton className="h-4 w-24" />
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <Skeleton className="h-8 w-8 rounded-md" />
                        <Skeleton className="h-8 w-8 rounded-md" />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4 sm:space-y-6">
        <PageHeader title="Vendedores" description="Gerencie sua equipe de vendas" />
        <TableErrorState onRetry={() => refetch()} />
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader
        title="Vendedores"
        description="Gerencie sua equipe de vendas"
        actions={
          <button
            onClick={() => navigate('/vendedores/novo')}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 sm:py-2 rounded-lg font-medium flex items-center justify-center space-x-2 transition-colors touch-manipulation w-full sm:w-auto"
          >
            <Plus className="w-4 h-4" />
            <span>Novo Vendedor</span>
          </button>
        }
      />

      <TableToolbar
        search={{
          value: searchTerm,
          onChange: setSearchTerm,
          placeholder: 'Buscar vendedores...',
          ariaLabel: 'Buscar vendedores',
        }}
        resultText={`${total} vendedores encontrados`}
        trailingInfo={`Página ${currentPage + 1} de ${totalPages}`}
        onClearFilters={clearSearch}
        hasActiveFilters={hasActiveSearch}
        clearLabel="Limpar busca"
      />

      {/* Vendedores Table */}
      <TableContainer>
          <table className="w-full min-w-[900px]">
            <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0 z-10">
              <tr>
                <th scope="col" className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Vendedor
                </th>
                <th scope="col" className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider hidden sm:table-cell">
                  Contato
                </th>
                <th scope="col" className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider hidden md:table-cell">
                  Status
                </th>
                <th scope="col" className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider hidden md:table-cell">
                  Vínculo
                </th>
                <th scope="col" className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider hidden lg:table-cell">
                  Pgto.
                </th>
                <th scope="col" className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider hidden lg:table-cell">
                  Entregas
                </th>
                <th scope="col" className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider hidden lg:table-cell">
                  PERCENTUAL MÍN.
                </th>
                <th scope="col" className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider hidden xl:table-cell">
                  Data Cadastro
                </th>
                <th scope="col" className="px-3 sm:px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
              {currentVendedores.length === 0 ? (
                hasActiveSearch ? (
                  <TableEmptyState
                    colSpan={9}
                    title="Não encontramos resultados para os filtros atuais."
                    action={
                      <button
                        type="button"
                        onClick={clearSearch}
                        className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        Limpar busca
                      </button>
                    }
                  />
                ) : (
                  <TableEmptyState
                    colSpan={9}
                    title="Nenhum vendedor cadastrado"
                    description="Cadastre seu primeiro vendedor para começar."
                    action={
                      <button
                        type="button"
                        onClick={() => navigate('/vendedores/novo')}
                        className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Novo Vendedor</span>
                      </button>
                    }
                  />
                )
              ) : (
                currentVendedores.map((vendedor: Vendedor, index) => (
                  <tr
                    key={vendedor.id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors animate-fade-in-up"
                    style={{ animationDelay: `${index * 75}ms` }}
                  >
                    <td className="px-3 sm:px-6 py-3 sm:py-4">
                      <div className="flex items-center">
                        <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-medium flex-shrink-0">
                          {vendedor.nome.charAt(0).toUpperCase()}
                        </div>
                        <div className="ml-3 min-w-0 flex-1">
                          <div className="text-sm font-medium text-gray-900 dark:text-white truncate" title={vendedor.nome}>
                            {vendedor.nome}
                          </div>
                          {/* Mobile-only info */}
                          <div className="sm:hidden mt-1 space-y-1">
                            <div className="text-xs text-gray-600 dark:text-gray-400">
                              {vendedor.email || 'N/A'}
                            </div>
                            <div className="text-xs text-gray-600 dark:text-gray-400">
                              {formatPhone(vendedor.telefone)}
                            </div>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <div className="md:hidden">
                                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                  vendedor.ativo 
                                    ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                                    : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
                                }`}>
                                  {vendedor.ativo ? 'Ativo' : 'Inativo'}
                                </span>
                              </div>
                              <VinculoBadge tipo={vendedor.tipo_vinculo} />
                              <PagamentoIcon status={vendedor.status_pagamento_vendedor} />
                            </div>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap hidden sm:table-cell">
                      <div className="text-sm text-gray-900 dark:text-white" title={vendedor.email || undefined}>{vendedor.email || 'N/A'}</div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">{formatPhone(vendedor.telefone)}</div>
                    </td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap hidden md:table-cell">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        vendedor.ativo 
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                          : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
                      }`}>
                        {vendedor.ativo ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap hidden md:table-cell">
                      <VinculoBadge tipo={vendedor.tipo_vinculo} />
                    </td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap hidden lg:table-cell">
                      <div className="flex items-center">
                        <PagamentoIcon status={vendedor.status_pagamento_vendedor} />
                      </div>
                    </td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap hidden lg:table-cell">
                       {isLoadingEntregas ? (
                         <div className="animate-pulse bg-gray-200 dark:bg-gray-600 h-4 w-8 rounded"></div>
                       ) : (
                         <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400">
                           {entregasPorVendedor[vendedor.id] || 0}
                         </span>
                       )}
                     </td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white hidden lg:table-cell">
                      {formatPercentual(vendedor.percentual_minimo)}
                    </td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white hidden xl:table-cell">
                      {formatDate(vendedor.created_at)}
                    </td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-1">

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              aria-label={`Ações do vendedor ${vendedor.nome}`}
                              aria-haspopup="menu"
                              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-2 touch-manipulation"
                              disabled={deleteVendedorMutation.isPending}
                            >
                              <MoreHorizontal className="w-4 h-4" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleViewVendedor(vendedor)}>
                              <Eye className="w-4 h-4 mr-2" />
                              Visualizar
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleEditVendedor(vendedor)}>
                              <Edit className="w-4 h-4 mr-2" />
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => setVendedorParaExcluir(vendedor)}
                              className="text-red-600 dark:text-red-400"
                              disabled={deleteVendedorMutation.isPending}
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              {deleteVendedorMutation.isPending ? 'Excluindo...' : 'Excluir'}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
      </TableContainer>

      {/* Paginação */}
      {totalPages > 1 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalCount={total}
          pageSize={15}
          onPageChange={setCurrentPage}
        />
      )}
      
      {/* Modal de Visualização */}
      <VendedorModal 
        vendedor={selectedVendedor}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />



      {vendedorParaExcluir && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg w-[90%] max-w-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Confirmar exclusão</h3>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              Tem certeza que deseja excluir o vendedor {vendedorParaExcluir.nome}?
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                onClick={() => setVendedorParaExcluir(null)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                disabled={deleteVendedorMutation.isPending}
                onClick={async () => {
                  await handleDeleteVendedor(vendedorParaExcluir);
                  setVendedorParaExcluir(null);
                }}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Vendedores;