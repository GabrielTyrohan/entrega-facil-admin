import { useAuth } from '@/contexts/AuthContext';
import { CACHE_KEYS } from '@/lib/constants/queryKeys';
import { supabase } from '@/lib/supabase';
import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

// Quando uma tabela muda no banco (inclusive pelo app do vendedor), estas consultas ficam
// desatualizadas e são buscadas de novo se a tela estiver aberta.
// Só entram tabelas que estão na publicação `supabase_realtime` (conferido em 2026-11-18):
// entregas, entregas_cestas_vendedor, pagamentos, movimentacoes_estoque, estoque_vendedor,
// acertos_diarios e lancamentos_caixa. (pedidos_vendedor tem canal próprio em usePedidosVendedor.)
// O Supabase só envia eventos de linhas que o usuário pode ler (RLS).
const INICIO_VENDAS = [
  'dashboard_core',
  'dashboard_entregas_hoje',
  'dashboard_faturamento_mensal',
  'dashboard_top_vendedores',
  'dashboard_top_produtos',
  'dashboard_inadimplencia',
];
const ESTOQUE_GERAL = [
  CACHE_KEYS.VIEW_ESTOQUE_ATUAL,
  'view_estoque_atual_modal',
  'view_estoque_atual_emitir',
  'estoque_atual',
  CACHE_KEYS.MOVIMENTACOES_ESTOQUE,
  CACHE_KEYS.PRODUTOS,
  'dashboard_estoque_alerts',
];

export const TABLE_QUERY_MAP: Record<string, string[]> = {
  entregas: [
    ...INICIO_VENDAS,
    CACHE_KEYS.ENTREGAS,
    'entregas_all',
    CACHE_KEYS.DEVEDORES,
    CACHE_KEYS.CLIENTES,
  ],
  pagamentos: [
    ...INICIO_VENDAS,
    CACHE_KEYS.PAGAMENTOS,
    'pagamentos_all',
    CACHE_KEYS.ENTREGAS,
    'entregas_all',
    CACHE_KEYS.DEVEDORES,
    CACHE_KEYS.CLIENTES,
  ],
  entregas_cestas_vendedor: [
    'dashboard_core',
    'dashboard_top_produtos',
    'dashboard_faturamento_mensal',
    CACHE_KEYS.CESTAS,
    'estoque_vendedor',
    'entregas_avulsas_historico',
    ...ESTOQUE_GERAL,
  ],
  movimentacoes_estoque: ESTOQUE_GERAL,
  estoque_vendedor: [CACHE_KEYS.CESTAS, 'estoque_vendedor', 'dashboard_estoque_alerts'],
  acertos_diarios: [CACHE_KEYS.ACERTOS_DIARIOS],
  lancamentos_caixa: [CACHE_KEYS.FLUXO_CAIXA, 'fluxo-caixa', 'fluxo-caixa-stats', 'lancamentos_caixa', CACHE_KEYS.FLUXO_CAIXA_STATS],
};

// Várias mudanças seguidas (ex.: uma entrega com 10 itens) viram uma atualização só.
const ESPERA_MS = 800;

function criarInvalidador(queryClient: QueryClient) {
  const pendentes = new Set<string>();
  let timer: ReturnType<typeof setTimeout> | null = null;
  const disparar = () => {
    timer = null;
    const chaves = new Set(pendentes);
    pendentes.clear();
    queryClient.invalidateQueries({
      predicate: (q) => typeof q.queryKey[0] === 'string' && chaves.has(q.queryKey[0] as string),
    });
  };
  return {
    agendar(tabela: string) {
      (TABLE_QUERY_MAP[tabela] ?? []).forEach((k) => pendentes.add(k));
      if (!timer) timer = setTimeout(disparar, ESPERA_MS);
    },
    cancelar() {
      if (timer) clearTimeout(timer);
      timer = null;
      pendentes.clear();
    },
  };
}

export const useRealtimeInvalidator = () => {
  const queryClient = useQueryClient();
  const { adminId } = useAuth();

  useEffect(() => {
    if (!adminId) return;

    const invalidador = criarInvalidador(queryClient);
    let channel = supabase.channel(`dados-realtime-${adminId}`);
    for (const tabela of Object.keys(TABLE_QUERY_MAP)) {
      channel = channel.on('postgres_changes', { event: '*', schema: 'public', table: tabela }, () =>
        invalidador.agendar(tabela)
      );
    }
    channel.subscribe();

    return () => {
      invalidador.cancelar();
      supabase.removeChannel(channel);
    };
  }, [adminId, queryClient]);
};
