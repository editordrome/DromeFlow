import React from 'react';
import { Icon } from '../../../ui/Icon';

interface AppointmentDetailsModalProps {
   isOpen: boolean;
   onClose: () => void;
   appointment: any | null;
}

export const AppointmentDetailsModal: React.FC<AppointmentDetailsModalProps> = ({
   isOpen,
   onClose,
   appointment
}) => {
   if (!isOpen || !appointment) return null;

   const formatLabelValue = (label: string, value: any, colSpan = false) => (
      <div className={`flex flex-col gap-1 ${colSpan ? 'col-span-1 md:col-span-2' : ''}`}>
         <span className="text-[10px] sm:text-xs font-bold text-text-tertiary uppercase tracking-wider">{label}</span>
         <span className="text-sm sm:text-base font-semibold text-text-primary capitalize truncate" title={String(value || '-')}>
            {value || '-'}
         </span>
      </div>
   );

   return (
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[80] flex justify-center items-center p-4 overflow-y-auto">
         <div className="bg-bg-primary rounded-2xl w-full max-w-lg border border-border-secondary shadow-2xl flex flex-col max-h-[90vh]">
            {/* Header com destaque */}
            <div className="relative p-6 pt-10 border-b border-border-secondary">
               <button
                  onClick={onClose}
                  className="absolute top-4 right-4 p-2 bg-text-primary/10 hover:bg-text-primary/20 text-white rounded-full transition-all"
               >
                  <Icon name="X" className="w-5 h-5" />
               </button>
               <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2 mb-2">
                     <div className="px-3 py-1 bg-accent-primary/20 text-accent-primary border border-accent-primary rounded-md text-xs font-black uppercase tracking-widest shrink-0">
                        {appointment.HORARIO}
                     </div>
                     <h3 className="text-xl sm:text-2xl font-black text-text-primary uppercase tracking-tight flex-1 line-clamp-2" title={appointment.CLIENTE_NOME}>
                        {appointment.CLIENTE_NOME}
                     </h3>
                  </div>
                  <div className="flex items-center gap-2 text-text-secondary text-sm md:text-base font-medium">
                     <Icon name="Calendar" className="w-4 h-4 shrink-0" />
                     {new Date(appointment.DATA).toLocaleDateString('pt-BR')} — <span className="font-bold">{appointment.PERIODO}h</span>
                  </div>
               </div>
            </div>

            {/* Conteúdo scrollable */}
            <div className="p-6 overflow-y-auto custom-scrollbar flex-1 bg-bg-secondary">
               <div className="flex flex-col gap-6">
                  {/* Bloco 1: Informações Principais */}
                  <div className="bg-bg-tertiary border border-border-secondary p-4 sm:p-5 rounded-2xl shadow-sm">
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-y-5 gap-x-6">
                        {formatLabelValue('Profissional Alocada', appointment.PROFISSIONAL || 'Não alocada')}
                        {formatLabelValue('Código ID', appointment['ID Atendimento'])}
                        {formatLabelValue('Serviço Contratado', appointment['SERVIÇO'], true)}
                     </div>
                  </div>

                  {/* Bloco 2: Endereço & Logística */}
                  <div className="border border-border-secondary p-4 sm:p-5 rounded-2xl flex flex-col gap-5">
                     <div className="flex items-center gap-2 mb-1">
                        <Icon name="MapPin" className="w-4 h-4 text-text-secondary" />
                        <h4 className="text-xs font-black text-text-secondary uppercase tracking-wider">Logística e Endereço</h4>
                     </div>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-y-4 gap-x-6">
                        {formatLabelValue('Bairro', appointment.BAIRRO)}
                        {formatLabelValue('Cep', appointment.CEP)}
                        {formatLabelValue('Valor Translado', `R$ ${appointment['VALOR TRANSLADO'] ?? '0,00'}`)}
                     </div>
                  </div>

                  {/* Bloco 3: Observações (se houver) */}
                  {appointment['OBSERVAÇÕES'] && (
                     <div className="border border-border-secondary p-4 sm:p-5 rounded-2xl flex flex-col gap-3 bg-blue-500/5">
                        <div className="flex items-center gap-2 mb-1">
                           <Icon name="FileText" className="w-4 h-4 text-blue-400" />
                           <h4 className="text-xs font-black text-blue-400 uppercase tracking-wider">Observações do Lead</h4>
                        </div>
                        <p className="text-sm font-medium text-text-primary leading-relaxed whitespace-pre-wrap italic opacity-90">
                           "{appointment['OBSERVAÇÕES']}"
                        </p>
                     </div>
                  )}
               </div>
            </div>

            <div className="p-4 sm:p-6 border-t border-border-secondary bg-bg-primary flex justify-end shrink-0">
               <button
                  onClick={onClose}
                  className="w-full sm:w-auto px-8 py-3 bg-text-primary text-black hover:bg-white font-black uppercase text-sm rounded-xl transition-all"
               >
                 Fechar Detalhes
               </button>
            </div>
         </div>
      </div>
   );
};
