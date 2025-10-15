import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAppContext } from '../../contexts/AppContext';
import { useAuth } from '../../contexts/AuthContext';
import { fetchClients, fetchClientMetricsFromProcessed, fetchAllUnitClientsWithHistory, fetchLastAttendance } from '../../services/analytics/clients.service';
import { Icon } from '../ui/Icon';
import ClientDetailModal from '../ui/ClientDetailModal';

interface ClientRow {
  id: string;
  nome: string;
  tipo: string | null;
  lastAttendance?: string | null;
  categoria?: string | null;
  monthlyCounts?: Record<string, number>;
}

type ClientMetrics = { total: number; mes: number; recorrente: number; atencao: number; outros: number; churnRatePercent: string };
type MetricKey = 'total' | 'mes' | 'recorrente' | 'atencao' | 'outros';

const metricCards: { key: MetricKey; label: string; icon: string; color: string; formatter: (v: number, m: ClientMetrics) => string }[] = [
  { key: 'total', label: 'Total', icon: 'users', color: 'bg-accent-primary', formatter: (v) => String(v) },
  { key: 'mes', label: 'Mês', icon: 'calendar', color: 'bg-blue-600', formatter: (v) => String(v) },
  { key: 'recorrente', label: 'Recorrentes', icon: 'archive', color: 'bg-purple-600', formatter: (v) => String(v) },
  { key: 'atencao', label: 'Atenção', icon: 'support', color: 'bg-amber-600', formatter: (v) => String(v) },
  { key: 'outros', label: 'Outros', icon: 'user-plus', color: 'bg-slate-600', formatter: (v) => String(v) },
];

