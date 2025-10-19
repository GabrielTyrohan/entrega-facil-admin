import { supabase, type Cliente } from '../lib/supabase';

export class ClienteService {
  private administradorId: string;

  constructor(administradorId?: string) {
    this.administradorId = administradorId || '';
  }

  // Buscar todos os clientes dos vendedores de um administrador específico
  async getClientesByAdmin(): Promise<Cliente[]> {
    try {
      const { data, error } = await supabase
        .from('clientes')
        .select(`
          *,
          vendedores!inner(
            id,
            nome,
            administrador_id
          )
        `)
        .eq('vendedores.administrador_id', this.administradorId)
        .eq('ativo', true)
        .order('created_at', { ascending: false });

      if (error) {
        // Error handling without logging sensitive data
        throw new Error('Erro ao buscar clientes');
      }

      return data || [];
    } catch {
      // Error handling without logging sensitive data
      throw new Error('Erro ao buscar clientes');
    }
  }

  // Buscar clientes por vendedor específico
  async getClientesByVendedor(vendedorId: string): Promise<Cliente[]> {
    try {
      const { data, error } = await supabase
        .from('clientes')
        .select('*')
        .eq('vendedor_id', vendedorId)
        .eq('ativo', true)
        .order('nome', { ascending: true });

      if (error) {
        // Error handling without logging sensitive data
        throw new Error('Erro ao buscar clientes do vendedor');
      }

      return data || [];
    } catch {
      // Error handling without logging sensitive data
      throw new Error('Erro ao buscar clientes do vendedor');
    }
  }

  // Buscar cliente por ID
  async getClienteById(id: string): Promise<Cliente | null> {
    try {
      const { data, error } = await supabase
        .from('clientes')
        .select(`
          *,
          vendedores!inner(
            id,
            nome,
            administrador_id
          )
        `)
        .eq('id', id)
        .eq('vendedores.administrador_id', this.administradorId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null; // Cliente não encontrado
        }
        // Error handling without logging sensitive data
        throw new Error('Erro ao buscar cliente');
      }

      return data;
    } catch {
      // Error handling without logging sensitive data
      throw new Error('Erro ao buscar cliente');
    }
  }

  // Buscar clientes com filtros
  async searchClientes(filters: {
    nome?: string;
    cpf?: string;
    vendedorId?: string;
  }): Promise<Cliente[]> {
    try {
      let query = supabase
        .from('clientes')
        .select(`
          *,
          vendedores!inner(
            id,
            nome,
            administrador_id
          )
        `)
        .eq('vendedores.administrador_id', this.administradorId)
        .eq('ativo', true);

      if (filters.nome) {
        query = query.ilike('nome', `%${filters.nome}%`);
      }

      if (filters.cpf) {
        query = query.ilike('cpf', `%${filters.cpf}%`);
      }

      if (filters.vendedorId) {
        query = query.eq('vendedor_id', filters.vendedorId);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) {
        // Error handling without logging sensitive data
        throw new Error('Erro ao buscar clientes com filtros');
      }

      return data || [];
    } catch {
      // Error handling without logging sensitive data
      throw new Error('Erro ao buscar clientes com filtros');
    }
  }
}

