import React, { useState, useMemo, useEffect } from 'react';
import { Search, MoreHorizontal, Eye, Trash2, Package, Calendar, User, MapPin } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { 
  useEntregas, 
  useDeleteEntrega,
  type Entrega 
} from '../hooks/useEntregas';
import { 
  useVendedoresByAdmin,
  type Vendedor 
} from '../hooks/useVendedores';
import { useAuth } from '../contexts/AuthContext';
import { EntregaComDetalhes, EntregaService } from '../services/entregaService';
import EntregaModal from '../components/ui/EntregaModal';

const Entregas: React.FC = () => {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedVendedor, setSelectedVendedor] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [selectedEntrega, setSelectedEntrega] = useState<EntregaComDetalhes | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [entregaParaExcluir, setEntregaParaExcluir] = useState<Entrega | null>(null);
  const entregaService = useMemo(() => new EntregaService(user?.id || ''), [user?.id]);

  // React Query hooks para dados
  const { data: entregasData = [], isLoading, error } = useEntregas({ 
    enabled: !!user?.id,
    administrador_id: user?.id
  });
  const { data: vendedoresData = [] } = useVendedoresByAdmin(user?.id || '');
  const deleteEntregaMutation = useDeleteEntrega();

  // Tipar os dados corretamente
  const entregas = entregasData as Entrega[];
  const vendedores = vendedoresData as Vendedor[];

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
  React.useEffect(() => {
    const handleResize = () => {
      const newItemsPerPage = calculateItemsPerPage();
      setItemsPerPage(newItemsPerPage);
      
      // Ajustar página atual se necessário
      const maxPage = Math.ceil(entregas.length / newItemsPerPage);
      if (currentPage > maxPage && maxPage > 0) {
        setCurrentPage(maxPage);
      }
    };

    handleResize(); // Calcular inicial
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [entregas.length, currentPage]);

  // Filtrar entregas baseado nos critérios de busca
  const filteredEntregas = useMemo(() => {
    const filtered = entregas.filter((entrega: Entrega) => {
      const matchesSearch = 
        entrega.cliente?.nome?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesVendedor = selectedVendedor === '' || entrega.vendedor_id === selectedVendedor;
      
      return matchesSearch && matchesVendedor;
    });

    // Ordenar por data_entrega de forma decrescente (mais recente primeiro)
    return filtered.sort((a, b) => {
      const dateA = new Date(a.data_entrega || '');
      const dateB = new Date(b.data_entrega || '');
      return dateB.getTime() - dateA.getTime();
    });
  }, [entregas, searchTerm, selectedVendedor]);

  // Lógica de paginação
  const totalPages = Math.ceil(filteredEntregas.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentEntregas = filteredEntregas.slice(startIndex, endIndex);

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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  // Monta o endereço completo do cliente com tolerância a variações de capitalização
  const formatClienteAddress = (entrega: Entrega) => {
    const c: any = entrega.cliente || {};
    const rua = c?.endereco ?? entrega.cliente_endereco ?? '';
    const numero = c?.numero;
    const bairro = c?.Bairro ?? c?.bairro;
    const cidade = c?.Cidade ?? c?.cidade;
    const estado = c?.Estado ?? c?.estado;
    
    const baseParts = [
      rua || null,
      numero || null,
      bairro || null,
    ].filter(Boolean) as string[];

    let cidadeEstado = '';
    if (cidade) {
      cidadeEstado = `${cidade}${estado ? ` - ${estado}` : ''}`;
    } else if (estado) {
      cidadeEstado = estado;
    }

    const parts = [...baseParts, cidadeEstado || null].filter(Boolean) as string[];

    return parts.length ? parts.join(', ') : 'N/A';
  };

  const handleViewEntrega = (entrega: Entrega) => {
    
    // Converter Entrega para EntregaComDetalhes para compatibilidade com o modal
    const entregaComDetalhes: EntregaComDetalhes = {
      id: entrega.id,
      vendedor_id: entrega.vendedor_id,
      cliente_id: entrega.cliente_id,
      produto_id: entrega.produto_id,
      valor: entrega.valor,
      data_entrega: entrega.data_entrega,
      pago: entrega.pago,
      status: entrega.status_pagamento,
      status_pagamento: entrega.status_pagamento,
      mes_cobranca: entrega.mes_cobranca || null,
      dataRetorno: entrega.dataRetorno || null,
      created_at: entrega.created_at,
      updated_at: entrega.updated_at,
      // Flat properties
      cliente_nome: entrega.cliente?.nome || entrega.cliente_nome || '',
      cliente_sobrenome: (entrega.cliente as any)?.sobrenome || null,
      cliente_cpf: entrega.cliente?.cpf || '',
      cliente_telefone: entrega.cliente?.telefone || '',
      cliente_email: null,
      cliente_endereco: entrega.cliente_endereco || '',
      vendedor_nome: entrega.vendedor?.nome || '',
      produto_nome: entrega.produto?.nome || '',
      produto_preco: entrega.valor,
      // Nested objects
      cliente: entrega.cliente ? {
        nome: entrega.cliente.nome,
        sobrenome: (entrega.cliente as any).sobrenome || null,
        cpf: entrega.cliente.cpf || '',
        telefone: entrega.cliente.telefone || '',
        email: null,
        endereco: entrega.cliente_endereco || '',
        numero: entrega.cliente.numero || '',
        Bairro: (entrega.cliente as any).Bairro || entrega.cliente.bairro || '',
        Cidade: (entrega.cliente as any).Cidade || entrega.cliente.cidade || '',
        Estado: (entrega.cliente as any).Estado || entrega.cliente.estado || '',
        cep: entrega.cliente.cep || '',
        complemento: entrega.cliente.complemento || ''
      } : undefined,
      vendedor: entrega.vendedor,
      produto: entrega.produto ? {
        nome: entrega.produto.nome,
        preco: entrega.valor
      } : undefined,
      // Endereço de entrega - usando o endereço do cliente como padrão
      endereco_entrega: (entrega.cliente?.endereco || entrega.cliente_endereco) ? {
        rua: entrega.cliente?.endereco || entrega.cliente_endereco || '',
        numero: entrega.cliente?.numero || '',
        bairro: (entrega.cliente as any)?.Bairro || entrega.cliente?.bairro || '',
        cep: entrega.cliente?.cep || '',
        cidade: (entrega.cliente as any)?.Cidade || entrega.cliente?.cidade || '',
        estado: (entrega.cliente as any)?.Estado || entrega.cliente?.estado || '',
        complemento: entrega.cliente?.complemento || ''
      } : undefined
    };
    
    setSelectedEntrega(entregaComDetalhes);
    setIsModalOpen(true);

    // Buscar detalhes completos (itens da cesta, itens adicionais e totais)
    entregaService.getEntregaDetalhadaById(entrega.id)
      .then((detalhes) => {
        setSelectedEntrega(detalhes);
      })
      .catch(() => {
        // Se falhar, mantemos os dados básicos já abertos no modal
      });
  };

  const handleDeleteEntrega = async (entrega: Entrega) => {
    try {
      await deleteEntregaMutation.mutateAsync({ id: entrega.id });
    } catch {
      // Error handling without logging sensitive data
    }
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedEntrega(null);
  };

  // Estados de loading e error do React Query
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Entregas</h1>
            <p className="text-gray-600 dark:text-gray-400">Gerencie suas entregas</p>
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
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Entregas</h1>
            <p className="text-gray-600 dark:text-gray-400">Gerencie suas entregas</p>
          </div>
        </div>
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-600 dark:text-red-400">
            {error instanceof Error ? error.message : 'Erro ao carregar entregas'}
          </p>
          <button 
            onClick={() => window.location.reload()}
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
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Entregas</h1>
          <p className="text-gray-600 dark:text-gray-400">Gerencie suas entregas</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="flex flex-col lg:flex-row space-y-4 lg:space-y-0 lg:space-x-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar entregas..."
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
            Mostrando {startIndex + 1} a {Math.min(endIndex, filteredEntregas.length)} de {filteredEntregas.length} entregas
          </span>
          <span>
            {itemsPerPage} por página
          </span>
        </div>
      </div>

      {/* Tabela de Entregas */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Cliente
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Endereço
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Vendedor
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Data Entrega
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
              {currentEntregas.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <div className="text-gray-500 dark:text-gray-400">
                      {searchTerm || selectedVendedor ? 'Nenhuma entrega encontrada com os critérios de busca.' : 'Nenhuma entrega cadastrada ainda.'}
                    </div>
                  </td>
                </tr>
              ) : (
                currentEntregas.map((entrega) => (
                  <tr key={entrega.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-medium">
                          <Package className="w-4 h-4" />
                        </div>
                        <div className="ml-3">
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {([entrega.cliente?.nome, (entrega.cliente as any)?.sobrenome].filter(Boolean) as string[]).join(' ') || 'N/A'}
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            ID: {entrega.id.slice(0, 8)}...
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-start">
                        <MapPin className="w-4 h-4 text-gray-400 mt-0.5 mr-2 flex-shrink-0" />
                    <div className="text-sm text-gray-900 dark:text-white max-w-xs">
                          {formatClienteAddress(entrega)}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <User className="w-4 h-4 text-gray-400 mr-2" />
                        <div className="text-sm text-gray-900 dark:text-white">
                          {entrega.vendedor?.nome || 'N/A'}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center text-sm text-gray-900 dark:text-white">
                        <Calendar className="w-4 h-4 text-gray-400 mr-2" />
                        {entrega.data_entrega ? formatDate(entrega.data_entrega) : 'N/A'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button 
                            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                            disabled={deleteEntregaMutation.isPending}
                          >
                            <MoreHorizontal className="w-4 h-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleViewEntrega(entrega)}>
                            <Eye className="w-4 h-4 mr-2" />
                            Visualizar
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => setEntregaParaExcluir(entrega)}
                            className="text-red-600 dark:text-red-400"
                            disabled={deleteEntregaMutation.isPending}
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            {deleteEntregaMutation.isPending ? 'Excluindo...' : 'Excluir'}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
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

      {/* Modal de Visualização */}
      <EntregaModal
        entrega={selectedEntrega}
        isOpen={isModalOpen}
        onClose={handleCloseModal}
      />

      {entregaParaExcluir && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg w-[90%] max-w-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Confirmar exclusão</h3>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">Tem certeza que deseja excluir a entrega?</p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                onClick={() => setEntregaParaExcluir(null)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                disabled={deleteEntregaMutation.isPending}
                onClick={async () => {
                  if (entregaParaExcluir) {
                    await handleDeleteEntrega(entregaParaExcluir);
                  }
                  setEntregaParaExcluir(null);
                }}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Entregas;
