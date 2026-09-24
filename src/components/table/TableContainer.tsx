import React from 'react';

interface TableContainerProps {
  children: React.ReactNode;
  className?: string;
}

const TableContainer: React.FC<TableContainerProps> = ({ children, className = '' }) => {
  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden ${className}`}>
      <div className="overflow-auto max-h-[70vh]">
        {children}
      </div>
    </div>
  );
};

export default TableContainer;
