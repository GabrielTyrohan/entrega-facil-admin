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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  let body: any = {}
  try {
    const bodyText = await req.text()
    if (bodyText) body = JSON.parse(bodyText)
  } catch (e) {
    console.error('Erro ao parsear body:', e)
  }

  const authHeader = req.headers.get('Authorization') || ''
  if (!authHeader.startsWith('Bearer ')) return json({ error: 'Não autenticado' }, 401)

  const token = authHeader.slice(7).trim()
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
  if (authError || !user) return json({ error: 'Sessão inválida' }, 401)

  const { data: callerAdmin } = await supabaseAdmin
    .from('administradores')
    .select('id, email')
    .eq('id', user.id)
    .maybeSingle()
  if (!callerAdmin) return json({ error: 'Acesso restrito ao administrador' }, 403)

  if (body.administrador_id && body.administrador_id !== callerAdmin.id) {
    return json({ error: 'Administrador incompatível com a sessão' }, 403)
  }

  const administrador_id: string = callerAdmin.id
  const email: string = callerAdmin.email
  const servico = 'criar-assinatura'

  await registrarLog({
    tipo: 'info',
    servico,
    mensagem: `Início da criação de assinatura para ${email || 'email não informado'}`,
    administrador_id
  })

  try {
    if (!email) throw new Error('E-mail do administrador não cadastrado')

    // Valor calculado no banco: base + valor por vendedor REPRESENTADO ativo.
    // Autônomos pagam a própria assinatura e não entram aqui.
    const { data: calculo, error: calcError } = await supabaseAdmin
      .rpc('calcular_valor_assinatura_admin', { p_administrador_id: administrador_id })
      .single()

    if (calcError || !calculo) {
      throw new Error(`Falha ao calcular valor da assinatura: ${calcError?.message ?? 'sem retorno'}`)
    }

    const valorTotal = Number(calculo.valor_total)
    const representados = Number(calculo.vendedores_representados)

    const url = new URL(req.url)
    const backUrl = `${url.origin}/dashboard`

    const mpToken = Deno.env.get('MERCADOPAGO_ACCESS_TOKEN')
    if (!mpToken) throw new Error('MERCADOPAGO_ACCESS_TOKEN não configurado')

    const mpResponse = await fetch('https://api.mercadopago.com/preapproval', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${mpToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        reason: 'Assinatura Entrega Fácil',
        auto_recurring: {
          frequency: 1,
          frequency_type: 'months',
          transaction_amount: valorTotal,
          currency_id: 'BRL'
        },
        back_url: backUrl,
        payer_email: email,
        external_reference: administrador_id
      })
    })

    const responseText = await mpResponse.text()
    let assinatura: any
    try {
      assinatura = JSON.parse(responseText)
    } catch {
      throw new Error(`Erro ao parsear resposta do MP: ${responseText}`)
    }

    if (!mpResponse.ok || !assinatura.id) {
      throw new Error(`Erro MP: ${JSON.stringify(assinatura)}`)
    }

    const { error: updateError } = await supabaseAdmin
      .from('administradores')
      .update({
        mp_preapproval_id: assinatura.id,
        mp_payer_email: email,
        valor_assinatura: valorTotal,
        quantidade_vendedores: representados,
        status_pagamento: 'pendente'
      })
      .eq('id', administrador_id)

    if (updateError) throw updateError

    await registrarLog({
      tipo: 'info',
      servico,
      mensagem: `Assinatura criada para ${email}. Valor: R$ ${valorTotal} (${representados} representado(s))`,
      administrador_id
    })

    return json({
      success: true,
      init_point: assinatura.init_point,
      preapproval_id: assinatura.id,
      valor_total: valorTotal,
      vendedores_representados: representados,
      vendedores_autonomos: Number(calculo.vendedores_autonomos),
      // compatibilidade com o front atual
      vendedores_ativos: representados
    })
  } catch (error: any) {
    console.error('ERRO GERAL:', error)
    await registrarLog({
      tipo: 'error',
      servico,
      mensagem: `Erro ao criar assinatura: ${error.message}`,
      stack: error.stack,
      administrador_id
    })
    return json({ error: error.message }, 500)
  }
})
