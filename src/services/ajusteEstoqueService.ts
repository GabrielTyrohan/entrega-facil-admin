// src/services/ajusteEstoqueService.ts
// Ajuste MANUAL de estoque via RPC segura `registrar_ajuste_estoque_seguro`.
// O frontend envia SOMENTE dados de negócio (produto/tipo/quantidade/motivo
// e opcionais). Administrador, usuário da sessão e quantidades anterior/nova
// são derivados no servidor — nenhum identificador de autoridade é enviado.
// Tipos de outros fluxos (compra, venda, transferência, devolução de venda)
// NÃO são aceitos no ajuste manual.
import { supabase } from '@/lib/supabase';

export type TipoAjusteManual =
  | 'entrada_ajuste'
  | 'saida_ajuste'
  | 'saida_perda'
  | 'entrada_devolucao';

export interface RegistrarAjusteEstoqueInput {
  produtoId: string;
  tipoMovimentacao: TipoAjusteManual;
  quantidade: number;
  motivo: string;
  observacoes?: string | null;
  lote?: string | null;
  fornecedor?: string | null;
}

export interface RegistrarAjusteEstoqueResponse {
  success: boolean;
  [key: string]: unknown;
}

function normalizarOpcional(valor: string | null | undefined): string | null {
  return valor && valor.trim() ? valor : null;
}

export async function registrarAjusteEstoqueSeguro(
  input: RegistrarAjusteEstoqueInput,
): Promise<RegistrarAjusteEstoqueResponse> {
  // Validações de UX (o backend também valida; não confiar só nestas).
  if (!input.produtoId) throw new Error('Selecione um produto');
  if (!Number.isFinite(input.quantidade) || input.quantidade <= 0) {
    throw new Error('Quantidade inválida');
  }
  if (!input.motivo || !input.motivo.trim()) throw new Error('Informe o motivo');

  const { data, error } = await supabase.rpc('registrar_ajuste_estoque_seguro', {
    p_produto_id: input.produtoId,
    p_tipo_movimentacao: input.tipoMovimentacao,
    p_quantidade: input.quantidade,
    p_motivo: input.motivo,
    p_observacoes: normalizarOpcional(input.observacoes),
    p_lote: normalizarOpcional(input.lote),
    p_fornecedor: normalizarOpcional(input.fornecedor),
  });

  if (error) throw error;
  if (data && typeof data === 'object' && 'success' in data && !data.success) {
    throw new Error('Erro ao registrar ajuste');
  }
  return (data ?? { success: true }) as RegistrarAjusteEstoqueResponse;
}
