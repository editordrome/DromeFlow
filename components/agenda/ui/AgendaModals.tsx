import React from 'react';
import { Icon } from '../../ui/Icon';
import { formatLocalISO } from '../helpers';

interface AgendaModalsProps {
   // Profissional Modal
   profModalData: any | null;
   setProfModalData: (data: any | null) => void;
   profMetricas: Record<string, any>;
   atendimentosDia: any[];
   selectedDate: Date;
   
   // Conflict Modal
   conflictModal: any | null;
   setConflictModal: (data: any | null) => void;

   // Sidebar / Atendimento Modal
   selectedSidebarAtendimento: any | null;
   setSelectedSidebarAtendimento: (data: any | null) => void;

   // State Control
   activeMetricPeriod: 'd7' | 'd30' | 'geral';
   setActiveMetricPeriod: (p: 'd7' | 'd30' | 'geral') => void;
}

export const AgendaModals: React.FC<AgendaModalsProps> = ({
   profModalData,
   setProfModalData,
   profMetricas,
   atendimentosDia,
   selectedDate,
   conflictModal,
   setConflictModal,
   selectedSidebarAtendimento,
   setSelectedSidebarAtendimento,
   activeMetricPeriod,
   setActiveMetricPeriod
}) => {
   return (
      <>
         {/* MODAL: INFORMATIVOS PROFISSIONAL */}
         {profModalData && (() => {
            const prof = profModalData;
            const metrics = profMetricas[prof.id];
            const atsHoje = atendimentosDia.filter(a =>
               !!a.PROFISSIONAL && !!prof.nome && a.PROFISSIONAL.trim().toLowerCase() === prof.nome.trim().toLowerCase()
            );

            return (
               <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setProfModalData(null)}>
                  <div className="bg-bg-secondary w-full max-w-md rounded-2xl border border-border-secondary shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200" onClick={e => e.stopPropagation()}>
                     <div className="p-4 bg-bg-tertiary border-b border-border-secondary flex items-center justify-between">
                        <div>
                           <h4 className="font-bold text-text-primary text-sm">{prof.nome}</h4>
                           <p className="text-[9px] text-text-tertiary uppercase tracking-tighter">{prof.habilidade}</p>
                        </div>
                        <button onClick={() => setProfModalData(null)} className="p-1 hover:bg-bg-secondary rounded-lg text-text-tertiary hover:text-text-primary transition-colors">
                           <Icon name="X" className="w-5 h-5" />
                        </button>
                     </div>
                     <div className="p-6 space-y-6 overflow-auto max-h-[80vh]">
                        {/* ABAS DE CONFIANÇA */}
                        <div className="space-y-4">
                           <h4 className="text-[10px] font-bold text-text-tertiary uppercase tracking-widest px-1">Confiabilidade</h4>
                           <div className="grid grid-cols-3 gap-2">
                              {(['d7', 'd30', 'geral'] as const).map(period => (
                                 <button
                                    key={period}
                                    onClick={() => setActiveMetricPeriod(period)}
                                    className={`p-2 rounded-xl border text-center transition-all ${activeMetricPeriod === period ? 'bg-accent-primary/10 border-accent-primary' : 'bg-bg-primary border-border-secondary hover:border-border-primary'}`}
                                 >
                                    <p className={`text-[9px] uppercase font-bold mb-1 ${activeMetricPeriod === period ? 'text-accent-primary' : 'text-text-tertiary'}`}>{period === 'd7' ? '7 Dias' : period === 'd30' ? '30 Dias' : 'Geral'}</p>
                                    <p className={`text-lg font-black ${activeMetricPeriod === period ? 'text-accent-primary' : 'text-text-primary'}`}>{metrics?.[period]?.conf?.tx || 0}%</p>
                                 </button>
                              ))}
                           </div>
                           {(() => {
                              const mPeriod = metrics?.[activeMetricPeriod];
                              if (!mPeriod) return null;
                              return (
                                 <div className="grid grid-cols-2 gap-2 animate-in fade-in zoom-in-95 duration-200">
                                    <div className="bg-bg-primary p-3 rounded-xl border border-border-secondary flex items-center justify-between">
                                       <span className="text-[10px] font-bold text-text-tertiary uppercase">Faltas</span>
                                       <span className="text-sm font-black text-rose-500">{mPeriod.falta?.qtd || 0}</span>
                                    </div>
                                    <div className="bg-bg-primary p-3 rounded-xl border border-border-secondary flex items-center justify-between">
                                       <span className="text-[10px] font-bold text-text-tertiary uppercase">Cancelou</span>
                                       <span className="text-sm font-black text-orange-500">{mPeriod.conf?.canc || 0}</span>
                                    </div>
                                    <div className="bg-bg-primary p-3 rounded-xl border border-border-secondary flex items-center justify-between">
                                       <span className="text-[10px] font-bold text-text-tertiary uppercase">Não</span>
                                       <span className="text-sm font-black text-text-secondary">{mPeriod.conf?.nao || 0}</span>
                                    </div>
                                    <div className="bg-bg-primary p-3 rounded-xl border border-border-secondary flex items-center justify-between">
                                       <span className="text-[10px] font-bold text-text-tertiary uppercase">Clie+Liv</span>
                                       <span className="text-sm font-black text-success">{(mPeriod.conf?.cli || 0) + (mPeriod.conf?.liv || 0)}</span>
                                    </div>
                                    <div className="col-span-2 bg-bg-primary p-3 rounded-xl border border-border-secondary flex items-center justify-between">
                                       <span className="text-[10px] font-bold text-text-tertiary uppercase">Perfil Predominante</span>
                                       <span className="text-xs font-black text-text-primary">{mPeriod.perf?.desc || '-'} <span className="text-text-tertiary font-bold ml-1 text-[9px]">({mPeriod.perf?.res}R / {mPeriod.perf?.com}C)</span></span>
                                    </div>
                                 </div>
                              );
                           })()}
                        </div>

                        <div className="border-t border-border-secondary" />

                        {/* ATENDIMENTOS HOJE */}
                        <div className="space-y-3">
                           <div className="flex items-center justify-between">
                              <h4 className="text-[10px] font-bold text-accent-primary uppercase tracking-widest flex items-center gap-2">
                                 <Icon name="CalendarClock" className="w-3.5 h-3.5" />
                                 Atendimentos Hoje
                              </h4>
                              <span className="text-[10px] font-bold text-text-tertiary">{formatLocalISO(selectedDate).split('-').reverse().join('/')}</span>
                           </div>
                           {atsHoje.length === 0 ? (
                              <div className="text-center py-6 bg-bg-primary border border-dashed border-border-secondary rounded-xl text-text-tertiary font-bold text-[10px] uppercase">
                                 Nenhum atendimento<br />para esta data
                              </div>
                           ) : (
                              <div className="space-y-3">
                                 {[...atsHoje].sort((a, b) => parseFloat(a.HORARIO?.replace(':', '.') || '0') - parseFloat(b.HORARIO?.replace(':', '.') || '0')).map((at, idx) => (
                                    <div key={idx} className="p-4 bg-bg-primary rounded-xl border border-border-primary shadow-sm relative overflow-hidden hover:border-accent-primary/50 transition-colors">
                                       <div className="absolute left-0 top-0 bottom-0 w-1 bg-accent-primary" />
                                       <div className="space-y-2">
                                          <div><p className="text-[7px] text-text-tertiary uppercase font-bold tracking-tighter">Cliente</p><p className="text-xs font-bold text-text-primary truncate">{at.CLIENTE}</p></div>
                                          <div className="grid grid-cols-2 gap-2">
                                             <div><p className="text-[7px] text-text-tertiary uppercase font-bold tracking-tighter">Horário</p><p className="text-[10px] font-bold text-text-primary">{at.HORARIO}</p></div>
                                             <div><p className="text-[7px] text-text-tertiary uppercase font-bold tracking-tighter">Duração</p><p className="text-[10px] font-bold text-text-primary">{at['PERÍODO']}h</p></div>
                                          </div>
                                          <div><p className="text-[7px] text-text-tertiary uppercase font-bold tracking-tighter">Serviço</p><p className="text-[10px] font-bold text-text-primary truncate">{at['SERVIÇO']}</p></div>
                                       </div>
                                    </div>
                                 ))}
                              </div>
                           )}
                        </div>
                     </div>
                  </div>
               </div>
            );
         })()}

         {/* MODAL DE CONFLITO DE DISPONIBILIDADE */}
         {conflictModal && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={() => setConflictModal(null)}>
               <div className="bg-bg-secondary w-full max-w-lg rounded-2xl border border-rose-500/40 shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200" onClick={e => e.stopPropagation()}>
                  <div className="p-4 bg-rose-500/10 border-b border-rose-500/30 flex items-center justify-between">
                     <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-rose-500/20 flex items-center justify-center">
                           <Icon name="AlertTriangle" className="w-4 h-4 text-rose-400" />
                        </div>
                        <div>
                           <h4 className="font-bold text-text-primary text-sm">Conflito de Disponibilidade</h4>
                           <p className="text-[10px] text-rose-400 font-bold uppercase tracking-wide">Marcou NÃO mas possui atendimento agendado</p>
                        </div>
                     </div>
                     <button onClick={() => setConflictModal(null)} className="p-1 hover:bg-bg-tertiary rounded-lg text-text-tertiary hover:text-text-primary transition-colors">
                        <Icon name="X" className="w-5 h-5" />
                     </button>
                  </div>

                  <div className="p-5 space-y-4">
                     <div className="flex items-center justify-between bg-bg-tertiary/60 rounded-xl p-3 border border-border-secondary">
                        <div>
                           <p className="text-[9px] text-text-tertiary uppercase font-bold tracking-wider mb-0.5">Profissional</p>
                           <p className="font-bold text-sm text-text-primary">{conflictModal.profNome}</p>
                        </div>
                        <div className="text-right">
                           <p className="text-[9px] text-text-tertiary uppercase font-bold tracking-wider mb-0.5">Data</p>
                           <p className="font-bold text-sm text-text-primary">{conflictModal.data.split('-').reverse().join('/')}</p>
                        </div>
                     </div>

                     <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-bold text-text-tertiary uppercase">Disponibilidade:</span>
                        {conflictModal.periodos.length > 0
                           ? conflictModal.periodos.map((p: string, i: number) => (
                              <span key={i} className="px-2 py-0.5 bg-[#1A1A1A] text-white text-[10px] font-bold rounded-full border border-white/10">{p}</span>
                           ))
                           : <span className="text-[10px] text-text-tertiary italic">Não informado</span>
                        }
                        <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full border ${conflictModal.statusManha === 'NÃO' ? 'bg-[#1A1A1A] text-white border-white/10' : conflictModal.statusManha === 'RESERVA' ? 'bg-[#FACC15] text-black border-[#FACC15]/30' : 'bg-green-500/20 text-green-400 border-green-500/30'
                           }`}>Manhã: {conflictModal.statusManha || '—'}</span>
                        <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full border ${conflictModal.statusTarde === 'NÃO' ? 'bg-[#1A1A1A] text-white border-white/10' : conflictModal.statusTarde === 'RESERVA' ? 'bg-[#FACC15] text-black border-[#FACC15]/30' : 'bg-green-500/20 text-green-400 border-green-500/30'
                           }`}>Tarde: {conflictModal.statusTarde || '—'}</span>
                     </div>

                     <div>
                        <h5 className="text-[10px] font-bold text-rose-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                           <Icon name="AlertCircle" className="w-3.5 h-3.5" />
                           Atendimento(s) Agendado(s) no dia
                        </h5>
                        <div className="space-y-2 max-h-[240px] overflow-y-auto">
                           {conflictModal.atendimentos.map((at: any, idx: number) => (
                              <div key={idx} className="p-3 bg-bg-primary rounded-xl border border-rose-500/20 relative overflow-hidden">
                                 <div className="absolute left-0 top-0 bottom-0 w-1 bg-rose-500" />
                                 <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                                    <div>
                                       <p className="text-[8px] text-text-tertiary uppercase font-bold tracking-tighter">Cliente</p>
                                       <p className="text-xs font-bold text-text-primary truncate">{at.CLIENTE || '—'}</p>
                                    </div>
                                    <div>
                                       <p className="text-[8px] text-text-tertiary uppercase font-bold tracking-tighter">Horário</p>
                                       <p className="text-xs font-bold text-rose-400">{at.HORARIO || '—'}</p>
                                    </div>
                                    <div>
                                       <p className="text-[8px] text-text-tertiary uppercase font-bold tracking-tighter">Período</p>
                                       <p className="text-xs font-bold text-text-primary">{at['PERÍODO'] ? `${at['PERÍODO']}h` : '—'}</p>
                                    </div>
                                    <div>
                                       <p className="text-[8px] text-text-tertiary uppercase font-bold tracking-tighter">Serviço</p>
                                       <p className="text-xs font-bold text-text-primary truncate">{at['SERVIÇO'] || at.TIPO || '—'}</p>
                                    </div>
                                 </div>
                              </div>
                           ))}
                        </div>
                     </div>
                  </div>

                  <div className="p-4 bg-bg-tertiary border-t border-border-secondary flex justify-end">
                     <button
                        onClick={() => setConflictModal(null)}
                        className="px-6 py-2 bg-rose-500 hover:bg-rose-600 text-white font-bold rounded-lg transition-colors shadow-md text-sm"
                     >
                        Fechar
                     </button>
                  </div>
               </div>
            </div>
         )}

         {/* MODAL DE DETALHES DO ATENDIMENTO (SIDEBAR EMULADO) */}
         {selectedSidebarAtendimento && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setSelectedSidebarAtendimento(null)}>
               <div className="bg-bg-secondary w-full max-w-md rounded-2xl border border-border-secondary shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200" onClick={e => e.stopPropagation()}>
                  <div className="p-4 bg-bg-tertiary border-b border-border-secondary flex items-center justify-between">
                     <h4 className="font-bold text-text-primary flex items-center gap-2">
                        <Icon name="CalendarCheck" className="w-5 h-5 text-success" />
                        Detalhes do Atendimento
                     </h4>
                     <button onClick={() => setSelectedSidebarAtendimento(null)} className="p-1 hover:bg-bg-secondary rounded-lg text-text-tertiary hover:text-text-primary transition-colors">
                        <Icon name="X" className="w-5 h-5" />
                     </button>
                  </div>
                  <div className="p-6 space-y-4">
                     <div className="grid grid-cols-2 gap-4">
                        <div className="p-3 bg-bg-primary rounded-lg border border-border-primary text-center">
                           <p className="text-[10px] uppercase text-text-tertiary font-bold mb-1 tracking-wider">Horário</p>
                           <p className="text-xl font-bold text-text-primary">{selectedSidebarAtendimento.HORARIO}</p>
                        </div>
                        <div className="p-3 bg-bg-primary rounded-lg border border-border-primary text-center">
                           <p className="text-[10px] uppercase text-text-tertiary font-bold mb-1 tracking-wider">Status</p>
                           <span className="px-2 py-0.5 bg-success/20 text-success text-[10px] font-bold rounded-full border border-success/30">
                              {selectedSidebarAtendimento.STATUS || 'Agendado'}
                           </span>
                        </div>
                     </div>

                     <div className="p-4 bg-bg-tertiary/50 border border-border-secondary rounded-xl">
                        <div className="mb-4">
                           <p className="text-[10px] uppercase text-text-tertiary font-bold mb-1">Cliente</p>
                           <p className="text-base font-bold text-text-primary">{selectedSidebarAtendimento.CLIENTE}</p>
                        </div>
                        <div className="mb-4">
                           <p className="text-[10px] uppercase text-text-tertiary font-bold mb-1">Profissional</p>
                           <p className="text-sm font-medium text-text-primary">{selectedSidebarAtendimento.PROFISSIONAL || 'Sem Profissional'}</p>
                        </div>
                        <div>
                           <p className="text-[10px] uppercase text-text-tertiary font-bold mb-1">Serviço / Tipo</p>
                           <p className="text-sm font-medium text-text-primary">{selectedSidebarAtendimento.TIPO || selectedSidebarAtendimento['SERVIÇO'] || 'Padrão'}</p>
                        </div>
                     </div>
                  </div>
                  <div className="p-4 bg-bg-tertiary border-t border-border-secondary flex justify-end">
                     <button
                        onClick={() => setSelectedSidebarAtendimento(null)}
                        className="px-6 py-2 bg-accent-primary text-text-on-accent font-bold rounded-lg hover:bg-accent-primary/90 transition-colors shadow-md"
                     >
                        Fechar
                     </button>
                  </div>
               </div>
            </div>
         )}
      </>
   );
};

export default AgendaModals;
