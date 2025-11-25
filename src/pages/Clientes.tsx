import React, { useState, useMemo } from 'react';
import { Search, MoreHorizontal, Eye, Edit, Trash2 } from 'lucide-react';
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
import { 
  useClientesByAdmin, 
  useDeleteCliente,
  type Cliente 
} from '../hooks/useClientes';
import { 
  useVendedoresByAdmin,
  type Vendedor 
} from '../hooks/useVendedores';
import { useAuth } from '../contexts/AuthContext';
import ClienteModal from '../components/ui/ClienteModal';
import EditClienteModal from '../components/ui/EditClienteModal';

const Clientes: React.FC = () => {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedVendedor, setSelectedVendedor] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [clienteToEdit, setClienteToEdit] = useState<Cliente | null>(null);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [clienteParaExcluir, setClienteParaExcluir] = useState<Cliente | null>(null);

  // Usar hooks de cache para buscar dados
  const { 
    data: clientesData = [], 
    isLoading, 
    error,
    refetch 
  } = useClientesByAdmin(user?.id || '');

  // Buscar vendedores do admin
  const { 
    data: vendedoresData = [] 
  } = useVendedoresByAdmin(user?.id || '');

  // Tipar os dados corretamente
  const clientes = clientesData as Cliente[];
  const vendedores = vendedoresData as Vendedor[];

  // Hook para deletar cliente
  const deleteClienteMutation = useDeleteCliente();

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
      const maxPage = Math.ceil(clientes.length / newItemsPerPage);
      if (currentPage > maxPage && maxPage > 0) {
        setCurrentPage(maxPage);
      }
    };

    handleResize(); // Calcular inicial
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [clientes.length, currentPage]);

  // Filtrar clientes baseado nos critérios de busca e ordenar por data de cadastro (decrescente)
  const filteredClientes = useMemo(() => {
    const filtered = clientes.filter((cliente: Cliente) => {
      const matchesSearch = 
        cliente.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
        cliente.telefone?.includes(searchTerm) ||
        cliente.endereco?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesVendedor = selectedVendedor === '' || cliente.vendedor_id === selectedVendedor;
      
      return matchesSearch && matchesVendedor;
    });

    // Ordenar por data de cadastro (created_at) de forma decrescente (mais recente primeiro)
    return filtered.sort((a: Cliente, b: Cliente) => {
      const dateA = new Date(a.created_at);
      const dateB = new Date(b.created_at);
      return dateB.getTime() - dateA.getTime();
    });
  }, [clientes, searchTerm, selectedVendedor]);

  // Lógica de paginação
  const totalPages = Math.ceil(filteredClientes.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentClientes = filteredClientes.slice(startIndex, endIndex);

  // Reset página quando filtro mudar
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedVendedor]);

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

  // Funções auxiliares
  const getVendedorNome = (vendedorId: string) => {
    const vendedor = vendedores.find((v: Vendedor) => v.id === vendedorId);
    return vendedor ? vendedor.nome : 'N/A';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  const formatPhoneNumber = (phone: string | null | undefined) => {
    if (!phone) return 'N/A';
    
    // Remove todos os caracteres não numéricos
    const cleanPhone = phone.replace(/\D/g, '');
    
    // Aplica a máscara baseada no tamanho do número
    if (cleanPhone.length === 11) {
      // Celular: (XX) 9XXXX-XXXX
      return cleanPhone.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
    } else if (cleanPhone.length === 10) {
      // Fixo: (XX) XXXX-XXXX
      return cleanPhone.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
    } else if (cleanPhone.length === 9) {
      // Celular sem DDD: 9XXXX-XXXX
      return cleanPhone.replace(/(\d{5})(\d{4})/, '$1-$2');
    } else if (cleanPhone.length === 8) {
      // Fixo sem DDD: XXXX-XXXX
      return cleanPhone.replace(/(\d{4})(\d{4})/, '$1-$2');
    }
    
    // Se não se encaixar nos padrões, retorna o número original
    return phone;
  };

  const handleViewCliente = (cliente: Cliente) => {
    setSelectedCliente(cliente);
    setIsModalOpen(true);
  };

  const handleEditCliente = (cliente: Cliente) => {
    setClienteToEdit(cliente);
    setIsEditModalOpen(true);
  };

  const handleDeleteCliente = async (cliente: Cliente) => {
    try {
      await deleteClienteMutation.mutateAsync(cliente.id);
    } catch {
      // Error handling without logging sensitive data
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Clientes</h1>
            <p className="text-gray-600 dark:text-gray-400">Gerencie seus clientes</p>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-8 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-3 text-gray-600 dark:text-gray-400">Carregando clientes...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Clientes</h1>
            <p className="text-gray-600 dark:text-gray-400">Gerencie seus clientes</p>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-8 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="text-center py-12">
            <div className="mx-auto w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-4">
              <Search className="w-8 h-8 text-red-600 dark:text-red-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Erro ao carregar clientes</h3>
            <p className="text-gray-500 dark:text-gray-400 mb-6">
              Ocorreu um erro ao buscar os clientes. Tente novamente.
            </p>
            <button 
              onClick={() => refetch()}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
            >
              Tentar Novamente
            </button>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-4 sm:space-y-6 p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">Clientes</h1>
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">Gerencie seus clientes</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 sm:p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="flex flex-col space-y-3 sm:space-y-4 lg:flex-row lg:space-y-0 lg:space-x-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar clientes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2.5 sm:py-2 w-full border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent touch-manipulation"
            />
          </div>
          
          <select
            value={selectedVendedor}
            onChange={(e) => setSelectedVendedor(e.target.value)}
            className="px-4 py-2.5 sm:py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent touch-manipulation min-w-0 lg:min-w-[200px]"
          >
            <option value="">Todos os vendedores</option>
            {vendedores.map((vendedor: Vendedor) => (
              <option key={vendedor.id} value={vendedor.id}>
                {vendedor.nome}
              </option>
            ))}
          </select>
        </div>
        
        {/* Informações de paginação */}
        <div className="mt-3 sm:mt-4 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 text-xs sm:text-sm text-gray-600 dark:text-gray-400">
          <span>
            Mostrando {startIndex + 1} a {Math.min(endIndex, filteredClientes.length)} de {filteredClientes.length} clientes
          </span>
          <span>
            {itemsPerPage} por página
          </span>
        </div>
      </div>

      {/* Tabela de Clientes */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px]">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Cliente
                </th>
                <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider hidden sm:table-cell">
                  Contato
                </th>
                <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider hidden lg:table-cell">
                  Endereço
                </th>
                <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider hidden md:table-cell">
                  Vendedor
                </th>
                <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider hidden lg:table-cell">
                  Data Cadastro
                </th>
                <th className="px-3 sm:px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
              {currentClientes.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 sm:px-6 py-8 sm:py-12 text-center">
                    <div className="text-sm sm:text-base text-gray-500 dark:text-gray-400">
                      {searchTerm || selectedVendedor ? 'Nenhum cliente encontrado com os critérios de busca.' : 'Nenhum cliente cadastrado ainda.'}
                    </div>
                  </td>
                </tr>
              ) : (
                currentClientes.map((cliente) => (
                  <tr key={cliente.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-3 sm:px-6 py-3 sm:py-4">
                      <div className="flex items-center">
                        <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center text-white text-sm font-medium flex-shrink-0">
                          {cliente.nome.charAt(0).toUpperCase()}
                        </div>
                        <div className="ml-3 min-w-0 flex-1">
                          <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                            {cliente.nome}
                          </div>
                          <div className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 truncate">
                            ID: {cliente.id.slice(0, 8)}...
                          </div>
                          {/* Mobile-only info */}
                          <div className="sm:hidden mt-1 space-y-1">
                            <div className="text-xs text-gray-600 dark:text-gray-400">
                              {formatPhoneNumber(cliente.telefone)}
                            </div>
                            <div className="text-xs text-gray-600 dark:text-gray-400 md:hidden">
                              {getVendedorNome(cliente.vendedor_id)}
                            </div>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap hidden sm:table-cell">
                      <div className="text-sm text-gray-900 dark:text-white">{formatPhoneNumber(cliente.telefone)}</div>
                    </td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4 hidden lg:table-cell">
                      <div className="text-sm text-gray-900 dark:text-white max-w-xs truncate">
                        {`${cliente.endereco || ''}${cliente.numero ? `, ${cliente.numero}` : ''}${cliente.Bairro ? `, ${cliente.Bairro}` : ''}${cliente.Cidade ? `, ${cliente.Cidade}` : ''}${cliente.Estado ? ` - ${cliente.Estado}` : ''}${cliente.cep ? `, CEP: ${cliente.cep}` : ''}${cliente.complemento ? `, ${cliente.complemento}` : ''}`.replace(/^, /g, '') || 'N/A'}
                      </div>
                    </td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap hidden md:table-cell">
                      <div className="text-sm text-gray-900 dark:text-white">
                        {getVendedorNome(cliente.vendedor_id)}
                      </div>
                    </td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white hidden lg:table-cell">
                      {formatDate(cliente.created_at)}
                    </td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-right text-sm font-medium">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-2 touch-manipulation">
                            <MoreHorizontal className="w-4 h-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleViewCliente(cliente)}>
                            <Eye className="w-4 h-4 mr-2" />
                            Visualizar
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleEditCliente(cliente)}>
                            <Edit className="w-4 h-4 mr-2" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => setClienteParaExcluir(cliente)}
                            className="text-red-600 dark:text-red-400"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
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

      {/* Modal de visualização do cliente */}
      <ClienteModal
        cliente={selectedCliente}
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedCliente(null);
        }}
      />

      {/* Modal de edição do cliente */}
      <EditClienteModal
        cliente={clienteToEdit}
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setClienteToEdit(null);
        }}
      />

      {clienteParaExcluir && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg w-[90%] max-w-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Confirmar exclusão</h3>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              Tem certeza que deseja excluir o cliente {clienteParaExcluir.nome}?
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                onClick={() => setClienteParaExcluir(null)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                onClick={async () => {
                  await handleDeleteCliente(clienteParaExcluir);
                  setClienteParaExcluir(null);
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

export default Clientes;
