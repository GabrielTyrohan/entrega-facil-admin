// src/services/contoraConfigService.ts
// Onboarding Fiscal Contora — ambiente de HOMOLOGAÇÃO.
// O navegador envia dados SOMENTE para as Edge Functions do Supabase.
// A chave da Fiscal Contora NÃO existe no frontend (fica no backend/Edge Function).
// Nunca persistir senha do certificado, Base64, arquivo .pfx/.p12 ou token em
// localStorage / sessionStorage / IndexedDB / Supabase Storage / banco / logs.
import { supabase } from '@/lib/supabase';

const EDGE_BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;
const CONFIGURAR_EMPRESA_FUNCTION = 'configurar-empresa-contora';
const ENVIAR_CERTIFICADO_FUNCTION = 'enviar-certificado-contora';

// Ambiente fixo em homologação — emissão SEFAZ em produção NÃO implementada.
export const CONTORA_AMBIENTE = 'homologacao' as const;

export type IndicadorIE = 1 | 2 | 9;
export type RegimeTributario = 1 | 2 | 3;

export interface EmpresaContoraPayload {
  razao_social: string;
  nome_fantasia?: string | null;
  cpf_cnpj: string;
  inscricao_estadual?: string | null;
  nfe_indicador_ie: IndicadorIE;
  nfe_regime_tributario: RegimeTributario;
  telefone?: string | null;
  cep: string;
  endereco: string;
  numero: string;
  complemento?: string | null;
  bairro: string;
  cidade: string;
  estado: string;
  codigo_municipio: string;
}

export interface EmpresaContoraResponse {
  success: boolean;
  created: boolean;
  companyId: string;
  hasCertificate: boolean;
  ambiente: string;
  status: string;
  [key: string]: unknown;
}

export interface CertificadoContoraResponse {
  success: boolean;
  hasCertificate: boolean;
  validade?: string | null;
  documento?: string | null;
  status: string;
  [key: string]: unknown;
}

export interface DadosFiscaisEmpresa {
  razao_social: string | null;
  nome_fantasia: string | null;
  nome_empresa: string | null;
  cpf_cnpj: string | null;
  inscricao_estadual: string | null;
  nfe_indicador_ie: number | null;
  nfe_regime_tributario: number | null;
  telefone: string | null;
  cep: string | null;
  endereco: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  estado: string | null;
  codigo_municipio: string | null;
  nfe_contora_company_id: string | null;
  nfe_integracao_status: string | null;
  nfe_contora_has_certificate: boolean | null;
  nfe_certificado_validade: string | null;
  nfe_contora_ultima_sincronizacao: string | null;
  [key: string]: unknown;
}

function somenteDigitos(valor: string | null | undefined): string {
  return (valor ?? '').replace(/\D/g, '');
}

/** Valida extensão do certificado — somente .pfx / .p12 */
export function isArquivoCertificadoValido(nomeArquivo: string): boolean {
  const nome = nomeArquivo.toLowerCase().trim();
  return nome.endsWith('.pfx') || nome.endsWith('.p12');
}

/**
 * Validação frontend (o backend continua sendo a autoridade).
 * Retorna mapa campo -> mensagem. Vazio = válido.
 */
export function validarDadosEmpresaContora(
  dados: Partial<EmpresaContoraPayload>,
): Record<string, string> {
  const erros: Record<string, string> = {};

  if (!dados.razao_social || !dados.razao_social.trim()) {
    erros.razao_social = 'Razão social é obrigatória.';
  }

  const cnpj = somenteDigitos(dados.cpf_cnpj);
  if (!cnpj) {
    erros.cpf_cnpj = 'CNPJ é obrigatório.';
  } else if (cnpj.length !== 14) {
    erros.cpf_cnpj = 'CNPJ deve conter 14 dígitos.';
  }

  if (
    dados.nfe_regime_tributario !== 1 &&
    dados.nfe_regime_tributario !== 2 &&
    dados.nfe_regime_tributario !== 3
  ) {
    erros.nfe_regime_tributario = 'Regime tributário é obrigatório.';
  }

  if (
    dados.nfe_indicador_ie !== 1 &&
    dados.nfe_indicador_ie !== 2 &&
    dados.nfe_indicador_ie !== 9
  ) {
    erros.nfe_indicador_ie = 'Situação da inscrição estadual é obrigatória.';
  }

  if (dados.nfe_indicador_ie === 1 && !dados.inscricao_estadual?.trim()) {
    erros.inscricao_estadual =
      'Inscrição estadual é obrigatória para contribuinte ICMS.';
  }

  const cep = somenteDigitos(dados.cep);
  if (!cep) {
    erros.cep = 'CEP é obrigatório.';
  } else if (cep.length !== 8) {
    erros.cep = 'CEP deve conter 8 dígitos.';
  }

  if (!dados.endereco?.trim()) erros.endereco = 'Endereço é obrigatório.';
  if (!dados.numero?.trim()) erros.numero = 'Número é obrigatório.';
  if (!dados.bairro?.trim()) erros.bairro = 'Bairro é obrigatório.';
  if (!dados.cidade?.trim()) erros.cidade = 'Cidade é obrigatória.';

  const uf = (dados.estado ?? '').trim().toUpperCase();
  if (!uf) {
    erros.estado = 'UF é obrigatória.';
  } else if (!/^[A-Z]{2}$/.test(uf)) {
    erros.estado = 'UF deve ter 2 letras.';
  }

  const ibge = somenteDigitos(dados.codigo_municipio);
  if (!ibge) {
    erros.codigo_municipio = 'Código IBGE é obrigatório.';
  } else if (ibge.length !== 7) {
    erros.codigo_municipio = 'Código IBGE deve conter 7 dígitos.';
  }

  return erros;
}

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

