import { AlertTriangle, CheckCircle2, ShieldAlert, X } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { toast } from '@/utils/toast';
import { useAuth } from '../contexts/AuthContext';
import { useUpdateProduto, type Produto } from '../hooks/useProdutos';
import { ORIGEM_MERCADORIA_OPTIONS } from './ui/ProdutoModal';
import FiscalStatusBadge from './FiscalStatusBadge';
import {
  FISCAL_STATUS_LABEL,
  alterarStatusFiscalProduto,
  normalizarFiscalStatus,
  verificarRequisitosValidacao,
  type FiscalStatus,
} from '../services/produtoFiscalService';
import {
  buscarHistoricoFiscalProduto,
  produtoVeioDeImportacao,
  preencherCamposFiscaisDoHistorico,
  type ItemImportacaoFiscalHistorico,
} from '../services/produtoFiscalReferenciaHistoricaService';

interface RevisaoFiscalModalProps {
  produto: Produto | null;
  isOpen: boolean;
  onClose: () => void;
  onStatusChange?: () => void;
}

interface FormFiscal {
  ncm: string;
  cest: string;
  cfop_padrao: string;
  origem_mercadoria: number;
  cst_icms: string;
  aliquota_icms: number;
  cst_pis: string;
  aliquota_pis: number;
  cst_cofins: string;
  aliquota_cofins: number;
  unidade_medida: string;
  categoria_fiscal: string;
}

function extrairFormFiscal(produto: Produto): FormFiscal {
  return {
    ncm: produto.ncm || '',
    cest: produto.cest || '',
    cfop_padrao: produto.cfop_padrao || '',
    origem_mercadoria: produto.origem_mercadoria ?? 0,
    cst_icms: produto.cst_icms || '',
    aliquota_icms: produto.aliquota_icms ?? 0,
    cst_pis: produto.cst_pis || '',
    aliquota_pis: produto.aliquota_pis ?? 0,
    cst_cofins: produto.cst_cofins || '',
    aliquota_cofins: produto.aliquota_cofins ?? 0,
    unidade_medida: produto.unidade_medida || 'UN',
    categoria_fiscal: produto.categoria_fiscal || '',
  };
}

