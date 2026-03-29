import { Skeleton } from '@/components/ui/Skeleton';
import { toast } from '@/utils/toast';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
    ArrowLeft,
    Check,
    ChevronDown,
    ChevronRight,
    ClipboardList,
    Edit2,
    Loader2,
    Minus,
    Package,
    Plus,
    Search,
    ShoppingBasket,
    Trash2,
    User,
    X,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useProdutos } from '../hooks/useProdutos';
import { useVendedoresByAdmin } from '../hooks/useVendedores';
import { supabase } from '../lib/supabase';
import { movimentarEstoque } from '../utils/movimentarEstoque';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Vendedor { id: string; nome: string; }

interface Produto {
  id: string;
  produto_nome: string;
  produto_cod: string;
  categoria: string;
  qtd_estoque: number;
  preco_unt: number;
}

interface ItemAvulso { produto: Produto; quantidade: number; }

interface ItemHistorico {
  id: string;
  quantidade: number;
  preco_unitario: number;
  produto_cadastrado_id?: string;
  produtos_cadastrado: { id?: string; produto_nome: string; qtd_estoque?: number } | null;
}

interface EntregaHistorico {
  id: string;
  created_at: string;
  observacao: string | null;
  usuario_nome: string | null;
  vendedor_id: string;
  vendedores: { nome: string } | null;
  entregas_avulsas_itens: ItemHistorico[];
}

interface ItemEditavel {
  id: string | null;          // null = novo item
  produto_cadastrado_id: string;
  produto_nome: string;
  preco_unitario: number;
  quantidade: number;
  qtd_estoque: number;        // estoque atual (base para validação)
  quantidadeOriginal: number; // quantidade original (para calcular diff no save)
  isNovo: boolean;
  removido: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = (s: string) =>
  new Date(s).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

const normalizar = (str: string) =>
  str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

// ─── Component ───────────────────────────────────────────────────────────────

const EntregaAvulsa: React.FC = () => {
  const navigate = useNavigate();
  const { user, adminId } = useAuth();
  const queryClient = useQueryClient();

  // ── Tabs ──────────────────────────────────────────────────────────────────
  const [aba, setAba] = useState<'historico' | 'nova'>('historico');

  // ── Expanded rows ─────────────────────────────────────────────────────────
  const [expandedEntrega, setExpandedEntrega] = useState<string | null>(null);

  // ── Delete modal ──────────────────────────────────────────────────────────
  const [deletando, setDeletando] = useState<EntregaHistorico | null>(null);
  const [isDeletando, setIsDeletando] = useState(false);

  // ── Edit modal ────────────────────────────────────────────────────────────
  const [editando, setEditando] = useState<EntregaHistorico | null>(null);
  const [editObs, setEditObs] = useState('');
  const [editItens, setEditItens] = useState<ItemEditavel[]>([]);
  const [editSearch, setEditSearch] = useState('');
  const [isSalvandoEdit, setIsSalvandoEdit] = useState(false);

  // ── New delivery form ─────────────────────────────────────────────────────
  const [vendedorSelecionado, setVendedorSelecionado] = useState<Vendedor | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [filtroEstoque, setFiltroEstoque] = useState<'todos' | 'emEstoque'>('todos');
  const [paginaAtual, setPaginaAtual] = useState(1);
  const PRODUTOS_POR_PAGINA = 9;

  const [itens, setItens] = useState<ItemAvulso[]>([]);
  const [observacao, setObservacao] = useState('');
  const [isConfirmando, setIsConfirmando] = useState(false);

  // ── Vendors ───────────────────────────────────────────────────────────────
  const { data: vendedores = [], isLoading: loadingVendedores } = useVendedoresByAdmin(
    adminId || '', { enabled: !!adminId }
  ) as { data: Vendedor[]; isLoading: boolean };

  // ── History ───────────────────────────────────────────────────────────────
  const { data: historico = [], isLoading: loadingHistorico } = useQuery<EntregaHistorico[]>({
    queryKey: ['entregas_avulsas_historico', adminId],
    queryFn: async () => {
      if (!adminId) return [];
      const { data, error } = await supabase
        .from('entregas_avulsas')
        .select(`
          id, created_at, observacao, usuario_nome, vendedor_id,
          vendedores ( nome ),
          entregas_avulsas_itens (
            id, quantidade, preco_unitario, produto_cadastrado_id,
            produtos_cadastrado ( id, produto_nome, qtd_estoque )
          )
        `)
        .eq('administrador_id', adminId)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data as unknown as EntregaHistorico[]) ?? [];
    },
    enabled: !!adminId,
    staleTime: 1000 * 60,
  });

  const invalidateHistory = () => queryClient.invalidateQueries({ queryKey: ['entregas_avulsas_historico', adminId] });

