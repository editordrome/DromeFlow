import React, { useEffect, useMemo, useState, useRef } from 'react';
import { Icon } from './Icon';
import type { Profissional } from '../../services/profissionais/profissionais.service';
import { useAppContext } from '../../contexts/AppContext';
import { fetchProfessionalHistory, fetchProfessionalPosVendaMetrics, updateProfissional, createProfissional } from '../../services/profissionais/profissionais.service';
import DataDetailModal from './DataDetailModal';
import { fetchDataRecordById } from '../../services/data/dataTable.service';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { generateAditamentoHTML } from '../documents/utils/generateAditamentoHTML';
import { generateContratoHTML } from '../documents/utils/generateContratoHTML';
import { generateDistratoHTML } from '../documents/utils/generateDistratoHTML';
import { generateTermoHTML } from '../documents/utils/generateTermoHTML';
import { generateNotificacaoHTML } from '../documents/utils/generateNotificacaoHTML';
import type { Unit } from '../../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  profissional: Profissional | null;
  onEdit?: (updated: Profissional) => void;
  onCreate?: (created: Profissional) => void;
}

const ProfissionalDetailModal: React.FC<Props> = ({ isOpen, onClose, profissional, onEdit, onCreate }) => {
  const { selectedUnit } = useAppContext();
  const unitCode = (selectedUnit as any)?.unit_code || null;
  const unitName = (selectedUnit as any)?.unit_name || null;
  const isCreating = !profissional; // Modo criação quando profissional é null

  const [activeTab, setActiveTab] = useState<'inicio' | 'dados' | 'historico' | 'documentos'>('inicio');
  const [selectedPeriod, setSelectedPeriod] = useState<string>(() => {
    const now = new Date();
    const y = now.getUTCFullYear();
    const m = String(now.getUTCMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  });
  const [loadingHist, setLoadingHist] = useState(false);
  const [history, setHistory] = useState<Array<{ id?: number; DATA: string | null; DIA: string; CLIENTE: string; 'pos vendas': string | null }>>([]);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailRecord, setDetailRecord] = useState<any | null>(null);
  const [metrics, setMetrics] = useState<{ geral: number | null; comercial: number | null; residencial: number | null }>({ geral: null, comercial: null, residencial: null });
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Estados para campos editáveis
  const [editNome, setEditNome] = useState<string>('');
  const [editWhatsapp, setEditWhatsapp] = useState<string>('');
  const [editRg, setEditRg] = useState<string>('');
  const [editCpf, setEditCpf] = useState<string>('');
  const [editDataNasc, setEditDataNasc] = useState<string>('');
  const [editTipo, setEditTipo] = useState<string>('');
  const [editPreferencia, setEditPreferencia] = useState<string>('');
  const [editHabilidade, setEditHabilidade] = useState<string>('');
  const [editEstadoCivil, setEditEstadoCivil] = useState<string>('');
  const [editFumante, setEditFumante] = useState<string>('');
  const [editFilhos, setEditFilhos] = useState<string>('');
  const [editQtoFilhos, setEditQtoFilhos] = useState<string>('');
  const [editEndereco, setEditEndereco] = useState<string>('');
  const [editNomeRecado, setEditNomeRecado] = useState<string>('');
  const [editTelRecado, setEditTelRecado] = useState<string>('');
  const [editObservacao, setEditObservacao] = useState<string>('');
  const [editAssinatura, setEditAssinatura] = useState<string>('');
  const [editStatus, setEditStatus] = useState<string>('');
  const [autoSavingObs, setAutoSavingObs] = useState(false);
  const [autoSaveObsMsg, setAutoSaveObsMsg] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [documentName, setDocumentName] = useState('Documento');
  const previewRef = useRef<HTMLDivElement>(null);

  // Detecta mudanças
  const hasChanges = useMemo(() => {
    // Modo criação: verifica se tem nome preenchido
    if (isCreating) {
      return editNome.trim().length > 0;
    }
    // Modo edição: verifica se houve alteração
    if (!profissional) return false;
    return (
      editNome !== (profissional.nome || '') ||
      editWhatsapp !== (profissional.whatsapp || '') ||
      editRg !== (profissional.rg || '') ||
      editCpf !== (profissional.cpf || '') ||
      editDataNasc !== (profissional.data_nasc || '') ||
      editTipo !== (profissional.tipo || '') ||
      editPreferencia !== (profissional.preferencia || '') ||
      editHabilidade !== (profissional.habilidade || '') ||
      editEstadoCivil !== (profissional.estado_civil || '') ||
      editFumante !== (profissional.fumante || '') ||
      editFilhos !== (profissional.filhos || '') ||
      editQtoFilhos !== (profissional.qto_filhos || '') ||
      editEndereco !== (profissional.endereco || '') ||
      editNomeRecado !== (profissional.nome_recado || '') ||
      editTelRecado !== (profissional.tel_recado || '') ||
      editObservacao !== (profissional.observacao || '') ||
      editAssinatura !== (profissional.assinatura || '')
    );
  }, [isCreating, profissional, editNome, editWhatsapp, editRg, editCpf, editDataNasc, editTipo, editPreferencia, editHabilidade, editEstadoCivil, editFumante, editFilhos, editQtoFilhos, editEndereco, editNomeRecado, editTelRecado, editObservacao, editAssinatura]);

  // Usar useRef para rastrear se já inicializamos os campos (não causa re-render)
  const initializedRef = useRef(false);
  const lastProfissionalIdRef = useRef<string | null>(null);

  useEffect(() => {
    // Detecta se é uma nova abertura do modal ou mudança de profissional
    const profissionalId = profissional?.id || null;
    const isNewModal = isOpen && (!initializedRef.current || lastProfissionalIdRef.current !== profissionalId);

    if (isNewModal) {
      if (profissional) {
        // Modo edição - carrega dados existentes
        setEditNome(profissional.nome || '');
        setEditWhatsapp(profissional.whatsapp || '');
        setEditRg(profissional.rg || '');
        setEditCpf(profissional.cpf || '');
        setEditDataNasc(profissional.data_nasc || '');
        setEditTipo(profissional.tipo || '');
        setEditPreferencia(profissional.preferencia || '');
        setEditHabilidade(profissional.habilidade || '');
        setEditEstadoCivil(profissional.estado_civil || '');
        setEditFumante(profissional.fumante || '');
        setEditFilhos(profissional.filhos || '');
        setEditQtoFilhos(profissional.qto_filhos || '');
        setEditEndereco(profissional.endereco || '');
        setEditNomeRecado(profissional.nome_recado || '');
        setEditTelRecado(profissional.tel_recado || '');
        setEditObservacao(profissional.observacao || '');
        setEditAssinatura(profissional.assinatura || '');
        setEditStatus(profissional.status || '');
        setIsEditing(false);
      } else {
        // Modo criação - limpa campos
        setEditNome('');
        setEditWhatsapp('');
        setEditRg('');
        setEditCpf('');
        setEditDataNasc('');
        setEditTipo('');
        setEditPreferencia('');
        setEditHabilidade('');
        setEditEstadoCivil('');
        setEditFumante('');
        setEditFilhos('');
        setEditQtoFilhos('');
        setEditEndereco('');
        setEditNomeRecado('');
        setEditTelRecado('');
        setEditObservacao('');
        setEditAssinatura('');
        setIsEditing(true); // Sempre em modo edição na criação
      }
      setIsSaving(false);
      initializedRef.current = true;
      lastProfissionalIdRef.current = profissionalId;
    }

    // Resetar ref quando o modal fechar
    if (!isOpen) {
      initializedRef.current = false;
      lastProfissionalIdRef.current = null;
    }
  }, [profissional, isOpen]);

  const handleStatusChange = async (value: string) => {
    setEditStatus(value);
    if (!profissional || isCreating) return;
    try {
      await updateProfissional(profissional.id, { status: value });
      if (onEdit) {
        onEdit({ ...profissional, status: value });
      }
    } catch (e) {
      console.error('Falha ao atualizar status:', e);
    }
  };

  const onSave = async () => {
    try {
      setIsSaving(true);

      // Modo criação
      if (isCreating) {
        if (!editNome.trim()) {
          alert('Nome é obrigatório');
          return;
        }

        const newProfissional: any = {
          nome: editNome,
          whatsapp: editWhatsapp || null,
          rg: editRg || null,
          cpf: editCpf || null,
          data_nasc: editDataNasc || null,
          tipo: editTipo || null,
          preferencia: editPreferencia || null,
          habilidade: editHabilidade || null,
          estado_civil: editEstadoCivil || null,
          fumante: editFumante || null,
          filhos: editFilhos || null,
          qto_filhos: editQtoFilhos || null,
          endereco: editEndereco || null,
          nome_recado: editNomeRecado || null,
          tel_recado: editTelRecado || null,
          observacao: editObservacao || null,
          assinatura: editAssinatura || null,
          status: 'Ativa', // Status padrão
          unit_id: selectedUnit && selectedUnit.unit_code !== 'ALL' ? (selectedUnit as any).id : null,
          recrutadora_id: 0 // Valor padrão, ajustar conforme necessário
        };

        console.log('ProfissionalDetailModal: Criando profissional:', newProfissional);
        const created = await createProfissional(newProfissional);
        console.log('ProfissionalDetailModal: Resposta do create:', created);

        if (created && onCreate) {
          onCreate(created);
        }
        onClose();
        return;
      }

      // Modo edição
      if (!profissional || !hasChanges) return;

      const patch: any = {};
      if (editNome !== (profissional.nome || '')) patch.nome = editNome;
      if (editWhatsapp !== (profissional.whatsapp || '')) patch.whatsapp = editWhatsapp;
      if (editRg !== (profissional.rg || '')) patch.rg = editRg;
      if (editCpf !== (profissional.cpf || '')) patch.cpf = editCpf;
      if (editDataNasc !== (profissional.data_nasc || '')) patch.data_nasc = editDataNasc || null;
      if (editTipo !== (profissional.tipo || '')) patch.tipo = editTipo;
      if (editPreferencia !== (profissional.preferencia || '')) patch.preferencia = editPreferencia;
      if (editHabilidade !== (profissional.habilidade || '')) patch.habilidade = editHabilidade;
      if (editEstadoCivil !== (profissional.estado_civil || '')) patch.estado_civil = editEstadoCivil;
      if (editFumante !== (profissional.fumante || '')) patch.fumante = editFumante;
      if (editFilhos !== (profissional.filhos || '')) patch.filhos = editFilhos;
      if (editQtoFilhos !== (profissional.qto_filhos || '')) patch.qto_filhos = editQtoFilhos;
      if (editEndereco !== (profissional.endereco || '')) patch.endereco = editEndereco;
      if (editNomeRecado !== (profissional.nome_recado || '')) patch.nome_recado = editNomeRecado;
      if (editTelRecado !== (profissional.tel_recado || '')) patch.tel_recado = editTelRecado;
      if (editObservacao !== (profissional.observacao || '')) patch.observacao = editObservacao;
      if (editAssinatura !== (profissional.assinatura || '')) patch.assinatura = editAssinatura || null;

      if (Object.keys(patch).length > 0) {
        console.log('ProfissionalDetailModal: Salvando patch:', patch);
        const updated = await updateProfissional(profissional.id, patch);
        console.log('ProfissionalDetailModal: Resposta do update:', updated);
        if (updated && onEdit) {
          onEdit(updated);
        }
        setIsEditing(false);
      }
    } catch (error: any) {
      console.error('Erro ao salvar profissional:', error);
      const errorMessage = error?.message || error?.error_description || JSON.stringify(error);
      alert(`Erro ao salvar alterações:\n${errorMessage}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Funções para geração de documentos (idênticas ao RecrutadoraCardModal)
  const generateTemplateDocument = (templateHtml: string, filename: string) => {
    setDocumentName(filename);
    setPreviewOpen(true);
    setTimeout(() => {
      if (previewRef.current) previewRef.current.innerHTML = templateHtml;
    }, 0);
  };

  const printPreview = () => {
    if (!previewRef.current) return;
    const doc = previewRef.current.innerHTML;
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.open();
    w.document.write(doc);
    w.document.close();
    w.focus();
    try { w.print(); } catch { }
  };

  const downloadPreviewPdf = async () => {
    if (!previewRef.current) return;
    const container = previewRef.current.querySelector('html') || previewRef.current;

    const canvas = await html2canvas(container as HTMLElement, {
      scale: window.devicePixelRatio || 2,
      useCORS: true,
      backgroundColor: '#ffffff'
    });

    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const imgWidth = pageWidth;
    const imgHeight = canvas.height * (imgWidth / canvas.width);

    if (imgHeight <= pageHeight) {
      pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight, undefined, 'FAST');
    } else {
      let pos = 0;
      let heightLeft = imgHeight;
      while (heightLeft > 0) {
        pdf.addImage(imgData, 'PNG', 0, pos, imgWidth, imgHeight, undefined, 'FAST');
        heightLeft -= pageHeight;
        if (heightLeft > 0) {
          pdf.addPage();
          pos = - (imgHeight - heightLeft);
        }
      }
    }
    const cleanFilename = `${documentName}_${(editNome || profissional?.nome || 'sem_nome').replace(/\s+/g, '_')}.pdf`;
    pdf.save(cleanFilename);
  };

  const generatePdf = () => {
    // Implementação da Ficha (Ficha Completa)
    setDocumentName('Ficha');
    const titulo = `Ficha - ${editNome || profissional?.nome || 'Sem nome'}`;
    const now = new Date();
    const dateStr = now.toLocaleString('pt-BR');
    const accent = '#010d32';

    const val = (v: any) => {
      if (v === null || v === undefined) return 'Não informado';
      const s = String(v).trim();
      return s === '' ? 'Não informado' : s;
    };

    const nomeDisplay = val(editNome || profissional?.nome);

    const html = `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <title>${titulo}</title>
    <style>
      @page { size: A4; margin: 16mm; }
      * { box-sizing: border-box; }
      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', 'Liberation Sans', sans-serif;
        color: #111827; background: #ffffff; line-height: 1.4;
      }
      .header {
        background: ${accent}; color: #ffffff;
        padding: 18px; border-radius: 14px; margin-bottom: 18px;
        text-align: center;
      }
      .section-title {
        font-size: 18px; font-weight: 700; color: #1f2937; margin: 16px 0 10px;
        padding-bottom: 6px; border-bottom: 2px solid ${accent};
      }
      .grid { display: grid; gap: 10px; grid-template-columns: repeat(2, 1fr); }
      .card {
        background: #ffffff; border-radius: 12px; padding: 12px;
        border: 1px solid rgba(1, 13, 50, 0.1);
      }
      .label { font-size: 11px; font-weight: 700; color: #6b7280; text-transform: uppercase; }
      .value { font-size: 14px; font-weight: 600; color: #111827; }
    </style>
  </head>
  <body>
    <div class="header">
      <h1>${nomeDisplay}</h1>
      <p>Ficha de Cadastro Detalhada • Gerado em ${dateStr}</p>
    </div>
    <section>
      <h2 class="section-title">Informações Pessoais</h2>
      <div class="grid">
        <div class="card"><div class="label">WhatsApp</div><div class="value">${val(editWhatsapp || profissional?.whatsapp)}</div></div>
        <div class="card"><div class="label">RG</div><div class="value">${val(editRg || profissional?.rg)}</div></div>
        <div class="card"><div class="label">CPF</div><div class="value">${val(editCpf || profissional?.cpf)}</div></div>
        <div class="card"><div class="label">Data de Nascimento</div><div class="value">${val(editDataNasc || profissional?.data_nasc)}</div></div>
        <div class="card"><div class="label">Estado Civil</div><div class="value">${val(editEstadoCivil || profissional?.estado_civil)}</div></div>
        <div class="card"><div class="label">Endereço</div><div class="value">${val(editEndereco || profissional?.endereco)}</div></div>
      </div>
    </section>
    <section>
      <h2 class="section-title">Observações</h2>
      <div class="card" style="min-height: 100px;">
        <div class="value">${val(editObservacao || profissional?.observacao).replace(/\n/g, '<br>')}</div>
      </div>
    </section>
  </body>
</html>`;

    generateTemplateDocument(html, 'Ficha');
  };

  useEffect(() => {
    if (!isOpen) return;
    setActiveTab('inicio');
  }, [isOpen]);

  // Carrega métricas de pós-venda ao abrir
  useEffect(() => {
    let cancelled = false;
    if (!isOpen || !profissional || !unitCode || unitCode === 'ALL') return;
    (async () => {
      const m = await fetchProfessionalPosVendaMetrics(unitCode, profissional.nome || '');
      if (!cancelled) setMetrics(m);
    })();
    return () => { cancelled = true; };
  }, [isOpen, profissional, unitCode]);

  useEffect(() => {
    let cancelled = false;
    if (!isOpen || !profissional || !unitCode || unitCode === 'ALL' || activeTab !== 'historico') return;
    setLoadingHist(true);
    (async () => {
      try {
        const hist = await fetchProfessionalHistory(unitCode, profissional.nome || '', 200, selectedPeriod);
        if (!cancelled) setHistory(hist || []);
      } finally {
        if (!cancelled) setLoadingHist(false);
      }
    })();
    return () => { cancelled = true; };
  }, [isOpen, profissional, unitCode, selectedPeriod, activeTab]);

  const Item: React.FC<{ label: string; value: any }> = ({ label, value }) => (
    <div>
      <div className="text-xs text-text-secondary">{label}</div>
      <div className="text-sm text-text-primary break-words">{value ?? '-'}</div>
    </div>
  );

  const StarMetric: React.FC<{ title: string; value: number | null }> = ({ title, value }) => {
    const full = Math.floor(value || 0);
    const half = value !== null && value - full >= 0.5 ? 1 : 0;
    const empty = 5 - full - half;
    const stars: React.ReactNode[] = [];
    for (let i = 0; i < full; i++) stars.push(<span key={`f${i}`} className="text-yellow-400">★</span>);
    if (half) stars.push(<span key="h" className="text-yellow-400">☆</span>);
    for (let i = 0; i < empty; i++) stars.push(<span key={`e${i}`} className="text-text-tertiary">☆</span>);
    return (
      <div className="p-3 border border-white/10 rounded-md">
        <div className="text-xs text-text-secondary mb-1 truncate" title={title}>{title}</div>
        <div className="flex items-center gap-2">
          <div className="text-lg leading-none">{stars}</div>
          <div className="text-sm text-text-secondary">{value !== null ? value.toFixed(1) : '-'}</div>
        </div>
      </div>
    );
  };

  const LabeledInput: React.FC<{ label: string; value: string; onChange: (v: string) => void; type?: string }> = ({ label, value, onChange, type = 'text' }) => (
    <label className="block">
      <span className="text-xs text-text-secondary">{label}</span>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 w-full bg-bg-tertiary border border-border-secondary rounded-md px-2 py-1.5 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-accent-primary" />
    </label>
  );

  const LabeledTextarea: React.FC<{ label: string; value: string; onChange: (v: string) => void }> = ({ label, value, onChange }) => (
    <label className="block col-span-full">
      <span className="text-xs text-text-secondary">{label}</span>
      <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={3} className="mt-1 w-full bg-bg-tertiary border border-border-secondary rounded-md px-2 py-1.5 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-accent-primary" />
    </label>
  );

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4" aria-modal="true" role="dialog" onClick={onClose}>
        <div className="w-full max-w-3xl max-h-[90vh] rounded-xl bg-bg-secondary shadow-2xl overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
          {/* Header compacto com gradiente - Padronizado com Recrutadora */}
          <div className="relative bg-gradient-to-r from-accent-primary/5 to-brand-cyan/5 border-b border-border-secondary px-5 py-3.5">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <div
                  className="h-4 w-4 rounded-full border-2 border-white shadow-md"
                  style={{ backgroundColor: '#4ade80' }}
                />
                <h2 className="text-lg font-bold text-text-primary">
                  {isCreating ? (editNome || 'Profissional') : (profissional?.nome || 'Profissional')}
                </h2>
                {unitName && (
                  <div className="flex items-center gap-1.5 text-xs text-text-secondary">
                    <Icon name="building" className="w-3.5 h-3.5" />
                    <span>{unitName}</span>
                  </div>
                )}
                {profissional && (
                  <div className="flex items-center gap-1.5 text-xs text-text-secondary">
                    <Icon name="hash" className="w-3.5 h-3.5" />
                    <span>ID: {profissional.id}</span>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3">
                {/* Status ao lado do botão fechar */}
                <label className="flex flex-col gap-1.5 min-w-[150px]">
                  <span className="text-xs font-medium text-text-secondary">Status</span>
                  <select
                    value={editStatus || ''}
                    onChange={(e) => handleStatusChange(e.target.value)}
                    className="rounded-lg border border-border-secondary bg-bg-tertiary px-3 py-1.5 text-sm text-text-primary focus:border-accent-primary focus:outline-none focus:ring-2 focus:ring-accent-primary/20 transition-all"
                  >
                    <option value="">-</option>
                    <option value="Ativa">Ativa</option>
                    <option value="Inativa">Inativa</option>
                    <option value="Pendente">Pendente</option>
                  </select>
                </label>

                <button
                  onClick={onClose}
                  className="text-text-secondary hover:text-text-primary hover:bg-bg-tertiary rounded-lg p-1.5 transition-colors mt-5"
                  title="Fechar"
                >
                  <Icon name="X" className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>

          {/* Tabs - Padronizado com Recrutadora */}
          <div className="border-b border-border-secondary bg-bg-tertiary/30">
            <div className="flex items-center px-5">
              <button
                onClick={() => setActiveTab('inicio')}
                className={`px-3 py-2.5 text-sm font-medium transition-colors ${activeTab === 'inicio'
                  ? 'text-accent-primary border-b-2 border-accent-primary'
                  : 'text-text-secondary hover:text-text-primary'
                  }`}
              >
                Início
              </button>
              <button
                onClick={() => setActiveTab('dados')}
                className={`px-3 py-2.5 text-sm font-medium transition-colors ${activeTab === 'dados'
                  ? 'text-accent-primary border-b-2 border-accent-primary'
                  : 'text-text-secondary hover:text-text-primary'
                  }`}
              >
                Dados
              </button>
              {!isCreating && (
                <button
                  onClick={() => setActiveTab('historico')}
                  className={`px-3 py-2.5 text-sm font-medium transition-colors ${activeTab === 'historico'
                    ? 'text-accent-primary border-b-2 border-accent-primary'
                    : 'text-text-secondary hover:text-text-primary'
                    }`}
                >
                  Histórico
                </button>
              )}
              {!isCreating && (
                <button
                  onClick={() => setActiveTab('documentos')}
                  className={`px-3 py-2.5 text-sm font-medium transition-colors ${activeTab === 'documentos'
                    ? 'text-accent-primary border-b-2 border-accent-primary'
                    : 'text-text-secondary hover:text-text-primary'
                    }`}
                >
                  Documentos
                </button>
              )}
              {activeTab === 'historico' && unitCode !== 'ALL' && (
                <div className="ml-auto flex items-center gap-2 py-2">
                  <button
                    type="button"
                    className="px-2 py-1 rounded-md border border-border-secondary text-text-secondary hover:bg-bg-tertiary"
                    title="Mês anterior"
                    onClick={() => {
                      if (!selectedPeriod || !/^\d{4}-\d{2}$/.test(selectedPeriod)) return;
                      const [y, m] = selectedPeriod.split('-').map(Number);
                      const d = new Date(Date.UTC(y, m - 1, 1));
                      d.setUTCMonth(d.getUTCMonth() - 1);
                      const ny = d.getUTCFullYear();
                      const nm = d.getUTCMonth() + 1;
                      setSelectedPeriod(`${ny}-${String(nm).padStart(2, '0')}`);
                    }}
                  >‹</button>
                  <span className="text-xs text-text-secondary min-w-[140px] text-center">
                    {(() => {
                      const label = (p?: string) => {
                        if (!p || !/^\d{4}-\d{2}$/.test(p)) return '-';
                        const [yy, mm] = p.split('-').map(Number);
                        const meses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
                        return `${meses[Math.max(1, Math.min(12, mm)) - 1]} ${yy}`;
                      };
                      return label(selectedPeriod);
                    })()}
                  </span>
                  <button
                    type="button"
                    className="px-2 py-1 rounded-md border border-border-secondary text-text-secondary hover:bg-bg-tertiary"
                    title="Próximo mês"
                    onClick={() => {
                      if (!selectedPeriod || !/^\d{4}-\d{2}$/.test(selectedPeriod)) return;
                      const [y, m] = selectedPeriod.split('-').map(Number);
                      const d = new Date(Date.UTC(y, m - 1, 1));
                      d.setUTCMonth(d.getUTCMonth() + 1);
                      const ny = d.getUTCFullYear();
                      const nm = d.getUTCMonth() + 1;
                      const next = `${ny}-${String(nm).padStart(2, '0')}`;
                      const now = new Date();
                      const cap = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
                      if (next > cap) return;
                      setSelectedPeriod(next);
                    }}
                  >›</button>
                </div>
              )}
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto p-4">
            {activeTab === 'inicio' && (
              <div className="space-y-4">
                {/* Métricas de pós-venda com estrelas - apenas para profissionais existentes */}
                {!isCreating && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <StarMetric title="Geral" value={metrics.geral} />
                    <StarMetric title="Comercial" value={metrics.comercial} />
                    <StarMetric title="Residencial" value={metrics.residencial} />
                  </div>
                )}

                <div className="space-y-3">
                  {isEditing || isCreating ? (
                    <>
                      {/* Linha 1: Nome (4) | Data Nasc (3) | WhatsApp (3) */}
                      <div className="grid grid-cols-1 md:grid-cols-10 gap-3">
                        <div className="md:col-span-4">
                          <label className="block text-xs font-medium text-text-secondary mb-1">
                            Nome <span className="text-danger">*</span>
                          </label>
                          <input
                            type="text"
                            value={editNome}
                            onChange={(e) => setEditNome(e.target.value)}
                            className="w-full rounded-md border border-border-secondary bg-bg-tertiary/50 px-3 py-1.5 text-sm text-text-primary focus:border-accent-primary focus:outline-none focus:ring-1 focus:ring-accent-primary/20 transition-all"
                            placeholder="Nome completo"
                          />
                        </div>
                        <div className="md:col-span-3">
                          <label className="block text-xs font-medium text-text-secondary mb-1">Data Nascimento</label>
                          <input
                            type="date"
                            value={editDataNasc}
                            onChange={(e) => setEditDataNasc(e.target.value)}
                            className="w-full rounded-md border border-border-secondary bg-bg-tertiary/50 px-3 py-1.5 text-sm text-text-primary focus:border-accent-primary focus:outline-none focus:ring-1 focus:ring-accent-primary/20 transition-all"
                          />
                        </div>
                        <div className="md:col-span-3">
                          <label className="block text-xs font-medium text-text-secondary mb-1">WhatsApp</label>
                          <input
                            type="text"
                            value={editWhatsapp}
                            onChange={(e) => setEditWhatsapp(e.target.value)}
                            className="w-full rounded-md border border-border-secondary bg-bg-tertiary/50 px-3 py-1.5 text-sm text-text-primary focus:border-accent-primary focus:outline-none focus:ring-1 focus:ring-accent-primary/20 transition-all"
                            placeholder="(00) 00000-0000"
                          />
                        </div>
                      </div>

                      {/* Linha 2: RG | CPF | Tipo | Preferência */}
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-text-secondary mb-1">RG</label>
                          <input
                            type="text"
                            value={editRg}
                            onChange={(e) => setEditRg(e.target.value)}
                            className="w-full rounded-md border border-border-secondary bg-bg-tertiary/50 px-3 py-1.5 text-sm text-text-primary focus:border-accent-primary focus:outline-none focus:ring-1 focus:ring-accent-primary/20 transition-all"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-text-secondary mb-1">CPF</label>
                          <input
                            type="text"
                            value={editCpf}
                            onChange={(e) => setEditCpf(e.target.value)}
                            className="w-full rounded-md border border-border-secondary bg-bg-tertiary/50 px-3 py-1.5 text-sm text-text-primary focus:border-accent-primary focus:outline-none focus:ring-1 focus:ring-accent-primary/20 transition-all"
                            placeholder="000.000.000-00"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-text-secondary mb-1">Tipo</label>
                          <input
                            type="text"
                            value={editTipo}
                            onChange={(e) => setEditTipo(e.target.value)}
                            className="w-full rounded-md border border-border-secondary bg-bg-tertiary/50 px-3 py-1.5 text-sm text-text-primary focus:border-accent-primary focus:outline-none focus:ring-1 focus:ring-accent-primary/20 transition-all"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-text-secondary mb-1">Preferência</label>
                          <input
                            type="text"
                            value={editPreferencia}
                            onChange={(e) => setEditPreferencia(e.target.value)}
                            className="w-full rounded-md border border-border-secondary bg-bg-tertiary/50 px-3 py-1.5 text-sm text-text-primary focus:border-accent-primary focus:outline-none focus:ring-1 focus:ring-accent-primary/20 transition-all"
                          />
                        </div>
                      </div>

                      {/* Linha 3: Habilidade (full width) */}
                      <div>
                        <label className="block text-xs font-medium text-text-secondary mb-1">Habilidade</label>
                        <input
                          type="text"
                          value={editHabilidade}
                          onChange={(e) => setEditHabilidade(e.target.value)}
                          className="w-full rounded-md border border-border-secondary bg-bg-tertiary/50 px-3 py-1.5 text-sm text-text-primary focus:border-accent-primary focus:outline-none focus:ring-1 focus:ring-accent-primary/20 transition-all"
                        />
                      </div>
                    </>
                  ) : profissional ? (
                    <>
                      {/* READ ONLY VIEW */}
                      <div className="grid grid-cols-1 md:grid-cols-10 gap-3">
                        <div className="md:col-span-4">
                          <div className="text-xs text-text-secondary mb-1">Nome</div>
                          <div className="border border-border-secondary rounded-md p-2 bg-bg-tertiary/30 text-sm text-text-primary">{profissional.nome || '-'}</div>
                        </div>
                        <div className="md:col-span-3">
                          <div className="text-xs text-text-secondary mb-1">Data Nascimento</div>
                          <div className="border border-border-secondary rounded-md p-2 bg-bg-tertiary/30 text-sm text-text-primary">{profissional.data_nasc ? new Date(profissional.data_nasc).toLocaleDateString('pt-BR') : '-'}</div>
                        </div>
                        <div className="md:col-span-3">
                          <div className="text-xs text-text-secondary mb-1">WhatsApp</div>
                          <div className="border border-border-secondary rounded-md p-2 bg-bg-tertiary/30 text-sm text-text-primary">{profissional.whatsapp || '-'}</div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                        <div>
                          <div className="text-xs text-text-secondary mb-1">RG</div>
                          <div className="border border-border-secondary rounded-md p-2 bg-bg-tertiary/30 text-sm text-text-primary">{profissional.rg || '-'}</div>
                        </div>
                        <div>
                          <div className="text-xs text-text-secondary mb-1">CPF</div>
                          <div className="border border-border-secondary rounded-md p-2 bg-bg-tertiary/30 text-sm text-text-primary">{profissional.cpf || '-'}</div>
                        </div>
                        <div>
                          <div className="text-xs text-text-secondary mb-1">Tipo</div>
                          <div className="border border-border-secondary rounded-md p-2 bg-bg-tertiary/30 text-sm text-text-primary">{profissional.tipo || '-'}</div>
                        </div>
                        <div>
                          <div className="text-xs text-text-secondary mb-1">Preferência</div>
                          <div className="border border-border-secondary rounded-md p-2 bg-bg-tertiary/30 text-sm text-text-primary">{profissional.preferencia || '-'}</div>
                        </div>
                      </div>

                      <div>
                        <div className="text-xs text-text-secondary mb-1">Habilidade</div>
                        <div className="border border-border-secondary rounded-md p-2 bg-bg-tertiary/30 text-sm text-text-primary">{profissional.habilidade || '-'}</div>
                      </div>
                    </>
                  ) : null}
                </div>
              </div>
            )}

            {activeTab === 'dados' && (
              <div className="space-y-3">
                {(isEditing || isCreating) ? (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-text-secondary mb-1">Estado Civil</label>
                        <input
                          type="text"
                          value={editEstadoCivil}
                          onChange={(e) => setEditEstadoCivil(e.target.value)}
                          className="w-full rounded-md border border-border-secondary bg-bg-tertiary/50 px-3 py-1.5 text-sm text-text-primary focus:border-accent-primary focus:outline-none focus:ring-1 focus:ring-accent-primary/20 transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-text-secondary mb-1">Fumante</label>
                        <input
                          type="text"
                          value={editFumante}
                          onChange={(e) => setEditFumante(e.target.value)}
                          className="w-full rounded-md border border-border-secondary bg-bg-tertiary/50 px-3 py-1.5 text-sm text-text-primary focus:border-accent-primary focus:outline-none focus:ring-1 focus:ring-accent-primary/20 transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-text-secondary mb-1">Filhos</label>
                        <input
                          type="text"
                          value={editFilhos}
                          onChange={(e) => setEditFilhos(e.target.value)}
                          className="w-full rounded-md border border-border-secondary bg-bg-tertiary/50 px-3 py-1.5 text-sm text-text-primary focus:border-accent-primary focus:outline-none focus:ring-1 focus:ring-accent-primary/20 transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-text-secondary mb-1">Qtd Filhos</label>
                        <input
                          type="text"
                          value={editQtoFilhos}
                          onChange={(e) => setEditQtoFilhos(e.target.value)}
                          className="w-full rounded-md border border-border-secondary bg-bg-tertiary/50 px-3 py-1.5 text-sm text-text-primary focus:border-accent-primary focus:outline-none focus:ring-1 focus:ring-accent-primary/20 transition-all"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-text-secondary mb-1">Endereço</label>
                      <input
                        type="text"
                        value={editEndereco}
                        onChange={(e) => setEditEndereco(e.target.value)}
                        className="w-full rounded-md border border-border-secondary bg-bg-tertiary/50 px-3 py-1.5 text-sm text-text-primary focus:border-accent-primary focus:outline-none focus:ring-1 focus:ring-accent-primary/20 transition-all"
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-text-secondary mb-1">Nome Recado</label>
                        <input
                          type="text"
                          value={editNomeRecado}
                          onChange={(e) => setEditNomeRecado(e.target.value)}
                          className="w-full rounded-md border border-border-secondary bg-bg-tertiary/50 px-3 py-1.5 text-sm text-text-primary focus:border-accent-primary focus:outline-none focus:ring-1 focus:ring-accent-primary/20 transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-text-secondary mb-1">Tel Recado</label>
                        <input
                          type="text"
                          value={editTelRecado}
                          onChange={(e) => setEditTelRecado(e.target.value)}
                          className="w-full rounded-md border border-border-secondary bg-bg-tertiary/50 px-3 py-1.5 text-sm text-text-primary focus:border-accent-primary focus:outline-none focus:ring-1 focus:ring-accent-primary/20 transition-all"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-text-secondary mb-1">Observação</label>
                      <textarea
                        value={editObservacao}
                        onChange={(e) => setEditObservacao(e.target.value)}
                        rows={4}
                        className="w-full rounded-md border border-border-secondary bg-bg-tertiary/50 px-3 py-1.5 text-sm text-text-primary focus:border-accent-primary focus:outline-none focus:ring-1 focus:ring-accent-primary/20 transition-all resize-none"
                      />
                    </div>
                  </>
                ) : profissional ? (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                      <div>
                        <div className="text-xs text-text-secondary mb-1">Estado Civil</div>
                        <div className="border border-border-secondary rounded-md p-2 bg-bg-tertiary/30 text-sm text-text-primary">{profissional.estado_civil || '-'}</div>
                      </div>
                      <div>
                        <div className="text-xs text-text-secondary mb-1">Fumante</div>
                        <div className="border border-border-secondary rounded-md p-2 bg-bg-tertiary/30 text-sm text-text-primary">{profissional.fumante || '-'}</div>
                      </div>
                      <div>
                        <div className="text-xs text-text-secondary mb-1">Filhos</div>
                        <div className="border border-border-secondary rounded-md p-2 bg-bg-tertiary/30 text-sm text-text-primary">{profissional.filhos || '-'}</div>
                      </div>
                      <div>
                        <div className="text-xs text-text-secondary mb-1">Qtd Filhos</div>
                        <div className="border border-border-secondary rounded-md p-2 bg-bg-tertiary/30 text-sm text-text-primary">{profissional.qto_filhos || '-'}</div>
                      </div>
                    </div>

                    <div>
                      <div className="text-xs text-text-secondary mb-1">Endereço</div>
                      <div className="border border-border-secondary rounded-md p-2 bg-bg-tertiary/30 text-sm text-text-primary">{profissional.endereco || '-'}</div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <div className="text-xs text-text-secondary mb-1">Nome Recado</div>
                        <div className="border border-border-secondary rounded-md p-2 bg-bg-tertiary/30 text-sm text-text-primary">{profissional.nome_recado || '-'}</div>
                      </div>
                      <div>
                        <div className="text-xs text-text-secondary mb-1">Tel Recado</div>
                        <div className="border border-border-secondary rounded-md p-2 bg-bg-tertiary/30 text-sm text-text-primary">{profissional.tel_recado || '-'}</div>
                      </div>
                    </div>

                    <div>
                      <div className="text-xs text-text-secondary mb-1">Observação</div>
                      <div className="border border-border-secondary rounded-md p-2 bg-bg-tertiary/30 text-sm text-text-primary min-h-[100px] whitespace-pre-wrap">{profissional.observacao || '-'}</div>
                    </div>
                  </>
                ) : null}
              </div>
            )}
            {activeTab === 'historico' && (
              unitCode === 'ALL' ? (
                <div className="text-sm text-text-secondary">Selecione uma unidade para ver o histórico.</div>
              ) : (
                <div className="overflow-auto border border-border-secondary rounded-md">
                  {loadingHist ? (
                    <div className="p-3 text-sm text-text-secondary">Carregando…</div>
                  ) : (
                    <table className="min-w-full text-sm">
                      <thead className="bg-bg-tertiary text-text-secondary">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium">Data</th>
                          <th className="px-3 py-2 text-left font-medium">Dia</th>
                          <th className="px-3 py-2 text-left font-medium">Cliente</th>
                          <th className="px-3 py-2 text-left font-medium">Pós-venda</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(!history || history.length === 0) ? (
                          <tr><td colSpan={4} className="px-3 py-4 text-center text-text-secondary">Sem atendimentos registrados.</td></tr>
                        ) : (
                          history.map((h, idx) => (
                            <tr
                              key={h.id || idx}
                              className="border-t border-border-secondary hover:bg-bg-tertiary/50 cursor-pointer transition-colors"
                              onDoubleClick={async () => {
                                if (!h.id) return;
                                const rec = await fetchDataRecordById(String(h.id));
                                setDetailRecord(rec);
                                setDetailOpen(true);
                              }}
                            >
                              <td className="px-3 py-2">{h.DATA ? new Date(h.DATA + 'T00:00:00').toLocaleDateString('pt-BR') : '-'}</td>
                              <td className="px-3 py-2">{h.DIA || '-'}</td>
                              <td className="px-3 py-2">{h.CLIENTE || '-'}</td>
                              <td className="px-3 py-2">{(h as any)['pos vendas'] || '-'}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  )}
                </div>
              )
            )}
            {activeTab === 'documentos' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-4 p-3 bg-bg-tertiary rounded-lg border border-border-secondary">
                  <div className="text-sm text-text-secondary">
                    Data de assinatura do contrato agenciamento:
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      value={editAssinatura}
                      onChange={(e) => setEditAssinatura(e.target.value)}
                      disabled={!isEditing}
                      className="px-3 py-1.5 rounded bg-bg-secondary text-text-primary border border-border-secondary focus:outline-none text-sm disabled:opacity-50"
                    />
                  </div>
                </div>

                <div className="flex gap-3 overflow-x-auto pb-4 scrollbar-hide">

                  {/* Contrato de Agenciamento */}
                  <button
                    onClick={() => {
                      if (!selectedUnit || (selectedUnit as any).id === 'ALL') {
                        alert('Por favor, selecione uma unidade específica.');
                        return;
                      }
                      const unit = selectedUnit as Unit;
                      const documentData = {
                        profissional: {
                          nome: editNome || profissional?.nome || '',
                          cpf: editCpf || profissional?.cpf || '',
                          rg: editRg || profissional?.rg || '',
                          dataNascimento: editDataNasc || profissional?.data_nasc || '',
                          estadoCivil: editEstadoCivil || profissional?.estado_civil || '',
                          endereco: editEndereco || profissional?.endereco || '',
                          whatsapp: editWhatsapp || profissional?.whatsapp || '',
                        },
                        unidade: {
                          razaoSocial: unit.razao_social || '',
                          cnpj: unit.cnpj || '',
                          endereco: unit.endereco || (unit as any).address || '',
                          unitName: unit.unit_name || '',
                          uniform_value: (unit as any).uniform_value,
                        },
                        contrato: {
                          percentualProfissional: 55,
                          dataAssinatura: editAssinatura ? new Date(editAssinatura + 'T12:00:00').toLocaleDateString('pt-BR') : new Date().toLocaleDateString('pt-BR'),
                        },
                      };
                      const html = generateContratoHTML(documentData);
                      generateTemplateDocument(html, 'Contrato_Agenciamento');
                    }}
                    className="flex-shrink-0 flex flex-col items-center gap-2 p-4 border border-border-secondary rounded-lg hover:bg-bg-tertiary hover:border-accent-primary/50 transition-all group min-w-[140px]"
                  >
                    <div className="w-12 h-12 rounded-lg bg-green-500/10 flex items-center justify-center group-hover:bg-green-500/20 transition-colors">
                      <Icon name="FileText" className="w-6 h-6 text-green-500" />
                    </div>
                    <div className="text-sm font-medium text-text-primary text-center">Contrato</div>
                    <div className="text-xs text-text-secondary text-center">Agenciamento</div>
                  </button>

                  {/* Aditamento Contratual */}
                  <button
                    onClick={() => {
                      if (!selectedUnit || (selectedUnit as any).id === 'ALL') {
                        alert('Por favor, selecione uma unidade específica.');
                        return;
                      }
                      const unit = selectedUnit as Unit;
                      const documentData = {
                        profissional: {
                          nome: editNome || profissional?.nome || '',
                          cpf: editCpf || profissional?.cpf || '',
                          rg: editRg || profissional?.rg || '',
                          dataNascimento: editDataNasc || profissional?.data_nasc || '',
                          estadoCivil: editEstadoCivil || profissional?.estado_civil || '',
                          endereco: editEndereco || profissional?.endereco || '',
                          whatsapp: editWhatsapp || profissional?.whatsapp || '',
                        },
                        unidade: {
                          razaoSocial: unit.razao_social || '',
                          cnpj: unit.cnpj || '',
                          endereco: unit.endereco || (unit as any).address || '',
                          unitName: unit.unit_name || '',
                          uniform_value: (unit as any).uniform_value,
                        },
                        contrato: {
                          percentualProfissional: 55,
                          dataAssinatura: editAssinatura ? new Date(editAssinatura + 'T12:00:00').toLocaleDateString('pt-BR') : new Date().toLocaleDateString('pt-BR'),
                        },
                      };
                      const html = generateAditamentoHTML(documentData);
                      generateTemplateDocument(html, `Aditamento_${(editNome || profissional?.nome || 'sem_nome').replace(/\s+/g, '_')}`);
                    }}
                    className="flex-shrink-0 flex flex-col items-center gap-2 p-4 border border-border-secondary rounded-lg hover:bg-bg-tertiary hover:border-accent-primary/50 transition-all group min-w-[140px]"
                  >
                    <div className="w-12 h-12 rounded-lg bg-blue-500/10 flex items-center justify-center group-hover:bg-blue-500/20 transition-colors">
                      <Icon name="FileText" className="w-6 h-6 text-blue-500" />
                    </div>
                    <div className="text-sm font-medium text-text-primary text-center">Aditamento</div>
                    <div className="text-xs text-text-secondary text-center">Contrato</div>
                  </button>

                  {/* Termo de Confidencialidade */}
                  <button
                    onClick={() => {
                      if (!selectedUnit || (selectedUnit as any).id === 'ALL') {
                        alert('Por favor, selecione uma unidade específica.');
                        return;
                      }
                      const unit = selectedUnit as Unit;
                      const documentData = {
                        profissional: {
                          nome: editNome || profissional?.nome || '',
                          cpf: editCpf || profissional?.cpf || '',
                          rg: editRg || profissional?.rg || '',
                          dataNascimento: editDataNasc || profissional?.data_nasc || '',
                          estadoCivil: editEstadoCivil || profissional?.estado_civil || '',
                          endereco: editEndereco || profissional?.endereco || '',
                          whatsapp: editWhatsapp || profissional?.whatsapp || '',
                        },
                        unidade: {
                          razaoSocial: unit.razao_social || '',
                          cnpj: unit.cnpj || '',
                          endereco: unit.endereco || (unit as any).address || '',
                          unitName: unit.unit_name || '',
                        },
                      };
                      const html = generateTermoHTML(documentData);
                      generateTemplateDocument(html, 'Termo_Confidencialidade');
                    }}
                    className="flex-shrink-0 flex flex-col items-center gap-2 p-4 border border-border-secondary rounded-lg hover:bg-bg-tertiary hover:border-accent-primary/50 transition-all group min-w-[140px]"
                  >
                    <div className="w-12 h-12 rounded-lg bg-purple-500/10 flex items-center justify-center group-hover:bg-purple-500/20 transition-colors">
                      <Icon name="FileText" className="w-6 h-6 text-purple-500" />
                    </div>
                    <div className="text-sm font-medium text-text-primary text-center">Termo</div>
                    <div className="text-xs text-text-secondary text-center">Confidencialidade</div>
                  </button>

                  {/* Notificação de Recisão */}
                  <button
                    onClick={() => {
                      if (!selectedUnit || (selectedUnit as any).id === 'ALL') {
                        alert('Por favor, selecione uma unidade específica.');
                        return;
                      }
                      const unit = selectedUnit as Unit;
                      const documentData = {
                        profissional: {
                          nome: editNome || profissional?.nome || '',
                          cpf: editCpf || profissional?.cpf || '',
                          rg: editRg || profissional?.rg || '',
                          dataNascimento: editDataNasc || profissional?.data_nasc || '',
                          estadoCivil: editEstadoCivil || profissional?.estado_civil || '',
                          endereco: editEndereco || profissional?.endereco || '',
                          whatsapp: editWhatsapp || profissional?.whatsapp || '',
                        },
                        unidade: {
                          razaoSocial: unit.razao_social || '',
                          cnpj: unit.cnpj || '',
                          endereco: unit.endereco || (unit as any).address || '',
                          unitName: unit.unit_name || '',
                        },
                      };
                      const html = generateNotificacaoHTML(documentData);
                      generateTemplateDocument(html, 'Notificacao_Rescisao');
                    }}
                    className="flex-shrink-0 flex flex-col items-center gap-2 p-4 border border-border-secondary rounded-lg hover:bg-bg-tertiary hover:border-accent-primary/50 transition-all group min-w-[140px]"
                  >
                    <div className="w-12 h-12 rounded-lg bg-orange-500/10 flex items-center justify-center group-hover:bg-orange-500/20 transition-colors">
                      <Icon name="FileText" className="w-6 h-6 text-orange-500" />
                    </div>
                    <div className="text-sm font-medium text-text-primary text-center">Notificação</div>
                    <div className="text-xs text-text-secondary text-center">Recisão</div>
                  </button>

                  {/* Distrato */}
                  <button
                    onClick={() => {
                      if (!selectedUnit || (selectedUnit as any).id === 'ALL') {
                        alert('Por favor, selecione uma unidade específica.');
                        return;
                      }
                      const unit = selectedUnit as Unit;
                      const documentData = {
                        profissional: {
                          nome: editNome || profissional?.nome || '',
                          cpf: editCpf || profissional?.cpf || '',
                          rg: editRg || profissional?.rg || '',
                          dataNascimento: editDataNasc || profissional?.data_nasc || '',
                          estadoCivil: editEstadoCivil || profissional?.estado_civil || '',
                          endereco: editEndereco || profissional?.endereco || '',
                          whatsapp: editWhatsapp || profissional?.whatsapp || '',
                        },
                        unidade: {
                          razaoSocial: unit.razao_social || '',
                          cnpj: unit.cnpj || '',
                          endereco: unit.endereco || (unit as any).address || '',
                          unitName: unit.unit_name || '',
                        },
                        contrato: {
                          dataAssinatura: editAssinatura ? new Date(editAssinatura + 'T12:00:00').toLocaleDateString('pt-BR') : new Date().toLocaleDateString('pt-BR'),
                        }
                      };
                      const html = generateDistratoHTML(documentData);
                      generateTemplateDocument(html, 'Distrato_Parceria');
                    }}
                    className="flex-shrink-0 flex flex-col items-center gap-2 p-4 border border-border-secondary rounded-lg hover:bg-bg-tertiary hover:border-accent-primary/50 transition-all group min-w-[140px]"
                  >
                    <div className="w-12 h-12 rounded-lg bg-red-500/10 flex items-center justify-center group-hover:bg-red-500/20 transition-colors">
                      <Icon name="FileText" className="w-6 h-6 text-red-500" />
                    </div>
                    <div className="text-sm font-medium text-text-primary text-center">Distrato</div>
                    <div className="text-xs text-text-secondary text-center">Parceria</div>
                  </button>
                </div>
              </div>
            )}

            {/* Footer compacto - Padronizado com Recrutadora */}
            <div className="flex items-center justify-between border-t border-border-secondary bg-bg-tertiary px-5 py-3.5">
              <div className="flex items-center gap-1 text-xs text-text-secondary">
                <Icon name="info" className="w-3 h-3" />
                <span>{activeTab === 'dados' && isEditing ? '* Obrigatório' : ''}</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (!isEditing && !isCreating) {
                      setIsEditing(true);
                    } else {
                      onSave();
                    }
                  }}
                  disabled={isSaving || (isEditing && !hasChanges)}
                  className="rounded-lg bg-accent-primary p-2.5 text-white hover:bg-accent-primary/90 focus:outline-none focus:ring-2 focus:ring-accent-primary transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-accent-primary/20"
                  title={isSaving ? "Salvando..." : (!isEditing && !isCreating) ? "Editar" : "Salvar"}
                >
                  {isSaving ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  ) : (
                    <Icon name={(!isEditing && !isCreating) ? "edit" : "check"} className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Modal de Preview (A4) */}
          {
            previewOpen && (
              <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 px-4" onClick={() => setPreviewOpen(false)}>
                <div className="bg-white rounded-lg shadow-xl w-full max-w-5xl h-[90vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-between px-6 py-4 border-b border-border-secondary bg-bg-tertiary">
                    <h3 className="text-lg font-bold text-text-primary">Pré-visualização</h3>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={printPreview}
                        className="px-4 py-2 bg-accent-primary text-white rounded-lg hover:bg-accent-primary/90 transition-all flex items-center gap-2 text-sm font-medium"
                      >
                        <Icon name="Printer" className="w-4 h-4" />
                        Imprimir
                      </button>
                      <button
                        onClick={downloadPreviewPdf}
                        className="px-4 py-2 bg-brand-cyan text-white rounded-lg hover:bg-brand-cyan/90 transition-all flex items-center gap-2 text-sm font-medium"
                      >
                        <Icon name="Download" className="w-4 h-4" />
                        Baixar PDF
                      </button>
                      <button
                        onClick={() => setPreviewOpen(false)}
                        className="p-2 rounded-lg hover:bg-bg-secondary text-text-secondary transition-colors"
                      >
                        <Icon name="X" className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                  <div className="flex-1 min-h-0 overflow-auto bg-gray-100 p-8">
                    <div className="mx-auto bg-white shadow-2xl" style={{ width: '210mm', minHeight: '297mm' }}>
                      <div ref={previewRef} className="p-0" />
                    </div>
                  </div>
                </div>
              </div>
            )
          }

        </div>
      </div >

      <DataDetailModal
        isOpen={detailOpen}
        onClose={() => setDetailOpen(false)}
        record={detailRecord}
        onEdit={() => { }}
        onDelete={() => { }}
      />
    </>
  );
};

export default ProfissionalDetailModal;
