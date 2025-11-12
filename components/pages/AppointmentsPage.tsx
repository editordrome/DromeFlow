import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useAppContext } from '../../contexts/AppContext';
import { useAuth } from '../../contexts/AuthContext';
import { fetchAppointments, fetchAppointmentsMulti } from '../../services/data/dataTable.service';
import { DataRecord } from '../../types';
import DataDetailModal from '../ui/DataDetailModal';
import { Icon } from '../ui/Icon';
import { useRealtimeSubscription } from '../../hooks/useRealtimeSubscription';

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
  const { userModules, userUnits, profile } = useAuth();
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
    'all' | 'comercial' | 'residencial' | 'pendente' | 'aguardando' | 'confirmado' | 'recusado' | 'esperar'
  >('all');
  const [isSending, setIsSending] = useState(false);
  const [sendFeedback, setSendFeedback] = useState<null | { type: 'success' | 'error'; message: string }>(null);
  // Controle local de envios individuais do status CONFIRMADO
  const [sentConfirmed, setSentConfirmed] = useState<Set<string>>(new Set());
  const [sendingConfirmed, setSendingConfirmed] = useState<Set<string>>(new Set());
  // Campo de busca
  const [searchTerm, setSearchTerm] = useState<string>('');

  const recordKey = (r: DataRecord) => String((r as any).id ?? r.ATENDIMENTO_ID);

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

  // OBS: Payload mínimo — apenas unidade_code e data

  // Envia payload mínimo ao webhook (POST JSON com fallback GET)
  const sendWebhookPayload = useCallback(
    async (_enriched: any[], _total: number, keyword?: string, atendimentoId?: string) => {
      if (!appointmentsWebhook) return;
      if (!activeDate) return;
      const unidadeCode = selectedUnit?.unit_code || '';
      
      // Busca o valor de conexao da unidade
      const { fetchConexao } = await import('../../services/units/unitKeys.service');
      const conexao = selectedUnit ? await fetchConexao(selectedUnit.id) : null;

      const payload = {
        unidade_code: unidadeCode,
        data: activeDate,
        conexao,
        usuario_email: profile?.email || null,
        usuario_nome: profile?.full_name || null,
        ...(keyword ? { keyword } : {}),
        ...(atendimentoId ? { atendimento_id: String(atendimentoId) } : {})
      } as any;

      let usedFallback = false;
      try {
        const resp = await fetch(appointmentsWebhook, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (!resp.ok) {
          const text = await resp.text().catch(() => '');
          throw new Error(`Falha HTTP ${resp.status}${text ? ' - ' + text.slice(0, 140) : ''}`);
        }
        return { ok: true as const, mode: 'POST' };
      } catch (primaryErr: any) {
        const msg = primaryErr?.message || '';
        if (msg.includes('Failed to fetch') || msg.includes('CORS') || msg.includes('NetworkError') || msg.includes('TypeError')) {
          usedFallback = true;
        } else {
          throw primaryErr;
        }
      }

      if (usedFallback) {
        const url = new URL(appointmentsWebhook);
        url.searchParams.set('u', unidadeCode);
        url.searchParams.set('d', activeDate);
        url.searchParams.set('cx', conexao || '');
        if (profile?.email) url.searchParams.set('ue', profile.email);
        if (profile?.full_name) url.searchParams.set('un', profile.full_name);
        if (keyword) url.searchParams.set('kw', keyword);
        if (atendimentoId) url.searchParams.set('aid', String(atendimentoId));
        const r = await fetch(url.toString(), { method: 'GET' });
        if (!r.ok) throw new Error(`Fallback GET falhou HTTP ${r.status}`);
        return { ok: true as const, mode: 'GET-ONE' };
      }
    },
    [appointmentsWebhook, activeDate, selectedUnit, profile]
  );

  const handleSendWebhook = async () => {
    if (!appointmentsWebhook) return;
    if (!activeDate) return;
    if (!selectedUnit || selectedUnit.unit_code === 'ALL') return;
    setIsSending(true);
    setSendFeedback(null);
    try {
      const result = await sendWebhookPayload([], 0, 'atendimento');
      if (result?.ok) {
        const msg = result.mode === 'POST' ? 'Atendimentos enviados.' : 'Webhook via fallback GET.';
        setSendFeedback({ type: 'success', message: msg });
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

  // Envio individual para registros CONFIRMADO
  const handleSendSingleConfirmed = async (rec: DataRecord) => {
    if (!appointmentsWebhook || !activeDate) return;
    if (!selectedUnit || selectedUnit.unit_code === 'ALL') return; // mantém mesma regra do botão principal
    const key = recordKey(rec);
    if (sentConfirmed.has(key)) return;
    setSendingConfirmed(prev => {
      const next = new Set(prev);
      next.add(key);
      return next;
    });
    try {
      const atendimentoId = String(((rec as any).ATENDIMENTO_ID || (rec as any).id) ?? '');
      const result = await sendWebhookPayload([], 0, 'cliente', atendimentoId);
      if (result?.ok) {
        setSendFeedback({ type: 'success', message: 'Envio realizado.' });
        setSentConfirmed(prev => {
          const next = new Set(prev);
          next.add(key);
          return next;
        });
      }
    } catch (err: any) {
      let msg = 'Erro ao enviar.';
      if (err?.message) {
        if (err.message.includes('Failed to fetch')) msg = 'Falha de rede/DNS ao contatar webhook.';
        else msg = err.message;
      }
      console.error('Erro ao enviar webhook individual:', err);
      setSendFeedback({ type: 'error', message: msg });
    } finally {
      setSendingConfirmed(prev => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
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

  // Subscription em tempo real para atualizar automaticamente quando dados mudarem
  useRealtimeSubscription({
    table: 'processed_data',
    enabled: !!activeDate && !!selectedUnit,
    filter: (record: any) => {
      // Filtra apenas registros da data ativa
      if (!activeDate) return false;
      const recordDate = record.DATA?.split('T')[0] || record.DATA;
      if (recordDate !== activeDate) return false;
      
      // Filtra por unidade
      if (selectedUnit?.unit_code === 'ALL') {
        const unitCodes = (userUnits || []).map(u => u.unit_code);
        return unitCodes.includes(record.unidade_code);
      }
      return record.unidade_code === selectedUnit?.unit_code;
    },
    callbacks: {
      onInsert: (newRecord: any) => {
        console.log('[Realtime] Novo agendamento inserido:', newRecord);
        setAppointments(prev => {
          // Evita duplicatas
          const exists = prev.find(r => (r as any).id === newRecord.id);
          if (exists) return prev;
          return [...prev, newRecord as DataRecord];
        });
      },
      onUpdate: (updatedRecord: any) => {
        console.log('[Realtime] Agendamento atualizado:', updatedRecord);
        setAppointments(prev =>
          prev.map(r => ((r as any).id === updatedRecord.id ? updatedRecord as DataRecord : r))
        );
      },
      onDelete: (deletedRecord: any) => {
        console.log('[Realtime] Agendamento deletado:', deletedRecord);
        setAppointments(prev => prev.filter(r => (r as any).id !== deletedRecord.id));
      }
    }
  });

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

  // Aplica filtro baseado na métrica selecionada e busca
  const filteredAppointments = useMemo(() => {
    let result = sortedAppointments;
    
    // Filtro por métrica (card)
    if (activeMetricFilter !== 'all') {
      result = result.filter(a => {
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
          case 'esperar':
            return st === 'ESPERAR';
          default:
            return true;
        }
      });
    }
    
    // Filtro por busca
    if (searchTerm.trim()) {
      const search = searchTerm.toLowerCase();
      result = result.filter(a => {
        const cliente = (a.CLIENTE || '').toLowerCase();
        const profissional = (a.PROFISSIONAL || '').toLowerCase();
        const tipo = (a.TIPO || '').toLowerCase();
        const horario = (a.HORARIO || '').toLowerCase();
        return cliente.includes(search) || 
               profissional.includes(search) || 
               tipo.includes(search) ||
               horario.includes(search);
      });
    }
    
    return result;
  }, [sortedAppointments, activeMetricFilter, searchTerm]);

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
  // IMPORTANTE: Exclui registros derivados (IS_DIVISAO = 'SIM') da contagem, conforme regra de negócio
  const metrics = useMemo(() => {
    // Filtra apenas registros originais (não derivados da expansão multi-profissional)
    const originalRecords = appointments.filter(a => {
      const isDivisao = (a.IS_DIVISAO || '').toUpperCase();
      return isDivisao !== 'SIM';
    });
    
    const total = originalRecords.length;
    let comercial = 0;
    let residencial = 0;
    let pendente = 0;
    let aguardando = 0;
    let confirmado = 0;
    let recusado = 0;
    let esperar = 0;
    originalRecords.forEach(a => {
      const tipo = (a.TIPO || '').toLowerCase();
      if (tipo.includes('comercial')) comercial++;
      if (tipo.includes('residencial')) residencial++;
      const rawStatus = (a as any).STATUS || (a as any).status || '';
      const st = String(rawStatus).trim().toUpperCase();
      if (st === 'PENDENTE') pendente++;
      else if (st === 'AGUARDANDO') aguardando++;
      else if (st === 'CONFIRMADO' || st === 'FINALIZADO') confirmado++; // agrupa FINALIZADO em confirmado para visão operacional
      else if (st === 'RECUSADO' || st === 'CANCELADO') recusado++; // inclui CANCELADO em recusado
      else if (st === 'ESPERAR') esperar++;
    });
    return { total, comercial, residencial, pendente, aguardando, confirmado, recusado, esperar };
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
      {/* Cabeçalho Principal */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-text-primary flex items-center flex-wrap gap-x-2">
          <span>Agendamentos</span>
          {activeDateInfo && (
            <span className="text-base font-normal text-text-secondary">
              {activeDateInfo.formatted} - {activeDateInfo.weekday}
            </span>
          )}
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          {/* Campo de busca */}
          <div className="relative">
            <label htmlFor="appointments-search" className="sr-only">
              Buscar agendamentos
            </label>
            <input
              id="appointments-search"
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por cliente, profissional..."
              className="w-full max-w-64 rounded-md border border-border-secondary bg-bg-tertiary px-3 py-2 pr-8 text-sm text-text-primary focus:border-accent-primary focus:outline-none focus:ring-2 focus:ring-accent-primary/40"
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

          {/* Filtros de Status - Apenas ícones */}
          <div className="flex items-center gap-2">
            {([
              { key: 'pendente', label: 'Pendente', icon: 'Clock', color: 'text-amber-500', value: metrics.pendente },
              { key: 'aguardando', label: 'Aguardando', icon: 'Hourglass', color: 'text-brand-cyan', value: metrics.aguardando },
              { key: 'esperar', label: 'Esperar', icon: 'Pause', color: 'text-purple-500', value: metrics.esperar },
              { key: 'confirmado', label: 'Confirmado', icon: 'CheckCircle', color: 'text-brand-green', value: metrics.confirmado },
              { key: 'recusado', label: 'Recusado', icon: 'XCircle', color: 'text-danger', value: metrics.recusado }
            ] as const).map(m => {
              const isActive = activeMetricFilter === (m.key as any);
              return (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => setActiveMetricFilter(prev => (prev === m.key ? 'all' : (m.key as any)))}
                  className={`flex items-center gap-1 rounded-md border px-2 py-1 text-sm transition focus:outline-none focus:ring-2 focus:ring-offset-1 ${
                    isActive
                      ? 'border-accent-primary bg-accent-primary text-text-on-accent'
                      : 'border-border-secondary bg-bg-tertiary text-text-primary hover:bg-bg-tertiary/70'
                  }`}
                  aria-pressed={isActive}
                  aria-label={`Filtrar por ${m.label}`}
                  title={`${m.label}: ${m.value}`}
                >
                  <Icon name={m.icon as any} className={`h-4 w-4 ${isActive ? 'text-text-on-accent' : m.color}`} />
                </button>
              );
            })}
          </div>
          
          {sendFeedback && (
            <div className={`text-sm px-3 py-1 rounded-md border ${sendFeedback.type === 'success' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/40' : 'bg-rose-500/10 text-rose-500 border-rose-500/40'}`}>
              {sendFeedback.message}
            </div>
          )}
          <button
            type="button"
            disabled={!appointmentsWebhook || isSending || selectedUnit.unit_code === 'ALL'}
            onClick={handleSendWebhook}
            className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold shadow transition focus:outline-none focus:ring-2 disabled:opacity-50 disabled:cursor-not-allowed ${
              appointmentsWebhook ? 'bg-accent-primary text-text-on-accent hover:bg-accent-primary/90 focus:ring-accent-primary' : 'bg-bg-tertiary text-text-tertiary border border-border-secondary'
            }`}
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
      
      {/* Métricas - Cards principais TOTAL, COMERCIAL, RESIDENCIAL */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {([
          { key: 'all', label: 'Total', value: metrics.total, icon: 'calendar' },
          { key: 'comercial', label: 'Comercial', value: metrics.comercial, icon: 'briefcase' },
          { key: 'residencial', label: 'Residencial', value: metrics.residencial, icon: 'Home' }
        ] as const).map(card => {
          const isActive = activeMetricFilter === card.key;
          return (
            <button
              key={card.key}
              type="button"
              onClick={() => setActiveMetricFilter(prev => prev === card.key ? 'all' : card.key as any)}
              className={`p-3 rounded-lg border transition-all ${
                isActive 
                  ? 'bg-accent-primary text-white border-transparent shadow-lg' 
                  : 'bg-bg-secondary border-border-primary hover:shadow-md'
              }`}
              aria-pressed={isActive}
              aria-label={`Filtrar por ${card.label}`}
            >
              <div className="flex items-center gap-2">
                <Icon name={card.icon} className="w-5 h-5" />
                <span className="text-sm font-medium">{card.label}</span>
                <span className={`ml-auto text-lg font-bold ${isActive ? 'text-white' : 'text-text-primary'}`}>
                  {card.value}
                </span>
              </div>
            </button>
          );
        })}
      </div>
      
      {/* Área de Tabela */}
      <div className="bg-bg-secondary rounded-lg shadow-md overflow-hidden">
        {/* Barra de abas de dias */}
        <div className="p-4 border-b border-border-secondary bg-bg-tertiary">
            <div className="flex w-full gap-2">
              {tabs.map(t => (
                <button
                  key={t.date}
                  onClick={() => setActiveDate(t.date)}
                  className={`flex-1 px-4 py-2 rounded-md text-xs sm:text-sm font-medium transition text-center truncate border ${
                    activeDate === t.date
                      ? 'bg-accent-primary text-text-on-accent border-accent-primary shadow'
                      : 'bg-bg-tertiary text-text-secondary border-border-secondary hover:text-text-primary hover:shadow'
                  }`}
                >
                  {t.label}
                </button>
              ))}
              {/* Botão calendário com popover */}
              <div className="relative" ref={calendarRef}>
                <button
                  type="button"
                  aria-label="Abrir seletor de data"
                  onClick={() => setShowCalendar(v => !v)}
                  className={`h-full aspect-square flex items-center justify-center rounded-md transition border ${
                    showCalendar ? 'bg-accent-primary text-text-on-accent border-accent-primary shadow' : 'bg-bg-tertiary text-text-secondary border-border-secondary hover:text-text-primary hover:shadow'
                  }`}
                >
                  <Icon name="calendar" className="w-5 h-5" />
                </button>
                {showCalendar && (
                  <div className="fixed mt-2 z-50 w-72 p-3 rounded-md bg-bg-secondary shadow-lg border border-border-secondary animate-fade-in"
                    style={{
                      top: calendarRef.current ? calendarRef.current.getBoundingClientRect().bottom + 8 : 0,
                      right: calendarRef.current ? window.innerWidth - calendarRef.current.getBoundingClientRect().right : 0,
                    }}
                  >
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
          </div>
        
        <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
          <table className="w-full text-sm table-fixed" style={{ minWidth: '1000px' }}>
            <colgroup>
              <col className="w-[10%]" />
              <col className="w-[8%]" />
              <col className="w-[28%]" />
              <col className="w-[10%]" />
              <col className="w-[12%]" />
              <col className="w-[20%]" />
              <col className="w-[12%]" />
            </colgroup>
            <thead className="sticky top-0 z-10 bg-bg-tertiary shadow-sm">
              <tr className="bg-bg-tertiary text-text-secondary">
                <th className="px-4 py-3 text-left font-semibold">ID</th>
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
                  <td colSpan={7} className="py-10 text-center">
                    <div className="w-10 h-10 border-4 border-gray-200 border-t-accent-primary rounded-full animate-spin mx-auto" />
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-danger">{error}</td>
                </tr>
              ) : filteredAppointments.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-text-secondary">Nenhum agendamento para esta data.</td>
                </tr>
              ) : (
                filteredAppointments.map(rec => (
                  <tr
                    key={rec.id || rec.ATENDIMENTO_ID}
                    className="border-t border-border-secondary hover:bg-bg-tertiary cursor-pointer"
                    onClick={() => setSelectedRecord(rec)}
                  >
                    <td className="px-4 py-2 text-text-primary truncate" title={rec.ATENDIMENTO_ID}>{rec.ATENDIMENTO_ID}</td>
                    <td className="px-4 py-2 font-medium text-text-primary">{formatDisplayHour(rec.HORARIO)}</td>
                    <td className="px-4 py-2 text-text-primary truncate" title={rec.CLIENTE}>{rec.CLIENTE}</td>
                    <td className="px-4 py-2 text-text-secondary text-center">{(() => {
                      const periodo = (rec as any)['PERÍODO'];
                      if (!periodo) return '-';
                      // Exibir no formato '8 horas'
                      return `${periodo} horas`;
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
                        // Cores alinhadas aos cards: PENDENTE=amarelo, AGUARDANDO=azul, CONFIRMADO/CONCLUIDO/FINALIZADO=verde, RECUSADO/CANCELADO=vermelho
                        if (value === 'PENDENTE') style = 'bg-warning text-black border-warning/80 hover:bg-warning/90';
                        else if (value === 'AGUARDANDO') style = 'bg-blue-500/10 text-blue-500 border-blue-400/40 hover:bg-blue-500/15';
                        else if (value === 'RECUSADO' || value === 'CANCELADO') style = 'bg-rose-500/10 text-rose-500 border-rose-500/40 hover:bg-rose-500/15';

                        // Para CONFIRMADO: vira botão acionável que envia o atendimento individual com keyword 'cliente'
                        if (value === 'CONFIRMADO') {
                          const key = recordKey(rec);
                          const wasSent = sentConfirmed.has(key);
                          const isRowSending = sendingConfirmed.has(key);
                          const disabledByConfirmacao = Boolean((rec as any).confirmacao === true);
                          const isDisabled = !appointmentsWebhook || selectedUnit.unit_code === 'ALL' || isRowSending || wasSent || disabledByConfirmacao;
                          const confirmedStyle = `bg-success ${(wasSent || disabledByConfirmacao) ? 'text-black' : 'text-text-on-accent'} border-success/80`;
                          return (
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); handleSendSingleConfirmed(rec); }}
                              disabled={isDisabled}
                              className={`${base} ${confirmedStyle} ${isDisabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer hover:bg-success/90'}`}
                              aria-label={`Enviar atendimento CONFIRMADO (${rec.CLIENTE})`}
                              title={wasSent ? 'Enviado' : 'Enviar este atendimento'}
                            >
                              {isRowSending ? 'Enviando...' : value}
                            </button>
                          );
                        }

                        // Para CONCLUIDO/FINALIZADO mantemos como rótulo (somente visual)
                        if (value === 'CONCLUIDO' || value === 'FINALIZADO') {
                          style = 'bg-success text-text-on-accent border-success/80 hover:bg-success/90';
                        }
                        return (
                          <button type="button" disabled className={`${base} ${style} cursor-default`} aria-label={`Status: ${value}`}>
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
        onEdit={(updated) => {
          // Atualiza lista e o registro selecionado
          setAppointments(prev => prev.map(r => {
            const sameId = (r.id != null && updated.id != null && r.id === updated.id);
            const sameKey = r.ATENDIMENTO_ID && updated.ATENDIMENTO_ID && r.ATENDIMENTO_ID === updated.ATENDIMENTO_ID;
            return (sameId || sameKey) ? { ...r, ...updated } as any : r;
          }));
          setSelectedRecord(prev => prev ? ({ ...(prev as any), ...updated } as any) : prev);
        }}
      />
    </div>
  );
};

export default AppointmentsPage;
