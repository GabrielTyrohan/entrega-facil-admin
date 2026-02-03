import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/Skeleton';
import { useEstoque } from '@/hooks/useEstoque';
import { Download, Filter, Printer, Search } from 'lucide-react';
import { useMemo, useState } from 'react';

const Badge = ({ children, variant }: { children: React.ReactNode, variant: 'default' | 'destructive' | 'warning' | 'success' | 'outline' }) => {
  const styles = {
    default: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
    destructive: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
    warning: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
    success: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
    outline: "border border-gray-200 text-gray-800 dark:border-gray-700 dark:text-gray-300",
  };
  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[variant]}`}>
      {children}
    </span>
  );
};

export default function RelatorioEstoque() {
  const { data: estoque, isLoading } = useEstoque();
  
  const [filters, setFilters] = useState({
    search: '',
    status: '',
    categoria: ''
  });

  const filteredData = useMemo(() => {
    if (!estoque) return [];

    return estoque.filter(item => {
      // Filter by Search (Name or Code)
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        const matchName = item.produto_nome.toLowerCase().includes(searchLower);
        const matchCode = item.produto_cod?.toLowerCase().includes(searchLower);
        if (!matchName && !matchCode) return false;
      }

      // Filter by Status
      if (filters.status && item.status_estoque !== filters.status) {
        return false;
      }

      // Filter by Category (if implemented later, for now just placeholder logic)
      if (filters.categoria && item.categoria !== filters.categoria) {
        return false;
      }

      return true;
    });
  }, [estoque, filters]);

  // Extract unique categories for filter
  const categories = useMemo(() => {
    if (!estoque) return [];
    return Array.from(new Set(estoque.map(item => item.categoria))).filter(Boolean).sort();
  }, [estoque]);

  const handlePrint = () => {
    window.print();
  };

  const handleExportCSV = () => {
    if (!filteredData.length) return;

    const headers = ['Código', 'Produto', 'Categoria', 'Qtd Atual', 'Unidade', 'Estoque Mínimo', 'Status', 'Custo Unit.', 'Valor Total'];
    const csvContent = [
      headers.join(','),
      ...filteredData.map(item => [
        `"${item.produto_cod || ''}"`,
        `"${item.produto_nome}"`,
        `"${item.categoria}"`,
        item.qtd_estoque,
        item.unidade_medida,
        item.estoque_minimo,
        item.status_estoque,
        (item.custo_compra || 0).toFixed(2),
        ((item.custo_compra || 0) * item.qtd_estoque).toFixed(2)
      ].join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `relatorio_estoque_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'ZERADO': return 'destructive';
      case 'BAIXO': return 'warning';
      case 'NORMAL': return 'success';
      case 'EXCESSO': return 'default';
      default: return 'outline';
    }
  };

  const totalValorEstoque = filteredData.reduce((acc, item) => acc + ((item.custo_compra || 0) * item.qtd_estoque), 0);

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-6 print:p-0 print:max-w-none">
      {/* Styles for print */}
      <style>
        {`
          @media print {
            body * {
              visibility: hidden;
            }
            #printable-content, #printable-content * {
              visibility: visible;
            }
            #printable-content {
              position: absolute;
              left: 0;
              top: 0;
              width: 100%;
              padding: 20px;
              background: white;
            }
            .no-print {
              display: none !important;
            }
            /* Ensure background colors print */
            * {
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
          }
        `}
      </style>

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 no-print">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Relatório de Estoque</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Visão geral do inventário com valores e status
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleExportCSV}>
            <Download className="w-4 h-4 mr-2" />
            Exportar CSV
          </Button>
          <Button onClick={handlePrint}>
            <Printer className="w-4 h-4 mr-2" />
            Imprimir
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 no-print">
        <div className="flex items-center gap-2 mb-4 text-sm font-medium text-gray-700 dark:text-gray-300">
          <Filter className="w-4 h-4" />
          Filtros
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-500">Buscar Produto</label>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Nome ou código..."
                className="w-full h-10 pl-9 pr-3 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={filters.search}
                onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-500">Status</label>
            <select
              className="w-full h-10 px-3 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={filters.status}
              onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
            >
              <option value="">Todos os status</option>
              <option value="NORMAL">Normal</option>
              <option value="BAIXO">Baixo</option>
              <option value="ZERADO">Zerado</option>
              <option value="EXCESSO">Excesso</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-500">Categoria</label>
            <select
              className="w-full h-10 px-3 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={filters.categoria}
              onChange={(e) => setFilters(prev => ({ ...prev, categoria: e.target.value }))}
            >
              <option value="">Todas as categorias</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Summary Cards (Visible in Print) */}
      <div id="printable-content" className="space-y-6">
        <div className="hidden print:block mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Relatório de Estoque</h1>
          <p className="text-sm text-gray-500">Gerado em {new Date().toLocaleDateString()} às {new Date().toLocaleTimeString()}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 print:grid-cols-4">
          <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
            <p className="text-sm text-gray-500">Total de Produtos</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{filteredData.length}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
            <p className="text-sm text-gray-500">Itens com Estoque Baixo</p>
            <p className="text-2xl font-bold text-yellow-600">
              {filteredData.filter(i => i.status_estoque === 'BAIXO').length}
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
            <p className="text-sm text-gray-500">Itens Zerados</p>
            <p className="text-2xl font-bold text-red-600">
              {filteredData.filter(i => i.status_estoque === 'ZERADO').length}
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
            <p className="text-sm text-gray-500">Valor Total (Custo)</p>
            <p className="text-2xl font-bold text-blue-600">
              {formatCurrency(totalValorEstoque)}
            </p>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <th className="px-4 py-3 font-medium">Produto</th>
                  <th className="px-4 py-3 font-medium">Categoria</th>
                  <th className="px-4 py-3 font-medium text-center">Qtd Atual</th>
                  <th className="px-4 py-3 font-medium text-center">Mínimo</th>
                  <th className="px-4 py-3 font-medium text-center">Status</th>
                  <th className="px-4 py-3 font-medium text-right">Custo Unit.</th>
                  <th className="px-4 py-3 font-medium text-right">Valor Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}>
                      <td className="px-4 py-3"><Skeleton className="h-4 w-40" /></td>
                      <td className="px-4 py-3"><Skeleton className="h-4 w-24" /></td>
                      <td className="px-4 py-3"><Skeleton className="h-4 w-12 mx-auto" /></td>
                      <td className="px-4 py-3"><Skeleton className="h-4 w-12 mx-auto" /></td>
                      <td className="px-4 py-3"><Skeleton className="h-4 w-16 mx-auto" /></td>
                      <td className="px-4 py-3"><Skeleton className="h-4 w-20 ml-auto" /></td>
                      <td className="px-4 py-3"><Skeleton className="h-4 w-20 ml-auto" /></td>
                    </tr>
                  ))
                ) : filteredData.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                      Nenhum produto encontrado com os filtros selecionados.
                    </td>
                  </tr>
                ) : (
                  filteredData.map((item) => (
                    <tr key={item.id} className="bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                        <div>{item.produto_nome}</div>
                        {item.produto_cod && (
                          <div className="text-xs text-gray-500">{item.produto_cod}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                        {item.categoria}
                      </td>
                      <td className="px-4 py-3 text-center font-medium">
                        {item.qtd_estoque} {item.unidade_medida}
                      </td>
                      <td className="px-4 py-3 text-center text-gray-500">
                        {item.estoque_minimo}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Badge variant={getStatusVariant(item.status_estoque)}>
                          {item.status_estoque}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right text-gray-500">
                        {formatCurrency(item.custo_compra || 0)}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-gray-900 dark:text-white">
                        {formatCurrency((item.custo_compra || 0) * item.qtd_estoque)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}