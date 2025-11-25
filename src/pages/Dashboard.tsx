import React, { useState } from 'react';
import { TrendingUp, Users, AlertTriangle, Truck, DollarSign } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { 
  useVendedoresAtivos, 
  useEntregasDoMes, 
  useFaturamentoDoMes, 
  useValoresEmFalta,
  useFaturamentoMensal,
  useTopVendedores
} from '../hooks/useDashboard';

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const [hoveredColumn, setHoveredColumn] = useState<number | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const [currentDateTime, setCurrentDateTime] = useState(new Date());

  // Atualizar data e hora a cada minuto
  React.useEffect(() => {
    const timer = setInterval(() => {
      setCurrentDateTime(new Date());
    }, 60000); // Atualiza a cada minuto

    return () => clearInterval(timer);
  }, []);

  // Função para formatar data e hora em UTC-3
  const formatDateTime = (date: Date) => {
    const utcMinus3 = new Date(date.getTime() - (3 * 60 * 60 * 1000));
    
    const dateOptions: Intl.DateTimeFormatOptions = {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      timeZone: 'UTC'
    };
    
    const timeOptions: Intl.DateTimeFormatOptions = {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'UTC'
    };
    
    const formattedDate = utcMinus3.toLocaleDateString('pt-BR', dateOptions);
    const formattedTime = utcMinus3.toLocaleTimeString('pt-BR', timeOptions);
    
    return `${formattedDate}, ${formattedTime}`;
  };

  // Hooks para buscar dados
  const { data: vendedoresAtivos } = useVendedoresAtivos(user?.id || '');
  const entregasDoMes = useEntregasDoMes(user?.id || '');
  const faturamentoDoMes = useFaturamentoDoMes(user?.id || '');
  const { data: valoresEmFalta } = useValoresEmFalta(user?.id || '');
  const faturamentoMensal = useFaturamentoMensal(user?.id || '');
  const topVendedores = useTopVendedores(user?.id || '');

  // Calcular totais
  const totalVendedoresAtivos = (vendedoresAtivos as Record<string, unknown>[])?.length || 0;
  const totalEntregasAtual = (entregasDoMes?.currentMonth?.data as Record<string, unknown>[])?.length || 0;
  const totalEntregasAnterior = (entregasDoMes?.previousMonth?.data as Record<string, unknown>[])?.length || 0;
  const totalFaturamentoAtual = (faturamentoDoMes?.currentMonth?.data as Record<string, unknown>[])?.reduce((sum: number, item: Record<string, unknown>) => sum + ((item.valor as number) || 0), 0) || 0;
  const totalFaturamentoAnterior = (faturamentoDoMes?.previousMonth?.data as Record<string, unknown>[])?.reduce((sum: number, item: Record<string, unknown>) => sum + ((item.valor as number) || 0), 0) || 0;
  const totalValoresEmFalta = (valoresEmFalta as Record<string, unknown>[])?.reduce((sum: number, item: Record<string, unknown>) => {
    const valorEntrega = (item.entregas as Record<string, unknown>)?.valor || 0;
    const valorPago = item.valor_total_pago || 0;
    return sum + Math.max(0, (valorEntrega as number) - (valorPago as number));
  }, 0) || 0;

  // Calcular percentuais
  const percentualEntregas = totalEntregasAnterior > 0 
    ? (((totalEntregasAtual - totalEntregasAnterior) / totalEntregasAnterior) * 100).toFixed(1)
    : '0.0';

  const percentualFaturamento = totalFaturamentoAnterior > 0 
    ? (((totalFaturamentoAtual - totalFaturamentoAnterior) / totalFaturamentoAnterior) * 100).toFixed(1)
    : '0.0';

  // Preparar dados do gráfico de faturamento mensal
  const faturamentoMensalData = React.useMemo(() => {
    if (!faturamentoMensal?.data) return [];
    
    const data = (faturamentoMensal?.data as Record<string, unknown>[]) || [];
    const monthlyData: { [key: string]: number } = {};
    const monthsInPortuguese = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
    
    // Agrupar dados por mês
    data.forEach((item: Record<string, unknown>) => {
      const date = new Date(item.data_pagamento as string);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      monthlyData[monthKey] = (monthlyData[monthKey] || 0) + ((item.valor as number) || 0);
    });
    
    // Gerar dados dos últimos 12 meses
    const monthsData: Array<{
      monthKey: string;
      realMonthIndex: number;
      value: number;
    }> = [];
    const currentDate = new Date();
    
    for (let i = 11; i >= 0; i--) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const value = monthlyData[monthKey] || 0;
      
      monthsData.push({
        monthKey,
        realMonthIndex: date.getMonth(),
        value: value
      });
    }
    
    // Criar array com ordem fixa dos meses (jan a dez) e mapear os dados
    const result = monthsInPortuguese.map((monthLabel, fixedIndex) => {
      // Encontrar o dado correspondente a este mês
      const monthData = monthsData.find(item => item.realMonthIndex === fixedIndex);
      
      return {
        month: monthLabel,
        value: monthData ? monthData.value : 0,
        height: 0 // Will be calculated after we have all values
      };
    });
    
    // Calculate heights based on max value
    const maxValue = Math.max(...result.map(item => item.value));
    return result.map(item => ({
      ...item,
      height: maxValue > 0 ? (item.value / maxValue) * 100 : 0
    }));
  }, [faturamentoMensal?.data]);

  // Preparar dados dos top vendedores
  const topVendedoresData = (topVendedores?.data || []).map((vendedor: Record<string, unknown>) => ({
    name: String(vendedor.nome || ''),
    sales: `${vendedor.totalVendas || 0} entregas`,
    totalValue: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format((vendedor.valorTotalEntregas as number) || 0)
  }));



  const stats = [
    {
      title: 'Vendedores Ativos',
      value: totalVendedoresAtivos.toString(),
      change: '+0%',
      changeType: 'neutral',
      icon: Users,
      color: 'bg-blue-500'
    },
    {
      title: 'Entregas do Mês',
      value: totalEntregasAtual.toString(),
      change: `${parseFloat(percentualEntregas) >= 0 ? '+' : ''}${percentualEntregas}%`,
      changeType: parseFloat(percentualEntregas) >= 0 ? 'increase' : 'decrease',
      icon: Truck,
      color: 'bg-green-500'
    },
    {
      title: 'Faturamento',
      value: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalFaturamentoAtual),
      change: `${parseFloat(percentualFaturamento) >= 0 ? '+' : ''}${percentualFaturamento}%`,
      changeType: parseFloat(percentualFaturamento) >= 0 ? 'increase' : 'decrease',
      icon: DollarSign,
      color: 'bg-emerald-500'
    },
    {
      title: 'Faltante',
      value: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalValoresEmFalta),
      change: '0%',
      changeType: 'neutral',
      icon: AlertTriangle,
      color: 'bg-red-500'
    }
  ];

  return (
    <div className="space-y-6 sm:space-y-8 p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between space-y-4 sm:space-y-0">
        <div className="text-center sm:text-left">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
          <p className="text-gray-600 dark:text-gray-400 text-sm sm:text-base">Visão geral do sistema</p>
        </div>
        <div className="text-center sm:text-right">
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Data e hora</p>
          <p className="text-xs sm:text-sm font-medium text-gray-900 dark:text-white">{formatDateTime(currentDateTime)}</p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {stats.map((stat, index) => (
          <div key={index} className="bg-white dark:bg-gray-800 rounded-lg p-4 sm:p-6 shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mb-1 truncate">{stat.title}</p>
                <p className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-white break-words">{stat.value}</p>
                {/* Variação: mostra porcentagem ou um espaçador invisível para manter altura consistente */}
                {stat.title !== 'Vendedores Ativos' && stat.title !== 'Faltante' ? (
                  <div className="flex items-center mt-2">
                    <TrendingUp className={`w-3 h-3 sm:w-4 sm:h-4 mr-1 flex-shrink-0 ${
                      stat.changeType === 'increase' ? 'text-green-500' : 
                      stat.changeType === 'decrease' ? 'text-red-500' : 'text-gray-500'
                    }`} />
                    <span className={`text-xs sm:text-sm font-medium ${
                      stat.changeType === 'increase' ? 'text-green-600' : 
                      stat.changeType === 'decrease' ? 'text-red-600' : 'text-gray-500'
                    }`}>
                      {stat.change}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400 ml-1 hidden sm:inline">vs mês anterior</span>
                  </div>
                ) : (
                  <div className="mt-2 h-5 sm:h-6" aria-hidden />
                )}
              </div>
              <div className={`w-10 h-10 sm:w-12 sm:h-12 ${stat.color} rounded-lg flex items-center justify-center flex-shrink-0 ml-3`}>
                <stat.icon className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 sm:gap-8">
        {/* Faturamento Mensal */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 sm:p-6 shadow-sm border border-gray-200 dark:border-gray-700 relative">
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-4">Faturamento Mensal</h3>
          
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
                <div className="font-semibold">{faturamentoMensalData[hoveredColumn]?.month}</div>
                <div className="text-green-400">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(faturamentoMensalData[hoveredColumn]?.value || 0)}
                </div>
              </div>
              {/* Seta do tooltip */}
              <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900 dark:border-t-gray-700"></div>
            </div>
          )}
          
          <div className="h-48 sm:h-64 flex items-end justify-between space-x-1 sm:space-x-2 relative overflow-x-auto">
            {faturamentoMensalData.map((data: Record<string, unknown>, index: number) => (
              <div 
                key={index} 
                className="flex-1 min-w-[20px] bg-blue-500 rounded-t-sm opacity-80 hover:opacity-100 transition-all duration-200 cursor-pointer hover:bg-blue-600 touch-manipulation" 
                style={{ height: `${data.height}%` }}
                onMouseEnter={(e) => {
                   const rect = e.currentTarget.getBoundingClientRect();
                   const containerRect = e.currentTarget.parentElement?.getBoundingClientRect();
                   if (containerRect) {
                     const relativeX = ((rect.left + rect.width / 2 - containerRect.left) / containerRect.width) * 100;
                     // Calcular a posição Y baseada na altura da coluna
                     const columnHeight = rect.height;
                     const containerHeight = containerRect.height;
                     const relativeY = containerHeight - columnHeight - 10; // 10px de offset acima da coluna
                     
                     setTooltipPosition({ 
                       x: relativeX, 
                       y: relativeY
                     });
                   }
                   setHoveredColumn(index);
                 }}
                onMouseLeave={() => {
                  setHoveredColumn(null);
                }}
              ></div>
            ))}
          </div>
          <div className="flex justify-between mt-2 text-xs text-gray-500 dark:text-gray-400 overflow-x-auto">
            {faturamentoMensalData.map((data: Record<string, unknown>, index: number) => (
              <span key={index} className="flex-shrink-0">{String(data.month || '')}</span>
            ))}
          </div>
        </div>

        {/* Top Vendedores */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 sm:p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-4">Top Vendedores</h3>
          <div className="space-y-3 sm:space-y-4">
            {topVendedoresData.length > 0 ? topVendedoresData.map((seller: { name: string; sales: string; totalValue: string }, index: number) => (
              <div key={index} className="flex items-center justify-between">
                <div className="flex items-center min-w-0 flex-1">
                  <div className={`w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-white text-xs sm:text-sm font-medium flex-shrink-0 ${
                    index === 0 ? 'bg-yellow-500' : index === 1 ? 'bg-gray-400' : index === 2 ? 'bg-orange-600' : 'bg-blue-500'
                  }`}>
                    {index + 1}
                  </div>
                  <div className="ml-2 sm:ml-3 min-w-0 flex-1">
                    <p className="text-xs sm:text-sm font-medium text-gray-900 dark:text-white truncate">{seller.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{seller.sales}</p>
                  </div>
                </div>
                <span className="text-xs sm:text-sm font-medium flex-shrink-0 ml-2 text-green-600">
                  {seller.totalValue}
                </span>
              </div>
            )) : (
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Nenhum vendedor encontrado</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
