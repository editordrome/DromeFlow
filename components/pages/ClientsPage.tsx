import React, { useEffect, useState } from 'react';
import { useAppContext } from '../../contexts/AppContext';
import { useAuth } from '../../contexts/AuthContext';
import { fetchClients, fetchClientMetricsFromProcessed } from '../../services/analytics/clients.service';
import { Icon } from '../ui/Icon';

interface ClientRow {
  id: string;
  nome: string;
  tipo: string | null;
  lastAttendance?: string | null;
  categoria?: string | null;
  monthlyCounts?: Record<string, number>;
}

type ClientMetrics = { total: number; recorrente: number; atencao: number; outros: number; churnRatePercent: string };
type MetricKey = 'total' | 'recorrente' | 'atencao' | 'outros';

const metricCards: { key: MetricKey; label: string; icon: string; color: string; formatter: (v: number, m: ClientMetrics) => string }[] = [
  { key: 'total', label: 'Total', icon: 'users', color: 'bg-accent-primary', formatter: (v) => String(v) },
  { key: 'recorrente', label: 'Recorrentes', icon: 'archive', color: 'bg-purple-600', formatter: (v) => String(v) },
  { key: 'atencao', label: 'Atenção', icon: 'support', color: 'bg-amber-600', formatter: (v) => String(v) },
  { key: 'outros', label: 'Outros', icon: 'user-plus', color: 'bg-slate-600', formatter: (v) => String(v) },
];

const ClientsPage: React.FC = () => {
  const { selectedUnit } = useAppContext();
  const { userUnits } = useAuth();
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<ClientMetrics | null>(null);
  const [atencaoList, setAtencaoList] = useState<ClientRow[]>([]);
  const [period, setPeriod] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
  });
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const pageSize = 25;

  useEffect(() => {
    const load = async () => {
      if (!selectedUnit) return;
      if (selectedUnit.unit_code === 'ALL') { setClients([]); setMetrics(null); return; }
      setIsLoading(true); setError(null);
      try {
        const [list, m] = await Promise.all([
          fetchClients({ unitCode: selectedUnit.unit_code, search, period }),
          fetchClientMetricsFromProcessed(selectedUnit.unit_code, period)
        ]);
  const metaAtencao = (list as any)._atencaoSource || [];
  const filteredList = Array.isArray(list) ? list.filter((x:any) => !Array.isArray(x)) : list;
  setClients(filteredList);
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

  if (!selectedUnit) {
    return <div className="p-4 text-text-secondary">Selecione uma unidade para ver clientes.</div>;
  }
  if (selectedUnit.unit_code === 'ALL') {
    return <div className="p-4 text-text-secondary">Visualização multi-unidade para clientes ainda não implementada.</div>;
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold text-text-primary">Clientes - {selectedUnit.unit_name}</h1>
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {metricCards.map(cfg => (
            <button
              key={cfg.key}
              type="button"
              onClick={() => setActiveFilter(prev => prev === cfg.key ? null : cfg.key)}
              className={`p-5 rounded-lg shadow-md flex items-center transition-all group border ${activeFilter === cfg.key ? 'bg-accent-primary border-accent-secondary' : 'bg-bg-secondary hover:bg-bg-tertiary border-transparent'}`}
            >
              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${cfg.color} text-white group-hover:scale-105 transition-transform ${activeFilter === cfg.key ? 'ring-2 ring-white/40' : ''}`}>
                <Icon name={cfg.icon} className="w-6 h-6" />
              </div>
              <div className="ml-4 text-left">
                <p className={`text-xs font-medium uppercase tracking-wide ${activeFilter === cfg.key ? 'text-white' : 'text-text-secondary'}`}>{cfg.label}</p>
                <p className={`text-2xl font-bold ${activeFilter === cfg.key ? 'text-white' : 'text-text-primary'}`}>
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
        <div className="overflow-auto border border-white/10 rounded-md">
          <table className="min-w-full text-sm">
            <thead className="bg-bg-tertiary text-text-secondary">
              <tr>
                <th className="px-2 py-2 text-left w-12">#</th>
                <th className="px-3 py-2 text-left">Nome</th>
                {activeFilter === 'atencao' ? (
                  <>
                    <th className="px-3 py-2 text-left">Tipo</th>
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
                        <th key={k} className="px-3 py-2 text-left">{fmt(k)}</th>
                      ));
                    })()}
                  </>
                ) : (
                  <>
                    <th className="px-3 py-2 text-left">Tipo</th>
                    <th className="px-3 py-2 text-left">Último Atendimento</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {clients.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-3 py-4 text-center text-text-secondary">Nenhum cliente encontrado.</td>
                </tr>
              )}
              {(() => {
                const base = (activeFilter === 'atencao'
                  ? atencaoList
                  : clients.filter(c => {
                      if (!activeFilter || activeFilter === 'total') return true;
                      if (activeFilter === 'recorrente') return c.categoria === 'recorrente';
                      if (activeFilter === 'outros') return c.categoria === 'outro';
                      return true;
                    })
                );
                const totalRows = base.length;
                const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
                const currentPage = Math.min(page, totalPages);
                const start = (currentPage - 1) * pageSize;
                const paginated = base.slice(start, start + pageSize);
                return paginated.map((c:any, idx:number) => (
                  <tr key={c.id} className="border-t border-white/5 hover:bg-white/5">
                    <td className="px-2 py-2 text-text-secondary">{start + idx + 1}</td>
                    <td className="px-3 py-2 font-medium text-text-primary">{c.nome}</td>
                    {activeFilter === 'atencao' ? (
                      <>
                        <td className="px-3 py-2">{c.tipo || '-'}</td>
                        {(() => {
                          const keys = c.monthlyCounts ? Object.keys(c.monthlyCounts).sort().reverse() : [];
                          return keys.map((k:string) => (
                            <td key={k} className="px-3 py-2">{c.monthlyCounts[k]}</td>
                          ));
                        })()}
                      </>
                    ) : (
                      <>
                        <td className="px-3 py-2">{c.tipo || '-'}</td>
                        <td className="px-3 py-2">{c.lastAttendance ? new Date(c.lastAttendance + 'T00:00:00').toLocaleDateString('pt-BR') : '-'}</td>
                      </>
                    )}
                  </tr>
                ));
              })()}
            </tbody>
          </table>
        </div>
        {/* Paginação */}
        <Pagination
          page={page}
          onChange={setPage}
          totalItems={(activeFilter === 'atencao' ? atencaoList.length : clients.filter(c => {
            if (!activeFilter || activeFilter === 'total') return true;
            if (activeFilter === 'recorrente') return c.categoria === 'recorrente';
            if (activeFilter === 'outros') return c.categoria === 'outro';
            return true;
          }).length)}
          pageSize={pageSize}
        />
        </>
      )}
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
