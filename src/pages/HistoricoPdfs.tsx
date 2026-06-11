import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Download, FileText, Package, ShoppingBag, Search, Calendar, User } from 'lucide-react';
import { toast } from 'sonner';

interface NotaPdf {
  id: string;
  vendedor_nome: string;
  tipo: 'cesta' | 'avulsa';
  numero_pedido: string;
  storage_path: string;
  criado_em: string;
}

export default function HistoricoPdfs() {
  const { adminId } = useAuth();
  const [busca, setBusca] = useState('');
  const [filtroTipo, setFiltroTipo] = useState<'todos' | 'cesta' | 'avulsa'>('todos');
  const [baixando, setBaixando] = useState<string | null>(null);

  const { data: notas = [], isLoading } = useQuery<NotaPdf[]>({
    queryKey: ['notas_pdf', adminId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notas_pdf')
        .select('*')
        .order('criado_em', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!adminId,
  });

  const notasFiltradas = notas.filter((n) => {
    const matchBusca =
      busca === '' ||
      n.vendedor_nome.toLowerCase().includes(busca.toLowerCase()) ||
      n.numero_pedido.toLowerCase().includes(busca.toLowerCase());
    const matchTipo = filtroTipo === 'todos' || n.tipo === filtroTipo;
    return matchBusca && matchTipo;
  });

  const handleDownload = async (nota: NotaPdf) => {
    setBaixando(nota.id);
    try {
      const { data, error } = await supabase.storage
        .from('notas-pdf')
        .download(nota.storage_path);
      if (error || !data) throw error ?? new Error('Arquivo não encontrado');
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = nota.storage_path.split('/').pop() ?? 'nota.pdf';
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Erro ao baixar o PDF. Tente novamente.');
    } finally {
      setBaixando(null);
    }
  };

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <FileText className="w-6 h-6 text-blue-500" />
          Histórico de Notas
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          PDFs gerados de entregas de cestas e avulsas
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por vendedor ou nº pedido..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex gap-2">
          {(['todos', 'cesta', 'avulsa'] as const).map((tipo) => (
            <button
              key={tipo}
              onClick={() => setFiltroTipo(tipo)}
              className={`px-4 py-2 text-sm rounded-lg font-medium transition-colors ${
                filtroTipo === tipo
                  ? 'bg-blue-600 text-white'
                  : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              {tipo === 'todos' ? 'Todos' : tipo === 'cesta' ? 'Cestas' : 'Avulsas'}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-gray-400">
            <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full mr-3" />
            Carregando notas...
          </div>
        ) : notasFiltradas.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <FileText className="w-12 h-12 mb-3 opacity-30" />
            <p className="text-sm font-medium">Nenhuma nota encontrada</p>
            <p className="text-xs mt-1 opacity-70">
              {busca || filtroTipo !== 'todos'
                ? 'Tente ajustar os filtros'
                : 'Os PDFs gerados aparecerão aqui'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700/50">
                <tr className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  <th className="px-6 py-3 text-left font-semibold">Nº Pedido</th>
                  <th className="px-6 py-3 text-left font-semibold">
                    <span className="flex items-center gap-1"><User className="w-3 h-3" /> Vendedor</span>
                  </th>
                  <th className="px-6 py-3 text-left font-semibold">Tipo</th>
                  <th className="px-6 py-3 text-left font-semibold">
                    <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> Data</span>
                  </th>
                  <th className="px-6 py-3 text-right font-semibold">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {notasFiltradas.map((nota) => (
                  <tr key={nota.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                    <td className="px-6 py-4">
                      <span className="font-mono text-sm font-semibold text-gray-900 dark:text-white">
                        #{nota.numero_pedido}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300">
                      {nota.vendedor_nome}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                        nota.tipo === 'cesta'
                          ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                          : 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                      }`}>
                        {nota.tipo === 'cesta'
                          ? <Package className="w-3 h-3" />
                          : <ShoppingBag className="w-3 h-3" />}
                        {nota.tipo === 'cesta' ? 'Cesta' : 'Avulsa'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                      {new Date(nota.criado_em).toLocaleString('pt-BR', {
                        day: '2-digit', month: '2-digit', year: 'numeric',
                        hour: '2-digit', minute: '2-digit',
                      })}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleDownload(nota)}
                        disabled={baixando === nota.id}
                        className="inline-flex items-center gap-2 px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
                      >
                        {baixando === nota.id
                          ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          : <Download className="w-4 h-4" />}
                        {baixando === nota.id ? 'Baixando...' : 'Baixar'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!isLoading && notasFiltradas.length > 0 && (
          <div className="px-6 py-3 border-t border-gray-100 dark:border-gray-700 text-xs text-gray-400">
            {notasFiltradas.length} nota{notasFiltradas.length !== 1 ? 's' : ''} encontrada{notasFiltradas.length !== 1 ? 's' : ''}
            {busca || filtroTipo !== 'todos' ? ` (de ${notas.length} no total)` : ''}
          </div>
        )}
      </div>
    </div>
  );
}