  // ── Products search (new delivery) ────────────────────────────────────────
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 500);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  const { data: produtos = [], isLoading: loadingProdutos } = useProdutos({
    enabled: !!adminId,
    searchTerm: debouncedSearchTerm
  }) as { data: Produto[], isLoading: boolean };

  const isBuscando = loadingProdutos || searchTerm !== debouncedSearchTerm;

  const produtosFiltrados = useMemo<Produto[]>(() => {
    let filtered: Produto[] = produtos;

    if (filtroEstoque === 'emEstoque') {
      filtered = filtered.filter(p => p.qtd_estoque > 0);
    }

    if (searchTerm.trim()) {
      const termos = normalizar(searchTerm.trim()).split(/\s+/);
      filtered = filtered.filter(p => {
        const campos =
          normalizar(p.produto_nome) + ' ' +
          normalizar(p.produto_cod || '') + ' ' +
          normalizar(p.categoria || '');
        return termos.every(termo => campos.includes(termo));
      });
    }

    return filtered;
  }, [produtos, searchTerm, filtroEstoque]);

  // Resetar paginação ao mudar os filtros
  useEffect(() => {
    setPaginaAtual(1);
  }, [searchTerm, filtroEstoque]);

  // ── Products search (edit modal) ──────────────────────────────────────────
  const { data: produtosEdit = [], isLoading: loadingProdutosEdit } = useQuery<Produto[]>({
    queryKey: ['produtos_avulsa_edit', adminId, editSearch],
    queryFn: async () => {
      if (!adminId || editSearch.trim().length < 2) return [];
      const { data, error } = await supabase
        .from('produtos_cadastrado')
        .select('id, produto_nome, produto_cod, categoria, qtd_estoque, preco_unt')
        .eq('administrador_id', adminId).eq('ativo', true)
        .ilike('produto_nome', `%${editSearch.trim()}%`)
        .order('produto_nome').limit(20);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!adminId && editSearch.trim().length >= 2,
    staleTime: 1000 * 30,
  });

  const totalUnidades = itens.reduce((acc, i) => acc + i.quantidade, 0);
  const totalValor = itens.reduce((acc, i) => acc + i.quantidade * i.produto.preco_unt, 0);
  const produtoJaAdicionado = useCallback((id: string) => itens.some(i => i.produto.id === id), [itens]);

  // ── New delivery handlers ─────────────────────────────────────────────────
  const handleAdicionarProduto = (produto: Produto) => {
    if (produtoJaAdicionado(produto.id)) return;
    if (produto.qtd_estoque <= 0) { toast.error('Produto sem estoque disponível.'); return; }
    setItens(prev => [...prev, { produto, quantidade: 1 }]);
    setSearchTerm('');
  };

  const handleAlterarQuantidade = (produtoId: string, novaQtd: number) => {
    if (novaQtd <= 0) { setItens(prev => prev.filter(i => i.produto.id !== produtoId)); return; }
    const item = itens.find(i => i.produto.id === produtoId);
    if (item && novaQtd > item.produto.qtd_estoque) { toast.error(`Máx. disponível: ${item.produto.qtd_estoque} un.`); return; }
    setItens(prev => prev.map(i => i.produto.id === produtoId ? { ...i, quantidade: novaQtd } : i));
  };

  const handleConfirmar = async () => {
    if (!vendedorSelecionado) { toast.error('Selecione um vendedor.'); return; }
    if (itens.length === 0) { toast.error('Adicione pelo menos um produto.'); return; }
    for (const item of itens) {
      if (item.quantidade > item.produto.qtd_estoque) {
        toast.error(`"${item.produto.produto_nome}": excede estoque (${item.produto.qtd_estoque}).`); return;
      }
    }
    setIsConfirmando(true);
    try {
      const { data: entrega, error: e1 } = await supabase
        .from('entregas_avulsas')
        .insert({ administrador_id: adminId || user?.id, vendedor_id: vendedorSelecionado.id, usuario_id: user?.id, usuario_nome: user?.email, observacao: observacao.trim() || null, sincronizado: false })
        .select('id').single();
      if (e1) throw new Error(e1.message);

      const { error: e2 } = await supabase.from('entregas_avulsas_itens').insert(
        itens.map(item => ({ entrega_avulsa_id: entrega.id, produto_cadastrado_id: item.produto.id, quantidade: item.quantidade, preco_unitario: item.produto.preco_unt, sincronizado: false }))
      );
      if (e2) throw new Error(e2.message);

      // Registrar movimentações de saída (trigger atualiza qtd_estoque)
      for (const item of itens) {
        await movimentarEstoque({
          adminId: adminId || user?.id || '',
          produtoId: item.produto.id,
          quantidade: item.quantidade,
          tipoMovimentacao: 'saida_venda',
          referenciaTipo: 'entrega_avulsa',
          referenciaId: entrega.id,
          usuarioId: user?.id || '',
          usuarioTipo: 'admin',
          usuarioNome: user?.email || 'Sistema',
        });
      }

      toast.success(`Entrega confirmada! ${itens.length} produto(s) para ${vendedorSelecionado.nome}.`);
      setVendedorSelecionado(null); setItens([]); setObservacao(''); setSearchTerm('');
      setAba('historico');
      await invalidateHistory();
    } catch (err: unknown) {
      toast.error(`Erro: ${err instanceof Error ? err.message : 'Erro desconhecido'}`);
    } finally { setIsConfirmando(false); }
  };

  // ── Delete handlers ───────────────────────────────────────────────────────
  const handleConfirmarDelete = async () => {
    if (!deletando) return;
    setIsDeletando(true);
    try {
      // Devolver estoque via movimentação de entrada
      for (const item of deletando.entregas_avulsas_itens) {
        const pid = item.produto_cadastrado_id ?? item.produtos_cadastrado?.id;
        if (pid) {
          await movimentarEstoque({
            adminId: adminId || '',
            produtoId: pid,
            quantidade: item.quantidade,
            tipoMovimentacao: 'entrada_devolucao',
            referenciaTipo: 'entrega_avulsa',
            referenciaId: deletando.id,
            usuarioId: user?.id || '',
            usuarioTipo: 'admin',
            usuarioNome: user?.email || 'Sistema',
          });
        }
      }
      // Deletar itens e entrega
      await supabase.from('entregas_avulsas_itens').delete().eq('entrega_avulsa_id', deletando.id);
      const { error } = await supabase.from('entregas_avulsas').delete().eq('id', deletando.id);
      if (error) throw new Error(error.message);

      toast.success('Entrega excluída e estoque devolvido.');
      setDeletando(null);
      await invalidateHistory();
    } catch (err: unknown) {
      toast.error(`Erro ao excluir: ${err instanceof Error ? err.message : 'Erro desconhecido'}`);
    } finally { setIsDeletando(false); }
  };

  // ── Edit handlers ─────────────────────────────────────────────────────────
  const abrirEdicao = (entrega: EntregaHistorico) => {
    setEditObs(entrega.observacao ?? '');
    setEditSearch('');
    setEditItens(entrega.entregas_avulsas_itens.map(item => ({
      id: item.id,
      produto_cadastrado_id: item.produto_cadastrado_id ?? item.produtos_cadastrado?.id ?? '',
      produto_nome: item.produtos_cadastrado?.produto_nome ?? 'Produto desconhecido',
      preco_unitario: item.preco_unitario,
      quantidade: item.quantidade,
      qtd_estoque: item.produtos_cadastrado?.qtd_estoque ?? 0,
      quantidadeOriginal: item.quantidade,
      isNovo: false,
      removido: false,
    })));
    setEditando(entrega);
  };

  const editAlterarQtd = (idx: number, novaQtd: number) => {
    setEditItens(prev => prev.map((it, i) => {
      if (i !== idx) return it;
      // Estoque disponível = estoque atual do produto + qtde já entregue (foi debitada)
      const estoqueDisp = it.qtd_estoque + it.quantidadeOriginal;
      if (novaQtd > estoqueDisp) { toast.error(`Máx. disponível: ${estoqueDisp} un.`); return it; }
      return { ...it, quantidade: Math.max(0, novaQtd) };
    }));
  };

  const editRemoverItem = (idx: number) => {
    setEditItens(prev => prev.map((it, i) =>
      i === idx ? (it.isNovo ? null : { ...it, removido: true }) : it
    ).filter(Boolean) as ItemEditavel[]);
  };

  const editAdicionarProduto = (produto: Produto) => {
    const jaEstaAtivo = editItens.some(it => it.produto_cadastrado_id === produto.id && !it.removido);
    if (jaEstaAtivo) { toast.error('Produto já está na lista.'); return; }
    if (produto.qtd_estoque <= 0) { toast.error('Produto sem estoque.'); return; }
    setEditItens(prev => [...prev, {
      id: null, produto_cadastrado_id: produto.id, produto_nome: produto.produto_nome,
      preco_unitario: produto.preco_unt, quantidade: 1, qtd_estoque: produto.qtd_estoque,
      quantidadeOriginal: 0, isNovo: true, removido: false,
    }]);
    setEditSearch('');
  };

  const handleSalvarEdicao = async () => {
    if (!editando) return;
    const itensAtivos = editItens.filter(it => !it.removido);
    if (itensAtivos.length === 0) { toast.error('A entrega precisa ter pelo menos 1 produto.'); return; }
    setIsSalvandoEdit(true);
    try {
      // Ajustar estoque via movimentações
      for (const it of editItens) {
        const diff = it.quantidade - it.quantidadeOriginal;
        if (diff === 0 && !it.removido) continue;
        if (!it.produto_cadastrado_id) continue;

        if (it.removido) {
          // Devolver tudo que foi debitado originalmente
          if (it.quantidadeOriginal > 0) {
            await movimentarEstoque({
              adminId: adminId || '',
              produtoId: it.produto_cadastrado_id,
              quantidade: it.quantidadeOriginal,
              tipoMovimentacao: 'entrada_devolucao',
              referenciaTipo: 'entrega_avulsa',
              referenciaId: editando.id,
              usuarioId: user?.id || '',
              usuarioTipo: 'admin',
              usuarioNome: user?.email || 'Sistema',
            });
          }
        } else if (diff > 0) {
          // Mais debitado — saída
          await movimentarEstoque({
            adminId: adminId || '',
            produtoId: it.produto_cadastrado_id,
            quantidade: diff,
            tipoMovimentacao: 'saida_venda',
            referenciaTipo: 'entrega_avulsa',
            referenciaId: editando.id,
            usuarioId: user?.id || '',
            usuarioTipo: 'admin',
            usuarioNome: user?.email || 'Sistema',
          });
        } else if (diff < 0) {
          // Devolvido parte — entrada
          await movimentarEstoque({
            adminId: adminId || '',
            produtoId: it.produto_cadastrado_id,
            quantidade: Math.abs(diff),
            tipoMovimentacao: 'entrada_devolucao',
            referenciaTipo: 'entrega_avulsa',
            referenciaId: editando.id,
            usuarioId: user?.id || '',
            usuarioTipo: 'admin',
            usuarioNome: user?.email || 'Sistema',
          });
        }

        // Deletar item removido
        if (it.removido && it.id) {
          await supabase.from('entregas_avulsas_itens').delete().eq('id', it.id);
        }
      }

      // Atualizar/inserir itens ativos
      for (const it of itensAtivos) {
        if (it.isNovo) {
          await supabase.from('entregas_avulsas_itens').insert({
            entrega_avulsa_id: editando.id, produto_cadastrado_id: it.produto_cadastrado_id,
            quantidade: it.quantidade, preco_unitario: it.preco_unitario, sincronizado: false,
          });
        } else if (it.id) {
          await supabase.from('entregas_avulsas_itens').update({ quantidade: it.quantidade }).eq('id', it.id);
        }
      }

      // Atualizar observação
      await supabase.from('entregas_avulsas').update({ observacao: editObs.trim() || null, updated_at: new Date().toISOString() }).eq('id', editando.id);

      toast.success('Entrega atualizada com sucesso!');
      setEditando(null);
      await invalidateHistory();
    } catch (err: unknown) {
      toast.error(`Erro ao salvar: ${err instanceof Error ? err.message : 'Erro desconhecido'}`);
    } finally { setIsSalvandoEdit(false); }
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 p-4 sm:p-6 max-w-4xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/produtos/cestas')}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors text-gray-600 dark:text-gray-400">
            <ArrowLeft size={22} />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Entrega Avulsa</h1>
            <p className="text-gray-600 dark:text-gray-400 text-sm">Envie produtos diretamente ao vendedor</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-700">
        {(['historico', 'nova'] as const).map(t => (
          <button key={t} onClick={() => setAba(t)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${aba === t ? 'border-blue-600 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}>
            {t === 'historico' ? <><ClipboardList className="w-4 h-4" />Histórico</> : <><Package className="w-4 h-4" />Nova Entrega</>}
          </button>
        ))}
      </div>

      {/* ── ABA: HISTÓRICO ── */}
      {aba === 'historico' && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          {loadingHistorico ? (
            <div className="p-6 space-y-3">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
          ) : historico.length === 0 ? (
            <div className="p-12 text-center text-gray-400 dark:text-gray-500">
              <ClipboardList className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">Nenhuma entrega avulsa realizada ainda</p>
              <p className="text-sm mt-1">Clique em "Nova Entrega" para começar</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {historico.map(entrega => {
                const totalQtd = entrega.entregas_avulsas_itens.reduce((s, i) => s + i.quantidade, 0);
                const totalVal = entrega.entregas_avulsas_itens.reduce((s, i) => s + i.quantidade * i.preco_unitario, 0);
                const expanded = expandedEntrega === entrega.id;
                return (
                  <div key={entrega.id}>
                    <div className="px-5 py-4 flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                      {/* Expand toggle */}
                      <button type="button" onClick={() => setExpandedEntrega(expanded ? null : entrega.id)}
                        className="flex-1 min-w-0 text-left flex items-center gap-3">
                        {expanded ? <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" /> : <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />}
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-gray-900 dark:text-white text-sm">{entrega.vendedores?.nome ?? 'Vendedor desconhecido'}</span>
                            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400">
                              {entrega.entregas_avulsas_itens.length} tipo(s) · {totalQtd} un.
                            </span>
                          </div>
                          <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500 dark:text-gray-400 flex-wrap">
                            <span>{fmtDate(entrega.created_at)}</span>
                            {entrega.usuario_nome && <span>por {entrega.usuario_nome}</span>}
                            {entrega.observacao && <span className="italic truncate max-w-xs">{entrega.observacao}</span>}
                          </div>
                        </div>
                      </button>
                      <span className="font-bold text-blue-600 dark:text-blue-400 text-sm flex-shrink-0">R$ {fmt(totalVal)}</span>
                      {/* Edit */}
                      <button type="button" onClick={() => abrirEdicao(entrega)} title="Editar entrega"
                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors flex-shrink-0">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      {/* Delete */}
                      <button type="button" onClick={() => setDeletando(entrega)} title="Excluir entrega"
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors flex-shrink-0">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    {expanded && (
                      <div className="bg-gray-50 dark:bg-gray-700/30 px-5 pb-4">
                        <div className="border border-gray-200 dark:border-gray-600 rounded-lg overflow-hidden divide-y divide-gray-100 dark:divide-gray-600">
                          {entrega.entregas_avulsas_itens.map(item => (
                            <div key={item.id} className="flex items-center justify-between px-4 py-2.5 text-sm bg-white dark:bg-gray-800">
                              <span className="text-gray-900 dark:text-white font-medium">{item.produtos_cadastrado?.produto_nome ?? 'Produto removido'}</span>
                              <div className="flex items-center gap-4 text-gray-500 dark:text-gray-400">
                                <span>{item.quantidade} un. × R$ {fmt(item.preco_unitario)}</span>
                                <span className="font-semibold text-gray-900 dark:text-white">R$ {fmt(item.quantidade * item.preco_unitario)}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── ABA: NOVA ENTREGA ── */}
      {aba === 'nova' && (
        <>
          {/* Vendedor */}
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
              <User className="w-5 h-5 mr-2 text-blue-600 dark:text-blue-400" /> Selecionar Vendedor
            </h2>
            {loadingVendedores ? <Skeleton className="h-10 w-full" /> : (
              <select value={vendedorSelecionado?.id ?? ''}
                onChange={e => setVendedorSelecionado(vendedores.find(v => v.id === e.target.value) ?? null)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white">
                <option value="">— Selecione um vendedor —</option>
                {vendedores.map(v => <option key={v.id} value={v.id}>{v.nome}</option>)}
              </select>
            )}
            {vendedorSelecionado && (
              <p className="mt-2 text-sm text-green-600 dark:text-green-400 flex items-center gap-1">
                <Check className="w-4 h-4" /><span>Vendedor: <strong>{vendedorSelecionado.nome}</strong></span>
              </p>
            )}
          </div>

          {/* Produtos */}
          {/* Produtos GRID AVANÇADO */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden mb-6">
            <div className="flex flex-wrap items-center justify-between gap-3 p-6 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/80">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
                <Package className="w-5 h-5 mr-2 text-green-600 dark:text-green-400" />
                Produtos Disponíveis
                <span className="ml-2 text-sm font-normal text-gray-400 dark:text-gray-500">
                  ({produtosFiltrados.length} produto{produtosFiltrados.length !== 1 ? 's' : ''})
                </span>
              </h2>
              <div className="flex items-center gap-2">
                {/* Filtro de estoque */}
                <div className="flex items-center bg-gray-100 dark:bg-gray-700 rounded-lg p-0.5">
                  <button
                    type="button"
                    onClick={() => setFiltroEstoque('todos')}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                      filtroEstoque === 'todos'
                        ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                    }`}
                  >
                    Todos
                  </button>
                  <button
                    type="button"
                    onClick={() => setFiltroEstoque('emEstoque')}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                      filtroEstoque === 'emEstoque'
                        ? 'bg-white dark:bg-gray-600 text-green-700 dark:text-green-400 shadow-sm'
                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                    }`}
                  >
                    Com Estoque
                  </button>
                </div>
                {/* Buscador */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Buscar produtos..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white text-sm w-full sm:w-auto"
                  />
                </div>
              </div>
            </div>

            <div className="p-6">
              {(() => {
                const totalPaginas = Math.ceil(produtosFiltrados.length / PRODUTOS_POR_PAGINA);
                const inicio = (paginaAtual - 1) * PRODUTOS_POR_PAGINA;
                const produtosPagina = produtosFiltrados.slice(inicio, inicio + PRODUTOS_POR_PAGINA);
                
                return (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {isBuscando ? (
                        Array.from({ length: 6 }).map((_, i) => (
                          <div key={i} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 animate-pulse">
                            <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded w-3/4 mb-2" />
                            <div className="h-3 bg-gray-200 dark:bg-gray-600 rounded w-1/2 mb-4" />
                            <div className="flex justify-between items-center mb-3">
                              <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded w-1/4" />
                              <div className="h-5 bg-gray-200 dark:bg-gray-600 rounded-full w-14" />
                            </div>
                            <div className="h-8 bg-gray-200 dark:bg-gray-600 rounded w-full mt-4" />
                          </div>
                        ))
                      ) : produtosPagina.length === 0 ? (
                        <div className="col-span-1 md:col-span-2 lg:col-span-3 text-center py-10 text-gray-500 dark:text-gray-400">
                          <Package className="w-10 h-10 mx-auto mb-2 opacity-40" />
                          <p>Nenhum produto encontrado na busca.</p>
                        </div>
                      ) : (
                        produtosPagina.map(produto => {
                          const isAdded = produtoJaAdicionado(produto.id);
                          return (
                            <div
                              key={produto.id}
                              className={`border rounded-lg p-4 transition-colors ${
                                isAdded
                                  ? 'border-green-300 bg-green-50 dark:border-green-600 dark:bg-green-900/20'
                                  : 'border-gray-200 dark:border-gray-600 hover:border-blue-300 dark:hover:border-blue-500 bg-white dark:bg-gray-800'
                              }`}
                            >
                              <div className="flex items-start justify-between mb-2">
                                <div className="flex-1 pr-2">
                                  <h3 className="font-medium text-gray-900 dark:text-white text-sm line-clamp-2" title={produto.produto_nome}>
                                    {produto.produto_nome}
                                  </h3>
                                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                    {produto.produto_cod || 'S/N'} {produto.categoria ? `• ${produto.categoria}` : ''}
                                  </p>
                                </div>
                                {isAdded && <Check className="w-4 h-4 text-green-600 dark:text-green-400" />}
                              </div>

                              <div className="flex items-center justify-between mb-3">
                                <span className="text-sm font-medium text-gray-900 dark:text-white">
                                  {fmt(produto.preco_unt)}
                                </span>
                                <span className={`text-xs px-2 py-1 rounded-full ${
                                  produto.qtd_estoque > 10
                                    ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                                    : produto.qtd_estoque > 0
                                    ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
                                    : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
                                }`}>
                                  {produto.qtd_estoque} un.
                                </span>
                              </div>

                              <button
                                type="button"
                                onClick={() => handleAdicionarProduto(produto)}
                                disabled={isAdded || produto.qtd_estoque === 0 || produto.preco_unt <= 0}
                                className={`w-full py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                                  isAdded
                                    ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400 cursor-not-allowed'
                                    : produto.preco_unt <= 0
                                    ? 'bg-gray-100 text-gray-400 dark:bg-gray-700 dark:text-gray-500 cursor-not-allowed border border-gray-200 dark:border-gray-600'
                                    : produto.qtd_estoque === 0
                                    ? 'bg-gray-100 text-gray-400 dark:bg-gray-700 dark:text-gray-500 cursor-not-allowed'
                                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                                }`}
                              >
                                {isAdded ? (
                                  'Adicionado'
                                ) : produto.preco_unt <= 0 ? (
                                  'Valor zerado'
                                ) : produto.qtd_estoque === 0 ? (
                                  'Sem estoque'
                                ) : (
                                  'Incluir na Entrega'
                                )}
                              </button>
                            </div>
                          );
                        })
                      )}
                    </div>

                    {/* Paginação */}
                    {totalPaginas > 1 && (
                      <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Página {paginaAtual} de {totalPaginas} &bull; {produtosFiltrados.length} produto{produtosFiltrados.length !== 1 ? 's' : ''}
                        </p>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setPaginaAtual(1)}
                            disabled={paginaAtual === 1}
                            className="px-2 py-1 text-xs rounded border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                          >
                            «
                          </button>
                          <button
                            type="button"
                            onClick={() => setPaginaAtual(p => Math.max(1, p - 1))}
                            disabled={paginaAtual === 1}
                            className="px-2 py-1 text-xs rounded border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                          >
                            ‹
                          </button>
                          {Array.from({ length: totalPaginas }, (_, i) => i + 1)
                            .filter(p => p === 1 || p === totalPaginas || Math.abs(p - paginaAtual) <= 1)
                            .reduce<(number | '...')[]>((acc, p, idx, arr) => {
                              if (idx > 0 && typeof arr[idx - 1] === 'number' && (p as number) - (arr[idx - 1] as number) > 1) {
                                acc.push('...');
                              }
                              acc.push(p);
                              return acc;
                            }, [])
                            .map((p, idx) =>
                              p === '...' ? (
                                <span key={`ellipsis-${idx}`} className="px-1 text-xs text-gray-400">…</span>
                              ) : (
                                <button
                                  key={p}
                                  type="button"
                                  onClick={() => setPaginaAtual(p as number)}
                                  className={`px-2.5 py-1 text-xs rounded border transition-colors ${
                                    paginaAtual === p
                                      ? 'bg-blue-600 border-blue-600 text-white'
                                      : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                                  }`}
                                >
                                  {p}
                                </button>
                              )
                            )
                          }
                          <button
                            type="button"
                            onClick={() => setPaginaAtual(p => Math.min(totalPaginas, p + 1))}
                            disabled={paginaAtual === totalPaginas}
                            className="px-2 py-1 text-xs rounded border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                          >
                            ›
                          </button>
                          <button
                            type="button"
                            onClick={() => setPaginaAtual(totalPaginas)}
                            disabled={paginaAtual === totalPaginas}
                            className="px-2 py-1 text-xs rounded border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                          >
                            »
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          </div>

          {/* Itens adicionados card */}
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
              <ShoppingBasket className="w-5 h-5 mr-2 text-purple-600 dark:text-purple-400" /> Itens na Entrega
            </h2>
            {itens.length === 0 ? (
              <div className="text-center py-8 text-gray-400 dark:text-gray-500 text-sm border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-lg">
                <Package className="w-8 h-8 mx-auto mb-2 opacity-40" /><p>Adicione acima os produtos da entrega</p>
              </div>
            ) : (
              <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden divide-y divide-gray-100 dark:divide-gray-700">
                {itens.map(item => (
                  <div key={item.produto.id} className="flex items-center gap-3 px-4 py-3 bg-white dark:bg-gray-800">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{item.produto.produto_nome}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">R$ {fmt(item.produto.preco_unt)} · Estoque: {item.produto.qtd_estoque} un.</p>
                    </div>
                    <div className="flex items-center bg-gray-100 dark:bg-gray-800 rounded-lg p-1 shadow-sm border border-gray-200 dark:border-gray-700 flex-shrink-0">
                      <button type="button" onClick={() => handleAlterarQuantidade(item.produto.id, item.quantidade - 1)} className="w-10 h-10 rounded-md bg-white dark:bg-gray-700 flex items-center justify-center text-gray-600 dark:text-gray-300 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/30 transition-colors shadow-sm border border-gray-200 dark:border-gray-600"><Minus className="w-4 h-4" /></button>
                      <input type="number" value={item.quantidade} min={1} max={item.produto.qtd_estoque} onChange={e => handleAlterarQuantidade(item.produto.id, parseInt(e.target.value) || 0)} className="w-16 text-center border-none bg-transparent focus:ring-0 text-gray-900 dark:text-white font-bold text-lg mx-2" />
                      <button type="button" onClick={() => handleAlterarQuantidade(item.produto.id, item.quantidade + 1)} disabled={item.quantidade >= item.produto.qtd_estoque} className="w-10 h-10 rounded-md bg-blue-600 flex items-center justify-center text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-colors"><Plus className="w-4 h-4" /></button>
                    </div>
                    <span className="text-sm font-semibold text-gray-700 dark:text-gray-300 w-24 text-right flex-shrink-0">R$ {fmt(item.produto.preco_unt * item.quantidade)}</span>
                    <button type="button" onClick={() => setItens(prev => prev.filter(i => i.produto.id !== item.produto.id))} className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors flex-shrink-0"><Trash2 className="w-4 h-4" /></button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Resumo + Confirmar */}
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700 space-y-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center"><ShoppingBasket className="w-5 h-5 mr-2 text-purple-600 dark:text-purple-400" />Resumo da Entrega</h2>
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 space-y-2 text-sm border border-gray-200 dark:border-gray-700">
              <div className="flex justify-between text-gray-600 dark:text-gray-400"><span>Vendedor</span><span className="font-medium text-gray-900 dark:text-white">{vendedorSelecionado?.nome ?? <span className="italic text-gray-400">Não selecionado</span>}</span></div>
              <div className="flex justify-between text-gray-600 dark:text-gray-400"><span>Tipos de produto</span><span className="font-medium text-gray-900 dark:text-white">{itens.length}</span></div>
              <div className="flex justify-between text-gray-600 dark:text-gray-400"><span>Total unidades</span><span className="font-medium text-gray-900 dark:text-white">{totalUnidades}</span></div>
              <div className="flex justify-between pt-2 border-t border-gray-200 dark:border-gray-600"><span className="font-bold text-gray-900 dark:text-white">Valor total</span><span className="font-bold text-lg text-blue-600 dark:text-blue-400">R$ {fmt(totalValor)}</span></div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Observação <span className="text-gray-400 font-normal">(opcional)</span></label>
              <textarea value={observacao} onChange={e => setObservacao(e.target.value)} rows={3} placeholder="Ex: Reposição semanal de estoque..." className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm resize-none" />
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={() => setAba('historico')} className="flex-1 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-sm font-medium transition-colors">Cancelar</button>
              <button type="button" onClick={handleConfirmar} disabled={isConfirmando || !vendedorSelecionado || itens.length === 0} className="flex-[2] py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 dark:disabled:bg-gray-600 text-white rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-2 shadow-sm disabled:cursor-not-allowed">
                {isConfirmando ? <><Loader2 className="w-4 h-4 animate-spin" />Confirmando...</> : <><Check className="w-4 h-4" />Confirmar Entrega</>}
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── MODAL DELETE ── */}
      {deletando && (
        <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-start gap-4 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0">
                <Trash2 className="w-5 h-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Excluir entrega?</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  A entrega de <strong>{deletando.vendedores?.nome}</strong> será removida e o estoque dos produtos será <strong>devolvido automaticamente</strong>.
                </p>
              </div>
            </div>
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden mb-5">
              {deletando.entregas_avulsas_itens.map(item => (
                <div key={item.id} className="flex items-center justify-between px-4 py-2.5 text-sm border-b last:border-b-0 border-gray-100 dark:border-gray-700">
                  <span className="text-gray-900 dark:text-white">{item.produtos_cadastrado?.produto_nome ?? 'Produto'}</span>
                  <span className="text-gray-500 dark:text-gray-400 font-medium">{item.quantidade} un.</span>
                </div>
              ))}
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={() => setDeletando(null)} disabled={isDeletando} className="flex-1 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-sm font-medium transition-colors">Cancelar</button>
              <button type="button" onClick={handleConfirmarDelete} disabled={isDeletando} className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-colors">
                {isDeletando ? <><Loader2 className="w-4 h-4 animate-spin" />Excluindo...</> : <><Trash2 className="w-4 h-4" />Excluir</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL EDIT ── */}
      {editando && (
        <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-gray-700">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Editar Entrega</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">{editando.vendedores?.nome} · {fmtDate(editando.created_at)}</p>
              </div>
              <button onClick={() => setEditando(null)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors text-gray-500"><X className="w-5 h-5" /></button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {/* Itens */}
              <div>
                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Itens da entrega</h4>
                <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden divide-y divide-gray-100 dark:divide-gray-700">
                  {editItens.filter(it => !it.removido).map((it) => (
                    <div key={it.id ?? it.produto_cadastrado_id} className="flex items-center gap-3 px-4 py-3 bg-white dark:bg-gray-800">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{it.produto_nome}</p>
                        <p className="text-xs text-gray-400">R$ {fmt(it.preco_unitario)}</p>
                      </div>
                      <div className="flex items-center bg-gray-100 dark:bg-gray-700 rounded-lg p-0.5 border border-gray-200 dark:border-gray-600 flex-shrink-0">
                        <button type="button" onClick={() => editAlterarQtd(editItens.indexOf(it), it.quantidade - 1)} className="w-8 h-8 rounded-md bg-white dark:bg-gray-600 flex items-center justify-center text-gray-600 dark:text-gray-300 hover:bg-red-50 hover:text-red-600 transition-colors shadow-sm"><Minus className="w-3.5 h-3.5" /></button>
                        <input type="number" value={it.quantidade} min={1} onChange={e => editAlterarQtd(editItens.indexOf(it), parseInt(e.target.value) || 0)} className="w-12 text-center border-none bg-transparent focus:ring-0 text-gray-900 dark:text-white font-bold mx-1" />
                        <button type="button" onClick={() => editAlterarQtd(editItens.indexOf(it), it.quantidade + 1)} className="w-8 h-8 rounded-md bg-blue-600 flex items-center justify-center text-white hover:bg-blue-700 shadow-sm transition-colors"><Plus className="w-3.5 h-3.5" /></button>
                      </div>
                      <span className="text-sm font-semibold text-gray-700 dark:text-gray-300 w-20 text-right flex-shrink-0">R$ {fmt(it.preco_unitario * it.quantidade)}</span>
                      <button type="button" onClick={() => editRemoverItem(editItens.indexOf(it))} className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Adicionar produto no modal */}
              <div>
                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Adicionar produto</h4>
                <div className="relative mb-2">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input type="text" placeholder="Buscar produto..." value={editSearch} onChange={e => setEditSearch(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm" />
                </div>
                {editSearch.trim().length >= 2 && (
                  <div className="border border-gray-200 dark:border-gray-600 rounded-lg overflow-hidden max-h-40 overflow-y-auto">
                    {loadingProdutosEdit ? <div className="p-3"><Skeleton className="h-8 w-full" /></div>
                      : produtosEdit.length === 0 ? <div className="p-3 text-center text-sm text-gray-500 dark:text-gray-400">Nenhum produto encontrado.</div>
                      : produtosEdit.map(produto => (
                        <button key={produto.id} type="button" onClick={() => editAdicionarProduto(produto)}
                          className="w-full text-left px-4 py-2.5 flex items-center justify-between hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-colors text-sm bg-white dark:bg-gray-800">
                          <span className="font-medium text-gray-900 dark:text-white truncate">{produto.produto_nome}</span>
                          <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                            <span className={`text-xs px-1.5 py-0.5 rounded-full ${produto.qtd_estoque > 0 ? 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400'}`}>{produto.qtd_estoque} un.</span>
                            <span className="text-xs text-gray-500 dark:text-gray-400">R$ {fmt(produto.preco_unt)}</span>
                            <Plus className="w-3.5 h-3.5 text-blue-500" />
                          </div>
                        </button>
                      ))
                    }
                  </div>
                )}
              </div>

              {/* Observação */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Observação <span className="text-gray-400 font-normal">(opcional)</span></label>
                <textarea value={editObs} onChange={e => setEditObs(e.target.value)} rows={2} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm resize-none" />
              </div>
            </div>

            {/* Footer */}
            <div className="flex gap-3 p-5 border-t border-gray-200 dark:border-gray-700">
              <button type="button" onClick={() => setEditando(null)} disabled={isSalvandoEdit} className="flex-1 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-sm font-medium transition-colors">Cancelar</button>
              <button type="button" onClick={handleSalvarEdicao} disabled={isSalvandoEdit} className="flex-[2] py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-colors shadow-sm">
                {isSalvandoEdit ? <><Loader2 className="w-4 h-4 animate-spin" />Salvando...</> : <><Check className="w-4 h-4" />Salvar Alterações</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EntregaAvulsa;
