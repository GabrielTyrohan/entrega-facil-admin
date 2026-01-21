import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { CACHE_KEYS, CACHE_TIMES } from '../lib/supabaseCache';

export interface CestaData {
  id: string;
  vendedor_id: string;
  vendedor_nome: string;
  cesta_nome: string;
  data_montagem: string;
  status: 'em_uso' | 'entregue' | 'retornada';
  total_itens: number;
  valor_total: number;
  itens: Array<{
    produto: {
      id: string;
      produto_nome: string;
      produto_cod: string;
      categoria: string;
      qtd_estoque: number;
      preco_unt: number;
      descricao?: string;
    };
    quantidade: number;
  }>;
}

export const useCestas = () => {
  const { user, adminId } = useAuth();

  return useQuery({
    queryKey: [CACHE_KEYS.CESTAS, adminId],
    queryFn: async (): Promise<CestaData[]> => {
      try {
        if (!adminId) {
          return [];
        }

        // Buscar cestas (produtos que são cestas) com informações do vendedor
        const { data: cestasData, error: cestasError } = await supabase
          .from('produtos')
          .select(`
            id,
            nome,
            preco,
            created_at,
            ativo,
            vendedor_id,
            vendedores!inner (
              id,
              nome,
              administrador_id
            )
          `)
          .eq('vendedores.administrador_id', adminId)
          .order('created_at', { ascending: false });

        if (cestasError) {
          throw new Error('Erro ao carregar cestas');
        }

        if (!cestasData || cestasData.length === 0) {
          return [];
        }

        // Para cada cesta, buscar os itens
        const cestasComItens = await Promise.all(
          cestasData.map(async (cesta) => {
            // Buscar itens da cesta
            const { data: itensData, error: itensError } = await supabase
              .from('produtos_na_cesta')
              .select(`
                quantidade,
                produtos_cadastrado!inner (
                  id,
                  produto_nome,
                  produto_cod,
                  categoria,
                  qtd_estoque,
                  preco_unt
                )
              `)
              .eq('cesta_id', cesta.id);

            if (itensError) {
              return null;
            }

            const itens = itensData?.map((item: any) => ({
              produto: {
                id: item.produtos_cadastrado?.id,
                produto_nome: item.produtos_cadastrado?.produto_nome,
                produto_cod: item.produtos_cadastrado?.produto_cod,
                categoria: item.produtos_cadastrado?.categoria,
                qtd_estoque: item.produtos_cadastrado?.qtd_estoque,
                preco_unt: item.produtos_cadastrado?.preco_unt,
                descricao: undefined // Campo não existe na tabela
              },
              quantidade: item.quantidade
            })) || [];

            return {
              id: cesta.id,
              vendedor_id: cesta.vendedor_id,
              vendedor_nome: Array.isArray(cesta.vendedores) 
                ? cesta.vendedores[0]?.nome || 'Desconhecido' 
                : (cesta.vendedores as any)?.nome || 'Desconhecido',
              cesta_nome: cesta.nome,
              data_montagem: cesta.created_at,
              status: cesta.ativo ? 'em_uso' : 'retornada', // Mapeamento simplificado
              total_itens: itens.length,
              valor_total: cesta.preco,
              itens
            } as CestaData;
          })
        );

        return cestasComItens.filter(Boolean) as CestaData[];
      } catch (error) {
        console.error('Erro no useCestas:', error);
        throw error;
      }
    },
    enabled: !!user?.id,
    staleTime: CACHE_TIMES.CESTAS.staleTime,
    gcTime: CACHE_TIMES.CESTAS.gcTime
  });
};

export const useListaCestas = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['lista-cestas-simples', user?.id],
    queryFn: async () => {
      if (!user?.id) throw new Error('Usuário não autenticado');

      const { data, error } = await supabase
        .from('produtos')
        .select(`
          id,
          nome,
          preco,
          vendedores!inner (
            administrador_id
          )
        `)
        .eq('vendedores.administrador_id', user.id)
        .eq('ativo', true)
        .order('nome');

      if (error) throw error;
      
      return data.map(item => ({
        id: item.id,
        nome: item.nome,
        preco: item.preco
      }));
    },
    enabled: !!user?.id
  });
};
