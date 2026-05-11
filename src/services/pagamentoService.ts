import { supabase } from '../lib/supabase';

export interface PagamentoComDetalhes {
  id: string;
  entrega_id: string;
  forma_pagamento: string;
  valor: number;
  data_pagamento: string;
  created_at: string;
  updated_at: string;
  // Dados da entrega
  entrega_valor: number;
  entrega_data_entrega: string;
  entrega_status_pagamento: string;
  entrega_pago: boolean;
  // Dados do cliente
  cliente_id: string;
  cliente_nome: string;
  cliente_sobrenome: string | null;
  cliente_cpf: string;
  cliente_telefone: string;
  cliente_email: string | null;
  cliente_endereco: string;
  // Dados do vendedor
  vendedor_id: string;
  vendedor_nome: string;
  // Dados do produto
  produto_id: string;
  produto_nome: string;
  produto_preco: number;
}

export class PagamentoService {
  private adminId: string;

  constructor(adminId: string) {
    this.adminId = adminId;
  }

  async getPagamentosByAdmin(): Promise<PagamentoComDetalhes[]> {
    // Etapa 1: buscar IDs de vendedores que pertencem ao admin
    const { data: vendedores, error: vendedorError } = await supabase
      .from('vendedores')
      .select('id')
      .eq('administrador_id', this.adminId);

    if (vendedorError || !vendedores?.length) return [];
    const vendedorIds = vendedores.map(v => v.id);

    // Etapa 2: buscar pagamentos filtrando pela coluna local da tabela principal
    const { data, error } = await supabase
      .from('pagamentos')
      .select(`
        id,
        entrega_id,
        forma_pagamento,
        valor,
        data_pagamento,
        created_at,
        updated_at,
        entregas!pagamentos_entrega_id_fkey (
          id,
          vendedor_id,
          cliente_id,
          produto_id,
          valor,
          data_entrega,
          status_pagamento,
          pago,
          clientes!entregas_cliente_id_fkey (
            nome,
            sobrenome,
            cpf,
            telefone,
            email,
            endereco
          ),
          vendedores!entregas_vendedor_id_fkey (
            nome,
            administrador_id
          ),
          produtos!entregas_produto_id_fkey (
            nome,
            preco
          )
        )
      `)
      .in('entregas.vendedor_id', vendedorIds)
      .order('data_pagamento', { ascending: false });

    if (error) {
      throw error;
    }

    // Filtrar registros sem entrega correspondente
    const pagamentos: PagamentoComDetalhes[] = (data || [])
      .filter((p: any) => p.entregas !== null)
      .map((pagamento: any) => ({
        id: String(pagamento.id),
        entrega_id: String(pagamento.entrega_id),
        forma_pagamento: pagamento.forma_pagamento,
        valor: Number(pagamento.valor),
        data_pagamento: pagamento.data_pagamento,
        created_at: pagamento.created_at,
        updated_at: pagamento.updated_at,
        entrega_valor: Number((pagamento.entregas as any)?.valor || 0),
        entrega_data_entrega: (pagamento.entregas as any)?.data_entrega || '',
        entrega_status_pagamento: (pagamento.entregas as any)?.status_pagamento || '',
        entrega_pago: Boolean((pagamento.entregas as any)?.pago || false),
        cliente_id: (pagamento.entregas as any)?.cliente_id || '',
        cliente_nome: (pagamento.entregas as any)?.clientes?.nome || '',
        cliente_sobrenome: (pagamento.entregas as any)?.clientes?.sobrenome || null,
        cliente_cpf: (pagamento.entregas as any)?.clientes?.cpf || '',
        cliente_telefone: (pagamento.entregas as any)?.clientes?.telefone || '',
        cliente_email: (pagamento.entregas as any)?.clientes?.email || null,
        cliente_endereco: (pagamento.entregas as any)?.clientes?.endereco || '',
        vendedor_id: (pagamento.entregas as any)?.vendedor_id || '',
        vendedor_nome: (pagamento.entregas as any)?.vendedores?.nome || '',
        produto_id: (pagamento.entregas as any)?.produto_id || '',
        produto_nome: (pagamento.entregas as any)?.produtos?.nome || '',
        produto_preco: Number((pagamento.entregas as any)?.produtos?.preco || 0),
      }));

    return pagamentos;
  }

