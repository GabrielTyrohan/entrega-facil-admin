
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-app-version, x-app-build, x-app-platform',
}

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)


async function registrarTelemetria(
  req: Request,
  vendedor: any | null,
  action: string,
  sucesso: boolean,
  httpStatus: number,
  erroCodigo?: string | null
) {
  try {
    const appVersion = req.headers.get('x-app-version')
    const appBuild = req.headers.get('x-app-build')
    const appPlatform = req.headers.get('x-app-platform')
    const userAgent = req.headers.get('user-agent')

    await supabaseAdmin
      .from('vendedor_sync_telemetria')
      .insert({
        vendedor_id: vendedor?.id ?? null,
        administrador_id: vendedor?.administrador_id ?? null,
        action: action || 'unknown',
        canal: 'edge_segura',
        app_version: appVersion || null,
        app_build: appBuild || null,
        app_platform: appPlatform || null,
        user_agent: userAgent || null,
        sucesso,
        http_status: httpStatus,
        erro_codigo: erroCodigo || null,
      })
  } catch {
    // Telemetria nunca pode quebrar o fluxo principal.
  }
}

async function sha256(value: string): Promise<string> {
  const data = new TextEncoder().encode(value)
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', data))
  return Array.from(digest).map(b => b.toString(16).padStart(2, '0')).join('')
}

async function getSession(req: Request) {
  const auth = req.headers.get('Authorization')
  if (!auth?.startsWith('Bearer ')) throw new Error('Sessão do vendedor ausente')

  const token = auth.slice(7).trim()
  if (!token) throw new Error('Sessão do vendedor inválida')

  const tokenHash = await sha256(token)
  const nowIso = new Date().toISOString()

  const { data: sessao, error } = await supabaseAdmin
    .from('vendedor_sessoes')
    .select('id, vendedor_id, expira_em, revogado_em')
    .eq('token_hash', tokenHash)
    .is('revogado_em', null)
    .gt('expira_em', nowIso)
    .maybeSingle()

  if (error || !sessao) throw new Error('Sessão do vendedor inválida ou expirada')

  const { data: vendedor, error: vendError } = await supabaseAdmin
    .from('vendedores')
    .select('id, administrador_id, ativo, bloqueado, tipo_vinculo, status_pagamento_vendedor, data_vencimento_vendedor, assinatura_ativa, dia_fechamento, percentual_minimo')
    .eq('id', sessao.vendedor_id)
    .single()

  if (vendError || !vendedor) throw new Error('Vendedor não encontrado')
  if (!vendedor.ativo) throw new Error('Vendedor inativo')

  await supabaseAdmin
    .from('vendedor_sessoes')
    .update({ ultimo_uso_em: nowIso })
    .eq('id', sessao.id)

  return { sessao, vendedor }
}

async function rpc(name: string, args: Record<string, unknown>) {
  const { data, error } = await supabaseAdmin.rpc(name, args)
  if (error) throw new Error(`Falha em ${name}: ${error.message}`)
  return data
}

// Data válida enviada pelo app (ISO). Qualquer outra coisa vira download completo.
function dataDoCorpo(valor: unknown): string | null {
  if (typeof valor !== 'string' || !valor) return null
  const t = Date.parse(valor)
  return Number.isFinite(t) ? new Date(t).toISOString() : null
}

