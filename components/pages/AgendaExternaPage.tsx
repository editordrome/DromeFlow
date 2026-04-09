import React, { useState, useEffect } from 'react';
import { authenticateProfissional, saveDisponibilidades } from '../../services/agenda/agenda.service';

const AgendaExternaPage: React.FC = () => {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Auth State
  const [telefone, setTelefone] = useState('');
  const [unitSlug, setUnitSlug] = useState('');
  const [profissional, setProfissional] = useState<any>(null);
  const [configuracao, setConfiguracao] = useState<any>(null);
  const [unidade, setUnidade] = useState<any>(null);

  // Estado "já enviou"
  const [jaEnviou, setJaEnviou] = useState(false);
  const [disponibilidadeEnviada, setDisponibilidadeEnviada] = useState<
    { data: string; periodos: string[]; status_manha: string | null; status_tarde: string | null }[]
  >([]);
  const [diasPendentes, setDiasPendentes] = useState<string[]>([]);

  // Form State (Fase 2)
  const [currentDayIndex, setCurrentDayIndex] = useState(0);
  const [selecoes, setSelecoes] = useState<Record<string, string[]>>({});
  const [showModal, setShowModal] = useState(false);
  const [tempSelection, setTempSelection] = useState<string | null>(null);

  useEffect(() => {
    // Força checagem de nova versão do cache (Service Worker) imediatamente
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(registrations => {
        registrations.forEach(r => r.update());
      });
    }

    // Captura o slug estritamente pelo path, garantindo que o formato agenda.dromeflow.com/unit_code funcione sem ambiguidades
    const pathparts = window.location.pathname.split('/').filter(Boolean);

    // O último parâmetro da URL será SEMPRE o slug da unidade (ex: mb-londrina em agenda.dromeflow.com/mb-londrina)
    const extractedSlug = pathparts.length > 0 ? pathparts[pathparts.length - 1] : '';

    setUnitSlug(extractedSlug);
  }, []);

  const handleNextDay = () => {
    const datasOrdenadas = [...diasPendentes].sort();
    if (currentDayIndex < datasOrdenadas.length - 1) {
      setCurrentDayIndex(prev => prev + 1);
      window.scrollTo(0, 0);
    } else {
      // Se era o último dia, vai para a tela de Resumo
      setStep(3);
      window.scrollTo(0, 0);
    }
  };

  const confirmSelection = () => {
    if (!tempSelection) return;
    const datasOrdenadas = [...diasPendentes].sort();
    setSelecoes(prev => ({ ...prev, [datasOrdenadas[currentDayIndex]]: [tempSelection] }));
    setShowModal(false);
    setTempSelection(null);
    handleNextDay();
  };

  const cancelSelection = () => {
    setShowModal(false);
    setTempSelection(null);
  };

  const handleSelect = (option: string) => {
    setTempSelection(option);
    setShowModal(true);
  };

  const handlePrevDay = () => {
    if (currentDayIndex > 0) {
      setCurrentDayIndex(prev => prev - 1);
    }
  };


  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!unitSlug || !telefone) return;
    setLoading(true);
    setError(null);

    try {
      const response = await authenticateProfissional(telefone, unitSlug);
      if (response) {
        setProfissional(response.profissional);
        setConfiguracao(response.configuracoes);
        setUnidade(response.unidade);

        if (response.jaEnviou) {
          setJaEnviou(true);
        }

        setDiasPendentes(response.diasPendentes || []);
        setDisponibilidadeEnviada(response.disponibilidadeEnviada);

        setStep(2);
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao autenticar. Verifique o número e tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const formatTelefoneInput = (value: string) => {
    return value.replace(/\D/g, '').substring(0, 13);
  };

  const handleSubmitDisponibilidade = async () => {
    if (!profissional || !configuracao) return;

    const params = Object.entries(selecoes).map(([data, periodos]) => ({
      data,
      periodos
    })).filter(item => (item.periodos as string[]).length > 0);

    if (params.length === 0) {
      setError('Selecione pelo menos um período.');
      return;
    }

    setLoading(true);
    setError(null);

    console.log('Iniciando envio. Configuracao Atual:', configuracao);

    try {
      await saveDisponibilidades(
        configuracao.unit_id,
        profissional.id,
        profissional.nome,
        configuracao.id,
        params as { data: string, periodos: string[] }[]
      );

      // Limpa estritamente os caches locais e unregister os Service Workers para não segurar versão velha
      if ('caches' in window) {
        const names = await caches.keys();
        await Promise.all(names.map(name => caches.delete(name)));
      }
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const registration of registrations) {
          await registration.unregister();
        }
      }

      // Limpa dados de sessão local para forçar novo fetch de configurações no próximo acesso
      localStorage.clear();

      setSuccess(true);

      // Recarrega silenciosamente a página no fundo após 3 segundos 
      // para garantir que a próxima visita da pessoa use a versão mais atual
      setTimeout(() => {
        window.location.reload();
      }, 3500);

    } catch (err: any) {
      setError(err.message || 'Erro ao salvar. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  // Helper para formatar data ISO em pt-BR
  const formatData = (iso: string) => {
    const [year, month, day] = iso.split('-').map(Number);
    const d = new Date(year, month - 1, day);
    return {
      diaNome: new Intl.DateTimeFormat('pt-BR', { weekday: 'long' }).format(d),
      diaMes: new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'long' }).format(d)
    };
  };

  // Helper para label amigável do período
  const labelPeriodo = (periodos: string[]) => {
    if (!periodos || periodos.length === 0) return '—';
    const p = periodos[0];
    if (p === 'NÃO DISPONIVEL') return 'Não Disponível';
    return p;
  };

  // ─── UI: Sucesso de envio ─────────────────────────────────────────────────
  if (success) {
    return (
      <div className="min-h-screen bg-bg-primary text-text-primary flex flex-col items-center justify-center p-6 font-sans">
        <div className="w-full max-w-md bg-bg-secondary rounded-[40px] p-12 border border-border-primary text-center shadow-2xl animate-in zoom-in-95 duration-500">
          <div className="w-24 h-24 bg-success/15 text-success rounded-full flex items-center justify-center mx-auto mb-8 shadow-inner">
            <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-4xl font-[900] text-text-primary mb-4 tracking-tight">Tudo Certo!</h2>
          <p className="text-lg text-text-secondary leading-relaxed font-semibold">Sua agenda foi enviada com sucesso para a unidade.</p>

          <div className="mt-12 p-6 bg-bg-tertiary rounded-2xl border border-border-primary">
            <p className="text-xs font-black text-text-secondary uppercase tracking-widest">Você já pode fechar esta página.</p>
          </div>
        </div>
      </div>
    );
  }

  // ─── UI: Etapa 1 — Login ──────────────────────────────────────────────────
  if (step === 1) {
    return (
      <div className="min-h-screen bg-bg-primary text-text-primary flex flex-col items-center justify-center p-6 font-sans">
        <div className="w-full max-w-md bg-bg-secondary rounded-[32px] p-10 shadow-2xl border border-border-primary">
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-accent-primary/10 text-accent-primary text-[11px] font-extrabold uppercase tracking-widest rounded-full mb-6">
              <span className="w-1.5 h-1.5 bg-accent-primary rounded-full animate-pulse" />
              Acesso Profissional
            </div>
            <h1 className="text-4xl font-[900] text-text-primary tracking-tight leading-none">
              DromeFlow
            </h1>
            <p className="text-text-secondary mt-4 text-sm font-medium leading-relaxed">
              Olá! Informe seu <span className="text-text-primary font-bold">WhatsApp</span> para acessar sua agenda.
            </p>
          </div>

          <form onSubmit={handleAuth} className="space-y-8">
            <div className="space-y-3">
              <label className="block text-[11px] font-[800] text-text-secondary uppercase tracking-[0.1em] ml-1">
                Número do WhatsApp
              </label>
              <input
                type="tel"
                value={telefone}
                onChange={(e) => setTelefone(formatTelefoneInput(e.target.value))}
                placeholder="(00) 0 0000-0000"
                className="w-full bg-bg-tertiary border-2 border-transparent focus:border-accent-primary rounded-2xl px-6 py-5 text-xl font-bold text-text-primary placeholder:text-text-secondary/30 transition-all shadow-inner outline-none"
              />
            </div>

            {error && (
              <div className="p-4 bg-danger/10 border border-danger/20 rounded-2xl text-danger text-sm font-bold flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
                <div className="w-6 h-6 bg-danger/20 rounded-full flex items-center justify-center shrink-0">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" /></svg>
                </div>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !telefone}
              className="w-full bg-accent-primary hover:bg-black text-text-on-accent font-[900] text-xl py-6 rounded-2xl transition-all disabled:opacity-30 disabled:grayscale flex items-center justify-center shadow-xl shadow-accent-primary/20 active:scale-[0.98]"
            >
              {loading ? (
                <div className="flex items-center gap-3">
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  VALIDANDO...
                </div>
              ) : 'ENTRAR AGORA'}
            </button>
          </form>

          <p className="mt-8 text-center text-[10px] text-text-secondary font-bold uppercase tracking-widest opacity-40">
            Powered by DromeFlow
          </p>
        </div>
      </div>
    );
  }

  // ─── UI: Etapa 2a — Já enviou (Tela de Histórico) ───────────────────────────
  if (jaEnviou) {
    return (
      <div className="min-h-screen bg-bg-primary text-text-primary flex flex-col font-sans">
        {/* Header Fixo */}
        <div className="sticky top-0 z-30 px-6 py-6 bg-bg-secondary border-b border-border-secondary text-center shadow-sm">
          <p className="text-[10px] uppercase tracking-widest font-black text-brand-cyan mb-0.5">Minha Agenda</p>
          <h1 className="text-sm font-bold text-text-primary truncate">{profissional?.nome}</h1>
        </div>

        <div className="flex-1 w-full max-w-md mx-auto px-6 py-8 flex flex-col gap-8">
          <div className="flex flex-col items-center text-center pt-6">
            <div className="w-20 h-20 bg-success/10 rounded-[24px] flex items-center justify-center mb-6 border-2 border-success/20">
              <svg className="w-10 h-10 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-3xl font-[900] text-text-primary tracking-tight">Agenda Enviada</h2>
            <p className="text-sm font-medium text-text-secondary mt-3 leading-relaxed">
              Você já informou sua disponibilidade para este período. Confira abaixo:
            </p>
          </div>

          {/* Lista de dias enviados */}
          <div className="space-y-4">
            {disponibilidadeEnviada.map(d => {
              const { diaNome, diaMes } = formatData(d.data);
              const periodo = labelPeriodo(d.periodos);
              const isNao = periodo === 'Não Disponível';
              return (
                <div
                  key={d.data}
                  className="bg-bg-secondary rounded-2xl border border-border-primary px-6 py-5 flex items-center justify-between shadow-md"
                >
                  <div className="space-y-0.5">
                    <p className="text-base font-[900] text-text-primary capitalize">{diaMes}</p>
                    <p className="text-xs font-bold text-text-secondary capitalize">{diaNome}</p>
                  </div>
                  <span className={`text-[11px] font-[900] px-4 py-2 rounded-full uppercase tracking-widest ${isNao
                    ? 'bg-bg-tertiary text-text-secondary'
                    : 'bg-accent-primary/10 text-accent-primary border border-accent-primary/20'
                    }`}>
                    {periodo}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="bg-bg-secondary border-2 border-border-primary rounded-[24px] p-6 flex items-start gap-4 shadow-lg">
            <div className="w-10 h-10 bg-accent-primary/10 rounded-xl flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-accent-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-sm font-medium text-text-secondary leading-relaxed">
              Para alterar qualquer data, por favor entre em contato com a <span className="font-bold text-text-primary uppercase">Administração da Unidade</span>.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ─── UI: Etapa 3 — Resumo ("Quase pronto!") ──────────────────────────────
  if (step === 3) {
    const datasOrdenadas = [...diasPendentes].sort();

    return (
      <div className="min-h-screen bg-bg-primary text-text-primary flex flex-col font-sans">
        {/* Header Fixo */}
        <div className="sticky top-0 z-30 px-6 py-4 bg-bg-secondary border-b border-border-secondary text-center">
          <p className="text-[10px] uppercase tracking-widest font-black text-brand-cyan mb-0.5">Confirmação Final</p>
          <h1 className="text-sm font-bold text-text-primary truncate">{profissional?.nome}</h1>
        </div>

        <div className="flex-1 w-full max-w-md mx-auto px-6 flex flex-col justify-center space-y-8 py-8">
          <div className="text-center space-y-2">
            <svg className="w-12 h-12 text-accent-primary mx-auto opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
            <h2 className="text-lg font-bold text-text-primary">Quase pronto!</h2>
            <p className="text-[11px] text-text-tertiary">Confirme sua disponibilidade para finalizar o processo.</p>
          </div>

          {/* Lista de Resumo com UX do Preview */}
          <div className="bg-bg-secondary rounded-2xl p-4 border border-border-secondary space-y-3 max-h-[40vh] overflow-y-auto">
            {datasOrdenadas.map(iso => {
              const selecao = selecoes[iso]?.[0] || '—';
              const isNao = selecao === 'NÃO DISPONÍVEL' || selecao === 'NAO' || selecao === 'NÃO';
              const displaySel = selecao === 'NÃO' || selecao === 'NAO' ? 'NÃO DISPONÍVEL' : selecao;

              return (
                <div key={iso} className="flex justify-between items-center text-[10px]">
                  <span className="font-bold text-text-secondary">{iso.split('-').reverse().slice(0, 2).join('/')}</span>
                  <span className={`font-black uppercase ${isNao ? 'text-red-500' : 'text-brand-cyan'}`}>
                    {displaySel}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="space-y-4">
            <button
              onClick={handleSubmitDisponibilidade}
              disabled={loading}
              className="w-full py-4 bg-accent-primary text-text-on-accent font-black rounded-2xl shadow-xl shadow-accent-primary/20 active:scale-95 transition-transform"
            >
              {loading ? 'ENVIANDO...' : 'ENVIAR AGENDA'}
            </button>

            <button
              onClick={() => {
                setCurrentDayIndex(0);
                setStep(2);
              }}
              disabled={loading}
              className="w-full text-[10px] font-bold text-text-tertiary uppercase hover:text-text-primary transition-colors text-center block"
            >
              Revisar datas
            </button>
          </div>

          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-xs font-bold text-center">
              {error}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─── UI: Etapa 2b — Formulário de Seleção ────────────────────────────────
  const datasOrdenadas = [...diasPendentes].sort();
  const currentIso = datasOrdenadas[currentDayIndex];

  // Opções fixas do app
  const options = [
    { label: '8 horas', value: '8h', variant: '' },
    { label: '6 horas', value: '6h', variant: '' },
    { label: '4 horas manhã', value: '4m', variant: '' },
    { label: '4 horas tarde', value: '4t', variant: '' },
    { label: 'NÃO DISPONÍVEL', value: 'NÃO', variant: 'danger' },
  ];

  const formatPreviewDate = (isoStr: string) => {
    try {
      if (!isoStr) return { diaNome: '', diaData: '' };
      const [year, month, day] = isoStr.split('-').map(Number);
      const d = new Date(year, month - 1, day);
      const diaNome = new Intl.DateTimeFormat('pt-BR', { weekday: 'long' }).format(d);
      const diaData = `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`;
      return { diaNome, diaData };
    } catch {
      return { diaNome: '?', diaData: '?' };
    }
  };

  return (
    <div className="h-[100dvh] overflow-hidden bg-bg-primary text-text-primary flex flex-col font-sans relative">
      {/* Modal Interativo Profissional */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-6 animate-in fade-in duration-200">
          <div className="bg-bg-primary w-full max-w-sm rounded-3xl p-8 shadow-2xl border border-border-secondary space-y-8 animate-in zoom-in-95 duration-200">
            <div className="text-center space-y-4">
              <div className="w-12 h-12 bg-accent-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-2 text-accent-primary">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
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
              <p className={`text-xl font-black uppercase ${tempSelection === 'NÃO DISPONÍVEL' || tempSelection === 'NAO' ? 'text-red-500' : 'text-accent-primary'}`}>{tempSelection}</p>
            </div>

            <div className="space-y-3">
              <button
                onClick={confirmSelection}
                className={`w-full py-4 text-white font-black rounded-2xl shadow-lg active:scale-95 transition-all text-sm tracking-widest ${tempSelection === 'NÃO DISPONÍVEL' || tempSelection === 'NAO' ? 'bg-red-500 shadow-red-500/20' : 'bg-accent-primary shadow-accent-primary/20'}`}
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

      {/* Header Fixo e Elegante */}
      <div className="shrink-0 z-30 px-6 py-4 bg-bg-secondary border-b border-border-secondary text-center">
        <p className="text-[10px] uppercase tracking-widest font-black text-brand-cyan mb-0.5">
          Agenda {unidade?.unit_name || 'Unidade'}
        </p>
        <h1 className="text-sm font-bold text-text-primary truncate">
          {profissional?.nome}
        </h1>
      </div>

      <div className="flex-1 w-full max-w-md mx-auto px-6 py-6 flex flex-col min-h-0">

        {/* Info do Dia */}
        <div className="text-center mb-6 relative shrink-0">
          {currentDayIndex > 0 && (
            <button
              onClick={handlePrevDay}
              className="absolute left-0 top-1/2 -translate-y-1/2 p-2 hover:bg-bg-tertiary rounded-full text-text-secondary transition-colors"
              title="Voltar"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" /></svg>
            </button>
          )}
          <div className="space-y-0.5">
            <h2 className="text-2xl font-black text-text-primary capitalize leading-tight">
              {formatPreviewDate(currentIso).diaNome}
            </h2>
            <p className="text-xs font-bold text-accent-primary uppercase tracking-widest">
              {formatPreviewDate(currentIso).diaData}
            </p>
          </div>
        </div>

        {/* Botões de Opção */}
        <div className="flex-1 flex flex-col gap-3 min-h-0">
          {options.map(opt => (
            <button
              key={opt.value}
              onClick={() => handleSelect(opt.label)}
              className={`w-full flex-1 rounded-2xl text-[19px] sm:text-[20px] font-black border-2 transition-all active:scale-95 flex items-center justify-center outline-none focus:outline-none select-none
                ${opt.variant === 'danger'
                  ? 'border-red-500/20 bg-red-500/5 text-red-500 active:bg-red-500 active:text-white active:border-red-500'
                  : 'border-border-secondary bg-bg-secondary text-text-primary active:border-accent-primary active:bg-accent-primary/10'
                }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Barra de Progresso no Rodapé */}
        <div className="shrink-0 mt-6 w-full">
          <div className="h-1 bg-bg-tertiary rounded-full overflow-hidden w-full">
            <div
              className="h-full bg-accent-primary transition-all duration-500"
              style={{ width: `${((currentDayIndex + 1) / datasOrdenadas.length) * 100}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default AgendaExternaPage;
