import React, { useMemo, useState } from 'react';
import { Check, Package, ShoppingBasket, Store, X } from 'lucide-react';
import { toast } from '@/utils/toast';
import { cls } from '@/components/ui/lista';
import { useRecusarPedido, type PedidoVendedor } from '@/hooks/usePedidosVendedor';
import {
  formatarBRL,
  useAtenderPedidoRevendedor,
  usePrecosCompraRevendedor,
  usePrecosProdutos,
} from '@/hooks/useRevendedores';

interface Props {
  pedido: PedidoVendedor;
  onFechar: () => void;
}

const FORMAS = ['Pix', 'Dinheiro', 'Boleto', 'Cartão', 'Transferência'];

function mensagemErro(e: unknown): string {
  if (e && typeof e === 'object' && 'message' in e) return String((e as { message: string }).message);
  return 'Erro desconhecido';
}

/**
 * Fase 9 — pedido de um revendedor: em vez de liberar a mercadoria, vira uma venda PJ para o CNPJ dele.
 * Cesta sai pelo valor dos produtos dela (X); avulso pelo preço de venda do produto.
 * O preço final é calculado pelo banco; aqui é só a prévia.
 */
const PainelPedidoRevendedor: React.FC<Props> = ({ pedido, onFechar }) => {
  const atender = useAtenderPedidoRevendedor();
  const recusar = useRecusarPedido();
  const { data: precos } = usePrecosCompraRevendedor(pedido.vendedor_id);
  const idsAvulsos = useMemo(
    () => pedido.itens.filter((i) => i.tipo !== 'cesta' && i.produto_cadastrado_id).map((i) => i.produto_cadastrado_id!),
    [pedido.itens]
  );
  const { data: precosAvulsos = {} } = usePrecosProdutos(idsAvulsos);

  const [quantidades, setQuantidades] = useState<Record<string, number>>(
    () => Object.fromEntries(pedido.itens.map((i) => [i.id, i.quantidade_solicitada]))
  );
  const [resposta, setResposta] = useState('');
  const [modoRecusa, setModoRecusa] = useState(false);
  const [pago, setPago] = useState(false);
  const [forma, setForma] = useState('Pix');
  const pendente = pedido.status === 'pendente';
  const ocupado = atender.isPending || recusar.isPending;

  const precoUnit = (item: PedidoVendedor['itens'][number]): number | null => {
    if (item.tipo === 'cesta') {
      const c = precos?.cestas.find((x) => x.cesta_id === item.cesta_id);
      return c ? c.preco_compra : null;
    }
    return item.produto_cadastrado_id ? precosAvulsos[item.produto_cadastrado_id] ?? null : null;
  };
  const sugerido = (item: PedidoVendedor['itens'][number]) =>
    item.tipo === 'cesta' ? precos?.cestas.find((x) => x.cesta_id === item.cesta_id)?.preco_sugerido ?? null : null;

  const total = pedido.itens.reduce((s, i) => s + (Number(quantidades[i.id]) || 0) * (precoUnit(i) ?? 0), 0);
  const totalInformado = Object.values(quantidades).reduce((a, b) => a + (Number(b) || 0), 0);

  const confirmar = async () => {
    try {
      const res = await atender.mutateAsync({
        pedidoId: pedido.id,
        itens: pedido.itens.map((i) => ({ item_id: i.id, quantidade: Number(quantidades[i.id]) || 0 })),
        venda: pago
          ? { status_pagamento: 'pago', pago: true, valor_pago: Math.round(total * 100) / 100, forma_pagamento: forma, data_pagamento: new Date().toISOString().slice(0, 10) }
          : { status_pagamento: 'pendente', pago: false, valor_pago: 0, forma_pagamento: forma },
        resposta: resposta.trim() || undefined,
      });
      toast.success(`Venda #${res.venda.numero_pedido} criada: ${formatarBRL(res.venda.valor_total)}`);
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
          <h2 className="flex items-center gap-2 text-[15px] font-semibold text-gray-900 dark:text-white">
            <Store className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            Pedido #{pedido.numero} — {pedido.vendedor?.nome ?? 'Revendedor'}
          </h2>
          <p className="text-[12.5px] text-gray-500 dark:text-gray-400">Revendedor: o pedido vira uma venda PJ para o CNPJ dele.</p>
        </div>
        <button onClick={onFechar} className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-white" aria-label="Fechar">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-4 px-5 py-4">
        {pedido.observacao && (
          <div className="rounded-md bg-gray-50 px-3 py-2.5 text-[13px] text-gray-700 dark:bg-gray-900/50 dark:text-gray-300">
            <span className="font-medium">Observação do revendedor: </span>
            {pedido.observacao}
          </div>
        )}

        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700">
              <th className="py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Item</th>
              <th className="py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400">Preço</th>
              <th className="py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400">Pedido</th>
              <th className="w-24 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400">{pendente ? 'Vender' : 'Vendido'}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60">
            {pedido.itens.map((item) => {
              const preco = precoUnit(item);
              const y = sugerido(item);
              return (
                <tr key={item.id}>
                  <td className="py-2.5">
                    <div className="flex items-center gap-2 text-[13px] text-gray-900 dark:text-white">
                      {item.tipo === 'cesta'
                        ? <ShoppingBasket className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
                        : <Package className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />}
                      <span>{item.descricao}</span>
                    </div>
                    {y != null && (
                      <span className="ml-6 text-xs text-gray-500">Revenda sugerida {formatarBRL(y)}</span>
                    )}
                  </td>
                  <td className="py-2.5 text-right font-mono text-[13px] tabular-nums text-gray-700 dark:text-gray-300">
                    {preco == null ? '—' : formatarBRL(preco)}
                  </td>
                  <td className="py-2.5 text-right font-mono text-[13px] tabular-nums text-gray-700 dark:text-gray-300">{item.quantidade_solicitada}</td>
                  <td className="py-2.5 text-right">
                    {pendente ? (
                      <input
                        type="number"
                        min={0}
                        max={item.quantidade_solicitada}
                        step={1}
                        value={quantidades[item.id] ?? 0}
                        onChange={(e) => setQuantidades((q) => ({ ...q, [item.id]: Math.trunc(Number(e.target.value)) }))}
                        disabled={modoRecusa || ocupado}
                        aria-label={`Quantidade a vender de ${item.descricao}`}
                        className="h-8 w-20 rounded-md border border-gray-300 bg-white px-2 text-right font-mono text-[13px] tabular-nums focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                      />
                    ) : (
                      <span className="font-mono text-[13px] tabular-nums text-gray-700 dark:text-gray-300">{item.quantidade_atendida}</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {pendente ? (
          <>
            {!modoRecusa && (
              <div className="space-y-3 rounded-md border border-gray-200 p-3 dark:border-gray-700">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Total da venda (prévia)</span>
                  <span className="font-mono font-semibold tabular-nums text-gray-900 dark:text-white">{formatarBRL(total)}</span>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-[13px]">
                  <label className="inline-flex items-center gap-1.5">
                    <input type="radio" name="pagamento" checked={!pago} onChange={() => setPago(false)} disabled={ocupado} />
                    A prazo (fica devendo)
                  </label>
                  <label className="inline-flex items-center gap-1.5">
                    <input type="radio" name="pagamento" checked={pago} onChange={() => setPago(true)} disabled={ocupado} />
                    Pago agora
                  </label>
                  <select
                    value={forma}
                    onChange={(e) => setForma(e.target.value)}
                    disabled={ocupado}
                    aria-label="Forma de pagamento"
                    className="h-8 rounded-md border border-gray-300 bg-white px-2 text-[13px] dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                  >
                    {FORMAS.map((f) => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
              </div>
            )}

            <label className="block">
              <span className="mb-1.5 block text-[13px] font-medium text-gray-700 dark:text-gray-300">
                {modoRecusa ? 'Motivo da recusa (o revendedor verá no app) *' : 'Recado para o revendedor (opcional)'}
              </span>
              <textarea
                value={resposta}
                onChange={(e) => setResposta(e.target.value)}
                rows={2}
                maxLength={500}
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              />
            </label>

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              {modoRecusa ? (
                <>
                  <button onClick={() => setModoRecusa(false)} disabled={ocupado} className={cls.btn}>Voltar</button>
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
                  <button onClick={confirmar} disabled={ocupado || totalInformado <= 0} className={cls.btnPri}>
                    <Check className="h-4 w-4" />
                    {atender.isPending ? 'Criando venda…' : 'Atender como venda'}
                  </button>
                </>
              )}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              A venda dá baixa no estoque geral e a mercadoria vai para o estoque do revendedor na próxima
              sincronização do app. O valor final é calculado na hora pelo preço atual dos produtos.
              A venda aparece em Vendas PJ, onde dá para registrar pagamentos.
            </p>
          </>
        ) : (
          <div className="space-y-1.5 text-[13px] text-gray-600 dark:text-gray-400">
            {pedido.atendido_por_nome && <p>Atendido por {pedido.atendido_por_nome}</p>}
            {pedido.resposta && <p>Recado: {pedido.resposta}</p>}
          </div>
        )}
      </div>
    </div>
  );
};

export default PainelPedidoRevendedor;
