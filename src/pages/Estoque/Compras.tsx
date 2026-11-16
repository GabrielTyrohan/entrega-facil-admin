import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FileUp, Plus, ShoppingCart } from 'lucide-react';
import PageHeader from '@/components/layout/PageHeader';
import { formatCurrency } from '@/utils/currencyUtils';
import { useCompras } from '@/hooks/useCompras';

const dataBR = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
};

const ORIGEM: Record<string, string> = { manual: 'Manual', xml: 'XML da nota', contora: 'SEFAZ' };

const Compras: React.FC = () => {
  const navigate = useNavigate();
  const { data: compras = [], isLoading, error } = useCompras();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Compras"
        description="Entrada no estoque do que foi comprado nos mercados/fornecedores."
        actions={
          <button
            onClick={() => navigate('/estoque/compras/nova')}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
          >
            <Plus className="w-4 h-4" /> Lançar compra
          </button>
        }
      />

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-x-auto">
        {isLoading ? (
          <p className="p-6 text-sm text-gray-500">Carregando compras…</p>
        ) : error ? (
          <p className="p-6 text-sm text-red-600">Erro ao carregar compras.</p>
        ) : compras.length === 0 ? (
          <div className="p-10 text-center text-gray-500 dark:text-gray-400">
            <ShoppingCart className="w-10 h-10 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Nenhuma compra lançada ainda.</p>
            <button
              onClick={() => navigate('/estoque/compras/nova')}
              className="mt-3 inline-flex items-center gap-2 text-sm text-blue-600 hover:underline"
            >
              <FileUp className="w-4 h-4" /> Lançar a primeira compra
            </button>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                <th className="px-4 py-3 font-medium">Entrada</th>
                <th className="px-4 py-3 font-medium">Fornecedor</th>
                <th className="px-4 py-3 font-medium">Nota</th>
                <th className="px-4 py-3 font-medium text-right">Itens</th>
                <th className="px-4 py-3 font-medium text-right">Valor</th>
                <th className="px-4 py-3 font-medium">Origem</th>
                <th className="px-4 py-3 font-medium">Lançado por</th>
              </tr>
            </thead>
            <tbody>
              {compras.map((c) => (
                <tr key={c.id} className="border-b border-gray-100 dark:border-gray-700/60">
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{dataBR(c.data_entrada)}</td>
                  <td className="px-4 py-3 text-gray-900 dark:text-white">{c.fornecedor_nome}</td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{c.numero_nota ?? '—'}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{c.itens?.length ?? 0}</td>
                  <td className="px-4 py-3 text-right font-medium tabular-nums">{formatCurrency(Number(c.valor_total))}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{ORIGEM[c.origem] ?? c.origem}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{c.criado_por_nome ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default Compras;
