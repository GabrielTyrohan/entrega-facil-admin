import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import {
  getPeriodoAtual,
  formatDateSQL,
  formatDateBR,
} from '@/utils/periodoFechamento';

export interface PeriodoVendedor {
  inicioStr: string;   // 'YYYY-MM-DD' para queries
  fimStr: string;
  exibicao: string;    // 'DD/MM a DD/MM' para UI
  loading: boolean;
  error: Error | null;
}

const EMPTY_PERIODO: PeriodoVendedor = {
  inicioStr: '',
  fimStr: '',
  exibicao: '',
  loading: false,
  error: null,
};

export function usePeriodoVendedor(vendedorId: string | null | undefined): PeriodoVendedor {
  const { data, isLoading, error } = useQuery({
    queryKey: ['periodo_vendedor', vendedorId],
    enabled: !!vendedorId,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      // 1. Tenta buscar da view v_periodos_ativos
      const { data: periodos } = await supabase
        .from('v_periodos_ativos')
        .select('periodo_inicio, periodo_fim')
        .eq('vendedor_id', vendedorId)
        .limit(1)
        .single();

      if (periodos?.periodo_inicio && periodos?.periodo_fim) {
        return {
          inicioStr: periodos.periodo_inicio as string,
          fimStr: periodos.periodo_fim as string,
        };
      }

      // 2. Fallback: busca dia_fechamento e calcula localmente
      const { data: vendedor } = await supabase
        .from('vendedores')
        .select('dia_fechamento')
        .eq('id', vendedorId)
        .single();

      const diaFechamento = vendedor?.dia_fechamento ?? 1;
      const { inicio, fim } = getPeriodoAtual(diaFechamento);

      return {
        inicioStr: formatDateSQL(inicio),
        fimStr: formatDateSQL(fim),
      };
    },
  });

  if (!vendedorId) return EMPTY_PERIODO;
  if (isLoading) return { ...EMPTY_PERIODO, loading: true };

  const inicioStr = data?.inicioStr ?? '';
  const fimStr = data?.fimStr ?? '';

  let exibicao = '';
  if (inicioStr && fimStr) {
    const ini = new Date(inicioStr + 'T12:00:00');
    const fim = new Date(fimStr + 'T12:00:00');
    exibicao = `${formatDateBR(ini)} a ${formatDateBR(fim)}`;
  }

  return {
    inicioStr,
    fimStr,
    exibicao,
    loading: false,
    error: error as Error | null,
  };
}
