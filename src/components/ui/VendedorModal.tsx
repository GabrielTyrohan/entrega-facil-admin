import React, { useEffect } from 'react';
import { X, Mail, Phone, Calendar, DollarSign, TrendingUp } from 'lucide-react';
import type { Vendedor } from '../../hooks/useVendedores';
import { useTotalVendasPorVendedor } from '../../hooks/useDashboard';

interface VendedorModalProps {
  vendedor: Vendedor | null;
  isOpen: boolean;
  onClose: () => void;
}

const VendedorModal: React.FC<VendedorModalProps> = ({ vendedor, isOpen, onClose }) => {
  // CORREÇÃO: Mover todos os hooks ANTES de qualquer early return
  // Hook para buscar total de vendas do vendedor
  const { data: totalVendas, isLoading: isLoadingVendas } = useTotalVendasPorVendedor(
    vendedor?.id || '', 
    { enabled: !!vendedor?.id && isOpen }
  );

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

  // Early return APÓS todos os hooks
  if (!isOpen || !vendedor) return null;

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
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-xs sm:max-w-lg md:max-w-2xl max-h-[95vh] sm:max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900 dark:text-white truncate pr-4">
            Detalhes do Vendedor
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
            <div className="w-12 h-12 sm:w-16 sm:h-16 bg-blue-600 rounded-full flex items-center justify-center text-white text-lg sm:text-2xl font-bold sm:mr-4 flex-shrink-0 mx-auto sm:mx-0">
              {vendedor.nome.charAt(0).toUpperCase()}
            </div>
            <div className="text-center sm:text-left min-w-0">
              <h3 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white truncate">
                {vendedor.nome}
              </h3>
              <p className="text-gray-500 dark:text-gray-400 text-sm">ID: {vendedor.id.slice(0, 8)}...</p>
              <span className={`inline-flex px-2 sm:px-3 py-1 text-xs sm:text-sm font-semibold rounded-full mt-2 ${
                vendedor.ativo 
                  ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                  : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
              }`}>
                {vendedor.ativo ? 'Ativo' : 'Inativo'}
              </span>
            </div>
          </div>

          {/* Information Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
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
                    <p className="text-sm sm:text-base text-gray-900 dark:text-white font-medium break-all">{formatPhone(vendedor.telefone)}</p>
                  </div>
                </div>

                {vendedor.email && (
                  <div className="flex items-start space-x-3">
                    <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg flex-shrink-0">
                      <Mail className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Email</p>
                      <p className="text-sm sm:text-base text-gray-900 dark:text-white font-medium break-all">{vendedor.email}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Informações Profissionais */}
            <div className="space-y-4">
              <h4 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center">
                <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 mr-2 flex-shrink-0" />
                <span className="truncate">Informações Profissionais</span>
              </h4>
              
              <div className="space-y-3">
                <div className="flex items-start space-x-3">
                  <div className="p-2 bg-purple-100 dark:bg-purple-900/20 rounded-lg flex-shrink-0">
                    <Calendar className="w-4 h-4 sm:w-5 sm:h-5 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Data de Cadastro</p>
                    <p className="text-sm sm:text-base text-gray-900 dark:text-white font-medium">
                      {new Date(vendedor.created_at).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-3">
                  <div className="p-2 bg-yellow-100 dark:bg-yellow-900/20 rounded-lg flex-shrink-0">
                    <DollarSign className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-600 dark:text-yellow-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Total de Vendas</p>
                    {isLoadingVendas ? (
                      <div className="animate-pulse bg-gray-200 dark:bg-gray-600 h-4 w-24 rounded"></div>
                    ) : (
                      <p className="text-sm sm:text-base text-gray-900 dark:text-white font-medium">
                        {totalVendas ? `R$ ${totalVendas.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : 'R$ 0,00'}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Resumo do Vendedor */}
          <div className="mt-6 sm:mt-8 p-3 sm:p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <h4 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Resumo do Vendedor
            </h4>
            <p className="text-gray-600 dark:text-gray-300 text-xs sm:text-sm leading-relaxed">
              Vendedor cadastrado no sistema em {new Date(vendedor.created_at).toLocaleDateString('pt-BR')}. 
              Status atual: <span className="font-medium">{vendedor.ativo ? 'Ativo' : 'Inativo'}</span>.
              {vendedor.ativo 
                ? ' Vendedor ativo e disponível para novas vendas.'
                : ' Vendedor inativo no momento.'
              }
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

export default VendedorModal;
