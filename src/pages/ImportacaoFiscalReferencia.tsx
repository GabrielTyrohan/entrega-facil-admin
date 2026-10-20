// src/pages/ImportacaoFiscalReferencia.tsx
// Ferramenta TEMPORÁRIA e ISOLADA para importar a base histórica TMP_PROD.ods
// para a tabela public.produtos_fiscal_referencia via RPC segura.
// Esta tabela representa SOMENTE referência histórica para comparação fiscal.
// NUNCA grava em produtos_cadastrado nem altera dados fiscais dos produtos atuais.
import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { toast } from '../utils/toast';
import {
  importarReferenciaFiscal,
  type ImportacaoResumo,
} from '../services/importacaoFiscalReferenciaService';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  FileText,
  Loader2,
  ShieldAlert,
  Upload,
} from 'lucide-react';

const ACEITA_SOMENTE_ODS = '.ods';

export default function ImportacaoFiscalReferencia() {
  const { userType } = useAuth();

  const [arquivo, setArquivo] = useState<File | null>(null);
  const [mostrandoConfirmacao, setMostrandoConfirmacao] = useState(false);
  const [importando, setImportando] = useState(false);
  const [resumo, setResumo] = useState<ImportacaoResumo | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const ehAdmin = userType === 'admin';

  const handleSelecionarArquivo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selecionado = e.target.files?.[0] ?? null;
    setErro(null);
    setResumo(null);
    if (!selecionado) {
      setArquivo(null);
      return;
    }
    if (!selecionado.name.toLowerCase().endsWith(ACEITA_SOMENTE_ODS)) {
      setArquivo(null);
      toast.error('Selecione um arquivo com extensão .ods');
      return;
    }
    setArquivo(selecionado);
  };

  const handleAbrirConfirmacao = () => {
    if (!arquivo) return;
    setErro(null);
    setResumo(null);
    setMostrandoConfirmacao(true);
  };

  const handleCancelarConfirmacao = () => {
    setMostrandoConfirmacao(false);
    setErro(null);
  };

  const handleImportar = async () => {
    if (!arquivo) return;
    setMostrandoConfirmacao(false);
    setErro(null);
    setResumo(null);
    setImportando(true);

    try {
      const resultado = await importarReferenciaFiscal(arquivo);
      setResumo(resultado);
      if (resultado.erros.length > 0) {
        toast.error(
          `Importação concluída com ${resultado.erros.length} erro(s) em lote(s).`,
        );
      } else {
        toast.success(
          `Importação concluída: ${resultado.aceitos} de ${resultado.enviados} registro(s) aceito(s).`,
        );
      }
    } catch (err) {
      setErro(
        err instanceof Error ? err.message : 'Erro inesperado ao importar.',
      );
      toast.error('Erro ao importar a base fiscal de referência.');
    } finally {
      setImportando(false);
    }
  };

  const handleNovaImportacao = () => {
    setArquivo(null);
    setResumo(null);
    setErro(null);
    const input = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement | null;
    if (input) input.value = '';
  };

  return (
    <div className="space-y-4 sm:space-y-6 p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
            Importação Fiscal de Referência
          </h1>
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
            Importa a base histórica TMP_PROD.ods para a tabela de referência
            fiscal. Somente para comparação — não altera produtos atuais.
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={handleAbrirConfirmacao}
            disabled={!arquivo || importando || !ehAdmin}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Upload className="w-4 h-4" />
            {importando ? 'Importando...' : 'Importar arquivo .ods'}
          </button>
        </div>
      </div>

      {/* Aviso de segurança */}
      <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 p-4 text-sm text-blue-800 dark:text-blue-200 flex items-start gap-3">
        <ShieldAlert className="w-5 h-5 shrink-0 text-blue-600 dark:text-blue-400" />
        <div>
          <p className="font-medium">Somente leitura de referência</p>
          <p className="text-[12px] leading-relaxed mt-1">
            Esta operação importa a base histórica somente para comparação
            fiscal. Nenhum produto cadastrado será alterado, nem campos de NCM,
            CEST, CFOP, CST, estoque ou preço serão modificados. A RPC valida
            o tenant e o administrador automaticamente a partir da sessão.
          </p>
        </div>
      </div>

      {/* Seleção de arquivo */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Arquivo TMP_PROD.ods
            </label>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Planilha com a base histórica de produtos fiscais.
            </p>
          </div>
          <div className="flex items-end gap-2">
            <input
              type="file"
              accept={ACEITA_SOMENTE_ODS}
              onChange={handleSelecionarArquivo}
              disabled={importando || !ehAdmin}
              className="block w-full text-sm text-gray-500 dark:text-gray-400
                file:mr-3 file:py-2 file:px-4 file:rounded-md file:border-0
                file:text-sm file:font-semibold file:bg-blue-50 dark:file:bg-blue-900/20
                file:text-blue-600 dark:file:text-blue-400 hover:file:bg-blue-100
                dark:hover:file:bg-blue-900/50 disabled:opacity-50"
            />
            {arquivo && (
              <span className="ml-3 text-sm text-gray-900 dark:text-white truncate max-w-xs">
                {arquivo.name}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Resumo da importação */}
      {resumo && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400" />
            Resultado da importação
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50">
              <div className="text-[10px] uppercase text-gray-500 dark:text-gray-400 font-semibold">
                Lidos
              </div>
              <div className="text-gray-900 dark:text-white font-medium">{resumo.lidos}</div>
            </div>
            <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50">
              <div className="text-[10px] uppercase text-gray-500 dark:text-gray-400 font-semibold">
                Enviados
              </div>
              <div className="text-gray-900 dark:text-white font-medium">{resumo.enviados}</div>
            </div>
            <div className="p-3 rounded-lg bg-green-50 dark:bg-green-900/20">
              <div className="text-[10px] uppercase text-green-600 dark:text-green-400 font-semibold">
                Aceitos
              </div>
              <div className="text-gray-900 dark:text-white font-medium">{resumo.aceitos}</div>
            </div>
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20">
              <div className="text-[10px] uppercase text-red-600 dark:text-red-400 font-semibold">
                Erros
              </div>
              <div className="text-gray-900 dark:text-white font-medium">{resumo.erros.length}</div>
            </div>
          </div>
          {resumo.erros.length > 0 && (
            <div className="mt-4 p-3 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20">
              <div className="text-xs font-semibold text-red-700 dark:text-red-300 mb-1">
                Erros por lote:
              </div>
              <ul className="text-[11px] text-red-700 dark:text-red-400 list-disc list-inside space-y-1">
                {resumo.erros.map((erro, i) => (
                  <li key={i}>{erro}</li>
                ))}
              </ul>
            </div>
          )}
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={handleNovaImportacao}
              className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              Nova importação
            </button>
          </div>
        </div>
      )}

      {erro && (
        <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4 text-sm text-red-700 dark:text-red-300 flex items-start gap-2">
          <AlertCircle className="w-5 h-5 shrink-0 text-red-600 dark:text-red-400" />
          <span>{erro}</span>
        </div>
      )}

      {/* Modal de confirmação */}
      {mostrandoConfirmacao && (
        <>
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50" />
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md p-6">
              <div className="flex items-start gap-3 mb-4">
                <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 shrink-0" />
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Confirmar importação
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                    Esta operação irá importar a base histórica somente para
                    comparação fiscal. Nenhum produto atual será alterado.
                  </p>
                </div>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700/40 rounded-lg p-3 text-sm text-gray-600 dark:text-gray-300 mb-5">
                <div className="font-semibold mb-1">Arquivo para importar:</div>
                <div className="truncate">{arquivo?.name}</div>
                <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
                  Serão enviados os registros da planilha em lotes de 100 para a
                  RPC `importar_produtos_fiscal_referencia`.
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={handleCancelarConfirmacao}
                  className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleImportar}
                  disabled={importando}
                  className="px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {importando ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Importando...
                    </>
                  ) : (
                    <>
                      <FileText className="w-4 h-4 mr-2" />
                      Confirmar importação
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
