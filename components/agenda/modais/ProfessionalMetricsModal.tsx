import React from 'react';
import { Icon } from '../../../ui/Icon';

interface ProfessionalMetricsModalProps {
   isOpen: boolean;
   onClose: () => void;
   profModalData: any; // { id, nome }
   metricas: any; // profMetricas[profId]
}

export const ProfessionalMetricsModal: React.FC<ProfessionalMetricsModalProps> = ({
   isOpen,
   onClose,
   profModalData,
   metricas
}) => {
   if (!isOpen || !profModalData) return null;

   const renderMetricasCard = (titulo: string, dataCtx: any) => {
      if (!dataCtx) return null;
      return (
         <div className="bg-bg-tertiary rounded-xl p-4 border border-border-secondary">
            <h4 className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-4 border-b border-border-secondary pb-2">
               {titulo}
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
               <div>
                  <p className="text-[10px] text-text-tertiary uppercase font-bold mb-1">Índ. Confiança</p>
                  <p className="text-xl font-black text-white">{dataCtx.conf.tx}%</p>
               </div>
               <div>
                  <p className="text-[10px] text-text-tertiary uppercase font-bold mb-1">Taxa Faltas</p>
                  <p className="text-xl font-black text-red-400">{dataCtx.falta.tx}%</p>
               </div>
               <div>
                  <p className="text-[10px] text-text-tertiary uppercase font-bold mb-1">Atendimentos</p>
                  <p className="text-xl font-black text-text-primary">{dataCtx.conf.cli}</p>
               </div>
               <div>
                  <p className="text-[10px] text-text-tertiary uppercase font-bold mb-1">Perfil (R/C)</p>
                  <p className="text-xl font-black text-text-primary">
                     <span className="text-sm font-medium text-text-secondary">{dataCtx.perf.desc}</span>
                     <span className="text-xs text-text-tertiary block mt-0.5">({dataCtx.perf.res}/{dataCtx.perf.com})</span>
                  </p>
               </div>
            </div>
         </div>
      );
   };

   return (
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[70] flex justify-center items-center p-4 overflow-y-auto">
         <div className="bg-bg-primary rounded-2xl w-[95%] sm:w-full max-w-4xl border border-border-secondary shadow-2xl flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-border-secondary flex justify-between items-center bg-bg-secondary sticky top-0 z-10">
               <div>
                  <h3 className="text-lg font-black text-text-primary uppercase tracking-tight">
                     Métricas da Profissional
                  </h3>
                  <p className="text-sm text-text-secondary font-medium mt-0.5">
                     {profModalData.nome}
                  </p>
               </div>
               <button
                  onClick={onClose}
                  className="p-2 hover:bg-bg-tertiary rounded-xl text-text-secondary transition-colors"
               >
                  <Icon name="X" className="w-5 h-5" />
               </button>
            </div>

            <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
               {metricas ? (
                  <div className="space-y-6">
                     {renderMetricasCard("Últimos 7 Dias", metricas.d7)}
                     {renderMetricasCard("Últimos 30 Dias", metricas.d30)}
                     {renderMetricasCard("Histórico Completo", metricas.geral)}
                  </div>
               ) : (
                  <div className="flex flex-col items-center justify-center p-12 text-center">
                     <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent-primary mb-4" />
                     <p className="text-text-secondary font-medium">Carregando métricas...</p>
                  </div>
               )}
            </div>

            <div className="p-4 border-t border-border-secondary bg-bg-secondary flex justify-end">
               <button
                  onClick={onClose}
                  className="px-6 py-2.5 bg-bg-tertiary hover:bg-border-secondary text-text-primary font-bold rounded-xl transition-all"
               >
                  Fechar
               </button>
            </div>
         </div>
      </div>
   );
};
