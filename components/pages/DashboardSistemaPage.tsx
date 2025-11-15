import React, { useState, useEffect, useCallback } from 'react';
import { useAppContext } from '../../contexts/AppContext';
import { useAuth } from '../../contexts/AuthContext';
import { Icon } from '../ui/Icon';
import { supabase } from '../../services/supabaseClient';
import {
  fetchMonitoringLogs,
  fetchErrorLogs,
  fetchMonitoringStats,
  fetchLatestErrorsByWorkflow,
  fetchActions
} from '../../services/integration/dataDrome.service';
import type { N8NMonitoringLog, N8NErrorLog } from '../../types';

type TabType = 'n8n' | 'metrics';
type PeriodFilter = 'today' | 'yesterday' | 'last7days' | 'lastWeek' | 'lastMonth' | 'last30days';

const DashboardSistemaPage: React.FC = () => {
  const { selectedUnit } = useAppContext();
  const { profile } = useAuth();
  
  const [activeTab, setActiveTab] = useState<TabType>('n8n');
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodFilter>('today');
  const [monitoringLogs, setMonitoringLogs] = useState<N8NMonitoringLog[]>([]);
  const [errorLogs, setErrorLogs] = useState<N8NErrorLog[]>([]);
  const [stats, setStats] = useState<{
    total: number;
    successCount: number;
    errorCount: number;
    byWorkflow: { workflow: string; count: number }[];
  }>({ total: 0, successCount: 0, errorCount: 0, byWorkflow: [] });
  const [latestErrors, setLatestErrors] = useState<any[]>([]);
  
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Estado para filtro de workflow
  const [selectedWorkflow, setSelectedWorkflow] = useState<string | null>(null);
  const [isWorkflowDropdownOpen, setIsWorkflowDropdownOpen] = useState(false);
  
  // Estado para filtro de unidade
  const [selectedUnitFilter, setSelectedUnitFilter] = useState<string | null>(null);
  const [isUnitDropdownOpen, setIsUnitDropdownOpen] = useState(false);
  const [unitsMap, setUnitsMap] = useState<Map<string, string>>(new Map()); // unit_code -> unit_name
  const [actionsMap, setActionsMap] = useState<Map<string, string>>(new Map()); // action_code -> action_name
  
  // Estado para mostrar gráfico de evolução
  const [showExecutionChart, setShowExecutionChart] = useState(false);
  
  // Estado para mostrar logs de erro
  const [showErrorLogs, setShowErrorLogs] = useState(false);

  // Verifica se é super_admin
  const isSuperAdmin = profile?.role === 'super_admin';

  // Busca unidades do banco dromeflow para mapeamento
  useEffect(() => {
    const fetchUnits = async () => {
      try {
        const { data: units, error } = await supabase
          .from('units')
          .select('unit_code, unit_name');
        
        if (error) throw error;
        
        const map = new Map<string, string>();
        units?.forEach(unit => {
          if (unit.unit_code && unit.unit_name) {
            map.set(unit.unit_code, unit.unit_name);
          }
        });
        setUnitsMap(map);
      } catch (err) {
        console.error('[Dashboard Sistema] Erro ao buscar unidades:', err);
      }
    };
    
    const fetchActionsData = async () => {
      try {
        const map = await fetchActions();
        setActionsMap(map);
      } catch (err) {
        console.error('[Dashboard Sistema] Erro ao buscar ações:', err);
      }
    };
    
    fetchUnits();
    fetchActionsData();
  }, []);

  // Função auxiliar para obter nome da unidade
  const getUnitName = (unitCode: string | null): string => {
    if (!unitCode) return 'N/A';
    return unitsMap.get(unitCode) || unitCode;
  };

  // Função auxiliar para obter nome da ação
  const getActionName = (actionCode: string | null): string => {
    if (!actionCode) return 'N/A';
    return actionsMap.get(actionCode) || actionCode;
  };

  // Calcula intervalo de datas baseado no filtro
  const getDateRange = (period: PeriodFilter): { start: Date; end: Date } => {
    const now = new Date();
    const end = new Date(now);
    let start = new Date(now);

    switch (period) {
      case 'today':
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        break;
      case 'yesterday':
        start.setDate(now.getDate() - 1);
        start.setHours(0, 0, 0, 0);
        end.setDate(now.getDate() - 1);
        end.setHours(23, 59, 59, 999);
        break;
      case 'last7days':
        start.setDate(now.getDate() - 7);
        start.setHours(0, 0, 0, 0);
        break;
      case 'lastWeek':
        const lastMonday = new Date(now);
        lastMonday.setDate(now.getDate() - now.getDay() - 6);
        lastMonday.setHours(0, 0, 0, 0);
        start = lastMonday;
        end.setDate(lastMonday.getDate() + 6);
        end.setHours(23, 59, 59, 999);
        break;
      case 'lastMonth':
        start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
        break;
      case 'last30days':
        start.setDate(now.getDate() - 30);
        start.setHours(0, 0, 0, 0);
        break;
    }

    return { start, end };
  };

  // Filtra logs por período
  const filterLogsByPeriod = (logs: N8NMonitoringLog[]) => {
    const { start, end } = getDateRange(selectedPeriod);
    return logs.filter(log => {
      const logDate = new Date(log.created_at);
      return logDate >= start && logDate <= end;
    });
  };

  const loadData = useCallback(async () => {
    if (!isSuperAdmin) {
      setError('Acesso restrito a Super Administradores');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Busca todos os logs (filtro será aplicado no frontend)
      const [logs, errors, latestErrs] = await Promise.all([
        fetchMonitoringLogs(1000), // Aumenta limite para ter dados suficientes
        fetchErrorLogs(500),
        fetchLatestErrorsByWorkflow(10)
      ]);

      setMonitoringLogs(logs);
      setErrorLogs(errors);
      setLatestErrors(latestErrs);
      
      // Calcula stats dos logs filtrados
      const filteredLogs = filterLogsByPeriod(logs);
      const total = filteredLogs.length;
      const successCount = filteredLogs.filter(l => l.status?.toLowerCase() === 'success' || l.status?.toLowerCase() === 'sucesso').length;
      const errorCount = filteredLogs.filter(l => l.status?.toLowerCase() === 'error' || l.status?.toLowerCase() === 'erro').length;

      const workflowCounts = filteredLogs.reduce((acc: { [key: string]: number }, log) => {
        const wf = log.workflow || 'Unknown';
        acc[wf] = (acc[wf] || 0) + 1;
        return acc;
      }, {});

      const byWorkflow = Object.entries(workflowCounts)
        .map(([workflow, count]) => ({ workflow, count: count as number }))
        .sort((a, b) => b.count - a.count);

      setStats({ total, successCount, errorCount, byWorkflow });
    } catch (err: any) {
      console.error('[Dashboard Sistema] Erro ao carregar dados:', err);
      setError('Falha ao carregar dados do sistema');
    } finally {
      setIsLoading(false);
    }
  }, [isSuperAdmin, selectedPeriod]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Formata data/hora
  const formatDateTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Renderiza badge de status
  const StatusBadge: React.FC<{ status: string | null }> = ({ status }) => {
    const statusLower = status?.toLowerCase();
    const isSuccess = statusLower === 'success' || statusLower === 'sucesso';
    const isError = statusLower === 'error' || statusLower === 'erro';

    return (
      <span className={`px-2 py-1 text-xs font-medium rounded ${
        isSuccess ? 'bg-green-100 text-green-800' :
        isError ? 'bg-red-100 text-red-800' :
        'bg-gray-100 text-gray-800'
      }`}>
        {status || 'N/A'}
      </span>
    );
  };

  if (!isSuperAdmin) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center p-8 bg-bg-secondary rounded-lg border border-border-primary">
          <Icon name="shield-alert" className="w-12 h-12 mx-auto mb-4 text-red-500" />
          <h3 className="text-lg font-bold text-text-primary mb-2">Acesso Restrito</h3>
          <p className="text-text-secondary">
            Este módulo é exclusivo para Super Administradores.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">
            Dashboard Sistema
          </h1>
        </div>
        <button
          onClick={loadData}
          disabled={isLoading}
          className="p-2 bg-accent-primary text-white rounded-lg hover:bg-accent-secondary transition-colors disabled:opacity-50"
          title="Atualizar"
        >
          {isLoading ? (
            <Icon name="Loader2" className="w-5 h-5 animate-spin" />
          ) : (
            <Icon name="RefreshCw" className="w-5 h-5" />
          )}
        </button>
      </div>

      {/* Tabs */}
      <div className="border-b border-border-secondary">
        <nav className="flex gap-4">
          <button
            onClick={() => setActiveTab('n8n')}
            className={`px-4 py-2 font-medium transition-colors border-b-2 ${
              activeTab === 'n8n'
                ? 'border-accent-primary text-accent-primary'
                : 'border-transparent text-text-secondary hover:text-text-primary'
            }`}
          >
            <div className="flex items-center gap-2">
              <Icon name="workflow" className="w-4 h-4" />
              N8N Workflows
            </div>
          </button>

          <button
            onClick={() => setActiveTab('metrics')}
            className={`px-4 py-2 font-medium transition-colors border-b-2 ${
              activeTab === 'metrics'
                ? 'border-accent-primary text-accent-primary'
                : 'border-transparent text-text-secondary hover:text-text-primary'
            }`}
          >
            <div className="flex items-center gap-2">
              <Icon name="bar-chart-3" className="w-4 h-4" />
              Métricas Sistema
            </div>
          </button>
        </nav>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Icon name="loader-2" className="w-8 h-8 animate-spin text-accent-primary" />
        </div>
      )}

      {/* Error State */}
      {error && !isLoading && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
          <div className="flex items-center gap-2">
            <Icon name="alert-circle" className="w-5 h-5" />
            {error}
          </div>
        </div>
      )}

      {/* Tab Content */}
      {!isLoading && !error && (
        <>
          {/* Tab: N8N Workflows */}
          {activeTab === 'n8n' && (
            <div className="space-y-6">
              {/* Stats Cards - Estilo compacto igual ao Atendimentos */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <button
                  type="button"
                  onClick={() => setShowExecutionChart(!showExecutionChart)}
                  className={`p-3 rounded-lg border bg-bg-secondary border-border-primary hover:shadow-md transition-all ${
                    showExecutionChart ? 'ring-2 ring-accent-primary' : ''
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Icon name="Activity" className="w-5 h-5 text-blue-600" />
                    <span className="text-sm font-medium text-text-secondary">Total Execuções</span>
                    <span className="ml-auto text-lg font-bold text-text-primary">{stats.total}</span>
                    <Icon 
                      name={showExecutionChart ? "ChevronUp" : "ChevronDown"} 
                      className="w-4 h-4 text-text-secondary" 
                    />
                  </div>
                </button>
                <button
                  type="button"
                  className="p-3 rounded-lg border bg-bg-secondary border-border-primary hover:shadow-md transition-all"
                >
                  <div className="flex items-center gap-2">
                    <Icon name="CheckCircle" className="w-5 h-5 text-green-600" />
                    <span className="text-sm font-medium text-text-secondary">Sucesso</span>
                    <span className="ml-auto text-lg font-bold text-green-600">{stats.successCount}</span>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setShowErrorLogs(!showErrorLogs)}
                  className={`p-3 rounded-lg border bg-bg-secondary border-border-primary hover:shadow-md transition-all ${
                    showErrorLogs ? 'ring-2 ring-red-500' : ''
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Icon name="XCircle" className="w-5 h-5 text-red-600" />
                    <span className="text-sm font-medium text-text-secondary">Erros</span>
                    <span className="ml-auto text-lg font-bold text-red-600">{stats.errorCount}</span>
                    <Icon 
                      name={showErrorLogs ? "ChevronUp" : "ChevronDown"} 
                      className="w-4 h-4 text-text-secondary" 
                    />
                  </div>
                </button>
                <button
                  type="button"
                  className="p-3 rounded-lg border bg-bg-secondary border-border-primary hover:shadow-md transition-all"
                >
                  <div className="flex items-center gap-2">
                    <Icon name="Zap" className="w-5 h-5 text-purple-600" />
                    <span className="text-sm font-medium text-text-secondary">Taxa Sucesso</span>
                    <span className="ml-auto text-lg font-bold text-purple-600">
                      {stats.total > 0 ? Math.round((stats.successCount / stats.total) * 100) : 0}%
                    </span>
                  </div>
                </button>
              </div>

              {/* Área de Tabela com Filtros no topo - Igual ao Atendimentos */}
              <div className="bg-bg-secondary rounded-lg shadow-md overflow-hidden">
                {/* Barra de filtros de período */}
                <div className="p-4 border-b border-border-secondary bg-bg-tertiary">
                  <div className="flex w-full gap-2">
                    <button
                      onClick={() => setSelectedPeriod('today')}
                      className={`flex-1 px-4 py-2 rounded-md text-xs sm:text-sm font-medium transition text-center border ${
                        selectedPeriod === 'today'
                          ? 'bg-accent-primary text-text-on-accent border-accent-primary shadow'
                          : 'bg-bg-tertiary text-text-secondary border-border-secondary hover:text-text-primary hover:shadow'
                      }`}
                    >
                      Hoje
                    </button>
                    <button
                      onClick={() => setSelectedPeriod('yesterday')}
                      className={`flex-1 px-4 py-2 rounded-md text-xs sm:text-sm font-medium transition text-center border ${
                        selectedPeriod === 'yesterday'
                          ? 'bg-accent-primary text-text-on-accent border-accent-primary shadow'
                          : 'bg-bg-tertiary text-text-secondary border-border-secondary hover:text-text-primary hover:shadow'
                      }`}
                    >
                      Dia Anterior
                    </button>
                    <button
                      onClick={() => setSelectedPeriod('last7days')}
                      className={`flex-1 px-4 py-2 rounded-md text-xs sm:text-sm font-medium transition text-center border ${
                        selectedPeriod === 'last7days'
                          ? 'bg-accent-primary text-text-on-accent border-accent-primary shadow'
                          : 'bg-bg-tertiary text-text-secondary border-border-secondary hover:text-text-primary hover:shadow'
                      }`}
                    >
                      Últimos 7 dias
                    </button>
                    <button
                      onClick={() => setSelectedPeriod('lastWeek')}
                      className={`flex-1 px-4 py-2 rounded-md text-xs sm:text-sm font-medium transition text-center border ${
                        selectedPeriod === 'lastWeek'
                          ? 'bg-accent-primary text-text-on-accent border-accent-primary shadow'
                          : 'bg-bg-tertiary text-text-secondary border-border-secondary hover:text-text-primary hover:shadow'
                      }`}
                    >
                      Última Semana
                    </button>
                    <button
                      onClick={() => setSelectedPeriod('lastMonth')}
                      className={`flex-1 px-4 py-2 rounded-md text-xs sm:text-sm font-medium transition text-center border ${
                        selectedPeriod === 'lastMonth'
                          ? 'bg-accent-primary text-text-on-accent border-accent-primary shadow'
                          : 'bg-bg-tertiary text-text-secondary border-border-secondary hover:text-text-primary hover:shadow'
                      }`}
                    >
                      Mês Anterior
                    </button>
                    <button
                      onClick={() => setSelectedPeriod('last30days')}
                      className={`flex-1 px-4 py-2 rounded-md text-xs sm:text-sm font-medium transition text-center border ${
                        selectedPeriod === 'last30days'
                          ? 'bg-accent-primary text-text-on-accent border-accent-primary shadow'
                          : 'bg-bg-tertiary text-text-secondary border-border-secondary hover:text-text-primary hover:shadow'
                      }`}
                    >
                      Últimos 30 dias
                    </button>
                  </div>
                </div>
                
                {/* Gráfico de Evolução das Execuções */}
                {showExecutionChart && (
                  <div className="p-4 bg-bg-secondary border-t border-border-secondary">
                    <h3 className="text-sm font-semibold text-text-primary mb-4 flex items-center gap-2">
                      <Icon name="TrendingUp" className="w-4 h-4" />
                      Evolução das Execuções por Hora
                    </h3>
                    {(() => {
                      // Agrupa logs por hora e status
                      const filteredLogs = filterLogsByPeriod(monitoringLogs)
                        .filter(log => !selectedWorkflow || log.workflow === selectedWorkflow)
                        .filter(log => !selectedUnitFilter || log.unit === selectedUnitFilter);
                      
                      const hourlyData = new Map<number, { success: number; error: number }>();
                      
                      filteredLogs.forEach(log => {
                        const date = new Date(log.created_at);
                        const hour = date.getHours();
                        
                        if (!hourlyData.has(hour)) {
                          hourlyData.set(hour, { success: 0, error: 0 });
                        }
                        
                        const data = hourlyData.get(hour)!;
                        const isSuccess = log.status?.toLowerCase() === 'success';
                        
                        if (isSuccess) {
                          data.success++;
                        } else {
                          data.error++;
                        }
                      });
                      
                      // Ordena as horas e preenche intervalo contínuo
                      const sortedHours = Array.from(hourlyData.entries())
                        .sort((a, b) => a[0] - b[0]);
                      
                      if (sortedHours.length === 0) {
                        return (
                          <div className="space-y-4">
                            <p className="text-sm text-text-secondary text-center py-4">
                              Nenhum dado disponível para o período e filtros selecionados
                            </p>
                          </div>
                        );
                      }
                      
                      // Pega primeira e última hora com dados, limitando ao horário comercial
                      const firstHour = 6; // Sempre inicia às 6h
                      const lastHour = 23; // Sempre termina às 23h
                      
                      // Cria array contínuo de horas (inclui horas sem execuções)
                      const continuousHours: Array<[number, { success: number; error: number }]> = [];
                      for (let h = firstHour; h <= lastHour; h++) {
                        continuousHours.push([h, hourlyData.get(h) || { success: 0, error: 0 }]);
                      }
                      
                      // Define valor máximo baseado no maior número de execuções em uma hora
                      const maxValue = Math.max(...continuousHours.map(([_, data]) => data.success + data.error));
                      
                      return (
                        <div className="space-y-4">
                          <>
                            {/* Gráfico de barras verticais */}
                            <div className="relative" style={{ height: '250px' }}>
                              {/* Linhas de grade horizontais com valores no eixo Y */}
                              <div className="absolute inset-0 flex flex-col justify-between">
                                {[0, 1, 2, 3, 4].map((i) => {
                                  const value = i === 0 ? maxValue : Math.round((maxValue * (4 - i)) / 4);
                                  return (
                                    <div key={i} className="flex items-center">
                                      <span className="text-xs font-medium text-text-secondary w-10 text-right pr-2">
                                        {value}
                                      </span>
                                      <div className="flex-1 border-t border-border-secondary border-dashed"></div>
                                    </div>
                                  );
                                })}
                              </div>
                              
                              {/* Barras - Colunas únicas por hora */}
                              <div className="absolute inset-0 pl-12 flex items-end gap-1 pb-8">
                                {continuousHours.map(([hour, data]) => {
                                  const total = data.success + data.error;
                                  const totalHeight = total > 0 ? (total / maxValue) * 100 : 0;
                                  const successPercent = total > 0 ? (data.success / total) * 100 : 0;
                                  const errorPercent = total > 0 ? (data.error / total) * 100 : 0;
                                  
                                  // Define cor baseada na proporção de sucesso
                                  let barColor = 'bg-gray-300';
                                  if (total > 0) {
                                    if (successPercent === 100) {
                                      barColor = 'bg-green-500 hover:bg-green-600';
                                    } else if (errorPercent === 100) {
                                      barColor = 'bg-red-500 hover:bg-red-600';
                                    } else if (successPercent >= 75) {
                                      barColor = 'bg-green-400 hover:bg-green-500';
                                    } else if (successPercent >= 50) {
                                      barColor = 'bg-yellow-400 hover:bg-yellow-500';
                                    } else if (successPercent >= 25) {
                                      barColor = 'bg-orange-400 hover:bg-orange-500';
                                    } else {
                                      barColor = 'bg-red-400 hover:bg-red-500';
                                    }
                                  }
                                  
                                  return (
                                    <div 
                                      key={hour} 
                                      className="flex-1 flex flex-col items-center justify-end"
                                      style={{ minWidth: '20px' }}
                                    >
                                      {total > 0 ? (
                                        <div 
                                          className={`w-full ${barColor} rounded-t transition-all cursor-pointer relative group`}
                                          style={{ 
                                            height: `${Math.max(totalHeight, 8)}%`,
                                            minHeight: '30px'
                                          }}
                                          title={`${String(hour).padStart(2, '0')}h\nTotal: ${total}\nSucesso: ${data.success}\nErro: ${data.error}`}
                                        >
                                          {/* Número total */}
                                          <div className="absolute inset-0 flex flex-col items-center justify-center">
                                            <span className="text-xs font-bold text-white drop-shadow-md">
                                              {total}
                                            </span>
                                            {total > 1 && totalHeight > 30 && (
                                              <div className="text-[10px] text-white/90 mt-0.5">
                                                {data.success > 0 && <div>✓{data.success}</div>}
                                                {data.error > 0 && <div>✗{data.error}</div>}
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      ) : (
                                        <div className="w-full h-1 bg-border-secondary rounded opacity-30" title={`${String(hour).padStart(2, '0')}h - Sem execuções`}></div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                              
                              {/* Eixo X - Horas (a partir da primeira execução) */}
                              <div className="absolute bottom-0 left-12 right-0 flex gap-1">
                                {continuousHours.map(([hour]) => (
                                  <div 
                                    key={hour} 
                                    className="flex-1 text-center"
                                    style={{ minWidth: '16px' }}
                                  >
                                    <span className="text-xs font-medium text-text-secondary">
                                      {String(hour).padStart(2, '0')}h
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                            
                            {/* Legenda */}
                            <div className="flex items-center justify-center gap-6 pt-2 border-t border-border-secondary">
                              <div className="flex items-center gap-2">
                                <div className="w-3 h-3 bg-green-500 rounded"></div>
                                <span className="text-xs text-text-secondary">Sucesso</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="w-3 h-3 bg-red-500 rounded"></div>
                                <span className="text-xs text-text-secondary">Erro</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-medium text-text-primary">
                                  Período: {String(firstHour).padStart(2, '0')}h - {String(lastHour).padStart(2, '0')}h
                                </span>
                              </div>
                            </div>
                          </>
                        </div>
                      );
                    })()}
                  </div>
                )}
                
                {/* Logs de Erro - Aparecem quando card Erros é clicado */}
                {showErrorLogs && (
                  <div className="space-y-4 p-4 bg-bg-tertiary border-t border-border-secondary">
                    <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
                      <Icon name="AlertTriangle" className="w-4 h-4 text-red-600" />
                      Logs de Erro
                    </h3>
                    
                    {/* Latest Errors by Workflow */}
                    {latestErrors.length > 0 && (
                      <div className="bg-bg-secondary rounded-lg border border-border-primary overflow-hidden">
                        <div className="px-4 py-2 border-b border-border-secondary bg-red-50">
                          <h4 className="text-xs font-semibold text-red-900">Erros Agrupados por Workflow</h4>
                        </div>
                        <div className="p-3 space-y-2 max-h-60 overflow-y-auto">
                          {latestErrors.map((err, idx) => (
                            <div key={idx} className="p-2 bg-red-50 border border-red-200 rounded">
                              <div className="flex items-start justify-between gap-4">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    <Icon name="AlertCircle" className="w-3.5 h-3.5 text-red-600 flex-shrink-0" />
                                    <span className="font-semibold text-xs text-red-900 truncate">{err.workflow}</span>
                                    <span className="px-1.5 py-0.5 text-[10px] bg-red-200 text-red-900 rounded-full flex-shrink-0">
                                      {err.count}x
                                    </span>
                                  </div>
                                  <p className="text-xs text-red-800 truncate">{err.lastError}</p>
                                </div>
                                <span className="text-[10px] text-red-700 whitespace-nowrap">
                                  {formatDateTime(err.lastOccurrence)}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* All Error Logs - Tabela compacta */}
                    <div className="bg-bg-secondary rounded-lg border border-border-primary overflow-hidden">
                      <div className="px-4 py-2 border-b border-border-secondary bg-red-50">
                        <h4 className="text-xs font-semibold text-red-900">Todos os Erros</h4>
                      </div>
                      <div className="overflow-x-auto max-h-80">
                        <table className="w-full">
                          <thead className="bg-bg-tertiary sticky top-0">
                            <tr>
                              <th className="px-3 py-2 text-left text-[10px] font-medium text-text-secondary">Data/Hora</th>
                              <th className="px-3 py-2 text-left text-[10px] font-medium text-text-secondary">Workflow</th>
                              <th className="px-3 py-2 text-left text-[10px] font-medium text-text-secondary">Mensagem de Erro</th>
                              <th className="px-3 py-2 text-left text-[10px] font-medium text-text-secondary">URL</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border-secondary">
                            {errorLogs.length === 0 ? (
                              <tr>
                                <td colSpan={4} className="px-3 py-6 text-center text-text-secondary">
                                  <div className="flex flex-col items-center gap-2">
                                    <Icon name="CheckCircle" className="w-6 h-6 text-green-500" />
                                    <p className="text-xs">Nenhum erro registrado!</p>
                                  </div>
                                </td>
                              </tr>
                            ) : (
                              errorLogs.map((log) => (
                                <tr key={log.id} className="hover:bg-bg-tertiary transition-colors">
                                  <td className="px-3 py-2 text-xs text-text-secondary whitespace-nowrap">
                                    {formatDateTime(log.created_at)}
                                  </td>
                                  <td className="px-3 py-2 text-xs text-text-primary font-medium">
                                    {log.workflow || 'N/A'}
                                  </td>
                                  <td className="px-3 py-2 text-xs text-red-600">
                                    <div className="max-w-md truncate" title={log.erro_message || 'N/A'}>
                                      {log.erro_message || 'N/A'}
                                    </div>
                                  </td>
                                  <td className="px-3 py-2 text-xs">
                                    {log.url_workflow ? (
                                      <a
                                        href={log.url_workflow}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-accent-primary hover:underline flex items-center gap-1"
                                      >
                                        <Icon name="ExternalLink" className="w-3 h-3" />
                                        Ver
                                      </a>
                                    ) : (
                                      <span className="text-text-secondary">N/A</span>
                                    )}
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}
                
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-bg-primary border-y border-border-secondary">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">Data/Hora</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">
                          <div className="flex items-center gap-2 relative">
                            <span>Workflow</span>
                            <button
                              onClick={() => setIsWorkflowDropdownOpen(!isWorkflowDropdownOpen)}
                              className="p-1 hover:bg-bg-tertiary rounded transition-colors"
                              title="Filtrar por workflow"
                            >
                              <Icon name="Filter" className="w-3.5 h-3.5" />
                            </button>
                            {selectedWorkflow && (
                              <button
                                onClick={() => setSelectedWorkflow(null)}
                                className="p-1 hover:bg-bg-tertiary rounded transition-colors text-accent-primary"
                                title="Limpar filtro"
                              >
                                <Icon name="X" className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {isWorkflowDropdownOpen && (
                              <div className="absolute top-full left-0 mt-1 bg-bg-secondary border border-border-primary rounded-lg shadow-lg z-10 min-w-[200px] max-h-[300px] overflow-y-auto">
                                <button
                                  onClick={() => {
                                    setSelectedWorkflow(null);
                                    setIsWorkflowDropdownOpen(false);
                                  }}
                                  className={`w-full px-3 py-2 text-left text-sm hover:bg-bg-tertiary transition-colors ${
                                    !selectedWorkflow ? 'bg-accent-primary/10 text-accent-primary font-medium' : 'text-text-primary'
                                  }`}
                                >
                                  Todos os workflows
                                </button>
                                {Array.from(new Set(filterLogsByPeriod(monitoringLogs).map(log => log.workflow).filter(Boolean)))
                                  .sort()
                                  .map((workflow) => (
                                    <button
                                      key={workflow}
                                      onClick={() => {
                                        setSelectedWorkflow(workflow!);
                                        setIsWorkflowDropdownOpen(false);
                                      }}
                                      className={`w-full px-3 py-2 text-left text-sm hover:bg-bg-tertiary transition-colors border-t border-border-secondary ${
                                        selectedWorkflow === workflow ? 'bg-accent-primary/10 text-accent-primary font-medium' : 'text-text-primary'
                                      }`}
                                    >
                                      {workflow}
                                    </button>
                                  ))}
                              </div>
                            )}
                          </div>
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">
                          <div className="flex items-center gap-2 relative">
                            <span>Unidade</span>
                            <button
                              onClick={() => setIsUnitDropdownOpen(!isUnitDropdownOpen)}
                              className="p-1 hover:bg-bg-tertiary rounded transition-colors"
                              title="Filtrar por unidade"
                            >
                              <Icon name="Filter" className="w-3.5 h-3.5" />
                            </button>
                            {selectedUnitFilter && (
                              <button
                                onClick={() => setSelectedUnitFilter(null)}
                                className="p-1 hover:bg-bg-tertiary rounded transition-colors text-accent-primary"
                                title="Limpar filtro"
                              >
                                <Icon name="X" className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {isUnitDropdownOpen && (
                              <div className="absolute top-full left-0 mt-1 bg-bg-secondary border border-border-primary rounded-lg shadow-lg z-10 min-w-[200px] max-h-[300px] overflow-y-auto">
                                <button
                                  onClick={() => {
                                    setSelectedUnitFilter(null);
                                    setIsUnitDropdownOpen(false);
                                  }}
                                  className={`w-full px-3 py-2 text-left text-sm hover:bg-bg-tertiary transition-colors ${
                                    !selectedUnitFilter ? 'bg-accent-primary/10 text-accent-primary font-medium' : 'text-text-primary'
                                  }`}
                                >
                                  Todas as unidades
                                </button>
                                {Array.from(new Set(filterLogsByPeriod(monitoringLogs).map(log => log.unit).filter(Boolean)))
                                  .sort((a, b) => {
                                    const nameA = getUnitName(a!);
                                    const nameB = getUnitName(b!);
                                    return nameA.localeCompare(nameB);
                                  })
                                  .map((unit) => (
                                    <button
                                      key={unit}
                                      onClick={() => {
                                        setSelectedUnitFilter(unit!);
                                        setIsUnitDropdownOpen(false);
                                      }}
                                      className={`w-full px-3 py-2 text-left text-sm hover:bg-bg-tertiary transition-colors border-t border-border-secondary ${
                                        selectedUnitFilter === unit ? 'bg-accent-primary/10 text-accent-primary font-medium' : 'text-text-primary'
                                      }`}
                                    >
                                      {getUnitName(unit!)}
                                    </button>
                                  ))}
                              </div>
                            )}
                          </div>
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">Usuário</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">Ação</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">Status</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">Atend. ID</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-secondary">
                      {filterLogsByPeriod(monitoringLogs).length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-4 py-8 text-center text-text-secondary">
                            Nenhum log de monitoramento encontrado para o período selecionado
                          </td>
                        </tr>
                      ) : (
                        filterLogsByPeriod(monitoringLogs)
                          .filter(log => !selectedWorkflow || log.workflow === selectedWorkflow)
                          .filter(log => !selectedUnitFilter || log.unit === selectedUnitFilter)
                          .map((log) => (
                          <tr key={log.id} className="hover:bg-bg-tertiary transition-colors">
                            <td className="px-4 py-3 text-sm text-text-secondary">
                              {formatDateTime(log.created_at)}
                            </td>
                            <td className="px-4 py-3 text-sm text-text-primary font-medium">
                              {log.workflow || 'N/A'}
                            </td>
                            <td className="px-4 py-3 text-sm text-text-secondary">
                              {getUnitName(log.unit)}
                            </td>
                            <td className="px-4 py-3 text-sm text-text-secondary">
                              {log.user || 'N/A'}
                            </td>
                            <td className="px-4 py-3 text-sm text-text-secondary">
                              {getActionName(log.action)}
                            </td>
                            <td className="px-4 py-3">
                              <StatusBadge status={log.status} />
                            </td>
                            <td className="px-4 py-3 text-sm text-text-secondary font-mono">
                              {log.atend_id || 'N/A'}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Tab: Métricas Sistema */}
          {activeTab === 'metrics' && (
            <div className="space-y-6">
              <div className="bg-bg-secondary rounded-lg border border-border-primary p-8 text-center">
                <Icon name="chart-bar" className="w-12 h-12 mx-auto mb-4 text-text-secondary" />
                <h3 className="text-lg font-semibold text-text-primary mb-2">
                  Métricas em Desenvolvimento
                </h3>
                <p className="text-text-secondary">
                  Esta seção será populada com métricas de sistema como:<br />
                  • Usuários ativos<br />
                  • Performance de queries<br />
                  • Uploads recentes<br />
                  • Uso de storage<br />
                  • Logs de auditoria
                </p>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default DashboardSistemaPage;
