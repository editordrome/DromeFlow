import React, { useState, useEffect } from 'react';
import { Icon } from '../../ui/Icon';
import { formatLocalISO } from '../helpers';

interface AgendaCalendarProps {
   mode: 'gestao' | 'configuracao';
   selectedDate?: Date; // Data principal (Gestão)
   diasLiberados?: string[]; // Array de ISOs (Configuração)
   onDateSelect: (dateStr: string, dateObj: Date) => void;
}

export const AgendaCalendar: React.FC<AgendaCalendarProps> = ({
   mode,
   selectedDate,
   diasLiberados = [],
   onDateSelect
}) => {
   // O mês principal visualizado na tela
   const [viewDate, setViewDate] = useState<Date>(selectedDate || new Date());

   // Sincroniza a visão do calendário apenas quando a data selecionada mudar de fato (clique ou externa)
   const [lastIso, setLastIso] = useState<string | null>(selectedDate ? formatLocalISO(selectedDate) : null);

   useEffect(() => {
      if (selectedDate && mode === 'gestao') {
         const currentIso = formatLocalISO(selectedDate);
         if (currentIso !== lastIso) {
            setViewDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1));
            setLastIso(currentIso);
         }
      }
   }, [selectedDate, mode, lastIso]);

   const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
   const getFirstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

   const year = viewDate.getFullYear();
   const month = viewDate.getMonth();
   const daysInMonth = getDaysInMonth(year, month);
   const firstDay = getFirstDayOfMonth(year, month);

   const prevMonth = () => setViewDate(new Date(year, month - 1, 1));
   const nextMonth = () => setViewDate(new Date(year, month + 1, 1));

   const monthStr = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(viewDate).replace(' de ', ' ');
   
   const hoje = new Date();
   hoje.setHours(0, 0, 0, 0);

   const days = [];
   for (let i = 0; i < firstDay; i++) {
      days.push(
         <div key={`empty-${i}`} className="p-2 opacity-10 text-center h-full"></div>
      );
   }

   for (let i = 1; i <= daysInMonth; i++) {
      const dateObj = new Date(year, month, i);
      const isoStr = formatLocalISO(dateObj);
      
      let isSelected = false;
      let isDisabled = false;

      if (mode === 'gestao') {
         if (selectedDate && formatLocalISO(selectedDate) === isoStr) {
            isSelected = true;
         }
      } else {
         isSelected = diasLiberados.includes(isoStr);
         isDisabled = dateObj < hoje;
      }

      const handleClick = () => {
         if (!isDisabled) {
            onDateSelect(isoStr, dateObj);
         }
      };

      days.push(
         <div
            key={i}
            onClick={handleClick}
            className={`h-full min-h-[2.5rem] flex items-center justify-center text-sm font-bold rounded-xl transition-all border cursor-pointer
             ${isDisabled
               ? 'opacity-20 cursor-not-allowed bg-bg-tertiary border-transparent text-text-tertiary'
               : isSelected
                  ? 'bg-accent-primary border-accent-primary text-text-on-accent shadow-md scale-[1.03] z-10'
                  : 'border-border-secondary text-text-secondary hover:bg-bg-tertiary hover:border-border-primary hover:scale-[1.03] bg-bg-primary'
            }`}
         >
            {i}
         </div>
      );
   }

   return (
      <div className="bg-bg-secondary rounded-xl border border-border-secondary overflow-hidden shadow-md p-3 flex flex-col h-full w-full">
         <div className="flex items-center justify-between mb-2 w-full px-2">
            <button onClick={prevMonth} className="p-2 hover:bg-bg-tertiary rounded-xl text-text-secondary transition-colors cursor-pointer">
               <Icon name="ChevronLeft" className="w-5 h-5" />
            </button>
            <div className="text-lg font-black tracking-tight text-text-primary capitalize">{monthStr}</div>
            <button onClick={nextMonth} className="p-2 hover:bg-bg-tertiary rounded-xl text-text-secondary transition-colors cursor-pointer">
               <Icon name="ChevronRight" className="w-5 h-5" />
            </button>
         </div>

         <div className="grid grid-cols-7 gap-2 mb-2 w-full px-2">
            {['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'].map(day => (
               <div key={day} className="text-center text-[10px] sm:text-xs font-bold text-text-secondary py-1.5 bg-bg-tertiary rounded-lg uppercase tracking-wider">
                  {day}
               </div>
            ))}
         </div>

         <div className="grid grid-cols-7 gap-2 flex-1 w-full px-2 pb-2">
            {days}
         </div>
      </div>
   );
};
