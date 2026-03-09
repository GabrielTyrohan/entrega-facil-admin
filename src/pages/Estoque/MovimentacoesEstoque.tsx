import { format } from 'date-fns';
import { Check, Filter, Plus, Search, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/Modal';
import { Pagination } from '@/components/ui/pagination';
import { Skeleton } from '@/components/ui/Skeleton';
import { useMovimentacoesEstoque } from '@/hooks/useMovimentacoesEstoque';
import { useProdutos } from '@/hooks/useProdutos';
import { toast } from '@/utils/toast';

const MOVEMENT_TYPES = {
  entrada_compra: 'Entrada (Compra)',
  entrada_devolucao: 'Entrada (Devolução)',
  entrada_ajuste: 'Entrada (Ajuste)',
  entrada_transferencia: 'Entrada (Transferência)',
  saida_venda: 'Saída (Venda)',
  saida_perda: 'Saída (Perda)',
  saida_ajuste: 'Saída (Ajuste)',
  saida_devolucao: 'Saída (Devolução)',
  saida_transferencia: 'Saída (Transferência)',
};

const ADJUSTMENT_TYPES = [
  { value: 'entrada_ajuste', label: 'Entrada (Ajuste)' },
  { value: 'saida_ajuste', label: 'Saída (Ajuste)' },
  { value: 'saida_perda', label: 'Saída (Perda)' },
  { value: 'entrada_devolucao', label: 'Entrada (Devolução)' },
];

export default function MovimentacoesEstoque() {
  // State
  const [filters, setFilters] = useState({
    produtoId: '',
    tipoMovimentacao: '',
    dataInicio: '',
    dataFim: '',
  });
  const [page, setPage] = useState(0);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const pageSize = 10;

  // Modal State
  const [ajusteData, setAjusteData] = useState({
    produtoId: '',
    tipo: 'entrada_ajuste',
    quantidade: '',
    motivo: '',
    observacoes: '',
  });

  // Combobox State
  const [comboboxOpen, setComboboxOpen] = useState(false);
  const [comboboxSearch, setComboboxSearch] = useState('');
  const comboboxRef = useRef<HTMLDivElement>(null);

  // Hooks
  const { data: produtos } = useProdutos();

  // Close combobox when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (comboboxRef.current && !comboboxRef.current.contains(event.target as Node)) {
        setComboboxOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter products for combobox
  const filteredProducts = useMemo(() => {
    if (!produtos) return [];
    if (!comboboxSearch) return produtos;
    return produtos.filter((prod: any) => 
      prod.produto_nome.toLowerCase().includes(comboboxSearch.toLowerCase())
    );
  }, [produtos, comboboxSearch]);

  const selectedProduct = useMemo(() => {
    return produtos?.find((p: any) => p.id === ajusteData.produtoId);
  }, [produtos, ajusteData.produtoId]);
  const { 
    movimentacoes, 
    isLoading, 
    registrarMovimentacao, 
    isRegistrando 
  } = useMovimentacoesEstoque(filters.produtoId || undefined);

  // Filter Logic
  const filteredData = useMemo(() => {
    if (!movimentacoes) return [];

    return movimentacoes.filter(mov => {
      // Filter by Type
      if (filters.tipoMovimentacao && mov.tipo_movimentacao !== filters.tipoMovimentacao) {
        return false;
      }

      // Filter by Date Range
      if (filters.dataInicio) {
        const dataMov = new Date(mov.created_at).setHours(0, 0, 0, 0);
        const dataInicio = new Date(filters.dataInicio).setHours(0, 0, 0, 0);
        if (dataMov < dataInicio) return false;
      }

      if (filters.dataFim) {
        const dataMov = new Date(mov.created_at).setHours(0, 0, 0, 0);
        const dataFim = new Date(filters.dataFim).setHours(0, 0, 0, 0);
        if (dataMov > dataFim) return false;
      }

      return true;
    });
  }, [movimentacoes, filters]);

  // Pagination Logic
  const totalCount = filteredData.length;
  const totalPages = Math.ceil(totalCount / pageSize);
  const paginatedData = filteredData.slice(page * pageSize, (page + 1) * pageSize);

  // Handlers
  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPage(0);
  };

  const handleClearFilters = () => {
    setFilters({
      produtoId: '',
      tipoMovimentacao: '',
      dataInicio: '',
      dataFim: '',
    });
    setPage(0);
  };

  const handleSaveAjuste = async () => {
    try {
      if (!ajusteData.produtoId) {
        toast.error('Selecione um produto');
        return;
      }
      if (!ajusteData.quantidade || Number(ajusteData.quantidade) <= 0) {
        toast.error('Quantidade inválida');
        return;
      }
      if (!ajusteData.motivo) {
        toast.error('Informe o motivo');
        return;
      }

      await registrarMovimentacao({
        produto_id: ajusteData.produtoId,
        tipo_movimentacao: ajusteData.tipo as any,
        quantidade: Number(ajusteData.quantidade),
        motivo: ajusteData.motivo,
        observacoes: ajusteData.observacoes,
      });

      toast.success('Ajuste registrado com sucesso!');
      setIsModalOpen(false);
      setAjusteData({
        produtoId: '',
        tipo: 'entrada_ajuste',
        quantidade: '',
        motivo: '',
        observacoes: '',
      });
    } catch (error) {
      console.error(error);
      toast.error('Erro ao registrar ajuste');
    }
  };

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Movimentações de Estoque</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Visualize o histórico e realize ajustes manuais
          </p>
        </div>
        <Button onClick={() => setIsModalOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Registrar Ajuste
        </Button>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2 mb-4 text-sm font-medium text-gray-700 dark:text-gray-300">
          <Filter className="w-4 h-4" />
          Filtros
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-500">Produto</label>
            <select
              className="w-full h-10 px-3 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={filters.produtoId}
              onChange={(e) => handleFilterChange('produtoId', e.target.value)}
            >
              <option value="">Todos os produtos</option>
              {produtos?.map((prod: any) => (
                <option key={prod.id} value={prod.id}>
                  {prod.produto_nome}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-500">Tipo</label>
            <select
              className="w-full h-10 px-3 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={filters.tipoMovimentacao}
              onChange={(e) => handleFilterChange('tipoMovimentacao', e.target.value)}
            >
              <option value="">Todos os tipos</option>
              {Object.entries(MOVEMENT_TYPES).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-500">Data Inicial</label>
            <input
              type="date"
              className="w-full h-10 px-3 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={filters.dataInicio}
              onChange={(e) => handleFilterChange('dataInicio', e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-500">Data Final</label>
            <div className="flex gap-2">
              <input
                type="date"
                className="w-full h-10 px-3 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={filters.dataFim}
                onChange={(e) => handleFilterChange('dataFim', e.target.value)}
              />
              <Button 
                variant="outline" 
                size="icon" 
                className="shrink-0"
                onClick={handleClearFilters}
                title="Limpar filtros"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 dark:bg-gray-900/50 text-gray-500 dark:text-gray-400 font-medium border-b border-gray-200 dark:border-gray-700">
              <tr>
                <th className="px-4 py-3">Data/Hora</th>
                <th className="px-4 py-3">Produto</th>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3 text-right">Qtd</th>
                <th className="px-4 py-3 text-right">Anterior</th>
                <th className="px-4 py-3 text-right">Novo</th>
                <th className="px-4 py-3">Usuário</th>
                <th className="px-4 py-3">Motivo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    <td className="px-4 py-3"><Skeleton className="h-4 w-24" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-4 w-32" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-4 w-20" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-4 w-8 ml-auto" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-4 w-8 ml-auto" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-4 w-8 ml-auto" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-4 w-20" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-4 w-24" /></td>
                  </tr>
                ))
              ) : paginatedData.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                    Nenhuma movimentação encontrada
                  </td>
                </tr>
              ) : (
                paginatedData.map((mov) => {
                  const produto = produtos?.find((p: any) => p.id === mov.produto_cadastrado_id);
                  const isEntrada = mov.tipo_movimentacao.startsWith('entrada');
                  
                  return (
                    <tr key={mov.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap">
                        {format(new Date(mov.created_at), 'dd/MM/yyyy HH:mm')}
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                        {produto?.produto_nome || 'Produto não encontrado'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          isEntrada 
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                            : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                        }`}>
                          {MOVEMENT_TYPES[mov.tipo_movimentacao] || mov.tipo_movimentacao}
                        </span>
                      </td>
                      <td className={`px-4 py-3 text-right font-medium ${
                        isEntrada ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                      }`}>
                        {isEntrada ? '+' : '-'}{mov.quantidade}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-500">
                        {mov.quantidade_anterior}
                      </td>
                      <td className="px-4 py-3 text-right font-medium">
                        {mov.quantidade_nova}
                      </td>
                      <td className="px-4 py-3 text-gray-500">
                        {mov.usuario_nome}
                      </td>
                      <td className="px-4 py-3 text-gray-500 truncate max-w-[150px]" title={mov.motivo}>
                        {mov.motivo || '-'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        
        {!isLoading && (
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            totalCount={totalCount}
            pageSize={pageSize}
            onPageChange={setPage}
          />
        )}
      </div>

      {/* Adjustment Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Registrar Ajuste Manual"
      >
        <div className="space-y-4">
          <div className="space-y-2 relative" ref={comboboxRef}>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Produto</label>
            <div 
              className="w-full h-10 px-3 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm flex items-center justify-between cursor-pointer focus-within:ring-2 focus-within:ring-blue-500"
              onClick={() => {
                setComboboxOpen(!comboboxOpen);
                if (!comboboxOpen) setComboboxSearch('');
              }}
            >
              <span className={selectedProduct ? 'text-gray-900 dark:text-white' : 'text-gray-500'}>
                {selectedProduct 
                  ? `${selectedProduct.produto_nome} (Atual: ${selectedProduct.qtd_estoque})` 
                  : 'Selecione ou pesquise um produto...'}
              </span>
              <Search className="w-4 h-4 text-gray-400" />
            </div>

            {comboboxOpen && (
              <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg max-h-60 overflow-hidden flex flex-col">
                <div className="p-2 border-b border-gray-200 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800">
                  <input
                    type="text"
                    className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 dark:bg-gray-900 dark:text-white"
                    placeholder="Buscar produto..."
                    value={comboboxSearch}
                    onChange={(e) => setComboboxSearch(e.target.value)}
                    autoFocus
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
                <div className="overflow-y-auto flex-1">
                  {filteredProducts.length === 0 ? (
                    <div className="px-4 py-3 text-sm text-gray-500 text-center">
                      Nenhum produto encontrado.
                    </div>
                  ) : (
                    filteredProducts.map((prod: any) => (
                      <div
                        key={prod.id}
                        className={`px-4 py-2 text-sm cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/20 flex items-center justify-between ${
                          ajusteData.produtoId === prod.id ? 'bg-blue-50 dark:bg-blue-900/30' : ''
                        }`}
                        onClick={() => {
                          setAjusteData(prev => ({ ...prev, produtoId: prod.id }));
                          setComboboxOpen(false);
                        }}
                      >
                        <span className="text-gray-900 dark:text-white">
                          {prod.produto_nome} <span className="text-gray-500 text-xs ml-1">(Estoque: {prod.qtd_estoque})</span>
                        </span>
                        {ajusteData.produtoId === prod.id && (
                          <Check className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Tipo de Ajuste</label>
            <div className="grid grid-cols-2 gap-2">
              {ADJUSTMENT_TYPES.map(type => (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => setAjusteData(prev => ({ ...prev, tipo: type.value }))}
                  className={`px-3 py-2 text-sm font-medium rounded-md border transition-colors ${
                    ajusteData.tipo === type.value
                      ? 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-300'
                      : 'border-gray-200 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  {type.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Quantidade</label>
              <input
                type="number"
                min="1"
                className="w-full h-10 px-3 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={ajusteData.quantidade}
                onChange={(e) => setAjusteData(prev => ({ ...prev, quantidade: e.target.value }))}
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Motivo</label>
              <select
                className="w-full h-10 px-3 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={ajusteData.motivo}
                onChange={(e) => setAjusteData(prev => ({ ...prev, motivo: e.target.value }))}
              >
                <option value="">Selecione...</option>
                <option value="Inventário">Inventário</option>
                <option value="Perda/Quebra">Perda/Quebra</option>
                <option value="Vencimento">Vencimento</option>
                <option value="Erro de Lançamento">Erro de Lançamento</option>
                <option value="Outros">Outros</option>
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Observações</label>
            <textarea
              className="w-full min-h-[80px] px-3 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
              value={ajusteData.observacoes}
              onChange={(e) => setAjusteData(prev => ({ ...prev, observacoes: e.target.value }))}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveAjuste} disabled={isRegistrando}>
              {isRegistrando ? 'Salvando...' : 'Confirmar Ajuste'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
