import { EstoqueAtual } from '@/types/estoque';
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
  const estoqueAlertsQuery = useEstoqueAlerts(adminId || '', { enabled: !!adminId });

  const summary = summaryQuery.data;
  const chartsData = chartsQuery.data;
  const estoqueAlerts = estoqueAlertsQuery.data;

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
    estoqueAlerts: estoqueAlerts || [],
    isLoading: summaryQuery.isLoading,
    someLoading: summaryQuery.isLoading || chartsQuery.isLoading || estoqueAlertsQuery.isLoading
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

// Hook para total de vendas por vendedor (usado no modal de detalhes)
export const useTotalVendasPorVendedor = (vendedorId: string, options?: { enabled?: boolean }) => {
  return useQuery({
    queryKey: ['TOTAL_VENDAS_VENDEDOR', vendedorId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('entregas')
        .select('valor')
        .eq('vendedor_id', vendedorId);

      if (error) throw error;

      const total = data?.reduce((acc, curr) => acc + (curr.valor || 0), 0) || 0;
      const count = data?.length || 0;

      return { total, count };
    },
    enabled: options?.enabled && !!vendedorId,
    staleTime: 1000 * 60 * 5, // 5 minutos
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
  const currentMonthStart = `${currentYear}-${currentMonth.toString().padStart(2, '0')}-01`;
  const currentMonthEnd = new Date(currentYear, currentMonth, 0).toISOString().split('T')[0];

  // Query para entregas dos últimos 60 dias (para garantir dados mesmo se o mês começou agora)
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
  }, [entregasData.data, entregasData.isLoading, administrador_id, currentMonthStart, currentMonthEnd]);

  return {
    data: processedData,
    isLoading: entregasData.isLoading,
    error: entregasData.error,
  };
};

// Hook para pagamentos mensais dos últimos 12 meses
export const usePagamentosMensais = (administrador_id: string, options?: { enabled?: boolean }) => {
  const currentDate = new Date();
  const months: { month: string; value: number; height: number; count: number }[] = [];
  
  // Gerar dados dos últimos 12 meses
  for (let i = 11; i >= 0; i--) {
    const d = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
    const monthName = d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
    months.push({
      month: monthName.charAt(0).toUpperCase() + monthName.slice(1),
      value: 0,
      height: 0,
      count: 0
    });
  }

  const { data: faturamentoData, isLoading } = useFaturamentoMensal(administrador_id, options);

  const processedData = React.useMemo(() => {
    if (!faturamentoData || isLoading) return [];

    const dataMap = [...months];
    let maxValue = 0;

    faturamentoData.forEach((item: any) => {
      const date = new Date(item.data_pagamento);
      const monthIndex = 11 - (currentDate.getMonth() - date.getMonth() + 
        (12 * (currentDate.getFullYear() - date.getFullYear())));
      
      if (monthIndex >= 0 && monthIndex < 12) {
        dataMap[monthIndex].value += item.valor;
        dataMap[monthIndex].count += 1;
        if (dataMap[monthIndex].value > maxValue) {
          maxValue = dataMap[monthIndex].value;
        }
      }
    });

    // Calcular alturas relativas (max 90%)
    return dataMap.map(item => ({
      ...item,
      height: maxValue > 0 ? (item.value / maxValue) * 90 : 10
    }));
  }, [faturamentoData, isLoading]);

  return {
    data: processedData,
    isLoading
  };
};

// Hook para alertas de estoque baixo
export const useEstoqueAlerts = (administrador_id: string, options?: { enabled?: boolean }) => {
  return useQuery({
    queryKey: [CACHE_KEYS.VIEW_ESTOQUE_ATUAL, 'baixo', administrador_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('view_estoque_atual')
        .select('*')
        .eq('administrador_id', administrador_id)
        .or('status_estoque.eq.BAIXO,status_estoque.eq.ZERADO')
        .order('qtd_estoque', { ascending: true });

      if (error) throw error;
      return data as EstoqueAtual[];
    },
    enabled: options?.enabled && !!administrador_id,
    staleTime: CACHE_TIMES.DASHBOARD_SUMMARY.staleTime,
  });
};

// Hook para total de entregas por vendedor (agrupado para o administrador)
export const useTotalEntregasPorAdministrador = (administrador_id: string, options?: { enabled?: boolean }) => {
  return useQuery({
    queryKey: ['TOTAL_ENTREGAS_POR_ADMINISTRADOR', administrador_id],
    queryFn: async () => {
      // Buscar entregas e seus vendedores
      const { data, error } = await supabase
        .from('entregas')
        .select('vendedor_id, vendedores!inner(administrador_id)')
        .eq('vendedores.administrador_id', administrador_id);

      if (error) throw error;

      // Agrupar contagem por vendedor_id
      const entregasPorVendedor: Record<string, number> = {};
      
      data?.forEach((entrega) => {
        const vendedorId = entrega.vendedor_id;
        if (vendedorId) {
          entregasPorVendedor[vendedorId] = (entregasPorVendedor[vendedorId] || 0) + 1;
        }
      });

      return entregasPorVendedor;
    },
    enabled: options?.enabled && !!administrador_id,
    staleTime: 1000 * 60 * 15, // 15 minutos
  });
};
