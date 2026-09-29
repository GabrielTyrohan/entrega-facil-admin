// src/services/entregaAvulsaService.ts
// Entregas avulsas via RPCs seguras: criar/atualizar/excluir.
// O frontend envia SOMENTE dados de negócio (vendedor/itens/observação).
// Administrador, usuário da sessão, preços, tenant e movimentações de
// estoque são derivados no servidor — nada disso vem do navegador.
import { supabase } from '@/lib/supabase';

export interface EntregaAvulsaItemInput {
  produtoId: string;
  quantidade: number;
}

export interface CriarEntregaAvulsaInput {
  vendedorId: string;
  itens: EntregaAvulsaItemInput[];
  observacao?: string | null;
}

export interface AtualizarEntregaAvulsaInput {
  entregaId: string;
  itens: EntregaAvulsaItemInput[];
  observacao?: string | null;
}

export interface EntregaAvulsaResponse {
  success: boolean;
  id?: string;
  entregaId?: string;
  entrega_id?: string;
  [key: string]: unknown;
}

function normalizarObservacao(valor: string | null | undefined): string | null {
  return valor && valor.trim() ? valor : null;
}

function normalizarItens(
  itens: EntregaAvulsaItemInput[],
): Array<{ produtoId: string; quantidade: number }> {
  return itens.map((item) => ({
    produtoId: item.produtoId,
    quantidade: item.quantidade,
  }));
}

function validarItens(vendedorId: string, itens: EntregaAvulsaItemInput[]): void {
  if (!vendedorId) throw new Error('Selecione um vendedor.');
  if (!itens || itens.length === 0) throw new Error('Adicione pelo menos um produto.');
  for (const item of itens) {
    if (!item.produtoId) throw new Error('Produto inválido na entrega.');
    if (!Number.isFinite(item.quantidade) || item.quantidade <= 0) {
      throw new Error('Informe quantidades maiores que zero.');
    }
  }
}

function extrairId(data: unknown): string | null {
  if (!data) return null;
  if (typeof data === 'string') return data;
  if (typeof data === 'object') {
    const registro = data as Record<string, unknown>;
    for (const chave of ['id', 'entregaId', 'entrega_id']) {
      if (typeof registro[chave] === 'string' && (registro[chave] as string)) {
        return registro[chave] as string;
      }
    }
  }
  return null;
}

export async function criarEntregaAvulsaSegura(
  input: CriarEntregaAvulsaInput,
): Promise<{ id: string }> {
  validarItens(input.vendedorId, input.itens);

  const { data, error } = await supabase.rpc('criar_entrega_avulsa_segura', {
    p_vendedor_id: input.vendedorId,
    p_itens: normalizarItens(input.itens),
    p_observacao: normalizarObservacao(input.observacao),
  });

  if (error) throw error;
  const id = extrairId(data);
  if (!id) throw new Error('Erro ao criar entrega.');
  return { id };
}

export async function atualizarEntregaAvulsaSegura(
  input: AtualizarEntregaAvulsaInput,
): Promise<EntregaAvulsaResponse> {
  if (!input.entregaId) throw new Error('Entrega inválida.');
  if (!input.itens || input.itens.length === 0) {
    throw new Error('A entrega precisa ter pelo menos 1 produto.');
  }
  for (const item of input.itens) {
    if (!item.produtoId) throw new Error('Produto inválido na entrega.');
    if (!Number.isFinite(item.quantidade) || item.quantidade <= 0) {
      throw new Error('Informe quantidades maiores que zero.');
    }
  }

  const { data, error } = await supabase.rpc('atualizar_entrega_avulsa_segura', {
    p_entrega_id: input.entregaId,
    p_itens: normalizarItens(input.itens),
    p_observacao: normalizarObservacao(input.observacao),
  });

  if (error) throw error;
  return (data ?? { success: true }) as EntregaAvulsaResponse;
}

export async function excluirEntregaAvulsaSegura(entregaId: string): Promise<void> {
  if (!entregaId) throw new Error('Entrega inválida.');

  const { error } = await supabase.rpc('excluir_entrega_avulsa_segura', {
    p_entrega_id: entregaId,
  });

  if (error) throw error;
}
