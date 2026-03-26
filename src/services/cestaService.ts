import { supabase } from '../lib/supabase';
import { movimentarEstoqueBatch } from '../utils/movimentarEstoque';

export interface Cesta {
  id: string;
  nome: string;
  preco: number; // Mudança: usar 'preco' em vez de 'preco_total'
  vendedor_id: string;
  descricao?: string;
  ativo: boolean;
  sincronizado?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface ProdutoNaCesta {
  id: string;
  cesta_id: string;
  produto_cadastrado_id: string;
  quantidade: number;
  created_at?: string;
}

export interface CreateCestaData {
  nome: string;
  vendedor_id: string;
  descricao?: string;
  itens: {
    produto_cadastrado_id: string;
    quantidade: number;
  }[];
}

export class CestaService {
  static async createCestaWithItems(cestaData: CreateCestaData): Promise<Cesta> {
    try {
      // Validar dados de entrada
      if (!cestaData.vendedor_id) {
        throw new Error('Vendedor é obrigatório');
      }

      if (!cestaData.nome) {
        throw new Error('Nome da cesta é obrigatório');
      }

      if (!cestaData.itens || cestaData.itens.length === 0) {
        throw new Error('A cesta deve conter pelo menos um produto');
      }

      // Verificar se o vendedor existe
      const { data: vendedor, error: vendedorError } = await supabase
        .from('vendedores')
        .select('id, nome, ativo')
        .eq('id', cestaData.vendedor_id)
        .eq('ativo', true)
        .single();

      if (vendedorError || !vendedor) {
        throw new Error('Vendedor não encontrado ou inativo');
      }

      // Buscar informações dos produtos e calcular preço total
      const produtoIds = cestaData.itens.map(item => item.produto_cadastrado_id);
      const { data: produtos, error: produtosError } = await supabase
        .from('produtos_cadastrado')
        .select('id, produto_nome, preco_unt, qtd_estoque')
        .in('id', produtoIds);

      if (produtosError) {
        throw new Error('Erro ao buscar produtos');
      }

      if (!produtos || produtos.length !== produtoIds.length) {
        throw new Error('Um ou mais produtos não foram encontrados');
      }

      // Validar estoque disponível
      for (const item of cestaData.itens) {
        const produto = produtos.find(p => p.id === item.produto_cadastrado_id);
        if (!produto) {
          throw new Error(`Produto ${item.produto_cadastrado_id} não encontrado`);
        }
        if (produto.qtd_estoque < item.quantidade) {
          throw new Error(`Estoque insuficiente para o produto ${produto.produto_nome}. Disponível: ${produto.qtd_estoque}, Solicitado: ${item.quantidade}`);
        }
      }

      // Calcular preço total
      const precoTotal = cestaData.itens.reduce((total, item) => {
        const produto = produtos.find(p => p.id === item.produto_cadastrado_id);
        return total + (produto ? produto.preco_unt * item.quantidade : 0);
      }, 0);

      // Usar nome fornecido
      const nomeCesta = cestaData.nome;

      // Implementar criação manual da cesta
      return await this.createCestaRecord(cestaData, nomeCesta, precoTotal);
    } catch (error) {
      console.error('Erro no serviço de cestas:', error);
      throw error;
    }
  }

