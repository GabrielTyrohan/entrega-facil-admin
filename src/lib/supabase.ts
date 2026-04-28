import { createClient } from '@supabase/supabase-js'

// Configurações do Supabase
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
// const supabaseServiceKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Variáveis VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY obrigatórias')
}

// Cliente público (anon) para uso no frontend
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false
  }
})

// Não é mais necessário usar service role no cliente.
// Operações privilegiadas são feitas via RPC segura no backend.
//
// export const supabaseAdmin = createClient(
//   supabaseUrl,
//   import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY,
//   {
//     auth: {
//       autoRefreshToken: false,
//       persistSession: false
//     }
//   }
// )

// Tipos para as tabelas do banco
export interface Administrador {
  id: string
  nome: string
  email: string
  created_at: string
}

export interface Vendedor {
  id: string
  administrador_id: string
  nome: string
  senha?: number  // Alterado de string para number
  telefone?: string | null
  percentual_minimo?: number | null
  last_sync?: string | null
  token?: string | null
  ativo?: boolean
  created_at: string
  email?: string | null
  endereco?: string | null
  data_inicio?: string | null
  tipo_vinculo?: string | null
  contrato?: string | null
  contrato_arquivo_url?: string | null
  status?: boolean
  dados_bancarios?: any
  dia_fechamento?: number | null
}

export interface Cliente {
  id: string
  vendedor_id: string
  nome: string
  sobrenome?: string
  cpf: string
  rg?: string
  data_nascimento?: string
  sexo?: string
  estado_civil?: string
  nacionalidade?: string
  nome_pai?: string
  nome_mae?: string
  telefone: string
  email?: string
  endereco: string
  nome_conjuge?: string
  renda_mensal?: number
  ponto_referencia?: string
  menor_idade?: boolean
  ativo?: boolean
  sincronizado?: boolean
  created_at: string
  updated_at: string
}

export interface Produto {
  id: string
  vendedor_id: string
  nome: string
  preco: number
  descricao?: string
  ativo?: boolean
  sincronizado?: boolean
  created_at: string
  updated_at: string
}

export interface Entrega {
  id: string
  vendedor_id: string
  cliente_id: string
  produto_id: string
  valor: number
  data_entrega: string
  pago?: boolean
  sincronizado?: boolean
  created_at: string
  updated_at: string
  mes_cobranca?: string
  status_pagamento?: string
  dataRetorno?: string
  // Relacionamentos
  cliente?: Cliente
  produto?: Produto
  vendedor?: Vendedor
}

export interface Pagamento {
  id: string
  entrega_id: string
  forma_pagamento: string
  valor: number
  data_pagamento: string
  sincronizado?: boolean
  created_at: string
  updated_at: string
  // Relacionamentos
  entrega?: Entrega
}

export interface SuporteSolicitacao {
  id: string
  administrador_id: string
  nome_contato: string
  email_contato: string
  telefone_contato?: string
  tipo: 'bug' | 'duvida' | 'feature' | 'performance' | 'outro'
  urgencia: 'baixa' | 'media' | 'alta'
  assunto: string
  descricao: string
  anexo_url?: string
  status: 'aberto' | 'em_analise' | 'resolvido' | 'fechado'
  resposta_desenvolvedor?: string
  tempo_resposta_horas?: number
  sincronizado?: boolean
  created_at: string
  updated_at: string
  resolvido_em?: string
}

export interface SuporteMensagem {
  id: string
  solicitacao_id: string
  remetente_tipo: 'administrador' | 'desenvolvedor'
  remetente_nome: string
  mensagem: string
  anexo_url?: string
  sincronizado?: boolean
  created_at: string
}

export interface SistemaStatus {
  id: string
  status: 'operacional' | 'instavel' | 'manutencao' | 'offline'
  mensagem?: string
  inicio: string
  termino?: string
  notificar_usuarios?: boolean
  created_at: string
  updated_at: string
}
