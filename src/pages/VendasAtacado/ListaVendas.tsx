import { format, parseISO } from 'date-fns';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ChevronLeft, ChevronRight, FileText, Filter, Plus, TrendingUp } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useVendasAtacado, useVendasPorVendedor } from '../../hooks/useVendasAtacado';
import { useVendedoresByAdmin } from '../../hooks/useVendedores';
import { supabase } from '../../lib/supabase';
import { formatCurrency } from '../../utils/currencyUtils';

const ListaVendas = () => {
  const navigate = useNavigate();
  const { adminId, userProfile, user, userType } = useAuth();
  
  // Filters State
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedVendedor, setSelectedVendedor] = useState('todos');
  const [statusPagamento, setStatusPagamento] = useState('todos');
  const [page, setPage] = useState(0);
  const [vendedorPage, setVendedorPage] = useState(0);
  const PAGE_SIZE = 10;

  // Queries
  const { 
    data: vendas, 
    isLoading, 
    totalPages, 
    totalCount 
  } = useVendasAtacado(adminId || '', {
    page,
    pageSize: PAGE_SIZE,
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

  // Derived state for paginated sellers
  const paginatedVendasPorVendedor = vendasPorVendedor 
    ? vendasPorVendedor.slice(vendedorPage * PAGE_SIZE, (vendedorPage + 1) * PAGE_SIZE)
    : [];
  
  const totalVendedoresPages = vendasPorVendedor 
    ? Math.ceil(vendasPorVendedor.length / PAGE_SIZE) 
    : 0;

  // Handlers
  const handleExportPDF = async () => {
    if (!vendas || vendas.length === 0) return;

    // Buscar nome do usuário gerador
    let geradoPor = 'Usuário do Sistema';
    try {
      if (user?.id) {
        if (userType === 'admin') {
          const { data: adminData } = await supabase
            .from('administradores')
            .select('nome')
            .eq('id', user.id)
            .single();
          if (adminData) geradoPor = adminData.nome;
        } else {
          // Tenta buscar por 'auth_id' primeiro
          let { data: funcData } = await supabase
            .from('funcionarios')
            .select('nome')
            .eq('auth_id', user.id)
            .single();
            
          // Se falhar, tenta buscar por 'email' que é um identificador único comum
          if (!funcData && user.email) {
             const { data: funcDataByEmail } = await supabase
              .from('funcionarios')
              .select('nome')
              .eq('email', user.email)
              .single();
              funcData = funcDataByEmail;
          }

          // Se ainda falhar, tenta buscar por 'id' direto (menos provável, mas possível)
          if (!funcData) {
             const { data: funcDataById } = await supabase
              .from('funcionarios')
              .select('nome')
              .eq('id', user.id)
              .single();
              funcData = funcDataById;
          }
          
          if (funcData && funcData.nome) {
             geradoPor = funcData.nome;
          } else {
             // Fallback final: Se realmente não achar, usa o nome do metadata
             // mas adiciona um log para saber que falhou a busca no banco
             console.warn('Nome do funcionário não encontrado no banco. Usando fallback.');
             geradoPor = user.user_metadata?.nome || 'Funcionário';
          }
        }
      }
    } catch (error) {
      console.error('Erro ao buscar nome do usuário:', error);
    }

    const doc = new jsPDF();

    // Cabeçalho da Empresa
    const profile = userProfile as any;
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text(profile?.nome_empresa || 'Minha Empresa', 14, 15);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    let yPos = 22;
    
    if (profile?.cnpj) {
      doc.text(`CNPJ: ${profile.cnpj}`, 14, yPos);
      yPos += 5;
    }
    if (profile?.endereco) {
      doc.text(`Endereço: ${profile.endereco}`, 14, yPos);
      yPos += 5;
    }
    if (profile?.telefone) {
      doc.text(`Telefone: ${profile.telefone}`, 14, yPos);
      yPos += 8;
    } else {
      yPos += 3;
    }

    // Título do Relatório e Filtros
    doc.setDrawColor(200);
    doc.line(14, yPos, 196, yPos);
    yPos += 10;

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Relatório de Vendas Atacado', 14, yPos);
    
    yPos += 7;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Gerado em: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 14, yPos);
    
    // Identificar quem gerou o relatório
    doc.text(`Gerado por: ${geradoPor}`, 100, yPos);
    
    // Informações de Filtro
    let filtrosTexto = '';
    if (startDate && endDate) {
      filtrosTexto += `Período: ${format(parseISO(startDate), 'dd/MM/yyyy')} a ${format(parseISO(endDate), 'dd/MM/yyyy')}`;
    } else {
      filtrosTexto += 'Período: Todo o histórico';
    }
    
    if (selectedVendedor !== 'todos') {
      const nomeVendedor = vendedores?.find(v => v.id === selectedVendedor)?.nome || 'Desconhecido';
      filtrosTexto += ` | Vendedor: ${nomeVendedor}`;
    }
    
    if (statusPagamento !== 'todos') {
      filtrosTexto += ` | Status: ${statusPagamento.toUpperCase()}`;
    }

    yPos += 6;
    doc.text(filtrosTexto, 14, yPos);

    // Preparar dados da tabela
    const tableData = vendas.map(v => {
      const cliente = (v as any).clientes;
      const clienteNome = cliente 
        ? (cliente.tipo_pessoa === 'PJ' 
            ? (cliente.responsavel_pj_nome || cliente.nome) 
            : `${cliente.nome} ${cliente.sobrenome || ''}`.trim())
        : 'Cliente não identificado';

      return [
        format(parseISO(v.data_entrega), 'dd/MM/yyyy'),
        clienteNome,
        formatCurrency(v.valor_total),
        v.forma_pagamento,
        v.status_pagamento.toUpperCase()
      ];
    });

    // Calcular totais
    const valorTotal = vendas.reduce((acc, curr) => acc + (Number(curr.valor_total) || 0), 0);

    autoTable(doc, {
      startY: yPos + 8,
      head: [['Data Entrega', 'Cliente', 'Valor', 'Forma Pagto', 'Status']],
      body: tableData,
      styles: { fontSize: 9 },
      headStyles: { fillColor: [41, 128, 185] },
      foot: [['', 'TOTAL', formatCurrency(valorTotal), '', '']],
      footStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' }
    });

    doc.save('relatorio_vendas_atacado.pdf');
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
            onClick={handleExportPDF}
            className="flex items-center px-4 py-2  bg-red-600 hover:bg-red-700 text-white rounded-md transition-colors shadow-sm"
            title="Exportar para PDF"
          >
            <FileText size={18} className="mr-2" />
            Exportar PDF
          </button>
        </div>
      </div>

      {/* Filters Section */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
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

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        
        {/* Left Column: List (3/4 width on large screens) */}
        <div className="xl:col-span-3">
          {/* Table */}
          <div className="bg-white dark:bg-gray-800 shadow-sm rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Entrega</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Nome Cliente</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Valor</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Ações</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {isLoading ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                        Carregando vendas...
                      </td>
                    </tr>
                  ) : vendas?.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                        Nenhuma venda encontrada.
                      </td>
                    </tr>
                  ) : (
                    vendas?.map((venda) => {
                      const cliente = (venda as any).clientes;
                      const clienteNome = cliente 
                        ? (cliente.tipo_pessoa === 'PJ' 
                            ? (cliente.responsavel_pj_nome || cliente.nome) 
                            : `${cliente.nome} ${cliente.sobrenome || ''}`.trim())
                        : 'Cliente não identificado';

                      return (
                        <tr key={venda.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer" onClick={() => navigate(`/vendas-atacado/${venda.id}`)}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                            {format(parseISO(venda.data_entrega), 'dd/MM/yyyy')}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                            {clienteNome}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900 dark:text-white">
                            {formatCurrency(venda.valor_total)}
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
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                            <button className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300">Ver</button>
                          </td>
                        </tr>
                      );
                    })
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
                      onClick={(e) => { e.stopPropagation(); setPage(p => Math.max(0, p - 1)); }}
                      disabled={page === 0}
                      className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm font-medium text-gray-500 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50"
                    >
                      <span className="sr-only">Anterior</span>
                      <ChevronLeft size={16} />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setPage(p => (totalPages > p + 1 ? p + 1 : p)); }}
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

        {/* Right Column: Vendas por Vendedor (1/4 width) */}
        <div className="xl:col-span-1">
           {/* Totals Summary moved here - Reusing previous container */}
           <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 h-full sticky top-6">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-3 flex items-center">
              <TrendingUp size={16} className="mr-2" />
              Vendas por Vendedor
            </h3>
            <div className="space-y-3 overflow-y-auto pr-2" style={{ maxHeight: 'calc(100vh - 250px)' }}>
              {paginatedVendasPorVendedor.map((item: any) => (
                <div key={item.vendedor_id} className="flex justify-between items-center text-sm border-b border-gray-50 dark:border-gray-700 pb-2 last:border-0 last:pb-0">
                  <span className="text-gray-600 dark:text-gray-300 truncate mr-2 flex-1" title={item.vendedor_nome || 'Desconhecido'}>
                    {item.vendedor_nome || 'Desconhecido'}
                  </span>
                  <div className="text-right">
                    <div className="font-semibold text-gray-900 dark:text-white">{formatCurrency(item.total_valor || 0)}</div>
                    <div className="text-xs text-gray-400 dark:text-gray-500">{item.total_vendas || 0} vendas</div>
                  </div>
                </div>
              ))}
              {(!vendasPorVendedor || vendasPorVendedor.length === 0) && (
                <div className="text-center text-xs text-gray-500 dark:text-gray-400 py-4">
                  Nenhum dado disponível para o período selecionado
                </div>
              )}
            </div>
            
            {/* Vendedores Pagination */}
            {totalVendedoresPages > 1 && (
              <div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-700 flex justify-between items-center">
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {vendedorPage + 1} de {totalVendedoresPages}
                </span>
                <div className="flex gap-1">
                  <button
                    onClick={() => setVendedorPage(p => Math.max(0, p - 1))}
                    disabled={vendedorPage === 0}
                    className="p-1 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-500 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50"
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <button
                    onClick={() => setVendedorPage(p => (totalVendedoresPages > p + 1 ? p + 1 : p))}
                    disabled={vendedorPage >= totalVendedoresPages - 1}
                    className="p-1 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-500 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50"
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ListaVendas;
