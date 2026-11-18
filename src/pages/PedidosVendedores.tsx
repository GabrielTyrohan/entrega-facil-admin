import React, { useMemo, useState } from 'react';
import { Check, ClipboardList, Package, ShoppingBasket, X } from 'lucide-react';
import { toast } from '@/utils/toast';
import { CabecalhoPagina, Chips, Etiqueta, Vazio, cls, type ChipOpcao, type Tom } from '@/components/ui/lista';
import {
  PedidoVendedor,
  StatusPedido,
  useAtenderPedido,
  usePedidosPendentesCount,
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

const STATUS_TOM: Record<StatusPedido, Tom> = {
  pendente: 'atencao',
  aprovado: 'ok',
  parcial: 'destaque',
  recusado: 'perigo',
  cancelado: 'neutro',
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
    <div className={`${cls.card} lg:sticky lg:top-0`}>
      <div className="flex items-start justify-between gap-3 border-b border-gray-200 px-5 py-4 dark:border-gray-700">
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold text-gray-900 dark:text-white">
            Pedido #{pedido.numero} — {pedido.vendedor?.nome ?? 'Vendedor'}
          </h2>
          <p className="text-[12.5px] text-gray-500 dark:text-gray-400">Enviado em {formatarData(pedido.created_at)}</p>
        </div>
        <button onClick={onFechar} className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-white" aria-label="Fechar">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-4 px-5 py-4">
        {pedido.observacao && (
          <div className="rounded-md bg-gray-50 px-3 py-2.5 text-[13px] text-gray-700 dark:bg-gray-900/50 dark:text-gray-300">
            <span className="font-medium">Observação do vendedor: </span>
            {pedido.observacao}
          </div>
        )}

        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700">
              <th className="py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Item</th>
              <th className="py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400">Pedido</th>
              <th className="w-32 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400">{pendente ? 'Liberar' : 'Liberado'}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60">
            {pedido.itens.map((item) => (
              <tr key={item.id}>
                <td className="py-2.5">
                  <div className="flex items-center gap-2 text-[13px] text-gray-900 dark:text-white">
                    {item.tipo === 'cesta'
                      ? <ShoppingBasket className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
                      : <Package className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />}
                    <span>{item.descricao}</span>
                  </div>
                  <span className="ml-6 text-xs text-gray-500">{item.tipo === 'cesta' ? 'Cesta' : 'Produto avulso'}</span>
                </td>
                <td className="py-2.5 text-right font-mono text-[13px] tabular-nums text-gray-700 dark:text-gray-300">{item.quantidade_solicitada}</td>
                <td className="py-2.5 text-right">
                  {pendente ? (
                    <input
                      type="number"
                      min={0}
                      max={item.quantidade_solicitada}
                      step={item.tipo === 'cesta' ? 1 : 'any'}
                      value={quantidades[item.id] ?? 0}
                      onChange={(e) => setQuantidades((q) => ({ ...q, [item.id]: Number(e.target.value) }))}
                      disabled={modoRecusa || ocupado}
                      aria-label={`Quantidade a liberar de ${item.descricao}`}
                      className="h-8 w-24 rounded-md border border-gray-300 bg-white px-2 text-right font-mono text-[13px] tabular-nums focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                    />
                  ) : (
                    <span className="font-mono text-[13px] tabular-nums text-gray-700 dark:text-gray-300">{item.quantidade_atendida}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {pendente ? (
          <>
            <label className="block">
              <span className="mb-1.5 block text-[13px] font-medium text-gray-700 dark:text-gray-300">
                {modoRecusa ? 'Motivo da recusa (o vendedor verá no app) *' : 'Recado para o vendedor (opcional)'}
              </span>
              <textarea
                value={resposta}
                onChange={(e) => setResposta(e.target.value)}
                rows={2}
                maxLength={500}
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              />
            </label>

            {!modoRecusa && totalInformado > 0 && totalInformado < totalSolicitado && (
              <p className="rounded-md bg-blue-50 px-3 py-2 text-[13px] text-blue-700 dark:bg-blue-500/10 dark:text-blue-300">
                Será registrado como atendido em parte.
              </p>
            )}

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              {modoRecusa ? (
                <>
                  <button onClick={() => setModoRecusa(false)} disabled={ocupado} className={cls.btn}>
                    Voltar
                  </button>
                  <button
                    onClick={confirmarRecusa}
                    disabled={ocupado || !resposta.trim()}
                    className="inline-flex h-8 items-center justify-center rounded-md bg-red-600 px-3 text-[13px] font-medium text-white shadow-sm hover:bg-red-700 disabled:opacity-50"
                  >
                    {recusar.isPending ? 'Recusando…' : 'Confirmar recusa'}
                  </button>
                </>
              ) : (
                <>
                  <button onClick={() => setModoRecusa(true)} disabled={ocupado} className={`${cls.btn} text-red-600 dark:text-red-400`}>
                    Recusar
                  </button>
                  <button onClick={confirmarAtendimento} disabled={ocupado || totalInformado <= 0} className={cls.btnPri}>
                    <Check className="h-4 w-4" />
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
          <div className="space-y-1.5 text-[13px] text-gray-600 dark:text-gray-400">
            <p className="flex flex-wrap items-center gap-1.5">
              <Etiqueta tom={STATUS_TOM[pedido.status]}>{STATUS_LABEL[pedido.status]}</Etiqueta>
              {pedido.atendido_por_nome && <span>por {pedido.atendido_por_nome}</span>}
              {pedido.atendido_em && <span>em {formatarData(pedido.atendido_em)}</span>}
            </p>
            {pedido.resposta && <p>Recado: {pedido.resposta}</p>}
          </div>
        )}
      </div>
    </div>
  );
};

const PedidosVendedores: React.FC = () => {
  const [filtro, setFiltro] = useState<StatusPedido | 'todos'>('pendente');
  const [selecionadoId, setSelecionadoId] = useState<string | null>(null);
  const { data: pedidos = [], isLoading, error } = usePedidosVendedor(filtro);
  const { data: aguardando } = usePedidosPendentesCount();

  const selecionado = useMemo(
    () => pedidos.find((p) => p.id === selecionadoId) ?? null,
    [pedidos, selecionadoId]
  );

  const opcoes: ChipOpcao<StatusPedido | 'todos'>[] = FILTROS.map((f) => ({
    valor: f.value,
    rotulo: f.label,
    contagem: f.value === 'pendente' && aguardando ? aguardando : undefined,
  }));

  return (
    <div className="space-y-5">
      <CabecalhoPagina titulo="Pedidos dos vendedores" descricao="Cestas e produtos que os vendedores pediram pelo app. Atenda ou recuse cada pedido." />

      <Chips
        rotulo="Filtrar pedidos por situação"
        opcoes={opcoes}
        valor={filtro}
        onChange={(v) => {
          setFiltro(v);
          setSelecionadoId(null);
        }}
      />

      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-2">
        <div className={`${cls.card} overflow-hidden`}>
          {isLoading ? (
            <div className="space-y-3 p-4" aria-label="Carregando pedidos…">
              {[0, 1, 2].map((i) => (
                <div key={i} className="space-y-1.5">
                  <div className="h-3.5 w-1/3 animate-pulse rounded bg-gray-100 dark:bg-gray-700" />
                  <div className="h-3 w-2/3 animate-pulse rounded bg-gray-100 dark:bg-gray-700" />
                </div>
              ))}
            </div>
          ) : error ? (
            <p className="p-6 text-sm text-red-600">Erro ao carregar pedidos: {mensagemErro(error)}</p>
          ) : pedidos.length === 0 ? (
            <Vazio
              icone={ClipboardList}
              titulo={`Nenhum pedido ${filtro === 'pendente' ? 'aguardando' : 'neste filtro'}.`}
              texto={filtro === 'pendente' ? 'Quando um vendedor pedir cestas pelo app, o pedido aparece aqui.' : undefined}
            />
          ) : (
            <ul className="divide-y divide-gray-200 dark:divide-gray-700">
              {pedidos.map((p) => {
                const resumo = p.itens.map((i) => `${i.quantidade_solicitada}× ${i.descricao}`).join(', ');
                const ativo = selecionadoId === p.id;
                return (
                  <li key={p.id}>
                    <button
                      onClick={() => setSelecionadoId(p.id)}
                      aria-current={ativo ? 'true' : undefined}
                      className={`relative w-full px-4 py-3 text-left transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/40 ${ativo ? 'bg-blue-50/70 dark:bg-blue-500/10' : ''}`}
                    >
                      {ativo && <span aria-hidden="true" className="absolute inset-y-0 left-0 w-0.5 bg-blue-600" />}
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-[13.5px] font-medium text-gray-900 dark:text-white">
                          #{p.numero} · {p.vendedor?.nome ?? 'Vendedor'}
                        </span>
                        <Etiqueta tom={STATUS_TOM[p.status]} className="shrink-0">{STATUS_LABEL[p.status]}</Etiqueta>
                      </div>
                      <p className="truncate text-[13px] text-gray-600 dark:text-gray-400">{resumo}</p>
                      <p className="font-mono text-xs text-gray-400">{formatarData(p.created_at)}</p>
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
            <div className="hidden rounded-lg border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500 dark:border-gray-600 dark:text-gray-400 lg:block">
              Selecione um pedido para ver os itens e atender.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PedidosVendedores;
