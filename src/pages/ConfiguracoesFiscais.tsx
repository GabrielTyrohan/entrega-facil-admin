import {
  AlertCircle,
  Building2,
  CheckCircle2,
  FileKey2,
  Info,
  Loader2,
  RefreshCw,
  Shield,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import {
  carregarDadosFiscaisEmpresa,
  enviarCertificadoContora,
  isArquivoCertificadoValido,
  mapearTextoStatusIntegracao,
  sincronizarEmpresaContora,
  validarDadosEmpresaContora,
  type EmpresaContoraPayload,
} from '../services/contoraConfigService';
import { toast } from '../utils/toast';

// Formata data ISO (YYYY-MM-DD) sem converter timezone — evita subtrair 1 dia por BRT (UTC-3)
function formatarDataLocal(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null;
  const apenasData = dateStr.split('T')[0];
  const partes = apenasData.split('-');
  if (partes.length < 3) return null;
  const [ano, mes, dia] = partes;
  return `${dia}/${mes}/${ano}`;
}

function certVencendoEm30Dias(dateStr: string | null | undefined): boolean {
  if (!dateStr) return false;
  const partes = dateStr.split('T')[0].split('-').map(Number);
  if (partes.length < 3 || partes.some(Number.isNaN)) return false;
  const [ano, mes, dia] = partes;
  const dataValidade = new Date(ano, mes - 1, dia, 12, 0, 0);
  return dataValidade.getTime() < Date.now() + 30 * 24 * 60 * 60 * 1000;
}

function regimeLabel(regime: number | null | undefined): string {
  if (regime === 1) return 'Simples Nacional';
  if (regime === 2) return 'Lucro Presumido';
  if (regime === 3) return 'Lucro Real';
  return 'Não informado';
}

function situacaoIELabel(indicador: number | null | undefined): string {
  if (indicador === 1) return 'Contribuinte ICMS';
  if (indicador === 2) return 'Contribuinte isento';
  if (indicador === 9) return 'Não contribuinte';
  return 'Não informado';
}

function somenteDigitos(valor: string): string {
  return valor.replace(/\D/g, '');
}

function formatarCNPJParaExibicao(digitos: string): string {
  const d = somenteDigitos(digitos).slice(0, 14);
  if (d.length <= 2) return d;
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`;
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`;
  if (d.length <= 12)
    return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

function formatarCEPParaExibicao(digitos: string): string {
  const d = somenteDigitos(digitos).slice(0, 8);
  if (d.length <= 5) return d;
  return `${d.slice(0, 5)}-${d.slice(5)}`;
}

interface ViaCepResponse {
  logradouro?: string;
  complemento?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
  ibge?: string;
  erro?: boolean;
}

async function buscarEnderecoPorCep(
  cepDigitos: string,
): Promise<ViaCepResponse | null> {
  if (cepDigitos.length !== 8) return null;
  try {
    const res = await fetch(`https://viacep.com.br/ws/${cepDigitos}/json/`);
    if (!res.ok) return null;
    const data = (await res.json()) as ViaCepResponse;
    if (data?.erro) return null;
    return data;
  } catch {
    return null;
  }
}

function arquivoParaBase64(arquivo: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Não foi possível ler o arquivo.'));
    reader.onload = () => {
      const resultado = reader.result as string;
      const partes = resultado.split(',');
      const base64 = partes.length > 1 ? partes[1] : '';
      if (!base64) {
        reject(new Error('Não foi possível ler o arquivo.'));
        return;
      }
      resolve(base64);
    };
    reader.readAsDataURL(arquivo);
  });
}

interface FormEmpresa {
  razao_social: string;
  nome_fantasia: string;
  cpf_cnpj: string;
  inscricao_estadual: string;
  nfe_indicador_ie: '' | '1' | '2' | '9';
  nfe_regime_tributario: '' | '1' | '2' | '3';
  telefone: string;
  cep: string;
  endereco: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  estado: string;
  codigo_municipio: string;
}

const FORM_INICIAL: FormEmpresa = {
  razao_social: '',
  nome_fantasia: '',
  cpf_cnpj: '',
  inscricao_estadual: '',
  nfe_indicador_ie: '',
  nfe_regime_tributario: '',
  telefone: '',
  cep: '',
  endereco: '',
  numero: '',
  complemento: '',
  bairro: '',
  cidade: '',
  estado: '',
  codigo_municipio: '',
};

