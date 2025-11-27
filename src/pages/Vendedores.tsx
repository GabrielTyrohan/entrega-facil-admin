import React, { useState, useMemo } from 'react';
import { Plus, Search, MoreHorizontal, Edit, Trash2, Eye, Key } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import VendedorModal from '@/components/ui/VendedorModal';
import { 
  useVendedores, 
  useDeleteVendedor,
  type Vendedor 
} from '../hooks/useVendedores';
import { useTotalEntregasPorAdministrador } from '../hooks/useDashboard';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { toast } from '@/utils/toast';

const Vendedores: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedVendedor, setSelectedVendedor] = useState<Vendedor | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [vendedorParaExcluir, setVendedorParaExcluir] = useState<Vendedor | null>(null);
  const [resetModal, setResetModal] = useState<{ 
    visible: boolean; 
    vendedor?: any; 
    novaSenha?: string; 
  }>({ visible: false });

  // React Query hooks para dados
  const { data: vendedores = [], isLoading, error } = useVendedores({
    administrador_id: user?.id || '',
    enabled: !!user?.id
  }) as { data: Vendedor[]; isLoading: boolean; error: unknown };
  const deleteVendedorMutation = useDeleteVendedor();
  
  // Hook para total de entregas por vendedor
  const { data: entregasPorVendedor = {}, isLoading: isLoadingEntregas } = useTotalEntregasPorAdministrador(user?.id || '', {
    enabled: !!user?.id
  });

  // Função para calcular itens por página baseado no tamanho da tela
  const calculateItemsPerPage = () => {
    const height = window.innerHeight;
    const width = window.innerWidth;
    
    // Altura disponível para a tabela (descontando header, filtros, etc.)
    const availableHeight = height - 400; // ~400px para header, filtros, paginação
    const rowHeight = 73; // altura aproximada de cada linha da tabela
    
    let baseItemsPerPage = Math.floor(availableHeight / rowHeight);
    
    // Ajustar baseado na largura da tela para melhor experiência
    if (width >= 1920) { // 4K ou maior
      baseItemsPerPage = Math.max(baseItemsPerPage, 15);
    } else if (width >= 1440) { // Desktop grande
      baseItemsPerPage = Math.max(baseItemsPerPage, 12);
    } else if (width >= 1024) { // Desktop padrão
      baseItemsPerPage = Math.max(baseItemsPerPage, 10);
    } else { // Tablet/Mobile
      baseItemsPerPage = Math.max(baseItemsPerPage, 8);
    }
    
    // Garantir um mínimo e máximo razoável
    return Math.min(Math.max(baseItemsPerPage, 5), 25);
  };

  // Atualizar itens por página quando a tela redimensionar
  React.useEffect(() => {
    const handleResize = () => {
      const newItemsPerPage = calculateItemsPerPage();
      setItemsPerPage(newItemsPerPage);
      
      // Ajustar página atual se necessário
      const maxPage = Math.ceil(vendedores.length / newItemsPerPage);
      if (currentPage > maxPage && maxPage > 0) {
        setCurrentPage(maxPage);
      }
    };

    handleResize(); // Calcular inicial
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [vendedores.length, currentPage]);

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

  const handleResetSenha = async (vendedor: Vendedor) => {
    if (!window.confirm(`Resetar senha de ${vendedor.nome}?`)) return;

    try {
      const novaSenha = Math.floor(100000 + Math.random() * 900000).toString();
      
      const { data, error } = await supabase.rpc('reset_senha_vendedor', {
        p_vendedor_id: vendedor.id,
        p_nova_senha: novaSenha
      });

      if (error) {
        if (error.message.includes('Apenas administradores')) {
          toast.error('Você não tem permissão');
        } else if (error.message.includes('não encontrado')) {
          toast.error('Vendedor não encontrado');
        } else {
          toast.error('Erro: ' + error.message);
        }
        return;
      }

      if (data?.success) {
        setResetModal({ visible: true, vendedor, novaSenha });
        toast.success('Senha resetada com sucesso!');
      }
    } catch (error: any) {
      toast.error('Erro: ' + error.message);
    }
  };




  const copiarSenha = () => {
    if (resetModal.novaSenha) {
      navigator.clipboard.writeText(resetModal.novaSenha);
      toast.success('Senha copiada!');
    }
  };

  // Filtrar vendedores baseado no termo de busca e ordenar por total de entregas (decrescente)
  const filteredVendedores = useMemo(() => {
    const filtered = vendedores.filter((vendedor: Vendedor) =>
      vendedor.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      vendedor.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      vendedor.telefone?.includes(searchTerm)
    );

    // Ordenar por total de entregas de forma decrescente (maior número primeiro)
    return filtered.sort((a: Vendedor, b: Vendedor) => {
      const entregasA = entregasPorVendedor[a.id] || 0;
      const entregasB = entregasPorVendedor[b.id] || 0;
      
      // Primeiro critério: total de entregas (decrescente)
      if (entregasA !== entregasB) {
        return entregasB - entregasA;
      }
      
      // Segundo critério: status ativo (ativos primeiro)
      if (a.ativo !== b.ativo) {
        return a.ativo ? -1 : 1;
      }
      
      // Terceiro critério: nome alfabético
      return a.nome.localeCompare(b.nome, 'pt-BR');
    });
  }, [vendedores, searchTerm, entregasPorVendedor]);

  // Lógica de paginação
  const totalPages = Math.ceil(filteredVendedores.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentVendedores = filteredVendedores.slice(startIndex, endIndex);

  // Reset página quando filtro mudar
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  // Função para gerar números das páginas
  const getPageNumbers = () => {
    const pages = [];
    const maxVisiblePages = window.innerWidth >= 768 ? 7 : 5; // Mais páginas em telas maiores
    
    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      const halfVisible = Math.floor(maxVisiblePages / 2);
      let startPage = Math.max(1, currentPage - halfVisible);
      const endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
      
      if (endPage - startPage < maxVisiblePages - 1) {
        startPage = Math.max(1, endPage - maxVisiblePages + 1);
      }
      
      for (let i = startPage; i <= endPage; i++) {
        pages.push(i);
      }
    }
    
    return pages;
  };

  // Formatação de data
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  // Formatação de percentual
  const formatPercentual = (percentual?: number) => {
    return percentual ? `${percentual}%` : 'N/A';
  };

  // Formatação de telefone
  const formatPhone = (phone?: string) => {
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
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Vendedores</h1>
            <p className="text-gray-600 dark:text-gray-400">Gerencie sua equipe de vendas</p>
          </div>
        </div>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Vendedores</h1>
            <p className="text-gray-600 dark:text-gray-400">Gerencie sua equipe de vendas</p>
          </div>
        </div>
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-600 dark:text-red-400">
            {error instanceof Error ? error.message : 'Erro ao carregar vendedores'}
          </p>
          <button 
            onClick={() => window.location.reload()}
            className="mt-2 text-red-600 dark:text-red-400 underline hover:no-underline"
          >
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">Vendedores</h1>
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">Gerencie sua equipe de vendas</p>
        </div>
        <button 
          onClick={() => navigate('/vendedores/novo')}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 sm:py-2 rounded-lg font-medium flex items-center justify-center space-x-2 transition-colors touch-manipulation"
        >
          <Plus className="w-4 h-4" />
          <span>Novo Vendedor</span>
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 sm:p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="flex flex-col space-y-3 sm:flex-row sm:space-y-0 sm:space-x-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar vendedores..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2.5 sm:py-2 w-full border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent touch-manipulation"
            />
          </div>
        </div>
        
        {/* Informações de paginação */}
        <div className="mt-3 sm:mt-4 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 text-xs sm:text-sm text-gray-600 dark:text-gray-400">
          <span>
            Mostrando {startIndex + 1} a {Math.min(endIndex, filteredVendedores.length)} de {filteredVendedores.length} vendedores
          </span>
          <span>
            {itemsPerPage} por página
          </span>
        </div>
      </div>

      {/* Vendedores Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Vendedor
                </th>
                <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider hidden sm:table-cell">
                  Contato
                </th>
                <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider hidden md:table-cell">
                  Status
                </th>
                <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider hidden lg:table-cell">
                  Entregas
                </th>
                <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider hidden lg:table-cell">
                  PERCENTUAL.MIN
                </th>
                <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider hidden xl:table-cell">
                  Data Cadastro
                </th>
                <th className="px-3 sm:px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
              {currentVendedores.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 sm:px-6 py-8 sm:py-12 text-center">
                    <div className="text-sm sm:text-base text-gray-500 dark:text-gray-400">
                      {searchTerm ? 'Nenhum vendedor encontrado com os critérios de busca.' : 'Nenhum vendedor cadastrado ainda.'}
                    </div>
                  </td>
                </tr>
              ) : (
                currentVendedores.map((vendedor: Vendedor) => (
                  <tr key={vendedor.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-3 sm:px-6 py-3 sm:py-4">
                      <div className="flex items-center">
                        <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-medium flex-shrink-0">
                          {vendedor.nome.charAt(0).toUpperCase()}
                        </div>
                        <div className="ml-3 min-w-0 flex-1">
                          <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                            {vendedor.nome}
                          </div>
                          <div className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 truncate">
                            ID: {vendedor.id.slice(0, 8)}...
                          </div>
                          {/* Mobile-only info */}
                          <div className="sm:hidden mt-1 space-y-1">
                            <div className="text-xs text-gray-600 dark:text-gray-400">
                              {vendedor.email || 'N/A'}
                            </div>
                            <div className="text-xs text-gray-600 dark:text-gray-400">
                              {formatPhone(vendedor.telefone)}
                            </div>
                            <div className="md:hidden">
                              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                vendedor.ativo 
                                  ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                                  : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
                              }`}>
                                {vendedor.ativo ? 'Ativo' : 'Inativo'}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap hidden sm:table-cell">
                      <div className="text-sm text-gray-900 dark:text-white">{vendedor.email || 'N/A'}</div>
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
                    <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white hidden lg:table-cell">
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
                        <button 
                          onClick={() => handleResetSenha(vendedor)} 
                          className="p-2 text-yellow-600 hover:text-yellow-800 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 rounded-md transition-colors"
                          title="Resetar senha"
                          type="button"
                        >
                          <Key className="w-4 h-4" />
                        </button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button 
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
        </div>
      </div>

      {/* Paginação */}
      {totalPages > 1 && (
        <div className="flex justify-center px-4">
          <Pagination>
            <PaginationContent className="flex-wrap gap-1">
              <PaginationItem>
                <PaginationPrevious 
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    if (currentPage > 1) setCurrentPage(currentPage - 1);
                  }}
                  className={`${currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'} touch-manipulation`}
                  size="default"
                />
              </PaginationItem>
              
              {getPageNumbers().map((pageNum, index, array) => {
                const showEllipsisBefore = index === 0 && pageNum > 1;
                const showEllipsisAfter = index === array.length - 1 && pageNum < totalPages;
                
                return (
                  <React.Fragment key={pageNum}>
                    {showEllipsisBefore && (
                      <PaginationItem>
                        <PaginationEllipsis />
                      </PaginationItem>
                    )}
                    
                    <PaginationItem>
                      <PaginationLink
                        href="#"
                        onClick={(e) => {
                          e.preventDefault();
                          setCurrentPage(pageNum);
                        }}
                        isActive={currentPage === pageNum}
                        className="cursor-pointer touch-manipulation"
                        size="default"
                      >
                        {pageNum}
                      </PaginationLink>
                    </PaginationItem>
                    
                    {showEllipsisAfter && (
                      <PaginationItem>
                        <PaginationEllipsis />
                      </PaginationItem>
                    )}
                  </React.Fragment>
                );
              })}
              
              <PaginationItem>
                <PaginationNext 
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    if (currentPage < totalPages) setCurrentPage(currentPage + 1);
                  }}
                  className={`${currentPage === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'} touch-manipulation`}
                  size="default"
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}
      
      {/* Modal de Visualização */}
      <VendedorModal 
        vendedor={selectedVendedor}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />

      {resetModal.visible && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center">
                <Key className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Nova Senha Gerada</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">{resetModal.vendedor?.nome}</p>
              </div>
            </div>

            <div className="mb-4">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Senha temporária:</p>
              <div className="bg-gray-100 dark:bg-gray-700 p-4 rounded-lg flex items-center justify-between gap-3">
                <span className="text-3xl font-mono font-bold tracking-widest text-gray-900 dark:text-white">
                  {resetModal.novaSenha}
                </span>
                <button
                  onClick={copiarSenha}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium transition-colors flex-shrink-0"
                  type="button"
                >
                  Copiar
                </button>
              </div>
            </div>

            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg p-3 mb-4">
              <p className="text-xs text-yellow-800 dark:text-yellow-400 flex items-start gap-2">
                <span className="text-base">⚠️</span>
                <span>
                  Anote esta senha agora! Não poderá ser recuperada depois. Repasse ao vendedor por telefone/WhatsApp.
                </span>
              </p>
            </div>

            <button
              onClick={() => setResetModal({ visible: false })}
              className="w-full px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-900 dark:text-white rounded-md font-medium transition-colors"
              type="button"
            >
              Fechar
            </button>
          </div>
        </div>
      )}

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
