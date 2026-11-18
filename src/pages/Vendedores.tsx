import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Pagination } from "@/components/ui/pagination";
import { Skeleton } from "@/components/ui/Skeleton";
import VendedorModal from '@/components/ui/VendedorModal';
import { Edit, Eye, MoreHorizontal, Plus, Search, Trash2, Users } from 'lucide-react';
import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import PageHeader from '../components/layout/PageHeader';
import { TableErrorState } from '../components/table';
import { BarraFiltros, Busca, CabecalhoPagina, Etiqueta, Vazio, cls } from '../components/ui/lista';
import NovoVendedor from './NovoVendedor';
import { useAuth } from '../contexts/AuthContext';
import { useTotalEntregasPorAdministrador } from '../hooks/useDashboard';
import {
  useDeleteVendedor,
  useVendedores,
  type Vendedor
} from '../hooks/useVendedores';


const Vendedores: React.FC = () => {
  const navigate = useNavigate();
  const { user, adminId } = useAuth();
  const targetId = adminId || user?.id; // Usa adminId se for funcionário, ou user.id se for admin
  
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [selectedVendedor, setSelectedVendedor] = useState<Vendedor | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [vendedorParaExcluir, setVendedorParaExcluir] = useState<Vendedor | null>(null);

  // Cadastro em painel lateral; abre também por /vendedores?novo=1 (ação do Ctrl+K)
  const [searchParams, setSearchParams] = useSearchParams();
  const [novoAberto, setNovoAberto] = useState(searchParams.get('novo') === '1');
  React.useEffect(() => {
    if (searchParams.get('novo') === '1') {
      setNovoAberto(true);
      searchParams.delete('novo');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  // Debounce para busca server-side
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 450);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // React Query hooks para dados (busca server-side em todo o conjunto paginado)
  const { data, isLoading, error, refetch } = useVendedores(currentPage, debouncedSearchTerm || undefined);

  // Acessar os dados corretamente:
  const vendedores = data?.vendedores || [];
  const totalPages = data?.totalPages || 1;
  const total = data?.total || 0;

  const hasActiveSearch = searchTerm.trim() !== '';

  const clearSearch = () => {
    setSearchTerm('');
    setDebouncedSearchTerm('');
    setCurrentPage(0);
  };

  // Resetar página ao aplicar busca e evitar página inválida após filtro
  React.useEffect(() => {
    setCurrentPage(0);
  }, [debouncedSearchTerm]);

  React.useEffect(() => {
    if (totalPages > 0 && currentPage > totalPages - 1) {
      setCurrentPage(0);
    }
  }, [totalPages, currentPage]);

  const deleteVendedorMutation = useDeleteVendedor();
  
  // Hook para total de entregas por vendedor
  const { data: entregasPorVendedor = {}, isLoading: isLoadingEntregas } = useTotalEntregasPorAdministrador(targetId || '', {
    enabled: !!targetId
  });

  // Handlers para as ações do dropdown
  const handleViewVendedor = (vendedor: Vendedor) => {
    setSelectedVendedor(vendedor);
    setIsModalOpen(true);
  };

  const handleEditVendedor = (vendedor: Vendedor) => {
    navigate(`/vendedores/editar/${vendedor.id}`);
  };

  const handleDeleteVendedor = async (vendedor: Vendedor) => {
    try {
      // A API de delete espera um objeto com a chave primária
      await deleteVendedorMutation.mutateAsync({ id: vendedor.id });
    } catch {
      // Error handling without logging sensitive data
    }
  };

  // Dados já filtrados (server-side) e paginados pelo hook
  const currentVendedores = vendedores;

  // Formatação de data
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  // Formatação de percentual
  const formatPercentual = (percentual?: number | null) => {
    return percentual ? `${percentual}%` : 'N/A';
  };

  // Formatação de telefone
  const formatPhone = (phone?: string | null) => {
    if (!phone) return 'N/A';
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 11) {
      return cleaned.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
    } else if (cleaned.length === 10) {
      return cleaned.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
    }
    return phone;
  };

  // Estados de loading e error do React Query
  if (isLoading) {
    return (
      <div className="space-y-4 sm:space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
          <Skeleton className="h-10 w-40 rounded-lg" />
        </div>

        {/* Filters Skeleton */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 sm:p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex flex-col space-y-3 sm:flex-row sm:space-y-0 sm:space-x-4">
            <Skeleton className="h-10 flex-1" />
          </div>
          <div className="mt-3 sm:mt-4 flex justify-between items-center">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-4 w-24" />
          </div>
        </div>

        {/* Vendedores Table Skeleton */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  {[...Array(9)].map((_, i) => (
                    <th key={i} className="px-6 py-3 text-left">
                      <Skeleton className="h-4 w-24" />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
                {[...Array(8)].map((_, i) => (
                  <tr key={i}>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-3">
                        <Skeleton className="h-8 w-8 rounded-full" />
                        <div className="space-y-1">
                          <Skeleton className="h-4 w-32" />
                          <Skeleton className="h-3 w-20" />
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 hidden sm:table-cell">
                      <div className="space-y-1">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-3 w-24" />
                      </div>
                    </td>
                    <td className="px-6 py-4 hidden md:table-cell">
                      <Skeleton className="h-6 w-20 rounded-full" />
                    </td>
                    <td className="px-6 py-4 hidden md:table-cell">
                      <Skeleton className="h-5 w-14 rounded-full" />
                    </td>
                    <td className="px-6 py-4 hidden md:table-cell">
                      <Skeleton className="h-5 w-5 rounded-full" />
                    </td>
                    <td className="px-6 py-4 hidden lg:table-cell">
                      <Skeleton className="h-5 w-10 rounded-full" />
                    </td>
                    <td className="px-6 py-4 hidden lg:table-cell">
                      <Skeleton className="h-4 w-12" />
                    </td>
                    <td className="px-6 py-4 hidden xl:table-cell">
                      <Skeleton className="h-4 w-24" />
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <Skeleton className="h-8 w-8 rounded-md" />
                        <Skeleton className="h-8 w-8 rounded-md" />
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
      <div className="space-y-4 sm:space-y-6">
        <PageHeader title="Vendedores" description="Gerencie sua equipe de vendas" />
        <TableErrorState onRetry={() => refetch()} />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <CabecalhoPagina
        titulo="Vendedores"
        descricao="Quem vende na rua, o vínculo de cada um e quem paga a assinatura."
        acoes={
          <button type="button" onClick={() => setNovoAberto(true)} className={cls.btnPri}>
            <Plus className="h-4 w-4" /> Novo vendedor
          </button>
        }
      />

      <BarraFiltros>
        <Busca value={searchTerm} onChange={setSearchTerm} placeholder="Buscar vendedor por nome" className="flex-1 sm:max-w-sm" />
        <span className="text-[13px] text-gray-500 dark:text-gray-400">
          {total} {total === 1 ? 'vendedor' : 'vendedores'}
          {totalPages > 1 && ` · página ${currentPage + 1} de ${totalPages}`}
        </span>
      </BarraFiltros>

      <div className={`${cls.card} overflow-hidden`}>
        {currentVendedores.length === 0 ? (
          hasActiveSearch ? (
            <Vazio
              icone={Search}
              titulo="Nenhum vendedor com esse nome"
              texto="Confira a grafia ou limpe a busca."
              acao={
                <button type="button" onClick={clearSearch} className={cls.btn}>
                  Limpar busca
                </button>
              }
            />
          ) : (
            <Vazio
              icone={Users}
              titulo="Nenhum vendedor cadastrado"
              texto="Cadastre o primeiro vendedor para liberar cestas e acompanhar a cobrança."
              acao={
                <button type="button" onClick={() => setNovoAberto(true)} className={cls.btnPri}>
                  <Plus className="h-4 w-4" /> Novo vendedor
                </button>
              }
            />
          )
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px]">
              <thead className={cls.thead}>
                <tr>
                  <th scope="col" className={cls.th}>Vendedor</th>
                  <th scope="col" className={cls.th}>Contato</th>
                  <th scope="col" className={cls.th}>Situação</th>
                  <th scope="col" className={cls.th}>Quem paga</th>
                  <th scope="col" className={cls.thR}>Entregas</th>
                  <th scope="col" className={cls.thR}>% mínimo</th>
                  <th scope="col" className={cls.th}>Desde</th>
                  <th scope="col" className={cls.th}>
                    <span className="sr-only">Ações</span>
                  </th>
                </tr>
              </thead>
              <tbody className={cls.tbody}>
                {currentVendedores.map((vendedor: Vendedor) => (
                  <tr key={vendedor.id} className={cls.tr}>
                    <td className={cls.td}>
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-50 text-xs font-semibold text-blue-700 dark:bg-blue-500/15 dark:text-blue-300">
                          {vendedor.nome.charAt(0).toUpperCase()}
                        </div>
                        <span className="truncate font-medium text-gray-900 dark:text-white" title={vendedor.nome}>
                          {vendedor.nome}
                        </span>
                      </div>
                    </td>
                    <td className={cls.td}>
                      <div className="max-w-[220px] truncate" title={vendedor.email || undefined}>
                        {vendedor.email || '—'}
                      </div>
                      <div className="font-mono text-xs text-gray-500 dark:text-gray-400">{formatPhone(vendedor.telefone)}</div>
                    </td>
                    <td className={cls.td}>
                      <Etiqueta tom={vendedor.ativo ? 'ok' : 'neutro'}>{vendedor.ativo ? 'Ativo' : 'Inativo'}</Etiqueta>
                    </td>
                    <td className={cls.td}>
                      <div className="flex flex-wrap items-center gap-1">
                        <Etiqueta tom={vendedor.tipo_vinculo === 'autonomo' ? 'neutro' : 'destaque'}>
                          {vendedor.tipo_vinculo === 'autonomo' ? 'O vendedor' : 'A empresa'}
                        </Etiqueta>
                        {vendedor.status_pagamento_vendedor === 'pendente' && <Etiqueta tom="atencao">Pendente</Etiqueta>}
                        {vendedor.status_pagamento_vendedor === 'pago' && <Etiqueta tom="ok">Em dia</Etiqueta>}
                      </div>
                    </td>
                    <td className={cls.tdR}>
                      {isLoadingEntregas ? <span className="inline-block h-3.5 w-6 animate-pulse rounded bg-gray-200 dark:bg-gray-600" /> : entregasPorVendedor[vendedor.id] || 0}
                    </td>
                    <td className={cls.tdR}>{formatPercentual(vendedor.percentual_minimo)}</td>
                    <td className={`${cls.td} whitespace-nowrap`}>{formatDate(vendedor.created_at)}</td>
                    <td className={`${cls.td} whitespace-nowrap`}>
                      <div className={cls.rowActions}>
                        <button type="button" onClick={() => handleEditVendedor(vendedor)} className={cls.btnGhost}>
                          <Edit className="h-3.5 w-3.5" /> Editar
                        </button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              aria-label={`Mais ações do vendedor ${vendedor.nome}`}
                              aria-haspopup="menu"
                              className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-gray-200"
                              disabled={deleteVendedorMutation.isPending}
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleViewVendedor(vendedor)}>
                              <Eye className="mr-2 h-4 w-4" />
                              Visualizar
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => setVendedorParaExcluir(vendedor)}
                              className="text-red-600 dark:text-red-400"
                              disabled={deleteVendedorMutation.isPending}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              {deleteVendedorMutation.isPending ? 'Excluindo...' : 'Excluir'}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {novoAberto && <NovoVendedor emPainel aberto onFechar={() => setNovoAberto(false)} />}

      {/* Paginação */}
      {totalPages > 1 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalCount={total}
          pageSize={15}
          onPageChange={setCurrentPage}
        />
      )}
      
      {/* Modal de Visualização */}
      <VendedorModal 
        vendedor={selectedVendedor}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />



      {vendedorParaExcluir && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg w-[90%] max-w-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Confirmar exclusão</h3>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              Tem certeza que deseja excluir o vendedor {vendedorParaExcluir.nome}?
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                onClick={() => setVendedorParaExcluir(null)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                disabled={deleteVendedorMutation.isPending}
                onClick={async () => {
                  await handleDeleteVendedor(vendedorParaExcluir);
                  setVendedorParaExcluir(null);
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

export default Vendedores;