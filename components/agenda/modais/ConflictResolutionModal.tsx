import React from 'react';
import { Icon } from '../../../ui/Icon';

interface ConflictResolutionModalProps {
   isOpen: boolean;
   onClose: () => void;
   conflictData: any; // { date, period, profId, profName, appointments }
   todasProfissionais: any[];
   onReallocate: (appointmentId: string, newProfId: string, newProfName: string) => Promise<void>;
   loadingAction: string | null;
}

export const ConflictResolutionModal: React.FC<ConflictResolutionModalProps> = ({
   isOpen,
   onClose,
   conflictData,
   todasProfissionais,
   onReallocate,
   loadingAction
}) => {
   if (!isOpen || !conflictData) return null;

   return (
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-[60] overflow-y-auto w-full h-full">
         <div className="bg-bg-primary border border-border-secondary rounded-2xl w-[95%] sm:w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-border-secondary flex justify-between items-center bg-red-500/10">
               <div className="flex items-center gap-3">
                  <div className="p-2 bg-red-500 rounded-lg shrink-0">
                     <Icon name="AlertTriangle" className="w-5 h-5 text-white" />
                  </div>
                  <div>
                     <h2 className="text-lg font-bold text-text-primary uppercase tracking-tight line-clamp-1">
                        Resolução de Conflito
                     </h2>
                     <p className="text-sm text-red-400 font-medium">
                        {conflictData.profName} marcou NÃO DISPONÍVEL, mas possui atendimentos.
                     </p>
                  </div>
               </div>
               <button onClick={onClose} className="p-2 hover:bg-bg-secondary rounded-xl text-text-secondary transition-colors shrink-0">
                  <Icon name="X" className="w-5 h-5" />
               </button>
            </div>

            <div className="p-4 overflow-y-auto custom-scrollbar flex-1">
               <div className="mb-4">
                  <p className="text-sm text-text-secondary">
                     Abaixo estão os agendamentos da profissional para o período marcado como indisponível. Para resolver o conflito, você deve repassar os antendimentos para outra profissional ou remanejar.
                  </p>
               </div>

               <div className="space-y-3">
                  {conflictData.appointments.map((apt: any) => (
                     <div key={apt.id} className="p-3 bg-bg-secondary border border-red-500/30 rounded-xl relative">
                        <div className="flex flex-col sm:flex-row justify-between sm:items-start gap-4">
                           <div>
                              <div className="text-sm font-bold text-text-primary mb-1">
                                 {apt.CLIENTE_NOME}
                              </div>
                              <div className="text-xs text-text-secondary flex flex-wrap gap-2 mb-2">
                                 <span className="bg-bg-tertiary px-2 py-0.5 rounded-md">{apt.BAIRRO}</span>
                                 <span className="bg-bg-tertiary px-2 py-0.5 rounded-md">{apt.HORARIO} ({apt.PERIODO}h)</span>
                                 <span className="bg-bg-tertiary px-2 py-0.5 rounded-md">{apt['SERVIÇO']}</span>
                              </div>
                           </div>

                           <div className="flex flex-col gap-2 min-w-[200px]">
                              <label className="text-xs font-bold text-text-secondary uppercase">
                                 Realocar para:
                              </label>
                              <select
                                 className="w-full bg-bg-tertiary border border-border-secondary rounded-lg px-2 py-1.5 text-sm outline-none focus:border-accent-primary"
                                 onChange={(e) => {
                                    if (e.target.value) {
                                       const selectedProf = todasProfissionais.find(p => p.id === e.target.value);
                                       if (selectedProf) {
                                          onReallocate(apt.id, selectedProf.id, selectedProf.nome);
                                       }
                                       // Reseta o select
                                       e.target.value = '';
                                    }
                                 }}
                                 disabled={loadingAction === apt.id}
                              >
                                 <option value="">Selecione...</option>
                                 {todasProfissionais
                                    .filter(p => p.id !== conflictData.profId)
                                    .map(p => (
                                       <option key={p.id} value={p.id}>{p.nome}</option>
                                    ))
                                 }
                              </select>
                              {loadingAction === apt.id && (
                                 <div className="text-xs text-accent-primary animate-pulse">
                                    Realocando...
                                 </div>
                              )}
                           </div>
                        </div>
                     </div>
                  ))}
               </div>
            </div>

            <div className="p-4 border-t border-border-secondary bg-bg-primary flex justify-end">
               <button
                  onClick={onClose}
                  className="px-4 py-2 bg-text-primary text-black font-bold text-sm rounded-lg hover:bg-white transition-colors"
               >
                  Fechar
               </button>
            </div>
         </div>
      </div>
   );
};
