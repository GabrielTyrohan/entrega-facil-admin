import React, { useState, useMemo } from 'react';
import { 
  Calendar, 
  TrendingUp, 
  Users, 
  DollarSign, 
  Package, 
  Truck,
  Filter,
  BarChart3,
  FileText,
  Printer,
  CreditCard,
  Info,
  MoreHorizontal
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from '../contexts/AuthContext';
import { usePagamentos } from '../hooks/usePagamentos';
import { useEntregas } from '../hooks/useEntregas';
import { useVendedores } from '../hooks/useVendedores';
import { useProdutos } from '../hooks/useProdutos';
import { subtractDaysUTC3, toUTC3 } from '../utils/dateUtils';

const Relatorios: React.FC = () => {
  const { user } = useAuth();
  const [selectedPeriod, setSelectedPeriod] = useState('30'); // dias
  const [selectedReport, setSelectedReport] = useState<'vendas' | 'vendedores' | 'entregas' | 'produtos'>('vendas');

  // Hooks para buscar dados com administrador_id
  const administrador_id = user?.id;
  
  // Adicionar verificação de erro e loading
  const { data: pagamentos = [], isLoading: isLoadingPagamentos, error: errorPagamentos } = usePagamentos({ 
    enabled: !!administrador_id,
    administrador_id 
  });
  const { data: entregas = [], isLoading: isLoadingEntregas, error: errorEntregas } = useEntregas({ 
    enabled: !!administrador_id,
    administrador_id 
  });
  const { data: vendedores = [], isLoading: isLoadingVendedores, error: errorVendedores } = useVendedores({ 
    enabled: !!administrador_id,
    administrador_id 
  });
  const { data: produtos = [], isLoading: isLoadingProdutos, error: errorProdutos } = useProdutos({ 
    enabled: !!administrador_id
  });

  // Verificar se há erros
  const hasErrors = errorPagamentos || errorEntregas || errorVendedores || errorProdutos;
  const isLoading = isLoadingPagamentos || isLoadingEntregas || isLoadingVendedores || isLoadingProdutos;

  // Calcular período usando UTC-3 - MOVER ANTES DOS EARLY RETURNS
  const periodoDias = parseInt(selectedPeriod);
  const dataInicio = subtractDaysUTC3(new Date(), periodoDias);

  // Filtrar dados por período usando UTC-3
  const dadosPeriodo = useMemo(() => {
    try {
      // Verificar se os dados existem antes de filtrar
      if (!Array.isArray(pagamentos) || !Array.isArray(entregas)) {
        return { pagamentos: [], entregas: [] };
      }

      // Primeiro, filtrar pagamentos por período (data_pagamento) usando UTC-3
      const pagamentosFiltrados = pagamentos.filter((p: Record<string, unknown>) => {
        try {
          if (!p?.data_pagamento) return false;
          const dataPagamento = toUTC3(new Date(p.data_pagamento as string));
          return dataPagamento >= dataInicio;
        } catch (error) {
          console.warn('Erro ao processar data de pagamento:', p, error);
          return false;
        }
      });
      
      // Depois, filtrar entregas que têm pagamentos no período
      const entregasComPagamentos = pagamentosFiltrados.map((p: Record<string, unknown>) => p.entrega_id).filter(Boolean);
      const entregasFiltradas = entregas.filter((e: Record<string, unknown>) => 
        entregasComPagamentos.includes(e?.id)
      );

      return {
        pagamentos: pagamentosFiltrados,
        entregas: entregasFiltradas
      };
    } catch (error) {
      console.error('Erro ao filtrar dados por período:', error);
      return { pagamentos: [], entregas: [] };
    }
  }, [pagamentos, entregas, dataInicio]);

  // Calcular métricas de vendas
  const metricas = useMemo(() => {
    try {
      // Verificar se dadosPeriodo existe e tem dados válidos
      if (!dadosPeriodo?.entregas || !dadosPeriodo?.pagamentos) {
        return {
          totalVendas: 0,
          totalPagamentos: 0,
          totalEntregas: 0,
          entregasPagas: 0,
          entregasPendentes: 0,
          vendedorPerformance: [],
          produtoVendas: []
        };
      }

      // Total de vendas baseado no valor das entregas (não dos pagamentos)
      const totalVendasEntregas = dadosPeriodo.entregas.reduce((sum: number, e: Record<string, unknown>) => {
        return sum + (parseFloat(e?.valor as string) || 0);
      }, 0);
      
      // Total de pagamentos efetivamente recebidos
      const totalPagamentos = dadosPeriodo.pagamentos.reduce((sum: number, p: Record<string, unknown>) => {
        return sum + (parseFloat(p?.valor as string) || 0);
      }, 0);
      
      const totalEntregas = dadosPeriodo.entregas.length;
      
      // Calcular entregas pagas baseado na comparação entre valor da entrega e soma dos pagamentos
      const entregasPagas = dadosPeriodo.entregas.filter((entrega: Record<string, unknown>) => {
        try {
          if (!entrega?.id || !entrega?.valor) return false;
          
          // Buscar todos os pagamentos relacionados a esta entrega
          const pagamentosEntrega = dadosPeriodo.pagamentos.filter((p: Record<string, unknown>) => p?.entrega_id === entrega.id);
          
          // Somar todos os pagamentos desta entrega
          const totalPagamentosEntrega = pagamentosEntrega.reduce((sum: number, p: Record<string, unknown>) => {
            return sum + (parseFloat(p?.valor as string) || 0);
          }, 0);
          
          // Considerar paga se o total de pagamentos for igual ou maior que o valor da entrega
          return totalPagamentosEntrega >= (parseFloat(entrega.valor as string) || 0);
        } catch (error) {
          console.warn('Erro ao processar entrega:', entrega, error);
          return false;
        }
      }).length;
      
      const entregasPendentes = totalEntregas - entregasPagas;

      // Performance por vendedor - corrigindo cálculo de vendas
      const vendedorPerformance = Array.isArray(vendedores) ? vendedores.map((vendedor: Record<string, unknown>) => {
        try {
          if (!vendedor?.id) return null;
          
          const entregasVendedor = dadosPeriodo.entregas.filter((e: Record<string, unknown>) => e?.vendedor_id === vendedor.id);
          
          // Calcular vendas baseado no valor das entregas do vendedor
          const totalVendasVendedor = entregasVendedor.reduce((sum: number, e: Record<string, unknown>) => {
            return sum + (parseFloat(e?.valor as string) || 0);
          }, 0);
          
          // Calcular pagamentos recebidos das entregas do vendedor
          const pagamentosVendedor = dadosPeriodo.pagamentos.filter((p: Record<string, unknown>) => {
            return entregasVendedor.some((e: Record<string, unknown>) => e?.id === p?.entrega_id);
          });
          const totalPagamentosVendedor = pagamentosVendedor.reduce((sum: number, p: Record<string, unknown>) => {
            return sum + (parseFloat(p?.valor as string) || 0);
          }, 0);

          // Calcular entregas pagas do vendedor usando a mesma lógica
          const entregasPagasVendedor = entregasVendedor.filter((entrega: Record<string, unknown>) => {
            try {
              if (!entrega?.id || !entrega?.valor) return false;
              
              // Buscar todos os pagamentos relacionados a esta entrega
              const pagamentosEntrega = dadosPeriodo.pagamentos.filter((p: Record<string, unknown>) => p?.entrega_id === entrega.id);
              
              // Somar todos os pagamentos desta entrega
              const totalPagamentosEntrega = pagamentosEntrega.reduce((sum: number, p: Record<string, unknown>) => {
                return sum + (parseFloat(String(p?.valor)) || 0);
              }, 0);
              
              // Considerar paga se o total de pagamentos for igual ou maior que o valor da entrega
              return totalPagamentosEntrega >= (parseFloat(String(entrega.valor)) || 0);
            } catch (error) {
              console.warn('Erro ao processar entrega do vendedor:', entrega, error);
              return false;
            }
          }).length;

          return {
            id: vendedor.id,
            nome: vendedor.nome || 'Nome não informado',
            totalEntregas: entregasVendedor.length,
            totalVendas: totalVendasVendedor,
            totalPagamentos: totalPagamentosVendedor,
            entregasPagas: entregasPagasVendedor,
            taxaConversao: entregasVendedor.length > 0 
              ? (entregasPagasVendedor / entregasVendedor.length * 100).toFixed(1)
              : '0'
          };
        } catch (error) {
          console.warn('Erro ao processar vendedor:', vendedor, error);
          return null;
        }
      }).filter(Boolean) : [];

      // Produtos mais vendidos - corrigindo cálculo
      const produtoVendas = Array.isArray(produtos) ? produtos.map((produto: Record<string, unknown>) => {
        try {
          if (!produto?.id) return null;
          
          const entregasProduto = dadosPeriodo.entregas.filter((e: Record<string, unknown>) => e?.produto_id === produto.id);
          
          // Calcular vendas baseado no valor das entregas do produto
          const totalVendasProduto = entregasProduto.reduce((sum: number, e: Record<string, unknown>) => {
            return sum + (parseFloat(e?.valor as string) || 0);
          }, 0);
          
          // Calcular pagamentos recebidos das entregas do produto
          const pagamentosProduto = dadosPeriodo.pagamentos.filter((p: Record<string, unknown>) => {
            return entregasProduto.some((e: Record<string, unknown>) => e?.id === p?.entrega_id);
          });
          const totalPagamentosProduto = pagamentosProduto.reduce((sum: number, p: Record<string, unknown>) => {
            return sum + (parseFloat(p?.valor as string) || 0);
          }, 0);

          return {
            id: produto.id,
            nome: produto.produto_nome || produto.nome || 'Produto sem nome',
            categoria: produto.categoria || 'Sem categoria',
            totalEntregas: entregasProduto.length,
            totalVendas: totalVendasProduto,
            totalPagamentos: totalPagamentosProduto,
            estoque: produto.qtd_estoque || 0
          };
        } catch (error) {
          console.warn('Erro ao processar produto:', produto, error);
          return null;
        }
      }).filter(Boolean).sort((a: any, b: any) => (b.totalVendas as number) - (a.totalVendas as number)) : [];

      return {
        totalVendas: totalVendasEntregas,
        totalPagamentos,
        totalEntregas,
        entregasPagas,
        entregasPendentes,
        vendedorPerformance: vendedorPerformance.sort((a: any, b: any) => (b.totalVendas as number) - (a.totalVendas as number)),
        produtoVendas: produtoVendas.slice(0, 10) // Top 10
      };
    } catch (error) {
      console.error('Erro ao calcular métricas:', error);
      return {
        totalVendas: 0,
        totalPagamentos: 0,
        totalEntregas: 0,
        entregasPagas: 0,
        entregasPendentes: 0,
        vendedorPerformance: [],
        produtoVendas: []
      };
    }
  }, [dadosPeriodo, vendedores, produtos, entregas, pagamentos]);

  // EARLY RETURNS APÓS TODOS OS HOOKS E USEMEMO
  // Se houver erros, mostrar mensagem de erro
  if (hasErrors) {
    console.error('Erros nos hooks:', { errorPagamentos, errorEntregas, errorVendedores, errorProdutos });
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4">
        <div className="max-w-7xl mx-auto">
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <h2 className="text-lg font-semibold text-red-800 dark:text-red-200 mb-2">Erro ao carregar dados</h2>
            <p className="text-red-600 dark:text-red-300">
              Ocorreu um erro ao carregar os dados dos relatórios. Tente recarregar a página.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Se estiver carregando, mostrar loading
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-2 text-gray-600 dark:text-gray-400">Carregando relatórios...</span>
          </div>
        </div>
      </div>
    );
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const handlePrint = () => {
    window.print();
  };

  const exportToPDF = () => {
    const element = document.querySelector('.print-area') as HTMLElement;
    if (element) {
      import('html2pdf.js').then((html2pdf) => {
        const opt = {
          margin: 1,
          filename: `relatorio-${selectedReport}-${new Date().toISOString().split('T')[0]}.pdf`,
          image: { type: 'jpeg' as const, quality: 0.98 },
          html2canvas: { scale: 2 },
          jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' as const }
        };
        html2pdf.default().set(opt).from(element).save();
      });
    }
  };

  // Utilidade: montar HTML fragmentado do relatório do vendedor com estilo que força texto preto
  const buildVendorReportHtml = (vendedor: any) => {
    try {
      const entregasVendedor = Array.isArray(dadosPeriodo.entregas)
        ? dadosPeriodo.entregas.filter((e: any) => e?.vendedor_id === vendedor.id)
        : [];

      const pagamentosVendedor = Array.isArray(dadosPeriodo.pagamentos)
        ? dadosPeriodo.pagamentos.filter((p: any) => entregasVendedor.some((e: any) => e?.id === p?.entrega_id))
        : [];

      const vendedorNome = String(vendedor?.nome || 'Vendedor');
      const adminEmail = String(user?.email || 'Administrador');
      const hoje = new Date().toLocaleDateString('pt-BR');

      const entregasRows = entregasVendedor.map((e: any) => `
          <tr>
            <td>${new Date(String(e?.data_entrega || '')).toLocaleDateString('pt-BR')}</td>
            <td>${String((e?.cliente as any)?.nome || e?.cliente_nome || 'N/A')}</td>
            <td>${formatCurrency(Number(e?.valor) || 0)}</td>
            <td>${e?.pago ? 'Pago' : 'Pendente'}</td>
          </tr>
        `).join('');

      const pagamentosRows = pagamentosVendedor.map((p: any) => {
        // Tentar obter o nome do cliente diretamente do pagamento -> entrega -> cliente
        const nomeClienteDireto = String(((p?.entregas as any)?.clientes?.nome) || '');
        // Fallback: buscar a entrega correspondente deste pagamento dentro das entregas do vendedor e pegar o nome do cliente
        const entregaMatch = entregasVendedor.find((e: any) => e?.id === p?.entrega_id);
        const nomeClienteEntrega = String(
          ((entregaMatch?.cliente as any)?.nome) || entregaMatch?.cliente_nome || ''
        );
        const nomeCliente = nomeClienteDireto || nomeClienteEntrega || 'N/A';

        return `
          <tr>
            <td>${new Date(String(p?.data_pagamento || '')).toLocaleDateString('pt-BR')}</td>
            <td>${nomeCliente}</td>
            <td>${formatCurrency(Number(p?.valor) || 0)}</td>
          </tr>
        `;
      }).join('');

      return `
        <style>
          .vendor-pdf, .vendor-pdf * { color: #000 !important; background: #fff !important; }
          .vendor-pdf { font-family: Arial, sans-serif; margin: 24px; }
          .vendor-pdf h1, .vendor-pdf h2 { margin: 0 0 12px 0; }
          .vendor-pdf .header { border-bottom: 2px solid #000; padding-bottom: 12px; margin-bottom: 16px; }
          .vendor-pdf .metrics { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 16px; }
          .vendor-pdf .card { border: 1px solid #000; padding: 10px; }
          .vendor-pdf table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 12px; }
          .vendor-pdf th, .vendor-pdf td { border: 1px solid #000; padding: 6px; text-align: left; }
          .vendor-pdf th { background: #f0f0f0; }
          @media print { * { -webkit-print-color-adjust: exact; } }
        </style>
        <div class="vendor-pdf">
          <div class="header">
            <h1>Relatório do Vendedor</h1>
            <div>Vendedor: <strong>${vendedorNome}</strong></div>
            <div>Administrador: ${adminEmail}</div>
            <div>Período: Últimos ${selectedPeriod} dias</div>
            <div>Gerado em: ${hoje}</div>
          </div>

          <h2>Métricas</h2>
          <div class="metrics">
            <div class="card">Total de Entregas: <strong>${Number(vendedor.totalEntregas) || 0}</strong></div>
            <div class="card">Total de Vendas: <strong>${formatCurrency(Number(vendedor.totalVendas) || 0)}</strong></div>
            <div class="card">Total de Pagamentos: <strong>${formatCurrency(Number(vendedor.totalPagamentos) || 0)}</strong></div>
            <div class="card">Entregas Pagas: <strong>${Number(vendedor.entregasPagas) || 0}</strong></div>
            <div class="card">Taxa de Conversão: <strong>${String(vendedor.taxaConversao || '0')}%</strong></div>
          </div>

          <h2>Entregas</h2>
          <table>
            <thead>
              <tr>
                <th>Data</th>
                <th>Cliente</th>
                <th>Valor</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${entregasRows || '<tr><td colspan="4">Nenhuma entrega no período</td></tr>'}
            </tbody>
          </table>

          <h2>Pagamentos</h2>
          <table>
            <thead>
              <tr>
                <th>Data</th>
                <th>Cliente</th>
                <th>Valor</th>
              </tr>
            </thead>
            <tbody>
              ${pagamentosRows || '<tr><td colspan="3">Nenhum pagamento no período</td></tr>'}
            </tbody>
          </table>
        </div>
      `;
    } catch (error) {
      console.error('Erro ao montar relatório do vendedor:', error);
      return '<div class="vendor-pdf">Erro ao gerar relatório do vendedor.</div>';
    }
  };

  const handlePrintVendor = (vendedor: any) => {
    const content = buildVendorReportHtml(vendedor);
    const htmlDoc = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8" />
      <title>Impressão - Relatório do Vendedor</title>
      <style>html, body { background: #fff; } .vendor-pdf, .vendor-pdf * { color: #000 !important; }</style>
    </head><body>${content}</body></html>`;
    const printWindow = window.open('', 'PRINT', 'height=800,width=1000');
    if (!printWindow) {
      console.warn('Não foi possível abrir a janela de impressão.');
      return;
    }
    printWindow.document.write(htmlDoc);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    printWindow.close();
  };

  const exportVendorPDF = async (vendedor: any) => {
    const container = document.createElement('div');
    container.className = 'print-area';
    // Força cores neutras para evitar texto branco em fundo branco
    const content = buildVendorReportHtml(vendedor);
    container.innerHTML = `<style>.print-area, .print-area * { color: #000 !important; background: #fff !important; }</style>${content}`;
    document.body.appendChild(container);
    try {
      const html2pdf = await import('html2pdf.js');
      const safeName = String(vendedor?.nome || 'vendedor').replace(/\s+/g, '-');
      const opt = {
        margin: 1,
        filename: `relatorio-vendedor-${safeName}-${new Date().toISOString().split('T')[0]}.pdf`,
        image: { type: 'jpeg' as const, quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' as const }
      };
      await html2pdf.default().set(opt).from(container).save();
    } catch (error) {
      console.error('Erro ao exportar PDF do vendedor:', error);
    } finally {
      container.remove();
    }
  };



  return (
    <>
      {/* Print Styles */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-area { 
            width: 100% !important; 
            margin: 0 !important; 
            padding: 20px !important;
            background: white !important;
            color: black !important;
          }
          .print-header {
            text-align: center;
            margin-bottom: 30px;
            border-bottom: 2px solid #000;
            padding-bottom: 20px;
          }
          .print-metrics {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 20px;
            margin-bottom: 30px;
          }
          .print-metric-card {
            border: 1px solid #000;
            padding: 15px;
            text-align: center;
          }
          .print-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 30px;
            font-size: 12px;
          }
          .print-table th,
          .print-table td {
            border: 1px solid #000;
            padding: 8px;
            text-align: left;
          }
          .print-table th {
            background-color: #f0f0f0;
            font-weight: bold;
          }
          body { margin: 0; }
          * { -webkit-print-color-adjust: exact; }
        }
      `}</style>

      <div className="space-y-4 sm:space-y-6 p-4 sm:p-6 lg:p-8 print-area">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between space-y-4 sm:space-y-0 no-print">
          <div className="text-center sm:text-left">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">Relatórios</h1>
            <p className="text-gray-600 dark:text-gray-400 text-sm sm:text-base">
              Relatórios detalhados do administrador: {user?.email}
            </p>
          </div>
          <div className="flex flex-wrap justify-center sm:justify-end gap-2 sm:gap-3">
            {/* Ícone de informação */}
            <div className="relative group">
              <button className="flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300 rounded-lg transition-colors">
                <Info className="w-4 h-4" />
              </button>
              {/* Tooltip */}
              <div className="absolute right-full top-1/2 transform -translate-y-1/2 mr-2 px-3 py-2 bg-gray-900 dark:bg-gray-700 text-white text-xs rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10">
                <div className="text-left">
                  <div className="font-semibold mb-1">Como usar os botões:</div>
                  <div>1. Selecione o período desejado</div>
                  <div>2. Escolha o tipo de relatório</div>
                  <div>3. Clique em Imprimir ou PDF</div>
                </div>
                {/* Seta do tooltip */}
                <div className="absolute left-full top-1/2 transform -translate-y-1/2 w-0 h-0 border-t-4 border-b-4 border-l-4 border-transparent border-l-gray-900 dark:border-l-gray-700"></div>
              </div>
            </div>
            
            <button
              onClick={handlePrint}
              className="flex items-center space-x-1 sm:space-x-2 px-3 sm:px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm touch-manipulation"
            >
              <Printer className="w-3 h-3 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Imprimir</span>
              <span className="sm:hidden">Print</span>
            </button>
            <button
              onClick={exportToPDF}
              className="flex items-center space-x-1 sm:space-x-2 px-3 sm:px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors text-sm touch-manipulation"
            >
              <FileText className="w-3 h-3 sm:w-4 sm:h-4" />
              <span>PDF</span>
            </button>

          </div>
        </div>

        {/* Print Header */}
        <div className="print-header hidden print:block">
          <h1 className="text-2xl font-bold">Relatório Administrativo</h1>
          <p>Período: Últimos {selectedPeriod} dias</p>
          <p>Gerado em: {new Date().toLocaleDateString('pt-BR')}</p>
          <p>Administrador: {user?.email}</p>
        </div>

        {/* Filtros */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 sm:p-6 shadow-sm border border-gray-200 dark:border-gray-700 no-print">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-2">
              <div className="flex items-center space-x-2">
                <Calendar className="w-4 h-4 text-gray-500 dark:text-gray-400 flex-shrink-0" />
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Período:</label>
              </div>
              <select
                value={selectedPeriod}
                onChange={(e) => setSelectedPeriod(e.target.value)}
                className="w-full sm:w-auto px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm dark:bg-gray-700 dark:text-white touch-manipulation"
              >
                <option value="7">Últimos 7 dias</option>
                <option value="30">Últimos 30 dias</option>
                <option value="90">Últimos 90 dias</option>
                <option value="365">Último ano</option>
              </select>
            </div>
            
            <div className="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-2">
              <div className="flex items-center space-x-2">
                <Filter className="w-4 h-4 text-gray-500 dark:text-gray-400 flex-shrink-0" />
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Relatório:</label>
              </div>
              <select
                value={selectedReport}
                onChange={(e) => setSelectedReport(e.target.value as 'vendas' | 'vendedores' | 'entregas' | 'produtos')}
                className="w-full sm:w-auto px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm dark:bg-gray-700 dark:text-white touch-manipulation"
              >
                <option value="vendas">Vendas</option>
                <option value="vendedores">Performance de Vendedores</option>
                <option value="entregas">Entregas</option>
                <option value="produtos">Produtos</option>
              </select>
            </div>
          </div>
        </div>

        {/* Cards de Métricas */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 sm:gap-6 print-metrics">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 sm:p-6 shadow-sm border border-gray-200 dark:border-gray-700 print-metric-card">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400 mb-1 truncate">Total de Vendas</p>
                <p className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-white break-words">
                  {formatCurrency(metricas.totalVendas)}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Valor das entregas</p>
              </div>
              <div className="p-2 sm:p-3 bg-green-100 dark:bg-green-900/20 rounded-full no-print flex-shrink-0 ml-2">
                <DollarSign className="w-4 h-4 sm:w-6 sm:h-6 text-green-600 dark:text-green-400" />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 sm:p-6 shadow-sm border border-gray-200 dark:border-gray-700 print-metric-card">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400 mb-1 truncate">Total de Pagamentos</p>
                <p className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-white break-words">
                  {formatCurrency(metricas.totalPagamentos)}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Valores recebidos</p>
              </div>
              <div className="p-2 sm:p-3 bg-blue-100 dark:bg-blue-900/20 rounded-full no-print flex-shrink-0 ml-2">
                <CreditCard className="w-4 h-4 sm:w-6 sm:h-6 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 sm:p-6 shadow-sm border border-gray-200 dark:border-gray-700 print-metric-card">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400 mb-1 truncate">Total de Entregas</p>
                <p className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-white">
                  {metricas.totalEntregas}
                </p>
              </div>
              <div className="p-2 sm:p-3 bg-purple-100 dark:bg-purple-900/20 rounded-full no-print flex-shrink-0 ml-2">
                <Truck className="w-4 h-4 sm:w-6 sm:h-6 text-purple-600 dark:text-purple-400" />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 sm:p-6 shadow-sm border border-gray-200 dark:border-gray-700 print-metric-card">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400 mb-1 truncate">Entregas Pagas</p>
                <p className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-white">
                  {metricas.entregasPagas}
                </p>
              </div>
              <div className="p-2 sm:p-3 bg-green-100 dark:bg-green-900/20 rounded-full no-print flex-shrink-0 ml-2">
                <TrendingUp className="w-4 h-4 sm:w-6 sm:h-6 text-green-600 dark:text-green-400" />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 sm:p-6 shadow-sm border border-gray-200 dark:border-gray-700 print-metric-card">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400 mb-1 truncate">Entregas Pendentes</p>
                <p className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-white">
                  {metricas.entregasPendentes}
                </p>
              </div>
              <div className="p-2 sm:p-3 bg-yellow-100 dark:bg-yellow-900/20 rounded-full no-print flex-shrink-0 ml-2">
                <Package className="w-4 h-4 sm:w-6 sm:h-6 text-yellow-600 dark:text-yellow-400" />
              </div>
            </div>
          </div>
        </div>

        {/* Conteúdo do Relatório */}
        {selectedReport === 'vendas' && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white flex items-center">
                <BarChart3 className="w-4 h-4 sm:w-5 sm:h-5 mr-2 no-print" />
                Relatório de Vendas - Últimos {selectedPeriod} dias
              </h2>
            </div>
            <div className="p-4 sm:p-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                <div>
                  <h3 className="text-base sm:text-lg font-medium text-gray-900 dark:text-white mb-4">Resumo Financeiro</h3>
                  <div className="space-y-3">
                    <div className="flex flex-col sm:flex-row sm:justify-between space-y-1 sm:space-y-0">
                      <span className="text-sm sm:text-base text-gray-600 dark:text-gray-400">Total Vendas (Entregas):</span>
                      <span className="font-semibold text-gray-900 dark:text-white text-sm sm:text-base break-words">
                        {formatCurrency(metricas.totalVendas)}
                      </span>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:justify-between space-y-1 sm:space-y-0">
                      <span className="text-sm sm:text-base text-gray-600 dark:text-gray-400">Total Pagamentos Recebidos:</span>
                      <span className="font-semibold text-gray-900 dark:text-white text-sm sm:text-base break-words">
                        {formatCurrency(metricas.totalPagamentos)}
                      </span>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:justify-between space-y-1 sm:space-y-0">
                      <span className="text-sm sm:text-base text-gray-600 dark:text-gray-400">Diferença (A Receber):</span>
                      <span className="font-semibold text-gray-900 dark:text-white text-sm sm:text-base break-words">
                        {formatCurrency(metricas.totalVendas - metricas.totalPagamentos)}
                      </span>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:justify-between space-y-1 sm:space-y-0">
                      <span className="text-sm sm:text-base text-gray-600 dark:text-gray-400">Média por Entrega:</span>
                      <span className="font-semibold text-gray-900 dark:text-white text-sm sm:text-base break-words">
                        {formatCurrency(metricas.totalEntregas > 0 ? metricas.totalVendas / metricas.totalEntregas : 0)}
                      </span>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:justify-between space-y-1 sm:space-y-0">
                      <span className="text-sm sm:text-base text-gray-600 dark:text-gray-400">Taxa de Conversão:</span>
                      <span className="font-semibold text-gray-900 dark:text-white text-sm sm:text-base">
                        {metricas.totalEntregas > 0 ? ((metricas.entregasPagas / metricas.totalEntregas) * 100).toFixed(1) : 0}%
                      </span>
                    </div>
                  </div>
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-medium text-gray-900 dark:text-white mb-4">Distribuição de Status</h3>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div className="w-3 h-3 bg-green-500 rounded-full mr-2 flex-shrink-0"></div>
                        <span className="text-sm text-gray-600 dark:text-gray-400">Pagas</span>
                      </div>
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {metricas.entregasPagas} ({metricas.totalEntregas > 0 ? ((metricas.entregasPagas / metricas.totalEntregas) * 100).toFixed(0) : 0}%)
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div className="w-3 h-3 bg-yellow-500 rounded-full mr-2 flex-shrink-0"></div>
                        <span className="text-sm text-gray-600 dark:text-gray-400">Pendentes</span>
                      </div>
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {metricas.entregasPendentes} ({metricas.totalEntregas > 0 ? ((metricas.entregasPendentes / metricas.totalEntregas) * 100).toFixed(0) : 0}%)
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {selectedReport === 'vendedores' && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white flex items-center">
                <Users className="w-4 h-4 sm:w-5 sm:h-5 mr-2 no-print" />
                Performance de Vendedores - Últimos {selectedPeriod} dias
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 print-table">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Vendedor
                    </th>
                    <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Entregas
                    </th>
                    <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Vendas (Entregas)
                    </th>
                    <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Pagamentos
                    </th>
                    <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Pagas
                    </th>
                    <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Taxa Conversão
                    </th>
                    <th className="px-3 sm:px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider no-print">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {metricas.vendedorPerformance.map((vendedor: any) => (
                    <tr key={vendedor.id}>
                      <td className="px-3 sm:px-6 py-4 text-xs sm:text-sm font-medium text-gray-900 dark:text-white">
                        {String(vendedor.nome || '')}
                      </td>
                      <td className="px-3 sm:px-6 py-4 text-xs sm:text-sm text-gray-900 dark:text-white">
                        {vendedor.totalEntregas}
                      </td>
                      <td className="px-3 sm:px-6 py-4 text-xs sm:text-sm text-gray-900 dark:text-white break-words">
                        {formatCurrency(vendedor.totalVendas)}
                      </td>
                      <td className="px-3 sm:px-6 py-4 text-xs sm:text-sm text-gray-900 dark:text-white break-words">
                        {formatCurrency(vendedor.totalPagamentos)}
                      </td>
                      <td className="px-3 sm:px-6 py-4 text-xs sm:text-sm text-gray-900 dark:text-white">
                        {vendedor.entregasPagas}
                      </td>
                      <td className="px-3 sm:px-6 py-4 text-xs sm:text-sm text-gray-900 dark:text-white">
                        {vendedor.taxaConversao}%
                      </td>
                      <td className="px-3 sm:px-6 py-4 text-right no-print">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              className="inline-flex items-center justify-center h-8 w-8 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600"
                              aria-label="Ações"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => exportVendorPDF(vendedor)}>
                              Baixar PDF
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handlePrintVendor(vendedor)}>
                              Imprimir
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
        )}

        {selectedReport === 'produtos' && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white flex items-center">
                <Package className="w-4 h-4 sm:w-5 sm:h-5 mr-2 no-print" />
                Top 10 Produtos - Últimos {selectedPeriod} dias
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 print-table">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Produto
                    </th>
                    <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Categoria
                    </th>
                    <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Entregas
                    </th>
                    <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Vendas (Entregas)
                    </th>
                    <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Pagamentos
                    </th>
                    <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Estoque
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {metricas.produtoVendas.map((produto: any) => produto && (
                    <tr key={String(produto.id || '')}>
                      <td className="px-3 sm:px-6 py-4 text-xs sm:text-sm font-medium text-gray-900 dark:text-white">
                        {String(produto.nome || '')}
                      </td>
                      <td className="px-3 sm:px-6 py-4 text-xs sm:text-sm text-gray-900 dark:text-white">
                        <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400">
                          {String(produto.categoria || '')}
                        </span>
                      </td>
                      <td className="px-3 sm:px-6 py-4 text-xs sm:text-sm text-gray-900 dark:text-white">
                        {produto.totalEntregas}
                      </td>
                      <td className="px-3 sm:px-6 py-4 text-xs sm:text-sm text-gray-900 dark:text-white">
                        {formatCurrency(Number(produto.totalVendas) || 0)}
                      </td>
                      <td className="px-3 sm:px-6 py-4 text-xs sm:text-sm text-gray-900 dark:text-white">
                        {formatCurrency(Number(produto.totalPagamentos) || 0)}
                      </td>
                      <td className="px-3 sm:px-6 py-4 text-xs sm:text-sm text-gray-900 dark:text-white">
                        {String(produto.estoque || '')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {selectedReport === 'entregas' && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white flex items-center">
                <Truck className="w-4 h-4 sm:w-5 sm:h-5 mr-2 no-print" />
                Relatório de Entregas - Últimos {selectedPeriod} dias
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 print-table">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Data
                    </th>
                    <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Cliente
                    </th>
                    <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Vendedor
                    </th>
                    <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Valor
                    </th>
                    <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {dadosPeriodo.entregas.slice(0, 50).map((entrega: Record<string, unknown>) => (
                    <tr key={String(entrega.id || Math.random())}>
                      <td className="px-3 sm:px-6 py-4 text-xs sm:text-sm text-gray-900 dark:text-white">
                        {new Date(entrega.data_entrega as string | number | Date).toLocaleDateString('pt-BR')}
                      </td>
                      <td className="px-3 sm:px-6 py-4 text-xs sm:text-sm text-gray-900 dark:text-white break-words">
                        {(entrega.cliente as any)?.nome || entrega.cliente_nome || 'N/A'}
                      </td>
                      <td className="px-3 sm:px-6 py-4 text-xs sm:text-sm text-gray-900 dark:text-white break-words">
                        {(entrega.vendedor as any)?.nome || 
                         (vendedores as Record<string, unknown>[]).find(v => v.id === entrega.vendedor_id)?.nome || 'N/A'}
                      </td>
                      <td className="px-3 sm:px-6 py-4 text-xs sm:text-sm text-gray-900 dark:text-white break-words">
                        {formatCurrency(Number(entrega.valor) || 0)}
                      </td>
                      <td className="px-3 sm:px-6 py-4 text-xs sm:text-sm">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          entrega.pago 
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                            : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
                        }`}>
                          {entrega.pago ? 'Pago' : 'Pendente'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default Relatorios;
