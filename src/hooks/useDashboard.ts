import { useQuery, UseQueryResult } from '@tanstack/react-query';
import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { CACHE_KEYS, CACHE_TIMES } from '../lib/constants/queryKeys';
import { supabase } from '../lib/supabase';
import { useSupabaseQuery } from '../lib/supabaseCache';

export const useDashboard = () => {
  // Implementação movida para o final do arquivo para acessar os outros hooks
  const { adminId } = useAuth();
  
  // Hooks auxiliares definidos abaixo
  const summaryQuery = useDashboardSummary(adminId || '', { enabled: !!adminId });
  const chartsQuery = usePagamentosMensais(adminId || '', { enabled: !!adminId });

  const summary = summaryQuery.data;
  const chartsData = chartsQuery.data;

  // Cálculos de percentual
  const calcPercent = (atual: number, anterior: number) => {
    if (!anterior) return atual > 0 ? 100 : 0;
    return Math.round(((atual - anterior) / anterior) * 100);
  };

  const percentualFaturamento = calcPercent(summary?.faturamento_mes_atual || 0, summary?.faturamento_mes_anterior || 0);
  const percentualEntregas = calcPercent(summary?.entregas_mes_atual || 0, summary?.entregas_mes_anterior || 0);

  // Mapear Top Vendedores para formato da UI
  const vendedores = summary?.top_vendedores.map(v => ({
    name: v.nome,
    sales: `${v.total_entregas} vendas`,
    totalValue: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v.total_vendido)
  })) || [];

  return {
    stats: {
      faturamentoAtual: summary?.faturamento_mes_atual || 0,
      valoresEmFalta: summary?.valores_em_falta || 0,
      entregasAtual: summary?.entregas_mes_atual || 0,
      vendedoresAtivos: summary?.vendedores_ativos || 0,
      percentualFaturamento,
      percentualEntregas,
    },
    charts: {
      faturamentoMensal: chartsData || []
    },
    vendedores,
    isLoading: summaryQuery.isLoading,
    someLoading: summaryQuery.isLoading || chartsQuery.isLoading
  };
};

export interface DashboardSummary {
  vendedores_ativos: number;
  entregas_mes_atual: number;
  entregas_mes_anterior: number;
  faturamento_mes_atual: number;
  faturamento_mes_anterior: number;
  valores_em_falta: number;
  top_vendedores: {
    id: string;
    nome: string;
    total_entregas: number;
    total_vendido: number;
  }[];
}

