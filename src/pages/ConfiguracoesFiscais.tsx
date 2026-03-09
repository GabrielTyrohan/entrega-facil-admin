import {
  AlertCircle,
  CheckCircle,
  FileKey,
  Info,
  RefreshCw,
  Shield,
  Upload
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { buscarStatusCertificado, configurarEmpresaNFe } from '../services/nfeConfigService'

type Ambiente = 'producao'
type Regime = 1 | 2 | 3

interface StatusCert {
  nfe_certificado_configurado: boolean
  nfe_certificado_validade: string | null
  nfe_ambiente: string
  nfe_regime_tributario: number
}

export default function ConfiguracoesFiscais() {
  const [status, setStatus] = useState<StatusCert | null>(null)
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [senha, setSenha] = useState('')
  const [ambiente, setAmbiente] = useState<Ambiente>('producao')
  const [regime, setRegime] = useState<Regime>(1)
  const [loading, setLoading] = useState(false)
  const [loadingStatus, setLoadingStatus] = useState(true)
  const [mensagem, setMensagem] = useState<{ tipo: 'sucesso' | 'erro'; texto: string } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    buscarStatusCertificado()
      .then((data) => {
        setStatus(data)
        setAmbiente((data.nfe_ambiente as Ambiente) || 'producao')
        setRegime((data.nfe_regime_tributario as Regime) || 1)
      })
      .catch(console.error)
      .finally(() => setLoadingStatus(false))
  }, [])

  async function recarregarStatus() {
    try {
      await new Promise(r => setTimeout(r, 500))
      const data = await buscarStatusCertificado()
      setStatus(data)
      setAmbiente((data.nfe_ambiente as Ambiente) || 'producao')
      setRegime((data.nfe_regime_tributario as Regime) || 1)
    } catch (err) {
      console.error('Erro ao recarregar status:', err)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!arquivo || !senha) return

    setLoading(true)
    setMensagem(null)

    try {
      const arrayBuffer = await arquivo.arrayBuffer()
      const bytes = new Uint8Array(arrayBuffer)
      let binary = ''
      bytes.forEach(b => (binary += String.fromCharCode(b)))
      const base64 = btoa(binary)

      const result = await configurarEmpresaNFe({
        certificadoBase64: base64,
        senha,
        ambiente,
        regimeTributario: regime,
        homologacaoAutomatica: false,
      })

      setMensagem({
        tipo: 'sucesso',
        texto: `Certificado configurado com sucesso! Válido até: ${
          result.validade
            ? new Date(result.validade).toLocaleDateString('pt-BR')
            : 'N/A'
        }`,
      })

      await recarregarStatus()

      setSenha('')
      setArquivo(null)
      if (inputRef.current) inputRef.current.value = ''
    } catch (err: any) {
      setMensagem({ tipo: 'erro', texto: err.message })
    } finally {
      setLoading(false)
    }
  }


  const validadeFormatada = status?.nfe_certificado_validade
    ? new Date(status.nfe_certificado_validade).toLocaleDateString('pt-BR')
    : null

  const certVencendo = status?.nfe_certificado_validade
    ? new Date(status.nfe_certificado_validade) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    : false

  return (
    <div className="space-y-4">

      {/* Header */}
      <div className="flex items-center gap-3">
        <Shield className="w-7 h-7 text-blue-600 dark:text-blue-400" />
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Configurações Fiscais</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Certificado digital A1 para emissão de NF-e</p>
        </div>
      </div>

      {/* Layout em 2 colunas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Coluna esquerda: Status + Info + Homologação automática */}
        <div className="space-y-4">

          {/* Skeleton de loading do status */}
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

          {/* Card de Status atual */}
          {!loadingStatus && status && (
            <div
              className={`rounded-lg border p-4 ${
                status.nfe_certificado_configurado
                  ? certVencendo
                    ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-700'
                    : 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700'
                  : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700'
              }`}
            >
              <div className="flex items-start gap-3">
                {status.nfe_certificado_configurado ? (
                  certVencendo ? (
                    <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mt-0.5 shrink-0" />
                  ) : (
                    <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 mt-0.5 shrink-0" />
                  )
                ) : (
                  <AlertCircle className="w-5 h-5 text-red-500 dark:text-red-400 mt-0.5 shrink-0" />
                )}
                <div className="space-y-1">
                  <p
                    className={`font-medium text-sm ${
                      status.nfe_certificado_configurado
                        ? certVencendo
                          ? 'text-yellow-800 dark:text-yellow-300'
                          : 'text-green-800 dark:text-green-300'
                        : 'text-red-700 dark:text-red-400'
                    }`}
                  >
                    {status.nfe_certificado_configurado
                      ? certVencendo
                        ? '⚠️ Certificado próximo do vencimento'
                        : '✅ Certificado configurado'
                      : '❌ Certificado não configurado'}
                  </p>
                  {status.nfe_certificado_configurado && (
                    <div className="text-xs text-gray-600 dark:text-gray-400 space-y-0.5">
                      <p>Válido até: <strong className="dark:text-gray-300">{validadeFormatada || 'N/A'}</strong></p>
                      <p>
                        Ambiente:{' '}
                        <strong className="text-green-700 dark:text-green-400">
                          🟢 Produção
                        </strong>
                      </p>
                      <p>
                        Regime tributário:{' '}
                        <strong className="dark:text-gray-300">
                          {status.nfe_regime_tributario === 1 ? 'Simples Nacional' : status.nfe_regime_tributario === 2 ? 'Lucro Presumido' : 'Lucro Real'}
                        </strong>
                      </p>
                    </div>
                  )}
                  {!status.nfe_certificado_configurado && (
                    <p className="text-xs text-red-600 dark:text-red-400">
                      Configure o certificado para habilitar a emissão de NF-e
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Aviso sobre ambientes */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4 flex gap-3">
            <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
            <div className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
              <p className="font-medium">Como funciona?</p>
              <ul className="list-disc list-inside space-y-0.5 text-xs">
                <li>O certificado A1 é o arquivo <strong>.pfx</strong> fornecido pela certificadora</li>
                <li>O arquivo nunca é salvo no sistema — vai direto para a Nuvem Fiscal</li>
                <li>Após configurar, a emissão de NF-e fica habilitada automaticamente</li>
              </ul>
            </div>
          </div>

          {/* Feedback */}
          {mensagem && (
            <div
              className={`rounded-lg p-3 text-sm flex items-start gap-2 ${
                mensagem.tipo === 'sucesso'
                  ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 text-green-700 dark:text-green-300'
                  : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-300'
              }`}
            >
              {mensagem.tipo === 'sucesso' ? (
                <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              )}
              {mensagem.texto}
            </div>
          )}
        </div>

        {/* Coluna direita: Formulário de certificado manual */}
        <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-5 space-y-4 shadow-sm h-fit">
          <h2 className="font-semibold text-gray-700 dark:text-gray-200 flex items-center gap-2">
            <FileKey className="w-4 h-4" />
            {status?.nfe_certificado_configurado
              ? 'Atualizar Certificado Digital'
              : 'Configurar Certificado Digital'}
          </h2>

          {/* Ambiente */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Ambiente *</label>
            <select
              value={ambiente}
              onChange={e => setAmbiente(e.target.value as Ambiente)}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
            >
              <option value="producao">🟢 Produção</option>
            </select>
          </div>

          {/* Regime tributário */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Regime Tributário *</label>
            <select
              value={regime}
              onChange={e => setRegime(Number(e.target.value) as Regime)}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
            >
              <option value={1}>Simples Nacional</option>
              <option value={2}>Lucro Presumido</option>
              <option value={3}>Lucro Real</option>
            </select>
          </div>

          {/* Upload do certificado */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Certificado A1 (.pfx ou .p12) *</label>
            <div
              onClick={() => inputRef.current?.click()}
              className={`border-2 border-dashed rounded-lg p-3 text-center cursor-pointer transition-colors ${
                arquivo
                  ? 'border-green-400 dark:border-green-600 bg-green-50 dark:bg-green-900/20'
                  : 'border-gray-300 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20'
              }`}
            >
              <Upload className={`w-5 h-5 mx-auto mb-1 ${arquivo ? 'text-green-500 dark:text-green-400' : 'text-gray-400 dark:text-gray-500'}`} />
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {arquivo ? arquivo.name : 'Clique para selecionar o arquivo .pfx'}
              </p>
              {arquivo && (
                <p className="text-xs text-green-600 dark:text-green-400 mt-1">{(arquivo.size / 1024).toFixed(1)} KB</p>
              )}
            </div>
            <input
              ref={inputRef}
              type="file"
              accept=".pfx,.p12"
              className="hidden"
              onChange={e => setArquivo(e.target.files?.[0] || null)}
            />
          </div>

          {/* Senha */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Senha do Certificado *</label>
            <input
              type="password"
              value={senha}
              onChange={e => setSenha(e.target.value)}
              placeholder="Senha do arquivo .pfx"
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading || !arquivo || !senha}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-2.5 rounded-lg text-sm flex items-center justify-center gap-2 transition-colors"
          >
            {loading ? (
              <><RefreshCw className="w-4 h-4 animate-spin" /> Configurando...</>
            ) : (
              <><Shield className="w-4 h-4" /> Salvar Certificado</>
            )}
          </button>
        </form>
      </div>
    </div>
  )
}
