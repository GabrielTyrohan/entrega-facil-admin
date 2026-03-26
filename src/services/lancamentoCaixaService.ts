import { addMonths, format } from 'date-fns';
import { supabase } from '@/lib/supabase';

interface NovoLancamento {
  administrador_id: string;
  tipo: 'entrada' | 'saida';
  categoria: string;
  descricao: string;
  valor: number;
  data_lancamento: string;
  data_vencimento?: string;
  forma_pagamento?: string;
  status?: string;
}

export async function criarLancamentoSimples(dados: NovoLancamento) {
  const { error } = await supabase
    .from('lancamentos_caixa')
    .insert({ ...dados, recorrente: false, total_parcelas: 1, parcela_atual: 1 });

  if (error) throw error;
}

export async function criarLancamentoRecorrente(dados: NovoLancamento, parcelas: number) {
  const grupoParcela = crypto.randomUUID();

  const registros = Array.from({ length: parcelas }, (_, i) => {
    const dataBase = new Date(dados.data_lancamento + 'T12:00:00');
    const dataParc = addMonths(dataBase, i);
    const dataStr  = format(dataParc, 'yyyy-MM-dd');

    return {
      ...dados,
      data_lancamento: dataStr,
      data_vencimento: dataStr,
      descricao: `${dados.descricao} (${i + 1}/${parcelas})`,
      status: 'pendente',
      recorrente: true,
      total_parcelas: parcelas,
      parcela_atual: i + 1,
      grupo_parcela_id: grupoParcela,
    };
  });

  const { error } = await supabase
    .from('lancamentos_caixa')
    .insert(registros);

  if (error) throw error;
}
