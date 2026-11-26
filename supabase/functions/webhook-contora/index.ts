// Fase 6e — Recebe os avisos da Fiscal Contora (situação das notas e do
// certificado). Confere a assinatura (HMAC SHA-256 de "timestamp.corpo"
// com o segredo guardado em contora_webhook), grava cada entrega uma vez só
// (X-Fiscal-Delivery-Id) e atualiza a nota/empresa.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

const TOLERANCIA_MS = 15 * 60 * 1000

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

async function hmacHex(secret: string, mensagem: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(mensagem))
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

function iguais(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false
  let r = 0
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return r === 0
}

function pick(obj: any, caminhos: string[]): any {
  for (const c of caminhos) {
    const v = c.split('.').reduce((o: any, k) => (o == null ? undefined : o[k]), obj)
    if (v !== undefined && v !== null && v !== '') return v
  }
  return null
}

// Situação da nota no nosso banco a partir do evento da Contora
const STATUS_POR_EVENTO: Record<string, string> = {
  'document.authorized': 'autorizada',
  'document.cancelled': 'cancelada',
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json(405, { ok: false })

  const corpo = await req.text()
  const assinatura = (req.headers.get('X-Fiscal-Signature') || '').replace(/^sha256=/, '').toLowerCase()
  const assinaturaNova = (req.headers.get('X-Fiscal-Signature-Next') || '').replace(/^sha256=/, '').toLowerCase()
  const timestamp = req.headers.get('X-Fiscal-Timestamp') || ''
  const evento = req.headers.get('X-Fiscal-Event') || ''
  const deliveryId = req.headers.get('X-Fiscal-Delivery-Id') || null
  const teste = (req.headers.get('X-Fiscal-Test') || '').toLowerCase() === 'true'

  const { data: cfg } = await supabaseAdmin.from('contora_webhook').select('secret').eq('id', 1).maybeSingle()
  if (!cfg?.secret) return json(503, { ok: false, error: 'webhook não configurado' })

  const esperado = await hmacHex(cfg.secret, `${timestamp}.${corpo}`)
  if (!iguais(assinatura, esperado) && !iguais(assinaturaNova, esperado)) {
    return json(401, { ok: false, error: 'assinatura inválida' })
  }
  const ts = Date.parse(timestamp)
  if (!Number.isFinite(ts) || Math.abs(Date.now() - ts) > TOLERANCIA_MS) {
    return json(401, { ok: false, error: 'timestamp fora da janela' })
  }

  let payload: any = null
  try { payload = corpo ? JSON.parse(corpo) : {} } catch { payload = { raw: corpo.slice(0, 2000) } }

  const documentoId = pick(payload, ['data.id', 'data.document.id', 'document.id', 'document_id', 'data.document_id'])
  const companyId = pick(payload, ['data.company_id', 'company_id', 'company.id', 'data.company.id'])

  const { data: admin } = companyId
    ? await supabaseAdmin.from('administradores').select('id').eq('nfe_contora_company_id', String(companyId)).maybeSingle()
    : { data: null }

  const { data: registro, error: insErr } = await supabaseAdmin
    .from('contora_webhook_eventos')
    .insert({
      delivery_id: deliveryId,
      evento,
      documento_id: documentoId ? String(documentoId) : null,
      company_id: companyId ? String(companyId) : null,
      administrador_id: admin?.id ?? null,
      payload,
      assinatura_ok: true,
    })
    .select('id')
    .single()

  if (insErr) {
    // Entrega repetida (mesmo delivery_id): já processada
    if (String(insErr.code) === '23505') return json(200, { ok: true, duplicado: true })
    return json(500, { ok: false, error: 'falha ao registrar' })
  }

  let erro: string | null = null
  try {
    if (!teste && evento.startsWith('document.') && documentoId) {
      const provedorStatus = pick(payload, ['data.status', 'status', 'document.status'])
      const processamento = pick(payload, ['data.processing_status', 'processing_status', 'document.processing_status'])
      const protocolo = pick(payload, ['data.protocol', 'data.authorization.protocol', 'protocol'])
      const chave = pick(payload, ['data.access_key', 'data.key', 'access_key'])
      // Formato real (conferido em 26/11/2026): data.last_error_message,
      // data.last_error_code e context.error.
      const motivo = pick(payload, ['data.last_error_message', 'context.error', 'data.rejection.message', 'data.status_reason', 'data.error.message', 'message'])
      const codigoErro = pick(payload, ['data.last_error_code', 'data.rejection.code', 'data.error.code'])

      const update: Record<string, unknown> = {
        provedor_status: provedorStatus ?? evento.replace('document.', ''),
        processamento_status: processamento ?? evento.replace('document.', ''),
        ultima_sincronizacao_em: new Date().toISOString(),
      }
      if (STATUS_POR_EVENTO[evento]) update.status = STATUS_POR_EVENTO[evento]
      if (protocolo) update.protocolo_autorizacao = String(protocolo)
      if (chave) update.chave_acesso = String(chave)
      if (['document.rejected', 'document.failed', 'document.build_sync_failed', 'document.cancellation_rejected'].includes(evento)) {
        // Sem motivo no aviso, mantém a mensagem que a emissão já gravou.
        if (motivo) update.erro_mensagem = String(motivo).slice(0, 2000)
        if (codigoErro) update.erro_codigo = String(codigoErro).slice(0, 100)
      }

      await supabaseAdmin.from('notas_fiscais').update(update).eq('provedor_documento_id', String(documentoId))
    }

    if (!teste && companyId && (evento === 'company.certificate_expiring' || evento === 'company.certificate_expired')) {
      await supabaseAdmin
        .from('administradores')
        .update({
          nfe_integracao_status: evento === 'company.certificate_expired' ? 'certificado_vencido' : 'certificado_vencendo',
          ...(evento === 'company.certificate_expired' ? { nfe_contora_has_certificate: false, nfe_certificado_configurado: false } : {}),
          nfe_contora_ultima_sincronizacao: new Date().toISOString(),
        })
        .eq('nfe_contora_company_id', String(companyId))
    }
  } catch (e: any) {
    erro = String(e?.message || e).slice(0, 1000)
  }

  await supabaseAdmin.from('contora_webhook_eventos').update({ processado: !erro, erro }).eq('id', registro.id)
  return json(200, { ok: true })
})
