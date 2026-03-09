import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Pagination } from "@/components/ui/pagination";
import ProdutoModal from '@/components/ui/ProdutoModal';
import { Skeleton } from "@/components/ui/Skeleton";
import { Edit, Eye, Filter, MoreHorizontal, Package, Plus, Search, Trash2 } from 'lucide-react';
import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  useDeleteProduto,
  useProdutos,
  type Produto
} from '../hooks/useProdutos';

const categorias = [
  'Todas',
  'Bebidas',
  'Alimentos',
  'Limpeza',
  'Higiene',
  'Congelados',
  'Outros'
];

const normalizar = (str: string) =>
  str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

const Produtos: React.FC = () => {
  const { isLoading: authLoading, userType, adminId, user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Todas');
  const [selectedProduto, setSelectedProduto] = useState<Produto | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'view' | 'edit' | 'create'>('view');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [produtoParaExcluir, setProdutoParaExcluir] = useState<Produto | null>(null);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      // Normaliza antes de enviar ao hook (remove acentos, minúscula)
      setDebouncedSearchTerm(normalizar(searchTerm.trim()));
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Usar hooks de cache para buscar produtos
  const {
    data: produtosData = [],
    count: totalCount,
    isLoading: productsLoading,
    error,
    refetch
  } = useProdutos({
    page: currentPage,
    pageSize: itemsPerPage,
    searchTerm: debouncedSearchTerm,
    categoria: selectedCategory
  });

  // isLoading considera carregamento da auth, dos produtos E se temos usuário mas ainda sem adminId
  const isLoading = authLoading || productsLoading || (!!user && !adminId);

  // Buscar categorias disponíveis (removido - não utilizado)
  // const { data: categoriasDisponiveis = [] } = useProdutoCategories();

  // Hook para deletar produto
  const deleteProdutoMutation = useDeleteProduto();

  // Tipar os dados corretamente
  const produtos = produtosData as Produto[];

  // Filtro local complementar para multi-palavras (ex: "arroz 5kg")
  const produtosFiltrados = React.useMemo(() => {
    if (!searchTerm.trim()) return produtos;
    const termos = normalizar(searchTerm.trim()).split(/\s+/);
    return produtos.filter(p => {
      const campos =
        normalizar(p.produto_nome) + ' ' +
        normalizar(p.produto_cod) + ' ' +
        normalizar(p.categoria || '');
      return termos.every(termo => campos.includes(termo));
    });
  }, [produtos, searchTerm]);

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
      
      // Resetar para a primeira página se mudar o tamanho da página, 
      // pois o cálculo de maxPage mudaria
      // setCurrentPage(1); // Opcional, mas mais seguro
    };

    handleResize(); // Calcular inicial
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Lógica de paginação
  const totalPages = Math.ceil((totalCount || 0) / itemsPerPage);
  
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentProdutos = produtosFiltrados;

  // Reset página quando filtro mudar
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedCategory]);

  // Renderização de Debug para caso de lista vazia
  if (!isLoading && produtos.length === 0 && userType === 'funcionario') {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center space-y-4">
        <Package className="h-16 w-16 text-gray-300" />
        <h2 className="text-xl font-semibold text-gray-700">Nenhum produto encontrado</h2>
        <p className="text-gray-500 max-w-md">
          Não encontramos produtos vinculados ao administrador.
        </p>
        
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-left text-sm max-w-lg w-full mt-4">
          <h3 className="font-bold text-yellow-800 mb-2 flex items-center">
            <MoreHorizontal className="h-4 w-4 mr-2" />
            Diagnóstico de Permissões
          </h3>
          <ul className="space-y-1 text-yellow-700">
            <li><strong>Admin ID Vinculado:</strong> {adminId || 'Não encontrado'}</li>
            <li><strong>Status da Conta:</strong> Funcionário</li>
            <li><strong>Ação Necessária:</strong> Peça ao administrador para rodar o script de correção de permissões (fix_permissions.sql) no Supabase.</li>
          </ul>
        </div>

        <button 
          onClick={() => refetch()}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
        >
          Tentar Novamente
        </button>
      </div>
    );
  }

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
      await deleteProdutoMutation.mutateAsync({ id: produto.id });
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
      <div className="space-y-4 sm:space-y-6 p-4 sm:p-6">
        {/* Header Skeleton */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
          <Skeleton className="h-10 w-32 rounded-lg" />
        </div>

        {/* Filters Skeleton */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 sm:p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex flex-col space-y-3 sm:space-y-4 md:flex-row md:items-center md:justify-between md:space-y-0 md:space-x-4">
            <Skeleton className="h-10 flex-1 max-w-md" />
            <Skeleton className="h-10 w-48" />
          </div>
        </div>

        {/* Table Skeleton */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="px-4 sm:px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <Skeleton className="h-6 w-48" />
          </div>
          
          <div className="px-4 sm:px-6 py-2 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
            <Skeleton className="h-4 w-64" />
            <Skeleton className="h-4 w-32" />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px]">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  {[...Array(7)].map((_, i) => (
                    <th key={i} className="px-3 sm:px-6 py-3 text-left">
                      <Skeleton className="h-4 w-24" />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {[...Array(8)].map((_, i) => (
                  <tr key={i}>
                    <td className="px-3 sm:px-6 py-3 sm:py-4">
                      <div className="space-y-2">
                        <Skeleton className="h-4 w-40" />
                        <div className="sm:hidden space-y-1">
                          <Skeleton className="h-3 w-24" />
                          <Skeleton className="h-3 w-16" />
                        </div>
                      </div>
                    </td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4 hidden sm:table-cell">
                      <Skeleton className="h-4 w-16" />
                    </td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4 hidden md:table-cell">
                      <Skeleton className="h-6 w-24 rounded-full" />
                    </td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4 hidden lg:table-cell">
                      <Skeleton className="h-4 w-16" />
                    </td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4 hidden lg:table-cell">
                      <Skeleton className="h-4 w-20" />
                    </td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4 hidden xl:table-cell">
                      <Skeleton className="h-6 w-24 rounded-full" />
                    </td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4 text-right">
                      <Skeleton className="h-8 w-8 ml-auto rounded-lg" />
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
      {produtos.length > 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="px-4 sm:px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white flex items-center">
              <Package className="w-4 sm:w-5 h-4 sm:h-5 mr-2 text-blue-600 dark:text-blue-400" />
              {selectedCategory === 'Todas' ? 'Todos os Produtos' : selectedCategory} ({totalCount || 0})
            </h2>
          </div>

          {/* Informações de paginação */}
          <div className="px-4 sm:px-6 py-2 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 text-xs sm:text-sm text-gray-600 dark:text-gray-400">
            <span>
              Mostrando {startIndex + 1} a {Math.min(endIndex, totalCount || 0)} de {totalCount || 0} produtos
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
                {currentProdutos.map((produto, index) => (
                  <tr 
                    key={produto.id} 
                    className="hover:bg-gray-50 dark:hover:bg-gray-700 animate-fade-in-up"
                    style={{ animationDelay: `${index * 75}ms` }}
                  >
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
        <Pagination
          currentPage={currentPage - 1}
          totalPages={totalPages}
          totalCount={totalCount || 0}
          pageSize={itemsPerPage}
          onPageChange={(page) => setCurrentPage(page + 1)}
        />
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