const RevisaoFiscalModal: React.FC<RevisaoFiscalModalProps> = ({
  produto,
  isOpen,
  onClose,
  onStatusChange,
}) => {
  const { userType, permissions, adminId } = useAuth();
  const updateMutation = useUpdateProduto();
  const autorizado = userType === 'admin' || !!permissions?.produtos;

  const [form, setForm] = useState<FormFiscal | null>(null);
  // Último estado gravado no banco (inicial ou pós-salvamento). A RPC de
  // validação avalia a linha gravada — nunca o rascunho em tela.
  const [snapshot, setSnapshot] = useState<FormFiscal | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [confirmando, setConfirmando] = useState<FiscalStatus | null>(null);
  const [executando, setExecutando] = useState(false);

  // Dados fiscais históricos (snapshot da referência de importação)
  const [historicoFiscal, setHistoricoFiscal] = useState<ItemImportacaoFiscalHistorico | null>(null);
  const [carregandoHistorico, setCarregandoHistorico] = useState(false);
  const [erroHistorico, setErroHistorico] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && produto) {
      const inicial = extrairFormFiscal(produto);
      setForm(inicial);
      setSnapshot(inicial);
      setConfirmando(null);
      setHistoricoFiscal(null);
      setErroHistorico(null);

      // Carregar histórico fiscal se o produto veio de importação
      if (produtoVeioDeImportacao(produto) && adminId) {
        setCarregandoHistorico(true);
        buscarHistoricoFiscalProduto(produto.id, adminId)
          .then((hist) => {
            setHistoricoFiscal(hist);
          })
          .catch((err) => {
            setErroHistorico(
              err instanceof Error ? err.message : 'Erro ao carregar histórico fiscal.',
            );
          })
          .finally(() => {
            setCarregandoHistorico(false);
          });
      }
    }
  }, [isOpen, produto, adminId]);

  if (!isOpen || !produto || !form) return null;

  // Há edição não salva quando o formulário difere do último estado gravado.
  const formSujo =
    snapshot === null || JSON.stringify(form) !== JSON.stringify(snapshot);

  const statusAtual = normalizarFiscalStatus(produto.fiscal_status);
  const requisitos = verificarRequisitosValidacao({
    produto_nome: produto.produto_nome,
    categoria: produto.categoria,
    unidade_medida: form.unidade_medida,
    ncm: form.ncm,
    cfop_padrao: form.cfop_padrao,
    origem_mercadoria: form.origem_mercadoria,
  });

  function atualizarCampo<K extends keyof FormFiscal>(campo: K, valor: FormFiscal[K]) {
    setForm((prev) => (prev ? { ...prev, [campo]: valor } : prev));
  }

  // Preenche o formulário com valores do snapshot histórico (ação explícita)
  function preencherDoHistorico() {
    if (!historicoFiscal?.snapshot_referencia || !form) return;

    const preenchido = preencherCamposFiscaisDoHistorico(form, historicoFiscal.snapshot_referencia);
    if (JSON.stringify(preenchido) !== JSON.stringify(form)) {
      setForm(preenchido);
      toast.success('Campos preenchidos com valores da referência histórica. Revise e salve.');
    } else {
      toast.info('Não há novos campos fiscais para preencher a partir da referência.');
    }
  }

  function formatarValorHistorico(valor: unknown): string {
    if (valor === null || valor === undefined) return 'Não informado na referência';
    if (typeof valor === 'boolean') return valor ? 'Sim' : 'Não';
    if (typeof valor === 'number') return String(valor);
    if (typeof valor === 'string') return valor.trim() || 'Não informado na referência';
    return String(valor);
  }

  async function handleSalvarCampos() {
    if (!produto || !form) return;
    try {
      setSalvando(true);
      // Somente campos fiscais editáveis — NUNCA fiscal_status por aqui.
      await updateMutation.mutateAsync({
        id: produto.id,
        ncm: form.ncm,
        cest: form.cest,
        cfop_padrao: form.cfop_padrao,
        origem_mercadoria: form.origem_mercadoria,
        cst_icms: form.cst_icms,
        aliquota_icms: form.aliquota_icms,
        cst_pis: form.cst_pis,
        aliquota_pis: form.aliquota_pis,
        cst_cofins: form.cst_cofins,
        aliquota_cofins: form.aliquota_cofins,
        unidade_medida: form.unidade_medida,
        categoria_fiscal: form.categoria_fiscal,
      });
      toast.success('Campos fiscais salvos. O status continua pendente de validação.');
      setSnapshot({ ...form });
      if (onStatusChange) onStatusChange();
    } catch {
      toast.error('Erro ao salvar campos fiscais.');
    } finally {
      setSalvando(false);
    }
  }

  async function handleConfirmarStatus() {
    if (!confirmando || !produto) return;
    try {
      setExecutando(true);
      await alterarStatusFiscalProduto(produto.id, confirmando);
      toast.success(
        confirmando === 'validado'
          ? 'Classificação fiscal validada.'
          : `Produto marcado como "${FISCAL_STATUS_LABEL[confirmando].toLowerCase()}".`,
      );
      setConfirmando(null);
      if (onStatusChange) onStatusChange();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao alterar status fiscal.');
    } finally {
      setExecutando(false);
    }
  }

  const campo = 'w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white disabled:opacity-50';
  const rotulo = 'block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1';

  function CampoTexto<K extends keyof FormFiscal>({
    chave,
    label,
    valor,
    numerico,
  }: {
    chave: K;
    label: string;
    valor: FormFiscal[K];
    numerico?: boolean;
  }) {
    return (
      <div>
        <label className={rotulo}>{label}</label>
        <input
          type={numerico ? 'number' : 'text'}
          aria-label={label}
          value={valor}
          min={numerico ? 0 : undefined}
          step={numerico ? '0.01' : undefined}
          disabled={!autorizado}
          onChange={(e) =>
            atualizarCampo(
              chave,
              (numerico ? Number(e.target.value) || 0 : e.target.value) as FormFiscal[K],
            )
          }
          className={campo}
        />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Revisão fiscal</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {produto.produto_nome} · {produto.produto_cod}
              {produto.codigo_barras ? ` · ${produto.codigo_barras}` : ''}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <FiscalStatusBadge status={produto.fiscal_status} />
            <button onClick={onClose} aria-label="Fechar revisão fiscal" className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
              <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            </button>
          </div>
        </div>

        <div className="p-5 space-y-5 overflow-y-auto flex-1">
          {!autorizado && (
            <div className="rounded-lg border border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/20 p-3 text-sm text-yellow-800 dark:text-yellow-200 flex items-start gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
              <span>Você não tem permissão para revisar ou validar a classificação fiscal.</span>
            </div>
          )}

          {/* Dados fiscais históricos da referência (somente leitura) */}
          {produtoVeioDeImportacao(produto) && (
            <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 p-4 space-y-3">
              <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-200">
                Dados fiscais da referência (histórico de importação)
              </h3>
              <p className="text-xs text-blue-700 dark:text-blue-300">
                Estes valores foram importados da base de referência fiscal e são
                somente leitura. O cadastro atual pode ter campos nulos; os
                valores históricos são exibidos separadamente.
              </p>

              {carregandoHistorico && (
                <p className="text-xs text-blue-600 dark:text-blue-400">
                  Carregando dados históricos...
                </p>
              )}

              {erroHistorico && (
                <p className="text-xs text-red-600 dark:text-red-400">
                  Erro ao carregar histórico: {erroHistorico}
                </p>
              )}

              {historicoFiscal && historicoFiscal.snapshot_referencia && (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                    <div>
                      <dt className="font-medium text-blue-800 dark:text-blue-300">NCM</dt>
                      <dd className="text-blue-900 dark:text-blue-100">
                        {formatarValorHistorico(historicoFiscal.snapshot_referencia.ncm)}
                      </dd>
                    </div>
                    <div>
                      <dt className="font-medium text-blue-800 dark:text-blue-300">CEST</dt>
                      <dd className="text-blue-900 dark:text-blue-100">
                        {formatarValorHistorico(historicoFiscal.snapshot_referencia.cest)}
                      </dd>
                    </div>
                    <div>
                      <dt className="font-medium text-blue-800 dark:text-blue-300">CFOP</dt>
                      <dd className="text-blue-900 dark:text-blue-100">
                        {formatarValorHistorico(
                          historicoFiscal.snapshot_referencia.cfop_padrao ??
                            historicoFiscal.snapshot_referencia.nfe_cfop,
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt className="font-medium text-blue-800 dark:text-blue-300">Origem</dt>
                      <dd className="text-blue-900 dark:text-blue-100">
                        {formatarValorHistorico(historicoFiscal.snapshot_referencia.origem_mercadoria)}
                      </dd>
                    </div>
                    <div>
                      <dt className="font-medium text-blue-800 dark:text-blue-300">CST ICMS</dt>
                      <dd className="text-blue-900 dark:text-blue-100">
                        {formatarValorHistorico(historicoFiscal.snapshot_referencia.cst_icms)}
                      </dd>
                    </div>
                    <div>
                      <dt className="font-medium text-blue-800 dark:text-blue-300">Alíq. ICMS</dt>
                      <dd className="text-blue-900 dark:text-blue-100">
                        {formatarValorHistorico(historicoFiscal.snapshot_referencia.aliquota_icms)}
                      </dd>
                    </div>
                    <div>
                      <dt className="font-medium text-blue-800 dark:text-blue-300">CST PIS</dt>
                      <dd className="text-blue-900 dark:text-blue-100">
                        {formatarValorHistorico(historicoFiscal.snapshot_referencia.cst_pis)}
                      </dd>
                    </div>
                    <div>
                      <dt className="font-medium text-blue-800 dark:text-blue-300">Alíq. PIS</dt>
                      <dd className="text-blue-900 dark:text-blue-100">
                        {formatarValorHistorico(historicoFiscal.snapshot_referencia.aliquota_pis)}
                      </dd>
                    </div>
                    <div>
                      <dt className="font-medium text-blue-800 dark:text-blue-300">CST COFINS</dt>
                      <dd className="text-blue-900 dark:text-blue-100">
                        {formatarValorHistorico(historicoFiscal.snapshot_referencia.cst_cofins)}
                      </dd>
                    </div>
                    <div>
                      <dt className="font-medium text-blue-800 dark:text-blue-300">Alíq. COFINS</dt>
                      <dd className="text-blue-900 dark:text-blue-100">
                        {formatarValorHistorico(historicoFiscal.snapshot_referencia.aliquota_cofins)}
                      </dd>
                    </div>
                  </div>

                  {autorizado && (
                    <button
                      type="button"
                      onClick={preencherDoHistorico}
                      className="px-3 py-1.5 text-xs font-medium rounded-lg border border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/40"
                    >
                      Preencher campos a partir da referência
                    </button>
                  )}
                  <p className="text-[10px] text-blue-600 dark:text-blue-400">
                    O preenchimento é manual — revise os valores antes de salvar.
                    Nenhum dado é gravado automaticamente.
                  </p>
                </>
              )}

              {historicoFiscal && !historicoFiscal.snapshot_referencia && (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  O item de importação foi encontrado, mas não contém snapshot de
                  referência.
                </p>
              )}

              {!carregandoHistorico && !erroHistorico && !historicoFiscal && (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  Nenhum dado histórico encontrado para este produto.
                </p>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <CampoTexto chave="ncm" label="NCM" valor={form.ncm} />
            <CampoTexto chave="cest" label="CEST (quando aplicável)" valor={form.cest} />
            <CampoTexto chave="cfop_padrao" label="CFOP sugerido" valor={form.cfop_padrao} />
            <div>
              <label className={rotulo}>Origem da mercadoria</label>
              <select
                aria-label="Origem da mercadoria"
                value={form.origem_mercadoria}
                disabled={!autorizado}
                onChange={(e) => atualizarCampo('origem_mercadoria', Number(e.target.value))}
                className={campo}
              >
                {ORIGEM_MERCADORIA_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <CampoTexto chave="cst_icms" label="CST/CSOSN do ICMS" valor={form.cst_icms} />
            <CampoTexto chave="aliquota_icms" label="Alíquota do ICMS (%)" valor={form.aliquota_icms} numerico />
            <CampoTexto chave="cst_pis" label="CST do PIS" valor={form.cst_pis} />
            <CampoTexto chave="aliquota_pis" label="Alíquota do PIS (%)" valor={form.aliquota_pis} numerico />
            <CampoTexto chave="cst_cofins" label="CST da COFINS" valor={form.cst_cofins} />
            <CampoTexto chave="aliquota_cofins" label="Alíquota da COFINS (%)" valor={form.aliquota_cofins} numerico />
            <CampoTexto chave="unidade_medida" label="Unidade de medida" valor={form.unidade_medida} />
            <CampoTexto chave="categoria_fiscal" label="Categoria fiscal" valor={form.categoria_fiscal} />
          </div>

          {autorizado && (
            <button
              type="button"
              onClick={handleSalvarCampos}
              disabled={salvando}
              className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
            >
              {salvando ? 'Salvando...' : 'Salvar campos fiscais'}
            </button>
          )}

          <div className="rounded-lg bg-gray-50 dark:bg-gray-700/40 border border-gray-200 dark:border-gray-600 p-3 text-xs text-gray-600 dark:text-gray-300">
            Na dúvida sobre o tratamento tributário, mantenha o produto pendente e consulte o contador.
            Nenhum produto é validado automaticamente ao cadastrar, editar ou salvar.
          </div>

          {autorizado && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Ações de status</h3>
              {!requisitos.ok && (
                <div className="rounded-lg border border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/20 p-3 text-xs text-yellow-800 dark:text-yellow-200">
                  Pendências para validar: {requisitos.pendencias.join('; ')}.
                </div>
              )}
              {requisitos.ok && formSujo && (
                <div className="rounded-lg border border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/20 p-3 text-xs text-yellow-800 dark:text-yellow-200">
                  Há alterações não salvas. Salve os campos fiscais antes de validar —
                  a validação avalia os dados gravados no cadastro.
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={!requisitos.ok || statusAtual === 'validado'}
                  onClick={() => setConfirmando('validado')}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Validar classificação fiscal
                </button>
                {statusAtual !== 'em_revisao' && (
                  <button
                    type="button"
                    onClick={() => setConfirmando('em_revisao')}
                    className="px-4 py-2 text-sm font-medium rounded-lg border border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                  >
                    Marcar em revisão
                  </button>
                )}
                {statusAtual !== 'pendente_revisao' && (
                  <button
                    type="button"
                    onClick={() => setConfirmando('pendente_revisao')}
                    className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    Devolver para pendente
                  </button>
                )}
                {statusAtual !== 'bloqueado' && (
                  <button
                    type="button"
                    onClick={() => setConfirmando('bloqueado')}
                    className="px-4 py-2 text-sm font-medium rounded-lg border border-red-300 dark:border-red-700 text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20"
                  >
                    Bloquear
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {confirmando && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md p-6">
              <h3 className="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
                Confirmar: {FISCAL_STATUS_LABEL[confirmando]}
              </h3>
              <div className="mt-3 text-sm text-gray-600 dark:text-gray-300 space-y-2">
                <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                  <dt className="text-gray-500">NCM</dt><dd className="font-medium">{form.ncm || '—'}</dd>
                  <dt className="text-gray-500">CEST</dt><dd className="font-medium">{form.cest || '—'}</dd>
                  <dt className="text-gray-500">CFOP</dt><dd className="font-medium">{form.cfop_padrao || '—'}</dd>
                  <dt className="text-gray-500">CST ICMS</dt><dd className="font-medium">{form.cst_icms || '—'}</dd>
                  <dt className="text-gray-500">CST PIS / COFINS</dt>
                  <dd className="font-medium">{form.cst_pis || '—'} / {form.cst_cofins || '—'}</dd>
                </dl>
                {confirmando === 'validado' && (
                  <p className="font-medium text-gray-800 dark:text-gray-100">
                    A validação significa que uma pessoa autorizada conferiu esta classificação
                    para as operações pretendidas.
                  </p>
                )}
                {formSujo && (
                  <p className="font-medium text-yellow-800 dark:text-yellow-200">
                    Há alterações não salvas neste formulário. Salve os campos fiscais antes
                    de confirmar — a validação avalia os dados gravados, não o rascunho em tela.
                  </p>
                )}
              </div>
              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmando(null)}
                  disabled={executando}
                  className="px-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmarStatus}
                  disabled={executando || formSujo}
                  title={formSujo ? 'Salve os campos fiscais antes de confirmar' : undefined}
                  className="px-4 py-2 text-sm font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {executando ? 'Confirmando...' : 'Confirmar'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RevisaoFiscalModal;
