import React from 'react';
import {
  FISCAL_STATUS_LABEL,
  normalizarFiscalStatus,
  type FiscalStatus,
} from '../services/produtoFiscalService';

const FISCAL_STATUS_STYLE: Record<FiscalStatus, string> = {
  pendente_revisao:
    'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400',
  em_revisao: 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400',
  validado: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400',
  bloqueado: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400',
};

interface FiscalStatusBadgeProps {
  status?: string | null;
  className?: string;
}

const FiscalStatusBadge: React.FC<FiscalStatusBadgeProps> = ({ status, className = '' }) => {
  const normalizado = normalizarFiscalStatus(status as FiscalStatus | undefined);
  const semStatusDefinido =
    status !== 'pendente_revisao' &&
    status !== 'em_revisao' &&
    status !== 'validado' &&
    status !== 'bloqueado';
  return (
    <span
      title={
        semStatusDefinido
          ? 'Sem status definido no cadastro — tratar como pendente de revisão'
          : FISCAL_STATUS_LABEL[normalizado]
      }
      className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${FISCAL_STATUS_STYLE[normalizado]} ${className}`}
    >
      {FISCAL_STATUS_LABEL[normalizado]}
    </span>
  );
};

export default FiscalStatusBadge;
