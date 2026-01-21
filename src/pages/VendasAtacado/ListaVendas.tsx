import { format, parseISO } from 'date-fns';
import { ChevronLeft, ChevronRight, FileSpreadsheet, Filter, Plus, TrendingUp } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import XLSX from 'xlsx-js-style';
import { useAuth } from '../../contexts/AuthContext';
import { useVendasAtacado, useVendasPorVendedor } from '../../hooks/useVendasAtacado';
import { useVendedoresByAdmin } from '../../hooks/useVendedores';
import { formatCurrency } from '../../utils/currencyUtils';

const ListaVendas = () => {
  const navigate = useNavigate();
  const { adminId } = useAuth();
  
  // Filters State
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedVendedor, setSelectedVendedor] = useState('todos');
  const [statusPagamento, setStatusPagamento] = useState('todos');
  const [page, setPage] = useState(0);

  // Queries
  const { 
    data: vendas, 
    isLoading, 
    totalPages, 
    totalCount 
  } = useVendasAtacado(adminId || '', {
    page,
    pageSize: 20,
    startDate,
    endDate,
    vendedor_id: selectedVendedor,
    status_pagamento: statusPagamento as any
  });

  const { data: vendasPorVendedor } = useVendasPorVendedor(adminId || '', {
    startDate,
    endDate
  });

  const { data: vendedores } = useVendedoresByAdmin(adminId || '');

  // Handlers
  const handleExportExcel = () => {
    if (!vendas || vendas.length === 0) return;

    const data = vendas.map(v => ({
      'Entrega': format(parseISO(v.data_entrega), 'dd/MM/yyyy'),
      'Cod Cliente': v.cliente_id.slice(0, 8),
      'Nº Pedido': v.numero_pedido,
      'Cliente': v.cliente_nome,
      'Valor': v.valor_total,
      'Forma Pagamento': v.forma_pagamento,
      'Data Pagamento': v.data_pagamento ? format(parseISO(v.data_pagamento), 'dd/MM/yyyy') : '-'
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Vendas");
    XLSX.writeFile(wb, "vendas_atacado.xlsx");
  };

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Vendas Atacado</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Gerencie suas vendas e acompanhe os resultados</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => navigate('/vendas-atacado/nova')}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors shadow-sm"
          >
            <Plus size={18} className="mr-2" />
            Nova Venda
          </button>
          <button
            onClick={handleExportExcel}
            className="flex items-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors shadow-sm"
            title="Exportar para Excel (CSV)"
          >
            <FileSpreadsheet size={18} className="mr-2" />
            Exportar
          </button>
        </div>
      </div>

      {/* Filters & Totals Section */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        {/* Filters */}
        <div className="xl:col-span-3 bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-3 flex items-center">
            <Filter size={16} className="mr-2" />
            Filtros
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Período (Início)</label>
              <input
                type="date"
                className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-blue-500 focus:border-blue-500"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Período (Fim)</label>
              <input
                type="date"
                className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-blue-500 focus:border-blue-500"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Vendedor</label>
              <select
                className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-blue-500 focus:border-blue-500"
                value={selectedVendedor}
                onChange={(e) => setSelectedVendedor(e.target.value)}
              >
                <option value="todos">Todos</option>
                {vendedores?.map(v => (
                  <option key={v.id} value={v.id}>{v.nome}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Status Pagamento</label>
              <select
                className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-blue-500 focus:border-blue-500"
                value={statusPagamento}
                onChange={(e) => setStatusPagamento(e.target.value)}
              >
                <option value="todos">Todos</option>
                <option value="pendente">Pendente</option>
                <option value="pago">Pago</option>
                <option value="atrasado">Atrasado</option>
                <option value="cancelado">Cancelado</option>
              </select>
            </div>
          </div>
        </div>

        {/* Totals Summary */}
        <div className="xl:col-span-1 bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-y-auto max-h-[200px] xl:max-h-none">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-3 flex items-center">
            <TrendingUp size={16} className="mr-2" />
            Vendas por Vendedor
          </h3>
          <div className="space-y-3">
            {vendasPorVendedor?.map((item: any) => (
              <div key={item.vendedor_id} className="flex justify-between items-center text-sm border-b border-gray-50 dark:border-gray-700 pb-2 last:border-0 last:pb-0">
                <span className="text-gray-600 dark:text-gray-300 truncate mr-2">{item.vendedor_nome}</span>
                <div className="text-right">
                  <div className="font-semibold text-gray-900 dark:text-white">{formatCurrency(item.total_valor)}</div>
                  <div className="text-xs text-gray-400 dark:text-gray-500">{item.total_vendas} vendas</div>
                </div>
              </div>
            ))}
            {(!vendasPorVendedor || vendasPorVendedor.length === 0) && (
              <div className="text-center text-xs text-gray-500 dark:text-gray-400 py-2">
                Nenhum dado disponível
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 shadow-sm rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Entrega</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Cód. Cliente</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Nº Pedido</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Nome Cliente</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Vendedor</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Valor</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Forma Pgto</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Data Pgto</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                    Carregando vendas...
                  </td>
                </tr>
              ) : vendas?.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                    Nenhuma venda encontrada.
                  </td>
                </tr>
              ) : (
                vendas?.map((venda) => (
                  <tr key={venda.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      {format(parseISO(venda.data_entrega), 'dd/MM/yyyy')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 font-mono">
                      {venda.cliente_id.slice(0, 8)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white font-medium">
                      #{venda.numero_pedido}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      {venda.cliente_nome}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {venda.vendedor_nome}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900 dark:text-white">
                      {formatCurrency(venda.valor_total)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      {venda.forma_pagamento}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {venda.data_pagamento ? format(parseISO(venda.data_pagamento), 'dd/MM/yyyy') : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                        ${venda.status_pagamento === 'pago' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' : 
                          venda.status_pagamento === 'atrasado' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' : 
                          venda.status_pagamento === 'cancelado' ? 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300' :
                          'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'}`}>
                        {venda.status_pagamento.toUpperCase()}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination */}
        <div className="bg-white dark:bg-gray-800 px-4 py-3 flex items-center justify-between border-t border-gray-200 dark:border-gray-700 sm:px-6">
          <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-gray-700 dark:text-gray-300">
                Mostrando <span className="font-medium">{vendas ? vendas.length : 0}</span> de <span className="font-medium">{totalCount}</span> resultados
              </p>
            </div>
            <div>
              <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                <button
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm font-medium text-gray-500 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50"
                >
                  <span className="sr-only">Anterior</span>
                  <ChevronLeft size={16} />
                </button>
                <button
                  onClick={() => setPage(p => (totalPages > p + 1 ? p + 1 : p))}
                  disabled={page >= totalPages - 1}
                  className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm font-medium text-gray-500 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50"
                >
                  <span className="sr-only">Próxima</span>
                  <ChevronRight size={16} />
                </button>
              </nav>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ListaVendas;
