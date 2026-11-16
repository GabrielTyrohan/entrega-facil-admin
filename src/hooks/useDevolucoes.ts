import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

export const DEVOLUCOES_KEY = 'devolucoes';

export interface Devolucao {
  id: string;
  valor: number;
  data_entrega: string;
  devolvida_em: string | null;
  cliente: { id: string; nome: string; sobrenome: string | null } | null;
  vendedor: { id: string; nome: string } | null;
  cesta: string | null;
  /** Pagamentos que ficaram na entrega devolvida = crédito ainda não usado */
  credito_restante: number;
  /** Entregas que nasceram desta (troca) */
  trocas: { id: string; valor: number; data_entrega: string; credito_movido: number }[];
}

/**
 * Entregas devolvidas pelos vendedores (Fase 6b): o pago vira crédito do
 * cliente e, na troca, os pagamentos vão para a entrega nova.
 */
export function useDevolucoes() {
  const { adminId } = useAuth();
  return useQuery({
    queryKey: [DEVOLUCOES_KEY, adminId],
    enabled: !!adminId,
    queryFn: async (): Promise<Devolucao[]> => {
      const { data, error } = await supabase
        .from('entregas')
        .select(`
          id, valor, data_entrega, devolvida_em, updated_at,
          clientes ( id, nome, sobrenome ),
          vendedores!inner ( id, nome, administrador_id ),
          produtos ( nome ),
          pagamentos ( valor )
        `)
        .eq('status_entrega', 'devolução')
        .eq('vendedores.administrador_id', adminId!)
        .order('devolvida_em', { ascending: false, nullsFirst: false })
        .limit(300);
      if (error) throw error;

      const linhas = (data ?? []) as any[];
      const ids = linhas.map((l) => l.id);
      const trocasPorOrigem = new Map<string, Devolucao['trocas']>();
      if (ids.length > 0) {
        const { data: trocas, error: e2 } = await supabase
          .from('entregas')
          .select('id, valor, data_entrega, credito_movido, entrega_origem_id')
          .in('entrega_origem_id', ids);
        if (e2) throw e2;
        for (const t of (trocas ?? []) as any[]) {
          const l = trocasPorOrigem.get(t.entrega_origem_id) ?? [];
          l.push({ id: t.id, valor: Number(t.valor), data_entrega: t.data_entrega, credito_movido: Number(t.credito_movido) || 0 });
          trocasPorOrigem.set(t.entrega_origem_id, l);
        }
      }

      return linhas.map((l) => ({
        id: l.id,
        valor: Number(l.valor) || 0,
        data_entrega: l.data_entrega,
        devolvida_em: l.devolvida_em ?? l.updated_at ?? null,
        cliente: l.clientes ?? null,
        vendedor: l.vendedores ? { id: l.vendedores.id, nome: l.vendedores.nome } : null,
        cesta: l.produtos?.nome ?? null,
        credito_restante: Math.round(((l.pagamentos ?? []) as { valor: number }[])
          .reduce((a, p) => a + (Number(p.valor) || 0), 0) * 100) / 100,
        trocas: trocasPorOrigem.get(l.id) ?? [],
      }));
    },
  });
}
