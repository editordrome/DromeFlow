import React from 'react';
import { Icon } from '../../ui/Icon';
import { matchName } from '../helpers';

interface AgendaProfissionaisLivresProps {
   loading: boolean;
   selectedDate: Date;
   profissionaisLivres: any[];
   selectedProfDetails: any;
   setSelectedProfDetails: (p: any) => void;
   profMetricas: Record<string, any>;
   loadProfissionalMetrics: (id: string, name: string) => void;
   activeMetricPeriod: 'd7' | 'd30' | 'geral';
   setActiveMetricPeriod: (p: 'd7' | 'd30' | 'geral') => void;
   atendimentosDia: any[];
   handleDragStartProfissional: (e: React.DragEvent, p: any) => void;
   handleDragOver: (e: React.DragEvent) => void;
   handleDropToProfissionais: (e: React.DragEvent) => void;
}

export const AgendaProfissionaisLivres: React.FC<AgendaProfissionaisLivresProps> = ({
   loading,
   selectedDate,
   profissionaisLivres,
   selectedProfDetails,
   setSelectedProfDetails,
   profMetricas = {},
   loadProfissionalMetrics,
   activeMetricPeriod,
   setActiveMetricPeriod,
   atendimentosDia,
   handleDragStartProfissional,
   handleDragOver,
   handleDropToProfissionais
}) => {
   return (
      <div
         className="lg:col-span-1 bg-bg-secondary rounded-xl border border-border-secondary flex flex-col overflow-hidden h-full"
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
                                 if (p.profissional?.id && typeof loadProfissionalMetrics === 'function') {
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
                                    <span className="text-[11px] font-black text-accent-primary">{profMetricas[selectedProfDetails.profissional?.id]?.geral?.conf?.tx ?? 0}%</span>
                                 </div>
                              </div>

                              <div className="p-3 space-y-3">
                                 <div className="grid grid-cols-3 gap-1.5">
                                    {(['d7', 'd30', 'geral'] as const).map((period) => {
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
                                                {metrics?.[period]?.conf?.tx ?? 0}%
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
   );
};

export default AgendaProfissionaisLivres;
