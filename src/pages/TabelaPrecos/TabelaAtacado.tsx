import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { AlertCircle, Edit, RefreshCw, Save, Search, X } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { Pagination } from '../../components/ui/pagination';
import { useAuth } from '../../contexts/AuthContext';
import { Produto, useTabelaPrecos, useUpdatePreco } from '../../hooks/useTabelaPrecos';
import { PAGINATION } from '../../lib/constants/pagination';
import { applyCurrencyMask, currencyMaskToNumber, formatCurrency } from '../../utils/currencyUtils';

const UpdateCustoModal = ({ 
  isOpen, 
  onClose, 
  produto, 
  onSave 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  produto: Produto | null; 
  onSave: (id: string, novoCusto: number) => Promise<void>;
}) => {
  const [custo, setCusto] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (produto) {
      const valueStr = (produto.preco_unt * 100).toFixed(0);
      setCusto(applyCurrencyMask(valueStr));
    }
  }, [produto]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!produto) return;

    try {
      setError('');
      setLoading(true);
      
      const novoCusto = currencyMaskToNumber(custo);
      await onSave(produto.id, novoCusto);
      onClose();
    } catch (err) {
      setError('Erro ao atualizar custo. Tente novamente.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setCusto(applyCurrencyMask(value));
  };

  if (!isOpen || !produto) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md mx-4 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-700">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">Atualizar Custo</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300 transition-colors">
            <X size={20} />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6">
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Produto</label>
            <p className="text-gray-900 dark:text-white font-medium">{produto.produto_nome}</p>
          </div>

          <div className="mb-6">
            <label htmlFor="custo" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Custo Atual (R$)
            </label>
            <div className="relative">
              <input
                type="text"
                id="custo"
                value={custo}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="0,00"
                autoFocus
              />
            </div>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-md text-sm flex items-start">
              <AlertCircle size={16} className="mr-2 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
              disabled={loading}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors flex items-center"
              disabled={loading}
            >
              {loading ? (
                <>
                  <RefreshCw size={16} className="animate-spin mr-2" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save size={16} className="mr-2" />
                  Salvar
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const TabelaAtacado = () => {
  const { adminId } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const { data: produtosData, isLoading, refetch } = useTabelaPrecos(adminId || undefined, { search: searchTerm });
  const produtos = Array.isArray(produtosData) ? produtosData : [];
  const updateMutation = useUpdatePreco();
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedProduto, setSelectedProduto] = useState<Produto | null>(null);
  const [currentPage, setCurrentPage] = useState(0);

  // Pagination calculations
  const { start, end } = PAGINATION.calculateSlice(currentPage, PAGINATION.FRONTEND_PAGE_SIZE);
  const currentProdutos = produtos.slice(start, end);
  const totalPages = PAGINATION.calculateTotalPages(produtos.length, PAGINATION.FRONTEND_PAGE_SIZE);

  // Reset page on search
  useEffect(() => {
    setCurrentPage(0);
  }, [searchTerm]);

  const handleOpenModal = (produto: Produto) => {
    setSelectedProduto(produto);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedProduto(null);
  };

  const handleSaveCusto = async (id: string, novoCusto: number) => {
    await updateMutation.mutateAsync({ id, custo_atual: novoCusto });
  };

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      refetch();
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm, refetch]);

  const margins = [10, 15, 20, 30, 40];

  return (
    <div className="p-6 max-w-[1600px] mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Tabela de Preços</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Gerencie os custos e visualize as margens de lucro</p>
        </div>
        <div className="relative w-full md:w-64">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search size={18} className="text-gray-400 dark:text-gray-500" />
          </div>
          <input
            type="text"
            className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md leading-5 bg-white dark:bg-gray-900 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:placeholder-gray-400 dark:focus:placeholder-gray-500 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition-shadow text-gray-900 dark:text-white"
            placeholder="Buscar produto..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 shadow-sm rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider sticky left-0 bg-gray-50 dark:bg-gray-700 z-10">
                  Produto
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Custo Atual
                </th>
                {margins.map(margin => (
                  <th key={margin} scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    {margin}%
                  </th>
                ))}
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Última Atualização
                </th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider sticky right-0 bg-gray-50 dark:bg-gray-700 z-10">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {isLoading ? (
                <tr>
                  <td colSpan={3 + margins.length} className="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                    Carregando produtos...
                  </td>
                </tr>
              ) : produtos?.length === 0 ? (
                <tr>
                  <td colSpan={3 + margins.length} className="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                    Nenhum produto encontrado.
                  </td>
                </tr>
              ) : (
                currentProdutos?.map((produto) => (
                  <tr key={produto.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white sticky left-0 bg-white dark:bg-gray-800 z-10 group-hover:bg-gray-50 dark:group-hover:bg-gray-700">
                      {produto.produto_nome}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white font-semibold">
                      {formatCurrency(produto.preco_unt || 0)}
                    </td>
                    {margins.map(margin => (
                      <td key={margin} className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {formatCurrency((produto.preco_unt || 0) * (1 + margin / 100))}
                      </td>
                    ))}
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {produto.updated_at 
                        ? format(new Date(produto.updated_at), "dd/MM/yyyy HH:mm", { locale: ptBR })
                        : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium sticky right-0 bg-white dark:bg-gray-800 z-10 group-hover:bg-gray-50 dark:group-hover:bg-gray-700">
                      <button
                        onClick={() => handleOpenModal(produto)}
                        className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 p-2 rounded-full transition-colors"
                        title="Atualizar Custo"
                      >
                        <Edit size={16} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {totalPages > 1 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalCount={produtos.length}
          pageSize={PAGINATION.FRONTEND_PAGE_SIZE}
          onPageChange={setCurrentPage}
        />
      )}

      <UpdateCustoModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        produto={selectedProduto}
        onSave={handleSaveCusto}
      />
    </div>
  );
};

export default TabelaAtacado;
