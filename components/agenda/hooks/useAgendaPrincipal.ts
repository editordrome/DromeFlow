import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../../../services/supabaseClient';
import { formatLocalISO, getWeekDates } from '../helpers';
import { 
   getProfissionaisLivres, 
   getDisponibilidades, 
   syncProfissionalAvailability,
   getAgendaSettings
} from '../../../services/agenda/agenda.service';
import { fetchAppointmentsRange } from '../../../services/data/dataTable.service';

export const useAgendaPrincipal = (selectedUnit: any) => {
   const [loading, setLoading] = useState(false);
   const [error, setError] = useState<string | null>(null);

   const [selectedDate, setSelectedDate] = useState(new Date());
   const [profissionaisLivres, setProfissionaisLivres] = useState<any[]>([]);
   const [atendimentosDia, setAtendimentosDia] = useState<any[]>([]);
   const [atendimentosSemana, setAtendimentosSemana] = useState<any[]>([]);
   const [todasDisponibilidades, setTodasDisponibilidades] = useState<any[]>([]);
   const [statusMenu, setStatusMenu] = useState<{ profId: string, period: 'M' | 'T', dateStr: string } | null>(null);
   const [selectedProfDetails, setSelectedProfDetails] = useState<any | null>(null);
   const [filterSemProfissional, setFilterSemProfissional] = useState(false);
   const [activeMetricPeriod, setActiveMetricPeriod] = useState<'d7' | 'd30' | 'geral'>('d7');

   const weekDatesMap = useMemo(() => getWeekDates(selectedDate), [selectedDate]);

   const loadGestaoData = useCallback(async () => {
      if (!selectedUnit?.id || selectedUnit.id === 'ALL') return;
      setLoading(true);
      setError(null);
      try {
         const dateISO = formatLocalISO(selectedDate);
         const startOfWeekDate = weekDatesMap[0].date;
         const endOfWeekDate = weekDatesMap[6].date;
         const startISO = formatLocalISO(startOfWeekDate);
         const endISO = formatLocalISO(endOfWeekDate);

         const currentSettings = await getAgendaSettings(selectedUnit.id);
         const settingsId = currentSettings?.id;

         const [livresRaw, weekApts, weekDisps] = await Promise.all([
            getProfissionaisLivres(selectedUnit.id, dateISO),
            fetchAppointmentsRange(selectedUnit.unit_code, startISO, endISO),
            getDisponibilidades(selectedUnit.id, startISO, endISO)
         ]);

         const apts = weekApts || [];

         // Filtro de Segurança: Garante que a lista lateral (DnD) bata com o resumo de métricas
         // Remove profissionais que já tenham agendamentos reais no dia selecionado, mesmo que o banco não tenha sincronizado o status ainda.
         const livresProfsFix = (livresRaw || []).filter((lp: any) => {
            // Regra 1: Não pode ter agendamento real (CLIENTE)
            const hasAtendimento = apts.some((a: any) => {
               const aDate = typeof a.DATA === 'string' && a.DATA.includes('T') ? a.DATA.split('T')[0] : a.DATA;
               const lpNome = (lp.profissional?.nome || '').trim().toLowerCase();
               const atProf = (a.PROFISSIONAL || '').trim().toLowerCase();
               return aDate === dateISO && !!a.PROFISSIONAL && atProf === lpNome;
            });

            // Regra 2: Impedimentos de maior prioridade (Reserva, Cancelamentos, Faltas)
            const isBlocked = lp.status_manha === 'RESERVA' || lp.status_tarde === 'RESERVA' || 
                             lp.status_manha === 'CANCELOU' || lp.status_tarde === 'CANCELOU' || 
                             lp.status_manha === 'FALTOU' || lp.status_tarde === 'FALTOU';
            
            if (hasAtendimento || isBlocked) return false;

            // Regra 3: Turno Vencido (Filtro de tempo real para o dia de hoje)
            const isToday = dateISO === formatLocalISO(new Date());
            if (isToday) {
               const now = new Date();
               // 13:00 é o divisor de águas do sistema
               const currentHour = now.getHours() + (now.getMinutes() / 60);
               
               // Se a profissional for LIVRE apenas na manhã e já passou das 13h, oculta
               const isManhaSolo = lp.status_manha === 'LIVRE' && lp.status_tarde !== 'LIVRE' && lp.status_tarde !== 'CLIENTE';
               if (isManhaSolo && currentHour >= 13) return false;
            }

            return true;
         });

         // Garante unicidade por profissional_id
         const uniqueLivres = Array.from(
            livresProfsFix.reduce((map: Map<string, any>, item: any) => {
               if (!map.has(item.profissional_id)) map.set(item.profissional_id, item);
               return map;
            }, new Map()).values()
         ) as any[];
         
         // Ordenação por período solicitada: 4h Manhã > 4h Tarde > 6h > 8h
         const getWeight = (disp: any) => {
            const p = disp.periodos || [];
            if (p.includes('4 horas manhã')) return 1;
            if (p.includes('4 horas tarde')) return 2;
            if (p.includes('6 horas')) return 3;
            if (p.includes('8 horas')) return 4;
            return 99; // Outros
         };

         uniqueLivres.sort((a, b) => {
            const wA = getWeight(a);
            const wB = getWeight(b);
            if (wA !== wB) return wA - wB;
            // Desempate por nome
            return (a.profissional?.nome || '').localeCompare(b.profissional?.nome || '');
         });

         setProfissionaisLivres(uniqueLivres);
         setAtendimentosSemana(apts);
         setTodasDisponibilidades(weekDisps || []);

         const aptsDia = apts
            .filter((a: any) => {
               const aDate = typeof a.DATA === 'string' && a.DATA.includes('T') ? a.DATA.split('T')[0] : a.DATA;
               return aDate === dateISO;
            })
            .sort((a: any, b: any) => {
               // Prioridade 1: Sem profissional (null/vazio) aparece primeiro
               const hasA = !!(a.PROFISSIONAL && a.PROFISSIONAL.trim());
               const hasB = !!(b.PROFISSIONAL && b.PROFISSIONAL.trim());
               if (hasA !== hasB) return hasA ? 1 : -1;

               // Prioridade 2: Horário (Mais cedo primeiro)
               return (a.HORARIO || '').localeCompare(b.HORARIO || '');
            });

         setAtendimentosDia(aptsDia);
      } catch (err: any) {
         console.error('Erro ao carregar dados da agenda (principal)', err);
         setError(err.message || 'Erro ao carregar dados');
      } finally {
         setLoading(false);
      }
   }, [selectedUnit, selectedDate, weekDatesMap]);

   useEffect(() => {
      loadGestaoData();
   }, [loadGestaoData]);

   // Realtime listener for availability and appointments changes
   useEffect(() => {
      if (!selectedUnit?.id || selectedUnit.id === 'ALL') return;
      
      const channel = supabase
         .channel('agenda_principal_changes')
         .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'agenda_disponibilidade', filter: `unit_id=eq.${selectedUnit.id}` },
            () => loadGestaoData()
         )
         .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'atendimentos', filter: `unidade=eq.${selectedUnit.id}` },
            () => loadGestaoData()
         )
         .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'processed_data', filter: `unit_id=eq.${selectedUnit.id}` },
            () => loadGestaoData()
         )
         .subscribe();

      return () => {
         supabase.removeChannel(channel);
      };
   }, [selectedUnit, loadGestaoData]);

   const [profMetricas, setProfMetricas] = useState<Record<string, any>>({});

   const loadProfissionalMetrics = async (profId: string, profNome: string) => {
      try {
         const response = await fetch(`${window.location.origin}/api/metrics/professional?id=${profId}&nome=${encodeURIComponent(profNome)}&unit_id=${selectedUnit.id}`);
         if (!response.ok) throw new Error('Falha ao carregar métricas');
         const data = await response.json();
         setProfMetricas(prev => ({ ...prev, [profId]: data }));
      } catch (err) {
         console.error('Erro ao carregar métricas do profissional:', err);
      }
   };

   return {
      loading, error,
      selectedDate, setSelectedDate,
      weekDatesMap,
      profissionaisLivres,
      atendimentosDia, setAtendimentosDia,
      atendimentosSemana,
      todasDisponibilidades,
      statusMenu, setStatusMenu,
      selectedProfDetails, setSelectedProfDetails,
      filterSemProfissional, setFilterSemProfissional,
      activeMetricPeriod, setActiveMetricPeriod,
      profMetricas, loadProfissionalMetrics,
      refreshData: loadGestaoData
   };
};
