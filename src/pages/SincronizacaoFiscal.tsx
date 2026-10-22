// src/pages/SincronizacaoFiscal.tsx
// Tela de Prévia da Sincronização Fiscal.
// Compara os dados da tabela `produtos_fiscal_referencia` com os produtos
// cadastrados em `produtos_cadastrado`, sem gravar nada no banco.
// Somente leitura.
import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { toast } from '../utils/toast';
import {
  carregarComparacaoFiscal,
  type ComparacaoFiscalItem,
  type ResumoSincronizacao,
  type ReferenciaFiscalItem,
} from '../services/sincronizacaoFiscalService';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Download,
  FileText,
  Loader2,
  Package,
  Plus,
  ShieldAlert,
} from 'lucide-react';

type Aba = 'resumo' | 'correspondencias' | 'novos' | 'pendentes' | 'comparacao';

export default function SincronizacaoFiscal() {
  const { userProfile } = useAuth();
  const adminId = userProfile?.id;

  const [aba, setAba] = useState<Aba>('resumo');
  const [searchTerm] = useState('');
  const [filtroSituacao] = useState<
    'todos' | 'correspondidas' | 'nao_correspondidas' | 'pendentes' | 'ambiguas'
  >('todos');

  const [, setReferencias] = useState<ReferenciaFiscalItem[]>([]);
  const [, setProdutos] = useState<any[]>([]);
  const [comparacao, setComparacao] = useState<ComparacaoFiscalItem[]>([]);
  const [resumo, setResumo] = useState<ResumoSincronizacao | null>(null);
  const [avisos, setAvisos] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const carregar = async () => {
    if (!adminId) return;
    setIsLoading(true);
    setError(null);
    try {
      const resultado = await carregarComparacaoFiscal(adminId);
      setReferencias(resultado.referencia);
      setProdutos(resultado.produtos);
      setComparacao(resultado.comparacao);
      setResumo(resultado.resumo);
      setAvisos(resultado.avisos ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar a prévia da sincronização.');
      toast.error('Erro ao carregar a prévia da sincronização.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    carregar();
  }, [adminId]);

  const comparacaoFiltrada = useMemo(() => {
    let resultado = comparacao;

    if (searchTerm.trim()) {
      const termo = searchTerm.trim().toLowerCase();
      resultado = resultado.filter((c) => {
        const texto = [
          c.referencia.descricao,
          c.referencia.codigo,
          c.referencia.codigo_barras,
          c.produto?.produto_nome,
          c.produto?.produto_cod,
          c.produto?.codigo_barras,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return texto.includes(termo);
      });
    }

    if (filtroSituacao !== 'todos') {
      switch (filtroSituacao) {
        case 'correspondidas':
          resultado = resultado.filter((c) => c.tipo === 'encontrada');
          break;
        case 'nao_correspondidas':
          resultado = resultado.filter((c) => c.tipo === 'nao_encontrada');
          break;
        case 'pendentes':
          resultado = resultado.filter(
            (c) => c.estoque_invalido || !c.produto || c.diferencas_fiscais.length > 0,
          );
          break;
        case 'ambiguas':
          resultado = resultado.filter((c) => c.tipo === 'ambigua');
          break;
      }
    }

    return resultado;
  }, [comparacao, searchTerm, filtroSituacao]);

  const [paginaAtual, setPaginaAtual] = useState(1);
  const ITENS_POR_PAGINA = 20;
  const totalPaginas = Math.max(1, Math.ceil(comparacaoFiltrada.length / ITENS_POR_PAGINA));

  const podeExportar = resumo !== null && resumo.total_referencias > 0;

  const textoSituacao = (c: ComparacaoFiscalItem): string => {
    if (c.tipo === 'nao_encontrada') return 'Não encontrada';
    if (c.tipo === 'ambigua') return 'Ambígua';
    if (c.estoque_invalido) return 'Estoque inválido';
    if (c.diferencas_fiscais.length > 0) return 'Divergência fiscal';
    return 'Conforme';
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh]">
        <div className="w-12 h-12 border-4 border-blue-600 dark:border-blue-400 border-t-transparent rounded-full animate-spin" />
        <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">Carregando a prévia da sincronização...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] p-6">
        <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 mb-3" />
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Erro ao carregar</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">{error}</p>
        <button
          onClick={carregar}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  if (!resumo) {
    return null;
  }

  return (
    <div className="space-y-4 sm:space-y-6 p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
            Sincronização Fiscal
          </h1>
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
            Compare o catálogo atual com a base de referência fiscal.
            Esta é uma tela de apenas leitura — nenhum dado será alterado.
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={carregar}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium disabled:opacity-50 transition-colors"
          >
            {isLoading ? (
              <><Loader2 className="w-4 h-4 animate-[shimmer_2s_infinite]" /> Atualizando...</>
            ) : (
              <>
                <Loader2 className="w-4 h-4 mr-2" />
                Atualizar prévia
              </>
            )}
          </button>
          <button
            onClick={() => {
              if (!podeExportar) return;
              const linhas: string[] = [
                'Tipo;Critério;Código;Código de barras;Descrição;NCM;CEST;CFOP;CST ICMS;Alíquota ICMS;CST PIS;Alíquota PIS;CST COFINS;Alíquota COFINS;Estoque atual;Qtd referência;Estoque proposto;Situação;Motivo',
              ];
              for (const c of comparacaoFiltrada) {
                linhas.push([
                  c.tipo,
                  c.criterio_correspondencia ?? '',
                  c.referencia.codigo ?? '',
                  c.referencia.codigo_barras ?? '',
                  c.referencia.descricao ?? '',
                  c.referencia.ncm ?? '',
                  c.referencia.cest ?? '',
                  c.referencia.cfop_padrao ?? '',
                  c.referencia.cst_icms ?? '',
                  c.referencia.aliquota_icms ?? '',
                  c.referencia.cst_pis ?? '',
                  c.referencia.aliquota_pis ?? '',
                  c.referencia.cst_cofins ?? '',
                  c.referencia.aliquota_cofins ?? '',
                  c.estoque_atual ?? '',
                  c.quantidade_planilha ?? '',
                  c.estoque_proposto ?? '',
                  textoSituacao(c),
                  c.motivo ?? '',
                ].join(';'));
              }
              const blob = new Blob([linhas.join('\n')], { type: 'text/csv;charset=utf-8;' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `previsao-sincronizacao-fiscal-${new Date().toISOString().slice(0, 10)}.csv`;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              URL.revokeObjectURL(url);
            }}
            disabled={!podeExportar || isLoading}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors"
          >
            <Download className="w-4 h-4 mr-2" />
            Exportar CSV
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

      {/* Avisos de integridade da leitura (paginação e colisões) */}
      {avisos.length > 0 && (
        <div className="rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 p-4 text-sm text-amber-900 dark:text-amber-200 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0 text-amber-600 dark:text-amber-400" />
          <div className="w-full">
            <p className="font-medium">A leitura encontrou inconsistências</p>
            <ul className="mt-1 list-disc pl-5 space-y-0.5 text-[12px] leading-relaxed">
              {avisos.map((aviso, indice) => (
                <li key={`${indice}-${aviso}`}>{aviso}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Indicadores superiores */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
        <CardEstatistica
          titulo="Referências fiscais"
          valor={resumo.total_referencias}
          cor="bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400"
          icone={<FileText className="w-5 h-5" />}
        />
        <CardEstatistica
          titulo="Produtos cadastrados"
          valor={resumo.total_produtos_cadastrados}
          cor="bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400"
          icone={<Package className="w-5 h-5" />}
        />
        <CardEstatistica
          titulo="Correspondências"
          valor={resumo.total_correspondencias}
          cor="bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400"
          icone={<CheckCircle2 className="w-5 h-5" />}
        />
        <CardEstatistica
          titulo="Novos produtos"
          valor={resumo.total_novos_produtos}
          cor="bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400"
          icone={<Plus className="w-5 h-5" />}
        />
        <CardEstatistica
          titulo="Divergências fiscais"
          valor={resumo.total_divergencias_fiscais}
          cor="bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400"
          icone={<AlertTriangle className="w-5 h-5" />}
        />
        <CardEstatistica
          titulo="Bloqueados por estoque"
          valor={resumo.total_bloqueados}
          cor="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400"
          icone={<AlertTriangle className="w-5 h-5" />}
        />
      </div>

      {/* Abas */}
      <div className="flex border-b border-gray-200 dark:border-gray-700 mb-4">
        <button
          key="resumo"
          onClick={() => setAba('resumo')}
          className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${aba === 'resumo' ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400' : 'border-transparent text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
        >
          Resumo
        </button>
        <button
          key="correspondencias"
          onClick={() => setAba('correspondencias')}
          className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${aba === 'correspondencias' ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400' : 'border-transparent text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
        >
          Correspondências
        </button>
        <button
          key="novos"
          onClick={() => setAba('novos')}
          className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${aba === 'novos' ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400' : 'border-transparent text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
        >
          Novos produtos
        </button>
        <button
          key="pendentes"
          onClick={() => setAba('pendentes')}
          className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${aba === 'pendentes' ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400' : 'border-transparent text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
        >
          Pendências
        </button>
        <button
          key="comparacao"
          onClick={() => setAba('comparacao')}
          className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${aba === 'comparacao' ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400' : 'border-transparent text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
        >
          Comparação fiscal
        </button>
      </div>

      {/* Conteúdo das abas */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        {aba === 'resumo' && (
          <div className="p-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <CardEstatistica
                titulo="Referências fiscais"
                valor={resumo.total_referencias}
                cor="bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400"
                icone={<FileText className="w-5 h-5" />}
              />
              <CardEstatistica
                titulo="Produtos cadastrados"
                valor={resumo.total_produtos_cadastrados}
                cor="bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400"
                icone={<Package className="w-5 h-5" />}
              />
              <CardEstatistica
                titulo="Correspondências"
                valor={resumo.total_correspondencias}
                cor="bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400"
                icone={<CheckCircle2 className="w-5 h-5" />}
              />
              <CardEstatistica
                titulo="Novos produtos"
                valor={resumo.total_novos_produtos}
                cor="bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400"
                icone={<Plus className="w-5 h-5" />}
              />
              <CardEstatistica
                titulo="Divergências fiscais"
                valor={resumo.total_divergencias_fiscais}
                cor="bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400"
                icone={<AlertTriangle className="w-5 h-5" />}
              />
              <CardEstatistica
                titulo="Bloqueados por estoque"
                valor={resumo.total_bloqueados}
                cor="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400"
                icone={<AlertTriangle className="w-5 h-5" />}
              />
            </div>
          </div>
        )}
        {aba === 'correspondencias' && (
          <TabelaComparacao
            itens={comparacaoFiltrada.filter((c) => c.tipo === 'encontrada')}
            paginaAtual={paginaAtual}
            itensPorPagina={ITENS_POR_PAGINA}
          />
        )}
        {aba === 'novos' && (
          <TabelaComparacao
            itens={comparacaoFiltrada.filter((c) => c.tipo === 'nao_encontrada')}
            paginaAtual={paginaAtual}
            itensPorPagina={ITENS_POR_PAGINA}
          />
        )}
        {aba === 'pendentes' && (
          <TabelaComparacao
            itens={comparacaoFiltrada.filter((c) => c.tipo === 'encontrada' && (c.estoque_invalido || c.diferencas_fiscais.length > 0))}
            paginaAtual={paginaAtual}
            itensPorPagina={ITENS_POR_PAGINA}
          />
        )}
        {aba === 'comparacao' && (
          <TabelaComparacao
            itens={comparacaoFiltrada}
            paginaAtual={paginaAtual}
            itensPorPagina={ITENS_POR_PAGINA}
          />
        )}
      </div>

      {/* Paginação */}
      {totalPaginas > 1 && (
        <div className="flex items-center justify-between gap-2 mt-4">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Página {paginaAtual} de {totalPaginas}
          </div>
          <div className="flex gap-1">
            <button
              onClick={() => setPaginaAtual((p) => Math.max(1, p - 1))}
              disabled={paginaAtual === 1}
              className="px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Anterior
            </button>
            <button
              onClick={() => setPaginaAtual((p) => Math.min(totalPaginas, p + 1))}
              disabled={paginaAtual === totalPaginas}
              className="px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Próxima
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

interface CardEstatisticaProps {
  titulo: string;
  valor: number;
  cor: string;
  icone: React.ReactNode;
}

function CardEstatistica({ titulo, valor, cor, icone }: CardEstatisticaProps) {
  return (
    <div className={`rounded-lg border p-4 ${cor}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{titulo}</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatarNumero(valor)}</p>
        </div>
        <div className="p-2 rounded-md bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400">
          {icone}
        </div>
      </div>
    </div>
  );
}

interface TabelaComparacaoProps {
  itens: ComparacaoFiscalItem[];
  paginaAtual: number;
  itensPorPagina: number;
}

function TabelaComparacao({
  itens,
  paginaAtual,
  itensPorPagina,
}: TabelaComparacaoProps) {
  const paginaInicial = (paginaAtual - 1) * itensPorPagina;
  const paginaFinal = paginaInicial + itensPorPagina;
  const itensPagina = itens.slice(paginaInicial, paginaFinal);

  const textoSituacao = (c: ComparacaoFiscalItem): string => {
    if (c.tipo === 'nao_encontrada') return 'Não encontrada';
    if (c.tipo === 'ambigua') return 'Ambígua';
    if (c.estoque_invalido) return 'Estoque inválido';
    if (c.diferencas_fiscais.length > 0) return 'Divergência fiscal';
    return 'Conforme';
  };

  const badgeSituacao = (c: ComparacaoFiscalItem): string => {
    if (c.tipo === 'encontrada' && c.estoque_invalido === false && c.diferencas_fiscais.length === 0) {
      return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400';
    }
    if (c.tipo === 'nao_encontrada') return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400';
    if (c.tipo === 'ambigua') return 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400';
    if (c.estoque_invalido) return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400';
    return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400';
  };

  if (itensPagina.length === 0) {
    return (
      <div className="p-4 text-center text-gray-500 dark:text-gray-400">
        Nenhum registro encontrado.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 dark:bg-gray-700/50">
          <tr>
            <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
              Produto
            </th>
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase hidden sm:table-cell">
              Código de barras
            </th>
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase hidden md:table-cell">
              NCM
            </th>
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase hidden lg:table-cell">
              CEST
            </th>
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase hidden xl:table-cell">
              CFOP
            </th>
            <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase hidden lg:table-cell">
              Estoque atual
            </th>
            <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase hidden lg:table-cell">
              Qtd referência
            </th>
            <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase hidden xl:table-cell">
              Estoque proposto
            </th>
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase hidden xl:table-cell">
              Status
            </th>
          </tr>
        </thead>
        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
          {itensPagina.map((c) => (
            <tr key={c.referencia.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
              <td className="px-3 py-3 text-left text-sm text-gray-900 dark:text-white">
                <div className="truncate max-w-[200px]">
                  {c.referencia.descricao || 'Sem descrição'}
                </div>
                {c.tipo === 'nao_encontrada' && (
                  <div className="text-xs text-blue-600 dark:text-blue-400">
                    Produto não encontrado
                  </div>
                )}
                {c.tipo === 'ambigua' && (
                  <div className="text-xs text-orange-600 dark:text-orange-400">
                    {c.motivo || 'Correspondência ambígua'}
                  </div>
                )}
              </td>
              <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-white hidden sm:table-cell">
                {c.referencia.codigo_barras || '—'}
              </td>
              <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-white hidden md:table-cell">
                {c.referencia.ncm || '—'}
              </td>
              <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-white hidden lg:table-cell">
                {c.referencia.cest || '—'}
              </td>
              <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-white hidden xl:table-cell">
                {c.referencia.cfop_padrao || '—'}
              </td>
              <td className="px-3 py-3 whitespace-nowrap text-right text-sm text-gray-900 dark:text-white hidden lg:table-cell">
                {formatarNumero(c.estoque_atual)}
              </td>
              <td className="px-3 py-3 whitespace-nowrap text-right text-sm text-gray-900 dark:text-white hidden lg:table-cell">
                {formatarNumero(c.quantidade_planilha)}
              </td>
              <td className="px-3 py-3 whitespace-nowrap text-right text-sm font-medium text-gray-900 dark:text-white hidden xl:table-cell">
                {formatarNumero(c.estoque_proposto)}
              </td>
              <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-white hidden xl:table-cell">
                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${badgeSituacao(c)}`}>
                  {textoSituacao(c)}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function formatarNumero(v: number | null | undefined): string {
  if (v === null || v === undefined) return '—';
  return Number(v).toLocaleString('pt-BR');
}