// Hook unificado para todas as estatísticas do dashboard
export const useDashboardSummary = (administrador_id: string, options?: { enabled?: boolean }) => {
  // TODO: Quando a função RPC estiver criada no banco, descomentar e usar:
  // const query = supabase.rpc('get_dashboard_summary', { admin_id: administrador_id });

  // Fallback temporário usando queries separadas enquanto RPC não existe
  const result = useQuery({
    queryKey: ['DASHBOARD', 'summary', administrador_id],
    queryFn: async () => {
      try {
        // 1. Vendedores Ativos
        const { data: vendedores, error: errVendedores } = await supabase
          .from('vendedores')
          .select('id')
          .eq('administrador_id', administrador_id)
          .eq('ativo', true);
          
        if (errVendedores) throw errVendedores;

        const vendedores_ativos = vendedores?.length || 0;
        const vendedorIds = vendedores?.map(v => v.id) || [];

        // 2. Entregas (Mês Atual e Anterior)
        const now = new Date();
        const firstDayCurrent = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
        const firstDayPrevious = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
        const lastDayPrevious = new Date(now.getFullYear(), now.getMonth(), 0).toISOString();

        const { data: entregasAtuais, error: errEntregasAtuais } = await supabase
          .from('entregas')
          .select('valor')
          .in('vendedor_id', vendedorIds)
          .gte('data_entrega', firstDayCurrent);
          
        if (errEntregasAtuais) throw errEntregasAtuais;

        const { data: entregasAnteriores, error: errEntregasAnteriores } = await supabase
          .from('entregas')
          .select('valor')
          .in('vendedor_id', vendedorIds)
          .gte('data_entrega', firstDayPrevious)
          .lte('data_entrega', lastDayPrevious);

        if (errEntregasAnteriores) throw errEntregasAnteriores;

        const entregas_mes_atual = entregasAtuais?.length || 0;
        const entregas_mes_anterior = entregasAnteriores?.length || 0;
        const faturamento_mes_atual = entregasAtuais?.reduce((sum, e) => sum + (e.valor || 0), 0) || 0;
        const faturamento_mes_anterior = entregasAnteriores?.reduce((sum, e) => sum + (e.valor || 0), 0) || 0;

        // 3. Valores em Falta (Geral) - MATCHING DEVEDORES LOGIC
        // Calculates debts from overdue deliveries (dataRetorno < current month)
        const firstDayCurrentStr = firstDayCurrent.split('T')[0];

        const { data: entregasDevedoras, error: errEntregasDevedoras } = await supabase
           .from('entregas')
           .select(`
             id,
             valor,
             pagamentos (
               valor
             ),
             vendedores!inner (
               administrador_id
             )
           `)
           .eq('vendedores.administrador_id', administrador_id)
           .not('dataRetorno', 'is', null)
           .lt('dataRetorno', firstDayCurrentStr);

        if (errEntregasDevedoras) throw errEntregasDevedoras;

        let valores_em_falta = 0;
        
        entregasDevedoras?.forEach((entrega: any) => {
          const valorTotal = entrega.valor || 0;
          const valorPago = entrega.pagamentos?.reduce((sum: number, p: any) => sum + (p.valor || 0), 0) || 0;
          const debito = valorTotal - valorPago;
          
          if (debito > 0.01) { // Small epsilon for float comparison
             valores_em_falta += debito;
          }
        });

        // 4. Top Vendedores (Calculado)
        const { data: dadosVendedores, error: errTopVendedores } = await supabase
          .from('entregas')
          .select(`
            vendedor_id, 
            valor, 
            vendedores!inner(id, nome)
          `)
          .in('vendedor_id', vendedorIds)
          .gte('data_entrega', firstDayCurrent);

        if (errTopVendedores) throw errTopVendedores;

        const vendedoresMap = new Map();
        dadosVendedores?.forEach((e: any) => {
          // Safe navigation para evitar crash se relacionamento falhar
          const vid = e.vendedores?.id;
          if (!vid) return;

          if (!vendedoresMap.has(vid)) {
            vendedoresMap.set(vid, {
              id: vid,
              nome: e.vendedores.nome || 'Vendedor',
              total_entregas: 0,
              total_vendido: 0
            });
          }
          const v = vendedoresMap.get(vid);
          v.total_entregas++;
          v.total_vendido += (e.valor || 0);
        });

        const top_vendedores = Array.from(vendedoresMap.values())
          .sort((a: any, b: any) => b.total_vendido - a.total_vendido)
          .slice(0, 5); 

        return {
          vendedores_ativos,
          entregas_mes_atual,
          entregas_mes_anterior,
          faturamento_mes_atual,
          faturamento_mes_anterior,
          valores_em_falta,
          top_vendedores
        } as DashboardSummary;
      } catch (error) {
        console.error('Erro na query do Dashboard:', error);
        throw error;
      }
    },
    enabled: options?.enabled && !!administrador_id,
    staleTime: CACHE_TIMES.DASHBOARD_SUMMARY.staleTime,
    retry: 2,
    refetchOnWindowFocus: false // Evita refetch excessivo que pode causar race conditions
  });

  // Se tiver erro ou data null (e não estiver carregando), retornar dados vazios
  if (result.error || (!result.isLoading && !result.data)) {
    if (result.error) {
       console.error('Dashboard Error:', result.error);
    }
    return {
      data: {
        vendedores_ativos: 0,
        entregas_mes_atual: 0,
        entregas_mes_anterior: 0,
        faturamento_mes_atual: 0,
        faturamento_mes_anterior: 0,
        valores_em_falta: 0,
        top_vendedores: [],
      },
      isLoading: false,
      error: result.error,
      refetch: result.refetch,
      status: 'success', // Fallback to success with empty data to avoid crashing UI
    } as unknown as UseQueryResult<DashboardSummary, Error>;
  }

  return {
    ...result,
    data: result.data as DashboardSummary | undefined,
  } as UseQueryResult<DashboardSummary, Error>;
};