async function downloadCore(vendedor: any, body: any = {}) {
  const vendedorId = vendedor.id
  const adminId = vendedor.administrador_id
  // Clientes incrementais: o app manda clientesDesde (com folga) e guarda o cursorClientes
  // devolvido. Sem clientesDesde (APK antigo ou primeira vez) vem a lista completa.
  const clientesDesde = dataDoCorpo(body?.clientesDesde)
  const cursorClientes = new Date().toISOString()

  const [
    clientes,
    produtos,
    entregas,
    entregasPendentes,
    pagamentos,
    produtosNaCesta,
    produtosCadastrado,
    cestasBaseResult,
  ] = await Promise.all([
    clientesDesde
      ? rpc('get_clientes_vendedor', { p_vendedor_id: vendedorId, p_updated_after: clientesDesde })
      : rpc('get_clientes_vendedor', { p_vendedor_id: vendedorId }),
    rpc('get_produtos_vendedor', { p_vendedor_id: vendedorId }),
    rpc('get_entregas_vendedor', { p_vendedor_id: vendedorId }),
    rpc('get_entregas_pendentes_vendedor', { p_vendedor_id: vendedorId }),
    rpc('get_pagamentos_vendedor', { p_vendedor_id: vendedorId }),
    rpc('get_produtos_na_cesta_vendedor', { p_vendedor_id: vendedorId }),
    rpc('get_produtos_cadastrado_vendedor', { p_vendedor_id: vendedorId }),
    supabaseAdmin
      .from('cestas_base')
      .select('*')
      .eq('administrador_id', adminId)
      .eq('ativo', true),
  ])

  if (cestasBaseResult.error) {
    throw new Error(`Falha ao carregar cestas base: ${cestasBaseResult.error.message}`)
  }

  return {
    vendedor: {
      id: vendedor.id,
      administrador_id: vendedor.administrador_id,
      ativo: vendedor.ativo,
      bloqueado: vendedor.bloqueado,
      tipo_vinculo: vendedor.tipo_vinculo,
      status_pagamento_vendedor: vendedor.status_pagamento_vendedor,
      data_vencimento_vendedor: vendedor.data_vencimento_vendedor,
      assinatura_ativa: vendedor.assinatura_ativa,
      dia_fechamento: vendedor.dia_fechamento,
      percentual_minimo: vendedor.percentual_minimo,
    },
    clientes: clientes || [],
    clientesIncremental: Boolean(clientesDesde),
    cursorClientes,
    produtos: produtos || [],
    entregas: entregas || [],
    entregasPendentes: entregasPendentes || [],
    pagamentos: pagamentos || [],
    produtosNaCesta: produtosNaCesta || [],
    produtosCadastrado: produtosCadastrado || [],
    cestasBase: cestasBaseResult.data || [],
  }
}

async function downloadItens(vendedor: any, body: any) {
  const updatedAfterItens =
    typeof body?.updatedAfterItens === 'string' && body.updatedAfterItens
      ? body.updatedAfterItens
      : null

  const itens = updatedAfterItens
    ? await rpc('get_itens_entrega_vendedor', {
        p_vendedor_id: vendedor.id,
        p_updated_after: updatedAfterItens,
      })
    : await rpc('get_itens_entrega_vendedor', { p_vendedor_id: vendedor.id })

  return { itensEntrega: itens || [] }
}

async function downloadEstoque(vendedor: any) {
  const estoque = await rpc('get_estoque_vendedor', { p_vendedor_id: vendedor.id })
  return { estoqueVendedor: estoque || [] }
}

