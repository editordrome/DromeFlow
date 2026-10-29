import React, { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer
} from 'recharts';
import Chart from 'react-apexcharts';
import type { MonthlyChartData } from '../../services/analytics/dashboard.service';

interface MonthlyComparisonChartProps {
  data: MonthlyChartData[];
  selectedMetric:
  | 'totalRevenue'
  | 'totalServices'
  | 'uniqueClients'
  | 'totalRepasse'
  | 'averageTicket'
  | 'margin'
  | 'marginPerService';
  isLoading?: boolean;
  invertColors?: boolean;
  chartRange?: 'year' | 'last12';
}

const MonthlyComparisonChart: React.FC<MonthlyComparisonChartProps> = ({
  data,
  selectedMetric,
  isLoading = false,
  invertColors = false,
  chartRange = 'year',
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

  const currentDate = new Date();
  const currentMonth = currentDate.getMonth() + 1;
  const filteredData = chartRange === 'year'
    ? data.filter(item => parseInt(item.month) <= currentMonth)
    : data;

  const enrichedData = filteredData.map((d: any) => ({
    ...d,
    margin: (d.totalRevenue || 0) - (d.totalRepasse || 0),
    marginPerService: d.totalServices > 0 ? (((d.totalRevenue || 0) - (d.totalRepasse || 0)) / d.totalServices) : 0,
  }));

  const monetaryMetrics = new Set(['totalRevenue', 'totalRepasse', 'averageTicket', 'margin', 'marginPerService']);
  const volumeMetrics = new Set(['totalServices', 'uniqueClients']);

  const useAreaChart = monetaryMetrics.has(selectedMetric);
  const useBarChart = volumeMetrics.has(selectedMetric);
  const useApexChart = useAreaChart || useBarChart;

  // Recharts Custom Tooltip config
  const CustomRechartsTooltip = ({ active, payload, label }: any) => {
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

  const maxValue = enrichedData.length > 0
    ? enrichedData.reduce((max, current) => current[selectedMetric] > max[selectedMetric] ? current : max)
    : null;
  const minValue = enrichedData.length > 0
    ? enrichedData.reduce((min, current) => current[selectedMetric] < min[selectedMetric] ? current : min)
    : null;

  // -- APEX CHARTS OPTIONS --
  const getApexOptions = () => {
    const seriesData = enrichedData.map(d => d[selectedMetric]);
    const maxVal = Math.max(...seriesData);
    const minVal = Math.min(...seriesData);
    const maxIndex = seriesData.indexOf(maxVal);
    const minIndex = seriesData.indexOf(minVal);

    if (useBarChart) {
      const maxColor = invertColors ? '#EF4444' : '#10B981';
      const minColor = invertColors ? '#10B981' : '#EF4444';

      const maxGradient = invertColors ? '#FCA5A5' : '#6EE7B7';
      const minGradient = invertColors ? '#6EE7B7' : '#FCA5A5';
      const defaultGradient = config.color === '#F59E0B' ? '#FDE68A' : '#93C5FD';

      const barColors = seriesData.map(val => {
        if (val === maxVal && maxVal !== minVal) return maxColor;
        if (val === minVal && maxVal !== minVal) return minColor;
        return config.color;
      });

      const barGradients = seriesData.map(val => {
        if (val === maxVal && maxVal !== minVal) return maxGradient;
        if (val === minVal && maxVal !== minVal) return minGradient;
        return defaultGradient;
      });

      return {
        series: [{
          name: config.title.split(' ')[0],
          data: seriesData
        }],
        options: {
          chart: {
            type: 'bar',
            fontFamily: 'Inter, sans-serif',
            toolbar: { show: false },
          },
          colors: barColors,
          plotOptions: {
            bar: {
              borderRadius: 6,
              borderRadiusApplication: 'end',
              columnWidth: '40%',
              dataLabels: { position: 'top' },
              distributed: true,
            }
          },
          legend: { show: false },
          dataLabels: {
            enabled: true,
            formatter: function (val: number) {
              return val.toString();
            },
            offsetY: -20,
            style: {
              fontSize: '12px',
              colors: ["#6B7280"],
              fontWeight: 600
            }
          },
          stroke: { show: true, width: 2, colors: ['transparent'] },
          xaxis: {
            categories: enrichedData.map(d => d.monthName),
            axisBorder: { show: false },
            axisTicks: { show: false },
            labels: {
              style: { colors: '#9CA3AF', fontSize: '12px', fontWeight: 500 }
            }
          },
          yaxis: {
            labels: {
              formatter: function (value: number) { return config.yAxisFormatter(value); },
              style: { colors: '#9CA3AF', fontSize: '12px', fontWeight: 500 }
            }
          },
          grid: {
            borderColor: '#F3F4F6',
            strokeDashArray: 4,
            xaxis: { lines: { show: false } },
            yaxis: { lines: { show: true } },
          },
          fill: {
            type: 'gradient',
            gradient: {
              shade: 'light',
              type: "vertical",
              shadeIntensity: 0.25,
              gradientToColors: barGradients,
              inverseColors: true,
              opacityFrom: 1,
              opacityTo: 1,
              stops: [0, 100]
            }
          },
          tooltip: {
            shared: true,
            intersect: false,
            custom: function ({ series, seriesIndex, dataPointIndex, w }: any) {
              const currentVal = series[seriesIndex][dataPointIndex];
              let variationHtml = '';

              if (dataPointIndex > 0) {
                const prevVal = series[seriesIndex][dataPointIndex - 1];
                if (prevVal > 0) {
                  const variation = ((currentVal - prevVal) / prevVal) * 100;
                  const isPositive = variation >= 0;
                  const colorClass = isPositive ? 'text-emerald-600' : 'text-rose-600';
                  const bgColorClass = isPositive ? 'bg-emerald-50' : 'bg-rose-50';
                  const icon = isPositive ? '↗' : '↘';

                  variationHtml = `
                    <div class="mt-2 flex items-center">
                        <span class="px-2 py-1 rounded flex items-center gap-1 text-[11px] font-bold ${bgColorClass} ${colorClass}">
                            ${icon} ${Math.abs(variation).toFixed(1)}% vs ant.
                        </span>
                    </div>
                  `;
                }
              }

              return `
                  <div class="flex flex-col p-3 bg-white border border-gray-100 rounded-lg shadow-xl">
                      <span class="text-[10px] uppercase tracking-wider font-semibold text-gray-400 mb-1">${w.globals.labels[dataPointIndex]}</span>
                      <div class="flex items-end gap-1">
                          <span class="text-2xl font-black text-gray-900 tracking-tight leading-none">${currentVal}</span>
                          <span class="text-xs font-medium text-gray-500 mb-0.5">${config.title.split(' ')[0]}</span>
                      </div>
                      ${variationHtml}
                  </div>
              `;
            }
          },
        } as ApexCharts.ApexOptions
      };
    }

    return {
      series: [{
        name: config.title.split(' ')[0],
        data: seriesData
      }],
      options: {
        chart: {
          type: 'area',
          fontFamily: 'Inter, sans-serif',
          toolbar: { show: false },
          zoom: { enabled: false },
        },
        colors: [config.color],
        fill: {
          type: 'gradient',
          gradient: {
            shadeIntensity: 1,
            opacityFrom: 0.5,
            opacityTo: 0.05,
            stops: [0, 90, 100]
          }
        },
        dataLabels: { enabled: false },
        stroke: { curve: 'smooth', width: 3 },
        xaxis: {
          categories: enrichedData.map(d => d.monthName),
          axisBorder: { show: false },
          axisTicks: { show: false },
          labels: {
            style: { colors: '#9CA3AF', fontSize: '12px', fontWeight: 500 }
          },
          tooltip: { enabled: false }
        },
        yaxis: {
          labels: {
            formatter: function (value: number) {
              return config.yAxisFormatter(value);
            },
            style: { colors: '#9CA3AF', fontSize: '12px', fontWeight: 500 }
          }
        },
        grid: {
          borderColor: '#F3F4F6',
          strokeDashArray: 4,
          xaxis: { lines: { show: false } },
          yaxis: { lines: { show: true } },
          padding: { top: 0, right: 0, bottom: 0, left: 10 }
        },
        tooltip: {
          custom: function ({ series, seriesIndex, dataPointIndex, w }: any) {
            const currentVal = series[seriesIndex][dataPointIndex];
            let variationHtml = '';

            if (dataPointIndex > 0) {
              const prevVal = series[seriesIndex][dataPointIndex - 1];
              // Proteção contra divisão por zero
              if (prevVal > 0) {
                const variation = ((currentVal - prevVal) / prevVal) * 100;
                const isPositive = variation >= 0;
                const colorClass = isPositive ? 'text-emerald-600' : 'text-rose-600';
                const bgColorClass = isPositive ? 'bg-emerald-50' : 'bg-rose-50';
                const icon = isPositive ? '↗' : '↘';

                variationHtml = `
                          <div class="mt-3 flex items-center">
                              <span class="px-2 py-1 rounded flex items-center gap-1 text-xs font-bold ${bgColorClass} ${colorClass}">
                                  ${icon} ${Math.abs(variation).toFixed(1)}% vs ant.
                              </span>
                          </div>
                      `;
              }
            }

            return `
                    <div class="flex flex-col p-3 bg-white border border-gray-200 rounded-lg shadow-lg">
                        <span class="text-xs uppercase tracking-wider font-semibold text-gray-500 mb-1">${w.globals.labels[dataPointIndex]}</span>
                        <span class="text-xl font-black text-gray-900 tracking-tight">${config.formatter(currentVal)}</span>
                        ${variationHtml}
                    </div>
                `;
          }
        },
        markers: {
          size: 0,
          colors: ['#fff'],
          strokeColors: config.color,
          strokeWidth: 2,
          hover: { size: 6, sizeOffset: 3 }
        },
        annotations: {
          points: maxIndex >= 0 ? [{
            x: enrichedData[maxIndex].monthName,
            y: maxVal,
            marker: {
              size: 5,
              fillColor: '#10B981',
              strokeColor: '#fff',
              strokeWidth: 2,
              shape: "circle"
            },
            label: {
              borderColor: 'transparent',
              offsetY: -15,
              style: {
                color: '#10B981',
                background: 'transparent',
                fontSize: '11px',
                fontWeight: 700,
                padding: { left: 0, right: 0, top: 0, bottom: 0 }
              },
              text: 'MÁXIMA'
            }
          }] : []
        }
      } as ApexCharts.ApexOptions
    };
  };

  const apexData = useMemo(() => getApexOptions(), [enrichedData, selectedMetric, config]);

  return (
    <div className="h-60 w-full">
      {useApexChart ? (
        <Chart
          options={apexData.options}
          series={apexData.series}
          type={useBarChart ? "bar" : "area"}
          height="100%"
          width="100%"
        />
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={enrichedData} margin={{ top: 25, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
            <XAxis dataKey="monthName" stroke="#6B7280" fontSize={12} />
            <YAxis stroke="#6B7280" fontSize={12} tickFormatter={config.yAxisFormatter} />
            <RechartsTooltip content={<CustomRechartsTooltip />} />
            <Bar
              dataKey={selectedMetric}
              radius={[4, 4, 0, 0]}
              shape={(props: any) => {
                const isMax = maxValue && props.payload && props.payload.monthName === maxValue.monthName;
                const isMin = minValue && props.payload && props.payload.monthName === minValue.monthName;

                const maxColor = invertColors ? '#EF4444' : '#10B981';
                const minColor = invertColors ? '#10B981' : '#EF4444';
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
                      <text x={props.x + props.width / 2} y={props.y - 8} textAnchor="middle" className="text-xs font-bold" fill={maxColor}>
                        {maxLabel}
                      </text>
                    )}
                    {isMin && (
                      <text x={props.x + props.width / 2} y={props.y - 8} textAnchor="middle" className="text-xs font-bold" fill={minColor}>
                        {minLabel}
                      </text>
                    )}
                  </g>
                );
              }}
            />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
};

export default MonthlyComparisonChart;