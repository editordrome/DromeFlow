import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAppContext } from '../../contexts/AppContext';
import { useAuth } from '../../contexts/AuthContext';
import { Icon } from '../ui/Icon';
import { countProfissionais, countRecrutadora, countProcessedDataForPeriod, getMonthlyActivitySummary, MonthlyActivitySummary, getProfessionalMonthlyStats, ProfessionalMonthlyStat, getProfessionalAppointmentsForPeriod, type ProfessionalAppointment, getRecrutadoraMonthlyMetrics, type RecrutadoraMonthlyMetrics, getProfissionaisActivatedForPeriod } from '../../services/analytics/prestadoras.service';
import ProfessionalAppointmentsModal from '../ui/ProfessionalAppointmentsModal';
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
    className={`p-6 rounded-lg shadow-md flex items-center transition-all ${
      onClick ? 'cursor-pointer' : ''
    } ${isSelected ? 'bg-accent-primary border-2 border-accent-secondary hover:shadow-lg' : 'bg-bg-secondary hover:bg-bg-tertiary hover:shadow-md'}`}
    onClick={onClick}
  >
    <div className={`w-12 h-12 rounded-full flex items-center justify-center ${iconBgColor}`}>
      <Icon name={icon} className="w-6 h-6 text-white" />
    </div>
    <div className="ml-4">
      <p className={`text-sm font-medium ${isSelected ? 'text-white' : 'text-text-secondary'}`}>{title}</p>
      <p className={`text-2xl font-bold ${isSelected ? 'text-white' : 'text-text-primary'}`}>{value}</p>
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
  const [activePanel, setActivePanel] = useState<'profissionais' | 'recrutadora' | null>(null);
  const [appointmentsOpen, setAppointmentsOpen] = useState(false);
  const [appointmentsLoading, setAppointmentsLoading] = useState(false);
  const [appointments, setAppointments] = useState<ProfessionalAppointment[]>([]);
  const [selectedProf, setSelectedProf] = useState<string | null>(null);
  const [autoLoaded, setAutoLoaded] = useState(false);

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
  const handleClickProfissionais = useCallback(async () => {
    try {
      setBusyCard('profissionais');
      const summary = await getMonthlyActivitySummary(multiUnitCodes, period);
      setProfClickSummary(summary);
      const stats = await getProfessionalMonthlyStats(multiUnitCodes, period);
      setRanking(stats);
    } catch (e) {
      // opcional: tratar erro com toast
    } finally {
      setBusyCard(null);
    }
  }, [multiUnitCodes, period]);

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

  // Recarrega automaticamente o painel de Profissionais ao mudar período/unidade quando estiver ativo
  useEffect(() => {
    if (activePanel === 'profissionais') {
      handleClickProfissionais();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, multiUnitCodes.join('|'), activePanel]);

  return (
    <>
    <div className="p-6 bg-bg-secondary rounded-lg shadow-md">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-text-primary">Prestadoras{selectedUnit && selectedUnit.unit_code !== 'ALL' ? ` - ${selectedUnit.unit_name}` : ''}</h1>
        <PeriodDropdown value={period} onChange={setPeriod} availableYears={availableYears} />
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
          <MetricCard title="Recrutadora (cadastros)" value={recruMetrics ? recruMetrics.total : recrutadoraCount} icon="KanbanSquare" iconBgColor="bg-brand-cyan" isSelected={activePanel==='recrutadora'} onClick={() => setActivePanel('recrutadora')} />
          <MetricCard title="Atendimentos (mês)" value={processedCount} icon="CalendarCheck" iconBgColor="bg-accent-primary" />
        </div>
      )}

      {activePanel==='profissionais' && profClickSummary && (
        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
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
            <div className="text-sm text-text-secondary">Profissionais atuantes no mês</div>
            <div className="text-2xl font-bold text-text-primary">{profClickSummary.profissionaisAtuantes}</div>
            <div className="text-xs text-text-secondary mt-1">Fonte: processed_data</div>
          </div>
        </div>
      )}

      {activePanel !== 'recrutadora' && ranking && ranking.length > 0 && (
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
    </>
  );
};

export default PrestadorasPage;
