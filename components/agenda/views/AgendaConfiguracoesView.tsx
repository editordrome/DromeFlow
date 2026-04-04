import React, { useState } from 'react';
import { Icon } from '../../ui/Icon';
import { formatLocalISO, matchDate, matchName } from '../helpers';
import { STATUS_OPTIONS, STATUS_LABELS, PERIODOS_MANHA, PERIODOS_TARDE, PERIODOS_NAO } from '../constants';

interface AgendaConfiguracoesViewProps {
   config: any;
   selectedUnit: any;
   loading: boolean;
   linkAcessoPublico: string;
   atendimentosSemana: any[];
   
   // Tab State
   configTab: 'metricas' | 'parametros';
   setConfigTab: (val: 'metricas' | 'parametros') => void;
   
   // Navigation State
   selectedDate: Date;
   setSelectedDate: (d: Date) => void;
   weekDatesMap: { date: Date, iso: string }[];
   activeMetricPeriod: 'd7' | 'd30' | 'geral';
   setActiveMetricPeriod: (p: 'd7' | 'd30' | 'geral') => void;

   // UI state & Modals
   statusMenu: { profId: string, period: 'M' | 'T', dateStr: string } | null;
   setStatusMenu: (val: any) => void;
   setConflictModal: (modalInfo: any) => void;
   setProfModalData: (profInfo: any) => void;
   profWithMetrics: string | null;
   setProfWithMetrics: (val: string | null) => void;
}

