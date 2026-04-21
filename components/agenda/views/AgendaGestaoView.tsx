import React from 'react';
import { Icon } from '../../../ui/Icon';
import { AgendaCalendar } from '../ui/AgendaCalendar';
import { WeekSummary } from '../ui/WeekSummary';
import { useDroppable } from '@dnd-kit/core';
import { AtendimentoCard } from './AtendimentoCard';

interface AgendaGestaoViewProps {
   selectedDate: Date;
   setSelectedDate: (date: Date) => void;
   todasDisponibilidades: any[];
   atendimentosSemana: any[];
   atendimentosDia: any[];
   profissionaisLivres: any[];
   loading: boolean;
   searchGestao: string;
   setSearchGestao: (s: string) => void;
   metrics: any; // profMetricas
}

export const AgendaGestaoView: React.FC<AgendaGestaoViewProps> = ({
   selectedDate,
   setSelectedDate,
   todasDisponibilidades,
   atendimentosSemana,
   atendimentosDia,
   profissionaisLivres,
   loading,
   searchGestao,
   setSearchGestao,
   metrics
}) => {
   // Esta View receberá no futuro a iteração completa do DND.
   // Por enquanto, ela serve como wrapper layout.
   const handleDateSelect = (isoStr: string, dateObj: Date) => {
      setSelectedDate(dateObj);
   };

   return (
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 pb-[200px] items-start pt-4 h-full">
         
         {/* Lado Esquerdo - Calendário e Filtros */}
         <div className="xl:col-span-3 flex flex-col gap-6 sticky top-24 h-[calc(100vh-120px)] overflow-y-auto custom-scrollbar pr-2">
            
            <div className="bg-bg-secondary rounded-2xl border border-border-secondary p-4 sm:p-5 shadow-sm">
               <div className="flex items-center gap-2 mb-4">
                  <Icon name="Search" className="w-5 h-5 text-text-secondary" />
                  <h3 className="text-sm font-black text-text-primary uppercase tracking-tight">Buscar Profissional</h3>
               </div>
               <input
                  type="text"
                  placeholder="Ex: Maria Silvia..."
                  value={searchGestao}
                  onChange={e => setSearchGestao(e.target.value)}
                  className="w-full bg-bg-tertiary border border-border-secondary rounded-xl px-4 py-3 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent-primary focus:ring-1 focus:ring-accent-primary transition-all font-medium"
               />
            </div>

            {/* Calendário Unificado */}
            <div className="h-[280px] shrink-0">
               <AgendaCalendar
                  mode="gestao"
                  selectedDate={selectedDate}
                  onDateSelect={handleDateSelect}
               />
            </div>

            {/* Resumo Semanal Unificado */}
            <div className="bg-bg-secondary rounded-2xl border border-border-secondary shadow-sm min-h-[350px] flex flex-col overflow-hidden">
               <WeekSummary
                  selectedDate={selectedDate}
                  setSelectedDate={setSelectedDate}
                  todasDisponibilidades={todasDisponibilidades}
                  atendimentosSemana={atendimentosSemana}
                  loading={loading}
               />
            </div>
         </div>

         {/* Lado Direito - DndContext (Será renderizado pelo contêiner pai no AgendaPage.tsx atual, 
         aqui teríamos as colunas de "LIVRES" e "ATENDIMENTOS".
         Como placeholder do plano de refatoração estrutural, transferimos a responsabilidade do SidePanel para esta view. */}
         <div className="xl:col-span-9 bg-bg-secondary rounded-2xl border border-border-secondary h-[calc(100vh-120px)] overflow-hidden flex flex-col relative w-full" id="gestao-board-portal">
            <div className="absolute inset-0 flex items-center justify-center p-8 bg-dashed-primary z-50">
               <div className="text-center">
                  <h2 className="text-xl font-bold text-text-primary mb-2">Painel de Gestão e Alocação</h2>
                  <p className="text-text-secondary w-[80%] mx-auto">
                     A lógica pesada do React-Dnd permanecerá no contêiner principal para manter a integridade dos Sensors e Modifiers nesta fase. O Layout lateral já foi totalmente desacoplado.
                  </p>
               </div>
            </div>
         </div>
      </div>
   );
};

// Componente dummy para compilar
const AtendimentoCard = () => <div/>;
