// src/services/entregaCestaService.ts
// Registro de entrega de cestas via RPC segura `registrar_entrega_cestas_seguro`.
// O frontend envia SOMENTE dados de negócio (vendedor/cesta/quantidade/
// observação). Administrador, tenant, permissão e dados do usuário da
// sessão são derivados/validados no servidor — nenhum identificador de
// autoridade é enviado pelo navegador.
import { supabase } from '@/lib/supabase';

export interface RegistrarEntregaCestaInput {
  vendedorId: string;
  cestaId: string;
  quantidade: number;
  observacao?: string | null;
}

export interface RegistrarEntregaCestaResponse {
  success: boolean;
  id?: string;
  erro?: string;
  [key: string]: unknown;
}

export async function registrarEntregaCesta(
  input: RegistrarEntregaCestaInput,
): Promise<RegistrarEntregaCestaResponse> {
  if (!Number.isFinite(input.quantidade) || input.quantidade < 1) {
    throw new Error('Informe ao menos 1 cesta para registrar a entrega.');
  }

  const { data, error } = await supabase.rpc('registrar_entrega_cestas_seguro', {
    p_vendedor_id: input.vendedorId,
    p_cesta_id: input.cestaId,
    p_quantidade: input.quantidade,
    p_observacao:
      input.observacao && input.observacao.trim() ? input.observacao : null,
  });

  if (error) throw error;
  if (!data?.success) throw new Error(data?.erro || 'Erro ao registrar entrega.');
  return data;
}
