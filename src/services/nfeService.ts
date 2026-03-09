import { supabase } from '@/lib/supabase';

export const nfeService = {
  async emitirNFe(orcamentoId: string, clienteId?: string) {
    // 1. Pegar sessão e token
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError || !session?.access_token) {
      throw new Error('Sessão expirada. Faça login novamente.');
    }


    try {
      // 2. Usar fetch direto — garante que o Authorization chega na Edge Function
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      const response = await fetch(`${supabaseUrl}/functions/v1/emitir-nfe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': supabaseAnonKey,
        },
        body: JSON.stringify({ orcamentoId, clienteId }),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('❌ Erro da Edge Function:', data);
        throw new Error(data?.error || `Erro ${response.status} ao emitir NF-e`);
      }

      if (!data?.success) {
        const errorMsg = data?.error || 'Erro desconhecido ao emitir NF-e';
        console.error('❌ Erro retornado (success=false):', errorMsg);
        throw new Error(errorMsg);
      }

      return data;

    } catch (err: any) {
      console.error('❌ Exceção capturada no serviço:', err);
      throw err;
    }
  },
};
