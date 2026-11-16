
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

const CONTORA_BASE_URL = 'https://fiscal.contora.com.br/api/v1'
const CONTORA_TOKEN = Deno.env.get('CONTORA_API_TOKEN_HOMOLOGACAO') || ''
const WEBHOOK_URL = `${Deno.env.get('SUPABASE_URL')}/functions/v1/webhook-contora`
const WEBHOOK_EVENTS = [
  'document.authorized',
  'document.rejected',
  'document.failed',
  'document.cancelled',
  'document.cancellation_rejected',
  'document.processed',
  'document.built_sync',
  'document.build_sync_failed',
  'document.status_refreshed',
  'company.certificate_expiring',
  'company.certificate_expired',
]

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function onlyDigits(v: unknown): string {
  return String(v ?? '').replace(/\D/g, '')
}

function isValidCNPJ(value: string): boolean {
  const cnpj = onlyDigits(value)
  if (cnpj.length !== 14 || /^(\d)\1{13}$/.test(cnpj)) return false

  const calc = (base: string, weights: number[]) => {
    const sum = base.split('').reduce((acc, digit, i) => acc + Number(digit) * weights[i], 0)
    const mod = sum % 11
    return mod < 2 ? 0 : 11 - mod
  }

  const d1 = calc(cnpj.slice(0, 12), [5,4,3,2,9,8,7,6,5,4,3,2])
  const d2 = calc(cnpj.slice(0, 12) + d1, [6,5,4,3,2,9,8,7,6,5,4,3,2])
  return cnpj === cnpj.slice(0, 12) + String(d1) + String(d2)
}

// Valores da tela: 1 Simples Nacional, 2 Lucro Presumido, 3 Lucro Real
function taxRegime(value: unknown): string {
  const n = Number(value)
  if (n === 1) return 'simples'
  if (n === 2) return 'presumido'
  if (n === 3) return 'real'
  throw new Error('Regime tributário inválido. Selecione Simples Nacional, Lucro Presumido ou Lucro Real.')
}

function preferBody(bodyValue: unknown, currentValue: unknown) {
  if (bodyValue === undefined || bodyValue === null || bodyValue === '') return currentValue
  return bodyValue
}

async function contoraJson(path: string, init: RequestInit) {
  if (!CONTORA_TOKEN) throw new Error('Token de homologação da Fiscal Contora não configurado')

  const headers = new Headers(init.headers || {})
  headers.set('Authorization', `Bearer ${CONTORA_TOKEN}`)
  headers.set('Accept', 'application/json')
  headers.set('Content-Type', 'application/json')

  const res = await fetch(`${CONTORA_BASE_URL}${path}`, { ...init, headers })
  const raw = await res.text()
  let data: any = null
  try { data = raw ? JSON.parse(raw) : null } catch { data = { raw } }

  if (!res.ok) {
    const msg = data?.message || data?.error?.message || JSON.stringify(data)
    throw new Error(`Fiscal Contora HTTP ${res.status}: ${msg}`)
  }

  return { status: res.status, data }
}

/**
 * Fase 6e — webhook único da conta Contora. Cadastra uma vez (com um
 * segredo gerado aqui e guardado em contora_webhook, que só o servidor lê).
 * Falha aqui não impede salvar a empresa.
 */
