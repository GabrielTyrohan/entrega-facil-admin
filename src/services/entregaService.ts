import { supabase } from '../lib/supabase';

// Função para dividir endereço completo em componentes
function parseEndereco(enderecoCompleto: string) {
  if (!enderecoCompleto) {
    return {
      rua: '',
      numero: '',
      bairro: '',
      cep: '',
      cidade: '',
      estado: '',
    };
  }

  // Padrão esperado: "Rua Silva Jardim, 620, Centro, Porto Alegre - RS"
  // Ou: "Rua Silva Jardim, 620, Centro, 90000-000, Porto Alegre - RS"
  
  const parts = enderecoCompleto.split(',').map(part => part.trim());
  
  let rua = '';
  let numero = '';
  let bairro = '';
  let cep = '';
  let cidade = '';
  let estado = '';

  if (parts.length >= 2) {
    rua = parts[0] || '';
    numero = parts[1] || '';
  }

  if (parts.length >= 3) {
    bairro = parts[2] || '';
  }

  // Verificar se há CEP (formato XXXXX-XXX ou XXXXXXXX)
  let cidadeEstadoPart = '';
  if (parts.length >= 4) {
    const possibleCep = parts[3];
    const cepPattern = /^\d{5}-?\d{3}$/;
    
    if (cepPattern.test(possibleCep.replace(/\s/g, ''))) {
      cep = possibleCep;
      if (parts.length >= 5) {
        cidadeEstadoPart = parts[4];
      }
    } else {
      cidadeEstadoPart = possibleCep;
    }
  }

  // Se não encontrou CEP na posição 3, a cidade/estado está na posição 3
  if (!cidadeEstadoPart && parts.length >= 4) {
    cidadeEstadoPart = parts[3];
  }

  // Processar cidade e estado (formato: "Porto Alegre - RS")
  if (cidadeEstadoPart) {
    const cidadeEstadoMatch = cidadeEstadoPart.match(/^(.+?)\s*-\s*([A-Z]{2})$/);
    if (cidadeEstadoMatch) {
      cidade = cidadeEstadoMatch[1].trim();
      estado = cidadeEstadoMatch[2].trim();
    } else {
      cidade = cidadeEstadoPart;
    }
  }

  return {
    rua,
    numero,
    bairro,
    cep,
    cidade,
    estado,
  };
}

export interface EntregaComDetalhes {
  id: string;
  vendedor_id: string;
  cliente_id: string;
  produto_id: string;
  valor: number;
  data_entrega: string;
  pago: boolean;
  status_entrega?: string;
  status: string; // Added for status display
  status_pagamento: string;
  mes_cobranca: string | null;
  dataRetorno: string | null;
  created_at: string;
  updated_at: string;
  observacoes?: string; // Added for observations
  // Dados do cliente (flat properties for backward compatibility)
  cliente_nome: string;
  cliente_sobrenome: string | null;
  cliente_cpf: string;
  cliente_telefone: string;
  cliente_email: string | null;
  cliente_endereco: string;
  // Dados do vendedor (flat properties for backward compatibility)
  vendedor_nome: string;
  // Dados do produto (flat properties for backward compatibility)
  produto_nome: string;
  produto_preco: number;
  // Itens detalhados da cesta e itens adicionais da entrega
  cesta_itens?: Array<{
    produto: {
      id: string;
      produto_nome: string;
      produto_cod: string;
      categoria: string;
      preco_unt: number;
    };
    quantidade: number;
  }>;
  itens_adicionais?: Array<{
    id: string;
    quantidade: number;
    preco_unitario: number;
    subtotal: number;
    produto: {
      id: string;
      produto_nome: string;
      produto_cod: string;
      categoria: string;
      preco_unt: number;
    };
  }>;
  // Totais calculados
  valor_cesta?: number;
  valor_adicionais?: number;
  valor_total?: number;
  // Nested objects for component compatibility
  cliente?: {
    nome: string;
    sobrenome?: string | null;
    cpf: string;
    telefone: string;
    email?: string | null;
    endereco: string;
    numero?: string;
    Bairro?: string;
    Cidade?: string;
    Estado?: string;
    bairro?: string;
    cidade?: string;
    estado?: string;
    cep?: string;
    complemento?: string | null;
  };
  vendedor?: {
    nome: string;
  };
  produto?: {
    nome: string;
    preco: number;
  };
  endereco_entrega?: {
    rua: string;
    numero: string;
    bairro: string;
    cep: string;
    cidade: string;
    estado: string;
    complemento?: string;
  };
  pagamento?: {
    forma_pagamento: string;
    metodo_pagamento?: string;
    valor: number;
    data_pagamento?: string;
    status?: string;
  };
}

