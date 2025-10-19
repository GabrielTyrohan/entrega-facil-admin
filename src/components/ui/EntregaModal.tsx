import React, { useEffect } from 'react';
import { X, Package, User, MapPin, Calendar, DollarSign, Phone, Mail, FileText, CreditCard } from 'lucide-react';
import { EntregaComDetalhes } from '../../services/entregaService';

interface EntregaModalProps {
  entrega: EntregaComDetalhes | null;
  isOpen: boolean;
  onClose: () => void;
}

const EntregaModal: React.FC<EntregaModalProps> = ({ entrega, isOpen, onClose }) => {
  // Implementar fechamento com Esc
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen || !entrega) return null;

  // Função para formatar data
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  // Função para formatar moeda
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  // Função para formatar telefone
  const formatPhone = (phone?: string) => {
    if (!phone) return 'N/A';
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 11) {
      return cleaned.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
    } else if (cleaned.length === 10) {
      return cleaned.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
    }
    return phone;
  };

  // Função para formatar CPF
  const formatCPF = (cpf?: string) => {
    if (!cpf || cpf.trim() === '') {
      return 'N/A';
    }
    
    // Converter para string se não for
    const cpfString = String(cpf);
    
    const cleaned = cpfString.replace(/\D/g, '');
    
    if (cleaned.length === 11) {
      return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    }
    
    // Se o CPF não tem 11 dígitos, retorna como incompleto
    return cleaned + ' (incompleto)';
  };

  // Função para obter cor do status
  const getStatusColor = () => {
    return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400';
  };

  // Função para obter label do status
  const getStatusLabel = () => {
    return 'Entregue';
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
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-xs sm:max-w-lg md:max-w-3xl max-h-[95vh] sm:max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900 dark:text-white truncate pr-4">
            Detalhes da Entrega
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
          {/* Status e ID */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 space-y-3 sm:space-y-0">
            <div className="text-center sm:text-left">
              <h3 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white">
                Entrega #{entrega.id.slice(0, 8)}...
              </h3>
              <p className="text-gray-500 dark:text-gray-400 text-sm">
                Criada em {formatDate(entrega.created_at)}
              </p>
            </div>
            <span className={`inline-flex px-3 py-1 text-xs sm:text-sm font-semibold rounded-full ${getStatusColor()}`}>
              {getStatusLabel()}
            </span>
          </div>

          {/* Information Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
            {/* Informações do Cliente */}
            <div className="space-y-4">
              <h4 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center">
                <User className="w-4 h-4 sm:w-5 sm:h-5 mr-2 flex-shrink-0" />
                <span className="truncate">Informações do Cliente</span>
              </h4>
              
              <div className="space-y-3">
                <div className="flex items-start space-x-3">
                  <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg flex-shrink-0">
                    <User className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Nome</p>
                    <p className="text-sm sm:text-base text-gray-900 dark:text-white font-medium break-words">
                      {entrega.cliente?.nome || 'N/A'}
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-3">
                  <div className="p-2 bg-green-100 dark:bg-green-900/20 rounded-lg flex-shrink-0">
                    <Phone className="w-4 h-4 sm:w-5 sm:h-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Telefone</p>
                    <p className="text-sm sm:text-base text-gray-900 dark:text-white font-medium break-all">
                      {formatPhone(entrega.cliente?.telefone)}
                    </p>
                  </div>
                </div>

                {entrega.cliente?.email && (
                  <div className="flex items-start space-x-3">
                    <div className="p-2 bg-purple-100 dark:bg-purple-900/20 rounded-lg flex-shrink-0">
                      <Mail className="w-4 h-4 sm:w-5 sm:h-5 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Email</p>
                      <p className="text-sm sm:text-base text-gray-900 dark:text-white font-medium break-all">
                        {entrega.cliente.email}
                      </p>
                    </div>
                  </div>
                )}

                <div className="flex items-start space-x-3">
                  <div className="p-2 bg-orange-100 dark:bg-orange-900/20 rounded-lg flex-shrink-0">
                    <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-orange-600 dark:text-orange-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">CPF</p>
                    <p className="text-sm sm:text-base text-gray-900 dark:text-white font-medium">
                      {formatCPF(entrega.cliente?.cpf)}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Informações do Produto */}
            <div className="space-y-4">
              <h4 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center">
                <Package className="w-4 h-4 sm:w-5 sm:h-5 mr-2 flex-shrink-0" />
                <span className="truncate">Informações do Produto</span>
              </h4>
              
              <div className="space-y-3">
                <div className="flex items-start space-x-3">
                  <div className="p-2 bg-indigo-100 dark:bg-indigo-900/20 rounded-lg flex-shrink-0">
                    <Package className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Produto</p>
                    <p className="text-sm sm:text-base text-gray-900 dark:text-white font-medium break-words">
                      {entrega.produto?.nome || 'N/A'}
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-3">
                  <div className="p-2 bg-yellow-100 dark:bg-yellow-900/20 rounded-lg flex-shrink-0">
                    <DollarSign className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-600 dark:text-yellow-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Valor</p>
                    <p className="text-sm sm:text-base text-gray-900 dark:text-white font-medium">
                      {formatCurrency(entrega.valor)}
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-3">
                  <div className="p-2 bg-red-100 dark:bg-red-900/20 rounded-lg flex-shrink-0">
                    <Calendar className="w-4 h-4 sm:w-5 sm:h-5 text-red-600 dark:text-red-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Data de Entrega</p>
                    <p className="text-sm sm:text-base text-gray-900 dark:text-white font-medium">
                      {formatDate(entrega.data_entrega)}
                    </p>
                  </div>
                </div>

                {entrega.vendedor && (
                  <div className="flex items-start space-x-3">
                    <div className="p-2 bg-teal-100 dark:bg-teal-900/20 rounded-lg flex-shrink-0">
                      <User className="w-4 h-4 sm:w-5 sm:h-5 text-teal-600 dark:text-teal-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Vendedor</p>
                      <p className="text-sm sm:text-base text-gray-900 dark:text-white font-medium break-words">
                        {entrega.vendedor.nome}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Endereço de Entrega */}
          <div className="mt-6 lg:mt-8">
            <h4 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center">
              <MapPin className="w-4 h-4 sm:w-5 sm:h-5 mr-2 flex-shrink-0" />
              <span className="truncate">Endereço de Entrega</span>
            </h4>
            
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 sm:p-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Endereço</p>
                  <p className="text-sm sm:text-base text-gray-900 dark:text-white font-medium break-words">
                    {entrega.endereco_entrega?.rua || 'N/A'}
                  </p>
                </div>
                <div>
                  <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">CEP</p>
                  <p className="text-sm sm:text-base text-gray-900 dark:text-white font-medium">
                    {entrega.endereco_entrega?.cep || 'N/A'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Informações de Pagamento */}
          {entrega.pagamento && (
            <div className="mt-6 lg:mt-8">
              <h4 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center">
                <CreditCard className="w-4 h-4 sm:w-5 sm:h-5 mr-2 flex-shrink-0" />
                <span className="truncate">Informações de Pagamento</span>
              </h4>
              
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 sm:p-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div>
                    <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Método</p>
                    <p className="text-sm sm:text-base text-gray-900 dark:text-white font-medium">
                      {entrega.pagamento.metodo_pagamento || 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Status</p>
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor()}`}>
                      {getStatusLabel()}
                    </span>
                  </div>
                  <div>
                    <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Valor Pago</p>
                    <p className="text-sm sm:text-base text-gray-900 dark:text-white font-medium">
                      {formatCurrency(entrega.pagamento.valor)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Data do Pagamento</p>
                    <p className="text-sm sm:text-base text-gray-900 dark:text-white font-medium">
                      {entrega.pagamento.data_pagamento ? formatDate(entrega.pagamento.data_pagamento) : 'N/A'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Observações */}
          {entrega.observacoes && (
            <div className="mt-6 lg:mt-8">
              <h4 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-3">
                Observações
              </h4>
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 sm:p-4">
                <p className="text-sm sm:text-base text-gray-900 dark:text-white leading-relaxed break-words">
                  {entrega.observacoes}
                </p>
              </div>
            </div>
          )}
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

export default EntregaModal;