interface ResumoFiscal {
  empresaId: string | null;
  integracaoStatus: string | null;
  temCertificado: boolean;
  validade: string | null;
  ultimaSincronizacao: string | null;
  regime: number | null;
  indicadorIE: number | null;
}

const UFS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA',
  'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN',
  'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
];

function aplicarDadosNaTela(
  dados: Awaited<ReturnType<typeof carregarDadosFiscaisEmpresa>>,
  setForm: (f: FormEmpresa) => void,
  setResumo: (r: ResumoFiscal) => void,
) {
  const d = (dados ?? {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === 'string' ? v : '');
  const num = (v: unknown) =>
    typeof v === 'number' ? v : typeof v === 'string' && v !== '' ? Number(v) : null;

  const indicador = num(d['nfe_indicador_ie']);
  const regime = num(d['nfe_regime_tributario']);

  setForm({
    razao_social: str(d['razao_social']),
    nome_fantasia: str(d['nome_fantasia']) || str(d['nome_empresa']),
    cpf_cnpj: somenteDigitos(str(d['cpf_cnpj'])),
    inscricao_estadual: str(d['inscricao_estadual']),
    nfe_indicador_ie:
      indicador === 1 || indicador === 2 || indicador === 9
        ? (String(indicador) as FormEmpresa['nfe_indicador_ie'])
        : '',
    nfe_regime_tributario:
      regime === 1 || regime === 2 || regime === 3
        ? (String(regime) as FormEmpresa['nfe_regime_tributario'])
        : '',
    telefone: str(d['telefone']),
    cep: somenteDigitos(str(d['cep'])),
    endereco: str(d['endereco']),
    numero: str(d['numero']),
    complemento: str(d['complemento']),
    bairro: str(d['bairro']),
    cidade: str(d['cidade']),
    estado: str(d['estado']).toUpperCase(),
    codigo_municipio: somenteDigitos(str(d['codigo_municipio'])),
  });

  const empresaId =
    typeof d['nfe_contora_company_id'] === 'string'
      ? (d['nfe_contora_company_id'] as string)
      : null;

  setResumo({
    empresaId,
    integracaoStatus:
      typeof d['nfe_integracao_status'] === 'string'
        ? (d['nfe_integracao_status'] as string)
        : null,
    temCertificado: d['nfe_contora_has_certificate'] === true,
    validade:
      typeof d['nfe_certificado_validade'] === 'string'
        ? (d['nfe_certificado_validade'] as string)
        : null,
    ultimaSincronizacao:
      typeof d['nfe_contora_ultima_sincronizacao'] === 'string'
        ? (d['nfe_contora_ultima_sincronizacao'] as string)
        : null,
    regime: regime,
    indicadorIE: indicador,
  });
}

export default function ConfiguracoesFiscais() {
  const [carregando, setCarregando] = useState(true);
  const [recarregando, setRecarregando] = useState(false);
  const [erroCarga, setErroCarga] = useState<string | null>(null);

  const [resumo, setResumo] = useState<ResumoFiscal>({
    empresaId: null,
    integracaoStatus: null,
    temCertificado: false,
    validade: null,
    ultimaSincronizacao: null,
    regime: null,
    indicadorIE: null,
  });
  const [form, setForm] = useState<FormEmpresa>(FORM_INICIAL);
  const [erros, setErros] = useState<Record<string, string>>({});
  const [salvandoEmpresa, setSalvandoEmpresa] = useState(false);
  const [msgEmpresa, setMsgEmpresa] = useState<{
    tipo: 'ok' | 'erro';
    texto: string;
  } | null>(null);
  const [buscandoCep, setBuscandoCep] = useState(false);

  const [arquivo, setArquivo] = useState<File | null>(null);
  const [senha, setSenha] = useState('');
  const [enviandoCert, setEnviandoCert] = useState(false);
  const [msgCert, setMsgCert] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null);
  const inputArquivoRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let ativo = true;
    carregarDadosFiscaisEmpresa()
      .then((dados) => {
        if (!ativo) return;
        aplicarDadosNaTela(dados, setForm, setResumo);
      })
      .catch((err: unknown) => {
        if (!ativo) return;
        const mensagem =
          err instanceof Error ? err.message : 'Erro ao carregar dados fiscais';
        setErroCarga(mensagem);
      })
      .finally(() => {
        if (ativo) setCarregando(false);
      });
    return () => {
      ativo = false;
    };
  }, []);

  async function recarregarDados() {
    setRecarregando(true);
    setErroCarga(null);
    try {
      const dados = await carregarDadosFiscaisEmpresa();
      aplicarDadosNaTela(dados, setForm, setResumo);
    } catch (err: unknown) {
      const mensagem =
        err instanceof Error ? err.message : 'Erro ao recarregar dados';
      setErroCarga(mensagem);
    } finally {
      setRecarregando(false);
    }
  }

  const temEmpresa = resumo.empresaId != null && resumo.empresaId !== '';
  const temCertificado = resumo.temCertificado === true;
  const textoStatus = mapearTextoStatusIntegracao(
    resumo.empresaId,
    resumo.integracaoStatus,
  );
  const validadeFormatada = formatarDataLocal(resumo.validade);
  const certVencendo = certVencendoEm30Dias(resumo.validade);
  const etapaAtual: 1 | 2 | 3 = !temEmpresa ? 1 : !temCertificado ? 2 : 3;

  function atualizarCampo<K extends keyof FormEmpresa>(campo: K, valor: FormEmpresa[K]) {
    setForm((prev) => ({ ...prev, [campo]: valor }));
    setErros((prev) => {
      if (!prev[campo]) return prev;
      const copia = { ...prev };
      delete copia[campo];
      return copia;
    });
  }

  async function handleBuscarCep() {
    const digitos = somenteDigitos(form.cep);
    if (digitos.length !== 8) {
      toast.error('Informe um CEP com 8 dígitos para buscar o endereço.');
      return;
    }
    setBuscandoCep(true);
    try {
      const dados = await buscarEnderecoPorCep(digitos);
      if (!dados) {
        toast.error('CEP não encontrado. Preencha o endereço manualmente.');
        return;
      }
      // Preenche endereço; código IBGE somente se a busca retornar (não inventar).
      setForm((prev) => ({
        ...prev,
        endereco: dados.logradouro || prev.endereco,
        bairro: dados.bairro || prev.bairro,
        cidade: dados.localidade || prev.cidade,
        estado: dados.uf || prev.estado,
        complemento: dados.complemento || prev.complemento,
        codigo_municipio: dados.ibge || prev.codigo_municipio,
      }));
      if (dados.ibge) {
        toast.success('Endereço preenchido. Código IBGE detectado.');
      } else {
        toast.success('Endereço preenchido a partir do CEP.');
      }
    } finally {
      setBuscandoCep(false);
    }
  }

  async function handleSalvarEmpresa(e: React.FormEvent) {
    e.preventDefault();
    setMsgEmpresa(null);

    const regime =
      form.nfe_regime_tributario === '' ? undefined : Number(form.nfe_regime_tributario);
    const indicador =
      form.nfe_indicador_ie === '' ? undefined : Number(form.nfe_indicador_ie);

    const errosValidacao = validarDadosEmpresaContora({
      razao_social: form.razao_social,
      nome_fantasia: form.nome_fantasia,
      cpf_cnpj: form.cpf_cnpj,
      inscricao_estadual: form.inscricao_estadual,
      nfe_indicador_ie: indicador as 1 | 2 | 9,
      nfe_regime_tributario: regime as 1 | 2 | 3,
      telefone: form.telefone,
      cep: form.cep,
      endereco: form.endereco,
      numero: form.numero,
      complemento: form.complemento,
      bairro: form.bairro,
      cidade: form.cidade,
      estado: form.estado,
      codigo_municipio: form.codigo_municipio,
    });

    if (Object.keys(errosValidacao).length > 0) {
      setErros(errosValidacao);
      toast.error('Verifique os campos destacados antes de continuar.');
      return;
    }

    const payload: EmpresaContoraPayload = {
      razao_social: form.razao_social.trim(),
      nome_fantasia: form.nome_fantasia.trim() || null,
      cpf_cnpj: somenteDigitos(form.cpf_cnpj),
      inscricao_estadual: form.inscricao_estadual.trim() || null,
      nfe_indicador_ie: Number(form.nfe_indicador_ie) as 1 | 2 | 9,
      nfe_regime_tributario: Number(form.nfe_regime_tributario) as 1 | 2 | 3,
      telefone: form.telefone.trim() || null,
      cep: somenteDigitos(form.cep),
      endereco: form.endereco.trim(),
      numero: form.numero.trim(),
      complemento: form.complemento.trim() || null,
      bairro: form.bairro.trim(),
      cidade: form.cidade.trim(),
      estado: form.estado.trim().toUpperCase(),
      codigo_municipio: somenteDigitos(form.codigo_municipio),
    };

    setSalvandoEmpresa(true);
    try {
      const resposta = await sincronizarEmpresaContora(payload);
      const texto = 'Empresa cadastrada na Fiscal Contora em homologação.';
      setMsgEmpresa({ tipo: 'ok', texto });
      toast.success(texto);
      setResumo((prev) => ({
        ...prev,
        empresaId: (resposta.companyId as string) ?? prev.empresaId,
        integracaoStatus: (resposta.status as string) ?? prev.integracaoStatus,
        temCertificado: Boolean(resposta.hasCertificate) || prev.temCertificado,
      }));
      // Recarrega do banco (backend salva empresa, status e sincronização).
      try {
        const dados = await carregarDadosFiscaisEmpresa();
        aplicarDadosNaTela(dados, setForm, setResumo);
      } catch {
        // Mantém o estado vindo da resposta se a releitura falhar.
      }
    } catch (err: unknown) {
      const mensagem =
        err instanceof Error ? err.message : 'Erro ao cadastrar empresa fiscal';
      setMsgEmpresa({ tipo: 'erro', texto: mensagem });
      toast.error(mensagem);
    } finally {
      setSalvandoEmpresa(false);
    }
  }

  function handleSelecionarArquivo(e: React.ChangeEvent<HTMLInputElement>) {
    setMsgCert(null);
    const selecionado = e.target.files?.[0] ?? null;
    if (!selecionado) {
      setArquivo(null);
      return;
    }
    if (!isArquivoCertificadoValido(selecionado.name)) {
      setArquivo(null);
      if (inputArquivoRef.current) inputArquivoRef.current.value = '';
      const mensagem = 'Selecione um arquivo .pfx ou .p12.';
      setMsgCert({ tipo: 'erro', texto: mensagem });
      toast.error(mensagem);
      return;
    }
    setArquivo(selecionado);
  }

  function limparCertificadoLocal() {
    // Descarta senha e arquivo da memória/estado; nunca persistir.
    setSenha('');
    setArquivo(null);
    if (inputArquivoRef.current) inputArquivoRef.current.value = '';
  }

  async function handleEnviarCertificado(e: React.FormEvent) {
    e.preventDefault();
    setMsgCert(null);

    if (!temEmpresa) {
      const mensagem = 'Cadastre a empresa fiscal na etapa 1 antes de enviar o certificado.';
      setMsgCert({ tipo: 'erro', texto: mensagem });
      toast.error(mensagem);
      return;
    }
    if (!arquivo) {
      const mensagem = 'Selecione o arquivo .pfx ou .p12 do certificado.';
      setMsgCert({ tipo: 'erro', texto: mensagem });
      return;
    }
    if (!senha) {
      const mensagem = 'Informe a senha do certificado.';
      setMsgCert({ tipo: 'erro', texto: mensagem });
      return;
    }

    setEnviandoCert(true);
    try {
      // Base64 vive apenas neste escopo e é descartado após a requisição.
      const base64 = await arquivoParaBase64(arquivo);
      const nomeArquivo = arquivo.name;
      const resposta = await enviarCertificadoContora({
        certificadoBase64: base64,
        senha,
        nomeArquivo,
      });

      const validadeResposta =
        typeof resposta.validade === 'string' ? resposta.validade : null;
      const validadeTexto = formatarDataLocal(validadeResposta);
      const textoBase = 'Certificado A1 configurado com sucesso.';
      const textoFinal = validadeTexto
        ? `${textoBase} Válido até ${validadeTexto}.`
        : textoBase;
      setMsgCert({ tipo: 'ok', texto: textoFinal });
      toast.success(textoBase);

      if (validadeResposta) {
        setResumo((prev) => ({
          ...prev,
          validade: validadeResposta,
          temCertificado: true,
          integracaoStatus: (resposta.status as string) ?? prev.integracaoStatus,
        }));
      }

      // Recarrega status do banco sem manter segredos em memória.
      try {
        const dados = await carregarDadosFiscaisEmpresa();
        aplicarDadosNaTela(dados, setForm, setResumo);
      } catch {
        // Mantém o estado local se a releitura falhar.
      }
    } catch (err: unknown) {
      const mensagem =
        err instanceof Error ? err.message : 'Erro ao enviar certificado';
      setMsgCert({ tipo: 'erro', texto: mensagem });
      toast.error(mensagem);
    } finally {
      limparCertificadoLocal();
      setEnviandoCert(false);
    }
  }

  const campoBase =
    'w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white disabled:opacity-60 disabled:cursor-not-allowed ';
  const campoOk = 'border-gray-300 dark:border-gray-600';
  const campoErro = 'border-red-400 dark:border-red-500';
  const classeCampo = (nome: string) => `${campoBase}${erros[nome] ? campoErro : campoOk}`;

  function ErroCampo({ nome }: { nome: string }) {
    if (!erros[nome]) return null;
    return <p className="mt-1 text-xs text-red-600 dark:text-red-400">{erros[nome]}</p>;
  }

  function Passo({
    numero,
    titulo,
    concluido,
    atual,
  }: {
    numero: number;
    titulo: string;
    concluido: boolean;
    atual: boolean;
  }) {
    return (
      <div className="flex items-center gap-2">
        <span
          className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${
            concluido
              ? 'bg-green-600 text-white'
              : atual
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
          }`}
        >
          {concluido ? <CheckCircle2 className="w-4 h-4" /> : numero}
        </span>
        <span
          className={`text-sm font-medium ${
            atual || concluido
              ? 'text-gray-900 dark:text-white'
              : 'text-gray-500 dark:text-gray-400'
          }`}
        >
          {titulo}
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Shield className="w-7 h-7 text-blue-600 dark:text-blue-400" />
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">
            Configuração Fiscal
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Empresa fiscal e certificado digital — ambiente de homologação
          </p>
        </div>
      </div>

      {carregando ? (
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 animate-pulse">
          <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded w-48" />
          <div className="mt-2 h-3 bg-gray-100 dark:bg-gray-700 rounded w-32" />
        </div>
      ) : (
        <>
          {erroCarga && (
            <div className="rounded-lg border border-red-200 dark:border-red-700 bg-red-50 dark:bg-red-900/20 p-4 text-sm text-red-700 dark:text-red-300 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{erroCarga}</span>
            </div>
          )}

          {/* Status da integração */}
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-semibold text-gray-700 dark:text-gray-200">
                Situação da integração
              </h2>
              <button
                type="button"
                onClick={recarregarDados}
                disabled={recarregando}
                className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${recarregando ? 'animate-spin' : ''}`} />
                {recarregando ? 'Atualizando...' : 'Atualizar situação'}
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <Passo numero={1} titulo="Empresa fiscal" concluido={temEmpresa} atual={etapaAtual === 1} />
              <Passo numero={2} titulo="Certificado digital" concluido={temCertificado} atual={etapaAtual === 2} />
              <Passo numero={3} titulo="Homologação" concluido={etapaAtual === 3} atual={etapaAtual === 3} />
            </div>

            <dl className="text-sm space-y-2">
              <div className="flex justify-between gap-4">
                <dt className="text-gray-500 dark:text-gray-400">Ambiente:</dt>
                <dd className="font-medium text-right">
                  <span className="inline-flex px-2 py-0.5 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300">
                    Homologação
                  </span>
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-gray-500 dark:text-gray-400">Empresa:</dt>
                <dd className="font-medium text-gray-900 dark:text-white text-right">
                  {temEmpresa ? 'Configurada ✓' : 'Não configurada'}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-gray-500 dark:text-gray-400">Certificado:</dt>
                <dd className="font-medium text-gray-900 dark:text-white text-right">
                  {temCertificado ? 'Configurado ✓' : 'Pendente'}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-gray-500 dark:text-gray-400">Status:</dt>
                <dd className="font-medium text-gray-900 dark:text-white text-right">
                  {textoStatus}
                </dd>
              </div>
              {validadeFormatada && (
                <div className="flex justify-between gap-4">
                  <dt className="text-gray-500 dark:text-gray-400">Validade do certificado:</dt>
                  <dd className="font-medium text-gray-900 dark:text-white text-right">
                    {validadeFormatada}
                    {certVencendo && ' ⚠️'}
                  </dd>
                </div>
              )}
              <div className="flex justify-between gap-4">
                <dt className="text-gray-500 dark:text-gray-400">Regime tributário:</dt>
                <dd className="font-medium text-gray-900 dark:text-white text-right">
                  {regimeLabel(resumo.regime)}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-gray-500 dark:text-gray-400">Situação da inscrição:</dt>
                <dd className="font-medium text-gray-900 dark:text-white text-right">
                  {situacaoIELabel(resumo.indicadorIE)}
                </dd>
              </div>
            </dl>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
            {/* ETAPA 1 — Dados da empresa */}
            <form
              onSubmit={handleSalvarEmpresa}
              className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-5 space-y-4 shadow-sm"
            >
              <h2 className="font-semibold text-gray-700 dark:text-gray-200 flex items-center gap-2">
                <Building2 className="w-4 h-4" />
                Etapa 1 — Dados da empresa
              </h2>

              {msgEmpresa && (
                <div
                  className={`rounded-lg border p-3 text-sm flex items-start gap-2 ${
                    msgEmpresa.tipo === 'ok'
                      ? 'border-green-200 bg-green-50 text-green-700 dark:border-green-700 dark:bg-green-900/20 dark:text-green-300'
                      : 'border-red-200 bg-red-50 text-red-700 dark:border-red-700 dark:bg-red-900/20 dark:text-red-300'
                  }`}
                >
                  {msgEmpresa.tipo === 'ok' ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  )}
                  <span>{msgEmpresa.texto}</span>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Razão Social *
                  </label>
                  <input
                    type="text"
                    value={form.razao_social}
                    onChange={(e) => atualizarCampo('razao_social', e.target.value)}
                    className={classeCampo('razao_social')}
                    placeholder="Razão social da empresa"
                    disabled={salvandoEmpresa}
                  />
                  <ErroCampo nome="razao_social" />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Nome Fantasia
                  </label>
                  <input
                    type="text"
                    value={form.nome_fantasia}
                    onChange={(e) => atualizarCampo('nome_fantasia', e.target.value)}
                    className={classeCampo('nome_fantasia')}
                    placeholder="Nome fantasia (opcional)"
                    disabled={salvandoEmpresa}
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    CNPJ *
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={formatarCNPJParaExibicao(form.cpf_cnpj)}
                    onChange={(e) =>
                      atualizarCampo('cpf_cnpj', somenteDigitos(e.target.value).slice(0, 14))
                    }
                    className={classeCampo('cpf_cnpj')}
                    placeholder="00.000.000/0000-00"
                    disabled={salvandoEmpresa}
                  />
                  <ErroCampo nome="cpf_cnpj" />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Telefone
                  </label>
                  <input
                    type="text"
                    inputMode="tel"
                    value={form.telefone}
                    onChange={(e) => atualizarCampo('telefone', e.target.value)}
                    className={classeCampo('telefone')}
                    placeholder="(11) 99999-9999"
                    disabled={salvandoEmpresa}
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Regime Tributário *
                  </label>
                  <select
                    value={form.nfe_regime_tributario}
                    onChange={(e) =>
                      atualizarCampo(
                        'nfe_regime_tributario',
                        e.target.value as FormEmpresa['nfe_regime_tributario'],
                      )
                    }
                    className={classeCampo('nfe_regime_tributario')}
                    disabled={salvandoEmpresa}
                  >
                    <option value="">Selecione...</option>
                    <option value="1">Simples Nacional</option>
                    <option value="2">Lucro Presumido</option>
                    <option value="3">Lucro Real</option>
                  </select>
                  <ErroCampo nome="nfe_regime_tributario" />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Situação da Inscrição Estadual *
                  </label>
                  <select
                    value={form.nfe_indicador_ie}
                    onChange={(e) =>
                      atualizarCampo(
                        'nfe_indicador_ie',
                        e.target.value as FormEmpresa['nfe_indicador_ie'],
                      )
                    }
                    className={classeCampo('nfe_indicador_ie')}
                    disabled={salvandoEmpresa}
                  >
                    <option value="">Selecione...</option>
                    <option value="1">Contribuinte ICMS</option>
                    <option value="2">Contribuinte isento</option>
                    <option value="9">Não contribuinte</option>
                  </select>
                  <ErroCampo nome="nfe_indicador_ie" />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Inscrição Estadual{' '}
                    {form.nfe_indicador_ie === '1' ? (
                      '*'
                    ) : (
                      <span className="font-normal text-gray-400">
                        (obrigatória apenas para contribuinte ICMS)
                      </span>
                    )}
                  </label>
                  <input
                    type="text"
                    value={form.inscricao_estadual}
                    onChange={(e) => atualizarCampo('inscricao_estadual', e.target.value)}
                    className={classeCampo('inscricao_estadual')}
                    placeholder="Inscrição estadual"
                    disabled={salvandoEmpresa}
                  />
                  <ErroCampo nome="inscricao_estadual" />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    CEP *
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      inputMode="numeric"
                      value={formatarCEPParaExibicao(form.cep)}
                      onChange={(e) =>
                        atualizarCampo('cep', somenteDigitos(e.target.value).slice(0, 8))
                      }
                      onBlur={() => {
                        if (somenteDigitos(form.cep).length === 8) void handleBuscarCep();
                      }}
                      className={classeCampo('cep')}
                      placeholder="00000-000"
                      disabled={salvandoEmpresa || buscandoCep}
                    />
                    <button
                      type="button"
                      onClick={handleBuscarCep}
                      disabled={salvandoEmpresa || buscandoCep}
                      className="shrink-0 px-3 py-2 text-xs font-medium rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
                    >
                      {buscandoCep ? 'Buscando...' : 'Buscar'}
                    </button>
                  </div>
                  <ErroCampo nome="cep" />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Código IBGE *
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={form.codigo_municipio}
                    onChange={(e) =>
                      atualizarCampo(
                        'codigo_municipio',
                        somenteDigitos(e.target.value).slice(0, 7),
                      )
                    }
                    className={classeCampo('codigo_municipio')}
                    placeholder="Preenchido via CEP"
                    disabled={salvandoEmpresa}
                  />
                  <ErroCampo nome="codigo_municipio" />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Endereço *
                  </label>
                  <input
                    type="text"
                    value={form.endereco}
                    onChange={(e) => atualizarCampo('endereco', e.target.value)}
                    className={classeCampo('endereco')}
                    placeholder="Rua, avenida..."
                    disabled={salvandoEmpresa}
                  />
                  <ErroCampo nome="endereco" />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Número *
                  </label>
                  <input
                    type="text"
                    value={form.numero}
                    onChange={(e) => atualizarCampo('numero', e.target.value)}
                    className={classeCampo('numero')}
                    placeholder="Número"
                    disabled={salvandoEmpresa}
                  />
                  <ErroCampo nome="numero" />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Complemento
                  </label>
                  <input
                    type="text"
                    value={form.complemento}
                    onChange={(e) => atualizarCampo('complemento', e.target.value)}
                    className={classeCampo('complemento')}
                    placeholder="Sala, bloco... (opcional)"
                    disabled={salvandoEmpresa}
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Bairro *
                  </label>
                  <input
                    type="text"
                    value={form.bairro}
                    onChange={(e) => atualizarCampo('bairro', e.target.value)}
                    className={classeCampo('bairro')}
                    placeholder="Bairro"
                    disabled={salvandoEmpresa}
                  />
                  <ErroCampo nome="bairro" />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Cidade *
                  </label>
                  <input
                    type="text"
                    value={form.cidade}
                    onChange={(e) => atualizarCampo('cidade', e.target.value)}
                    className={classeCampo('cidade')}
                    placeholder="Cidade"
                    disabled={salvandoEmpresa}
                  />
                  <ErroCampo nome="cidade" />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    UF *
                  </label>
                  <select
                    value={form.estado}
                    onChange={(e) => atualizarCampo('estado', e.target.value.toUpperCase())}
                    className={classeCampo('estado')}
                    disabled={salvandoEmpresa}
                  >
                    <option value="">Selecione...</option>
                    {UFS.map((uf) => (
                      <option key={uf} value={uf}>
                        {uf}
                      </option>
                    ))}
                  </select>
                  <ErroCampo nome="estado" />
                </div>
              </div>

              <button
                type="submit"
                disabled={salvandoEmpresa}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {salvandoEmpresa && <Loader2 className="w-4 h-4 animate-spin" />}
                {salvandoEmpresa
                  ? 'Salvando...'
                  : temEmpresa
                    ? 'Sincronizar dados fiscais'
                    : 'Cadastrar empresa fiscal'}
              </button>
            </form>

            {/* ETAPA 2 — Certificado */}
            <div className="space-y-4">
              <form
                onSubmit={handleEnviarCertificado}
                className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-5 space-y-4 shadow-sm"
              >
                <h2 className="font-semibold text-gray-700 dark:text-gray-200 flex items-center gap-2">
                  <FileKey2 className="w-4 h-4" />
                  Etapa 2 — Certificado Digital A1
                </h2>

                {!temEmpresa && (
                  <div className="rounded-lg bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 p-3 text-xs text-gray-600 dark:text-gray-300">
                    Cadastre a empresa fiscal na etapa 1 para habilitar o envio
                    do certificado.
                  </div>
                )}

                {msgCert && (
                  <div
                    className={`rounded-lg border p-3 text-sm flex items-start gap-2 ${
                      msgCert.tipo === 'ok'
                        ? 'border-green-200 bg-green-50 text-green-700 dark:border-green-700 dark:bg-green-900/20 dark:text-green-300'
                        : 'border-red-200 bg-red-50 text-red-700 dark:border-red-700 dark:bg-red-900/20 dark:text-red-300'
                    }`}
                  >
                    {msgCert.tipo === 'ok' ? (
                      <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    )}
                    <span>{msgCert.texto}</span>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Arquivo do certificado (.pfx / .p12)
                  </label>
                  <input
                    ref={inputArquivoRef}
                    type="file"
                    accept=".pfx,.p12"
                    onChange={handleSelecionarArquivo}
                    disabled={!temEmpresa || enviandoCert}
                    className="w-full text-xs text-gray-600 dark:text-gray-300 file:mr-3 file:px-3 file:py-2 file:text-xs file:font-medium file:rounded-lg file:border file:border-gray-300 dark:file:border-gray-600 file:bg-gray-50 dark:file:bg-gray-700 file:text-gray-700 dark:file:text-gray-200 hover:file:bg-gray-100 dark:hover:file:bg-gray-600 disabled:opacity-60"
                  />
                  {arquivo && (
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      Selecionado: {arquivo.name}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Senha do certificado
                  </label>
                  <input
                    type="password"
                    autoComplete="off"
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                    disabled={!temEmpresa || enviandoCert}
                    className={`${campoBase}${campoOk}`}
                    placeholder="Senha do certificado"
                  />
                </div>

                <button
                  type="submit"
                  disabled={!temEmpresa || enviandoCert || !arquivo || !senha}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {enviandoCert && <Loader2 className="w-4 h-4 animate-spin" />}
                  {enviandoCert ? 'Enviando certificado com segurança...' : 'Enviar certificado'}
                </button>

                <p className="text-[11px] leading-relaxed text-gray-500 dark:text-gray-400">
                  O arquivo e a senha são enviados com segurança e não ficam
                  salvos nesta tela após o envio.
                </p>
              </form>

              {/* Etapa 3 — orientação */}
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4 flex gap-3">
                <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                <div className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
                  <p className="font-medium">Como funciona nesta fase?</p>
                  <ul className="list-disc list-inside space-y-0.5 text-xs">
                    <li>
                      A empresa fiscal é cadastrada em ambiente de{' '}
                      <strong>homologação</strong>.
                    </li>
                    <li>
                      Depois do certificado, a situação passa a{' '}
                      <strong>pronta para homologação</strong>.
                    </li>
                    <li>
                      Nenhuma nota é transmitida de verdade nesta etapa — apenas
                      validação da estrutura fiscal.
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
