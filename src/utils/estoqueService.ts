import { ProdutoCadastrado } from '../services/produtoService';

export type Produto = ProdutoCadastrado;

export interface ItemCesta {
  produto: Produto;
  quantidade: number;
}

export interface Cesta {
  id: string;
  vendedor_id: string;
  vendedor_nome: string;
  data_montagem: string;
  status: 'em_uso' | 'entregue' | 'retornada';
  limite_maximo: number;
  itens: ItemCesta[];
  total_itens: number;
  valor_total: number;
}

export interface ReservaEstoque {
  produto_id: string;
  cesta_id: string;
  vendedor_id: string;
  quantidade_reservada: number;
  data_reserva: string;
}

class EstoqueService {
  private reservas: ReservaEstoque[] = [];

  // Verificar disponibilidade de estoque considerando reservas
  verificarDisponibilidade(produto_id: string, quantidade_solicitada: number): {
    disponivel: boolean;
    quantidade_disponivel: number;
    quantidade_reservada: number;
  } {
    // Calcular total reservado para este produto
    const totalReservado = this.reservas
      .filter(reserva => reserva.produto_id === produto_id)
      .reduce((sum, reserva) => sum + reserva.quantidade_reservada, 0);

    // Buscar produto no estoque (simulado)
    const produto = this.obterProduto(produto_id);
    if (!produto) {
      return {
        disponivel: false,
        quantidade_disponivel: 0,
        quantidade_reservada: totalReservado
      };
    }

    const quantidadeDisponivel = produto.qtd_estoque - totalReservado;
    
    return {
      disponivel: quantidadeDisponivel >= quantidade_solicitada,
      quantidade_disponivel: quantidadeDisponivel,
      quantidade_reservada: totalReservado
    };
  }

  // Reservar produtos para uma cesta
  reservarProdutos(cesta: Cesta): {
    sucesso: boolean;
    erros: string[];
    reservas_criadas: ReservaEstoque[];
  } {
    const erros: string[] = [];
    const reservasCriadas: ReservaEstoque[] = [];

    // Verificar se vendedor já tem cesta ativa
    const cestaAtivaExistente = this.reservas.find(
      reserva => reserva.vendedor_id === cesta.vendedor_id && reserva.cesta_id !== cesta.id
    );

    if (cestaAtivaExistente) {
      erros.push(`Vendedor ${cesta.vendedor_nome} já possui uma cesta ativa`);
      return { sucesso: false, erros, reservas_criadas: [] };
    }

    // Verificar disponibilidade para cada item
    for (const item of cesta.itens) {
      const disponibilidade = this.verificarDisponibilidade(
        item.produto.id, 
        item.quantidade
      );

      if (!disponibilidade.disponivel) {
        erros.push(
          `Produto ${item.produto.produto_nome}: estoque insuficiente. ` +
          `Disponível: ${disponibilidade.quantidade_disponivel}, ` +
          `Solicitado: ${item.quantidade}`
        );
      }
    }

    // Se houver erros, não criar reservas
    if (erros.length > 0) {
      return { sucesso: false, erros, reservas_criadas: [] };
    }

    // Criar reservas
    for (const item of cesta.itens) {
      const reserva: ReservaEstoque = {
        produto_id: item.produto.id,
        cesta_id: cesta.id,
        vendedor_id: cesta.vendedor_id,
        quantidade_reservada: item.quantidade,
        data_reserva: new Date().toISOString()
      };

      this.reservas.push(reserva);
      reservasCriadas.push(reserva);
    }

    return { sucesso: true, erros: [], reservas_criadas: reservasCriadas };
  }

  // Liberar reservas de uma cesta
  liberarReservas(cesta_id: string): {
    sucesso: boolean;
    reservas_liberadas: ReservaEstoque[];
  } {
    const reservasLiberadas = this.reservas.filter(
      reserva => reserva.cesta_id === cesta_id
    );

    this.reservas = this.reservas.filter(
      reserva => reserva.cesta_id !== cesta_id
    );

    return {
      sucesso: true,
      reservas_liberadas: reservasLiberadas
    };
  }

  // Finalizar cesta (consumir estoque)
  finalizarCesta(cesta_id: string): {
    sucesso: boolean;
    erros: string[];
    produtos_consumidos: { produto_id: string; quantidade: number }[];
  } {
    const erros: string[] = [];
    const produtosConsumidos: { produto_id: string; quantidade: number }[] = [];

    const reservasCesta = this.reservas.filter(
      reserva => reserva.cesta_id === cesta_id
    );

    if (reservasCesta.length === 0) {
      erros.push('Nenhuma reserva encontrada para esta cesta');
      return { sucesso: false, erros, produtos_consumidos: [] };
    }

    // Simular consumo do estoque
    for (const reserva of reservasCesta) {
      // Aqui seria feita a atualização real no banco de dados
      // Por enquanto, apenas registramos o consumo
      produtosConsumidos.push({
        produto_id: reserva.produto_id,
        quantidade: reserva.quantidade_reservada
      });
    }

    // Liberar reservas após consumo
    this.liberarReservas(cesta_id);

    return {
      sucesso: true,
      erros: [],
      produtos_consumidos: produtosConsumidos
    };
  }

  // Retornar cesta (liberar reservas sem consumir estoque)
  retornarCesta(cesta_id: string): {
    sucesso: boolean;
    reservas_liberadas: ReservaEstoque[];
  } {
    return this.liberarReservas(cesta_id);
  }

