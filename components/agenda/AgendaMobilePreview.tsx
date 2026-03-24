import React, { useState } from 'react';
import { Icon } from '../ui/Icon';

interface AgendaMobilePreviewProps {
  settings: {
    dias_liberados: string[];
    periodos_cadastrados: string[];
    is_link_active: boolean;
  };
  unitName?: string;
  professionalName?: string;
}

const AgendaMobilePreview: React.FC<AgendaMobilePreviewProps> = ({ 
  settings, 
  unitName,
  professionalName = 'Nome da Profissional'
}) => {
  const [currentDayIndex, setCurrentDayIndex] = useState(0);
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [isSubmitted, setIsSubmitted] = useState(false);
  
  // Reset preview when settings change (so it actually updates after admin saves)
  React.useEffect(() => {
    setCurrentDayIndex(0);
    setResponses({});
    setIsSubmitted(false);
  }, [settings.dias_liberados]);

  const diasOrdenados = [...(settings.dias_liberados || [])].sort();
  const currentIso = diasOrdenados[currentDayIndex];

  const formatPreviewDate = (isoStr: string) => {
    try {
      const [year, month, day] = isoStr.split('-').map(Number);
      const d = new Date(year, month - 1, day);
      const diaNome = new Intl.DateTimeFormat('pt-BR', { weekday: 'long' }).format(d);
      const diaData = `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`;
      return { diaNome, diaData };
    } catch {
      return { diaNome: '?', diaData: '?' };
    }
  };

  const [showModal, setShowModal] = useState(false);
  const [tempSelection, setTempSelection] = useState<string | null>(null);

  const handleSelect = (option: string) => {
    if (isSubmitted) return;
    setTempSelection(option);
    setShowModal(true);
  };

  const confirmSelection = () => {
    if (!tempSelection) return;
    setResponses(prev => ({ ...prev, [currentIso]: tempSelection }));
    setShowModal(false);
    setTempSelection(null);
    
    if (currentDayIndex < diasOrdenados.length - 1) {
      setCurrentDayIndex(prev => prev + 1);
    } else {
      setCurrentDayIndex(diasOrdenados.length);
    }
  };

  const cancelSelection = () => {
    setShowModal(false);
    setTempSelection(null);
  };

  // Opções fixas do app (padrão)
  const options = [
    { label: '8 horas',        value: '8h',  variant: '' },
    { label: '6 horas',        value: '6h',  variant: '' },
    { label: '4 horas manhã',  value: '4m',  variant: '' },
    { label: '4 horas tarde',  value: '4t',  variant: '' },
    { label: 'NÃO DISPONIVEL', value: 'NÃO', variant: 'danger' },
  ];

  const isFinalStep = currentDayIndex === diasOrdenados.length && diasOrdenados.length > 0;

  return (
    <div className="flex flex-col items-center py-4">
      {/* Moldura do Celular */}
      <div className="w-[320px] h-[580px] bg-bg-primary rounded-[40px] border-[8px] border-border-secondary shadow-2xl relative overflow-hidden flex flex-col">
        {/* Notch */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-border-secondary rounded-b-2xl z-20"></div>

        {/* Modal Interativo Profissional */}
        {showModal && (
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-6 animate-in fade-in duration-200">
             <div className="bg-bg-primary w-full rounded-3xl p-8 shadow-2xl border border-border-secondary space-y-8 animate-in zoom-in-95 duration-200">
                <div className="text-center space-y-4">
                   <div className="w-12 h-12 bg-accent-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-2 text-accent-primary">
                      <Icon name="CalendarCheck" className="w-6 h-6" />
                   </div>
                   <div className="space-y-1">
                      <p className="text-[10px] uppercase tracking-widest font-black text-brand-cyan">Confirmação de Agenda</p>
                      <h3 className="text-lg font-bold text-text-primary leading-tight italic capitalize">
                         {formatPreviewDate(currentIso).diaNome}
                      </h3>
                      <p className="text-xs font-bold text-text-tertiary">{formatPreviewDate(currentIso).diaData}</p>
                   </div>
                </div>

                <div className="bg-bg-secondary rounded-2xl p-4 border border-border-secondary text-center">
                   <p className="text-[10px] uppercase tracking-widest font-bold text-text-tertiary mb-1">Disponibilidade Selecionada</p>
                   <p className="text-xl font-black text-accent-primary uppercase">{tempSelection}</p>
                </div>

                <div className="space-y-3">
                   <button
                     onClick={confirmSelection}
                     className="w-full py-4 bg-accent-primary text-text-on-accent font-black rounded-2xl shadow-lg shadow-accent-primary/20 active:scale-95 transition-all text-sm tracking-widest"
                   >
                     CONFIRMAR
                   </button>
                   <button
                     onClick={cancelSelection}
                     className="w-full py-2 text-xs font-bold text-text-tertiary hover:text-text-primary transition-colors uppercase tracking-widest"
                   >
                     Corrigir
                   </button>
                </div>
             </div>
          </div>
        )}

        {/* Status Bar */}
        <div className="h-10 flex items-center justify-between px-6 pt-4 shrink-0 z-10">
          <span className="text-[10px] font-bold text-text-primary">15:54</span>
          <div className="flex items-center gap-1.5">
            <Icon name="Wifi" className="w-2.5 h-2.5 text-text-primary" />
            <div className="w-4 h-2 border border-text-primary rounded-[2px] relative">
              <div className="absolute left-0.5 top-0.5 bottom-0.5 right-1 bg-text-primary rounded-[1px]"></div>
            </div>
          </div>
        </div>

        {/* App Header */}
        <div className="px-6 py-4 bg-bg-secondary border-b border-border-secondary text-center">
          <p className="text-[10px] uppercase tracking-widest font-black text-brand-cyan mb-0.5">
            Agenda {unitName || 'Unidade'}
          </p>
          <h1 className="text-sm font-bold text-text-primary truncate">
             {professionalName}
          </h1>
        </div>

        {/* Conteúdo Principal */}
        <div className="flex-1 flex flex-col p-6 overflow-y-auto">
          {diasOrdenados.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center space-y-4 opacity-60">
              <Icon name="Calendar" className="w-12 h-12 text-text-tertiary" />
              <p className="text-xs font-bold text-text-secondary">Nenhuma data configurada pelo administrador.</p>
            </div>
          ) : isSubmitted ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center space-y-6">
              <div className="w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center">
                <Icon name="Check" className="w-10 h-10 text-green-500" />
              </div>
              <div className="space-y-2">
                <h2 className="text-lg font-bold text-text-primary">Agenda Enviada!</h2>
                <p className="text-[11px] text-text-tertiary leading-relaxed px-4">
                  Sua disponibilidade foi registrada com sucesso. Para alterações, entre em contato com a administração.
                </p>
              </div>
            </div>
          ) : isFinalStep ? (
            <div className="flex-1 flex flex-col justify-center space-y-8">
              <div className="text-center space-y-2">
                <Icon name="Send" className="w-12 h-12 text-accent-primary mx-auto opacity-20" />
                <h2 className="text-lg font-bold text-text-primary">Quase pronto!</h2>
                <p className="text-[11px] text-text-tertiary">Confirme sua disponibilidade para finalizar o processo.</p>
              </div>
              
              <div className="bg-bg-secondary rounded-2xl p-4 border border-border-secondary space-y-3 max-h-48 overflow-y-auto">
                {diasOrdenados.map(iso => (
                   <div key={iso} className="flex justify-between items-center text-[10px]">
                      <span className="font-bold text-text-secondary">{iso.split('-').reverse().slice(0,2).join('/')}</span>
                      <span className={`font-black ${responses[iso] === 'NÃO' ? 'text-red-500' : 'text-brand-cyan'}`}>
                         {responses[iso] || '-'}
                      </span>
                   </div>
                ))}
              </div>

              <button
                onClick={() => setIsSubmitted(true)}
                className="w-full py-4 bg-accent-primary text-text-on-accent font-black rounded-2xl shadow-xl shadow-accent-primary/20 active:scale-95 transition-transform"
              >
                ENVIAR AGENDA
              </button>
              
              <button 
                onClick={() => {
                  setCurrentDayIndex(0);
                  setIsSubmitted(false);
                }}
                className="text-[10px] font-bold text-text-tertiary uppercase hover:text-text-primary transition-colors"
              >
                Revisar datas
              </button>
            </div>
          ) : (
            <div className="flex-1 flex flex-col">
              {/* Info do Dia */}
              <div className="text-center mb-5 relative">
                {currentDayIndex > 0 && (
                  <button 
                    onClick={() => setCurrentDayIndex(prev => prev - 1)}
                    className="absolute left-0 top-1/2 -translate-y-1/2 p-2 hover:bg-bg-tertiary rounded-full text-text-secondary transition-colors"
                    title="Voltar"
                  >
                    <Icon name="ArrowLeft" className="w-5 h-5" />
                  </button>
                )}
                <div className="space-y-0.5">
                   <h2 className="text-xl font-black text-text-primary capitalize leading-tight">
                     {formatPreviewDate(currentIso).diaNome}
                   </h2>
                   <p className="text-[11px] font-bold text-accent-primary uppercase tracking-widest">
                     {formatPreviewDate(currentIso).diaData}
                   </p>
                </div>
              </div>

              {/* Botões de Opção */}
              <div className="space-y-2">
                {options.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => handleSelect(opt.label)}
                    className={`w-full py-4 px-6 rounded-2xl text-sm font-bold border-2 transition-all active:scale-95 text-center
                      ${opt.variant === 'danger' 
                        ? 'border-red-500/20 bg-red-500/5 text-red-500 hover:bg-red-500 hover:text-white hover:border-red-500' 
                        : 'border-border-secondary bg-bg-secondary text-text-primary hover:border-accent-primary hover:bg-accent-primary/5'
                      }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {/* Barra de Progresso */}
              <div className="mt-12 w-full h-1 bg-bg-tertiary rounded-full overflow-hidden">
                <div 
                  className="h-full bg-accent-primary transition-all duration-500"
                  style={{ width: `${((currentDayIndex + 1) / diasOrdenados.length) * 100}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Home Indicator */}
        <div className="h-6 flex items-center justify-center shrink-0 bg-bg-secondary/50">
          <div className="w-24 h-1 bg-border-secondary rounded-full opacity-40"></div>
        </div>
      </div>
      <p className="text-[10px] text-text-tertiary mt-4 uppercase tracking-widest font-bold">Preview Profissional</p>
    </div>
  );
};

export default AgendaMobilePreview;
