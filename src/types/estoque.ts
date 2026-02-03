export interface MovimentacaoEstoque {
  id: string;
  administrador_id: string;
  produto_cadastrado_id: string;
  tipo_movimentacao:
    | 'entrada_compra'
    | 'entrada_devolucao'
    | 'entrada_ajuste'
    | 'entrada_transferencia'
    | 'saida_venda'
    | 'saida_perda'
    | 'saida_ajuste'
    | 'saida_devolucao'
    | 'saida_transferencia';
  quantidade: number;
  quantidade_anterior: number;
  quantidade_nova: number;
  custo_unitario?: number;
  valor_total?: number;
  referencia_tipo?: 'venda_atacado' | 'entrega' | 'nota_fiscal' | 'orcamento' | 'ajuste_manual' | 'inventario';
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

export interface RegistrarMovimentacaoParams {
  produto_id: string;
  tipo_movimentacao: MovimentacaoEstoque['tipo_movimentacao'];
  quantidade: number;
  motivo?: string;
  observacoes?: string;
  lote?: string;
  fornecedor?: string;
}

export interface EstoqueAtual {
  id: string;
  administrador_id: string;
  produto_nome: string;
  produto_cod: string;
  codigo_barras?: string;
  categoria: string;
  qtd_estoque: number;
  estoque_minimo: number;
  estoque_maximo?: number;
  custo_compra?: number;
  preco_unt: number;
  valor_estoque?: number;
  unidade_medida: string;
  ativo: boolean;
  fornecedor_principal?: string;
  ultima_compra?: string;
  status_estoque: 'ZERADO' | 'BAIXO' | 'NORMAL' | 'EXCESSO';
  ultima_movimentacao?: string;
}
