import { supabase } from '../lib/supabase';

export interface ProdutoCadastrado {
  id: string;
  administrador_id: string;
  produto_nome: string;
  produto_cod: string;
  categoria: string;
  qtd_estoque: number;
  preco_unt: number;
  // Novos campos
  codigo_barras?: string;
  kit?: boolean;
  ativo?: boolean;
  unidade_medida?: string;
  custo_compra?: number;
  margem_lucro?: number;
  readonly valor_estoque?: number; // Calculated by DB
  // Campos fiscais
  ncm?: string;
  cest?: string;
  cfop_padrao?: string;
  cst_pis?: string;
  aliquota_pis?: number;
  cst_cofins?: string;
  aliquota_cofins?: number;
  cst_icms?: string;
  aliquota_icms?: number;
  // Campos de gestão
  fornecedor_principal?: string;
  ultima_compra?: string; // ISO date
  estoque_minimo?: number;
  estoque_maximo?: number;
  // Timestamps
  created_at?: string;
  updated_at?: string;
}

export interface CreateProdutoData {
  produto_nome: string;
  produto_cod: string;
  categoria: string;
  qtd_estoque: number;
  preco_unt: number;
  administrador_id?: string;
  // Novos campos opcionais
  codigo_barras?: string;
  kit?: boolean;
  ativo?: boolean;
  unidade_medida?: string;
  custo_compra?: number;
  margem_lucro?: number;
  ncm?: string;
  cest?: string;
  cfop_padrao?: string;
  cst_pis?: string;
  aliquota_pis?: number;
  cst_cofins?: string;
  aliquota_cofins?: number;
  cst_icms?: string;
  aliquota_icms?: number;
  fornecedor_principal?: string;
  ultima_compra?: string;
  estoque_minimo?: number;
  estoque_maximo?: number;
}

export type TipoMovimentacao = 
  | 'entrada_compra' 
  | 'entrada_devolucao' 
  | 'entrada_ajuste' 
  | 'entrada_transferencia' 
  | 'saida_venda' 
  | 'saida_perda' 
  | 'saida_ajuste' 
  | 'saida_devolucao' 
  | 'saida_transferencia';

export type ReferenciaTipo = 
  | 'venda_atacado' 
  | 'entrega' 
  | 'nota_fiscal' 
  | 'orcamento' 
  | 'ajuste_manual' 
  | 'inventario';

export interface MovimentacaoEstoque {
  id: string;
  administrador_id: string;
  produto_cadastrado_id: string;
  tipo_movimentacao: TipoMovimentacao;
  quantidade: number;
  quantidade_anterior: number;
  quantidade_nova: number;
  custo_unitario?: number;
  valor_total?: number;
  referencia_tipo?: ReferenciaTipo;
  referencia_id?: string;
  usuario_id: string;
  usuario_tipo: 'admin' | 'funcionario' | 'vendedor';
  usuario_nome: string;
  motivo?: string;
  observacoes?: string;
  lote?: string;
  data_validade?: string;
  fornecedor?: string;
  nota_fiscal_numero?: string;
  sincronizado: boolean;
  created_at: string;
}

export class ProdutoService {
  private adminId: string;

  constructor(adminId: string) {
    this.adminId = adminId;
  }

  // Métodos estáticos para uso sem instância
  static async checkExistingCode(codigo: string, adminId: string, excludeId?: string): Promise<boolean> {
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
          ...produtoData
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
  async verificarCodigoExistente(codigo: string, excludeId?: string): Promise<boolean> {
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

