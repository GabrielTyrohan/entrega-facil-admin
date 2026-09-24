import React from 'react';

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children?: React.ReactNode;
}

const PageHeader: React.FC<PageHeaderProps> = ({ title, description, actions, children }) => {
  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="min-w-0 space-y-1">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
            {title}
          </h1>
          {description && (
            <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
              {description}
            </p>
          )}
        </div>
        {actions && (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end sm:shrink-0">
            {actions}
          </div>
        )}
      </div>
      {children}
    </div>
  );
};

export default PageHeader;
