// src/services/funcionarioAdminService.ts
// Operações ADMINISTRATIVAS de funcionários via Edge Function segura
// `gerenciar-funcionario`. O navegador nunca cria usuário via auth.signUp()
// nem escreve direto em `funcionarios` nesse fluxo.
// O backend deriva administrador_id/auth_user_id/nome_empresa e valida
// que o chamador é ADMINISTRADOR. Nunca enviar service_role ao frontend.
// Nunca logar senha, access_token ou body contendo senha.
import { supabase } from '@/lib/supabase';

const GERENCIAR_FUNCIONARIO_FUNCTION = 'gerenciar-funcionario';

function edgeBase(): string {
  return `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;
}

// Conjunto real de permissões configuráveis no modal de funcionário.
// NÃO inclui `funcionarios`, `configuracoes` nem `configuracoes_fiscais`
// porque essas páginas são ADMIN ONLY.
export interface FuncionarioPermissions {
  orcamentos_pj: boolean;
  vendas_atacado: boolean;
  notas_fiscais: boolean;
  caixa: boolean;
  acertos: boolean;
  relatorios: boolean;
  vendedores: boolean;
  produtos: boolean;
  expedicao?: boolean;
}

export interface CreateFuncionarioInput {
  nome: string;
  email: string;
  senha: string;
  telefone: string | null;
  cargo: string | null;
  permissoes: FuncionarioPermissions;
}

export interface UpdateFuncionarioInput {
  id: string;
  nome: string;
  email: string;
  telefone: string | null;
  cargo: string | null;
  permissoes: FuncionarioPermissions;
}

export interface GerenciarFuncionarioResponse {
  success: boolean;
  funcionarioId?: string;
  message?: string;
  error?: string;
  [key: string]: unknown;
}

type GerenciarAction = 'create' | 'update' | 'set_active' | 'reset_password';

async function getAccessToken(): Promise<string> {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();
  if (error || !session?.access_token) {
    throw new Error('Sessão expirada. Faça login novamente.');
  }
  return session.access_token;
}

// Extrai mensagem segura do backend. Nunca inclui payload, token ou senha.
function extrairMensagemErro(data: unknown, status: number): string {
  if (data && typeof data === 'object') {
    const registro = data as { error?: unknown; message?: unknown };
    if (typeof registro.error === 'string' && registro.error.trim()) {
      return registro.error;
    }
    if (typeof registro.message === 'string' && registro.message.trim()) {
      return registro.message;
    }
  }
  if (status === 403) return 'Acesso restrito ao administrador';
  return 'Erro ao gerenciar funcionário';
}

export async function chamarGerenciarFuncionario(
  action: GerenciarAction,
  payload: Record<string, unknown>,
): Promise<GerenciarFuncionarioResponse> {
  const accessToken = await getAccessToken();

  const response = await fetch(`${edgeBase()}/${GERENCIAR_FUNCIONARIO_FUNCTION}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ action, ...payload }),
  });

  const data = (await response.json().catch(() => null)) as
    | GerenciarFuncionarioResponse
    | null;

  if (!response.ok) {
    throw new Error(extrairMensagemErro(data, response.status));
  }
  if (!data?.success) {
    throw new Error(extrairMensagemErro(data, response.status));
  }
  return data;
}

export function criarFuncionarioSeguro(
  input: CreateFuncionarioInput,
): Promise<GerenciarFuncionarioResponse> {
  return chamarGerenciarFuncionario('create', {
    nome: input.nome,
    email: input.email,
    senha: input.senha,
    telefone: input.telefone,
    cargo: input.cargo,
    permissoes: input.permissoes,
  });
}

export function atualizarFuncionarioSeguro(
  input: UpdateFuncionarioInput,
): Promise<GerenciarFuncionarioResponse> {
  return chamarGerenciarFuncionario('update', {
    funcionarioId: input.id,
    nome: input.nome,
    email: input.email,
    telefone: input.telefone,
    cargo: input.cargo,
    permissoes: input.permissoes,
  });
}

export function alterarStatusFuncionarioSeguro(
  id: string,
  ativo: boolean,
): Promise<GerenciarFuncionarioResponse> {
  return chamarGerenciarFuncionario('set_active', {
    funcionarioId: id,
    ativo,
  });
}

export function redefinirSenhaFuncionarioSeguro(
  id: string,
  senha: string,
): Promise<GerenciarFuncionarioResponse> {
  return chamarGerenciarFuncionario('reset_password', {
    funcionarioId: id,
    senha,
  });
}