export class EntregaService {
  private adminId: string;

  constructor(adminId: string) {
    this.adminId = adminId;
  }

  async getEntregasByAdmin(): Promise<EntregaComDetalhes[]> {
    try {
      const { data, error } = await supabase
        .from('entregas')
        .select(`
          id,
          vendedor_id,
          cliente_id,
          produto_id,
          valor,
          data_entrega,
          pago,
          status_entrega,
          status_pagamento,
          mes_cobranca,
          dataRetorno,
          created_at,
          updated_at,
          clientes!entregas_cliente_id_fkey (
            nome,
            sobrenome,
            cpf,
            telefone,
            email,
            endereco,
            numero,
            "Bairro",
          "Cidade",
          "Estado",
            cep
          ),
          vendedores!entregas_vendedor_id_fkey (
            nome,
            administrador_id
          ),
          produtos!entregas_produto_id_fkey (
            nome,
            preco
          )
        `)
        .eq('vendedores.administrador_id', this.adminId)
        .order('data_entrega', { ascending: false });

      if (error) {
        console.error('Erro ao buscar entregas:', error);
        throw error;
      }

      // Transformar os dados para o formato esperado
      const entregas: EntregaComDetalhes[] = (data || []).map((entrega: any) => ({
        id: String(entrega.id),
        vendedor_id: String(entrega.vendedor_id),
        cliente_id: String(entrega.cliente_id),
        produto_id: String(entrega.produto_id),
        valor: Number(entrega.valor),
        data_entrega: entrega.data_entrega,
        pago: Boolean(entrega.pago),
        status_entrega: entrega.status_entrega || null,
        status: entrega.status_pagamento, // Map status_pagamento to status
        status_pagamento: entrega.status_pagamento,
        mes_cobranca: entrega.mes_cobranca,
        dataRetorno: entrega.dataRetorno,
        created_at: entrega.created_at,
        updated_at: entrega.updated_at,
        observacoes: entrega.observacoes || null,
        // Flat properties for backward compatibility
        cliente_nome: (entrega.clientes as any)?.nome || '',
        cliente_sobrenome: (entrega.clientes as any)?.sobrenome || null,
        cliente_cpf: (entrega.clientes as any)?.cpf || '',
        cliente_telefone: (entrega.clientes as any)?.telefone || '',
        cliente_email: (entrega.clientes as any)?.email || null,
        cliente_endereco: (entrega.clientes as any)?.endereco || '',
        vendedor_nome: (entrega.vendedores as any)?.nome || '',
        produto_nome: (entrega.produtos as any)?.nome || '',
        produto_preco: Number((entrega.produtos as any)?.preco || 0),
        // Nested objects for component compatibility
        cliente: entrega.clientes ? {
          nome: (entrega.clientes as any).nome || '',
          sobrenome: (entrega.clientes as any).sobrenome || null,
          cpf: (entrega.clientes as any).cpf || '',
          telefone: (entrega.clientes as any).telefone || '',
          email: (entrega.clientes as any).email || null,
          endereco: (entrega.clientes as any).endereco || '',
          numero: (entrega.clientes as any).numero || '',
          bairro: (entrega.clientes as any).Bairro || '',
          cidade: (entrega.clientes as any).Cidade || '',
          estado: (entrega.clientes as any).Estado || '',
          cep: (entrega.clientes as any).cep || '',
          Bairro: (entrega.clientes as any).Bairro || '',
          Cidade: (entrega.clientes as any).Cidade || '',
          Estado: (entrega.clientes as any).Estado || '',
        } : undefined,
        vendedor: entrega.vendedores ? {
          nome: (entrega.vendedores as any).nome || '',
        } : undefined,
        produto: entrega.produtos ? {
          nome: (entrega.produtos as any).nome || '',
          preco: Number((entrega.produtos as any).preco || 0),
        } : undefined,
        // Default endereco_entrega from cliente endereco if not provided
        endereco_entrega: entrega.endereco_entrega || ((entrega.clientes as any)?.endereco ? 
          parseEndereco((entrega.clientes as any).endereco) : undefined),
        // Default pagamento info if available
        pagamento: entrega.pago ? {
          forma_pagamento: 'Pago',
          metodo_pagamento: 'N/A',
          valor: Number(entrega.valor),
          data_pagamento: entrega.dataRetorno,
          status: entrega.status_pagamento || 'pago',
        } : undefined,
      }));

      return entregas;
    } catch {
      // Error handling without logging sensitive data
      throw new Error('Erro ao buscar entregas');
    }
  }

