import { Skeleton } from '@/components/ui/Skeleton';
import { useAuth } from '@/contexts/AuthContext';
import { useCountUp } from '@/hooks/useCountUp';
import { useDashboard, useIsVisible } from '@/hooks/useDashboard';
import { supabase } from '@/lib/supabase';
import { EstoqueAtual } from '@/types/estoque';
import { useQueryClient } from '@tanstack/react-query';
import {
  Activity, AlertTriangle, ArrowRight, Calendar,
  DollarSign, FileText, HelpCircle, Package,
  TrendingDown, TrendingUp, Truck, Users
} from 'lucide-react';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { Link } from 'react-router-dom';

// ─── Tooltip ──────────────────────────────────────────────────────────────────
const Tooltip: React.FC<{ text: string }> = ({ text }) => {
  const [visible, setVisible] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);

  const show = () => {
    if (!btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    setPos({ top: rect.top - 8, left: rect.left + rect.width / 2 });
    setVisible(true);
  };

  return (
    <div className="relative inline-flex items-center ml-1">
      <button
        ref={btnRef}
        onMouseEnter={show}
        onMouseLeave={() => setVisible(false)}
        onFocus={show}
        onBlur={() => setVisible(false)}
        onClick={() => visible ? setVisible(false) : show()}
        className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors flex-shrink-0"
        aria-label="Informação"
        type="button"
      >
        <HelpCircle className="w-3.5 h-3.5" />
      </button>
      {visible && typeof window !== 'undefined' && ReactDOM.createPortal(
        <div
          className="fixed z-[9999] w-52 bg-gray-900 dark:bg-gray-700 text-white text-xs rounded-lg px-3 py-2 shadow-xl pointer-events-none leading-relaxed -translate-x-1/2 -translate-y-full"
          style={{ top: pos.top, left: pos.left }}
        >
          {text}
          <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900 dark:border-t-gray-700" />
        </div>,
        document.body
      )}
    </div>
  );
};

