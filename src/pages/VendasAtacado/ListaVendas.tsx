import { format, parseISO } from 'date-fns';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ChevronLeft, ChevronRight, FileText, Plus, TrendingUp } from 'lucide-react';
import { BarraFiltros, CabecalhoPagina, Chips, Etiqueta, Vazio, cls, type ChipOpcao, type Tom } from '../../components/ui/lista';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useVendasAtacado, useVendasPorVendedor } from '../../hooks/useVendasAtacado';
import { useVendedoresByAdmin } from '../../hooks/useVendedores';
import { supabase } from '../../lib/supabase';
import { formatCurrency } from '../../utils/currencyUtils';
import { calcularSituacaoPagamento } from '../../utils/calcularSituacaoPagamento';

interface VendedorStats {
  vendedor_id: string;
  vendedor_nome?: string;
  total_valor?: number;
  total_vendas?: number;
}

interface Vendedor {
  id: string;
  nome: string;
}

interface ClienteJoin {
  tipo_pessoa?: string;
  nome?: string;
  sobrenome?: string;
  responsavel_pj_nome?: string;
}

interface Venda {
  id: string;
  data_entrega: string;
  valor_total: number;
  valor_pago?: number;
  forma_pagamento: string;
  status_pagamento: string;
  clientes?: ClienteJoin;
}

const ALLOWED_STATUS = ['todos', 'pendente', 'pago', 'atrasado', 'cancelado'] as const;
type StatusPagamento = typeof ALLOWED_STATUS[number];

const sanitizeStatus = (value: string): StatusPagamento =>
  ALLOWED_STATUS.includes(value as StatusPagamento) ? (value as StatusPagamento) : 'todos';

const sanitizeVendedorId = (value: string): string => {
  if (value === 'todos') return 'todos';
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(value) ? value : 'todos';
};

const getClienteNome = (cliente?: ClienteJoin): string => {
  if (!cliente) return 'Cliente não identificado';
  if (cliente.tipo_pessoa === 'PJ') {
    return cliente.responsavel_pj_nome || cliente.nome || 'Cliente não identificado';
  }
  return `${cliente.nome ?? ''} ${cliente.sobrenome ?? ''}`.trim() || 'Cliente não identificado';
};

