import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalCount: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  isLoading?: boolean;
}

export const Pagination = ({
  currentPage,
  totalPages,
  totalCount,
  pageSize,
  onPageChange,
  isLoading = false,
}: PaginationProps) => {
  const canGoBack = currentPage > 0;
  const canGoForward = currentPage < totalPages - 1;

  // Calcular range visível
  const from = currentPage * pageSize + 1;
  const to = Math.min((currentPage + 1) * pageSize, totalCount);

  if (totalPages <= 1) return null; // Não mostrar se só tem 1 página

  return (
    <div className="flex items-center justify-between mt-6 px-4 py-3 
                    bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
      {/* Info de registros */}
      <div className="text-sm text-gray-700 dark:text-gray-300">
        Mostrando <span className="font-medium">{from}</span> a{' '}
        <span className="font-medium">{to}</span> de{' '}
        <span className="font-medium">{totalCount}</span> registros
      </div>

      {/* Controles */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={!canGoBack || isLoading}
          className="flex items-center gap-1 px-3 py-2 text-sm font-medium 
                     border border-gray-300 dark:border-gray-600 rounded-lg 
                     hover:bg-gray-50 dark:hover:bg-gray-700 
                     disabled:opacity-50 disabled:cursor-not-allowed 
                     transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          <span className="hidden sm:inline">Anterior</span>
        </button>

        {/* Números de página (se houver espaço) */}
        <div className="hidden md:flex items-center gap-1">
          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
            // Mostrar até 5 páginas ao redor da atual
            let pageNum;
            if (totalPages <= 5) {
              pageNum = i;
            } else if (currentPage < 3) {
              pageNum = i;
            } else if (currentPage > totalPages - 3) {
              pageNum = totalPages - 5 + i;
            } else {
              pageNum = currentPage - 2 + i;
            }

            return (
              <button
                key={pageNum}
                onClick={() => onPageChange(pageNum)}
                className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                  pageNum === currentPage
                    ? 'bg-blue-600 text-white'
                    : 'border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                {pageNum + 1}
              </button>
            );
          })}
        </div>

        {/* Indicador mobile */}
        <span className="md:hidden px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300">
          Página {currentPage + 1} de {totalPages}
        </span>

        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={!canGoForward || isLoading}
          className="flex items-center gap-1 px-3 py-2 text-sm font-medium 
                     border border-gray-300 dark:border-gray-600 rounded-lg 
                     hover:bg-gray-50 dark:hover:bg-gray-700 
                     disabled:opacity-50 disabled:cursor-not-allowed 
                     transition-colors"
        >
          <span className="hidden sm:inline">Próxima</span>
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
