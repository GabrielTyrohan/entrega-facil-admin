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
// O Supabase só envia eventos de linhas que o usuário pode ler (RLS); inclusões e alterações
// também são filtradas pela empresa (administrador_id) para não pesar no Realtime.
const INICIO_VENDAS = [
  'dashboard_core',
  'dashboard_entregas_hoje',
  'dashboard_faturamento_mensal',
  'dashboard_top_vendedores',
  'dashboard_top_produtos',
  'dashboard_inadimplencia',
];
// A lista de produtos (CACHE_KEYS.PRODUTOS) fica de fora: ela tem ~1 MB por empresa e era
// baixada inteira a cada movimentação. Agora só os produtos que mudaram são buscados de novo
// e trocados no cache (veja `atualizarProdutosNoCache`).
const ESTOQUE_GERAL = [
  CACHE_KEYS.VIEW_ESTOQUE_ATUAL,
  'view_estoque_atual_modal',
  'view_estoque_atual_emitir',
  'estoque_atual',
  CACHE_KEYS.MOVIMENTACOES_ESTOQUE,
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

type Linha = Record<string, unknown> & { id?: unknown };

// Troca os produtos que mudaram em qualquer formato guardado no cache: lista, lista dentro de
// `{ data, count }` (useSupabaseQuery) ou um produto só. Só os campos que a consulta já trazia
// são trocados, para uma consulta com poucas colunas continuar com poucas colunas.
function trocarProdutos(valor: unknown, novos: Map<string, Linha>): unknown {
  const trocar = (item: unknown): unknown => {
    if (!item || typeof item !== 'object') return item;
    const novo = novos.get(String((item as Linha).id));
    if (!novo) return item;
    const atualizado: Linha = { ...(item as Linha) };
    for (const campo of Object.keys(atualizado)) if (campo in novo) atualizado[campo] = novo[campo];
    return atualizado;
  };
  if (Array.isArray(valor)) return valor.map(trocar);
  if (valor && typeof valor === 'object') {
    const v = valor as Linha;
    if ('data' in v && !('id' in v)) return { ...v, data: trocarProdutos(v.data, novos) };
    return trocar(v);
  }
  return valor;
}

/** Busca só os produtos que mudaram e troca no cache. Se falhar, recarrega a lista. */
export async function atualizarProdutosNoCache(queryClient: QueryClient, ids: string[]): Promise<void> {
  const recarregarTudo = () => queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.PRODUTOS] });
  if (ids.length === 0) return void (await recarregarTudo());
  const { data, error } = await supabase.from('produtos_cadastrado').select('*').in('id', ids);
  if (error || !Array.isArray(data)) return void (await recarregarTudo());
  const novos = new Map<string, Linha>(data.map((p: Linha) => [String(p.id), p]));
  queryClient.setQueriesData({ queryKey: [CACHE_KEYS.PRODUTOS] }, (antigo: unknown) =>
    antigo === undefined ? antigo : trocarProdutos(antigo, novos)
  );
}

function criarInvalidador(queryClient: QueryClient) {
  const pendentes = new Set<string>();
  const produtosMudados = new Set<string>();
  let produtoSemId = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const disparar = () => {
    timer = null;
    const chaves = new Set(pendentes);
    pendentes.clear();
    // Sem o id do produto no evento não dá para saber qual mudou: recarrega a lista.
    const ids = produtoSemId ? [] : [...produtosMudados];
    const buscarProdutos = produtosMudados.size > 0 || produtoSemId;
    produtosMudados.clear();
    produtoSemId = false;
    if (chaves.size > 0) {
      queryClient.invalidateQueries({
        predicate: (q) => typeof q.queryKey[0] === 'string' && chaves.has(q.queryKey[0] as string),
      });
    }
    if (buscarProdutos) {
      atualizarProdutosNoCache(queryClient, ids).catch(() =>
        queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.PRODUTOS] })
      );
    }
  };
  return {
    agendar(tabela: string, registro?: Linha | null) {
      (TABLE_QUERY_MAP[tabela] ?? []).forEach((k) => pendentes.add(k));
      if (tabela === 'movimentacoes_estoque') {
        const id = registro?.produto_cadastrado_id;
        if (typeof id === 'string' && id) produtosMudados.add(id);
        else produtoSemId = true;
      }
      if (!timer) timer = setTimeout(disparar, ESPERA_MS);
    },
    cancelar() {
      if (timer) clearTimeout(timer);
      timer = null;
      pendentes.clear();
      produtosMudados.clear();
      produtoSemId = false;
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
      const aoMudar = (payload: { new?: Linha | null; old?: Linha | null }) =>
        invalidador.agendar(tabela, payload?.new && Object.keys(payload.new).length ? payload.new : payload?.old);
      // Inclusões e alterações só da empresa: o Realtime descarta as das outras antes de conferir
      // o RLS de cada tela aberta. Todas estas tabelas têm administrador_id (entregas e
      // pagamentos desde a migration 20261123150000). Exclusões não aceitam filtro no Supabase;
      // elas são raras, não passam pelo RLS e trazem só o id.
      for (const evento of ['INSERT', 'UPDATE'] as const) {
        channel = channel.on(
          'postgres_changes',
          { event: evento, schema: 'public', table: tabela, filter: `administrador_id=eq.${adminId}` },
          aoMudar
        );
      }
      channel = channel.on('postgres_changes', { event: 'DELETE', schema: 'public', table: tabela }, aoMudar);
    }
    channel.subscribe();

    return () => {
      invalidador.cancelar();
      supabase.removeChannel(channel);
    };
  }, [adminId, queryClient]);
};
