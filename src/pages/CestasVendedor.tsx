import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/Skeleton";
import { toast } from '@/utils/toast';
import { AlertCircle, AlertTriangle, Calendar, CheckCircle2, Edit, Eye, Filter, Loader2, MoreHorizontal, Package, PackagePlus, Plus, Search, ShoppingBasket, Trash2, User, X } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { CestaData, useCestaDetalhes, useCestas, useEntregarCestas } from '../hooks/useCestas';
import { supabase } from '../lib/supabase'; // ← NOVO
import { CestaService } from '../services/cestaService';

type Cesta = CestaData;

const CestasVendedor: React.FC = () => {
  const navigate = useNavigate();
  const { user, adminId } = useAuth();
  const entregarCestasMutation = useEntregarCestas();
  
  const { data: cestas = [], isLoading, error, refetch } = useCestas();
  const [filteredCestas, setFilteredCestas] = useState<Cesta[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('todos');
  const [selectedCesta, setSelectedCesta] = useState<Cesta | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [cestaParaExcluir, setCestaParaExcluir] = useState<Cesta | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [modalEntrega, setModalEntrega] = useState<{ 
    cestaId: string; 
    cestaNome: string; 
    vendedorId: string;
    quantidadeAtual: number;
  } | null>(null);
  const [qtdEntrega, setQtdEntrega] = useState(1);
  const [obsEntrega, setObsEntrega] = useState('');

  const { data: detalhesCesta } = useCestaDetalhes(
    modalEntrega?.cestaId || '',
    { enabled: !!modalEntrega?.cestaId }
  );

  useEffect(() => {
    let filtered = cestas;

    if (statusFilter !== 'todos') {
      filtered = filtered.filter(cesta => cesta.status === statusFilter);
    }

    if (searchTerm) {
      filtered = filtered.filter(cesta =>
        cesta.vendedor_nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        cesta.cesta_nome?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    setFilteredCestas(prev => {
      if (JSON.stringify(prev) === JSON.stringify(filtered)) return prev;
      return filtered;
    });
  }, [cestas, searchTerm, statusFilter]);

  const handleViewCesta = (cesta: Cesta) => {
    setSelectedCesta(cesta);
    setShowModal(true);
  };

  const handleEditCesta = (cesta: Cesta) => {
    if (!adminId && !user?.id) {
      toast.error('Você não tem permissão para editar esta cesta.');
      return;
    }
    navigate(`/produtos/cestas/editar/${cesta.id}`);
  };

  const handleDeleteCesta = async () => {
    if (!cestaParaExcluir) return;
    setIsDeleting(true);
    try {
      await CestaService.deleteCesta(cestaParaExcluir.id);
      toast.success('Cesta excluída com sucesso!');
      setCestaParaExcluir(null);
      await refetch();
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao excluir a cesta. Tente novamente.');
    } finally {
      setIsDeleting(false);
    }
  };

  const solicitarExclusaoCesta = (cesta: Cesta) => {
    setCestaParaExcluir(cesta);
  };

  const handleConfirmarEntrega = async () => {
    if (!modalEntrega || qtdEntrega <= 0) return;
    try {
      await entregarCestasMutation.mutateAsync({
        administrador_id: adminId || user?.id || '',
        vendedor_id: modalEntrega.vendedorId,
        cesta_id: modalEntrega.cestaId,
        quantidade: qtdEntrega,
        usuario_id: user?.id,
        usuario_nome: user?.email,
        observacao: obsEntrega || undefined,
      });

      // Atualizar o estoque do vendedor somando a quantidade entregue
      const novoEstoque = modalEntrega.quantidadeAtual + qtdEntrega;
      await supabase
        .from('estoque_vendedor')
        .upsert(
          {
            vendedor_id: modalEntrega.vendedorId,
            produto_id: modalEntrega.cestaId,
            quantidade_disponivel: novoEstoque,
            administrador_id: adminId || user?.id,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'vendedor_id,produto_id' }
        );

      toast.success(`${qtdEntrega} cesta(s) entregue(s) e estoque atualizado para ${novoEstoque}!`);
      setModalEntrega(null);
      setQtdEntrega(1);
      setObsEntrega('');
      await refetch();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao registrar entrega.');
    }
  };



  const getStatusColor = (status: string) => {
    switch (status) {
      case 'em_uso': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400';
      case 'entregue': return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400';
      case 'retornada': return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'em_uso': return 'Em Uso';
      case 'entregue': return 'Entregue';
      case 'retornada': return 'Retornada';
      default: return status;
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedCesta(null);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric'
    });
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
                {[...Array(8)].map((_, i) => (
                  <tr key={i}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <Skeleton className="h-10 w-10 rounded-full mr-4" />
                        <div className="space-y-1">
                          <Skeleton className="h-4 w-32" />
                          <Skeleton className="h-3 w-24" />
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <Skeleton className="w-4 h-4 mr-2" />
                        <Skeleton className="h-4 w-24" />
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap"><Skeleton className="h-4 w-32" /></td>
                    <td className="px-6 py-4 whitespace-nowrap"><Skeleton className="h-4 w-24" /></td>
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Cestas do Vendedor</h1>
          <p className="text-gray-600 dark:text-gray-400">Gerencie as cestas de produtos dos vendedores</p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={() => navigate('/produtos/cestas-base')}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 gap-2 py-2 rounded-lg font-medium flex items-center space-x-2 transition-colors"
          >
            <PackagePlus className="w-4 h-4" />
            Cestas Base
          </button>
          <button 
            onClick={() => navigate('/produtos/cestas/nova')}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium flex items-center space-x-2 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Nova Cesta</span>
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0 md:space-x-4">
          <div className="flex-1 max-w-md">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar por vendedor ou nome da cesta..."
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
              <option value="em_uso">Em Uso</option>
              <option value="entregue">Entregue</option>
              <option value="retornada">Retornada</option>
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
              <h3 className="text-sm font-medium text-red-800 dark:text-red-200">Erro ao carregar cestas</h3>
              <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                {error.message || 'Ocorreu um erro inesperado. Tente novamente.'}
              </p>
              <button onClick={() => refetch()} className="mt-2 text-sm text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200 underline">
                Tentar novamente
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lista de Cestas */}
      {!isLoading && !error && filteredCestas.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Vendedor</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Data de Montagem</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Itens</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Valor Total</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Entregas</th>
                  {/* ← NOVO cabeçalho */}
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Estoque Mobile</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
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
                        <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold mr-4">
                          {cesta.vendedor_nome.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="text-sm font-medium text-gray-900 dark:text-white">{cesta.vendedor_nome}</div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">{cesta.cesta_nome}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center text-sm text-gray-900 dark:text-white">
                        <Calendar className="w-4 h-4 mr-2 text-gray-400" />
                        {formatDate(cesta.data_montagem)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {cesta.itens.length} produtos diferentes
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      R$ {(cesta.valor_total || 0).toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        {cesta.entregas_realizadas || 0}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {(() => {
                        const qtd = cesta.quantidade_disponivel;
                        if (qtd === null) {
                          return <span className="text-xs text-gray-400 dark:text-gray-500 italic">Não definido</span>;
                        }
                        return (
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                            qtd === 0
                              ? 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400'
                              : qtd <= 3
                              ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400'
                              : 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400'
                          }`}>
                            {qtd} cesta{qtd !== 1 ? 's' : ''}
                          </span>
                        );
                      })()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(cesta.status)}`}>
                        {getStatusText(cesta.status)}
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
                          <DropdownMenuItem onClick={() => handleViewCesta(cesta)}>
                            <Eye className="w-4 h-4 mr-2" />
                            Visualizar
                          </DropdownMenuItem>
                          {cesta.status === 'em_uso' && (
                            <DropdownMenuItem onClick={() => handleEditCesta(cesta)}>
                              <Edit className="w-4 h-4 mr-2" />
                              Editar
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={() => setModalEntrega({
                            cestaId: cesta.id,
                            cestaNome: cesta.cesta_nome,
                            vendedorId: cesta.vendedor_id,
                            quantidadeAtual: cesta.quantidade_disponivel ?? 0,
                          })}>
                            <Package className="w-4 h-4 mr-2 text-blue-500" />
                            Entregar Cestas
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => solicitarExclusaoCesta(cesta)}
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
            <div className="mx-auto w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
              <ShoppingBasket className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Nenhuma cesta encontrada</h3>
            <p className="text-gray-500 dark:text-gray-400 mb-6">
              {searchTerm || statusFilter !== 'todos'
                ? 'Tente ajustar os filtros de busca.'
                : 'Comece criando a primeira cesta para um vendedor.'
              }
            </p>
            {!searchTerm && statusFilter === 'todos' && (
              <button
                onClick={() => navigate('/produtos/cestas/nova')}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium flex items-center space-x-2 transition-colors mx-auto"
              >
                <Plus className="w-4 h-4" />
                <span>Criar Primeira Cesta</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Alertas */}
      <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
        <div className="flex">
          <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mt-0.5 mr-3" />
          <div>
            <h3 className="text-sm font-medium text-yellow-800 dark:text-yellow-200">Controle de Estoque</h3>
            <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
              Produtos em cestas ativas são reservados do estoque. Finalize ou retorne as cestas para liberar os produtos.
            </p>
          </div>
        </div>
      </div>

      {/* Modal de Visualização Detalhada */}
      {showModal && selectedCesta && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center space-x-3">
                <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center">
                  <ShoppingBasket className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Detalhes da Cesta</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{selectedCesta?.cesta_nome || 'Nome não disponível'}</p>
                </div>
              </div>
              <button onClick={closeModal} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
                <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
              </button>
            </div>
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                  <div className="flex items-center space-x-2 mb-2">
                    <User className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Vendedor</span>
                  </div>
                  <p className="text-lg font-semibold text-gray-900 dark:text-white">
                    {selectedCesta?.vendedor_nome || 'Vendedor não informado'}
                  </p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                  <div className="flex items-center space-x-2 mb-2">
                    <Calendar className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Data de Montagem</span>
                  </div>
                  <p className="text-lg font-semibold text-gray-900 dark:text-white">
                    {selectedCesta?.data_montagem ? formatDate(selectedCesta.data_montagem) : 'Data não informada'}
                  </p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                  <div className="flex items-center space-x-2 mb-2">
                    <Package className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Quantidade de Itens</span>
                  </div>
                  <p className="text-lg font-semibold text-gray-900 dark:text-white">
                    {selectedCesta?.total_itens || 0} itens
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {selectedCesta?.itens?.length || 0} produtos diferentes
                  </p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                  <div className="flex items-center space-x-2 mb-2">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Valor Total</span>
                  </div>
                  <p className="text-lg font-semibold text-green-600 dark:text-green-400">
                    R$ {(selectedCesta.valor_total || 0).toFixed(2)}
                  </p>
                  <div className="mt-1">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(selectedCesta?.status || '')}`}>
                      {getStatusText(selectedCesta?.status || '')}
                    </span>
                  </div>
                </div>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Produtos na Cesta</h3>
                <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50 dark:bg-gray-700">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Código</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Nome</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Categoria</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Quantidade</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Preço Unit.</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                        {selectedCesta.itens && selectedCesta.itens.length > 0 ? (
                          selectedCesta.itens.map((item, index) => (
                            <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                              <td className="px-4 py-3 whitespace-nowrap text-sm font-mono text-gray-900 dark:text-white">
                                {item.produto?.produto_cod || 'N/A'}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                <div className="text-sm font-medium text-gray-900 dark:text-white">
                                  {item.produto?.produto_nome || 'Nome não disponível'}
                                </div>
                                {item.produto?.descricao && (
                                  <div className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-xs">
                                    {item.produto.descricao}
                                  </div>
                                )}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                                {item.produto?.categoria || 'N/A'}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                                {item.quantidade || 0}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                                R$ {(item.produto?.preco_unt || 0).toFixed(2)}
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={5} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                              Nenhum produto encontrado nesta cesta
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex justify-end p-6 border-t border-gray-200 dark:border-gray-700">
              <button onClick={closeModal} className="px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors">
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmação de Exclusão */}
      {cestaParaExcluir && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-lg w-full">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Confirmar exclusão</h2>
              <button onClick={() => setCestaParaExcluir(null)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
                <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-gray-700 dark:text-gray-300">
                Tem certeza que deseja excluir a cesta
                <span className="font-semibold"> {cestaParaExcluir.cesta_nome} </span>
                do vendedor
                <span className="font-semibold"> {cestaParaExcluir.vendedor_nome}</span>?
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Esta ação removerá a cesta e todos os itens associados. Não é possível desfazer.
              </p>
              <div className="mt-6 flex justify-end space-x-3">
                <button onClick={() => setCestaParaExcluir(null)} className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                  Cancelar
                </button>
                <button
                  onClick={handleDeleteCesta}
                  disabled={isDeleting}
                  className="bg-red-600 hover:bg-red-700 disabled:bg-red-600/60 text-white px-4 py-2 rounded-lg font-medium flex items-center space-x-2 transition-colors"
                >
                  {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  <span>Excluir</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Entrega de Cestas */}
      {modalEntrega && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                  <Package size={20} className="text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 dark:text-white">Entregar Cestas</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{modalEntrega.cestaNome}</p>
                </div>
              </div>
              <button onClick={() => { setModalEntrega(null); setQtdEntrega(1); }} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
                <X size={20} className="text-gray-500" />
              </button>
            </div>
            <div className="p-6 space-y-6">
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mt-0.5" />
                  <div className="text-sm text-yellow-800 dark:text-yellow-200 w-full">
                    <p className="font-medium mb-1">Atenção ao Estoque</p>
                    <p className="text-yellow-700 dark:text-yellow-300 text-xs mb-3">Esta ação irá debitar do estoque:</p>
                    {detalhesCesta && detalhesCesta.itens && detalhesCesta.itens.length > 0 && (
                      <div className="border border-yellow-200 dark:border-yellow-700 rounded-lg overflow-hidden max-h-40 overflow-y-auto bg-white dark:bg-gray-800">
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                          <thead className="bg-gray-50 dark:bg-gray-700/50 sticky top-0">
                            <tr>
                              <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-500 uppercase">Produto</th>
                              <th className="px-3 py-2 text-right text-[10px] font-medium text-gray-500 uppercase">Qtd</th>
                              <th className="px-3 py-2 text-right text-[10px] font-medium text-gray-500 uppercase">Estoque</th>
                              <th className="px-3 py-2 text-center text-[10px] font-medium text-gray-500 uppercase">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                            {detalhesCesta.itens.map((item: any) => {
                              const necessario = item.quantidade * qtdEntrega;
                              const disponivel = item.produto.qtd_estoque || 0;
                              const temEstoque = disponivel >= necessario;
                              return (
                                <tr key={item.produto.id}>
                                  <td className="px-3 py-2 text-xs text-gray-900 dark:text-white truncate max-w-[120px]" title={item.produto.produto_nome}>
                                    {item.produto.produto_nome}
                                  </td>
                                  <td className="px-3 py-2 text-xs text-right font-medium text-gray-700 dark:text-gray-300">{necessario}</td>
                                  <td className="px-3 py-2 text-xs text-right text-gray-500 dark:text-gray-400">{disponivel}</td>
                                  <td className="px-3 py-2 text-center">
                                    {temEstoque
                                      ? <CheckCircle2 size={14} className="text-green-500 mx-auto" />
                                      : <AlertTriangle size={14} className="text-red-500 mx-auto" />
                                    }
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Quantidade de Cestas a Entregar *
                </label>
                <div className="flex items-center gap-4">
                  <button onClick={() => setQtdEntrega(Math.max(1, qtdEntrega - 1))} className="w-10 h-10 flex items-center justify-center rounded-lg border border-gray-300 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700">-</button>
                  <input
                    type="number"
                    min="1"
                    className="flex-1 text-center py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-lg font-bold bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    value={qtdEntrega}
                    onChange={(e) => setQtdEntrega(Math.max(1, parseInt(e.target.value) || 0))}
                  />
                  <button onClick={() => setQtdEntrega(qtdEntrega + 1)} className="w-10 h-10 flex items-center justify-center rounded-lg border border-gray-300 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700">+</button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Observação (opcional)</label>
                <input
                  type="text"
                  placeholder="Ex: Reposição de estoque semanal"
                  className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  value={obsEntrega}
                  onChange={(e) => setObsEntrega(e.target.value)}
                />
              </div>
            </div>
            <div className="flex gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
              <button onClick={() => { setModalEntrega(null); setQtdEntrega(1); }} className="flex-1 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                Cancelar
              </button>
              <button
                onClick={handleConfirmarEntrega}
                disabled={entregarCestasMutation.isPending || qtdEntrega <= 0}
                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                {entregarCestasMutation.isPending ? <span>Registrando...</span> : <><Package size={16} /> Confirmar Entrega</>}
              </button>
            </div>
          </div>
        </div>
      )}


    </div>
  );
};

export default CestasVendedor;
