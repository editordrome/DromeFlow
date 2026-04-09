import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useAppContext } from '../../contexts/AppContext';
import { Icon } from '../ui/Icon';
import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  BarChart as RechartsBarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as RechartsTooltip, 
  Legend 
} from 'recharts';
import type { PosVenda } from '../../types';
import {
  fetchPosVendas,
  fetchPendenteWithProfissional,
  deletePosVenda,
  getMetrics
} from '../../services/posVendas/posVendas.service';
import PosVendaFormModal from '../ui/PosVendaFormModal';
import { useRealtimeSubscription } from '../../hooks/useRealtimeSubscription';
import { fetchAvailableYearsFromProcessedData } from '../../services/data/dataTable.service';

type ActiveCard = 'geral' | 'pendente' | 'agendado' | 'contatado' | 'finalizados';

// Componente de seletor de período
const PeriodSelector: React.FC<{
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  availableYears?: number[];
}> = ({ value, onChange, disabled = false, availableYears }) => {
  const [isOpen, setIsOpen] = useState(false);

  const months = [
    { value: '01', label: 'Janeiro' },
    { value: '02', label: 'Fevereiro' },
    { value: '03', label: 'Março' },
    { value: '04', label: 'Abril' },
    { value: '05', label: 'Maio' },
    { value: '06', label: 'Junho' },
    { value: '07', label: 'Julho' },
    { value: '08', label: 'Agosto' },
    { value: '09', label: 'Setembro' },
    { value: '10', label: 'Outubro' },
    { value: '11', label: 'Novembro' },
    { value: '12', label: 'Dezembro' },
  ];

  // Usa os anos disponíveis dos dados
  const years = availableYears && availableYears.length > 0 
    ? availableYears 
    : [new Date().getFullYear()];

  // Gera opções para todos os anos disponíveis
  const options: { value: string; label: string }[] = [];
  years.forEach(year => {
    months.forEach(month => {
      options.push({ value: `${year}-${month.value}`, label: `${month.label} ${year}` });
    });
  });

  const getDisplayLabel = () => {
    const [year, monthNum] = value.split('-');
    const month = months.find(m => m.value === monthNum);
    return month ? `${month.label} ${year}` : value;
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className="flex items-center justify-between w-64 px-3 py-2 text-left border rounded-md bg-bg-secondary border-border-primary focus:ring-2 focus:ring-primary focus:border-primary disabled:bg-gray-100 disabled:cursor-not-allowed"
      >
        <span className="text-sm text-text-primary">{getDisplayLabel()}</span>
        <Icon name={isOpen ? 'ChevronUp' : 'ChevronDown'} className="w-4 h-4 text-text-secondary" />
      </button>

      {isOpen && !disabled && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 z-20 w-64 mt-1 bg-bg-secondary border rounded-md shadow-lg border-border-primary max-h-80 overflow-y-auto">
            <div className="py-1">
              {options.map((option) => (
                <button
                  key={option.value}
                  onClick={() => {
                    onChange(option.value);
                    setIsOpen(false);
                  }}
                  className={`w-full px-3 py-2 text-left text-sm transition-colors hover:bg-bg-tertiary ${
                    value === option.value ? 'bg-primary text-white' : 'text-text-primary'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

const PosVendasPage: React.FC = () => {
  const { profile, getModulesForUnit } = useAuth();
  const { selectedUnit } = useAppContext();

  const [allRecords, setAllRecords] = useState<PosVenda[]>([]);
  const [contatadosRecords, setContatadosRecords] = useState<PosVenda[]>([]);
  const [finalizadosRecords, setFinalizadosRecords] = useState<PosVenda[]>([]);
  const [agendadosRecords, setAgendadosRecords] = useState<PosVenda[]>([]);
  const [pendentesProfissional, setPendentesProfissional] = useState<Array<PosVenda>>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<PosVenda | null>(null);
  const [activeCard, setActiveCard] = useState<ActiveCard>('geral');
  const [sendingWebhook, setSendingWebhook] = useState<Set<string>>(new Set());
  const [webhookFeedback, setWebhookFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [specificDate, setSpecificDate] = useState<string>(''); // Filtro de data específica
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [schedulingRecord, setSchedulingRecord] = useState<PosVenda | null>(null);
  const [posVendasWebhook, setPosVendasWebhook] = useState<string | null>(null);
  const ITEMS_PER_PAGE = 25;

  // Busca webhook do módulo pós-vendas quando a unidade mudar
  useEffect(() => {
    const loadWebhook = async () => {
      if (!selectedUnit?.id) {
        setPosVendasWebhook(null);
        return;
      }

      try {
        const modules = await getModulesForUnit(selectedUnit.id);
        console.log('[PosVendasPage] Módulos da unidade:', modules);
        
        const module = modules.find(m => {
          const nameMatch = m.name.toLowerCase().includes('pós') || m.name.toLowerCase().includes('vendas');
          const viewMatch = m.view_id === 'pos_vendas';
          console.log('[PosVendasPage] Verificando módulo:', m.name, 'nameMatch:', nameMatch, 'viewMatch:', viewMatch, 'webhook_url:', m.webhook_url);
          return nameMatch || viewMatch;
        });
        
        console.log('[PosVendasPage] Módulo encontrado:', module);
        console.log('[PosVendasPage] Webhook URL:', module?.webhook_url);
        setPosVendasWebhook(module?.webhook_url || null);
      } catch (error) {
        console.error('[PosVendasPage] Erro ao carregar webhook:', error);
        setPosVendasWebhook(null);
      }
    };

    loadWebhook();
  }, [selectedUnit?.id, getModulesForUnit]);

  // Limpa feedback de webhook após alguns segundos
  useEffect(() => {
    if (webhookFeedback) {
      const t = setTimeout(() => setWebhookFeedback(null), 5000);
      return () => clearTimeout(t);
    }
  }, [webhookFeedback]);

  // Período selecionado (formato: YYYY-MM)
  const currentDate = new Date();
  const [selectedPeriod, setSelectedPeriod] = useState(
    `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`
  );

  // Anos disponíveis com dados
  const [availableYears, setAvailableYears] = useState<number[]>([new Date().getFullYear()]);

  // Métricas
  const [metrics, setMetrics] = useState<{
    totalContatos: number;
    totalContatados: number;
    totalFinalizados: number;
    nps: number | null;
    taxaReagendamento: number;
    distribuicaoNotas: { nota: number; count: number }[];
  } | null>(null);

  // Carregar anos disponíveis quando a unidade mudar
  useEffect(() => {
    const loadYears = async () => {
      if (!selectedUnit || selectedUnit.id === 'ALL') {
        setAvailableYears([new Date().getFullYear()]);
        return;
      }
      
      try {
        const years = await fetchAvailableYearsFromProcessedData(selectedUnit.unit_code);
        setAvailableYears(years);
      } catch (error) {
        console.error('Erro ao carregar anos disponíveis:', error);
        setAvailableYears([new Date().getFullYear()]);
      }
    };
    loadYears();
  }, [selectedUnit]);

  useEffect(() => {
    loadData();
  }, [selectedUnit, selectedPeriod, specificDate]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const filters: any = {};
      
      // Sempre filtrar pela unidade selecionada (exceto super_admin sem unidade)
      if (selectedUnit && selectedUnit.id !== 'ALL') {
        filters.unit_id = selectedUnit.id;
      } else if (profile?.role !== 'super_admin') {
        // Se não houver unidade selecionada e não for super_admin, não carrega nada
        setAllRecords([]);
        setMetrics({
          totalContatos: 0,
          totalContatados: 0,
          totalFinalizados: 0,
          nps: null,
          taxaReagendamento: 0,
          distribuicaoNotas: []
        });
        setLoading(false);
        return;
      }

      // Filtrar pelo mês/ano selecionado
      const [year, month] = selectedPeriod.split('-');
      const paddedMonth = month.padStart(2, '0');
      const startDate = `${year}-${paddedMonth}-01`;
      const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
      const paddedLastDay = String(lastDay).padStart(2, '0');
      const endDate = `${year}-${paddedMonth}-${paddedLastDay}`;

      filters.startDate = startDate;
      filters.endDate = endDate;

      // Filtro específico para pendentes: até hoje (se for o mês atual) ou fim do mês
      const hoje = new Date();
      const hojeIso = hoje.toISOString().split('T')[0];
      const selectedMonthStr = `${year}-${month}`;
      const currentMonthStr = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
      
      const pendenteFilters = { 
        ...filters, 
        endDate: selectedMonthStr === currentMonthStr && hojeIso < endDate ? hojeIso : endDate 
      };

      // Buscar contatados, finalizados e agendados do mês (baseado na data do atendimento)
      const contatadosFilters = { ...filters, status: 'contatado' };
      const finalizadosFilters = { ...filters, status: 'finalizado' };
      const agendadosFilters = { ...filters, status: 'agendado' };

      const [data, metricsData, pendenteData, contatadosData, finalizadosData, agendadosData] = await Promise.all([
        fetchPosVendas(filters),
        getMetrics(filters),
        fetchPendenteWithProfissional(pendenteFilters), // Filtrado do início do mês até o dia ativo
        fetchPosVendas(contatadosFilters),
        fetchPosVendas(finalizadosFilters),
        fetchPosVendas(agendadosFilters)
      ]);

      // Aplicar filtro de data específica se fornecido
      let pendentesFiltrados = pendenteData;
      
      if (specificDate) {
        pendentesFiltrados = pendenteData.filter(record => {
          if (!record.data) return false;
          // Comparar strings diretas no formato YYYY-MM-DD
          const dataStr = record.data.split('T')[0]; // Garante formato YYYY-MM-DD
          return dataStr === specificDate;
        });
      }

      setAllRecords(data);
      setContatadosRecords(contatadosData);
      setFinalizadosRecords(finalizadosData);
      setAgendadosRecords(agendadosData); // Agendados vem direto da tabela pos_vendas
      setMetrics(metricsData);
      setPendentesProfissional(pendentesFiltrados);
    } catch (error) {
      console.error('Erro ao carregar pós-vendas:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedUnit, selectedPeriod, specificDate, profile]);

  // ✅ Otimização: Filtro server-side p/ reduzir carga
  const realtimeFilterQuery = useMemo(() => {
    if (!selectedUnit || selectedUnit.id === 'ALL') return undefined;
    return `unit_id=eq.${selectedUnit.id}`;
  }, [selectedUnit]);

  // Realtime Subscription para pos_vendas
  useRealtimeSubscription<PosVenda>({
    table: 'pos_vendas',
    filterQuery: realtimeFilterQuery,
    filter: (record) => {
      // Filtrar por unidade (se não for super_admin sem unidade)
      if (selectedUnit && selectedUnit.id !== 'ALL' && record.unit_id !== selectedUnit.id) {
        return false;
      }
      
      // Filtrar por período
      if (record.data) {
        const [year, month] = selectedPeriod.split('-');
        const recordDate = new Date(record.data);
        const recordMonth = recordDate.getMonth() + 1;
        const recordYear = recordDate.getFullYear();
        
        if (recordYear !== parseInt(year) || recordMonth !== parseInt(month)) {
          return false;
        }
      }
      
      return true;
    },
    callbacks: {
      onInsert: (newRecord) => {
        setAllRecords(prev => [...prev, newRecord]);
        
        // Se for pendente, adicionar à lista de pendentes com profissional
        if (newRecord.status === 'pendente') {
          loadData(); // Recarregar para pegar o join com profissional
        }
      },
      onUpdate: (updatedRecord) => {
        setAllRecords(prev => prev.map(r => r.id === updatedRecord.id ? updatedRecord : r));
        
        // Atualizar também na lista de pendentes se aplicável
        setPendentesProfissional(prev => 
          prev.map(r => r.id === updatedRecord.id ? { ...r, ...updatedRecord } : r)
        );
        
        // Atualizar contatados e finalizados
        if (updatedRecord.status === 'contatado') {
          setContatadosRecords(prev => {
            const exists = prev.some(r => r.id === updatedRecord.id);
            if (exists) {
              return prev.map(r => r.id === updatedRecord.id ? updatedRecord : r);
            } else {
              return [...prev, updatedRecord];
            }
          });
          setFinalizadosRecords(prev => prev.filter(r => r.id !== updatedRecord.id));
        } else if (updatedRecord.status === 'finalizado') {
          setFinalizadosRecords(prev => {
            const exists = prev.some(r => r.id === updatedRecord.id);
            if (exists) {
              return prev.map(r => r.id === updatedRecord.id ? updatedRecord : r);
            } else {
              return [...prev, updatedRecord];
            }
          });
          setContatadosRecords(prev => prev.filter(r => r.id !== updatedRecord.id));
        } else {
          // Se mudou para pendente, remover de contatados/finalizados
          setContatadosRecords(prev => prev.filter(r => r.id !== updatedRecord.id));
          setFinalizadosRecords(prev => prev.filter(r => r.id !== updatedRecord.id));
        }
      },
      onDelete: (deletedRecord) => {
        setAllRecords(prev => prev.filter(r => r.id !== deletedRecord.id));
        setPendentesProfissional(prev => prev.filter(r => r.id !== deletedRecord.id));
        setContatadosRecords(prev => prev.filter(r => r.id !== deletedRecord.id));
        setFinalizadosRecords(prev => prev.filter(r => r.id !== deletedRecord.id));
      }
    },
    enabled: !loading // Apenas habilitar após carregamento inicial
  });

  // Filtrar registros por status
  const getRecordsByStatus = (status: string): PosVenda[] => {
    return allRecords.filter(record => record.status === status);
  };

  // Filtrar pendentes apenas até o dia anterior (ontem) E dentro do mês selecionado
  const getPendentesFiltrados = (): PosVenda[] => {
    const hoje = new Date();
    const hojeIso = hoje.toISOString().split('T')[0];
    
    const [year, month] = selectedPeriod.split('-');
    const startDateStr = `${year}-${month.padStart(2, '0')}-01`;
    const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
    const endDateStr = `${year}-${month.padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    
    return getRecordsByStatus('pendente').filter(record => {
      if (!record.data) return false;
      const recordDateStr = record.data; // Formato YYYY-MM-DD
      
      const currentMonthStr = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
      const isCurrentMonth = selectedPeriod === currentMonthStr;
      
      if (isCurrentMonth) {
        // No mês atual, limitar até hoje
        return recordDateStr >= startDateStr && recordDateStr <= hojeIso;
      }
      
      // Meses anteriores: estritamente dentro do mês selecionado
      return recordDateStr >= startDateStr && recordDateStr <= endDateStr;
    });
  };

  const pendentes = getPendentesFiltrados();
  const agendados = agendadosRecords;
  // Contatados e finalizados vêm de estados separados, filtrados pelo mês do atendimento
  const contatados = contatadosRecords;
  const finalizados = finalizadosRecords;

  // Filtrar pela busca (aplicado à lista de pendentes com profissional)
  const pendentesFiltradosPorBusca = useMemo(() => {
    if (!searchTerm.trim()) return pendentesProfissional;
    
    const term = searchTerm.toLowerCase();
    return pendentesProfissional.filter(record => 
      (record.nome?.toLowerCase() || '').includes(term) ||
      (record.ATENDIMENTO_ID?.toLowerCase() || '').includes(term) ||
      (record.profissional?.toLowerCase() || '').includes(term)
    );
  }, [pendentesProfissional, searchTerm]);

  // Resetar para página 1 quando o termo de busca mudar
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  // Paginação
  const totalPages = Math.ceil(pendentesFiltradosPorBusca.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const pendentesPaginados = pendentesFiltradosPorBusca.slice(startIndex, endIndex);

  const handlePreviousPage = () => {
    setCurrentPage(prev => Math.max(1, prev - 1));
  };

  const handleNextPage = () => {
    setCurrentPage(prev => Math.min(totalPages, prev + 1));
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja realmente excluir este registro?')) return;

    try {
      await deletePosVenda(id);
      loadData();
    } catch (error) {
      console.error('Erro ao deletar:', error);
      alert('Erro ao deletar registro');
    }
  };

  const handleEdit = (record: PosVenda) => {
    setEditingRecord(record);
    setIsModalOpen(true);
  };

  const handleNew = () => {
    setEditingRecord(null);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingRecord(null);
  };

  const handleSendWebhook = async (record: PosVenda) => {
    if (!posVendasWebhook) {
      setWebhookFeedback({ type: 'error', message: 'Webhook não configurado para este módulo' });
      return;
    }

    if (!record.ATENDIMENTO_ID) {
      setWebhookFeedback({ type: 'error', message: 'ATENDIMENTO_ID não disponível' });
      return;
    }

    setSendingWebhook(prev => new Set(prev).add(record.id));

    try {
      // Busca o valor de conexao da unidade
      const { fetchConexao } = await import('../../services/units/unitKeys.service');
      const conexao = selectedUnit ? await fetchConexao(selectedUnit.id) : null;

      // Timestamp da ação (ISO 8601)
      const timestamp = new Date().toISOString();

      const payload = {
        action: 'pos_vendas',
        ATENDIMENTO_ID: record.ATENDIMENTO_ID,
        unit_id: record.unit_id,
        conexao,
        usuario_email: profile?.email || null,
        timestamp
      };

      let usedFallback = false;
      try {
        const resp = await fetch(posVendasWebhook, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (!resp.ok) {
          const text = await resp.text().catch(() => '');
          throw new Error(`Falha HTTP ${resp.status}${text ? ' - ' + text.slice(0, 140) : ''}`);
        }
        setWebhookFeedback({ type: 'success', message: 'Pós venda enviado com sucesso!' });
      } catch (primaryErr: any) {
        const msg = primaryErr?.message || '';
        if (msg.includes('Failed to fetch') || msg.includes('CORS') || msg.includes('NetworkError') || msg.includes('TypeError')) {
          usedFallback = true;
        } else {
          throw primaryErr;
        }
      }

      if (usedFallback) {
        const url = new URL(posVendasWebhook);
        url.searchParams.set('action', 'pos_vendas');
        url.searchParams.set('aid', record.ATENDIMENTO_ID);
        url.searchParams.set('uid', record.unit_id || '');
        url.searchParams.set('cx', conexao || '');
        if (profile?.email) url.searchParams.set('ue', profile.email);
        url.searchParams.set('ts', timestamp);
        const r = await fetch(url.toString(), { method: 'GET' });
        if (!r.ok) throw new Error(`Fallback GET falhou HTTP ${r.status}`);
        setWebhookFeedback({ type: 'success', message: 'Webhook enviado via fallback GET!' });
      }
    } catch (err: any) {
      let msg = 'Erro ao enviar webhook.';
      if (err?.message) {
        if (err.message.includes('Failed to fetch')) msg = 'Falha de rede/DNS ao contatar webhook.';
        else msg = err.message;
      }
      console.error('Erro ao enviar webhook pós-vendas:', err);
      setWebhookFeedback({ type: 'error', message: msg });
    } finally {
      setSendingWebhook(prev => {
        const next = new Set(prev);
        next.delete(record.id);
        return next;
      });
    }
  };

  const handleOpenScheduleModal = (record: PosVenda) => {
    setSchedulingRecord(record);
    setIsScheduleModalOpen(true);
  };

  const handleCloseScheduleModal = () => {
    setIsScheduleModalOpen(false);
    setSchedulingRecord(null);
  };

  const handleSaveSchedule = async (dataAgendamento: string, horarioAgendamento: string) => {
    if (!schedulingRecord) return;

    try {
      const { updatePosVenda, createPosVenda, getPosVendasByAtendimento } = await import('../../services/posVendas/posVendas.service');
      
      // 1. Persistir no Banco de Dados
      const existingRecords = await getPosVendasByAtendimento(schedulingRecord.ATENDIMENTO_ID || '');
      
      if (existingRecords && existingRecords.length > 0) {
        await updatePosVenda(existingRecords[0].id, {
          data_agendamento: dataAgendamento,
          horario_agendamento: horarioAgendamento,
          status: 'agendado'
        });
      } else {
        await createPosVenda({
          ATENDIMENTO_ID: schedulingRecord.ATENDIMENTO_ID,
          chat_id: schedulingRecord.chat_id,
          nome: schedulingRecord.nome,
          contato: schedulingRecord.contato,
          unit_id: schedulingRecord.unit_id,
          data: schedulingRecord.data || new Date().toISOString().split('T')[0],
          status: 'agendado',
          nota: null,
          reagendou: false,
          feedback: null,
          data_agendamento: dataAgendamento,
          horario_agendamento: horarioAgendamento
        });
      }

      // 2. Disparar Webhook (se configurado)
      if (posVendasWebhook) {
        try {
          const { fetchConexao } = await import('../../services/units/unitKeys.service');
          const conexao = selectedUnit && (selectedUnit as any).id !== 'ALL' ? await fetchConexao((selectedUnit as any).id) : null;
          
          const payload = {
            action: 'agendado',
            ATENDIMENTO_ID: schedulingRecord.ATENDIMENTO_ID,
            unit_code: typeof selectedUnit === 'string' ? selectedUnit : (selectedUnit as any)?.unit_code || 'ALL',
            conexao,
            data_agendamento: dataAgendamento,
            horario_agendamento: horarioAgendamento,
            usuario_email: profile?.email || null,
            timestamp: new Date().toISOString()
          };

          // Tentar POST robusto
          let usedFallback = false;
          try {
            const resp = await fetch(posVendasWebhook, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload)
            });
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
          } catch (e) {
            usedFallback = true;
          }

          // Fallback GET se POST falhar (comum em n8n sem CORS configurado)
          if (usedFallback) {
            const url = new URL(posVendasWebhook);
            url.searchParams.set('action', 'agendado');
            url.searchParams.set('aid', schedulingRecord.ATENDIMENTO_ID || '');
            url.searchParams.set('uc', typeof selectedUnit === 'string' ? selectedUnit : (selectedUnit as any)?.unit_code || 'ALL');
            url.searchParams.set('dag', dataAgendamento);
            url.searchParams.set('hag', horarioAgendamento);
            url.searchParams.set('cx', conexao || '');
            await fetch(url.toString(), { method: 'GET' }).catch(err => console.error('Fallback GET failed:', err));
          }
        } catch (webhookErr) {
          console.error('Erro ao notificar webhook de agendamento:', webhookErr);
        }
      }

      setWebhookFeedback({ 
        type: 'success', 
        message: `Agendamento salvo e enviado para automação: ${new Date(dataAgendamento + 'T00:00:00').toLocaleDateString('pt-BR')} às ${horarioAgendamento}` 
      });
      
      handleCloseScheduleModal();
      await loadData();
    } catch (error) {
      console.error('Erro ao salvar agendamento:', error);
      setWebhookFeedback({ type: 'error', message: 'Erro ao salvar agendamento' });
    }
  };

  const handleRemoveSchedule = async (record: PosVenda) => {
    if (!confirm('Deseja remover o agendamento deste pós-venda?')) return;

    try {
      const { updatePosVenda, getPosVendasByAtendimento } = await import('../../services/posVendas/posVendas.service');
      
      // Verifica se o registro existe na tabela pos_vendas
      const existingRecords = await getPosVendasByAtendimento(record.ATENDIMENTO_ID || '');
      
      if (existingRecords && existingRecords.length > 0) {
        await updatePosVenda(existingRecords[0].id, {
          data_agendamento: null,
          horario_agendamento: null
        });

        setWebhookFeedback({ 
          type: 'success', 
          message: 'Agendamento removido com sucesso!' 
        });
        
        await loadData();
      } else {
        setWebhookFeedback({ 
          type: 'error', 
          message: 'Registro não encontrado na base de pós-vendas' 
        });
      }
    } catch (error) {
      console.error('Erro ao remover agendamento:', error);
      setWebhookFeedback({ type: 'error', message: 'Erro ao remover agendamento' });
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    // Adiciona T00:00:00 para evitar problemas de timezone com datas tipo DATE
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('pt-BR');
  };

  const getStatusBadge = (status: string | null) => {
    const statusMap: Record<string, { label: string; color: string }> = {
      pendente: { label: 'Pendente', color: 'bg-yellow-100 text-yellow-800' },
      contatado: { label: 'Contatado', color: 'bg-blue-100 text-blue-800' },
      finalizado: { label: 'Finalizado', color: 'bg-green-100 text-green-800' }
    };

    const statusInfo = status ? statusMap[status] : { label: '-', color: 'bg-gray-100 text-gray-800' };

    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusInfo.color}`}>
        {statusInfo.label}
      </span>
    );
  };

  const renderStars = (nota: number | null) => {
    if (!nota) return '-';
    return (
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map(star => (
          <Icon
            key={star}
            name={star <= nota ? 'Star' : 'Star'}
            className={`w-4 h-4 ${star <= nota ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`}
          />
        ))}
      </div>
    );
  };

  // Tabela específica para contatados (data, ID, cliente, data de envio)
  const renderContatadosTable = (records: PosVenda[], emptyMessage: string) => (
    <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
      <table className="w-full">
        <thead className="sticky top-0 z-10 bg-bg-tertiary shadow-sm">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
              Data
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
              ID
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
              Cliente
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
              Data de Envio
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border-primary">
          {records.length === 0 ? (
            <tr>
              <td colSpan={4} className="px-4 py-8 text-center text-text-secondary">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            records.map((record) => (
              <tr 
                key={record.id} 
                className="hover:bg-bg-tertiary transition-colors cursor-pointer"
                onDoubleClick={() => handleEdit(record)}
                title="Duplo clique para editar"
              >
                <td className="px-4 py-3 whitespace-nowrap text-sm text-text-primary">
                  {formatDate(record.data)}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-text-primary font-mono">
                  {record.ATENDIMENTO_ID || '-'}
                </td>
                <td className="px-4 py-3 text-sm text-text-primary">
                  <div>
                    <p className="font-medium">{record.nome || '-'}</p>
                  </div>
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-text-primary">
                  {record.updated_at ? new Date(record.updated_at).toLocaleDateString('pt-BR', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric'
                  }) : '-'}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
      {records.length > 0 && (
        <div className="px-4 py-3 bg-bg-tertiary text-center text-sm text-text-secondary">
          Mostrando {records.length} registro{records.length !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  );

  // Tabela específica para finalizados (data, ID, cliente, profissional, nota, reagendou, data de finalização)
  const renderFinalizadosTable = (records: PosVenda[], emptyMessage: string) => (
    <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
      <table className="w-full">
        <thead className="sticky top-0 z-10 bg-bg-tertiary shadow-sm">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
              Data
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
              ID
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
              Cliente
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
              Profissional
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
              Nota
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
              Reagendou
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
              Data de Finalização
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border-primary">
          {records.length === 0 ? (
            <tr>
              <td colSpan={7} className="px-4 py-8 text-center text-text-secondary">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            records.map((record) => (
              <tr 
                key={record.id} 
                className="hover:bg-bg-tertiary transition-colors cursor-pointer"
                onDoubleClick={() => handleEdit(record)}
                title="Duplo clique para editar"
              >
                <td className="px-4 py-3 whitespace-nowrap text-sm text-text-primary">
                  {formatDate(record.data)}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-text-primary font-mono">
                  {record.ATENDIMENTO_ID || '-'}
                </td>
                <td className="px-4 py-3 text-sm text-text-primary">
                  <p className="font-medium">{(record as any).CLIENTE || record.nome || '-'}</p>
                </td>
                <td className="px-4 py-3 text-sm text-text-primary">
                  {(record as any).profissional || '-'}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  {renderStars(record.nota)}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-text-primary">
                  {record.reagendou ? (
                    <Icon name="Check" className="w-5 h-5 text-green-500" />
                  ) : (
                    <Icon name="X" className="w-5 h-5 text-gray-400" />
                  )}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-text-primary">
                  {record.updated_at ? new Date(record.updated_at).toLocaleDateString('pt-BR', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric'
                  }) : '-'}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
      {records.length > 0 && (
        <div className="px-4 py-3 bg-bg-tertiary text-center text-sm text-text-secondary">
          Mostrando {records.length} registro{records.length !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  );

  const renderTable = (records: PosVenda[], emptyMessage: string) => (
    <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
      <table className="w-full">
        <thead className="sticky top-0 z-10 bg-bg-tertiary shadow-sm">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
              Data
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
              Cliente
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
              Profissional
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
              Contato
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
              Avaliação
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
              Reagendou
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-text-secondary uppercase tracking-wider">
              Ações
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border-primary">
          {records.length === 0 ? (
            <tr>
              <td colSpan={7} className="px-4 py-8 text-center text-text-secondary">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            records.slice(0, 10).map((record) => (
              <tr key={record.id} className="hover:bg-bg-tertiary transition-colors">
                <td className="px-4 py-3 whitespace-nowrap text-sm text-text-primary">
                  {formatDate(record.data)}
                </td>
                <td className="px-4 py-3 text-sm text-text-primary">
                  <div>
                    <p className="font-medium">{(record as any).CLIENTE || record.nome || '-'}</p>
                    {record.ATENDIMENTO_ID && (
                      <p className="text-xs text-text-secondary">ID: {record.ATENDIMENTO_ID}</p>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-text-primary">
                  {(record as any).profissional || '-'}
                </td>
                <td className="px-4 py-3 text-sm text-text-primary">
                  {record.contato || '-'}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  {renderStars(record.nota)}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-text-primary">
                  {record.reagendou ? (
                    <Icon name="Check" className="w-5 h-5 text-green-500" />
                  ) : (
                    <Icon name="X" className="w-5 h-5 text-gray-400" />
                  )}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-right text-sm">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => handleEdit(record)}
                      className="p-1 text-primary hover:bg-bg-tertiary rounded transition-colors"
                      title="Editar"
                    >
                      <Icon name="Edit" className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(record.id)}
                      className="p-1 text-red-500 hover:bg-bg-tertiary rounded transition-colors"
                      title="Excluir"
                    >
                      <Icon name="Trash2" className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
      {records.length > 10 && (
        <div className="px-4 py-3 bg-bg-tertiary text-center text-sm text-text-secondary">
          Mostrando 10 de {records.length} registros
        </div>
      )}
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Icon name="Loader2" className="w-8 h-8 animate-spin text-primary mx-auto mb-2" />
          <p className="text-text-secondary">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Pós-Vendas</h1>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative flex-1 sm:flex-initial">
            <label htmlFor="posvendas-search" className="sr-only">
              Buscar registros
            </label>
            <input
              id="posvendas-search"
              type="text"
              placeholder="Buscar cliente, ID ou profissional..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full sm:w-64 rounded-md border border-border-secondary bg-bg-tertiary px-3 py-2 pr-8 text-sm text-text-primary focus:border-accent-primary focus:outline-none focus:ring-2 focus:ring-accent-primary/40"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-primary"
                aria-label="Limpar busca"
              >
                <Icon name="close" className="h-4 w-4" />
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <input
                type="date"
                value={specificDate}
                onChange={(e) => setSpecificDate(e.target.value)}
                className="absolute inset-0 opacity-0 cursor-pointer"
                style={{ 
                  width: '40px',
                  height: '40px'
                }}
                title={specificDate ? `Filtrado por: ${new Date(specificDate).toLocaleDateString('pt-BR')}` : 'Filtrar por data'}
              />
              <button
                className={`p-2 rounded-md border transition-colors ${
                  specificDate 
                    ? 'bg-primary text-white border-primary' 
                    : 'bg-bg-secondary text-text-secondary border-border-primary'
                }`}
                title={specificDate ? `Filtrado por: ${new Date(specificDate).toLocaleDateString('pt-BR')}` : 'Filtrar por data'}
              >
                <Icon name="Calendar" className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 sm:flex-initial">
              <PeriodSelector
                value={selectedPeriod}
                onChange={setSelectedPeriod}
                disabled={loading}
                availableYears={availableYears}
              />
            </div>
            {specificDate && (
              <button
                onClick={() => setSpecificDate('')}
                className="p-2 text-text-secondary hover:text-text-primary transition-colors"
                title="Limpar filtro de data"
              >
                <Icon name="X" className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Cards de Navegação */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Card Geral */}
        <button
          onClick={() => setActiveCard('geral')}
          className={`p-3 rounded-lg border transition-all ${
            activeCard === 'geral'
              ? 'bg-accent-primary text-white border-accent-primary shadow-lg'
              : 'bg-bg-secondary border-border-primary hover:border-accent-primary'
          }`}
        >
          <div className="flex items-center gap-2">
            <Icon name="BarChart3" className="w-5 h-5" />
            <span className="text-sm font-medium">Geral</span>
          </div>
        </button>

        {/* Card Pendente */}
        <button
          onClick={() => setActiveCard('pendente')}
          className={`p-3 rounded-lg border transition-all ${
            activeCard === 'pendente'
              ? 'bg-amber-500 text-white border-amber-500 shadow-lg'
              : 'bg-bg-secondary border-border-primary hover:border-amber-500'
          }`}
        >
          <div className="flex items-center gap-2">
            <Icon name="Clock" className="w-5 h-5" />
            <span className="text-sm font-medium">Pendente</span>
            <span className={`ml-auto text-lg font-bold ${activeCard === 'pendente' ? 'text-white' : 'text-amber-500'}`}>
              {pendentesProfissional.length}
            </span>
          </div>
        </button>

        {/* Card Agendado */}
        <button
          onClick={() => setActiveCard('agendado')}
          className={`p-3 rounded-lg border transition-all ${
            activeCard === 'agendado'
              ? 'bg-purple-500 text-white border-purple-500 shadow-lg'
              : 'bg-bg-secondary border-border-primary hover:border-purple-500'
          }`}
        >
          <div className="flex items-center gap-2">
            <Icon name="CalendarClock" className="w-5 h-5" />
            <span className="text-sm font-medium">Agendado</span>
            <span className={`ml-auto text-lg font-bold ${activeCard === 'agendado' ? 'text-white' : 'text-purple-500'}`}>
              {agendados.length}
            </span>
          </div>
        </button>

        {/* Card Contatado */}
        <button
          onClick={() => setActiveCard('contatado')}
          className={`p-3 rounded-lg border transition-all ${
            activeCard === 'contatado'
              ? 'bg-brand-cyan text-white border-brand-cyan shadow-lg'
              : 'bg-bg-secondary border-border-primary hover:border-brand-cyan'
          }`}
        >
          <div className="flex items-center gap-2">
            <Icon name="Phone" className="w-5 h-5" />
            <span className="text-sm font-medium">Contatado</span>
            <span className={`ml-auto text-lg font-bold ${activeCard === 'contatado' ? 'text-white' : 'text-brand-cyan'}`}>
              {contatados.length}
            </span>
          </div>
        </button>

        {/* Card Finalizado */}
        <button
          onClick={() => setActiveCard('finalizados')}
          className={`p-3 rounded-lg border transition-all ${
            activeCard === 'finalizados'
              ? 'bg-brand-green text-white border-brand-green shadow-lg'
              : 'bg-bg-secondary border-border-primary hover:border-brand-green'
          }`}
        >
          <div className="flex items-center gap-2">
            <Icon name="CheckCircle" className="w-5 h-5" />
            <span className="text-sm font-medium">Finalizado</span>
            <span className={`ml-auto text-lg font-bold ${activeCard === 'finalizados' ? 'text-white' : 'text-brand-green'}`}>
              {finalizados.length}
            </span>
          </div>
        </button>
      </div>

      {/* Conteúdo do Card Ativo */}
      <div className="bg-bg-secondary rounded-lg border border-border-primary overflow-hidden">
        {activeCard === 'geral' && metrics && (
          <div className="p-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Gráfico de Pizza - Status de Avaliações */}
              <div className="bg-bg-tertiary rounded-lg border border-border-primary p-6">
                <h3 className="text-lg font-semibold text-text-primary mb-6">Status de Avaliações</h3>
                <div className="flex flex-col items-center">
                  <div className="w-full h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={[
                            { name: 'Pendentes', value: pendentes.length, color: '#f59e0b' },
                            { name: 'Agendados', value: agendados.length, color: '#a855f7' },
                            { name: 'Contatados', value: metrics.totalContatados, color: '#06b6d4' },
                            { name: 'Finalizados', value: metrics.totalFinalizados, color: '#10b981' }
                          ].filter(d => d.value > 0)}
                          cx="50%"
                          cy="50%"
                          outerRadius={80}
                          dataKey="value"
                          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        >
                          {[
                            { name: 'Pendentes', value: pendentes.length, color: '#f59e0b' },
                            { name: 'Agendados', value: agendados.length, color: '#a855f7' },
                            { name: 'Contatados', value: metrics.totalContatados, color: '#06b6d4' },
                            { name: 'Finalizados', value: metrics.totalFinalizados, color: '#10b981' }
                          ].filter(d => d.value > 0).map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <RechartsTooltip 
                          contentStyle={{ 
                            backgroundColor: 'var(--bg-secondary)', 
                            borderColor: 'var(--border-primary)',
                            borderRadius: '8px',
                            color: 'var(--text-primary)'
                          }}
                          itemStyle={{ color: 'var(--text-primary)' }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  
                  {/* Legenda - Linha horizontal compacta */}
                  <div className="mt-4 flex flex-wrap justify-center gap-4 w-full">
                    <div className="flex items-center gap-2 px-3 py-2 bg-bg-primary rounded-lg border border-border-secondary">
                      <div className="w-3 h-3 rounded-full bg-amber-500"></div>
                      <div className="flex flex-col">
                        <span className="text-xs font-medium text-text-secondary">Pendentes</span>
                        <div className="flex items-baseline gap-1">
                          <span className="text-base font-bold text-text-primary">{pendentes.length}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 px-3 py-2 bg-bg-primary rounded-lg border border-border-secondary">
                      <div className="w-3 h-3 rounded-full bg-purple-500"></div>
                      <div className="flex flex-col">
                        <span className="text-xs font-medium text-text-secondary">Agendados</span>
                        <div className="flex items-baseline gap-1">
                          <span className="text-base font-bold text-text-primary">{agendados.length}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 px-3 py-2 bg-bg-primary rounded-lg border border-border-secondary">
                      <div className="w-3 h-3 rounded-full bg-brand-cyan"></div>
                      <div className="flex flex-col">
                        <span className="text-xs font-medium text-text-secondary">Contatados</span>
                        <div className="flex items-baseline gap-1">
                          <span className="text-base font-bold text-text-primary">{metrics.totalContatados}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 px-3 py-2 bg-bg-primary rounded-lg border border-border-secondary">
                      <div className="w-3 h-3 rounded-full bg-brand-green"></div>
                      <div className="flex flex-col">
                        <span className="text-xs font-medium text-text-secondary">Finalizados</span>
                        <div className="flex items-baseline gap-1">
                          <span className="text-base font-bold text-text-primary">{metrics.totalFinalizados}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Gráfico de Colunas - Avaliações */}
              <div className="bg-bg-tertiary rounded-lg border border-border-primary p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-semibold text-text-primary">Avaliações</h3>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-text-secondary">Nota Média:</span>
                    <span className="text-lg font-bold text-text-primary">
                      {(() => {
                        const somaNotas = metrics.distribuicaoNotas.reduce((acc, { nota, count }) => acc + (nota * count), 0);
                        const totalRespostas = metrics.distribuicaoNotas.reduce((acc, { count }) => acc + count, 0);
                        return totalRespostas > 0 ? (somaNotas / totalRespostas).toFixed(1) : '0.0';
                      })()}
                    </span>
                    <Icon name="Star" className="w-5 h-5 text-yellow-400 fill-yellow-400" />
                  </div>
                </div>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsBarChart 
                      data={[...metrics.distribuicaoNotas].sort((a, b) => a.nota - b.nota)}
                      margin={{ top: 20, right: 30, left: 0, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-primary)" />
                      <XAxis 
                        dataKey="nota" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fill: 'var(--text-secondary)', fontSize: 12 }}
                        label={{ value: 'Estrelas', position: 'insideBottom', offset: -5, fill: 'var(--text-secondary)', fontSize: 10 }}
                      />
                      <YAxis hide />
                      <RechartsTooltip 
                        cursor={{ fill: 'rgba(0,0,0,0.05)' }}
                        contentStyle={{ 
                          backgroundColor: 'var(--bg-secondary)', 
                          borderColor: 'var(--border-primary)',
                          borderRadius: '8px',
                          color: 'var(--text-primary)'
                        }}
                      />
                      <Bar 
                        dataKey="count" 
                        fill="var(--accent-primary)" 
                        radius={[4, 4, 0, 0]}
                        name="Quantidade"
                      >
                        {[...metrics.distribuicaoNotas].sort((a, b) => a.nota - b.nota).map((entry, index) => (
                          <Cell 
                            key={`cell-${index}`} 
                            fill={entry.nota >= 4 ? '#10b981' : entry.nota >= 3 ? '#f59e0b' : '#ef4444'} 
                          />
                        ))}
                      </Bar>
                    </RechartsBarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Tabela de Finalizados */}
            <div className="mt-6">
              <div className="flex items-center justify-between mb-4 px-6">
                <h3 className="text-lg font-semibold text-text-primary">Registros Finalizados</h3>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-text-secondary">Taxa de Reagendamento:</span>
                  <span className="text-lg font-bold text-brand-green">
                    {(() => {
                      const totalFinalizados = finalizados.length;
                      const totalReagendou = finalizados.filter(r => r.reagendou === true).length;
                      const percentual = totalFinalizados > 0 ? Math.round((totalReagendou / totalFinalizados) * 100) : 0;
                      return `${percentual}%`;
                    })()}
                  </span>
                </div>
              </div>
              <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                <table className="w-full">
                  <thead className="sticky top-0 z-10 bg-bg-tertiary shadow-sm">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                        Data Finalização
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                        Cliente
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                        Profissional
                      </th>
                      <th className="px-3 py-2 text-center text-xs font-medium text-text-secondary uppercase tracking-wider">
                        Nota
                      </th>
                      <th className="px-3 py-2 text-center text-xs font-medium text-text-secondary uppercase tracking-wider">
                        Reagendou
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-primary">
                    {finalizados.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-3 py-6 text-center text-text-secondary">
                          Nenhum registro finalizado
                        </td>
                      </tr>
                    ) : (
                      finalizados.map((record) => (
                        <tr 
                          key={record.id} 
                          className="hover:bg-bg-tertiary transition-colors cursor-pointer"
                          onDoubleClick={() => handleEdit(record)}
                          title="Duplo clique para editar"
                        >
                          <td className="px-3 py-2 whitespace-nowrap text-sm text-text-primary">
                            {record.data_finalizacao ? formatDate(record.data_finalizacao) : formatDate(record.data)}
                          </td>
                          <td className="px-3 py-2 text-sm text-text-primary">
                            {(record as any).CLIENTE || record.nome || '-'}
                          </td>
                          <td className="px-3 py-2 text-sm text-text-primary">
                            {(record as any).profissional || '-'}
                          </td>
                          <td className="px-3 py-2 text-center">
                            {record.nota ? (
                              <div className="flex items-center justify-center gap-0.5">
                                {[1, 2, 3, 4, 5].map(star => (
                                  <Icon
                                    key={star}
                                    name="Star"
                                    className={`w-3 h-3 ${star <= record.nota! ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`}
                                  />
                                ))}
                              </div>
                            ) : (
                              <span className="text-sm text-text-secondary">-</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-center">
                            {record.reagendou ? (
                              <Icon name="CheckCircle" className="w-5 h-5 text-brand-green mx-auto" />
                            ) : (
                              <Icon name="XCircle" className="w-5 h-5 text-text-tertiary mx-auto" />
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

        {activeCard === 'pendente' && (
          <div>
            {!posVendasWebhook && (
              <div className="mb-4 p-3 rounded-lg bg-orange-100 dark:bg-orange-900/20 border border-orange-300 dark:border-orange-800">
                <div className="flex items-center gap-2 text-orange-800 dark:text-orange-300">
                  <Icon name="AlertTriangle" className="w-5 h-5" />
                  <div>
                    <p className="font-medium">Webhook não configurado</p>
                    <p className="text-sm text-orange-700 dark:text-orange-400">
                      Configure a URL do webhook no módulo "Pós-Vendas" em Gerenciar Módulos para habilitar o envio de avaliações.
                    </p>
                  </div>
                </div>
              </div>
            )}
            {webhookFeedback && (
              <div className={`mb-4 p-3 rounded-lg ${webhookFeedback.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                {webhookFeedback.message}
              </div>
            )}
            
            {/* Tabela Desktop */}
            <div className="hidden lg:block overflow-x-auto max-h-[600px] overflow-y-auto">
              <table className="w-full">
              <thead className="sticky top-0 z-10 bg-bg-tertiary shadow-sm">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                    Data
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                    ID
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                    Cliente
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                    Profissional
                  </th>
                  <th className="px-3 py-2 text-center text-xs font-medium text-text-secondary uppercase tracking-wider">
                    Ação
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-primary">
                {pendentesFiltradosPorBusca.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-6 text-center text-text-secondary">
                      {searchTerm ? 'Nenhum registro encontrado com esse termo' : 'Nenhum registro pendente'}
                    </td>
                  </tr>
                ) : (
                  pendentesPaginados.map((record) => (
                    <tr 
                      key={record.id} 
                      className="hover:bg-bg-tertiary transition-colors cursor-pointer"
                      onDoubleClick={() => handleEdit(record)}
                      title="Duplo clique para editar"
                    >
                      <td className="px-3 py-2 whitespace-nowrap text-sm text-text-primary">
                        {formatDate(record.data)}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-sm text-text-secondary">
                        {record.ATENDIMENTO_ID || '-'}
                      </td>
                      <td className="px-3 py-2 text-sm text-text-primary">
                        <div>
                          <p className="font-medium">{record.nome || '-'}</p>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-sm text-text-primary">
                        {record.profissional || '-'}
                      </td>
                      <td className="px-3 py-2">
                        {record.data_agendamento && record.horario_agendamento ? (
                          // Exibe informações de agendamento - CENTRALIZADO
                          <div className="flex flex-col items-center gap-2">
                            <div className="flex items-center gap-2 text-sm">
                              <Icon name="Clock" className="w-4 h-4 text-brand-cyan" />
                              <div className="flex flex-col items-center">
                                <span className="font-medium text-brand-cyan">Agendado</span>
                                <span className="text-xs text-text-secondary whitespace-nowrap">
                                  {new Date(record.data_agendamento + 'T00:00:00').toLocaleDateString('pt-BR')} às {record.horario_agendamento.substring(0, 5)}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => handleOpenScheduleModal(record)}
                                title="Editar agendamento"
                                className="px-2 py-1 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors flex items-center gap-1 text-xs"
                              >
                                <Icon name="Edit" className="w-3 h-3" />
                                Editar
                              </button>
                              <button
                                onClick={() => handleRemoveSchedule(record)}
                                title="Remover agendamento"
                                className="px-2 py-1 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors flex items-center gap-1 text-xs"
                              >
                                <Icon name="X" className="w-3 h-3" />
                                Remover
                              </button>
                            </div>
                          </div>
                        ) : (
                          // Exibe botões de ação normais - apenas ícones
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => handleSendWebhook(record)}
                              disabled={sendingWebhook.has(record.id) || !posVendasWebhook}
                              title={!posVendasWebhook ? 'Webhook não configurado para este módulo' : 'Enviar avaliação'}
                              className="p-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center"
                            >
                              {sendingWebhook.has(record.id) ? (
                                <Icon name="Loader2" className="w-4 h-4 animate-spin" />
                              ) : !posVendasWebhook ? (
                                <Icon name="AlertCircle" className="w-4 h-4" />
                              ) : (
                                <Icon name="Send" className="w-4 h-4" />
                              )}
                            </button>
                            
                            <button
                              onClick={() => handleOpenScheduleModal(record)}
                              title="Agendar envio"
                              className="p-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors flex items-center justify-center"
                            >
                              <Icon name="CalendarClock" className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              </table>
            </div>
            
            {/* Cards Mobile */}
            <div className="lg:hidden space-y-3">
              {pendentesFiltradosPorBusca.length === 0 ? (
                <div className="bg-bg-secondary rounded-lg p-6 text-center">
                  <p className="text-text-secondary">
                    {searchTerm ? 'Nenhum registro encontrado com esse termo' : 'Nenhum registro pendente'}
                  </p>
                </div>
              ) : (
                pendentesPaginados.map((record) => (
                  <div
                    key={record.id}
                    className="bg-bg-secondary rounded-lg p-4 space-y-3 border border-border-primary"
                    onDoubleClick={() => handleEdit(record)}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <p className="font-semibold text-sm text-text-primary">{record.nome || '-'}</p>
                        <p className="text-xs text-text-secondary mt-0.5">
                          ID: {record.ATENDIMENTO_ID || '-'}
                        </p>
                      </div>
                      <span className="px-2 py-1 bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300 text-xs rounded-full">
                        Pendente
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-text-secondary">Data:</span>
                        <p className="text-text-primary font-medium">{formatDate(record.data)}</p>
                      </div>
                      <div>
                        <span className="text-text-secondary">Profissional:</span>
                        <p className="text-text-primary font-medium">{record.profissional || '-'}</p>
                      </div>
                    </div>
                    
                    {record.data_agendamento && record.horario_agendamento ? (
                      // Exibe informações de agendamento no mobile
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 p-3 bg-brand-cyan/10 rounded-lg border border-brand-cyan/20">
                          <Icon name="Clock" className="w-5 h-5 text-brand-cyan" />
                          <div className="flex-1">
                            <p className="text-sm font-medium text-brand-cyan">Agendado</p>
                            <p className="text-xs text-text-secondary">
                              {new Date(record.data_agendamento + 'T00:00:00').toLocaleDateString('pt-BR')} às {record.horario_agendamento.substring(0, 5)}
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleOpenScheduleModal(record)}
                            className="flex-1 px-3 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors flex items-center justify-center gap-2 text-sm"
                          >
                            <Icon name="Edit" className="w-4 h-4" />
                            Editar
                          </button>
                          <button
                            onClick={() => handleRemoveSchedule(record)}
                            className="flex-1 px-3 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors flex items-center justify-center gap-2 text-sm"
                          >
                            <Icon name="X" className="w-4 h-4" />
                            Remover
                          </button>
                        </div>
                      </div>
                    ) : (
                      // Exibe botões normais no mobile - mantém texto por espaço
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleSendWebhook(record)}
                          disabled={sendingWebhook.has(record.id) || !posVendasWebhook}
                          className="flex-1 px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm"
                        >
                          {sendingWebhook.has(record.id) ? (
                            <>
                              <Icon name="Loader2" className="w-4 h-4 animate-spin" />
                              Enviando...
                            </>
                          ) : !posVendasWebhook ? (
                            <>
                              <Icon name="AlertCircle" className="w-4 h-4" />
                              Sem webhook
                            </>
                          ) : (
                            <>
                              <Icon name="Send" className="w-4 h-4" />
                              Enviar
                            </>
                          )}
                        </button>
                        
                        <button
                          onClick={() => handleOpenScheduleModal(record)}
                          className="flex-1 px-3 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors flex items-center justify-center gap-2 text-sm"
                        >
                          <Icon name="CalendarClock" className="w-4 h-4" />
                          Agendar
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
            
            {/* Paginação */}
            {pendentesFiltradosPorBusca.length > 0 && (
              <div className="bg-bg-tertiary border-t border-border-primary mt-4 lg:mt-0 rounded-b-lg">
                <div className="flex flex-col sm:flex-row items-center justify-between px-4 py-3 gap-3">
                  <div className="text-xs sm:text-sm text-text-secondary text-center sm:text-left">
                    Mostrando {startIndex + 1}-{Math.min(endIndex, pendentesFiltradosPorBusca.length)} de {pendentesFiltradosPorBusca.length} registro(s)
                    {searchTerm && pendentesFiltradosPorBusca.length !== pendentesProfissional.length && (
                      <span className="ml-1">(filtrado de {pendentesProfissional.length})</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 w-full sm:w-auto justify-center">
                    <button
                      onClick={handlePreviousPage}
                      disabled={currentPage === 1}
                      className="flex items-center gap-1 px-3 py-1.5 text-sm border rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed hover:bg-bg-primary border-border-primary text-text-primary"
                    >
                      <Icon name="ChevronLeft" className="w-4 h-4" />
                      Anterior
                    </button>
                    <span className="text-sm text-text-primary px-2">
                      Página {currentPage} de {totalPages}
                    </span>
                    <button
                      onClick={handleNextPage}
                      disabled={currentPage === totalPages}
                      className="flex items-center gap-1 px-3 py-1.5 text-sm border rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed hover:bg-bg-primary border-border-primary text-text-primary"
                    >
                      Próxima
                      <Icon name="ChevronRight" className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
        {activeCard === 'agendado' && (
          <div>
            {/* Tabela Desktop */}
            <div className="hidden lg:block overflow-x-auto max-h-[600px] overflow-y-auto">
              <table className="w-full">
                <thead className="sticky top-0 z-10 bg-bg-tertiary shadow-sm">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                      Data
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                      ID
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                      Cliente
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                      Profissional
                    </th>
                    <th className="px-3 py-2 text-center text-xs font-medium text-text-secondary uppercase tracking-wider">
                      Agendamento
                    </th>
                    <th className="px-3 py-2 text-center text-xs font-medium text-text-secondary uppercase tracking-wider">
                      Ação
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-primary">
                  {agendados.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-3 py-6 text-center text-text-secondary">
                        Nenhum registro agendado
                      </td>
                    </tr>
                  ) : (
                    agendados.map((record) => (
                      <tr 
                        key={record.id} 
                        className="hover:bg-bg-tertiary transition-colors cursor-pointer"
                        onDoubleClick={() => handleEdit(record)}
                        title="Duplo clique para editar"
                      >
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-text-primary">
                          {formatDate(record.data)}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-text-secondary">
                          {record.ATENDIMENTO_ID || '-'}
                        </td>
                        <td className="px-3 py-2 text-sm text-text-primary">
                          <div>
                            <p className="font-medium">{record.nome || '-'}</p>
                          </div>
                        </td>
                        <td className="px-3 py-2 text-sm text-text-primary">
                          {record.profissional || '-'}
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex flex-col items-center gap-1">
                            <div className="flex items-center gap-2 text-sm">
                              <Icon name="CalendarClock" className="w-4 h-4 text-purple-500" />
                              <span className="font-medium text-purple-500">
                                {record.data_agendamento ? new Date(record.data_agendamento + 'T00:00:00').toLocaleDateString('pt-BR') : '-'}
                              </span>
                            </div>
                            <span className="text-xs text-text-secondary">
                              {record.horario_agendamento ? record.horario_agendamento.substring(0, 5) : '-'}
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => handleOpenScheduleModal(record)}
                              title="Editar agendamento"
                              className="p-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
                            >
                              <Icon name="Edit" className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleRemoveSchedule(record)}
                              title="Remover agendamento"
                              className="p-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                            >
                              <Icon name="X" className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            
            {/* Cards Mobile */}
            <div className="lg:hidden space-y-3">
              {agendados.length === 0 ? (
                <div className="bg-bg-secondary rounded-lg p-6 text-center">
                  <p className="text-text-secondary">Nenhum registro agendado</p>
                </div>
              ) : (
                agendados.map((record) => (
                  <div
                    key={record.id}
                    className="bg-bg-secondary rounded-lg p-4 space-y-3 border border-border-primary"
                    onDoubleClick={() => handleEdit(record)}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <p className="font-semibold text-sm text-text-primary">{record.nome || '-'}</p>
                        <p className="text-xs text-text-secondary mt-0.5">
                          ID: {record.ATENDIMENTO_ID || '-'}
                        </p>
                      </div>
                      <span className="px-2 py-1 bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300 text-xs rounded-full">
                        Agendado
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-text-secondary">Data:</span>
                        <p className="text-text-primary font-medium">{formatDate(record.data)}</p>
                      </div>
                      <div>
                        <span className="text-text-secondary">Profissional:</span>
                        <p className="text-text-primary font-medium">{record.profissional || '-'}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 p-3 bg-purple-50 dark:bg-purple-900/10 rounded-lg border border-purple-200 dark:border-purple-800">
                      <Icon name="CalendarClock" className="w-5 h-5 text-purple-500" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-purple-600 dark:text-purple-400">Agendado para:</p>
                        <p className="text-xs text-text-secondary">
                          {record.data_agendamento ? new Date(record.data_agendamento + 'T00:00:00').toLocaleDateString('pt-BR') : '-'} às {record.horario_agendamento ? record.horario_agendamento.substring(0, 5) : '-'}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex gap-2 justify-center">
                      <button
                        onClick={() => handleOpenScheduleModal(record)}
                        title="Editar agendamento"
                        className="p-2.5 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
                      >
                        <Icon name="Edit" className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => handleRemoveSchedule(record)}
                        title="Remover agendamento"
                        className="p-2.5 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                      >
                        <Icon name="X" className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
        {activeCard === 'contatado' && renderContatadosTable(contatados, 'Nenhum registro contatado')}
        {activeCard === 'finalizados' && renderFinalizadosTable(finalizados, 'Nenhum registro finalizado')}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <PosVendaFormModal
          record={editingRecord}
          onClose={handleCloseModal}
        />
      )}

      {/* Modal de Agendamento */}
      {isScheduleModalOpen && schedulingRecord && (
        <ScheduleModal
          record={schedulingRecord}
          onClose={handleCloseScheduleModal}
          onSave={handleSaveSchedule}
        />
      )}
    </div>
  );
};

// Componente Modal de Agendamento
const ScheduleModal: React.FC<{
  record: PosVenda;
  onClose: () => void;
  onSave: (dataAgendamento: string, horarioAgendamento: string) => void;
}> = ({ record, onClose, onSave }) => {
  const [dataAgendamento, setDataAgendamento] = useState(record.data_agendamento || '');
  const [horarioAgendamento, setHorarioAgendamento] = useState(record.horario_agendamento || '');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dataAgendamento || !horarioAgendamento) {
      alert('Preencha data e horário para agendar');
      return;
    }
    setSaving(true);
    try {
      await onSave(dataAgendamento, horarioAgendamento);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div className="w-full max-w-md rounded-xl bg-bg-secondary shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="relative bg-gradient-to-r from-brand-cyan/10 to-accent-primary/10 border-b border-border-secondary px-5 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Icon name="Clock" className="w-5 h-5 text-brand-cyan" />
              <h2 className="text-lg font-bold text-text-primary">Agendar Envio</h2>
            </div>
            <button 
              onClick={onClose} 
              type="button"
              className="text-text-secondary hover:text-text-primary hover:bg-bg-tertiary rounded-lg p-1.5 transition-colors"
              aria-label="Fechar"
            >
              <Icon name="X" className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit}>
          <div className="px-5 py-4 space-y-4">
            {/* Info do Cliente */}
            <div className="bg-bg-tertiary/50 rounded-lg p-3 border border-border-secondary/50">
              <p className="text-sm font-medium text-text-primary">{record.nome || '-'}</p>
              <p className="text-xs text-text-secondary mt-1">ID: {record.ATENDIMENTO_ID || '-'}</p>
              {record.profissional && (
                <p className="text-xs text-text-secondary">Profissional: {record.profissional}</p>
              )}
            </div>

            {/* Campos de Agendamento */}
            <div className="space-y-3">
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-text-secondary flex items-center gap-1">
                  <Icon name="Calendar" className="w-3 h-3" />
                  Data Programada <span className="text-danger">*</span>
                </span>
                <input
                  type="date"
                  value={dataAgendamento}
                  onChange={(e) => setDataAgendamento(e.target.value)}
                  required
                  min={new Date().toISOString().split('T')[0]}
                  className="rounded-lg border border-border-secondary bg-bg-tertiary px-3 py-2 text-sm text-text-primary focus:border-brand-cyan focus:outline-none focus:ring-2 focus:ring-brand-cyan/20 transition-all"
                />
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-text-secondary flex items-center gap-1">
                  <Icon name="Clock" className="w-3 h-3" />
                  Horário Programado <span className="text-danger">*</span>
                </span>
                <input
                  type="time"
                  value={horarioAgendamento}
                  onChange={(e) => setHorarioAgendamento(e.target.value)}
                  required
                  className="rounded-lg border border-border-secondary bg-bg-tertiary px-3 py-2 text-sm text-text-primary focus:border-brand-cyan focus:outline-none focus:ring-2 focus:ring-brand-cyan/20 transition-all"
                />
              </label>
            </div>

            {/* Preview do Agendamento */}
            {dataAgendamento && horarioAgendamento && (
              <div className="flex items-start gap-2 p-2.5 rounded-lg bg-brand-cyan/5 border border-brand-cyan/20">
                <Icon name="Info" className="w-4 h-4 text-brand-cyan flex-shrink-0 mt-0.5" />
                <p className="text-xs text-text-secondary">
                  O pós-venda será enviado automaticamente em{' '}
                  <strong className="text-brand-cyan">
                    {new Date(dataAgendamento + 'T00:00:00').toLocaleDateString('pt-BR')}
                  </strong>{' '}
                  às <strong className="text-brand-cyan">{horarioAgendamento}</strong>.
                </p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between border-t border-border-secondary bg-bg-tertiary px-5 py-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving || !dataAgendamento || !horarioAgendamento}
              className="rounded-lg bg-brand-cyan px-4 py-2 text-sm font-medium text-white hover:bg-brand-cyan/90 focus:outline-none focus:ring-2 focus:ring-brand-cyan transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-brand-cyan/20 flex items-center gap-2"
            >
              {saving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  Salvando...
                </>
              ) : (
                <>
                  <Icon name="Check" className="w-4 h-4" />
                  Agendar Envio
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PosVendasPage;
