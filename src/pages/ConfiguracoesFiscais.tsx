import {
  AlertCircle,
  CheckCircle,
  Info,
  RefreshCw,
  Shield
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { buscarStatusCertificado } from '../services/nfeConfigService'

interface StatusFiscal {
  nfe_certificado_configurado: boolean
  nfe_certificado_validade: string | null
  nfe_ambiente: string | null
  nfe_regime_tributario: number | null
  nfe_integracao_status: string | null
}

// Formata data ISO (YYYY-MM-DD) sem converter timezone — evita subtrair 1 dia por BRT (UTC-3)
function formatarDataLocal(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null
  const apenasData = dateStr.split('T')[0]
  const [ano, mes, dia] = apenasData.split('-')
  return `${dia}/${mes}/${ano}`
}

// Verifica vencimento nos próximos 30 dias sem conversão de timezone
function certVencendoEm30Dias(dateStr: string | null | undefined): boolean {
  if (!dateStr) return false
  const [ano, mes, dia] = dateStr.split('T')[0].split('-').map(Number)
  const dataValidade = new Date(ano, mes - 1, dia, 12, 0, 0)
  return dataValidade < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
}

function regimeLabel(regime: number | null): string {
  if (regime === 1) return 'Simples Nacional'
  if (regime === 2) return 'Lucro Presumido'
  if (regime === 3) return 'Lucro Real'
  return 'Não informado'
}

export default function ConfiguracoesFiscais() {
  const [status, setStatus] = useState<StatusFiscal | null>(null)
  const [loadingStatus, setLoadingStatus] = useState(true)
  const [reloading, setReloading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    buscarStatusCertificado()
      .then((data) => {
        setStatus(data as StatusFiscal)
      })
      .catch((err) => {
        console.error(err)
        setErro(err?.message || 'Erro ao carregar status fiscal')
      })
      .finally(() => setLoadingStatus(false))
  }, [])

  async function recarregarStatus() {
    setReloading(true)
    setErro(null)
    try {
      const data = await buscarStatusCertificado()
      setStatus(data as StatusFiscal)
    } catch (err: any) {
      console.error('Erro ao recarregar status:', err)
      setErro(err?.message || 'Erro ao recarregar status')
    } finally {
      setReloading(false)
    }
  }

  const validadeFormatada = formatarDataLocal(status?.nfe_certificado_validade)
  const certVencendo = certVencendoEm30Dias(status?.nfe_certificado_validade)
  // `nfe_certificado_configurado` é exibido apenas como referência —
  // a fonte oficial do certificado nesta fase é o painel da Fiscal Contora.
  const certificadoGerenciadoContora = true

  return (
    <div className="space-y-4">

      {/* Header */}
      <div className="flex items-center gap-3">
        <Shield className="w-7 h-7 text-blue-600 dark:text-blue-400" />
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Configurações Fiscais</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Fiscal Contora — ambiente de homologação</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Coluna esquerda: Status da integração */}
        <div className="space-y-4">

          {loadingStatus && (
            <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 animate-pulse">
              <div className="flex gap-3">
                <div className="w-5 h-5 bg-gray-200 dark:bg-gray-600 rounded-full shrink-0 mt-0.5" />
                <div className="space-y-2 flex-1">
                  <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded w-48" />
                  <div className="h-3 bg-gray-100 dark:bg-gray-700 rounded w-32" />
                </div>
              </div>
            </div>
          )}

          {!loadingStatus && erro && (
            <div className="rounded-lg border border-red-200 dark:border-red-700 bg-red-50 dark:bg-red-900/20 p-4 text-sm text-red-700 dark:text-red-300 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              {erro}
            </div>
          )}

          {!loadingStatus && status && (
            <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 space-y-3">
              <h2 className="font-semibold text-gray-700 dark:text-gray-200">Fiscal Contora</h2>

              <dl className="text-sm space-y-2">
                <div className="flex justify-between gap-4">
                  <dt className="text-gray-500 dark:text-gray-400">Provedor fiscal:</dt>
                  <dd className="font-medium text-gray-900 dark:text-white text-right">Fiscal Contora</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-gray-500 dark:text-gray-400">Ambiente:</dt>
                  <dd className="font-medium text-right">
                    <span className="inline-flex px-2 py-0.5 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300">
                      Homologação
                    </span>
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-gray-500 dark:text-gray-400">Status da integração:</dt>
                  <dd className="font-medium text-gray-900 dark:text-white text-right">
                    {status.nfe_integracao_status || 'Não informado'}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-gray-500 dark:text-gray-400">Certificado:</dt>
                  <dd className="font-medium text-gray-900 dark:text-white text-right">
                    {certificadoGerenciadoContora
                      ? 'Gerenciado pela Fiscal Contora'
                      : status.nfe_certificado_configurado
                        ? 'Configurado'
                        : 'Não configurado'}
                  </dd>
                </div>
                {validadeFormatada && (
                  <div className="flex justify-between gap-4">
                    <dt className="text-gray-500 dark:text-gray-400">Validade (referência):</dt>
                    <dd className="font-medium text-gray-900 dark:text-white text-right">
                      {validadeFormatada}
                      {certVencendo && ' ⚠️'}
                    </dd>
                  </div>
                )}
                <div className="flex justify-between gap-4">
                  <dt className="text-gray-500 dark:text-gray-400">Regime tributário (referência):</dt>
                  <dd className="font-medium text-gray-900 dark:text-white text-right">
                    {regimeLabel(status.nfe_regime_tributario)}
                  </dd>
                </div>
              </dl>

              <button
                type="button"
                onClick={recarregarStatus}
                disabled={reloading}
                className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${reloading ? 'animate-spin' : ''}`} />
                {reloading ? 'Atualizando...' : 'Atualizar status'}
              </button>
            </div>
          )}

          {/* Aviso sobre certificado */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4 flex gap-3">
            <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
            <div className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
              <p className="font-medium">Como funciona nesta fase?</p>
              <ul className="list-disc list-inside space-y-0.5 text-xs">
                <li>O provedor fiscal é a <strong>Fiscal Contora</strong> em ambiente de <strong>homologação</strong>.</li>
                <li>O certificado digital da empresa é configurado no painel da Fiscal Contora durante a fase de homologação.</li>
                <li>Nenhuma NF-e é transmitida à SEFAZ nesta etapa — apenas validação da estrutura fiscal.</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Coluna direita: orientações (sem upload nesta etapa) */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-5 space-y-4 shadow-sm h-fit">
          <h2 className="font-semibold text-gray-700 dark:text-gray-200 flex items-center gap-2">
            <CheckCircle className="w-4 h-4" />
            Certificado digital
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Não é necessário enviar o arquivo .pfx nem a senha nesta tela durante a homologação.
            A configuração é feita diretamente no painel da Fiscal Contora.
          </p>
          <div className="rounded-lg bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 p-3 text-xs text-gray-600 dark:text-gray-300">
            Em caso de dúvidas sobre o certificado, verifique o status da integração ao lado
            ou fale com o responsável fiscal da empresa.
          </div>
        </div>
      </div>
    </div>
  )
}
