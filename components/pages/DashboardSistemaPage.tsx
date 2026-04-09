import React, { useState, useEffect, useCallback } from 'react';
import { useAppContext } from '../../contexts/AppContext';
import { useAuth } from '../../contexts/AuthContext';
import { Icon } from '../ui/Icon';
import { supabase } from '../../services/supabaseClient';
import { n8nService, N8NExecution, N8NWorkflow } from '../../services/n8n/n8n.service';
import type { N8NMonitoringLog, N8NErrorLog } from '../../types';

type TabType = 'n8n' | 'dados';
type PeriodFilter = 'today' | 'yesterday' | 'last7days' | 'lastWeek' | 'lastMonth' | 'last30days';

interface ActivityLog {
  id: number;
  created_at: string;
  unit_code: string | null;
  workflow: string | null;
  action_code: string | null;
  atend_id: string | null;
  user_identifier: string | null;
  status: string | null;
  horario: string | null;
  metadata: any;
}

const DashboardSistemaPage: React.FC = () => {
  const { selectedUnit } = useAppContext();
  const { profile } = useAuth();

  const [activeTab, setActiveTab] = useState<TabType>('n8n');
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodFilter>('today');
  const [monitoringLogs, setMonitoringLogs] = useState<N8NMonitoringLog[]>([]);
  const [errorLogs, setErrorLogs] = useState<N8NErrorLog[]>([]);

  // Estados para N8N API
  const [n8nExecutions, setN8nExecutions] = useState<N8NExecution[]>([]);
  const [n8nWorkflows, setN8nWorkflows] = useState<N8NWorkflow[]>([]);
  const [workflowsMap, setWorkflowsMap] = useState<Map<string, string>>(new Map());

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

  // Estado para controlar qual card está ativo (apenas um por vez)
  const [activeCard, setActiveCard] = useState<'atividades' | 'indexScans' | 'operacoes' | null>('atividades');

  // Estado para activity logs em tempo real
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [activeConnections, setActiveConnections] = useState(0);

  // Estado para paginação da tabela de atividades
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  // Verifica se é super_admin
  const isSuperAdmin = profile?.role === 'super_admin';

  // Funções locais para buscar dados (substituindo dataDrome.service.ts removido)
  const fetchActions = async (): Promise<Map<string, string>> => {
    try {
      const { data, error } = await supabase
        .from('actions')
        .select('action_code, action_name')
        .order('action_name', { ascending: true });

      if (error) {
        console.error('[Dashboard Sistema] Erro ao buscar ações:', error);
        return new Map();
      }

      const map = new Map<string, string>();
      data?.forEach(action => {
        if (action.action_code && action.action_name) {
          map.set(action.action_code, action.action_name);
        }
      });

      return map;
    } catch (error) {
      console.error('[Dashboard Sistema] Falha ao buscar ações:', error);
      return new Map();
    }
  };

  const fetchMonitoringLogs = async (limit: number = 100): Promise<N8NMonitoringLog[]> => {
    try {
      const { data, error } = await supabase
        .from('activity_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      // Mapeia activity_logs para formato N8NMonitoringLog
      return (data || []).map((log: ActivityLog) => ({
        id: log.id,
        created_at: log.created_at,
        horario: log.created_at, // Usa created_at como horario se não houver
        unit: log.unit_code || undefined,
        workflow: log.workflow || undefined,
        status: log.status || undefined,
        action: log.action_code || undefined,
        user: log.user_identifier || undefined,
        user_identifier: log.user_identifier || undefined,
        atend_id: log.atend_id || undefined,
        metadata: log.metadata
      }));
    } catch (error) {
      console.error('[Dashboard Sistema] Falha ao buscar logs de monitoramento:', error);
      return [];
    }
  };

  const fetchErrorLogs = async (limit: number = 50): Promise<N8NErrorLog[]> => {
    try {
      const { data, error } = await supabase
        .from('error_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      return (data || []).map((log: any) => ({
        id: log.id,
        created_at: log.created_at,
        workflow: log.workflow || undefined,
        erro_message: log.error_message || undefined,
        error_message: log.error_message || undefined, // Suporte a ambas as chaves
        url_workflow: log.url_workflow || undefined
      }));
    } catch (error) {
      console.error('[Dashboard Sistema] Falha ao buscar logs de erro:', error);
      return [];
    }
  };

  const fetchLatestErrorsByWorkflow = async (limit: number = 10): Promise<any[]> => {
    try {
      const { data, error } = await supabase
        .from('error_logs')
        .select('workflow, error_message, created_at')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      const logs = data || [];

      // Agrupar por workflow
      const grouped = logs.reduce((acc: { [key: string]: any }, log) => {
        const wf = log.workflow || 'Unknown';
        if (!acc[wf]) {
          acc[wf] = {
            workflow: wf,
            lastError: log.error_message || 'N/A',
            lastOccurrence: log.created_at,
            count: 1
          };
        } else {
          acc[wf].count += 1;
        }
        return acc;
      }, {});

      return Object.values(grouped)
        .sort((a: any, b: any) => b.count - a.count)
        .slice(0, limit);
    } catch (error) {
      console.error('[Dashboard Sistema] Falha ao buscar últimos erros:', error);
      return [];
    }
  };

  // Busca activity logs recentes
  const loadActivityLogs = useCallback(async () => {
    try {
      // Busca últimas 100 atividades da última hora (aumentado para permitir paginação)
      const oneHourAgo = new Date();
      oneHourAgo.setHours(oneHourAgo.getHours() - 1);

      const { data, error } = await supabase
        .from('activity_logs')
        .select('*')
        .gte('created_at', oneHourAgo.toISOString())
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      setActivityLogs(data || []);
      setCurrentPage(1); // Reset para primeira página ao atualizar

      // Conta conexões únicas ativas (últimos 5 minutos)
      const fiveMinAgo = new Date();
      fiveMinAgo.setMinutes(fiveMinAgo.getMinutes() - 5);

      const uniqueUsers = new Set(
        (data || [])
          .filter(log => new Date(log.created_at) >= fiveMinAgo)
          .map(log => log.user_identifier)
          .filter(Boolean)
      );
      setActiveConnections(uniqueUsers.size);
    } catch (err) {
      console.error('[Dashboard Sistema] Erro ao carregar activity logs:', err);
    }
  }, []);

  // Realtime subscription para activity logs (sempre ativo para super_admin)
  useEffect(() => {
    if (!isSuperAdmin) return;

    loadActivityLogs();

    // Subscribe to realtime changes
    const channel = supabase
      .channel('activity_logs_realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'activity_logs'
        },
        (payload) => {
          console.log('[Realtime] Nova atividade:', payload.new);

          // Garantir que o payload tenha um ID antes de adicionar
          const newLog = payload.new as ActivityLog;
          if (newLog && newLog.id) {
            setActivityLogs(prev => {
              // Evitar duplicatas
              if (prev.some(log => log.id === newLog.id)) {
                return prev;
              }
              return [newLog, ...prev.slice(0, 19)];
            });
          }

          // Atualiza contagem de conexões ativas
          loadActivityLogs();
        }
      )
      .subscribe();

    // Refresh a cada 30 segundos para atualizar contadores
    const interval = setInterval(loadActivityLogs, 30000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [isSuperAdmin, loadActivityLogs]);

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
    let end = new Date(now);
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
      // 1. Busca dados do Supabase
      const [logs, errors, latestErrs] = await Promise.all([
        fetchMonitoringLogs(1000),
        fetchErrorLogs(500),
        fetchLatestErrorsByWorkflow(10)
      ]);

      setMonitoringLogs(logs);
      setErrorLogs(errors);
      setLatestErrors(latestErrs);

      // 2. Busca dados da API do N8N
      try {
        const [executionsResult, workflows] = await Promise.all([
          n8nService.getExecutions(50),
          n8nService.getWorkflows()
        ]);

        setN8nExecutions(executionsResult.data);
        setN8nWorkflows(workflows);

        const wfMap = new Map<string, string>();
        workflows.forEach(wf => wfMap.set(wf.id, wf.name));
        setWorkflowsMap(wfMap);

        // Se estivermos na aba n8n, as métricas do topo usam os dados da API
        const executions = executionsResult.data;
        const total = executions.length;
        const successCount = executions.filter(e => e.status === 'success').length;
        const errorCount = executions.filter(e => e.status === 'error').length;

        const workflowStats = executions.reduce((acc: { [key: string]: number }, exec) => {
          const wfName = wfMap.get(exec.workflowId) || exec.workflowId;
          acc[wfName] = (acc[wfName] || 0) + 1;
          return acc;
        }, {});

        const byWorkflow = Object.entries(workflowStats)
          .map(([workflow, count]) => ({ workflow, count: count as number }))
          .sort((a, b) => b.count - a.count);

        setStats({ total, successCount, errorCount, byWorkflow });
      } catch (n8nErr) {
        console.warn('[Dashboard Sistema] Falha ao carregar dados da API do N8N:', n8nErr);
        // Fallback para métricas baseadas em logs do Supabase se a API falhar (ex: CORS ou credenciais)
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
      }
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

  // Formata tempo relativo (ex: "há 2 min")
  const formatTimeAgo = (isoString: string) => {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);

    if (diffSecs < 10) return 'agora';
    if (diffSecs < 60) return `há ${diffSecs}s`;
    if (diffMins < 60) return `há ${diffMins} min`;
    return `há ${diffHours}h`;
  };

  // Renderiza badge de status
  const StatusBadge: React.FC<{ status: string | null }> = ({ status }) => {
    const statusLower = status?.toLowerCase();
    const isSuccess = statusLower === 'success' || statusLower === 'sucesso';
    const isError = statusLower === 'error' || statusLower === 'erro';

    return (
      <span className={`px-2 py-1 text-sm font-medium rounded ${isSuccess ? 'bg-green-100 text-green-800' :
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
            className={`px-4 py-2 font-medium transition-colors border-b-2 ${activeTab === 'n8n'
              ? 'border-accent-primary text-accent-primary'
              : 'border-transparent text-text-secondary hover:text-text-primary'
              }`}
          >
            N8N
          </button>

          <button
            onClick={() => setActiveTab('dados')}
            className={`px-4 py-2 font-medium transition-colors border-b-2 ${activeTab === 'dados'
              ? 'border-accent-primary text-accent-primary'
              : 'border-transparent text-text-secondary hover:text-text-primary'
              }`}
          >
            Dados
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
                  className={`p-3 rounded-lg border bg-bg-secondary border-border-primary hover:shadow-md transition-all ${showExecutionChart ? 'ring-2 ring-accent-primary' : ''
                    }`}
                >
                  <div className="flex items-center gap-2">
                    <Icon name="Activity" className="w-5 h-5 text-blue-600" />
                    <span className="text-base font-semibold text-text-secondary">Total Execuções</span>
                    <span className="ml-auto text-xl font-bold text-text-primary">{stats.total}</span>
                    <Icon
                      name={showExecutionChart ? "ChevronUp" : "ChevronDown"}
                      className="w-5 h-5 text-text-secondary"
                    />
                  </div>
                </button>
                <button
                  type="button"
                  className="p-3 rounded-lg border bg-bg-secondary border-border-primary hover:shadow-md transition-all"
                >
                  <div className="flex items-center gap-2">
                    <Icon name="CheckCircle" className="w-5 h-5 text-green-600" />
                    <span className="text-base font-semibold text-text-secondary">Sucesso</span>
                    <span className="ml-auto text-xl font-bold text-green-600">{stats.successCount}</span>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setShowErrorLogs(!showErrorLogs)}
                  className={`p-3 rounded-lg border bg-bg-secondary border-border-primary hover:shadow-md transition-all ${showErrorLogs ? 'ring-2 ring-red-500' : ''
                    }`}
                >
                  <div className="flex items-center gap-2">
                    <Icon name="XCircle" className="w-5 h-5 text-red-600" />
                    <span className="text-base font-semibold text-text-secondary">Erros</span>
                    <span className="ml-auto text-xl font-bold text-red-600">{stats.errorCount}</span>
                    <Icon
                      name={showErrorLogs ? "ChevronUp" : "ChevronDown"}
                      className="w-5 h-5 text-text-secondary"
                    />
                  </div>
                </button>
                <button
                  type="button"
                  className="p-3 rounded-lg border bg-bg-secondary border-border-primary hover:shadow-md transition-all"
                >
                  <div className="flex items-center gap-2">
                    <Icon name="Zap" className="w-5 h-5 text-purple-600" />
                    <span className="text-base font-semibold text-text-secondary">Taxa Sucesso</span>
                    <span className="ml-auto text-xl font-bold text-purple-600">
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
                      className={`flex-1 px-4 py-2.5 rounded-md text-sm font-bold transition text-center border ${selectedPeriod === 'today'
                        ? 'bg-accent-primary text-text-on-accent border-accent-primary shadow'
                        : 'bg-bg-tertiary text-text-secondary border-border-secondary hover:text-text-primary hover:shadow'
                        }`}
                    >
                      Hoje
                    </button>
                    <button
                      onClick={() => setSelectedPeriod('yesterday')}
                      className={`flex-1 px-4 py-2.5 rounded-md text-sm font-bold transition text-center border ${selectedPeriod === 'yesterday'
                        ? 'bg-accent-primary text-text-on-accent border-accent-primary shadow'
                        : 'bg-bg-tertiary text-text-secondary border-border-secondary hover:text-text-primary hover:shadow'
                        }`}
                    >
                      Dia Anterior
                    </button>
                    <button
                      onClick={() => setSelectedPeriod('last7days')}
                      className={`flex-1 px-4 py-2.5 rounded-md text-sm font-bold transition text-center border ${selectedPeriod === 'last7days'
                        ? 'bg-accent-primary text-text-on-accent border-accent-primary shadow'
                        : 'bg-bg-tertiary text-text-secondary border-border-secondary hover:text-text-primary hover:shadow'
                        }`}
                    >
                      Últimos 7 dias
                    </button>
                    <button
                      onClick={() => setSelectedPeriod('lastWeek')}
                      className={`flex-1 px-4 py-2.5 rounded-md text-sm font-bold transition text-center border ${selectedPeriod === 'lastWeek'
                        ? 'bg-accent-primary text-text-on-accent border-accent-primary shadow'
                        : 'bg-bg-tertiary text-text-secondary border-border-secondary hover:text-text-primary hover:shadow'
                        }`}
                    >
                      Última Semana
                    </button>
                    <button
                      onClick={() => setSelectedPeriod('lastMonth')}
                      className={`flex-1 px-4 py-2.5 rounded-md text-sm font-bold transition text-center border ${selectedPeriod === 'lastMonth'
                        ? 'bg-accent-primary text-text-on-accent border-accent-primary shadow'
                        : 'bg-bg-tertiary text-text-secondary border-border-secondary hover:text-text-primary hover:shadow'
                        }`}
                    >
                      Mês Anterior
                    </button>
                    <button
                      onClick={() => setSelectedPeriod('last30days')}
                      className={`flex-1 px-4 py-2.5 rounded-md text-sm font-bold transition text-center border ${selectedPeriod === 'last30days'
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
                                    <span className="font-semibold text-sm text-red-900 truncate">{err.workflow}</span>
                                    <span className="px-1.5 py-0.5 text-[10px] bg-red-200 text-red-900 rounded-full flex-shrink-0">
                                      {err.count}x
                                    </span>
                                  </div>
                                  <p className="text-sm text-red-800 truncate">{err.lastError}</p>
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
                              <th className="px-3 py-2 text-left text-sm font-medium text-text-secondary">Data/Hora</th>
                              <th className="px-3 py-2 text-left text-sm font-medium text-text-secondary">Workflow</th>
                              <th className="px-3 py-2 text-left text-sm font-medium text-text-secondary">Mensagem de Erro</th>
                              <th className="px-3 py-2 text-left text-sm font-medium text-text-secondary">URL</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border-secondary">
                            {errorLogs.length === 0 ? (
                              <tr>
                                <td colSpan={4} className="px-3 py-6 text-center text-text-secondary">
                                  <div className="flex flex-col items-center gap-2">
                                    <Icon name="CheckCircle" className="w-6 h-6 text-green-500" />
                                    <p className="text-sm">Nenhum erro registrado!</p>
                                  </div>
                                </td>
                              </tr>
                            ) : (
                              errorLogs.map((log) => (
                                <tr key={log.id} className="hover:bg-bg-tertiary transition-colors">
                                  <td className="px-3 py-2 text-sm text-text-secondary whitespace-nowrap">
                                    {formatDateTime(log.created_at)}
                                  </td>
                                  <td className="px-3 py-2 text-sm text-text-primary font-medium">
                                    {log.workflow || 'N/A'}
                                  </td>
                                  <td className="px-3 py-2 text-sm text-red-600">
                                    <div className="max-w-md truncate" title={log.erro_message || 'N/A'}>
                                      {log.erro_message || 'N/A'}
                                    </div>
                                  </td>
                                  <td className="px-3 py-2 text-sm">
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
                        <th className="px-4 py-3 text-left text-sm font-bold text-text-secondary">Data/Hora</th>
                        <th className="px-4 py-3 text-left text-sm font-bold text-text-secondary">
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
                                  className={`w-full px-3 py-2 text-left text-sm hover:bg-bg-tertiary transition-colors ${!selectedWorkflow ? 'bg-accent-primary/10 text-accent-primary font-medium' : 'text-text-primary'
                                    }`}
                                >
                                  Todos os workflows
                                </button>
                                {((n8nExecutions.length > 0)
                                  ? Array.from(new Set(n8nExecutions.map(e => workflowsMap.get(e.workflowId) || e.workflowId)))
                                  : Array.from(new Set(filterLogsByPeriod(monitoringLogs).map(log => log.workflow).filter(Boolean)))
                                ).sort().map((wf) => (
                                  <button
                                    key={wf}
                                    onClick={() => {
                                      setSelectedWorkflow(wf!);
                                      setIsWorkflowDropdownOpen(false);
                                    }}
                                    className={`w-full px-3 py-2 text-left text-sm hover:bg-bg-tertiary transition-colors border-t border-border-secondary ${selectedWorkflow === wf ? 'bg-accent-primary/10 text-accent-primary font-medium' : 'text-text-primary'
                                      }`}
                                  >
                                    {wf}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-bold text-text-secondary">
                          {n8nExecutions.length > 0 ? 'ID Execução' : 'Unidade'}
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-bold text-text-secondary">
                          {n8nExecutions.length > 0 ? 'Modo' : 'Usuário'}
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-bold text-text-secondary">
                          {n8nExecutions.length > 0 ? 'Duração' : 'Ação'}
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-bold text-text-secondary">Status</th>
                        <th className="px-4 py-3 text-left text-sm font-bold text-text-secondary">
                          {n8nExecutions.length > 0 ? 'Link' : 'Atend. ID'}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-secondary">
                      {n8nExecutions.length > 0 ? (
                        /* Renderização via N8N API */
                        n8nExecutions
                          .filter(exec => {
                            const wfName = workflowsMap.get(exec.workflowId) || exec.workflowId;
                            return !selectedWorkflow || wfName === selectedWorkflow;
                          })
                          .map((exec) => (
                            <tr key={exec.id} className="hover:bg-bg-tertiary transition-colors">
                              <td className="px-4 py-3 text-sm text-text-secondary">
                                {formatDateTime(exec.startedAt)}
                              </td>
                              <td className="px-4 py-3 text-sm text-text-primary font-medium">
                                {workflowsMap.get(exec.workflowId) || exec.workflowId}
                                <span className="ml-2 px-1.5 py-0.5 text-[10px] bg-bg-tertiary text-text-tertiary rounded border border-border-secondary">
                                  ID: {exec.workflowId.substring(0, 8)}...
                                </span>
                              </td>
                              <td className="px-4 py-3 text-sm text-text-secondary font-mono">
                                {exec.id}
                              </td>
                              <td className="px-4 py-3 text-sm text-text-secondary">
                                {exec.mode === 'trigger' ? 'Trigger' : 'Manual'}
                              </td>
                              <td className="px-4 py-3 text-sm text-text-secondary">
                                {exec.stoppedAt ? Math.round((new Date(exec.stoppedAt).getTime() - new Date(exec.startedAt).getTime()) / 1000) + 's' : '-'}
                              </td>
                              <td className="px-4 py-3">
                                <StatusBadge status={exec.status} />
                              </td>
                              <td className="px-4 py-3 text-sm text-text-secondary">
                                <a
                                  href={`https://bot.dromeflow.com/workflow/${exec.workflowId}/executions/${exec.id}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-accent-primary hover:underline flex items-center gap-1"
                                >
                                  Abrir <Icon name="ExternalLink" className="w-3 h-3" />
                                </a>
                              </td>
                            </tr>
                          ))
                      ) : filterLogsByPeriod(monitoringLogs).length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-4 py-8 text-center text-text-secondary">
                            Nenhum dado de execução encontrado (API ou Logs)
                          </td>
                        </tr>
                      ) : (
                        /* Fallback para logs do Supabase */
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
                              <td className="px-4 py-3 text-sm text-text-secondary text-center" colSpan={3}>
                                {getUnitName(log.unit)} - {getActionName(log.action)}
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

          {/* Tab: Dados do Sistema */}
          {activeTab === 'dados' && (
            <div className="space-y-6">
              {/* Card Armazenamento - Mesma altura dos cards N8N com barra de progresso */}
              <div className="p-3 rounded-lg border bg-bg-secondary border-border-primary shadow-sm">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2 min-w-[140px]">
                    <Icon name="HardDrive" className="w-5 h-5 text-blue-600" />
                    <span className="text-sm font-medium text-text-secondary">Armazenamento</span>
                  </div>
                  <div className="flex-1 flex items-center gap-4">
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-semibold text-blue-600">1.6%</span>
                      </div>
                      <div className="w-full bg-border-secondary rounded-full h-2">
                        <div className="bg-blue-500 h-2 rounded-full transition-all" style={{ width: '1.6%' }}></div>
                      </div>
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-lg font-bold text-text-primary">83 MB</span>
                      <span className="text-xs text-text-secondary">/ 5 GB</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Filtros de Cards - Estilo igual aos filtros de período N8N */}
              <div className="flex w-full gap-2">
                {isSuperAdmin && (
                  <button
                    type="button"
                    onClick={() => setActiveCard(activeCard === 'atividades' ? null : 'atividades')}
                    className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition text-center border ${activeCard === 'atividades'
                      ? 'bg-accent-primary text-text-on-accent border-accent-primary shadow'
                      : 'bg-bg-tertiary text-text-secondary border-border-secondary hover:text-text-primary hover:shadow'
                      }`}
                  >
                    <div className="flex items-center justify-center gap-2">
                      <Icon name="Activity" className="w-4 h-4" />
                      Atividades
                    </div>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setActiveCard(activeCard === 'indexScans' ? null : 'indexScans')}
                  className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition text-center border ${activeCard === 'indexScans'
                    ? 'bg-accent-primary text-text-on-accent border-accent-primary shadow'
                    : 'bg-bg-tertiary text-text-secondary border-border-secondary hover:text-text-primary hover:shadow'
                    }`}
                >
                  <div className="flex items-center justify-center gap-2">
                    <Icon name="Zap" className="w-4 h-4" />
                    Index Scans
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveCard(activeCard === 'operacoes' ? null : 'operacoes')}
                  className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition text-center border ${activeCard === 'operacoes'
                    ? 'bg-accent-primary text-text-on-accent border-accent-primary shadow'
                    : 'bg-bg-tertiary text-text-secondary border-border-secondary hover:text-text-primary hover:shadow'
                    }`}
                >
                  <div className="flex items-center justify-center gap-2">
                    <Icon name="Edit" className="w-4 h-4" />
                    Operações
                  </div>
                </button>
              </div>

              {/* Activity Logs - Aparecem quando card Atividades é clicado (apenas super_admin) */}
              {isSuperAdmin && activeCard === 'atividades' && (
                <div className="space-y-4 p-4 bg-bg-tertiary border border-border-secondary rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
                        <Icon name="Activity" className="w-4 h-4 text-green-600" />
                        Atividades em Tempo Real
                        {activeConnections > 0 && (
                          <span className="px-2 py-0.5 text-xs bg-green-100 text-green-800 rounded-full flex items-center gap-1">
                            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                            {activeConnections} {activeConnections === 1 ? 'usuário ativo' : 'usuários ativos'}
                          </span>
                        )}
                      </h3>
                      {/* Estatísticas no header */}
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-text-secondary">Total:</span>
                          <span className="text-sm font-bold text-blue-600">{activityLogs.length}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-text-secondary">Sucesso:</span>
                          <span className="text-sm font-bold text-green-600">
                            {activityLogs.filter(l => l.status?.toLowerCase() === 'success').length}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-text-secondary">Erros:</span>
                          <span className="text-sm font-bold text-red-600">
                            {activityLogs.filter(l => l.status?.toLowerCase() === 'error').length}
                          </span>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={loadActivityLogs}
                      className="p-1.5 hover:bg-bg-secondary rounded transition-colors"
                      title="Atualizar"
                    >
                      <Icon name="RefreshCw" className="w-4 h-4 text-text-secondary" />
                    </button>
                  </div>

                  <div className="bg-bg-secondary rounded-lg border border-border-primary overflow-hidden">
                    {activityLogs.length === 0 ? (
                      <div className="p-6 text-center">
                        <Icon name="Info" className="w-8 h-8 mx-auto mb-2 text-blue-500" />
                        <p className="text-sm text-text-secondary mb-1">Nenhuma atividade registrada na última hora</p>
                        <p className="text-xs text-text-tertiary">
                          As ações dos usuários aparecerão aqui em tempo real quando workflows N8N executarem
                        </p>
                      </div>
                    ) : (
                      <div className="max-h-[400px] overflow-y-auto">
                        <table className="w-full">
                          <thead className="bg-bg-tertiary sticky top-0 border-b border-border-secondary">
                            <tr>
                              <th className="px-3 py-2 text-left text-sm font-semibold text-text-secondary">Data</th>
                              <th className="px-3 py-2 text-left text-sm font-semibold text-text-secondary">Hora</th>
                              <th className="px-3 py-2 text-left text-sm font-semibold text-text-secondary">Usuário</th>
                              <th className="px-3 py-2 text-left text-sm font-semibold text-text-secondary">Workflow</th>
                              <th className="px-3 py-2 text-left text-sm font-semibold text-text-secondary">Unidade</th>
                              <th className="px-3 py-2 text-left text-sm font-semibold text-text-secondary">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border-secondary">
                            {(() => {
                              const startIndex = (currentPage - 1) * itemsPerPage;
                              const endIndex = startIndex + itemsPerPage;
                              const paginatedLogs = activityLogs.slice(startIndex, endIndex);

                              return paginatedLogs.map((log) => {
                                const logDate = new Date(log.created_at);
                                const dateStr = logDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
                                const timeStr = logDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                                const isRecent = new Date(log.created_at) > new Date(Date.now() - 60000); // Últimos 60s

                                // Extrai módulo do metadata (workflow mostra o módulo acessado)
                                const moduleName = log.metadata?.module_name || log.metadata?.module || log.workflow || '-';

                                return (
                                  <tr
                                    key={log.id}
                                    className={`hover:bg-bg-tertiary transition-colors ${isRecent ? 'bg-green-50 dark:bg-green-900/10' : ''
                                      }`}
                                  >
                                    <td className="px-3 py-2 text-sm text-text-secondary whitespace-nowrap">
                                      {isRecent && (
                                        <span className="inline-block w-2 h-2 bg-green-500 rounded-full mr-1 animate-pulse"></span>
                                      )}
                                      {dateStr}
                                    </td>
                                    <td className="px-3 py-2 text-sm text-text-secondary whitespace-nowrap">
                                      {timeStr}
                                    </td>
                                    <td className="px-3 py-2 text-sm font-medium text-text-primary">
                                      {log.user_identifier || 'N/A'}
                                    </td>
                                    <td className="px-3 py-2 text-sm text-text-secondary">
                                      {moduleName}
                                    </td>
                                    <td className="px-3 py-2 text-sm text-text-secondary">
                                      {getUnitName(log.unit_code)}
                                    </td>
                                    <td className="px-3 py-2">
                                      <span className={`px-2 py-0.5 text-sm font-medium rounded ${log.status?.toLowerCase() === 'success'
                                        ? 'bg-green-100 text-green-800'
                                        : log.status?.toLowerCase() === 'error'
                                          ? 'bg-red-100 text-red-800'
                                          : 'bg-gray-100 text-gray-800'
                                        }`}>
                                        {log.status || 'N/A'}
                                      </span>
                                    </td>
                                  </tr>
                                );
                              });
                            })()}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* Paginação */}
                  {activityLogs.length > itemsPerPage && (
                    <div className="flex items-center justify-between px-4 py-3 border-t border-border-secondary bg-bg-secondary rounded-b-lg">
                      <div className="text-xs text-text-secondary">
                        Mostrando {((currentPage - 1) * itemsPerPage) + 1} a {Math.min(currentPage * itemsPerPage, activityLogs.length)} de {activityLogs.length} registros
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                          disabled={currentPage === 1}
                          className="px-3 py-1.5 text-xs font-medium rounded border border-border-primary hover:bg-bg-tertiary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          <Icon name="ChevronLeft" className="w-4 h-4" />
                        </button>
                        <span className="text-xs font-medium text-text-primary px-2">
                          Página {currentPage} de {Math.ceil(activityLogs.length / itemsPerPage)}
                        </span>
                        <button
                          onClick={() => setCurrentPage(prev => Math.min(Math.ceil(activityLogs.length / itemsPerPage), prev + 1))}
                          disabled={currentPage >= Math.ceil(activityLogs.length / itemsPerPage)}
                          className="px-3 py-1.5 text-xs font-medium rounded border border-border-primary hover:bg-bg-tertiary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          <Icon name="ChevronRight" className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Index Scans - Aparecem quando card Index Scans é clicado */}
              {activeCard === 'indexScans' && (
                <div className="bg-bg-secondary rounded-lg border border-border-primary overflow-hidden">
                  <div className="px-4 py-3 bg-bg-tertiary border-b border-border-secondary">
                    <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
                      <Icon name="BarChart3" className="w-4 h-4" />
                      Tabelas por Tamanho e Performance
                    </h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-bg-primary border-b border-border-secondary">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">Tabela</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">Registros</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">Tamanho Total</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">Dados</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">Índices</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">% do Banco</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border-secondary">
                        <tr className="hover:bg-bg-tertiary transition-colors">
                          <td className="px-4 py-3 text-sm font-medium text-text-primary">processed_data</td>
                          <td className="px-4 py-3 text-sm text-text-secondary font-mono">63,335</td>
                          <td className="px-4 py-3 text-sm text-text-secondary font-mono">52 MB</td>
                          <td className="px-4 py-3 text-sm text-text-secondary font-mono">28 MB</td>
                          <td className="px-4 py-3 text-sm text-text-secondary font-mono">24 MB</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 bg-border-secondary rounded-full h-2 max-w-[100px]">
                                <div className="bg-blue-500 h-2 rounded-full" style={{ width: '62.7%' }}></div>
                              </div>
                              <span className="text-xs font-medium text-text-secondary">62.7%</span>
                            </div>
                          </td>
                        </tr>
                        <tr className="hover:bg-bg-tertiary transition-colors">
                          <td className="px-4 py-3 text-sm font-medium text-text-primary">pos_vendas</td>
                          <td className="px-4 py-3 text-sm text-text-secondary font-mono">43,749</td>
                          <td className="px-4 py-3 text-sm text-text-secondary font-mono">12 MB</td>
                          <td className="px-4 py-3 text-sm text-text-secondary font-mono">6.5 MB</td>
                          <td className="px-4 py-3 text-sm text-text-secondary font-mono">6.3 MB</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 bg-border-secondary rounded-full h-2 max-w-[100px]">
                                <div className="bg-green-500 h-2 rounded-full" style={{ width: '14.5%' }}></div>
                              </div>
                              <span className="text-xs font-medium text-text-secondary">14.5%</span>
                            </div>
                          </td>
                        </tr>
                        <tr className="hover:bg-bg-tertiary transition-colors">
                          <td className="px-4 py-3 text-sm font-medium text-text-primary">recrutadora</td>
                          <td className="px-4 py-3 text-sm text-text-secondary font-mono">2,297</td>
                          <td className="px-4 py-3 text-sm text-text-secondary font-mono">2 MB</td>
                          <td className="px-4 py-3 text-sm text-text-secondary font-mono">1.5 MB</td>
                          <td className="px-4 py-3 text-sm text-text-secondary font-mono">600 KB</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 bg-border-secondary rounded-full h-2 max-w-[100px]">
                                <div className="bg-purple-500 h-2 rounded-full" style={{ width: '2.4%' }}></div>
                              </div>
                              <span className="text-xs font-medium text-text-secondary">2.4%</span>
                            </div>
                          </td>
                        </tr>
                        <tr className="hover:bg-bg-tertiary transition-colors">
                          <td className="px-4 py-3 text-sm font-medium text-text-primary">unit_clients</td>
                          <td className="px-4 py-3 text-sm text-text-secondary font-mono">3,772</td>
                          <td className="px-4 py-3 text-sm text-text-secondary font-mono">1.5 MB</td>
                          <td className="px-4 py-3 text-sm text-text-secondary font-mono">928 KB</td>
                          <td className="px-4 py-3 text-sm text-text-secondary font-mono">576 KB</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 bg-border-secondary rounded-full h-2 max-w-[100px]">
                                <div className="bg-orange-500 h-2 rounded-full" style={{ width: '1.8%' }}></div>
                              </div>
                              <span className="text-xs font-medium text-text-secondary">1.8%</span>
                            </div>
                          </td>
                        </tr>
                        <tr className="hover:bg-bg-tertiary transition-colors">
                          <td className="px-4 py-3 text-sm font-medium text-text-primary">profissionais</td>
                          <td className="px-4 py-3 text-sm text-text-secondary font-mono">502</td>
                          <td className="px-4 py-3 text-sm text-text-secondary font-mono">432 KB</td>
                          <td className="px-4 py-3 text-sm text-text-secondary font-mono">104 KB</td>
                          <td className="px-4 py-3 text-sm text-text-secondary font-mono">328 KB</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 bg-border-secondary rounded-full h-2 max-w-[100px]">
                                <div className="bg-cyan-500 h-2 rounded-full" style={{ width: '0.5%' }}></div>
                              </div>
                              <span className="text-xs font-medium text-text-secondary">0.5%</span>
                            </div>
                          </td>
                        </tr>
                        <tr className="hover:bg-bg-tertiary transition-colors">
                          <td className="px-4 py-3 text-sm font-medium text-text-primary">comercial</td>
                          <td className="px-4 py-3 text-sm text-text-secondary font-mono">120</td>
                          <td className="px-4 py-3 text-sm text-text-secondary font-mono">~200 KB</td>
                          <td className="px-4 py-3 text-sm text-text-secondary font-mono">~100 KB</td>
                          <td className="px-4 py-3 text-sm text-text-secondary font-mono">~100 KB</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 bg-border-secondary rounded-full h-2 max-w-[100px]">
                                <div className="bg-pink-500 h-2 rounded-full" style={{ width: '0.2%' }}></div>
                              </div>
                              <span className="text-xs font-medium text-text-secondary">0.2%</span>
                            </div>
                          </td>
                        </tr>
                        <tr className="hover:bg-bg-tertiary transition-colors">
                          <td className="px-4 py-3 text-sm font-medium text-text-primary">atend_status</td>
                          <td className="px-4 py-3 text-sm text-text-secondary font-mono">510</td>
                          <td className="px-4 py-3 text-sm text-text-secondary font-mono">~150 KB</td>
                          <td className="px-4 py-3 text-sm text-text-secondary font-mono">~80 KB</td>
                          <td className="px-4 py-3 text-sm text-text-secondary font-mono">~70 KB</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 bg-border-secondary rounded-full h-2 max-w-[100px]">
                                <div className="bg-indigo-500 h-2 rounded-full" style={{ width: '0.2%' }}></div>
                              </div>
                              <span className="text-xs font-medium text-text-secondary">0.2%</span>
                            </div>
                          </td>
                        </tr>
                        <tr className="hover:bg-bg-tertiary transition-colors">
                          <td className="px-4 py-3 text-sm font-medium text-text-primary">unit_modules</td>
                          <td className="px-4 py-3 text-sm text-text-secondary font-mono">66</td>
                          <td className="px-4 py-3 text-sm text-text-secondary font-mono">~50 KB</td>
                          <td className="px-4 py-3 text-sm text-text-secondary font-mono">~25 KB</td>
                          <td className="px-4 py-3 text-sm text-text-secondary font-mono">~25 KB</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 bg-border-secondary rounded-full h-2 max-w-[100px]">
                                <div className="bg-teal-500 h-2 rounded-full" style={{ width: '0.1%' }}></div>
                              </div>
                              <span className="text-xs font-medium text-text-secondary">&lt;0.1%</span>
                            </div>
                          </td>
                        </tr>
                        <tr className="hover:bg-bg-tertiary transition-colors">
                          <td className="px-4 py-3 text-sm font-medium text-text-primary">user_modules</td>
                          <td className="px-4 py-3 text-sm text-text-secondary font-mono">125</td>
                          <td className="px-4 py-3 text-sm text-text-secondary font-mono">~40 KB</td>
                          <td className="px-4 py-3 text-sm text-text-secondary font-mono">~20 KB</td>
                          <td className="px-4 py-3 text-sm text-text-secondary font-mono">~20 KB</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 bg-border-secondary rounded-full h-2 max-w-[100px]">
                                <div className="bg-violet-500 h-2 rounded-full" style={{ width: '0.1%' }}></div>
                              </div>
                              <span className="text-xs font-medium text-text-secondary">&lt;0.1%</span>
                            </div>
                          </td>
                        </tr>
                        <tr className="hover:bg-bg-tertiary transition-colors">
                          <td className="px-4 py-3 text-sm font-medium text-text-primary">user_units</td>
                          <td className="px-4 py-3 text-sm text-text-secondary font-mono">45</td>
                          <td className="px-4 py-3 text-sm text-text-secondary font-mono">~30 KB</td>
                          <td className="px-4 py-3 text-sm text-text-secondary font-mono">~15 KB</td>
                          <td className="px-4 py-3 text-sm text-text-secondary font-mono">~15 KB</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 bg-border-secondary rounded-full h-2 max-w-[100px]">
                                <div className="bg-fuchsia-500 h-2 rounded-full" style={{ width: '0.1%' }}></div>
                              </div>
                              <span className="text-xs font-medium text-text-secondary">&lt;0.1%</span>
                            </div>
                          </td>
                        </tr>
                        <tr className="hover:bg-bg-tertiary transition-colors">
                          <td className="px-4 py-3 text-sm font-medium text-text-primary">profiles</td>
                          <td className="px-4 py-3 text-sm text-text-secondary font-mono">23</td>
                          <td className="px-4 py-3 text-sm text-text-secondary font-mono">~25 KB</td>
                          <td className="px-4 py-3 text-sm text-text-secondary font-mono">~12 KB</td>
                          <td className="px-4 py-3 text-sm text-text-secondary font-mono">~13 KB</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 bg-border-secondary rounded-full h-2 max-w-[100px]">
                                <div className="bg-rose-500 h-2 rounded-full" style={{ width: '0.1%' }}></div>
                              </div>
                              <span className="text-xs font-medium text-text-secondary">&lt;0.1%</span>
                            </div>
                          </td>
                        </tr>
                        <tr className="hover:bg-bg-tertiary transition-colors">
                          <td className="px-4 py-3 text-sm font-medium text-text-primary">units</td>
                          <td className="px-4 py-3 text-sm text-text-secondary font-mono">19</td>
                          <td className="px-4 py-3 text-sm text-text-secondary font-mono">~20 KB</td>
                          <td className="px-4 py-3 text-sm text-text-secondary font-mono">~10 KB</td>
                          <td className="px-4 py-3 text-sm text-text-secondary font-mono">~10 KB</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 bg-border-secondary rounded-full h-2 max-w-[100px]">
                                <div className="bg-amber-500 h-2 rounded-full" style={{ width: '0.1%' }}></div>
                              </div>
                              <span className="text-xs font-medium text-text-secondary">&lt;0.1%</span>
                            </div>
                          </td>
                        </tr>
                        <tr className="hover:bg-bg-tertiary transition-colors">
                          <td className="px-4 py-3 text-sm font-medium text-text-primary">modules</td>
                          <td className="px-4 py-3 text-sm text-text-secondary font-mono">15</td>
                          <td className="px-4 py-3 text-sm text-text-secondary font-mono">~15 KB</td>
                          <td className="px-4 py-3 text-sm text-text-secondary font-mono">~8 KB</td>
                          <td className="px-4 py-3 text-sm text-text-secondary font-mono">~7 KB</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 bg-border-secondary rounded-full h-2 max-w-[100px]">
                                <div className="bg-lime-500 h-2 rounded-full" style={{ width: '0.1%' }}></div>
                              </div>
                              <span className="text-xs font-medium text-text-secondary">&lt;0.1%</span>
                            </div>
                          </td>
                        </tr>
                        <tr className="hover:bg-bg-tertiary transition-colors">
                          <td className="px-4 py-3 text-sm font-medium text-text-primary">actions</td>
                          <td className="px-4 py-3 text-sm text-text-secondary font-mono">10</td>
                          <td className="px-4 py-3 text-sm text-text-secondary font-mono">~10 KB</td>
                          <td className="px-4 py-3 text-sm text-text-secondary font-mono">~5 KB</td>
                          <td className="px-4 py-3 text-sm text-text-secondary font-mono">~5 KB</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 bg-border-secondary rounded-full h-2 max-w-[100px]">
                                <div className="bg-emerald-500 h-2 rounded-full" style={{ width: '0.1%' }}></div>
                              </div>
                              <span className="text-xs font-medium text-text-secondary">&lt;0.1%</span>
                            </div>
                          </td>
                        </tr>
                        <tr className="hover:bg-bg-tertiary transition-colors">
                          <td className="px-4 py-3 text-sm font-medium text-text-primary">activity_logs</td>
                          <td className="px-4 py-3 text-sm font-mono">
                            <span className="text-green-600 font-semibold">{activityLogs.length}</span>
                            <span className="text-text-secondary"> (tempo real)</span>
                          </td>
                          <td className="px-4 py-3 text-sm text-text-secondary font-mono">~5 KB</td>
                          <td className="px-4 py-3 text-sm text-text-secondary font-mono">~2 KB</td>
                          <td className="px-4 py-3 text-sm text-text-secondary font-mono">~3 KB</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 bg-border-secondary rounded-full h-2 max-w-[100px]">
                                <div className="bg-sky-500 h-2 rounded-full" style={{ width: '0.1%' }}></div>
                              </div>
                              <span className="text-xs font-medium text-text-secondary">&lt;0.1%</span>
                            </div>
                          </td>
                        </tr>
                        <tr className="hover:bg-bg-tertiary transition-colors">
                          <td className="px-4 py-3 text-sm font-medium text-text-primary">error_logs</td>
                          <td className="px-4 py-3 text-sm text-text-secondary font-mono">0</td>
                          <td className="px-4 py-3 text-sm text-text-secondary font-mono">~5 KB</td>
                          <td className="px-4 py-3 text-sm text-text-secondary font-mono">~2 KB</td>
                          <td className="px-4 py-3 text-sm text-text-secondary font-mono">~3 KB</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 bg-border-secondary rounded-full h-2 max-w-[100px]">
                                <div className="bg-red-500 h-2 rounded-full" style={{ width: '0.1%' }}></div>
                              </div>
                              <span className="text-xs font-medium text-text-secondary">&lt;0.1%</span>
                            </div>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Operações - Aparecem quando card Operações é clicado */}
              {activeCard === 'operacoes' && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Index vs Sequential Scans */}
                  <div className="bg-bg-secondary rounded-lg border border-border-primary p-4">
                    <h4 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2">
                      <Icon name="Search" className="w-4 h-4 text-blue-600" />
                      Tipos de Busca
                    </h4>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-text-secondary">Index Scans</span>
                        <span className="text-sm font-bold text-green-600">1.4M</span>
                      </div>
                      <div className="w-full bg-border-secondary rounded-full h-2">
                        <div className="bg-green-500 h-2 rounded-full" style={{ width: '96.5%' }}></div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-text-secondary">Sequential Scans</span>
                        <span className="text-sm font-bold text-orange-600">51.4K</span>
                      </div>
                      <div className="w-full bg-border-secondary rounded-full h-2">
                        <div className="bg-orange-500 h-2 rounded-full" style={{ width: '3.5%' }}></div>
                      </div>
                      <p className="text-xs text-text-tertiary mt-2 pt-2 border-t border-border-secondary">
                        <Icon name="TrendingUp" className="w-3 h-3 inline mr-1 text-green-600" />
                        96.5% das buscas usando índices (excelente!)
                      </p>
                    </div>
                  </div>

                  {/* Operações de Escrita */}
                  <div className="bg-bg-secondary rounded-lg border border-border-primary p-4">
                    <h4 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2">
                      <Icon name="Edit" className="w-4 h-4 text-purple-600" />
                      Operações de Escrita
                    </h4>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                          <span className="text-xs text-text-secondary">Inserts</span>
                        </div>
                        <span className="text-sm font-bold text-text-primary">306.6K</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                          <span className="text-xs text-text-secondary">Updates</span>
                        </div>
                        <span className="text-sm font-bold text-text-primary">301.4K</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                          <span className="text-xs text-text-secondary">Deletes</span>
                        </div>
                        <span className="text-sm font-bold text-text-primary">40.0K</span>
                      </div>
                      <p className="text-xs text-text-tertiary mt-2 pt-2 border-t border-border-secondary">
                        Total de 648K operações realizadas
                      </p>
                    </div>
                  </div>

                  {/* Top Índices Mais Usados */}
                  <div className="bg-bg-secondary rounded-lg border border-border-primary p-4">
                    <h4 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2">
                      <Icon name="Zap" className="w-4 h-4 text-yellow-600" />
                      Índices Mais Utilizados
                    </h4>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-text-secondary truncate">processed_data_pkey</span>
                        <span className="text-xs font-bold text-text-primary">935K</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-text-secondary truncate">idx_unidade_code_data</span>
                        <span className="text-xs font-bold text-text-primary">199K</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-text-secondary truncate">units_pkey</span>
                        <span className="text-xs font-bold text-text-primary">79K</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-text-secondary truncate">unidade_atendimento</span>
                        <span className="text-xs font-bold text-text-primary">69K</span>
                      </div>
                      <p className="text-xs text-text-tertiary mt-2 pt-2 border-t border-border-secondary">
                        <Icon name="Info" className="w-3 h-3 inline mr-1" />
                        Performance otimizada com índices
                      </p>
                    </div>
                  </div>
                </div>
              )}

            </div>
          )}
        </>
      )}
    </div>
  );
};

export default DashboardSistemaPage;