function normalizarEmpresaPayload(
  dados: EmpresaContoraPayload,
): Record<string, unknown> {
  return {
    razao_social: dados.razao_social.trim(),
    nome_fantasia: dados.nome_fantasia?.trim() || null,
    cpf_cnpj: somenteDigitos(dados.cpf_cnpj),
    inscricao_estadual: dados.inscricao_estadual?.trim() || null,
    nfe_indicador_ie: dados.nfe_indicador_ie,
    nfe_regime_tributario: dados.nfe_regime_tributario,
    telefone: dados.telefone?.trim() || null,
    cep: somenteDigitos(dados.cep),
    endereco: dados.endereco.trim(),
    numero: dados.numero.trim(),
    complemento: dados.complemento?.trim() || null,
    bairro: dados.bairro.trim(),
    cidade: dados.cidade.trim(),
    estado: dados.estado.trim().toUpperCase(),
    codigo_municipio: somenteDigitos(dados.codigo_municipio),
  };
}

/**
 * Cadastra/sincroniza a empresa na Fiscal Contora (homologação)
 * via Edge Function `configurar-empresa-contora`.
 * Somente ADMINISTRADOR (validação no backend).
 */
export async function sincronizarEmpresaContora(
  dados: EmpresaContoraPayload,
): Promise<EmpresaContoraResponse> {
  const accessToken = await getAccessToken();
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  const response = await fetch(
    `${EDGE_BASE}/${CONFIGURAR_EMPRESA_FUNCTION}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
        apikey: supabaseAnonKey,
      },
      body: JSON.stringify(normalizarEmpresaPayload(dados)),
    },
  );

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      (data as { error?: string })?.error ||
        `Erro ${response.status} ao cadastrar empresa fiscal`,
    );
  }

  if (!data?.success) {
    throw new Error(
      (data as { error?: string })?.error ||
        'Erro desconhecido ao cadastrar empresa fiscal',
    );
  }

  return data as EmpresaContoraResponse;
}

export interface EnviarCertificadoParams {
  certificadoBase64: string;
  senha: string;
  nomeArquivo: string;
}

/**
 * Envia o certificado A1 para a Edge Function `enviar-certificado-contora`.
 * A empresa precisa já ter sido cadastrada (etapa 1).
 * Aceita somente .pfx / .p12.
 * O chamador deve descartar o Base64 e a senha da memória/estado após a chamada.
 */
export async function enviarCertificadoContora(
  params: EnviarCertificadoParams,
): Promise<CertificadoContoraResponse> {
  if (!isArquivoCertificadoValido(params.nomeArquivo)) {
    throw new Error('Selecione um arquivo .pfx ou .p12.');
  }
  if (!params.certificadoBase64) {
    throw new Error('Certificado inválido. Selecione o arquivo novamente.');
  }
  if (!params.senha) {
    throw new Error('Informe a senha do certificado.');
  }

  const accessToken = await getAccessToken();
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  const response = await fetch(`${EDGE_BASE}/${ENVIAR_CERTIFICADO_FUNCTION}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
      apikey: supabaseAnonKey,
    },
    body: JSON.stringify({
      certificadoBase64: params.certificadoBase64,
      senha: params.senha,
      nomeArquivo: params.nomeArquivo,
    }),
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      (data as { error?: string })?.error ||
        `Erro ${response.status} ao enviar certificado`,
    );
  }

  if (!data?.success) {
    throw new Error(
      (data as { error?: string })?.error ||
        'Erro desconhecido ao enviar certificado',
    );
  }

  return data as CertificadoContoraResponse;
}

/**
 * Carrega os dados fiscais atuais da empresa (tabela `administradores`).
 * Usa `select('*')` para não quebrar se o cache do PostgREST ainda não
 * expuser alguma coluna nova.
 */
export async function carregarDadosFiscaisEmpresa(): Promise<DadosFiscaisEmpresa | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Não autenticado');

  const { data, error } = await supabase
    .from('administradores')
    .select('*')
    .eq('id', user.id)
    .single();

  if (error) throw new Error(error.message);
  return (data ?? null) as DadosFiscaisEmpresa | null;
}

export function mapearTextoStatusIntegracao(
  companyId: string | null | undefined,
  integracaoStatus: string | null | undefined,
): string {
  if (!companyId) return 'Empresa não configurada';
  if (integracaoStatus === 'pronta_homologacao') return 'Pronta para homologação';
  if (integracaoStatus === 'empresa_configurada')
    return 'Empresa configurada — certificado pendente';
  return integracaoStatus || 'Empresa não configurada';
}