// Hook para estatísticas do dashboard do administrador
// @deprecated Use useDashboardSummary instead
export const useDashboardStats = (administrador_id: string, options?: { enabled?: boolean }) => {
  const query = supabase.rpc('get_dashboard_stats', { admin_id: administrador_id });

  return useSupabaseQuery('DASHBOARD_STATS', query, [CACHE_KEYS.DASHBOARD_STATS, administrador_id], {
    enabled: options?.enabled && !!administrador_id,
  });
};

// Hook para vendedores ativos do administrador
export const useVendedoresAtivos = (administrador_id: string, options?: { enabled?: boolean }) => {
  const query = supabase
    .from('vendedores')
    .select('id, nome, created_at')
    .eq('administrador_id', administrador_id)
    .eq('ativo', true);

  return useSupabaseQuery('VENDEDORES_ATIVOS', query, [CACHE_KEYS.VENDEDORES_ATIVOS, administrador_id], {
    enabled: options?.enabled && !!administrador_id,
  });
};

// Hook para entregas do mês atual vs mês anterior
export const useEntregasDoMes = (administrador_id: string, options?: { enabled?: boolean }) => {
  const currentDate = new Date();
  const currentMonth = currentDate.getMonth() + 1;
  const currentYear = currentDate.getFullYear();
  const previousMonth = currentMonth === 1 ? 12 : currentMonth - 1;
  const previousYear = currentMonth === 1 ? currentYear - 1 : currentYear;

  const currentMonthStart = `${currentYear}-${currentMonth.toString().padStart(2, '0')}-01`;
  const currentMonthEnd = new Date(currentYear, currentMonth, 0).toISOString().split('T')[0];
  const previousMonthStart = `${previousYear}-${previousMonth.toString().padStart(2, '0')}-01`;
  const previousMonthEnd = new Date(previousYear, previousMonth + 1, 0).toISOString().split('T')[0];

  // Entregas do mês atual
  const currentMonthQuery = supabase
    .from('entregas')
    .select('id, valor, vendedores!inner(administrador_id)')
    .eq('vendedores.administrador_id', administrador_id)
    .gte('data_entrega', currentMonthStart)
    .lte('data_entrega', currentMonthEnd);

  // Entregas do mês anterior
  const previousMonthQuery = supabase
    .from('entregas')
    .select('id, valor, vendedores!inner(administrador_id)')
    .eq('vendedores.administrador_id', administrador_id)
    .gte('data_entrega', previousMonthStart)
    .lte('data_entrega', previousMonthEnd);

  const currentMonth_data = useSupabaseQuery('ENTREGAS_MES_ATUAL', currentMonthQuery, [CACHE_KEYS.ENTREGAS_MES_ATUAL, administrador_id, currentMonthStart, currentMonthEnd], {
    enabled: options?.enabled && !!administrador_id,
  });

  const previousMonth_data = useSupabaseQuery('ENTREGAS_MES_ANTERIOR', previousMonthQuery, [CACHE_KEYS.ENTREGAS_MES_ANTERIOR, administrador_id, previousMonthStart, previousMonthEnd], {
    enabled: options?.enabled && !!administrador_id,
  });

  return {
    currentMonth: currentMonth_data,
    previousMonth: previousMonth_data,
  };
};

// Hook para faturamento do mês atual vs mês anterior
export const useFaturamentoDoMes = (administrador_id: string, options?: { enabled?: boolean }) => {
  const currentDate = new Date();
  const currentMonth = currentDate.getMonth() + 1;
  const currentYear = currentDate.getFullYear();
  const previousMonth = currentMonth === 1 ? 12 : currentMonth - 1;
  const previousYear = currentMonth === 1 ? currentYear - 1 : currentYear;

  const currentMonthStart = `${currentYear}-${currentMonth.toString().padStart(2, '0')}-01`;
  const currentMonthEnd = new Date(currentYear, currentMonth, 0).toISOString().split('T')[0];
  const previousMonthStart = `${previousYear}-${previousMonth.toString().padStart(2, '0')}-01`;
  const previousMonthEnd = new Date(previousYear, previousMonth + 1, 0).toISOString().split('T')[0];

  // Pagamentos do mês atual
  const currentMonthQuery = supabase
    .from('pagamentos')
    .select('valor, entregas!inner(vendedores!inner(administrador_id))')
    .eq('entregas.vendedores.administrador_id', administrador_id)
    .gte('data_pagamento', currentMonthStart)
    .lte('data_pagamento', currentMonthEnd);

  // Pagamentos do mês anterior
  const previousMonthQuery = supabase
    .from('pagamentos')
    .select('valor, entregas!inner(vendedores!inner(administrador_id))')
    .eq('entregas.vendedores.administrador_id', administrador_id)
    .gte('data_pagamento', previousMonthStart)
    .lte('data_pagamento', previousMonthEnd);

  const currentMonth_data = useSupabaseQuery('FATURAMENTO_MES_ATUAL', currentMonthQuery, [CACHE_KEYS.FATURAMENTO_MES_ATUAL, administrador_id, currentMonthStart, currentMonthEnd], {
    enabled: options?.enabled && !!administrador_id,
  });

  const previousMonth_data = useSupabaseQuery('FATURAMENTO_MES_ANTERIOR', previousMonthQuery, [CACHE_KEYS.FATURAMENTO_MES_ANTERIOR, administrador_id, previousMonthStart, previousMonthEnd], {
    enabled: options?.enabled && !!administrador_id,
  });

  return {
    currentMonth: currentMonth_data,
    previousMonth: previousMonth_data,
  };
};

