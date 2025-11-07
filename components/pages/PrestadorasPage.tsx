import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAppContext } from '../../contexts/AppContext';
import { useAuth } from '../../contexts/AuthContext';
import { Icon } from '../ui/Icon';
import { countProfissionais, countRecrutadora, countProcessedDataForPeriod, getMonthlyActivitySummary, MonthlyActivitySummary, getProfessionalMonthlyStats, ProfessionalMonthlyStat, getProfessionalAppointmentsForPeriod, type ProfessionalAppointment, getRecrutadoraMonthlyMetrics, type RecrutadoraMonthlyMetrics, getProfissionaisActivatedForPeriod, getLastAppointmentByProfessional } from '../../services/analytics/prestadoras.service';
import { fetchProfissionais, updateProfissionalStatus, Profissional } from '../../services/profissionais/profissionais.service';
import ProfessionalAppointmentsModal from '../ui/ProfessionalAppointmentsModal';
import { ProfissionalFormModal } from '../ui/ProfissionalFormModal';
import { fetchAvailableYearsFromProcessedData } from '../../services/data/dataTable.service';

const MetricCard: React.FC<{
  title: string;
  value?: string | number;
  icon: string;
  iconBgColor: string;
  isSelected?: boolean;
  onClick?: () => void;
  showValue?: boolean;
}> = ({ title, value, icon, iconBgColor, isSelected = false, onClick, showValue = true }) => (
  <button
    type="button"
    onClick={onClick}
    className={`p-3 rounded-lg border transition-all ${
      isSelected 
        ? `${iconBgColor} text-white border-transparent shadow-lg` 
        : 'bg-bg-secondary border-border-primary hover:shadow-md'
    }`}
    disabled={!onClick}
  >
    <div className="flex items-center gap-2">
      <Icon name={icon} className="w-5 h-5" />
      <span className="text-sm font-medium">{title}</span>
      {showValue && value !== undefined && (
        <span className={`ml-auto text-lg font-bold ${isSelected ? 'text-white' : 'text-text-primary'}`}>
          {value}
        </span>
      )}
    </div>
  </button>
);

