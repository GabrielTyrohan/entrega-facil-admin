import FuncionarioModal from '@/components/FuncionarioModal';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Pagination } from '@/components/ui/pagination';
import { Skeleton } from "@/components/ui/Skeleton";
import { useAuth } from '@/contexts/AuthContext';
import {
  useFuncionarios,
  useToggleFuncionarioStatus,
  type Funcionario
} from '@/hooks/useFuncionarios';
import { useFuncionariosPresence } from '@/hooks/useFuncionariosPresence';
import { PAGINATION } from '@/lib/constants/pagination';
import { toast } from '@/utils/toast';
import { Edit, MoreHorizontal, Plus, Search, ShieldAlert, Trash2, Wifi } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';


const Funcionarios: React.FC = () => {
  const { user, userType, adminId } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFuncionario, setSelectedFuncionario] = useState<Funcionario | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const itemsPerPage = PAGINATION.FRONTEND_PAGE_SIZE;

  
  // Linha da chamada do hook — simplifica para:
const { isOnline, onlineUsers } = useFuncionariosPresence(
  userType === 'admin' ? (adminId ?? undefined) : undefined
);


  const onlineCount = Object.keys(onlineUsers).length;

  useEffect(() => {
    setCurrentPage(0);
  }, [searchTerm]);

  const { data: funcionarios = [], isLoading } = useFuncionarios(user?.id);
  const toggleStatusMutation = useToggleFuncionarioStatus();

  const filteredFuncionarios = useMemo(() => {
    return (funcionarios || []).filter((func: Funcionario) =>
      func.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      func.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      func.cargo?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [funcionarios, searchTerm]);

  const currentItems = useMemo(() => {
    const { start, end } = PAGINATION.calculateSlice(currentPage, itemsPerPage);
    return filteredFuncionarios.slice(start, end);
  }, [filteredFuncionarios, currentPage, itemsPerPage]);

  const totalPages = PAGINATION.calculateTotalPages(filteredFuncionarios.length, itemsPerPage);

  const handleEdit = (funcionario: Funcionario) => {
    setSelectedFuncionario(funcionario);
    setIsModalOpen(true);
  };

  const handleToggleStatus = async (funcionario: Funcionario) => {
    try {
      await toggleStatusMutation.mutateAsync({
        id: funcionario.id,
        ativo: !funcionario.ativo
      });
      toast.success(`Funcionário ${!funcionario.ativo ? 'ativado' : 'desativado'} com sucesso!`);
    } catch {
      toast.error('Erro ao alterar status do funcionário');
    }
  };

  if (userType !== 'admin' && userType !== 'funcionario') {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400">
        <ShieldAlert className="w-16 h-16 mb-4" />
        <h2 className="text-xl font-semibold">Acesso Restrito</h2>
        <p>Apenas administradores podem gerenciar funcionários.</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-6">

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Funcionários</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Gerencie sua equipe e permissões de acesso
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Badge de online — somente admin */}
          {userType === 'admin' && (
            <div className="flex items-center gap-1.5 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 px-3 py-1.5 rounded-full text-sm font-medium">
              <Wifi size={14} />
              <span>
                {onlineCount === 0
                  ? 'Nenhum online'
                  : onlineCount === 1
                  ? '1 online agora'
                  : `${onlineCount} online agora`}
              </span>
            </div>
          )}
          {userType === 'admin' && (
            <button
              onClick={() => {
                setSelectedFuncionario(null);
                setIsModalOpen(true);
              }}
              className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg transition-colors shadow-sm hover:shadow-md"
            >
              <Plus size={20} />
              <span>Novo Funcionário</span>
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" size={20} />
          <input
            type="text"
            placeholder="Buscar por nome, email ou cargo..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-100 dark:border-gray-700">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Nome</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Email / Telefone</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Cargo</th>
                <th className="px-6 py-4 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                {/* Coluna online só aparece para admin */}
                {userType === 'admin' && (
                  <th className="px-6 py-4 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Agora
                  </th>
                )}
                <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {isLoading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i}>
                    <td className="px-6 py-4"><Skeleton className="h-4 w-32 dark:bg-gray-700" /></td>
                    <td className="px-6 py-4"><Skeleton className="h-4 w-40 dark:bg-gray-700" /></td>
                    <td className="px-6 py-4"><Skeleton className="h-4 w-24 dark:bg-gray-700" /></td>
                    <td className="px-6 py-4"><Skeleton className="h-6 w-16 mx-auto dark:bg-gray-700" /></td>
                    {userType === 'admin' && (
                      <td className="px-6 py-4"><Skeleton className="h-4 w-16 mx-auto dark:bg-gray-700" /></td>
                    )}
                    <td className="px-6 py-4"><Skeleton className="h-8 w-8 ml-auto dark:bg-gray-700" /></td>
                  </tr>
                ))
              ) : funcionarios.length === 0 ? (
                <tr>
                  <td colSpan={userType === 'admin' ? 6 : 5} className="px-6 py-16 text-center text-gray-500 dark:text-gray-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <span className="text-lg font-medium text-gray-900 dark:text-gray-100">
                        Não existem funcionários cadastrados
                      </span>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Clique no botão "Novo Funcionário" para adicionar o primeiro membro da equipe.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : currentItems.length === 0 ? (
                <tr>
                  <td colSpan={userType === 'admin' ? 6 : 5} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                    Nenhum funcionário encontrado na busca.
                  </td>
                </tr>
              ) : (
                currentItems.map((func: Funcionario) => (
                  <tr key={func.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/50 transition-colors">

                    {/* Nome com dot de presença */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {userType === 'admin' && (
                          <span
                            title={isOnline(func.auth_user_id) ? 'Online agora' : 'Offline'}
                            className={`w-2 h-2 rounded-full flex-shrink-0 transition-colors ${
                              isOnline(func.auth_user_id)
                                ? 'bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.7)] animate-pulse'
                                : 'bg-gray-300 dark:bg-gray-600'
                            }`}
                          />
                        )}
                        <span className="font-medium text-gray-900 dark:text-white">
                          {func.nome}
                        </span>
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-gray-900 dark:text-gray-200">{func.email}</span>
                        {func.telefone && (
                          <span className="text-xs text-gray-500 dark:text-gray-400">{func.telefone}</span>
                        )}
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200">
                        {func.cargo || 'Não informado'}
                      </span>
                    </td>

                    <td className="px-6 py-4 text-center">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        func.ativo
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400'
                          : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                      }`}>
                        {func.ativo ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>

                    {/* Célula de presença — somente admin */}
                    {userType === 'admin' && (
                      <td className="px-6 py-4 text-center">
                        {isOnline(func.auth_user_id) ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            Online
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400">
                            <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                            Offline
                          </span>
                        )}
                      </td>
                    )}

                    <td className="px-6 py-4 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors outline-none">
                          <MoreHorizontal size={18} className="text-gray-500 dark:text-gray-400" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48 dark:bg-gray-800 dark:border-gray-700">
                          <DropdownMenuItem
                            onClick={() => handleEdit(func)}
                            className="gap-2 cursor-pointer dark:focus:bg-gray-700 dark:text-gray-200"
                          >
                            <Edit size={16} /> Editar
                          </DropdownMenuItem>
                          <DropdownMenuSeparator className="dark:bg-gray-700" />
                          <DropdownMenuItem
                            onClick={() => handleToggleStatus(func)}
                            className={`gap-2 cursor-pointer dark:focus:bg-gray-700 ${
                              func.ativo
                                ? 'text-red-600 focus:text-red-600 dark:text-red-400 dark:focus:text-red-400'
                                : 'text-emerald-600 focus:text-emerald-600 dark:text-emerald-400 dark:focus:text-emerald-400'
                            }`}
                          >
                            <Trash2 size={16} /> {func.ativo ? 'Desativar' : 'Ativar'}
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

        {totalPages > 1 && (
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalCount={filteredFuncionarios.length}
            pageSize={itemsPerPage}
            onPageChange={setCurrentPage}
          />
        )}
      </div>

      <FuncionarioModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedFuncionario(null);
        }}
        funcionarioToEdit={selectedFuncionario}
      />
    </div>
  );
};

export default Funcionarios;
