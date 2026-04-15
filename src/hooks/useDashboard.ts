import { EstoqueAtual } from '@/types/estoque';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';


// ─── Utilitário: detecta quando elemento entra na tela ───────────────────────
export const useIsVisible = () => {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (!ref.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setIsVisible(true); },
      { threshold: 0.1 }
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return { ref, isVisible };
};


// ─── Utilitário: soma campo de array ─────────────────────────────────────────
const soma = (arr: any[], field: string) =>
  arr?.reduce((s, i) => s + (Number(i[field]) || 0), 0) || 0;


// ─── Utilitário: gera início/fim do mês em ISO para timestamp with time zone ──
// data_entrega é "timestamp with time zone" salvo como UTC meia-noite.
// Usamos UTC para não cortar registros por fuso horário.
const mesAtualInicio = () =>
  new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)).toISOString();


// ─── ONDA 1: Core — cards principais ─────────────────────────────────────────
export const useDashboardCore = (adminId: string) => {
  const enabled = !!adminId;

  // Gera as datas uma vez por render (estáveis dentro do mesmo minuto)
  const now              = new Date();
  const firstDayCurrent  = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(),     1)).toISOString();
  const firstDayPrevious = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)).toISOString();
  const lastDayPrevious  = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(),     0, 23, 59, 59, 999)).toISOString();
  const firstDayDateOnly = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-01`;

  // Chave de cache baseada em ano+mês (string curta e estável)
  const cacheKey = `${now.getUTCFullYear()}-${now.getUTCMonth()}`;

  return useQuery({
    queryKey: ['dashboard_core', adminId, cacheKey],
    queryFn: async () => {
      const { data: vendedores } = await supabase
        .from('vendedores')
        .select('id')
        .eq('administrador_id', adminId)
        .eq('ativo', true);

      const vendedorIds = vendedores?.map(v => v.id) || [];

      const [
        entregasAtual,
        entregasAnterior,
        atacadoAtual,
        atacadoAnterior,
        orcamentosAtual,
        orcamentosAnterior,
        faltanteResult,
        faltanteAtacado,
      ] = await Promise.all([
        // Entregas do mês atual
        supabase.from('entregas').select('valor')
          .in('vendedor_id', vendedorIds)
          .gte('data_entrega', firstDayCurrent),

        // Entregas do mês anterior
        supabase.from('entregas').select('valor')
          .in('vendedor_id', vendedorIds)
          .gte('data_entrega', firstDayPrevious)
          .lte('data_entrega', lastDayPrevious),

        // Atacado do mês atual
        supabase.from('vendas_atacado').select('valor_total')
          .eq('administrador_id', adminId)
          .gte('created_at', firstDayCurrent),

        // Atacado do mês anterior
        supabase.from('vendas_atacado').select('valor_total')
          .eq('administrador_id', adminId)
          .gte('created_at', firstDayPrevious)
          .lte('created_at', lastDayPrevious),

        // Orçamentos PJ do mês atual convertidos
        supabase.from('orcamentos_pj').select('valor_total')
          .eq('administrador_id', adminId)
          .eq('status', 'convertido')
          .gte('data_orcamento', firstDayCurrent),

        // Orçamentos PJ do mês anterior convertidos
        supabase.from('orcamentos_pj').select('valor_total')
          .eq('administrador_id', adminId)
          .eq('status', 'convertido')
          .gte('data_orcamento', firstDayPrevious)
          .lte('data_orcamento', lastDayPrevious),

        // Inadimplência: entregas com dataRetorno ANTES do mês atual, sem join
        supabase.from('entregas').select(`
          id, valor,
          pagamentos(valor)
        `)
          .in('vendedor_id', vendedorIds)
          .not('dataRetorno', 'is', null)
          .lt('dataRetorno', firstDayDateOnly),

        // Inadimplência: atacado pendente/parcial/atrasado
        supabase.from('vendas_atacado')
          .select('valor_total, valor_pago')
          .eq('administrador_id', adminId)
          .in('status_pagamento', ['pendente', 'parcial', 'atrasado']),
      ]);

      const fat_entregas_atual    = soma(entregasAtual.data    || [], 'valor');
      const fat_atacado_atual     = soma(atacadoAtual.data     || [], 'valor_total');
      const fat_entregas_anterior = soma(entregasAnterior.data || [], 'valor');
      const fat_atacado_anterior  = soma(atacadoAnterior.data  || [], 'valor_total');

      const faturamento_atual    = fat_entregas_atual   + fat_atacado_atual;
      const faturamento_anterior = fat_entregas_anterior + fat_atacado_anterior;

      const entregas_atual    = (entregasAtual.data?.length    || 0) + (atacadoAtual.data?.length    || 0);
      const entregas_anterior = (entregasAnterior.data?.length || 0) + (atacadoAnterior.data?.length || 0);

      const fat_orcamentos_atual    = soma(orcamentosAtual.data    || [], 'valor_total');
      const fat_orcamentos_anterior = soma(orcamentosAnterior.data || [], 'valor_total');
      const qtd_orcamentos_atual    = orcamentosAtual.data?.length || 0;

      let valores_em_falta = 0;
      faltanteResult.data?.forEach((e: any) => {
        const pago   = e.pagamentos?.reduce((s: number, p: any) => s + (p.valor || 0), 0) || 0;
        const debito = (e.valor || 0) - pago;
        if (debito > 0.01) valores_em_falta += debito;
      });
      faltanteAtacado.data?.forEach((v: any) => {
        const debito = (Number(v.valor_total) || 0) - (Number(v.valor_pago) || 0);
        if (debito > 0.01) valores_em_falta += debito;
      });

      return {
        vendedores_ativos: vendedores?.length || 0,
        faturamento_atual,
        faturamento_anterior,
        entregas_atual,
        entregas_anterior,
        valores_em_falta,
        breakdown: {
          fat_entregas_atual,
          fat_atacado_atual,
          fat_orcamentos_atual,
          fat_orcamentos_anterior,
          qtd_orcamentos_atual,
        },
      };
    },
    enabled,
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
    retry: 2,
  });
};


// ─── ONDA 2: Entregas de hoje ─────────────────────────────────────────────────
export const useEntregasHoje = (adminId: string, enabled: boolean) => {
  // Para "hoje" usamos UTC meia-noite, igual ao padrão de gravação
  const hoje     = new Date().toISOString().split('T')[0];
  const inicioDia = `${hoje}T00:00:00.000Z`;
  const fimDia    = `${hoje}T23:59:59.999Z`;

  return useQuery({
    queryKey: ['dashboard_entregas_hoje', adminId, hoje],
    queryFn: async () => {
      const { data: vendedores } = await supabase
        .from('vendedores').select('id')
        .eq('administrador_id', adminId).eq('ativo', true);
      const ids = vendedores?.map(v => v.id) || [];

      const [entregas, atacado] = await Promise.all([
        // Filtra pelo dia inteiro em UTC (cobre qualquer hora gravada no dia)
        supabase.from('entregas').select('id')
          .in('vendedor_id', ids)
          .gte('data_entrega', inicioDia)
          .lte('data_entrega', fimDia),
        supabase.from('vendas_atacado').select('id')
          .eq('administrador_id', adminId)
          .gte('created_at', inicioDia)
          .lte('created_at', fimDia),
      ]);

      return { total: (entregas.data?.length || 0) + (atacado.data?.length || 0) };
    },
    enabled: enabled && !!adminId,
    staleTime: 1000 * 60 * 2,
    refetchOnWindowFocus: true,
  });
};


// ─── ONDA 2: Inadimplência por faixa ─────────────────────────────────────────
export const useInadimplenciaFaixas = (adminId: string, enabled: boolean) => {
  const now  = new Date();
  const hoje = now.toISOString().split('T')[0];

  return useQuery({
    queryKey: ['dashboard_inadimplencia', adminId, hoje],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('entregas')
        .select(`
          id, valor, "dataRetorno",
          pagamentos(valor),
          vendedores!inner(administrador_id)
        `)
        .eq('vendedores.administrador_id', adminId)
        .not('dataRetorno', 'is', null);

      if (error) throw error;

      const faixas = { ate30: 0, de30a60: 0, de60a90: 0, acima90: 0 };
      const totais = { ate30: 0, de30a60: 0, de60a90: 0, acima90: 0 };

      data?.forEach((e: any) => {
        const pago   = e.pagamentos?.reduce((s: number, p: any) => s + (p.valor || 0), 0) || 0;
        const debito = (e.valor || 0) - pago;
        if (debito <= 0.01) return;

        const diasAtraso = Math.floor(
          (now.getTime() - new Date(e.dataRetorno).getTime()) / 86400000
        );

        if      (diasAtraso <= 30) { faixas.ate30++;   totais.ate30   += debito; }
        else if (diasAtraso <= 60) { faixas.de30a60++; totais.de30a60 += debito; }
        else if (diasAtraso <= 90) { faixas.de60a90++; totais.de60a90 += debito; }
        else                       { faixas.acima90++; totais.acima90 += debito; }
      });

      return { faixas, totais };
    },
    enabled: enabled && !!adminId,
    staleTime: 1000 * 60 * 10,
    refetchOnWindowFocus: false,
  });
};


// ─── ONDA 2: Top Vendedores ───────────────────────────────────────────────────
export const useTopVendedoresDashboard = (adminId: string, enabled: boolean) => {
  const firstDay = mesAtualInicio();
  const cacheKey = `${new Date().getUTCFullYear()}-${new Date().getUTCMonth()}`;

  return useQuery({
    queryKey: ['dashboard_top_vendedores', adminId, cacheKey],
    queryFn: async () => {
      const [entregas, atacado] = await Promise.all([
        supabase.from('entregas')
          .select('vendedor_id, valor, vendedores!inner(id, nome)')
          .eq('vendedores.administrador_id', adminId)
          .gte('data_entrega', firstDay),
        supabase.from('vendas_atacado')
          .select('vendedor_id, valor_total, vendedores!inner(id, nome)')
          .eq('administrador_id', adminId)
          .gte('created_at', firstDay),
      ]);

      const map = new Map<string, { nome: string; entregas: number; total: number }>();

      const addToMap = (id: string, nome: string, valor: number) => {
        if (!map.has(id)) map.set(id, { nome, entregas: 0, total: 0 });
        const v = map.get(id)!;
        v.entregas++;
        v.total += valor;
      };

      entregas.data?.forEach((e: any) => {
        if (e.vendedores?.id) addToMap(e.vendedores.id, e.vendedores.nome, e.valor || 0);
      });
      atacado.data?.forEach((v: any) => {
        if (v.vendedores?.id) addToMap(v.vendedores.id, v.vendedores.nome, Number(v.valor_total) || 0);
      });

      return Array.from(map.entries())
        .map(([id, v]) => ({ id, ...v }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 5);
    },
    enabled: enabled && !!adminId,
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
  });
};


// ─── ONDA 3: Alertas de estoque ───────────────────────────────────────────────
export const useEstoqueAlertsDashboard = (adminId: string, enabled: boolean) => {
  return useQuery({
    queryKey: ['dashboard_estoque_alerts', adminId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('produtos_cadastrado')
        .select('id, produto_nome, qtd_estoque, estoque_minimo, unidade_medida')
        .eq('administrador_id', adminId);

      if (error) throw error;

      return (data || [])
        .filter(p => (p.qtd_estoque || 0) < 20)
        .map(p => ({
          id:             p.id,
          produto_nome:   p.produto_nome,
          qtd_estoque:    p.qtd_estoque    || 0,
          estoque_minimo: p.estoque_minimo || 0,
          unidade_medida: p.unidade_medida || 'un',
          status_estoque: (p.qtd_estoque || 0) <= 0 ? 'ZERADO' : 'BAIXO',
        }))
        .sort((a, b) => a.qtd_estoque - b.qtd_estoque) as EstoqueAtual[];
    },
    enabled: enabled && !!adminId,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
};


// ─── ONDA 3: Top Produtos mais vendidos (via itens_entrega) ──────────────────
export const useTopProdutosDashboard = (adminId: string, enabled: boolean) => {
  const firstDay = mesAtualInicio();
  const cacheKey = `${new Date().getUTCFullYear()}-${new Date().getUTCMonth()}`;

  return useQuery({
    queryKey: ['dashboard_top_produtos', adminId, cacheKey],
    queryFn: async () => {
      const { data: vendedores } = await supabase
        .from('vendedores')
        .select('id')
        .eq('administrador_id', adminId)
        .eq('ativo', true);

      const vendedorIds = vendedores?.map(v => v.id) || [];
      if (!vendedorIds.length) return [];

      const { data: entregas, error: errEntregas } = await supabase
        .from('entregas')
        .select('id')
        .in('vendedor_id', vendedorIds)
        .gte('data_entrega', firstDay);

      if (errEntregas) throw errEntregas;
      if (!entregas?.length) return [];

      const entregaIds = entregas.map(e => e.id);

      const { data: itens, error: errItens } = await supabase
        .from('itens_entrega')
        .select('produto_cadastrado_id, quantidade, produtos_cadastrado(id, produto_nome, unidade_medida)')
        .in('entrega_id', entregaIds);

      if (errItens) throw errItens;
      if (!itens?.length) return [];

      const map = new Map<string, { nome: string; unidade: string; qtd: number }>();

      itens.forEach((item: any) => {
        const pid  = item.produto_cadastrado_id;
        const info = item.produtos_cadastrado;
        if (!pid) return;

        if (!map.has(pid)) {
          map.set(pid, {
            nome:    info?.produto_nome   || 'Produto',
            unidade: info?.unidade_medida || 'un',
            qtd:     0,
          });
        }
        map.get(pid)!.qtd += Number(item.quantidade) || 1;
      });

      return Array.from(map.entries())
        .map(([id, v]) => ({ id, ...v }))
        .sort((a, b) => b.qtd - a.qtd)
        .slice(0, 5);
    },
    enabled: enabled && !!adminId,
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
  });
};


// ─── ONDA 4: Gráfico mensal ───────────────────────────────────────────────────
export const useFaturamentoMensalDashboard = (adminId: string, enabled: boolean) => {
  const now = new Date();

  // Últimos 12 meses completos em UTC
  const startDate = new Date(Date.UTC(now.getUTCFullYear() - 1, now.getUTCMonth(), 1)).toISOString();
  const endDate   = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999)).toISOString();

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard_faturamento_mensal', adminId, startDate],
    queryFn: async () => {
      const [pagamentos, atacado] = await Promise.all([
        supabase.from('pagamentos')
          .select('valor, data_pagamento, entregas!inner(vendedores!inner(administrador_id))')
          .eq('entregas.vendedores.administrador_id', adminId)
          .gte('data_pagamento', startDate)
          .lte('data_pagamento', endDate),
        supabase.from('vendas_atacado_pagamentos')
          .select('valor, created_at, vendas_atacado!inner(administrador_id)')
          .eq('vendas_atacado.administrador_id', adminId)
          .gte('created_at', startDate)
          .lte('created_at', endDate),
      ]);

      return [
        ...(pagamentos.data || []).map((p: any) => ({ valor: p.valor, data: p.data_pagamento })),
        ...(atacado.data    || []).map((p: any) => ({ valor: p.valor, data: p.created_at.split('T')[0] })),
      ];
    },
    enabled: enabled && !!adminId,
    staleTime: 0,
    refetchOnWindowFocus: false,
  });

  const chartData = useMemo(() => {
    const months = Array.from({ length: 12 }, (_, i) => {
      const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (11 - i), 1));
      return {
        month: d.toLocaleDateString('pt-BR', { month: 'short', timeZone: 'UTC' })
          .replace('.', '').replace(/^\w/, c => c.toUpperCase()),
        year:     d.getUTCFullYear(),
        monthNum: d.getUTCMonth(),
        value:    0,
        height:   0,
      };
    });

    data?.forEach((item: any) => {
      const d = new Date(item.data + (item.data.includes('T') ? '' : 'T00:00:00Z'));
      const idx = months.findIndex(m => m.monthNum === d.getUTCMonth() && m.year === d.getUTCFullYear());
      if (idx >= 0) months[idx].value += item.valor || 0;
    });

    const max = Math.max(...months.map(m => m.value), 1);
    return months.map(m => ({ ...m, height: (m.value / max) * 90 || 5 }));
  }, [data]);

  return { data: chartData, isLoading };
};


// ─── Hook principal ───────────────────────────────────────────────────────────
export const useDashboard = () => {
  const { adminId } = useAuth();
  const id = adminId || '';

  const core         = useDashboardCore(id);
  const wave2Enabled = !core.isLoading;

  const entregasHoje      = useEntregasHoje(id, wave2Enabled);
  const inadimplencia     = useInadimplenciaFaixas(id, wave2Enabled);
  const topVendedores     = useTopVendedoresDashboard(id, wave2Enabled);
  const topProdutos       = useTopProdutosDashboard(id, wave2Enabled);
  const estoqueAlerts     = useEstoqueAlertsDashboard(id, wave2Enabled);
  const faturamentoMensal = useFaturamentoMensalDashboard(id, !!id);

  const calcPercent = (atual: number, anterior: number) => {
    if (!anterior) return atual > 0 ? 100 : 0;
    return Math.round(((atual - anterior) / anterior) * 100);
  };

  const c = core.data;

  return {
    stats: {
      faturamentoAtual:      c?.faturamento_atual    || 0,
      faturamentoAnterior:   c?.faturamento_anterior || 0,
      valoresEmFalta:        c?.valores_em_falta     || 0,
      entregasAtual:         c?.entregas_atual       || 0,
      entregasAnterior:      c?.entregas_anterior    || 0,
      vendedoresAtivos:      c?.vendedores_ativos    || 0,
      percentualFaturamento: calcPercent(c?.faturamento_atual || 0, c?.faturamento_anterior || 0),
      percentualEntregas:    calcPercent(c?.entregas_atual    || 0, c?.entregas_anterior    || 0),
    },
    breakdown: {
      fatEntregas:          c?.breakdown?.fat_entregas_atual      || 0,
      fatAtacado:           c?.breakdown?.fat_atacado_atual       || 0,
      fatOrcamentos:        c?.breakdown?.fat_orcamentos_atual    || 0,
      fatOrcamentosAnt:     c?.breakdown?.fat_orcamentos_anterior || 0,
      qtdOrcamentos:        c?.breakdown?.qtd_orcamentos_atual    || 0,
      percentualOrcamentos: calcPercent(
        c?.breakdown?.fat_orcamentos_atual    || 0,
        c?.breakdown?.fat_orcamentos_anterior || 0,
      ),
    },
    entregasHoje:  entregasHoje.data?.total || 0,
    inadimplencia: inadimplencia.data       || null,
    vendedores:    topVendedores.data       || [],
    topProdutos:   topProdutos.data         || [],
    estoqueAlerts: estoqueAlerts.data       || [],
    charts: { faturamentoMensal: faturamentoMensal.data || [] },
    isLoading:   core.isLoading,
    someLoading: core.isLoading || entregasHoje.isLoading,
    loadingStates: {
      core:          core.isLoading,
      vendedores:    topVendedores.isLoading,
      topProdutos:   topProdutos.isLoading,
      estoque:       estoqueAlerts.isLoading,
      grafico:       faturamentoMensal.isLoading,
      inadimplencia: inadimplencia.isLoading,
      entregasHoje:  entregasHoje.isLoading,
    },
  };
};


// ─── Exports legados ──────────────────────────────────────────────────────────
export { useDashboardCore as useDashboardSummary };


export const useTotalVendasPorVendedor = (vendedorId: string, options?: { enabled?: boolean }) => {
  return useQuery({
    queryKey: ['TOTAL_VENDAS_VENDEDOR', vendedorId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('entregas').select('valor')
        .eq('vendedor_id', vendedorId);
      if (error) throw error;
      return {
        total: data?.reduce((acc, curr) => acc + (curr.valor || 0), 0) || 0,
        count: data?.length || 0,
      };
    },
    enabled: options?.enabled && !!vendedorId,
    staleTime: 1000 * 60 * 5,
  });
};


export const useTotalEntregasPorAdministrador = (administrador_id: string, options?: { enabled?: boolean }) => {
  return useQuery({
    queryKey: ['TOTAL_ENTREGAS_POR_ADMINISTRADOR', administrador_id],
    queryFn: async () => {
      const [entregasResult, vendasResult] = await Promise.all([
        supabase.from('entregas')
          .select('vendedor_id, vendedores!inner(administrador_id)')
          .eq('vendedores.administrador_id', administrador_id),
        supabase.from('vendas_atacado')
          .select('vendedor_id')
          .eq('administrador_id', administrador_id),
      ]);

      if (entregasResult.error) throw entregasResult.error;
      if (vendasResult.error)   throw vendasResult.error;

      const map: Record<string, number> = {};
      entregasResult.data?.forEach((e: any) => {
        if (e.vendedor_id) map[e.vendedor_id] = (map[e.vendedor_id] || 0) + 1;
      });
      vendasResult.data?.forEach((v: any) => {
        if (v.vendedor_id) map[v.vendedor_id] = (map[v.vendedor_id] || 0) + 1;
      });

      return map;
    },
    enabled: options?.enabled && !!administrador_id,
    staleTime: 1000 * 60 * 15,
  });
};


export type { };

