import React, { useState, useEffect, useMemo } from 'react';
import { useAppContext } from '../../contexts/AppContext';
import { Icon } from '../ui/Icon';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css'; // Estilos obrigatórios do base do react-calendar
import {
   getAgendaSettings,
   saveAgendaSettings,
   getDisponibilidades,
   getProfissionaisLivres,
   syncProfissionalAvailability
} from '../../services/agenda/agenda.service';
import { fetchAppointments, fetchAppointmentsRange, updateDataRecord } from '../../services/data/dataTable.service';
import { getUnitServices } from '../../services/units/unitServices.service';
import { supabase } from '../../services/supabaseClient';
import { DataRecord, UnitService } from '../../types';
import AgendaMobilePreview from '../agenda/AgendaMobilePreview';

type ActiveTab = 'gestao' | 'configuracoes';
type StatusPeriod = 'M' | 'T';
type FilterType = 'TODOS' | 'CLIENTE' | 'LIVRE' | 'NÃO' | 'FALTOU' | 'CANCELOU';
type StatusOption = 'LIVRE' | 'NÃO' | 'CANCELOU' | 'FALTOU' | 'LIMPAR';

// Mapeamento fiel ao app externo (AgendaExternaPage)
const PERIODOS_MANHA = ['8 horas', '6 horas', '4 horas manhã'];
const PERIODOS_TARDE = ['8 horas', '6 horas', '4 horas tarde'];
const PERIODOS_NAO = ['NÃO DISPONIVEL'];

const MOBILE_STATUS_OPTIONS = [
   '8 horas',
   '6 horas',
   '4 horas manhã',
   '4 horas tarde',
   'NÃO DISPONIVEL'
];

// Helpers puros fora do componente para evitar recriação a cada render
const formatLocalISO = (date: Date): string => {
   const offset = date.getTimezoneOffset();
   const local = new Date(date.getTime() - offset * 60_000);
   return local.toISOString().split('T')[0];
};

const matchName = (n1: string, n2: string): boolean =>
   !!n1 && !!n2 && n1.trim().toLowerCase() === n2.trim().toLowerCase();

const matchDate = (d1: any, d2: string): boolean => {
   if (!d1 || !d2) return false;
   const s1 = typeof d1 === 'string' ? d1.split('T')[0] : formatLocalISO(new Date(d1));
   return s1 === d2;
};

const STATUS_LABELS: Record<StatusOption, { label: string; color: string }> = {
   LIVRE: { label: 'LIVRE', color: 'text-brand-cyan' },
   'NÃO': { label: 'NÃO', color: 'text-text-tertiary' },
   CANCELOU: { label: 'CANCELOU', color: 'text-rose-500' },
   FALTOU: { label: 'FALTOU', color: 'text-orange-500' },
   LIMPAR: { label: 'LIMPAR STATUS', color: 'text-text-tertiary' },
};

const STATUS_OPTIONS: StatusOption[] = ['LIVRE', 'NÃO', 'CANCELOU', 'FALTOU', 'LIMPAR'];

