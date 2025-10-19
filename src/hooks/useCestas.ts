import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export interface CestaData {
  id: string;
  vendedor_id: string;
  vendedor_nome: string;
  cesta_nome: string;
  data_montagem: string;
  status: 'em_uso' | 'entregue' | 'retornada';
  limite_maximo: number;
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
  const { user } = useAuth();

  return useQuery({
    queryKey: ['cestas', user?.id],
    queryFn: async (): Promise<CestaData[]> => {
      try {
        if (!user?.id) {
          throw new Error('Usuário não autenticado');
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
          .eq('vendedores.administrador_id', user.id)
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

            // Calcular totais
            // total_itens = quantidade de itens únicos (não quantidade total)
            const total_itens = itens.length;
            // valor_total = preço da tabela produtos (coluna preco)
            const valor_total = cesta.preco;

            return {
              id: cesta.id,
              vendedor_id: cesta.vendedor_id,
              vendedor_nome: (cesta.vendedores as any)?.nome || 'Vendedor não encontrado',
              cesta_nome: cesta.nome,
              data_montagem: cesta.created_at,
              status: cesta.ativo ? 'entregue' as const : 'retornada' as const,
              limite_maximo: 50, // Valor padrão, pode ser ajustado conforme necessário
              total_itens,
              valor_total,
              itens
            };
          })
        );

        // Filtrar cestas que falharam ao carregar
        return cestasComItens.filter(cesta => cesta !== null) as CestaData[];
      } catch {
        throw error;
      }
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000, // 5 minutos
    gcTime: 10 * 60 * 1000, // 10 minutos
  });
};
