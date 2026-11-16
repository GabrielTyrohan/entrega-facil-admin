import React, { useMemo, useState } from 'react';
import { Undo2 } from 'lucide-react';
import PageHeader from '@/components/layout/PageHeader';
import { formatCurrency } from '@/utils/currencyUtils';
import { useDevolucoes } from '@/hooks/useDevolucoes';

const dataBR = (iso: string | null) => {
  if (!iso) return '—';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
};

const Devolucoes: React.FC = () => {
  const { data = [], isLoading, error } = useDevolucoes();
  const [filtro, setFiltro] = useState<'todas' | 'credito' | 'troca'>('todas');

  const lista = useMemo(() => {
    if (filtro === 'credito') return data.filter((d) => d.credito_restante > 0);
    if (filtro === 'troca') return data.filter((d) => d.trocas.length > 0);
    return data;
  }, [data, filtro]);

  const creditoAberto = data.reduce((a, d) => a + d.credito_restante, 0);
  const qtdTrocas = data.filter((d) => d.trocas.length > 0).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Devoluções e trocas"
        description="Feitas pelos vendedores no app, com conferência dos itens. O que o cliente já tinha pago vira crédito; na troca, vai para a entrega nova."
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">Devoluções</p>
          <p className="text-2xl font-semibold text-gray-900 dark:text-white tabular-nums">{data.length}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">Viraram troca</p>
          <p className="text-2xl font-semibold text-gray-900 dark:text-white tabular-nums">{qtdTrocas}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">Crédito de clientes em aberto</p>
          <p className="text-2xl font-semibold text-gray-900 dark:text-white tabular-nums">{formatCurrency(creditoAberto)}</p>
        </div>
      </div>

      <div className="flex gap-2">
        {([
          ['todas', 'Todas'],
          ['credito', 'Com crédito'],
          ['troca', 'Trocas'],
        ] as const).map(([k, rotulo]) => (
          <button
            key={k}
            onClick={() => setFiltro(k)}
            className={`px-3 py-1.5 text-sm rounded-lg border ${
              filtro === k
                ? 'bg-blue-600 text-white border-blue-600'
                : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
          >
            {rotulo}
          </button>
        ))}
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-x-auto">
        {isLoading ? (
          <p className="p-6 text-sm text-gray-500">Carregando…</p>
        ) : error ? (
          <p className="p-6 text-sm text-red-600">Erro ao carregar as devoluções.</p>
        ) : lista.length === 0 ? (
          <div className="p-10 text-center text-gray-500 dark:text-gray-400">
            <Undo2 className="w-10 h-10 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Nenhuma devolução {filtro !== 'todas' ? 'neste filtro' : 'registrada'}.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                <th className="px-4 py-3 font-medium">Devolvida em</th>
                <th className="px-4 py-3 font-medium">Cliente</th>
                <th className="px-4 py-3 font-medium">Vendedor</th>
                <th className="px-4 py-3 font-medium">Cesta</th>
                <th className="px-4 py-3 font-medium text-right">Valor</th>
                <th className="px-4 py-3 font-medium text-right">Crédito restante</th>
                <th className="px-4 py-3 font-medium">Troca</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((d) => (
                <tr key={d.id} className="border-b border-gray-100 dark:border-gray-700/60">
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{dataBR(d.devolvida_em)}</td>
                  <td className="px-4 py-3 text-gray-900 dark:text-white">
                    {d.cliente ? `${d.cliente.nome} ${d.cliente.sobrenome ?? ''}`.trim() : '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{d.vendedor?.nome ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{d.cesta ?? '—'}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatCurrency(d.valor)}</td>
                  <td className={`px-4 py-3 text-right tabular-nums font-medium ${d.credito_restante > 0 ? 'text-amber-600' : 'text-gray-500'}`}>
                    {formatCurrency(d.credito_restante)}
                  </td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                    {d.trocas.length === 0
                      ? '—'
                      : d.trocas.map((t) => (
                          <div key={t.id}>
                            {dataBR(t.data_entrega)} · {formatCurrency(t.valor)}
                            {t.credito_movido > 0 && (
                              <span className="text-green-600"> (crédito {formatCurrency(t.credito_movido)})</span>
                            )}
                          </div>
                        ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default Devolucoes;
