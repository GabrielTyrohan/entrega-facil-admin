import React, { useMemo, useState } from 'react';
import { Check, ClipboardList, Package, ShoppingBasket, X } from 'lucide-react';
import PageHeader from '@/components/layout/PageHeader';
import { toast } from '@/utils/toast';
import {
  PedidoVendedor,
  StatusPedido,
  useAtenderPedido,
  usePedidosVendedor,
  useRecusarPedido,
} from '@/hooks/usePedidosVendedor';

const STATUS_LABEL: Record<StatusPedido, string> = {
  pendente: 'Aguardando',
  aprovado: 'Atendido',
  parcial: 'Atendido em parte',
  recusado: 'Recusado',
  cancelado: 'Cancelado pelo vendedor',
};

const STATUS_CLASS: Record<StatusPedido, string> = {
  pendente: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  aprovado: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  parcial: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  recusado: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  cancelado: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
};

const FILTROS: { value: StatusPedido | 'todos'; label: string }[] = [
  { value: 'pendente', label: 'Aguardando' },
  { value: 'aprovado', label: 'Atendidos' },
  { value: 'parcial', label: 'Em parte' },
  { value: 'recusado', label: 'Recusados' },
  { value: 'todos', label: 'Todos' },
];

const formatarData = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

function mensagemErro(e: unknown): string {
  if (e && typeof e === 'object' && 'message' in e) return String((e as { message: string }).message);
  return 'Erro desconhecido';
}

interface PainelProps {
  pedido: PedidoVendedor;
  onFechar: () => void;
}

