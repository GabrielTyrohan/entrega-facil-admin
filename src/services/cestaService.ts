import { supabase } from '../lib/supabase';

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
      return await this.createCestaRecord(cestaData, nomeCesta, precoTotal, produtos);
    } catch (error) {
      console.error('Erro no serviço de cestas:', error);
      throw error;
    }
  }

  private static async createCestaRecord(
    cestaData: CreateCestaData, 
    nomeCesta: string, 
    precoTotal: number,
    produtos: Record<string, unknown>[]
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

      // 3. Atualizar estoque dos produtos (reservar)
      for (const item of cestaData.itens) {
        const produto = produtos.find(p => p.id === item.produto_cadastrado_id);
        if (produto) {
          const novoEstoque = Number(produto.qtd_estoque) - item.quantidade;
          
          const { error: estoqueError } = await supabase
            .from('produtos_cadastrado')
            .update({ qtd_estoque: novoEstoque })
            .eq('id', item.produto_cadastrado_id);

          if (estoqueError) {
            // Rollback: remover cesta e itens
            await supabase.from('produtos_na_cesta').delete().eq('cesta_id', novaCesta.id);
            await supabase.from('produtos').delete().eq('id', novaCesta.id);
            
            console.error('Erro ao atualizar estoque:', estoqueError);
            throw new Error('Erro ao reservar estoque dos produtos');
          }
        }
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
    try {
      // Primeiro remover os itens da cesta
      const { error: itensError } = await supabase
        .from('produtos_na_cesta')
        .delete()
        .eq('cesta_id', cestaId);

      if (itensError) {
        throw new Error('Erro ao remover itens da cesta');
      }

      // Depois remover a cesta
      const { error: cestaError } = await supabase
        .from('produtos')
        .delete()
        .eq('id', cestaId);

      if (cestaError) {
        throw new Error('Erro ao remover cesta');
      }
    } catch {
      // Error handling without logging sensitive data
      throw new Error('Erro ao buscar cestas com filtros');
    }
  }
}

