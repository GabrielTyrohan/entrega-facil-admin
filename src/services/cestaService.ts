import { supabase } from '../lib/supabase';

export interface Cesta {
  id: string;
  nome: string;
  preco: number;
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
  // ✅ adminId, usuarioId, usuarioNome removidos — não são mais usados na criação
  static async createCestaWithItems(cestaData: CreateCestaData): Promise<Cesta> {
    if (!cestaData.vendedor_id) throw new Error('Vendedor é obrigatório');
    if (!cestaData.nome) throw new Error('Nome da cesta é obrigatório');
    if (!cestaData.itens || cestaData.itens.length === 0) {
      throw new Error('A cesta deve conter pelo menos um produto');
    }

    const { data: vendedor, error: vendedorError } = await supabase
      .from('vendedores')
      .select('id, nome, ativo')
      .eq('id', cestaData.vendedor_id)
      .eq('ativo', true)
      .single();

    if (vendedorError || !vendedor) {
      throw new Error('Vendedor não encontrado ou inativo');
    }

    const produtoIds = cestaData.itens.map(item => item.produto_cadastrado_id);
    const { data: produtos, error: produtosError } = await supabase
      .from('produtos_cadastrado')
      .select('id, produto_nome, preco_unt, qtd_estoque')
      .in('id', produtoIds);

    if (produtosError) throw new Error('Erro ao buscar produtos');
    if (!produtos || produtos.length !== produtoIds.length) {
      throw new Error('Um ou mais produtos não foram encontrados');
    }

    const precoTotal = cestaData.itens.reduce((total, item) => {
      const produto = produtos.find(p => p.id === item.produto_cadastrado_id);
      return total + (produto ? produto.preco_unt * item.quantidade : 0);
    }, 0);

    return await this.createCestaRecord(cestaData, cestaData.nome, precoTotal);
  }

  private static async createCestaRecord(
    cestaData: CreateCestaData,
    nomeCesta: string,
    precoTotal: number
  ): Promise<Cesta> {
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

    if (cestaError) throw new Error('Erro ao criar cesta: ' + cestaError.message);

    const itensParaInserir = cestaData.itens.map(item => ({
      cesta_id: novaCesta.id,
      produto_cadastrado_id: item.produto_cadastrado_id,
      quantidade: item.quantidade
    }));

    const { error: itensError } = await supabase
      .from('produtos_na_cesta')
      .insert(itensParaInserir);

    if (itensError) {
      await supabase.from('produtos').delete().eq('id', novaCesta.id);
      throw new Error('Erro ao adicionar produtos à cesta: ' + itensError.message);
    }

    // Estoque debitado SOMENTE na entrega via RPC registrar_entrega_cestas
    return novaCesta;
  }

  static async getCestaById(id: string): Promise<Cesta | null> {
    const { data, error } = await supabase
      .from('produtos')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error('Erro ao buscar cesta: ' + error.message);
    }

    return data;
  }

  static async getCestasByVendedor(vendedorId: string): Promise<Cesta[]> {
    const { data, error } = await supabase
      .from('produtos')
      .select('*')
      .eq('vendedor_id', vendedorId)
      .eq('ativo', true)
      .order('created_at', { ascending: false });

    if (error) throw new Error('Erro ao buscar cestas do vendedor: ' + error.message);

    return data || [];
  }

  static async getItensCesta(cestaId: string): Promise<ProdutoNaCesta[]> {
    const { data, error } = await supabase
      .from('produtos_na_cesta')
      .select(`
        *,
        produto_cadastrado:produtos_cadastrado(*)
      `)
      .eq('cesta_id', cestaId);

    if (error) throw new Error('Erro ao buscar itens da cesta: ' + error.message);

    return data || [];
  }

  static async updateCestaStatus(cestaId: string, ativo: boolean): Promise<void> {
    const { error } = await supabase
      .from('produtos')
      .update({ ativo, updated_at: new Date().toISOString() })
      .eq('id', cestaId);

    if (error) throw new Error('Erro ao atualizar status da cesta: ' + error.message);
  }

  static async deleteCesta(cestaId: string): Promise<void> {
    const { error } = await supabase.rpc('excluir_cesta', { p_cesta_id: cestaId });

    if (error) throw new Error(error.message || 'Erro ao excluir cesta');
  }

  // ✅ Prefixo _ nos parâmetros não usados — mantém assinatura pública compatível
  // com EditarCesta.tsx e NovaCesta.tsx sem gerar warnings
  static async updateCestaWithItems(
    cestaId: string,
    cestaData: Partial<CreateCestaData>,
    _adminId: string,
    _usuarioId: string,
    _usuarioNome: string
  ): Promise<Cesta> {
    const updateData: any = { updated_at: new Date().toISOString() };
    if (cestaData.nome) updateData.nome = cestaData.nome;
    if (cestaData.descricao) updateData.descricao = cestaData.descricao;

    if (cestaData.itens) {
      const produtoIds = cestaData.itens.map(item => item.produto_cadastrado_id);
      const { data: produtos, error: produtosError } = await supabase
        .from('produtos_cadastrado')
        .select('id, produto_nome, preco_unt')
        .in('id', produtoIds);

      if (produtosError || !produtos) {
        throw new Error('Erro ao buscar informações dos produtos');
      }

      // Substitui itens sem movimentar estoque
      // Estoque debitado SOMENTE na entrega via RPC registrar_entrega_cestas
      await supabase.from('produtos_na_cesta').delete().eq('cesta_id', cestaId);

      const { error: insertError } = await supabase
        .from('produtos_na_cesta')
        .insert(cestaData.itens.map(item => ({
          cesta_id: cestaId,
          produto_cadastrado_id: item.produto_cadastrado_id,
          quantidade: item.quantidade
        })));

      if (insertError) {
        throw new Error('Erro ao atualizar itens da cesta: ' + insertError.message);
      }

      updateData.preco = cestaData.itens.reduce((total, item) => {
        const produto = produtos.find(p => p.id === item.produto_cadastrado_id);
        return total + (produto ? produto.preco_unt * item.quantidade : 0);
      }, 0);
    }

    const { data: cestaAtualizada, error: updateError } = await supabase
      .from('produtos')
      .update(updateData)
      .eq('id', cestaId)
      .select()
      .single();

    if (updateError) throw new Error('Erro ao atualizar cesta: ' + updateError.message);

    return cestaAtualizada;
  }
}