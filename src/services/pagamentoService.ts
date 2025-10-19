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
        entregas!inner (
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
          vendedores!inner (
            nome,
            administrador_id
          ),
          produtos!entregas_produto_id_fkey (
            nome,
            preco
          )
        )
      `)
      .eq('entregas.vendedores.administrador_id', this.adminId)
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
    let query = supabase
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
      .eq('entregas.vendedores.administrador_id', this.adminId);

    if (filters.vendedorId) {
      query = query.eq('entregas.vendedor_id', filters.vendedorId);
    }

    if (filters.formaPagamento) {
      query = query.eq('forma_pagamento', filters.formaPagamento);
    }

    if (filters.dataInicio) {
      query = query.gte('data_pagamento', filters.dataInicio);
    }

    if (filters.dataFim) {
      query = query.lte('data_pagamento', filters.dataFim);
    }

    query = query.order('data_pagamento', { ascending: false });

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    // Transformar os dados para o formato esperado
    let pagamentos: PagamentoComDetalhes[] = (data || []).map((pagamento: any) => ({
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
      const clienteNomeLower = filters.clienteNome.toLowerCase();
      pagamentos = pagamentos.filter(pagamento =>
        pagamento.cliente_nome.toLowerCase().includes(clienteNomeLower) ||
        (pagamento.cliente_sobrenome && pagamento.cliente_sobrenome.toLowerCase().includes(clienteNomeLower))
      );
    }

    return pagamentos;
  }

  async getTotalPagamentosByAdmin(): Promise<number> {
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
      .eq('entregas.vendedores.administrador_id', this.adminId);

    if (error) {
      throw error;
    }

    const total = (data || []).reduce((sum, pagamento) => sum + pagamento.valor, 0);
    return total;
  }
}

