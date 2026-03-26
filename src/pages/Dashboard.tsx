import { Skeleton } from '@/components/ui/Skeleton';
import { useAuth } from '@/contexts/AuthContext';
import { useCountUp } from '@/hooks/useCountUp';
import { useDashboard } from '@/hooks/useDashboard';
import { EstoqueAtual } from '@/types/estoque';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  DollarSign,
  TrendingUp,
  Truck,
  Users
} from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

// ===== COMPONENTE: Badge =====
const Badge = ({ children, variant }: { children: React.ReactNode, variant: 'default' | 'destructive' | 'warning' | 'success' | 'outline' }) => {
  const styles = {
    default: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
    destructive: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
    warning: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
    success: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
    outline: "border border-gray-200 text-gray-800 dark:border-gray-700 dark:text-gray-300",
  };
  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[variant]}`}>
      {children}
    </span>
  );
};

// ===== COMPONENTE: Alertas de Estoque =====
const EstoqueAlertsCard: React.FC<{ data: EstoqueAtual[], isLoading: boolean }> = ({ 
  data, 
  isLoading 
}) => {
  return (
  <div className="bg-white dark:bg-gray-800 rounded-lg p-4 sm:p-6 shadow-sm border border-gray-200 dark:border-gray-700 h-96 overflow-hidden flex flex-col">
    <div className="flex items-center justify-between mb-4 flex-shrink-0">
      <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
        <AlertTriangle className="w-5 h-5 text-yellow-500" />
        Alertas de Estoque
        {!isLoading && data && data.length > 0 && (
          <span className="bg-red-100 text-red-800 text-xs font-medium mr-2 px-2.5 py-0.5 rounded dark:bg-red-900 dark:text-red-300">
            {data.length}
          </span>
        )}
      </h3>
      <Link to="/estoque/movimentacoes" className="text-xs sm:text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 flex items-center gap-1">
        Ver todos
        <ArrowRight className="w-3 h-3" />
      </Link>
    </div>
    
    {isLoading ? (
      <div className="space-y-4 overflow-y-auto pr-2">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="flex items-center justify-between">
            <div className="flex items-center min-w-0 flex-1">
              <Skeleton className="w-8 h-8 rounded-md flex-shrink-0" />
              <div className="ml-3 min-w-0 flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4" />
              </div>
            </div>
            <Skeleton className="h-4 w-16 ml-2" />
          </div>
        ))}
      </div>
    ) : (
      <div className="space-y-3 sm:space-y-4 overflow-y-auto pr-2 h-full">
        {data && data.length > 0 ? data.map((produto, index) => (
          <div 
            key={produto.id} 
            className="flex items-center justify-between animate-fade-in-up border-b border-gray-100 dark:border-gray-700 pb-2 last:border-0 last:pb-0"
            style={{ animationDelay: `${index * 150}ms` }}
          >
            <div className="flex items-center min-w-0 flex-1">
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm font-medium text-gray-900 dark:text-white truncate">
                  {produto.produto_nome}
                </p>
                <div className="flex items-center gap-2">
                  <p className={`text-xs font-medium truncate ${
                    produto.status_estoque === 'ZERADO' 
                      ? 'text-red-600 dark:text-red-400' 
                      : 'text-orange-600 dark:text-orange-400'
                  }`}>
                    {produto.status_estoque === 'ZERADO' 
                      ? 'Estoque Esgotado' 
                      : 'Estoque Abaixo do Mínimo'}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex flex-col items-end">
              <Badge variant={produto.status_estoque === 'ZERADO' ? 'destructive' : 'warning'}>
                {produto.qtd_estoque} {produto.unidade_medida}
              </Badge>
            </div>
          </div>
        )) : (
          <div className="flex flex-col items-center justify-center py-8 text-center h-full">
             <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-3">
               <TrendingUp className="w-6 h-6 text-green-600 dark:text-green-400" />
             </div>
             <p className="text-sm font-medium text-gray-900 dark:text-white">Estoque Saudável</p>
             <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Nenhum produto com estoque baixo ou zerado.</p>
          </div>
        )}
      </div>
    )}
  </div>
);
};

// ===== INTERFACES ===== 
interface StatCardProps { 
  title: string; 
  value: string; 
  change?: string; 
  changeType?: 'increase' | 'decrease' | 'neutral'; 
  icon: React.ComponentType<any>; 
  color: string; 
  isLoading: boolean; 
  showChange?: boolean; 
} 

// ===== COMPONENTE: Card de Estatística ===== 
const StatCard: React.FC<StatCardProps> = ({ 
  title, 
  value, 
  change, 
  changeType, 
  icon: Icon, 
  color, 
  isLoading, 
  showChange = false 
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
          <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mb-1 truncate"> 
            {title} 
          </p> 
          <p className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-white break-words"> 
            {value} 
          </p> 
          
          {showChange && change && ( 
            <div className="flex items-center mt-2"> 
              <TrendingUp className={`w-3 h-3 sm:w-4 sm:h-4 mr-1 flex-shrink-0 ${ 
                changeType === 'increase' ? 'text-green-500' : 
                changeType === 'decrease' ? 'text-red-500' : 'text-gray-500' 
              }`} /> 
              <span className={`text-xs sm:text-sm font-medium ${ 
                changeType === 'increase' ? 'text-green-600' : 
                changeType === 'decrease' ? 'text-red-600' : 'text-gray-500' 
              }`}> 
                {change} 
              </span> 
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

// ===== INTERFACE ===== 
interface MonthData { 
  month: string; 
  value: number; 
  height: number; 
} 

// ===== COMPONENTE: Gráfico de Faturamento Mensal ===== 
const FaturamentoMensalChart: React.FC<{ data: MonthData[], isLoading: boolean }> = ({ 
  data, 
  isLoading 
}) => { 
  const [hoveredColumn, setHoveredColumn] = useState<number | null>(null); 
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 }); 

  if (isLoading) { 
    return ( 
      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 sm:p-6 shadow-sm border border-gray-200 dark:border-gray-700 h-96"> 
        <Skeleton className="h-5 w-48 mb-4" /> 
        <div className="h-48 sm:h-64 flex items-end justify-between space-x-1 sm:space-x-2"> 
          {[...Array(12)].map((_, i) => ( 
            <Skeleton 
              key={i} 
              className="flex-1 min-w-[20px] rounded-t-sm" 
              style={{ height: `${[30, 50, 40, 70, 50, 80, 60, 90, 70, 50, 60, 40][i]}%` }} 
            /> 
          ))} 
        </div> 
        <div className="flex justify-between mt-2 space-x-1"> 
          {[...Array(12)].map((_, i) => ( 
            <Skeleton key={i} className="h-3 w-6 flex-shrink-0" /> 
          ))} 
        </div> 
      </div> 
    ); 
  } 

  return ( 
    <div className="bg-white dark:bg-gray-800 rounded-lg p-4 sm:p-6 shadow-sm border border-gray-200 dark:border-gray-700 relative h-96 flex flex-col"> 
      <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-4 flex-shrink-0"> 
        Faturamento Mensal 
      </h3> 
      
      {/* Tooltip */} 
      {hoveredColumn !== null && ( 
        <div 
          className="absolute z-10 bg-gray-900 dark:bg-gray-700 text-white px-2 sm:px-3 py-1 sm:py-2 rounded-lg shadow-lg text-xs sm:text-sm font-medium pointer-events-none transform -translate-x-1/2 transition-all duration-150" 
          style={{ 
            left: `${tooltipPosition.x}%`, 
            top: `${tooltipPosition.y}px`, 
          }} 
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
            style={{ 
              height: `${item.height}%`, 
              animationDelay: `${index * 100}ms` 
            }} 
            onMouseEnter={(e) => { 
              const rect = e.currentTarget.getBoundingClientRect(); 
              const containerRect = e.currentTarget.parentElement?.getBoundingClientRect(); 
              if (containerRect) { 
                const relativeX = ((rect.left + rect.width / 2 - containerRect.left) / containerRect.width) * 100; 
                const columnHeight = rect.height; 
                const containerHeight = containerRect.height; 
                const relativeY = containerHeight - columnHeight - 10; 
                setTooltipPosition({ x: relativeX, y: relativeY }); 
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
    </div> 
  ); 
};

// ===== INTERFACE ===== 
interface TopVendedor { 
  name: string; 
  sales: string; 
  totalValue: string; 
} 

// ===== COMPONENTE: Top Vendedores ===== 
const TopVendedoresCard: React.FC<{ data: TopVendedor[], isLoading: boolean }> = ({ 
  data, 
  isLoading 
}) => ( 
  <div className="bg-white dark:bg-gray-800 rounded-lg p-4 sm:p-6 shadow-sm border border-gray-200 dark:border-gray-700 h-96 overflow-hidden flex flex-col"> 
    <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-4 flex-shrink-0"> 
      Top Vendedores 
    </h3> 
    
    {isLoading ? ( 
      <div className="space-y-4 overflow-y-auto pr-2"> 
        {[...Array(5)].map((_, i) => ( 
          <div key={i} className="flex items-center justify-between"> 
            <div className="flex items-center min-w-0 flex-1"> 
              <Skeleton className="w-6 h-6 sm:w-8 sm:h-8 rounded-full flex-shrink-0" /> 
              <div className="ml-2 sm:ml-3 min-w-0 flex-1 space-y-2"> 
                <Skeleton className="h-4 w-3/4" /> 
                <Skeleton className="h-3 w-1/2" /> 
              </div> 
            </div> 
            <Skeleton className="h-4 w-20 ml-2" /> 
          </div> 
        ))} 
      </div> 
    ) : ( 
      <div className="space-y-3 sm:space-y-4 overflow-y-auto pr-2"> 
        {data.length > 0 ? data.slice(0, 5).map((seller, index) => ( 
          <div 
            key={index} 
            className="flex items-center justify-between animate-fade-in-up" 
            style={{ animationDelay: `${index * 150}ms` }} 
          > 
            <div className="flex items-center min-w-0 flex-1"> 
              <div className={`w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-white text-xs sm:text-sm font-medium flex-shrink-0 ${ 
                index === 0 ? 'bg-yellow-500' : 
                index === 1 ? 'bg-gray-400' : 
                index === 2 ? 'bg-orange-600' : 'bg-blue-500' 
              }`}> 
                {index + 1} 
              </div> 
              <div className="ml-2 sm:ml-3 min-w-0 flex-1"> 
                <p className="text-xs sm:text-sm font-medium text-gray-900 dark:text-white truncate"> 
                  {seller.name} 
                </p> 
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate"> 
                  {seller.sales} 
                </p> 
              </div> 
            </div> 
            <span className="text-xs sm:text-sm font-medium flex-shrink-0 ml-2 text-green-600"> 
              {seller.totalValue} 
            </span> 
          </div> 
        )) : ( 
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 text-center"> 
            Nenhum vendedor encontrado 
          </p> 
        )} 
      </div> 
    )} 
  </div> 
);

// ===== COMPONENTE PRINCIPAL =====
const Dashboard: React.FC = () => {
  const { userType, permissions } = useAuth();
  const isExpedicao = userType !== 'admin' && permissions?.expedicao === true;

  const [currentDateTime, setCurrentDateTime] = useState(new Date()); 
 
   // Atualizar data/hora a cada minuto 
   useEffect(() => { 
     const timer = setInterval(() => setCurrentDateTime(new Date()), 60000); 
     return () => clearInterval(timer); 
   }, []); 
 
   // Buscar dados otimizados 
   const { stats, charts, vendedores, estoqueAlerts, isLoading, someLoading } = useDashboard(); 
 
   // Animações de valores 
   const faturamentoAnimado = useCountUp({ 
     end: stats?.faturamentoAtual || 0, 
     duration: 800, 
     decimals: 2 
   }); 
 
   const faltanteAnimado = useCountUp({ 
     end: stats?.valoresEmFalta || 0, 
     duration: 800, 
     decimals: 2 
   }); 
 
   // Formatar data/hora 
   const formatDateTime = (date: Date) => { 
     return new Intl.DateTimeFormat('pt-BR', { 
       day: '2-digit', 
       month: '2-digit', 
       year: 'numeric', 
       hour: '2-digit', 
       minute: '2-digit', 
     }).format(date); 
   }; 
 
   // Preparar dados do gráfico mensal 
   const faturamentoMensalData = useMemo<MonthData[]>(() => { 
     if (!charts?.faturamentoMensal) return []; 
     
     // O hook já calcula height, mas se precisar recalcular ou garantir:
     // O hook usePagamentosMensais retorna dados com height já calculado.
     // Mas a interface MonthData no Dashboard espera height.
     // Vamos mapear para garantir compatibilidade se o hook retornar algo diferente.
     
     const rawData = charts.faturamentoMensal;
     if (!rawData || rawData.length === 0) return [];

     // Se já vier com height, usamos. Se não, calculamos.
     // O hook usePagamentosMensais retorna { month, value, height, count }.
     // O Dashboard espera { month, value, height }.
     
     return rawData.map((item: any) => ({
        month: item.month,
        value: item.value,
        height: item.height
     }));
   }, [charts]); 
 
   // Cards de estatísticas 
  const statsCards = [ 
    { 
      title: 'Faturamento', 
      value: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }) 
        .format(Number(faturamentoAnimado)), 
      change: `${stats?.percentualFaturamento >= 0 ? '+' : ''}${stats?.percentualFaturamento}%`, 
      changeType: stats?.percentualFaturamento >= 0 ? 'increase' : 'decrease', 
      icon: DollarSign, 
      color: 'bg-emerald-500', 
      isLoading, 
      showChange: true 
    }, 
    { 
      title: 'Faltante', 
      value: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }) 
        .format(Number(faltanteAnimado)), 
      icon: AlertTriangle, 
      color: 'bg-red-500', 
      isLoading, 
      showChange: false 
    }, 
    { 
      title: 'Entregas do Mês', 
      value: String(stats?.entregasAtual || 0), 
      change: `${stats?.percentualEntregas >= 0 ? '+' : ''}${stats?.percentualEntregas}%`, 
      changeType: stats?.percentualEntregas >= 0 ? 'increase' : 'decrease', 
      icon: Truck, 
      color: 'bg-green-500', 
      isLoading, 
      showChange: true 
    }, 
    { 
      title: 'Vendedores Ativos', 
      value: String(stats?.vendedoresAtivos || 0), 
      icon: Users, 
      color: 'bg-blue-500', 
      isLoading, 
      showChange: false 
    } 
  ] as const; 
 
   return ( 
    <div className="space-y-6 sm:space-y-8 p-4 sm:p-6 lg:p-8"> 
      {/* Header */} 
       <div className="flex flex-col sm:flex-row sm:items-center justify-between space-y-4 sm:space-y-0"> 
         <div className="text-center sm:text-left"> 
           <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white"> 
             Dashboard 
           </h1> 
           <p className="text-gray-600 dark:text-gray-400 text-sm sm:text-base"> 
             Visão geral do sistema 
           </p> 
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
 
       {/* Stats Grid */} 
       {!isExpedicao && (
       <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6"> 
         {statsCards.map((stat, index) => ( 
           <StatCard key={index} {...stat} /> 
         ))} 
       </div> 
       )}
 
       {/* Charts Section - Full width chart on top */} 
       <div className="space-y-6 sm:space-y-8">
         {!isExpedicao && (
         <FaturamentoMensalChart 
           data={faturamentoMensalData} 
           isLoading={someLoading && !charts} 
         />
         )}

         {/* Bottom row: Vendedores + Estoque side by side */}
         <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 sm:gap-8">
           <TopVendedoresCard 
             data={vendedores || []} 
             isLoading={someLoading && !vendedores} 
           />
           <EstoqueAlertsCard
             data={estoqueAlerts || []}
             isLoading={someLoading && !estoqueAlerts}
           />
         </div>
       </div> 
     </div> 
   ); 
 }; 
 
 export default Dashboard;
