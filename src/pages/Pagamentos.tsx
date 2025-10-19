import React, { useState, useEffect } from 'react';
import { Search, DollarSign, Calendar, User, CreditCard } from 'lucide-react';
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { PagamentoService, PagamentoComDetalhes } from '../services/pagamentoService';
import { VendedorService } from '../services/vendedorService';
import { useAuth } from '../contexts/AuthContext';
import type { Vendedor } from '../lib/supabase';

const Pagamentos: React.FC = () => {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedVendedor, setSelectedVendedor] = useState<string>('');
  const [pagamentos, setPagamentos] = useState<PagamentoComDetalhes[]>([]);
  const [vendedores, setVendedores] = useState<Vendedor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Estados para paginação
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Função para calcular itens por página baseado no tamanho da tela
  const calculateItemsPerPage = () => {
    const height = window.innerHeight;
    const width = window.innerWidth;
    
    // Altura disponível para a tabela (descontando header, filtros, etc.)
    const availableHeight = height - 400; // ~400px para header, filtros, paginação
    const rowHeight = 73; // altura aproximada de cada linha da tabela
    
    let baseItemsPerPage = Math.floor(availableHeight / rowHeight);
    
    // Ajustar baseado na largura da tela para melhor experiência
    if (width >= 1920) { // 4K ou maior
      baseItemsPerPage = Math.max(baseItemsPerPage, 15);
    } else if (width >= 1440) { // Desktop grande
      baseItemsPerPage = Math.max(baseItemsPerPage, 12);
    } else if (width >= 1024) { // Desktop padrão
      baseItemsPerPage = Math.max(baseItemsPerPage, 10);
    } else { // Tablet/Mobile
      baseItemsPerPage = Math.max(baseItemsPerPage, 8);
    }
    
    // Garantir um mínimo e máximo razoável
    return Math.min(Math.max(baseItemsPerPage, 5), 25);
  };

  // Atualizar itens por página quando a tela redimensionar
  useEffect(() => {
    const handleResize = () => {
      const newItemsPerPage = calculateItemsPerPage();
      setItemsPerPage(newItemsPerPage);
      
      // Ajustar página atual se necessário
      const maxPage = Math.ceil(pagamentos.length / newItemsPerPage);
      if (currentPage > maxPage && maxPage > 0) {
        setCurrentPage(maxPage);
      }
    };

    handleResize(); // Calcular inicial
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [pagamentos.length, currentPage]);

  // Carregar dados iniciais
  useEffect(() => {
    if (user?.id) {
      loadData();
    }
  }, [user?.id]);

  const loadData = async () => {
    if (!user?.id) return;

    try {
      setLoading(true);
      setError(null);
      
      // Criar instância do serviço
      const pagamentoService = new PagamentoService(user.id);
      
      // Carregar pagamentos e vendedores em paralelo
      const [pagamentosData, vendedoresData] = await Promise.all([
        pagamentoService.getPagamentosByAdmin(),
        VendedorService.getVendedoresByAdmin(user.id)
      ]);
      
      setPagamentos(pagamentosData);
      setVendedores(vendedoresData);
    } catch {
      setError('Erro ao carregar dados. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  // Filtrar pagamentos baseado nos critérios de busca
  const filteredPagamentos = pagamentos.filter(pagamento => {
    const matchesSearch = 
      pagamento.cliente_nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      pagamento.forma_pagamento?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesVendedor = selectedVendedor === '' || pagamento.vendedor_id === selectedVendedor;
    
    return matchesSearch && matchesVendedor;
  });

  // Lógica de paginação
  const totalPages = Math.ceil(filteredPagamentos.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentPagamentos = filteredPagamentos.slice(startIndex, endIndex);

  // Reset página quando filtro mudar
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedVendedor]);

  // Função para gerar números das páginas
  const getPageNumbers = () => {
    const pages = [];
    const maxVisiblePages = window.innerWidth >= 768 ? 7 : 5; // Mais páginas em telas maiores
    
    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      const halfVisible = Math.floor(maxVisiblePages / 2);
      let startPage = Math.max(1, currentPage - halfVisible);
      const endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
      
      if (endPage - startPage < maxVisiblePages - 1) {
        startPage = Math.max(1, endPage - maxVisiblePages + 1);
      }
      
      for (let i = startPage; i <= endPage; i++) {
        pages.push(i);
      }
    }
    
    return pages;
  };

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
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Pagamentos</h1>
            <p className="text-gray-600 dark:text-gray-400">Gerencie seus pagamentos</p>
          </div>
        </div>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
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
    <div className="space-y-6">
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
        </div>
        
        {/* Informações de paginação */}
        <div className="mt-4 flex justify-between items-center text-sm text-gray-600 dark:text-gray-400">
          <span>
            Mostrando {startIndex + 1} a {Math.min(endIndex, filteredPagamentos.length)} de {filteredPagamentos.length} pagamentos
          </span>
          <span>
            {itemsPerPage} por página
          </span>
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
              {currentPagamentos.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <div className="text-gray-500 dark:text-gray-400">
                      {searchTerm || selectedVendedor ? 'Nenhum pagamento encontrado com os critérios de busca.' : 'Nenhum pagamento cadastrado ainda.'}
                    </div>
                  </td>
                </tr>
              ) : (
                currentPagamentos.map((pagamento) => (
                  <tr key={pagamento.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
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
      {totalPages > 1 && (
        <div className="flex justify-center">
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious 
                  href="#"
                  size="default"
                  onClick={(e) => {
                    e.preventDefault();
                    if (currentPage > 1) setCurrentPage(currentPage - 1);
                  }}
                  className={currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                />
              </PaginationItem>
              
              {getPageNumbers().map((pageNum, index, array) => {
                const showEllipsisBefore = index === 0 && pageNum > 1;
                const showEllipsisAfter = index === array.length - 1 && pageNum < totalPages;
                
                return (
                  <React.Fragment key={pageNum}>
                    {showEllipsisBefore && (
                      <PaginationItem>
                        <PaginationEllipsis />
                      </PaginationItem>
                    )}
                    
                    <PaginationItem>
                      <PaginationLink
                        href="#"
                        size="default"
                        onClick={(e) => {
                          e.preventDefault();
                          setCurrentPage(pageNum);
                        }}
                        isActive={currentPage === pageNum}
                        className="cursor-pointer"
                      >
                        {pageNum}
                      </PaginationLink>
                    </PaginationItem>
                    
                    {showEllipsisAfter && (
                      <PaginationItem>
                        <PaginationEllipsis />
                      </PaginationItem>
                    )}
                  </React.Fragment>
                );
              })}
              
              <PaginationItem>
                <PaginationNext 
                  href="#"
                  size="default"
                  onClick={(e) => {
                    e.preventDefault();
                    if (currentPage < totalPages) setCurrentPage(currentPage + 1);
                  }}
                  className={currentPage === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}
    </div>
  );
};

export default Pagamentos;
