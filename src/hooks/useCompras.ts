import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { CACHE_KEYS } from '@/lib/constants/queryKeys';

export const COMPRAS_KEY = 'compras';

export interface Compra {
  id: string;
  origem: 'manual' | 'xml' | 'contora';
  fornecedor_nome: string;
  fornecedor_cnpj: string | null;
  numero_nota: string | null;
  data_entrada: string;
  valor_total: number;
  criado_por_nome: string | null;
  created_at: string;
  itens: { id: string }[];
}

export interface ProdutoParaCompra {
  id: string;
  produto_nome: string;
  codigo_barras: string | null;
  unidade_medida: string | null;
  qtd_estoque: number | null;
  custo_compra: number | null;
}

export interface VinculoFornecedor {
  codigo_fornecedor: string;
  produto_cadastrado_id: string;
  fator_conversao: number;
}

export interface ItemCompraEnvio {
  produto_cadastrado_id: string;
  quantidade_nota: number;
  fator_conversao: number;
  valor_total: number;
  codigo_fornecedor?: string | null;
  ean?: string | null;
  ncm?: string | null;
  descricao_nota?: string | null;
  unidade_nota?: string | null;
}

export interface CompraEnvio {
  origem: 'manual' | 'xml';
  fornecedor_nome: string;
  fornecedor_cnpj?: string | null;
  numero_nota?: string | null;
  serie?: string | null;
  chave_acesso?: string | null;
  data_emissao?: string | null;
  data_entrada?: string | null;
  observacao?: string | null;
}

export function useCompras() {
  const { adminId } = useAuth();
  return useQuery({
    queryKey: [COMPRAS_KEY, adminId],
    enabled: !!adminId,
    queryFn: async (): Promise<Compra[]> => {
      const { data, error } = await supabase
        .from('compras')
        .select('id, origem, fornecedor_nome, fornecedor_cnpj, numero_nota, data_entrada, valor_total, criado_por_nome, created_at, itens:compras_itens(id)')
        .eq('administrador_id', adminId!)
        .order('data_entrada', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as unknown as Compra[];
    },
  });
}

export function useProdutosParaCompra() {
  const { adminId } = useAuth();
  return useQuery({
    queryKey: [COMPRAS_KEY, 'produtos', adminId],
    enabled: !!adminId,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<ProdutoParaCompra[]> => {
      const { data, error } = await supabase
        .from('produtos_cadastrado')
        .select('id, produto_nome, codigo_barras, unidade_medida, qtd_estoque, custo_compra')
        .eq('administrador_id', adminId!)
        .eq('ativo', true)
        .order('produto_nome')
        .limit(5000);
      if (error) throw error;
      return (data ?? []) as ProdutoParaCompra[];
    },
  });
}

/** Vínculos lembrados (código do fornecedor → produto) de um CNPJ. */
export async function buscarVinculosFornecedor(adminId: string, cnpj: string): Promise<VinculoFornecedor[]> {
  const { data, error } = await supabase
    .from('produtos_vinculo_fornecedor')
    .select('codigo_fornecedor, produto_cadastrado_id, fator_conversao')
    .eq('administrador_id', adminId)
    .eq('fornecedor_cnpj', cnpj);
  if (error) throw error;
  return ((data ?? []) as VinculoFornecedor[]).map((v) => ({ ...v, fator_conversao: Number(v.fator_conversao) }));
}

export function useRegistrarCompra() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { compra: CompraEnvio; itens: ItemCompraEnvio[] }) => {
      const { data, error } = await supabase.rpc('registrar_compra', {
        p_compra: vars.compra,
        p_itens: vars.itens,
      });
      if (error) throw error;
      return data as { id: string; itens: number; valor_total: number };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [COMPRAS_KEY] });
      queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.PRODUTOS] });
      queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.MOVIMENTACOES_ESTOQUE] });
      queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.VIEW_ESTOQUE_ATUAL] });
    },
  });
}