export const AgendaConfiguracoesView: React.FC<AgendaConfiguracoesViewProps> = ({
   config,
   selectedUnit,
   loading,
   linkAcessoPublico,
   atendimentosSemana,
   configTab,
   setConfigTab,
   selectedDate,
   setSelectedDate,
   weekDatesMap,
   activeMetricPeriod,
   setActiveMetricPeriod,
   statusMenu,
   setStatusMenu,
   setConflictModal,
   setProfModalData,
   profWithMetrics,
   setProfWithMetrics
}) => {
   const [isCalendarCollapsed, setIsCalendarCollapsed] = useState(false);

   const { 
      configSettings, setConfigSettings, isSavingConfig, todasProfissionais, todasDisponibilidades,
      profMetricas, loadProfissionalMetrics, activeFilter, setActiveFilter, 
      profSearchTerm, setProfSearchTerm, calendarViewDate, setCalendarViewDate,
      handleStatusUpdate, handleSaveSettings 
   } = config;

   // Helper para toggle de dia no calendário de config
   const toggleDiaVisual = (isoStr: string) => {
      const dias = configSettings.dias_liberados || [];
      const newDias = dias.includes(isoStr) 
         ? dias.filter((d: string) => d !== isoStr) 
         : [...dias, isoStr];
      setConfigSettings({ ...configSettings, dias_liberados: newDias });
   };

   // Handler para salvar configurações local
   const handleSaveConfigLocal = () => handleSaveSettings(configSettings);

   if (!configSettings) return null;

   return (
      <div className="flex flex-col flex-1 bg-bg-secondary rounded-xl border border-border-secondary overflow-y-auto p-6 scroll-smooth">
         {/* HEADER CONTEXTUAL (Apenas seletor de dados histórico na Disponibilidade antiga - Removido daqui em favor da nova posição) */}

         {configTab === 'parametros' && (
            <div className="flex flex-col gap-4">
               {/* CABEÇALHO DO CALENDÁRIO COM CONTROLES (Simplificado) */}
               <div className="w-full flex flex-col items-center gap-6 animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="w-full max-w-4xl space-y-4">
                     <div className="bg-bg-secondary rounded-xl border border-border-secondary overflow-hidden shadow-md flex flex-col w-full relative">
                        {/* Header do Bloco */}
                        <div className="flex items-center justify-between bg-bg-tertiary/40 px-4 py-3 border-b border-border-secondary/30">
                           <div className="flex items-center gap-3">
                              <div className="p-2 rounded-xl bg-accent-primary/10 border border-accent-primary/20">
                                 <Icon name="CalendarRange" className="w-4 h-4 text-accent-primary" />
                              </div>
                              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                                 <h4 className="text-[11px] font-black text-text-primary uppercase tracking-tight whitespace-nowrap">Datas Disponíveis</h4>
                                 <div className="flex items-center gap-2 border-l border-border-secondary/50 pl-2">
                                    <span className="text-[8px] font-bold text-text-tertiary uppercase tracking-widest whitespace-nowrap">Última Atualização:</span>
                                    <span className="text-[9px] font-black uppercase text-accent-primary bg-accent-primary/10 px-2 py-0.5 rounded-full border border-accent-primary/20 whitespace-nowrap">
                                       {configSettings.created_at 
                                          ? new Date(configSettings.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) 
                                          : 'Sem registro'}
                                    </span>
                                 </div>
                              </div>
                           </div>

                           <button 
                              onClick={() => setIsCalendarCollapsed(!isCalendarCollapsed)}
                              className="p-2 hover:bg-bg-tertiary rounded-xl text-text-secondary transition-all active:scale-95 border border-transparent hover:border-border-secondary group"
                              title={isCalendarCollapsed ? "Expandir Calendário" : "Recolher Calendário"}
                           >
                              <Icon name={isCalendarCollapsed ? "Maximize2" : "Minimize2"} className="w-5 h-5 group-hover:text-accent-primary" />
                           </button>
                        </div>

                        {!isCalendarCollapsed && (
                           <div className="p-3 animate-in zoom-in-95 duration-200">
                              <div className="flex items-center justify-between mb-2 w-full px-2">
                                 <button
                                    onClick={() => setCalendarViewDate(new Date(calendarViewDate.getFullYear(), calendarViewDate.getMonth() - 1, 1))}
                                    className="p-2 hover:bg-bg-tertiary rounded-xl text-text-secondary transition-colors"
                                 >
                                    <Icon name="ChevronLeft" className="w-5 h-5" />
                                 </button>
                                 <div className="text-lg font-black tracking-tight text-text-primary capitalize">
                                    {new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(calendarViewDate).replace(' de ', ' ')}
                                 </div>
                                 <button
                                    onClick={() => setCalendarViewDate(new Date(calendarViewDate.getFullYear(), calendarViewDate.getMonth() + 1, 1))}
                                    className="p-2 hover:bg-bg-tertiary rounded-xl text-text-secondary transition-colors"
                                 >
                                    <Icon name="ChevronRight" className="w-5 h-5" />
                                 </button>
                              </div>

                              {/* Dias da Semana */}
                              <div className="grid grid-cols-7 gap-2 mb-2 w-full px-2">
                                 {['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'].map(day => (
                                    <div key={day} className="text-center text-[10px] sm:text-xs font-bold text-text-secondary py-1.5 bg-bg-tertiary rounded-lg uppercase tracking-wider">
                                       {day}
                                    </div>
                                 ))}
                              </div>

                              {/* Grid de Dias */}
                              <div className="grid grid-cols-7 gap-2 w-full px-2 pb-2">
                                 {Array.from({ length: new Date(calendarViewDate.getFullYear(), calendarViewDate.getMonth(), 1).getDay() }).map((_, i) => (
                                    <div key={`empty-${i}`} className="p-2 opacity-10 text-center h-full"></div>
                                 ))}
                                 {Array.from({ length: new Date(calendarViewDate.getFullYear(), calendarViewDate.getMonth() + 1, 0).getDate() }).map((_, i) => {
                                    const day = i + 1;
                                    const dateObj = new Date(calendarViewDate.getFullYear(), calendarViewDate.getMonth(), day);
                                    const isoStr = formatLocalISO(dateObj);
                                    const isSelected = configSettings.dias_liberados?.includes(isoStr);

                                    const hoje = new Date();
                                    hoje.setHours(0, 0, 0, 0);
                                    const isPast = dateObj < hoje;

                                    return (
                                       <div
                                          key={day}
                                          onClick={() => !isPast && toggleDiaVisual(isoStr)}
                                          className={`h-full min-h-[2.5rem] flex items-center justify-center text-sm font-bold rounded-xl transition-all border cursor-pointer
                                          ${isPast
                                                ? 'opacity-20 cursor-not-allowed bg-bg-tertiary border-transparent text-text-tertiary'
                                                : isSelected
                                                   ? 'bg-accent-primary border-accent-primary text-text-on-accent shadow-md scale-[1.03] z-10'
                                                   : 'border-border-secondary text-text-secondary hover:bg-bg-tertiary hover:border-border-primary hover:scale-[1.03] bg-bg-primary'}`}
                                       >
                                          {day}
                                       </div>
                                    );
                                 })}
                              </div>
                           </div>
                        )}
                     </div>
                  </div>

                  {!isCalendarCollapsed && (
                     <div className="flex items-center justify-center gap-4 w-full mt-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <button
                           onClick={() => setConfigSettings({ ...configSettings, dias_liberados: [] })}
                           className="flex-1 max-w-[160px] text-[11px] font-black text-rose-500 hover:text-white hover:bg-rose-500 px-6 py-4 rounded-2xl transition-all flex items-center justify-center gap-2 border border-rose-500/20 active:scale-95 uppercase tracking-widest cursor-pointer shadow-sm"
                        >
                           <Icon name="Trash2" className="w-4 h-4" />
                           Limpar
                        </button>

                        <button
                           onClick={handleSaveConfigLocal}
                           disabled={isSavingConfig}
                           className="flex-3 sm:flex-1 max-w-[240px] text-[11px] font-black bg-accent-primary hover:bg-accent-primary/90 text-text-on-accent px-8 py-4 rounded-2xl transition-all flex items-center justify-center gap-2 shadow-xl shadow-accent-primary/20 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed uppercase tracking-widest cursor-pointer border-b-4 border-accent-primary/50"
                        >
                           <Icon name="Save" className="w-4 h-4" />
                           {isSavingConfig ? 'Salvando...' : 'Salvar'}
                        </button>
                     </div>
                  )}
               </div>

               {/* TABELA DE ÚLTIMOS ENVIOS (Histórico) */}
               <div className="flex flex-col gap-6 pt-4 mt-8 border-t border-border-secondary/30">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                     <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-accent-primary/10 flex items-center justify-center">
                           <Icon name="History" className="w-6 h-6 text-accent-primary" />
                        </div>
                        <div>
                           <h3 className="text-xl font-black text-text-primary tracking-tight">Últimos Envios</h3>
                           <p className="text-[10px] font-bold text-text-tertiary uppercase tracking-widest">Histórico de sincronização semanal</p>
                        </div>
                     </div>

                     <div className="flex items-center gap-4 flex-1 max-w-2xl justify-end">
                        <div className="relative group flex-1 max-w-xs">
                           <Icon name="Search" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary group-focus-within:text-accent-primary transition-colors" />
                           <input
                              type="text"
                              placeholder="Buscar profissional..."
                              value={profSearchTerm}
                              onChange={(e) => setProfSearchTerm(e.target.value)}
                              className="w-full bg-bg-secondary/50 border border-border-secondary focus:border-accent-primary rounded-xl py-2 pl-10 pr-4 text-xs font-bold text-text-primary placeholder:text-text-tertiary/50 outline-none transition-all shadow-sm"
                           />
                        </div>

                        <div className="flex items-center gap-2 bg-bg-secondary/50 p-1.5 rounded-2xl border border-border-secondary shadow-sm">
                           <button
                              onClick={() => {
                                 const d = new Date(selectedDate);
                                 d.setDate(d.getDate() - 7);
                                 setSelectedDate(d);
                              }}
                              className="p-1.5 hover:bg-bg-tertiary rounded-xl text-text-secondary hover:text-text-primary transition-all active:scale-90 cursor-pointer"
                           >
                              <Icon name="ChevronLeft" className="w-5 h-5" />
                           </button>
                           <div className="flex items-center gap-2 px-3 text-[11px] font-black text-text-primary min-w-[150px] justify-center text-center uppercase tracking-tighter">
                              <Icon name="Calendar" className="w-3.5 h-3.5 text-accent-primary" />
                              {(() => {
                                 const start = new Date(selectedDate);
                                 start.setDate(selectedDate.getDate() - selectedDate.getDay() + (selectedDate.getDay() === 0 ? -6 : 1));
                                 const end = new Date(start);
                                 end.setDate(start.getDate() + 6);
                                 return `${start.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} • ${end.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}`;
                              })()}
                           </div>
                           <button
                              onClick={() => {
                                 const d = new Date(selectedDate);
                                 d.setDate(d.getDate() + 7);
                                 setSelectedDate(d);
                              }}
                              className="p-1.5 hover:bg-bg-tertiary rounded-xl text-text-secondary hover:text-text-primary transition-all active:scale-90 cursor-pointer"
                           >
                              <Icon name="ChevronRight" className="w-5 h-5" />
                           </button>
                        </div>
                     </div>
                  </div>

                  {/* Container da Tabela com Scroll */}
                  <div className="bg-bg-secondary rounded-2xl border border-border-secondary shadow-xl flex flex-col max-h-[600px] overflow-hidden">
                     <div className="flex-1 overflow-auto custom-scrollbar min-h-0">
                        <div className="min-w-[1200px] pb-10">
                           <div className="sticky top-0 z-20 bg-bg-tertiary/95 backdrop-blur-sm border-b border-border-secondary flex px-2 py-2">
                              <div className="w-[280px] shrink-0 px-3 text-[10px] font-bold uppercase tracking-wider text-text-tertiary flex items-center">
                                 Profissional
                              </div>
                              <div className="flex-1 flex border-l border-border-secondary/40">
                                 {weekDatesMap.map((wd) => {
                                    const dayName = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'][wd.date.getDay()];
                                    const isToday = wd.iso === formatLocalISO(new Date());
                                    return (
                                       <div key={wd.iso} className={`flex-1 flex flex-col items-center justify-center border-r border-border-secondary/40 py-1 transition-all ${isToday ? 'bg-accent-primary/5' : ''}`}>
                                          <span className={`text-[10px] font-bold uppercase ${isToday ? 'text-accent-primary' : 'text-text-tertiary'}`}>
                                             {dayName} {wd.date.getDate().toString().padStart(2, '0')}/{(wd.date.getMonth() + 1).toString().padStart(2, '0')}
                                          </span>
                                       </div>
                                    );
                                 })}
                                 <div className="w-[150px] shrink-0 text-[10px] font-bold uppercase tracking-wider text-text-tertiary text-center border-l border-border-secondary/40 bg-bg-tertiary/40 flex items-center justify-center">
                                    Atualizado
                                 </div>
                              </div>
                           </div>

                           <div className="flex flex-col p-2 gap-1 px-4">
                              {(() => {
                                 const weekDates = weekDatesMap.map(wd => wd.iso);
                                 const formatStatus = (val: string) => {
                                    if (!val) return null;
                                    const lower = val.toLowerCase();
                                    if (lower.includes('8 horas')) return '8 horas';
                                    if (lower.includes('6 horas')) return '6 horas';
                                    if (lower.includes('manhã')) return '4h Manhã';
                                    if (lower.includes('tarde')) return '4h Tarde';
                                    if (lower.includes('não')) return 'NÃO';
                                    return val.length > 7 ? val.slice(0, 6) + '.' : val;
                                 };

                                 const professionalMap: Record<string, any> = {};
                                 (todasDisponibilidades || []).forEach(d => {
                                    const entryDate = typeof d.data === 'string' ? d.data.split('T')[0] : '';
                                    if (!weekDates.includes(entryDate)) return;

                                    if (!professionalMap[d.profissional_id]) {
                                       const profRef = todasProfissionais.find(p => p.id === d.profissional_id);
                                       if (!profRef && !d.profissional?.nome) return;

                                       professionalMap[d.profissional_id] = {
                                          id: d.profissional_id,
                                          nome: profRef?.nome || d.profissional?.nome || '—',
                                          habilidade: profRef?.habilidade || '—',
                                          envios: {},
                                          last_created: d.created_at
                                       };
                                    }
                                    const originalData = (d.periodos && d.periodos.length > 0) ? d.periodos.join(', ') : (d.status_manha || d.status_tarde || '—');
                                    professionalMap[d.profissional_id].envios[entryDate] = originalData;
                                    if (new Date(d.created_at || 0) > new Date(professionalMap[d.profissional_id].last_created || 0)) {
                                       professionalMap[d.profissional_id].last_created = d.created_at;
                                    }
                                 });

                                 const rows = Object.values(professionalMap)
                                    .filter((p: any) => !profSearchTerm || p.nome.toLowerCase().includes(profSearchTerm.toLowerCase()))
                                    .sort((a, b) => a.nome.localeCompare(b.nome));

                                 if (rows.length === 0) return (
                                    <div className="py-20 text-center bg-bg-primary rounded-2xl border border-dashed border-border-secondary/40 my-4 mx-2">
                                       <Icon name="Inbox" className="w-12 h-12 mx-auto mb-4 opacity-10" />
                                       <p className="text-xs font-black uppercase tracking-widest text-text-tertiary opacity-30">Nenhum registro sincronizado</p>
                                    </div>
                                 );

                                 return rows.map((row: any) => (
                                    <div key={row.id} className="group bg-bg-primary rounded-xl border border-border-primary hover:border-border-secondary shadow-sm transition-all duration-200 h-10 flex relative z-0">
                                       <div className="w-[280px] shrink-0 border-r border-border-secondary/40 py-1 px-3 flex flex-col justify-center sticky left-0 z-10 bg-bg-primary rounded-l-xl group-hover:bg-bg-tertiary/50 transition-colors">
                                          <span className="font-bold text-xs truncate text-text-primary">{row.nome}</span>
                                          <span className="text-[9px] uppercase truncate text-text-tertiary">{row.habilidade}</span>
                                       </div>
                                       <div className="flex-1 flex border-l border-border-secondary/40 items-stretch">
                                          {weekDates.map(date => {
                                             const status = formatStatus(row.envios[date]);
                                             const isToday = date === formatLocalISO(new Date());
                                             return (
                                                <div key={date} className={`flex-1 flex items-center justify-center p-1 border-r border-border-secondary/40 ${isToday ? 'bg-accent-primary/5' : ''}`}>
                                                   {status ? (
                                                      <span className={`w-full h-full flex items-center justify-center rounded-lg text-[9.5px] font-black uppercase tracking-tighter transition-all group-hover:scale-[1.02] px-1 text-center leading-none ${status === 'NÃO' ? 'bg-[#1A1A1A] text-white shadow-sm' : status === '8 horas' ? 'bg-[#15803D] text-white shadow-sm' : status === '6 horas' ? 'bg-[#93C5FD] text-white shadow-sm' : status.includes('4h') ? 'bg-[#4ADE80] text-black shadow-sm' : 'bg-accent-primary text-white shadow-sm'}`}>{status}</span>
                                                   ) : <span className="text-text-tertiary opacity-10 text-[11px]">—</span>}
                                                </div>
                                             );
                                          })}
                                          <div className="w-[150px] shrink-0 flex flex-col items-end justify-center px-4 border-l border-border-secondary/40 bg-bg-tertiary/20 group-hover:bg-accent-primary/5 transition-colors">
                                             <span className="text-[11px] font-black text-text-primary">{row.last_created ? new Date(row.last_created).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'}</span>
                                             <span className="text-[9px] font-bold text-text-tertiary italic">{row.last_created ? new Date(row.last_created).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—'}</span>
                                          </div>
                                       </div>
                                    </div>
                                 ));
                              })()}
                           </div>
                        </div>
                     </div>
                  </div>
               </div>
            </div>
         )}

         {configTab === 'metricas' && (
            <div className="flex flex-col h-[calc(100vh-200px)] lg:h-[calc(100vh-250px)]">
               <div className="flex flex-col bg-bg-secondary rounded-2xl border border-border-secondary overflow-hidden flex-1">
                  <div className="p-4 bg-bg-tertiary border-b border-border-secondary flex flex-wrap items-center justify-between gap-4">
                     <div className="flex items-center gap-2">
                        {(['TODOS', 'RESERVA', 'LIVRE', 'NÃO', 'FALTOU', 'CANCELOU'] as const).map(f => (
                           <button
                              key={f}
                              onClick={() => setActiveFilter(f)}
                              className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all border cursor-pointer ${activeFilter === f
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

                     {/* NOVO POSICIONAMENTO DO SELETOR DE DATA (Disponibilidade) */}
                     <div className="flex items-center gap-2 bg-bg-primary px-2 py-1 rounded-xl border border-border-primary shadow-sm">
                        <button
                           onClick={() => {
                              const d = new Date(selectedDate);
                              d.setDate(d.getDate() - 7);
                              setSelectedDate(d);
                           }}
                           className="p-1 hover:bg-bg-tertiary rounded-lg text-text-tertiary hover:text-text-primary transition-colors cursor-pointer"
                        >
                           <Icon name="ChevronLeft" className="w-4 h-4" />
                        </button>
                        <div className="flex items-center gap-2 px-1 text-[11px] font-black text-text-primary min-w-[100px] justify-center text-center uppercase tracking-tighter">
                           {selectedDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                        </div>
                        <button
                           onClick={() => {
                              const d = new Date(selectedDate);
                              d.setDate(d.getDate() + 7);
                              setSelectedDate(d);
                           }}
                           className="p-1 hover:bg-bg-tertiary rounded-lg text-text-tertiary hover:text-text-primary transition-colors cursor-pointer"
                        >
                           <Icon name="ChevronRight" className="w-4 h-4" />
                        </button>
                     </div>

                     <div className="text-[10px] font-bold text-text-tertiary uppercase flex items-center gap-4">
                        <div className="flex items-center gap-2">
                           <Icon name="Users" className="w-3 h-3" />
                           {todasProfissionais.length} Profissionais
                        </div>
                     </div>
                  </div>

                  <div className="flex-1 overflow-auto custom-scrollbar">
                     <div className="min-w-[1200px] overflow-visible">
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
                                 if (activeFilter === 'TODOS') return true;
                                 if (activeFilter === 'CLIENTE') return atendimentosSemana.some(a => matchName(a.PROFISSIONAL, p.nome));
                                 if (['LIVRE', 'NÃO', 'FALTOU', 'CANCELOU'].includes(activeFilter)) {
                                    return todasDisponibilidades.some(d =>
                                       d.profissional_id === p.id &&
                                       (d.status_manha === activeFilter || d.status_tarde === activeFilter) &&
                                       weekDatesMap.some(wd => matchDate(d.data, wd.iso))
                                    );
                                 }
                                 return true;
                              });

                              if (filteredProfs.length === 0) return (
                                 <div className="py-20 text-center text-text-tertiary opacity-40">
                                    <Icon name="SearchX" className="w-12 h-12 mx-auto mb-4" />
                                    <p className="font-bold uppercase tracking-widest text-xs">Nenhum resultado</p>
                                 </div>
                              );

                              return filteredProfs.map(prof => {
                                 const isSelected = profWithMetrics === prof.id;
                                 const atsSemanaProf = atendimentosSemana.filter(a => matchName(a.PROFISSIONAL, prof.nome));

                                 return (
                                    <div key={prof.id} className={`group bg-bg-primary rounded-xl border transition-all duration-200 h-10 flex border-border-primary hover:border-border-secondary shadow-sm ${statusMenu?.profId === prof.id ? 'relative z-50' : 'relative z-0'} ${isSelected ? 'border-accent-primary ring-1 ring-accent-primary' : ''}`}>
                                       <div
                                          className={`w-[280px] shrink-0 border-r border-border-secondary py-1 px-3 flex flex-col justify-center cursor-pointer transition-colors sticky left-0 z-10 bg-bg-primary rounded-l-xl hover:bg-bg-tertiary/50 ${isSelected ? 'bg-accent-primary/10' : ''}`}
                                          onClick={() => {
                                             setProfWithMetrics(isSelected ? null : prof.id);
                                             if (!isSelected) loadProfissionalMetrics(prof.id, prof.nome);
                                          }}
                                       >
                                          <span className="font-bold text-xs truncate text-text-primary">{prof.nome}</span>
                                          <span className="text-[9px] uppercase truncate text-text-tertiary">{prof.habilidade}</span>
                                       </div>

                                       <div className="flex-1 flex border-l border-border-secondary/40 items-stretch">
                                          {weekDatesMap.map((wd) => {
                                             const isToday = wd.iso === formatLocalISO(new Date());
                                             const isSelectedDay = wd.iso === formatLocalISO(selectedDate);
                                             const disp = todasDisponibilidades.find(d => d.profissional_id === prof.id && matchDate(d.data, wd.iso));
                                             const atsDia = atsSemanaProf.filter(a => matchDate(a.DATA, wd.iso));

                                             const getPeriodStatus = (startH: number, endH: number) => {
                                                const statusCol = startH < 13 ? 'status_manha' : 'status_tarde';
                                                const manualStatus = disp?.[statusCol];

                                                if (manualStatus === '') return { label: '—', color: 'bg-bg-tertiary text-text-tertiary' };
                                                
                                                const overlapAt = atsDia.find(at => {
                                                   const [atStH] = (at.HORARIO || '0:0').split(':').map(Number);
                                                   const dur = parseFloat(at['PERÍODO']?.toString().replace(',', '.') || '1');
                                                   return atStH < endH && (atStH + dur) > startH;
                                                });

                                                if (overlapAt) return { label: 'CLIENTE', color: (parseFloat(overlapAt['PERÍODO'] || '0') === 8 ? 'bg-[#1E3A8A]' : 'bg-[#3B82F6]') + ' text-white shadow-sm' };

                                                if (manualStatus) {
                                                   if (['8 horas', '6 horas', '4 horas manhã', '4 horas tarde'].includes(manualStatus)) return { label: 'LIVRE', color: 'bg-[#4ADE80] text-black shadow-sm' };
                                                   let color = 'bg-[#F97316] text-black shadow-sm';
                                                   if (manualStatus === 'FALTOU') color = 'bg-[#EF4444] text-white shadow-sm';
                                                   else if (manualStatus === 'RESERVA') color = 'bg-[#FACC15] text-black shadow-sm';
                                                   else if (manualStatus === 'NÃO') color = 'bg-[#1A1A1A] text-white shadow-sm';
                                                   return { label: manualStatus, color };
                                                }

                                                return { label: '—', color: 'bg-bg-tertiary text-text-tertiary' };
                                             };

                                             const mStatus = getPeriodStatus(6, 13);
                                             const tStatus = getPeriodStatus(13, 20);
                                             const isUnified = mStatus.label === tStatus.label && mStatus.label !== '—';

                                             return (
                                                <div key={wd.iso} className={`flex-1 flex border-r border-border-secondary/40 relative ${isSelectedDay ? 'bg-accent-primary/10' : isToday ? 'bg-accent-primary/5' : ''}`}>
                                                   {isUnified ? (
                                                      <div
                                                         onClick={() => setStatusMenu(statusMenu?.profId === prof.id && statusMenu?.period === 'M' && statusMenu?.dateStr === wd.iso ? null : { profId: prof.id, period: 'M', dateStr: wd.iso })}
                                                         className={`flex-1 flex items-center justify-center text-[9px] font-bold uppercase cursor-pointer transition-all hover:brightness-110 ${mStatus.color}`}
                                                      >
                                                         {mStatus.label}
                                                      </div>
                                                   ) : (
                                                      <>
                                                         <div
                                                            onClick={() => setStatusMenu(statusMenu?.profId === prof.id && statusMenu?.period === 'M' && statusMenu?.dateStr === wd.iso ? null : { profId: prof.id, period: 'M', dateStr: wd.iso })}
                                                            className={`flex-1 flex items-center justify-center text-[9px] font-bold uppercase cursor-pointer border-r border-border-secondary/20 transition-all hover:brightness-110 ${mStatus.color}`}
                                                         >{mStatus.label}</div>
                                                         <div
                                                            onClick={() => setStatusMenu(statusMenu?.profId === prof.id && statusMenu?.period === 'T' && statusMenu?.dateStr === wd.iso ? null : { profId: prof.id, period: 'T', dateStr: wd.iso })}
                                                            className={`flex-1 flex items-center justify-center text-[9px] font-bold uppercase cursor-pointer transition-all hover:brightness-110 ${tStatus.color}`}
                                                         >{tStatus.label}</div>
                                                      </>
                                                   )}

                                                   {/* MENU DE STATUS */}
                                                   {statusMenu?.profId === prof.id && statusMenu?.dateStr === wd.iso && (
                                                      <div data-menu className="absolute top-full left-0 mt-1 z-[100] bg-bg-secondary border border-border-secondary rounded-md shadow-lg py-1 min-w-[170px]">
                                                         {STATUS_OPTIONS.map(s => (
                                                            <button
                                                               key={s}
                                                               onClick={(ev) => { ev.stopPropagation(); handleStatusUpdate(prof.id, s, statusMenu.period, wd.iso); setStatusMenu(null); }}
                                                               className="w-full px-4 py-2 text-left text-[11px] font-bold uppercase hover:bg-bg-tertiary"
                                                            >{STATUS_LABELS[s].label}</button>
                                                         ))}
                                                      </div>
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
         )}
      </div>
   );
};

export default AgendaConfiguracoesView;
