import React, { useEffect, useState } from 'react';
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';
import HC_exporting from 'highcharts/modules/exporting';
import HC_accessibility from 'highcharts/modules/accessibility';
import HC_mouseWheelZoom from 'highcharts/modules/mouse-wheel-zoom';

// Initialize modules
const initModule = (module: any) => {
  if (typeof module === 'function') {
    module(Highcharts);
  } else if (typeof module === 'object' && module.default) {
    module.default(Highcharts);
  }
};

initModule(HC_exporting);
initModule(HC_accessibility);
initModule(HC_mouseWheelZoom);

interface StatusPagamentosPieChartProps {
  data: Array<{
    name: string;
    value: number;
    valorTotal: number;
    color: string;
  }>;
}

const StatusPagamentosPieChart: React.FC<StatusPagamentosPieChartProps> = ({ data }) => {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    // Check initial theme
    const checkTheme = () => {
      setIsDark(document.documentElement.classList.contains('dark'));
    };
    checkTheme();

    // Observe class changes on html element to update theme dynamically
    const observer = new MutationObserver(checkTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });

    return () => observer.disconnect();
  }, []);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const options: Highcharts.Options = {
    chart: {
      type: 'pie',
      backgroundColor: 'transparent',
      style: {
        fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, sans-serif',
      },
      height: 250,
    },
    title: {
      text: '', // Hidden as requested by the user's layout which has the title outside
      style: {
        color: isDark ? '#ffffff' : '#111827',
        fontSize: '18px',
        fontWeight: '600'
      }
    },
    tooltip: {
      backgroundColor: isDark ? '#374151' : '#ffffff',
      borderColor: isDark ? '#4b5563' : '#e5e7eb',
      style: {
        color: isDark ? '#ffffff' : '#1f2937',
      },
      formatter: function (this: Highcharts.Point) {
        const point = this as any;
        return `<b>${point.name}</b><br/>${point.y} entregas<br/>(${formatCurrency(point.valorTotal)})`;
      }
    },
    plotOptions: {
      pie: {
        allowPointSelect: true,
        cursor: 'pointer',
        borderWidth: 0,
        dataLabels: [
          {
            enabled: true,
            distance: 20,
            format: '<b>{point.name}</b>',
            style: {
              color: isDark ? '#e5e7eb' : '#374151',
              fontSize: '12px',
              textOutline: 'none',
              fontWeight: '500'
            },
            connectorColor: isDark ? '#4b5563' : '#d1d5db',
          },
          {
            enabled: true,
            distance: -40,
            format: '{point.percentage:.0f}%',
            style: {
              fontSize: '1.2em',
              textOutline: 'none',
              color: '#ffffff',
              opacity: 0.9,
              fontWeight: 'bold'
            },
            filter: {
              operator: '>',
              property: 'percentage',
              value: 5
            }
          }
        ],
        showInLegend: true
      }
    },
    legend: {
      itemStyle: {
        color: isDark ? '#e5e7eb' : '#374151',
      },
      itemHoverStyle: {
        color: isDark ? '#ffffff' : '#000000',
      }
    },
    credits: {
      enabled: false
    },
    exporting: {
      enabled: false
    },
    series: [
      {
        type: 'pie',
        name: 'Status',
        data: data.map(item => ({
          name: item.name,
          y: item.value,
          valorTotal: item.valorTotal,
          color: item.color,
          sliced: item.name === 'Pendentes',
          selected: item.name === 'Pendentes'
        }))
      }
    ]
  };

  return (
    <div className="w-full h-full">
      <HighchartsReact
        highcharts={Highcharts}
        options={options}
      />
    </div>
  );
};

export default StatusPagamentosPieChart;
