import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAppContext } from '../../contexts/AppContext';
import { useAuth } from '../../contexts/AuthContext';
import { Icon } from '../ui/Icon';
import { countProfissionais, countRecrutadora, countProcessedDataForPeriod, getMonthlyActivitySummary, MonthlyActivitySummary, getProfessionalMonthlyStats, ProfessionalMonthlyStat, getProfessionalAppointmentsForPeriod, type ProfessionalAppointment, getRecrutadoraMonthlyMetrics, type RecrutadoraMonthlyMetrics, getProfissionaisActivatedForPeriod, getLastAppointmentByProfessional } from '../../services/analytics/prestadoras.service';
import { fetchProfissionais, updateProfissionalStatus, Profissional } from '../../services/profissionais/profissionais.service';
import ProfessionalAppointmentsModal from '../ui/ProfessionalAppointmentsModal';
import ProfissionalDetailModal from '../ui/ProfissionalDetailModal';
import { fetchAvailableYearsFromProcessedData } from '../../services/data/dataTable.service';

const MetricCard: React.FC<{
  title: string;
  value: string | number;
  icon: string;
  iconBgColor: string;
  isSelected?: boolean;
  onClick?: () => void;
}> = ({ title, value, icon, iconBgColor, isSelected = false, onClick }) => (
  <div 
    className={`p-3 rounded-lg border transition-all ${
      onClick ? 'cursor-pointer' : ''
    } ${
      isSelected 
        ? `${iconBgColor} text-white border-transparent shadow-lg` 
        : 'bg-bg-secondary border-border-primary hover:shadow-md'
    }`}
    onClick={onClick}
  >
    <div className="flex items-center justify-center gap-3">
      <Icon name={icon} className="w-6 h-6" />
      <span className={`text-2xl font-bold ${isSelected ? 'text-white' : 'text-text-primary'}`}>
        {value}
      </span>
    </div>
  </div>
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
  const [activePanel, setActivePanel] = useState<'profissionais' | 'recrutadora' | 'atuantes' | null>(null);
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

  // Cálculo de profissionais ativas sem atendimento no mês
  const profissionaisAtivasSemAtendimento = useMemo(() => {
    if (!profClickSummary || !ranking) return 0;
    
    // Profissionais que atenderam no mês (do ranking)
    const profissionaisQueAtenderam = new Set(ranking.map(r => r.profissional.toLowerCase().trim()));
    
    // Filtrar profissionais ativas
    const ativas = profissionaisList.filter(p => {
      const status = (p.status || '').toLowerCase().trim();
      return status === 'ativa' || status === 'ativo';
    });
    
    // Contar quantas ativas não aparecem no ranking
    const semAtendimento = ativas.filter(p => {
      const nome = (p.nome || '').toLowerCase().trim();
      return !profissionaisQueAtenderam.has(nome);
    });
    
    return semAtendimento.length;
  }, [profClickSummary, ranking, profissionaisList]);

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
    
    // Calcular profissionais com mais de 15 dias sem atendimento
    const hoje = new Date();
    const atencao = profissionaisList.filter(r => {
      const status = normalizeStatus(r.status);
      if (status !== 'ativa' && status !== 'ativo') return false;
      
      const nomeKey = (r.nome || '').toLowerCase().trim();
      const ultimaData = lastAppointments[nomeKey];
      
      if (!ultimaData) return true; // Nunca atendeu
      
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
      return profissionaisList.filter(r => {
        const status = normalizeStatus(r.status);
        if (status !== 'ativa' && status !== 'ativo') return false;
        
        const nomeKey = (r.nome || '').toLowerCase().trim();
        const ultimaData = lastAppointments[nomeKey];
        
        if (!ultimaData) return true; // Nunca atendeu
        
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
    <div className="p-6 bg-bg-secondary rounded-lg shadow-md">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-text-primary">
          Prestadoras - {
            activePanel === 'profissionais' ? 'Profissionais' :
            activePanel === 'recrutadora' ? 'Recrutadora' :
            activePanel === 'atuantes' ? 'Profissionais Atuantes' :
            'Visão Geral'
          }
        </h1>
        <div className="flex items-center gap-2">
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
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-12 h-12 border-4 border-t-4 border-gray-200 rounded-full animate-spin border-t-accent-primary"></div>
        </div>
      ) : err ? (
        <div className="p-4 text-danger bg-danger/10 border border-danger/30 rounded-md">{err}</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <MetricCard title="Profissionais (ativos)" value={busyCard==='profissionais' ? '...' : profissionaisCount} icon="Users" iconBgColor="bg-brand-green" isSelected={activePanel==='profissionais'} onClick={() => { setActivePanel('profissionais'); handleClickProfissionais(); }} />
          <MetricCard title="Profissionais atuantes (mês)" value={profClickSummary ? profClickSummary.profissionaisAtuantes : recruActivated} icon="UserCheck" iconBgColor="bg-accent-primary" isSelected={activePanel==='atuantes'} onClick={() => { setActivePanel('atuantes'); handleClickProfissionais(); }} />
          <MetricCard title="Recrutadora (cadastros)" value={recruMetrics ? recruMetrics.total : recrutadoraCount} icon="KanbanSquare" iconBgColor="bg-brand-cyan" isSelected={activePanel==='recrutadora'} onClick={() => setActivePanel('recrutadora')} />
        </div>
      )}

      {activePanel==='atuantes' && profClickSummary && (
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 bg-bg-tertiary rounded-lg shadow-sm">
            <div className="text-sm text-text-secondary">Média de atendimentos por profissional</div>
            <div className="text-2xl font-bold text-text-primary">{profClickSummary.mediaAtendPorProfissional.toFixed(2)}</div>
            <div className="text-xs text-text-secondary mt-1">{profClickSummary.atendimentos} atend. / {profClickSummary.profissionaisAtuantes} profs.</div>
          </div>
          <div className="p-4 bg-bg-tertiary rounded-lg shadow-sm">
            <div className="text-sm text-text-secondary">Média de ganhos por atendimento</div>
            <div className="text-2xl font-bold text-text-primary">{profClickSummary.mediaRepassePorAtendimento.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
            <div className="text-xs text-text-secondary mt-1">Total repasse: {profClickSummary.totalRepasse.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
          </div>
          <div className="p-4 bg-bg-tertiary rounded-lg shadow-sm">
            <div className="text-sm text-text-secondary">Média de ganhos por mês</div>
            <div className="text-2xl font-bold text-text-primary">
              {profClickSummary.profissionaisAtuantes > 0 
                ? (profClickSummary.totalRepasse / profClickSummary.profissionaisAtuantes).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                : 'R$ 0,00'
              }
            </div>
            <div className="text-xs text-text-secondary mt-1">Por profissional atuante</div>
          </div>
          <div className="p-4 bg-orange-100 dark:bg-orange-900/20 border border-orange-300 dark:border-orange-800 rounded-lg shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <Icon name="AlertTriangle" className="w-5 h-5 text-orange-600 dark:text-orange-400" />
              <div className="text-sm font-medium text-orange-800 dark:text-orange-300">Atenção</div>
            </div>
            <div className="text-2xl font-bold text-orange-800 dark:text-orange-300">{profissionaisAtivasSemAtendimento}</div>
            <div className="text-xs text-orange-700 dark:text-orange-400 mt-1">Profissionais ativas sem atendimento no mês</div>
          </div>
        </div>
      )}

      {activePanel === 'profissionais' && !profissionaisLoading && (
        <div className="mt-6">
          {/* Filtros por status */}
          <div className="p-4 border-b border-border-secondary bg-bg-tertiary">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setStatusTab('todas')}
                  className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                    statusTab === 'todas' ? 'bg-accent-primary text-white' : 'text-text-secondary hover:bg-bg-secondary'
                  }`}
                >
                  Todas ({profMetrics.total})
                </button>
                <button
                  onClick={() => setStatusTab('ativas')}
                  className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                    statusTab === 'ativas' ? 'bg-accent-primary text-white' : 'text-text-secondary hover:bg-bg-secondary'
                  }`}
                >
                  Ativas ({profMetrics.ativas})
                </button>
                <button
                  onClick={() => setStatusTab('inativas')}
                  className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                    statusTab === 'inativas' ? 'bg-accent-primary text-white' : 'text-text-secondary hover:bg-bg-secondary'
                  }`}
                >
                  Inativas ({profMetrics.inativas})
                </button>
                <button
                  onClick={() => setStatusTab('atencao')}
                  className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                    statusTab === 'atencao' ? 'bg-orange-500 text-white' : 'text-text-secondary hover:bg-bg-secondary'
                  }`}
                >
                  <div className="flex items-center gap-1">
                    <Icon name="AlertTriangle" className="w-4 h-4" />
                    <span>Atenção ({profMetrics.atencao})</span>
                  </div>
                </button>
              </div>
              <button
                onClick={() => {
                  setSelectedProfissional(null);
                  setProfissionalModalOpen(true);
                }}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-accent-primary rounded-md hover:bg-accent-primary/90 transition-colors"
              >
                <Icon name="Plus" className="w-4 h-4" />
                <span>Nova profissional</span>
              </button>
            </div>
          </div>

          {/* Tabela */}
          <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
            <table className="min-w-full text-sm">
              <colgroup>
                <col style={{ width: '35%' }} />
                <col style={{ width: '25%' }} />
                <col style={{ width: '20%' }} />
                <col style={{ width: '20%' }} />
              </colgroup>
              <thead className="sticky top-0 z-10 bg-bg-tertiary text-text-secondary shadow-sm">
                <tr>
                  <th className="px-6 py-3 text-left font-semibold">Nome</th>
                  <th className="px-6 py-3 text-left font-semibold">WhatsApp</th>
                  <th className="px-6 py-3 text-center font-semibold">Último</th>
                  <th className="px-6 py-3 text-center font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {paginatedProfRows.length === 0 ? (
                  <tr>
                    <td className="px-6 py-10 text-center text-text-secondary" colSpan={4}>
                      {searchProfTerm ? 'Nenhuma profissional encontrada para a busca.' : 'Nenhuma profissional encontrada.'}
                    </td>
                  </tr>
                ) : (
                  paginatedProfRows.map((r) => {
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
                        <td className="px-6 py-3 text-text-primary">
                          {r.nome || '-'}
                        </td>
                        <td className="px-6 py-3 text-text-primary">
                          {r.whatsapp || '-'}
                        </td>
                        <td className={`px-6 py-3 text-center ${ultimoClass}`}>
                          {ultimoTexto}
                        </td>
                        <td className="px-6 py-3" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-center gap-3">
                            <span className={`text-xs font-medium ${isAtiva ? 'text-green-600' : 'text-red-600'}`}>
                              {isAtiva ? 'Ativa' : 'Inativa'}
                            </span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleToggleStatus(r);
                              }}
                              disabled={isUpdating}
                              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-accent-primary focus:ring-offset-2 ${
                                isUpdating ? 'opacity-50 cursor-wait' : 'cursor-pointer'
                              } ${isAtiva ? 'bg-green-500' : 'bg-gray-400'}`}
                              title={isAtiva ? 'Clique para inativar' : 'Clique para ativar'}
                              role="switch"
                              aria-checked={isAtiva}
                            >
                              {isUpdating ? (
                                <span className="absolute inset-0 flex items-center justify-center">
                                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                </span>
                              ) : (
                                <span
                                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                    isAtiva ? 'translate-x-6' : 'translate-x-1'
                                  }`}
                                />
                              )}
                            </button>
                          </div>
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
            <div className="flex items-center justify-between mt-4 text-xs text-text-secondary">
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
        </div>
      )}

      {activePanel === 'atuantes' && ranking && ranking.length > 0 && (
        <div className="mt-6">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-semibold text-text-primary">Ranking de Profissionais (mês)</h2>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-text-secondary">Ordenar por:</span>
              <button className={`px-2 py-1 rounded border ${rankSort==='atendimentos' ? 'bg-accent-primary text-white border-transparent' : 'border-border-secondary text-text-primary hover:bg-bg-tertiary'}`} onClick={()=> setRankSort('atendimentos')}>Atendimentos</button>
              <button className={`px-2 py-1 rounded border ${rankSort==='ganhos' ? 'bg-accent-primary text-white border-transparent' : 'border-border-secondary text-text-primary hover:bg-bg-tertiary'}`} onClick={()=> setRankSort('ganhos')}>Ganhos</button>
            </div>
          </div>
          <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
            <table className="min-w-full divide-y divide-border-primary">
              <thead className="sticky top-0 z-10 bg-bg-tertiary shadow-sm">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-text-secondary uppercase">#</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-text-secondary uppercase">Profissional</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-text-secondary uppercase">Atendimentos</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-text-secondary uppercase">Ganhos (Repasse)</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-text-secondary uppercase">Média</th>
                </tr>
              </thead>
              <tbody className="bg-bg-secondary divide-y divide-border-primary">
                {([...ranking].sort((a,b)=> rankSort==='atendimentos' ? (b.atendimentos - a.atendimentos || b.totalRepasse - a.totalRepasse) : (b.totalRepasse - a.totalRepasse || b.atendimentos - a.atendimentos))).map((r, idx) => (
                  <tr key={`${r.profissional}-${idx}`} className="hover:bg-bg-tertiary/60 cursor-pointer" onClick={() => handleOpenAppointments(r.profissional)}>
                    <td className="px-4 py-2 text-sm text-text-secondary">{idx + 1}</td>
                    <td className="px-4 py-2 text-sm text-text-primary">{r.profissional}</td>
                    <td className="px-4 py-2 text-sm text-text-primary">{r.atendimentos}</td>
                    <td className="px-4 py-2 text-sm text-text-primary">{r.totalRepasse.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                    <td className="px-4 py-2 text-sm text-text-primary">{(r.atendimentos ? (r.totalRepasse / r.atendimentos) : 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!profClickSummary && (
        <div className="mt-6 text-sm text-text-secondary">
          <p>Base para métricas: profissionais, recrutadora e processed_data. Clique no card “Profissionais (ativos)” para ver médias iniciais do mês.</p>
        </div>
      )}
    </div>
    {activePanel==='recrutadora' && recruMetrics && (
      <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="p-4 bg-bg-tertiary rounded-lg shadow-sm">
          <div className="text-sm text-text-secondary">Cadastros no mês</div>
          <div className="text-2xl font-bold text-text-primary">{recruMetrics.total}</div>
          <div className="text-xs text-text-secondary mt-1">Período: {periodLabel}</div>
        </div>
        <div className="p-4 bg-bg-tertiary rounded-lg shadow-sm">
          <div className="text-sm text-text-secondary">Qualificadas</div>
          <div className="text-2xl font-bold text-text-primary">{recruMetrics.qualificadas}</div>
          <div className="text-xs text-text-secondary mt-1">Status: qualificadas</div>
        </div>
        <div className="p-4 bg-bg-tertiary rounded-lg shadow-sm">
          <div className="text-sm text-text-secondary">Não aprovadas</div>
          <div className="text-2xl font-bold text-text-primary">{recruMetrics.naoAprovadas}</div>
          <div className="text-xs text-text-secondary mt-1">Status: nao_aprovadas</div>
        </div>
        <div className="p-4 bg-bg-tertiary rounded-lg shadow-sm">
          <div className="text-sm text-text-secondary">Desistentes</div>
          <div className="text-2xl font-bold text-text-primary">{recruMetrics.desistentes}</div>
          <div className="text-xs text-text-secondary mt-1">Status: desistentes</div>
        </div>
        <div className="p-4 bg-bg-tertiary rounded-lg shadow-sm md:col-span-4">
          <div className="text-sm text-text-secondary">Ativadas no mês (profissionais)</div>
          <div className="text-2xl font-bold text-text-primary">{recruActivated}</div>
          <div className="text-xs text-text-secondary mt-1">Origem: tabela profissionais (status contendo "ativo")</div>
        </div>
      </div>
    )}
    <ProfessionalAppointmentsModal
      isOpen={appointmentsOpen}
      onClose={() => setAppointmentsOpen(false)}
      profissional={selectedProf}
      periodLabel={periodLabel}
      appointments={appointments}
      loading={appointmentsLoading}
    />
    <ProfissionalDetailModal
      profissional={selectedProfissional}
      isOpen={profissionalModalOpen}
      onClose={() => {
        setProfissionalModalOpen(false);
        setSelectedProfissional(null);
      }}
      onUpdate={loadProfissionaisList}
    />
    </>
  );
};

export default PrestadorasPage;
