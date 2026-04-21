import React, { useState } from 'react';
import { Icon } from '../ui/Icon';
import { useAuth } from '../../contexts/AuthContext';
import { useAppContext } from '../../contexts/AppContext';

// Hooks Modulados
import { useAgendaPrincipal } from '../agenda/hooks/useAgendaPrincipal';
import { useAgendaConfig } from '../agenda/hooks/useAgendaConfig';
import { useAgendaDnd } from '../agenda/hooks/useAgendaDnd';

// Views e Modais
import { AgendaPrincipalView } from '../agenda/views/AgendaPrincipalView';
import { AgendaConfiguracoesView } from '../agenda/views/AgendaConfiguracoesView';
import { AgendaModals } from '../agenda/ui/AgendaModals';

const AgendaPage: React.FC = () => {
   const { user } = useAuth();
   const { selectedUnit } = useAppContext();

   // Estados de Navegação de UI (troca de abas)
   const [activeTab, setActiveTab] = useState<'gestao' | 'disponibilidade' | 'configuracoes'>('gestao');
   
   // Hooks de Lógica
   const agenda = useAgendaPrincipal(selectedUnit);
   const config = useAgendaConfig(selectedUnit);
   const dnd = useAgendaDnd(selectedUnit, agenda);

   // Estados de Modais
   const [profModalData, setProfModalData] = useState<any | null>(null);
   const [conflictModal, setConflictModal] = useState<any | null>(null);
   const [selectedSidebarAtendimento, setSelectedSidebarAtendimento] = useState<any | null>(null);

   // Link público
   const linkAcessoPublico = (selectedUnit && (selectedUnit as any).id !== 'ALL')
      ? `https://agenda.dromeflow.com/${selectedUnit.unit_code}`
      : '';

   if (!selectedUnit) {
      return (
         <div className="flex flex-col h-screen bg-bg-primary items-center justify-center text-text-tertiary">
            <Icon name="CalendarDays" className="w-12 h-12 mb-4 opacity-20" />
            <p className="text-sm font-bold uppercase tracking-widest">Selecione uma unidade para gerenciar a agenda</p>
         </div>
      );
   }

   return (
      <div className="flex flex-col h-screen bg-bg-primary overflow-hidden">
         {/* HEADER */}
         <header className="shrink-0 bg-bg-secondary border-b border-border-secondary p-4 grid grid-cols-3 items-center z-10">
            <div className="flex items-center gap-4">
               <h1 className="text-2xl font-bold text-text-primary">Agenda</h1>
            </div>

            <div className="flex justify-center">
               <div className="flex bg-bg-tertiary p-1 rounded-xl border border-border-secondary">
                  <button
                     onClick={() => setActiveTab('gestao')}
                     className={`px-6 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'gestao' ? 'bg-bg-primary text-accent-primary shadow-sm border border-border-secondary' : 'text-text-tertiary hover:text-text-secondary'}`}
                  >
                     Gestão
                  </button>
                  <button
                     onClick={() => setActiveTab('disponibilidade')}
                     className={`px-6 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'disponibilidade' ? 'bg-bg-primary text-accent-primary shadow-sm border border-border-secondary' : 'text-text-tertiary hover:text-text-secondary'}`}
                  >
                     Disponibilidade
                  </button>
                  <button
                     onClick={() => setActiveTab('configuracoes')}
                     className={`px-6 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'configuracoes' ? 'bg-bg-primary text-accent-primary shadow-sm border border-border-secondary' : 'text-text-tertiary hover:text-text-secondary'}`}
                  >
                     Configurações
                  </button>
               </div>
            </div>

            <div className="flex justify-end">
               {activeTab === 'configuracoes' && linkAcessoPublico && (
                  <div className="flex items-center gap-3 animate-in fade-in slide-in-from-right-2 duration-500">
                     <div className="bg-bg-tertiary px-3 py-1.5 rounded-xl border border-border-secondary flex items-center gap-3 shadow-sm">
                        <span className="text-[10px] font-black text-text-tertiary uppercase tracking-widest whitespace-nowrap">Link Público:</span>
                        <p className="text-[10px] text-brand-cyan font-mono truncate max-w-[150px] font-bold">
                           {linkAcessoPublico?.split('/').pop() || 'Link'}
                        </p>
                        <button
                           onClick={() => {
                              navigator.clipboard.writeText(linkAcessoPublico);
                              alert('Link copiado!');
                           }}
                           className="p-1.5 bg-bg-secondary hover:bg-bg-tertiary rounded-lg text-text-primary transition-colors shrink-0 border border-border-secondary/50 active:scale-90"
                           title="Copiar Link"
                        >
                           <Icon name="Copy" className="w-3.5 h-3.5" />
                        </button>
                     </div>
                  </div>
               )}
            </div>
         </header>

         {/* MAIN CONTENT */}
         <main className="flex-1 overflow-hidden relative min-h-0">
            {activeTab === 'gestao' && (
               <AgendaPrincipalView
                  agenda={agenda}
                  dnd={dnd}
                  selectedUnit={selectedUnit}
                  activeMetricPeriod={agenda.activeMetricPeriod}
                  setActiveMetricPeriod={agenda.setActiveMetricPeriod}
                  setProfModalData={setProfModalData}
                  setConflictModal={setConflictModal}
                  setSelectedSidebarAtendimento={setSelectedSidebarAtendimento}
               />
            )}
            
            {(activeTab === 'disponibilidade' || activeTab === 'configuracoes') && (
               <AgendaConfiguracoesView
                  config={config}
                  selectedUnit={selectedUnit}
                  loading={agenda.loading}
                  linkAcessoPublico={linkAcessoPublico}
                  atendimentosSemana={agenda.atendimentosSemana}
                  configTab={activeTab === 'disponibilidade' ? 'metricas' : 'parametros'}
                  setConfigTab={() => {}} // Agora controlado pelo AgendaPage
                  selectedDate={agenda.selectedDate}
                  setSelectedDate={agenda.setSelectedDate}
                  weekDatesMap={agenda.weekDatesMap}
                  activeMetricPeriod={agenda.activeMetricPeriod}
                  setActiveMetricPeriod={agenda.setActiveMetricPeriod}
                  statusMenu={agenda.statusMenu}
                  setStatusMenu={agenda.setStatusMenu}
                  setConflictModal={setConflictModal}
                  setProfModalData={setProfModalData}
                  profWithMetrics={config.profWithMetrics}
                  setProfWithMetrics={config.setProfWithMetrics}
               />
            )}
         </main>

         {/* MODALS */}
         <AgendaModals
            profModalData={profModalData}
            setProfModalData={setProfModalData}
            profMetricas={config.profMetricas}
            atendimentosDia={agenda.atendimentosDia}
            selectedDate={agenda.selectedDate}
            conflictModal={conflictModal}
            setConflictModal={setConflictModal}
            selectedSidebarAtendimento={selectedSidebarAtendimento}
            setSelectedSidebarAtendimento={setSelectedSidebarAtendimento}
            activeMetricPeriod={agenda.activeMetricPeriod}
            setActiveMetricPeriod={agenda.setActiveMetricPeriod}
         />
      </div>
   );
};

export default AgendaPage;
