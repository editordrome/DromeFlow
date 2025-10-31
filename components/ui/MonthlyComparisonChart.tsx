import React from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';
import type { MonthlyChartData } from '../../services/analytics/dashboard.service';

interface MonthlyComparisonChartProps {
  data: MonthlyChartData[];
  // Estendido para suportar métricas derivadas e averageTicket
  selectedMetric:
    | 'totalRevenue'
    | 'totalServices'
    | 'uniqueClients'
    | 'totalRepasse'
    | 'averageTicket'
    | 'margin'
    | 'marginPerService';
  isLoading?: boolean;
  invertColors?: boolean; // Para métricas onde maior = pior (ex: Churn)
}

const MonthlyComparisonChart: React.FC<MonthlyComparisonChartProps> = ({
  data,
  selectedMetric,
  isLoading = false,
  invertColors = false,
}) => {
  const getMetricConfig = () => {
    switch (selectedMetric) {
      case 'totalRevenue':
        return {
          title: 'Faturamento por Mês',
          color: '#3B82F6',
          formatter: (value: number) => 
            value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
          yAxisFormatter: (value: number) => 
            `R$ ${(value / 1000).toFixed(0).replace('.', ',')}k`
        };
      case 'averageTicket':
        return {
          title: 'Média por Atendimento (Mês)',
          color: '#0EA5E9',
          formatter: (value: number) =>
            value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
          yAxisFormatter: (value: number) =>
            `R$ ${(value / 1000).toFixed(0).replace('.', ',')}k`
        };
      case 'margin':
        return {
          title: 'Margem por Mês',
          color: '#3B82F6',
          formatter: (value: number) =>
            value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
          yAxisFormatter: (value: number) =>
            `R$ ${(value / 1000).toFixed(0).replace('.', ',')}k`
        };
      case 'marginPerService':
        return {
          title: 'Margem por Atendimento (Mês)',
          color: '#3B82F6',
          formatter: (value: number) =>
            value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
          yAxisFormatter: (value: number) =>
            `R$ ${(value / 1000).toFixed(0).replace('.', ',')}k`
        };
      case 'totalServices':
        return {
          title: 'Atendimentos por Mês',
          color: '#F59E0B',
          formatter: (value: number) => `${Math.round(value)} atendimentos`,
          yAxisFormatter: (value: number) => Math.round(value).toString()
        };
      case 'uniqueClients':
        return {
          title: 'Clientes por Mês',
          color: '#F59E0B',
          formatter: (value: number) => `${Math.round(value)} clientes`,
          yAxisFormatter: (value: number) => Math.round(value).toString()
        };
      case 'totalRepasse':
        return {
          title: 'Repasse por Mês',
          color: '#8B5CF6',
          formatter: (value: number) => 
            value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
          yAxisFormatter: (value: number) => 
            `R$ ${(value / 1000).toFixed(0).replace('.', ',')}k`
        };

      default:
        return {
          title: 'Métrica por Mês',
          color: '#6B7280',
          formatter: (value: number) => value.toString(),
          yAxisFormatter: (value: number) => value.toString()
        };
    }
  };

  const config = getMetricConfig();

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-bg-secondary border border-border-primary rounded-lg shadow-lg p-3">
          <p className="text-text-primary font-medium">{label}</p>
          <p style={{ color: config.color }} className="text-sm">
            {`${config.title.split(' ')[0]}: ${config.formatter(payload[0].value)}`}
          </p>
        </div>
      );
    }
    return null;
  };



  if (isLoading) {
    return (
      <div className="h-60 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-t-4 border-gray-200 rounded-full animate-spin border-t-accent-primary"></div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="h-60 flex items-center justify-center">
        <p className="text-text-secondary">Nenhum dado disponível para exibir o gráfico.</p>
      </div>
    );
  }

  // Filtra dados apenas até o mês atual para análise justa
  const currentDate = new Date();
  const currentMonth = currentDate.getMonth() + 1; // getMonth() retorna 0-11
  
  const filteredData = data.filter(item => {
    const itemMonth = parseInt(item.month);
    return itemMonth <= currentMonth;
  });

  // Calcula campos derivados no dataset (margin, marginPerService) ANTES de calcular min/max
  const enrichedData = filteredData.map((d: any) => ({
    ...d,
    // já existe averageTicket nos dados
    margin: (d.totalRevenue || 0) - (d.totalRepasse || 0),
    marginPerService: d.totalServices > 0 ? (((d.totalRevenue || 0) - (d.totalRepasse || 0)) / d.totalServices) : 0,
  }));

  // Para métricas monetárias, usar LineChart; para contagens, usar BarChart
  const monetaryMetrics = new Set(['totalRevenue', 'totalRepasse', 'averageTicket', 'margin', 'marginPerService']);
  const useLineChart = monetaryMetrics.has(selectedMetric);

  // Calcula os valores máximo e mínimo para anotações usando os dados enriquecidos
  const maxValue = enrichedData.length > 0 
    ? enrichedData.reduce((max, current) => 
        current[selectedMetric] > max[selectedMetric] ? current : max
      )
    : null;
  
  const minValue = enrichedData.length > 0
    ? enrichedData.reduce((min, current) => 
        current[selectedMetric] < min[selectedMetric] ? current : min
      )
    : null;

  return (
    <div className="h-60">
        <ResponsiveContainer width="100%" height="100%">
          {useLineChart ? (
            <LineChart data={enrichedData} margin={{ top: 25, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis 
                dataKey="monthName" 
                stroke="#6B7280"
                fontSize={12}
              />
              <YAxis 
                stroke="#6B7280"
                fontSize={12}
                tickFormatter={config.yAxisFormatter}
              />
              <Tooltip content={<CustomTooltip />} />
              <Line 
                type="monotone" 
                dataKey={selectedMetric} 
                stroke={config.color}
                strokeWidth={3}
                dot={(props: any) => {
                  const isMax = maxValue && props.payload.monthName === maxValue.monthName;
                  const isMin = minValue && props.payload.monthName === minValue.monthName;
                  
                  // Inverte cores se invertColors=true (ex: Churn - maior é pior)
                  const maxColor = invertColors ? '#EF4444' : '#10B981';
                  const minColor = invertColors ? '#10B981' : '#EF4444';
                  const maxLabel = invertColors ? '↑ MAIOR' : '↑ MAIOR';
                  const minLabel = invertColors ? '↓ MENOR' : '↓ MENOR';
                  const maxFill = invertColors ? 'fill-red-600' : 'fill-green-600';
                  const minFill = invertColors ? 'fill-green-600' : 'fill-red-600';
                  
                  if (isMax) {
                    return (
                      <g>
                        <circle cx={props.cx} cy={props.cy} r="6" fill={maxColor} stroke="#fff" strokeWidth="2" />
                        <text x={props.cx} y={props.cy - 15} textAnchor="middle" className={`text-xs font-semibold ${maxFill}`}>
                          {maxLabel}
                        </text>
                      </g>
                    );
                  }
                  
                  if (isMin) {
                    return (
                      <g>
                        <circle cx={props.cx} cy={props.cy} r="6" fill={minColor} stroke="#fff" strokeWidth="2" />
                        <text x={props.cx} y={props.cy - 15} textAnchor="middle" className={`text-xs font-semibold ${minFill}`}>
                          {minLabel}
                        </text>
                      </g>
                    );
                  }
                  
                  return <circle cx={props.cx} cy={props.cy} r="4" fill={config.color} stroke="#fff" strokeWidth="2" />;
                }}
                activeDot={{ r: 8, stroke: config.color, strokeWidth: 2, fill: '#fff' }}
              />
            </LineChart>
          ) : (
            <BarChart data={enrichedData} margin={{ top: 25, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis 
                dataKey="monthName" 
                stroke="#6B7280"
                fontSize={12}
              />
              <YAxis 
                stroke="#6B7280"
                fontSize={12}
                tickFormatter={config.yAxisFormatter}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar 
                dataKey={selectedMetric} 
                radius={[4, 4, 0, 0]}
                shape={(props: any) => {
                  const isMax = maxValue && props.payload && props.payload.monthName === maxValue.monthName;
                  const isMin = minValue && props.payload && props.payload.monthName === minValue.monthName;
                  
                  // Inverte cores se invertColors=true (ex: Churn - maior é pior)
                  const maxColor = invertColors ? '#EF4444' : '#10B981'; // vermelho se invertido
                  const minColor = invertColors ? '#10B981' : '#EF4444'; // verde se invertido
                  const maxLabel = invertColors ? '↑ MAIOR' : '↑ MAIOR';
                  const minLabel = invertColors ? '↓ MENOR' : '↓ MENOR';
                  
                  let barColor = config.color;
                  if (isMax) barColor = maxColor;
                  else if (isMin) barColor = minColor;
                  
                  return (
                    <g>
                      <rect
                        x={props.x}
                        y={props.y}
                        width={props.width}
                        height={props.height}
                        fill={barColor}
                        rx="4"
                        ry="4"
                      />
                      {isMax && (
                        <text
                          x={props.x + props.width / 2}
                          y={props.y - 8}
                          textAnchor="middle"
                          className="text-xs font-bold"
                          fill={maxColor}
                        >
                          {maxLabel}
                        </text>
                      )}
                      {isMin && (
                        <text
                          x={props.x + props.width / 2}
                          y={props.y - 8}
                          textAnchor="middle"
                          className="text-xs font-bold"
                          fill={minColor}
                        >
                          {minLabel}
                        </text>
                      )}
                    </g>
                  );
                }}
              />
            </BarChart>
          )}
        </ResponsiveContainer>
    </div>
  );
};

export default MonthlyComparisonChart;