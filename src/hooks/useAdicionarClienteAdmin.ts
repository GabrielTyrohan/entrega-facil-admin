import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { Cliente } from './useClientes';

export interface ClienteAdminInsert extends Omit<Cliente, 'id' | 'created_at' | 'updated_at' | 'vendedor' | 'vendedor_id'> {
  administrador_id: string;
  vendedor_id?: string; // Opcional, caso o backend exija ou preencha automaticamente
  pessoas_autorizadas?: string[]; // Lista de nomes
  responsaveis?: {
    nome: string;
    cpf: string;
    telefone: string;
    parentesco: string;
  }[];
}

export const useAdicionarClienteAdmin = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (novoCliente: ClienteAdminInsert) => {
      const { data, error } = await supabase
        .from('clientes')
        .insert(novoCliente)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clientes'] });
      // Invalidações adicionais para garantir consistência em outras listas
      queryClient.invalidateQueries({ queryKey: ['CLIENTES'] }); 
    },
    onError: (error: any) => {
      console.error('Erro ao adicionar cliente:', error);
      if (error?.message) {
        // toast.error(`Erro: ${error.message}`);
      }
      // O toast será exibido pelo componente que chama, ou podemos colocar aqui também
      // O padrão do useCreateCliente no useClientes.ts tem toast.error aqui.
      // O usuário pediu "Ao finalizar com sucesso: toast.success(...) e chame onClose()".
      // Vou deixar o toast de sucesso para o componente, mas o de erro pode ser útil aqui se for padrão.
      // Mas o user disse "Ao finalizar com sucesso: toast.success(...) e chame onClose() resetando o estado" NO COMPONENTE.
    }
  });
};
