import React from 'react';
import { useSupabaseQuery } from '../lib/supabaseCache';
import { supabase } from '../lib/supabase';
import { useQuery } from '@tanstack/react-query';
import { CACHE_KEYS } from '../lib/cache/cacheConfig';

// Hook para estatísticas do dashboard do administrador
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