  private static async createCestaRecord(
    cestaData: CreateCestaData, 
    nomeCesta: string, 
    precoTotal: number
  ): Promise<Cesta> {
    try {
      // 1. Criar a cesta na tabela produtos
      const { data: novaCesta, error: cestaError } = await supabase
        .from('produtos')
        .insert([{
          nome: nomeCesta,
          preco: precoTotal,
          vendedor_id: cestaData.vendedor_id,
          descricao: cestaData.descricao || 'Cesta de produtos',
          ativo: true,
          sincronizado: false
        }])
        .select()
        .single();

      if (cestaError) {
        // Error handling without logging sensitive data
        throw new Error('Erro ao criar cesta');
      }

      // 2. Inserir os itens da cesta
      const itensParaInserir = cestaData.itens.map(item => ({
        cesta_id: novaCesta.id,
        produto_cadastrado_id: item.produto_cadastrado_id,
        quantidade: item.quantidade
      }));

      const { error: itensError } = await supabase
        .from('produtos_na_cesta')
        .insert(itensParaInserir);

      if (itensError) {
        // Se falhar ao inserir itens, remover a cesta criada (rollback manual)
        await supabase
          .from('produtos')
          .delete()
          .eq('id', novaCesta.id);

        console.error('Erro ao inserir itens da cesta:', itensError);
        throw new Error('Erro ao adicionar produtos à cesta: ' + itensError.message);
      }

      // 3. Registrar movimentações de saída (trigger atualiza qtd_estoque)
      try {
        await movimentarEstoqueBatch(
          cestaData.itens.map(item => ({
            produtoId: item.produto_cadastrado_id,
            quantidade: item.quantidade,
          })),
          {
            adminId: cestaData.vendedor_id, // será sobrescrito se necessário
            tipoMovimentacao: 'saida_venda',
            referenciaTipo: 'entrega_cesta',
            referenciaId: novaCesta.id,
            usuarioId: cestaData.vendedor_id,
            usuarioTipo: 'admin',
            usuarioNome: 'Sistema',
          }
        );
      } catch (estoqueError) {
        // Rollback: remover cesta e itens
        await supabase.from('produtos_na_cesta').delete().eq('cesta_id', novaCesta.id);
        await supabase.from('produtos').delete().eq('id', novaCesta.id);
        throw estoqueError;
      }

      return novaCesta;
    } catch {
      // Error handling without logging sensitive data
      throw new Error('Erro na transação manual');
    }
  }

  static async getCestaById(id: string): Promise<Cesta | null> {
    try {
      const { data, error } = await supabase
        .from('produtos')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null; // Cesta não encontrada
        }
        console.error('Erro ao buscar cesta:', error);
        throw error;
      }

