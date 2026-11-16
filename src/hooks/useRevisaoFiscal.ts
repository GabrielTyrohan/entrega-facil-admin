import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { CACHE_KEYS } from '@/lib/constants/queryKeys';

export const REVISAO_FISCAL_KEY = 'revisao-fiscal';

export interface ProdutoFiscalLinha {
  id: string;
  produto_nome: string;
  ncm: string | null;
  cest: string | null;
  cfop_padrao: string | null;
  cst_icms: string | null;
  cst_pis: string | null;
  cst_cofins: string | null;
  origem_mercadoria: number | null;
  cst_ibscbs: string | null;
  cclasstrib: string | null;
  ibscbs_sugestao: 'cesta_basica' | 'padrao' | 'verificar' | 'manual' | null;
  fiscal_status: 'pendente_revisao' | 'em_revisao' | 'validado' | 'bloqueado' | null;
}

/** Campos que a revisão em lote pode mudar (string vazia = limpar). */
export type CamposFiscaisLote = Partial<Record<
  'ncm' | 'cest' | 'cfop_padrao' | 'cst_icms' | 'cst_pis' | 'aliquota_pis' | 'cst_cofins' | 'aliquota_cofins' | 'origem_mercadoria' | 'cst_ibscbs' | 'cclasstrib',
  string
>>;

export interface ResultadoLoteFiscal {
  atualizados: number;
  validados: number;
  erros: { id: string; nome: string; faltando: string[] }[];
}

/** Mesma regra do banco (fiscal_pendencias_produto), para mostrar na tela. */
export function pendenciasFiscais(p: ProdutoFiscalLinha): string[] {
  const d = (v: string | null) => (v ?? '').replace(/\D/g, '');
  const vazio = (v: string | null) => !(v ?? '').trim();
  const out: string[] = [];
  if (d(p.ncm).length !== 8) out.push('NCM');
  if (d(p.cfop_padrao).length !== 4) out.push('CFOP');
  if (vazio(p.cst_icms)) out.push('CSOSN');
  if (vazio(p.cst_pis)) out.push('PIS');
  if (vazio(p.cst_cofins)) out.push('COFINS');
  if (!p.cst_ibscbs) out.push('CST IBS/CBS');
  if (!p.cclasstrib) out.push('cClassTrib');
  return out;
}

/** Só envia os campos preenchidos no formulário do lote. */
export function camposPreenchidos(c: CamposFiscaisLote): CamposFiscaisLote {
  const out: CamposFiscaisLote = {};
  (Object.keys(c) as (keyof CamposFiscaisLote)[]).forEach((k) => {
    const v = c[k];
    if (v !== undefined && v.trim() !== '') out[k] = v.trim();
  });
  return out;
}

export function useProdutosRevisaoFiscal() {
  const { adminId } = useAuth();
  return useQuery({
    queryKey: [REVISAO_FISCAL_KEY, adminId],
    enabled: !!adminId,
    queryFn: async (): Promise<ProdutoFiscalLinha[]> => {
      const { data, error } = await supabase
        .from('produtos_cadastrado')
        .select('id, produto_nome, ncm, cest, cfop_padrao, cst_icms, cst_pis, cst_cofins, origem_mercadoria, cst_ibscbs, cclasstrib, ibscbs_sugestao, fiscal_status')
        .eq('administrador_id', adminId!)
        .eq('ativo', true)
        .order('produto_nome')
        .limit(5000);
      if (error) throw error;
      return (data ?? []) as ProdutoFiscalLinha[];
    },
  });
}

export function useAtualizarFiscalLote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { ids: string[]; campos: CamposFiscaisLote; validar: boolean }) => {
      const { data, error } = await supabase.rpc('atualizar_fiscal_lote', {
        p_ids: vars.ids,
        p_campos: vars.campos,
        p_validar: vars.validar,
      });
      if (error) throw error;
      return data as ResultadoLoteFiscal;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [REVISAO_FISCAL_KEY] });
      qc.invalidateQueries({ queryKey: [CACHE_KEYS.PRODUTOS] });
    },
  });
}