  // Obter reservas de um vendedor
  obterReservasVendedor(vendedor_id: string): ReservaEstoque[] {
    return this.reservas.filter(reserva => reserva.vendedor_id === vendedor_id);
  }

  // Obter reservas de um produto
  obterReservasProduto(produto_id: string): ReservaEstoque[] {
    return this.reservas.filter(reserva => reserva.produto_id === produto_id);
  }

  // Verificar se vendedor tem cesta ativa
  vendedorTemCestaAtiva(vendedor_id: string): boolean {
    return this.reservas.some(reserva => reserva.vendedor_id === vendedor_id);
  }

  // Obter estatísticas de estoque
  obterEstatisticasEstoque(): {
    total_produtos: number;
    total_reservado: number;
    produtos_com_reserva: number;
    vendedores_ativos: number;
  } {
    const produtosComReserva = new Set(this.reservas.map(r => r.produto_id));
    const vendedoresAtivos = new Set(this.reservas.map(r => r.vendedor_id));
    const totalReservado = this.reservas.reduce(
      (sum, reserva) => sum + reserva.quantidade_reservada, 0
    );

    return {
      total_produtos: this.obterTodosProdutos().length,
      total_reservado: totalReservado,
      produtos_com_reserva: produtosComReserva.size,
      vendedores_ativos: vendedoresAtivos.size
    };
  }

  // Métodos auxiliares (simulados)
  private obterProduto(produto_id: string): Produto | null {
    // Simular busca no banco de dados
    const produtos = this.obterTodosProdutos();
    return produtos.find(p => p.id === produto_id) || null;
  }

  private obterTodosProdutos(): Produto[] {
    // Dados simulados - em produção viria do banco de dados
    return [
      {
        id: '1',
        administrador_id: 'admin-1',
        produto_nome: 'Coca-Cola 350ml',
        produto_cod: 'COCA350ML',
        categoria: 'Bebidas',
        qtd_estoque: 50,
        preco_unt: 4.50,
      },
      {
        id: '2',
        administrador_id: 'admin-1',
        produto_nome: 'Pão de Açúcar Integral',
        produto_cod: 'PAO_INTEGRAL',
        categoria: 'Alimentos',
        qtd_estoque: 25,
        preco_unt: 8.90,
      },
      {
        id: '3',
        administrador_id: 'admin-1',
        produto_nome: 'Detergente Ypê',
        produto_cod: 'DET_YPE_500',
        categoria: 'Limpeza',
        qtd_estoque: 30,
        preco_unt: 3.25,
      },
      {
        id: '4',
        administrador_id: 'admin-1',
        produto_nome: 'Shampoo Head & Shoulders',
        produto_cod: 'SHAMP_HS_400',
        categoria: 'Higiene',
        qtd_estoque: 15,
        preco_unt: 12.90,
      }
    ];
  }

  // Validações de negócio
  validarCesta(cesta: Cesta): {
    valida: boolean;
    erros: string[];
  } {
    const erros: string[] = [];

    // Validar limite máximo
    if (cesta.total_itens > cesta.limite_maximo) {
      erros.push(`Total de itens (${cesta.total_itens}) excede o limite máximo (${cesta.limite_maximo})`);
    }

    // Validar produtos duplicados
    const produtoIds = cesta.itens.map(item => item.produto.id);
    const produtosDuplicados = produtoIds.filter((id, index) => produtoIds.indexOf(id) !== index);
    if (produtosDuplicados.length > 0) {
      erros.push('Cesta contém produtos duplicados');
    }

    // Validar quantidades
    for (const item of cesta.itens) {
      if (item.quantidade <= 0) {
        erros.push(`Quantidade inválida para produto ${item.produto.produto_nome}`);
      }
    }

    // Validar disponibilidade de estoque
    for (const item of cesta.itens) {
      const disponibilidade = this.verificarDisponibilidade(
        item.produto.id, 
        item.quantidade
      );

      if (!disponibilidade.disponivel) {
        erros.push(
          `Estoque insuficiente para ${item.produto.produto_nome}. ` +
          `Disponível: ${disponibilidade.quantidade_disponivel}, ` +
          `Solicitado: ${item.quantidade}`
        );
      }
    }

    return {
      valida: erros.length === 0,
      erros
    };
  }
}

// Instância singleton do serviço
export const estoqueService = new EstoqueService();

// Hooks para React (opcional)
export const useEstoque = () => {
  return {
    verificarDisponibilidade: estoqueService.verificarDisponibilidade.bind(estoqueService),
    reservarProdutos: estoqueService.reservarProdutos.bind(estoqueService),
    liberarReservas: estoqueService.liberarReservas.bind(estoqueService),
    finalizarCesta: estoqueService.finalizarCesta.bind(estoqueService),
    retornarCesta: estoqueService.retornarCesta.bind(estoqueService),
    obterReservasVendedor: estoqueService.obterReservasVendedor.bind(estoqueService),
    obterReservasProduto: estoqueService.obterReservasProduto.bind(estoqueService),
    vendedorTemCestaAtiva: estoqueService.vendedorTemCestaAtiva.bind(estoqueService),
    obterEstatisticasEstoque: estoqueService.obterEstatisticasEstoque.bind(estoqueService),
    validarCesta: estoqueService.validarCesta.bind(estoqueService)
  };
};