  async getEntregasByVendedor(vendedorId: string): Promise<EntregaComDetalhes[]> {
    try {
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
        .from('entregas')
        .select(`
          id,
          vendedor_id,
          cliente_id,
          produto_id,
          valor,
          data_entrega,
          pago,
          status_entrega,
          status_pagamento,
          mes_cobranca,
          dataRetorno,
          created_at,
          updated_at,
          clientes!entregas_cliente_id_fkey (
            nome,
            sobrenome,
            cpf,
            telefone,
            email,
            endereco,
            numero,
            "Bairro",
          "Cidade",
          "Estado",
            cep
          ),
          vendedores!entregas_vendedor_id_fkey (
            nome
          ),
          produtos!entregas_produto_id_fkey (
            nome,
            preco
          )
        `)
        .eq('vendedor_id', vendedorId)
        .order('data_entrega', { ascending: false });

      if (error) {
        // Error handling without logging sensitive data
        throw new Error('Erro ao buscar entregas por vendedor');
      }

      // Transformar os dados para o formato esperado
      const entregas: EntregaComDetalhes[] = (data || []).map((entrega: any) => ({
        id: String(entrega.id),
        vendedor_id: String(entrega.vendedor_id),
        cliente_id: String(entrega.cliente_id),
        produto_id: String(entrega.produto_id),
        valor: Number(entrega.valor),
        data_entrega: entrega.data_entrega,
        pago: Boolean(entrega.pago),
        status_entrega: entrega.status_entrega || null,
        status: entrega.status_pagamento, // Map status_pagamento to status
        status_pagamento: entrega.status_pagamento,
        mes_cobranca: entrega.mes_cobranca,
        dataRetorno: entrega.dataRetorno,
        created_at: entrega.created_at,
        updated_at: entrega.updated_at,
        observacoes: entrega.observacoes || null,
        // Flat properties for backward compatibility
        cliente_nome: (entrega.clientes as any)?.nome || '',
        cliente_sobrenome: (entrega.clientes as any)?.sobrenome || null,
        cliente_cpf: (entrega.clientes as any)?.cpf || '',
        cliente_telefone: (entrega.clientes as any)?.telefone || '',
        cliente_email: (entrega.clientes as any)?.email || null,
        cliente_endereco: (entrega.clientes as any)?.endereco || '',
        vendedor_nome: (entrega.vendedores as any)?.nome || '',
        produto_nome: (entrega.produtos as any)?.nome || '',
        produto_preco: Number((entrega.produtos as any)?.preco || 0),
        // Nested objects for component compatibility
        cliente: entrega.clientes ? {
          nome: (entrega.clientes as any).nome || '',
          sobrenome: (entrega.clientes as any).sobrenome || null,
          cpf: (entrega.clientes as any).cpf || '',
          telefone: (entrega.clientes as any).telefone || '',
          email: (entrega.clientes as any).email || null,
          endereco: (entrega.clientes as any).endereco || '',
          numero: (entrega.clientes as any).numero || '',
          bairro: (entrega.clientes as any).Bairro || '',
          cidade: (entrega.clientes as any).Cidade || '',
          estado: (entrega.clientes as any).Estado || '',
          cep: (entrega.clientes as any).cep || '',
          Bairro: (entrega.clientes as any).Bairro || '',
          Cidade: (entrega.clientes as any).Cidade || '',
          Estado: (entrega.clientes as any).Estado || '',
        } : undefined,
        vendedor: entrega.vendedores ? {
          nome: (entrega.vendedores as any).nome || '',
        } : undefined,
        produto: entrega.produtos ? {
          nome: (entrega.produtos as any).nome || '',
          preco: Number((entrega.produtos as any).preco || 0),
        } : undefined,
        // Default endereco_entrega from cliente endereco if not provided
        endereco_entrega: entrega.endereco_entrega || ((entrega.clientes as any)?.endereco ? 
          parseEndereco((entrega.clientes as any).endereco) : undefined),
        // Default pagamento info if available
        pagamento: entrega.pago ? {
          forma_pagamento: 'Pago',
          metodo_pagamento: 'N/A',
          valor: Number(entrega.valor),
          data_pagamento: entrega.dataRetorno,
          status: entrega.status_pagamento || 'pago',
        } : undefined,
      }));

      return entregas;
    } catch {
      // Error handling without logging sensitive data
      throw new Error('Erro ao buscar entregas com filtros');
    }
  }