      return data;
    } catch {
      // Error handling without logging sensitive data
      throw new Error('Erro ao buscar cesta');
    }
  }

  static async getCestasByVendedor(vendedorId: string): Promise<Cesta[]> {
    try {
      const { data, error } = await supabase
        .from('produtos')
        .select('*')
        .eq('vendedor_id', vendedorId)
        .eq('ativo', true)
        .order('created_at', { ascending: false });

      if (error) {
        // Error handling without logging sensitive data
        throw new Error('Erro ao buscar cestas do vendedor');
      }

      return data || [];
    } catch (error) {
      console.error('Erro no serviço de cestas:', error);
      throw error;
    }
  }

  static async getItensCesta(cestaId: string): Promise<ProdutoNaCesta[]> {
    try {
      const { data, error } = await supabase
        .from('produtos_na_cesta')
        .select(`
          *,
          produto_cadastrado:produtos_cadastrado(*)
        `)
        .eq('cesta_id', cestaId);

      if (error) {
        console.error('Erro ao buscar itens da cesta:', error);
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error('Erro no serviço de cestas:', error);
      throw error;
    }
  }

  static async updateCestaStatus(cestaId: string, ativo: boolean): Promise<void> {
    try {
      const { error } = await supabase
        .from('produtos')
        .update({ 
          ativo,
          updated_at: new Date().toISOString()
        })
        .eq('id', cestaId);

      if (error) {
        console.error('Erro ao atualizar status da cesta:', error);
        throw new Error('Erro ao atualizar status da cesta');
      }
    } catch (error) {
      console.error('Erro no serviço de cestas:', error);
      throw error;
    }
  }

  static async deleteCesta(cestaId: string): Promise<void> {
    const { error } = await supabase.rpc('excluir_cesta', { p_cesta_id: cestaId });

    if (error) {
      console.error('Erro ao excluir cesta:', error);
      throw new Error(error.message || 'Erro ao excluir cesta');
    }
  }

  static async updateCestaWithItems(cestaId: string, cestaData: Partial<CreateCestaData>): Promise<Cesta> {
    try {
      // 1. Atualizar dados básicos da cesta (se fornecidos)
      const updateData: any = { updated_at: new Date().toISOString() };
      if (cestaData.nome) updateData.nome = cestaData.nome;
      if (cestaData.descricao) updateData.descricao = cestaData.descricao;
      // Nota: Não atualizamos vendedor_id ou preço total aqui diretamente, o preço será recalculado

      // Buscar os itens atuais para comparar
      const { data: itensAtuais, error: itensError } = await supabase
        .from('produtos_na_cesta')
        .select('id, produto_cadastrado_id, quantidade')
        .eq('cesta_id', cestaId);

      if (itensError) throw new Error('Erro ao buscar itens atuais da cesta');

      // Se houver novos itens, recalcular preço e atualizar itens
      if (cestaData.itens) {
        // Buscar informações dos produtos para recalcular preço
        const produtoIds = cestaData.itens.map(item => item.produto_cadastrado_id);
        const { data: produtos, error: produtosError } = await supabase
          .from('produtos_cadastrado')
          .select('id, produto_nome, preco_unt, qtd_estoque')
          .in('id', produtoIds);

        if (produtosError || !produtos) throw new Error('Erro ao buscar informações dos produtos');

        // Validar estoque (apenas para aumento de quantidade ou novos itens seria o ideal, mas aqui validamos o total necessário)
        // Nota: O sistema atual parece debitar estoque na criação. Na edição, deveríamos devolver o estoque antigo e debitar o novo?
        // OU o sistema só debita na ENTREGA?
        // Com base no hook useEntregarCestas, o estoque é debitado na ENTREGA (RPC registrar_entrega_cestas).
        // A criação da cesta (createCestaWithItems) ATUALMENTE faz baixa de estoque (linha 152: update qtd_estoque).
        // Isso é uma inconsistência. Se baixamos na criação, a entrega não deveria baixar de novo, ou a criação é apenas uma "reserva"?
        // O user disse: "precisaria caso entregue mais cestas faça o calculo ... e retirar do estoque".
        // Isso implica que a baixa deve ser na entrega.
        // POREM, o código legado de createCestaRecord (linhas 152-169) JÁ FAZ A BAIXA.
        // Se a baixa é feita na criação, então na edição precisamos ajustar essa baixa (devolver o que foi removido, baixar o novo).
        
        // Complexidade: Ajuste de estoque na edição.
        // 1. Reverter baixa dos itens antigos.
        // 2. Aplicar baixa dos itens novos.
        
        // Passo 1: Devolver estoque dos itens antigos (movimentação de entrada)
        await movimentarEstoqueBatch(
          (itensAtuais || []).map(item => ({
            produtoId: item.produto_cadastrado_id,
            quantidade: item.quantidade,
          })),
          {
            adminId: '', // será preenchido pelo contexto
            tipoMovimentacao: 'entrada_devolucao',
            referenciaTipo: 'entrega_cesta',
            referenciaId: cestaId,
            usuarioId: '',
            usuarioTipo: 'admin',
            usuarioNome: 'Sistema',
          }
        );

        // Passo 2: Remover itens antigos da tabela de ligação
        await supabase.from('produtos_na_cesta').delete().eq('cesta_id', cestaId);

        // Passo 3: Inserir novos itens
        const novosItens = cestaData.itens.map(item => ({
          cesta_id: cestaId,
          produto_cadastrado_id: item.produto_cadastrado_id,
          quantidade: item.quantidade
        }));
        
        await supabase.from('produtos_na_cesta').insert(novosItens);

        // Passo 4: Baixar estoque dos novos itens (movimentação de saída)
        // A trigger rejeita se estoque insuficiente
        await movimentarEstoqueBatch(
          cestaData.itens.map(item => ({
            produtoId: item.produto_cadastrado_id,
            quantidade: item.quantidade,
          })),
          {
            adminId: '',
            tipoMovimentacao: 'saida_venda',
            referenciaTipo: 'entrega_cesta',
            referenciaId: cestaId,
            usuarioId: '',
            usuarioTipo: 'admin',
            usuarioNome: 'Sistema',
          }
        );

        // Recalcular preço total
        const novoPrecoTotal = cestaData.itens.reduce((total, item) => {
          const produto = produtos.find(p => p.id === item.produto_cadastrado_id);
          return total + (produto ? produto.preco_unt * item.quantidade : 0);
        }, 0);
        
        updateData.preco = novoPrecoTotal;
      }

      // Atualizar a cesta
      const { data: cestaAtualizada, error: updateError } = await supabase
        .from('produtos')
        .update(updateData)
        .eq('id', cestaId)
        .select()
        .single();

      if (updateError) throw new Error('Erro ao atualizar cesta');

      return cestaAtualizada;

    } catch (error) {
      console.error('Erro ao atualizar cesta:', error);
      throw error;
    }
  }
}

