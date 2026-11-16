import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

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
    }])
  } catch (err) {
    console.error('Erro ao registrar log:', err)
  }
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })

/**
 * Recalcula o valor da assinatura do administrador e atualiza o
 * preapproval no Mercado Pago.
 *
 * Quem pode chamar:
 *  - o próprio administrador (JWT dele);
 *  - um desenvolvedor ativo (superadmin), informando administrador_id.
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const servico = 'atualizar-assinatura'
  let administrador_id: string | undefined

  try {
    const bodyText = await req.text()
    const body = bodyText ? JSON.parse(bodyText) : {}

    const authHeader = req.headers.get('Authorization') || ''
    if (!authHeader.startsWith('Bearer ')) return json({ error: 'Não autenticado' }, 401)

    const token = authHeader.slice(7).trim()
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
    if (authError || !user) return json({ error: 'Sessão inválida' }, 401)

    const { data: dev } = await supabaseAdmin
      .from('desenvolvedores')
      .select('user_id')
      .eq('user_id', user.id)
      .eq('ativo', true)
      .maybeSingle()

    if (dev) {
      administrador_id = body.administrador_id
      if (!administrador_id) return json({ error: 'administrador_id é obrigatório' }, 400)
    } else {
      if (body.administrador_id && body.administrador_id !== user.id) {
        return json({ error: 'Administrador incompatível com a sessão' }, 403)
      }
      const { data: callerAdmin } = await supabaseAdmin
        .from('administradores')
        .select('id')
        .eq('id', user.id)
        .maybeSingle()
      if (!callerAdmin) return json({ error: 'Acesso restrito ao administrador' }, 403)
      administrador_id = callerAdmin.id
    }

    await registrarLog({
      tipo: 'info',
      servico,
      mensagem: `Início da atualização de assinatura para admin ${administrador_id}`,
      administrador_id
    })

    const { data: admin, error: adminError } = await supabaseAdmin
      .from('administradores')
      .select('id, mp_preapproval_id, valor_assinatura')
      .eq('id', administrador_id)
      .single()

    if (adminError || !admin) throw new Error('Administrador não encontrado')
    if (!admin.mp_preapproval_id) throw new Error('Assinatura não encontrada')

    const { data: calculo, error: calcError } = await supabaseAdmin
      .rpc('calcular_valor_assinatura_admin', { p_administrador_id: administrador_id })
      .single()

    if (calcError || !calculo) {
      throw new Error(`Falha ao calcular valor da assinatura: ${calcError?.message ?? 'sem retorno'}`)
    }

    const novoValor = Number(calculo.valor_total)
    const representados = Number(calculo.vendedores_representados)

    const mpToken = Deno.env.get('MERCADOPAGO_ACCESS_TOKEN')
    if (!mpToken) throw new Error('MERCADOPAGO_ACCESS_TOKEN não configurado')

    const mpResponse = await fetch(`https://api.mercadopago.com/preapproval/${admin.mp_preapproval_id}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${mpToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        auto_recurring: { transaction_amount: novoValor }
      })
    })

    if (!mpResponse.ok) {
      const errorData = await mpResponse.text()
      throw new Error(`Erro ao atualizar valor no Mercado Pago: ${errorData}`)
    }

    const { error: updateError } = await supabaseAdmin
      .from('administradores')
      .update({ valor_assinatura: novoValor, quantidade_vendedores: representados })
      .eq('id', administrador_id)

    if (updateError) throw updateError

    await registrarLog({
      tipo: 'info',
      servico,
      mensagem: `Assinatura atualizada de R$ ${admin.valor_assinatura ?? '?'} para R$ ${novoValor} (${representados} representado(s))`,
      administrador_id
    })

    return json({
      success: true,
      valor_anterior: admin.valor_assinatura,
      novo_valor: novoValor,
      vendedores_representados: representados,
      vendedores_autonomos: Number(calculo.vendedores_autonomos)
    })
  } catch (error: any) {
    console.error('ERRO:', error)
    await registrarLog({
      tipo: 'error',
      servico,
      mensagem: `Erro ao atualizar assinatura: ${error.message}`,
      stack: error.stack,
      administrador_id
    })
    return json({ error: error.message }, 500)
  }
})