const PainelAtendimento: React.FC<PainelProps> = ({ pedido, onFechar }) => {
  const atender = useAtenderPedido();
  const recusar = useRecusarPedido();
  const [quantidades, setQuantidades] = useState<Record<string, number>>(
    () => Object.fromEntries(pedido.itens.map((i) => [i.id, i.quantidade_solicitada]))
  );
  const [resposta, setResposta] = useState('');
  const [modoRecusa, setModoRecusa] = useState(false);
  const pendente = pedido.status === 'pendente';
  const ocupado = atender.isPending || recusar.isPending;

  const totalInformado = Object.values(quantidades).reduce((a, b) => a + (Number(b) || 0), 0);
  const totalSolicitado = pedido.itens.reduce((a, i) => a + i.quantidade_solicitada, 0);

  const confirmarAtendimento = async () => {
    try {
      const res = await atender.mutateAsync({
        pedidoId: pedido.id,
        itens: pedido.itens.map((i) => ({ item_id: i.id, quantidade: Number(quantidades[i.id]) || 0 })),
        resposta: resposta.trim() || undefined,
      });
      toast.success(res.status === 'aprovado' ? 'Pedido atendido por completo' : 'Pedido atendido em parte');
      onFechar();
    } catch (e) {
      toast.error('Não foi possível atender: ' + mensagemErro(e));
    }
  };

  const confirmarRecusa = async () => {
    if (!resposta.trim()) {
      toast.error('Informe o motivo da recusa');
      return;
    }
    try {
      await recusar.mutateAsync({ pedidoId: pedido.id, motivo: resposta.trim() });
      toast.success('Pedido recusado');
      onFechar();
    } catch (e) {
      toast.error('Não foi possível recusar: ' + mensagemErro(e));
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Pedido #{pedido.numero} — {pedido.vendedor?.nome ?? 'Vendedor'}
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">Enviado em {formatarData(pedido.created_at)}</p>
        </div>
        <button onClick={onFechar} className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700" aria-label="Fechar">
          <X className="w-5 h-5 text-gray-500" />
        </button>
      </div>

      {pedido.observacao && (
        <div className="text-sm bg-gray-50 dark:bg-gray-900/40 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
          <span className="font-medium text-gray-700 dark:text-gray-300">Observação do vendedor: </span>
          <span className="text-gray-700 dark:text-gray-300">{pedido.observacao}</span>
        </div>
      )}

      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
            <th className="py-2 font-medium">Item</th>
            <th className="py-2 font-medium text-right">Pedido</th>
            <th className="py-2 font-medium text-right w-32">{pendente ? 'Liberar' : 'Liberado'}</th>
          </tr>
        </thead>
        <tbody>
          {pedido.itens.map((item) => (
            <tr key={item.id} className="border-b border-gray-100 dark:border-gray-700/60">
              <td className="py-2">
                <div className="flex items-center gap-2 text-gray-900 dark:text-white">
                  {item.tipo === 'cesta'
                    ? <ShoppingBasket className="w-4 h-4 text-blue-500 shrink-0" />
                    : <Package className="w-4 h-4 text-amber-500 shrink-0" />}
                  <span>{item.descricao}</span>
                </div>
                <span className="text-xs text-gray-500">{item.tipo === 'cesta' ? 'Cesta' : 'Produto avulso'}</span>
              </td>
              <td className="py-2 text-right tabular-nums text-gray-700 dark:text-gray-300">{item.quantidade_solicitada}</td>
              <td className="py-2 text-right">
                {pendente ? (
                  <input
                    type="number"
                    min={0}
                    max={item.quantidade_solicitada}
                    step={item.tipo === 'cesta' ? 1 : 'any'}
                    value={quantidades[item.id] ?? 0}
                    onChange={(e) => setQuantidades((q) => ({ ...q, [item.id]: Number(e.target.value) }))}
                    disabled={modoRecusa || ocupado}
                    className="w-24 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded-md text-right bg-white dark:bg-gray-700 dark:text-white tabular-nums"
                  />
                ) : (
                  <span className="tabular-nums text-gray-700 dark:text-gray-300">{item.quantidade_atendida}</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {pendente ? (
        <>
          <label className="block text-sm">
            <span className="text-gray-700 dark:text-gray-300">
              {modoRecusa ? 'Motivo da recusa (o vendedor verá no app) *' : 'Recado para o vendedor (opcional)'}
            </span>
            <textarea
              value={resposta}
              onChange={(e) => setResposta(e.target.value)}
              rows={2}
              maxLength={500}
              className="mt-1 w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 dark:text-white"
            />
          </label>

          {!modoRecusa && totalInformado > 0 && totalInformado < totalSolicitado && (
            <p className="text-sm text-blue-700 dark:text-blue-300">
              Será registrado como atendido em parte.
            </p>
          )}

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
            {modoRecusa ? (
              <>
                <button
                  onClick={() => setModoRecusa(false)}
                  disabled={ocupado}
                  className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Voltar
                </button>
                <button
                  onClick={confirmarRecusa}
                  disabled={ocupado || !resposta.trim()}
                  className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                >
                  {recusar.isPending ? 'Recusando…' : 'Confirmar recusa'}
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => setModoRecusa(true)}
                  disabled={ocupado}
                  className="px-4 py-2 text-sm border border-red-300 text-red-700 dark:text-red-300 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"
                >
                  Recusar
                </button>
                <button
                  onClick={confirmarAtendimento}
                  disabled={ocupado || totalInformado <= 0}
                  className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 inline-flex items-center justify-center gap-2"
                >
                  <Check className="w-4 h-4" />
                  {atender.isPending ? 'Liberando…' : 'Liberar ao vendedor'}
                </button>
              </>
            )}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Liberar dá baixa no estoque geral e envia ao vendedor na próxima sincronização do app.
            Se faltar estoque de algum item, nada é liberado.
          </p>
        </>
      ) : (
        <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
          <p>
            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_CLASS[pedido.status]}`}>
              {STATUS_LABEL[pedido.status]}
            </span>
            {pedido.atendido_por_nome && <> por {pedido.atendido_por_nome}</>}
            {pedido.atendido_em && <> em {formatarData(pedido.atendido_em)}</>}
          </p>
          {pedido.resposta && <p>Recado: {pedido.resposta}</p>}
        </div>
      )}
    </div>
  );
};

const PedidosVendedores: React.FC = () => {
  const [filtro, setFiltro] = useState<StatusPedido | 'todos'>('pendente');
  const [selecionadoId, setSelecionadoId] = useState<string | null>(null);
  const { data: pedidos = [], isLoading, error } = usePedidosVendedor(filtro);

  const selecionado = useMemo(
    () => pedidos.find((p) => p.id === selecionadoId) ?? null,
    [pedidos, selecionadoId]
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pedidos dos vendedores"
        description="Cestas e produtos que os vendedores pediram pelo app."
      />

      <div className="flex flex-wrap gap-2">
        {FILTROS.map((f) => (
          <button
            key={f.value}
            onClick={() => { setFiltro(f.value); setSelecionadoId(null); }}
            className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
              filtro === f.value
                ? 'bg-blue-600 border-blue-600 text-white'
                : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          {isLoading ? (
            <p className="p-6 text-sm text-gray-500">Carregando pedidos…</p>
          ) : error ? (
            <p className="p-6 text-sm text-red-600">Erro ao carregar pedidos: {mensagemErro(error)}</p>
          ) : pedidos.length === 0 ? (
            <div className="p-10 text-center text-gray-500 dark:text-gray-400">
              <ClipboardList className="w-10 h-10 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Nenhum pedido {filtro === 'pendente' ? 'aguardando' : 'neste filtro'}.</p>
            </div>
          ) : (
            <ul className="divide-y divide-gray-100 dark:divide-gray-700">
              {pedidos.map((p) => {
                const resumo = p.itens.map((i) => `${i.quantidade_solicitada}× ${i.descricao}`).join(', ');
                return (
                  <li key={p.id}>
                    <button
                      onClick={() => setSelecionadoId(p.id)}
                      className={`w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 ${
                        selecionadoId === p.id ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-medium text-gray-900 dark:text-white">
                          #{p.numero} · {p.vendedor?.nome ?? 'Vendedor'}
                        </span>
                        <span className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_CLASS[p.status]}`}>
                          {STATUS_LABEL[p.status]}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 truncate">{resumo}</p>
                      <p className="text-xs text-gray-400">{formatarData(p.created_at)}</p>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div>
          {selecionado ? (
            <PainelAtendimento key={selecionado.id} pedido={selecionado} onFechar={() => setSelecionadoId(null)} />
          ) : (
            <div className="hidden lg:block text-sm text-gray-500 dark:text-gray-400 p-6 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-center">
              Selecione um pedido para ver os itens e atender.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PedidosVendedores;
