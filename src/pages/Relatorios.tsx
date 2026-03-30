import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Pagination } from "@/components/ui/pagination";
import { Skeleton } from "@/components/ui/Skeleton";
import { useQuery } from '@tanstack/react-query';
import DOMPurify from 'dompurify';
import {
  BarChart3,
  Calendar,
  CreditCard,
  DollarSign,
  FileText,
  Filter,
  Info,
  MoreHorizontal,
  Package,
  Printer,
  TrendingUp,
  Truck,
  Users
} from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useCountUp } from '../hooks/useCountUp';
import { useProdutos } from '../hooks/useProdutos';
import { useVendedoresByAdmin, Vendedor } from '../hooks/useVendedores';
import { supabase } from '../lib/supabase';
import { subtractDaysUTC3, toUTC3 } from '../utils/dateUtils';

const Relatorios: React.FC = () => {
  const { user, adminId } = useAuth();
  const [selectedPeriod, setSelectedPeriod] = useState('30'); // dias
  const [selectedReport, setSelectedReport] = useState<'vendas' | 'vendedores' | 'entregas' | 'produtos' | 'financeiro' | 'fluxo_pagamentos' | 'vendas_atacado_pj'>('vendas');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedVendedor, setSelectedVendedor] = useState<string>('');
  const itemsPerPage = 15;

  // Reset page when report type or period changes
  React.useEffect(() => {
    setCurrentPage(1);
  }, [selectedReport, selectedPeriod, selectedVendedor]);

  // Hooks para buscar dados com administrador_id
  const administrador_id = adminId || undefined;
  
  // Queries manuais para substituir hooks paginados (limitados a 50 itens)
  // Agora buscamos até 10000 registros para garantir cobertura anual
  const { data: pagamentos = [], isLoading: isLoadingPagamentos, error: errorPagamentos } = useQuery({
    queryKey: ['pagamentos_all', administrador_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pagamentos')
        .select(`
          *,
          entregas!inner(
            id,
            vendedor_id,
            cliente_id,
            produto_id,
            valor,
            data_entrega,
            vendedores!inner(id, nome, administrador_id),
            clientes(id, nome),
            produtos(id, nome)
          )
        `)
        .eq('entregas.vendedores.administrador_id', administrador_id)
        .order('data_pagamento', { ascending: false })
        .limit(10000);
        
      if (error) throw error;
      return data || [];
    },
    enabled: !!administrador_id
  });

  const { data: entregas = [], isLoading: isLoadingEntregas, error: errorEntregas } = useQuery({
    queryKey: ['entregas_all', administrador_id],
    queryFn: async () => {
      // 1. Buscar IDs dos vendedores do admin
      const { data: vendedores, error: vErr } = await supabase
        .from('vendedores')
        .select('id')
        .eq('administrador_id', administrador_id);
      
      if (vErr) throw vErr;
      const vendedorIds = vendedores?.map(v => v.id) || [];
      
      if (vendedorIds.length === 0) return [];

      // 2. Buscar entregas
      const { data, error } = await supabase
        .from('entregas')
        .select(`
          id, data_entrega, cliente_id, vendedor_id, valor, status_entrega, status_pagamento,
          cliente:clientes(id, nome, sobrenome, telefone, endereco, numero, "Bairro", "Cidade", "Estado", cep, complemento, cpf),
          vendedor:vendedores(id, nome, administrador_id)
        `)
        .in('vendedor_id', vendedorIds)
        .order('data_entrega', { ascending: false })
        .limit(10000);

      if (error) throw error;
      return data || [];
    },
    enabled: !!administrador_id
  });

  const { data: vendedores = [], isLoading: isLoadingVendedores, error: errorVendedores } = useVendedoresByAdmin(administrador_id || '', { 
    enabled: !!administrador_id
  });
  const { data: produtos = [], isLoading: isLoadingProdutos, error: errorProdutos } = useProdutos({ 
    enabled: !!administrador_id
  });

  // Queries manuais para hooks que não existem ou não suportam os parâmetros necessários
  // Importante: Remover o filtro de data (.gte) das queries iniciais para buscar TODO o histórico
  // O filtro de data será aplicado localmente no useMemo 'dadosPeriodo'
  const { data: vendasAtacado = [] } = useQuery({ 
    queryKey: ['vendas_atacado', administrador_id], 
    queryFn: async () => { 
      // Buscar até 10000 registros para garantir cobertura anual
      const { data } = await supabase 
        .from('vendas_atacado') 
        .select('*, vendas_atacado_pagamentos(*)') 
        .eq('administrador_id', administrador_id)
        .order('created_at', { ascending: false })
        .limit(10000);
      return data || []; 
    }, 
    enabled: !!administrador_id,
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
  }); 
  
  const { data: acertosDiarios = [] } = useQuery({ 
    queryKey: ['acertos_diarios', administrador_id], 
    queryFn: async () => { 
      const { data } = await supabase 
        .from('acertos_diarios') 
        .select('*') 
        .eq('administrador_id', administrador_id)
        .order('data_acerto', { ascending: false })
        .limit(10000);
      return data || []; 
    }, 
    enabled: !!administrador_id,
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
  }); 
  
  const { data: lancamentosCaixa = [] } = useQuery({ 
    queryKey: ['lancamentos_caixa', administrador_id], 
    queryFn: async () => { 
      const { data } = await supabase 
        .from('lancamentos_caixa') 
        .select('*') 
        .eq('administrador_id', administrador_id)
        .order('data_lancamento', { ascending: false })
        .limit(10000);
      return data || []; 
    }, 
    enabled: !!administrador_id,
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
  }); 
  
  const { data: orcamentosPJ = [] } = useQuery({ 
    queryKey: ['orcamentos_pj', administrador_id], 
    queryFn: async () => { 
      const { data } = await supabase 
        .from('orcamentos_pj') 
        .select('*') 
        .eq('administrador_id', administrador_id)
        .order('data_criacao', { ascending: false })
        .limit(10000);
      return data || []; 
    }, 
    enabled: !!administrador_id,
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
  });

  // Verificar se há erros
  const hasErrors = errorPagamentos || errorEntregas || errorVendedores || errorProdutos;
  const isLoading = isLoadingPagamentos || isLoadingEntregas || isLoadingVendedores || isLoadingProdutos;

  // Calcular período usando UTC-3 - MOVER ANTES DOS EARLY RETURNS
  const periodoDias = parseInt(selectedPeriod);
  
  // Usar subtractDaysUTC3 para obter a data de início em UTC-3
  // Isso garante que estamos comparando datas no mesmo fuso horário
  const dataInicio = subtractDaysUTC3(new Date(), periodoDias);


  // Filtrar dados por período usando UTC-3
  const dadosPeriodo = useMemo(() => {
    try {
      // Verificar se os dados existem antes de filtrar
      if (!Array.isArray(pagamentos) || !Array.isArray(entregas)) {
        return { 
          pagamentos: [], 
          entregas: [], 
          vendasAtacado: [], 
          acertosDiarios: [], 
          lancamentosCaixa: [], 
          orcamentosPJ: [] 
        };
      }

      // Função auxiliar para verificar se uma data está dentro do período
      const isDateInPeriod = (dateString: string | null | undefined) => {
        if (!dateString) return false;
        try {
          // Converter a data do banco para UTC-3
          const dataItem = toUTC3(new Date(dateString));
          // Comparar timestamps para garantir precisão
          return dataItem.getTime() >= dataInicio.getTime();
        } catch (e) {
          console.warn('Erro ao processar data:', dateString);
          return false;
        }
      };

      // 1. Pagamentos de Entregas (Cestas)
      const pagamentosFiltrados = pagamentos.filter((p: Record<string, unknown>) => 
        isDateInPeriod(p?.data_pagamento as string)
      );
      
      const entregasFiltradas = entregas.filter((e: any) => 
        isDateInPeriod(e.data_entrega)
      );

      // 2. Vendas Atacado - Usar data_entrega ou created_at
      const vendasAtacadoFiltradas = vendasAtacado.filter((v: any) => 
        isDateInPeriod(v.data_entrega || v.created_at)
      );

      // 3. Acertos Diários
      const acertosFiltrados = acertosDiarios.filter((a: any) => 
        isDateInPeriod(a.data_acerto || a.created_at)
      );

      // 4. Lançamentos Caixa (Entradas e Saídas)
      const caixaFiltrado = lancamentosCaixa.filter((l: any) => 
        isDateInPeriod(l.data_lancamento || l.created_at)
      );

      // 5. Orçamentos PJ (apenas Aprovados contam como venda)
      const orcamentosFiltrados = orcamentosPJ.filter((o: any) => 
        isDateInPeriod(o.data_aprovacao || o.data_criacao) && (o.status === 'aprovado' || o.status === 'convertido')
      );

      return {
        pagamentos: pagamentosFiltrados,
        entregas: entregasFiltradas,
        vendasAtacado: vendasAtacadoFiltradas,
        acertosDiarios: acertosFiltrados,
        lancamentosCaixa: caixaFiltrado,
        orcamentosPJ: orcamentosFiltrados
      };
    } catch (error) {
      console.error('Erro ao filtrar dados por período:', error);
      return { 
        pagamentos: [], 
        entregas: [], 
        vendasAtacado: [], 
        acertosDiarios: [], 
        lancamentosCaixa: [], 
        orcamentosPJ: [] 
      };
    }
  }, [pagamentos, entregas, vendasAtacado, acertosDiarios, lancamentosCaixa, orcamentosPJ, dataInicio]);

  // Calcular métricas de vendas e financeiras
  const metricas = useMemo(() => {
    try {
      // Verificar se dadosPeriodo existe e tem dados válidos
      if (!dadosPeriodo) {
        return {
          totalVendas: 0,
          totalPagamentos: 0,
          totalEntregas: 0,
          entregasPagas: 0,
          entregasPendentes: 0,
          vendedorPerformance: [],
          produtoVendas: [],
          // Novos campos financeiros
          totalVendasAtacado: 0,
          totalRecebidoAtacado: 0,
          totalEntradasCaixa: 0,
          totalSaidasCaixa: 0,
          totalVendasAcertos: 0,
          saldoLiquidoAcertos: 0,
          totalOrcamentosAprovados: 0
        };
      }

      // --- Métricas Originais (Entregas/Cestas) ---
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
          return false;
        }
      }).length;
      
      const entregasPendentes = totalEntregas - entregasPagas;

      // --- Métricas Financeiras Adicionais ---
      
      // Vendas Atacado
      const totalVendasAtacado = dadosPeriodo.vendasAtacado.reduce((sum: number, v: any) => sum + (Number(v.valor_total) || 0), 0);
      const totalRecebidoAtacado = dadosPeriodo.vendasAtacado.reduce((sum: number, v: any) => {
        const pagamentos = v.vendas_atacado_pagamentos || [];
        return sum + pagamentos.reduce((s: number, p: any) => s + (Number(p.valor) || 0), 0);
      }, 0);

      // Caixa
      const totalEntradasCaixa = dadosPeriodo.lancamentosCaixa
        .filter((l: any) => l.tipo === 'entrada' && l.status === 'pago')
        .reduce((sum: number, l: any) => sum + (Number(l.valor) || 0), 0);
      
      const totalSaidasCaixa = dadosPeriodo.lancamentosCaixa
        .filter((l: any) => l.tipo === 'saida' && l.status === 'pago')
        .reduce((sum: number, l: any) => sum + (Number(l.valor) || 0), 0);

      // Acertos
      const totalVendasAcertos = dadosPeriodo.acertosDiarios.reduce((sum: number, a: any) => sum + (Number(a.valor_total_vendas) || 0), 0);
      const saldoLiquidoAcertos = dadosPeriodo.acertosDiarios.reduce((sum: number, a: any) => sum + (Number(a.saldo_liquido) || 0), 0);

      // Orçamentos PJ aprovados
      const totalOrcamentosAprovados = dadosPeriodo.orcamentosPJ
        .filter((o: any) => o.status === 'aprovado' || o.status === 'convertido')
        .reduce((sum: number, o: any) => sum + (Number(o.valor_total) || 0), 0);

      // Performance por vendedor
      const vendedorPerformance = Array.isArray(vendedores) ? vendedores.map((vendedor: Vendedor) => {
        try {
          if (!vendedor?.id) return null;
          
          const entregasVendedor = dadosPeriodo.entregas.filter((e: Record<string, unknown>) => e?.vendedor_id === vendedor.id);
          const totalEntregas = entregasVendedor.length;
          
          // Calcular vendas baseado no valor das entregas do vendedor
          const totalVendas = entregasVendedor.reduce((sum: number, e: Record<string, unknown>) => {
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
          const entregasPagas = entregasVendedor.filter((entrega: Record<string, unknown>) => {
            try {
              if (!entrega?.id || !entrega?.valor) return false;
              
              const pagamentosEntrega = dadosPeriodo.pagamentos.filter((p: Record<string, unknown>) => p?.entrega_id === entrega.id);
              const totalPagamentosEntrega = pagamentosEntrega.reduce((sum: number, p: Record<string, unknown>) => {
                return sum + (parseFloat(String(p?.valor)) || 0);
              }, 0);
              
              return totalPagamentosEntrega >= (parseFloat(String(entrega.valor)) || 0);
            } catch (error) {
              return false;
            }
          }).length;

          return {
            id: vendedor.id,
            nome: vendedor.nome || 'Nome não informado',
            totalEntregas,
            totalVendas,
            totalPagamentos: totalPagamentosVendedor,
            entregasPagas,
            taxaConversao: totalEntregas > 0 
              ? ((entregasPagas / totalEntregas) * 100).toFixed(1) + '%' 
              : '0%'
          };
        } catch (error) {
          console.warn('Erro ao processar vendedor:', vendedor, error);
          return null;
        }
      }).filter(Boolean) : [];

      // Produtos mais vendidos
      const produtoVendas = Array.isArray(produtos) ? produtos.map((produto: Record<string, unknown>) => {
        try {
          if (!produto?.id) return null;
          
          const entregasProduto = dadosPeriodo.entregas.filter((e: Record<string, unknown>) => e?.produto_id === produto.id);
          
          const totalVendasProduto = entregasProduto.reduce((sum: number, e: Record<string, unknown>) => {
            return sum + (parseFloat(e?.valor as string) || 0);
          }, 0);
          
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
        produtoVendas: produtoVendas,
        // Novos campos
        totalVendasAtacado,
        totalRecebidoAtacado,
        totalEntradasCaixa,
        totalSaidasCaixa,
        totalVendasAcertos,
        saldoLiquidoAcertos,
        totalOrcamentosAprovados
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
        produtoVendas: [],
        totalVendasAtacado: 0,
        totalRecebidoAtacado: 0,
        totalEntradasCaixa: 0,
        totalSaidasCaixa: 0,
        totalVendasAcertos: 0,
        saldoLiquidoAcertos: 0,
        totalOrcamentosAprovados: 0
      };
    }
  }, [dadosPeriodo, vendedores, produtos, entregas, pagamentos]);

  // Valores animados para métricas financeiras (igual ao Dashboard)
  const totalVendasAnimado = useCountUp({
    end: metricas.totalVendas,
    duration: 800,
    decimals: 2
  });

  const totalPagamentosAnimado = useCountUp({
    end: metricas.totalPagamentos,
    duration: 800,
    decimals: 2
  });

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
        <div className="space-y-4 sm:space-y-6 p-4 sm:p-6 lg:p-8">
          {/* Header Skeleton */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between space-y-4 sm:space-y-0">
            <div className="space-y-2">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-4 w-64" />
            </div>
            <div className="flex flex-wrap justify-center sm:justify-end gap-2 sm:gap-3">
              <Skeleton className="h-10 w-10 rounded-lg" />
              <Skeleton className="h-10 w-24 rounded-lg" />
              <Skeleton className="h-10 w-20 rounded-lg" />
            </div>
          </div>

          {/* Filters Skeleton */}
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 sm:p-6 shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="flex items-center space-x-2">
                <Skeleton className="w-4 h-4" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-9 w-40 rounded-md" />
              </div>
              <div className="flex items-center space-x-2">
                <Skeleton className="w-4 h-4" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-9 w-40 rounded-md" />
              </div>
            </div>
          </div>

          {/* Metrics Cards Skeleton */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 sm:gap-6">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="bg-white dark:bg-gray-800 rounded-lg p-4 sm:p-6 shadow-sm border border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between">
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-6 w-32" />
                    {i < 2 && <Skeleton className="h-3 w-20" />}
                  </div>
                  <Skeleton className="h-10 w-10 rounded-full ml-2" />
                </div>
              </div>
            ))}
          </div>

          {/* Content Skeleton (mimicking Vendas report which is default) */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700">
              <Skeleton className="h-6 w-64" />
            </div>
            <div className="p-4 sm:p-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                <div>
                  <Skeleton className="h-6 w-40 mb-4" />
                  <div className="space-y-4">
                    {[...Array(5)].map((_, i) => (
                      <div key={i} className="flex justify-between">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-4 w-24" />
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <Skeleton className="h-6 w-48 mb-4" />
                  <div className="space-y-4">
                    {[...Array(2)].map((_, i) => (
                      <div key={i} className="flex justify-between items-center">
                        <div className="flex items-center">
                          <Skeleton className="h-3 w-3 rounded-full mr-2" />
                          <Skeleton className="h-4 w-20" />
                        </div>
                        <Skeleton className="h-4 w-16" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
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

  // Calcular total geral de receitas
  const totalGeralReceitas = metricas.totalVendas + 
    metricas.totalVendasAtacado + 
    metricas.totalEntradasCaixa + 
    metricas.totalVendasAcertos + 
    metricas.totalOrcamentosAprovados;

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
  // Escapa texto seguro para evitar XSS
  const escapeText = (value: any): string => {
    const s = String(value ?? '');
    return s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  };

  const buildVendorReportHtml = (vendedor: any) => {
    try {
      const entregasVendedor = Array.isArray(dadosPeriodo.entregas)
        ? dadosPeriodo.entregas.filter((e: any) => e?.vendedor_id === vendedor.id)
        : [];

      const pagamentosVendedor = Array.isArray(dadosPeriodo.pagamentos)
        ? dadosPeriodo.pagamentos.filter((p: any) => entregasVendedor.some((e: any) => e?.id === p?.entrega_id))
        : [];

      const vendedorNome = escapeText(vendedor?.nome || 'Vendedor');
      const adminEmail = escapeText(user?.email || 'Administrador');
      const hoje = new Date().toLocaleDateString('pt-BR');

      const entregasRows = entregasVendedor.map((e: any) => `
          <tr>
            <td>${new Date(String(e?.data_entrega || '')).toLocaleDateString('pt-BR')}</td>
            <td>${escapeText((e?.cliente as any)?.nome || e?.cliente_nome || 'N/A')}</td>
            <td>${formatCurrency(Number(e?.valor) || 0)}</td>
            <td>${e?.pago ? 'Pago' : 'Pendente'}</td>
          </tr>
        `).join('');

      const pagamentosRows = pagamentosVendedor.map((p: any) => {
        // Tentar obter o nome do cliente diretamente do pagamento -> entrega -> cliente
        const nomeClienteDireto = escapeText(((p?.entregas as any)?.clientes?.nome) || '');
        // Fallback: buscar a entrega correspondente deste pagamento dentro das entregas do vendedor e pegar o nome do cliente
        const entregaMatch = entregasVendedor.find((e: any) => e?.id === p?.entrega_id);
        const nomeClienteEntrega = escapeText(((entregaMatch?.cliente as any)?.nome) || (entregaMatch as any)?.cliente_nome || '');
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
            <div class="card">Taxa de Conversão: <strong>${String(vendedor.taxaConversao || '0')}</strong></div>
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
    const sanitizedHtml = DOMPurify.sanitize(htmlDoc, {
      ALLOWED_TAGS: ['html', 'head', 'body', 'meta', 'title', 'style', 'div', 'h1', 'h2', 'h3', 'p', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'span', 'strong', 'br'],
      ALLOWED_ATTR: ['class', 'style', 'charset'],
      ALLOW_DATA_ATTR: false
    });
    printWindow.document.write(sanitizedHtml);
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
    const htmlContent = `<style>.print-area, .print-area * { color: #000 !important; background: #fff !important; }</style>${content}`;
    container.innerHTML = DOMPurify.sanitize(htmlContent, {
      ALLOWED_TAGS: ['html', 'head', 'body', 'meta', 'title', 'style', 'div', 'h1', 'h2', 'h3', 'p', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'span', 'strong', 'br'],
      ALLOWED_ATTR: ['class', 'style', 'charset'],
      ALLOW_DATA_ATTR: false
    });
    document.body.appendChild(container);
    try {
      const html2pdf = await import('html2pdf.js');
      const safeName = String(vendedor?.nome || 'vendedor')
        .replace(/\s+/g, '-')
        .replace(/[^\w.-]/g, '');
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

  // Função genérica de paginação
  const getPaginatedData = (data: any[]) => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return {
      currentItems: data.slice(startIndex, endIndex),
      totalPages: Math.ceil(data.length / itemsPerPage),
      startIndex,
      endIndex,
      totalItems: data.length
    };
  };



  const { currentItems, totalPages, startIndex, endIndex, totalItems } = getPaginatedData(
    selectedReport === 'vendedores' ? metricas.vendedorPerformance :
    selectedReport === 'produtos' ? metricas.produtoVendas :
    selectedReport === 'entregas' ? dadosPeriodo.entregas.filter((e: any) => 
      selectedVendedor ? e.vendedor_id === selectedVendedor : true
    ) :
    selectedReport === 'fluxo_pagamentos' ? [
      ...dadosPeriodo.pagamentos.map((p: any) => ({ ...p, _tipo: 'entrega' })),
      ...dadosPeriodo.vendasAtacado.flatMap((v: any) => 
        (v.vendas_atacado_pagamentos || []).map((p: any) => ({ 
          ...p, 
          _tipo: 'atacado', 
          _pedido: v.numero_pedido, 
          _cliente: v.nome_cliente_cache 
        }))
      )
    ].sort((a: any, b: any) => 
      new Date(b.data_pagamento || b.created_at).getTime() - 
      new Date(a.data_pagamento || a.created_at).getTime()
    ) :
    selectedReport === 'vendas_atacado_pj' ? [
      ...dadosPeriodo.vendasAtacado.map((v: any) => ({ ...v, _tipo: 'atacado' })),
      ...dadosPeriodo.orcamentosPJ.map((o: any) => ({ ...o, _tipo: 'pj' }))
    ].sort((a: any, b: any) => 
      new Date(b.data_entrega || b.data_orcamento || b.created_at).getTime() - 
      new Date(a.data_entrega || a.data_orcamento || a.created_at).getTime()
    ) :
    []
  );

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
                onChange={(e) => setSelectedReport(e.target.value as any)}
                className="w-full sm:w-auto px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm dark:bg-gray-700 dark:text-white touch-manipulation"
              >
                <option value="vendas">Vendas</option>
                <option value="vendedores">Performance de Vendedores</option>
                <option value="entregas">Entregas</option>
                <option value="produtos">Produtos</option>
                <option value="financeiro">Financeiro Consolidado</option>
                <option value="fluxo_pagamentos">Fluxo de Pagamentos</option>
                <option value="vendas_atacado_pj">Vendas Atacado & PJ</option>
              </select>
            </div>

            {selectedReport === 'entregas' && (
              <div className="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-2">
                <div className="flex items-center space-x-2">
                  <Users className="w-4 h-4 text-gray-500 dark:text-gray-400 flex-shrink-0" />
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Vendedor:</label>
                </div>
                <select
                  value={selectedVendedor}
                  onChange={(e) => setSelectedVendedor(e.target.value)}
                  className="w-full sm:w-auto px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm dark:bg-gray-700 dark:text-white touch-manipulation"
                >
                  <option value="">Todos os Vendedores</option>
                  {Array.isArray(vendedores) && vendedores.map((v: any) => (
                    <option key={v.id} value={v.id}>{v.nome}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Cards de Métricas */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 sm:gap-6 print-metrics">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 sm:p-6 shadow-sm border border-gray-200 dark:border-gray-700 print-metric-card">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1 animate-fade-in-up">
                <p className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400 mb-1 truncate">Total de Vendas</p>
                <p className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-white break-words">
                  {formatCurrency(Number(totalVendasAnimado))}
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
              <div className="min-w-0 flex-1 animate-fade-in-up">
                <p className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400 mb-1 truncate">Total de Pagamentos</p>
                <p className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-white break-words">
                  {formatCurrency(Number(totalPagamentosAnimado))}
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
              <div className="min-w-0 flex-1 animate-fade-in-up">
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
              <div className="min-w-0 flex-1 animate-fade-in-up">
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
              <div className="min-w-0 flex-1 animate-fade-in-up">
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

        {selectedReport === 'financeiro' && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white flex items-center">
                <BarChart3 className="w-4 h-4 sm:w-5 sm:h-5 mr-2 no-print" />
                Relatório Financeiro Consolidado
              </h2>
            </div>
            <div className="p-4 sm:p-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Receitas */}
                <div>
                  <h3 className="text-lg font-medium text-green-700 dark:text-green-400 mb-4 border-b pb-2">Receitas</h3>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600 dark:text-gray-400">Total Vendas (Entregas)</span>
                      <span className="font-semibold text-gray-900 dark:text-white">{formatCurrency(metricas.totalVendas)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600 dark:text-gray-400">Total Vendas Atacado</span>
                      <span className="font-semibold text-gray-900 dark:text-white">{formatCurrency(metricas.totalVendasAtacado)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600 dark:text-gray-400">Orçamentos PJ Aprovados</span>
                      <span className="font-semibold text-gray-900 dark:text-white">{formatCurrency(metricas.totalOrcamentosAprovados)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600 dark:text-gray-400">Total Vendas Acertos</span>
                      <span className="font-semibold text-gray-900 dark:text-white">{formatCurrency(metricas.totalVendasAcertos)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600 dark:text-gray-400">Entradas no Caixa</span>
                      <span className="font-semibold text-gray-900 dark:text-white">{formatCurrency(metricas.totalEntradasCaixa)}</span>
                    </div>
                    <div className="pt-4 border-t border-gray-200 dark:border-gray-700 flex justify-between items-center">
                      <span className="font-bold text-gray-900 dark:text-white">TOTAL GERAL RECEITAS</span>
                      <span className="font-bold text-green-600 dark:text-green-400 text-lg">{formatCurrency(totalGeralReceitas)}</span>
                    </div>
                  </div>
                </div>

                {/* Despesas e Outros */}
                <div>
                  <h3 className="text-lg font-medium text-red-700 dark:text-red-400 mb-4 border-b pb-2">Despesas & Outros</h3>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600 dark:text-gray-400">Saídas no Caixa</span>
                      <span className="font-semibold text-gray-900 dark:text-white">{formatCurrency(metricas.totalSaidasCaixa)}</span>
                    </div>
                    
                    <h3 className="text-lg font-medium text-blue-700 dark:text-blue-400 mt-8 mb-4 border-b pb-2">Fluxo de Caixa Real (Recebido)</h3>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600 dark:text-gray-400">Recebido de Entregas</span>
                      <span className="font-semibold text-gray-900 dark:text-white">{formatCurrency(metricas.totalPagamentos)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600 dark:text-gray-400">Recebido de Atacado</span>
                      <span className="font-semibold text-gray-900 dark:text-white">{formatCurrency(metricas.totalRecebidoAtacado)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600 dark:text-gray-400">Saldo Líquido Acertos</span>
                      <span className="font-semibold text-gray-900 dark:text-white">{formatCurrency(metricas.saldoLiquidoAcertos)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {selectedReport === 'fluxo_pagamentos' && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white flex items-center">
                  <CreditCard className="w-5 h-5 mr-2 no-print" />
                  Fluxo de Pagamentos — Últimos {selectedPeriod} dias
                </h2>
                <div className="flex flex-wrap gap-3 text-sm">
                  <span className="bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-400 px-3 py-1 rounded-full font-medium">
                    Entregas: {formatCurrency(metricas.totalPagamentos)}
                  </span>
                  <span className="bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-400 px-3 py-1 rounded-full font-medium">
                    Atacado: {formatCurrency(metricas.totalRecebidoAtacado)}
                  </span>
                  <span className="bg-purple-100 dark:bg-purple-900/20 text-purple-800 dark:text-purple-400 px-3 py-1 rounded-full font-medium">
                    Total: {formatCurrency(metricas.totalPagamentos + metricas.totalRecebidoAtacado)}
                  </span>
                </div>
              </div>
              {totalItems > 0 && (
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400 no-print">
                  Mostrando {startIndex + 1} a {Math.min(endIndex, totalItems)} de {totalItems} pagamentos
                </p>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 print-table">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Data</th>
                    <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Canal</th>
                    <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Referência</th>
                    <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Forma Pgto</th>
                    <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Valor</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {currentItems.length === 0 ? (
                    <tr><td colSpan={5} className="px-6 py-8 text-center text-sm text-gray-500 dark:text-gray-400">Nenhum pagamento encontrado no período</td></tr>
                  ) : currentItems.map((item: any, index: number) => (
                    <tr key={String(item.id || index)} className="animate-fade-in-up" style={{ animationDelay: `${index * 50}ms` }}>
                      <td className="px-3 sm:px-6 py-4 text-xs sm:text-sm text-gray-900 dark:text-white whitespace-nowrap">
                        {item.data_pagamento ? new Date(item.data_pagamento).toLocaleDateString('pt-BR') : item.created_at ? new Date(item.created_at).toLocaleDateString('pt-BR') : '—'}
                      </td>
                      <td className="px-3 sm:px-6 py-4 text-xs sm:text-sm">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${item._tipo === 'atacado' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400' : 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'}`}>
                          {item._tipo === 'atacado' ? 'Atacado' : 'Entrega'}
                        </span>
                      </td>
                      <td className="px-3 sm:px-6 py-4 text-xs sm:text-sm text-gray-900 dark:text-white">
                        {item._tipo === 'atacado' ? `Pedido #${item._pedido || '—'} — ${item._cliente || 'Cliente'}` : `Entrega ${item.entrega_id ? String(item.entrega_id).slice(0, 8) + '...' : '—'}`}
                      </td>
                      <td className="px-3 sm:px-6 py-4 text-xs sm:text-sm text-gray-900 dark:text-white">{item.forma_pagamento || '—'}</td>
                      <td className="px-3 sm:px-6 py-4 text-xs sm:text-sm font-semibold text-gray-900 dark:text-white">{formatCurrency(Number(item.valor) || 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination currentPage={currentPage} totalPages={totalPages} totalCount={totalItems} pageSize={itemsPerPage} onPageChange={(page) => setCurrentPage(page)} />
          </div>
        )}

        {selectedReport === 'vendas_atacado_pj' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-gray-200 dark:border-gray-700">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Pedidos Atacado</p>
                <p className="text-xl font-bold text-blue-600 dark:text-blue-400">
                  {dadosPeriodo.vendasAtacado.length}
                </p>
                <p className="text-sm font-semibold text-gray-900 dark:text-white mt-1">
                  {formatCurrency(metricas.totalVendasAtacado)}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Recebido: {formatCurrency(metricas.totalRecebidoAtacado)}
                </p>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-gray-200 dark:border-gray-700">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Orçamentos PJ Aprovados</p>
                <p className="text-xl font-bold text-purple-600 dark:text-purple-400">
                  {dadosPeriodo.orcamentosPJ.length}
                </p>
                <p className="text-sm font-semibold text-gray-900 dark:text-white mt-1">
                  {formatCurrency(metricas.totalOrcamentosAprovados)}
                </p>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-gray-200 dark:border-gray-700">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">A Receber Atacado</p>
                <p className="text-xl font-bold text-red-500 dark:text-red-400">
                  {formatCurrency(metricas.totalVendasAtacado - metricas.totalRecebidoAtacado)}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  ({dadosPeriodo.vendasAtacado.filter((v: any) => v.status_pagamento !== 'pago').length} pendentes)
                </p>
              </div>
            </div>
            
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
      <div className="p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
          <BarChart3 className="w-5 h-5 mr-2 no-print" />
          Pedidos Atacado & Orçamentos PJ — Últimos {selectedPeriod} dias
        </h2>
        {totalItems > 0 && (
          <span className="text-xs text-gray-500 no-print">
            {startIndex + 1}–{Math.min(endIndex, totalItems)} de {totalItems}
          </span>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 print-table">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Data</th>
              <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tipo</th>
              <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nº</th>
              <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cliente</th>
              <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Valor Total</th>
              <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Pago</th>
              <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {currentItems.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-8 text-center text-sm text-gray-500">
                  Nenhum registro encontrado no período
                </td>
              </tr>
            ) : currentItems.map((item: any, index: number) => (
              <tr key={String(item.id || index)} className="animate-fade-in-up" style={{ animationDelay: `${index * 50}ms` }}>
                <td className="px-3 sm:px-6 py-4 text-xs sm:text-sm text-gray-900 dark:text-white whitespace-nowrap">
                  {item._tipo === 'atacado' 
                    ? (item.data_entrega ? new Date(item.data_entrega).toLocaleDateString('pt-BR') : '—') 
                    : (item.data_orcamento ? new Date(item.data_orcamento).toLocaleDateString('pt-BR') : '—')}
                </td>
                <td className="px-3 sm:px-6 py-4 text-xs sm:text-sm">
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                    item._tipo === 'atacado' 
                      ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400' 
                      : 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400'
                  }`}>
                    {item._tipo === 'atacado' ? 'Atacado' : 'Orç. PJ'}
                  </span>
                </td>
                <td className="px-3 sm:px-6 py-4 text-xs sm:text-sm text-gray-900 dark:text-white">
                  {item._tipo === 'atacado' ? `#${item.numero_pedido || '—'}` : `#${item.numero_orcamento || '—'}`}
                </td>
                <td className="px-3 sm:px-6 py-4 text-xs sm:text-sm text-gray-900 dark:text-white">
                  {item._tipo === 'atacado' ? (item.nome_cliente_cache || '—') : (item.cliente_nome || '—')}
                </td>
                <td className="px-3 sm:px-6 py-4 text-xs sm:text-sm font-semibold text-gray-900 dark:text-white">
                  {formatCurrency(Number(item.valor_total) || 0)}
                </td>
                <td className="px-3 sm:px-6 py-4 text-xs sm:text-sm text-gray-900 dark:text-white">
                  {item._tipo === 'atacado' ? formatCurrency(Number(item.valor_pago) || 0) : '—'}
                </td>
                <td className="px-3 sm:px-6 py-4 text-xs sm:text-sm">
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                    item.status_pagamento === 'pago' || item.status === 'convertido' || item.status === 'aprovado'
                      ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                      : item.status_pagamento === 'atrasado' || item.status === 'rejeitado'
                      ? 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
                      : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
                  }`}>
                    {item._tipo === 'atacado' 
                      ? (item.status_pagamento || 'pendente') 
                      : (item.status || 'pendente')}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination 
        currentPage={currentPage} 
        totalPages={totalPages} 
        totalCount={totalItems} 
        pageSize={itemsPerPage} 
        onPageChange={(page) => setCurrentPage(page)} 
      />
    </div>
          </div>
        )}

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
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white flex items-center">
                  <Users className="w-4 h-4 sm:w-5 sm:h-5 mr-2 no-print" />
                  Performance de Vendedores - Últimos {selectedPeriod} dias
                </h2>
                {totalItems > 0 && (
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 text-xs sm:text-sm text-gray-600 dark:text-gray-400 no-print">
                    <span>
                      Mostrando {startIndex + 1} a {Math.min(endIndex, totalItems)} de {totalItems} vendedores
                    </span>
                    <span className="hidden sm:inline text-gray-300 dark:text-gray-600">|</span>
                    <span>
                      {itemsPerPage} por página
                    </span>
                  </div>
                )}
              </div>
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
                  {currentItems.map((vendedor: any, index: number) => (
                    <tr 
                      key={vendedor.id}
                      className="animate-fade-in-up"
                      style={{ animationDelay: `${index * 75}ms` }}
                    >
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
                        {vendedor.taxaConversao}
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
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalCount={totalItems}
              pageSize={itemsPerPage}
              onPageChange={(page) => setCurrentPage(page)}
            />
          </div>
        )}

        {selectedReport === 'produtos' && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white flex items-center">
                  <Package className="w-4 h-4 sm:w-5 sm:h-5 mr-2 no-print" />
                  Top 10 Produtos - Últimos {selectedPeriod} dias
                </h2>
                {totalItems > 0 && (
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 text-xs sm:text-sm text-gray-600 dark:text-gray-400 no-print">
                    <span>
                      Mostrando {startIndex + 1} a {Math.min(endIndex, totalItems)} de {totalItems} produtos
                    </span>
                    <span className="hidden sm:inline text-gray-300 dark:text-gray-600">|</span>
                    <span>
                      {itemsPerPage} por página
                    </span>
                  </div>
                )}
              </div>
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
                  {currentItems.map((produto: any, index: number) => produto && (
                    <tr 
                      key={String(produto.id || '')}
                      className="animate-fade-in-up"
                      style={{ animationDelay: `${index * 75}ms` }}
                    >
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
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalCount={totalItems}
              pageSize={itemsPerPage}
              onPageChange={(page) => setCurrentPage(page)}
            />
          </div>
        )}

        {selectedReport === 'entregas' && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white flex items-center">
                  <Truck className="w-4 h-4 sm:w-5 sm:h-5 mr-2 no-print" />
                  Relatório de Entregas - Últimos {selectedPeriod} dias
                </h2>
                {totalItems > 0 && (
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 text-xs sm:text-sm text-gray-600 dark:text-gray-400 no-print">
                    <span>
                      Mostrando {startIndex + 1} a {Math.min(endIndex, totalItems)} de {totalItems} entregas
                    </span>
                    <span className="hidden sm:inline text-gray-300 dark:text-gray-600">|</span>
                    <span>
                      {itemsPerPage} por página
                    </span>
                  </div>
                )}
              </div>
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
                  {currentItems.map((entrega: any, index: number) => (
                    <tr 
                      key={String(entrega.id || Math.random())}
                      className="animate-fade-in-up"
                      style={{ animationDelay: `${index * 75}ms` }}
                    >
                      <td className="px-3 sm:px-6 py-4 text-xs sm:text-sm text-gray-900 dark:text-white">
                        {new Date(entrega.data_entrega as string | number | Date).toLocaleDateString('pt-BR')}
                      </td>
                      <td className="px-3 sm:px-6 py-4 text-xs sm:text-sm text-gray-900 dark:text-white break-words">
                        {(entrega.cliente as any)?.nome || entrega.cliente_nome || 'N/A'}
                      </td>
                      <td className="px-3 sm:px-6 py-4 text-xs sm:text-sm text-gray-900 dark:text-white break-words">
                        {(entrega.vendedor as any)?.nome || 
                         (vendedores || []).find(v => v.id === entrega.vendedor_id)?.nome || 'N/A'}
                      </td>
                      <td className="px-3 sm:px-6 py-4 text-xs sm:text-sm text-gray-900 dark:text-white break-words">
                        {formatCurrency(Number(entrega.valor) || 0)}
                      </td>
                      <td className="px-3 sm:px-6 py-4 text-xs sm:text-sm">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          entrega.status_pagamento === 'pago' 
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                            : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
                        }`}>
                          {entrega.status_pagamento === 'pago' ? 'Pago' : 'Pendente'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalCount={totalItems}
              pageSize={itemsPerPage}
              onPageChange={(page) => setCurrentPage(page)}
            />
          </div>
        )}
      </div>
    </>
  );
};

export default Relatorios;

