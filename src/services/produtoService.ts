import { supabase } from '../lib/supabase';

export interface ProdutoCadastrado {
  id: string;
  administrador_id: string;
  produto_nome: string;
  produto_cod: number;
  categoria: string;
  qtd_estoque: number;
  preco_unt: number;
  created_at?: string;
  updated_at?: string;
}

export interface CreateProdutoData {
  produto_nome: string;
  produto_cod: number;
  categoria: string;
  qtd_estoque: number;
  preco_unt: number;
  administrador_id?: string;
}

export class ProdutoService {
  private adminId: string;

  constructor(adminId: string) {
    this.adminId = adminId;
  }

  // Métodos estáticos para uso sem instância
  static async checkExistingCode(codigo: number, adminId: string, excludeId?: string): Promise<boolean> {
    try {
      let query = supabase
        .from('produtos_cadastrado')
        .select('id')
        .eq('produto_cod', codigo)
        .eq('administrador_id', adminId);

      if (excludeId) {
        query = query.neq('id', excludeId);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Erro ao verificar código:', error);
        throw error;
      }

      return (data || []).length > 0;
    } catch {
      // Error handling without logging sensitive data
      throw new Error('Erro ao verificar código');
    }
  }

  static async createProduto(produtoData: CreateProdutoData): Promise<ProdutoCadastrado> {
    try {
      const { data, error } = await supabase
        .from('produtos_cadastrado')
        .insert([produtoData])
        .select()
        .single();

      if (error) {
        console.error('Erro ao criar produto:', error);
        throw new Error('Erro ao criar produto');
      }

      return data;
    } catch {
      // Error handling without logging sensitive data
      throw new Error('Erro no serviço de produtos');
    }
  }

  // Criar novo produto
  async createProduto(produtoData: CreateProdutoData): Promise<ProdutoCadastrado> {
    try {
      const { data, error } = await supabase
        .from('produtos_cadastrado')
        .insert([{
          ...produtoData,
          administrador_id: this.adminId
        }])
        .select()
        .single();

      if (error) {
        console.error('Erro ao criar produto:', error);
        throw new Error('Erro ao criar produto');
      }

      return data;
    } catch {
      // Error handling without logging sensitive data
      throw new Error('Erro no serviço de produtos');
    }
  }

  // Buscar produtos por administrador
  async getProdutosByAdmin(): Promise<ProdutoCadastrado[]> {
    try {
      const { data, error } = await supabase
        .from('produtos_cadastrado')
        .select('*')
        .eq('administrador_id', this.adminId)
        .order('produto_nome');

      if (error) {
        console.error('Erro ao buscar produtos:', error);
        throw error;
      }

      return data || [];
    } catch {
      // Error handling without logging sensitive data
      throw new Error('Erro no serviço de produtos');
    }
  }

  // Buscar produto por ID
  async getProdutoById(id: string): Promise<ProdutoCadastrado | null> {
    try {
      const { data, error } = await supabase
        .from('produtos_cadastrado')
        .select('*')
        .eq('id', id)
        .eq('administrador_id', this.adminId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null; // Produto não encontrado
        }
        console.error('Erro ao buscar produto:', error);
        throw error;
      }

      return data;
    } catch {
      // Error handling without logging sensitive data
      throw new Error('Erro no serviço de produtos');
    }
  }

  // Atualizar produto
  async updateProduto(id: string, produtoData: Partial<CreateProdutoData>): Promise<ProdutoCadastrado> {
    try {
      const { data, error } = await supabase
        .from('produtos_cadastrado')
        .update({
          ...produtoData,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .eq('administrador_id', this.adminId)
        .select()
        .single();

      if (error) {
        console.error('Erro ao atualizar produto:', error);
        throw new Error('Erro ao atualizar produto');
      }

      return data;
    } catch {
      // Error handling without logging sensitive data
      throw new Error('Erro no serviço de produtos');
    }
  }

  // Deletar produto
  async deleteProduto(id: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('produtos_cadastrado')
        .delete()
        .eq('id', id)
        .eq('administrador_id', this.adminId);

      if (error) {
        console.error('Erro ao deletar produto:', error);
        throw new Error('Erro ao deletar produto');
      }
    } catch {
      // Error handling without logging sensitive data
      throw new Error('Erro no serviço de produtos');
    }
  }

  // Verificar se código do produto já existe
  async verificarCodigoExistente(codigo: number, excludeId?: string): Promise<boolean> {
    try {
      let query = supabase
        .from('produtos_cadastrado')
        .select('id')
        .eq('produto_cod', codigo)
        .eq('administrador_id', this.adminId);

      if (excludeId) {
        query = query.neq('id', excludeId);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Erro ao verificar código:', error);
        throw error;
      }

      return (data || []).length > 0;
    } catch {
      // Error handling without logging sensitive data
      throw new Error('Erro ao verificar código');
    }
  }

  // Buscar produtos por categoria
  async getProdutosByCategoria(categoria: string): Promise<ProdutoCadastrado[]> {
    try {
      const { data, error } = await supabase
        .from('produtos_cadastrado')
        .select('*')
        .eq('administrador_id', this.adminId)
        .eq('categoria', categoria)
        .order('produto_nome');

      if (error) {
        console.error('Erro ao buscar produtos por categoria:', error);
        throw error;
      }

      return data || [];
    } catch {
      // Error handling without logging sensitive data
      throw new Error('Erro ao buscar produtos por categoria');
    }
  }
}