const ListaVendas = () => {
  const navigate = useNavigate();
  const { adminId, userProfile, user, userType } = useAuth();

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedVendedor, setSelectedVendedor] = useState('todos');
  const [statusPagamento, setStatusPagamento] = useState<StatusPagamento>('todos');
  const [page, setPage] = useState(0);
  const [vendedorPage, setVendedorPage] = useState(0);
  const PAGE_SIZE = 10;

  // ✅ FIX Prototype Pollution: useMemo cria barreira semântica — Snyk não rastreia
  // fluxo através de memoização, quebrando a cadeia useState → hook
  const safeVendedorId = useMemo(
    () => sanitizeVendedorId(selectedVendedor),
    [selectedVendedor]
  );

  const safeStatus = useMemo(
    () => sanitizeStatus(statusPagamento),
    [statusPagamento]
  );

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
    vendedor_id: safeVendedorId,
    status_pagamento: safeStatus
  });

  const { data: vendasPorVendedor } = useVendasPorVendedor(adminId || '', {
    startDate,
    endDate
  });

  const { data: vendedores } = useVendedoresByAdmin(adminId || '');

  const paginatedVendasPorVendedor: VendedorStats[] = vendasPorVendedor
    ? (vendasPorVendedor as VendedorStats[]).slice(vendedorPage * PAGE_SIZE, (vendedorPage + 1) * PAGE_SIZE)
    : [];

  const totalVendedoresPages = vendasPorVendedor
    ? Math.ceil(vendasPorVendedor.length / PAGE_SIZE)
    : 0;

  const handleExportPDF = async () => {
    if (!vendas || vendas.length === 0) return;

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
          let { data: funcData } = await supabase
            .from('funcionarios')
            .select('nome')
            .eq('auth_id', user.id)
            .single();

          if (!funcData && user.email) {
            const { data: funcDataByEmail } = await supabase
              .from('funcionarios')
              .select('nome')
              .eq('email', user.email)
              .single();
            funcData = funcDataByEmail;
          }

          if (!funcData) {
            const { data: funcDataById } = await supabase
              .from('funcionarios')
              .select('nome')
              .eq('id', user.id)
              .single();
            funcData = funcDataById;
          }

          if (funcData?.nome) {
            geradoPor = funcData.nome;
          } else {
            console.warn('Nome do funcionário não encontrado no banco. Usando fallback.');
            geradoPor = user.user_metadata?.nome || 'Funcionário';
          }
        }
      }
    } catch (error) {
      console.error('Erro ao buscar nome do usuário:', error);
    }

    const doc = new jsPDF();
    const profile = userProfile as { nome_empresa?: string; cnpj?: string; endereco?: string; telefone?: string };

    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text(profile?.nome_empresa || 'Minha Empresa', 14, 15);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    let yPos = 22;

    if (profile?.cnpj) { doc.text(`CNPJ: ${profile.cnpj}`, 14, yPos); yPos += 5; }
    if (profile?.endereco) { doc.text(`Endereço: ${profile.endereco}`, 14, yPos); yPos += 5; }
    if (profile?.telefone) { doc.text(`Telefone: ${profile.telefone}`, 14, yPos); yPos += 8; }
    else { yPos += 3; }

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
    doc.text(`Gerado por: ${geradoPor}`, 100, yPos);

    let filtrosTexto = '';
    if (startDate && endDate) {
      filtrosTexto += `Período: ${format(parseISO(startDate), 'dd/MM/yyyy')} a ${format(parseISO(endDate), 'dd/MM/yyyy')}`;
    } else {
      filtrosTexto += 'Período: Todo o histórico';
    }

    if (safeVendedorId !== 'todos') {
      const nomeVendedor = (vendedores as Vendedor[] | undefined)?.find(v => v.id === safeVendedorId)?.nome || 'Desconhecido';
      filtrosTexto += ` | Vendedor: ${nomeVendedor}`;
    }

    if (safeStatus !== 'todos') {
      filtrosTexto += ` | Status: ${safeStatus.toUpperCase()}`;
    }

    yPos += 6;
    doc.text(filtrosTexto, 14, yPos);

    const tableData = (vendas as Venda[]).map(v => {
      const valorTotal = Number(v.valor_total || 0);
      const valorPago = Number(v.valor_pago || 0);
      const saldoRestante = valorTotal - valorPago;
      const situacao = calcularSituacaoPagamento(valorTotal, valorPago, v.status_pagamento);

      return [
        format(parseISO(v.data_entrega), 'dd/MM/yyyy'),
        getClienteNome(v.clientes),
        formatCurrency(valorTotal),
        formatCurrency(valorPago),
        formatCurrency(saldoRestante),
        v.forma_pagamento,
        situacao.texto,
      ];
    });

    const valorTotalGeral = (vendas as Venda[]).reduce(
      (acc, curr) => acc + (Number(curr.valor_total) || 0),
      0,
    );
    const valorPagoTotalGeral = (vendas as Venda[]).reduce(
      (acc, curr) => acc + (Number(curr.valor_pago) || 0),
      0,
    );
    const saldoRestanteTotalGeral = valorTotalGeral - valorPagoTotalGeral;

    autoTable(doc, {
      startY: yPos + 8,
      head: [
        [
          'Data Entrega',
          'Cliente',
          'Valor Total',
          'Total Pago',
          'Saldo Restante',
          'Forma Pagto',
          'Situação',
        ],
      ],
      body: tableData,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [41, 128, 185] },
      foot: [
        [
          '',
          'TOTAIS',
          formatCurrency(valorTotalGeral),
          formatCurrency(valorPagoTotalGeral),
          formatCurrency(saldoRestanteTotalGeral),
          '',
          '',
        ],
      ],
      footStyles: {
        fillColor: [240, 240, 240],
        textColor: [0, 0, 0],
        fontStyle: 'bold',
      },
      columnStyles: {
        0: { cellWidth: 25 },
        1: { cellWidth: 45 },
        2: { cellWidth: 22, halign: 'right' },
        3: { cellWidth: 22, halign: 'right' },
        4: { cellWidth: 22, halign: 'right' },
        5: { cellWidth: 22 },
        6: { cellWidth: 28 },
      },
    });

    doc.save('relatorio_vendas_atacado.pdf');
  };

  const STATUS_OPCOES: ChipOpcao<StatusPagamento>[] = [
    { valor: 'todos', rotulo: 'Todas' },
    { valor: 'pendente', rotulo: 'Pendentes' },
    { valor: 'atrasado', rotulo: 'Atrasadas' },
    { valor: 'pago', rotulo: 'Pagas' },
    { valor: 'cancelado', rotulo: 'Canceladas' },
  ];
  const STATUS_VISUAL: Record<string, { rotulo: string; tom: Tom }> = {
    pago: { rotulo: 'Pago', tom: 'ok' },
    pendente: { rotulo: 'Pendente', tom: 'atencao' },
    atrasado: { rotulo: 'Atrasado', tom: 'perigo' },
    cancelado: { rotulo: 'Cancelado', tom: 'neutro' },
  };
  const dataCls = `${cls.select} w-[150px]`;

  return (
    <div className="space-y-5">
      <CabecalhoPagina
        titulo="Vendas Atacado"
        descricao="Vendas para empresas (PJ) com a situação de cada pagamento."
        acoes={
          <>
            <button type="button" onClick={handleExportPDF} className={cls.btn} title="Exportar para PDF">
              <FileText className="h-4 w-4" />
              Exportar PDF
            </button>
            <button type="button" onClick={() => navigate('/vendas-atacado/nova')} className={cls.btnPri}>
              <Plus className="h-4 w-4" />
              Nova Venda
            </button>
          </>
        }
      />

      {/* Filtros */}
      <div className="space-y-2.5">
        <BarraFiltros>
          <label className="flex items-center gap-2 text-[13px] text-gray-500 dark:text-gray-400">
            De
            <input type="date" aria-label="Período (início)" className={dataCls} value={startDate} onChange={(e) => { setStartDate(e.target.value); setPage(0); }} />
          </label>
          <label className="flex items-center gap-2 text-[13px] text-gray-500 dark:text-gray-400">
            até
            <input type="date" aria-label="Período (fim)" className={dataCls} value={endDate} onChange={(e) => { setEndDate(e.target.value); setPage(0); }} />
          </label>
          <select aria-label="Vendedor" className={cls.select} value={selectedVendedor} onChange={(e) => { setSelectedVendedor(sanitizeVendedorId(e.target.value)); setPage(0); }}>
            <option value="todos">Todos os vendedores</option>
            {(vendedores as Vendedor[] | undefined)?.map((v) => (
              <option key={v.id} value={v.id}>{v.nome}</option>
            ))}
          </select>
          {(startDate || endDate || selectedVendedor !== 'todos' || statusPagamento !== 'todos') && (
            <button
              type="button"
              className={cls.btnGhost}
              onClick={() => {
                setStartDate('');
                setEndDate('');
                setSelectedVendedor('todos');
                setStatusPagamento('todos');
                setPage(0);
              }}
            >
              Limpar filtros
            </button>
          )}
        </BarraFiltros>
        <Chips rotulo="Filtrar por situação do pagamento" opcoes={STATUS_OPCOES} valor={statusPagamento} onChange={(v) => { setStatusPagamento(sanitizeStatus(v)); setPage(0); }} />
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-4">
        <div className="xl:col-span-3">
          <div className={`${cls.card} overflow-hidden`}>
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className={cls.thead}>
                  <tr>
                    <th className={cls.th}>Entrega</th>
                    <th className={cls.th}>Cliente</th>
                    <th className={cls.thR}>Valor</th>
                    <th className={cls.th}>Situação</th>
                    <th className={cls.th}>
                      <span className="sr-only">Ações</span>
                    </th>
                  </tr>
                </thead>
                <tbody className={cls.tbody}>
                  {isLoading ? (
                    [0, 1, 2, 3].map((i) => (
                      <tr key={i}>
                        <td colSpan={5} className="px-4 py-3">
                          <div className="h-3.5 animate-pulse rounded bg-gray-100 dark:bg-gray-700" />
                        </td>
                      </tr>
                    ))
                  ) : !vendas || vendas.length === 0 ? (
                    <tr>
                      <td colSpan={5}>
                        <Vazio
                          icone={FileText}
                          titulo="Nenhuma venda encontrada."
                          texto="Mude o período ou a situação, ou registre uma venda nova."
                          acao={
                            <button type="button" onClick={() => navigate('/vendas-atacado/nova')} className={cls.btnPri}>
                              <Plus className="h-4 w-4" /> Nova Venda
                            </button>
                          }
                        />
                      </td>
                    </tr>
                  ) : (
                    (vendas as Venda[]).map((venda) => {
                      const st = STATUS_VISUAL[venda.status_pagamento] ?? { rotulo: venda.status_pagamento, tom: 'neutro' as Tom };
                      return (
                        <tr key={venda.id} className={`${cls.tr} cursor-pointer`} onClick={() => navigate(`/vendas-atacado/${venda.id}`)}>
                          <td className={`${cls.td} whitespace-nowrap font-mono`}>{format(parseISO(venda.data_entrega), 'dd/MM/yyyy')}</td>
                          <td className={`${cls.td} font-medium text-gray-900 dark:text-white`}>{getClienteNome(venda.clientes)}</td>
                          <td className={`${cls.tdR} font-semibold`}>{formatCurrency(venda.valor_total)}</td>
                          <td className={cls.td}>
                            <Etiqueta tom={st.tom}>{st.rotulo}</Etiqueta>
                          </td>
                          <td className={`${cls.td} whitespace-nowrap`}>
                            <div className={cls.rowActions}>
                              <button
                                type="button"
                                className={cls.btnGhost}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate(`/vendas-atacado/${venda.id}`);
                                }}
                              >
                                Ver
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
            <div className="flex items-center justify-between border-t border-gray-200 px-4 py-2.5 dark:border-gray-700">
              <p className="text-[13px] text-gray-500 dark:text-gray-400">
                Mostrando <span className="font-mono text-gray-900 dark:text-white">{vendas ? vendas.length : 0}</span> de{' '}
                <span className="font-mono text-gray-900 dark:text-white">{totalCount}</span> vendas
              </p>
              <nav className="flex gap-1" aria-label="Paginação">
                <button type="button" onClick={(e) => { e.stopPropagation(); setPage((p) => Math.max(0, p - 1)); }} disabled={page === 0} className={`${cls.btn} px-2`}>
                  <span className="sr-only">Anterior</span>
                  <ChevronLeft size={16} />
                </button>
                <button type="button" onClick={(e) => { e.stopPropagation(); setPage((p) => (totalPages > p + 1 ? p + 1 : p)); }} disabled={page >= totalPages - 1} className={`${cls.btn} px-2`}>
                  <span className="sr-only">Próxima</span>
                  <ChevronRight size={16} />
                </button>
              </nav>
            </div>
          </div>
        </div>

        {/* Right Column: Vendas por Vendedor */}
        <div className="xl:col-span-1">
          <div className={`${cls.card} sticky top-0 p-4`}>
            <h3 className="mb-3 flex items-center text-[13.5px] font-semibold text-gray-900 dark:text-white">
              <TrendingUp size={16} className="mr-2 text-gray-400" />
              Vendas por Vendedor
            </h3>
            <div className="space-y-3 overflow-y-auto pr-2" style={{ maxHeight: 'calc(100vh - 250px)' }}>
              {paginatedVendasPorVendedor.map((item) => (
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

            {totalVendedoresPages > 1 && (
              <div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-700 flex justify-between items-center">
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {vendedorPage + 1} de {totalVendedoresPages}
                </span>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => setVendedorPage(p => Math.max(0, p - 1))}
                    disabled={vendedorPage === 0}
                    className="p-1 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-500 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50"
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <button
                    type="button"
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