  async getPagamentosByVendedor(vendedorId: string): Promise<PagamentoComDetalhes[]> {
    // Primeiro verificar se o vendedor pertence ao administrador
    const { data: vendedor, error: vendedorError } = await supabase
      .from('vendedores')
      .select('id')
      .eq('id', vendedorId)
      .eq('administrador_id', this.adminId)
      .single();

    if (vendedorError || !vendedor) {
      throw new Error('Vendedor não encontrado ou não autorizado');
    }

    const { data, error } = await supabase
      .from('pagamentos')
      .select(`
        id,
        entrega_id,
        forma_pagamento,
        valor,
        data_pagamento,
        created_at,
        updated_at,
        entregas!pagamentos_entrega_id_fkey (
          id,
          vendedor_id,
          cliente_id,
          produto_id,
          valor,
          data_entrega,
          status_pagamento,
          pago,
          clientes!entregas_cliente_id_fkey (
            nome,
            sobrenome,
            cpf,
            telefone,
            email,
            endereco
          ),
          vendedores!entregas_vendedor_id_fkey (
            nome
          ),
          produtos!entregas_produto_id_fkey (
            nome,
            preco
          )
        )
      `)
      .eq('entregas.vendedor_id', vendedorId)
      .order('data_pagamento', { ascending: false });

    if (error) {
      throw error;
    }

    // Transformar os dados para o formato esperado
    const pagamentos: PagamentoComDetalhes[] = (data || []).map((pagamento: any) => ({
      id: String(pagamento.id),
      entrega_id: String(pagamento.entrega_id),
      forma_pagamento: pagamento.forma_pagamento,
      valor: Number(pagamento.valor),
      data_pagamento: pagamento.data_pagamento,
      created_at: pagamento.created_at,
      updated_at: pagamento.updated_at,
      entrega_valor: Number((pagamento.entregas as any)?.valor || 0),
      entrega_data_entrega: (pagamento.entregas as any)?.data_entrega || '',
      entrega_status_pagamento: (pagamento.entregas as any)?.status_pagamento || '',
      entrega_pago: Boolean((pagamento.entregas as any)?.pago || false),
      cliente_id: (pagamento.entregas as any)?.cliente_id || '',
      cliente_nome: (pagamento.entregas as any)?.clientes?.nome || '',
      cliente_sobrenome: (pagamento.entregas as any)?.clientes?.sobrenome || null,
      cliente_cpf: (pagamento.entregas as any)?.clientes?.cpf || '',
      cliente_telefone: (pagamento.entregas as any)?.clientes?.telefone || '',
      cliente_email: (pagamento.entregas as any)?.clientes?.email || null,
      cliente_endereco: (pagamento.entregas as any)?.clientes?.endereco || '',
      vendedor_id: (pagamento.entregas as any)?.vendedor_id || '',
      vendedor_nome: (pagamento.entregas as any)?.vendedores?.nome || '',
      produto_id: (pagamento.entregas as any)?.produto_id || '',
      produto_nome: (pagamento.entregas as any)?.produtos?.nome || '',
      produto_preco: Number((pagamento.entregas as any)?.produtos?.preco || 0),
    }));

    return pagamentos;
  }

