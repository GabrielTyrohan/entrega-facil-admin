import { EstoqueAtual } from '@/types/estoque';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

function calcPeriodoInicio(diaFechamento: number, hoje: Date): string {
  const dia = diaFechamento;
  const diaAtual = hoje.getDate();
  let ano = hoje.getFullYear();
  let mes = hoje.getMonth(); // 0-indexed

  if (diaAtual >= dia) {
    // Período atual começou no dia D deste mês
    return new Date(ano, mes, dia).toISOString().split('T')[0];
  } else {
    // Período atual começou no dia D do mês anterior
    const mesAnterior = mes - 1 < 0 ? 11 : mes - 1;
    const anoAnterior = mes - 1 < 0 ? ano - 1 : ano;
    return new Date(anoAnterior, mesAnterior, dia).toISOString().split('T')[0];
  }
}


// ─── Utilitário: detecta quando elemento entra na tela ───────────────────────
export const useIsVisible = () => {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);


  useEffect(() => {
    if (!ref.current) return;

    // Verifica imediatamente se já está visível
    const rect = ref.current.getBoundingClientRect();
    if (rect.top < window.innerHeight && rect.bottom > 0) {
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setIsVisible(true); },
      { threshold: 0.1, rootMargin: '200px' }
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);


  return { ref, isVisible };
};


// ─── Utilitário: soma campo de array ─────────────────────────────────────────
const soma = (arr: any[], field: string) =>
  arr?.reduce((s, i) => s + (Number(i[field]) || 0), 0) || 0;





