import { supabase, type Vendedor } from '../lib/supabase';

export class VendedorService {
  private administradorId: string;

  constructor(administradorId?: string) {
    this.administradorId = administradorId || '';
  }

  // Método de instância para compatibilidade
  async getById(id: string): Promise<Vendedor | null> {
    return VendedorService.getVendedorById(id, this.administradorId);
  }

  // Método de instância para compatibilidade
  async update(id: string, vendedorData: Partial<Vendedor>): Promise<Vendedor> {
    return VendedorService.updateVendedor(id, vendedorData, this.administradorId);
  }

  // Buscar todos os vendedores de um administrador específico
  static async getVendedoresByAdmin(administradorId: string): Promise<Vendedor[]> {
    try {
      const { data, error } = await supabase
        .from('vendedores')
        .select('*')
        .eq('administrador_id', administradorId)
        .order('created_at', { ascending: false });

      if (error) {
        // Error handling without logging sensitive data
        throw new Error('Erro ao buscar vendedores');
      }

      return data || [];
    } catch {
      // Error handling without logging sensitive data
      throw new Error('Erro ao buscar vendedores');
    }
  }

  // Buscar vendedor por ID (verificando se pertence ao administrador)
  static async getVendedorById(id: string, administradorId: string): Promise<Vendedor | null> {
    const { data, error } = await supabase
      .from('vendedores')
      .select('*')
      .eq('id', id)
      .eq('administrador_id', administradorId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Vendedor não encontrado
      }
      // Error handling without logging sensitive data
      throw new Error('Erro ao buscar vendedor');
    }

    return data;
  }

  // Criar novo vendedor
  static async createVendedor(vendedorData: Omit<Vendedor, 'id' | 'created_at'>): Promise<Vendedor> {
    try {
      console.log('Tentando criar vendedor com dados:', vendedorData);
      
      const { data, error } = await supabase
        .from('vendedores')
        .insert([vendedorData])
        .select()
        .single();

      if (error) {
        console.error('Erro do Supabase:', error);
        
        // Tratamento de erros específicos
        if (error.code === '23505') {
          throw new Error('Email já está em uso por outro vendedor');
        } else if (error.code === '23502') {
          throw new Error('Campos obrigatórios não preenchidos');
        } else if (error.code === '42P01') {
          throw new Error('Tabela vendedores não encontrada no banco de dados');
        } else if (error.code === '23503') {
          throw new Error('Administrador não encontrado');
        } else {
          throw new Error(`Erro no banco de dados: ${error.message}`);
        }
      }

      // Debug: verificar se data está vazio mesmo sem erro
      console.log('Resultado da inserção - Data:', data);
      console.log('Resultado da inserção - Error:', error);

      if (!data) {
        console.warn('⚠️ AVISO: Data é null/undefined mesmo sem erro!');
        // Tentar buscar o vendedor recém-criado pelo email
        const { data: searchData, error: searchError } = await supabase
          .from('vendedores')
          .select('*')
          .eq('email', vendedorData.email)
          .eq('administrador_id', vendedorData.administrador_id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (searchError) {
          console.error('Erro ao buscar vendedor recém-criado:', searchError);
          throw new Error('Vendedor pode ter sido criado, mas não foi possível confirmar');
        }

        if (searchData) {
          console.log('✅ Vendedor encontrado após busca:', searchData);
          return searchData;
        } else {
          throw new Error('Vendedor não foi criado - dados não encontrados');
        }
      }

      console.log('Vendedor criado com sucesso:', data);
      return data;
    } catch (error) {
      console.error('Erro no createVendedor:', error);
      throw error;
    }
  }

  // Atualizar vendedor
  static async updateVendedor(id: string, vendedorData: Partial<Vendedor>, administradorId: string): Promise<Vendedor> {
    const { data, error } = await supabase
      .from('vendedores')
      .update(vendedorData)
      .eq('id', id)
      .eq('administrador_id', administradorId)
      .select()
      .single();

    if (error) {
      // Error handling without logging sensitive data
      throw new Error('Erro ao atualizar vendedor');
    }

    return data;
  }

  // Deletar vendedor
  static async deleteVendedor(id: string, administradorId: string): Promise<boolean> {
    const { error } = await supabase
      .from('vendedores')
      .delete()
      .eq('id', id)
      .eq('administrador_id', administradorId);

    if (error) {
      // Error handling without logging sensitive data
      throw new Error('Erro ao deletar vendedor');
    }

    return true;
  }

  // Buscar vendedores ativos de um administrador
  static async getVendedoresAtivos(administradorId: string): Promise<Vendedor[]> {
    const { data, error } = await supabase
      .from('vendedores')
      .select('*')
      .eq('administrador_id', administradorId)
      .eq('ativo', true)
      .order('nome', { ascending: true });

    if (error) {
      // Error handling without logging sensitive data
      throw new Error('Erro ao buscar vendedores ativos');
    }

    return data || [];
  }

  // Atualizar status do vendedor
  static async updateStatusVendedor(id: string, ativo: boolean, administradorId: string): Promise<boolean> {
    const { error } = await supabase
      .from('vendedores')
      .update({ ativo })
      .eq('id', id)
      .eq('administrador_id', administradorId);

    if (error) {
      // Error handling without logging sensitive data
      throw new Error('Erro ao atualizar status do vendedor');
    }

    return true;
  }

  // Buscar vendedores por filtros
  static async buscarVendedoresPorFiltros(
    administradorId: string,
    filters: {
      nome?: string;
      email?: string;
      ativo?: boolean;
      tipo_vinculo?: string;
    }
  ): Promise<Vendedor[]> {
    let query = supabase
      .from('vendedores')
      .select('*')
      .eq('administrador_id', administradorId);

    if (filters.nome) {
      query = query.ilike('nome', `%${filters.nome}%`);
    }

    if (filters.email) {
      query = query.ilike('email', `%${filters.email}%`);
    }

    if (filters.ativo !== undefined) {
      query = query.eq('ativo', filters.ativo);
    }

    if (filters.tipo_vinculo) {
      query = query.eq('tipo_vinculo', filters.tipo_vinculo);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      // Error handling without logging sensitive data
      throw new Error('Erro ao buscar vendedores com filtros');
    }

    return data || [];
  }
}

