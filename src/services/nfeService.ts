import { supabase } from '@/lib/supabase';

// =====================================================
// Fiscal Contora — Homologação (sem transmissão à SEFAZ)
// A antiga integração Nuvem Fiscal foi descontinuada e
// NÃO deve mais ser utilizada. Este serviço chama
// exclusivamente a Edge Function `emitir-nfe-contora`.
// =====================================================

export interface EmitirNFeContoraResponse {
  success: boolean;
  reused?: boolean;
  phase?: string;
  transmittedToSefaz?: boolean;
  notaFiscalId?: string;
  documentoId?: string;
  numero?: number;
  status?: string;
  processamentoStatus?: string;
  provedor?: string;
  ambiente?: string;
  [key: string]: unknown;
}

const CONTORA_FUNCTION = 'emitir-nfe-contora';

export const nfeService = {
  async emitirNFe(orcamentoId: string, clienteId?: string): Promise<EmitirNFeContoraResponse> {
    // 1. Pegar sessão e token
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError || !session?.access_token) {
      throw new Error('Sessão expirada. Faça login novamente.');
    }


    try {
      // 2. Usar fetch direto — garante que o Authorization chega na Edge Function
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      const response = await fetch(`${supabaseUrl}/functions/v1/${CONTORA_FUNCTION}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': supabaseAnonKey,
        },
        // NÃO enviar `authorize: true` nesta fase (somente build em homologação).
        body: JSON.stringify({ orcamentoId, clienteId }),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('❌ Erro da Edge Function (Fiscal Contora):', data);
        throw new Error(data?.error || `Erro ${response.status} ao validar NF-e em homologação`);
      }

      if (!data?.success) {
        const errorMsg = data?.error || 'Erro desconhecido ao validar NF-e em homologação';
        console.error('❌ Erro retornado (success=false):', errorMsg);
        throw new Error(errorMsg);
      }

      return data as EmitirNFeContoraResponse;

    } catch (err: any) {
      console.error('❌ Exceção capturada no serviço (Fiscal Contora):', err);
      throw err;
    }
  },
};
