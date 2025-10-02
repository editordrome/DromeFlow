import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useAppContext } from '../../contexts/AppContext';
import { useAuth } from '../../contexts/AuthContext';
import { fetchAppointments, fetchAppointmentsMulti } from '../../services/data/dataTable.service';
import { DataRecord } from '../../types';
import DataDetailModal from '../ui/DataDetailModal';
import { Icon } from '../ui/Icon';

interface DayTab {
  label: string;
  date: string; // YYYY-MM-DD
}

const formatDisplayHour = (raw: string) => {
  if (!raw) return '--:--';
  // Remove trailing ':00' or '00' mantendo HH:MM
  const cleaned = raw.trim();
  const match = cleaned.match(/^(\d{1,2}:\d{2})/);
  if (match) return match[1].padStart(5, '0');
  // Caso venha como HHMM
  if (/^\d{3,4}$/.test(cleaned)) {
    const h = cleaned.slice(0, cleaned.length - 2).padStart(2, '0');
    const m = cleaned.slice(-2);
    return `${h}:${m}`;
  }
  return cleaned;
};

const AppointmentsPage: React.FC = () => {
  const { selectedUnit } = useAppContext();
  const { userModules, userUnits } = useAuth();
  const [activeDate, setActiveDate] = useState<string>('');
  const [tabs, setTabs] = useState<DayTab[]>([]);
  const [appointments, setAppointments] = useState<DataRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedRecord, setSelectedRecord] = useState<DataRecord | null>(null);
  const [showCalendar, setShowCalendar] = useState(false);
  const calendarRef = useRef<HTMLDivElement | null>(null);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  // Filtro ativo derivado das métricas. 'all' significa sem filtro.
  const [activeMetricFilter, setActiveMetricFilter] = useState<
    'all' | 'comercial' | 'residencial' | 'pendente' | 'aguardando' | 'confirmado' | 'recusado'
  >('all');
  const [isSending, setIsSending] = useState(false);
  const [sendFeedback, setSendFeedback] = useState<null | { type: 'success' | 'error'; message: string }>(null);

  // Localiza webhook do módulo de agendamentos (heurística: nome contém 'agend' ou view_id === 'appointments')
  const appointmentsWebhook = useMemo(() => {
    const module = userModules.find(m =>
      (m.view_id && m.view_id.toLowerCase() === 'agenda') || // prioridade: view_id agenda
      (m.view_id && m.view_id.toLowerCase() === 'appointments') ||
      m.name.toLowerCase().includes('agend')
    );
    return module?.webhook_url || null;
  }, [userModules]);

  // Limpa feedback após alguns segundos
  useEffect(() => {
    if (sendFeedback) {
      const t = setTimeout(() => setSendFeedback(null), 5000);
      return () => clearTimeout(t);
    }
  }, [sendFeedback]);

  const computeSaida = (horario: string, periodo: string | number | null | undefined): string | null => {
    if (!horario) return null;
    const match = horario.match(/^(\d{1,2}):(\d{2})/);
    if (!match) return null;
    const h = parseInt(match[1], 10);
    const m = parseInt(match[2], 10);
    const dur = typeof periodo === 'number' ? periodo : parseInt(String(periodo || '').replace(/[^0-9]/g, ''), 10);
    if (isNaN(dur)) return null;
    const endMinutes = h * 60 + m + dur * 60;
    const eh = Math.floor(endMinutes / 60);
    const em = endMinutes % 60;
    return `${String(eh).padStart(2, '0')}:${String(em).padStart(2, '0')}`;
  };

  const handleSendWebhook = async () => {
    if (!appointmentsWebhook) return;
    if (!activeDate) return;
    const pendentes = appointments.filter(a => {
      const st = String(((a as any).STATUS || (a as any).status || '')).toUpperCase();
      return st === 'PENDENTE';
    });
    if (pendentes.length === 0) {
      setSendFeedback({ type: 'error', message: 'Nenhum atendimento PENDENTE para enviar.' });
      return;
    }
    setIsSending(true);
    setSendFeedback(null);
    try {
      // Estrutura completa em JSON agora (POST). Mantemos também versão compacta para economizar banda dependendo do volume.
      const enriched = pendentes.map(p => {
        const periodo = (p as any)['PERÍODO'];
        return {
          orcamento: p.orcamento,
          horario: p.HORARIO,
            periodo,
          saida: computeSaida(p.HORARIO, periodo) || undefined,
          profissional: p.PROFISSIONAL,
          cliente: p.CLIENTE,
          tipo: p.TIPO,
          endereco: (p as any).ENDEREÇO || (p as any).ENDERECO || undefined,
          status: (p as any).STATUS || (p as any).status || 'PENDENTE'
        };
      });

      const unidadeCode = selectedUnit?.unit_code || '';
      const payload = {
        unidade_code: unidadeCode,
        data: activeDate,
        total: pendentes.length,
        generated_at: new Date().toISOString(),
        atendimentos: enriched,
        // Campo opcional adicional com forma compacta para consumidores que queiram parse rápido
        compact: enriched.map(e => ({ o: e.orcamento, h: e.horario, p: e.periodo, s: e.saida, pr: e.profissional, c: e.cliente, t: e.tipo, e: e.endereco }))
      };

      let usedFallback = false;
      try {
        const resp = await fetch(appointmentsWebhook, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        });
        if (!resp.ok) {
          const text = await resp.text().catch(() => '');
          throw new Error(`Falha HTTP ${resp.status}${text ? ' - ' + text.slice(0,140) : ''}`);
        }
        setSendFeedback({ type: 'success', message: 'Webhook enviado (POST JSON).' });
        return; // sucesso POST, encerra
      } catch (primaryErr: any) {
        // Critérios para tentar fallback GET: erro de rede ou CORS genérico ou tamanho potencial
        const msg = primaryErr?.message || '';
        if (msg.includes('Failed to fetch') || msg.includes('CORS') || msg.includes('NetworkError') || msg.includes('TypeError')) {
          usedFallback = true;
        } else {
          throw primaryErr; // erro HTTP conhecido -> não tenta fallback
        }
      }

      // Fallback GET compactado com chunking adaptativo
      if (usedFallback) {
  const compactItems = enriched.map(e => ({ o: e.orcamento, h: e.horario, p: e.periodo, s: e.saida, pr: e.profissional, c: e.cliente, t: e.tipo, e: e.endereco, st: e.status }));
        const envelopeBase = {
          u: selectedUnit?.unit_code || '', // unidade
          d: activeDate,
          g: new Date().toISOString(), // generated_at
          tt: pendentes.length // total
        };
        const MAX_URL = 3000;

        const buildUrl = (subset: any[], part?: string, parts?: number) => {
          const url = new URL(appointmentsWebhook);
          const env: any = { ...envelopeBase, a: subset }; // 'a' = atendimentos
          if (part && parts) env.pt = part; // posição da parte (e.g., 1/3)
          const json = JSON.stringify(env);
          url.searchParams.set('payload', json);
          return url.toString();
        };

        // Tenta enviar tudo de uma vez
        let fullUrl = buildUrl(compactItems);
        if (fullUrl.length <= MAX_URL) {
          const r = await fetch(fullUrl, { method: 'GET' });
          if (!r.ok) throw new Error(`Fallback GET falhou HTTP ${r.status}`);
          setSendFeedback({ type: 'success', message: 'Webhook via fallback GET (1 parte).' });
          return;
        }

        // Chunking adaptativo
        let low = 1;
        let high = compactItems.length;
        // Busca tamanho máximo de chunk que cabe (binária)
        const fits = (size: number) => buildUrl(compactItems.slice(0, size)).length <= MAX_URL;
        // Garantir que pelo menos 1 cabe (se não couber, aborta e sugere outro meio)
        if (!fits(1)) throw new Error('Registro individual excede limite de URL no fallback GET. Configure POST no servidor.');
        while (low < high) {
          const mid = Math.min(high - 1, Math.floor((low + high + 1) / 2));
          if (fits(mid)) low = mid; else high = mid - 1;
        }
        const chunkSize = low;
        const batches: any[][] = [];
        for (let i = 0; i < compactItems.length; i += chunkSize) batches.push(compactItems.slice(i, i + chunkSize));
        for (let i = 0; i < batches.length; i++) {
          const partUrl = buildUrl(batches[i], `${i + 1}/${batches.length}`, batches.length);
          if (partUrl.length > MAX_URL) throw new Error('Falha inesperada: URL chunk > limite após cálculo.');
          const r = await fetch(partUrl, { method: 'GET' });
          if (!r.ok) throw new Error(`Fallback GET parte ${i + 1} HTTP ${r.status}`);
        }
        setSendFeedback({ type: 'success', message: `Webhook via fallback GET em ${batches.length} partes (chunk=${chunkSize}).` });
        return;
      }
    } catch (err: any) {
      let msg = 'Erro ao enviar webhook.';
      if (err?.message) {
        if (err.message.includes('Failed to fetch')) msg = 'Falha de rede/DNS ao contatar webhook.';
        else msg = err.message;
      }
      console.error('Erro ao enviar webhook (POST/GET) de agendamentos:', err);
      setSendFeedback({ type: 'error', message: msg });
    } finally {
      setIsSending(false);
    }
  };

  const startOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1);
  const endOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth() + 1, 0);

  const daysMatrix = useMemo(() => {
    const start = startOfMonth(calendarMonth);
    const end = endOfMonth(calendarMonth);
    const startWeekDay = start.getDay(); // 0 Domingo
    // Ajustar para começar em segunda (ISO) => transformar 0 em 6
    const offset = (startWeekDay === 0 ? 6 : startWeekDay - 1);
    const totalDays = end.getDate();
    const cells: (Date | null)[] = [];
    for (let i = 0; i < offset; i++) cells.push(null);
    for (let d = 1; d <= totalDays; d++) {
      cells.push(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), d));
    }
    while (cells.length % 7 !== 0) cells.push(null);
    const weeks: (Date | null)[][] = [];
    for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
    return weeks;
  }, [calendarMonth]);

  const formatDateKey = (d: Date) => d.toISOString().split('T')[0];

  const handleSelectDate = useCallback((d: Date) => {
    const dateKey = formatDateKey(d);
    const label = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    setTabs(prev => {
      if (prev.find(tb => tb.date === dateKey)) return prev;
      return [...prev, { label, date: dateKey }];
    });
    setActiveDate(dateKey);
    setShowCalendar(false);
  }, []);

  // Fechar ao clicar fora ou Esc
  useEffect(() => {
    if (!showCalendar) return;
    const handleClick = (e: MouseEvent) => {
      if (calendarRef.current && !calendarRef.current.contains(e.target as Node)) {
        setShowCalendar(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowCalendar(false);
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [showCalendar]);

  // Cria abas: Hoje, Amanhã, +2 dias, +3 dias, e selecionador livre
  useEffect(() => {
    const today = new Date();
    const makeDate = (d: Date) => d.toISOString().split('T')[0];
    const labels = ['Hoje', 'Amanhã'];
    const baseTabs: DayTab[] = [];
    for (let i = 0; i < 4; i++) {
      const d = new Date();
      d.setDate(today.getDate() + i);
      let label = '';
      if (i === 0) label = 'Hoje';
      else if (i === 1) label = 'Amanhã';
      else label = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
      baseTabs.push({ label, date: makeDate(d) });
    }
    setTabs(baseTabs);
    setActiveDate(baseTabs[0]?.date || '');
  }, []);

  const loadData = async (date: string) => {
    if (!selectedUnit) return;
    setIsLoading(true);
    setError(null);
    try {
      let data: DataRecord[] = [];
      if (selectedUnit.unit_code === 'ALL') {
        const codes = (userUnits || []).map(u => u.unit_code);
        data = await fetchAppointmentsMulti(codes, date);
      } else {
        data = await fetchAppointments(selectedUnit.unit_code, date);
      }
      setAppointments(data);
    } catch (e: any) {
      setError(e.message || 'Falha ao buscar agendamentos.');
      setAppointments([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (activeDate) {
      loadData(activeDate);
    }
  }, [activeDate, selectedUnit]);

  const handleCustomDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setActiveDate(e.target.value);
  };

  const sortedAppointments = useMemo(() => {
    return [...appointments].sort((a, b) => {
      const ah = a.HORARIO || '';
      const bh = b.HORARIO || '';
      return ah.localeCompare(bh);
    });
  }, [appointments]);

  // Aplica filtro baseado na métrica selecionada
  const filteredAppointments = useMemo(() => {
    if (activeMetricFilter === 'all') return sortedAppointments;
    return sortedAppointments.filter(a => {
      const tipo = (a.TIPO || '').toLowerCase();
      const rawStatus = (a as any).STATUS || (a as any).status || '';
      const st = String(rawStatus).trim().toUpperCase();
      switch (activeMetricFilter) {
        case 'comercial':
          return tipo.includes('comercial');
        case 'residencial':
          return tipo.includes('residencial');
        case 'pendente':
          return st === 'PENDENTE';
        case 'aguardando':
          return st === 'AGUARDANDO';
        case 'confirmado':
          return st === 'CONFIRMADO' || st === 'FINALIZADO';
        case 'recusado':
          return st === 'RECUSADO' || st === 'CANCELADO';
        default:
          return true;
      }
    });
  }, [sortedAppointments, activeMetricFilter]);

  // Info formatada da data ativa para exibir no título
  const activeDateInfo = useMemo(() => {
    if (!activeDate) return null;
    try {
      const d = new Date(activeDate + 'T00:00:00');
      if (isNaN(d.getTime())) return null;
      const formatted = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
      const weekdayLong = d.toLocaleDateString('pt-BR', { weekday: 'long' });
      const weekday = weekdayLong
        .split('-')
        .map(part => part.charAt(0).toUpperCase() + part.slice(1))
        .join('-');
      const tabLabel = tabs.find(t => t.date === activeDate)?.label || formatted;
      return { formatted, label: tabLabel, weekday };
    } catch {
      return null;
    }
  }, [activeDate, tabs]);

  // Métricas: Total, Comercial, Residencial + Status (PENDENTE, AGUARDANDO, CONFIRMADO, RECUSADO)
  const metrics = useMemo(() => {
    const total = appointments.length;
    let comercial = 0;
    let residencial = 0;
    let pendente = 0;
    let aguardando = 0;
    let confirmado = 0;
    let recusado = 0;
    appointments.forEach(a => {
      const tipo = (a.TIPO || '').toLowerCase();
      if (tipo.includes('comercial')) comercial++;
      if (tipo.includes('residencial')) residencial++;
      const rawStatus = (a as any).STATUS || (a as any).status || '';
      const st = String(rawStatus).trim().toUpperCase();
      if (st === 'PENDENTE') pendente++;
      else if (st === 'AGUARDANDO') aguardando++;
      else if (st === 'CONFIRMADO' || st === 'FINALIZADO') confirmado++; // agrupa FINALIZADO em confirmado para visão operacional
      else if (st === 'RECUSADO' || st === 'CANCELADO') recusado++; // inclui CANCELADO em recusado
    });
    return { total, comercial, residencial, pendente, aguardando, confirmado, recusado };
  }, [appointments]);

  if (!selectedUnit) {
    return (
      <div className="p-6 bg-bg-secondary rounded-lg shadow-md h-full flex items-center justify-center">
        <p className="text-text-secondary">Selecione uma unidade para ver os agendamentos.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center flex-wrap gap-3 justify-between">
        <h1 className="text-2xl font-bold text-text-primary flex items-center flex-wrap gap-x-2">
          <span>Agendamentos</span>
          {activeDateInfo && (
            <span className="text-base font-normal text-text-secondary">
              {activeDateInfo.formatted} - {activeDateInfo.weekday}
            </span>
          )}
        </h1>
        <div className="flex items-center gap-3">
          {sendFeedback && (
            <div className={`text-sm px-3 py-1 rounded-md border ${sendFeedback.type === 'success' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/40' : 'bg-rose-500/10 text-rose-500 border-rose-500/40'}`}>\n+              {sendFeedback.message}\n+            </div>
          )}
          <button
            type="button"
            disabled={!appointmentsWebhook || isSending || selectedUnit.unit_code === 'ALL'}
            onClick={handleSendWebhook}
            className={`inline-flex items-center gap-2 h-10 px-5 rounded-md text-sm font-semibold tracking-wide border transition focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm
              ${appointmentsWebhook ? 'bg-accent-primary text-text-on-accent border-accent-primary hover:bg-accent-primary/90' : 'bg-bg-tertiary text-text-tertiary border-border-secondary'}
            `}
            aria-disabled={!appointmentsWebhook || isSending}
          >
            {isSending ? (
              <>
                <span className="w-4 h-4 border-2 border-text-on-accent/30 border-t-text-on-accent rounded-full animate-spin" />
                Enviando...
              </>
            ) : (
              <>
                <Icon name="send" className="w-4 h-4" />
                {selectedUnit.unit_code === 'ALL' ? 'Enviar (indisponível em Todos)' : 'Enviar'}
              </>
            )}
          </button>
        </div>
      </div>
      <div className="bg-bg-secondary rounded-lg shadow-md overflow-hidden">
        {/* Barra de abas e botão calendário alinhados com a tabela */}
        <div className="p-4 border-b border-border-secondary">
          <div className="flex w-full gap-2">
            {tabs.map(t => (
              <button
                key={t.date}
                onClick={() => setActiveDate(t.date)}
                className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition text-center truncate ${
                  activeDate === t.date
                    ? 'bg-accent-primary text-text-on-accent shadow'
                    : 'bg-bg-tertiary text-text-secondary hover:text-text-primary hover:shadow'
                }`}
              >
                {t.label}
              </button>
            ))}
            {/* Botão calendário com popover */}
            <div className="relative mr-2" ref={calendarRef}>
              <button
                type="button"
                aria-label="Abrir seletor de data"
                onClick={() => setShowCalendar(v => !v)}
                className={`h-full aspect-square flex items-center justify-center rounded-md transition border border-border-secondary ${
                  showCalendar ? 'bg-accent-primary text-text-on-accent shadow' : 'bg-bg-tertiary text-text-secondary hover:text-text-primary hover:shadow'
                }`}
              >
                <Icon name="calendar" className="w-5 h-5" />
              </button>
              {showCalendar && (
                <div className="absolute right-0 mt-2 z-30 w-72 p-3 rounded-md bg-bg-secondary shadow-lg border border-border-secondary animate-fade-in">
                  <div className="flex items-center justify-between mb-2">
                    <button
                      type="button"
                      className="p-1 rounded hover:bg-bg-tertiary"
                      onClick={() => setCalendarMonth(m => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
                      aria-label="Mês anterior"
                    >
                      <span className="text-sm">‹</span>
                    </button>
                    <div className="text-sm font-medium text-text-primary select-none">
                      {calendarMonth.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                    </div>
                    <button
                      type="button"
                      className="p-1 rounded hover:bg-bg-tertiary"
                      onClick={() => setCalendarMonth(m => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
                      aria-label="Próximo mês"
                    >
                      <span className="text-sm">›</span>
                    </button>
                  </div>
                  <div className="grid grid-cols-7 gap-1 mb-1 text-[10px] uppercase tracking-wide text-text-secondary">
                    {['S','T','Q','Q','S','S','D'].map(d => <div key={d} className="text-center py-1">{d}</div>)}
                  </div>
                  <div className="grid grid-cols-7 gap-1">
                    {daysMatrix.map((week, wi) => week.map((day, di) => {
                      if (!day) return <div key={wi+'-'+di} className="h-8" />;
                      const key = formatDateKey(day);
                      const isActive = key === activeDate;
                      const isToday = key === new Date().toISOString().split('T')[0];
                      return (
                        <button
                          type="button"
                          key={key}
                          onClick={() => handleSelectDate(day)}
                          className={`h-8 text-xs rounded-md flex items-center justify-center transition border border-transparent ${
                            isActive
                              ? 'bg-accent-primary text-text-on-accent shadow'
                              : isToday
                              ? 'bg-bg-tertiary text-text-primary'
                              : 'hover:bg-bg-tertiary text-text-secondary'
                          }`}
                        >
                          {day.getDate()}
                        </button>
                      );
                    }))}
                  </div>
                </div>
              )}
            </div>
          </div>
          {/* Métricas */}
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-7 gap-3">
            {([
              { key: 'all', label: 'Total', value: metrics.total, base: true, color: '' },
              { key: 'comercial', label: 'Comercial', value: metrics.comercial, color: '' },
              { key: 'residencial', label: 'Residencial', value: metrics.residencial, color: '' },
              { key: 'pendente', label: 'Pendente', value: metrics.pendente, color: 'yellow' },
              { key: 'aguardando', label: 'Aguardando', value: metrics.aguardando, color: 'blue' },
              { key: 'confirmado', label: 'Confirmado', value: metrics.confirmado, color: 'emerald' },
              { key: 'recusado', label: 'Recusado', value: metrics.recusado, color: 'rose' }
            ] as const).map(card => {
              const isActive = activeMetricFilter === card.key;
              const common = 'rounded-md p-3 flex flex-col items-center text-center cursor-pointer select-none border transition shadow-sm';
              let style = 'bg-bg-tertiary/60 border-border-secondary hover:bg-bg-tertiary';
              if (card.color === 'yellow') style = 'border-yellow-400/40 bg-yellow-400/10';
              if (card.color === 'blue') style = 'border-blue-400/40 bg-blue-400/10';
              if (card.color === 'emerald') style = 'border-emerald-500/40 bg-emerald-500/10';
              if (card.color === 'rose') style = 'border-rose-500/40 bg-rose-500/10';
              if (isActive) {
                // Destaque diferente mantendo paleta
                if (card.key === 'all') style = 'bg-accent-primary text-text-on-accent border-accent-primary shadow';
                else if (card.color === 'yellow') style += ' ring-2 ring-yellow-400/60';
                else if (card.color === 'blue') style += ' ring-2 ring-blue-400/60';
                else if (card.color === 'emerald') style += ' ring-2 ring-emerald-500/60';
                else if (card.color === 'rose') style += ' ring-2 ring-rose-500/60';
                else style += ' ring-2 ring-accent-primary/60';
              }
              const textColor = card.key === 'all'
                ? (isActive ? 'text-text-on-accent' : 'text-text-secondary')
                : card.color === 'yellow'
                  ? 'text-yellow-500'
                  : card.color === 'blue'
                    ? 'text-blue-400'
                    : card.color === 'emerald'
                      ? 'text-emerald-500'
                      : card.color === 'rose'
                        ? 'text-rose-500'
                        : 'text-text-secondary';
              const numberColor = isActive && card.key === 'all'
                ? 'text-text-on-accent'
                : textColor.replace('text-', 'text-');
              return (
                <div
                  key={card.key}
                  role="button"
                  tabIndex={0}
                  onClick={() => setActiveMetricFilter(prev => prev === card.key ? 'all' : card.key as any)}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setActiveMetricFilter(prev => prev === card.key ? 'all' : card.key as any); } }}
                  className={`${common} ${style}`}
                  aria-pressed={isActive}
                  aria-label={`Filtrar por ${card.label}`}
                >
                  <p className={`text-[11px] uppercase tracking-wide font-medium ${textColor}`}>{card.label}</p>
                  <p className={`mt-1 text-lg font-semibold ${numberColor}`}>{card.value}</p>
                </div>
              );
            })}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm table-fixed">
            <colgroup>
              <col className="w-24" />
              <col className="w-52" />
              <col className="w-24" />
              <col className="w-36" />
              <col className="w-48" />
              <col className="w-28" />
            </colgroup>
            <thead>
              <tr className="bg-bg-tertiary text-text-secondary">
                <th className="px-4 py-3 text-left font-semibold">Horário</th>
                <th className="px-4 py-3 text-left font-semibold">Cliente</th>
                <th className="px-4 py-3 font-semibold text-center">Período</th>
                <th className="px-4 py-3 font-semibold text-center">Tipo</th>
                <th className="px-4 py-3 text-left font-semibold">Profissional</th>
                <th className="px-4 py-3 font-semibold text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center">
                    <div className="w-10 h-10 border-4 border-gray-200 border-t-accent-primary rounded-full animate-spin mx-auto" />
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-danger">{error}</td>
                </tr>
              ) : filteredAppointments.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-text-secondary">Nenhum agendamento para esta data.</td>
                </tr>
              ) : (
                filteredAppointments.map(rec => (
                  <tr
                    key={rec.id || rec.orcamento}
                    className="border-t border-border-secondary hover:bg-bg-tertiary cursor-pointer"
                    onClick={() => setSelectedRecord(rec)}
                  >
                    <td className="px-4 py-2 font-medium text-text-primary">{formatDisplayHour(rec.HORARIO)}</td>
                    <td className="px-4 py-2 text-text-primary truncate" title={rec.CLIENTE}>{rec.CLIENTE}</td>
                    <td className="px-4 py-2 text-text-secondary text-center">{(() => {
                      const periodo = (rec as any)['PERÍODO'];
                      if (!periodo) return '-';
                      // Exibir no formato '8hr'
                      return `${periodo}hr`;
                    })()}</td>
                    <td className="px-4 py-2 text-text-secondary text-center truncate" title={rec.TIPO || ''}>{rec.TIPO || '-'}</td>
                    <td className="px-4 py-2 text-text-secondary truncate" title={rec.PROFISSIONAL}>{rec.PROFISSIONAL}</td>
                    <td className="px-4 py-2 text-center">
                      {(() => {
                        const raw = (rec as any).STATUS || (rec as any).status;
                        if (!raw) return <span className="text-text-tertiary text-xs">—</span>;
                        const value = String(raw).toUpperCase();
                        let base = 'inline-flex items-center justify-center rounded-md text-xs font-semibold px-3 h-7 tracking-wide border focus:outline-none focus:ring-2 focus:ring-offset-1 transition shadow-sm';
                        let style = 'bg-bg-tertiary text-text-secondary border-border-secondary';
                        if (value === 'FINALIZADO') style = 'bg-success text-text-on-accent border-success/80 hover:bg-success/90';
                        else if (value === 'PENDENTE') style = 'bg-warning text-black border-warning/80 hover:bg-warning/90';
                        else if (value === 'CONFIRMADO') style = 'bg-success text-text-on-accent border-success/80 hover:bg-success/90';
                        return (
                          <button
                            type="button"
                            disabled
                            className={`${base} ${style} cursor-default`}
                            aria-label={`Status: ${value}`}
                          >
                            {value}
                          </button>
                        );
                      })()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <DataDetailModal
        isOpen={!!selectedRecord}
        onClose={() => setSelectedRecord(null)}
        record={selectedRecord as any}
      />
    </div>
  );
};

export default AppointmentsPage;
