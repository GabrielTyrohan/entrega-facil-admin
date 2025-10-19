import { useState } from 'react';
import { supabase } from '../lib/supabase';
import type { SuporteSolicitacao } from '../lib/supabase';

interface FormularioSuporte {
  tipo: 'bug' | 'feature' | 'support' | 'other';
  urgencia: 'baixa' | 'media' | 'alta';
  assunto: string;
  descricao: string;
}

export const useSuporteSolicitacoes = () => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const enviarSolicitacao = async (
    dados: FormularioSuporte,
    administrador: { id: string; nome: string; email: string }
  ): Promise<SuporteSolicitacao | null> => {
    setIsSubmitting(true);
    setError(null);

    try {
      // Verificar se o usuário está autenticado
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (authError || !user) {
        throw new Error('Usuário não autenticado. Faça login novamente.');
      }

      // Mapear tipos do formulário para banco
      const tipoMap: Record<string, SuporteSolicitacao['tipo']> = {
        bug: 'bug',
        feature: 'feature',
        support: 'duvida',
        other: 'outro',
      };

      const dadosParaInserir = {
        administrador_id: user.id, // Usar o ID do usuário autenticado do Supabase
        nome_contato: administrador.nome,
        email_contato: administrador.email,
        telefone_contato: null, // Campo obrigatório na tabela
        tipo: tipoMap[dados.tipo] || 'outro',
        urgencia: dados.urgencia,
        assunto: dados.assunto.trim(),
        descricao: dados.descricao.trim(),
        status: 'aberto' as const,
        sincronizado: false,
      };

      const { data, error: supabaseError } = await supabase
        .from('suporte_solicitacoes')
        .insert(dadosParaInserir)
        .select()
        .single();

      if (supabaseError) {
        console.error('Erro Supabase:', supabaseError);
        throw new Error(supabaseError.message);
      }

      return data as SuporteSolicitacao;
    } catch (err) {
      const mensagem = err instanceof Error ? err.message : 'Erro ao enviar solicitação';
      setError(mensagem);
      console.error('Erro ao enviar solicitação:', err);
      return null;
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    enviarSolicitacao,
    isSubmitting,
    error,
  };
};
