import { supabase } from '../lib/supabase';

export interface CestaBase {
  id: string;
  administrador_id: string;
  nome: string;
  descricao?: string;
  preco: number;
  ativo: boolean;
  created_at?: string;
  updated_at?: string;
  cestas_base_itens?: ItemCestaBase[];
}

export interface ItemCestaBase {
  id: string;
  cesta_base_id: string;
  produto_cadastrado_id: string;
  quantidade: number;
  created_at?: string;
  produto?: {
    produto_nome: string;
    preco_unt: number;
    unidade_medida: string;
  };
}

export interface CreateCestaBaseData {
  nome: string;
  descricao?: string;
  preco?: number;
  itens: {
    produto_cadastrado_id: string;
    quantidade: number;
  }[];
}

export class CestaBaseService {
  static async listar(adminId: string): Promise<CestaBase[]> {
    try {
      const { data, error } = await supabase
        .from('cestas_base')
        .select(`
          *,
          cestas_base_itens (
            *,
            produto:produtos_cadastrado(produto_nome, preco_unt, unidade_medida)
          )
        `)
        .eq('administrador_id', adminId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Erro ao listar cestas base:', error);
      throw error;
    }
  }

  static async criar(adminId: string, dados: CreateCestaBaseData): Promise<CestaBase> {
    try {
      const { data: cesta, error: cestaError } = await supabase
        .from('cestas_base')
        .insert([{
          administrador_id: adminId,
          nome: dados.nome,
          descricao: dados.descricao,
          preco: dados.preco || 0,
          ativo: true
        }])
        .select()
        .single();

      if (cestaError) throw cestaError;

      if (dados.itens && dados.itens.length > 0) {
        const itensParaInserir = dados.itens.map(item => ({
          cesta_base_id: cesta.id,
          produto_cadastrado_id: item.produto_cadastrado_id,
          quantidade: item.quantidade
        }));

        const { error: itensError } = await supabase
          .from('cestas_base_itens')
          .insert(itensParaInserir);

        if (itensError) {
          // Tenta remover a cesta em caso de erro nos itens (rollback manual)
          await supabase.from('cestas_base').delete().eq('id', cesta.id);
          throw itensError;
        }
      }

      return cesta;
    } catch (error) {
      console.error('Erro ao criar cesta base:', error);
      throw error;
    }
  }

  static async atualizar(id: string, dados: Partial<CreateCestaBaseData>): Promise<CestaBase> {
    try {
      const updateData: any = { updated_at: new Date().toISOString() };
      if (dados.nome !== undefined) updateData.nome = dados.nome;
      if (dados.descricao !== undefined) updateData.descricao = dados.descricao;
      if (dados.preco !== undefined) updateData.preco = dados.preco;

      const { data: cestaAtualizada, error: updateError } = await supabase
        .from('cestas_base')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (updateError) throw updateError;

      if (dados.itens) {
        // Remove itens antigos
        await supabase.from('cestas_base_itens').delete().eq('cesta_base_id', id);

        // Insere novos
        if (dados.itens.length > 0) {
          const itensParaInserir = dados.itens.map(item => ({
            cesta_base_id: id,
            produto_cadastrado_id: item.produto_cadastrado_id,
            quantidade: item.quantidade
          }));
          const { error: itensError } = await supabase.from('cestas_base_itens').insert(itensParaInserir);
          if (itensError) throw itensError;
        }
      }

      return cestaAtualizada;
    } catch (error) {
      console.error('Erro ao atualizar cesta base:', error);
      throw error;
    }
  }

  static async excluir(id: string): Promise<void> {
    try {
      // Como o cascade apaga os itens automaticamente, basta deletar a cesta base
      const { error } = await supabase.from('cestas_base').delete().eq('id', id);
      if (error) throw error;
    } catch (error) {
      console.error('Erro ao excluir cesta base:', error);
      throw error;
    }
  }

  static async distribuirParaVendedor(cestaBaseId: string, vendedorId: string, adminId: string): Promise<string> {
    try {
      const { data, error } = await supabase.rpc('distribuir_cesta_para_vendedor', {
        p_cesta_base_id: cestaBaseId,
        p_vendedor_id: vendedorId,
        p_administrador_id: adminId
      });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Erro ao distribuir cesta base para vendedor:', error);
      throw error;
    }
  }
}