const PeriodDropdown: React.FC<{
  value: string;
  onChange: (value: string) => void;
  availableYears?: number[];
}> = ({ value, onChange, availableYears }) => {
  const [isOpen, setIsOpen] = useState(false);
  const currentYear = new Date().getFullYear();
  const years = availableYears && availableYears.length > 0 ? availableYears : [currentYear, currentYear - 1, currentYear - 2];
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
    { value: '12', label: 'Dezembro' }
  ];
  const options: { value: string; label: string }[] = [];
  years.forEach(y => months.forEach(m => options.push({ value: `${y}-${m.value}`, label: `${m.label} ${y}` })));
  const label = (() => {
    const [y, m] = value.split('-');
    const mm = months.find(x => x.value === m);
    return mm ? `${mm.label} ${y}` : value;
  })();
  return (
    <div className="relative">
      <button type="button" onClick={() => setIsOpen(!isOpen)} className="flex items-center justify-between w-64 px-3 py-2 text-left border rounded-md bg-bg-secondary border-border-secondary">
        <span className="text-sm text-text-primary">{label}</span>
        <Icon name={isOpen ? 'close' : 'add'} className="w-4 h-4 text-text-secondary" />
      </button>
      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 z-20 w-64 mt-1 bg-bg-secondary border rounded-md shadow-lg border-border-secondary max-h-80 overflow-y-auto">
            <div className="py-1">
              {options.map(opt => (
                <button key={opt.value} onClick={() => { onChange(opt.value); setIsOpen(false); }} className={`w-full px-3 py-2 text-left text-sm transition-colors hover:bg-bg-tertiary ${value === opt.value ? 'bg-accent-primary text-white' : 'text-text-primary'}`}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

const PrestadorasPage: React.FC = () => {
  const { selectedUnit } = useAppContext();
  const { userUnits } = useAuth();
  const [period, setPeriod] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
  });
  const [availableYears, setAvailableYears] = useState<number[]>([new Date().getFullYear()]);

  const multiUnitIds = useMemo(() => {
    if (!selectedUnit) return [] as string[];
    return selectedUnit.unit_code === 'ALL' ? userUnits.map(u => u.id) : [selectedUnit.id];
  }, [selectedUnit, userUnits]);

  const multiUnitCodes = useMemo(() => {
    if (!selectedUnit) return [] as string[];
    return selectedUnit.unit_code === 'ALL' ? userUnits.map(u => u.unit_code) : [selectedUnit.unit_code];
  }, [selectedUnit, userUnits]);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [profissionaisCount, setProfissionaisCount] = useState<number>(0);
  const [recrutadoraCount, setRecrutadoraCount] = useState<number>(0);
  const [processedCount, setProcessedCount] = useState<number>(0);
  const [profClickSummary, setProfClickSummary] = useState<MonthlyActivitySummary | null>(null);
  const [ranking, setRanking] = useState<ProfessionalMonthlyStat[] | null>(null);
  const [rankSort, setRankSort] = useState<'atendimentos' | 'ganhos'>('atendimentos');
  const [busyCard, setBusyCard] = useState<'profissionais' | 'recrutadora' | 'processed' | null>(null);
  const [recruMetrics, setRecruMetrics] = useState<RecrutadoraMonthlyMetrics | null>(null);
  const [recruActivated, setRecruActivated] = useState<number>(0);
  const [activePanel, setActivePanel] = useState<'profissionais' | 'atuantes' | null>(null);
  const [appointmentsOpen, setAppointmentsOpen] = useState(false);
  const [appointmentsLoading, setAppointmentsLoading] = useState(false);
  const [appointments, setAppointments] = useState<ProfessionalAppointment[]>([]);
  const [selectedProf, setSelectedProf] = useState<string | null>(null);
  const [autoLoaded, setAutoLoaded] = useState(false);
  
  // Estados para tabela de profissionais
  const [profissionaisList, setProfissionaisList] = useState<Profissional[]>([]);
  const [profissionaisLoading, setProfissionaisLoading] = useState(false);
  const [selectedProfissional, setSelectedProfissional] = useState<Profissional | null>(null);
  const [profissionalModalOpen, setProfissionalModalOpen] = useState(false);
  const [searchProfTerm, setSearchProfTerm] = useState('');
  const [statusTab, setStatusTab] = useState<'todas' | 'ativas' | 'inativas' | 'atencao'>('todas');
  const [profCurrentPage, setProfCurrentPage] = useState(1);
  const profPageSize = 25;
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);
  const [lastAppointments, setLastAppointments] = useState<Record<string, string>>({});

  // Cálculo de profissionais ativas com mais de 15 dias sem atendimento
  const profissionaisAtivasSemAtendimento = useMemo(() => {
    const hoje = new Date();
    
    // Filtrar profissionais ativas
    const ativas = profissionaisList.filter(p => {
      const status = (p.status || '').toLowerCase().trim();
      return status === 'ativa' || status === 'ativo';
    });
    
    // Contar quantas ativas têm mais de 15 dias sem atendimento
    const atencao = ativas.filter(p => {
      const nomeKey = (p.nome || '').toLowerCase().trim();
      const ultimaData = lastAppointments[nomeKey];
      
      if (!ultimaData) return true; // Nunca atendeu = atenção
      
      const dataUltimo = new Date(ultimaData);
      const diffDias = Math.floor((hoje.getTime() - dataUltimo.getTime()) / (1000 * 60 * 60 * 24));
      return diffDias > 15;
    });
    
    return atencao.length;
  }, [profissionaisList, lastAppointments]);

  const periodLabel = useMemo(() => {
    const months = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
    const [y,m] = period.split('-');
    const mi = Number(m) - 1;
    if (mi >= 0 && mi < 12) return `${months[mi]} ${y}`;
    return period;
  }, [period]);

  useEffect(() => {
    if (!selectedUnit) {
      setAvailableYears([new Date().getFullYear()]);
      return;
    }
    const loadYears = async () => {
      try {
        const unitCode = selectedUnit.unit_code === 'ALL' ? multiUnitCodes : selectedUnit.unit_code;
        const years = await fetchAvailableYearsFromProcessedData(unitCode);
        setAvailableYears(years);
      } catch (error) {
        console.error('Erro ao carregar anos disponíveis:', error);
        setAvailableYears([new Date().getFullYear()]);
      }
    };
    loadYears();
  }, [selectedUnit, multiUnitCodes]);

  const load = useCallback(async () => {
    if (!selectedUnit) { setProfissionaisCount(0); setRecrutadoraCount(0); setProcessedCount(0); return; }
    setLoading(true); setErr(null);
    try {
      const [pc, rc, dc, rmm, act] = await Promise.all([
        countProfissionais(multiUnitIds),
        countRecrutadora(multiUnitIds),
        countProcessedDataForPeriod(multiUnitCodes, period),
        getRecrutadoraMonthlyMetrics(multiUnitIds, period),
        getProfissionaisActivatedForPeriod(multiUnitIds, period),
      ]);
      setProfissionaisCount(pc);
      setRecrutadoraCount(rc);
      setProcessedCount(dc);
      setRecruMetrics(rmm);
      setRecruActivated(act);
    } catch (e: any) {
      setErr(e.message || 'Falha ao carregar métricas de Prestadoras');
    } finally {
      setLoading(false);
    }
  }, [selectedUnit, multiUnitIds, multiUnitCodes, period]);

  useEffect(() => { load(); }, [load]);
  
  // Carregar lista de profissionais
  const loadProfissionaisList = useCallback(async () => {
    setProfissionaisLoading(true);
    try {
      const unitFilter = selectedUnit?.unit_code === 'ALL' ? undefined : (selectedUnit as any)?.id;
      const [data, lastAppts] = await Promise.all([
        fetchProfissionais(unitFilter),
        getLastAppointmentByProfessional(multiUnitCodes)
      ]);
      setProfissionaisList(data);
      setLastAppointments(lastAppts);
    } catch (e: any) {
      console.error('Erro ao carregar profissionais:', e);
    } finally {
      setProfissionaisLoading(false);
    }
  }, [selectedUnit, multiUnitCodes]);
  
  const handleClickProfissionais = useCallback(async () => {
    try {
      setBusyCard('profissionais');
      const summary = await getMonthlyActivitySummary(multiUnitCodes, period);
      setProfClickSummary(summary);
      const stats = await getProfessionalMonthlyStats(multiUnitCodes, period);
      setRanking(stats);
      
      // Carregar lista de profissionais quando ativar o painel
      await loadProfissionaisList();
    } catch (e) {
      // opcional: tratar erro com toast
    } finally {
      setBusyCard(null);
    }
  }, [multiUnitCodes, period, loadProfissionaisList]);

  // Ativa automaticamente o card de Profissionais ao entrar na página (uma vez por montagem)
  useEffect(() => {
    if (!autoLoaded && multiUnitCodes.length > 0) {
      setAutoLoaded(true);
      setActivePanel('profissionais');
      handleClickProfissionais();
    }
  }, [autoLoaded, multiUnitCodes, handleClickProfissionais]);

  const handleOpenAppointments = useCallback(async (profissional: string) => {
    setSelectedProf(profissional);
    setAppointments([]);
    setAppointmentsOpen(true);
    setAppointmentsLoading(true);
    try {
      const data = await getProfessionalAppointmentsForPeriod(multiUnitCodes, period, profissional.trim());
      setAppointments(data);
    } catch (e) {
      // TODO: opcional - notificar erro
    } finally {
      setAppointmentsLoading(false);
    }
  }, [multiUnitCodes, period]);

  // Funções para tabela de profissionais
  const handleRowDoubleClick = (p: Profissional) => {
    setSelectedProfissional(p);
    setProfissionalModalOpen(true);
  };

  const handleToggleStatus = async (profissional: Profissional) => {
    if (!profissional.id || updatingStatusId) return;
    
    const currentStatus = (profissional.status || '').toLowerCase().trim();
    const isCurrentlyActive = currentStatus === 'ativa' || currentStatus === 'ativo';
    const newStatus: 'Ativa' | 'Inativa' = isCurrentlyActive ? 'Inativa' : 'Ativa';
    
    setUpdatingStatusId(profissional.id);
    
    // Atualização otimista
    setProfissionaisList(prev => prev.map(r => 
      r.id === profissional.id ? { ...r, status: newStatus } : r
    ));
    
    try {
      await updateProfissionalStatus(profissional.id, newStatus);
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
      // Reverter em caso de erro
      setProfissionaisList(prev => prev.map(r => 
        r.id === profissional.id ? { ...r, status: profissional.status } : r
      ));
    } finally {
      setUpdatingStatusId(null);
    }
  };

  // Métricas da tabela de profissionais
  const profMetrics = useMemo(() => {
    const normalizeStatus = (status: string | null) => (status || '').toLowerCase().trim();
    const ativas = profissionaisList.filter(r => normalizeStatus(r.status) === 'ativa' || normalizeStatus(r.status) === 'ativo').length;
    const inativas = profissionaisList.filter(r => normalizeStatus(r.status) === 'inativa' || normalizeStatus(r.status) === 'inativo').length;
    
    // Calcular profissionais ativas com mais de 15 dias sem atendimento
    const hoje = new Date();
    const atencao = profissionaisList.filter(r => {
      const status = normalizeStatus(r.status);
      if (status !== 'ativa' && status !== 'ativo') return false;
      
      const nomeKey = (r.nome || '').toLowerCase().trim();
      const ultimaData = lastAppointments[nomeKey];
      
      if (!ultimaData) return true; // Nunca atendeu = atenção
      
      const dataUltimo = new Date(ultimaData);
      const diffDias = Math.floor((hoje.getTime() - dataUltimo.getTime()) / (1000 * 60 * 60 * 24));
      return diffDias > 15;
    }).length;
    
    return { ativas, inativas, atencao, total: profissionaisList.length };
  }, [profissionaisList, lastAppointments]);

  // Filtro por status
  const filteredByStatus = useMemo(() => {
    const normalizeStatus = (status: string | null) => (status || '').toLowerCase().trim();
    const hoje = new Date();
    
    if (statusTab === 'ativas') {
      return profissionaisList.filter(r => {
        const normalized = normalizeStatus(r.status);
        return normalized === 'ativa' || normalized === 'ativo';
      });
    }
    if (statusTab === 'inativas') {
      return profissionaisList.filter(r => {
        const normalized = normalizeStatus(r.status);
        return normalized === 'inativa' || normalized === 'inativo';
      });
    }
    if (statusTab === 'atencao') {
      // Profissionais ativas com mais de 15 dias sem atendimento
      return profissionaisList.filter(r => {
        const status = normalizeStatus(r.status);
        if (status !== 'ativa' && status !== 'ativo') return false;
        
        const nomeKey = (r.nome || '').toLowerCase().trim();
        const ultimaData = lastAppointments[nomeKey];
        
        if (!ultimaData) return true; // Nunca atendeu = atenção
        
        const dataUltimo = new Date(ultimaData);
        const diffDias = Math.floor((hoje.getTime() - dataUltimo.getTime()) / (1000 * 60 * 60 * 24));
        return diffDias > 15;
      });
    }
    return profissionaisList;
  }, [profissionaisList, statusTab, lastAppointments]);

  // Filtro por busca
  const filteredProfRows = useMemo(() => {
    const q = searchProfTerm.trim().toLowerCase();
    if (!q) return filteredByStatus;
    return filteredByStatus.filter(r =>
      (r.nome || '').toLowerCase().includes(q) ||
      (r.whatsapp || '').toLowerCase().includes(q)
    );
  }, [filteredByStatus, searchProfTerm]);

  const profTotalPages = Math.max(1, Math.ceil(filteredProfRows.length / profPageSize));
  const profPageIndex = Math.min(profCurrentPage, profTotalPages) - 1;
  const profStart = profPageIndex * profPageSize;
  const profEnd = profStart + profPageSize;
  const paginatedProfRows = filteredProfRows.slice(profStart, profEnd);

  // Resetar página ao alterar busca ou aba
  useEffect(() => { 
    setProfCurrentPage(1); 
  }, [searchProfTerm, statusTab]);

  // Recarrega automaticamente o painel de Profissionais ao mudar período/unidade quando estiver ativo
  useEffect(() => {
    if (activePanel === 'profissionais' || activePanel === 'atuantes') {
      handleClickProfissionais();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, multiUnitCodes.join('|'), activePanel]);

  return (
    <>
    <div className="space-y-6">
      {/* Cabeçalho Principal */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-text-primary">
          Prestadoras{
            activePanel === 'profissionais' ? ' - Profissionais' :
            activePanel === 'recrutadora' ? ' - Recrutadora' :
            activePanel === 'atuantes' ? ' - Profissionais Atuantes' :
            ''
          }
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          {activePanel === 'profissionais' && (
            <div className="relative">
              <input
                type="text"
                placeholder="Buscar profissional..."
                value={searchProfTerm}
                onChange={(e) => setSearchProfTerm(e.target.value)}
                className="w-64 px-3 py-2 pl-9 text-sm border rounded-md bg-bg-primary border-border-secondary text-text-primary placeholder-text-secondary focus:outline-none focus:ring-2 focus:ring-accent-primary"
              />
              <Icon name="Search" className="absolute left-2.5 top-2.5 w-4 h-4 text-text-secondary" />
            </div>
          )}
          <PeriodDropdown value={period} onChange={setPeriod} availableYears={availableYears} />
        </div>
      </div>

      {/* Cards principais - FORA do card de conteúdo */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => { setActivePanel('profissionais'); handleClickProfissionais(); }}
          className={`p-3 rounded-lg border transition-all ${
            activePanel === 'profissionais'
              ? 'bg-accent-primary text-white border-transparent shadow-lg'
              : 'bg-bg-secondary border-border-primary hover:shadow-md'
          }`}
          aria-pressed={activePanel === 'profissionais'}
        >
          <div className="flex items-center justify-center gap-2">
            <Icon name="Users" className="w-5 h-5" />
            <span className="text-sm font-medium">Profissionais</span>
          </div>
        </button>
        <button
          type="button"
          onClick={() => { setActivePanel('atuantes'); handleClickProfissionais(); }}
          className={`p-3 rounded-lg border transition-all ${
            activePanel === 'atuantes'
              ? 'bg-accent-primary text-white border-transparent shadow-lg'
              : 'bg-bg-secondary border-border-primary hover:shadow-md'
          }`}
          aria-pressed={activePanel === 'atuantes'}
        >
          <div className="flex items-center justify-center gap-2">
            <Icon name="UserCheck" className="w-5 h-5" />
            <span className="text-sm font-medium">Profissionais atuantes (mês)</span>
          </div>
        </button>
      </div>

      {/* Área de Conteúdo */}
      <div className="bg-bg-secondary rounded-lg shadow-md overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <div className="w-12 h-12 border-4 border-t-4 border-gray-200 rounded-full animate-spin border-t-accent-primary"></div>
          </div>
        ) : err ? (
          <div className="p-8 text-center">
            <div className="p-4 text-danger bg-danger/10 border border-danger/30 rounded-md">{err}</div>
          </div>
        ) : (
          <>
        {/* Sub-métricas - apenas na visão geral */}
        {!activePanel && (
          <div className="p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="p-4 bg-bg-tertiary rounded-lg text-center border border-transparent">
              <p className="text-sm text-text-secondary">Total profissionais</p>
              <p className="text-2xl font-bold text-text-primary">{busyCard==='profissionais' ? '...' : profissionaisCount}</p>
            </div>
            <div className="p-4 bg-bg-tertiary rounded-lg text-center border border-transparent">
              <p className="text-sm text-text-secondary">Profissionais atuantes</p>
              <p className="text-2xl font-bold text-text-primary">{profClickSummary ? profClickSummary.profissionaisAtuantes : recruActivated}</p>
            </div>
            <div className="p-4 bg-green-100 dark:bg-green-900/20 rounded-lg text-center border border-transparent">
              <p className="text-sm text-green-800 dark:text-green-300">Com atendimento</p>
              <p className="text-2xl font-bold text-green-800 dark:text-green-300">
                {profClickSummary ? profClickSummary.profissionaisAtuantes : recruActivated}
              </p>
            </div>
            <div className="p-4 bg-orange-100 dark:bg-orange-900/20 rounded-lg text-center border border-transparent">
              <p className="text-sm text-orange-800 dark:text-orange-300">Atenção</p>
              <p className="text-2xl font-bold text-orange-800 dark:text-orange-300">{profissionaisAtivasSemAtendimento}</p>
            </div>
          </div>
          </div>
        )}

        {/* Métricas de Atuantes */}
        {activePanel==='atuantes' && profClickSummary && (
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
              <div className="p-4 bg-accent-primary/10 rounded-lg text-center">
                <p className="text-sm text-accent-primary">Total atuantes</p>
                <p className="text-2xl font-bold text-text-primary">{profClickSummary.profissionaisAtuantes}</p>
              </div>
              <div className="p-4 bg-bg-tertiary rounded-lg text-center">
                <p className="text-sm text-text-secondary">Média de atendimentos</p>
                <p className="text-2xl font-bold text-text-primary">{profClickSummary.mediaAtendPorProfissional.toFixed(2)}</p>
              </div>
              <div className="p-4 bg-bg-tertiary rounded-lg text-center">
                <p className="text-sm text-text-secondary">Média por atendimento</p>
                <p className="text-2xl font-bold text-text-primary">{profClickSummary.mediaRepassePorAtendimento.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
              </div>
              <div className="p-4 bg-bg-tertiary rounded-lg text-center">
                <p className="text-sm text-text-secondary">Média por mês</p>
                <p className="text-2xl font-bold text-text-primary">
                  {profClickSummary.profissionaisAtuantes > 0 
                    ? (profClickSummary.totalRepasse / profClickSummary.profissionaisAtuantes).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                    : 'R$ 0,00'
                  }
                </p>
              </div>
              <div className="p-4 bg-orange-100 dark:bg-orange-900/20 rounded-lg text-center">
                <p className="text-sm text-orange-800 dark:text-orange-300">Atenção</p>
                <p className="text-2xl font-bold text-orange-800 dark:text-orange-300">{profissionaisAtivasSemAtendimento}</p>
              </div>
            </div>
          </div>
        )}

      {/* Tabela de Profissionais */}
      {activePanel === 'profissionais' && !profissionaisLoading && (
        <>
          {/* Filtros por status */}
          <div className="p-4 border-t border-border-secondary bg-bg-tertiary">
            <div className="flex w-full gap-2">
              <button
                onClick={() => setStatusTab('ativas')}
                className={`flex-1 px-4 py-2 rounded-md text-xs sm:text-sm font-medium transition text-center border ${
                  statusTab === 'ativas' 
                    ? 'bg-accent-primary text-text-on-accent border-accent-primary shadow' 
                    : 'bg-bg-tertiary text-text-secondary border-border-secondary hover:text-text-primary hover:shadow'
                }`}
              >
                Ativas ({profMetrics.ativas})
              </button>
              <button
                onClick={() => setStatusTab('inativas')}
                className={`flex-1 px-4 py-2 rounded-md text-xs sm:text-sm font-medium transition text-center border ${
                  statusTab === 'inativas' 
                    ? 'bg-accent-primary text-text-on-accent border-accent-primary shadow' 
                    : 'bg-bg-tertiary text-text-secondary border-border-secondary hover:text-text-primary hover:shadow'
                }`}
              >
                Inativas ({profMetrics.inativas})
              </button>
              <button
                onClick={() => setStatusTab('atencao')}
                className={`flex-1 px-4 py-2 rounded-md text-xs sm:text-sm font-medium transition text-center border ${
                  statusTab === 'atencao' 
                    ? 'bg-accent-primary text-text-on-accent border-accent-primary shadow' 
                    : 'bg-bg-tertiary text-text-secondary border-border-secondary hover:text-text-primary hover:shadow'
                }`}
              >
                Atenção ({profMetrics.atencao})
              </button>
              <button
                onClick={() => setStatusTab('todas')}
                className={`flex-1 px-4 py-2 rounded-md text-xs sm:text-sm font-medium transition text-center border ${
                  statusTab === 'todas' 
                    ? 'bg-accent-primary text-text-on-accent border-accent-primary shadow' 
                    : 'bg-bg-tertiary text-text-secondary border-border-secondary hover:text-text-primary hover:shadow'
                }`}
              >
                Todas ({profMetrics.total})
              </button>
              <button
                onClick={() => {
                  setSelectedProfissional(null);
                  setProfissionalModalOpen(true);
                }}
                title="Nova profissional"
                className="flex items-center justify-center px-3 py-2 rounded-md text-text-secondary bg-bg-tertiary border border-border-secondary hover:text-text-primary hover:shadow transition"
              >
                <Icon name="Plus" className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Tabela */}
          <div className="overflow-x-auto max-h-[600px] overflow-y-auto border-t border-border-secondary">
            <table className="w-full text-sm table-fixed" style={{ minWidth: '800px' }}>
              <colgroup>
                <col className="w-[8%]" />
                <col className="w-[35%]" />
                <col className="w-[22%]" />
                <col className="w-[20%]" />
                <col className="w-[15%]" />
              </colgroup>
              <thead className="sticky top-0 z-10 bg-bg-tertiary shadow-sm">
                <tr className="bg-bg-tertiary text-text-secondary">
                  <th className="px-4 py-3 text-left font-semibold">#</th>
                  <th className="px-4 py-3 text-left font-semibold">Nome</th>
                  <th className="px-4 py-3 text-center font-semibold">WhatsApp</th>
                  <th className="px-4 py-3 text-center font-semibold">Último</th>
                  <th className="px-4 py-3 text-center font-semibold">Status</th>
                </tr>
              </thead>
                <tbody>
                  {paginatedProfRows.length === 0 ? (
                    <tr>
                      <td className="px-4 py-6 text-center text-text-secondary" colSpan={5}>
                        {searchProfTerm ? 'Nenhuma profissional encontrada para a busca.' : 'Nenhuma profissional encontrada.'}
                      </td>
                    </tr>
                  ) : (
                    paginatedProfRows.map((r, idx) => {
                      const normalizedStatus = (r.status || '').toLowerCase().trim();
                      const isAtiva = normalizedStatus === 'ativa' || normalizedStatus === 'ativo';
                      const isUpdating = updatingStatusId === r.id;
                      
                      const nomeKey = (r.nome || '').toLowerCase().trim();
                      const ultimaData = lastAppointments[nomeKey];
                      const hoje = new Date();
                      let ultimoTexto = '-';
                      let ultimoClass = 'text-text-secondary';
                      
                      if (ultimaData) {
                        const dataUltimo = new Date(ultimaData);
                        const diffDias = Math.floor((hoje.getTime() - dataUltimo.getTime()) / (1000 * 60 * 60 * 24));
                        ultimoTexto = dataUltimo.toLocaleDateString('pt-BR');
                        if (diffDias > 15) {
                          ultimoClass = 'text-orange-600 font-semibold';
                        } else {
                          ultimoClass = 'text-text-primary';
                        }
                      } else if (isAtiva) {
                        ultimoTexto = 'Nunca';
                        ultimoClass = 'text-orange-600 font-semibold';
                      }
                      
                      return (
                        <tr 
                          key={r.id} 
                          className="border-t border-border-secondary hover:bg-bg-tertiary cursor-pointer"
                          onDoubleClick={() => handleRowDoubleClick(r)}
                        >
                          <td className="px-4 py-2 text-text-secondary">{profStart + idx + 1}</td>
                          <td className="px-4 py-2 font-medium text-text-primary truncate" title={r.nome || '-'}>
                            {r.nome || '-'}
                          </td>
                          <td className="px-4 py-2 text-text-secondary text-center truncate" title={r.whatsapp || '-'}>
                            {r.whatsapp || '-'}
                          </td>
                          <td className={`px-4 py-2 text-center ${ultimoClass}`}>
                            {ultimoTexto}
                          </td>
                          <td className="px-4 py-2 text-center" onClick={(e) => e.stopPropagation()}>
                            <span className={`inline-flex items-center justify-center rounded-md text-xs font-semibold px-3 h-7 tracking-wide border focus:outline-none focus:ring-2 focus:ring-offset-1 transition shadow-sm ${
                              isAtiva 
                                ? 'bg-success text-text-on-accent border-success/80' 
                                : 'bg-gray-500/10 text-gray-600 border-gray-500/30'
                            }`}>
                              {isAtiva ? 'ATIVA' : 'INATIVA'}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

          {/* Paginação */}
          {profTotalPages > 1 && (
            <div className="flex items-center justify-between p-4 border-t border-border-secondary bg-bg-secondary text-xs text-text-secondary">
              <div>Mostrando {profStart + 1} - {Math.min(profEnd, filteredProfRows.length)} de {filteredProfRows.length}</div>
              <div className="flex items-center gap-1">
                <button onClick={() => setProfCurrentPage(1)} disabled={profCurrentPage === 1} className={`px-2 py-1 rounded-md border ${profCurrentPage === 1 ? 'opacity-40 cursor-not-allowed' : 'hover:bg-bg-tertiary'}`}>«</button>
                <button onClick={() => setProfCurrentPage(profCurrentPage - 1)} disabled={profCurrentPage === 1} className={`px-2 py-1 rounded-md border ${profCurrentPage === 1 ? 'opacity-40 cursor-not-allowed' : 'hover:bg-bg-tertiary'}`}>‹</button>
                {Array.from({ length: Math.min(5, profTotalPages) }, (_, i) => {
                  const page = Math.max(1, Math.min(profCurrentPage - 2, profTotalPages - 4)) + i;
                  if (page > profTotalPages) return null;
                  return (
                    <button key={page} onClick={() => setProfCurrentPage(page)} className={`px-2 py-1 rounded-md border min-w-[32px] ${page === profCurrentPage ? 'bg-accent-primary text-white border-accent-secondary' : 'hover:bg-bg-tertiary'}`}>{page}</button>
                  );
                })}
                <button onClick={() => setProfCurrentPage(profCurrentPage + 1)} disabled={profCurrentPage === profTotalPages} className={`px-2 py-1 rounded-md border ${profCurrentPage === profTotalPages ? 'opacity-40 cursor-not-allowed' : 'hover:bg-bg-tertiary'}`}>›</button>
                <button onClick={() => setProfCurrentPage(profTotalPages)} disabled={profCurrentPage === profTotalPages} className={`px-2 py-1 rounded-md border ${profCurrentPage === profTotalPages ? 'opacity-40 cursor-not-allowed' : 'hover:bg-bg-tertiary'}`}>»</button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Ranking de Profissionais Atuantes */}
      {activePanel === 'atuantes' && ranking && ranking.length > 0 && (
        <>
          <div className="flex items-center justify-between border-t border-border-secondary p-6 pb-4">
            <h2 className="text-lg font-semibold text-text-primary">Ranking de Profissionais (mês)</h2>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-text-secondary">Ordenar por:</span>
              <button className={`px-3 py-1.5 rounded-md border transition-colors ${rankSort==='atendimentos' ? 'bg-accent-primary text-white border-transparent' : 'border-border-secondary text-text-primary hover:bg-bg-tertiary'}`} onClick={()=> setRankSort('atendimentos')}>Atendimentos</button>
              <button className={`px-3 py-1.5 rounded-md border transition-colors ${rankSort==='ganhos' ? 'bg-accent-primary text-white border-transparent' : 'border-border-secondary text-text-primary hover:bg-bg-tertiary'}`} onClick={()=> setRankSort('ganhos')}>Ganhos</button>
            </div>
          </div>
          <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
              <table className="min-w-full text-sm">
                <thead className="sticky top-0 z-10 bg-bg-tertiary shadow-sm">
                  <tr>
                    <th className="px-2 py-3 text-center text-xs font-medium text-text-secondary uppercase tracking-wider">#</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">Profissional</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-text-secondary uppercase tracking-wider">Atendimentos</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-text-secondary uppercase tracking-wider">Ganhos (Repasse)</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-text-secondary uppercase tracking-wider">Média</th>
                  </tr>
                </thead>
                <tbody>
                  {([...ranking].sort((a,b)=> rankSort==='atendimentos' ? (b.atendimentos - a.atendimentos || b.totalRepasse - a.totalRepasse) : (b.totalRepasse - a.totalRepasse || b.atendimentos - a.atendimentos))).map((r, idx) => (
                    <tr key={`${r.profissional}-${idx}`} className="hover:bg-bg-tertiary cursor-pointer transition-colors duration-150 border-t border-border-secondary" onClick={() => handleOpenAppointments(r.profissional)}>
                      <td className="px-2 py-2 text-center text-text-secondary text-xs">{idx + 1}</td>
                      <td className="px-4 py-2 text-sm font-medium text-text-primary truncate whitespace-nowrap" title={r.profissional}>{r.profissional}</td>
                      <td className="px-4 py-2 text-sm text-center text-text-primary">{r.atendimentos}</td>
                      <td className="px-4 py-2 text-sm text-center text-text-primary">{r.totalRepasse.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                      <td className="px-4 py-2 text-sm text-center text-text-primary">{(r.atendimentos ? (r.totalRepasse / r.atendimentos) : 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* Mensagem informativa */}
        {!profClickSummary && (
          <div className="p-6 text-sm text-text-secondary">
            <p>Base para métricas: profissionais, recrutadora e processed_data. Clique no card "Profissionais (ativos)" para ver médias iniciais do mês.</p>
          </div>
        )}
        </>
        )}
      </div>
    </div>
    
    <ProfessionalAppointmentsModal
      isOpen={appointmentsOpen}
      onClose={() => setAppointmentsOpen(false)}
      profissional={selectedProf}
      periodLabel={periodLabel}
      appointments={appointments}
      loading={appointmentsLoading}
    />
    <ProfissionalFormModal
      profissional={selectedProfissional}
      isOpen={profissionalModalOpen}
      onClose={() => {
        setProfissionalModalOpen(false);
        setSelectedProfissional(null);
      }}
      onSave={loadProfissionaisList}
    />
    </>
  );
};

export default PrestadorasPage;
