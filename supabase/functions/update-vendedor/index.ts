
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import * as bcrypt from "https://deno.land/x/bcrypt@v0.4.1/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

const registrarLog = async (dados: {
  administrador_id?: string
  tipo: 'info' | 'warning' | 'error'
  servico: string
  mensagem: string
  stack?: string
}) => {
  try {
    await supabaseAdmin.from('logs_sistema').insert([{
      ...dados,
      timestamp: new Date().toISOString()
    }]);
  } catch (err) {
    console.error('Erro ao registrar log:', err);
  }
};

const badRequest = (error: string) =>
  new Response(JSON.stringify({ error }), {
    status: 400,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });

async function resolveCaller(req: Request) {
  const authHeader = req.headers.get('Authorization') || '';
  if (!authHeader.startsWith('Bearer ')) {
    return { error: 'Não autorizado', status: 401 } as const;
  }

  const token = authHeader.slice(7).trim();
  if (!token) return { error: 'Não autorizado', status: 401 } as const;

  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !user) return { error: 'Não autorizado', status: 401 } as const;

  const { data: dev } = await supabaseAdmin
    .from('desenvolvedores')
    .select('user_id, ativo')
    .eq('user_id', user.id)
    .eq('ativo', true)
    .maybeSingle();

  if (dev) return { user, type: 'superadmin' as const, adminId: null };

  const { data: admin } = await supabaseAdmin
    .from('administradores')
    .select('id')
    .eq('id', user.id)
    .maybeSingle();

  if (admin) return { user, type: 'admin' as const, adminId: admin.id };

  const { data: funcionario } = await supabaseAdmin
    .from('funcionarios')
    .select('administrador_id, ativo, bloqueado, permissoes')
    .eq('auth_user_id', user.id)
    .maybeSingle();

  if (
    funcionario &&
    funcionario.ativo === true &&
    funcionario.bloqueado !== true &&
    funcionario.permissoes?.vendedores === true
  ) {
    return { user, type: 'funcionario' as const, adminId: funcionario.administrador_id };
  }

  return { error: 'Sem permissão para gerenciar vendedores', status: 403 } as const;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const servico = 'update-vendedor';
  let administrador_id: string | undefined;

  try {
    const caller = await resolveCaller(req);
    if ('error' in caller) {
      return new Response(JSON.stringify({ error: caller.error }), {
        status: caller.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const body = await req.json();
    const { vendedor_id, senha, administrador_id: requestedAdminId, ...rawUpdateData } = body ?? {};

    if (!vendedor_id) return badRequest('vendedor_id é obrigatório');

    let vendedorQuery = supabaseAdmin
      .from('vendedores')
      .select('id, auth_user_id, administrador_id, nome')
      .eq('id', vendedor_id);

    if (caller.type !== 'superadmin') {
      vendedorQuery = vendedorQuery.eq('administrador_id', caller.adminId!);
    }

    const { data: atual, error: lookupError } = await vendedorQuery.maybeSingle();
    if (lookupError) throw lookupError;

    if (!atual) {
      return new Response(JSON.stringify({ error: 'Vendedor não encontrado ou fora do seu tenant' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    administrador_id = atual.administrador_id;

    if (
      caller.type !== 'superadmin' &&
      requestedAdminId &&
      requestedAdminId !== atual.administrador_id
    ) {
      return new Response(JSON.stringify({ error: 'Não é permitido mover vendedor entre tenants' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const updateData: Record<string, unknown> = { ...rawUpdateData };

    // Normaliza os nomes usados pelo formulário React para as colunas reais do banco.
    const renomear: [string, string][] = [
      ['percentualMinimo', 'percentual_minimo'],
      ['diaFechamento', 'dia_fechamento'],
      ['tipoVinculo', 'tipo_vinculo'],
      ['dataInicio', 'data_inicio'],
      ['comissaoPercentual', 'comissao_percentual'],
      ['tipoContrato', 'tipo_contrato'],
    ];
    for (const [de, para] of renomear) {
      if (de in updateData) {
        if (!(para in updateData)) updateData[para] = updateData[de];
        delete updateData[de];
      }
    }

    if ('dia_fechamento' in updateData) {
      const dia = Number(updateData.dia_fechamento);
      if (!Number.isInteger(dia) || dia < 1 || dia > 28) {
        return badRequest('Dia de fechamento deve estar entre 1 e 28');
      }
      updateData.dia_fechamento = dia;
    }

    if ('percentual_minimo' in updateData) {
      const percentual = Number(updateData.percentual_minimo);
      if (!Number.isFinite(percentual) || percentual < 0 || percentual > 100) {
        return badRequest('Percentual mínimo deve estar entre 0 e 100');
      }
      updateData.percentual_minimo = percentual;
    }

    // Comissão e tipo de contrato: só o dono (e o superadmin) definem.
    if (caller.type === 'funcionario') {
      delete updateData.comissao_percentual;
      delete updateData.tipo_contrato;
    }

    if ('comissao_percentual' in updateData) {
      const comissao = Number(updateData.comissao_percentual);
      if (!Number.isFinite(comissao) || comissao < 0 || comissao > 100) {
        return badRequest('Comissão deve estar entre 0 e 100');
      }
      updateData.comissao_percentual = Math.round(comissao * 100) / 100;
    }

    if ('tipo_contrato' in updateData) {
      const tipo = updateData.tipo_contrato;
      if (tipo === '' || tipo === null) {
        updateData.tipo_contrato = null;
      } else if (tipo !== 'efetivado' && tipo !== 'autonomo') {
        return badRequest('Tipo de contrato deve ser efetivado ou autônomo');
      }
    }

    const forbidden = [
      'id', 'auth_user_id', 'administrador_id', 'senha_hash',
      'mp_preapproval_id_vendedor'
    ];
    for (const key of forbidden) delete updateData[key];

    await registrarLog({
      tipo: 'info',
      servico,
      mensagem: `Início da atualização do vendedor ID: ${vendedor_id} pelo usuário ${caller.user.id}`,
      administrador_id
    });

    if (senha) {
      if (!/^\d{6}$/.test(String(senha))) {
        return badRequest('Senha deve conter exatamente 6 números');
      }

      updateData.senha_hash = await bcrypt.hash(String(senha));
      const authUserId = atual.auth_user_id || atual.id;

      const { error: authUpdateError } = await supabaseAdmin.auth.admin.updateUserById(authUserId, {
        password: String(senha)
      });
      if (authUpdateError) throw authUpdateError;
    }

    const { data: vendedor, error: vendedorError } = await supabaseAdmin
      .from('vendedores')
      .update(updateData)
      .eq('id', atual.id)
      .eq('administrador_id', atual.administrador_id)
      .select()
      .single();

    if (vendedorError) throw vendedorError;

    await registrarLog({
      tipo: 'info',
      servico,
      mensagem: `Vendedor ID: ${vendedor_id} atualizado com sucesso.`,
      administrador_id
    });

    return new Response(JSON.stringify({ vendedor }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    console.error('ERRO:', error);
    await registrarLog({
      tipo: 'error',
      servico,
      mensagem: `Erro ao atualizar vendedor: ${error?.message ?? 'erro desconhecido'}`,
      stack: error?.stack,
      administrador_id
    });

    return new Response(JSON.stringify({ error: error?.message ?? 'Erro ao atualizar vendedor' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
