import { format, parseISO } from 'date-fns';
import { Eye, Plus } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useAcertos } from '../../hooks/useAcertos';
import { useVendedoresByAdmin } from '../../hooks/useVendedores';
import { formatCurrency } from '../../utils/currencyUtils';


const ListaAcertos = () => {
  const { adminId } = useAuth();
  const [filters, setFilters] = useState({
    startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    vendedor_id: 'todos',
    status: 'todos'
  });
  const [page, setPage] = useState(0);

  const { data: acertos, isLoading, totalPages } = useAcertos(adminId || undefined, {
    ...filters,
    page,
    pageSize: 20
  });

  const { data: vendedores } = useVendedoresByAdmin(adminId || '', { enabled: !!adminId });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pendente':   return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300';
      case 'conferido':  return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
      case 'aprovado':   return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
      case 'divergente': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
      default:           return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    }
  };

  return (
    <div className="p-[15px] w-full space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Acertos Diários</h1>
          <p className="text-gray-500 dark:text-gray-400">Gerencie e confira os acertos dos vendedores</p>
        </div>
        <Link
          to="/acertos-diarios/novo"
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus size={20} className="mr-2" />
          Novo Acerto
        </Link>
      </div>

      {/* Filtros */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 grid grid-cols-1 md:grid-cols-4 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Período De</label>
          <input type="date" value={filters.startDate}
            onChange={(e) => setFilters(prev => ({ ...prev, startDate: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Até</label>
          <input type="date" value={filters.endDate}
            onChange={(e) => setFilters(prev => ({ ...prev, endDate: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Vendedor</label>
          <select value={filters.vendedor_id}
            onChange={(e) => setFilters(prev => ({ ...prev, vendedor_id: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="todos">Todos</option>
            {vendedores?.map((v: any) => (
              <option key={v.id} value={v.id}>{v.nome}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Status</label>
          <select value={filters.status}
            onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="todos">Todos</option>
            <option value="pendente">Pendente</option>
            <option value="conferido">Conferido</option>
            <option value="aprovado">Aprovado</option>
            <option value="divergente">Divergente</option>
          </select>
        </div>
      </div>

      {/* Tabela */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
  <table className="w-full text-sm">

            <thead className="bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300 uppercase">
  <tr>
    <th className="px-6 py-3 text-left">Data</th>
    <th className="px-6 py-3 text-left">Vendedor</th>
    <th className="px-6 py-3 text-right">Total Vendas</th>
    <th className="px-6 py-3 text-right">Recebido</th>
    <th className="px-6 py-3 text-right">Despesas</th>
    <th className="px-6 py-3 text-right">Saldo</th>
    <th className="px-6 py-3 text-center">Status</th>
    <th className="px-6 py-3 text-center">Detalhes</th>
  </tr>
</thead>

            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">
                    Carregando...
                  </td>
                </tr>
              ) : acertos.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">
                    Nenhum acerto encontrado
                  </td>
                </tr>
              ) : (
                acertos.map((acerto: any) => {
                  const totalRecebido = Number(acerto.total_recebido_real ?? 0);
                  const totalDespesas = Number(acerto.total_despesas_real ?? 0);
                  const saldo         = Number(acerto.saldo_real ?? 0);

                  return (
                    <tr key={acerto.id}
                      className="bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-gray-900 dark:text-white">
                        {format(parseISO(acerto.data_acerto), 'dd/MM/yyyy')}
                      </td>
                      <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">
                        {acerto.vendedor_nome}
                      </td>
                      <td className="px-6 py-4 text-right text-gray-900 dark:text-white">
                        {formatCurrency(acerto.valor_total_vendas ?? 0)}
                      </td>
                      <td className="px-6 py-4 text-right text-green-600 dark:text-green-400">
                        {formatCurrency(totalRecebido)}
                      </td>
                      <td className="px-6 py-4 text-right text-red-600 dark:text-red-400">
                        {formatCurrency(totalDespesas)}
                      </td>
                      <td className={`px-6 py-4 text-right font-bold ${
                        saldo === 0 ? 'text-green-600 dark:text-green-400' :
                        saldo  > 0  ? 'text-blue-600 dark:text-blue-400' :
                        'text-red-600 dark:text-red-400'
                      }`}>
                        {saldo < 0 && '- '}
                        {formatCurrency(Math.abs(saldo))}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getStatusColor(acerto.status)}`}>
                          {acerto.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-6 py-4">
  <div className="flex items-center justify-center">
    <Link
      to={`/acertos-diarios/${acerto.id}`}
      className="text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400"
      title="Ver detalhes"
    >
      <Eye size={18} />
    </Link>
  </div>
</td>

                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="bg-white dark:bg-gray-800 px-4 py-3 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between sm:px-6">
            <div className="flex-1 flex justify-between sm:hidden">
              <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
                className="relative inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50">
                Anterior
              </button>
              <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page === totalPages - 1}
                className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50">
                Próxima
              </button>
            </div>
            <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
              <p className="text-sm text-gray-700 dark:text-gray-300">
                Página <span className="font-medium">{page + 1}</span> de{' '}
                <span className="font-medium">{totalPages}</span>
              </p>
              <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
                  className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm font-medium text-gray-500 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50">
                  Anterior
                </button>
                <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page === totalPages - 1}
                  className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm font-medium text-gray-500 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50">
                  Próxima
                </button>
              </nav>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ListaAcertos;
