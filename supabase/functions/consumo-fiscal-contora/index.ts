// Fase 6e — "Notas do mês": consumo de eventos fiscais na Fiscal Contora.
// O limite é da CONTA Contora (todas as empresas dividem). Lê os cabeçalhos
// X-Fiscal-Quota-* (quando vierem) e a empresa pelo CNPJ (/companies), guarda em
// contora_consumo e devolve para a tela. Se a Contora falhar, devolve o
// último valor guardado.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

const CONTORA_BASE_URL = 'https://fiscal.contora.com.br/api/v1'
const CONTORA_TOKEN = Deno.env.get('CONTORA_API_TOKEN_HOMOLOGACAO') || ''

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

function num(v: string | null): number | null {
  if (v === null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/** Procura no item da API o CNPJ e algum contador de eventos. */
function eventosDoItem(item: any): number | null {
  for (const k of ['events_used', 'used', 'events', 'total_events', 'count', 'quota_used', 'consumed']) {
    const v = item?.[k]
    if (typeof v === 'number') return v
  }
  return null
}

function documentoDoItem(item: any): string {
  return onlyDigits(item?.document ?? item?.cnpj ?? item?.company_document ?? item?.company?.document ?? '')
}

/** Limite da conta pelos cabeçalhos X-Fiscal-*; null quando a Contora não envia nenhum. */
function quotaDosCabecalhos(h: Headers): Record<string, unknown> | null {
  const q = {
    limite: num(h.get('X-Fiscal-Quota-Event-Limit')),
    usados: num(h.get('X-Fiscal-Quota-Event-Used')),
    restantes: num(h.get('X-Fiscal-Quota-Event-Remaining')),
    uso_percentual: num(h.get('X-Fiscal-Quota-Event-Usage')),
    aviso: h.get('X-Fiscal-Quota-Warning'),
    saldo_carteira: num(h.get('X-Fiscal-Wallet-Balance')),
  }
  return Object.values(q).some((v) => v !== null) ? q : null
}

function resposta(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) throw new Error('Usuário não autenticado')
    const jwt = authHeader.slice(7)

    const supabaseUser = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    })
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser(jwt)
    if (authError || !user) throw new Error('Usuário não autenticado')

    // Empresa do usuário (dono ou funcionária ativa); superadmin vê todas
    let adminId: string | null = null
    const { data: adm } = await supabaseAdmin.from('administradores').select('id').eq('id', user.id).maybeSingle()
    if (adm) adminId = adm.id
    else {
      const { data: f } = await supabaseAdmin
        .from('funcionarios')
        .select('administrador_id')
        .eq('auth_user_id', user.id)
        .eq('ativo', true)
        .or('bloqueado.is.null,bloqueado.eq.false')
        .maybeSingle()
      adminId = f?.administrador_id ?? null
    }
    const { data: superAdmin } = await supabaseUser.rpc('is_super_admin')
    if (!adminId && !superAdmin) throw new Error('Usuário não vinculado a uma empresa')

    const { data: empresas } = superAdmin
      ? await supabaseAdmin.from('administradores').select('id, cpf_cnpj, nome_empresa')
      : await supabaseAdmin.from('administradores').select('id, cpf_cnpj, nome_empresa').eq('id', adminId!)

    let erroContora: string | null = null
    const naContora = new Set<string>()
    try {
      if (!CONTORA_TOKEN) throw new Error('Token da Fiscal Contora não configurado')

      // Conferido em 26/11/2026 com o token real: /dashboard/companies só traz
      // totais ({ total, with_certificate, ... }). A lista por empresa é
      // /companies, paginada ({ data: [...], meta: { has_more_pages } }).
      const itens: any[] = []
      let base: Record<string, unknown> | null = null
      for (let page = 1; page <= 20; page++) {
        const res = await fetch(`${CONTORA_BASE_URL}/companies?per_page=100&page=${page}`, {
          headers: { Authorization: `Bearer ${CONTORA_TOKEN}`, Accept: 'application/json' },
        })
        const raw = await res.text()
        let data: any = null
        try { data = raw ? JSON.parse(raw) : null } catch { data = null }
        if (!res.ok) throw new Error(`Fiscal Contora HTTP ${res.status}`)

        if (!base) base = quotaDosCabecalhos(res.headers)
        if (Array.isArray(data?.data)) itens.push(...data.data)
        if (!data?.meta?.has_more_pages) break
      }

      for (const e of empresas ?? []) {
        const cnpj = onlyDigits(e.cpf_cnpj)
        const item = itens.find((i) => cnpj && documentoDoItem(i) === cnpj) ?? null
        if (item) naContora.add(e.id)
        // Sem os cabeçalhos X-Fiscal-Quota-* (a conta não os envia hoje),
        // mantém o último limite salvo em vez de apagar com null.
        await supabaseAdmin.from('contora_consumo').upsert({
          administrador_id: e.id,
          ...(base ?? {}),
          eventos_empresa: item ? eventosDoItem(item) : null,
          detalhe: item,
          atualizado_em: new Date().toISOString(),
        })
      }
    } catch (e: any) {
      erroContora = String(e?.message || e)
    }

    const ids = (empresas ?? []).map((e: any) => e.id)
    const { data: consumo } = await supabaseAdmin
      .from('contora_consumo')
      .select('*')
      .in('administrador_id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000'])

    const nomes = new Map((empresas ?? []).map((e: any) => [e.id, e.nome_empresa]))
    const lista = (consumo ?? []).map((c: any) => ({
      ...c,
      nome_empresa: nomes.get(c.administrador_id) ?? null,
      // null quando não deu para consultar a Contora agora
      empresa_na_contora: erroContora ? null : naContora.has(c.administrador_id),
    }))

    return resposta(200, {
      success: true,
      atualizado: !erroContora,
      erro: erroContora,
      consumo: superAdmin ? lista : (lista.find((c: any) => c.administrador_id === adminId) ?? null),
    })
  } catch (error: any) {
    return resposta(400, { success: false, error: error.message })
  }
})
