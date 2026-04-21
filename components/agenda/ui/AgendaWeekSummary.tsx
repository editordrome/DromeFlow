import React from 'react';
import { formatLocalISO } from '../helpers';

interface AgendaWeekSummaryProps {
   selectedDate: Date;
   setSelectedDate: (date: Date) => void;
   todasDisponibilidades: any[];
   atendimentosSemana: any[];
   loading: boolean;
}

export const AgendaWeekSummary: React.FC<AgendaWeekSummaryProps> = ({
   selectedDate,
   setSelectedDate,
   todasDisponibilidades,
   atendimentosSemana,
   loading
}) => {
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
      { key: 'reserva', label: 'Reserva', bg: 'bg-yellow-400', fg: 'text-black', color: 'text-yellow-500' },
      { key: 'cliente', label: 'Cliente', bg: 'bg-blue-500', fg: 'text-white', color: 'text-blue-400' },
      { key: 'possiveis', label: 'Possíveis', bg: 'bg-transparent', fg: 'text-black', color: 'text-blue-300', isMetric: true },
      { key: 'sistema', label: 'Sistema', bg: 'bg-transparent', fg: 'text-black', color: 'text-purple-400', isMetric: true },
      { key: 'aproveitamento', label: 'Aproveitamento', bg: 'bg-indigo-600', fg: 'text-white', color: 'text-indigo-400', isMetric: true },
   ];

   // Calcula métricas para cada dia
   const dayMetrics = weekDays.map(d => {
      const iso = formatISO(d);
      const dispsRaw = todasDisponibilidades.filter((disp: any) => {
         const dispDate = typeof disp.data === 'string' ? disp.data.split('T')[0] : formatISO(new Date(disp.data));
         return dispDate === iso;
      });

      // 1. Unicidade por Profissional (Headcount)
      // Agrupa pelo profissional_id e pega a versão mais recente dos dados
      const profsDayMap = new Map<string, any>();
      dispsRaw.forEach(disp => {
         const pid = disp.profissional_id;
         if (!profsDayMap.has(pid)) {
            profsDayMap.set(pid, disp);
         } else {
            const existing = profsDayMap.get(pid);
            if (new Date(disp.updated_at) > new Date(existing.updated_at)) {
               profsDayMap.set(pid, disp);
            }
         }
      });

      const uniqueProfs = Array.from(profsDayMap.values());

      // 2. Classificação de Status com Prioridade (Exclusividade)
      let livre = 0;
      let nao = 0;
      let cancelou = 0;
      let faltou = 0;
      let reserva = 0;
      let clienteHeadcount = 0;

      uniqueProfs.forEach(p => {
         const profNome = (p.profissional?.nome || '').trim().toLowerCase();
         
         // Verifica se a profissional tem agendamento real neste dia
         const hasAtendimento = atendimentosSemana.some((a: any) => {
            const aDate = typeof a.DATA === 'string' && a.DATA.includes('T') ? a.DATA.split('T')[0] : a.DATA;
            const atProf = (a.PROFISSIONAL || '').trim().toLowerCase();
            return aDate === iso && !!a.PROFISSIONAL && atProf === profNome;
         });

         const hasLivreManual = p.status_manha === 'LIVRE' || p.status_tarde === 'LIVRE';
         const hasReservaManual = p.status_manha === 'RESERVA' || p.status_tarde === 'RESERVA';
         const hasCancelouManual = p.status_manha === 'CANCELOU' || p.status_tarde === 'CANCELOU';
         const hasFaltouManual = p.status_manha === 'FALTOU' || p.status_tarde === 'FALTOU';
         const hasNaoManual = p.status_manha === 'NÃO' || p.status_tarde === 'NÃO';

         // HIERARQUIA DE PRIORIDADE (Mutuamente Exclusivo)
         if (hasAtendimento) {
            clienteHeadcount++;
         } else if (hasReservaManual) {
            reserva++;
         } else if (hasCancelouManual) {
            cancelou++;
         } else if (hasFaltouManual) {
            faltou++;
         } else if (hasLivreManual) {
            // Se tiver pelo menos um período LIVRE e nenhum atendimento/reserva/falta, conta como LIVRE
            livre++;
         } else if (hasNaoManual) {
            // Só conta como NÃO se não tiver nenhum período LIVRE (ou outros status acima)
            nao++;
         }
      });

      // Cliente: Atendimentos com profissional (Métrica de Demanda Atendida)
      const clienteTotalSpots = atendimentosSemana.filter((a: any) => {
         const aDate = typeof a.DATA === 'string' && a.DATA.includes('T') ? a.DATA.split('T')[0] : a.DATA;
         return aDate === iso && !!a.PROFISSIONAL;
      }).length;

      // Sistema: TODOS os atendimentos do dia (Demanda Total)
      const sistema = atendimentosSemana.filter((a: any) => {
         const aDate = typeof a.DATA === 'string' && a.DATA.includes('T') ? a.DATA.split('T')[0] : a.DATA;
         return aDate === iso;
      }).length;

      // Capacidade Real = Headcount (Livre + Ocupada + Reserva)
      // Usamos clienteHeadcount para contar PESSOAS reais, não serviços duplicados
      const possiveis = livre + clienteHeadcount + reserva;
      const aproveitamento = possiveis > 0 ? Math.round((sistema / possiveis) * 100) : 0;

      // No resumo mantemos a contagem de CLIENTE como o número de pessoas ocupadas para dar consistência ao headcount
      return { iso, livre, nao, cancelou, faltou, reserva, cliente: clienteHeadcount, possiveis, sistema, aproveitamento };
   });

   const totals = dayMetrics.reduce(
      (acc, m) => ({
         livre: acc.livre + m.livre,
         nao: acc.nao + m.nao,
         cancelou: acc.cancelou + m.cancelou,
         faltou: acc.faltou + m.faltou,
         reserva: (acc.reserva || 0) + m.reserva,
         cliente: acc.cliente + m.cliente,
         possiveis: acc.possiveis + m.possiveis,
         sistema: acc.sistema + m.sistema,
         aproveitamento: 0 
      }),
      { livre: 0, nao: 0, cancelou: 0, faltou: 0, reserva: 0, cliente: 0, possiveis: 0, sistema: 0, aproveitamento: 0 }
   );
   totals.aproveitamento = totals.possiveis > 0 ? Math.round((totals.sistema / totals.possiveis) * 100) : 0;

   const DAY_LABELS = ['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];

   const isToday = (d: Date) => formatISO(d) === formatISO(new Date());
   const isSelected = (d: Date) => formatISO(d) === formatISO(selectedDate);

   const getCellValue = (m: typeof dayMetrics[0], key: string): number => {
      return (m as any)[key] ?? 0;
   };

   return (
      <div className="bg-bg-secondary rounded-xl border border-border-secondary shadow-md p-3 flex flex-col h-full w-full overflow-hidden">
         <div className="flex items-center justify-center gap-2 mb-3 w-full shrink-0">
            <span className="text-sm font-bold text-text-primary capitalize">{headerLabel}</span>
            {loading && (
               <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-accent-primary" />
            )}
         </div>

         {/* Container para scroll horizontal sincronizado */}
         <div className="flex-1 min-h-0 overflow-x-auto custom-scrollbar-horizontal pb-2">
            {/* Headers da Grid */}
            <div className="grid grid-cols-8 gap-2 min-w-[700px] mb-2 pr-2">
               <div className="flex items-center justify-center text-center text-[10px] sm:text-xs font-bold text-text-secondary py-1.5 bg-bg-tertiary rounded-md h-full">
                  Status
               </div>
               {weekDays.map((d, i) => (
                  <div
                     key={i}
                     className={`flex flex-col items-center justify-center py-1.5 px-0.5 text-center text-xs font-bold rounded-md h-full transition-all ${isSelected(d)
                        ? 'bg-accent-primary text-text-on-accent shadow-sm ring-1 ring-accent-primary/20'
                        : isToday(d)
                           ? 'bg-bg-tertiary text-text-primary'
                           : 'bg-bg-tertiary text-text-secondary'
                        }`}
                  >
                     <span className="block text-[9px] sm:text-[10px]">{DAY_LABELS[i]}</span>
                     <span className="block font-medium text-[9px] sm:text-[10px]">{fmt(d)}</span>
                  </div>
               ))}
               <div className="flex items-center justify-center text-center text-[10px] sm:text-xs font-bold text-text-secondary py-1.5 bg-bg-tertiary rounded-md h-full">
                  Total
               </div>
            </div>

            {/* Conteúdo da Grid */}
            <div className="grid grid-cols-8 gap-2 items-stretch min-w-[700px] pr-2">
               {labels.map(({ key, label, bg, fg, isMetric }) => (
                  <React.Fragment key={key}>
                     {key === 'possiveis' && (
                        <div className="col-span-8 border-t-2 border-dashed border-border-secondary my-1" />
                     )}

                     <div className={`py-1.5 px-1 flex flex-col items-center justify-center text-center font-black uppercase tracking-tight rounded-md overflow-hidden text-ellipsis
                        ${key === 'possiveis' || key === 'sistema' ? 'text-[10px] sm:text-[11px] md:text-sm pt-2' : 'text-[8px] sm:text-[9px] lg:text-[10px] whitespace-nowrap lg:whitespace-normal'}
                        ${key === 'aproveitamento' ? '' : `${bg} ${fg} ${isMetric ? 'opacity-90' : ''}`}
                     `}>
                        {key === 'aproveitamento' ? '' : label}
                     </div>

                     {dayMetrics.map((m, i) => {
                        const val = getCellValue(m, key);
                        const sel = isSelected(weekDays[i]);
                        const isAproveitamento = key === 'aproveitamento';
                        return (
                           <div
                              key={i}
                              onClick={!isAproveitamento ? () => setSelectedDate(weekDays[i]) : undefined}
                              className={`py-1.5 px-1 flex flex-col items-center justify-center text-center font-medium rounded-md transition-colors ${isAproveitamento
                                 ? (sel ? 'text-accent-primary font-bold text-sm sm:text-base lg:text-xl' : 'text-text-tertiary font-bold text-sm sm:text-base lg:text-xl')
                                 : `border cursor-pointer ${key === 'possiveis' || key === 'sistema' ? 'text-xs sm:text-sm lg:text-base font-bold' : 'text-[10px] sm:text-xs lg:text-sm'} ${sel
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

                     <div className={`py-1.5 px-1 flex items-center justify-center text-center font-black rounded-md ${key === 'aproveitamento'
                        ? 'text-text-tertiary text-sm sm:text-base lg:text-lg'
                        : `border border-border-secondary ${key === 'possiveis' || key === 'sistema' ? 'text-xs sm:text-sm lg:text-base' : 'text-[10px] sm:text-xs lg:text-sm'} ${isMetric ? 'bg-bg-tertiary/60' : 'bg-bg-tertiary'} ${(totals as any)[key] === 0 ? 'text-text-tertiary/40' : 'text-text-primary'}`
                        }`}>
                        {(totals as any)[key]}{key === 'aproveitamento' ? '%' : ''}
                     </div>
                  </React.Fragment>
               ))}
            </div>
         </div>
      </div>
   );
};

export default AgendaWeekSummary;
