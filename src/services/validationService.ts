export interface ValidationResult {
  isValid: boolean;
  message?: string;
}

export interface Produto {
  id: string;
  produto_nome: string;
  produto_cod: string;
  categoria: string;
  qtd_estoque: number;
  preco_unt: number;
  descricao?: string;
}

export interface ItemCesta {
  produtoId: string;
  produto: Produto;
  quantidade: number;
}

export interface Cesta {
  id: string;
  vendedorId: string;
  vendedorNome: string;
  itens: ItemCesta[];
  limiteMaximo: number;
  status: 'ativa' | 'entregue' | 'retornada';
  dataCriacao: Date;
}

export class ValidationService {
  // Validações para Produtos
  static validateProduto(produto: Partial<Produto>): ValidationResult {
    if (!produto.produto_nome || produto.produto_nome.trim().length === 0) {
      return { isValid: false, message: 'Nome do produto é obrigatório' };
    }

    if (produto.produto_nome.trim().length < 2) {
      return { isValid: false, message: 'Nome do produto deve ter pelo menos 2 caracteres' };
    }

    if (!produto.produto_cod || produto.produto_cod.trim().length === 0) {
      return { isValid: false, message: 'Código do produto é obrigatório' };
    }

    if (!produto.categoria || produto.categoria.trim().length === 0) {
      return { isValid: false, message: 'Categoria do produto é obrigatória' };
    }

    if (produto.qtd_estoque === undefined || produto.qtd_estoque === null || produto.qtd_estoque < 0) {
      return { isValid: false, message: 'Quantidade deve ser um número maior ou igual a zero' };
    }

    if (produto.preco_unt === undefined || produto.preco_unt === null || produto.preco_unt <= 0) {
      return { isValid: false, message: 'Preço deve ser um número maior que zero' };
    }

    return { isValid: true };
  }

  static validateCodigoUnico(codigo: string, produtos: Produto[], produtoAtualId?: string): ValidationResult {
    const codigoExistente = produtos.find(p => 
      p.produto_cod.toLowerCase() === codigo.toLowerCase() && p.id !== produtoAtualId
    );

    if (codigoExistente) {
      return { isValid: false, message: 'Código do produto já existe. Use um código único.' };
    }

    return { isValid: true };
  }

  // Validações para Cestas
  static validateCesta(cesta: Partial<Cesta>): ValidationResult {
    if (!cesta.vendedorId || cesta.vendedorId.trim().length === 0) {
      return { isValid: false, message: 'Vendedor é obrigatório' };
    }

    if (!cesta.limiteMaximo || cesta.limiteMaximo <= 0) {
      return { isValid: false, message: 'Limite máximo deve ser maior que zero' };
    }

    if (cesta.limiteMaximo > 100) {
      return { isValid: false, message: 'Limite máximo não pode exceder 100 itens' };
    }

    return { isValid: true };
  }

  static validateItemCesta(
    item: Partial<ItemCesta>, 
    produto: Produto, 
    cestasAtivas: Cesta[],
    cestaAtualId?: string
  ): ValidationResult {
    if (!item.quantidade || item.quantidade <= 0) {
      return { isValid: false, message: 'Quantidade deve ser maior que zero' };
    }

    // Verificar estoque disponível
    const estoqueReservado = this.calcularEstoqueReservado(produto.id, cestasAtivas, cestaAtualId);
    const estoqueDisponivel = produto.qtd_estoque - estoqueReservado;

    if (item.quantidade > estoqueDisponivel) {
      return { 
        isValid: false, 
        message: `Estoque insuficiente. Disponível: ${estoqueDisponivel} unidades` 
      };
    }

    return { isValid: true };
  }

  static validateLimiteCesta(
    itensAtuais: ItemCesta[], 
    novoItem: ItemCesta, 
    limiteMaximo: number,
    isEdicao: boolean = false
  ): ValidationResult {
    // Contar produtos únicos ao invés de quantidade total
    const produtosUnicos = new Set(itensAtuais.map(item => item.produtoId));
    
    // Se não estamos editando um item existente, adicionar o novo produto
    if (!isEdicao) {
      produtosUnicos.add(novoItem.produtoId);
    }

    const totalProdutos = produtosUnicos.size;

    if (totalProdutos > limiteMaximo) {
      const excesso = totalProdutos - limiteMaximo;
      return { 
        isValid: false, 
        message: `Limite da cesta excedido em ${excesso} produtos. Limite máximo: ${limiteMaximo} produtos` 
      };
    }

    return { isValid: true };
  }

  static validateProdutoDuplicado(
    produtoId: string, 
    itensAtuais: ItemCesta[], 
    isEdicao: boolean = false
  ): ValidationResult {
    if (!isEdicao && itensAtuais.some(item => item.produtoId === produtoId)) {
      return { 
        isValid: false, 
        message: 'Este produto já foi adicionado à cesta. Não é permitido produtos duplicados.' 
      };
    }

    return { isValid: true };
  }

  static validateCestaAtiva(vendedorId: string, cestas: Cesta[], cestaAtualId?: string): ValidationResult {
    const cestaAtiva = cestas.find(c => 
      c.vendedorId === vendedorId && 
      c.status === 'ativa' && 
      c.id !== cestaAtualId
    );

    if (cestaAtiva) {
      return { 
        isValid: false, 
        message: 'Este vendedor já possui uma cesta ativa. Finalize a cesta atual antes de criar uma nova.' 
      };
    }

    return { isValid: true };
  }

  // Métodos auxiliares
  private static calcularEstoqueReservado(
    produtoId: string, 
    cestasAtivas: Cesta[], 
    cestaAtualId?: string
  ): number {
    return cestasAtivas
      .filter(cesta => cesta.status === 'ativa' && cesta.id !== cestaAtualId)
      .reduce((total, cesta) => {
        const item = cesta.itens.find(i => i.produtoId === produtoId);
        return total + (item ? item.quantidade : 0);
      }, 0);
  }

  // Validações de formulário
  static validateEmail(email: string): ValidationResult {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return { isValid: false, message: 'Email inválido' };
    }
    return { isValid: true };
  }

  static validatePhone(phone: string): ValidationResult {
    const phoneRegex = /^\(\d{2}\)\s\d{4,5}-\d{4}$/;
    if (!phoneRegex.test(phone)) {
      return { isValid: false, message: 'Telefone deve estar no formato (XX) XXXXX-XXXX' };
    }
    return { isValid: true };
  }

  static validateCPF(cpf: string): ValidationResult {
    const cpfRegex = /^\d{3}\.\d{3}\.\d{3}-\d{2}$/;
    if (!cpfRegex.test(cpf)) {
      return { isValid: false, message: 'CPF deve estar no formato XXX.XXX.XXX-XX' };
    }
    return { isValid: true };
  }

  // Mensagens de sucesso
  static getSuccessMessage(action: string, entity: string): string {
    const messages: { [key: string]: string } = {
      'create_produto': 'Produto cadastrado com sucesso!',
      'update_produto': 'Produto atualizado com sucesso!',
      'delete_produto': 'Produto excluído com sucesso!',
      'create_cesta': 'Cesta criada com sucesso!',
      'update_cesta': 'Cesta atualizada com sucesso!',
      'delete_cesta': 'Cesta excluída com sucesso!',
      'finalize_cesta': 'Cesta finalizada com sucesso!',
      'return_cesta': 'Cesta retornada com sucesso!',
    };

    return messages[`${action}_${entity}`] || 'Operação realizada com sucesso!';
  }
}

