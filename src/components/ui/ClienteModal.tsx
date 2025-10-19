import React from 'react';
import { X, Mail, Phone, Calendar, MapPin, User, CreditCard, FileText, Users, DollarSign, Shield } from 'lucide-react';
import type { Cliente } from '../../hooks/useClientes';
import { useVendedor } from '../../hooks/useVendedores';
import { useResponsaveisPorCliente, type Responsavel } from '../../hooks/useResponsaveis';

interface ClienteModalProps {
  cliente: Cliente | null;
  isOpen: boolean;
  onClose: () => void;
}

const ClienteModal: React.FC<ClienteModalProps> = ({ cliente, isOpen, onClose }) => {
  // CORREÇÃO: Mover todos os hooks ANTES de qualquer early return
  // Hook para buscar dados do vendedor
  const { data: vendedor, isLoading: isLoadingVendedor } = useVendedor(
    cliente?.vendedor_id || '', 
    { enabled: !!cliente?.vendedor_id && isOpen }
  ) as { data: { nome: string } | null, isLoading: boolean };

  // Hook para buscar responsáveis (apenas se cliente for menor de idade)
  const { data: responsaveis = [], isLoading: isLoadingResponsaveis } = useResponsaveisPorCliente(
    cliente?.id || '', 
    { enabled: !!cliente?.id && cliente?.menor_idade === true && isOpen }
  ) as { data: Responsavel[], isLoading: boolean };



  // Early return APÓS todos os hooks
  if (!isOpen || !cliente) return null;

  // Função para formatar telefone
  const formatPhoneNumber = (phone?: string) => {
    if (!phone) return 'N/A';
    
    const cleaned = phone.replace(/\D/g, '');
    
    if (cleaned.length === 11) {
      // Celular com DDD: (11) 99999-9999
      return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
    } else if (cleaned.length === 10) {
      // Fixo com DDD: (11) 9999-9999
      return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 6)}-${cleaned.slice(6)}`;
    } else if (cleaned.length === 9) {
      // Celular sem DDD: 99999-9999
      return `${cleaned.slice(0, 5)}-${cleaned.slice(5)}`;
    } else if (cleaned.length === 8) {
      // Fixo sem DDD: 9999-9999
      return `${cleaned.slice(0, 4)}-${cleaned.slice(4)}`;
    }
    
    return phone;
  };

  // Função para formatar CPF
  const formatCPF = (cpf?: string) => {
    if (!cpf) return 'N/A';
    const cleaned = cpf.replace(/\D/g, '');
    if (cleaned.length === 11) {
      return `${cleaned.slice(0, 3)}.${cleaned.slice(3, 6)}.${cleaned.slice(6, 9)}-${cleaned.slice(9)}`;
    }
    return cpf;
  };

  // Função para formatar RG
  const formatRG = (rg?: string) => {
    if (!rg) return 'N/A';
    const cleaned = rg.replace(/\D/g, '');
    if (cleaned.length === 9) {
      return `${cleaned.slice(0, 2)}.${cleaned.slice(2, 5)}.${cleaned.slice(5, 8)}-${cleaned.slice(8)}`;
    }
    return rg;
  };

  // Função para formatar data
  const formatDate = (date?: string) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('pt-BR');
  };

  // Função para formatar moeda
  const formatCurrency = (value?: number) => {
    if (!value) return 'N/A';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  // Função para lidar com clique no backdrop
  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4"
      onClick={handleBackdropClick}
    >
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-xs sm:max-w-lg md:max-w-2xl lg:max-w-4xl max-h-[95vh] sm:max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900 dark:text-white truncate pr-4">
            Detalhes do Cliente
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors touch-manipulation flex-shrink-0"
          >
            <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1">
          {/* Profile Section */}
          <div className="flex flex-col sm:flex-row sm:items-center mb-6 space-y-4 sm:space-y-0">
            <div className="w-12 h-12 sm:w-16 sm:h-16 bg-green-600 rounded-full flex items-center justify-center text-white text-lg sm:text-2xl font-bold sm:mr-4 flex-shrink-0 mx-auto sm:mx-0">
              {cliente.nome.charAt(0).toUpperCase()}
            </div>
            <div className="text-center sm:text-left min-w-0">
              <h3 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white truncate">
                {cliente.nome} {cliente.sobrenome || ''}
              </h3>
              <p className="text-gray-500 dark:text-gray-400 text-sm">ID: {cliente.id.slice(0, 8)}...</p>
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mt-2">
                <span className={`inline-flex px-2 sm:px-3 py-1 text-xs sm:text-sm font-semibold rounded-full ${
                  cliente.ativo 
                    ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                    : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
                }`}>
                  {cliente.ativo ? 'Ativo' : 'Inativo'}
                </span>
                {cliente.menor_idade && (
                  <span className="inline-flex px-2 sm:px-3 py-1 text-xs sm:text-sm font-semibold rounded-full bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400">
                    Menor de Idade
                  </span>
                )}
                {cliente.sincronizado && (
                  <span className="inline-flex px-2 sm:px-3 py-1 text-xs sm:text-sm font-semibold rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400">
                    Sincronizado
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Information Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
            {/* Informações Pessoais */}
            <div className="space-y-4">
              <h4 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center">
                <User className="w-4 h-4 sm:w-5 sm:h-5 mr-2 flex-shrink-0" />
                <span className="truncate">Informações Pessoais</span>
              </h4>
              
              <div className="space-y-3">
                <div className="flex items-start space-x-3">
                  <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg flex-shrink-0">
                    <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">CPF</p>
                    <p className="text-sm sm:text-base text-gray-900 dark:text-white font-medium break-all">{formatCPF(cliente.cpf)}</p>
                  </div>
                </div>

                {cliente.rg && (
                  <div className="flex items-start space-x-3">
                    <div className="p-2 bg-purple-100 dark:bg-purple-900/20 rounded-lg flex-shrink-0">
                      <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">RG</p>
                      <p className="text-sm sm:text-base text-gray-900 dark:text-white font-medium break-all">{formatRG(cliente.rg)}</p>
                    </div>
                  </div>
                )}

                {cliente.data_nascimento && (
                  <div className="flex items-start space-x-3">
                    <div className="p-2 bg-green-100 dark:bg-green-900/20 rounded-lg flex-shrink-0">
                      <Calendar className="w-4 h-4 sm:w-5 sm:h-5 text-green-600 dark:text-green-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Data de Nascimento</p>
                      <p className="text-sm sm:text-base text-gray-900 dark:text-white font-medium">{formatDate(cliente.data_nascimento)}</p>
                    </div>
                  </div>
                )}

                {cliente.sexo && (
                  <div className="flex items-start space-x-3">
                    <div className="p-2 bg-pink-100 dark:bg-pink-900/20 rounded-lg flex-shrink-0">
                      <User className="w-4 h-4 sm:w-5 sm:h-5 text-pink-600 dark:text-pink-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Sexo</p>
                      <p className="text-sm sm:text-base text-gray-900 dark:text-white font-medium">{cliente.sexo}</p>
                    </div>
                  </div>
                )}

                {cliente.estado_civil && (
                  <div className="flex items-start space-x-3">
                    <div className="p-2 bg-indigo-100 dark:bg-indigo-900/20 rounded-lg flex-shrink-0">
                      <Users className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Estado Civil</p>
                      <p className="text-sm sm:text-base text-gray-900 dark:text-white font-medium">{cliente.estado_civil}</p>
                    </div>
                  </div>
                )}

                {cliente.nacionalidade && (
                  <div className="flex items-start space-x-3">
                    <div className="p-2 bg-yellow-100 dark:bg-yellow-900/20 rounded-lg flex-shrink-0">
                      <MapPin className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-600 dark:text-yellow-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Nacionalidade</p>
                      <p className="text-sm sm:text-base text-gray-900 dark:text-white font-medium">{cliente.nacionalidade}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Informações de Contato */}
            <div className="space-y-4">
              <h4 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center">
                <Phone className="w-4 h-4 sm:w-5 sm:h-5 mr-2 flex-shrink-0" />
                <span className="truncate">Informações de Contato</span>
              </h4>
              
              <div className="space-y-3">
                <div className="flex items-start space-x-3">
                  <div className="p-2 bg-green-100 dark:bg-green-900/20 rounded-lg flex-shrink-0">
                    <Phone className="w-4 h-4 sm:w-5 sm:h-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Telefone</p>
                    <p className="text-sm sm:text-base text-gray-900 dark:text-white font-medium break-all">{formatPhoneNumber(cliente.telefone)}</p>
                  </div>
                </div>

                {cliente.email && (
                  <div className="flex items-start space-x-3">
                    <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg flex-shrink-0">
                      <Mail className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Email</p>
                      <p className="text-sm sm:text-base text-gray-900 dark:text-white font-medium break-all">{cliente.email}</p>
                    </div>
                  </div>
                )}

                <div className="flex items-start space-x-3">
                  <div className="p-2 bg-orange-100 dark:bg-orange-900/20 rounded-lg flex-shrink-0">
                    <MapPin className="w-4 h-4 sm:w-5 sm:h-5 text-orange-600 dark:text-orange-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Endereço</p>
                    <p className="text-sm sm:text-base text-gray-900 dark:text-white font-medium break-words">{cliente.endereco || 'N/A'}</p>
                  </div>
                </div>

                {cliente.cidade && (
                  <div className="flex items-start space-x-3">
                    <div className="p-2 bg-indigo-100 dark:bg-indigo-900/20 rounded-lg flex-shrink-0">
                      <MapPin className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Cidade</p>
                      <p className="text-sm sm:text-base text-gray-900 dark:text-white font-medium">{cliente.cidade}</p>
                    </div>
                  </div>
                )}

                {cliente.cep && (
                  <div className="flex items-start space-x-3">
                    <div className="p-2 bg-yellow-100 dark:bg-yellow-900/20 rounded-lg flex-shrink-0">
                      <CreditCard className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">CEP</p>
                      <p className="text-gray-900 dark:text-white font-medium">{cliente.cep}</p>
                    </div>
                  </div>
                )}

                {cliente.ponto_referencia && (
                  <div className="flex items-start space-x-3">
                    <div className="p-2 bg-teal-100 dark:bg-teal-900/20 rounded-lg">
                      <MapPin className="w-5 h-5 text-teal-600 dark:text-teal-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Ponto de Referência</p>
                      <p className="text-gray-900 dark:text-white font-medium">{cliente.ponto_referencia}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Informações Familiares */}
          {(cliente.nome_pai || cliente.nome_mae || cliente.nome_conjuge) && (
            <div className="mt-6 sm:mt-8">
              <h4 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-3 sm:mb-4 flex items-center">
                <Users className="w-4 h-4 sm:w-5 sm:h-5 mr-2 flex-shrink-0" />
                <span className="truncate">Informações Familiares</span>
              </h4>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                {cliente.nome_pai && (
                  <div className="flex items-start space-x-3">
                    <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg flex-shrink-0">
                      <User className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Nome do Pai</p>
                      <p className="text-sm sm:text-base text-gray-900 dark:text-white font-medium break-words">{cliente.nome_pai}</p>
                    </div>
                  </div>
                )}

                {cliente.nome_mae && (
                  <div className="flex items-start space-x-3">
                    <div className="p-2 bg-pink-100 dark:bg-pink-900/20 rounded-lg flex-shrink-0">
                      <User className="w-4 h-4 sm:w-5 sm:h-5 text-pink-600 dark:text-pink-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Nome da Mãe</p>
                      <p className="text-sm sm:text-base text-gray-900 dark:text-white font-medium break-words">{cliente.nome_mae}</p>
                    </div>
                  </div>
                )}

                {cliente.nome_conjuge && (
                  <div className="flex items-start space-x-3">
                    <div className="p-2 bg-purple-100 dark:bg-purple-900/20 rounded-lg flex-shrink-0">
                      <Users className="w-4 h-4 sm:w-5 sm:h-5 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Nome do Cônjuge</p>
                      <p className="text-sm sm:text-base text-gray-900 dark:text-white font-medium break-words">{cliente.nome_conjuge}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Informações Financeiras e Vendedor */}
          <div className="mt-6 sm:mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
            {/* Informações Financeiras */}
            <div className="space-y-4">
              <h4 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center">
                <DollarSign className="w-4 h-4 sm:w-5 sm:h-5 mr-2 flex-shrink-0" />
                <span className="truncate">Informações Financeiras</span>
              </h4>
              
              {cliente.renda_mensal && (
                <div className="flex items-start space-x-3">
                  <div className="p-2 bg-green-100 dark:bg-green-900/20 rounded-lg flex-shrink-0">
                    <DollarSign className="w-4 h-4 sm:w-5 sm:h-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Renda Mensal</p>
                    <p className="text-sm sm:text-base text-gray-900 dark:text-white font-medium">{formatCurrency(cliente.renda_mensal)}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Informações do Vendedor */}
            <div className="space-y-4">
              <h4 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center">
                <Shield className="w-4 h-4 sm:w-5 sm:h-5 mr-2 flex-shrink-0" />
                <span className="truncate">Informações do Vendedor</span>
              </h4>
              
              <div className="flex items-start space-x-3">
                <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg flex-shrink-0">
                  <User className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600 dark:text-gray-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Vendedor</p>
                  {isLoadingVendedor ? (
                    <div className="animate-pulse bg-gray-200 dark:bg-gray-600 h-4 w-32 rounded"></div>
                  ) : (
                    <p className="text-sm sm:text-base text-gray-900 dark:text-white font-medium break-words">
                      {vendedor?.nome || 'Vendedor não encontrado'}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Informações do Responsável (apenas para menores de idade) */}
          {cliente.menor_idade && (
            <div className="mt-6 sm:mt-8">
              <h4 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-3 sm:mb-4 flex items-center">
                <Shield className="w-4 h-4 sm:w-5 sm:h-5 mr-2 flex-shrink-0" />
                <span className="truncate">Informações do Responsável</span>
              </h4>
              
              {isLoadingResponsaveis ? (
                <div className="animate-pulse space-y-3">
                  <div className="bg-gray-200 dark:bg-gray-600 h-4 w-48 rounded"></div>
                  <div className="bg-gray-200 dark:bg-gray-600 h-4 w-32 rounded"></div>
                </div>
              ) : responsaveis.length > 0 ? (
                <div className="space-y-4">
                  {responsaveis.map((responsavel: Responsavel) => (
                    <div key={responsavel.id} className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 sm:p-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                        <div className="min-w-0">
                          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Nome</p>
                          <p className="text-sm sm:text-base text-gray-900 dark:text-white font-medium break-words">{responsavel.nome}</p>
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">CPF</p>
                          <p className="text-sm sm:text-base text-gray-900 dark:text-white font-medium break-all">{formatCPF(responsavel.cpf)}</p>
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Telefone</p>
                          <p className="text-sm sm:text-base text-gray-900 dark:text-white font-medium break-all">{formatPhoneNumber(responsavel.telefone)}</p>
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Parentesco</p>
                          <p className="text-sm sm:text-base text-gray-900 dark:text-white font-medium">{responsavel.parentesco}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 dark:text-gray-400 text-sm sm:text-base">Nenhum responsável cadastrado.</p>
              )}
            </div>
          )}

          {/* Resumo do Cliente */}
          <div className="mt-6 sm:mt-8 p-3 sm:p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <h4 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Resumo do Cliente
            </h4>
            <p className="text-gray-600 dark:text-gray-300 text-xs sm:text-sm leading-relaxed">
              Cliente cadastrado no sistema em {new Date(cliente.created_at).toLocaleDateString('pt-BR')}. 
              Status atual: <span className="font-medium">{cliente.ativo ? 'Ativo' : 'Inativo'}</span>.
              {cliente.ativo 
                ? ' Cliente ativo e disponível para novas entregas.'
                : ' Cliente inativo no momento.'
              }
              {cliente.menor_idade && ' Este cliente é menor de idade e possui responsável cadastrado.'}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end p-4 sm:p-6 border-t border-gray-200 dark:border-gray-700 flex-shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg transition-colors touch-manipulation text-sm sm:text-base"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};

export default ClienteModal;
