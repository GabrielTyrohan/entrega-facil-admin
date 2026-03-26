import { supabase } from '../lib/supabase';
import type { MovimentacaoEstoque } from '../types/estoque';

// ─────────────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────────────

export interface MovimentarEstoqueParams {
  adminId: string;
  produtoId: string;
  quantidade: number;
  tipoMovimentacao: MovimentacaoEstoque['tipo_movimentacao'];
  referenciaTipo?: MovimentacaoEstoque['referencia_tipo'];
  referenciaId?: string;
  usuarioId: string;
  usuarioTipo: 'admin' | 'funcionario' | 'vendedor';
  usuarioNome: string;
  motivo?: string;
  observacoes?: string;
  lote?: string;
  fornecedor?: string;
}

// ─────────────────────────────────────────────────────────────
// Função centralizada — insert em movimentacoes_estoque
// A TRIGGER no Supabase atualiza qtd_estoque automaticamente.
// NUNCA fazer UPDATE direto em produtos_cadastrado.qtd_estoque.
// ─────────────────────────────────────────────────────────────

export async function movimentarEstoque(params: MovimentarEstoqueParams): Promise<void> {
  const { error } = await supabase
    .from('movimentacoes_estoque')
    .insert({
      administrador_id: params.adminId,
      produto_cadastrado_id: params.produtoId,
      tipo_movimentacao: params.tipoMovimentacao,
      quantidade: params.quantidade,
      // Campos de auditoria de quem executou
      usuario_id: params.usuarioId,
      usuario_tipo: params.usuarioTipo,
      usuario_nome: params.usuarioNome,
      // Referência (cesta, entrega, etc.)
      referencia_tipo: params.referenciaTipo,
      referencia_id: params.referenciaId,
      // Campos opcionais
      motivo: params.motivo,
      observacoes: params.observacoes,
      lote: params.lote,
      fornecedor: params.fornecedor,
    })
    .select()
    .single();

  if (error) {
    // Tratar erro de estoque negativo (trigger pode rejeitar)
    const msg = error.message || '';
    if (msg.toLowerCase().includes('estoque') || msg.toLowerCase().includes('insuficiente') || msg.toLowerCase().includes('negativ')) {
      throw new Error(`Estoque insuficiente para realizar esta operação.`);
    }
    console.error('Erro ao registrar movimentação de estoque:', error);
    throw new Error(`Erro ao registrar movimentação de estoque: ${msg}`);
  }

  return;
}

// ─────────────────────────────────────────────────────────────
// Versão batch — múltiplos itens de uma vez
// ─────────────────────────────────────────────────────────────

export async function movimentarEstoqueBatch(
  itens: Array<{
    produtoId: string;
    quantidade: number;
  }>,
  base: Omit<MovimentarEstoqueParams, 'produtoId' | 'quantidade'>
): Promise<void> {
  for (const item of itens) {
    await movimentarEstoque({
      ...base,
      produtoId: item.produtoId,
      quantidade: item.quantidade,
    });
  }
}
