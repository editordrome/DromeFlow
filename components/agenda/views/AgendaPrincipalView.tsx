import React from 'react';
import { AgendaCalendar } from '../ui/AgendaCalendar';
import { AgendaProfissionaisLivres } from '../ui/AgendaProfissionaisLivres';
import { AgendaAtendimentosList } from '../ui/AgendaAtendimentosList';
import { AgendaWeekSummary } from '../ui/AgendaWeekSummary';

interface AgendaPrincipalViewProps {
   agenda: any;
   dnd: any;
   selectedUnit: any;
   activeMetricPeriod: 'd7' | 'd30' | 'geral';
   setActiveMetricPeriod: (p: 'd7' | 'd30' | 'geral') => void;
   setProfModalData: (data: any) => void;
   setConflictModal: (data: any) => void;
   setSelectedSidebarAtendimento: (data: any) => void;
}

export const AgendaPrincipalView: React.FC<AgendaPrincipalViewProps> = ({
   agenda,
   dnd,
   selectedUnit,
   activeMetricPeriod,
   setActiveMetricPeriod,
   setProfModalData,
   setConflictModal,
   setSelectedSidebarAtendimento
}) => {
   const {
      loading, profissionaisLivres, atendimentosDia, atendimentosSemana,
      todasDisponibilidades, profMetricas, loadProfissionalMetrics, selectedProfDetails, setSelectedProfDetails,
      selectedDate, setSelectedDate, filterSemProfissional, setFilterSemProfissional
   } = agenda;

   const {
      handleDragStartProfissional, handleDragOver, handleDropToProfissionais,
      handleDropOnAtendimento, handleDragStartRemoveProfissional
   } = dnd;

   return (
      <div className="flex flex-col h-full w-full p-4 sm:p-6 overflow-hidden bg-bg-primary">
         {/* MAIN GRID - 4 Colunas no desktop para equilibrar Left (75%) e Right (25%) */}
         <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-full w-full overflow-hidden">
            
            {/* LADO ESQUERDO/CENTRO: Calendario, Métricas e Profissionais Livres */}
            <div className="lg:col-span-3 grid grid-rows-2 gap-6 h-full overflow-hidden">
               
               {/* Linha 1 (Topo): Calendário e Profissionais Livres */}
               <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 min-h-0 overflow-hidden">
                  <div className="lg:col-span-2 h-full overflow-hidden">
                     <AgendaCalendar 
                        mode="gestao"
                        selectedDate={selectedDate}
                        onDateSelect={(_, dateObj) => setSelectedDate(dateObj)}
                     />
                  </div>
                  
                  <div className="h-full overflow-hidden">
                     <AgendaProfissionaisLivres 
                        loading={loading}
                        selectedDate={selectedDate}
                        profissionaisLivres={profissionaisLivres}
                        selectedProfDetails={selectedProfDetails}
                        setSelectedProfDetails={setSelectedProfDetails}
                        profMetricas={profMetricas}
                        loadProfissionalMetrics={loadProfissionalMetrics}
                        activeMetricPeriod={activeMetricPeriod}
                        setActiveMetricPeriod={setActiveMetricPeriod}
                        atendimentosDia={atendimentosDia}
                        handleDragStartProfissional={handleDragStartProfissional}
                        handleDragOver={handleDragOver}
                        handleDropToProfissionais={handleDropToProfissionais}
                     />
                  </div>
               </div>

               {/* Linha 2 (Base): Quadro Semanal de Métricas */}
               <div className="min-h-0 h-full overflow-hidden">
                  <AgendaWeekSummary 
                     selectedDate={selectedDate}
                     setSelectedDate={setSelectedDate}
                     todasDisponibilidades={todasDisponibilidades}
                     atendimentosSemana={atendimentosSemana}
                     loading={loading}
                  />
               </div>
            </div>

            {/* DIREITA: Lista Lateral de Atendimentos */}
            <div className="lg:col-span-1 h-full overflow-hidden">
               <AgendaAtendimentosList 
                  loading={loading}
                  selectedDate={selectedDate}
                  atendimentosDia={atendimentosDia}
                  filterSemProfissional={filterSemProfissional}
                  setFilterSemProfissional={setFilterSemProfissional}
                  handleDragOver={handleDragOver}
                  handleDropOnAtendimento={handleDropOnAtendimento}
                  handleDragStartRemoveProfissional={handleDragStartRemoveProfissional}
               />
            </div>

         </div>
      </div>
   );
};

export default AgendaPrincipalView;
