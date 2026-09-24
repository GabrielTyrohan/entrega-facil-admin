import { Search, X } from 'lucide-react';
import React from 'react';

interface TableToolbarProps {
  search?: {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    ariaLabel?: string;
  };
  filters?: React.ReactNode;
  resultText?: React.ReactNode;
  trailingInfo?: React.ReactNode;
  onClearFilters?: () => void;
  hasActiveFilters?: boolean;
  clearLabel?: string;
}

const TableToolbar: React.FC<TableToolbarProps> = ({
  search,
  filters,
  resultText,
  trailingInfo,
  onClearFilters,
  hasActiveFilters = false,
  clearLabel = 'Limpar filtros',
}) => {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-4 sm:p-6 shadow-sm border border-gray-200 dark:border-gray-700">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        {search && (
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder={search.placeholder}
              value={search.value}
              onChange={(e) => search.onChange(e.target.value)}
              aria-label={search.ariaLabel || search.placeholder}
              className="pl-10 pr-4 py-2.5 sm:py-2 w-full border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent touch-manipulation"
            />
          </div>
        )}
        {filters}
      </div>

      <div className="mt-3 sm:mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between text-xs sm:text-sm text-gray-600 dark:text-gray-400">
        <span>{resultText}</span>
        <div className="flex items-center gap-3">
          {hasActiveFilters && onClearFilters && (
            <button
              type="button"
              onClick={onClearFilters}
              className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline"
            >
              <X className="w-4 h-4" />
              {clearLabel}
            </button>
          )}
          {trailingInfo && <span>{trailingInfo}</span>}
        </div>
      </div>
    </div>
  );
};

export default TableToolbar;