// ─── Badge ────────────────────────────────────────────────────────────────────
const Badge = ({
  children, variant
}: { children: React.ReactNode; variant: 'default' | 'destructive' | 'warning' | 'success' | 'outline' }) => {
  const styles = {
    default:     'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
    destructive: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
    warning:     'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
    success:     'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
    outline:     'border border-gray-200 text-gray-800 dark:border-gray-700 dark:text-gray-300',
  };
  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[variant]}`}>
      {children}
    </span>
  );
};

// ─── StatCard ─────────────────────────────────────────────────────────────────
interface StatCardProps {
  title: string;
  value: string;
  change?: string;
  changeType?: 'increase' | 'decrease' | 'neutral';
  icon: React.ComponentType<any>;
  color: string;
  isLoading: boolean;
  showChange?: boolean;
  subtitle?: string;
  tooltip?: string;
}

const StatCard: React.FC<StatCardProps> = ({
  title, value, change, changeType, icon: Icon,
  color, isLoading, showChange = false, subtitle, tooltip
}) => (
  <div className="bg-white dark:bg-gray-800 rounded-lg p-4 sm:p-6 shadow-sm border border-gray-200 dark:border-gray-700">
    {isLoading ? (
      <div className="flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <Skeleton className="h-4 w-24 mb-2" />
          <Skeleton className="h-7 w-20 mb-2" />
          {showChange && <Skeleton className="h-4 w-24 mt-2" />}
        </div>
        <Skeleton className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg ml-3 flex-shrink-0" />
      </div>
    ) : (
      <div className="flex items-center justify-between">
        <div className="flex-1 min-w-0 animate-fade-in-up">
          <div className="flex items-center gap-0.5 mb-1">
            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 truncate">{title}</p>
            {tooltip && <Tooltip text={tooltip} />}
          </div>
          <p className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-white break-words">{value}</p>
          {subtitle && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{subtitle}</p>
          )}
          {showChange && change && (
            <div className="flex items-center mt-2">
              <TrendingUp className={`w-3 h-3 sm:w-4 sm:h-4 mr-1 flex-shrink-0 ${
                changeType === 'increase' ? 'text-green-500' :
                changeType === 'decrease' ? 'text-red-500' : 'text-gray-500'
              }`} />
              <span className={`text-xs sm:text-sm font-medium ${
                changeType === 'increase' ? 'text-green-600' :
                changeType === 'decrease' ? 'text-red-600' : 'text-gray-500'
              }`}>{change}</span>
              <span className="text-xs text-gray-500 dark:text-gray-400 ml-1 hidden sm:inline">
                vs mês anterior
              </span>
            </div>
          )}
        </div>
        <div className={`w-10 h-10 sm:w-12 sm:h-12 ${color} rounded-lg flex items-center justify-center flex-shrink-0 ml-3`}>
          <Icon className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
        </div>
      </div>
    )}
  </div>
);

// ─── InadimplenciaCard ────────────────────────────────────────────────────────
const InadimplenciaCard: React.FC<{
  data: { faixas: Record<string, number>; totais: Record<string, number> } | null;
  isLoading: boolean;
}> = ({ data, isLoading }) => {
  const { ref, isVisible } = useIsVisible();
  const fmt = (v: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  const faixas = [
    { key: 'ate30',   label: 'Até 30 dias', color: 'bg-yellow-400', textColor: 'text-yellow-700 dark:text-yellow-400' },
    { key: 'de30a60', label: '30–60 dias',  color: 'bg-orange-400', textColor: 'text-orange-700 dark:text-orange-400' },
    { key: 'de60a90', label: '60–90 dias',  color: 'bg-red-400',    textColor: 'text-red-700 dark:text-red-400'       },
    { key: 'acima90', label: '+90 dias',    color: 'bg-red-700',    textColor: 'text-red-900 dark:text-red-300'       },
  ];

  return (
    <div ref={ref} className="bg-white dark:bg-gray-800 rounded-lg p-4 sm:p-6 shadow-sm border border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <TrendingDown className="w-5 h-5 text-red-500" />
          Inadimplência por Faixa
          <Tooltip text="Débitos em aberto agrupados pelo tempo desde o retorno da entrega." />
        </h3>
        <Link to="/devedores" className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 flex items-center gap-1">
          Ver devedores <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
      {isLoading || !isVisible ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}
        </div>
      ) : !data ? (
        <p className="text-sm text-gray-500 text-center py-4">Sem dados</p>
      ) : (
        <div className="space-y-3">
          {faixas.map(f => (
            <div key={f.key} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <div className="flex items-center gap-2">
                <div className={`w-2.5 h-2.5 rounded-full ${f.color}`} />
                <span className="text-sm text-gray-700 dark:text-gray-300">{f.label}</span>
                <span className="text-xs bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300 px-1.5 py-0.5 rounded-full">
                  {data.faixas[f.key] || 0}
                </span>
              </div>
              <span className={`text-sm font-semibold ${f.textColor}`}>
                {fmt(data.totais[f.key] || 0)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── FaturamentoMensalChart ───────────────────────────────────────────────────
interface MonthData { month: string; value: number; height: number; }

const FaturamentoMensalChart: React.FC<{ data: MonthData[]; isLoading: boolean }> = ({ data, isLoading }) => {
  const { ref, isVisible } = useIsVisible();
  const [hoveredColumn, setHoveredColumn] = useState<number | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });

  return (
    <div ref={ref} className="bg-white dark:bg-gray-800 rounded-lg p-4 sm:p-6 shadow-sm border border-gray-200 dark:border-gray-700 relative h-80 flex flex-col">
      <div className="flex items-center gap-2 mb-4 flex-shrink-0">
        <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">
          Faturamento Mensal
        </h3>
        <Tooltip text="Total recebido por mês nos últimos 12 meses, somando pagamentos de entregas e vendas atacado." />
      </div>
      {isLoading || !isVisible ? (
        <div className="flex-1 flex items-end justify-between space-x-1 sm:space-x-2">
          {[...Array(12)].map((_, i) => (
            <Skeleton key={i} className="flex-1 min-w-[20px] rounded-t-sm"
              style={{ height: `${[30, 50, 40, 70, 50, 80, 60, 90, 70, 50, 60, 40][i]}%` }} />
          ))}
        </div>
      ) : (
        <>
          {hoveredColumn !== null && (
            <div
              className="absolute z-10 bg-gray-900 dark:bg-gray-700 text-white px-2 sm:px-3 py-1 sm:py-2 rounded-lg shadow-lg text-xs sm:text-sm font-medium pointer-events-none transform -translate-x-1/2 transition-all duration-150"
              style={{ left: `${tooltipPosition.x}%`, top: `${tooltipPosition.y}px` }}
            >
              <div className="text-center">
                <div className="font-semibold">{data[hoveredColumn]?.month}</div>
                <div className="text-green-400">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
                    .format(data[hoveredColumn]?.value || 0)}
                </div>
              </div>
              <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900 dark:border-t-gray-700" />
            </div>
          )}
          <div className="flex-1 flex items-end justify-between space-x-1 sm:space-x-2 relative min-h-0">
            {data.map((item, index) => (
              <div
                key={index}
                className="flex-1 min-w-[20px] bg-blue-500 rounded-t-sm opacity-80 hover:opacity-100 transition-all duration-200 cursor-pointer hover:bg-blue-600 animate-grow-up"
                style={{ height: `${item.height}%`, animationDelay: `${index * 100}ms` }}
                onMouseEnter={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const containerRect = e.currentTarget.parentElement?.getBoundingClientRect();
                  if (containerRect) {
                    setTooltipPosition({
                      x: ((rect.left + rect.width / 2 - containerRect.left) / containerRect.width) * 100,
                      y: containerRect.height - rect.height - 10,
                    });
                  }
                  setHoveredColumn(index);
                }}
                onMouseLeave={() => setHoveredColumn(null)}
              />
            ))}
          </div>
          <div className="flex justify-between mt-2 text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">
            {data.map((item, index) => (
              <span key={index} className="flex-shrink-0">{item.month}</span>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

// ─── TopVendedoresCard ────────────────────────────────────────────────────────
const TopVendedoresCard: React.FC<{
  data: { nome: string; entregas: number; total: number }[];
  isLoading: boolean;
}> = ({ data, isLoading }) => {
  const { ref, isVisible } = useIsVisible();
  const fmt = (v: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  return (
    <div ref={ref} className="bg-white dark:bg-gray-800 rounded-lg p-4 sm:p-6 shadow-sm border border-gray-200 dark:border-gray-700 h-80 overflow-hidden flex flex-col">
      <div className="flex items-center gap-2 mb-4 flex-shrink-0">
        <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">
          Top Vendedores — Mês Atual
        </h3>
        <Tooltip text="Os 5 vendedores com maior valor total em entregas e vendas atacado no mês corrente." />
      </div>
      {isLoading || !isVisible ? (
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center justify-between">
              <div className="flex items-center flex-1">
                <Skeleton className="w-8 h-8 rounded-full flex-shrink-0" />
                <div className="ml-3 flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
              <Skeleton className="h-4 w-20 ml-2" />
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-3 overflow-y-auto pr-2">
          {data.length > 0 ? data.map((seller, index) => (
            <div
              key={index}
              className="flex items-center justify-between animate-fade-in-up"
              style={{ animationDelay: `${index * 150}ms` }}
            >
              <div className="flex items-center min-w-0 flex-1">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium flex-shrink-0 ${
                  index === 0 ? 'bg-yellow-500' :
                  index === 1 ? 'bg-gray-400'   :
                  index === 2 ? 'bg-orange-600' : 'bg-blue-500'
                }`}>{index + 1}</div>
                <div className="ml-3 min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{seller.nome}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{seller.entregas} entregas</p>
                </div>
              </div>
              <span className="text-sm font-medium text-green-600 flex-shrink-0 ml-2">
                {fmt(seller.total)}
              </span>
            </div>
          )) : (
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">
              Nenhuma entrega no mês
            </p>
          )}
        </div>
      )}
    </div>
  );
};

