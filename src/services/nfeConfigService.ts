// src/services/nfeConfigService.ts
import { supabase } from '../lib/supabase'

const EDGE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`

export async function configurarEmpresaNFe(params: {
  certificadoBase64: string
  senha: string
  ambiente: 'homologacao' | 'producao'
  regimeTributario: 1 | 2 | 3
  homologacaoAutomatica?: boolean
}) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Sessão expirada')

  const res = await fetch(`${EDGE_URL}/configurar-empresa-nfe`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(params),
  })

  const result = await res.json()
  if (!res.ok) throw new Error(result.error || 'Erro ao configurar certificado')
  return result
}

export async function buscarStatusCertificado() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autenticado')

  const { data, error } = await supabase
    .from('administradores')
    .select('nfe_certificado_configurado, nfe_certificado_validade, nfe_ambiente, nfe_regime_tributario')
    .eq('id', user.id)
    .single()

  if (error) throw new Error(error.message)
  return data
}
