import { X } from 'lucide-react';
import React, { useEffect, useId } from 'react';
import { useModalFocus } from './useModalFocus';

type ModalSize = 'sm' | 'md' | 'lg' | 'xl';

const sizeClasses: Record<ModalSize, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
};

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  className?: string;
  size?: ModalSize;
  footer?: React.ReactNode;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  className = '',
  size = 'md',
  footer,
}) => {
  const titleId = useId();
  const panelRef = useModalFocus<HTMLDivElement>(isOpen);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.body.style.overflow = 'hidden';
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.body.style.overflow = 'unset';
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-8 animate-in fade-in duration-200"
      onClick={handleBackdropClick}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        tabIndex={-1}
        className={`bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full ${sizeClasses[size]} flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200 ${className}`}
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-700 shrink-0">
          {title && (
            <h3 id={titleId} className="text-lg font-semibold text-gray-900 dark:text-white">
              {title}
            </h3>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="p-2.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-4 text-gray-900 dark:text-gray-300 overflow-y-auto flex-1">
          {children}
        </div>

        {footer && (
          <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-3 p-4 border-t border-gray-100 dark:border-gray-700 shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};
