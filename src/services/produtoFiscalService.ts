// src/services/produtoFiscalService.ts
// Revisão fiscal de produtos. O status é SEMPRE lido do campo `fiscal_status`
// do Supabase — nunca calculado no frontend. Mudanças de status passam
// SEMPRE pela RPC `definir_status_fiscal_produto`; o backend registra
// fiscal_validado_em / fiscal_validado_por. Nada é validado automaticamente.
import { supabase } from '@/lib/supabase';
import type { ProdutoCadastrado } from './produtoService';

export type FiscalStatus = 'pendente_revisao' | 'em_revisao' | 'validado' | 'bloqueado';

export const FISCAL_STATUS_LIST: FiscalStatus[] = [
  'pendente_revisao',
  'em_revisao',
  'validado',
  'bloqueado',
];

export const FISCAL_STATUS_LABEL: Record<FiscalStatus, string> = {
  pendente_revisao: 'Pendente de revisão',
  em_revisao: 'Em revisão',
  validado: 'Validado',
  bloqueado: 'Bloqueado',
};

// Produtos sem status definido no banco ainda precisam de revisão.
export function normalizarFiscalStatus(
  status: ProdutoCadastrado['fiscal_status'],
): FiscalStatus {
  if (status === 'em_revisao' || status === 'validado' || status === 'bloqueado') {
    return status;
  }
  return 'pendente_revisao';
}

export function filtrarProdutosPorStatusFiscal<T extends Pick<ProdutoCadastrado, 'fiscal_status'>>(
  produtos: T[],
  status: FiscalStatus | 'todos',
): T[] {
  if (status === 'todos') return produtos;
  return produtos.filter((p) => normalizarFiscalStatus(p.fiscal_status) === status);
}

export interface RequisitosValidacaoFiscal {
  ok: boolean;
  pendencias: string[];
}

// Campos básicos exigidos antes de permitir a validação. Na dúvida o produto
// permanece pendente — sem presumir tratamento tributário.
export function verificarRequisitosValidacao(
  produto: Pick<
    ProdutoCadastrado,
    'produto_nome' | 'categoria' | 'unidade_medida' | 'ncm' | 'cfop_padrao' | 'origem_mercadoria'
  >,
): RequisitosValidacaoFiscal {
  const pendencias: string[] = [];
  if (!produto.produto_nome?.trim()) pendencias.push('Nome do produto');
  if (!produto.categoria?.trim()) pendencias.push('Categoria');
  if (!produto.unidade_medida?.trim()) pendencias.push('Unidade de medida');
  if (!produto.ncm || produto.ncm.replace(/\D/g, '').length !== 8) {
    pendencias.push('NCM válido (8 dígitos)');
  }
  if (!produto.cfop_padrao?.trim()) pendencias.push('CFOP sugerido para a operação');
  if (
    produto.origem_mercadoria === undefined ||
    produto.origem_mercadoria === null ||
    !Number.isInteger(produto.origem_mercadoria) ||
    produto.origem_mercadoria < 0 ||
    produto.origem_mercadoria > 8
  ) {
    pendencias.push('Origem da mercadoria (0 a 8)');
  }
  return { ok: pendencias.length === 0, pendencias };
}

export async function alterarStatusFiscalProduto(
  produtoId: string,
  status: FiscalStatus,
): Promise<void> {
  if (!produtoId) throw new Error('Produto inválido para alteração fiscal.');
  const { error } = await supabase.rpc('definir_status_fiscal_produto', {
    p_produto_id: produtoId,
    p_status: status,
  });
  if (error) throw new Error(error.message || 'Erro ao alterar status fiscal.');
}
