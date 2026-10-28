// src/pages/SincronizacaoFiscal.tsx
// Tela de Prévia da Sincronização Fiscal.
// Compara os dados da tabela `produtos_fiscal_referencia` com os produtos
// cadastrados em `produtos_cadastrado`.
//
// A prévia continua sendo somente leitura. A criação de novos produtos ocorre
// exclusivamente pela RPC segura `importar_produtos_fiscal_lote_seguro`:
// primeiro há validação sem gravação, depois confirmação explícita do usuário
// e, só então, a gravação transacional do lote.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { toast } from '../utils/toast';
import { CACHE_KEYS } from '../lib/constants/queryKeys';
import {
  carregarComparacaoFiscal,
  type ComparacaoFiscalItem,
  type ResultadoComparacaoFiscal,
  type ResumoSincronizacao,
  type ReferenciaFiscalItem,
} from '../services/sincronizacaoFiscalService';
import type { ProdutoCadastrado } from '../services/produtoService';
import {
  chamarImportacaoFiscalLote,
  criarEscolhaComercialInicial,
  gerarChaveIdempotenciaImportacaoFiscal,
  LIMITE_ITENS_IMPORTACAO_FISCAL,
  montarItemImportacaoFiscal,
  UNIDADES_MEDIDA_IMPORTACAO_FISCAL,
  validarEscolhaComercialImportacao,
  type EscolhaComercialImportacaoFiscal,
  type ItemImportacaoFiscalLote,
  type ItemRespostaImportacaoFiscal,
  type RespostaImportacaoFiscalLote,
} from '../services/importacaoFiscalLoteService';
import {
  avaliarCandidatoFiscal,
  classeBadgeStatusCandidato,
  motivosDoCandidato,
  rotuloStatusCandidato,
  type AvaliacaoCandidatoFiscal,
} from '../utils/avaliacaoCandidatoFiscal';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Download,
  Eye,
  FileText,
  Info,
  Loader2,
  Package,
  Plus,
  ShieldAlert,
  Upload,
  X,
} from 'lucide-react';

type Aba = 'resumo' | 'correspondencias' | 'novos' | 'pendentes' | 'comparacao';

const ITENS_POR_PAGINA = 20;

const formatadorMoeda = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

interface ItemImportadoExibicao {
  referenciaId: string | null;
  produtoId: string | null;
  descricao: string;
  codigo: string | null;
  codigoBarras: string | null;
  categoria: string;
  unidadeMedida: string;
  ativo: boolean;
}

interface ResultadoImportacaoExibicao {
  resposta: RespostaImportacaoFiscalLote;
  itens: ItemImportadoExibicao[];
}

interface ChaveIdempotenciaPendente {
  chave: string;
  assinatura: string;
}

const criarMapaConfiguracoes = (): Record<
  string,
  EscolhaComercialImportacaoFiscal
> => ({});

