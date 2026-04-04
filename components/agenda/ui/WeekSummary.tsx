import React, { useMemo } from 'react';
import { Icon } from '../../ui/Icon';
import { formatLocalISO } from '../helpers';

interface WeekSummaryProps {
   selectedDate: Date;
   setSelectedDate: (date: Date) => void;
   todasDisponibilidades: any[];
   atendimentosSemana: any[];
   loading: boolean;
}

export const WeekSummary: React.FC<WeekSummaryProps> = ({
   selectedDate,
   setSelectedDate,
   todasDisponibilidades,
   atendimentosSemana,
   loading
}) => {
   // Calcula o intervalo de segunda a sábado da semana do dia selecionado
   const weekDays = useMemo(() => {
      const dow = selectedDate.getDay(); // 0=dom, 1=seg...
      const diffToMon = dow === 0 ? -6 : 1 - dow;
      const monday = new Date(selectedDate);
      monday.setHours(0, 0, 0, 0); // Zera hora pra não ter problema de timezone no Date object original
      monday.setDate(selectedDate.getDate() + diffToMon);

      return Array.from({ length: 6 }, (_, i) => {
         const d = new Date(monday);
         d.setDate(monday.getDate() + i);
         return d;
      });
   }, [selectedDate]);

   const fmtDateDayMonth = (d: Date) => d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

   const firstDay = weekDays[0];
   const lastDay = weekDays[5];
   const headerLabel = `${fmtDateDayMonth(firstDay)} a ${fmtDateDayMonth(lastDay)}`;

   const labels = [
      { key: 'livre', label: 'Livre', bg: 'bg-green-500', fg: 'text-black', color: 'text-green-500' },
      { key: 'nao', label: 'Não', bg: 'bg-zinc-900', fg: 'text-white', color: 'text-zinc-400' },
      { key: 'cancelou', label: 'Cancelou', bg: 'bg-orange-500', fg: 'text-black', color: 'text-orange-500' },
      { key: 'faltou', label: 'Faltou', bg: 'bg-red-600', fg: 'text-white', color: 'text-red-500' },
      { key: 'reserva', label: 'Reserva', bg: 'bg-yellow-400', fg: 'text-black', color: 'text-yellow-500' },
      { key: 'cliente', label: 'Cliente', bg: 'bg-blue-500', fg: 'text-white', color: 'text-blue-400' },
      { key: 'possiveis', label: 'Possíveis', bg: 'bg-transparent', fg: 'text-black', color: 'text-blue-300', isMetric: true },
      { key: 'sistema', label: 'Sistema', bg: 'bg-transparent', fg: 'text-black', color: 'text-purple-400', isMetric: true },
      { key: 'aproveitamento', label: 'Aproveitamento', bg: 'bg-indigo-600', fg: 'text-white', color: 'text-indigo-400', isMetric: true },
   ];

   const dayMetrics = useMemo(() => {
      return weekDays.map(d => {
         const iso = formatLocalISO(d);
         const disps = todasDisponibilidades.filter((disp: any) => {
            const dispDate = typeof disp.data === 'string' ? disp.data.split('T')[0] : formatLocalISO(new Date(disp.data));
            return dispDate === iso;
         });

         const countStatus = (status: string) => disps.filter((dsp: any) =>
            dsp.status_manha === status || dsp.status_tarde === status
         ).length;

         const livre = countStatus('LIVRE');
         const nao = countStatus('NÃO') + countStatus('NAO') + countStatus('NÃO DISPONÍVEL') + countStatus('NÃO DISPONIVEL');
         const cancelou = countStatus('CANCELOU');
         const faltou = countStatus('FALTOU');
         const reserva = countStatus('RESERVA');

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

         const possiveis = livre + cliente + reserva;
         const aproveitamento = possiveis > 0 ? Math.round((sistema / possiveis) * 100) : 0;

         return { iso, livre, nao, cancelou, faltou, reserva, cliente, possiveis, sistema, aproveitamento };
      });
   }, [weekDays, todasDisponibilidades, atendimentosSemana]);

   const totals = useMemo(() => {
      const t = dayMetrics.reduce(
         (acc, m) => ({
            livre: acc.livre + m.livre,
            nao: acc.nao + m.nao,
            cancelou: acc.cancelou + m.cancelou,
            faltou: acc.faltou + m.faltou,
            reserva: (acc.reserva || 0) + m.reserva,
            cliente: acc.cliente + m.cliente,
            possiveis: acc.possiveis + m.possiveis,
            sistema: acc.sistema + m.sistema,
            aproveitamento: 0 // Será calculado depois
         }),
         { livre: 0, nao: 0, cancelou: 0, faltou: 0, reserva: 0, cliente: 0, possiveis: 0, sistema: 0, aproveitamento: 0 }
      );
      t.aproveitamento = t.possiveis > 0 ? Math.round((t.sistema / t.possiveis) * 100) : 0;
      return t;
   }, [dayMetrics]);

   const DAY_LABELS = ['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];

   const isToday = (d: Date) => formatLocalISO(d) === formatLocalISO(new Date());
   const isSelected = (d: Date) => formatLocalISO(d) === formatLocalISO(selectedDate);

   const getCellValue = (m: typeof dayMetrics[0], key: string): number => {
      return (m as any)[key] ?? 0;
   };

   return (
      <div className="bg-bg-secondary rounded-xl border border-border-secondary overflow-hidden shadow-md p-3 flex flex-col h-full w-full relative">
         {/* Loading visualizer layer */}
         {loading && (
            <div className="absolute inset-0 bg-bg-secondary/40 backdrop-blur-[1px] z-10 flex items-center justify-center">
               <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent-primary" />
            </div>
         )}

         {/* Header centralizado */}
         <div className="flex items-center justify-center gap-2 mb-2 w-full shrink-0">
            <span className="text-[12px] sm:text-sm font-bold text-text-primary capitalize">{headerLabel}</span>
         </div>

         {/* Weekdays Header — 8 colunas: Status + 6 dias + Total */}
         <div className="grid grid-cols-[auto_1fr_1fr_1fr_1fr_1fr_1fr_auto] gap-1 mb-1 w-full shrink-0">
            <div className="flex items-center justify-center text-center text-[10px] sm:text-xs font-bold text-text-secondary py-1 bg-bg-tertiary rounded-md h-full w-[50px] sm:w-[80px]">
               Status
            </div>
            {weekDays.map((d, i) => (
               <div
                  key={i}
                  className={`flex flex-col items-center justify-center p-1 text-center text-[10px] sm:text-xs font-bold rounded-md h-full transition-all ${isSelected(d)
                     ? 'bg-accent-primary text-text-on-accent shadow-sm ring-1 ring-accent-primary/20'
                     : isToday(d)
                        ? 'bg-bg-tertiary text-text-primary'
                        : 'bg-bg-tertiary text-text-secondary'
                     }`}
               >
                  <span className="block">{DAY_LABELS[i]}</span>
                  <span className="block font-medium text-[9px] sm:text-[10px]">{fmtDateDayMonth(d)}</span>
               </div>
            ))}
            <div className="flex items-center justify-center text-center text-[10px] sm:text-xs font-bold text-text-secondary py-1 bg-bg-tertiary rounded-md h-full w-[40px] sm:w-[60px]">
               Total
            </div>
         </div>

         {/* Metrics Grid */}
         <div className="grid grid-cols-[auto_1fr_1fr_1fr_1fr_1fr_1fr_auto] gap-1 sm:gap-1.5 flex-1 overflow-y-auto overflow-x-hidden min-h-0 custom-scrollbar pr-1 w-full pb-2">
            {labels.map(({ key, label, bg, fg, isMetric }) => (
               <React.Fragment key={key}>
                  {/* Separador Visual */}
                  {key === 'possiveis' && (
                     <div className="col-[1/-1] border-t-2 border-dashed border-border-secondary my-0 w-full" />
                  )}

                  {/* Label Esquerda */}
                  <div className={`py-1 flex items-center justify-center text-center font-black uppercase tracking-tight rounded-md w-[50px] sm:w-[80px] break-words flex-wrap
                     ${key === 'possiveis' || key === 'sistema' ? 'text-[9px] sm:text-xs md:text-sm' : 'text-[8px] sm:text-[10px] md:text-xs px-1'}
                     ${key === 'aproveitamento' ? '' : `${bg} ${fg} ${isMetric ? 'opacity-90' : ''}`}
                  `}>
                     {key === 'aproveitamento' ? '' : label}
                  </div>

                  {/* Células Dias */}
                  {dayMetrics.map((m, i) => {
                     const val = getCellValue(m, key);
                     const sel = isSelected(weekDays[i]);
                     const isAproveitamento = key === 'aproveitamento';
                     return (
                        <div
                           key={i}
                           onClick={!isAproveitamento ? () => setSelectedDate(weekDays[i]) : undefined}
                           className={`py-1 px-0.5 flex flex-col items-center justify-center text-center font-medium rounded-md transition-colors ${isAproveitamento
                              ? (sel ? 'text-accent-primary font-bold text-sm sm:text-xl' : 'text-text-tertiary font-bold text-sm sm:text-xl')
                              : `border cursor-pointer ${key === 'possiveis' || key === 'sistema' ? 'text-xs sm:text-base font-bold' : 'text-[10px] sm:text-sm'} ${sel
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

                  {/* Total da Linha Direita */}
                  <div className={`py-1 px-0.5 w-[40px] sm:w-[60px] shrink-0 flex items-center justify-center text-center font-black rounded-md ${key === 'aproveitamento'
                     ? 'text-text-tertiary text-xs sm:text-lg'
                     : `border border-border-secondary ${key === 'possiveis' || key === 'sistema' ? 'text-xs sm:text-base' : 'text-[10px] sm:text-sm'} ${isMetric ? 'bg-bg-tertiary/60' : 'bg-bg-tertiary'} ${(totals as any)[key] === 0 ? 'text-text-tertiary/40' : 'text-text-primary'}`
                     }`}>
                     {(totals as any)[key]}{key === 'aproveitamento' ? '%' : ''}
                  </div>
               </React.Fragment>
            ))}
         </div>
      </div>
   );
};
