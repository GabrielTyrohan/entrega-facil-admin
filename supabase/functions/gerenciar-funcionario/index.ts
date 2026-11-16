
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false, autoRefreshToken: false },
})

function asText(v: unknown, max = 255): string {
  return typeof v === 'string' ? v.trim().slice(0, max) : ''
}

function normalizeEmail(v: unknown): string {
  return asText(v, 320).toLowerCase()
}

function validatePassword(v: unknown): string {
  const p = typeof v === 'string' ? v : ''
  if (p.length < 8 || p.length > 128) {
    throw new Error('Senha deve ter entre 8 e 128 caracteres')
  }
  return p
}

function sanitizePermissions(v: unknown): Record<string, boolean> {
  const allowed = [
    'orcamentos_pj','vendas_atacado','notas_fiscais','caixa','acertos',
    'relatorios','produtos','funcionarios','vendedores','configuracoes',
    'configuracoes_fiscais',
    // Fase 3: cobrança (clientes/entregas/pagamentos/devedores) e liberar cestas/avulsos
    'cobranca','cestas_vendedor',
    'expedicao'
  ]
  const src = v && typeof v === 'object' && !Array.isArray(v)
    ? v as Record<string, unknown>
    : {}
  const out: Record<string, boolean> = {}
  for (const key of allowed) out[key] = src[key] === true

  if (out.expedicao) {
    for (const key of allowed) {
      if (key !== 'expedicao') out[key] = false
    }
  }
  return out
}

async function getAdminFromRequest(req: Request) {
  const authHeader = req.headers.get('Authorization') || ''
  if (!authHeader.startsWith('Bearer ')) return null
  const token = authHeader.slice(7).trim()
  if (!token) return null

  const authClient = createClient(SUPABASE_URL, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: { user }, error } = await authClient.auth.getUser()
  if (error || !user) return null

  const { data: administrador, error: adminError } = await admin
    .from('administradores')
    .select('id,nome_empresa')
    .eq('id', user.id)
    .maybeSingle()

  if (adminError || !administrador) return null
  return administrador as { id: string; nome_empresa: string | null }
}

async function getFuncionarioOwned(adminId: string, funcionarioId: string) {
  const { data, error } = await admin
    .from('funcionarios')
    .select('id,administrador_id,auth_user_id,nome,email,telefone,cargo,permissoes,ativo,nome_empresa')
    .eq('id', funcionarioId)
    .eq('administrador_id', adminId)
    .maybeSingle()
  if (error) throw new Error('Falha ao consultar funcionário')
  return data
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ success: false, error: 'Método não permitido' }, 405)

  try {
    const administrador = await getAdminFromRequest(req)
    if (!administrador) return json({ success: false, error: 'Acesso restrito ao administrador' }, 403)

    const body = await req.json().catch(() => ({}))
    const action = asText(body?.action, 40)

    if (action === 'create') {
      const nome = asText(body?.nome, 160)
      const email = normalizeEmail(body?.email)
      const senha = validatePassword(body?.senha)
      const telefone = asText(body?.telefone, 40) || null
      const cargo = asText(body?.cargo, 120) || null
      const permissoes = sanitizePermissions(body?.permissoes)

      if (!nome) return json({ success: false, error: 'Nome é obrigatório' }, 400)
      if (!email || !email.includes('@')) return json({ success: false, error: 'E-mail inválido' }, 400)

      const { data: created, error: authError } = await admin.auth.admin.createUser({
        email,
        password: senha,
        email_confirm: true,
        user_metadata: { nome, role: 'funcionario' },
      })

      if (authError || !created.user) {
        const msg = authError?.message?.toLowerCase().includes('already')
          ? 'Já existe um usuário com este e-mail'
          : 'Falha ao criar usuário de autenticação'
        return json({ success: false, error: msg }, 400)
      }

      const authUserId = created.user.id

      const { data: funcionario, error: insertError } = await admin
        .from('funcionarios')
        .insert({
          administrador_id: administrador.id,
          auth_user_id: authUserId,
          nome,
          email,
          telefone,
          cargo,
          permissoes,
          ativo: true,
          nome_empresa: administrador.nome_empresa ?? null,
        })
        .select('id,nome,email,telefone,cargo,permissoes,ativo,auth_user_id,administrador_id,nome_empresa')
        .single()

      if (insertError) {
        await admin.auth.admin.deleteUser(authUserId).catch(() => null)
        throw new Error('Falha ao vincular funcionário ao administrador')
      }

      return json({ success: true, funcionario })
    }

    const funcionarioId = asText(body?.funcionarioId, 80)
    if (!funcionarioId) return json({ success: false, error: 'Funcionário inválido' }, 400)

    const atual = await getFuncionarioOwned(administrador.id, funcionarioId)
    if (!atual) return json({ success: false, error: 'Funcionário não encontrado' }, 404)

    if (action === 'update') {
      const nome = asText(body?.nome, 160)
      const email = normalizeEmail(body?.email)
      const telefone = asText(body?.telefone, 40) || null
      const cargo = asText(body?.cargo, 120) || null
      const permissoes = sanitizePermissions(body?.permissoes)

      if (!nome) return json({ success: false, error: 'Nome é obrigatório' }, 400)
      if (!email || !email.includes('@')) return json({ success: false, error: 'E-mail inválido' }, 400)

      let authEmailAlterado = false
      if (email !== atual.email && atual.auth_user_id) {
        const { error: authUpdateError } = await admin.auth.admin.updateUserById(
          atual.auth_user_id,
          { email, user_metadata: { nome, role: 'funcionario' } },
        )
        if (authUpdateError) return json({ success: false, error: 'Não foi possível alterar o e-mail de login' }, 400)
        authEmailAlterado = true
      } else if (atual.auth_user_id) {
        await admin.auth.admin.updateUserById(
          atual.auth_user_id,
          { user_metadata: { nome, role: 'funcionario' } },
        ).catch(() => null)
      }

      const { data: funcionario, error: updateError } = await admin
        .from('funcionarios')
        .update({ nome, email, telefone, cargo, permissoes })
        .eq('id', funcionarioId)
        .eq('administrador_id', administrador.id)
        .select('id,nome,email,telefone,cargo,permissoes,ativo,auth_user_id,administrador_id,nome_empresa')
        .single()

      if (updateError) {
        if (authEmailAlterado && atual.auth_user_id && atual.email) {
          await admin.auth.admin.updateUserById(atual.auth_user_id, { email: atual.email }).catch(() => null)
        }
        throw new Error('Falha ao atualizar funcionário')
      }

      return json({ success: true, funcionario })
    }

    if (action === 'set_active') {
      const ativo = body?.ativo === true
      const { data: funcionario, error } = await admin
        .from('funcionarios')
        .update({ ativo })
        .eq('id', funcionarioId)
        .eq('administrador_id', administrador.id)
        .select('id,ativo')
        .single()
      if (error) throw new Error('Falha ao alterar status do funcionário')
      return json({ success: true, funcionario })
    }

    if (action === 'reset_password') {
      if (!atual.auth_user_id) return json({ success: false, error: 'Funcionário sem usuário de autenticação vinculado' }, 409)
      const senha = validatePassword(body?.senha)
      const { error } = await admin.auth.admin.updateUserById(atual.auth_user_id, { password: senha })
      if (error) throw new Error('Falha ao redefinir senha')
      return json({ success: true })
    }

    return json({ success: false, error: 'Ação inválida' }, 400)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro interno'
    return json({ success: false, error: message }, 500)
  }
})
