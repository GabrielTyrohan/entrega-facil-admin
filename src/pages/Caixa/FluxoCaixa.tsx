import { format, isAfter, parseISO, subDays } from 'date-fns';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
    AlertCircle,
    Check,
    ChevronLeft,
    ChevronRight,
    DollarSign,
    Download,
    FileText,
    Plus,
    Trash2,
    TrendingDown,
    TrendingUp
} from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useAuth } from '../../contexts/AuthContext';
import { useDeleteLancamento, useFluxoCaixa, useFluxoCaixaStats, useUpdateLancamento } from '../../hooks/useFluxoCaixa';
import { formatCurrency } from '../../utils/currencyUtils';

const FluxoCaixa = () => {
  const { adminId, userProfile } = useAuth();
  const [dateRange, setDateRange] = useState({
    startDate: subDays(new Date(), 30).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });
  const [tipoFiltro, setTipoFiltro] = useState('todos');
  const [currentPage, setCurrentPage] = useState(0);
  const ITEMS_PER_PAGE = 15;
  
  const { data: stats, isLoading: statsLoading } = useFluxoCaixaStats(
    adminId || '',
    dateRange.startDate,
    dateRange.endDate
  );

  const { data: lancamentos, isLoading: listLoading, refetch, totalCount, totalPages } = useFluxoCaixa(
    adminId || '',
    {
      startDate: dateRange.startDate,
      endDate: dateRange.endDate,
      tipo: tipoFiltro,
      page: currentPage,
      pageSize: ITEMS_PER_PAGE
    }
  );

  const deleteMutation = useDeleteLancamento();
  const updateMutation = useUpdateLancamento();

  const handleDelete = async (id: string) => {
    if (window.confirm('Tem certeza que deseja excluir este lançamento?')) {
      await deleteMutation.mutateAsync(id);
      refetch();
    }
  };

  const handleConfirmarPagamento = async (id: string) => {
    if (window.confirm('Confirmar pagamento deste lançamento?')) {
      await updateMutation.mutateAsync({ id, status: 'pago' });
      refetch();
    }
  };

  const handlePageChange = (newPage: number) => {
    if (newPage >= 0 && newPage < totalPages) {
      setCurrentPage(newPage);
    }
  };

  const handleExport = () => {
    if (!lancamentos.length) return;

    const doc = new jsPDF();

    // Nome da Empresa
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(userProfile?.nome_empresa || 'Minha Empresa', 14, 15);

    // Título
    doc.setFontSize(14);
    doc.setFont('helvetica', 'normal');
    doc.text('Relatório de Fluxo de Caixa', 14, 23);

    // Período e Data de Emissão
    doc.setFontSize(10);
    doc.text(`Período: ${format(parseISO(dateRange.startDate), 'dd/MM/yyyy')} a ${format(parseISO(dateRange.endDate), 'dd/MM/yyyy')}`, 14, 30);
    doc.text(`Gerado em: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 14, 35);

    // Resumo Financeiro
    const startY = 45;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Resumo do Período', 14, startY);
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Total Entradas: ${formatCurrency(stats?.totalEntradas || 0)}`, 14, startY + 8);
    doc.text(`Total Saídas: ${formatCurrency(stats?.totalSaidas || 0)}`, 14, startY + 14);
    
    const saldo = stats?.saldo || 0;
    doc.setTextColor(saldo >= 0 ? 0 : 200, saldo >= 0 ? 100 : 0, 0); // Verde ou Vermelho
    doc.text(`Saldo: ${formatCurrency(saldo)}`, 14, startY + 20);
    doc.setTextColor(0, 0, 0); // Reset cor

    doc.text(`Contas a Pagar: ${formatCurrency(stats?.contasAPagar || 0)}`, 100, startY + 8);

    // Tabela de Lançamentos
    const tableData = lancamentos.map(l => [
      format(parseISO(l.data_lancamento), 'dd/MM/yyyy'),
      l.categoria,
      l.tipo.toUpperCase(),
      formatCurrency(Number(l.valor)),
      l.forma_pagamento,
      l.status.toUpperCase()
    ]);

    autoTable(doc, {
      startY: startY + 28,
      head: [['Data', 'Categoria', 'Tipo', 'Valor', 'Pagamento', 'Status']],
      body: tableData,
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: [41, 128, 185], textColor: 255 },
      columnStyles: {
        0: { cellWidth: 25 }, // Data
        1: { cellWidth: 'auto' }, // Categoria
        2: { cellWidth: 25 }, // Tipo
        3: { cellWidth: 35, halign: 'right' }, // Valor
        4: { cellWidth: 35 }, // Pagamento
        5: { cellWidth: 25 } // Status
      },
      didParseCell: function(data) {
        // Colorir valores e status
        if (data.section === 'body') {
          if (data.column.index === 2) { // Tipo (agora índice 2)
            const tipo = data.cell.raw as string;
            if (tipo === 'SAIDA') {
              data.cell.styles.textColor = [220, 38, 38]; // Red
            } else {
              data.cell.styles.textColor = [22, 163, 74]; // Green
            }
          }
          if (data.column.index === 3) { // Valor (agora índice 3)
             // Manter cor padrão ou seguir a lógica do tipo
             const rowRaw = data.row.raw as unknown[];
             const tipo = rowRaw[2] as string; // Acessa o valor da coluna Tipo (índice 2) com cast seguro
             if (tipo === 'SAIDA') {
               data.cell.styles.textColor = [220, 38, 38];
             } else {
               data.cell.styles.textColor = [22, 163, 74];
             }
          }
        }
      }
    });

    doc.save(`fluxo_caixa_${dateRange.startDate}_${dateRange.endDate}.pdf`);
  };

  const isBoletoVencido = (lancamento: any) => {
    if (lancamento.tipo !== 'saida' || lancamento.categoria !== 'Boleto' || lancamento.status === 'pago') return false;
    if (!lancamento.data_vencimento) return false;
    return isAfter(new Date(), parseISO(lancamento.data_vencimento));
  };

  return (
    <div className="p-6 mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Fluxo de Caixa</h1>
          <p className="text-gray-500 dark:text-gray-400">Gestão financeira completa</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleExport}
            className="flex items-center px-4 py-2 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <Download size={20} className="mr-2" />
            Exportar
          </button>
          <Link
            to="/caixa/lancamento"
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus size={20} className="mr-2" />
            Novo Lançamento
          </Link>
        </div>
      </div>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Entradas</p>
              <h3 className="text-2xl font-bold text-green-600 dark:text-green-400 mt-1">
                {statsLoading ? '...' : formatCurrency(stats?.totalEntradas || 0)}
              </h3>
            </div>
            <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <TrendingUp className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Saídas</p>
              <h3 className="text-2xl font-bold text-red-600 dark:text-red-400 mt-1">
                {statsLoading ? '...' : formatCurrency(stats?.totalSaidas || 0)}
              </h3>
            </div>
            <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
              <TrendingDown className="w-6 h-6 text-red-600 dark:text-red-400" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Saldo</p>
              <h3 className={`text-2xl font-bold mt-1 ${(stats?.saldo || 0) >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-red-600 dark:text-red-400'}`}>
                {statsLoading ? '...' : formatCurrency(stats?.saldo || 0)}
              </h3>
            </div>
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <DollarSign className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Contas a Pagar</p>
              <h3 className="text-2xl font-bold text-orange-600 dark:text-orange-400 mt-1">
                {statsLoading ? '...' : formatCurrency(stats?.contasAPagar || 0)}
              </h3>
            </div>
            <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
              <AlertCircle className="w-6 h-6 text-orange-600 dark:text-orange-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Filtros e Gráfico */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Evolução Financeira</h3>
          <div className="h-80">
            {statsLoading ? (
              <div className="h-full flex items-center justify-center text-gray-500 dark:text-gray-400">Carregando gráfico...</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={stats?.graphData || []}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#374151" />
                  <XAxis dataKey="date" stroke="#9CA3AF" />
                  <YAxis stroke="#9CA3AF" />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1F2937', borderColor: '#374151', color: '#F3F4F6' }}
                    itemStyle={{ color: '#F3F4F6' }}
                    formatter={(value: any) => formatCurrency(Number(value))}
                  />
                  <Legend />
                  <Line type="monotone" dataKey="entradas" name="Entradas" stroke="#16a34a" strokeWidth={2} />
                  <Line type="monotone" dataKey="saidas" name="Saídas" stroke="#dc2626" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 space-y-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Filtros</h3>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Período De</label>
            <input
              type="date"
              value={dateRange.startDate}
              onChange={(e) => setDateRange(prev => ({ ...prev, startDate: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Até</label>
            <input
              type="date"
              value={dateRange.endDate}
              onChange={(e) => setDateRange(prev => ({ ...prev, endDate: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tipo</label>
            <select
              value={tipoFiltro}
              onChange={(e) => setTipoFiltro(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="todos">Todos</option>
              <option value="entrada">Entradas</option>
              <option value="saida">Saídas</option>
            </select>
          </div>
        </div>
      </div>

      {/* Lista de Lançamentos */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden border border-gray-200 dark:border-gray-700">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Últimos Lançamentos</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300 uppercase">
              <tr>
                <th className="px-6 py-3">Data</th>
                <th className="px-6 py-3">Descrição</th>
                <th className="px-6 py-3">Categoria</th>
                <th className="px-6 py-3 text-right">Valor</th>
                <th className="px-6 py-3 text-center">Status</th>
                <th className="px-6 py-3 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {listLoading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">Carregando...</td>
                </tr>
              ) : lancamentos.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">Nenhum lançamento encontrado</td>
                </tr>
              ) : (
                lancamentos.map((item: any) => {
                  const vencido = isBoletoVencido(item);
                  return (
                    <tr key={item.id} className={`bg-white dark:bg-gray-800 border-b hover:bg-gray-50 dark:hover:bg-gray-700/50 ${vencido ? 'bg-red-50 dark:bg-red-900/10' : ''}`}>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-900 dark:text-white">
                        <div className="flex flex-col">
                          <span>{format(parseISO(item.data_lancamento), 'dd/MM/yyyy')}</span>
                          {item.data_vencimento && (
                            <span className={`text-xs ${vencido ? 'text-red-600 dark:text-red-400 font-bold' : 'text-gray-500 dark:text-gray-400'}`}>
                              Venc: {format(parseISO(item.data_vencimento), 'dd/MM/yyyy')}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-medium text-gray-900 dark:text-white">{item.descricao}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">{item.forma_pagamento}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300 rounded-full text-xs">
                          {item.categoria}
                        </span>
                      </td>
                      <td className={`px-6 py-4 text-right font-medium ${item.tipo === 'entrada' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                        {item.tipo === 'entrada' ? '+' : '-'}{formatCurrency(item.valor)}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold
                          ${item.status === 'pago' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' : 
                            item.status === 'cancelado' ? 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300' : 
                            'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'}`}>
                          {item.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex justify-center gap-2">
                          {item.status === 'pendente' && (
                            <button
                              onClick={() => handleConfirmarPagamento(item.id)}
                              className="text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300"
                              title="Confirmar Pagamento"
                            >
                              <Check size={18} />
                            </button>
                          )}
                          {item.anexo_url && (
                            <a 
                              href={item.anexo_url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                              title="Ver Comprovante"
                            >
                              <FileText size={18} />
                            </a>
                          )}
                          <button
                            onClick={() => handleDelete(item.id)}
                            disabled={item.status === 'pago'}
                            className={`title="Excluir" ${
                              item.status === 'pago' 
                                ? 'text-gray-400 cursor-not-allowed dark:text-gray-600' 
                                : 'text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300'
                            }`}
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        
        {/* Paginação */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
            <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
              Mostrando {Math.min((currentPage * ITEMS_PER_PAGE) + 1, totalCount)} a {Math.min((currentPage + 1) * ITEMS_PER_PAGE, totalCount)} de {totalCount} resultados
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 0}
                className="p-1 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft size={20} />
              </button>
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum = i;
                  if (totalPages > 5) {
                    if (currentPage > 2 && currentPage < totalPages - 2) {
                      pageNum = currentPage - 2 + i;
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 5 + i;
                    }
                  }
                  
                  return (
                    <button
                      key={pageNum}
                      onClick={() => handlePageChange(pageNum)}
                      className={`w-8 h-8 flex items-center justify-center rounded-md text-sm font-medium transition-colors ${
                        currentPage === pageNum
                          ? 'bg-blue-600 text-white'
                          : 'hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      {pageNum + 1}
                    </button>
                  );
                })}
              </div>
              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages - 1}
                className="p-1 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronRight size={20} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FluxoCaixa;