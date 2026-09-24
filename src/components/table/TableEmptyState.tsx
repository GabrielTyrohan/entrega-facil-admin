import { Inbox } from 'lucide-react';
import React from 'react';

interface TableEmptyStateProps {
  colSpan: number;
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

const TableEmptyState: React.FC<TableEmptyStateProps> = ({
  colSpan,
  icon,
  title,
  description,
  action,
}) => {
  return (
    <tr>
      <td colSpan={colSpan} className="px-3 sm:px-6 py-8 sm:py-12 text-center">
        <div className="flex flex-col items-center">
          <div className="mx-auto w-12 h-12 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-3">
            {icon || <Inbox className="w-6 h-6 text-gray-400" />}
          </div>
          <p className="text-sm sm:text-base font-medium text-gray-900 dark:text-white">{title}</p>
          {description && (
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{description}</p>
          )}
          {action && <div className="mt-4">{action}</div>}
        </div>
      </td>
    </tr>
  );
};

export default TableEmptyState;
