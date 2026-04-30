import { Pagination } from '@/components/ui/pagination';
import { Skeleton } from "@/components/ui/Skeleton";
import { PAGINATION } from '@/lib/constants/pagination';
import { Calendar, CreditCard, DollarSign, Search, User } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import type { Vendedor } from '../lib/supabase';
import { PagamentoComDetalhes, PagamentoService } from '../services/pagamentoService';
import { VendedorService } from '../services/vendedorService';
import { usePeriodoVendedor } from '../hooks/usePeriodoVendedor';

const Pagamentos: React.FC = () => {
  const { adminId } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedVendedor, setSelectedVendedor] = useState<string>('');
  const [pagamentos, setPagamentos] = useState<PagamentoComDetalhes[]>([]);
  const [vendedores, setVendedores] = useState<Vendedor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const periodo = usePeriodoVendedor(selectedVendedor || null);

  // Estados para paginação (0-based)
  const [currentPage, setCurrentPage] = useState(0);
  const itemsPerPage = PAGINATION.FRONTEND_PAGE_SIZE;

  // Carregar dados iniciais e recarregar em mudanças de período
  useEffect(() => {
    if (adminId) {
      loadData();
    }
  }, [adminId, selectedVendedor, periodo.inicioStr, periodo.fimStr]);

  const loadData = async () => {
    if (!adminId) return;

    try {
      setLoading(true);
      setError(null);
      
      // Criar instância do serviço
      const pagamentoService = new PagamentoService(adminId);
      
      // Carregar pagamentos e vendedores em paralelo
      const [pagamentosData, vendedoresData] = await Promise.all([
        pagamentoService.searchPagamentos({
          vendedorId: selectedVendedor || undefined,
          dataInicio: periodo.inicioStr || undefined,
          dataFim: periodo.fimStr || undefined,
        }),
        vendedores.length === 0 ? VendedorService.getVendedoresByAdmin(adminId) : Promise.resolve(vendedores)
      ]);
      
      setPagamentos(pagamentosData);
      if (vendedores.length === 0) setVendedores(vendedoresData);
    } catch {
      setError('Erro ao carregar dados. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  // PAGINAÇÃO NO FRONTEND
  const paginatedData = useMemo(() => {
    // Filtrar pagamentos baseado nos critérios de busca
    const filtered = pagamentos.filter(pagamento => {
      const q = searchTerm.trim().toLowerCase();
      const matchesSearch =
        q === '' ||
        pagamento.cliente_nome?.toLowerCase().includes(q) ||
        pagamento.forma_pagamento?.toLowerCase().includes(q) ||
        pagamento.vendedor_nome?.toLowerCase().includes(q) ||
        pagamento.produto_nome?.toLowerCase().includes(q) ||
        String(pagamento.entrega_id || '').toLowerCase().includes(q) ||
        (pagamento.cliente_telefone || '').includes(searchTerm.trim());
      
      const matchesVendedor = selectedVendedor === '' || pagamento.vendedor_id === selectedVendedor;
      
      return matchesSearch && matchesVendedor;
    });

    const { start, end } = PAGINATION.calculateSlice(currentPage, itemsPerPage);
    const items = filtered.slice(start, end);

    return {
      items,
      total: filtered.length,
      totalPages: PAGINATION.calculateTotalPages(filtered.length, itemsPerPage),
      start, // export start/end for display
      end
    };
  }, [pagamentos, searchTerm, selectedVendedor, currentPage, itemsPerPage]);

  // Reset página quando filtro mudar
  useEffect(() => {
    setCurrentPage(0);
  }, [searchTerm, selectedVendedor]);

  // Funções auxiliares
  const getVendedorNome = (vendedorId: string) => {
    const vendedor = vendedores.find(v => v.id === vendedorId);
    return vendedor ? vendedor.nome : 'N/A';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const getMetodoPagamentoIcon = (metodo: string) => {
    switch (metodo?.toLowerCase()) {
      case 'cartao':
      case 'cartão':
        return <CreditCard className="w-4 h-4" />;
      case 'dinheiro':
        return <DollarSign className="w-4 h-4" />;
      default:
        return <DollarSign className="w-4 h-4" />;
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 p-4 sm:p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Pagamentos</h1>
            <p className="text-gray-600 dark:text-gray-400">Gerencie seus pagamentos</p>
          </div>
        </div>

        {/* Filtros Skeleton */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex flex-col lg:flex-row space-y-4 lg:space-y-0 lg:space-x-4">
            <Skeleton className="h-10 flex-1" />
            <Skeleton className="h-10 w-full lg:w-48" />
          </div>
          <div className="mt-4 flex justify-between items-center">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-4 w-24" />
          </div>
        </div>

        {/* Tabela Pagamentos Skeleton */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  {[...Array(5)].map((_, i) => (
                    <th key={i} className="px-6 py-3 text-left">
                      <Skeleton className="h-4 w-24" />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
                {[...Array(8)].map((_, i) => (
                  <tr key={i}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <Skeleton className="w-8 h-8 rounded-full flex-shrink-0" />
                        <div className="ml-3 space-y-1">
                          <Skeleton className="h-4 w-32" />
                          <Skeleton className="h-3 w-20" />
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                       <Skeleton className="h-4 w-24" />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <Skeleton className="w-4 h-4 mr-2" />
                        <Skeleton className="h-4 w-24" />
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <Skeleton className="w-4 h-4 mr-2" />
                        <Skeleton className="h-4 w-32" />
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <Skeleton className="w-4 h-4 mr-2" />
                        <Skeleton className="h-4 w-24" />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Pagamentos</h1>
            <p className="text-gray-600 dark:text-gray-400">Gerencie seus pagamentos</p>
          </div>
        </div>
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-600 dark:text-red-400">{error}</p>
          <button 
            onClick={loadData}
            className="mt-2 text-red-600 dark:text-red-400 underline hover:no-underline"
          >
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Pagamentos</h1>
          <p className="text-gray-600 dark:text-gray-400">Gerencie seus pagamentos</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="flex flex-col lg:flex-row space-y-4 lg:space-y-0 lg:space-x-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar pagamentos..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 w-full border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          
          <div className="flex flex-col space-y-2">
            <select
              value={selectedVendedor}
              onChange={(e) => setSelectedVendedor(e.target.value)}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Todos os vendedores</option>
              {vendedores.map(vendedor => (
                <option key={vendedor.id} value={vendedor.id}>
                  {vendedor.nome}
                </option>
              ))}
            </select>
            {selectedVendedor && periodo.exibicao && (
              <span className="text-xs text-gray-500 dark:text-gray-400 pl-1">
                📅 Período: {periodo.exibicao}
              </span>
            )}
          </div>
        </div>
        

      </div>

      {/* Tabela de Pagamentos */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Cliente
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Valor
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Método
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Vendedor
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Data Vencimento
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
                {paginatedData.items.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center">
                      <div className="text-gray-500 dark:text-gray-400">
                        {searchTerm || selectedVendedor ? 'Nenhum pagamento encontrado com os critérios de busca.' : 'Nenhum pagamento cadastrado ainda.'}
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginatedData.items.map((pagamento, index) => (
                    <tr 
                    key={pagamento.id} 
                    className="hover:bg-gray-50 dark:hover:bg-gray-700 animate-fade-in-up"
                    style={{ animationDelay: `${index * 75}ms` }}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center text-white text-sm font-medium">
                          <DollarSign className="w-4 h-4" />
                        </div>
                        <div className="ml-3">
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {pagamento.cliente_nome || 'N/A'}
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            ID: {pagamento.id.slice(0, 8)}...
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        {formatCurrency(pagamento.valor)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="text-gray-400 mr-2">
                          {getMetodoPagamentoIcon(pagamento.forma_pagamento)}
                        </div>
                        <div className="text-sm text-gray-900 dark:text-white">
                          {pagamento.forma_pagamento || 'N/A'}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <User className="w-4 h-4 text-gray-400 mr-2" />
                        <div className="text-sm text-gray-900 dark:text-white">
                          {getVendedorNome(pagamento.vendedor_id)}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <Calendar className="w-4 h-4 text-gray-400 mr-2" />
                        {formatDate(pagamento.data_pagamento)}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Paginação */}
      {paginatedData.totalPages > 1 && (
        <Pagination
          currentPage={currentPage}
          totalPages={paginatedData.totalPages}
          totalCount={paginatedData.total}
          pageSize={itemsPerPage}
          onPageChange={setCurrentPage}
        />
      )}
    </div>
  );
};

export default Pagamentos;