// Hook para valores em falta (devedores) - usando abordagem corrigida
export const useValoresEmFalta = (administrador_id: string, options?: { enabled?: boolean }) => {
  // Calcular o primeiro dia do mês atual (mesma lógica da página Devedores)
  const currentDate = new Date();
  const firstDayOfCurrentMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  const firstDayOfCurrentMonthString = firstDayOfCurrentMonth.toISOString().split('T')[0];

  // Buscar todas as entregas com data de retorno anterior ao mês atual (mesma lógica da página Devedores)
  const entregasQuery = supabase
    .from('entregas')
    .select(`
      id,
      valor,
      mes_cobranca,
      dataRetorno,
      pago,
      vendedores!inner(
        administrador_id
      )
    `)
    .eq('vendedores.administrador_id', administrador_id)
    .not('dataRetorno', 'is', null)
    .lt('dataRetorno', firstDayOfCurrentMonthString);

  const { data: entregasData, ...queryResult } = useSupabaseQuery('VALORES_EM_FALTA', entregasQuery, [CACHE_KEYS.VALORES_EM_FALTA, administrador_id, firstDayOfCurrentMonthString], {
    enabled: options?.enabled && !!administrador_id,
  });

  // Buscar valores pagos para cada entrega usando React Query
  const entregasComPagamentos = useQuery({
    queryKey: ['VALORES_PAGOS', Array.isArray(entregasData) ? entregasData.map((e: any) => e.id) : []],
    queryFn: async () => {
      if (!entregasData || !Array.isArray(entregasData) || entregasData.length === 0) return [];
      
      const entregasComValoresPagos = await Promise.all(
        entregasData.map(async (entrega: any) => {
          const { data: viewData } = await supabase
            .from('view_entregas_com_pagamentos')
            .select('valor_total_pago')
            .eq('entrega_id', entrega.id)
            .single();

          return {
            entrega_id: entrega.id,
            valor_total_pago: viewData?.valor_total_pago || 0,
            entregas: entrega
          };
        })
      );

      return entregasComValoresPagos;
    },
    enabled: !!entregasData && Array.isArray(entregasData) && entregasData.length > 0,
  });

  return {
    data: entregasComPagamentos.data || [],
    isLoading: queryResult.isLoading || entregasComPagamentos.isLoading,
    error: queryResult.error || entregasComPagamentos.error,
    refetch: () => {
      queryResult.refetch();
      entregasComPagamentos.refetch();
    }
  };
};

// Hook para faturamento mensal dos últimos 12 meses
export const useFaturamentoMensal = (administrador_id: string, options?: { enabled?: boolean }) => {
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth() + 1;

  // Calcular range de datas para os últimos 12 meses
  const startDate = new Date(currentYear - 1, currentMonth - 1, 1);
  const endDate = new Date(currentYear, currentMonth, 0);

  const query = supabase
    .from('pagamentos')
    .select(`
      valor,
      data_pagamento,
      entregas!inner(
        vendedores!inner(
          administrador_id
        )
      )
    `)
    .eq('entregas.vendedores.administrador_id', administrador_id)
    .gte('data_pagamento', startDate.toISOString().split('T')[0])
    .lte('data_pagamento', endDate.toISOString().split('T')[0])
    .order('data_pagamento', { ascending: true });

  return useSupabaseQuery('FATURAMENTO_MENSAL', query, [CACHE_KEYS.FATURAMENTO_MENSAL, administrador_id, startDate.toISOString().split('T')[0], endDate.toISOString().split('T')[0]], {
    enabled: options?.enabled && !!administrador_id,
  });
};

