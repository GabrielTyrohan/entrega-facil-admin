import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/Skeleton";
import { AlertCircle, ArrowLeft, CheckCircle2, Edit, Filter, LayoutGrid, Loader2, MoreHorizontal, PackagePlus, Plus, Search, Share2, Trash2, X } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useCestasBase, useDeleteCestaBase, useDistribuirCestaBase } from '../hooks/useCestasBase';
import { useVendedoresByAdmin } from '../hooks/useVendedores';
import { CestaBase } from '../services/cestaBaseService';
import { formatCurrency } from '../utils/currencyUtils';
import { toast } from '../utils/toast';

const CestasBase: React.FC = () => {
  const navigate = useNavigate();
  const { user, adminId } = useAuth();
  const targetId = adminId || user?.id;

  const { data: cestas = [], isLoading, error } = useCestasBase(targetId);
  const deleteCestaBaseMutation = useDeleteCestaBase();
  const distribuirCestaBaseMutation = useDistribuirCestaBase();
  
  const { data: vendedoresRaw = [], isLoading: loadingVendedores } = useVendedoresByAdmin(targetId || '', {
    enabled: !!targetId
  });
  
  // Assegurar tipo
  const vendedores = vendedoresRaw as any[];

  // filteredCestas is now derived via useMemo — no useState needed
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('todos');
  
  const [cestaParaExcluir, setCestaParaExcluir] = useState<CestaBase | null>(null);
  
  const [modalDistribuir, setModalDistribuir] = useState<{
    cestaId: string;
    cestaNome: string;
  } | null>(null);
  const [vendedorSelecionado, setVendedorSelecionado] = useState<string>('');

  // ✅ useMemo: derived state — no setState, no render loop
  const filteredCestas = useMemo(() => {
    let filtered = cestas;

    if (statusFilter !== 'todos') {
      const isAtivo = statusFilter === 'ativo';
      filtered = filtered.filter(cesta => cesta.ativo === isAtivo);
    }

    if (searchTerm) {
      filtered = filtered.filter(cesta =>
        cesta.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        cesta.descricao?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    return filtered;
  }, [cestas, searchTerm, statusFilter]);

  const handleEditCesta = (cesta: CestaBase) => {
    navigate(`/produtos/cestas-base/editar/${cesta.id}`);
  };

  const handleDeleteCesta = async () => {
    if (!cestaParaExcluir) return;
    try {
      await deleteCestaBaseMutation.mutateAsync(cestaParaExcluir.id);
      toast.success('Cesta Base excluída com sucesso!');
      setCestaParaExcluir(null);
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao excluir a cesta base. Tente novamente.');
    }
  };

  const handleDistribuir = async () => {
    if (!modalDistribuir || !vendedorSelecionado) return;
    const vendedor = vendedores.find(v => v.id === vendedorSelecionado);
    try {
      await distribuirCestaBaseMutation.mutateAsync({
        cestaBaseId: modalDistribuir.cestaId,
        vendedorId: vendedorSelecionado
      });
      toast.success(`Cesta distribuída para ${vendedor?.nome || 'o vendedor'}`);
      setModalDistribuir(null);
      setVendedorSelecionado('');
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao distribuir cesta base.');
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6 p-4 sm:p-6">
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
                {[...Array(5)].map((_, i) => (
                  <tr key={i}>
                    <td className="px-6 py-4 whitespace-nowrap"><Skeleton className="h-4 w-32" /></td>
                    <td className="px-6 py-4 whitespace-nowrap"><Skeleton className="h-4 w-48" /></td>
                    <td className="px-6 py-4 whitespace-nowrap"><Skeleton className="h-4 w-24" /></td>
                    <td className="px-6 py-4 whitespace-nowrap"><Skeleton className="h-6 w-16 rounded-full" /></td>
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

  return (
    <div className="space-y-6 p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Cadastrar Cestas</h1>
          <p className="text-gray-600 dark:text-gray-400">Modelos de cestas para distribuição aos vendedores</p>
        </div>
        <div className="flex items-center space-x-3">
          <button 
            onClick={() => navigate('/produtos/cestas')}
            className="bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-white px-4 py-2 rounded-lg font-medium flex items-center space-x-2 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Emitir Cesta</span>
          </button>
          <button 
            onClick={() => navigate('/produtos/cestas-base/nova')}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium flex items-center space-x-2 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Novo Modelo</span>
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex-1 max-w-md">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar por nome ou descrição..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
              />
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <Filter className="w-4 h-4 text-gray-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
            >
              <option value="todos">Todos os Status</option>
              <option value="ativo">Ativos</option>
              <option value="inativo">Inativos</option>
            </select>
          </div>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex">
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5 mr-3" />
            <div>
              <h3 className="text-sm font-medium text-red-800 dark:text-red-200">Erro ao carregar cestas base</h3>
              <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                {error.message || 'Ocorreu um erro inesperado. Tente novamente.'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Lista */}
      {!isLoading && !error && filteredCestas.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Nome</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Descrição</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Preço Sugerido</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Itens</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Ações</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {filteredCestas.map((cesta, index) => (
                  <tr
                    key={cesta.id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700 animate-fade-in-up"
                    style={{ animationDelay: `${index * 75}ms` }}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="h-10 w-10 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 mr-4">
                          <LayoutGrid className="w-5 h-5" />
                        </div>
                        <div className="text-sm font-medium text-gray-900 dark:text-white">{cesta.nome}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-500 dark:text-gray-400 truncate max-w-[200px]">
                        {cesta.descricao || '-'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                      {formatCurrency(cesta.preco)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">
                        {cesta.cestas_base_itens?.length || 0}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        cesta.ativo ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400' : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
                      }`}>
                        {cesta.ativo ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-lg transition-colors">
                            <MoreHorizontal className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEditCesta(cesta)}>
                            <Edit className="w-4 h-4 mr-2" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setModalDistribuir({
                            cestaId: cesta.id,
                            cestaNome: cesta.nome
                          })}>
                            <Share2 className="w-4 h-4 mr-2 text-indigo-500" />
                            Distribuir
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => setCestaParaExcluir(cesta)}
                            className="text-red-600 dark:text-red-400"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
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
            <div className="mx-auto w-16 h-16 bg-indigo-50 dark:bg-indigo-900/20 rounded-full flex items-center justify-center mb-4">
              <PackagePlus className="w-8 h-8 text-indigo-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Nenhum modelo encontrado</h3>
            <p className="text-gray-500 dark:text-gray-400 mb-6">
              {searchTerm || statusFilter !== 'todos'
                ? 'Tente ajustar os filtros de busca.'
                : 'Crie modelos de cestas para distribuir aos seus vendedores.'
              }
            </p>
            {!searchTerm && statusFilter === 'todos' && (
              <button
                onClick={() => navigate('/produtos/cestas-base/nova')}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium flex items-center space-x-2 transition-colors mx-auto"
              >
                <Plus className="w-4 h-4" />
                <span>Criar Primeiro Modelo</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Modal Distribuir */}
      {modalDistribuir && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
                  <Share2 size={20} className="text-indigo-600 dark:text-indigo-400" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 dark:text-white">Distribuir Cesta</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{modalDistribuir.cestaNome}</p>
                </div>
              </div>
              <button onClick={() => setModalDistribuir(null)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
                <X size={20} className="text-gray-500" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Selecione o Vendedor *
                </label>
                <select
                  value={vendedorSelecionado}
                  onChange={(e) => setVendedorSelecionado(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  disabled={loadingVendedores}
                >
                  <option value="">
                    {loadingVendedores ? 'Carregando vendedores...' : 'Selecione um vendedor...'}
                  </option>
                  {vendedores.filter(v => v.ativo).map(vendedor => (
                    <option key={vendedor.id} value={vendedor.id}>
                      {vendedor.nome}
                    </option>
                  ))}
                </select>
              </div>
              <div className="bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-lg border border-yellow-200 dark:border-yellow-800">
                <p className="text-sm text-yellow-800 dark:text-yellow-200 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 mt-0.5" />
                  Isso irá criar uma cópia desta cesta base (com todos os itens associados e preços atuais) e atribuí-la diretamente ao vendedor selecionado.
                </p>
              </div>
            </div>
            <div className="flex gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
              <button 
                onClick={() => setModalDistribuir(null)} 
                className="flex-1 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleDistribuir}
                disabled={distribuirCestaBaseMutation.isPending || !vendedorSelecionado}
                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                {distribuirCestaBaseMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><CheckCircle2 size={16} /> Confirmar</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmação de Exclusão */}
      {cestaParaExcluir && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-lg w-full">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Confirmar exclusão</h2>
              <button onClick={() => setCestaParaExcluir(null)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
                <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-gray-700 dark:text-gray-300">
                Tem certeza que deseja excluir a cesta base
                <span className="font-semibold"> {cestaParaExcluir.nome}</span>?
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Esta ação removerá o modelo de cesta. Cestas de vendedores que já foram distribuídas a partir desta não serão afetadas.
              </p>
              <div className="mt-6 flex justify-end gap-3">
                <button 
                  onClick={() => setCestaParaExcluir(null)} 
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleDeleteCesta}
                  disabled={deleteCestaBaseMutation.isPending}
                  className="bg-red-600 hover:bg-red-700 disabled:bg-red-600/60 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
                >
                  {deleteCestaBaseMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  <span>Excluir</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CestasBase;
