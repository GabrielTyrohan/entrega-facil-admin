import React, { useState, useMemo } from 'react';
import { Package, Plus, Search, Filter, MoreHorizontal, Edit, Trash2, Eye } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import ProdutoModal from '@/components/ui/ProdutoModal';
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
  useProdutos,
  useDeleteProduto,
  type Produto 
} from '../hooks/useProdutos';

const categorias = [
  'Todas',
  'Bebidas',
  'Alimentos',
  'Limpeza',
  'Higiene',
  'Outros'
];

const Produtos: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Todas');
  const [selectedProduto, setSelectedProduto] = useState<Produto | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'view' | 'edit' | 'create'>('view');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [produtoParaExcluir, setProdutoParaExcluir] = useState<Produto | null>(null);

  // Usar hooks de cache para buscar produtos
  const {
    data: produtosData = [],
    isLoading,
    error,
    refetch
  } = useProdutos();

  // Buscar categorias disponíveis (removido - não utilizado)
  // const { data: categoriasDisponiveis = [] } = useProdutoCategories();

  // Hook para deletar produto
  const deleteProdutoMutation = useDeleteProduto();

  // Tipar os dados corretamente
  const produtos = produtosData as Produto[];

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
      const maxPage = Math.ceil(produtos.length / newItemsPerPage);
      if (currentPage > maxPage && maxPage > 0) {
        setCurrentPage(maxPage);
      }
    };

    handleResize(); // Calcular inicial
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [produtos.length, currentPage]);

  // Filtrar produtos usando useMemo para otimização
  const filteredProdutos = useMemo(() => {
    let filtered = produtos;

    // Filtro por categoria
    if (selectedCategory !== 'Todas') {
      filtered = filtered.filter((produto: Produto) => produto.categoria === selectedCategory);
    }

    // Filtro por busca
    if (searchTerm) {
      filtered = filtered.filter((produto: Produto) =>
        produto.produto_nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
        produto.produto_cod?.toString().toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    return filtered;
  }, [produtos, searchTerm, selectedCategory]);

  // Lógica de paginação
  const totalPages = Math.ceil(filteredProdutos.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentProdutos = filteredProdutos.slice(startIndex, endIndex);

  // Reset página quando filtro mudar
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedCategory]);

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

  const handleViewProduto = (produto: Produto) => {
    setSelectedProduto(produto);
    setModalMode('view');
    setIsModalOpen(true);
  };

  const handleEditProduto = (produto: Produto) => {
    setSelectedProduto(produto);
    setModalMode('edit');
    setIsModalOpen(true);
  };

  const handleDeleteProduto = async (produto: Produto) => {
    try {
      await deleteProdutoMutation.mutateAsync(produto.id);
    } catch {
      // Error handling without logging sensitive data
    }
  };

  const handleSaveProduto = () => {
    // A atualização será feita através dos hooks de mutação
    // O cache será invalidado automaticamente
    setIsModalOpen(false);
    setSelectedProduto(null);
    // Refetch para atualizar a lista
    refetch();
  };

  const handleCreateProduto = () => {
    setSelectedProduto(null);
    setModalMode('create');
    setIsModalOpen(true);
  };

  // Mostrar loading
  if (isLoading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Produtos</h1>
            <p className="text-gray-600 dark:text-gray-400">Gerencie o catálogo de produtos</p>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-8 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-3 text-gray-600 dark:text-gray-400">Carregando produtos...</span>
          </div>
        </div>
      </div>
    );
  }

  // Mostrar erro
  if (error) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Produtos</h1>
            <p className="text-gray-600 dark:text-gray-400">Gerencie o catálogo de produtos</p>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-8 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="text-center py-12">
            <div className="mx-auto w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-4">
              <Package className="w-8 h-8 text-red-600 dark:text-red-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Erro ao carregar produtos</h3>
            <p className="text-gray-500 dark:text-gray-400 mb-6">
              Ocorreu um erro ao buscar os produtos. Tente novamente.
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

  const getStatusColor = (quantidade: number) => {
    if (quantidade === 0) return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400';
    if (quantidade <= 10) return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400';
    return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400';
  };

  const getStatusText = (quantidade: number) => {
    if (quantidade === 0) return 'Sem estoque';
    if (quantidade <= 10) return 'Estoque baixo';
    return 'Em estoque';
  };

  return (
    <div className="space-y-4 sm:space-y-6 p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">Produtos</h1>
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">Catálogo e estoque de produtos</p>
        </div>
        <div className="flex items-center space-x-3">
          <button 
            onClick={handleCreateProduto}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 sm:py-2 rounded-lg font-medium flex items-center justify-center space-x-2 transition-colors touch-manipulation"
          >
            <Plus className="w-4 h-4" />
            <span>Novo Produto</span>
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 sm:p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="flex flex-col space-y-3 sm:space-y-4 md:flex-row md:items-center md:justify-between md:space-y-0 md:space-x-4">
          <div className="flex-1 max-w-md">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar por nome ou código..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 sm:py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white touch-manipulation"
              />
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            <Filter className="w-4 h-4 text-gray-400" />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-3 py-2.5 sm:py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white touch-manipulation"
            >
              {categorias.map(categoria => (
                <option key={categoria} value={categoria}>{categoria}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Lista de Produtos Única */}
      {filteredProdutos.length > 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="px-4 sm:px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white flex items-center">
              <Package className="w-4 sm:w-5 h-4 sm:h-5 mr-2 text-blue-600 dark:text-blue-400" />
              {selectedCategory === 'Todas' ? 'Todos os Produtos' : selectedCategory} ({filteredProdutos.length})
            </h2>
          </div>

          {/* Informações de paginação */}
          <div className="px-4 sm:px-6 py-2 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 text-xs sm:text-sm text-gray-600 dark:text-gray-400">
            <span>
              Mostrando {startIndex + 1} a {Math.min(endIndex, filteredProdutos.length)} de {filteredProdutos.length} produtos
            </span>
            <span>
              {itemsPerPage} por página
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px]">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Produto
                  </th>
                  <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden sm:table-cell">
                    Código
                  </th>
                  <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden md:table-cell">
                    Categoria
                  </th>
                  <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden lg:table-cell">
                    Estoque
                  </th>
                  <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden lg:table-cell">
                    Preço
                  </th>
                  <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden xl:table-cell">
                    Status
                  </th>
                  <th className="px-3 sm:px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {currentProdutos.map((produto) => (
                  <tr key={produto.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-3 sm:px-6 py-3 sm:py-4">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {produto.produto_nome}
                        </div>
                        {/* Mobile-only info */}
                        <div className="sm:hidden mt-1 space-y-1">
                          <div className="text-xs text-gray-600 dark:text-gray-400">
                            Código: {produto.produto_cod}
                          </div>
                          <div className="md:hidden">
                            <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400">
                              {produto.categoria}
                            </span>
                          </div>
                          <div className="lg:hidden flex items-center space-x-3">
                            <span className="text-xs text-gray-600 dark:text-gray-400">
                              {produto.qtd_estoque || 0} un.
                            </span>
                            <span className="text-xs font-medium text-gray-900 dark:text-white">
                              R$ {produto.preco_unt?.toFixed(2) || '0.00'}
                            </span>
                          </div>
                          <div className="xl:hidden">
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(produto.qtd_estoque || 0)}`}>
                              {getStatusText(produto.qtd_estoque || 0)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white hidden sm:table-cell">
                      {produto.produto_cod}
                    </td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white hidden md:table-cell">
                      <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400">
                        {produto.categoria}
                      </span>
                    </td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white hidden lg:table-cell">
                      {produto.qtd_estoque || 0} un.
                    </td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white hidden lg:table-cell">
                      R$ {produto.preco_unt?.toFixed(2) || '0.00'}
                    </td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap hidden xl:table-cell">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(produto.qtd_estoque || 0)}`}>
                        {getStatusText(produto.qtd_estoque || 0)}
                      </span>
                    </td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-right text-sm font-medium">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-lg transition-colors touch-manipulation">
                            <MoreHorizontal className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleViewProduto(produto)}>
                            <Eye className="w-4 h-4 mr-2" />
                            Visualizar
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleEditProduto(produto)}>
                            <Edit className="w-4 h-4 mr-2" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => setProdutoParaExcluir(produto)}
                            className="text-red-600 dark:text-red-400"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 sm:p-8 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="text-center py-8 sm:py-12">
            <div className="mx-auto w-12 sm:w-16 h-12 sm:h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
              <Package className="w-6 sm:w-8 h-6 sm:h-8 text-gray-400" />
            </div>
            <h3 className="text-base sm:text-lg font-medium text-gray-900 dark:text-white mb-2">Nenhum produto encontrado</h3>
            <p className="text-sm sm:text-base text-gray-500 dark:text-gray-400 mb-6">
              {searchTerm || selectedCategory !== 'Todas' 
                ? 'Tente ajustar os filtros de busca.' 
                : 'Comece cadastrando seu primeiro produto.'
              }
            </p>
            {!searchTerm && selectedCategory === 'Todas' && (
              <button 
                onClick={handleCreateProduto}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 sm:py-2 rounded-lg font-medium flex items-center justify-center space-x-2 transition-colors mx-auto touch-manipulation"
              >
                <Plus className="w-4 h-4" />
                <span>Cadastrar Primeiro Produto</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Modal */}
      <ProdutoModal
        produto={selectedProduto}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        mode={modalMode}
        onSave={handleSaveProduto}
      />

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

      {produtoParaExcluir && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg w-[90%] max-w-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Confirmar exclusão</h3>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              Tem certeza que deseja excluir o produto {produtoParaExcluir.produto_nome}?
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                onClick={() => setProdutoParaExcluir(null)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                onClick={async () => {
                  await handleDeleteProduto(produtoParaExcluir);
                  setProdutoParaExcluir(null);
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

export default Produtos;
