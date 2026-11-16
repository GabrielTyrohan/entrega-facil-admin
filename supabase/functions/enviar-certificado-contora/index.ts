
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

function base64ToBytes(base64: string): Uint8Array {
  const normalized = base64.includes(',') ? base64.split(',').pop()! : base64
  const binary = atob(normalized)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    if (req.method !== 'POST') throw new Error('Método não permitido')
    if (!CONTORA_TOKEN) throw new Error('Token de homologação da Fiscal Contora não configurado')

    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) throw new Error('Usuário não autenticado')

    const jwt = authHeader.slice(7)
    const supabaseAuth = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!
    )

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(jwt)
    if (authError || !user) throw new Error('Usuário não autenticado')

    const { data: admin, error: adminError } = await supabaseAdmin
      .from('administradores')
      .select('id, cpf_cnpj, nfe_contora_company_id')
      .eq('id', user.id)
      .single()

    if (adminError || !admin) {
      throw new Error('Apenas o administrador pode configurar o certificado fiscal')
    }

    if (!admin.nfe_contora_company_id) {
      throw new Error('Cadastre/sincronize a empresa na Fiscal Contora antes de enviar o certificado')
    }

    const body = await req.json()
    const certificadoBase64 = String(body?.certificadoBase64 || '')
    const senha = String(body?.senha || '')
    const nomeArquivo = String(body?.nomeArquivo || 'certificado.pfx')

    if (!certificadoBase64) throw new Error('Arquivo do certificado A1 é obrigatório')
    if (!senha) throw new Error('Senha do certificado A1 é obrigatória')
    if (!/\.(pfx|p12)$/i.test(nomeArquivo)) throw new Error('O certificado deve ser .pfx ou .p12')

    const bytes = base64ToBytes(certificadoBase64)
    if (bytes.length === 0) throw new Error('Certificado A1 vazio')
    if (bytes.length > 5 * 1024 * 1024) throw new Error('Certificado A1 excede o limite de 5 MB')

    const form = new FormData()
    form.append(
      'certificate',
      new Blob([bytes], { type: 'application/x-pkcs12' }),
      nomeArquivo
    )
    form.append('password', senha)

    const res = await fetch(
      `${CONTORA_BASE_URL}/companies/${admin.nfe_contora_company_id}/certificate`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${CONTORA_TOKEN}`,
          'Accept': 'application/json',
        },
        body: form,
      }
    )

    const raw = await res.text()
    let data: any = null
    try { data = raw ? JSON.parse(raw) : null } catch { data = { raw } }

    if (!res.ok) {
      const msg = data?.message || data?.error?.message || JSON.stringify(data)
      throw new Error(`Fiscal Contora HTTP ${res.status}: ${msg}`)
    }

    const cert = data?.data || data

    await supabaseAdmin
      .from('administradores')
      .update({
        nfe_contora_has_certificate: true,
        nfe_certificado_configurado: true,
        nfe_certificado_validade: cert?.expires_at
          ? String(cert.expires_at).slice(0, 10)
          : null,
        nfe_certificado_nome: nomeArquivo,
        nfe_certificado_documento: cert?.document || null,
        nfe_integracao_status: 'pronta_homologacao',
        nfe_contora_ultima_sincronizacao: new Date().toISOString(),
      })
      .eq('id', admin.id)

    return new Response(JSON.stringify({
      success: true,
      hasCertificate: true,
      validade: cert?.expires_at || null,
      documento: cert?.document || null,
      status: 'pronta_homologacao',
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