// ─── TopProdutosCard ──────────────────────────────────────────────────────────
interface TopProdutoItem { id: string; nome: string; unidade: string; qtd: number; }

const TopProdutosCard: React.FC<{ data: TopProdutoItem[]; isLoading: boolean }> = ({ data, isLoading }) => {
  const { ref, isVisible } = useIsVisible();
  const cores = ['bg-orange-500', 'bg-orange-400', 'bg-orange-300', 'bg-orange-200', 'bg-orange-100'];

  return (
    <div ref={ref} className="bg-white dark:bg-gray-800 rounded-lg p-4 sm:p-6 shadow-sm border border-gray-200 dark:border-gray-700 h-80 overflow-hidden flex flex-col">
      <div className="flex items-center gap-2 mb-4 flex-shrink-0">
        <Package className="w-5 h-5 text-orange-500 flex-shrink-0" />
        <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">
          Top Produtos — Mês Atual
        </h3>
        <Tooltip text="Os 5 produtos mais entregues via cestas no mês corrente." />
      </div>
      {isLoading || !isVisible ? (
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="w-5 h-5 rounded flex-shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="flex justify-between">
                  <Skeleton className="h-3.5 w-2/3" />
                  <Skeleton className="h-3.5 w-12" />
                </div>
                <Skeleton className="h-1.5 w-full rounded-full" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-3 overflow-y-auto pr-1 flex-1">
          {data.length > 0 ? data.map((produto, index) => {
            const maxQtd = data[0]?.qtd || 1;
            const pct = Math.round((produto.qtd / maxQtd) * 100);
            return (
              <div
                key={produto.id}
                className="flex items-center gap-3 animate-fade-in-up"
                style={{ animationDelay: `${index * 150}ms` }}
              >
                <span className="w-5 text-xs font-bold text-gray-400 text-center shrink-0">{index + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-gray-700 dark:text-gray-200 truncate">{produto.nome}</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400 shrink-0 ml-2">
                      {produto.qtd} {produto.unidade}
                    </span>
                  </div>
                  <div className="h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${cores[index] ?? 'bg-orange-100'}`}
                      style={{ width: isVisible ? `${pct}%` : '0%' }}
                    />
                  </div>
                </div>
              </div>
            );
          }) : (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center mb-3">
                <Package className="w-6 h-6 text-orange-500" />
              </div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">Sem entregas no mês</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Nenhuma cesta entregue registrada ainda.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ─── EstoqueAlertsCard ────────────────────────────────────────────────────────
const EstoqueAlertsCard: React.FC<{ data: EstoqueAtual[]; isLoading: boolean }> = ({ data, isLoading }) => {
  const { ref, isVisible } = useIsVisible();

  return (
    <div ref={ref} className="bg-white dark:bg-gray-800 rounded-lg p-4 sm:p-6 shadow-sm border border-gray-200 dark:border-gray-700 h-80 overflow-hidden flex flex-col">
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-yellow-500" />
          Alertas de Estoque
          {!isLoading && data?.length > 0 && (
            <span className="bg-red-100 text-red-800 text-xs font-medium px-2.5 py-0.5 rounded dark:bg-red-900 dark:text-red-300">
              {data.length}
            </span>
          )}
          <Tooltip text="Produtos com estoque zerado ou abaixo de 20 unidades que precisam de reposição." />
        </h3>
        <Link to="/estoque/movimentacoes" className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 flex items-center gap-1">
          Ver todos <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
      {isLoading || !isVisible ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex items-center justify-between">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-16 ml-2" />
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-3 overflow-y-auto pr-2 h-full">
          {data?.length > 0 ? data.map((produto, index) => (
            <div
              key={produto.id}
              className="flex items-center justify-between animate-fade-in-up border-b border-gray-100 dark:border-gray-700 pb-2 last:border-0 last:pb-0"
              style={{ animationDelay: `${index * 150}ms` }}
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{produto.produto_nome}</p>
                <p className={`text-xs font-medium ${produto.status_estoque === 'ZERADO' ? 'text-red-600' : 'text-orange-600'}`}>
                  {produto.status_estoque === 'ZERADO' ? 'Estoque Esgotado' : 'Estoque Baixo'}
                </p>
              </div>
              <Badge variant={produto.status_estoque === 'ZERADO' ? 'destructive' : 'warning'}>
                {produto.qtd_estoque} {produto.unidade_medida}
              </Badge>
            </div>
          )) : (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-3">
                <TrendingUp className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">Estoque Saudável</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Nenhum produto abaixo do mínimo.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ─── Dashboard Principal ──────────────────────────────────────────────────────
const Dashboard: React.FC = () => {
  const { userType, permissions, adminId } = useAuth();
  const queryClient = useQueryClient();
  const isExpedicao = userType !== 'admin' && permissions?.expedicao === true;
  const [currentDateTime, setCurrentDateTime] = useState(new Date());

  // ── Realtime ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!adminId) return;

    console.log('🔌 [Realtime] Iniciando canal — adminId:', adminId);

    const refetch = (keys: string[]) => {
      keys.forEach(key =>
        queryClient.refetchQueries({
          predicate: (query) => query.queryKey[0] === key,
          type: 'active',
        })
      );
    };

    const channel = supabase
      .channel(`dashboard-realtime-${adminId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'entregas' }, (payload) => {
        console.log('📦 [Realtime] entregas:', payload.eventType);
        refetch(['dashboard_core', 'dashboard_entregas_hoje', 'dashboard_inadimplencia', 'dashboard_top_vendedores']);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'entregas_cestas_vendedor' }, (payload) => {
        console.log('📦 [Realtime] entregas_cestas_vendedor:', payload.eventType);
        refetch(['dashboard_core', 'dashboard_top_produtos']);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pagamentos' }, (payload) => {
        console.log('📦 [Realtime] pagamentos:', payload.eventType);
        refetch(['dashboard_core', 'dashboard_inadimplencia', 'dashboard_faturamento_mensal']);
      })
      // ✅ Pagamentos do atacado também atualizam o gráfico
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vendas_atacado_pagamentos' }, (payload) => {
        console.log('📦 [Realtime] vendas_atacado_pagamentos:', payload.eventType);
        refetch(['dashboard_faturamento_mensal']);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'movimentacoes_estoque' }, (payload) => {
        console.log('📦 [Realtime] movimentacoes_estoque:', payload.eventType);
        refetch(['dashboard_estoque_alerts']);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'estoque_vendedor' }, (payload) => {
        console.log('📦 [Realtime] estoque_vendedor:', payload.eventType);
        refetch(['dashboard_estoque_alerts']);
      })
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          console.log('✅ [Realtime] Canal conectado com sucesso!');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ [Realtime] Erro no canal:', err);
        } else if (status === 'TIMED_OUT') {
          console.error('⏱️ [Realtime] Timeout na conexão');
        } else if (status === 'CLOSED') {
          console.warn('🔒 [Realtime] Canal fechado');
        } else {
          console.log('ℹ️ [Realtime] Status:', status);
        }
      });

    return () => {
      console.log('🗑️ [Realtime] Canal removido');
      supabase.removeChannel(channel);
    };
  }, [adminId, queryClient]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentDateTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const {
    stats, breakdown, entregasHoje, inadimplencia, vendedores,
    topProdutos, estoqueAlerts, charts, isLoading, someLoading, loadingStates,
  } = useDashboard();

  const faturamentoAnimado = useCountUp({ end: stats?.faturamentoAtual  || 0, duration: 800, decimals: 2 });
  const faltanteAnimado    = useCountUp({ end: stats?.valoresEmFalta    || 0, duration: 800, decimals: 2 });
  const orcamentosAnimado  = useCountUp({ end: breakdown?.fatOrcamentos || 0, duration: 800, decimals: 2 });

  const fmt = (v: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  const formatDateTime = (date: Date) =>
    new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    }).format(date);

  const taxaInadimplencia = useMemo(() => {
    if (!stats?.faturamentoAtual || !stats?.valoresEmFalta) return null;
    return ((stats.valoresEmFalta / stats.faturamentoAtual) * 100).toFixed(1);
  }, [stats]);

  const statsRow1 = [
    {
      title: 'Faturamento do Mês',
      tooltip: 'Total faturado no mês somando entregas e vendas atacado.',
      value: fmt(Number(faturamentoAnimado)),
      change: `${stats?.percentualFaturamento >= 0 ? '+' : ''}${stats?.percentualFaturamento}%`,
      changeType: stats?.percentualFaturamento >= 0 ? 'increase' : 'decrease',
      icon: DollarSign, color: 'bg-emerald-500',
      isLoading, showChange: true,
    },
    {
      title: 'Valores em Falta',
      tooltip: 'Débitos em aberto de entregas já retornadas e vendas atacado com pagamento pendente.',
      value: fmt(Number(faltanteAnimado)),
      subtitle: taxaInadimplencia ? `${taxaInadimplencia}% do faturamento` : undefined,
      icon: AlertTriangle, color: 'bg-red-500',
      isLoading, showChange: false,
    },
    {
      title: 'Orçamentos PJ',
      tooltip: 'Valor total de orçamentos PJ com status convertido registrados no mês atual.',
      value: fmt(Number(orcamentosAnimado)),
      subtitle: breakdown?.qtdOrcamentos
        ? `${breakdown.qtdOrcamentos} convertido${breakdown.qtdOrcamentos > 1 ? 's' : ''} no mês`
        : 'Nenhum convertido',
      icon: FileText, color: 'bg-purple-500',
      isLoading, showChange: false,
    },
  ] as const;

  const statsRow2 = [
    {
      title: 'Entregas do Mês',
      tooltip: 'Total de entregas e vendas atacado registradas no mês corrente.',
      value: String(stats?.entregasAtual || 0),
      change: `${stats?.percentualEntregas >= 0 ? '+' : ''}${stats?.percentualEntregas}%`,
      changeType: stats?.percentualEntregas >= 0 ? 'increase' : 'decrease',
      icon: Truck, color: 'bg-green-500',
      isLoading, showChange: true,
    },
    {
      title: 'Entregas Hoje',
      tooltip: 'Total de entregas e vendas atacado registradas na data de hoje.',
      value: String(entregasHoje || 0),
      subtitle: 'registradas hoje',
      icon: Calendar, color: 'bg-indigo-500',
      isLoading: loadingStates.entregasHoje, showChange: false,
    },
    {
      title: 'Vendedores Ativos',
      tooltip: 'Quantidade de vendedores com status ativo vinculados à sua conta.',
      value: String(stats?.vendedoresAtivos || 0),
      icon: Users, color: 'bg-blue-500',
      isLoading, showChange: false,
    },
  ] as const;

  return (
    <div className="space-y-6 sm:space-y-8 p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between space-y-4 sm:space-y-0">
        <div className="text-center sm:text-left">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
          <p className="text-gray-600 dark:text-gray-400 text-sm sm:text-base">Visão geral do sistema</p>
        </div>
        <div className="text-center sm:text-right">
          {someLoading && (
            <div className="flex items-center gap-2 justify-center sm:justify-end mb-2">
              <Activity className="w-3 h-3 animate-pulse text-blue-500" />
              <span className="text-xs text-gray-500">Atualizando...</span>
            </div>
          )}
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Data e hora</p>
          <p className="text-xs sm:text-sm font-medium text-gray-900 dark:text-white">
            {formatDateTime(currentDateTime)}
          </p>
        </div>
      </div>

      {/* Stats */}
      {!isExpedicao && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {statsRow1.map((stat, index) => <StatCard key={index} {...stat} />)}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {statsRow2.map((stat, index) => <StatCard key={index} {...stat} />)}
          </div>
        </div>
      )}

      {/* Gráfico mensal */}
      {!isExpedicao && (
        <FaturamentoMensalChart data={charts.faturamentoMensal} isLoading={loadingStates.grafico} />
      )}

      {/* Inadimplência + Estoque */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {!isExpedicao && (
          <InadimplenciaCard data={inadimplencia} isLoading={loadingStates.inadimplencia} />
        )}
        <EstoqueAlertsCard data={estoqueAlerts} isLoading={loadingStates.estoque} />
      </div>

      {/* Top Vendedores + Top Produtos */}
      {!isExpedicao && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <TopVendedoresCard data={vendedores} isLoading={loadingStates.vendedores} />
          <TopProdutosCard data={topProdutos} isLoading={loadingStates.topProdutos} />
        </div>
      )}
    </div>
  );
};

export default Dashboard;