import { useAuth } from '@/contexts/AuthContext';
import { CACHE_KEYS } from '@/lib/constants/queryKeys';
import { supabase } from '@/lib/supabase';
import { nfeService } from '@/services/nfeService';
import { toast } from '@/utils/toast';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

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

  // Emitir NF-e via Edge Function (SEGURO)
  const emitirNFe = useMutation({
    mutationFn: ({ orcamentoId, clienteId }: { orcamentoId: string; clienteId?: string }) =>
      nfeService.emitirNFe(orcamentoId, clienteId),
    onSuccess: (data) => {
      toast.success(
        `NF-e ${data.nota.numero} emitida com sucesso! Chave: ${data.nota.chave_acesso}`,
        { duration: 8000 }
      );
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