async function garantirWebhook(): Promise<string> {
  const { data: atual } = await supabaseAdmin.from('contora_webhook').select('id').eq('id', 1).maybeSingle()
  if (atual) return 'existente'

  const bytes = crypto.getRandomValues(new Uint8Array(32))
  const secret = Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('')

  const result = await contoraJson('/webhooks', {
    method: 'POST',
    body: JSON.stringify({ url: WEBHOOK_URL, events: WEBHOOK_EVENTS, secret, is_active: true }),
    headers: { 'Idempotency-Key': 'entrega-facil-webhook-v1' },
  })
  const endpoint = result.data?.data || result.data

  const { error } = await supabaseAdmin.from('contora_webhook').insert({
    id: 1,
    contora_endpoint_id: endpoint?.id ? String(endpoint.id) : null,
    url: WEBHOOK_URL,
    secret,
    events: WEBHOOK_EVENTS,
  })
  if (error) throw new Error(`Webhook criado na Contora, mas não foi salvo: ${error.message}`)
  return 'criado'
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    if (req.method !== 'POST') throw new Error('Método não permitido')

    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) throw new Error('Usuário não autenticado')

    const jwt = authHeader.slice(7)
    const supabaseAuth = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!
    )

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(jwt)
    if (authError || !user) throw new Error('Usuário não autenticado')

    // Configuração fiscal sensível: somente o administrador da própria empresa.
    const { data: admin, error: adminError } = await supabaseAdmin
      .from('administradores')
      .select('*')
      .eq('id', user.id)
      .single()

    if (adminError || !admin) {
      throw new Error('Apenas o administrador pode configurar a empresa fiscal')
    }

    const body = await req.json()

    const updates: Record<string, unknown> = {
      razao_social: body.razao_social ?? admin.razao_social,
      nome_fantasia: body.nome_fantasia ?? admin.nome_fantasia,
      cpf_cnpj: body.cpf_cnpj ?? admin.cpf_cnpj,
      inscricao_estadual: body.inscricao_estadual ?? admin.inscricao_estadual,
      nfe_indicador_ie: preferBody(body.nfe_indicador_ie, admin.nfe_indicador_ie),
      nfe_regime_tributario: preferBody(body.nfe_regime_tributario, admin.nfe_regime_tributario),
      telefone: body.telefone ?? admin.telefone,
      cep: body.cep ?? admin.cep,
      endereco: body.endereco ?? admin.endereco,
      numero: body.numero ?? admin.numero,
      complemento: body.complemento ?? admin.complemento,
      bairro: body.bairro ?? admin.bairro,
      cidade: body.cidade ?? admin.cidade,
      estado: body.estado ?? admin.estado,
      codigo_municipio: body.codigo_municipio ?? admin.codigo_municipio,
      nfe_provedor: 'fiscal_contora',
      nfe_ambiente: 'homologacao',
    }

    const cnpj = onlyDigits(updates.cpf_cnpj)
    if (!isValidCNPJ(cnpj)) throw new Error('CNPJ do emitente inválido')

    const legalName = String(updates.razao_social || updates.nome_fantasia || admin.nome_empresa || '').trim()
    if (!legalName) throw new Error('Razão social é obrigatória')
    if (!updates.estado) throw new Error('UF da empresa é obrigatória')
    if (!updates.codigo_municipio) throw new Error('Código IBGE do município da empresa é obrigatório')
    if (!updates.endereco) throw new Error('Endereço da empresa é obrigatório')
    if (!updates.bairro) throw new Error('Bairro da empresa é obrigatório')
    if (!updates.cidade) throw new Error('Cidade da empresa é obrigatória')
    if (!updates.cep) throw new Error('CEP da empresa é obrigatório')

    const indicadorIE = Number(updates.nfe_indicador_ie)
    if (![1,2,9].includes(indicadorIE)) {
      throw new Error('Situação da Inscrição Estadual inválida. Selecione contribuinte, isento ou não contribuinte.')
    }

    // Valida também o regime antes de chamar a Fiscal Contora.
    taxRegime(updates.nfe_regime_tributario)
    if (indicadorIE === 1 && !String(updates.inscricao_estadual || '').trim()) {
      throw new Error('Inscrição Estadual é obrigatória para contribuinte ICMS')
    }

    const payload = {
      legal_name: legalName,
      trade_name: String(updates.nome_fantasia || admin.nome_empresa || legalName).trim(),
      document: cnpj,
      tax_regime: taxRegime(Number(updates.nfe_regime_tributario)),
      state_registration: indicadorIE === 1
        ? onlyDigits(updates.inscricao_estadual)
        : null,
      phone: onlyDigits(updates.telefone) || null,
      state_code: String(updates.estado).trim().toUpperCase(),
      city_code: String(updates.codigo_municipio),
      street: String(updates.endereco).trim(),
      number: String(updates.numero || 'S/N').trim(),
      complement: updates.complemento ? String(updates.complemento).trim() : null,
      district: String(updates.bairro).trim(),
      city_name: String(updates.cidade).trim(),
      postal_code: onlyDigits(updates.cep),
      default_environment: 'homologacao',
    }

    const result = await contoraJson(
      `/companies/by-document/${cnpj}`,
      {
        method: 'PUT',
        body: JSON.stringify(payload),
        headers: {
          'Idempotency-Key': `entrega-facil-company-${cnpj}`
        }
      }
    )

    const company = result.data?.data || result.data
    if (!company?.id) throw new Error('Fiscal Contora não retornou o ID da empresa')

    const { error: updateError } = await supabaseAdmin
      .from('administradores')
      .update({
        ...updates,
        inscricao_estadual: indicadorIE === 1 ? String(updates.inscricao_estadual || '').trim() : null,
        nfe_contora_company_id: company.id,
        nfe_integracao_status: company.has_certificate ? 'pronta_homologacao' : 'empresa_configurada',
        nfe_contora_has_certificate: Boolean(company.has_certificate),
        nfe_contora_ultima_sincronizacao: new Date().toISOString(),
        nfe_certificado_configurado: Boolean(company.has_certificate),
      })
      .eq('id', admin.id)

    if (updateError) throw new Error(`Empresa criada na Contora, mas falhou ao atualizar Supabase: ${updateError.message}`)

    let webhook = 'nao_verificado'
    try {
      webhook = await garantirWebhook()
    } catch (e: any) {
      webhook = 'erro'
      try {
        await supabaseAdmin.from('logs_sistema').insert({
          administrador_id: admin.id,
          tipo: 'warning',
          servico: 'configurar-empresa-contora',
          mensagem: `Webhook da Contora não cadastrado: ${String(e?.message || e).slice(0, 500)}`,
          timestamp: new Date().toISOString(),
        })
      } catch (_) {}
    }

    return new Response(JSON.stringify({
      success: true,
      created: result.status === 201,
      companyId: company.id,
      hasCertificate: Boolean(company.has_certificate),
      ambiente: 'homologacao',
      status: company.has_certificate ? 'pronta_homologacao' : 'empresa_configurada',
      webhook,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error: any) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
