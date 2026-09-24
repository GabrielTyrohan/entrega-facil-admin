import { AlertCircle } from 'lucide-react';
import React from 'react';

interface TableErrorStateProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
  retryLabel?: string;
}

const TableErrorState: React.FC<TableErrorStateProps> = ({
  title = 'Não foi possível carregar os dados.',
  description = 'Ocorreu um erro ao buscar os dados. Tente novamente.',
  onRetry,
  retryLabel = 'Tentar novamente',
}) => {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-8 shadow-sm border border-gray-200 dark:border-gray-700">
      <div className="text-center py-12">
        <div className="mx-auto w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-4">
          <AlertCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
        </div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">{title}</h3>
        <p className="text-gray-500 dark:text-gray-400 mb-6">{description}</p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
          >
            {retryLabel}
          </button>
        )}
      </div>
    </div>
  );
};

export default TableErrorState;