// Hook para top vendedores - usando abordagem corrigida
export const useTopVendedores = (administrador_id: string, options?: { enabled?: boolean }) => {
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth() + 1;
  const previousMonth = currentMonth === 1 ? 12 : currentMonth - 1;
  const previousYear = currentMonth === 1 ? currentYear - 1 : currentYear;

  // Query para entregas dos últimos 60 dias
  const last60DaysQuery = supabase
    .from('entregas')
    .select(`
      id,
      valor,
      data_entrega,
      vendedores!inner(
        id,
        nome,
        administrador_id
      )
    `)
    .eq('vendedores.administrador_id', administrador_id)
    .gte('data_entrega', new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
    .order('data_entrega', { ascending: false });

  const entregasData = useSupabaseQuery('TOP_VENDEDORES', last60DaysQuery, [CACHE_KEYS.TOP_VENDEDORES, administrador_id, 'last60Days'], {
    enabled: options?.enabled && !!administrador_id,
  });

  // Processar dados
  const processedData = React.useMemo(() => {
    if (!entregasData.data || entregasData.isLoading) {
      return [];
    }

    const entregas = entregasData.data as any[];
    
    if (!entregas || entregas.length === 0) {
      return [];
    }

    // Separar entregas por mês
    const currentMonthStart = `${currentYear}-${currentMonth.toString().padStart(2, '0')}-01`;
    const currentMonthEnd = new Date(currentYear, currentMonth, 0).toISOString().split('T')[0];

    const currentMonthEntregas = entregas.filter(e => 
      e.data_entrega >= currentMonthStart && e.data_entrega <= currentMonthEnd
    );

    // Se não há entregas no mês atual, usar dados dos últimos 60 dias
    const entregasParaProcessar = currentMonthEntregas.length > 0 ? currentMonthEntregas : entregas;

    // Agrupar por vendedor
    const vendedoresMap = new Map();
    
    entregasParaProcessar.forEach((entrega: any) => {
      const vendedorId = entrega.vendedores.id;
      const vendedorNome = entrega.vendedores.nome;
      
      if (!vendedoresMap.has(vendedorId)) {
        vendedoresMap.set(vendedorId, {
          id: vendedorId,
          nome: vendedorNome,
          totalEntregas: 0,
          valorTotalEntregas: 0,
          totalVendas: 0
        });
      }
      
      const vendedor = vendedoresMap.get(vendedorId);
      vendedor.totalEntregas += 1;
      vendedor.valorTotalEntregas += entrega.valor || 0;
      vendedor.totalVendas += 1;
    });

    // Converter para array e ordenar
    const topVendedores = Array.from(vendedoresMap.values())
      .sort((a: any, b: any) => b.valorTotalEntregas - a.valorTotalEntregas)
      .slice(0, 5);

    return topVendedores;
  }, [entregasData.data, entregasData.isLoading, administrador_id, currentYear, currentMonth, previousYear, previousMonth]);

  return {
    data: processedData,
    isLoading: entregasData.isLoading,
    error: entregasData.error,
  };
};

// Hook para pagamentos mensais dos últimos 12 meses
export const usePagamentosMensais = (administrador_id: string, options?: { enabled?: boolean }) => {
  const currentDate = new Date();
  const months = [];
  
  // Gerar dados dos últimos 12 meses
  for (let i = 11; i >= 0; i--) {
    const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
    const monthStart = date.toISOString().split('T')[0];
    const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0).toISOString().split('T')[0];
    
    months.push({
      label: date.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', ''),
      monthStart,
      monthEnd,
      index: i
    });
  }

  // Calcular o range correto: do mês mais antigo até o mês atual
  const startDate = months[0].monthStart; // Primeiro mês (mais antigo)
  const endDate = months[months.length - 1].monthEnd; // Último mês (atual)

  // Criar uma query única que busca todos os dados dos últimos 12 meses
  const query = supabase
    .from('pagamentos')
    .select('valor, data_pagamento, entregas!inner(vendedores!inner(administrador_id))')
    .eq('entregas.vendedores.administrador_id', administrador_id)
    .gte('data_pagamento', startDate)
    .lte('data_pagamento', endDate)
    .order('data_pagamento', { ascending: true });

  const { data: allData, ...queryResult } = useSupabaseQuery('PAGAMENTOS_MENSAIS', query, [CACHE_KEYS.PAGAMENTOS_MENSAIS, administrador_id], {
    enabled: options?.enabled && !!administrador_id,
  });

  // Processar os dados para agrupar por mês
  const processedData = months.map(month => {
    const monthData = Array.isArray(allData) ? allData.filter((item: any) => {
      const itemDate = new Date(item.data_pagamento);
      const itemMonth = itemDate.toISOString().split('T')[0];
      return itemMonth >= month.monthStart && itemMonth <= month.monthEnd;
    }) : [];

    const totalValue = monthData.reduce((sum: number, item: any) => sum + (item.valor || 0), 0);
    
    return {
      month: month.label,
      value: totalValue,
      count: monthData.length
    };
  });

  // Calcular altura relativa para o gráfico
  const maxValue = Math.max(...processedData.map(d => d.value), 1);
  const dataWithHeight = processedData.map(data => ({
    ...data,
    height: maxValue > 0 ? (data.value / maxValue) * 100 : 0
  }));

  return {
    ...queryResult,
    data: dataWithHeight,
    months: months.map(m => m.label),
    queries: months.map(() => ({ data: [] })) // Para compatibilidade com código existente
  };
};