export default function SincronizacaoFiscal() {
  const { userProfile } = useAuth();
  const queryClient = useQueryClient();
  const adminId = userProfile?.id;

  const [aba, setAba] = useState<Aba>('resumo');
  const [searchTerm] = useState('');
  const [filtroSituacao] = useState<
    'todos' | 'correspondidas' | 'nao_correspondidas' | 'pendentes' | 'ambiguas'
  >('todos');

  const [, setReferencias] = useState<ReferenciaFiscalItem[]>([]);
  const [produtos, setProdutos] = useState<ProdutoCadastrado[]>([]);
  const [comparacao, setComparacao] = useState<ComparacaoFiscalItem[]>([]);
  const [resumo, setResumo] = useState<ResumoSincronizacao | null>(null);
  const [avisos, setAvisos] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Seleção e revisão são 100% locais (estado do componente).
  const [selecionados, setSelecionados] = useState<Set<string>>(() => new Set());
  const [candidatoRevisao, setCandidatoRevisao] =
    useState<ComparacaoFiscalItem | null>(null);

  // Escolhas comerciais e fluxo de validação/gravação (também locais).
  const [configuracoes, setConfiguracoes] = useState<
    Record<string, EscolhaComercialImportacaoFiscal>
  >(criarMapaConfiguracoes);
  const [validacao, setValidacao] =
    useState<RespostaImportacaoFiscalLote | null>(null);
  const [assinaturaValidada, setAssinaturaValidada] = useState<string | null>(
    null,
  );
  const [errosLocaisValidacao, setErrosLocaisValidacao] = useState<string[]>([]);
  const [confirmacaoAberta, setConfirmacaoAberta] = useState(false);
  const [resultadoImportacao, setResultadoImportacao] =
    useState<ResultadoImportacaoExibicao | null>(null);
  const [erroGravacao, setErroGravacao] = useState<string | null>(null);
  const [falhaGravacao, setFalhaGravacao] =
    useState<RespostaImportacaoFiscalLote | null>(null);
  const [isValidando, setIsValidando] = useState(false);
  const [isGravando, setIsGravando] = useState(false);
  const [avisoAtualizacao, setAvisoAtualizacao] = useState<string | null>(null);
  const chaveIdempotenciaPendente =
    useRef<ChaveIdempotenciaPendente | null>(null);

  const [paginaAtual, setPaginaAtual] = useState(1);

  const aplicarResultadoPrevia = (resultado: ResultadoComparacaoFiscal) => {
    setReferencias(resultado.referencia);
    setProdutos(resultado.produtos);
    setComparacao(resultado.comparacao);
    setResumo(resultado.resumo);
    setAvisos(resultado.avisos ?? []);
  };

  const limparSelecaoEImportacao = () => {
    setSelecionados(new Set());
    setConfiguracoes(criarMapaConfiguracoes());
    setCandidatoRevisao(null);
    setValidacao(null);
    setAssinaturaValidada(null);
    setErrosLocaisValidacao([]);
    setConfirmacaoAberta(false);
    setErroGravacao(null);
    setFalhaGravacao(null);
    chaveIdempotenciaPendente.current = null;
  };

  const carregar = async () => {
    if (!adminId) return;
    setIsLoading(true);
    setError(null);
    setAvisoAtualizacao(null);
    // Uma nova leitura invalida a seleção anterior: os candidatos podem mudar.
    limparSelecaoEImportacao();
    try {
      const resultado = await carregarComparacaoFiscal(adminId);
      aplicarResultadoPrevia(resultado);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar a prévia da sincronização.');
      toast.error('Erro ao carregar a prévia da sincronização.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    carregar();
    // A prévia é recarregada apenas quando o administrador logado muda.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  /**
   * Itens da aba ativa. A paginação passa a considerar a lista da aba
   * (antes ela usava a lista global e podia exibir páginas vazias nas abas
   * com menos registros).
   */
  const itensAba = useMemo(() => {
    if (aba === 'correspondencias') {
      return comparacaoFiltrada.filter((c) => c.tipo === 'encontrada');
    }
    if (aba === 'novos') {
      return comparacaoFiltrada.filter((c) => c.tipo === 'nao_encontrada');
    }
    if (aba === 'pendentes') {
      return comparacaoFiltrada.filter(
        (c) =>
          c.tipo === 'encontrada' &&
          (c.estoque_invalido || c.diferencas_fiscais.length > 0),
      );
    }
    if (aba === 'comparacao') {
      return comparacaoFiltrada;
    }
    return [];
  }, [aba, comparacaoFiltrada]);

  const totalPaginas = Math.max(1, Math.ceil(itensAba.length / ITENS_POR_PAGINA));
  const paginaAtualEfetiva = Math.min(paginaAtual, totalPaginas);

  useEffect(() => {
    setPaginaAtual(1);
  }, [aba, searchTerm, filtroSituacao]);

  useEffect(() => {
    setPaginaAtual((pagina) => Math.min(pagina, totalPaginas));
  }, [totalPaginas]);

  useEffect(() => {
    // O painel de revisão pertence à aba "Novos produtos".
    setCandidatoRevisao(null);
  }, [aba]);

  /** Classificação local de todos os candidatos, calculada em memória. */
  const avaliacoes = useMemo(() => {
    const mapa = new Map<string, AvaliacaoCandidatoFiscal>();
    for (const item of comparacao) {
      mapa.set(item.referencia.id, avaliarCandidatoFiscal(item));
    }
    return mapa;
  }, [comparacao]);

  const categoriasCatalogo = useMemo(
    () =>
      Array.from(
        new Set(
          produtos
            .map((produto) => produto.categoria?.trim())
            .filter((categoria): categoria is string => Boolean(categoria)),
        ),
      ).sort((a, b) => a.localeCompare(b, 'pt-BR')),
    [produtos],
  );

  const itensSelecionados = useMemo(
    () =>
      comparacao.filter(
        (item) =>
          selecionados.has(item.referencia.id) &&
          item.tipo === 'nao_encontrada',
      ),
    [comparacao, selecionados],
  );

  const configuracaoDe = (
    id: string,
  ): EscolhaComercialImportacaoFiscal =>
    configuracoes[id] ?? criarEscolhaComercialInicial();

  const itensPayloadAtuais = useMemo<ItemImportacaoFiscalLote[]>(
    () =>
      itensSelecionados.map((item) =>
        montarItemImportacaoFiscal(
          item.referencia.id,
          configuracaoDe(item.referencia.id),
        ),
      ),
    // configuracaoDe é derivado de configuracoes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [itensSelecionados, configuracoes],
  );

  /**
   * Qualquer alteração na seleção ou nas escolhas comerciais invalida a
   * validação anterior. Também descarta a chave pendente, pois a operação
   * passou a ser outra.
   */
  const invalidarValidacao = () => {
    setValidacao(null);
    setAssinaturaValidada(null);
    setErrosLocaisValidacao([]);
    setConfirmacaoAberta(false);
    setErroGravacao(null);
    setFalhaGravacao(null);
    chaveIdempotenciaPendente.current = null;
  };

  const alternarSelecao = (id: string) => {
    const item = comparacao.find(
      (candidato) => candidato.referencia.id === id,
    );
    const avaliacao = avaliacoes.get(id);
    // Defesa adicional: candidatos bloqueados, ambíguos ou já correspondidos
    // nunca entram em um lote de importação.
    if (!item || item.tipo !== 'nao_encontrada' || !avaliacao?.selecionavel) {
      return;
    }
    invalidarValidacao();
    setSelecionados((anterior) => {
      const proximo = new Set(anterior);
      if (proximo.has(id)) {
        proximo.delete(id);
      } else {
        proximo.add(id);
      }
      return proximo;
    });
  };

  const selecionarVarios = (ids: string[]) => {
    const idsElegiveis = ids.filter((id) => {
      const item = comparacao.find(
        (candidato) => candidato.referencia.id === id,
      );
      const avaliacao = avaliacoes.get(id);
      return (
        item?.tipo === 'nao_encontrada' && avaliacao?.selecionavel === true
      );
    });
    invalidarValidacao();
    setSelecionados((anterior) => {
      const proximo = new Set(anterior);
      for (const id of idsElegiveis) proximo.add(id);
      return proximo;
    });
  };

  const desmarcarTodos = () => {
    invalidarValidacao();
    setSelecionados(new Set());
  };

  const atualizarConfiguracao = (
    id: string,
    alteracao: Partial<EscolhaComercialImportacaoFiscal>,
  ) => {
    invalidarValidacao();
    setConfiguracoes((anterior) => ({
      ...anterior,
      [id]: {
        ...(anterior[id] ?? criarEscolhaComercialInicial()),
        ...alteracao,
      },
    }));
  };

  const recarregarPreviaSilenciosamente = async () => {
    if (!adminId) return;
    try {
      const resultado = await carregarComparacaoFiscal(adminId);
      aplicarResultadoPrevia(resultado);
      setAvisoAtualizacao(null);
    } catch (err) {
      setAvisoAtualizacao(
        err instanceof Error
          ? `A importação foi concluída, mas a prévia não pôde ser atualizada: ${err.message}`
          : 'A importação foi concluída, mas a prévia não pôde ser atualizada. Atualize manualmente.',
      );
    }
    // Mantém eventuais listas/caches de produtos consistentes com a gravação.
    void queryClient.invalidateQueries({
      queryKey: [CACHE_KEYS.PRODUTOS],
    });
  };

  const validarSelecionados = async () => {
    if (isValidando || isGravando) return;

    if (itensSelecionados.length === 0) {
      setErrosLocaisValidacao([
        'Selecione ao menos um candidato para validar.',
      ]);
      return;
    }

    if (itensSelecionados.length > LIMITE_ITENS_IMPORTACAO_FISCAL) {
      setErrosLocaisValidacao([
        `A RPC aceita no máximo ${LIMITE_ITENS_IMPORTACAO_FISCAL} itens por lote. Selecione até ${LIMITE_ITENS_IMPORTACAO_FISCAL} candidatos por vez.`,
      ]);
      return;
    }

    const problemas: string[] = [];
    for (const item of itensSelecionados) {
      const descricao =
        item.referencia.descricao?.trim() ||
        `linha ${item.referencia.linha_origem}`;
      const avaliacao = avaliacoes.get(item.referencia.id);

      if (item.tipo !== 'nao_encontrada') {
        problemas.push(
          `${descricao}: somente referências sem correspondência podem ser importadas.`,
        );
        continue;
      }

      if (!avaliacao?.selecionavel) {
        const motivos = avaliacao
          ? motivosDoCandidato(avaliacao).join(' ')
          : 'Candidato sem avaliação local.';
        problemas.push(
          `${descricao}: candidato bloqueado e não pode ser importado. ${motivos}`.trim(),
        );
        continue;
      }

      for (const problema of validarEscolhaComercialImportacao(
        configuracaoDe(item.referencia.id),
      )) {
        problemas.push(`${descricao}: ${problema}`);
      }
    }

    if (problemas.length > 0) {
      setErrosLocaisValidacao(problemas);
      setValidacao(null);
      setAssinaturaValidada(null);
      setConfirmacaoAberta(false);
      toast.error('Revise os dados comerciais antes de validar o lote.');
      return;
    }

    const itens = itensSelecionados.map((item) =>
      montarItemImportacaoFiscal(
        item.referencia.id,
        configuracaoDe(item.referencia.id),
      ),
    );

    setErrosLocaisValidacao([]);
    setErroGravacao(null);
    setFalhaGravacao(null);
    setIsValidando(true);
    try {
      const resposta = await chamarImportacaoFiscalLote({
        modo: 'validar',
        // O modo validar NUNCA envia chave de idempotência.
        idempotencyKey: null,
        itens,
      });
      setValidacao(resposta);
      setAssinaturaValidada(JSON.stringify(itens));
      if (resposta.podeGravar) {
        toast.success(
          'Validação concluída. Nenhum dado foi gravado; a confirmação está liberada.',
        );
      } else {
        toast.error(
          'A RPC não autorizou a gravação deste lote. Nenhum dado foi gravado.',
        );
      }
    } catch (err) {
      setValidacao(null);
      setAssinaturaValidada(null);
      setErrosLocaisValidacao([
        err instanceof Error
          ? err.message
          : 'Não foi possível validar o lote. Nenhum dado foi gravado.',
      ]);
      toast.error('Não foi possível validar o lote fiscal.');
    } finally {
      setIsValidando(false);
    }
  };

  const abrirConfirmacao = () => {
    if (isValidando || isGravando) return;
    if (!validacao?.podeGravar) {
      setErrosLocaisValidacao([
        'A confirmação só é liberada após uma validação bem-sucedida da RPC.',
      ]);
      return;
    }

    const assinaturaAtual = JSON.stringify(itensPayloadAtuais);
    if (assinaturaAtual !== assinaturaValidada) {
      invalidarValidacao();
      setErrosLocaisValidacao([
        'A seleção ou os dados comerciais mudaram. Valide o lote novamente.',
      ]);
      return;
    }

    setErroGravacao(null);
    setFalhaGravacao(null);
    setConfirmacaoAberta(true);
  };

  const montarItensImportados = (
    resposta: RespostaImportacaoFiscalLote,
    itensDoLote: ItemImportacaoFiscalLote[],
    escolhas: Record<string, EscolhaComercialImportacaoFiscal>,
    referenciasSelecionadas: ComparacaoFiscalItem[],
  ): ItemImportadoExibicao[] => {
    const referencias = new Map(
      referenciasSelecionadas.map((item) => [item.referencia.id, item.referencia]),
    );

    const origem =
      resposta.itens.length > 0
        ? resposta.itens
        : itensDoLote.map<ItemRespostaImportacaoFiscal>((item) => ({
            referenciaId: item.referencia_id,
            produtoId: null,
            descricao: null,
            sucesso: null,
            bloqueado: false,
            avisos: [],
            erros: [],
            bruto: {},
          }));

    return origem.map((itemResposta, indice) => {
      const referenciaId =
        itemResposta.referenciaId ??
        itensDoLote[indice]?.referencia_id ??
        null;
      const referencia = referenciaId
        ? referencias.get(referenciaId)
        : undefined;
      const escolha = referenciaId
        ? escolhas[referenciaId] ?? criarEscolhaComercialInicial()
        : criarEscolhaComercialInicial();

      return {
        referenciaId,
        produtoId: itemResposta.produtoId,
        descricao:
          referencia?.descricao ??
          itemResposta.descricao ??
          'Produto sem descrição',
        codigo: referencia?.codigo ?? null,
        codigoBarras: referencia?.codigo_barras ?? null,
        categoria: escolha.categoria.trim(),
        unidadeMedida: escolha.unidade_medida,
        ativo: escolha.ativo,
      };
    });
  };

  const confirmarGravacao = async () => {
    if (isGravando || isValidando) return;
    if (!validacao?.podeGravar) {
      setErroGravacao(
        'A confirmação só é permitida após uma validação bem-sucedida.',
      );
      return;
    }

    const itens = itensPayloadAtuais;
    const assinatura = JSON.stringify(itens);
    if (assinatura !== assinaturaValidada) {
      setConfirmacaoAberta(false);
      invalidarValidacao();
      // Depois de invalidar, registra a mensagem que deve permanecer visível.
      setErroGravacao(
        'A seleção ou os dados comerciais mudaram. Valide o lote novamente.',
      );
      return;
    }

    let pendente = chaveIdempotenciaPendente.current;
    if (!pendente || pendente.assinatura !== assinatura) {
      pendente = {
        chave: gerarChaveIdempotenciaImportacaoFiscal(),
        assinatura,
      };
      chaveIdempotenciaPendente.current = pendente;
    }

    // A mesma chave é reutilizada em retries desta exata operação.
    const chave = pendente.chave;
    const itensDoLote = [...itens];
    const escolhasDoLote = Object.fromEntries(
      itensSelecionados.map((item) => [
        item.referencia.id,
        { ...configuracaoDe(item.referencia.id) },
      ]),
    );
    const referenciasDoLote = [...itensSelecionados];

    setIsGravando(true);
    setErroGravacao(null);
    setFalhaGravacao(null);
    try {
      const resposta = await chamarImportacaoFiscalLote({
        modo: 'gravar',
        idempotencyKey: chave,
        itens,
      });

      if (!resposta.sucesso) {
        setFalhaGravacao(resposta);
        setErroGravacao(
          resposta.mensagem ??
            resposta.erros[0] ??
            'A RPC não confirmou a criação do lote. Nenhum sucesso foi declarado.',
        );
        toast.error('A importação não foi confirmada pela RPC.');
        return;
      }

      setResultadoImportacao({
        resposta,
        itens: montarItensImportados(
          resposta,
          itensDoLote,
          escolhasDoLote,
          referenciasDoLote,
        ),
      });
      setErroGravacao(null);
      setFalhaGravacao(null);
      setConfirmacaoAberta(false);
      setValidacao(null);
      setAssinaturaValidada(null);
      setErrosLocaisValidacao([]);
      setCandidatoRevisao(null);
      setSelecionados(new Set());
      setConfiguracoes(criarMapaConfiguracoes());
      chaveIdempotenciaPendente.current = null;

      if (resposta.repeticaoIdempotente) {
        toast.success(
          'Este lote já havia sido importado. Nenhum produto foi duplicado.',
        );
      } else {
        toast.success(
          `${resposta.totalCriados} produto(s) importado(s) com fiscal_status pendente de revisão.`,
        );
      }

      await recarregarPreviaSilenciosamente();
    } catch (err) {
      // A chave NÃO é descartada: um novo clique repete a mesma operação de
      // forma idempotente. Nenhum sucesso é declarado em caso de erro.
      setErroGravacao(
        err instanceof Error
          ? err.message
          : 'Não foi possível confirmar a importação. Tente novamente com a mesma chave.',
      );
      setFalhaGravacao(null);
      toast.error(
        'A importação não foi confirmada. Nenhum sucesso foi declarado.',
      );
    } finally {
      setIsGravando(false);
    }
  };

  const fecharConfirmacao = () => {
    if (isGravando) return;
    setConfirmacaoAberta(false);
  };

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
            Compare o catálogo atual com a base de referência fiscal. A prévia é
            somente leitura; a importação de novos produtos exige validação e
            confirmação explícitas.
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
            A prévia e a validação não alteram o banco. A criação de novos
            produtos só ocorre pela RPC segura, depois de uma validação
            bem-sucedida e de uma confirmação explícita. Nenhum campo fiscal,
            preço, custo, estoque ou código é enviado pelo frontend. Produtos
            importados permanecem com <code>fiscal_status = pendente_revisao</code>.
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

      {/* Resultado da última importação confirmada */}
      {resultadoImportacao && (
        <ResultadoImportacaoFiscal
          resultado={resultadoImportacao}
          avisoAtualizacao={avisoAtualizacao}
        />
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
            itens={itensAba}
            paginaAtual={paginaAtualEfetiva}
            itensPorPagina={ITENS_POR_PAGINA}
          />
        )}
        {aba === 'novos' && (
          <ListaNovosProdutos
            itens={itensAba}
            paginaAtual={paginaAtualEfetiva}
            itensPorPagina={ITENS_POR_PAGINA}
            avaliacoes={avaliacoes}
            selecionados={selecionados}
            configuracoes={configuracoes}
            categoriasCatalogo={categoriasCatalogo}
            validacao={validacao}
            errosLocaisValidacao={errosLocaisValidacao}
            isValidando={isValidando}
            isGravando={isGravando}
            onAtualizarConfiguracao={atualizarConfiguracao}
            onAlternarSelecao={alternarSelecao}
            onSelecionarVarios={selecionarVarios}
            onDesmarcarTodos={desmarcarTodos}
            onValidar={validarSelecionados}
            onAbrirConfirmacao={abrirConfirmacao}
            onRevisar={setCandidatoRevisao}
          />
        )}
        {aba === 'pendentes' && (
          <TabelaComparacao
            itens={itensAba}
            paginaAtual={paginaAtualEfetiva}
            itensPorPagina={ITENS_POR_PAGINA}
          />
        )}
        {aba === 'comparacao' && (
          <TabelaComparacao
            itens={itensAba}
            paginaAtual={paginaAtualEfetiva}
            itensPorPagina={ITENS_POR_PAGINA}
          />
        )}
      </div>

      {/* Paginação */}
      {aba !== 'resumo' && totalPaginas > 1 && (
        <div className="flex items-center justify-between gap-2 mt-4">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Página {paginaAtualEfetiva} de {totalPaginas}
          </div>
          <div className="flex gap-1">
            <button
              onClick={() => setPaginaAtual(Math.max(1, paginaAtualEfetiva - 1))}
              disabled={paginaAtualEfetiva === 1}
              className="px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Anterior
            </button>
            <button
              onClick={() => setPaginaAtual(Math.min(totalPaginas, paginaAtualEfetiva + 1))}
              disabled={paginaAtualEfetiva === totalPaginas}
              className="px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Próxima
            </button>
          </div>
        </div>
      )}

      {/* Painel de revisão do candidato (somente leitura) */}
      {candidatoRevisao && (
        <PainelRevisaoCandidato
          item={candidatoRevisao}
          avaliacao={
            avaliacoes.get(candidatoRevisao.referencia.id) ??
            avaliarCandidatoFiscal(candidatoRevisao)
          }
          selecionado={selecionados.has(candidatoRevisao.referencia.id)}
          configuracao={configuracaoDe(candidatoRevisao.referencia.id)}
          onToggleSelecao={() => alternarSelecao(candidatoRevisao.referencia.id)}
          onClose={() => setCandidatoRevisao(null)}
        />
      )}

      {confirmacaoAberta && validacao && (
        <ConfirmacaoImportacaoFiscal
          itens={itensSelecionados}
          configuracoes={configuracoes}
          validacao={validacao}
          isGravando={isGravando}
          erroGravacao={erroGravacao}
          falhaGravacao={falhaGravacao}
          onClose={fecharConfirmacao}
          onConfirmar={confirmarGravacao}
        />
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

interface ListaNovosProdutosProps {
  itens: ComparacaoFiscalItem[];
  paginaAtual: number;
  itensPorPagina: number;
  avaliacoes: Map<string, AvaliacaoCandidatoFiscal>;
  selecionados: Set<string>;
  configuracoes: Record<string, EscolhaComercialImportacaoFiscal>;
  categoriasCatalogo: string[];
  validacao: RespostaImportacaoFiscalLote | null;
  errosLocaisValidacao: string[];
  isValidando: boolean;
  isGravando: boolean;
  onAtualizarConfiguracao: (
    id: string,
    alteracao: Partial<EscolhaComercialImportacaoFiscal>,
  ) => void;
  onAlternarSelecao: (id: string) => void;
  onSelecionarVarios: (ids: string[]) => void;
  onDesmarcarTodos: () => void;
  onValidar: () => void;
  onAbrirConfirmacao: () => void;
  onRevisar: (item: ComparacaoFiscalItem) => void;
}

function ListaNovosProdutos({
  itens,
  paginaAtual,
  itensPorPagina,
  avaliacoes,
  selecionados,
  configuracoes,
  categoriasCatalogo,
  validacao,
  errosLocaisValidacao,
  isValidando,
  isGravando,
  onAtualizarConfiguracao,
  onAlternarSelecao,
  onSelecionarVarios,
  onDesmarcarTodos,
  onValidar,
  onAbrirConfirmacao,
  onRevisar,
}: ListaNovosProdutosProps) {
  const avaliacaoDe = (item: ComparacaoFiscalItem): AvaliacaoCandidatoFiscal =>
    avaliacoes.get(item.referencia.id) ?? avaliarCandidatoFiscal(item);

  const configuracaoDe = (
    id: string,
  ): EscolhaComercialImportacaoFiscal =>
    configuracoes[id] ?? criarEscolhaComercialInicial();

  const itensElegiveis = itens.filter((item) => avaliacaoDe(item).selecionavel);
  const itensSelecionados = itens.filter((item) =>
    selecionados.has(item.referencia.id),
  );
  const totalBloqueados = itens.length - itensElegiveis.length;
  const excedeLimite =
    itensSelecionados.length > LIMITE_ITENS_IMPORTACAO_FISCAL;
  const ocupado = isValidando || isGravando;
  const podeValidar =
    itensSelecionados.length > 0 && !excedeLimite && !ocupado;
  const podeImportar =
    validacao?.podeGravar === true && !excedeLimite && !ocupado;
  const itensConfiguracao = itensSelecionados.slice(
    0,
    LIMITE_ITENS_IMPORTACAO_FISCAL,
  );

  let prontosSelecionados = 0;
  let revisaoSelecionados = 0;
  for (const item of itensSelecionados) {
    const status = avaliacaoDe(item).status;
    if (status === 'pronto') prontosSelecionados += 1;
    if (status === 'revisar') revisaoSelecionados += 1;
  }

  const paginaInicial = (paginaAtual - 1) * itensPorPagina;
  const itensPagina = itens.slice(paginaInicial, paginaInicial + itensPorPagina);

  const selecionarTodosElegiveis = () => {
    onSelecionarVarios(itensElegiveis.map((item) => item.referencia.id));
  };

  return (
    <div>
      {/* Painel de seleção e resumo local */}
      <div className="border-b border-gray-200 dark:border-gray-700 p-4 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">
              Revisão dos candidatos a novos produtos
            </h2>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 max-w-3xl">
              Selecione os candidatos para uma futura importação. Itens
              bloqueados não podem ser selecionados. A seleção existe apenas
              em memória e não é enviada ao banco.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={selecionarTodosElegiveis}
              disabled={itensElegiveis.length === 0 || ocupado}
              className="px-3 py-2 text-xs font-medium rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Selecionar todos os elegíveis
            </button>
            <button
              type="button"
              onClick={onDesmarcarTodos}
              disabled={selecionados.size === 0 || ocupado}
              className="px-3 py-2 text-xs font-medium rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Desmarcar todos
            </button>
            <span
              aria-live="polite"
              className="px-1 text-xs font-medium text-gray-700 dark:text-gray-300"
            >
              {formatarNumero(itensSelecionados.length)} selecionado
              {itensSelecionados.length === 1 ? '' : 's'}
            </span>
            <button
              type="button"
              onClick={onValidar}
              disabled={!podeValidar}
              title={
                excedeLimite
                  ? `Selecione até ${LIMITE_ITENS_IMPORTACAO_FISCAL} itens por lote.`
                  : 'Validar o lote sem gravar dados.'
              }
              className="flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isValidando ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <ShieldAlert className="w-4 h-4" />
              )}
              {isValidando ? 'Validando...' : 'Validar selecionados'}
            </button>
            <button
              type="button"
              onClick={onAbrirConfirmacao}
              disabled={!podeImportar}
              title={
                validacao?.podeGravar
                  ? 'Abrir confirmação explícita da importação.'
                  : 'A importação só é liberada após validação bem-sucedida.'
              }
              className="flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Upload className="w-4 h-4" />
              Importar selecionados
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <ResumoSelecao
            rotulo="Produtos selecionados"
            valor={itensSelecionados.length}
            destaque="text-blue-600 dark:text-blue-400"
          />
          <ResumoSelecao
            rotulo="Prontos"
            valor={prontosSelecionados}
            destaque="text-green-600 dark:text-green-400"
          />
          <ResumoSelecao
            rotulo="Em revisão"
            valor={revisaoSelecionados}
            destaque="text-amber-600 dark:text-amber-400"
          />
          <ResumoSelecao
            rotulo="Bloqueados (não selecionáveis)"
            valor={totalBloqueados}
            destaque="text-red-600 dark:text-red-400"
          />
        </div>

        <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-3 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2">
          <Info className="w-4 h-4 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p>
              <strong>Categoria e unidade comerciais devem ser escolhidas
              explicitamente.</strong> A base de referência fiscal não possui
              esses dados e eles não são inferidos pela descrição. O produto
              começa como <strong>inativo</strong> (recomendado para o piloto),
              mas o estado pode ser alterado antes da confirmação.
            </p>
            <p>
              Os dados fiscais da referência não são copiados para os campos
              fiscais definitivos. Nenhum produto será marcado como{' '}
              <code>fiscal_status = validado</code>; os produtos criados ficam
              pendentes de revisão.
            </p>
            <p className="font-medium">
              A validação não grava dados. A gravação só ocorre depois da
              confirmação explícita e usa exclusivamente a RPC segura.
            </p>
            <p>
              O contador &quot;Bloqueados&quot; desta aba considera os
              critérios desta etapa (quantidade, preço e descrição) e não
              substitui o indicador &quot;Bloqueados por estoque&quot; do
              topo, que se refere a produtos já cadastrados.
            </p>
          </div>
        </div>

        {excedeLimite && (
          <div
            role="alert"
            className="rounded-lg border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-3 text-xs text-red-800 dark:text-red-200 flex items-start gap-2"
          >
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <p>
              Você selecionou {formatarNumero(itensSelecionados.length)} itens.
              A RPC aceita no máximo {LIMITE_ITENS_IMPORTACAO_FISCAL} por lote.
              Reduza a seleção e valide um lote por vez; a gravação automática
              de vários lotes não é permitida.
            </p>
          </div>
        )}

        {errosLocaisValidacao.length > 0 && (
          <div
            role="alert"
            className="rounded-lg border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-3 text-xs text-red-800 dark:text-red-200"
          >
            <p className="font-semibold mb-1">
              Corrija os itens abaixo antes de continuar:
            </p>
            <ul className="list-disc pl-5 space-y-0.5">
              {errosLocaisValidacao.map((erro) => (
                <li key={erro}>{erro}</li>
              ))}
            </ul>
          </div>
        )}

        {itensSelecionados.length > 0 && (
          <section className="rounded-lg border border-gray-200 dark:border-gray-700 p-3">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-1">
              <div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                  Configuração comercial dos selecionados
                </h3>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
                  Defina categoria, unidade e estado ativo. A categoria pode ser
                  digitada ou escolhida entre as já usadas no catálogo. Nenhuma
                  categoria será criada automaticamente.
                </p>
              </div>
              <span className="text-[11px] text-gray-500 dark:text-gray-400">
                {excedeLimite
                  ? `Exibindo os primeiros ${LIMITE_ITENS_IMPORTACAO_FISCAL} de ${formatarNumero(itensSelecionados.length)}`
                  : `${formatarNumero(itensSelecionados.length)} item(ns) no lote`}
              </span>
            </div>

            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-700/50">
                  <tr>
                    <th className="px-2 py-2 text-left text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase">
                      Produto
                    </th>
                    <th className="px-2 py-2 text-left text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase">
                      Categoria comercial
                    </th>
                    <th className="px-2 py-2 text-left text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase">
                      Unidade
                    </th>
                    <th className="px-2 py-2 text-left text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase">
                      Estado ativo
                    </th>
                    <th className="px-2 py-2 text-left text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase">
                      Descrição duplicada
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {itensConfiguracao.map((item) => {
                    const referencia = item.referencia;
                    const descricao =
                      referencia.descricao?.trim() ||
                      `linha ${referencia.linha_origem}`;
                    const configuracao = configuracaoDe(referencia.id);
                    return (
                      <tr key={referencia.id}>
                        <td className="px-2 py-2 align-top">
                          <p className="font-medium text-gray-900 dark:text-white max-w-[260px] truncate">
                            {descricao}
                          </p>
                          <p className="text-[11px] text-gray-500 dark:text-gray-400">
                            Cód.: {formatarTexto(referencia.codigo)} • EAN:{' '}
                            {formatarTexto(referencia.codigo_barras)}
                          </p>
                        </td>
                        <td className="px-2 py-2 align-top min-w-[200px]">
                          <input
                            type="text"
                            list="categorias-comerciais-importacao-fiscal"
                            value={configuracao.categoria}
                            onChange={(event) =>
                              onAtualizarConfiguracao(referencia.id, {
                                categoria: event.target.value,
                              })
                            }
                            aria-label={`Categoria comercial de ${descricao}`}
                            placeholder="Selecione ou digite"
                            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-2 py-1.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </td>
                        <td className="px-2 py-2 align-top min-w-[130px]">
                          <select
                            value={configuracao.unidade_medida}
                            onChange={(event) =>
                              onAtualizarConfiguracao(referencia.id, {
                                unidade_medida: event.target.value,
                              })
                            }
                            aria-label={`Unidade comercial de ${descricao}`}
                            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-2 py-1.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="">Selecione...</option>
                            {UNIDADES_MEDIDA_IMPORTACAO_FISCAL.map((unidade) => (
                              <option key={unidade} value={unidade}>
                                {unidade}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-2 py-2 align-top min-w-[190px]">
                          <div className="space-y-1 text-xs text-gray-700 dark:text-gray-300">
                            <label className="flex items-center gap-1.5">
                              <input
                                type="radio"
                                name={`ativo-${referencia.id}`}
                                checked={configuracao.ativo === false}
                                onChange={() =>
                                  onAtualizarConfiguracao(referencia.id, {
                                    ativo: false,
                                  })
                                }
                                aria-label={`Inativo para ${descricao}`}
                                className="h-3.5 w-3.5 text-blue-600 focus:ring-blue-500"
                              />
                              Inativo (recomendado)
                            </label>
                            <label className="flex items-center gap-1.5">
                              <input
                                type="radio"
                                name={`ativo-${referencia.id}`}
                                checked={configuracao.ativo === true}
                                onChange={() =>
                                  onAtualizarConfiguracao(referencia.id, {
                                    ativo: true,
                                  })
                                }
                                aria-label={`Ativo para ${descricao}`}
                                className="h-3.5 w-3.5 text-blue-600 focus:ring-blue-500"
                              />
                              Ativo
                            </label>
                          </div>
                        </td>
                        <td className="px-2 py-2 align-top min-w-[160px]">
                          <label className="flex items-center gap-1.5 text-xs text-gray-700 dark:text-gray-300">
                            <input
                              type="checkbox"
                              checked={
                                configuracao.confirmar_descricao_duplicada
                              }
                              onChange={(event) =>
                                onAtualizarConfiguracao(referencia.id, {
                                  confirmar_descricao_duplicada:
                                    event.target.checked,
                                })
                              }
                              aria-label={`Confirmar descrição duplicada de ${descricao}`}
                              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            Confirmar se a RPC indicar duplicidade
                          </label>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <datalist id="categorias-comerciais-importacao-fiscal">
                {categoriasCatalogo.map((categoria) => (
                  <option key={categoria} value={categoria} />
                ))}
              </datalist>
            </div>
          </section>
        )}

        <ValidacaoImportacaoFiscal
          validacao={validacao}
          itensSelecionados={itensSelecionados}
        />
      </div>

      {itensPagina.length === 0 ? (
        <div className="p-4 text-center text-gray-500 dark:text-gray-400">
          Nenhum registro encontrado.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-700/50">
              <tr>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  <span className="sr-only">Seleção</span>
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  Produto
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase hidden sm:table-cell">
                  Código
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase hidden md:table-cell">
                  EAN
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
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase hidden xl:table-cell">
                  CST ICMS
                </th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase hidden 2xl:table-cell">
                  Alíq. ICMS
                </th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase hidden lg:table-cell">
                  Custo
                </th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  Preço
                </th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  Qtd. referência
                </th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase hidden xl:table-cell">
                  Linha
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  Status
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase hidden lg:table-cell">
                  Pendências
                </th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  Detalhes
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {itensPagina.map((item) => {
                const avaliacao = avaliacaoDe(item);
                const selecionado = selecionados.has(item.referencia.id);
                const bloqueado = !avaliacao.selecionavel;
                const motivos = motivosDoCandidato(avaliacao);
                const resumoMotivos =
                  motivos.length === 0
                    ? '—'
                    : `${motivos[0]}${motivos.length > 1 ? ` (+${motivos.length - 1})` : ''}`;
                const cfop = item.referencia.nfe_cfop ?? item.referencia.cfop_padrao ?? null;

                return (
                  <tr
                    key={item.referencia.id}
                    className={`transition-colors ${bloqueado ? 'bg-red-50/40 dark:bg-red-900/10' : 'hover:bg-gray-50 dark:hover:bg-gray-700/30'}`}
                  >
                    <td className="px-3 py-3">
                      <input
                        type="checkbox"
                        checked={selecionado}
                        disabled={bloqueado}
                        onChange={() => onAlternarSelecao(item.referencia.id)}
                        aria-label={`Selecionar ${item.referencia.descricao || `linha ${item.referencia.linha_origem}`}`}
                        title={
                          bloqueado
                            ? 'Candidato bloqueado: não pode ser selecionado.'
                            : 'Selecionar candidato'
                        }
                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:cursor-not-allowed"
                      />
                    </td>
                    <td className="px-3 py-3 text-left text-sm text-gray-900 dark:text-white">
                      <button
                        type="button"
                        onClick={() => onRevisar(item)}
                        className="text-left font-medium hover:text-blue-600 dark:hover:text-blue-400"
                        title="Abrir painel de revisão"
                      >
                        <span className="block truncate max-w-[220px]">
                          {item.referencia.descricao || 'Sem descrição'}
                        </span>
                      </button>
                      <div className="text-xs text-blue-600 dark:text-blue-400">
                        Produto não encontrado
                      </div>
                      {item.motivo && (
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {item.motivo}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-white hidden sm:table-cell">
                      {formatarTexto(item.referencia.codigo)}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-white hidden md:table-cell">
                      {formatarTexto(item.referencia.codigo_barras)}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-white hidden md:table-cell">
                      {formatarTexto(item.referencia.ncm)}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-white hidden lg:table-cell">
                      {formatarTexto(item.referencia.cest)}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-white hidden xl:table-cell">
                      {formatarTexto(cfop)}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-white hidden xl:table-cell">
                      {formatarTexto(item.referencia.cst_icms)}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-right text-sm text-gray-900 dark:text-white hidden 2xl:table-cell">
                      {formatarAliquota(item.referencia.aliquota_icms)}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-right text-sm text-gray-900 dark:text-white hidden lg:table-cell">
                      {formatarMoeda(avaliacao.custo)}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-right text-sm font-medium text-gray-900 dark:text-white">
                      {formatarMoeda(avaliacao.preco)}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-right text-sm text-gray-900 dark:text-white">
                      {formatarNumero(item.referencia.estoque)}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-right text-sm text-gray-900 dark:text-white hidden xl:table-cell">
                      {formatarNumero(item.referencia.linha_origem)}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-sm">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${classeBadgeStatusCandidato(avaliacao.status)}`}>
                        {rotuloStatusCandidato(avaliacao.status)}
                      </span>
                    </td>
                    <td
                      className="px-3 py-3 text-xs text-gray-600 dark:text-gray-400 hidden lg:table-cell max-w-[260px]"
                      title={motivos.join('\n')}
                    >
                      {resumoMotivos}
                    </td>
                    <td className="px-3 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => onRevisar(item)}
                        aria-label={`Revisar ${item.referencia.descricao || `linha ${item.referencia.linha_origem}`}`}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        Revisar
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

interface ResumoSelecaoProps {
  rotulo: string;
  valor: number;
  destaque: string;
}

function ResumoSelecao({ rotulo, valor, destaque }: ResumoSelecaoProps) {
  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3">
      <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400">
        {rotulo}
      </p>
      <p className={`text-xl font-bold ${destaque}`}>{formatarNumero(valor)}</p>
    </div>
  );
}

interface PainelRevisaoCandidatoProps {
  item: ComparacaoFiscalItem;
  avaliacao: AvaliacaoCandidatoFiscal;
  selecionado: boolean;
  configuracao: EscolhaComercialImportacaoFiscal;
  onToggleSelecao: () => void;
  onClose: () => void;
}

function PainelRevisaoCandidato({
  item,
  avaliacao,
  selecionado,
  configuracao,
  onToggleSelecao,
  onClose,
}: PainelRevisaoCandidatoProps) {
  const referencia = item.referencia;
  const cfop = referencia.nfe_cfop ?? referencia.cfop_padrao ?? null;
  const motivos = motivosDoCandidato(avaliacao);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-revisao-candidato"
        className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-start justify-between gap-3 p-5 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2
              id="titulo-revisao-candidato"
              className="text-lg font-semibold text-gray-900 dark:text-white"
            >
              Revisão do candidato
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {referencia.descricao || 'Sem descrição'}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Linha de origem #{formatarNumero(referencia.linha_origem)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${classeBadgeStatusCandidato(avaliacao.status)}`}>
              {rotuloStatusCandidato(avaliacao.status)}
            </span>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar painel de revisão"
              className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-5 space-y-5">
          <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-3 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2">
            <Info className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p>
                Os dados fiscais da referência estão sujeitos à revisão. Nenhum
                produto será marcado como <code>fiscal_status = validado</code>{' '}
                nesta etapa.
              </p>
              <p className="font-medium">
                Nenhuma alteração foi feita no banco de dados.
              </p>
            </div>
          </div>

          <section>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
              Dados comerciais
            </h3>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
              <CampoRevisao rotulo="Descrição" valor={formatarTexto(referencia.descricao)} />
              <CampoRevisao rotulo="Código" valor={formatarTexto(referencia.codigo)} />
              <CampoRevisao rotulo="EAN" valor={formatarTexto(referencia.codigo_barras)} />
              <CampoRevisao
                rotulo="Categoria comercial"
                valor={
                  configuracao.categoria.trim() || 'pendente de definição'
                }
              />
              <CampoRevisao
                rotulo="Unidade comercial"
                valor={configuracao.unidade_medida || 'pendente de definição'}
              />
              <CampoRevisao
                rotulo="Estado ativo"
                valor={
                  configuracao.ativo
                    ? 'Ativo'
                    : 'Inativo (recomendado no piloto)'
                }
              />
              <CampoRevisao
                rotulo="Descrição duplicada"
                valor={
                  configuracao.confirmar_descricao_duplicada
                    ? 'Confirmação autorizada'
                    : 'Não confirmada'
                }
              />
              <CampoRevisao rotulo="Custo" valor={formatarMoeda(avaliacao.custo)} />
              <CampoRevisao
                rotulo="Custo de compra"
                valor={formatarMoeda(referencia.custo_compra)}
              />
              <CampoRevisao rotulo="Preço" valor={formatarMoeda(avaliacao.preco)} />
              <CampoRevisao
                rotulo="Quantidade na referência"
                valor={formatarNumero(referencia.estoque)}
              />
              <CampoRevisao
                rotulo="Estoque inicial proposto"
                valor={
                  avaliacao.estoque_inicial === null
                    ? 'Não disponível — quantidade inválida'
                    : formatarNumero(avaliacao.estoque_inicial)
                }
              />
              <CampoRevisao
                rotulo="Kit"
                valor={
                  referencia.kit === null || referencia.kit === undefined
                    ? '—'
                    : referencia.kit
                      ? 'Sim'
                      : 'Não'
                }
              />
            </dl>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-2">
              O estoque inicial proposto é apenas informativo. Nenhum estoque
              será alterado nesta etapa.
            </p>
          </section>

          <section>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
              Dados fiscais da referência
            </h3>
            <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-3">
              <CampoRevisao rotulo="NCM" valor={formatarTexto(referencia.ncm)} />
              <CampoRevisao rotulo="CEST" valor={formatarTexto(referencia.cest)} />
              <CampoRevisao rotulo="CFOP" valor={formatarTexto(cfop)} />
              <CampoRevisao
                rotulo="Descrição do CFOP"
                valor={formatarTexto(referencia.cfop_descricao)}
              />
              <CampoRevisao
                rotulo="CST ICMS"
                valor={formatarTexto(referencia.cst_icms)}
              />
              <CampoRevisao
                rotulo="Alíquota ICMS"
                valor={formatarAliquota(referencia.aliquota_icms)}
              />
              <CampoRevisao
                rotulo="ICMS na referência"
                valor={formatarNumero(referencia.icms)}
              />
              <CampoRevisao
                rotulo="CST PIS"
                valor={formatarTexto(referencia.cst_pis)}
              />
              <CampoRevisao
                rotulo="Alíquota PIS"
                valor={formatarAliquota(referencia.aliquota_pis)}
              />
              <CampoRevisao
                rotulo="CST PIS (saída)"
                valor={formatarTexto(referencia.cst_pis_saida)}
              />
              <CampoRevisao
                rotulo="Alíquota PIS (saída)"
                valor={formatarAliquota(referencia.aliquota_pis_saida)}
              />
              <CampoRevisao
                rotulo="CST COFINS"
                valor={formatarTexto(referencia.cst_cofins)}
              />
              <CampoRevisao
                rotulo="Alíquota COFINS"
                valor={formatarAliquota(referencia.aliquota_cofins)}
              />
              <CampoRevisao
                rotulo="CST COFINS (saída)"
                valor={formatarTexto(referencia.cst_cofins_saida)}
              />
              <CampoRevisao
                rotulo="Alíquota COFINS (saída)"
                valor={formatarAliquota(referencia.aliquota_cofins_saida)}
              />
              <CampoRevisao
                rotulo="Origem da mercadoria"
                valor={formatarNumero(referencia.origem_mercadoria)}
              />
              <CampoRevisao
                rotulo="Valor de estoque na referência"
                valor={formatarMoeda(referencia.valor_estoque)}
              />
            </dl>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-2">
              Códigos fiscais são exibidos como texto, preservando zeros à
              esquerda. A classificação fiscal definitiva depende de revisão.
            </p>
          </section>

          <section>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
              Status e motivos
            </h3>
            <div className="space-y-2">
              {avaliacao.bloqueios.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-red-700 dark:text-red-400">
                    Bloqueios
                  </p>
                  <ul className="mt-1 list-disc pl-5 space-y-1 text-xs text-red-700 dark:text-red-300">
                    {avaliacao.bloqueios.map((motivo) => (
                      <li key={motivo}>{motivo}</li>
                    ))}
                  </ul>
                </div>
              )}
              {avaliacao.pendencias.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">
                    Pendências para revisão
                  </p>
                  <ul className="mt-1 list-disc pl-5 space-y-1 text-xs text-amber-700 dark:text-amber-300">
                    {avaliacao.pendencias.map((motivo) => (
                      <li key={motivo}>{motivo}</li>
                    ))}
                  </ul>
                </div>
              )}
              {motivos.length === 0 && (
                <p className="text-xs text-green-700 dark:text-green-400">
                  Nenhuma pendência identificada.
                </p>
              )}
              <p className="text-[11px] text-gray-500 dark:text-gray-400">
                Categoria comercial e unidade comercial não existem na base de
                referência fiscal e precisam ser definidas antes de qualquer
                importação.
              </p>
            </div>
          </section>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-5 border-t border-gray-200 dark:border-gray-700">
          <p className="text-[11px] text-gray-500 dark:text-gray-400">
            A gravação só ocorre após validação e confirmação explícitas. Nada é
            gravado ao abrir ou fechar este painel.
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onToggleSelecao}
              disabled={!avaliacao.selecionavel}
              className="px-3 py-2 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {!avaliacao.selecionavel
                ? 'Bloqueado — não selecionável'
                : selecionado
                  ? 'Remover seleção'
                  : 'Selecionar candidato'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 text-sm font-medium rounded-lg bg-gray-900 text-white hover:bg-gray-800 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-200"
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

interface ValidacaoImportacaoFiscalProps {
  validacao: RespostaImportacaoFiscalLote | null;
  itensSelecionados: ComparacaoFiscalItem[];
}

function ValidacaoImportacaoFiscal({
  validacao,
  itensSelecionados,
}: ValidacaoImportacaoFiscalProps) {
  if (!validacao) return null;

  const referencias = new Map(
    itensSelecionados.map((item) => [item.referencia.id, item.referencia]),
  );

  return (
    <section
      role="status"
      aria-live="polite"
      className="rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900/40 p-3 space-y-3"
    >
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
            Resultado da validação do lote
          </h3>
          <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
            Modo validação: <strong>nenhum dado foi gravado</strong>. A
            confirmação só é liberada quando a RPC devolve{' '}
            <code>pode_gravar = true</code>.
          </p>
        </div>
        <span
          className={`inline-flex self-start px-2 py-1 text-xs font-semibold rounded-full ${
            validacao.podeGravar
              ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
              : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
          }`}
        >
          {validacao.podeGravar
            ? 'Confirmação liberada'
            : 'Confirmação bloqueada'}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <ResumoSelecao
          rotulo="Itens válidos"
          valor={validacao.totalValidos}
          destaque="text-green-600 dark:text-green-400"
        />
        <ResumoSelecao
          rotulo="Itens bloqueados"
          valor={validacao.totalBloqueados}
          destaque="text-red-600 dark:text-red-400"
        />
        <ResumoSelecao
          rotulo="Avisos"
          valor={validacao.totalAvisos}
          destaque="text-amber-600 dark:text-amber-400"
        />
      </div>

      {!validacao.podeGravar && (
        <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-2 text-xs text-red-800 dark:text-red-200">
          O servidor não autorizou a gravação deste lote. Corrija os itens
          indicados e valide novamente. Nenhum produto foi criado.
        </div>
      )}

      {validacao.podeGravar && (
        <div className="rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 p-2 text-xs text-green-800 dark:text-green-200">
          A validação foi concluída. Clique em <strong>Importar selecionados</strong>{' '}
          e confirme a ação para gravar. A gravação não é automática.
        </div>
      )}

      {validacao.mensagem && (
        <p className="text-xs text-gray-700 dark:text-gray-300">
          {validacao.mensagem}
        </p>
      )}

      {validacao.erros.length > 0 && (
        <ul className="list-disc pl-5 space-y-0.5 text-xs text-red-700 dark:text-red-300">
          {validacao.erros.map((erro) => (
            <li key={erro}>{erro}</li>
          ))}
        </ul>
      )}

      {validacao.avisos.length > 0 && (
        <ul className="list-disc pl-5 space-y-0.5 text-xs text-amber-700 dark:text-amber-300">
          {validacao.avisos.map((aviso) => (
            <li key={aviso}>{aviso}</li>
          ))}
        </ul>
      )}

      {validacao.itens.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-gray-500 dark:text-gray-400">
                <th className="py-1 pr-3 font-medium">Produto</th>
                <th className="py-1 pr-3 font-medium">Situação</th>
                <th className="py-1 font-medium">Descrição / motivo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {validacao.itens.map((item, indice) => {
                const referenciaId =
                  item.referenciaId ??
                  itensSelecionados[indice]?.referencia.id ??
                  null;
                const referencia = referenciaId
                  ? referencias.get(referenciaId)
                  : undefined;
                const descricao =
                  referencia?.descricao ??
                  item.descricao ??
                  `Item ${indice + 1}`;
                return (
                  <tr key={`${referenciaId ?? 'item'}-${indice}`}>
                    <td className="py-1.5 pr-3 text-gray-900 dark:text-white">
                      {descricao}
                    </td>
                    <td className="py-1.5 pr-3">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full font-semibold ${
                          item.bloqueado
                            ? 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
                            : 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                        }`}
                      >
                        {item.bloqueado ? 'Bloqueado' : 'Válido'}
                      </span>
                    </td>
                    <td className="py-1.5 text-gray-600 dark:text-gray-300">
                      {[...item.erros, ...item.avisos].length > 0
                        ? [...item.erros, ...item.avisos].join(' ')
                        : 'Sem impedimentos informados.'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-xs text-amber-700 dark:text-amber-300">
          A RPC não retornou detalhes por item. A confirmação continua
          condicionada a <code>pode_gravar = true</code>.
        </p>
      )}
    </section>
  );
}

interface ConfirmacaoImportacaoFiscalProps {
  itens: ComparacaoFiscalItem[];
  configuracoes: Record<string, EscolhaComercialImportacaoFiscal>;
  validacao: RespostaImportacaoFiscalLote;
  isGravando: boolean;
  erroGravacao: string | null;
  falhaGravacao: RespostaImportacaoFiscalLote | null;
  onClose: () => void;
  onConfirmar: () => void;
}

function ConfirmacaoImportacaoFiscal({
  itens,
  configuracoes,
  validacao,
  isGravando,
  erroGravacao,
  falhaGravacao,
  onClose,
  onConfirmar,
}: ConfirmacaoImportacaoFiscalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      role="presentation"
      onClick={(event) => {
        if (!isGravando && event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-confirmacao-importacao-fiscal"
        className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-5xl max-h-[92vh] overflow-y-auto"
      >
        <div className="flex items-start justify-between gap-3 p-5 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2
              id="titulo-confirmacao-importacao-fiscal"
              className="text-lg font-semibold text-gray-900 dark:text-white"
            >
              Confirmar importação do lote
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              A validação autorizou {formatarNumero(validacao.totalValidos)}{' '}
              item(ns). A gravação só acontece após esta confirmação explícita.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isGravando}
            aria-label="Fechar confirmação de importação"
            className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700 disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 p-3 text-xs text-blue-800 dark:text-blue-200">
            Serão criados produtos com os dados comerciais da referência. Os
            campos fiscais definitivos permanecerão{' '}
            <strong>pendentes de revisão</strong> e não serão copiados da
            referência. Nenhum produto existente ou estoque atual será alterado.
          </div>

          {erroGravacao && (
            <div
              role="alert"
              className="rounded-lg border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-3 text-xs text-red-800 dark:text-red-200 space-y-1"
            >
              <p className="font-semibold">
                A importação não foi confirmada
              </p>
              <p>{erroGravacao}</p>
              <p>
                A chave de idempotência desta operação foi preservada. Se o
                problema for temporário, clique novamente em{' '}
                <strong>Confirmar e importar</strong> para repetir a mesma
                operação sem duplicar produtos.
              </p>
              {falhaGravacao?.erros.map((erro) => (
                <p key={erro}>• {erro}</p>
              ))}
              {falhaGravacao?.itens
                .flatMap((item) => item.erros)
                .map((erro) => (
                  <p key={erro}>• {erro}</p>
                ))}
            </div>
          )}

          {validacao.avisos.length > 0 && (
            <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-3 text-xs text-amber-900 dark:text-amber-200">
              <p className="font-semibold">Avisos da validação</p>
              <ul className="mt-1 list-disc pl-5 space-y-0.5">
                {validacao.avisos.map((aviso) => (
                  <li key={aviso}>{aviso}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-700/50">
                <tr>
                  <th className="px-2 py-2 text-left text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase">
                    Produto
                  </th>
                  <th className="px-2 py-2 text-left text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase">
                    Categoria / unidade
                  </th>
                  <th className="px-2 py-2 text-right text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase">
                    Estoque inicial
                  </th>
                  <th className="px-2 py-2 text-right text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase">
                    Preço / custo
                  </th>
                  <th className="px-2 py-2 text-left text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase">
                    Estado
                  </th>
                  <th className="px-2 py-2 text-left text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase">
                    Descrição duplicada
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {itens.map((item) => {
                  const referencia = item.referencia;
                  const descricao =
                    referencia.descricao?.trim() ||
                    `linha ${referencia.linha_origem}`;
                  const configuracao =
                    configuracoes[referencia.id] ??
                    criarEscolhaComercialInicial();
                  const custo =
                    referencia.custo ?? referencia.custo_compra ?? null;
                  return (
                    <tr key={referencia.id}>
                      <td className="px-2 py-2 align-top">
                        <p className="font-medium text-gray-900 dark:text-white">
                          {descricao}
                        </p>
                        <p className="text-[11px] text-gray-500 dark:text-gray-400">
                          Cód.: {formatarTexto(referencia.codigo)} • EAN:{' '}
                          {formatarTexto(referencia.codigo_barras)}
                        </p>
                      </td>
                      <td className="px-2 py-2 align-top text-gray-900 dark:text-white">
                        <p>{configuracao.categoria.trim() || '—'}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {configuracao.unidade_medida || '—'}
                        </p>
                      </td>
                      <td className="px-2 py-2 align-top text-right text-gray-900 dark:text-white">
                        {formatarNumero(referencia.estoque)}
                        <p className="text-[10px] text-gray-500 dark:text-gray-400">
                          proposto
                        </p>
                      </td>
                      <td className="px-2 py-2 align-top text-right text-gray-900 dark:text-white">
                        <p>{formatarMoeda(referencia.preco1)}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          custo {formatarMoeda(custo)}
                        </p>
                      </td>
                      <td className="px-2 py-2 align-top">
                        <span
                          className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            configuracao.ativo
                              ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                              : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                          }`}
                        >
                          {configuracao.ativo ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                      <td className="px-2 py-2 align-top text-xs text-gray-700 dark:text-gray-300">
                        {configuracao.confirmar_descricao_duplicada
                          ? 'Confirmação autorizada'
                          : 'Não confirmada'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <p className="text-[11px] text-gray-500 dark:text-gray-400">
            Estoque inicial, preço e custo são valores propostos pela referência
            e serão tratados pela RPC no servidor. O frontend não envia esses
            campos e não executa nenhuma escrita adicional.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-5 border-t border-gray-200 dark:border-gray-700">
          <p className="text-[11px] text-gray-500 dark:text-gray-400">
            A gravação é transacional e feita exclusivamente pela RPC segura.
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isGravando}
              className="px-3 py-2 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={onConfirmar}
              disabled={isGravando}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isGravando ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Upload className="w-4 h-4" />
              )}
              {isGravando ? 'Importando...' : 'Confirmar e importar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

interface ResultadoImportacaoFiscalProps {
  resultado: ResultadoImportacaoExibicao;
  avisoAtualizacao: string | null;
}

function ResultadoImportacaoFiscal({
  resultado,
  avisoAtualizacao,
}: ResultadoImportacaoFiscalProps) {
  const { resposta, itens } = resultado;
  const repeticao = resposta.repeticaoIdempotente;
  const itensSemId = itens.filter((item) => !item.produtoId);

  return (
    <section
      role="status"
      aria-live="polite"
      className="rounded-lg border border-green-300 dark:border-green-800 bg-green-50 dark:bg-green-900/20 p-4 text-sm text-green-900 dark:text-green-100 space-y-3"
    >
      <div className="flex items-start gap-3">
        <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5 text-green-600 dark:text-green-400" />
        <div>
          <h2 className="text-base font-semibold">
            {repeticao
              ? 'Lote já importado anteriormente'
              : 'Importação concluída'}
          </h2>
          <p className="text-xs mt-1">
            {repeticao
              ? 'A mesma chave de idempotência já havia sido processada. Nenhum produto foi duplicado.'
              : `${formatarNumero(resposta.totalCriados)} produto(s) criado(s).`}
          </p>
        </div>
      </div>

      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
        <div>
          <dt className="font-medium text-green-800 dark:text-green-300">
            ID do lote / importação
          </dt>
          <dd className="font-mono break-all">
            {resposta.importacaoId || 'Não informado pela RPC'}
          </dd>
        </div>
        <div>
          <dt className="font-medium text-green-800 dark:text-green-300">
            Total criado
          </dt>
          <dd>{formatarNumero(resposta.totalCriados)}</dd>
        </div>
      </dl>

      {itens.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-green-800 dark:text-green-300">
                <th className="py-1 pr-3 font-medium">Produto</th>
                <th className="py-1 pr-3 font-medium">Código / EAN</th>
                <th className="py-1 pr-3 font-medium">ID do produto</th>
                <th className="py-1 font-medium">Categoria / unidade</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-green-200 dark:divide-green-800">
              {itens.map((item, indice) => (
                <tr key={`${item.referenciaId ?? 'item'}-${indice}`}>
                  <td className="py-1.5 pr-3">{item.descricao}</td>
                  <td className="py-1.5 pr-3">
                    {formatarTexto(item.codigo)} /{' '}
                    {formatarTexto(item.codigoBarras)}
                  </td>
                  <td className="py-1.5 pr-3 font-mono break-all">
                    {item.produtoId || 'ID não retornado'}
                  </td>
                  <td className="py-1.5">
                    {item.categoria || '—'} / {item.unidadeMedida || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {itensSemId.length > 0 && (
        <p className="text-xs text-amber-800 dark:text-amber-200">
          A RPC não retornou o ID de {formatarNumero(itensSemId.length)} produto(s).
          Consulte o histórico do lote no Supabase para obter os identificadores.
        </p>
      )}

      {avisoAtualizacao && (
        <p className="text-xs text-amber-800 dark:text-amber-200">
          {avisoAtualizacao}
        </p>
      )}

      <p className="text-[11px] text-green-800 dark:text-green-300">
        Os produtos criados permanecem com{' '}
        <code>fiscal_status = pendente_revisao</code>. A classificação fiscal
        definitiva continua pendente de revisão.
      </p>
    </section>
  );
}

interface CampoRevisaoProps {
  rotulo: string;
  valor: React.ReactNode;
}

function CampoRevisao({ rotulo, valor }: CampoRevisaoProps) {
  return (
    <div>
      <dt className="text-[11px] font-medium text-gray-500 dark:text-gray-400">
        {rotulo}
      </dt>
      <dd className="text-sm text-gray-900 dark:text-white break-words">
        {valor ?? '—'}
      </dd>
    </div>
  );
}

function formatarNumero(v: number | null | undefined): string {
  if (v === null || v === undefined) return '—';
  return Number(v).toLocaleString('pt-BR');
}

function formatarMoeda(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—';
  return formatadorMoeda.format(v);
}

function formatarAliquota(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—';
  return `${formatarNumero(v)}%`;
}

function formatarTexto(v: string | null | undefined): string {
  if (v === null || v === undefined || v === '') return '—';
  return v;
}
