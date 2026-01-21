import { format, isAfter, parseISO, subDays } from 'date-fns';
import {
  AlertCircle,
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
import XLSX from 'xlsx-js-style';
import { useAuth } from '../../contexts/AuthContext';
import { useDeleteLancamento, useFluxoCaixa, useFluxoCaixaStats } from '../../hooks/useFluxoCaixa';
import { formatCurrency } from '../../utils/currencyUtils';

const FluxoCaixa = () => {
  const { adminId } = useAuth();
  const [dateRange, setDateRange] = useState({
    startDate: subDays(new Date(), 30).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });
  const [tipoFiltro, setTipoFiltro] = useState('todos');
  
  const { data: stats, isLoading: statsLoading } = useFluxoCaixaStats(
    adminId || '',
    dateRange.startDate,
    dateRange.endDate
  );

  const { data: lancamentos, isLoading: listLoading, refetch } = useFluxoCaixa(
    adminId || '',
    {
      startDate: dateRange.startDate,
      endDate: dateRange.endDate,
      tipo: tipoFiltro,
      pageSize: 15 // Mostrar os últimos 15 lançamentos
    }
  );

  const deleteMutation = useDeleteLancamento();

  const handleDelete = async (id: string) => {
    if (window.confirm('Tem certeza que deseja excluir este lançamento?')) {
      await deleteMutation.mutateAsync(id);
      refetch();
    }
  };

  const handleExport = () => {
    if (!lancamentos.length) return;

    const dataToExport = lancamentos.map(l => ({
      Data: format(parseISO(l.data_lancamento), 'dd/MM/yyyy'),
      Tipo: l.tipo.toUpperCase(),
      Categoria: l.categoria,
      Descrição: l.descricao,
      Valor: Number(l.valor),
      'Forma Pagamento': l.forma_pagamento,
      Status: l.status.toUpperCase(),
      Vencimento: l.data_vencimento ? format(parseISO(l.data_vencimento), 'dd/MM/yyyy') : '-'
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);

    // Ajustar largura das colunas automaticamente com base no conteúdo
    const colWidths = Object.keys(dataToExport[0]).map(key => {
      const maxContentLength = Math.max(
        ...dataToExport.map(row => String(row[key as keyof typeof row] || '').length),
        key.length
      );
      // Aumentei um pouco o limite máximo e o padding
      return { wch: Math.min(Math.max(maxContentLength + 5, 12), 120) };
    });

    ws['!cols'] = colWidths;

    // Estilos
    const range = XLSX.utils.decode_range(ws['!ref'] || 'A1:A1');
    
    const headerStyle = {
      font: { bold: true, color: { rgb: "FFFFFF" }, sz: 12 },
      fill: { fgColor: { rgb: "2F75B5" } }, // Azul mais escuro para cabeçalho
      alignment: { horizontal: "center", vertical: "center", wrapText: true },
      border: {
        top: { style: "thin", color: { rgb: "000000" } },
        bottom: { style: "medium", color: { rgb: "000000" } }, // Borda inferior mais grossa no cabeçalho
        left: { style: "thin", color: { rgb: "000000" } },
        right: { style: "thin", color: { rgb: "000000" } }
      }
    };

    const baseDataStyle = {
      font: { sz: 11 },
      alignment: { vertical: "center", wrapText: true }, // Alinhamento vertical centralizado e quebra de linha
      border: {
        top: { style: "thin", color: { rgb: "000000" } },
        bottom: { style: "thin", color: { rgb: "000000" } },
        left: { style: "thin", color: { rgb: "000000" } },
        right: { style: "thin", color: { rgb: "000000" } }
      }
    };

    const currencyStyle = {
      ...baseDataStyle,
      alignment: { ...baseDataStyle.alignment, horizontal: "center" },
      numFmt: '"R$ "#,##0.00'
    };

    const centerStyle = {
      ...baseDataStyle,
      alignment: { ...baseDataStyle.alignment, horizontal: "center" }
    };

    for (let R = range.s.r; R <= range.e.r; ++R) {
      for (let C = range.s.c; C <= range.e.c; ++C) {
        const cell_address = XLSX.utils.encode_cell({ r: R, c: C });
        if (!ws[cell_address]) continue;

        if (R === 0) {
          ws[cell_address].s = headerStyle;
        } else {
          // Colunas: 0=Data, 1=Tipo, 2=Categoria, 3=Descrição, 4=Valor, 5=Forma Pagamento, 6=Status, 7=Vencimento
          if (C === 4) { // Valor
            ws[cell_address].s = currencyStyle;
          } else {
            // Todas as outras colunas centralizadas (Data, Tipo, Categoria, Descrição, Forma Pagamento, Status, Vencimento)
            ws[cell_address].s = centerStyle;
          }
        }
      }
    }

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Fluxo de Caixa");
    XLSX.writeFile(wb, `fluxo_caixa_${dateRange.startDate}_${dateRange.endDate}.xlsx`);
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
                            className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                            title="Excluir"
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
      </div>
    </div>
  );
};

export default FluxoCaixa;