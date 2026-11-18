import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/Skeleton";
import { toast } from '@/utils/toast';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, Calendar, CheckCircle2, Edit, Eye, Loader2, MoreHorizontal, Package, Plus, ShoppingBasket, Trash2, User, X } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import type { AdminProfile } from '../contexts/AuthContext';
import NotaPedidoAutonomo from '../components/NotaPedidoAutonomo';
import type { NotaPedidoProps } from '../components/NotaPedidoAutonomo';
import { CestaData, useCestas, useEntregarCestas } from '../hooks/useCestas';
import { supabase } from '../lib/supabase';
import { CACHE_KEYS } from '../lib/supabaseCache';
import { CestaService } from '../services/cestaService';
import { salvarESalvarPdf } from '../utils/pdfStorage';
import { BarraFiltros, Busca, CabecalhoPagina, Chips, Etiqueta, cls, type ChipOpcao, type Tom } from '../components/ui/lista';


type Cesta = CestaData;

const CestasVendedor: React.FC = () => {
  const navigate = useNavigate();
  const { user, adminId, userProfile } = useAuth();
  const entregarCestasMutation = useEntregarCestas();
  const queryClient = useQueryClient();
  const { data: cestas = [], isLoading, error, refetch } = useCestas();
  const [filteredCestas, setFilteredCestas] = useState<Cesta[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('todos');
  const [selectedCesta, setSelectedCesta] = useState<Cesta | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [cestaParaExcluir, setCestaParaExcluir] = useState<Cesta | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [modalSelecionarVendedor, setModalSelecionarVendedor] = useState(false);

  // ── Modal de entrega em lote ──
  const [modalEntregaLote, setModalEntregaLote] = useState<{
    vendedorId: string;
    vendedorNome: string;
  } | null>(null);
  const [cestasNoLote, setCestasNoLote] = useState<Array<{
    cestaId: string;
    cestaNome: string;
    cestaBaseCodigo: string;
    qtd: number;
  }>>([]);
  const [etapaLote, setEtapaLote] = useState<1 | 2>(1);
  const [obsEntrega, setObsEntrega] = useState('');
  const [dadosNotaAutonomo, setDadosNotaAutonomo] = useState<NotaPedidoProps | null>(null);
  const [notaParaImprimir, setNotaParaImprimir] = useState<NotaPedidoProps | null>(null);
  const [isConfirmandoEntrega, setIsConfirmandoEntrega] = useState(false);

  // ── IDs dos produtos da cesta selecionada (modal Emitir) ──
  const produtoIdsEmitir = useMemo(() => {
    if (!selectedCesta?.itens?.length) return [];
    return selectedCesta.itens
      .map((item: any) => item.produto?.id)
      .filter(Boolean);
  }, [selectedCesta]);

  // ── Estoque atualizado para modal de Emitir Cestas ──
  const { data: estoqueAtualEmitir = [] } = useQuery<{ id: string; qtd_estoque: number }[]>({
    queryKey: ['view_estoque_atual_emitir', produtoIdsEmitir],
    queryFn: async () => {
      if (!produtoIdsEmitir.length) return [];
      const { data, error } = await supabase
        .from('view_estoque_atual')
        .select('id, qtd_estoque')
        .in('id', produtoIdsEmitir);
      if (error) throw error;
      return data || [];
    },
    enabled: showModal && produtoIdsEmitir.length > 0,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  // ── Map produto_id → qtd_estoque (modal Emitir) ──
  const estoqueMapEmitir = useMemo(() => {
    const map: Record<string, number> = {};
    estoqueAtualEmitir.forEach(e => { map[e.id] = e.qtd_estoque; });
    return map;
  }, [estoqueAtualEmitir]);

  // ── MaxQtd dinâmico por cesta (estoque vivo da query) ──
  const maxQtdMap = useMemo(() => {
    const map: Record<string, number> = {};
    cestas.forEach(cesta => {
      let max = Infinity;
      for (const item of cesta.itens ?? []) {
        const estoque = item.produto?.qtd_estoque ?? 0;
        const possivel = Math.floor(estoque / item.quantidade);
        if (possivel < max) max = possivel;
      }
      map[cesta.id] = max === Infinity ? 0 : max;
    });
    return map;
  }, [cestas]);

  useEffect(() => {
    let filtered = cestas;

    if (statusFilter !== 'todos') {
      filtered = filtered.filter(cesta => cesta.status === statusFilter);
    }

    if (searchTerm) {
      filtered = filtered.filter(cesta =>
        cesta.vendedor_nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        cesta.cesta_nome?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    setFilteredCestas(prev => {
      if (JSON.stringify(prev) === JSON.stringify(filtered)) return prev;
      return filtered;
    });
  }, [cestas, searchTerm, statusFilter]);

  const handleViewCesta = async (cesta: Cesta) => {
    setSelectedCesta(cesta);
    await queryClient.invalidateQueries({ queryKey: ['view_estoque_atual_emitir'] });
    setShowModal(true);
  };

  const handleEditCesta = (cesta: Cesta) => {
    if (!adminId && !user?.id) {
      toast.error('Você não tem permissão para editar esta cesta.');
      return;
    }
    navigate(`/produtos/cestas/editar/${cesta.id}`);
  };

  const handleDeleteCesta = async () => {
    if (!cestaParaExcluir) return;
    setIsDeleting(true);
    try {
      await CestaService.deleteCesta(cestaParaExcluir.id);
      toast.success('Cesta excluída com sucesso!');
      setCestaParaExcluir(null);
      await refetch();
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao excluir a cesta. Tente novamente.');
    } finally {
      setIsDeleting(false);
    }
  };

  const solicitarExclusaoCesta = (cesta: Cesta) => {
    setCestaParaExcluir(cesta);
  };

  // ── Abrir modal de entrega em lote ──
  const handleAbrirEntregaLote = async (vendedorId: string, vendedorNome: string) => {
    // Força dados frescos antes de calcular maxQtd
    await queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.CESTAS] });

    const cestasDoVendedor = cestas.filter(
      c => c.vendedor_id === vendedorId && c.status === 'em_uso'
    );

    if (cestasDoVendedor.length === 0) {
      toast.error('Nenhuma cesta ativa para este vendedor.');
      return;
    }

    const lote = cestasDoVendedor.map(cesta => ({
      cestaId: cesta.id,
      cestaNome: cesta.cesta_nome,
      cestaBaseCodigo: cesta.cesta_base_codigo || '',
      qtd: 0,
    }));

    setCestasNoLote(lote);
    setModalEntregaLote({ vendedorId, vendedorNome });
    setEtapaLote(1);
    setObsEntrega('');
    setDadosNotaAutonomo(null);
  };

  // ── Prévia da nota (passo 2) ──
  const handleVisualizarNotaLote = async () => {
    const cestasComQtd = cestasNoLote.filter(c => c.qtd > 0);
    if (cestasComQtd.length === 0) return;

    const { data: vendedorData } = await supabase
      .from('vendedores')
      .select('*')
      .eq('id', modalEntregaLote!.vendedorId)
      .single();

    if (vendedorData?.tipo_vinculo !== 'autonomo') {
      await handleConfirmarEntregaLote();
      return;
    }

    const itensTodas: NotaPedidoProps['itens'] = [];

    for (const cestaLote of cestasComQtd) {
      const { data: produtoData } = await supabase
        .from('produtos')
        .select('cesta_base_id, cestas_base(codigo), preco')
        .eq('id', cestaLote.cestaId)
        .single();

      const cestaBaseObj = Array.isArray(produtoData?.cestas_base)
        ? produtoData.cestas_base[0]
        : (produtoData?.cestas_base as any);

      const codigoCesta = cestaBaseObj?.codigo || '';
      const valorUnit = produtoData?.preco || 0;

      itensTodas.push({
        codigo: codigoCesta,
        descricao: cestaLote.cestaNome,
        unidade: 'UN',
        quantidade: cestaLote.qtd,
        valorUnitario: valorUnit,
        valorTotal: valorUnit * cestaLote.qtd,
      });
    }

    const quantidadeTotal = itensTodas.reduce((acc, i) => acc + i.quantidade, 0);
    const valorTotalPedido = itensTodas.reduce((acc, i) => acc + i.valorTotal, 0);
    const adminProfile = userProfile as AdminProfile;

    const dadosNota: NotaPedidoProps = {
      numeroPedido: '######',
      dataEmissao: new Date().toLocaleDateString('pt-BR'),
      dataEntrega: new Date().toLocaleDateString('pt-BR'),
      dataVencimento: new Date().toLocaleDateString('pt-BR'),
      vendedorInterno: (userProfile as any)?.nome || user?.email || 'Não identificado',
      vendedor: {
        codigo: vendedorData.id?.slice(0, 8) || '',
        nome: vendedorData.nome || '',
        cpfCnpj: vendedorData.cpf_cnpj || '',
        telefone: vendedorData.telefone || '',
        endereco: vendedorData.endereco || '',
      },
      empresa: {
        nome: adminProfile?.nome_empresa || 'Empresa',
        telefone: adminProfile?.telefone || '',
        cnpj: adminProfile?.cpf_cnpj || '',
        aviso: `NÃO EFETUAR NENHUM TIPO DE PAGAMENTO PARA O VENDEDOR. REALIZE PAGAMENTOS SOMENTE PARA A CONTA: ${adminProfile?.nome_empresa || 'Empresa'}.`,
      },
      itens: itensTodas,
      quantidadeTotal,
      valorTotalPedido,
    };

    setDadosNotaAutonomo(dadosNota);
    setEtapaLote(2);
  };

  // ── Confirmar entrega em lote ──
  const handleConfirmarEntregaLote = async () => {
    if (isConfirmandoEntrega) return;
    const cestasComQtd = cestasNoLote.filter(c => c.qtd > 0);
    if (!modalEntregaLote || cestasComQtd.length === 0) return;

    const vendedorIdSnapshot = modalEntregaLote.vendedorId;
    const vendedorNomeSnapshot = modalEntregaLote.vendedorNome;

    // Zera imediatamente para evitar que re-renders recalculem cestasComQtd
    setCestasNoLote(prev => prev.map(c => ({ ...c, qtd: 0 })));
    setIsConfirmandoEntrega(true);

    let ultimoId = '';

    try {
      for (const cestaLote of cestasComQtd) {
        // Só dados de negócio — admin/usuário/tenant são autoridade do servidor.
        const result = await entregarCestasMutation.mutateAsync({
          vendedorId: vendedorIdSnapshot,
          cestaId: cestaLote.cestaId,
          quantidade: cestaLote.qtd,
          observacao: obsEntrega,
        });
        if (result?.id) ultimoId = result.id.slice(0, 8).toUpperCase();
      }

      toast.success(`Entrega registrada: ${cestasComQtd.length} tipo(s) de cesta para ${vendedorNomeSnapshot}`);
      setModalEntregaLote(null);
      setEtapaLote(1);

      if (dadosNotaAutonomo) {
        const dadosFinais = { ...dadosNotaAutonomo, numeroPedido: ultimoId };
        setNotaParaImprimir(dadosFinais);
        setTimeout(async () => {
          await gerarPdfNotaComDados(dadosFinais, vendedorIdSnapshot, vendedorNomeSnapshot);
          setNotaParaImprimir(null);
        }, 300);
      }

      await refetch();
      queryClient.invalidateQueries({ queryKey: ['notas_pdf'] }); // invalida cache do histórico
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao registrar entrega.');
      // Se falhou, restaura as quantidades para o usuário poder tentar de novo
      setCestasNoLote(cestasComQtd.map(c => ({ ...c })));
    } finally {
      setIsConfirmandoEntrega(false);
    }
  };

  const gerarPdfNotaComDados = async (
    dados: NotaPedidoProps,
    vendedorId: string,
    vendedorNome: string
  ) => {
    const elemento = document.getElementById('nota-pedido');
    if (!elemento) return;

    const nomeSeguro = vendedorNome.replace(/\s+/g, '_');
    const numeroSeguro = (dados.numeroPedido ?? 'SEM-NUM').replace(/[^a-zA-Z0-9]/g, '');
    const filename = `nota-${nomeSeguro}-${numeroSeguro}.pdf`;

    const opt = {
      margin: [8, 8, 8, 8],
      filename,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
    };

    const blob: Blob = await new Promise((resolve) => {
      (window as any).html2pdf()
        .set(opt)
        .from(elemento)
        .toPdf()
        .get('pdf')
        .then((pdf: any) => {
          const out = pdf.output('blob');
          resolve(out);
        });
    });

    await salvarESalvarPdf(blob, {
      adminId: adminId!,
      vendedorId,
      vendedorNome,
      tipo: 'cesta',
      numeroPedido: dados.numeroPedido ?? 'sem-numero',
      filename,
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'em_uso': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400';
      case 'entregue': return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400';
      case 'retornada': return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'em_uso': return 'Em Uso';
      case 'entregue': return 'Entregue';
      case 'retornada': return 'Retornada';
      default: return status;
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedCesta(null);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric'
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-96" />
          </div>
          <Skeleton className="h-10 w-32 rounded-lg" />
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0 md:space-x-4">
            <Skeleton className="h-10 flex-1 max-w-md" />
            <Skeleton className="h-10 w-40" />
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  {[...Array(6)].map((_, i) => (
                    <th key={i} className="px-6 py-3 text-left">
                      <Skeleton className="h-4 w-24" />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {[...Array(8)].map((_, i) => (
                  <tr key={i}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <Skeleton className="h-10 w-10 rounded-full mr-4" />
                        <div className="space-y-1">
                          <Skeleton className="h-4 w-32" />
                          <Skeleton className="h-3 w-24" />
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <Skeleton className="w-4 h-4 mr-2" />
                        <Skeleton className="h-4 w-24" />
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap"><Skeleton className="h-4 w-32" /></td>
                    <td className="px-6 py-4 whitespace-nowrap"><Skeleton className="h-4 w-24" /></td>
                    <td className="px-6 py-4 whitespace-nowrap"><Skeleton className="h-6 w-20 rounded-full" /></td>
                    <td className="px-6 py-4 whitespace-nowrap"><Skeleton className="h-8 w-8 ml-auto rounded-lg" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // Contagem por situação (considerando a busca) para os chips
  const baseChips = searchTerm
    ? cestas.filter(
        (c) =>
          c.vendedor_nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          c.cesta_nome?.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : cestas;
  const chipsStatus: ChipOpcao<string>[] = [
    { valor: 'todos', rotulo: 'Todas', contagem: baseChips.length },
    { valor: 'em_uso', rotulo: 'Em uso', contagem: baseChips.filter((c) => c.status === 'em_uso').length },
    { valor: 'entregue', rotulo: 'Entregues', contagem: baseChips.filter((c) => c.status === 'entregue').length },
    { valor: 'retornada', rotulo: 'Retornadas', contagem: baseChips.filter((c) => c.status === 'retornada').length },
  ];
  const tomStatus = (status: string): Tom => (status === 'em_uso' ? 'destaque' : status === 'entregue' ? 'ok' : 'neutro');

  return (
    <div className="space-y-5">
      <CabecalhoPagina
        titulo="Cestas dos Vendedores"
        descricao="Cestas liberadas para cada vendedor. Liberar dá baixa no estoque geral."
        acoes={
          <>
            <button onClick={() => setModalSelecionarVendedor(true)} className={cls.btn}>
              <Package className="h-4 w-4" />
              <span>Entregar em Lote</span>
            </button>
            <button onClick={() => navigate('/produtos/cestas/nova')} className={cls.btnPri}>
              <Plus className="h-4 w-4" />
              <span>Emitir Cesta</span>
            </button>
          </>
        }
      />

      {/* Filtros */}
      <div className="space-y-2.5">
        <BarraFiltros>
          <Busca value={searchTerm} onChange={setSearchTerm} placeholder="Buscar por vendedor ou nome da cesta" className="flex-1 sm:max-w-md" />
        </BarraFiltros>
        <Chips rotulo="Filtrar por situação" opcoes={chipsStatus} valor={statusFilter} onChange={setStatusFilter} />
      </div>

      {/* Error State */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
          <div className="flex">
            <AlertCircle className="mr-3 mt-0.5 h-5 w-5 text-red-600 dark:text-red-400" />
            <div>
              <h3 className="text-sm font-medium text-red-800 dark:text-red-200">Erro ao carregar cestas</h3>
              <p className="mt-1 text-sm text-red-700 dark:text-red-300">{error.message || 'Ocorreu um erro inesperado. Tente novamente.'}</p>
              <button onClick={() => refetch()} className="mt-2 text-sm text-red-600 underline hover:text-red-800 dark:text-red-400 dark:hover:text-red-200">
                Tentar novamente
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lista de Cestas */}
      {!isLoading && !error && filteredCestas.length > 0 && (
        <div className={`${cls.card} overflow-hidden`}>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className={cls.thead}>
                <tr>
                  <th className={cls.th}>Vendedor</th>
                  <th className={`${cls.th} hidden xl:table-cell`}>Montada em</th>
                  <th className={cls.thR}>Itens</th>
                  <th className={cls.thR}>Valor</th>
                  <th className={`${cls.thR} hidden xl:table-cell`}>Entregas</th>
                  <th className={cls.th}>Com o vendedor</th>
                  <th className={cls.th}>Situação</th>
                  <th className={cls.th}>
                    <span className="sr-only">Ações</span>
                  </th>
                </tr>
              </thead>
              <tbody className={cls.tbody}>
                {filteredCestas.map((cesta) => (
                  <tr key={cesta.id} className={cls.tr}>
                    <td className={`${cls.td} max-w-[240px] xl:max-w-none`}>
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-50 text-xs font-semibold text-blue-700 dark:bg-blue-500/15 dark:text-blue-300">
                          {cesta.vendedor_nome.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="truncate font-medium text-gray-900 dark:text-white">{cesta.vendedor_nome}</div>
                          <div className="truncate text-xs text-gray-500 dark:text-gray-400">
                            {cesta.cesta_nome}
                            <span className="xl:hidden"> · {formatDate(cesta.data_montagem)}</span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className={`${cls.td} hidden whitespace-nowrap xl:table-cell`}>{formatDate(cesta.data_montagem)}</td>
                    <td className={cls.tdR}>{(cesta.itens ?? []).length}</td>
                    <td className={cls.tdR}>{(cesta.valor_total || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                    <td className={`${cls.tdR} hidden xl:table-cell`}>{cesta.entregas_realizadas || 0}</td>
                    <td className={cls.td}>
                      {(() => {
                        const qtd = cesta.quantidade_disponivel;
                        if (qtd === null) return <span className="text-xs italic text-gray-400">Não definido</span>;
                        return (
                          <Etiqueta tom={qtd === 0 ? 'perigo' : qtd <= 3 ? 'atencao' : 'ok'}>
                            {qtd} cesta{qtd !== 1 ? 's' : ''}
                          </Etiqueta>
                        );
                      })()}
                    </td>
                    <td className={cls.td}>
                      <Etiqueta tom={tomStatus(cesta.status)}>{getStatusText(cesta.status)}</Etiqueta>
                    </td>
                    <td className={`${cls.td} whitespace-nowrap`}>
                      <div className={cls.rowActions}>
                        <button type="button" onClick={() => handleViewCesta(cesta)} className={cls.btnGhost}>
                          <Eye className="h-3.5 w-3.5" /> Ver
                        </button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button aria-label={`Mais ações da cesta de ${cesta.vendedor_nome}`} className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-gray-200">
                              <MoreHorizontal className="h-4 w-4" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleViewCesta(cesta)}>
                              <Eye className="mr-2 h-4 w-4" />
                              Visualizar
                            </DropdownMenuItem>
                            {cesta.status === 'em_uso' && (
                              <DropdownMenuItem onClick={() => handleEditCesta(cesta)}>
                                <Edit className="mr-2 h-4 w-4" />
                                Editar
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onClick={() => solicitarExclusaoCesta(cesta)} className="text-red-600 dark:text-red-400">
                              <Trash2 className="mr-2 h-4 w-4" />
                              Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && filteredCestas.length === 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-8 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="text-center py-12">
            <div className="mx-auto w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
              <ShoppingBasket className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Nenhuma cesta encontrada</h3>
            <p className="text-gray-500 dark:text-gray-400 mb-6">
              {searchTerm || statusFilter !== 'todos'
                ? 'Tente ajustar os filtros de busca.'
                : 'Comece emitindo a primeira cesta para um vendedor.'
              }
            </p>
            {!searchTerm && statusFilter === 'todos' && (
              <button
                onClick={() => navigate('/produtos/cestas/nova')}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium flex items-center space-x-2 transition-colors mx-auto"
              >
                <Plus className="w-4 h-4" />
                <span>Emitir Primeira Cesta</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Alerta */}
      <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
        <div className="flex">
          <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mt-0.5 mr-3" />
          <div>
            <h3 className="text-sm font-medium text-yellow-800 dark:text-yellow-200">Controle de Estoque</h3>
            <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
              Produtos em cestas ativas são reservados do estoque. Finalize ou retorne as cestas para liberar os produtos.
            </p>
          </div>
        </div>
      </div>

      {/* Modal de Visualização Detalhada */}
      {showModal && selectedCesta && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
              <div className="flex items-center space-x-3">
                <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center">
                  <ShoppingBasket className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Detalhes da Cesta</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{selectedCesta?.cesta_nome || 'Nome não disponível'}</p>
                </div>
              </div>
              <button onClick={closeModal} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
                <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                  <div className="flex items-center space-x-2 mb-2">
                    <User className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Vendedor</span>
                  </div>
                  <p className="text-lg font-semibold text-gray-900 dark:text-white">
                    {selectedCesta?.vendedor_nome || 'Vendedor não informado'}
                  </p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                  <div className="flex items-center space-x-2 mb-2">
                    <Calendar className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Data de Montagem</span>
                  </div>
                  <p className="text-lg font-semibold text-gray-900 dark:text-white">
                    {selectedCesta?.data_montagem ? formatDate(selectedCesta.data_montagem) : 'Data não informada'}
                  </p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                  <div className="flex items-center space-x-2 mb-2">
                    <Package className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Quantidade de Itens</span>
                  </div>
                  <p className="text-lg font-semibold text-gray-900 dark:text-white">
                    {selectedCesta?.total_itens || 0} itens
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {selectedCesta?.itens?.length || 0} produtos diferentes
                  </p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                  <div className="flex items-center space-x-2 mb-2">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Valor Total</span>
                  </div>
                  <p className="text-lg font-semibold text-green-600 dark:text-green-400">
                    R$ {(selectedCesta.valor_total || 0).toFixed(2)}
                  </p>
                  <div className="mt-1">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(selectedCesta?.status || '')}`}>
                      {getStatusText(selectedCesta?.status || '')}
                    </span>
                  </div>
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Produtos na Cesta
                  </h3>
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    {selectedCesta.itens?.length || 0} produto(s) diferente(s)
                  </span>
                </div>

                <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-lg">
                  <table className="w-full text-sm" style={{ minWidth: "680px" }}>
                    <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-[12%]">Código</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-[38%]">Produto</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-[15%]">Categoria</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-[10%]">Qtd</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-[13%]">Preço Unit.</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-[12%]">Estoque</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {selectedCesta.itens && selectedCesta.itens.length > 0 ? (
                        selectedCesta.itens.map((item, index) => (
                          <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                            <td className="px-4 py-3 text-sm font-mono text-gray-500 dark:text-gray-400">
                              {item.produto?.produto_cod || 'N/A'}
                            </td>
                            <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
                              {item.produto?.produto_nome || 'Nome não disponível'}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
                              {item.produto?.categoria || 'N/A'}
                            </td>
                            <td className="px-4 py-3 text-sm text-right text-gray-900 dark:text-white">
                              {item.quantidade || 0}
                            </td>
                            <td className="px-4 py-3 text-sm text-right text-gray-900 dark:text-white">
                              {(item.produto?.preco_unt || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </td>
                            <td className="px-4 py-3 text-right">
                              {(() => {
                                const estoqueAtual = estoqueMapEmitir[item.produto?.id] ?? item.produto?.qtd_estoque ?? 0;
                                return (
                                  <span className={`inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                                    estoqueAtual === 0
                                      ? 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400'
                                      : estoqueAtual <= 5
                                      ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400'
                                      : 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400'
                                  }`}>
                                    {estoqueAtual}
                                  </span>
                                );
                              })()}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                            Nenhum produto encontrado nesta cesta
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
            <div className="flex-shrink-0 border-t border-gray-200 dark:border-gray-700 px-6 py-4 flex justify-end">
              <button onClick={closeModal} className="px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors">
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmação de Exclusão */}
      {cestaParaExcluir && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-lg w-full">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Confirmar exclusão</h2>
              <button onClick={() => setCestaParaExcluir(null)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
                <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-gray-700 dark:text-gray-300">
                Tem certeza que deseja excluir a cesta
                <span className="font-semibold"> {cestaParaExcluir.cesta_nome} </span>
                do vendedor
                <span className="font-semibold"> {cestaParaExcluir.vendedor_nome}</span>?
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Esta ação removerá a cesta e todos os itens associados. Não é possível desfazer.
              </p>
              <div className="mt-6 flex justify-end space-x-3">
                <button onClick={() => setCestaParaExcluir(null)} className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                  Cancelar
                </button>
                <button
                  onClick={handleDeleteCesta}
                  disabled={isDeleting}
                  className="bg-red-600 hover:bg-red-700 disabled:bg-red-600/60 text-white px-4 py-2 rounded-lg font-medium flex items-center space-x-2 transition-colors"
                >
                  {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  <span>Excluir</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Entrega em Lote */}
      {modalEntregaLote && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-fit min-w-[560px] max-w-[90vw] flex flex-col max-h-[85vh]">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center">
                  <Package className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900 dark:text-white">
                    {etapaLote === 1 ? 'Entregar Cestas' : 'Prévia da Nota'}
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{modalEntregaLote.vendedorNome}</p>
                </div>
              </div>
              <button
                onClick={() => { setModalEntregaLote(null); setEtapaLote(1); }}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <X size={20} className="text-gray-500" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
              {etapaLote === 1 ? (
                <>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Informe a quantidade a entregar de cada cesta. Cestas com estoque insuficiente estão desativadas.
                  </p>
                  <div className="space-y-3">
                    {cestasNoLote.map((item, idx) => {
                      const estoqueAtual = maxQtdMap[item.cestaId] ?? 0;
                      return (
                        <div
                          key={item.cestaId}
                          className={`flex items-center gap-4 p-3 rounded-xl border ${
                            estoqueAtual === 0
                              ? 'border-red-200 bg-red-50 dark:bg-red-900/10 opacity-60'
                              : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/40'
                          }`}
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-800 dark:text-white truncate">{item.cestaNome}</p>
                            <p className="text-xs text-gray-500">
                              {estoqueAtual === 0 ? 'Sem estoque' : `Máx: ${estoqueAtual} cestas`}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              disabled={estoqueAtual === 0 || item.qtd <= 0}
                              onClick={() => setCestasNoLote(prev =>
                                prev.map((c, i) => i === idx ? { ...c, qtd: Math.max(0, c.qtd - 1) } : c)
                              )}
                              className="w-8 h-8 rounded-lg border border-gray-300 dark:border-gray-600 flex items-center justify-center text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-40"
                            >−</button>
                            <span className="w-8 text-center text-sm font-bold text-gray-900 dark:text-white">
                              {item.qtd}
                            </span>
                            <button
                              disabled={estoqueAtual === 0 || item.qtd >= estoqueAtual}
                              onClick={() => setCestasNoLote(prev =>
                                prev.map((c, i) => i === idx ? { ...c, qtd: Math.min(estoqueAtual, c.qtd + 1) } : c)
                              )}
                              className="w-8 h-8 rounded-lg border border-gray-300 dark:border-gray-600 flex items-center justify-center text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-40"
                            >+</button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Observação */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Observação (opcional)
                    </label>
                    <textarea
                      value={obsEntrega}
                      onChange={e => setObsEntrega(e.target.value)}
                      rows={2}
                      placeholder="Ex: entrega parcial, produto substituído..."
                      className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </>
              ) : (
                /* Passo 2 — Prévia da nota */
                <>
                  <div className="flex items-center gap-2 mb-1">
                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                    <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                      Confira a nota antes de confirmar:
                    </p>
                  </div>
                  {dadosNotaAutonomo && <NotaPedidoAutonomo {...dadosNotaAutonomo} />}
                </>
              )}
            </div>

            {/* Footer */}
            <div className="flex gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700 shrink-0">
              {etapaLote === 1 ? (
                <>
                  <button
                    onClick={() => { setModalEntregaLote(null); setEtapaLote(1); }}
                    className="flex-1 py-3 border border-gray-300 dark:border-gray-600 rounded-xl text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleVisualizarNotaLote}
                    disabled={cestasNoLote.every(c => c.qtd === 0)}
                    className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                  >
                    <Eye size={16} /> Visualizar Nota →
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => setEtapaLote(1)}
                    className="flex-1 py-3 border border-gray-300 dark:border-gray-600 rounded-xl text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    ← Voltar
                  </button>
                  <button
                    onClick={handleConfirmarEntregaLote}
                    disabled={isConfirmandoEntrega}
                    className="flex-1 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-semibold disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                  >
                    {isConfirmandoEntrega
                      ? <Loader2 size={16} className="animate-spin" />
                      : <><Package size={16} /> Confirmar e Gerar PDF</>
                    }
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal de Seleção de Vendedor */}
      {modalSelecionarVendedor && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-sm">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-base font-bold text-gray-900 dark:text-white">Selecionar Vendedor</h3>
              <button onClick={() => setModalSelecionarVendedor(false)} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
                <X size={20} className="text-gray-500" />
              </button>
            </div>
            <div className="px-6 py-4 space-y-2 max-h-80 overflow-y-auto">
              {Array.from(
                new Map(
                  cestas
                    .filter(c => c.status === 'em_uso')
                    .map(c => [c.vendedor_id, { id: c.vendedor_id, nome: c.vendedor_nome }])
                ).values()
              ).map(vendedor => (
                <button
                  key={vendedor.id}
                  onClick={() => {
                    setModalSelecionarVendedor(false);
                    handleAbrirEntregaLote(vendedor.id, vendedor.nome);
                  }}
                  className="w-full text-left px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-3"
                >
                  <User size={18} className="text-gray-400 shrink-0" />
                  <span className="text-sm font-semibold text-gray-800 dark:text-white">{vendedor.nome}</span>
                </button>
              ))}
              {cestas.filter(c => c.status === 'em_uso').length === 0 && (
                <p className="text-sm text-gray-500 text-center py-4">Nenhum vendedor com cestas ativas.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Nota oculta para geração de PDF */}
      {notaParaImprimir && (
        <div style={{ position: 'fixed', left: '-9999px', top: 0, zIndex: -1 }}>
          <NotaPedidoAutonomo {...notaParaImprimir} />
        </div>
      )}

    </div>
  );
};

export default CestasVendedor;
