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
  // Origem da mercadoria (0-8). Default 0. Não alterar NCM/CEST/CFOP/etc. automaticamente.
  origem_mercadoria?: number;
  categoria_fiscal?: string;
  // Status da revisão fiscal — lido do Supabase, nunca calculado no frontend.
  // Alterações de status passam SEMPRE pela RPC `definir_status_fiscal_produto`.
  fiscal_status?: 'pendente_revisao' | 'em_revisao' | 'validado' | 'bloqueado';
  fiscal_validado_em?: string | null;
  fiscal_validado_por?: string | null;
  // ID do lote de importação fiscal (null quando o produto não veio de importação).
  importacao_id?: string | null;
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
  origem_mercadoria?: number;
  categoria_fiscal?: string;
  fornecedor_principal?: string;
  ultima_compra?: string;
  estoque_minimo?: number;
  estoque_maximo?: number;
}

// Monta o payload de cadastro preservando TODOS os campos preenchidos,
// incluindo os fiscais (cest, cfop, CSTs, alíquotas, origem, categoria
// fiscal). Usado pelo formulário de novo produto antes do envio à Edge
// `cadastrar-produto`. Nunca define fiscal_status (o backend decide).
export interface FormCadastroProduto {
  produto_nome: string;
  categoria: string;
  qtd_estoque?: number;
  preco_unt?: number;
  codigo_barras?: string;
  kit?: boolean;
  ativo?: boolean;
  unidade_medida?: string;
  custo_compra?: number;
  ncm?: string;
  cest?: string;
  cfop_padrao?: string;
  categoria_fiscal?: string;
  fornecedor_principal?: string;
  estoque_minimo?: number;
  estoque_maximo?: number;
  cst_pis?: string;
  aliquota_pis?: number;
  cst_cofins?: string;
  aliquota_cofins?: number;
  cst_icms?: string;
  aliquota_icms?: number;
  origem_mercadoria?: number;
}

export function montarPayloadCadastroProduto(form: FormCadastroProduto): CreateProdutoData {
  return {
    codigo_barras: form.codigo_barras || undefined,
    produto_nome: form.produto_nome,
    categoria: form.categoria,
    ncm: form.ncm,
    custo_compra: form.custo_compra || undefined,
    preco_unt: form.preco_unt,
    qtd_estoque: form.qtd_estoque,
    unidade_medida: form.unidade_medida || 'UN',
    kit: form.kit || false,
    ativo: form.ativo !== undefined ? form.ativo : true,
    fornecedor_principal: form.fornecedor_principal || undefined,
    estoque_minimo: form.estoque_minimo || 0,
    estoque_maximo: form.estoque_maximo || 0,
    origem_mercadoria: form.origem_mercadoria ?? 0,
    cest: form.cest || undefined,
    cfop_padrao: form.cfop_padrao || undefined,
    categoria_fiscal: form.categoria_fiscal || undefined,
    cst_icms: form.cst_icms || undefined,
    aliquota_icms: form.aliquota_icms ?? undefined,
    cst_pis: form.cst_pis || undefined,
    aliquota_pis: form.aliquota_pis ?? undefined,
    cst_cofins: form.cst_cofins || undefined,
    aliquota_cofins: form.aliquota_cofins ?? undefined,
  } as CreateProdutoData;
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
      const { 
        administrador_id, 
        created_at, 
        valor_estoque, 
        ...updateData 
      } = produtoData as any;

      const { data, error } = await supabase
        .from('produtos_cadastrado')
        .update({
          ...updateData,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('Erro ao atualizar produto:', error);
        throw error;
      }

      return data;
    } catch (error: any) {
      console.error('Erro ao atualizar produto:', error);
      throw new Error(error.message || 'Erro no serviço de produtos');
    }
  }

  // Deletar produto
  async deleteProduto(id: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('produtos_cadastrado')
        .delete()
        .eq('id', id);

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

