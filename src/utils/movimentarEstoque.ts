// src/utils/movimentarEstoque.ts

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
// Busca o estoque atual do produto diretamente de produtos_cadastrado
// ─────────────────────────────────────────────────────────────

async function buscarEstoqueAtual(produtoId: string, adminId: string): Promise<number> {
  const { data, error } = await supabase
    .from('produtos_cadastrado')
    .select('qtd_estoque')
    .eq('id', produtoId)
    .eq('administrador_id', adminId)
    .maybeSingle();

  if (error) throw error;
  return Number(data?.qtd_estoque ?? 0);
}

// ─────────────────────────────────────────────────────────────
// Função centralizada — INSERT em movimentacoes_estoque.
// A TRIGGER no Supabase atualiza qtd_estoque automaticamente.
// NUNCA fazer UPDATE direto em produtos_cadastrado.qtd_estoque.
// ─────────────────────────────────────────────────────────────

export async function movimentarEstoque(params: MovimentarEstoqueParams): Promise<void> {
  // ✅ Busca estoque ANTES do INSERT para gravar quantidade_anterior e quantidade_nova
  // corretamente no histórico — a trigger cuida do UPDATE no produto depois
  const quantidadeAnterior = await buscarEstoqueAtual(params.produtoId, params.adminId);
  const isEntrada = params.tipoMovimentacao.startsWith('entrada');
  const quantidadeNova = isEntrada
    ? quantidadeAnterior + params.quantidade
    : quantidadeAnterior - params.quantidade;

  const { error } = await supabase
    .from('movimentacoes_estoque')
    .insert({
      administrador_id:      params.adminId,
      produto_cadastrado_id: params.produtoId,
      tipo_movimentacao:     params.tipoMovimentacao,
      quantidade:            params.quantidade,
      quantidade_anterior:   quantidadeAnterior,
      quantidade_nova:       quantidadeNova,
      // Auditoria
      usuario_id:   params.usuarioId,
      usuario_tipo: params.usuarioTipo,
      usuario_nome: params.usuarioNome,
      // Referência
      referencia_tipo: params.referenciaTipo ?? null,
      referencia_id:   params.referenciaId ?? null,
      // Opcionais
      motivo:      params.motivo ?? null,
      observacoes: params.observacoes ?? null,
      lote:        params.lote ?? null,
      fornecedor:  params.fornecedor ?? null,
    })
    .select()
    .single();

  if (error) {
    const msg = error.message || '';
    if (
      msg.toLowerCase().includes('estoque') ||
      msg.toLowerCase().includes('insuficiente') ||
      msg.toLowerCase().includes('negativ')
    ) {
      throw new Error('Estoque insuficiente para realizar esta operação.');
    }
    console.error('Erro ao registrar movimentação de estoque:', error);
    throw new Error(`Erro ao registrar movimentação de estoque: ${msg}`);
  }
}

// ─────────────────────────────────────────────────────────────
// Versão batch — múltiplos itens sequencialmente
// ─────────────────────────────────────────────────────────────

export async function movimentarEstoqueBatch(
  itens: Array<{ produtoId: string; quantidade: number }>,
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