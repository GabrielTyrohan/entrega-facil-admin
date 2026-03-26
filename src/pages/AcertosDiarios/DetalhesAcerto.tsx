import { toast } from '@/utils/toast';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ArrowLeft, Clock, Minus, Plus, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
  useAcerto,
  useAtualizarStatusPorSaldo,
  useCreateLancamentoAdicional,
  useDeleteLancamentoAdicional,
  useLancamentosDoAcerto,
} from '../../hooks/useAcertos';
import { applyCurrencyMask, currencyMaskToNumber, formatCurrency } from '../../utils/currencyUtils';


const FORMAS_RECEBIMENTO = ['Dinheiro', 'PIX', 'Depósito', 'Cheque', 'Débito', 'Crédito', 'Cartão'];
const FORMAS_DESPESA = ['Gasolina', 'Borracharia', 'Pedágio', 'Mecânico', 'Outros'];


const getStatusColor = (status: string) => {
  switch (status) {
    case 'pendente':   return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300';
    case 'conferido':  return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
    case 'aprovado':   return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
    case 'divergente': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
    default:           return 'bg-gray-100 text-gray-800';
  }
};


const DetalheAcerto = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data: acerto, isLoading } = useAcerto(id!, { enabled: !!id });
  const { data: lancamentos = [] } = useLancamentosDoAcerto(id!, { enabled: !!id });

  const createLancamento = useCreateLancamentoAdicional();
  const deleteLancamento = useDeleteLancamentoAdicional();
  const atualizarStatus  = useAtualizarStatusPorSaldo();

  const podeEditar = acerto?.status === 'pendente' || acerto?.status === 'conferido';

  const [novoLancamento, setNovoLancamento] = useState({
    tipo: 'recebimento' as 'recebimento' | 'despesa',
    forma: 'Dinheiro',
    valor: 0,
    observacao: ''
  });
  const [valorRaw, setValorRaw] = useState('');

  // ===== CÁLCULOS =====
  const totaisOriginais = useMemo(() => {
    if (!acerto) return { recebido: 0, despesas: 0, vendas: 0 };
    return {
      recebido: (acerto.valor_pix          ?? 0) + (acerto.valor_deposito      ?? 0) +
                (acerto.valor_debito       ?? 0) + (acerto.valor_credito       ?? 0) +
                (acerto.valor_cheque       ?? 0) + (acerto.valor_dinheiro      ?? 0) +
                (acerto.valor_cartao       ?? 0),
      despesas: (acerto.valor_gasolina     ?? 0) + (acerto.valor_borracharia   ?? 0) +
                (acerto.valor_pedagio      ?? 0) + (acerto.valor_mecanico      ?? 0) +
                (acerto.valor_outras_despesas ?? 0),
      vendas:    acerto.valor_total_vendas ?? 0,
    };
  }, [acerto]);

  const totaisAdicionais = useMemo(() => {
    if (acerto?.adicional_recebido != null) {
      return {
        recebido: Number(acerto.adicional_recebido),
        despesas: Number(acerto.adicional_despesas ?? 0),
      };
    }
    return lancamentos.reduce(
      (acc, l) => {
        if (l.tipo === 'recebimento') acc.recebido += l.valor;
        else acc.despesas += l.valor;
        return acc;
      },
      { recebido: 0, despesas: 0 }
    );
  }, [acerto, lancamentos]);

  const totalRecebido = totaisOriginais.recebido + totaisAdicionais.recebido;
  const totalDespesas = totaisOriginais.despesas + totaisAdicionais.despesas;
  const valorEsperado = totaisOriginais.vendas - totalDespesas;
  const saldoFinal    = totalRecebido - valorEsperado;

  const handleAdicionarLancamento = async () => {
    if (novoLancamento.valor <= 0) {
      toast.error('Informe um valor válido');
      return;
    }
    if (!user) return;

    try {
      await createLancamento.mutateAsync({
        acerto_id: id!,
        tipo: novoLancamento.tipo,
        forma: novoLancamento.forma,
        valor: novoLancamento.valor,
        observacao: novoLancamento.observacao || undefined,
        criado_por_id: user.id,
        criado_por_nome: user.user_metadata?.nome || user.email || 'Usuário',
        criado_por_tipo: 'admin',
      });

      const novoSaldo = saldoFinal +
        (novoLancamento.tipo === 'recebimento' ? novoLancamento.valor : -novoLancamento.valor);

      await atualizarStatus.mutateAsync({
        acertoId: id!,
        saldoReal: novoSaldo,
        conferido_por: user.id
      });

      if (novoSaldo === 0) {
        toast.success('✅ Acerto fechado! Valor bateu certinho — aprovado automaticamente.');
      } else if (novoSaldo > 0) {
        toast.success(`Lançamento adicionado! Ainda sobram ${formatCurrency(novoSaldo)}.`);
      } else {
        toast.success(`Lançamento adicionado! Ainda faltam ${formatCurrency(Math.abs(novoSaldo))}.`);
      }

      setNovoLancamento({ tipo: 'recebimento', forma: 'Dinheiro', valor: 0, observacao: '' });
      setValorRaw('');
    } catch {
      toast.error('Erro ao adicionar lançamento');
    }
  };

  const handleRemoverLancamento = async (lancamentoId: string) => {
    try {
      const lancamento = lancamentos.find(l => l.id === lancamentoId);

      await deleteLancamento.mutateAsync({ id: lancamentoId, acerto_id: id! });

      if (lancamento) {
        const saldoAposRemocao = saldoFinal -
          (lancamento.tipo === 'recebimento' ? lancamento.valor : -lancamento.valor);

        await atualizarStatus.mutateAsync({
          acertoId: id!,
          saldoReal: saldoAposRemocao,
          conferido_por: user?.id || ''
        });
      }

      toast.success('Lançamento removido');
    } catch {
      toast.error('Erro ao remover lançamento');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500 dark:text-gray-400">Carregando acerto...</p>
      </div>
    );
  }

  if (!acerto) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500 dark:text-gray-400">Acerto não encontrado.</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/acertos-diarios')}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
          >
            <ArrowLeft size={20} className="text-gray-600 dark:text-gray-400" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Detalhe do Acerto
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {acerto.vendedor_nome} — {format(parseISO(acerto.data_acerto), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
            </p>
          </div>
        </div>
        <span className={`px-3 py-1 rounded-full text-sm font-semibold ${getStatusColor(acerto.status)}`}>
          {acerto.status.toUpperCase()}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* COLUNA ESQUERDA — Resumo */}
        <div className="lg:col-span-1">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-5 border border-gray-200 dark:border-gray-700">
            <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-4">
              Resumo Consolidado
            </h2>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Total de Vendas</span>
                <span className="font-medium text-blue-600 dark:text-blue-400">
                  {formatCurrency(totaisOriginais.vendas)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">(-) Despesas</span>
                <span className="font-medium text-orange-600 dark:text-orange-400">
                  - {formatCurrency(totalDespesas)}
                </span>
              </div>
              {totaisAdicionais.despesas > 0 && (
                <div className="flex justify-between text-xs pl-3">
                  <span className="text-gray-400 dark:text-gray-500">↳ adicionais</span>
                  <span className="text-orange-400">+ {formatCurrency(totaisAdicionais.despesas)}</span>
                </div>
              )}
              <div className="border-t border-gray-200 dark:border-gray-600 pt-2 flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Valor Esperado</span>
                <span className="font-semibold text-purple-600 dark:text-purple-400">
                  {formatCurrency(valorEsperado)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Total Recebido</span>
                <span className="font-medium text-green-600 dark:text-green-400">
                  {formatCurrency(totalRecebido)}
                </span>
              </div>
              {totaisAdicionais.recebido > 0 && (
                <div className="flex justify-between text-xs pl-3">
                  <span className="text-gray-400 dark:text-gray-500">↳ adicionais</span>
                  <span className="text-green-400">+ {formatCurrency(totaisAdicionais.recebido)}</span>
                </div>
              )}
              <div className="border-t-2 border-gray-400 dark:border-gray-500 pt-3">
                <div className="flex justify-between items-center text-lg font-bold">
                  <span className="text-gray-900 dark:text-white">
                    {saldoFinal === 0 ? '✅ Fechado' : saldoFinal > 0 ? 'Sobra' : 'Falta'}
                  </span>
                  <span className={
                    saldoFinal === 0 ? 'text-green-600 dark:text-green-400' :
                    saldoFinal  > 0  ? 'text-blue-600 dark:text-blue-400' :
                    'text-red-600 dark:text-red-400'
                  }>
                    {saldoFinal < 0 && '- '}
                    {formatCurrency(Math.abs(saldoFinal))}
                  </span>
                </div>
                {saldoFinal !== 0 && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 text-right">
                    {saldoFinal > 0
                      ? `Faltam receber ${formatCurrency(saldoFinal)} para fechar`
                      : `Vendedor entregou ${formatCurrency(Math.abs(saldoFinal))} a mais`
                    }
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* COLUNA DIREITA — Lançamentos */}
        <div className="lg:col-span-2 space-y-4">
          {podeEditar ? (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-5 border border-gray-200 dark:border-gray-700">
              <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-4">
                Adicionar Lançamento
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Tipo */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tipo</label>
                  <div className="flex rounded-lg overflow-hidden border border-gray-300 dark:border-gray-600">
                    <button
                      type="button"
                      onClick={() => setNovoLancamento(p => ({ ...p, tipo: 'recebimento', forma: 'Dinheiro' }))}
                      className={`flex-1 py-2 text-sm font-medium flex items-center justify-center gap-1 transition-colors ${
                        novoLancamento.tipo === 'recebimento'
                          ? 'bg-green-600 text-white'
                          : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
                      }`}
                    >
                      <Plus size={14} /> Recebimento
                    </button>
                    <button
                      type="button"
                      onClick={() => setNovoLancamento(p => ({ ...p, tipo: 'despesa', forma: 'Gasolina' }))}
                      className={`flex-1 py-2 text-sm font-medium flex items-center justify-center gap-1 transition-colors ${
                        novoLancamento.tipo === 'despesa'
                          ? 'bg-red-600 text-white'
                          : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
                      }`}
                    >
                      <Minus size={14} /> Despesa
                    </button>
                  </div>
                </div>

                {/* Forma */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Forma</label>
                  <select
                    value={novoLancamento.forma}
                    onChange={(e) => setNovoLancamento(p => ({ ...p, forma: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                  >
                    {(novoLancamento.tipo === 'recebimento' ? FORMAS_RECEBIMENTO : FORMAS_DESPESA).map(f => (
                      <option key={f} value={f}>{f}</option>
                    ))}
                  </select>
                </div>

                {/* Valor */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Valor</label>
                  <input
                    type="text"
                    value={valorRaw}
                    onChange={(e) => {
                      const masked = applyCurrencyMask(e.target.value);
                      setValorRaw(masked);
                      setNovoLancamento(p => ({ ...p, valor: currencyMaskToNumber(masked) }));
                    }}
                    placeholder="R$ 0,00"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-right bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                  />
                </div>

                {/* Observação */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Observação <span className="text-gray-400">(opcional)</span>
                  </label>
                  <input
                    type="text"
                    value={novoLancamento.observacao}
                    onChange={(e) => setNovoLancamento(p => ({ ...p, observacao: e.target.value }))}
                    placeholder="Ex: Cliente João pagou dívida"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={handleAdicionarLancamento}
                disabled={createLancamento.isPending || atualizarStatus.isPending || novoLancamento.valor <= 0}
                className="mt-4 w-full py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
              >
                <Plus size={16} />
                {createLancamento.isPending ? 'Adicionando...' : 'Adicionar Lançamento'}
              </button>
            </div>
          ) : (
            <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 border border-gray-200 dark:border-gray-700 text-center text-sm text-gray-500 dark:text-gray-400">
              🔒 Acerto <strong>{acerto.status}</strong> — não é possível adicionar lançamentos.
            </div>
          )}

          {/* Histórico */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700">
            <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                Histórico de Lançamentos Adicionais
                {lancamentos.length > 0 && (
                  <span className="ml-2 text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 px-2 py-0.5 rounded-full">
                    {lancamentos.length}
                  </span>
                )}
              </h2>
            </div>

            {lancamentos.length === 0 ? (
              <div className="px-5 py-8 text-center text-sm text-gray-400 dark:text-gray-500">
                Nenhum lançamento adicional registrado.
              </div>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {lancamentos.map((l) => (
                  <div key={l.id} className="px-5 py-4 flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className={`mt-0.5 p-1.5 rounded-full ${
                        l.tipo === 'recebimento'
                          ? 'bg-green-100 dark:bg-green-900/30'
                          : 'bg-red-100 dark:bg-red-900/30'
                      }`}>
                        {l.tipo === 'recebimento'
                          ? <Plus size={12} className="text-green-600 dark:text-green-400" />
                          : <Minus size={12} className="text-red-600 dark:text-red-400" />
                        }
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {l.forma}
                          <span className={`ml-2 text-xs font-semibold ${
                            l.tipo === 'recebimento'
                              ? 'text-green-600 dark:text-green-400'
                              : 'text-red-600 dark:text-red-400'
                          }`}>
                            {l.tipo === 'recebimento' ? '+' : '-'} {formatCurrency(l.valor)}
                          </span>
                        </p>
                        {l.observacao && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{l.observacao}</p>
                        )}
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 flex items-center gap-1">
                          <Clock size={10} />
                          {l.criado_por_nome} · {format(parseISO(l.created_at), "dd/MM 'às' HH:mm")}
                        </p>
                      </div>
                    </div>
                    {podeEditar && (
                      <button
                        onClick={() => handleRemoverLancamento(l.id)}
                        className="text-red-400 hover:text-red-600 dark:hover:text-red-300 transition-colors flex-shrink-0"
                        title="Remover lançamento"
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DetalheAcerto;