const ClientsPage: React.FC = () => {
  const { selectedUnit } = useAppContext();
  const { userUnits } = useAuth();
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [allHistoricalClients, setAllHistoricalClients] = useState<ClientRow[]>([]); // Todos os clientes históricos
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<ClientMetrics | null>(null);
  const [atencaoList, setAtencaoList] = useState<ClientRow[]>([]);
  const [period, setPeriod] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
  });
  // Inicia com TOTAL ativo conforme solicitado
  const [activeFilter, setActiveFilter] = useState<string | null>('total');
  const [page, setPage] = useState(1);
  const pageSize = 25;
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [selectedClientName, setSelectedClientName] = useState<string | null>(null);
  const [segmentFilter, setSegmentFilter] = useState<'all' | 'pf' | 'pj'>('all');
  // Fallback de último atendimento para casos em que o match não ocorreu na carga histórica
  const [fallbackLastAttendance, setFallbackLastAttendance] = useState<Record<string, string | null>>({});
  // Filtro por status (apenas quando TOTAL estiver ativo)
  const [statusFilter, setStatusFilter] = useState<'all' | 'ativo' | 'atencao' | 'inativo'>('all');
  const [isStatusMenuOpen, setIsStatusMenuOpen] = useState(false);
  const statusMenuRef = useRef<HTMLDivElement | null>(null);

  // Normalização local (alinha com o serviço) para chavear overrides por nome
  const normalizeName = (value?: string | null) => {
    if (!value) return '';
    return value
      .toString()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\(.*?\)/g, ' ')
      .replace(/[^a-zA-Z0-9\s]/g, ' ')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
  };

  // Cálculo do status por cliente (usa período atual e última data conhecida)
  const computeStatus = useCallback((c: any): 'Ativo' | 'Atenção' | 'Inativo' => {
    const [yr, mo] = period.split('-').map((n) => parseInt(n, 10));
    const currentStart = new Date(Date.UTC(yr, mo - 1, 1));
    const currentEnd = new Date(Date.UTC(yr, mo, 0));
    const prevStart = new Date(Date.UTC(yr, mo - 2, 1));
    const prevEnd = new Date(Date.UTC(yr, mo - 1, 0));
    const overrideKey = normalizeName(c.nome);
    const chosen = c.lastAttendance ?? fallbackLastAttendance[overrideKey] ?? null;
    if (!chosen) return 'Inativo';
    const [cy, cm, cd] = chosen.split('-').map((v: string) => parseInt(v, 10));
    const last = new Date(Date.UTC(cy, cm - 1, cd || 1));
    const inRange = (d: Date, a: Date, b: Date) => d.getTime() >= a.getTime() && d.getTime() <= b.getTime();
    if (inRange(last, currentStart, currentEnd)) return 'Ativo';
    if (inRange(last, prevStart, prevEnd)) return 'Atenção';
    const diffDays = Math.floor((currentEnd.getTime() - last.getTime()) / (1000 * 60 * 60 * 24));
    return diffDays > 30 ? 'Inativo' : 'Atenção';
  }, [period, fallbackLastAttendance]);

  const resolvedList = useMemo(() => {
    if (activeFilter === 'atencao') return atencaoList;
    if (activeFilter === 'total') return allHistoricalClients;
    const base = [...clients];
    if (!activeFilter || activeFilter === 'mes') return base;
    if (activeFilter === 'recorrente') return base.filter(c => c.categoria === 'recorrente');
    if (activeFilter === 'outros') return base.filter(c => c.categoria === 'outro');
    return base;
  }, [activeFilter, atencaoList, allHistoricalClients, clients]);

  const resolvedListWithSegment = useMemo(() => {
    const matchesSegment = (tipo?: string | null) => {
      const value = (tipo || '').trim().toLowerCase();
      if (segmentFilter === 'pf') return value === 'residencial' || value === 'pf';
      if (segmentFilter === 'pj') return value === 'comercial' || value === 'pj';
      return true;
    };
    let base = resolvedList.filter(item => matchesSegment(item.tipo));
    // Filtro de status apenas quando TOTAL ativo
    if (activeFilter === 'total' && statusFilter !== 'all') {
      const toKey = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
      const target = statusFilter; // 'ativo' | 'atencao' | 'inativo'
      base = base.filter(c => {
        const s = computeStatus(c);
        const k = toKey(s).replace(/ç/g, 'c'); // atençao -> atencao
        return k === target;
      });
    }
    return base;
  }, [resolvedList, segmentFilter, activeFilter, statusFilter, computeStatus]);

  useEffect(() => {
    const load = async () => {
      if (!selectedUnit) return;
      if (selectedUnit.unit_code === 'ALL') { setClients([]); setMetrics(null); setAllHistoricalClients([]); return; }
      setIsLoading(true); setError(null);
      try {
        const [list, m, historical] = await Promise.all([
          fetchClients({ unitCode: selectedUnit.unit_code, search, period }),
          fetchClientMetricsFromProcessed(selectedUnit.unit_code, period),
          selectedUnit.id
            ? fetchAllUnitClientsWithHistory({ unitId: selectedUnit.id, unitCode: selectedUnit.unit_code, search })
            : Promise.resolve([])
        ]);
  const metaAtencao = (list as any)._atencaoSource || [];
  const filteredList = Array.isArray(list) ? list.filter((x:any) => !Array.isArray(x)) : list;
  setClients(filteredList);
  setAllHistoricalClients(historical); // Armazena clientes históricos
  // metaAtencao já são objetos completos
  setAtencaoList(metaAtencao);
        setMetrics(m);
        setPage(1); // reset página ao recarregar dados
      } catch (e:any) {
        setError('Falha ao carregar clientes');
      } finally { setIsLoading(false); }
    };
    load();
  }, [selectedUnit, search, period]);

  // Resetar página quando filtro ativo muda
  useEffect(() => { setPage(1); }, [activeFilter]);
  useEffect(() => { setPage(1); }, [segmentFilter]);
  useEffect(() => { setPage(1); }, [statusFilter]);

  // Fecha o popover de Status ao clicar fora ou pressionar Esc
  useEffect(() => {
    if (!isStatusMenuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (statusMenuRef.current && !statusMenuRef.current.contains(e.target as Node)) {
        setIsStatusMenuOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsStatusMenuOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [isStatusMenuOpen]);


  // Enriquecer a página atual com fallback do último atendimento quando TOTAL estiver ativo
  useEffect(() => {
    const run = async () => {
      if (!selectedUnit || selectedUnit.unit_code === 'ALL') return;
      if (activeFilter !== 'total') return;
      const totalRows = resolvedListWithSegment.length;
      if (totalRows === 0) return;
      const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
      const currentPage = Math.min(page, totalPages);
      const start = (currentPage - 1) * pageSize;
      const paginated = resolvedListWithSegment.slice(start, start + pageSize);
      const tasks: Promise<void>[] = [];
      const nextOverrides: Record<string, string | null> = {};
      for (const c of paginated) {
        const key = normalizeName((c as any).nome);
        // Se já temos lastAttendance (da carga histórica) ou já há override, pula
        if ((c as any).lastAttendance) continue;
        if (fallbackLastAttendance[key] !== undefined) continue;
        tasks.push(
          (async () => {
            const dt = await fetchLastAttendance(selectedUnit.unit_code, (c as any).nome);
            nextOverrides[key] = dt;
          })()
        );
      }
      if (tasks.length === 0) return;
      try {
        await Promise.all(tasks);
        if (Object.keys(nextOverrides).length > 0) {
          setFallbackLastAttendance(prev => ({ ...prev, ...nextOverrides }));
        }
      } catch {
        // silencioso
      }
    };
    run();
  }, [activeFilter, page, pageSize, resolvedListWithSegment, selectedUnit]);

  if (!selectedUnit) {
    return <div className="p-4 text-text-secondary">Selecione uma unidade para ver clientes.</div>;
  }
  if (selectedUnit.unit_code === 'ALL') {
    return <div className="p-4 text-text-secondary">Visualização multi-unidade para clientes ainda não implementada.</div>;
  }

  return (
  <div className="p-6 bg-bg-secondary rounded-lg shadow-md space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold text-text-primary">Clientes{selectedUnit.unit_code !== 'ALL' ? ` - ${selectedUnit.unit_name}` : ''}</h1>
        <div className="flex items-center gap-3">
          <div className="min-w-[190px]"><PeriodDropdown value={period} onChange={setPeriod} /></div>
          <input
            type="text"
            className="px-3 py-2 rounded-md bg-bg-tertiary text-sm focus:outline-none focus:ring-2 focus:ring-accent-primary w-48"
            placeholder="Buscar..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {metrics && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {metricCards.map(cfg => (
            <button
              key={cfg.key}
              type="button"
              onClick={() => setActiveFilter(prev => prev === cfg.key ? null : cfg.key)}
              className={`p-3 rounded-lg shadow-sm flex items-center transition-all group border ${activeFilter === cfg.key ? 'bg-accent-primary border-accent-secondary' : 'bg-bg-secondary hover:bg-bg-tertiary border-transparent'}`}
            >
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${cfg.color} text-white group-hover:scale-105 transition-transform ${activeFilter === cfg.key ? 'ring-2 ring-white/40' : ''}`}>
                <Icon name={cfg.icon} className="w-5 h-5" />
              </div>
              <div className="ml-4 text-left">
                <p className={`text-[0.7rem] font-medium uppercase tracking-wide ${activeFilter === cfg.key ? 'text-white' : 'text-text-secondary'}`}>{cfg.label}</p>
                <p className={`text-xl font-bold ${activeFilter === cfg.key ? 'text-white' : 'text-text-primary'}`}>
                  {cfg.formatter((metrics as ClientMetrics)[cfg.key], metrics as ClientMetrics)}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}

      {isLoading && <div>Carregando...</div>}
      {error && <div className="text-danger">{error}</div>}

      {!isLoading && !error && (
        <>
        <div className="rounded-lg shadow-md overflow-hidden">
          {/* Cabeçalho das abas e filtros no padrão do Agendamentos */}
          <div className="p-4 border-b border-border-secondary bg-bg-tertiary">
            <div className="flex w-full gap-2">
              {([
                { key: 'all', label: 'Total' },
                { key: 'pf', label: 'PF' },
                { key: 'pj', label: 'PJ' },
              ] as const).map(tab => {
                const isActive = segmentFilter === tab.key;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setSegmentFilter(tab.key)}
                    aria-pressed={isActive}
                    className={`flex-1 px-4 py-2 rounded-md text-xs sm:text-sm font-medium transition text-center truncate border ${
                      isActive
                        ? 'bg-accent-primary text-text-on-accent border-accent-primary shadow'
                        : 'bg-bg-tertiary text-text-secondary border-border-secondary hover:text-text-primary hover:shadow'
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="overflow-auto">
          <table className="min-w-full text-sm">
            {activeFilter !== 'atencao' && (
              <colgroup>
                <col className="w-[45%]" />
                <col className="w-24" />
                <col className="w-32" />
                {/* Status apenas no TOTAL */}
                {activeFilter === 'total' && <col className="w-32" />}
              </colgroup>
            )}
            <thead className="bg-bg-tertiary text-text-secondary">
              <tr>
                <th className="px-4 py-3 text-left">Nome</th>
                {activeFilter === 'atencao' ? (
                  <>
                    <th className="px-4 py-3 text-center">Tipo</th>
                    {/* Cabeçalhos dinâmicos: últimos 3 meses (M, M-1, M-2) com rótulo pt-BR */}
                    {(() => {
                      const sample = atencaoList[0];
                      const keys = sample?.monthlyCounts ? Object.keys(sample.monthlyCounts) : [];
                      // Ordena descendente para mostrar M, M-1, M-2
                      keys.sort().reverse();
                      const months = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
                      const fmt = (k: string) => {
                        const [y, m] = k.split('-');
                        const idx = Math.max(1, Math.min(12, parseInt(m, 10))) - 1;
                        return `${months[idx]}/${y}`;
                      };
                      return keys.map(k => (
                        <th key={k} className="px-4 py-3 text-center">{fmt(k)}</th>
                      ));
                    })()}
                  </>
                ) : (
                  <>
                    <th className="px-4 py-3 text-center">Tipo</th>
                    <th className="px-4 py-3 text-center">Último Atendimento</th>
                    {activeFilter === 'total' && (
                      <th className="px-4 py-3 text-center">
                        <div className="inline-flex items-center gap-2 relative" ref={statusMenuRef}>
                          <span>Status</span>
                          <button
                            type="button"
                            aria-label="Filtrar status"
                            aria-expanded={isStatusMenuOpen}
                            onClick={() => setIsStatusMenuOpen((v) => !v)}
                            className={`p-1 rounded hover:bg-bg-secondary border border-transparent ${statusFilter !== 'all' ? 'text-text-primary' : 'text-text-secondary'}`}
                          >
                            <Icon name="ChevronDown" className="w-4 h-4" />
                          </button>
                          {isStatusMenuOpen && (
                            <div className="absolute right-0 top-full mt-2 z-20 w-40 rounded-md border border-border-secondary bg-bg-secondary shadow-lg">
                              {([
                                { v: 'all', l: 'Todos' },
                                { v: 'ativo', l: 'Ativo' },
                                { v: 'atencao', l: 'Atenção' },
                                { v: 'inativo', l: 'Inativo' },
                              ] as const).map(opt => (
                                <button
                                  key={opt.v}
                                  className={`block w-full text-left px-3 py-2 text-xs sm:text-sm hover:bg-bg-tertiary ${statusFilter === opt.v ? 'bg-accent-primary text-text-on-accent' : 'text-text-primary'}`}
                                  onClick={() => { setStatusFilter(opt.v as any); setIsStatusMenuOpen(false); }}
                                >
                                  {opt.l}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </th>
                    )}
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {(() => {
                const totalRows = resolvedListWithSegment.length;
                if (totalRows === 0) {
                  return (
                    <tr>
                      <td colSpan={100} className="px-4 py-6 text-center text-text-secondary">
                        Nenhum cliente encontrado.
                      </td>
                    </tr>
                  );
                }
                const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
                const currentPage = Math.min(page, totalPages);
                const start = (currentPage - 1) * pageSize;
                const paginated = resolvedListWithSegment.slice(start, start + pageSize);
                return paginated.map((c:any, idx:number) => (
                  <tr
                    key={c.id}
                    className="hover:bg-bg-tertiary cursor-pointer transition-colors duration-150 border-t border-border-secondary"
                    onDoubleClick={() => { setSelectedClientName(c.nome); setIsClientModalOpen(true); }}
                  >
                    <td className="px-4 py-2 font-medium text-text-primary truncate whitespace-nowrap" title={c.nome}>{c.nome}</td>
                    {activeFilter === 'atencao' ? (
                      <>
                        <td className="px-4 py-2 text-center">{c.tipo || '-'}</td>
                        {(() => {
                          const keys = c.monthlyCounts ? Object.keys(c.monthlyCounts).sort().reverse() : [];
                          return keys.map((k:string) => (
                            <td key={k} className="px-4 py-2 text-center">{c.monthlyCounts[k]}</td>
                          ));
                        })()}
                      </>
                    ) : (
                      <>
                        <td className="px-4 py-2 text-center">{c.tipo || '-'}</td>
                        <td className="px-4 py-2 text-center">{(() => {
                          const overrideKey = normalizeName(c.nome);
                          const chosen = c.lastAttendance ?? fallbackLastAttendance[overrideKey] ?? null;
                          return chosen ? new Date(chosen + 'T00:00:00').toLocaleDateString('pt-BR') : '-';
                        })()}</td>
                        {activeFilter === 'total' && (
                          <td className="px-4 py-2 text-center">
                            {(() => {
                              const status = computeStatus(c);
                              const styles = {
                                'Ativo': 'bg-green-500/10 text-green-600 border-green-500/30',
                                'Atenção': 'bg-yellow-500/10 text-yellow-600 border-yellow-500/30',
                                'Inativo': 'bg-gray-500/10 text-gray-600 border-gray-500/30'
                              };
                              return (
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${styles[status as keyof typeof styles] || ''}`}>
                                  {status}
                                </span>
                              );
                            })()}
                          </td>
                        )}
                      </>
                    )}
                  </tr>
                ));
              })()}
            </tbody>
          </table>
          </div>
        </div>
        {/* Paginação */}
        <Pagination
          page={page}
          onChange={setPage}
          totalItems={resolvedListWithSegment.length}
          pageSize={pageSize}
        />
        </>
      )}
      <ClientDetailModal
        isOpen={isClientModalOpen}
        onClose={() => setIsClientModalOpen(false)}
        clientName={selectedClientName}
        unitId={(selectedUnit as any).id}
        unitCode={selectedUnit.unit_code}
        currentPeriod={period}
      />
    </div>
  );
};

export default ClientsPage;

// Componente local PeriodDropdown (alinhado ao dashboard) - versão compacta
const PeriodDropdown: React.FC<{ value: string; onChange: (v: string) => void; disabled?: boolean }> = ({ value, onChange, disabled }) => {
  const [open, setOpen] = useState(false);
  const currentYear = new Date().getFullYear();
  const years = [currentYear, currentYear - 1, currentYear - 2];
  const months = [
    { value: '01', label: 'Janeiro' }, { value: '02', label: 'Fevereiro' }, { value: '03', label: 'Março' },
    { value: '04', label: 'Abril' }, { value: '05', label: 'Maio' }, { value: '06', label: 'Junho' },
    { value: '07', label: 'Julho' }, { value: '08', label: 'Agosto' }, { value: '09', label: 'Setembro' },
    { value: '10', label: 'Outubro' }, { value: '11', label: 'Novembro' }, { value: '12', label: 'Dezembro' }
  ];
  const options: { value: string; label: string }[] = [];
  years.forEach(y => months.forEach(m => options.push({ value: `${y}-${m.value}`, label: `${m.label} ${y}` })));
  const label = (() => {
    const [y, m] = value.split('-');
    const found = months.find(mm => mm.value === m);
    return found ? `${found.label} ${y}` : value;
  })();
  return (
    <div className="relative text-xs">
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen(o => !o)}
        className="px-2 py-1 w-48 bg-bg-tertiary rounded-md border border-border-secondary flex items-center justify-between hover:bg-bg-secondary"
      >
        <span className="truncate text-text-primary">{label}</span>
        <span className="text-text-secondary">{open ? '▲' : '▼'}</span>
      </button>
      {open && !disabled && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute z-20 mt-1 w-60 max-h-64 overflow-y-auto bg-bg-secondary border border-border-secondary rounded-md shadow-lg">
            {options.map(o => (
              <button
                key={o.value}
                onClick={() => { onChange(o.value); setOpen(false); }}
                className={`block w-full text-left px-3 py-2 hover:bg-bg-tertiary ${o.value === value ? 'bg-accent-primary text-white' : 'text-text-primary'}`}
              >{o.label}</button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

// Componente simples de paginação local
const Pagination: React.FC<{ page: number; onChange: (p:number)=>void; totalItems: number; pageSize: number }> = ({ page, onChange, totalItems, pageSize }) => {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  if (totalPages <= 1) return null;
  const go = (p:number) => { if (p>=1 && p<= totalPages) onChange(p); };
  const windowSize = 5;
  let start = Math.max(1, page - Math.floor(windowSize/2));
  let end = start + windowSize - 1;
  if (end > totalPages) { end = totalPages; start = Math.max(1, end - windowSize + 1); }
  const pages = [] as number[];
  for (let i=start; i<=end; i++) pages.push(i);
  return (
    <div className="flex items-center justify-between mt-4 text-xs text-text-secondary">
      <div>Mostrando {(page-1)*pageSize + 1} - {Math.min(page*pageSize, totalItems)} de {totalItems}</div>
      <div className="flex items-center gap-1">
        <button onClick={() => go(1)} disabled={page===1} className={`px-2 py-1 rounded-md border ${page===1?'opacity-40 cursor-not-allowed':'hover:bg-bg-tertiary'}`}>«</button>
        <button onClick={() => go(page-1)} disabled={page===1} className={`px-2 py-1 rounded-md border ${page===1?'opacity-40 cursor-not-allowed':'hover:bg-bg-tertiary'}`}>‹</button>
        {pages.map(p => (
          <button key={p} onClick={()=>go(p)} className={`px-2 py-1 rounded-md border min-w-[32px] ${p===page ? 'bg-accent-primary text-white border-accent-secondary' : 'hover:bg-bg-tertiary'}`}>{p}</button>
        ))}
        <button onClick={() => go(page+1)} disabled={page===totalPages} className={`px-2 py-1 rounded-md border ${page===totalPages?'opacity-40 cursor-not-allowed':'hover:bg-bg-tertiary'}`}>›</button>
        <button onClick={() => go(totalPages)} disabled={page===totalPages} className={`px-2 py-1 rounded-md border ${page===totalPages?'opacity-40 cursor-not-allowed':'hover:bg-bg-tertiary'}`}>»</button>
      </div>
    </div>
  );
};