  async searchEntregas(filters: {
    vendedorId?: string;
    statusPagamento?: string;
    dataInicio?: string;
    dataFim?: string;
    clienteNome?: string;
  }): Promise<EntregaComDetalhes[]> {
    let query = supabase
      .from('entregas')
      .select(`
        id,
        vendedor_id,
        cliente_id,
        produto_id,
        valor,
        data_entrega,
        pago,
        status_entrega,
        status_pagamento,
        mes_cobranca,
        dataRetorno,
        created_at,
        updated_at,
        clientes!entregas_cliente_id_fkey (
          nome,
          sobrenome,
          cpf,
          telefone,
          email,
          endereco,
          numero,
          "Bairro",
          "Cidade",
          "Estado",
          cep
        ),
        vendedores!entregas_vendedor_id_fkey (
          nome,
          administrador_id
        ),
        produtos!entregas_produto_id_fkey (
          nome,
          preco
        )
      `)
      .eq('vendedores.administrador_id', this.adminId);

    if (filters.vendedorId) {
      query = query.eq('vendedor_id', filters.vendedorId);
    }

    if (filters.statusPagamento) {
      query = query.eq('status_pagamento', filters.statusPagamento);
    }

    if (filters.dataInicio) {
      query = query.gte('data_entrega', filters.dataInicio);
    }

    if (filters.dataFim) {
      query = query.lte('data_entrega', filters.dataFim);
    }

    query = query.order('data_entrega', { ascending: false });

    const { data, error } = await query;

    if (error) {
      console.error('Erro ao buscar entregas com filtros:', error);
      throw error;
    }

    // Transformar os dados para o formato esperado
    let entregas: EntregaComDetalhes[] = (data || []).map((entrega: any) => ({
      id: String(entrega.id),
      vendedor_id: String(entrega.vendedor_id),
      cliente_id: String(entrega.cliente_id),
      produto_id: String(entrega.produto_id),
      valor: Number(entrega.valor),
      data_entrega: entrega.data_entrega,
      pago: Boolean(entrega.pago),
      status_entrega: entrega.status_entrega || null,
      status: entrega.status_pagamento || 'pendente', // Add status property
      status_pagamento: entrega.status_pagamento,
      mes_cobranca: entrega.mes_cobranca,
      dataRetorno: entrega.dataRetorno,
      created_at: entrega.created_at,
      updated_at: entrega.updated_at,
      observacoes: entrega.observacoes || null,
      cliente_nome: (entrega.clientes as any)?.nome || '',
      cliente_sobrenome: (entrega.clientes as any)?.sobrenome || null,
      cliente_cpf: (entrega.clientes as any)?.cpf || '',
      cliente_telefone: (entrega.clientes as any)?.telefone || '',
      cliente_email: (entrega.clientes as any)?.email || null,
      cliente_endereco: (entrega.clientes as any)?.endereco || '',
      vendedor_nome: (entrega.vendedores as any)?.nome || '',
      produto_nome: (entrega.produtos as any)?.nome || '',
      produto_preco: Number((entrega.produtos as any)?.preco || 0),
      // Nested objects for component compatibility
      cliente: entrega.clientes ? {
          nome: (entrega.clientes as any).nome || '',
          sobrenome: (entrega.clientes as any).sobrenome || null,
          cpf: (entrega.clientes as any).cpf || '',
          telefone: (entrega.clientes as any).telefone || '',
          email: (entrega.clientes as any).email || null,
          endereco: (entrega.clientes as any).endereco || '',
          numero: (entrega.clientes as any).numero || '',
          bairro: (entrega.clientes as any).Bairro || '',
          cidade: (entrega.clientes as any).Cidade || '',
          estado: (entrega.clientes as any).Estado || '',
          cep: (entrega.clientes as any).cep || '',
          Bairro: (entrega.clientes as any).Bairro || '',
          Cidade: (entrega.clientes as any).Cidade || '',
          Estado: (entrega.clientes as any).Estado || '',
        } : undefined,
      vendedor: entrega.vendedores ? {
        nome: (entrega.vendedores as any).nome || '',
      } : undefined,
      produto: entrega.produtos ? {
        nome: (entrega.produtos as any).nome || '',
        preco: Number((entrega.produtos as any).preco || 0),
      } : undefined,
      // Default endereco_entrega from cliente endereco if not provided
      endereco_entrega: entrega.endereco_entrega || ((entrega.clientes as any)?.endereco ? 
        parseEndereco((entrega.clientes as any).endereco) : undefined),
      // Default pagamento info if available
      pagamento: entrega.pago ? {
        forma_pagamento: 'Pago',
        metodo_pagamento: 'N/A',
        valor: Number(entrega.valor),
        data_pagamento: entrega.dataRetorno,
        status: entrega.status_pagamento || 'pago',
      } : undefined,
    }));

    // Filtrar por nome do cliente se especificado
    if (filters.clienteNome) {
      const clienteNomeLower = filters.clienteNome.toLowerCase();
      entregas = entregas.filter(entrega =>
        entrega.cliente_nome.toLowerCase().includes(clienteNomeLower) ||
        (entrega.cliente_sobrenome && entrega.cliente_sobrenome.toLowerCase().includes(clienteNomeLower))
      );
    }

    return entregas;
  }