export const useVendasMensaisPorVendedor = (administrador_id: string, options?: { enabled?: boolean }) => {
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  
  const firstDayString = firstDay.toISOString().split('T')[0];
  const lastDayString = lastDay.toISOString().split('T')[0];

  const vendasQuery = supabase
    .from('entregas')
    .select(`
      vendedor_id,
      vendedores!inner(
        id,
        nome,
        administrador_id
      )
    `)
    .eq('vendedores.administrador_id', administrador_id)
    .gte('data_entrega', firstDayString)
    .lte('data_entrega', lastDayString);

  const { data: entregasData, ...queryResult } = useSupabaseQuery('VENDAS_MENSAIS_VENDEDORES', vendasQuery, [CACHE_KEYS.VENDAS_MENSAIS_VENDEDORES, administrador_id], {
    enabled: options?.enabled && !!administrador_id,
  });

  // Processar os dados para contar entregas por vendedor
  const vendasPorVendedor = useQuery({
    queryKey: ['VENDAS_PROCESSADAS', administrador_id, firstDayString, lastDayString],
    queryFn: () => {
      if (!entregasData || !Array.isArray(entregasData)) return {};
      
      const contadorVendas: Record<string, number> = {};
      
      entregasData.forEach((entrega: any) => {
        const vendedorId = entrega.vendedor_id;
        contadorVendas[vendedorId] = (contadorVendas[vendedorId] || 0) + 1;
      });
      
      return contadorVendas;
    },
    enabled: !!entregasData && options?.enabled !== false,
  });

  return {
    ...queryResult,
    data: vendasPorVendedor.data || {},
    isLoading: queryResult.isLoading || vendasPorVendedor.isLoading,
    error: queryResult.error || vendasPorVendedor.error,
  };
};

// Hook para buscar total de entregas por vendedor (sem filtro de data)
export const useTotalVendasPorVendedor = (vendedor_id: string, options?: { enabled?: boolean }) => {
  const totalVendasQuery = supabase
    .from('entregas')
    .select('valor')
    .eq('vendedor_id', vendedor_id);

  const { data: entregasData, ...queryResult } = useSupabaseQuery(
    'TOTAL_VENDAS_VENDEDOR', 
    totalVendasQuery, 
    [CACHE_KEYS.TOTAL_VENDAS_VENDEDOR, vendedor_id],
    {
      enabled: options?.enabled && !!vendedor_id,
    }
  );

  // Calcular o valor total das vendas
  const totalValue = Array.isArray(entregasData) 
    ? entregasData.reduce((sum, entrega) => sum + (entrega.valor || 0), 0)
    : 0;

  return {
    ...queryResult,
    data: totalValue,
    isLoading: queryResult.isLoading,
    error: queryResult.error,
  };
};