async function uploadAll(vendedor: any, body: any) {
  const vendedorId = vendedor.id

  const clientes = Array.isArray(body?.clientes) ? body.clientes : []
  const entregas = Array.isArray(body?.entregas) ? body.entregas : []
  const pagamentos = Array.isArray(body?.pagamentos) ? body.pagamentos : []
  const itensEntrega = Array.isArray(body?.itensEntrega) ? body.itensEntrega : []
  const estoqueDeltas = Array.isArray(body?.estoqueDeltas) ? body.estoqueDeltas : []

  // Defesa contra IDOR/BOLA (somente leitura): qualquer ID já existente
  // precisa pertencer ao vendedor autenticado.
  const clienteIds = [...new Set(clientes.map((c: any) => String(c?.id || '')).filter(Boolean))]
  if (clienteIds.length > 0) {
    const { data: existentes, error } = await supabaseAdmin
      .from('clientes')
      .select('id, vendedor_id')
      .in('id', clienteIds)
    if (error) throw new Error('Falha ao validar clientes')
    if ((existentes || []).some((c: any) => String(c.vendedor_id) !== String(vendedorId))) {
      throw new Error('Um ou mais clientes não pertencem ao vendedor autenticado')
    }
  }

  const somenteDigitos = (v: any) => String(v || '').replace(/\D/g, '')
  const nomeDoCliente = (c: any) => {
    const nome = [c?.nome, c?.sobrenome].map((p: any) => String(p || '').trim()).filter(Boolean).join(' ')
    return nome || String(c?.razao_social || c?.nome_fantasia || '').trim() || 'sem nome'
  }
  const clienteDoEnvio = (campo: 'cpf' | 'cnpj', valor: any) =>
    clientes.find((c: any) => somenteDigitos(c?.[campo]) === somenteDigitos(valor))

  const cpfs = [...new Set(clientes
    .map((c: any) => String(c?.cpf || '').replace(/\D/g, ''))
    .filter(Boolean))]
  if (cpfs.length > 0) {
    const { data: cpfExistentes, error } = await supabaseAdmin
      .from('clientes')
      .select('id, vendedor_id, cpf')
      .in('cpf', cpfs)
    if (error) throw new Error('Falha ao validar CPF de clientes')
    const conflitoCPF = (cpfExistentes || []).find((c: any) => String(c.vendedor_id) !== String(vendedorId))
    if (conflitoCPF) {
      const nome = nomeDoCliente(clienteDoEnvio('cpf', conflitoCPF.cpf))
      throw new Error(`O cliente ${nome} já está cadastrado com outro vendedor ou em outra empresa. Corrija o CPF no cadastro.`)
    }
  }

  const cnpjs = [...new Set(clientes
    .map((c: any) => String(c?.cnpj || '').replace(/\D/g, ''))
    .filter(Boolean))]
  if (cnpjs.length > 0) {
    const { data: cnpjExistentes, error } = await supabaseAdmin
      .from('clientes')
      .select('id, vendedor_id, cnpj')
      .in('cnpj', cnpjs)
    if (error) throw new Error('Falha ao validar CNPJ de clientes')
    const conflitoCNPJ = (cnpjExistentes || []).find((c: any) => String(c.vendedor_id) !== String(vendedorId))
    if (conflitoCNPJ) {
      const nome = nomeDoCliente(clienteDoEnvio('cnpj', conflitoCNPJ.cnpj))
      throw new Error(`O cliente ${nome} já está cadastrado com outro vendedor ou em outra empresa. Corrija o CNPJ no cadastro.`)
    }
  }

  const entregaIdsUpload = [...new Set(entregas.map((e: any) => String(e?.id || '')).filter(Boolean))]
  if (entregaIdsUpload.length > 0) {
    const { data: existentes, error } = await supabaseAdmin
      .from('entregas')
      .select('id, vendedor_id')
      .in('id', entregaIdsUpload)
    if (error) throw new Error('Falha ao validar entregas')
    if ((existentes || []).some((e: any) => String(e.vendedor_id) !== String(vendedorId))) {
      throw new Error('Uma ou mais entregas não pertencem ao vendedor autenticado')
    }
  }

  for (const delta of estoqueDeltas) {
    const produtoId = String(delta?.produto_id || '')
    const valorDelta = Number(delta?.delta ?? 0)
    if (!produtoId || !Number.isFinite(valorDelta)) {
      throw new Error('Delta de estoque inválido')
    }
  }

  // Fase 2: TODA a escrita acontece numa única transação no banco.
  // Se qualquer parte falhar, nada é gravado e o app tenta de novo depois.
  const resultado = await rpc('sincronizar_upload_vendedor', {
    p_vendedor_id: vendedorId,
    p_clientes: clientes.length > 0 ? clientes : null,
    p_entregas: entregas.length > 0 ? entregas : null,
    p_pagamentos: pagamentos.length > 0 ? pagamentos : null,
    p_itens: itensEntrega.length > 0 ? itensEntrega : null,
    p_deltas: estoqueDeltas.length > 0
      ? estoqueDeltas.map((d: any) => ({ produto_id: String(d.produto_id), delta: Number(d.delta ?? 0) }))
      : null,
  })

  return {
    success: true,
    baseSincronizada: Boolean(resultado?.baseSincronizada),
    pagamentosSincronizados: resultado?.pagamentosSincronizados ?? [],
    itensSincronizados: resultado?.itensSincronizados ?? [],
    estoqueResultados: resultado?.estoqueResultados ?? [],
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  let vendedorTelemetria: any | null = null
  let actionTelemetria = 'unknown'

  try {
    if (req.method !== 'POST') throw new Error('Método não permitido')
    const { vendedor } = await getSession(req)
    vendedorTelemetria = vendedor
    const body = await req.json().catch(() => ({}))
    const action = String(body?.action || '')
    actionTelemetria = action || 'unknown'

    let data: any
    if (action === 'download') {
      data = await downloadCore(vendedor, body)
    } else if (action === 'download_itens') {
      data = await downloadItens(vendedor, body)
    } else if (action === 'download_estoque') {
      data = await downloadEstoque(vendedor)
    } else if (action === 'upload') {
      data = await uploadAll(vendedor, body)
    } else if (action === 'atualizar_percentual') {
      // Percentual mínimo que o cliente precisa ter pago para liberar nova
      // entrega. O vendedor pode alterar (cliente de confiança).
      const percentual = Number(body?.percentual)
      if (!Number.isFinite(percentual) || percentual < 0 || percentual > 100) {
        throw new Error('Percentual inválido: deve ser entre 0 e 100')
      }
      data = await rpc('atualizar_percentual_minimo_vendedor', {
        p_vendedor_id: vendedor.id,
        p_percentual: percentual,
      })
    } else if (action === 'criar_pedido') {
      // Pedido de cestas/avulsos para a funcionária atender (Fase 4).
      const itens = Array.isArray(body?.itens) ? body.itens : []
      data = await rpc('criar_pedido_vendedor', {
        p_vendedor_id: vendedor.id,
        p_itens: itens.map((i: any) => ({
          tipo: String(i?.tipo || ''),
          id: String(i?.id || ''),
          quantidade: Number(i?.quantidade ?? 0),
        })),
        p_observacao: typeof body?.observacao === 'string' ? body.observacao : null,
      })
    } else if (action === 'listar_pedidos') {
      data = { pedidos: await rpc('listar_pedidos_vendedor', { p_vendedor_id: vendedor.id, p_limite: 20 }) }
    } else if (action === 'cancelar_pedido') {
      data = await rpc('cancelar_pedido_vendedor', {
        p_vendedor_id: vendedor.id,
        p_pedido_id: String(body?.pedidoId || ''),
      })
    } else if (action === 'comissao') {
      // Extrato de comissão do vendedor (Fase 5), somente leitura.
      data = await rpc('extrato_comissao_vendedor', { p_vendedor_id: vendedor.id })
    } else if (action === 'ping') {
      data = {
        vendedor: {
          id: vendedor.id,
          administrador_id: vendedor.administrador_id,
          ativo: vendedor.ativo,
          bloqueado: vendedor.bloqueado,
        },
      }
    } else {
      throw new Error('Ação inválida')
    }

    await registrarTelemetria(req, vendedorTelemetria, actionTelemetria, true, 200, null)

    return new Response(JSON.stringify({ success: true, data }), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      },
    })
  } catch (error: any) {
    const message = String(error?.message || 'Falha no sync seguro')
    const unauthorized =
      message.includes('Sessão do vendedor') ||
      message.includes('Vendedor inativo')

    console.error('[sync-vendedor-seguro]', message)

    const status = unauthorized ? 401 : 400
    const erroCodigo =
      unauthorized ? 'unauthorized' :
      message.includes('não pertenc') || message.includes('outro vendedor') ? 'tenant_validation' :
      message.includes('inválid') ? 'validation_error' :
      'sync_error'

    await registrarTelemetria(req, vendedorTelemetria, actionTelemetria, false, status, erroCodigo)

    return new Response(JSON.stringify({
      success: false,
      error: message,
    }), {
      status,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      },
    })
  }
})