  // Busca detalhada de uma entrega com itens da cesta, itens adicionais e totais
  async getEntregaDetalhadaById(entregaId: string): Promise<EntregaComDetalhes> {
    // Buscar a entrega com joins básicos
    const { data: entrega, error: entregaError } = await supabase
      .from('entregas')
      .select(`
        id,
        vendedor_id,
        cliente_id,
        produto_id,
        valor,
        data_entrega,
        pago,
        status_entrega,
        status_pagamento,
        mes_cobranca,
        dataRetorno,
        created_at,
        updated_at,
        clientes!entregas_cliente_id_fkey (
          nome,
          sobrenome,
          cpf,
          telefone,
          email,
          endereco,
          cep,
          numero,
          "Bairro",
          "Cidade",
          "Estado",
          complemento
        ),
        vendedores!entregas_vendedor_id_fkey (
          nome
        ),
        produtos!entregas_produto_id_fkey (
          id,
          nome,
          preco
        )
      `)
      .eq('id', entregaId)
      .single();

    if (entregaError || !entrega) {
      throw new Error('Entrega não encontrada');
    }

    // Itens da cesta (produtos_na_cesta) vinculados ao produto (cesta)
    const cestaId = (entrega.produtos as any)?.id || entrega.produto_id;
    const { data: itensCesta, error: itensCestaError } = await supabase
      .from('produtos_na_cesta')
      .select(`
        quantidade,
        produtos_cadastrado!inner (
          id,
          produto_nome,
          produto_cod,
          categoria,
          preco_unt
        )
      `)
      .eq('cesta_id', cestaId);

    if (itensCestaError) {
      throw new Error('Erro ao buscar itens da cesta');
    }

    // Itens adicionais da entrega (itens_entrega)
    const { data: itensEntrega, error: itensEntregaError } = await supabase
      .from('itens_entrega')
      .select(`
        id,
        quantidade,
        preco_unitario,
        subtotal,
        produtos_cadastrado!inner (
          id,
          produto_nome,
          produto_cod,
          categoria,
          preco_unt
        )
      `)
      .eq('entrega_id', entrega.id);

    if (itensEntregaError) {
      throw new Error('Erro ao buscar itens adicionais da entrega');
    }

    // Mapear para o formato esperado
    const detalhesBase: EntregaComDetalhes = {
      id: String(entrega.id),
      vendedor_id: String(entrega.vendedor_id),
      cliente_id: String(entrega.cliente_id),
      produto_id: String(entrega.produto_id),
      valor: Number(entrega.valor),
      data_entrega: entrega.data_entrega,
      pago: Boolean(entrega.pago),
      status_entrega: (entrega as any).status_entrega || null,
      status: entrega.status_pagamento,
      status_pagamento: entrega.status_pagamento,
      mes_cobranca: entrega.mes_cobranca,
      dataRetorno: entrega.dataRetorno,
      created_at: entrega.created_at,
      updated_at: entrega.updated_at,
      observacoes: (entrega as any).observacoes || null,
      cliente_nome: (entrega.clientes as any)?.nome || '',
      cliente_sobrenome: (entrega.clientes as any)?.sobrenome || null,
      cliente_cpf: (entrega.clientes as any)?.cpf || '',
      cliente_telefone: (entrega.clientes as any)?.telefone || '',
      cliente_email: (entrega.clientes as any)?.email || null,
      cliente_endereco: (entrega.clientes as any)?.endereco || '',
      vendedor_nome: (entrega.vendedores as any)?.nome || '',
      produto_nome: (entrega.produtos as any)?.nome || '',
      produto_preco: Number((entrega.produtos as any)?.preco || 0),
      cliente: entrega.clientes ? {
        nome: (entrega.clientes as any).nome || '',
        sobrenome: (entrega.clientes as any).sobrenome || null,
        cpf: (entrega.clientes as any).cpf || '',
        telefone: (entrega.clientes as any).telefone || '',
        email: (entrega.clientes as any).email || null,
        endereco: (entrega.clientes as any).endereco || '',
        numero: (entrega.clientes as any).numero || '',
        Bairro: (entrega.clientes as any).Bairro || '',
        Cidade: (entrega.clientes as any).Cidade || '',
        Estado: (entrega.clientes as any).Estado || '',
        bairro: (entrega.clientes as any).Bairro || '',
        cidade: (entrega.clientes as any).Cidade || '',
        estado: (entrega.clientes as any).Estado || '',
        cep: (entrega.clientes as any).cep || '',
        complemento: (entrega.clientes as any).complemento || null,
      } : undefined,
      vendedor: entrega.vendedores ? {
        nome: (entrega.vendedores as any).nome || '',
      } : undefined,
      produto: entrega.produtos ? {
        nome: (entrega.produtos as any).nome || '',
        preco: Number((entrega.produtos as any).preco || 0),
      } : undefined,
      endereco_entrega: (entrega.clientes as any)?.endereco ?
        parseEndereco((entrega.clientes as any).endereco) : undefined,
    };

    const cesta_itens = (itensCesta || []).map((item: any) => ({
      produto: {
        id: String(item.produtos_cadastrado?.id || ''),
        produto_nome: String(item.produtos_cadastrado?.produto_nome || ''),
        produto_cod: String(item.produtos_cadastrado?.produto_cod || ''),
        categoria: String(item.produtos_cadastrado?.categoria || ''),
        preco_unt: Number(item.produtos_cadastrado?.preco_unt || 0),
      },
      quantidade: Number(item.quantidade || 0),
    }));

    const itens_adicionais = (itensEntrega || []).map((item: any) => ({
      id: String(item.id),
      quantidade: Number(item.quantidade || 0),
      preco_unitario: Number(item.preco_unitario || 0),
      subtotal: Number(item.subtotal || 0),
      produto: {
        id: String(item.produtos_cadastrado?.id || ''),
        produto_nome: String(item.produtos_cadastrado?.produto_nome || ''),
        produto_cod: String(item.produtos_cadastrado?.produto_cod || ''),
        categoria: String(item.produtos_cadastrado?.categoria || ''),
        preco_unt: Number(item.produtos_cadastrado?.preco_unt || 0),
      },
    }));

    const valor_cesta = Number(detalhesBase.valor || detalhesBase.produto_preco || 0);
    const valor_adicionais = itens_adicionais.reduce((acc, curr) => acc + Number(curr.subtotal || 0), 0);
    const valor_total = valor_cesta + valor_adicionais;

    return {
      ...detalhesBase,
      cesta_itens,
      itens_adicionais,
      valor_cesta,
      valor_adicionais,
      valor_total,
    };
  }
}