// Hook para contar o total de entregas por vendedor
// Hook para obter total de entregas por administrador (para todos os vendedores)
export const useTotalEntregasPorAdministrador = (administrador_id: string, options?: { enabled?: boolean }) => {
  const entregasQuery = supabase
    .from('entregas')
    .select('vendedor_id, vendedores!inner(administrador_id)')
    .eq('vendedores.administrador_id', administrador_id);

  const { data: entregasData, ...queryResult } = useSupabaseQuery(
    'TOTAL_ENTREGAS_ADMINISTRADOR',
    entregasQuery,
    [CACHE_KEYS.TOTAL_ENTREGAS_ADMINISTRADOR, administrador_id],
    {
      enabled: options?.enabled && !!administrador_id,
    }
  );

  // Agrupar por vendedor_id e contar
  const entregasPorVendedor: Record<string, number> = {};
  if (Array.isArray(entregasData)) {
    entregasData.forEach((entrega: any) => {
      entregasPorVendedor[entrega.vendedor_id] = (entregasPorVendedor[entrega.vendedor_id] || 0) + 1;
    });
  }

  return {
    ...queryResult,
    data: entregasPorVendedor,
  };
};

export const useClientesAtivos = (adminId: string, options?: { enabled?: boolean }) => {
  return useQuery({
    queryKey: ['clientes-ativos', adminId],
    queryFn: async () => {
      const { data: vendedores } = await supabase
        .from('vendedores')
        .select('id')
        .eq('administrador_id', adminId)
        .eq('ativo', true);
      
      const vendedorIds = vendedores?.map(v => v.id) || [];
      
      const { data } = await supabase
        .from('clientes')
        .select('id')
        .in('vendedor_id', vendedorIds)
        .eq('ativo', true);
      
      return data?.length || 0;
    },
    enabled: options?.enabled && !!adminId
  });
};

export const useTaxaInadimplencia = (adminId: string, options?: { enabled?: boolean }) => {
  return useQuery({
    queryKey: ['taxa-inadimplencia', adminId],
    queryFn: async () => {
      const { data: vendedores } = await supabase
        .from('vendedores')
        .select('id')
        .eq('administrador_id', adminId);
      
      const vendedorIds = vendedores?.map(v => v.id) || [];
      
      const { data: entregas } = await supabase
        .from('entregas')
        .select('id, pago, valor')
        .in('vendedor_id', vendedorIds);
      
      const total = entregas?.length || 0;
      const pendentes = entregas?.filter(e => !e.pago).length || 0;
      const valorPendente = entregas?.filter(e => !e.pago).reduce((sum, e) => sum + (e.valor || 0), 0) || 0;
      
      return {
        percentual: total > 0 ? ((pendentes / total) * 100) : 0,
        quantidade: pendentes,
        valorPendente
      };
    },
    enabled: options?.enabled && !!adminId
  });
};

export const useEntregasMensais = (adminId: string, options?: { enabled?: boolean }) => {
  return useQuery({
    queryKey: ['entregas-mensais', adminId],
    queryFn: async () => {
      const { data: vendedores } = await supabase
        .from('vendedores')
        .select('id')
        .eq('administrador_id', adminId);
      
      const vendedorIds = vendedores?.map(v => v.id) || [];
      
      const { data: entregas } = await supabase
        .from('entregas')
        .select('data_entrega')
        .in('vendedor_id', vendedorIds);
      
      const monthlyData: { [key: string]: number } = {};
      
      entregas?.forEach(e => {
        const date = new Date(e.data_entrega);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        monthlyData[monthKey] = (monthlyData[monthKey] || 0) + 1;
      });
      
      return monthlyData;
    },
    enabled: options?.enabled && !!adminId
  });
};