const AgendaPage: React.FC = () => {
   const { selectedUnit } = useAppContext();

   const [activeTab, setActiveTab] = useState<ActiveTab>('gestao');
   const [loading, setLoading] = useState(false);
   const [error, setError] = useState<string | null>(null);

   // States - Configuração
   const [configSettings, setConfigSettings] = useState<any>(null);
   const [isSavingConfig, setIsSavingConfig] = useState(false);
   const [unitServicesList, setUnitServicesList] = useState<UnitService[]>([]);
   const [configTab, setConfigTab] = useState<'parametros' | 'metricas'>('metricas');

   // --------------------------------------------------------------------------
   // DRAG AND DROP
   // --------------------------------------------------------------------------

   const handleDragStartProfissional = (e: React.DragEvent, profissional: any) => {
      e.dataTransfer.setData('application/json', JSON.stringify({
         type: 'profissional',
         nome: profissional.profissional?.nome
      }));
   };

   const handleDragStartRemoveProfissional = (e: React.DragEvent, atendimento: any) => {
      e.dataTransfer.setData('application/json', JSON.stringify({
         type: 'remove_profissional',
         atendimentoId: atendimento.id || atendimento.ATENDIMENTO_ID
      }));
   };

   const handleDragOver = (e: React.DragEvent) => {
      e.preventDefault(); // Necessário para permitir o drop
   };

   const handleDropOnAtendimento = async (e: React.DragEvent, atendimento: any) => {
      e.preventDefault();
      try {
         const dataStr = e.dataTransfer.getData('application/json');
         if (!dataStr) return;
         const data = JSON.parse(dataStr);

         if (data.type === 'profissional' && data.nome) {
            const recordId = atendimento.id || atendimento.ATENDIMENTO_ID;
            if (!recordId) return;

            // Atualiza no banco
            await updateDataRecord(recordId.toString(), { PROFISSIONAL: data.nome });

            // Atualiza localmente
            setAtendimentosDia(prev => prev.map(a =>
               (a.id === atendimento.id || a.ATENDIMENTO_ID === atendimento.ATENDIMENTO_ID)
                  ? { ...a, PROFISSIONAL: data.nome }
                  : a
            ));

            // Sincroniza disponibilidade no banco
            const prof = todasProfissionais.find(p => matchName(p.nome, data.nome));
            if (prof) {
               await syncProfissionalAvailability(
                  selectedUnit.id,
                  prof.id,
                  data.nome,
                  formatLocalISO(selectedDate)
               );
               // Recarrega todos os dados para refletir mudanças na UI
               await Promise.all([loadGestaoData(), loadProfissionaisConfig()]);
            }
         }
      } catch (err) {
         console.error('Erro no Drop:', err);
      }
   };

   const handleDropToProfissionais = async (e: React.DragEvent) => {
      e.preventDefault();
      try {
         const dataStr = e.dataTransfer.getData('application/json');
         if (!dataStr) return;
         const data = JSON.parse(dataStr);

         if (data.type === 'remove_profissional' && data.atendimentoId) {
            // Atualiza no banco removendo
            await updateDataRecord(data.atendimentoId.toString(), { PROFISSIONAL: null });

            // Atualiza localmente
            setAtendimentosDia(prev => prev.map(a =>
               (a.id === data.atendimentoId || a.ATENDIMENTO_ID === data.atendimentoId)
                  ? { ...a, PROFISSIONAL: null }
                  : a
            ));

            // Acha o atendimento para saber quem era a profissional e sincronizar
            const atendimentoOriginal = atendimentosDia.find(a => (a.id === data.atendimentoId || a.ATENDIMENTO_ID === data.atendimentoId));
            if (atendimentoOriginal?.PROFISSIONAL) {
               const prof = todasProfissionais.find(p => matchName(p.nome, atendimentoOriginal.PROFISSIONAL));
               if (prof) {
                  await syncProfissionalAvailability(
                     selectedUnit.id,
                     prof.id,
                     atendimentoOriginal.PROFISSIONAL,
                     formatLocalISO(selectedDate)
                  );
                  // Recarrega todos os dados
                  await Promise.all([loadGestaoData(), loadProfissionaisConfig()]);
               }
            }
         }
      } catch (err) {
         console.error('Erro no Drop para remover:', err);
      }
   };

   // --------------------------------------------------------------------------
   // LÓGICA DE CONFIGURAÇÃO
   // --------------------------------------------------------------------------
   const loadSettings = async () => {
      if (!selectedUnit?.id) return;
      try {
         const { data: settings, error: settingsError } = await supabase
            .from('agenda_settings')
            .select('*')
            .eq('unit_id', selectedUnit.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

         if (settingsError) {
            throw settingsError;
         }

         if (settings) {
            setConfigSettings(settings);
         } else {
            setConfigSettings({ dias_liberados: [], periodos_cadastrados: [], is_link_active: false });
         }
         setHasSynced(true);
      } catch (err) {
         // Silencioso se não houver config, usa o padrão
      }
   };

   const loadUnitServices = async () => {
      if (!selectedUnit?.id) return;
      try {
         const services = await getUnitServices(selectedUnit.id);
         setUnitServicesList(services);
      } catch (err) {
         console.error('Erro ao buscar unit services', err);
      }
   };

   const loadProfissionaisConfig = async () => {
      if (!selectedUnit?.id) return;
      try {
         // Busca Profissionais Ativos da Unidade
         const { data: profsData, error: profsError } = await supabase
            .from('profissionais')
            .select('id, nome, whatsapp, habilidade, status')
            .eq('unit_id', selectedUnit.id)
            .or('status.ilike.ativo,status.ilike.ativa,status.is.null')
            .order('nome');

         if (profsError) throw profsError;

         // Busca TODA a disponibilidade atrelada à Unidade
         const { data: dispData, error: dispError } = await supabase
            .from('agenda_disponibilidade')
            .select('*')
            .eq('unit_id', selectedUnit.id);

         if (dispError) throw dispError;

         setTodasProfissionais(profsData || []);
         setTodasDisponibilidades(dispData || []);
      } catch (err) {
         console.error('Erro ao buscar metadados de profissionais das configs', err);
      }
   };

   const loadGestaoData = async () => {
      if (!selectedUnit?.id) return;
      setLoading(true);
      setAtendimentosSemana([]);
      setTodasDisponibilidades([]);
      try {
         const dataFormatada = formatLocalISO(selectedDate);

         const startOfWeekDate = new Date(selectedDate);
         startOfWeekDate.setDate(selectedDate.getDate() - selectedDate.getDay());
         const endOfWeekDate = new Date(selectedDate);
         endOfWeekDate.setDate(selectedDate.getDate() - selectedDate.getDay() + 6);

         const startISO = formatLocalISO(startOfWeekDate);
         const endISO = formatLocalISO(endOfWeekDate);

         // Executa todas as buscas em paralelo para máxima performance
         const [livres, weekApts, weekDisps] = await Promise.all([
            getProfissionaisLivres(selectedUnit.id, dataFormatada),
            fetchAppointmentsRange(selectedUnit.unit_code, startISO, endISO),
            getDisponibilidades(selectedUnit.id, startISO, endISO)
         ]);

         setProfissionaisLivres(livres || []);
         setAtendimentosSemana(weekApts || []);
         setTodasDisponibilidades(weekDisps || []);

         // Derive Atendimentos do Dia localmente do array da semana
         const aptsDia = (weekApts || []).filter(a => {
            const aDate = typeof a.DATA === 'string' && a.DATA.includes('T') ? a.DATA.split('T')[0] : a.DATA;
            return aDate === dataFormatada;
         });
         setAtendimentosDia(aptsDia);

         const contagemSemana = (weekDisps || []).filter((d: any) =>
            d.status_manha === 'LIVRE' || d.status_tarde === 'LIVRE'
         ).length;
         setDispSemanaCount(contagemSemana);

      } catch (err) {
         console.error('Erro ao carregar dados da agenda (gestão)', err);
      } finally {
         setLoading(false);
      }
   };



   // Carrega métricas de performance da profissional
   const loadProfissionalMetrics = async (profId: string, profNome: string) => {
      if (!selectedUnit?.unit_code) return;
      try {
         const now = new Date();
         const dataHoje = formatLocalISO(now);

         const sevenDaysAgo = new Date();
         sevenDaysAgo.setDate(now.getDate() - 7);
         const data7 = formatLocalISO(sevenDaysAgo);

         const thirtyDaysAgo = new Date();
         thirtyDaysAgo.setDate(now.getDate() - 30);
         const data30 = formatLocalISO(thirtyDaysAgo);

         // 1. Histórico de disponibilidades da profissional
         const { data: dispData, error: dispError } = await supabase
            .from('agenda_disponibilidade')
            .select('data, status_manha, status_tarde')
            .eq('profissional_id', profId);

         if (dispError) throw dispError;

         // 2. Histórico de atendimentos do profissional (para Perfil de Atendimento)
         const { data: atdData, error: atdError } = await supabase
            .from('processed_data')
            .select('DATA, TIPO, "SERVIÇO"')
            .eq('unidade_code', selectedUnit.unit_code)
            .ilike('PROFISSIONAL', profNome)
            .lte('DATA', dataHoje);

         if (atdError) throw atdError;

         // Função auxiliar para calcular métricas por período
         const calculatePeriodMetrics = (dData: any[], aData: any[], minDate?: string) => {
            const dispPeriod = minDate ? dData.filter(d => d.data >= minDate && d.data <= dataHoje) : dData.filter(d => d.data <= dataHoje);
            const atdPeriod = minDate ? aData.filter(a => {
               const atD = typeof a.DATA === 'string' && a.DATA.includes('T') ? a.DATA.split('T')[0] : a.DATA;
               return atD >= minDate && atD <= dataHoje;
            }) : aData.filter(a => {
               const atD = typeof a.DATA === 'string' && a.DATA.includes('T') ? a.DATA.split('T')[0] : a.DATA;
               return atD <= dataHoje;
            });

            // 1. ÍNDICE DE CONFIANÇA
            let CountCancelou = 0, CountLivre = 0, CountFaltou = 0, CountNao = 0;

            dispPeriod.forEach(d => {
               if (d.status_manha === 'CANCELOU') CountCancelou++;
               if (d.status_tarde === 'CANCELOU') CountCancelou++;

               if (d.status_manha === 'LIVRE') CountLivre++;
               if (d.status_tarde === 'LIVRE') CountLivre++;

               if (d.status_manha === 'FALTOU') CountFaltou++;
               if (d.status_tarde === 'FALTOU') CountFaltou++;

               if (d.status_manha === 'NÃO' || d.status_manha === 'NÃO') CountNao++;
               if (d.status_tarde === 'NÃO' || d.status_tarde === 'NÃO') CountNao++;
            });

            // Quantos atendimentos reais ela teve na tabela processed_data
            const CountCliente = atdPeriod.length;

            const totalConfianca = CountLivre + CountCliente + CountCancelou;
            const txConf = totalConfianca > 0 ? ((CountCancelou / totalConfianca) * 100).toFixed(0) : '0';

            // 2. FALTAS
            const totalFaltasRef = CountCliente + CountFaltou;
            const txFalta = totalFaltasRef > 0 ? ((CountFaltou / totalFaltasRef) * 100).toFixed(0) : '0';

            // 3. PERFIL
            let resCount = 0, comCount = 0;
            atdPeriod.forEach(a => {
               const isRes = a.TIPO?.toUpperCase().includes('RESIDENCIAL') || a['SERVIÇO']?.toUpperCase().includes('RESIDENCIAL');
               const isCom = a.TIPO?.toUpperCase().includes('COMERCIAL') || a['SERVIÇO']?.toUpperCase().includes('COMERCIAL');
               if (isRes) resCount++;
               if (isCom) comCount++;
            });

            let perfilDesc = 'Não definido';
            if (resCount > comCount) perfilDesc = 'Residencial';
            else if (comCount > resCount) perfilDesc = 'Comercial';
            else if (resCount > 0 && resCount === comCount) perfilDesc = 'Misto';

            return {
               conf: { tx: txConf, canc: CountCancelou, liv: CountLivre, cli: CountCliente, nao: CountNao },
               falta: { tx: txFalta, qtd: CountFaltou },
               perf: { desc: perfilDesc, res: resCount, com: comCount }
            };
         };

         setProfMetricas(prev => ({
            ...prev,
            [profId]: {
               geral: calculatePeriodMetrics(dispData || [], atdData || []),
               d30: calculatePeriodMetrics(dispData || [], atdData || [], data30),
               d7: calculatePeriodMetrics(dispData || [], atdData || [], data7)
            }
         }));

      } catch (err) {
         console.error('Erro ao carregar métricas:', err);
      }
   };

   // Carrega métricas gerais da unidade
   const loadUnitMetrics = async () => {
      if (!selectedUnit?.unit_code) return;
      try {
         const now = new Date();
         const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
         const dataInicio = formatLocalISO(firstDayOfMonth);
         const dataFim = formatLocalISO(now);

         const { data, error } = await supabase
            .from('processed_data')
            .select('DATA, TIPO, SERVIÇO')
            .eq('unidade_code', selectedUnit.unit_code)
            .gte('DATA', dataInicio)
            .lte('DATA', dataFim);

         if (error) throw error;
         const rows = data as any[];
         if (rows) {
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(now.getDate() - 7);
            const dataSemana = formatLocalISO(sevenDaysAgo);
            const todayStr = formatLocalISO(now);

            setUnitMetrics({
               mes: rows.length,
               semana: rows.filter(a => a.DATA >= dataSemana).length,
               hoje: rows.filter(a => a.DATA === todayStr).length
            });
         }
      } catch (err) {
         console.error('Erro ao carregar métricas da unidade:', err);
      }
   };

   // Atualiza status manual da profissional para o dia
   // LIVRE → grava "LIVRE" no banco
   // Atualiza status da profissional para o dia/período
   const handleStatusUpdate = async (profId: string, newStatus: string, period: 'M' | 'T', dateStrOverride?: string) => {
      const dataStr = dateStrOverride ?? formatLocalISO(selectedDate);

      try {
         // Busca estado atual do banco
         const { data: currentEntry, error: fetchError } = await supabase
            .from('agenda_disponibilidade')
            .select('*')
            .eq('unit_id', selectedUnit.id)
            .eq('profissional_id', profId)
            .eq('data', dataStr)
            .maybeSingle();

         if (fetchError) throw fetchError;

         const statusCol = period === 'M' ? 'status_manha' : 'status_tarde';
         const outroStatusCol = period === 'M' ? 'status_tarde' : 'status_manha';

         // Verifica se o novo status é uma opção mobile de configuração de dia
         const isMobileOption = MOBILE_STATUS_OPTIONS.includes(newStatus);

         if (newStatus === 'LIMPAR') {
            // Sempre UPDATE com null para evitar falha silenciosa do DELETE (RLS exige auth)
            const { error } = await supabase
               .from('agenda_disponibilidade')
               .update({ [statusCol]: null })
               .eq('unit_id', selectedUnit.id)
               .eq('profissional_id', profId)
               .eq('data', dataStr);
            if (error) throw error;
         } else if (isMobileOption) {
            // Lógica ALINHADA com saveDisponibilidades (mobile)
            let statusM: string | null = null;
            let statusT: string | null = null;
            const periodos = [newStatus];

            if (newStatus === 'NÃO DISPONIVEL') {
               statusM = 'NÃO';
               statusT = 'NÃO';
            } else {
               if (PERIODOS_MANHA.includes(newStatus)) statusM = 'LIVRE';
               if (PERIODOS_TARDE.includes(newStatus)) statusT = 'LIVRE';
            }

            if (currentEntry) {
               const { error } = await supabase
                  .from('agenda_disponibilidade')
                  .update({
                     status_manha: statusM,
                     status_tarde: statusT,
                     periodos: periodos,
                     updated_at: new Date().toISOString()
                  })
                  .eq('id', currentEntry.id);
               if (error) throw error;
            } else {
               // Busca a settings_id ativa para correta vinculação (importante para paridade mobile)
               const { data: activeSettings } = await supabase
                  .from('agenda_settings')
                  .select('id')
                  .eq('unit_id', selectedUnit.id)
                  .order('created_at', { ascending: false })
                  .limit(1)
                  .maybeSingle();

               const { error } = await supabase
                  .from('agenda_disponibilidade')
                  .insert({
                     unit_id: selectedUnit.id,
                     profissional_id: profId,
                     data: dataStr,
                     settings_id: activeSettings?.id,
                     status_manha: statusM,
                     status_tarde: statusT,
                     periodos: periodos,
                  });
               if (error) throw error;
            }
         } else {
            const periodosExistentes = currentEntry?.periodos ?? [];
            const outroStatusExistente = currentEntry?.[outroStatusCol] ?? null;

            if (currentEntry) {
               const { error } = await supabase
                  .from('agenda_disponibilidade')
                  .update({ [statusCol]: newStatus })
                  .eq('unit_id', selectedUnit.id)
                  .eq('profissional_id', profId)
                  .eq('data', dataStr);
               if (error) throw error;
            } else {
               const { error } = await supabase
                  .from('agenda_disponibilidade')
                  .insert({
                     unit_id: selectedUnit.id,
                     profissional_id: profId,
                     data: dataStr,
                     [statusCol]: newStatus,
                     [outroStatusCol]: outroStatusExistente,
                     periodos: periodosExistentes,
                  });
               if (error) throw error;
            }
         }

         await Promise.all([
            loadProfissionaisConfig(),
            loadGestaoData()
         ]);
      } catch (err: any) {
         console.error('Erro ao atualizar status:', err);
         alert('Erro ao atualizar status: ' + (err.message || 'Erro no banco de dados.'));
      }
   };


   // Helper para calcular horário final baseada no período (horas)
   const calculateEndTime = (start: string, durationStr: any) => {
      if (!start) return '';
      const duration = parseInt(durationStr) || 0;
      const [hours, minutes] = start.split(':').map(Number);
      if (isNaN(hours)) return start;

      const endHours = (hours + duration) % 24;
      return `${String(endHours).padStart(2, '0')}:${String(minutes || 0).padStart(2, '0')}`;
   };

   const handleSaveConfig = async () => {
      if (!selectedUnit?.id) return;
      setIsSavingConfig(true);
      setError(null);
      try {
         const saved = await saveAgendaSettings(selectedUnit.id, configSettings);
         setConfigSettings(saved);
         alert('Configurações salvas com sucesso!');
      } catch (err) {
         console.error(err);
         setError('Erro ao salvar as configurações.');
      } finally {
         setIsSavingConfig(false);
      }
   };

   const toggleDiaVisual = (isoDateStr: string) => {
      const atual = configSettings.dias_liberados || [];
      const novo = atual.includes(isoDateStr)
         ? atual.filter((d: string) => d !== isoDateStr)
         : [...atual, isoDateStr];
      setConfigSettings({ ...configSettings, dias_liberados: novo });
   };

   const togglePeriodo = (periodo: string) => {
      const atual = configSettings.periodos_cadastrados || [];
      const novo = atual.includes(periodo) ? atual.filter((p: string) => p !== periodo) : [...atual, periodo];
      setConfigSettings({ ...configSettings, periodos_cadastrados: novo });
   };

   const linkAcessoPublico = selectedUnit
      ? `https://agenda.dromeflow.com/${selectedUnit.unit_code.toLowerCase().replace(/\s+/g, '-')}`
      : '';



   const [selectedAtendimento, setSelectedAtendimento] = useState<any>(null);
   // --------------------------------------------------------------------------
   // RENDER DYNAMICS
   // --------------------------------------------------------------------------

   // Custom Calendar Logic (Simples)
   const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
   const getFirstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

   const renderCalendar = () => {
      const year = selectedDate.getFullYear();
      const month = selectedDate.getMonth();
      const daysInMonth = getDaysInMonth(year, month);
      const firstDay = getFirstDayOfMonth(year, month);

      const days = [];
      for (let i = 0; i < firstDay; i++) {
         days.push(<div key={`empty-${i}`} className="p-2 opacity-10 text-center h-full"></div>);
      }

      for (let i = 1; i <= daysInMonth; i++) {
         const isSelected = selectedDate.getDate() === i;
         const dateObj = new Date(year, month, i);

         days.push(
            <div
               key={i}
               onClick={() => setSelectedDate(dateObj)}
               className={`h-full w-full min-h-[2.5rem] flex flex-col items-center justify-center text-sm sm:text-base cursor-pointer font-bold rounded-xl transition-all border
                ${isSelected
                     ? 'bg-accent-primary border-accent-primary text-text-on-accent shadow-md scale-[1.03] z-10'
                     : 'border-border-secondary text-text-secondary hover:bg-bg-tertiary hover:border-border-primary hover:scale-[1.03] bg-bg-primary'}`}
            >
               {i}
            </div>
         );
      }

      const monthStr = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(selectedDate);

      const prevMonth = () => setSelectedDate(new Date(year, month - 1, 1));
      const nextMonth = () => setSelectedDate(new Date(year, month + 1, 1));

      return (
         <div className="bg-bg-secondary rounded-xl border border-border-secondary overflow-hidden shadow-md p-3 flex flex-col h-full">
            {/* Calendar Header */}
            <div className="flex items-center justify-between mb-2 w-full px-2">
               <button onClick={prevMonth} className="p-2 hover:bg-bg-tertiary rounded-xl text-text-secondary transition-colors">
                  <Icon name="ChevronLeft" className="w-5 h-5" />
               </button>
               <div className="text-lg font-black tracking-tight text-text-primary capitalize">{monthStr}</div>
               <button onClick={nextMonth} className="p-2 hover:bg-bg-tertiary rounded-xl text-text-secondary transition-colors">
                  <Icon name="ChevronRight" className="w-5 h-5" />
               </button>
            </div>

            {/* Weekdays */}
            <div className="grid grid-cols-7 gap-2 mb-2 w-full px-2">
               {['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'].map(day => (
                  <div key={day} className="text-center text-[10px] sm:text-xs font-bold text-text-secondary py-1.5 bg-bg-tertiary rounded-lg uppercase tracking-wider">
                     {day}
                  </div>
               ))}
            </div>

            {/* Days Grid - auto-rows-fr stretches each row equally */}
            <div className="grid grid-cols-7 auto-rows-fr gap-2 flex-grow w-full px-2 pb-2">
               {days}
            </div>
         </div>
      );
   };

   // Quadro de Resumo Semanal (segunda a sábado da semana do dia selecionado)
   const renderWeekSummary = () => {
      // Calcula o intervalo de segunda a sábado da semana do dia selecionado
      const dow = selectedDate.getDay(); // 0=dom, 1=seg...
      const diffToMon = dow === 0 ? -6 : 1 - dow;
      const monday = new Date(selectedDate);
      monday.setDate(selectedDate.getDate() + diffToMon);

      // Gera array com os 6 dias (seg→sáb)
      const weekDays = Array.from({ length: 6 }, (_, i) => {
         const d = new Date(monday);
         d.setDate(monday.getDate() + i);
         return d;
      });

      const formatISO = (d: Date) => {
         const offset = d.getTimezoneOffset();
         const local = new Date(d.getTime() - offset * 60_000);
         return local.toISOString().split('T')[0];
      };

      const fmt = (d: Date) =>
         d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

      const firstDay = weekDays[0];
      const lastDay = weekDays[5];
      const headerLabel = `${fmt(firstDay)} a ${fmt(lastDay)}`;

      // bg sólido da célula de status + cor da fonte + cor do valor nas células de dia
      const labels = [
         { key: 'livre', label: 'Livre', bg: 'bg-green-500', fg: 'text-black', color: 'text-green-500' },
         { key: 'nao', label: 'Não', bg: 'bg-zinc-900', fg: 'text-white', color: 'text-zinc-400' },
         { key: 'cancelou', label: 'Cancelou', bg: 'bg-orange-500', fg: 'text-black', color: 'text-orange-500' },
         { key: 'faltou', label: 'Faltou', bg: 'bg-red-600', fg: 'text-white', color: 'text-red-500' },
         { key: 'cliente', label: 'Cliente', bg: 'bg-blue-500', fg: 'text-white', color: 'text-blue-400' },
         { key: 'possiveis', label: 'Possíveis', bg: 'bg-transparent', fg: 'text-black', color: 'text-blue-300', isMetric: true },
         { key: 'sistema', label: 'Sistema', bg: 'bg-transparent', fg: 'text-black', color: 'text-purple-400', isMetric: true },
         { key: 'aproveitamento', label: 'Aproveitamento', bg: 'bg-indigo-600', fg: 'text-white', color: 'text-indigo-400', isMetric: true },
      ];

      // Calcula métricas para cada dia
      const dayMetrics = weekDays.map(d => {
         const iso = formatISO(d);
         const disps = todasDisponibilidades.filter((disp: any) => {
            const dispDate = typeof disp.data === 'string' ? disp.data.split('T')[0] : formatISO(new Date(disp.data));
            return dispDate === iso;
         });

         const livre = disps.filter((dsp: any) =>
            dsp.status_manha === 'LIVRE' || dsp.status_tarde === 'LIVRE'
         ).length;

         const nao = disps.filter((dsp: any) =>
            dsp.status_manha === 'NÃO' || dsp.status_tarde === 'NÃO'
         ).length;

         const cancelou = disps.filter((dsp: any) =>
            dsp.status_manha === 'CANCELOU' || dsp.status_tarde === 'CANCELOU'
         ).length;

         const faltou = disps.filter((dsp: any) =>
            dsp.status_manha === 'FALTOU' || dsp.status_tarde === 'FALTOU'
         ).length;

         // Cliente: apenas atendimentos COM profissional alocado
         const cliente = atendimentosSemana.filter((a: any) => {
            const aDate = typeof a.DATA === 'string' && a.DATA.includes('T') ? a.DATA.split('T')[0] : a.DATA;
            return aDate === iso && !!a.PROFISSIONAL;
         }).length;

         // Sistema: TODOS os atendimentos do dia (com ou sem profissional)
         const sistema = atendimentosSemana.filter((a: any) => {
            const aDate = typeof a.DATA === 'string' && a.DATA.includes('T') ? a.DATA.split('T')[0] : a.DATA;
            return aDate === iso;
         }).length;

         const possiveis = livre + cliente;
         const aproveitamento = possiveis > 0 ? Math.round((sistema / possiveis) * 100) : 0;

         return { iso, livre, nao, cancelou, faltou, cliente, possiveis, sistema, aproveitamento };
      });

      const totals = dayMetrics.reduce(
         (acc, m) => ({
            livre: acc.livre + m.livre,
            nao: acc.nao + m.nao,
            cancelou: acc.cancelou + m.cancelou,
            faltou: acc.faltou + m.faltou,
            cliente: acc.cliente + m.cliente,
            possiveis: acc.possiveis + m.possiveis,
            sistema: acc.sistema + m.sistema,
            aproveitamento: 0 // Será calculado após o reduce
         }),
         { livre: 0, nao: 0, cancelou: 0, faltou: 0, cliente: 0, possiveis: 0, sistema: 0, aproveitamento: 0 }
      );
      totals.aproveitamento = totals.possiveis > 0 ? Math.round((totals.sistema / totals.possiveis) * 100) : 0;

      const DAY_LABELS = ['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];

      const isToday = (d: Date) => formatISO(d) === formatISO(new Date());
      const isSelected = (d: Date) => formatISO(d) === formatISO(selectedDate);

      const getCellValue = (m: typeof dayMetrics[0], key: string): number => {
         return (m as any)[key] ?? 0;
      };

      return (
         <div className="bg-bg-secondary rounded-xl border border-border-secondary overflow-hidden shadow-md p-3 flex flex-col h-full">
            {/* Header centralizado */}
            <div className="flex items-center justify-center gap-2 mb-2">
               <span className="text-sm font-bold text-text-primary capitalize">{headerLabel}</span>
               {loading && (
                  <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-accent-primary" />
               )}
            </div>

            {/* Weekdays Header — 8 colunas: Status + 6 dias + Total */}
            <div className="grid grid-cols-8 gap-1 mb-1">
               <div className="flex items-center justify-center text-center text-xs font-bold text-text-secondary py-1 bg-bg-tertiary rounded-md h-full">
                  Status
               </div>
               {weekDays.map((d, i) => (
                  <div
                     key={i}
                     className={`flex flex-col items-center justify-center p-1 text-center text-xs font-bold rounded-md h-full transition-all ${isSelected(d)
                        ? 'bg-accent-primary text-text-on-accent shadow-sm ring-1 ring-accent-primary/20'
                        : isToday(d)
                           ? 'bg-bg-tertiary text-text-primary'
                           : 'bg-bg-tertiary text-text-secondary'
                        }`}
                  >
                     <span className="block">{DAY_LABELS[i]}</span>
                     <span className="block font-medium text-[10px]">{fmt(d)}</span>
                  </div>
               ))}
               <div className="flex items-center justify-center text-center text-xs font-bold text-text-secondary py-1 bg-bg-tertiary rounded-md h-full">
                  Total
               </div>
            </div>

            {/* Metrics Grid — 8 colunas: status + 6 dias + total */}
            <div className="grid grid-cols-8 gap-1 sm:gap-1.5 flex-1 items-stretch">
               {labels.map(({ key, label, bg, fg, isMetric }) => (
                  <React.Fragment key={key}>
                     {/* Separador Visual para as Métricas Agregadas */}
                     {key === 'possiveis' && (
                        <div className="col-span-8 border-t-2 border-dashed border-border-secondary my-0" />
                     )}

                     {/* Label — bg sólido por status (fonte aumentada para text-xs) */}
                     <div className={`py-1 px-0.5 flex items-center justify-center text-center font-black uppercase tracking-tight rounded-md
                        ${key === 'possiveis' || key === 'sistema' ? 'text-[11px] sm:text-xs md:text-sm' : 'text-[9px] sm:text-[10px] md:text-xs'}
                        ${key === 'aproveitamento' ? '' : `${bg} ${fg} ${isMetric ? 'opacity-90' : ''}`}
                     `}>
                        {key === 'aproveitamento' ? '' : label}
                     </div>

                     {/* Células por dia */}
                     {dayMetrics.map((m, i) => {
                        const val = getCellValue(m, key);
                        const sel = isSelected(weekDays[i]);
                        const isAproveitamento = key === 'aproveitamento';
                        return (
                           <div
                              key={i}
                              onClick={!isAproveitamento ? () => setSelectedDate(weekDays[i]) : undefined}
                              className={`py-1 px-0.5 flex flex-col items-center justify-center text-center font-medium rounded-md transition-colors ${isAproveitamento
                                 ? (sel ? 'text-accent-primary font-bold text-lg sm:text-xl' : 'text-text-tertiary font-bold text-lg sm:text-xl')
                                 : `border cursor-pointer ${key === 'possiveis' || key === 'sistema' ? 'text-sm sm:text-base font-bold' : 'text-xs sm:text-sm'} ${sel
                                    ? (key === 'livre' && val >= 1
                                       ? 'bg-green-300 border-accent-primary text-black shadow-sm'
                                       : 'bg-accent-primary border-accent-primary text-text-on-accent shadow-sm')
                                    : val === 0
                                       ? `border-border-secondary text-text-tertiary/30 ${isMetric ? 'bg-bg-tertiary/40' : 'bg-bg-primary'}`
                                       : `border-border-secondary hover:bg-bg-tertiary/70 text-text-primary ${isMetric ? 'bg-bg-tertiary/40' : 'bg-bg-primary'}`
                                 }`
                                 }`}
                           >
                              {val}{isAproveitamento ? '%' : ''}
                           </div>
                        );
                     })}

                     {/* Total da linha */}
                     <div className={`py-1 px-0.5 flex items-center justify-center text-center font-black rounded-md ${key === 'aproveitamento'
                        ? 'text-text-tertiary text-base sm:text-lg'
                        : `border border-border-secondary ${key === 'possiveis' || key === 'sistema' ? 'text-sm sm:text-base' : 'text-xs sm:text-sm'} ${isMetric ? 'bg-bg-tertiary/60' : 'bg-bg-tertiary'} ${(totals as any)[key] === 0 ? 'text-text-tertiary/40' : 'text-text-primary'}`
                        }`}>
                        {(totals as any)[key]}{key === 'aproveitamento' ? '%' : ''}
                     </div>
                  </React.Fragment>
               ))}
            </div>
         </div>
      );
   };

   // States - Gestão
   const [selectedDate, setSelectedDate] = useState<Date>(new Date());
   const [calendarViewDate, setCalendarViewDate] = useState<Date>(new Date());
   const [hasSynced, setHasSynced] = useState(false);
   const [profissionaisLivres, setProfissionaisLivres] = useState<any[]>([]);
   const [atendimentosDia, setAtendimentosDia] = useState<any[]>([]);
   const [atendimentosSemana, setAtendimentosSemana] = useState<any[]>([]);
   const [dispSemanaCount, setDispSemanaCount] = useState<number>(0);
   const [filterSemProfissional, setFilterSemProfissional] = useState(false);

   // States - Gestão de Profissionais (Aba Configurações Lado C)
   const [todasProfissionais, setTodasProfissionais] = useState<any[]>([]);
   const [todasDisponibilidades, setTodasDisponibilidades] = useState<any[]>([]);
   const [profWithMetrics, setProfWithMetrics] = useState<string | null>(null);
   const [profMetricas, setProfMetricas] = useState<Record<string, any>>({});
   const [unitMetrics, setUnitMetrics] = useState<any>(null);
   const [activeFilter, setActiveFilter] = useState<FilterType>('TODOS');
   const [statusMenu, setStatusMenu] = useState<{ profId: string; period: StatusPeriod; dateStr: string } | null>(null);
   const [selectedSidebarAtendimento, setSelectedSidebarAtendimento] = useState<any>(null);
   // Modal de métricas da profissional (aberto por duplo-clique na tela de gestão)
   const [profModalData, setProfModalData] = useState<any | null>(null);
   const [activeMetricPeriod, setActiveMetricPeriod] = useState<'d7' | 'd30' | 'geral'>('d7');
   const [activeUnitMetric, setActiveUnitMetric] = useState<'responderam' | 'naoResponderam' | null>(null);

   const [profSearchTerm, setProfSearchTerm] = useState('');
   const [selectedProfDetails, setSelectedProfDetails] = useState<any | null>(null);

   // --------------------------------------------------------------------------
   // LÓGICA DE CARREGAMENTO
   // --------------------------------------------------------------------------

   // Efeito 1: Carregamento de Configurações (Apenas na mudança de Unidade ou Aba)
   useEffect(() => {
      if (selectedUnit?.id && selectedUnit.id !== 'ALL') {
         const loadConfigs = () => {
            if (activeTab === 'configuracoes') {
               loadSettings();
               loadUnitServices();
               loadProfissionaisConfig();
               loadUnitMetrics();
            } else {
               loadProfissionaisConfig();
            }
         };
         loadConfigs();
      }
   }, [selectedUnit, activeTab]);

   // Efeito 2: Carregamento de Dados de Gestão (Depende da Data Selecionada)
   useEffect(() => {
      if (selectedUnit?.id && selectedUnit.id !== 'ALL') {
         loadGestaoData();
      }
   }, [selectedUnit, selectedDate]);

   // Efeito 3: Realtime Subscription
   useEffect(() => {
      if (selectedUnit?.id && selectedUnit.id !== 'ALL') {
         const channel = supabase
            .channel('schema-db-changes')
            .on(
               'postgres_changes',
               { event: '*', schema: 'public', table: 'agenda_disponibilidade', filter: `unit_id=eq.${selectedUnit.id}` },
               () => {
                  if (activeTab === 'configuracoes') {
                     loadSettings();
                     loadProfissionaisConfig();
                  } else {
                     loadGestaoData();
                     loadProfissionaisConfig();
                  }
               }
            )
            .subscribe();

         return () => {
            supabase.removeChannel(channel);
         };
      }
   }, [selectedUnit, activeTab, selectedDate, selectedProfDetails]);

   // --------------------------------------------------------------------------
   // MAIN RENDER
   // --------------------------------------------------------------------------

   if (!selectedUnit || selectedUnit.id === 'ALL') {
      return (
         <div className="flex h-full items-center justify-center rounded-lg bg-bg-secondary p-6 shadow-md">
            <div className="text-center p-6 max-w-sm">
               <Icon name="Building" className="w-12 h-12 text-accent-primary mx-auto mb-4" />
               <h3 className="text-lg font-medium text-text-primary mb-2">Selecione uma Unidade</h3>
               <p className="text-sm text-text-secondary">
                  Para gerenciar a agenda e configurações, você precisa selecionar uma unidade específica no filtro global.
               </p>
            </div>
         </div>
      );
   }

   return (
      <div className="flex flex-col h-full space-y-6">

         {/* HEADER */}
         <div className="flex-shrink-0 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
               {activeTab === 'configuracoes' && (
                  <button
                     onClick={() => setActiveTab('gestao')}
                     className="p-1 hover:bg-bg-secondary rounded-lg text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
                     title="Voltar"
                  >
                     <Icon name="ArrowLeft" className="w-5 h-5" />
                  </button>
               )}
               <h1 className="text-2xl font-bold text-text-primary tracking-wider">Agenda Profissionais</h1>

               {activeTab === 'gestao' && (
                  <button
                     onClick={() => setActiveTab('configuracoes')}
                     className="p-2 rounded-full hover:bg-bg-tertiary transition-colors cursor-pointer group flex items-center justify-center border border-transparent hover:border-border-secondary"
                     title="Configurações da Agenda"
                  >
                     <Icon name="Settings" className="w-6 h-6 text-text-tertiary group-hover:text-accent-primary transition-colors" />
                  </button>
               )}
            </div>
            {activeTab === 'configuracoes' && (
               <span className="text-sm font-bold text-text-secondary pr-4">Configurações da Agenda - {selectedUnit.unit_name || (selectedUnit as any).name}</span>
            )}
         </div>

         {error && (
            <div className="p-4 bg-danger/10 border border-danger/30 text-danger rounded-lg mb-4">
               {error}
            </div>
         )}

         {/* TELA DE GESTÃO */}
         {activeTab === 'gestao' && (
            <div className="flex flex-col flex-1 gap-6 overflow-hidden">


               {/* MAIN GRID */}
               <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 flex-1 overflow-hidden">
                  
                  {/* LADO ESQUERDO/CENTRO: Calendario, Métricas e Profissionais Livres (75%) */}
                  <div className="lg:col-span-3 flex flex-col gap-4 overflow-hidden h-full">
                     
                     {/* Topo: Calendário (2/3) e Profissionais Livres (1/3) */}
                     <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 min-h-0" style={{ flex: 50 }}>
                        {/* Calendário */}
                        <div className="lg:col-span-2 overflow-hidden h-full">
                           {renderCalendar()}
                        </div>

                        {/* Profissionais Livres */}
                        <div
                           className="lg:col-span-1 bg-bg-secondary rounded-xl border border-border-secondary flex flex-col overflow-hidden"
                           onDragOver={handleDragOver}
                           onDrop={handleDropToProfissionais}
                        >
                           <div className="p-3 border-b border-border-secondary flex items-center justify-between shrink-0 bg-bg-tertiary">
                              <h3 className="font-bold flex items-center gap-2 text-sm text-text-primary">
                                 <Icon name="Users" className="w-4 h-4 text-text-secondary" />
                                 Profissionais Livres
                              </h3>
                           </div>
                           <div className="flex-1 overflow-y-auto p-3">
                        {loading ? (
                           <div className="flex items-center justify-center h-full">
                              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent-primary"></div>
                           </div>
                        ) : profissionaisLivres.length === 0 ? (
                           <div className="flex flex-col items-center justify-center h-full text-center text-text-tertiary">
                              <Icon name="Users" className="w-10 h-10 mx-auto mb-2 opacity-30" />
                              <p className="text-sm text-text-secondary">Nenhum profissional livre em {selectedDate.toLocaleDateString('pt-BR')}</p>
                           </div>
                        ) : (
                           <div className="w-full space-y-2">
                              {profissionaisLivres.map((p, i) => (
                                 <React.Fragment key={i}>
                                    <div
                                       draggable
                                       onDragStart={(e) => handleDragStartProfissional(e, p)}
                                       onClick={() => {
                                          if (selectedProfDetails?.profissional?.id === p.profissional?.id) {
                                             setSelectedProfDetails(null);
                                          } else {
                                             setSelectedProfDetails(p);
                                             if (p.profissional?.id) {
                                                loadProfissionalMetrics(p.profissional.id, p.profissional.nome);
                                             }
                                          }
                                       }}
                                       className={`p-3 bg-bg-tertiary border rounded-lg w-full cursor-pointer transition-all hover:shadow-md ${selectedProfDetails?.profissional?.id === p.profissional?.id ? 'border-accent-primary ring-1 ring-accent-primary/30 bg-accent-primary/5' : 'border-border-secondary hover:border-accent-primary'}`}
                                    >
                                       <p className="font-bold text-sm text-accent-primary">{p.profissional?.nome}</p>
                                       <p className="text-xs text-text-tertiary mt-1">Períodos: <span className="font-medium text-text-secondary">{p.periodos.join(', ')}</span></p>
                                    </div>

                                    {selectedProfDetails?.profissional?.id === p.profissional?.id && (
                                       <div className="bg-bg-primary border border-accent-primary/20 rounded-lg overflow-hidden flex flex-col animate-in slide-in-from-top-2 duration-300 my-2">
                                          <div className="p-2 bg-bg-tertiary border-b border-border-secondary flex items-center justify-between">
                                             <div className="flex items-center gap-2">
                                                <Icon name="Activity" className="w-3.5 h-3.5 text-accent-primary" />
                                                <span className="text-[10px] font-bold uppercase text-text-secondary">Desempenho</span>
                                             </div>
                                             <div className="flex items-center gap-1.5 px-1.5 py-0.5 bg-bg-primary border border-border-secondary rounded">
                                                <span className="text-[11px] font-black text-accent-primary">{profMetricas[selectedProfDetails.profissional?.id]?.geral?.conf?.tx || 0}%</span>
                                             </div>
                                          </div>

                                          <div className="p-3 space-y-3">
                                             <div className="grid grid-cols-3 gap-1.5">
                                                {['d7', 'd30', 'geral'].map((period: any) => {
                                                   const metrics = profMetricas[selectedProfDetails.profissional?.id];
                                                   const isActive = activeMetricPeriod === period;
                                                   return (
                                                      <button
                                                         key={period}
                                                         onClick={() => setActiveMetricPeriod(period)}
                                                         className={`py-1.5 rounded-lg border text-center transition-all ${isActive ? 'bg-accent-primary/10 border-accent-primary' : 'bg-bg-primary border-border-secondary'}`}
                                                      >
                                                         <p className={`text-[7px] uppercase font-bold ${isActive ? 'text-accent-primary' : 'text-text-tertiary'}`}>
                                                            {period === 'd7' ? '7D' : period === 'd30' ? '30D' : 'Ger'}
                                                         </p>
                                                         <p className={`text-[10px] font-black ${isActive ? 'text-accent-primary' : 'text-text-primary'}`}>
                                                            {metrics?.[period]?.conf?.tx || 0}%
                                                         </p>
                                                      </button>
                                                   );
                                                })}
                                             </div>

                                             <div className="space-y-2">
                                                <h5 className="text-[9px] font-bold text-accent-primary uppercase tracking-wider flex items-center gap-1.5">
                                                   <Icon name="CalendarClock" className="w-3 h-3" />
                                                   Atendimentos Hoje
                                                </h5>
                                                {(() => {
                                                   const atsHoje = atendimentosDia.filter(a => matchName(a.PROFISSIONAL, selectedProfDetails.profissional?.nome));
                                                   if (atsHoje.length === 0) {
                                                      return <p className="text-[9px] text-text-tertiary italic text-center py-1">Sem agendamentos</p>;
                                                   }
                                                   return (
                                                      <div className="space-y-1 max-h-[80px] overflow-y-auto">
                                                         {atsHoje.map((at, idx) => (
                                                            <div key={idx} className="p-1.5 bg-bg-secondary rounded border border-border-primary text-[9px]">
                                                               <span className="font-bold text-accent-primary">{at.HORARIO}</span> - {at.CLIENTE}
                                                            </div>
                                                         ))}
                                                      </div>
                                                   );
                                                })()}
                                             </div>
                                          </div>
                                       </div>
                                    )}
                                 </React.Fragment>
                              ))}
                           </div>
                        )}
                           </div>
                        </div>
                     </div>

                     {/* Base: Quadro Semanal de Métricas */}
                     <div className="min-h-0" style={{ flex: 50 }}>
                        {renderWeekSummary()}
                     </div>
                  </div>

                  {/* DIREITA: Atendimentos do Dia (25%) */}
                  <div className="lg:col-span-1 bg-bg-secondary rounded-xl border border-border-secondary flex flex-col overflow-hidden">
                     <div className="p-4 border-b border-border-secondary flex items-center justify-between shrink-0 bg-bg-tertiary">
                        <h3 className="font-bold flex items-center gap-2 text-sm text-text-primary">
                           <Icon name="CalendarCheck" className="w-4 h-4 text-text-secondary" />
                           Atendimentos - {selectedDate.toLocaleDateString('pt-BR')}
                        </h3>
                        <div className="flex items-center gap-2">
                           <button
                              onClick={() => setFilterSemProfissional(!filterSemProfissional)}
                              className={`p-1.5 rounded transition-colors ${filterSemProfissional ? 'bg-accent-primary text-text-on-accent' : 'bg-bg-secondary text-text-secondary hover:bg-bg-tertiary border border-border-secondary'}`}
                              title={filterSemProfissional ? "Remover filtro" : "Mostrar apenas sem profissional"}
                           >
                              <Icon name="Filter" className="w-3.5 h-3.5" />
                           </button>
                           <span className="text-xs bg-bg-secondary px-2 py-1 rounded text-text-secondary">{atendimentosDia.length}</span>
                        </div>
                     </div>
                     <div className="flex-1 overflow-y-auto p-4">
                        {loading ? (
                           <div className="flex items-center justify-center h-full">
                              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent-primary"></div>
                           </div>
                        ) : atendimentosDia.length === 0 ? (
                           <div className="flex flex-col items-center justify-center h-full text-center text-text-tertiary">
                              <Icon name="CalendarX" className="w-10 h-10 mx-auto mb-2 opacity-30" />
                              <p className="text-sm text-text-secondary">Nenhum atendimento agendado para este dia.</p>
                           </div>
                        ) : (
                           <div className="w-full space-y-2">
                              {atendimentosDia.filter(a => !filterSemProfissional || !a.PROFISSIONAL).length === 0 && filterSemProfissional ? (
                                 <div className="py-8 flex flex-col items-center justify-center text-center text-text-tertiary">
                                    <Icon name="UserCheck" className="w-8 h-8 opacity-30 mb-2" />
                                    <span className="text-sm text-text-secondary">Todos os atendimentos possuem profissional.</span>
                                 </div>
                              ) : (
                                 atendimentosDia.filter(a => !filterSemProfissional || !a.PROFISSIONAL).map((a, i) => {
                                    const horarioRaw = a.HORARIO || '';
                                    const horarioFormat = horarioRaw.match(/^(\d{1,2}:\d{2})/) ? horarioRaw.match(/^(\d{1,2}:\d{2})/)[1] : horarioRaw;

                                    return (
                                       <div
                                          key={i}
                                          onDragOver={handleDragOver}
                                          onDrop={(e) => handleDropOnAtendimento(e, a)}
                                          className="p-3 bg-bg-tertiary border border-border-secondary rounded-lg hover:border-text-secondary transition-colors"
                                       >
                                          {/* Linha 1: Horário, Período | Tipo e Status */}
                                          <div className="flex justify-between items-center mb-1">
                                             <div className="flex items-center gap-2">
                                                <span className="text-xs font-bold text-text-primary bg-bg-primary px-2 py-0.5 rounded">{horarioFormat}</span>
                                                <span className="text-xs font-medium text-text-secondary">{a['PERÍODO'] ? `${a['PERÍODO']} horas` : ''}</span>
                                             </div>
                                             <div className="flex items-center gap-2">
                                                <span className="text-[10px] uppercase font-bold text-text-tertiary border border-border-secondary px-1.5 py-0.5 rounded-full">{a.TIPO || 'Sem Tipo'}</span>
                                                <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded-full ${a.STATUS === 'CONFIRMADO' || a.STATUS === 'CONCLUIDO' || a.STATUS === 'FINALIZADO' ? 'bg-success text-text-on-accent border border-success/80' :
                                                   a.STATUS === 'AGUARDANDO' ? 'bg-blue-500/10 text-blue-500 border border-blue-400/40' :
                                                      a.STATUS === 'PENDENTE' ? 'bg-warning text-black border border-warning/80' :
                                                         a.STATUS === 'CANCELADO' || a.STATUS === 'RECUSADO' ? 'bg-rose-500/10 text-rose-500 border border-rose-500/40' :
                                                            'bg-bg-primary text-text-tertiary border border-border-secondary'
                                                   }`}>
                                                   {a.STATUS || 'Pendente'}
                                                </span>
                                             </div>
                                          </div>

                                          {/* Linha 2: Cliente */}
                                          <div className="flex justify-center items-center mb-2">
                                             <p className="font-bold text-sm text-text-primary truncate text-center" title={a.CLIENTE}>{a.CLIENTE}</p>
                                          </div>

                                          {/* Linha 3: Profissional Alocada (Drag and Drop) */}
                                          <div className="mt-2 text-right flex">
                                             {a.PROFISSIONAL ? (
                                                <div
                                                   draggable
                                                   onDragStart={(e) => handleDragStartRemoveProfissional(e, a)}
                                                   className="flex-1 inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 bg-accent-primary/10 border border-accent-primary/30 rounded-lg cursor-grab active:cursor-grabbing text-accent-primary text-xs font-bold transition-transform hover:scale-[1.02]"
                                                   title="Arraste para remover"
                                                >
                                                   <Icon name="UserCheck" className="w-3.5 h-3.5" />
                                                   {a.PROFISSIONAL}
                                                </div>
                                             ) : (
                                                <div className="flex-1 text-xs text-text-tertiary italic flex items-center justify-center gap-1.5 p-1.5 border border-dashed border-border-secondary rounded-lg bg-bg-primary/30">
                                                   <Icon name="UserPlus" className="w-3.5 h-3.5 opacity-50" />
                                                   Posicionar profissional
                                                </div>
                                             )}
                                          </div>
                                       </div>
                                    )
                                 })
                              )}
                           </div>
                        )}
                     </div>
                  </div>
               </div>
            </div>
         )}

         {/* TELA DE CONFIGURAÇÕES */}
         {activeTab === 'configuracoes' && configSettings && (
            <div className="flex flex-col flex-1 bg-bg-secondary rounded-xl border border-border-secondary overflow-y-auto p-6">

               {/* TOPO DA CONFIGURAÇÃO (Abas) */}
               <div className="flex items-center justify-between border-b border-border-secondary pb-4 mb-8">
                  <div className="flex gap-4">
                     <button
                        onClick={() => setConfigTab('metricas')}
                        className={`flex items-center gap-2 px-4 py-2 border-b-2 font-bold transition-colors cursor-pointer ${configTab === 'metricas' ? 'border-accent-primary text-accent-primary' : 'border-transparent text-text-secondary hover:text-text-primary'}`}
                     >
                        <Icon name="Users" className="w-5 h-5" />
                        Disponibilidades
                     </button>
                     <button
                        onClick={() => setConfigTab('parametros')}
                        className={`flex items-center gap-2 px-4 py-2 border-b-2 font-bold transition-colors cursor-pointer ${configTab === 'parametros' ? 'border-accent-primary text-accent-primary' : 'border-transparent text-text-secondary hover:text-text-primary'}`}
                     >
                        <Icon name="Settings" className="w-5 h-5" />
                        Configuração
                     </button>
                  </div>

                  {configTab === 'parametros' && (
                     <div className="flex items-center gap-3">
                        <button
                           onClick={handleSaveConfig}
                           disabled={isSavingConfig}
                           className="px-4 py-2 bg-accent-primary hover:bg-accent-primary/90 text-text-on-accent text-xs font-bold rounded-lg shadow-md transition-all active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                           <Icon name="Save" className="w-3.5 h-3.5" />
                           {isSavingConfig ? 'Salvando...' : 'Salvar Alterações'}
                        </button>

                        <div className="bg-bg-tertiary px-3 py-1.5 rounded-xl border border-border-secondary flex items-center gap-3">
                           <p className="text-[10px] text-brand-cyan font-mono truncate max-w-[150px]">
                              {linkAcessoPublico?.split('/').pop() || 'Link'}
                           </p>
                           <button
                              onClick={() => {
                                 navigator.clipboard.writeText(linkAcessoPublico);
                                 alert('Link copiado!');
                              }}
                              className="p-1.5 bg-bg-secondary hover:bg-bg-tertiary rounded-lg text-text-primary transition-colors shrink-0"
                              title="Copiar Link"
                           >
                              <Icon name="Copy" className="w-3.5 h-3.5" />
                           </button>
                        </div>
                     </div>
                  )}

                  {configTab === 'metricas' && (
                     <div className="flex items-center gap-3 bg-bg-tertiary px-3 py-1.5 rounded-xl border border-border-secondary">
                        <button
                           onClick={() => {
                              const d = new Date(selectedDate);
                              d.setDate(d.getDate() - 7);
                              setSelectedDate(d);
                           }}
                           className="p-1 hover:bg-bg-secondary rounded-lg text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
                        >
                           <Icon name="ChevronLeft" className="w-5 h-5" />
                        </button>
                        <div className="flex items-center gap-2 px-2 text-sm font-bold text-text-primary min-w-[120px] justify-center text-center">
                           <Icon name="Calendar" className="w-4 h-4 text-accent-primary" />
                           {selectedDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                        </div>
                        <button
                           onClick={() => {
                              const d = new Date(selectedDate);
                              d.setDate(d.getDate() + 7);
                              setSelectedDate(d);
                           }}
                           className="p-1 hover:bg-bg-secondary rounded-lg text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
                        >
                           <Icon name="ChevronRight" className="w-5 h-5" />
                        </button>
                     </div>
                  )}
               </div>

               {configTab === 'parametros' && (
                  <div className="flex flex-col lg:flex-row gap-8">

                     {/* COLUNA 1: Configurações (Lado Esquerdo) */}
                     <div className="flex-1 space-y-8 max-w-2xl">

                        <div className="space-y-4">
                           <div className="bg-bg-secondary p-10 rounded-xl border border-border-secondary shadow-md flex justify-center items-center">
                              <div className="w-full">
                                 {/* Header do Calendário de Configuração */}
                                 <div className="flex items-center justify-between mb-2">
                                    <p className="text-[10px] font-black text-text-tertiary uppercase tracking-widest">
                                       Selecione os dias disponíveis
                                    </p>
                                    <button
                                       onClick={() => setConfigSettings({ ...configSettings, dias_liberados: [] })}
                                       className="text-[10px] font-bold text-rose-500 hover:text-rose-600 bg-rose-500/10 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5"
                                    >
                                       <Icon name="Trash2" className="w-3 h-3" />
                                       LIMPAR SELEÇÃO
                                    </button>
                                 </div>
                                 <div className="flex items-center justify-between mb-6">
                                    <button
                                       onClick={() => setCalendarViewDate(new Date(calendarViewDate.getFullYear(), calendarViewDate.getMonth() - 1, 1))}
                                       className="p-3 hover:bg-bg-tertiary rounded-xl text-text-secondary transition-colors"
                                    >
                                       <Icon name="ChevronLeft" className="w-6 h-6" />
                                    </button>
                                    <div className="text-xl font-black text-text-primary capitalize tracking-tight">
                                       {new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(calendarViewDate)}
                                    </div>
                                    <button
                                       onClick={() => setCalendarViewDate(new Date(calendarViewDate.getFullYear(), calendarViewDate.getMonth() + 1, 1))}
                                       className="p-3 hover:bg-bg-tertiary rounded-xl text-text-secondary transition-colors"
                                    >
                                       <Icon name="ChevronRight" className="w-6 h-6" />
                                    </button>
                                 </div>

                                 {/* Dias da Semana */}
                                 <div className="grid grid-cols-7 gap-3 mb-4">
                                    {['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'].map(day => (
                                       <div key={day} className="text-center text-xs font-bold text-text-tertiary py-2 bg-bg-tertiary/50 rounded-lg uppercase tracking-widest">
                                          {day}
                                       </div>
                                    ))}
                                 </div>

                                 {/* Grid de Dias */}
                                 <div className="grid grid-cols-7 gap-3">
                                    {Array.from({ length: new Date(calendarViewDate.getFullYear(), calendarViewDate.getMonth(), 1).getDay() }).map((_, i) => (
                                       <div key={`empty-${i}`} />
                                    ))}
                                    {Array.from({ length: new Date(calendarViewDate.getFullYear(), calendarViewDate.getMonth() + 1, 0).getDate() }).map((_, i) => {
                                       const day = i + 1;
                                       const dateObj = new Date(calendarViewDate.getFullYear(), calendarViewDate.getMonth(), day);
                                       const isoStr = formatLocalISO(dateObj);
                                       const isSelected = configSettings.dias_liberados.includes(isoStr);

                                       // Verificar se é uma data passada
                                       const hoje = new Date();
                                       hoje.setHours(0, 0, 0, 0);
                                       const isPast = dateObj < hoje;

                                       return (
                                          <div
                                             key={day}
                                             onClick={() => !isPast && toggleDiaVisual(isoStr)}
                                             className={`h-16 flex items-center justify-center text-base font-bold rounded-xl transition-all border
                                               ${isPast
                                                   ? 'opacity-20 cursor-not-allowed bg-bg-tertiary border-transparent text-text-tertiary'
                                                   : isSelected
                                                      ? 'bg-accent-primary border-accent-primary text-text-on-accent shadow-[0_4px_12px_rgba(var(--accent-primary-rgb),0.3)] scale-[1.02] z-10'
                                                      : 'border-border-secondary text-text-secondary hover:bg-bg-tertiary hover:border-border-primary hover:scale-[1.02] bg-bg-primary'}`}
                                          >
                                             {day}
                                          </div>
                                       );

                                    })}
                                 </div>
                              </div>
                           </div>
                        </div>

                     </div>

                     {/* COLUNA 2: Preview Mobile (Lado Direito) */}
                     <div className="flex-1 flex justify-center items-start lg:sticky lg:top-0">
                        <AgendaMobilePreview
                           settings={configSettings}
                           unitName={selectedUnit.unit_name}
                        />
                     </div>
                  </div>
               )}

               {configTab === 'metricas' && (() => {
                  const getWeekDates = (baseDate: Date) => {
                     const start = new Date(baseDate);
                     const day = start.getDay();
                     // Ajusta para a segunda-feira da semana (Se domingo=0 facamos +1 para segunda=1)
                     const diffToSeg = day === 0 ? -6 : 1 - day;
                     start.setDate(start.getDate() + diffToSeg);

                     return Array.from({ length: 6 }, (_, i) => { // Apenas 6 dias (Seg-Sáb)
                        const current = new Date(start);
                        current.setDate(start.getDate() + i);
                        return { iso: formatLocalISO(current), date: current };
                     });
                  };
                  const weekDatesMap = getWeekDates(selectedDate);

                  return (
                     <div className="flex flex-col h-[calc(100vh-250px)]">
                        {/* LADO ÚNICO: TABELA SEMANAL */}
                        <div className="flex flex-col bg-bg-secondary rounded-2xl border border-border-secondary overflow-hidden flex-1">
                           {/* CABEÇALHO DA TABELA */}
                           <div className="p-4 bg-bg-tertiary border-b border-border-secondary flex flex-wrap items-center justify-between gap-4">
                              <div className="flex items-center gap-2">
                                 {(['TODOS', 'CLIENTE', 'LIVRE', 'NÃO', 'FALTOU', 'CANCELOU'] as const).map(f => (
                                    <button
                                       key={f}
                                       onClick={() => setActiveFilter(f)}
                                       className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all border ${activeFilter === f
                                          ? 'bg-accent-primary border-accent-primary text-text-on-accent shadow-lg'
                                          : 'bg-bg-primary border-border-primary text-text-tertiary hover:border-accent-primary/50'
                                          }`}
                                    >
                                       {f}
                                    </button>
                                 ))}
                              </div>

                              <div className="flex-1 min-w-[150px] max-w-xs mx-auto lg:mx-0">
                                 <div className="relative">
                                    <Icon name="Search" className="w-4 h-4 text-text-tertiary absolute left-3 top-1/2 -translate-y-1/2" />
                                    <input
                                       type="text"
                                       placeholder="Buscar profissional..."
                                       value={profSearchTerm}
                                       onChange={e => setProfSearchTerm(e.target.value)}
                                       className="w-full pl-9 pr-3 py-1.5 bg-bg-primary border border-border-primary rounded-lg text-xs text-text-primary placeholder:text-text-tertiary focus:border-accent-primary focus:ring-1 focus:ring-accent-primary/20 transition-all outline-none"
                                    />
                                 </div>
                              </div>

                              <div className="text-[10px] font-bold text-text-tertiary uppercase flex items-center gap-4">
                                 <div className="flex items-center gap-2">
                                    <Icon name="Users" className="w-3 h-3" />
                                    {todasProfissionais.length} Profissionais
                                 </div>
                              </div>
                           </div>

                           {/* TABELA SCROLLABLE FULL WIDTH */}
                           <div className="flex-1 overflow-auto">
                              <div className="min-w-[1200px] overflow-visible">
                                 {/* HEADER DAS COLUNAS */}
                                 <div className="sticky top-0 z-20 bg-bg-tertiary/95 backdrop-blur-sm border-b border-border-secondary flex px-2 py-2">
                                    <div className="w-[280px] shrink-0 px-3 text-[10px] font-bold uppercase tracking-wider text-text-tertiary flex items-center">
                                       Profissional
                                    </div>
                                    <div className="flex-1 flex border-l border-border-secondary/40">
                                       {weekDatesMap.map((wd) => {
                                          const dayName = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'][wd.date.getDay()];
                                          const isToday = wd.iso === formatLocalISO(new Date());
                                          const isSelectedDay = wd.iso === formatLocalISO(selectedDate);

                                          return (
                                             <div
                                                key={wd.iso}
                                                onClick={() => setSelectedDate(wd.date)}
                                                className={`flex-1 flex flex-col items-center justify-center border-r border-border-secondary/40 py-1 cursor-pointer transition-all
                                                   ${isSelectedDay ? 'bg-accent-primary/10' : isToday ? 'bg-accent-primary/5' : ''} 
                                                   ${isSelectedDay ? 'bg-accent-primary text-text-on-accent' : ''}`}
                                             >
                                                <span className={`text-[10px] font-bold uppercase ${isSelectedDay ? 'text-text-on-accent' : isToday ? 'text-accent-primary' : 'text-text-tertiary'}`}>
                                                   {dayName} {wd.date.getDate().toString().padStart(2, '0')}/{(wd.date.getMonth() + 1).toString().padStart(2, '0')}
                                                </span>
                                                <div className={`flex w-full mt-1 border-t ${isSelectedDay ? 'border-text-on-accent/20' : 'border-border-secondary/20'}`}>
                                                   <span className={`flex-1 text-center text-[8px] font-bold uppercase pt-1 border-r ${isSelectedDay ? 'border-text-on-accent/20 text-text-on-accent/60' : 'border-border-secondary/20 text-text-tertiary'}`}>MAN</span>
                                                   <span className={`flex-1 text-center text-[8px] font-bold uppercase pt-1 ${isSelectedDay ? 'text-text-on-accent/60' : 'text-text-tertiary'}`}>TAR</span>
                                                </div>
                                             </div>
                                          );
                                       })}
                                    </div>
                                 </div>

                                 <div className="flex flex-col p-2 gap-1 pb-32">
                                    {loading ? (
                                       <div className="py-20 flex flex-col items-center justify-center text-text-tertiary">
                                          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-accent-primary mb-4"></div>
                                          <p className="text-xs font-bold uppercase tracking-widest opacity-60">Carregando Agenda...</p>
                                       </div>
                                    ) : ((() => {
                                       const filteredProfs = todasProfissionais.filter(p => {
                                          if (!p.id) return false;
                                          if (profSearchTerm && !p.nome?.toLowerCase().includes(profSearchTerm.toLowerCase())) return false;

                                          // Filtros de Status (Baseado na semana visível)
                                          if (activeFilter === 'TODOS') return true;

                                          if (activeFilter === 'CLIENTE') {
                                             return atendimentosSemana.some(a => matchName(a.PROFISSIONAL, p.nome));
                                          }

                                          if (activeFilter === 'LIVRE') {
                                             return todasDisponibilidades.some(d =>
                                                d.profissional_id === p.id &&
                                                (d.status_manha === 'LIVRE' || d.status_tarde === 'LIVRE') &&
                                                weekDatesMap.some(wd => matchDate(d.data, wd.iso))
                                             );
                                          }

                                          if (activeFilter === 'NÃO') {
                                             return todasDisponibilidades.some(d =>
                                                d.profissional_id === p.id &&
                                                (d.status_manha === 'NÃO' || d.status_tarde === 'NÃO') &&
                                                weekDatesMap.some(wd => matchDate(d.data, wd.iso))
                                             );
                                          }

                                          if (activeFilter === 'FALTOU') {
                                             return todasDisponibilidades.some(d =>
                                                d.profissional_id === p.id &&
                                                (d.status_manha === 'FALTOU' || d.status_tarde === 'FALTOU') &&
                                                weekDatesMap.some(wd => matchDate(d.data, wd.iso))
                                             );
                                          }

                                          if (activeFilter === 'CANCELOU') {
                                             return todasDisponibilidades.some(d =>
                                                d.profissional_id === p.id &&
                                                (d.status_manha === 'CANCELOU' || d.status_tarde === 'CANCELOU') &&
                                                weekDatesMap.some(wd => matchDate(d.data, wd.iso))
                                             );
                                          }

                                          return true;
                                       });

                                       if (filteredProfs.length === 0) {
                                          return (
                                             <div className="py-20 text-center text-text-tertiary opacity-40">
                                                <Icon name="SearchX" className="w-12 h-12 mx-auto mb-4" />
                                                <p className="font-bold uppercase tracking-widest text-xs">Nenhum resultado para o filtro selecionado</p>
                                             </div>
                                          );
                                       }

                                       return filteredProfs.map(prof => {
                                          const isSelected = profWithMetrics === prof.id;

                                          // Usaremos atendimentos da semana inteira para verificar filtros gerais, se for preciso.
                                          const atsSemanaProf = atendimentosSemana.filter(a => matchName(a.PROFISSIONAL, prof.nome));
                                          // O filtro já foi aplicado acima no filteredProfs.filter, então aqui apenas renderizamos todos que restaram.

                                          return (
                                             <div key={prof.id} className={`group bg-bg-primary rounded-xl border transition-all duration-200 h-10 flex border-border-primary hover:border-border-secondary shadow-sm ${statusMenu?.profId === prof.id ? 'relative z-50' : 'relative z-0'} ${isSelected ? 'border-accent-primary ring-1 ring-accent-primary' : ''}`}>
                                                {/* COLUNA NOME */}
                                                <div
                                                   className={`w-[280px] shrink-0 border-r border-border-secondary py-1 px-3 flex flex-col justify-center cursor-pointer transition-colors sticky left-0 z-10 bg-bg-primary rounded-l-xl hover:bg-bg-tertiary/50 ${isSelected ? 'bg-accent-primary/10' : ''}`}
                                                   onClick={() => {
                                                      setProfWithMetrics(isSelected ? null : prof.id);
                                                      if (!isSelected) {
                                                         loadProfissionalMetrics(prof.id, prof.nome);
                                                      }
                                                   }}
                                                >
                                                   <span className="font-bold text-xs truncate text-text-primary">{prof.nome}</span>
                                                   <span className="text-[9px] uppercase truncate text-text-tertiary">{prof.habilidade}</span>
                                                </div>

                                                {/* COLUNAS DOS DIAS */}
                                                <div className="flex-1 flex border-l border-border-secondary/40 items-stretch">
                                                   {weekDatesMap.map((wd) => {
                                                      const isToday = wd.iso === formatLocalISO(new Date());
                                                      const isSelectedDay = wd.iso === formatLocalISO(selectedDate);
                                                      const disp = todasDisponibilidades.find(d => d.profissional_id === prof.id && matchDate(d.data, wd.iso));
                                                      const atsDia = atsSemanaProf.filter(a => matchDate(a.DATA, wd.iso));

                                                      const getPeriodStatus = (startH: number, endH: number) => {
                                                         const statusCol = startH < 13 ? 'status_manha' : 'status_tarde';
                                                         const manualStatus = disp?.[statusCol];

                                                         // Prioridade 1: Status manual
                                                         if (manualStatus && manualStatus !== 'LIVRE') {
                                                            let finalColor = 'bg-[#F97316] text-black shadow-sm';
                                                            let hasConflict = false;
                                                            if (manualStatus === 'CANCELOU') finalColor = 'bg-[#F97316] text-black shadow-sm';
                                                            else if (manualStatus === 'FALTOU') finalColor = 'bg-[#EF4444] text-white shadow-sm';
                                                            else if (manualStatus === 'NÃO') {
                                                               finalColor = 'bg-[#1A1A1A] text-white shadow-sm';
                                                               if (true) { // Sempre verifica conflito proativamente
                                                                  const hasOverlap = atsDia.some(at => {
                                                                     const [atStH] = (at.HORARIO || '0:0').split(':').map(Number);
                                                                     const dur = parseFloat(at['PERÍODO'] || '0');
                                                                     return atStH < endH && (atStH + dur) > startH;
                                                                  });
                                                                  if (hasOverlap) {
                                                                     finalColor = 'bg-[#1A1A1A] text-white shadow-sm ring-2 ring-red-500 ring-inset flex gap-1';
                                                                     hasConflict = true;
                                                                  }
                                                               }
                                                            }
                                                            return { label: manualStatus, color: finalColor, hasConflict };
                                                         }

                                                         // Prioridade 2: Atendimentos agendados
                                                         const fullDayAt = atsDia.find(at => {
                                                            const dur = parseFloat(at['PERÍODO'] || '0');
                                                            return dur === 6 || dur === 8;
                                                         });

                                                         if (fullDayAt) {
                                                            const dur = parseFloat(fullDayAt['PERÍODO']);
                                                            return { label: 'CLIENTE', color: 'bg-[#3B82F6] text-white shadow-sm', period: `${dur} horas` };
                                                         }

                                                         const hasOverlap = atsDia.some(at => {
                                                            const [atStH] = (at.HORARIO || '0:0').split(':').map(Number);
                                                            const dur = parseFloat(at['PERÍODO'] || '0');
                                                            return atStH < endH && (atStH + dur) > startH;
                                                         });
                                                         if (hasOverlap) return { label: 'CLIENTE', color: 'bg-[#3B82F6] text-white shadow-sm' };

                                                         // Prioridade 3/4: Regras via link de horários (se houver) -> aqui simplificamos as the period lists may not immediately apply smoothly or are parsed. We fallback to manual.
                                                         const periodosList: string[] = disp?.periodos ?? [];
                                                         const isLivreViaLink = startH < 13
                                                            ? periodosList.some((p: string) => PERIODOS_MANHA.includes(p))
                                                            : periodosList.some((p: string) => PERIODOS_TARDE.includes(p));
                                                         if (manualStatus === 'LIVRE' || (!manualStatus && isLivreViaLink)) {
                                                            const currentPeriods = startH < 13 ? PERIODOS_MANHA : PERIODOS_TARDE;
                                                            const periodLabel = periodosList.find((p: string) => currentPeriods.includes(p));
                                                            return { label: 'LIVRE', color: 'bg-[#4ADE80] text-black shadow-sm', period: periodLabel };
                                                         }

                                                         const isNaoViaLink = periodosList.some((p: string) => PERIODOS_NAO.includes(p));
                                                         if (!manualStatus && isNaoViaLink) {
                                                            return { label: 'NÃO', color: 'bg-[#1A1A1A] text-white shadow-sm' };
                                                         }

                                                         return { label: '—', color: 'bg-bg-tertiary text-text-tertiary', data: null };
                                                      };

                                                      const mStatus = getPeriodStatus(6, 13);
                                                      const tStatus = getPeriodStatus(13, 20);

                                                      // Unificação: Se for 8h (mesmo atendimento ou ambos NÃO)
                                                      const isUnified = (mStatus.label === tStatus.label && (mStatus.label === 'CLIENTE' || mStatus.label === 'NÃO' || mStatus.label === 'LIVRE' || mStatus.label === 'FALTOU' || mStatus.label === 'CANCELOU')) ||
                                                         (mStatus.label === 'CLIENTE' && tStatus.label === 'CLIENTE');

                                                      // Helper para tooltip
                                                      const getTooltip = (status: any, ats: any[]) => {
                                                         if (status.label === 'LIVRE' && status.period) return status.period;
                                                         if (status.label !== 'CLIENTE') return undefined;
                                                         const at = ats[0]; // Pega o primeiro agendamento do periodo
                                                         if (!at) return status.period;
                                                         let text = `Cliente: ${at.CLIENTE || 'N/A'}\nHorário: ${at.HORARIO}\nLançamento: ${at['LANÇAMENTO'] || at.INICIO || 'N/A'}\nServiço: ${at['SERVIÇO']}\nPeríodo: ${at['PERÍODO']}`;
                                                         if (status.period) text += `\nConfiguração: ${status.period}`;
                                                         return text;
                                                      };
                                                      return (
                                                         <div key={wd.iso} className={`flex-1 flex border-r border-border-secondary/40 relative ${isSelectedDay ? 'bg-accent-primary/10' : isToday ? 'bg-accent-primary/5' : ''}`}>
                                                            {isUnified ? (
                                                               <div
                                                                  title={getTooltip(mStatus, atsDia)}
                                                                  onClick={(e) => {
                                                                     if ((e.target as HTMLElement).closest('[data-menu]')) return;
                                                                     setStatusMenu(statusMenu?.profId === prof.id && statusMenu?.period === 'M' && statusMenu?.dateStr === wd.iso ? null : { profId: prof.id, period: 'M', dateStr: wd.iso });
                                                                  }}
                                                                  className={`flex-1 flex items-center justify-center text-[9px] font-bold uppercase cursor-pointer transition-all hover:brightness-110 ${mStatus.color}`}
                                                               >
                                                                  {mStatus.label}
                                                                  {statusMenu?.profId === prof.id && statusMenu?.period === 'M' && statusMenu?.dateStr === wd.iso && (
                                                                     <div data-menu className="absolute top-full left-0 mt-1 z-[100] bg-bg-secondary border border-border-secondary rounded-md shadow-lg py-1 min-w-[170px] animate-in slide-in-from-top-1">
                                                                        {/* Se ambos estiverem vazios, mostra configuração inicial tipo mobile */}
                                                                        {mStatus.label === '—' && (
                                                                           <>
                                                                              <div className="px-3 py-1 text-[9px] font-bold text-text-tertiary uppercase border-b border-border-secondary/40 mb-1">Configuração Inicial</div>
                                                                              {MOBILE_STATUS_OPTIONS.map(opt => (
                                                                                 <button
                                                                                    key={opt}
                                                                                    onClick={(ev) => { ev.stopPropagation(); handleStatusUpdate(prof.id, opt, 'M', wd.iso); setStatusMenu(null); }}
                                                                                    className="w-full px-4 py-2 text-left text-[11px] font-medium text-text-primary hover:bg-bg-tertiary transition-colors uppercase"
                                                                                 >{opt}</button>
                                                                              ))}
                                                                              <div className="h-px bg-border-secondary/40 my-1" />
                                                                           </>
                                                                        )}
                                                                        {STATUS_OPTIONS.map(s => {
                                                                           const currentStatus = disp?.status_manha;
                                                                           const isActive = s === 'LIMPAR' ? !currentStatus : currentStatus === s;
                                                                           return (
                                                                              <button
                                                                                 key={s}
                                                                                 onClick={(ev) => { ev.stopPropagation(); handleStatusUpdate(prof.id, s, 'M', wd.iso); setStatusMenu(null); }}
                                                                                 className={`w-full px-4 py-2 text-left text-[11px] font-bold uppercase transition-colors ${isActive ? "bg-accent-primary text-white" : "text-text-primary hover:bg-bg-tertiary"}`}
                                                                              >{STATUS_LABELS[s].label}</button>
                                                                           );
                                                                        })}
                                                                     </div>
                                                                  )}
                                                               </div>
                                                            ) : (
                                                               <>
                                                                  {/* MANHÃ */}
                                                                  <div
                                                                     title={getTooltip(mStatus, atsDia.filter(a => (parseFloat(a.HORARIO?.split(':')[0] || '0') < 13)))}
                                                                     onClick={(e) => {
                                                                        if ((e.target as HTMLElement).closest('[data-menu]')) return;
                                                                        setStatusMenu(statusMenu?.profId === prof.id && statusMenu?.period === 'M' && statusMenu?.dateStr === wd.iso ? null : { profId: prof.id, period: 'M', dateStr: wd.iso });
                                                                     }}
                                                                     className={`flex-1 flex items-center justify-center text-[9px] font-bold uppercase cursor-pointer border-r border-border-secondary/20 transition-all hover:brightness-110 ${mStatus.color}`}
                                                                  >
                                                                     {mStatus.label}
                                                                     {statusMenu?.profId === prof.id && statusMenu?.period === 'M' && statusMenu?.dateStr === wd.iso && (
                                                                        <div data-menu className="absolute top-full left-0 mt-1 z-[100] bg-bg-secondary border border-border-secondary rounded-md shadow-lg py-1 min-w-[170px] animate-in slide-in-from-top-1">
                                                                           {/* Se ambos estiverem vazios, mostra APENAS configuração inicial tipo mobile */}
                                                                           {mStatus.label === '—' ? (
                                                                              <>
                                                                                 <div className="px-3 py-1 text-[9px] font-bold text-text-tertiary uppercase border-b border-border-secondary/40 mb-1">Configuração Inicial</div>
                                                                                 {MOBILE_STATUS_OPTIONS.map(opt => (
                                                                                    <button
                                                                                       key={opt}
                                                                                       onClick={(ev) => { ev.stopPropagation(); handleStatusUpdate(prof.id, opt, 'M', wd.iso); setStatusMenu(null); }}
                                                                                       className="w-full px-4 py-2 text-left text-[11px] font-medium text-text-primary hover:bg-bg-tertiary transition-colors uppercase"
                                                                                    >{opt}</button>
                                                                                 ))}
                                                                              </>
                                                                           ) : (
                                                                              STATUS_OPTIONS.map(s => {
                                                                                 const currentStatus = disp?.status_manha;
                                                                                 const isActive = s === 'LIMPAR' ? !currentStatus : currentStatus === s;
                                                                                 return (
                                                                                    <button
                                                                                       key={s}
                                                                                       onClick={(ev) => { ev.stopPropagation(); handleStatusUpdate(prof.id, s, 'M', wd.iso); setStatusMenu(null); }}
                                                                                       className={`w-full px-4 py-2 text-left text-[11px] font-bold uppercase transition-colors ${isActive ? "bg-accent-primary text-white" : "text-text-primary hover:bg-bg-tertiary"}`}
                                                                                    >{STATUS_LABELS[s].label}</button>
                                                                                 );
                                                                              })
                                                                           )}
                                                                        </div>
                                                                     )}
                                                                  </div>
                                                                  {/* TARDE */}
                                                                  <div
                                                                     title={getTooltip(tStatus, atsDia.filter(a => (parseFloat(a.HORARIO?.split(':')[0] || '0') >= 13)))}
                                                                     onClick={(e) => {
                                                                        if ((e.target as HTMLElement).closest('[data-menu]')) return;
                                                                        setStatusMenu(statusMenu?.profId === prof.id && statusMenu?.period === 'T' && statusMenu?.dateStr === wd.iso ? null : { profId: prof.id, period: 'T', dateStr: wd.iso });
                                                                     }}
                                                                     className={`flex-1 flex items-center justify-center text-[9px] font-bold uppercase cursor-pointer transition-all hover:brightness-110 ${tStatus.color}`}
                                                                  >
                                                                     {tStatus.label}
                                                                     {statusMenu?.profId === prof.id && statusMenu?.period === 'T' && statusMenu?.dateStr === wd.iso && (
                                                                        <div data-menu className="absolute top-full right-0 mt-1 z-[100] bg-bg-secondary border border-border-secondary rounded-md shadow-lg py-1 min-w-[170px] animate-in slide-in-from-top-1">
                                                                           {STATUS_OPTIONS.map(s => {
                                                                              const currentStatus = disp?.status_tarde;
                                                                              const isActive = s === 'LIMPAR' ? !currentStatus : currentStatus === s;
                                                                              return (
                                                                                 <button
                                                                                    key={s}
                                                                                    onClick={(ev) => { ev.stopPropagation(); handleStatusUpdate(prof.id, s, 'T', wd.iso); setStatusMenu(null); }}
                                                                                    className={`w-full px-4 py-2 text-left text-[11px] font-bold uppercase transition-colors ${isActive ? "bg-accent-primary text-white" : "text-text-primary hover:bg-bg-tertiary"}`}
                                                                                 >{STATUS_LABELS[s].label}</button>
                                                                              );
                                                                           })}
                                                                        </div>
                                                                     )}
                                                                  </div>
                                                               </>
                                                            )}
                                                         </div>
                                                      );
                                                   })}
                                                </div>
                                             </div>
                                          );
                                       });
                                    })())}
                                 </div>
                              </div>
                           </div>
                        </div>
                     </div>
                  );
               })()}

               {/* MODAL: INFORMATIVOS PROFISSIONAL (duplo-clique em Profissional Livre) */}
               {profModalData && (() => {
                  const prof = profModalData;
                  const metrics = profMetricas[prof.id];
                  const atsHoje = atendimentosDia.filter(a => matchName(a.PROFISSIONAL, prof.nome));
                  return (
                     <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setProfModalData(null)}>
                        <div className="bg-bg-secondary w-full max-w-md rounded-2xl border border-border-secondary shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200" onClick={e => e.stopPropagation()}>
                           <div className="p-4 bg-bg-tertiary border-b border-border-secondary flex items-center justify-between">
                              <div>
                                 <h4 className="font-bold text-text-primary text-sm">{prof.nome}</h4>
                                 <p className="text-[9px] text-text-tertiary uppercase tracking-tighter">{prof.habilidade}</p>
                              </div>
                              <button onClick={() => setProfModalData(null)} className="p-1 hover:bg-bg-secondary rounded-lg text-text-tertiary hover:text-text-primary transition-colors">
                                 <Icon name="X" className="w-5 h-5" />
                              </button>
                           </div>
                           <div className="p-6 space-y-6 overflow-auto max-h-[80vh]">
                              {/* ABAS DE CONFIANÇA */}
                              <div className="space-y-4">
                                 <h4 className="text-[10px] font-bold text-text-tertiary uppercase tracking-widest px-1">Confiabilidade</h4>
                                 <div className="grid grid-cols-3 gap-2">
                                    {(['d7', 'd30', 'geral'] as const).map(period => (
                                       <button
                                          key={period}
                                          onClick={() => setActiveMetricPeriod(period)}
                                          className={`p-2 rounded-xl border text-center transition-all ${activeMetricPeriod === period ? 'bg-accent-primary/10 border-accent-primary' : 'bg-bg-primary border-border-secondary hover:border-border-primary'}`}
                                       >
                                          <p className={`text-[9px] uppercase font-bold mb-1 ${activeMetricPeriod === period ? 'text-accent-primary' : 'text-text-tertiary'}`}>{period === 'd7' ? '7 Dias' : period === 'd30' ? '30 Dias' : 'Geral'}</p>
                                          <p className={`text-lg font-black ${activeMetricPeriod === period ? 'text-accent-primary' : 'text-text-primary'}`}>{metrics?.[period]?.conf?.tx || 0}%</p>
                                       </button>
                                    ))}
                                 </div>
                                 {(() => {
                                    const mPeriod = metrics?.[activeMetricPeriod];
                                    return (
                                       <div className="grid grid-cols-2 gap-2 animate-in fade-in zoom-in-95 duration-200">
                                          <div className="bg-bg-primary p-3 rounded-xl border border-border-secondary flex items-center justify-between">
                                             <span className="text-[10px] font-bold text-text-tertiary uppercase">Faltas</span>
                                             <span className="text-sm font-black text-rose-500">{mPeriod.falta?.qtd || 0}</span>
                                          </div>
                                          <div className="bg-bg-primary p-3 rounded-xl border border-border-secondary flex items-center justify-between">
                                             <span className="text-[10px] font-bold text-text-tertiary uppercase">Cancelou</span>
                                             <span className="text-sm font-black text-orange-500">{mPeriod.conf?.canc || 0}</span>
                                          </div>
                                          <div className="bg-bg-primary p-3 rounded-xl border border-border-secondary flex items-center justify-between">
                                             <span className="text-[10px] font-bold text-text-tertiary uppercase">Não</span>
                                             <span className="text-sm font-black text-text-secondary">{mPeriod.conf?.nao || 0}</span>
                                          </div>
                                          <div className="bg-bg-primary p-3 rounded-xl border border-border-secondary flex items-center justify-between">
                                             <span className="text-[10px] font-bold text-text-tertiary uppercase">Clie+Liv</span>
                                             <span className="text-sm font-black text-success">{(mPeriod.conf?.cli || 0) + (mPeriod.conf?.liv || 0)}</span>
                                          </div>
                                          <div className="col-span-2 bg-bg-primary p-3 rounded-xl border border-border-secondary flex items-center justify-between">
                                             <span className="text-[10px] font-bold text-text-tertiary uppercase">Perfil Predominante</span>
                                             <span className="text-xs font-black text-text-primary">{mPeriod.perf?.desc || '-'} <span className="text-text-tertiary font-bold ml-1 text-[9px]">({mPeriod.perf?.res}R / {mPeriod.perf?.com}C)</span></span>
                                          </div>
                                       </div>
                                    );
                                 })()}
                              </div>

                              <div className="border-t border-border-secondary" />

                              {/* ATENDIMENTOS HOJE */}
                              <div className="space-y-3">
                                 <div className="flex items-center justify-between">
                                    <h4 className="text-[10px] font-bold text-accent-primary uppercase tracking-widest flex items-center gap-2">
                                       <Icon name="CalendarClock" className="w-3.5 h-3.5" />
                                       Atendimentos Hoje
                                    </h4>
                                    <span className="text-[10px] font-bold text-text-tertiary">{formatLocalISO(selectedDate).split('-').reverse().join('/')}</span>
                                 </div>
                                 {atsHoje.length === 0 ? (
                                    <div className="text-center py-6 bg-bg-primary border border-dashed border-border-secondary rounded-xl text-text-tertiary font-bold text-[10px] uppercase">
                                       Nenhum atendimento<br />para esta data
                                    </div>
                                 ) : (
                                    <div className="space-y-3">
                                       {[...atsHoje].sort((a, b) => parseFloat(a.HORARIO?.replace(':', '.') || '0') - parseFloat(b.HORARIO?.replace(':', '.') || '0')).map((at, idx) => (
                                          <div key={idx} className="p-4 bg-bg-primary rounded-xl border border-border-primary shadow-sm relative overflow-hidden hover:border-accent-primary/50 transition-colors">
                                             <div className="absolute left-0 top-0 bottom-0 w-1 bg-accent-primary" />
                                             <div className="space-y-2">
                                                <div><p className="text-[7px] text-text-tertiary uppercase font-bold tracking-tighter">Cliente</p><p className="text-xs font-bold text-text-primary truncate">{at.CLIENTE}</p></div>
                                                <div className="grid grid-cols-2 gap-2">
                                                   <div><p className="text-[7px] text-text-tertiary uppercase font-bold tracking-tighter">Horário</p><p className="text-[10px] font-bold text-text-primary">{at.HORARIO}</p></div>
                                                   <div><p className="text-[7px] text-text-tertiary uppercase font-bold tracking-tighter">Duração</p><p className="text-[10px] font-bold text-text-primary">{at['PERÍODO']}h</p></div>
                                                </div>
                                                <div><p className="text-[7px] text-text-tertiary uppercase font-bold tracking-tighter">Serviço</p><p className="text-[10px] font-bold text-text-primary truncate">{at['SERVIÇO']}</p></div>
                                             </div>
                                          </div>
                                       ))}
                                    </div>
                                 )}
                              </div>
                           </div>
                        </div>
                     </div>
                  );
               })()}
            </div>
         )}
         {/* MODAL DE DETALHES DO ATENDIMENTO (CLIENTE) */}
         {selectedAtendimento && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
               <div className="bg-bg-secondary w-full max-w-md rounded-2xl border border-border-secondary shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
                  <div className="p-4 bg-bg-tertiary border-b border-border-secondary flex items-center justify-between">
                     <h4 className="font-bold text-text-primary flex items-center gap-2">
                        <Icon name="CalendarCheck" className="w-5 h-5 text-success" />
                        Detalhes do Atendimento
                     </h4>
                     <button onClick={() => setSelectedAtendimento(null)} className="p-1 hover:bg-bg-secondary rounded-lg text-text-tertiary hover:text-text-primary transition-colors">
                        <Icon name="X" className="w-5 h-5" />
                     </button>
                  </div>
                  <div className="p-6 space-y-4">
                     <div className="grid grid-cols-2 gap-4">
                        <div className="p-3 bg-bg-primary rounded-lg border border-border-primary text-center">
                           <p className="text-[10px] uppercase text-text-tertiary font-bold mb-1 tracking-wider">Horário</p>
                           <p className="text-xl font-bold text-text-primary">{selectedAtendimento.HORARIO}</p>
                        </div>
                        <div className="p-3 bg-bg-primary rounded-lg border border-border-primary text-center">
                           <p className="text-[10px] uppercase text-text-tertiary font-bold mb-1 tracking-wider">Status</p>
                           <span className="px-2 py-0.5 bg-success/20 text-success text-[10px] font-bold rounded-full border border-success/30">
                              {selectedAtendimento.STATUS}
                           </span>
                        </div>
                     </div>

                     <div className="p-4 bg-bg-tertiary/50 border border-border-secondary rounded-xl">
                        <div className="mb-4">
                           <p className="text-[10px] uppercase text-text-tertiary font-bold mb-1">Cliente</p>
                           <p className="text-base font-bold text-text-primary">{selectedAtendimento.CLIENTE}</p>
                        </div>
                        <div className="mb-4">
                           <p className="text-[10px] uppercase text-text-tertiary font-bold mb-1">Profissional</p>
                           <p className="text-sm font-medium text-text-primary">{selectedAtendimento.PROFISSIONAL}</p>
                        </div>
                        <div>
                           <p className="text-[10px] uppercase text-text-tertiary font-bold mb-1">Serviço / Tipo</p>
                           <p className="text-sm font-medium text-text-primary">{selectedAtendimento.TIPO || selectedAtendimento['SERVIÇO'] || 'Padrão'}</p>
                        </div>
                     </div>
                  </div>
                  <div className="p-4 bg-bg-tertiary border-t border-border-secondary flex justify-end">
                     <button
                        onClick={() => setSelectedAtendimento(null)}
                        className="px-6 py-2 bg-accent-primary text-text-on-accent font-bold rounded-lg hover:bg-accent-primary/90 transition-colors shadow-md"
                     >
                        Fechar
                     </button>
                  </div>
               </div>
            </div>
         )}
      </div>
   );
};

export default AgendaPage;
