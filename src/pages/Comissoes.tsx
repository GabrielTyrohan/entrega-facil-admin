import React from 'react';
import { BadgePercent, CheckCircle2, Lock } from 'lucide-react';
import PageHeader from '@/components/layout/PageHeader';
import { toast } from '@/utils/toast';
import { formatCurrency } from '@/utils/currencyUtils';
import {
  ComissaoCalculo,
  useComissoesVendedores,
  useFecharPeriodo,
  useFechamentos,
  useMarcarComissaoPaga,
} from '@/hooks/useComissoes';

const dataBR = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
};

const janela = (c: ComissaoCalculo) => `${dataBR(c.periodo_inicio)} a ${dataBR(c.periodo_fim)}`;

function mensagemErro(e: unknown): string {
  if (e && typeof e === 'object' && 'message' in e) return String((e as { message: string }).message);
  return 'Erro desconhecido';
}

const StatusPeriodo: React.FC<{ c: ComissaoCalculo }> = ({ c }) => {
  if (c.status === 'pago')
    return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">Paga</span>;
  if (c.status === 'fechado')
    return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">Fechada, a pagar</span>;
  if (c.encerrado)
    return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300">Aguardando fechamento</span>;
  return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300">Em andamento</span>;
};

const Comissoes: React.FC = () => {
  const { data: resumo = [], isLoading, error } = useComissoesVendedores();
  const { data: fechamentos = [] } = useFechamentos();
  const fechar = useFecharPeriodo();
  const marcarPaga = useMarcarComissaoPaga();

  const onFechar = async (vendedorNome: string, vendedorId: string, c: ComissaoCalculo) => {
    const ok = window.confirm(
      `Fechar a comissão de ${vendedorNome} (${janela(c)})?\n\n` +
      `Valor: ${formatCurrency(c.valor_comissao)} (${c.percentual}% de ${formatCurrency(c.base_calculo)}).\n` +
      'Depois de fechado, o valor não muda.'
    );
    if (!ok) return;
    try {
      await fechar.mutateAsync({ vendedorId, periodoInicio: c.periodo_inicio });
      toast.success('Período fechado');
    } catch (e) {
      toast.error('Não foi possível fechar: ' + mensagemErro(e));
    }
  };

  const onPagar = async (fechamentoId: string) => {
    if (!window.confirm('Marcar esta comissão como paga ao vendedor?')) return;
    try {
      await marcarPaga.mutateAsync(fechamentoId);
      toast.success('Comissão marcada como paga');
    } catch (e) {
      toast.error('Não foi possível marcar: ' + mensagemErro(e));
    }
  };

  const ocupado = fechar.isPending || marcarPaga.isPending;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Comissões dos vendedores"
        description="Percentual de cada vendedor sobre o que ele recebeu dos clientes na janela de cobrança."
      />

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-x-auto">
        {isLoading ? (
          <p className="p-6 text-sm text-gray-500">Calculando comissões…</p>
        ) : error ? (
          <p className="p-6 text-sm text-red-600">Erro ao carregar: {mensagemErro(error)}</p>
        ) : resumo.length === 0 ? (
          <div className="p-10 text-center text-gray-500 dark:text-gray-400">
            <BadgePercent className="w-10 h-10 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Nenhum vendedor ativo.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                <th className="px-4 py-3 font-medium">Vendedor</th>
                <th className="px-4 py-3 font-medium">Período anterior</th>
                <th className="px-4 py-3 font-medium text-right">Comissão</th>
                <th className="px-4 py-3 font-medium">Situação</th>
                <th className="px-4 py-3 font-medium">Período atual (prévia)</th>
                <th className="px-4 py-3 font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {resumo.map(({ vendedor, atual, anterior }) => (
                <tr key={vendedor.id} className="border-b border-gray-100 dark:border-gray-700/60 align-top">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900 dark:text-white">{vendedor.nome}</div>
                    <div className="text-xs text-gray-500">
                      {vendedor.comissao_percentual}% · fecha dia {vendedor.dia_fechamento ?? 1}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                    <div>{janela(anterior)}</div>
                    <div className="text-xs text-gray-500">
                      Recebido {formatCurrency(anterior.total_recebido)}
                      {anterior.ajustes > 0 && <> + ajustes {formatCurrency(anterior.ajustes)}</>}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums text-gray-900 dark:text-white">
                    {formatCurrency(anterior.valor_comissao)}
                  </td>
                  <td className="px-4 py-3"><StatusPeriodo c={anterior} /></td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                    <div>{janela(atual)}</div>
                    <div className="text-xs text-gray-500">
                      Recebido {formatCurrency(atual.total_recebido)} → {formatCurrency(atual.valor_comissao)}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    {anterior.status === 'aberto' && anterior.encerrado && (
                      <button
                        onClick={() => onFechar(vendedor.nome, vendedor.id, anterior)}
                        disabled={ocupado}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                      >
                        <Lock className="w-3.5 h-3.5" /> Fechar período
                      </button>
                    )}
                    {anterior.status === 'fechado' && anterior.fechamento_id && (
                      <button
                        onClick={() => onPagar(anterior.fechamento_id!)}
                        disabled={ocupado}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" /> Marcar paga
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Histórico de fechamentos</h2>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-x-auto">
          {fechamentos.length === 0 ? (
            <p className="p-6 text-sm text-gray-500 dark:text-gray-400">Nenhum período fechado ainda.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                  <th className="px-4 py-3 font-medium">Vendedor</th>
                  <th className="px-4 py-3 font-medium">Período</th>
                  <th className="px-4 py-3 font-medium text-right">Base</th>
                  <th className="px-4 py-3 font-medium text-right">%</th>
                  <th className="px-4 py-3 font-medium text-right">Comissão</th>
                  <th className="px-4 py-3 font-medium">Situação</th>
                  <th className="px-4 py-3 font-medium text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {fechamentos.map((f) => (
                  <tr key={f.id} className="border-b border-gray-100 dark:border-gray-700/60">
                    <td className="px-4 py-3 text-gray-900 dark:text-white">{f.vendedor?.nome ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                      {dataBR(f.periodo_inicio)} a {dataBR(f.periodo_fim)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{formatCurrency(Number(f.base_calculo))}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{Number(f.percentual)}%</td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums">{formatCurrency(Number(f.valor_comissao))}</td>
                    <td className="px-4 py-3 text-xs text-gray-600 dark:text-gray-400">
                      {f.status === 'pago'
                        ? <>Paga{f.pago_em && ` em ${dataBR(f.pago_em)}`}{f.pago_por_nome && ` por ${f.pago_por_nome}`}</>
                        : <>Fechada em {dataBR(f.fechado_em)}{f.fechado_por_nome && ` por ${f.fechado_por_nome}`}</>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {f.status === 'fechado' && (
                        <button
                          onClick={() => onPagar(f.id)}
                          disabled={ocupado}
                          className="text-xs font-medium text-green-700 dark:text-green-400 hover:underline disabled:opacity-50"
                        >
                          Marcar paga
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

export default Comissoes;
