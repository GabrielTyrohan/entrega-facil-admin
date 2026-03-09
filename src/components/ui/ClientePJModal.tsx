import { Briefcase, Building2, CreditCard, FileText, Mail, MapPin, Phone, Shield, User, Users, X } from 'lucide-react';
import React from 'react';
import type { Cliente } from '../../hooks/useClientes';
import { useVendedor } from '../../hooks/useVendedores';

interface ClientePJModalProps {
  cliente: Cliente | null;
  isOpen: boolean;
  onClose: () => void;
}

const ClientePJModal: React.FC<ClientePJModalProps> = ({ cliente, isOpen, onClose }) => {
  // Hook para buscar dados do vendedor
  const { data: vendedor } = useVendedor(
    cliente?.vendedor_id || '', 
    { enabled: !!cliente?.vendedor_id && isOpen }
  ) as { data: { nome: string } | null };

  if (!isOpen || !cliente) return null;

  // Formatter functions
  const formatPhoneNumber = (phone?: string) => {
    if (!phone) return 'N/A';
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 11) return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
    if (cleaned.length === 10) return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 6)}-${cleaned.slice(6)}`;
    return phone;
  };

  const formatCNPJ = (cnpj?: string) => {
    if (!cnpj) return 'N/A';
    const cleaned = cnpj.replace(/\D/g, '');
    if (cleaned.length === 14) {
      return `${cleaned.slice(0, 2)}.${cleaned.slice(2, 5)}.${cleaned.slice(5, 8)}/${cleaned.slice(8, 12)}-${cleaned.slice(12)}`;
    }
    return cnpj;
  };

  const formatCPF = (cpf?: string) => {
    if (!cpf) return 'N/A';
    const cleaned = cpf.replace(/\D/g, '');
    if (cleaned.length === 11) {
      return `${cleaned.slice(0, 3)}.${cleaned.slice(3, 6)}.${cleaned.slice(6, 9)}-${cleaned.slice(9)}`;
    }
    return cpf;
  };

  const formatCurrency = (value?: number | string) => {
    if (value === undefined || value === null || value === '') return 'N/A';
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(numValue)) return 'N/A';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(numValue);
  };

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };

  // Mapeamento de campos PJ
  // No banco: nome = Razão Social, sobrenome = Nome Fantasia
  const razaoSocial = cliente.razao_social || cliente.nome;
  const nomeFantasia = cliente.nome_fantasia || cliente.sobrenome;
  const cnpj = cliente.cnpj || cliente.cpf; // Fallback se cnpj vazio mas cpf tiver valor (workaround antigo)

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4"
      onClick={handleBackdropClick}
    >
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-xs sm:max-w-lg md:max-w-2xl lg:max-w-4xl max-h-[95vh] sm:max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900 dark:text-white truncate pr-4">
            Detalhes da Empresa (PJ)
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors touch-manipulation flex-shrink-0">
            <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1">
          {/* Header Profile */}
          <div className="flex flex-col sm:flex-row sm:items-center mb-6 space-y-4 sm:space-y-0">
            <div className="w-12 h-12 sm:w-16 sm:h-16 bg-blue-600 rounded-lg flex items-center justify-center text-white text-lg sm:text-2xl font-bold sm:mr-4 flex-shrink-0 mx-auto sm:mx-0">
              <Building2 className="w-6 h-6 sm:w-8 sm:h-8" />
            </div>
            <div className="text-center sm:text-left min-w-0">
              <h3 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white truncate">
                {razaoSocial}
              </h3>
              <p className="text-gray-500 dark:text-gray-400 text-sm font-medium">{nomeFantasia}</p>
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mt-2">
                <span className={`inline-flex px-2 sm:px-3 py-1 text-xs sm:text-sm font-semibold rounded-full ${
                  cliente.ativo 
                    ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                    : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
                }`}>
                  {cliente.ativo ? 'Ativo' : 'Inativo'}
                </span>
                {cliente.sincronizado && (
                  <span className="inline-flex px-2 sm:px-3 py-1 text-xs sm:text-sm font-semibold rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400">
                    Sincronizado
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
            
            {/* Dados da Empresa */}
            <div className="space-y-4">
              <h4 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center">
                <Building2 className="w-4 h-4 sm:w-5 sm:h-5 mr-2 flex-shrink-0" />
                <span className="truncate">Dados da Empresa</span>
              </h4>
              
              <div className="space-y-3">
                <div className="flex items-start space-x-3">
                  <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg flex-shrink-0">
                    <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">CNPJ</p>
                    <p className="text-sm sm:text-base text-gray-900 dark:text-white font-medium break-all">{formatCNPJ(cnpj)}</p>
                  </div>
                </div>

                <div className="flex items-start space-x-3">
                  <div className="p-2 bg-purple-100 dark:bg-purple-900/20 rounded-lg flex-shrink-0">
                    <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Inscrição Estadual</p>
                    <p className="text-sm sm:text-base text-gray-900 dark:text-white font-medium break-all">{cliente.inscricao_estadual || 'Isento/Não informado'}</p>
                  </div>
                </div>

                {cliente.inscricao_municipal && (
                  <div className="flex items-start space-x-3">
                    <div className="p-2 bg-indigo-100 dark:bg-indigo-900/20 rounded-lg flex-shrink-0">
                      <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Inscrição Municipal</p>
                      <p className="text-sm sm:text-base text-gray-900 dark:text-white font-medium break-all">{cliente.inscricao_municipal}</p>
                    </div>
                  </div>
                )}
                
                <div className="flex items-start space-x-3">
                  <div className="p-2 bg-green-100 dark:bg-green-900/20 rounded-lg flex-shrink-0">
                    <CreditCard className="w-4 h-4 sm:w-5 sm:h-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Faturamento Mensal</p>
                    <p className="text-sm sm:text-base text-gray-900 dark:text-white font-medium">{formatCurrency(cliente.renda_mensal)}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Endereço e Contato */}
            <div className="space-y-4">
              <h4 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center">
                <MapPin className="w-4 h-4 sm:w-5 sm:h-5 mr-2 flex-shrink-0" />
                <span className="truncate">Endereço e Contato</span>
              </h4>

              <div className="space-y-3">
                <div className="flex items-start space-x-3">
                  <div className="p-2 bg-orange-100 dark:bg-orange-900/20 rounded-lg flex-shrink-0">
                    <MapPin className="w-4 h-4 sm:w-5 sm:h-5 text-orange-600 dark:text-orange-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Endereço Completo</p>
                    <p className="text-sm sm:text-base text-gray-900 dark:text-white font-medium">
                      {cliente.endereco}
                      {cliente.numero && `, ${cliente.numero}`}
                      {cliente.bairro || cliente.Bairro && ` - ${cliente.bairro || cliente.Bairro}`}
                    </p>
                    {(cliente.cidade || cliente.estado) && (
                      <p className="text-sm text-gray-600 dark:text-gray-300">
                        {cliente.cidade || cliente.Cidade}{cliente.cidade && cliente.estado && ' - '}{cliente.estado || cliente.Estado}
                      </p>
                    )}
                    {cliente.complemento && (
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        Comp: {cliente.complemento}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-start space-x-3">
                  <div className="p-2 bg-teal-100 dark:bg-teal-900/20 rounded-lg flex-shrink-0">
                    <Phone className="w-4 h-4 sm:w-5 sm:h-5 text-teal-600 dark:text-teal-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Telefone Comercial</p>
                    <p className="text-sm sm:text-base text-gray-900 dark:text-white font-medium">{formatPhoneNumber(cliente.telefone)}</p>
                  </div>
                </div>

                {cliente.email && (
                  <div className="flex items-start space-x-3">
                    <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg flex-shrink-0">
                      <Mail className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">E-mail</p>
                      <p className="text-sm sm:text-base text-gray-900 dark:text-white font-medium break-all">{cliente.email}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Responsável */}
            <div className="space-y-4 lg:col-span-2">
              <h4 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center border-t border-gray-200 dark:border-gray-700 pt-4">
                <User className="w-4 h-4 sm:w-5 sm:h-5 mr-2 flex-shrink-0" />
                <span className="truncate">Dados do Responsável</span>
              </h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <div className="flex items-start space-x-3">
                  <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg flex-shrink-0">
                    <User className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600 dark:text-gray-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Nome</p>
                    <p className="text-sm sm:text-base text-gray-900 dark:text-white font-medium">{cliente.responsavel_pj_nome || 'N/A'}</p>
                  </div>
                </div>

                <div className="flex items-start space-x-3">
                  <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg flex-shrink-0">
                    <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600 dark:text-gray-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">CPF</p>
                    <p className="text-sm sm:text-base text-gray-900 dark:text-white font-medium">{formatCPF(cliente.responsavel_pj_cpf)}</p>
                  </div>
                </div>

                <div className="flex items-start space-x-3">
                  <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg flex-shrink-0">
                    <Briefcase className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600 dark:text-gray-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Cargo</p>
                    <p className="text-sm sm:text-base text-gray-900 dark:text-white font-medium">{cliente.responsavel_pj_cargo || 'N/A'}</p>
                  </div>
                </div>

                <div className="flex items-start space-x-3">
                  <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg flex-shrink-0">
                    <Phone className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600 dark:text-gray-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Telefone do Responsável</p>
                    <p className="text-sm sm:text-base text-gray-900 dark:text-white font-medium">{formatPhoneNumber(cliente.responsavel_pj_telefone)}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Vendedor */}
            <div className="space-y-4 lg:col-span-2">
               <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg flex items-center justify-between">
                 <div className="flex items-center space-x-3">
                   <div className="p-2 bg-indigo-100 dark:bg-indigo-900/20 rounded-lg">
                     <Users className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                   </div>
                   <div>
                     <p className="text-xs text-gray-500 dark:text-gray-400">Vendedor Responsável</p>
                     <p className="text-sm font-semibold text-gray-900 dark:text-white">
                       {vendedor?.nome || 'Não vinculado'}
                     </p>
                   </div>
                 </div>
                 <div className="flex items-center space-x-3">
                    <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
                      <Shield className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Observações</p>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {cliente.ponto_referencia || 'Nenhuma'}
                      </p>
                    </div>
                 </div>
               </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};

export default ClientePJModal;