  async searchPagamentos(filters: {
    vendedorId?: string;
    formaPagamento?: string;
    dataInicio?: string;
    dataFim?: string;
    clienteNome?: string;
  }): Promise<PagamentoComDetalhes[]> {
    // Etapa 1: resolver vendedorIds do admin
    let vendedorIds: string[] = [];

    if (filters.vendedorId) {
      const { data: v } = await supabase
        .from('vendedores')
        .select('id')
        .eq('id', filters.vendedorId)
        .eq('administrador_id', this.adminId)
        .single();
      if (!v) return [];
      vendedorIds = [filters.vendedorId];
    } else {
      const { data: vendedores } = await supabase
        .from('vendedores')
        .select('id')
        .eq('administrador_id', this.adminId);
      if (!vendedores?.length) return [];
      vendedorIds = vendedores.map(v => v.id);
    }

    // Etapa 2: montar query com filtros diretos na coluna local
    let query = supabase
      .from('pagamentos')
      .select(`
        id, entrega_id, forma_pagamento, valor, data_pagamento, created_at, updated_at,
        entregas!pagamentos_entrega_id_fkey (
          id, vendedor_id, cliente_id, produto_id, valor, data_entrega, status_pagamento, pago,
          clientes!entregas_cliente_id_fkey (nome, sobrenome, cpf, telefone, email, endereco),
          vendedores!entregas_vendedor_id_fkey (nome, administrador_id),
          produtos!entregas_produto_id_fkey (nome, preco)
        )
      `)
      .in('entregas.vendedor_id', vendedorIds);

    if (filters.formaPagamento) query = query.eq('forma_pagamento', filters.formaPagamento);
    if (filters.dataInicio) query = query.gte('data_pagamento', filters.dataInicio);
    if (filters.dataFim) query = query.lte('data_pagamento', filters.dataFim);

    query = query.order('data_pagamento', { ascending: false });

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    let pagamentos: PagamentoComDetalhes[] = (data || [])
      .filter((p: any) => p.entregas !== null)
      .map((pagamento: any) => ({
        id: String(pagamento.id),
        entrega_id: String(pagamento.entrega_id),
        forma_pagamento: pagamento.forma_pagamento,
        valor: Number(pagamento.valor),
        data_pagamento: pagamento.data_pagamento,
        created_at: pagamento.created_at,
        updated_at: pagamento.updated_at,
        entrega_valor: Number((pagamento.entregas as any)?.valor || 0),
        entrega_data_entrega: (pagamento.entregas as any)?.data_entrega || '',
        entrega_status_pagamento: (pagamento.entregas as any)?.status_pagamento || '',
        entrega_pago: Boolean((pagamento.entregas as any)?.pago || false),
        cliente_id: (pagamento.entregas as any)?.cliente_id || '',
        cliente_nome: (pagamento.entregas as any)?.clientes?.nome || '',
        cliente_sobrenome: (pagamento.entregas as any)?.clientes?.sobrenome || null,
        cliente_cpf: (pagamento.entregas as any)?.clientes?.cpf || '',
        cliente_telefone: (pagamento.entregas as any)?.clientes?.telefone || '',
        cliente_email: (pagamento.entregas as any)?.clientes?.email || null,
        cliente_endereco: (pagamento.entregas as any)?.clientes?.endereco || '',
        vendedor_id: (pagamento.entregas as any)?.vendedor_id || '',
        vendedor_nome: (pagamento.entregas as any)?.vendedores?.nome || '',
        produto_id: (pagamento.entregas as any)?.produto_id || '',
        produto_nome: (pagamento.entregas as any)?.produtos?.nome || '',
        produto_preco: Number((pagamento.entregas as any)?.produtos?.preco || 0),
      }));

    // Filtrar por nome do cliente se especificado
    if (filters.clienteNome) {
      const terms = filters.clienteNome.trim().split(/\s+/).filter(Boolean);

      if (terms.length === 1) {
        // Busca simples: nome OU sobrenome contém o termo
        query = query.or(
          `entregas.clientes.nome.ilike.%${terms[0]}%,entregas.clientes.sobrenome.ilike.%${terms[0]}%`
        );
      } else {
        // Busca com múltiplas palavras: cada palavra deve aparecer
        // no nome completo (nome + sobrenome)
        // Estratégia: filtra no lado do JavaScript após carregar,
        // pois o Supabase não suporta concat de colunas em ilike diretamente
        const lowerTerms = terms.map(t => t.toLowerCase());
        
        pagamentos = pagamentos.filter((pagamento) => {
          const fullName = [
            pagamento.cliente_nome || '',
            pagamento.cliente_sobrenome || ''
          ]
            .join(' ')
            .toLowerCase();
          return lowerTerms.every(t => fullName.includes(t));
        });
      }
    }

    return pagamentos;
  }

  async getTotalPagamentosByAdmin(): Promise<number> {
    // Etapa 1: buscar IDs de vendedores do admin
    const { data: vendedores, error: vendedorError } = await supabase
      .from('vendedores')
      .select('id')
      .eq('administrador_id', this.adminId);

    if (vendedorError || !vendedores?.length) return 0;
    const vendedorIds = vendedores.map(v => v.id);

    // Etapa 2: buscar totais filtrando pela coluna local
    const { data, error } = await supabase
      .from('pagamentos')
      .select(`
        valor,
        entregas!pagamentos_entrega_id_fkey (
          vendedores!entregas_vendedor_id_fkey (
            administrador_id
          )
        )
      `)
      .in('entregas.vendedor_id', vendedorIds);

    if (error) {
      throw error;
    }

    const total = (data || []).reduce((sum, pagamento) => sum + pagamento.valor, 0);
    return total;
  }
}

