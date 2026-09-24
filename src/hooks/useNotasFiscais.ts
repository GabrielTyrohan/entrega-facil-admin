import { useAuth } from '@/contexts/AuthContext';
import { CACHE_KEYS } from '@/lib/constants/queryKeys';
import { supabase } from '@/lib/supabase';
import { nfeService, type EmitirNFeContoraResponse } from '@/services/nfeService';
import { toast } from '@/utils/toast';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

function isBuildConcluido(processamentoStatus?: string): boolean {
  if (!processamentoStatus) return false;
  const normalized = processamentoStatus.toLowerCase();
  return (
    normalized.includes('build') ||
    normalized.includes('conclu') ||
    normalized.includes('validado') ||
    normalized.includes('processado')
  );
}

function montarMensagemHomologacao(data: EmitirNFeContoraResponse): string {
  const base =
    'NF-e validada em homologação com sucesso. Nenhuma nota foi transmitida à SEFAZ.';
  const complemento = isBuildConcluido(data?.processamentoStatus)
    ? ' Estrutura fiscal validada pela Fiscal Contora.'
    : '';
  const reutilizado = data?.reused ? ' Rascunho existente reutilizado.' : '';
  return `${base}${complemento}${reutilizado}`;
}

export const useNotasFiscais = () => {
  const { adminId } = useAuth();
  const queryClient = useQueryClient();

  // Listar notas fiscais
  const { data: notasFiscais, isLoading } = useQuery({
    queryKey: [CACHE_KEYS.NOTAS_FISCAIS, adminId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notas_fiscais')
        .select('*, clientes(nome, sobrenome, cpf)')
        .eq('administrador_id', adminId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!adminId,
  });

  // Validar NF-e em homologação via Fiscal Contora (SEM transmissão à SEFAZ)
  const emitirNFe = useMutation({
    mutationFn: ({ orcamentoId, clienteId }: { orcamentoId: string; clienteId?: string }) =>
      nfeService.emitirNFe(orcamentoId, clienteId),
    onSuccess: (data) => {
      toast.success(montarMensagemHomologacao(data), { duration: 8000 });
      queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.NOTAS_FISCAIS] });
    },
    onError: (error: any) => {
      toast.error(`Erro: ${error.message}`);
    },
  });

  return {
    notasFiscais,
    isLoading,
    emitirNFe,
  };
};