export const useTopProdutos = (adminId: string, options?: { enabled?: boolean }) => {
  return useQuery({
    queryKey: ['top-produtos', adminId],
    queryFn: async () => {
      const currentMonth = new Date();
      currentMonth.setDate(1);
      currentMonth.setHours(0, 0, 0, 0);
      
      const { data: vendedores } = await supabase
        .from('vendedores')
        .select('id')
        .eq('administrador_id', adminId);
      
      const vendedorIds = vendedores?.map(v => v.id) || [];
      
      // Buscar entregas e seus valores
      const { data: entregas } = await supabase
        .from('entregas')
        .select('produto_id, valor')
        .in('vendedor_id', vendedorIds)
        .gte('data_entrega', currentMonth.toISOString())
        .not('produto_id', 'is', null);
      
      if (!entregas || entregas.length === 0) return [];

      // Extrair IDs dos produtos
      const produtoIds = [...new Set(entregas.map(e => e.produto_id))];

      // Buscar nomes dos produtos manualmente (evita erro de FK inexistente)
      const { data: produtos } = await supabase
        .from('produtos_cadastrado')
        .select('id, produto_nome')
        .in('id', produtoIds);
        
      const produtosMapName = new Map();
      produtos?.forEach(p => produtosMapName.set(p.id, p.produto_nome));
      
      const produtosStats: { [key: string]: { nome: string; quantidade: number; valorTotal: number } } = {};
      
      entregas.forEach((e: any) => {
        const produtoId = e.produto_id;
        if (!produtoId) return;

        if (!produtosStats[produtoId]) {
          produtosStats[produtoId] = { 
            nome: produtosMapName.get(produtoId) || 'Produto desconhecido', 
            quantidade: 0, 
            valorTotal: 0 
          };
        }
        produtosStats[produtoId].quantidade += 1;
        produtosStats[produtoId].valorTotal += (e.valor || 0);
      });
      
      return Object.values(produtosStats)
        .sort((a, b) => b.quantidade - a.quantidade)
        .slice(0, 5);
    },
    enabled: options?.enabled && !!adminId
  });
};

export const useStatusPagamentos = (adminId: string, dias: string = '30', options?: { enabled?: boolean }) => {
  return useQuery({
    queryKey: ['status-pagamentos', adminId, dias],
    queryFn: async () => {
      const { data: vendedores } = await supabase
        .from('vendedores')
        .select('id')
        .eq('administrador_id', adminId);
      
      const vendedorIds = vendedores?.map(v => v.id) || [];
      
      let query = supabase
        .from('entregas')
        .select('pago, valor')
        .in('vendedor_id', vendedorIds);
      
      if (dias !== 'todos') {
        const date = new Date();
        date.setDate(date.getDate() - parseInt(dias));
        query = query.gte('data_entrega', date.toISOString());
      }
      
      const { data } = await query;
      
      const pagas = data?.filter(e => e.pago).length || 0;
      const pendentes = data?.filter(e => !e.pago).length || 0;
      const valorPago = data?.filter(e => e.pago).reduce((sum, e) => sum + (e.valor || 0), 0) || 0;
      const valorPendente = data?.filter(e => !e.pago).reduce((sum, e) => sum + (e.valor || 0), 0) || 0;
      
      return [
        { name: 'Pagas', value: pagas, valorTotal: valorPago, color: '#10b981' },
        { name: 'Pendentes', value: pendentes, valorTotal: valorPendente, color: '#ef4444' }
      ];
    },
    enabled: options?.enabled && !!adminId
  });
};

export const useAlertas = (adminId: string, options?: { enabled?: boolean }) => {
  return useQuery({
    queryKey: ['alertas-dashboard', adminId],
    queryFn: async () => {
      const alertas: any[] = [];
      
      const { data: vendedores } = await supabase
        .from('vendedores')
        .select('id, nome, last_sync')
        .eq('administrador_id', adminId)
        .eq('ativo', true);
      
      const diasSemSync = 7;
      const dataLimite = new Date();
      dataLimite.setDate(dataLimite.getDate() - diasSemSync);
      
      vendedores?.forEach(v => {
        if (!v.last_sync || new Date(v.last_sync) < dataLimite) {
          alertas.push({
            tipo: 'warning',
            mensagem: `${v.nome} sem sincronizar há ${diasSemSync}+ dias`,
            icone: '⚠️'
          });
        }
      });
      
      const { data: entregas } = await supabase
        .from('entregas')
        .select('id, cliente_id, clientes(nome)')
        .in('vendedor_id', vendedores?.map(v => v.id) || [])
        .eq('pago', false)
        .order('data_entrega', { ascending: true })
        .limit(3);
      
      entregas?.forEach(e => {
        alertas.push({
          tipo: 'danger',
          mensagem: `Cliente ${(e.clientes as any)?.nome} com pagamento pendente`,
          icone: '💰'
        });
      });
      
      return alertas.slice(0, 5);
    },
    enabled: options?.enabled && !!adminId
  });
  
};