// ─── ONDA 1: Core — cards principais ─────────────────────────────────────────
export const useDashboardCore = (adminId: string) => {
  const enabled = !!adminId;
  const now = new Date();

  // ✅ FIX: todos com .split('T')[0] para comparar com campos tipo date
  const firstDayCurrent  = new Date(now.getFullYear(), now.getMonth(),     1).toISOString().split('T')[0];
  const firstDayPrevious = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0];
  const lastDayPrevious  = new Date(now.getFullYear(), now.getMonth(),     0).toISOString().split('T')[0];

  // Chave de cache baseada em ano+mês (string curta e estável)
  const cacheKey = `${now.getFullYear()}-${now.getMonth()}`;

  return useQuery({
    queryKey: ['dashboard_core', adminId, cacheKey],
    queryFn: async () => {
      const { data: vendedores } = await supabase
        .from('vendedores')
        .select('id')
        .eq('administrador_id', adminId)
        .eq('ativo', true);

      const vendedorIds = vendedores?.map(v => v.id) || [];

      // Busca dia_fechamento diretamente da tabela (admin já tem acesso)
      const { data: vendedoresFechamento } = await supabase
        .from('vendedores')
        .select('id, dia_fechamento')
        .eq('administrador_id', adminId)
        .eq('ativo', true);

      // Usa a RPC que respeita o período de cada vendedor
      const [coreResult, orcamentosAtual, orcamentosAnterior, faltanteResult, faltanteAtacado] =
        await Promise.all([
          supabase.rpc('get_dashboard_core_por_periodo', { p_admin_id: adminId }),

          // Orçamentos PJ mantém mês calendário (não tem vendedor_id específico)
          supabase.from('orcamentos_pj').select('valor_total')
            .eq('administrador_id', adminId)
            .eq('status', 'convertido')
            .gte('data_orcamento', firstDayCurrent),

          supabase.from('orcamentos_pj').select('valor_total')
            .eq('administrador_id', adminId)
            .eq('status', 'convertido')
            .gte('data_orcamento', firstDayPrevious)
            .lte('data_orcamento', lastDayPrevious),

          // Inadimplência: mantém a lógica atual (não depende de período corrente)
          supabase.from('entregas').select('id, valor, vendedor_id, "dataRetorno", pagamentos(valor)')
            .in('vendedor_id', vendedorIds)
            .not('dataRetorno', 'is', null),

          supabase.from('vendas_atacado')
            .select('valor_total, valor_pago')
            .eq('administrador_id', adminId)
            .in('status_pagamento', ['pendente', 'parcial', 'atrasado']),
        ]);

      const core: any = Array.isArray(coreResult.data) ? coreResult.data[0] : coreResult.data;

      const fat_orcamentos_atual    = soma(orcamentosAtual.data    || [], 'valor_total');
      const fat_orcamentos_anterior = soma(orcamentosAnterior.data || [], 'valor_total');
      const qtd_orcamentos_atual    = orcamentosAtual.data?.length || 0;

      const menorDiaFechamento = Math.min(
        ...(vendedoresFechamento || []).map((v: any) => v.dia_fechamento ?? 1)
      );
      const corteGlobal = calcPeriodoInicio(menorDiaFechamento, now);

      let valores_em_falta = 0;
      faltanteResult.data?.forEach((e: any) => {
        if (e.dataRetorno >= corteGlobal) return;

        const pago = e.pagamentos?.reduce((s: number, p: any) => s + (p.valor || 0), 0) || 0;
        const debito = (e.valor || 0) - pago;
        if (debito > 0.01) valores_em_falta += debito;
      });
      faltanteAtacado.data?.forEach((v: any) => {
        const debito = (Number(v.valor_total) || 0) - (Number(v.valor_pago) || 0);
        if (debito > 0.01) valores_em_falta += debito;
      });

      return {
        vendedores_ativos:   vendedorIds.length,
        faturamento_atual:   (core?.faturamento_atual   || 0) + fat_orcamentos_atual,
        faturamento_anterior:(core?.faturamento_anterior || 0) + fat_orcamentos_anterior,
        entregas_atual:      core?.entregas_atual        || 0,
        entregas_anterior:   core?.entregas_anterior     || 0,
        valores_em_falta,
        periodo_inicio:      core?.periodo_inicio        || null,
        periodo_fim:         core?.periodo_fim           || null,
        breakdown: {
          fat_entregas_atual:   core?.faturamento_atual   || 0,
          fat_atacado_atual:    0, // já incluso no core
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

      const { data: vendedoresFechamento } = await supabase
        .from('vendedores')
        .select('id, dia_fechamento')
        .eq('administrador_id', adminId)
        .eq('ativo', true);

      const vendedorIds = (vendedoresFechamento || []).map((v: any) => v.id);

      const menorDiaFechamento = Math.min(
        ...(vendedoresFechamento || []).map((v: any) => v.dia_fechamento ?? 1)
      );
      const corteGlobal = calcPeriodoInicio(menorDiaFechamento, now);

      const { data, error } = await supabase
        .from('entregas')
        .select('id, valor, vendedor_id, "dataRetorno", pagamentos(valor)')
        .in('vendedor_id', vendedorIds)
        .not('dataRetorno', 'is', null);

      if (error) throw error;

      const faixas = { ate30: 0, de30a60: 0, de60a90: 0, acima90: 0 };
      const totais = { ate30: 0, de30a60: 0, de60a90: 0, acima90: 0 };

      data?.forEach((e: any) => {
        if (e.dataRetorno >= corteGlobal) return;

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
  const cacheKey = `${new Date().getUTCFullYear()}-${new Date().getUTCMonth()}`;


  return useQuery({
    queryKey: ['dashboard_top_vendedores', adminId, cacheKey],
    queryFn: async () => {
      const { data, error } = await supabase
        .rpc('get_top_vendedores_por_periodo', { p_admin_id: adminId });

      if (error) throw error;
      return (data || []).map((v: any) => ({
        id:       v.vendedor_id,
        nome:     v.nome,
        total:    Number(v.faturamento)    || 0,
        entregas: Number(v.total_entregas) || 0,
      }));
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
  const cacheKey = `${new Date().getUTCFullYear()}-${new Date().getUTCMonth()}`;

  return useQuery({
    queryKey: ['dashboard_top_produtos', adminId, cacheKey],
    queryFn: async () => {
      // Filtra por período correto via v_periodos_ativos (dia_fechamento)
      const { data, error } = await supabase
        .rpc('get_top_produtos_por_periodo', { p_admin_id: adminId });

      if (error) throw error;

      return (data || []).map((v: any) => ({
        id:      v.produto_id,
        nome:    v.nome,
        unidade: v.unidade,
        qtd:     Number(v.qtd) || 0,
      }));
    },
    enabled: enabled && !!adminId,
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
  });
};


// ─── ONDA 4: Gráfico mensal (por períodos de fechamento) ──────────────────────
export const useFaturamentoMensalDashboard = (adminId: string, enabled: boolean) => {
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard_faturamento_mensal', adminId],
    queryFn: async () => {
      const { data, error } = await supabase
        .rpc('get_faturamento_12_periodos_por_admin', {
          p_admin_id: adminId,
        });

      if (error) throw error;
      return data ?? [];
    },
    enabled: enabled && !!adminId,
    staleTime: 0,
    refetchOnWindowFocus: false,
  });

  const chartData = useMemo(() => {
    if (!data || data.length === 0) return [];

    const maxValor = Math.max(...data.map((d: any) => Number(d.valor) || 0), 1);

    return data.map((d: any) => ({
      month:  d.label,
      value:  Number(d.valor) || 0,
      height: Math.max(Math.round((Number(d.valor) / maxValor) * 100), 2),
    }));
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
  const vendedoresTipo    = useVendedoresPorTipo(id, wave2Enabled);


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
      periodoInicio:         c?.periodo_inicio       || null,
      periodoFim:            c?.periodo_fim          || null,
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
    vendedoresPorTipo: vendedoresTipo.data  || null,
    isLoading:   core.isLoading,
    someLoading: core.isLoading || entregasHoje.isLoading,
    loadingStates: {
      core:              core.isLoading,
      vendedores:        topVendedores.isLoading,
      topProdutos:       topProdutos.isLoading,
      estoque:           estoqueAlerts.isLoading,
      grafico:           faturamentoMensal.isLoading,
      inadimplencia:     inadimplencia.isLoading,
      entregasHoje:      entregasHoje.isLoading,
      vendedoresTipo:    vendedoresTipo.isLoading,
    },
  };
};


// ─── ONDA 2: Resumo de vendedores por tipo de vínculo ─────────────────────────
export const useVendedoresPorTipo = (adminId: string, enabled: boolean) => {
  return useQuery({
    queryKey: ['dashboard_vendedores_tipo', adminId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vendedores')
        .select('tipo_vinculo, status_pagamento_vendedor')
        .eq('administrador_id', adminId)
        .eq('ativo', true);

      if (error) throw error;

      let representados = 0;
      let autonomos = 0;
      let autonomosPendentes = 0;

      (data || []).forEach((v: any) => {
        if (v.tipo_vinculo === 'autonomo') {
          autonomos++;
          if (v.status_pagamento_vendedor === 'pendente') autonomosPendentes++;
        } else {
          // null ou 'representado' → representado
          representados++;
        }
      });

      return { representados, autonomos, autonomosPendentes };
    },
    enabled: enabled && !!adminId,
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
  });
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
