import React from 'react';
import { Icon } from '../../ui/Icon';

interface AgendaAtendimentosListProps {
   loading: boolean;
   selectedDate: Date;
   atendimentosDia: any[];
   filterSemProfissional: boolean;
   setFilterSemProfissional: (v: boolean) => void;
   handleDragOver: (e: React.DragEvent) => void;
   handleDropOnAtendimento: (e: React.DragEvent, a: any) => void;
   handleDragStartRemoveProfissional: (e: React.DragEvent, a: any) => void;
}

export const AgendaAtendimentosList: React.FC<AgendaAtendimentosListProps> = ({
   loading,
   selectedDate,
   atendimentosDia,
   filterSemProfissional,
   setFilterSemProfissional,
   handleDragOver,
   handleDropOnAtendimento,
   handleDragStartRemoveProfissional
}) => {
   const filteredAts = atendimentosDia.filter(a => !filterSemProfissional || !a.PROFISSIONAL);

   return (
      <div className="lg:col-span-1 bg-bg-secondary rounded-xl border border-border-secondary flex flex-col overflow-hidden h-full">
         <div className="p-4 border-b border-border-secondary flex items-center justify-between shrink-0 bg-bg-tertiary">
            <h3 className="font-bold flex items-center gap-2 text-sm text-text-primary">
               <Icon name="CalendarCheck" className="w-4 h-4 text-text-secondary" />
               Atendimentos - {selectedDate.toLocaleDateString('pt-BR')}
            </h3>
            <div className="flex items-center gap-2">
               <button
                  onClick={() => setFilterSemProfissional(!filterSemProfissional)}
                  className={`p-1.5 rounded transition-colors cursor-pointer ${filterSemProfissional ? 'bg-accent-primary text-text-on-accent' : 'bg-bg-secondary text-text-secondary hover:bg-bg-tertiary border border-border-secondary'}`}
                  title={filterSemProfissional ? "Remover filtro" : "Mostrar apenas sem profissional"}
               >
                  <Icon name="Filter" className="w-3.5 h-3.5" />
               </button>
               <span className="text-xs bg-bg-secondary px-2 py-1 rounded text-text-secondary">{atendimentosDia.length}</span>
            </div>
         </div>
         <div className="flex-1 overflow-y-auto p-4 transition-all">
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
                  {filteredAts.length === 0 && filterSemProfissional ? (
                     <div className="py-8 flex flex-col items-center justify-center text-center text-text-tertiary">
                        <Icon name="UserCheck" className="w-8 h-8 opacity-30 mb-2" />
                        <span className="text-sm text-text-secondary">Todos os atendimentos possuem profissional.</span>
                     </div>
                  ) : (
                     filteredAts.map((a, i) => {
                        const horarioRaw = a.HORARIO || '';
                        const horarioFormat = horarioRaw.match(/^(\d{1,2}:\d{2})/) ? horarioRaw.match(/^(\d{1,2}:\d{2})/)[1] : horarioRaw;

                        return (
                           <div
                              key={i}
                              onDragOver={handleDragOver}
                              onDrop={(e) => handleDropOnAtendimento(e, a)}
                              className="p-3 bg-bg-tertiary border border-border-secondary rounded-lg hover:border-text-secondary transition-colors"
                           >
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

                              <div className="flex justify-center items-center mb-2">
                                 <p className="font-bold text-sm text-text-primary truncate text-center" title={a.CLIENTE}>{a.CLIENTE}</p>
                              </div>

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
   );
};

export default AgendaAtendimentosList;
