import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
  entregas_realizadas: number;
  quantidade_disponivel: number | null;
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
        const { data: entregasData, error: entregasQueryError } = await supabase
          .from('entregas_cestas_vendedor')
          .select('*') // Selecionar tudo para garantir que pegamos os campos certos
          .eq('administrador_id', adminId);
          
        if (entregasQueryError) {
           console.error('Erro ao buscar entregas (tabela entregas_cestas_vendedor):', entregasQueryError);
        }
          
        const entregasMap: Record<string, number> = {};
        if (entregasData) {
          entregasData.forEach((entrega: any) => {
            // Verificar se os campos existem
            const cestaId = entrega.cesta_id;
            // O campo de quantidade pode ser 'quantidade' ou 'qtd' ou 'quantidade_entregue'
            // Vamos tentar várias opções
            const qtd = entrega.quantidade || entrega.qtd || entrega.quantidade_cestas || 1; 
            
            if (cestaId) {
              entregasMap[cestaId] = (entregasMap[cestaId] || 0) + Number(qtd);
            }
          });
        }

        // Para cada cesta, buscar os itens + estoque_vendedor em paralelo
        const cestasComItens = await Promise.all(
          cestasData.map(async (cesta) => {
            // Buscar itens da cesta e estoque do vendedor em paralelo
            const [itensResult, estoqueResult] = await Promise.all([
              supabase
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
                .eq('cesta_id', cesta.id),
              supabase
                .from('estoque_vendedor')
                .select('quantidade_disponivel')
                .eq('vendedor_id', cesta.vendedor_id)
                .eq('produto_id', cesta.id)
                .maybeSingle()
            ]);

            if (itensResult.error) {
              return null;
            }

            const itens = itensResult.data?.map((item: any) => {
              const prodData = Array.isArray(item.produtos_cadastrado) 
                ? item.produtos_cadastrado[0] 
                : item.produtos_cadastrado;

              return {
                produto: {
                  id: prodData?.id,
                  produto_nome: prodData?.produto_nome,
                  produto_cod: prodData?.produto_cod,
                  categoria: prodData?.categoria,
                  qtd_estoque: prodData?.qtd_estoque,
                  preco_unt: prodData?.preco_unt,
                  descricao: undefined
                },
                quantidade: item.quantidade
              };
            }) || [];

            const quantidadeDisponivel: number | null =
              estoqueResult.data?.quantidade_disponivel ?? null;

            return {
              id: cesta.id,
              vendedor_id: cesta.vendedor_id,
              vendedor_nome: Array.isArray(cesta.vendedores)
                ? cesta.vendedores[0]?.nome || 'Desconhecido'
                : (cesta.vendedores as any)?.nome || 'Desconhecido',
              cesta_nome: cesta.nome,
              data_montagem: cesta.created_at,
              status: cesta.ativo ? 'em_uso' : 'retornada',
              total_itens: itens.length,
              valor_total: cesta.preco,
              entregas_realizadas: entregasMap[cesta.id] || 0,
              quantidade_disponivel: quantidadeDisponivel,
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

export const useCestaDetalhes = (cestaId: string, options?: { enabled?: boolean }) => {
  const { adminId } = useAuth();

  return useQuery({
    queryKey: [CACHE_KEYS.CESTAS, 'detalhes', cestaId],
    queryFn: async () => {
      // Buscar itens da cesta com dados do produto cadastrado (estoque)
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
        .eq('cesta_id', cestaId);

      if (itensError) throw itensError;

      const itens = itensData?.map((item: any) => {
        const prodData = Array.isArray(item.produtos_cadastrado) 
          ? item.produtos_cadastrado[0] 
          : item.produtos_cadastrado;

        return {
          produto: {
            id: prodData?.id,
            produto_nome: prodData?.produto_nome,
            produto_cod: prodData?.produto_cod,
            categoria: prodData?.categoria,
            qtd_estoque: prodData?.qtd_estoque,
            preco_unt: prodData?.preco_unt,
          },
          quantidade: item.quantidade
        };
      }) || [];

      return { itens };
    },
    enabled: options?.enabled && !!cestaId && !!adminId,
    staleTime: 0, // Sempre buscar dados frescos para estoque
  });
};

export const useEntregarCestas = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      administrador_id,
      vendedor_id,
      cesta_id,
      quantidade,
      usuario_id,
      usuario_nome,
      observacao,
    }: {
      administrador_id: string;
      vendedor_id: string;
      cesta_id: string;
      quantidade: number;
      usuario_id?: string;
      usuario_nome?: string;
      observacao?: string;
    }) => {
      const { data, error } = await supabase.rpc('registrar_entrega_cestas', {
        p_administrador_id: administrador_id,
        p_vendedor_id: vendedor_id,
        p_cesta_id: cesta_id,
        p_quantidade: quantidade,
        p_usuario_id: usuario_id || null,
        p_usuario_nome: usuario_nome || null,
        p_observacao: observacao || null,
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.erro);

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.CESTAS] });
      queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.PRODUTOS] });
      queryClient.invalidateQueries({ queryKey: ['movimentacoes_estoque'] });
    },
  });
};
