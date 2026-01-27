import React, { useState, useEffect, useRef } from 'react';
import { Icon } from './Icon';
import { Profissional, createProfissional, updateProfissional, fetchProfessionalHistory, fetchProfessionalPosVendaMetrics } from '../../services/profissionais/profissionais.service';
import { useAppContext } from '../../contexts/AppContext';
import DataDetailModal from './DataDetailModal';
import { fetchDataRecordById } from '../../services/data/dataTable.service';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { generateAditamentoHTML } from '../documents/utils/generateAditamentoHTML';
import { generateContratoHTML } from '../documents/utils/generateContratoHTML';
import { generateDistratoHTML } from '../documents/utils/generateDistratoHTML';
import { generateTermoHTML } from '../documents/utils/generateTermoHTML';
import { generateNotificacaoHTML } from '../documents/utils/generateNotificacaoHTML';
import { getDocumentTemplate } from '../documents/utils/templateHelpers';
import { Unit } from '../../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  profissional: Profissional | null;
  onSave: () => void;
}

type TabType = 'dados' | 'atendimentos' | 'observacao' | 'documentos' | 'posvendas';

export const ProfissionalFormModal: React.FC<Props> = ({ isOpen, onClose, profissional, onSave }) => {
  const { selectedUnit } = useAppContext();
  const isCreating = !profissional;
  const unitCode = (selectedUnit as any)?.unit_code || null;
  const unidade = (selectedUnit as any)?.unit_name || '';

  const [activeTab, setActiveTab] = useState<TabType>('dados');
  const [formData, setFormData] = useState({
    nome: '',
    whatsapp: '',
    cpf: '',
    rg: '',
    data_nasc: '',
    endereco: '',
    tipo: '',
    estado_civil: '',
    nome_recado: '',
    tel_recado: '',
    observacao: '',
    assinatura: '',
    status: 'Ativa',
  });

  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  // Estado para modo edição
  const [editMode, setEditMode] = useState(false);

  // Estados para histórico
  const [selectedPeriod, setSelectedPeriod] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [loadingHist, setLoadingHist] = useState(false);
  const [history, setHistory] = useState<Array<any>>([]);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailRecord, setDetailRecord] = useState<any | null>(null);

  // Estados para pós-venda
  const [metrics, setMetrics] = useState<{ geral: number | null; comercial: number | null; residencial: number | null }>({
    geral: null,
    comercial: null,
    residencial: null
  });

  // Estados para auto-save observação
  const [autoSavingObs, setAutoSavingObs] = useState(false);
  const [autoSaveObsMsg, setAutoSaveObsMsg] = useState<string | null>(null);
  const prevObservacaoRef = useRef<string>('');

  // Estados para preview PDF
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewHtml, setPreviewHtml] = useState<string>('');
  const [documentName, setDocumentName] = useState('Documento');
  const previewRef = useRef<HTMLDivElement>(null);

  // Inicializa ou reseta o formulário
  useEffect(() => {
    if (isOpen) {
      if (profissional) {
        setFormData({
          nome: profissional.nome || '',
          whatsapp: profissional.whatsapp || '',
          cpf: profissional.cpf || '',
          rg: profissional.rg || '',
          data_nasc: profissional.data_nasc || '',
          endereco: profissional.endereco || '',
          tipo: profissional.tipo || '',
          estado_civil: profissional.estado_civil || '',
          nome_recado: profissional.nome_recado || '',
          tel_recado: profissional.tel_recado || '',
          observacao: profissional.observacao || '',
          assinatura: profissional.assinatura || '',
          status: profissional.status || 'Ativa',
        });
        prevObservacaoRef.current = profissional.observacao || '';
        setEditMode(false);
        setActiveTab('dados');
      } else {
        setFormData({
          nome: '',
          whatsapp: '',
          cpf: '',
          rg: '',
          data_nasc: '',
          endereco: '',
          tipo: '',
          estado_civil: '',
          nome_recado: '',
          tel_recado: '',
          observacao: '',
          assinatura: '',
          status: 'Ativa',
        });
        prevObservacaoRef.current = '';
        setEditMode(true);
        setActiveTab('dados');
      }
      setError('');
      setIsSaving(false);
      setHistory([]);
      setMetrics({ geral: null, comercial: null, residencial: null });
    }
  }, [isOpen, profissional]);

  // Carrega histórico quando mudar de tab ou período
  useEffect(() => {
    if (isOpen && activeTab === 'atendimentos' && profissional && unitCode) {
      loadHistory();
    }
  }, [isOpen, activeTab, selectedPeriod, profissional, unitCode]);

  // Carrega métricas pós-venda
  useEffect(() => {
    if (isOpen && activeTab === 'posvendas' && profissional && unitCode) {
      loadPosVendaMetrics();
    }
  }, [isOpen, activeTab, profissional, unitCode]);

  const loadHistory = async () => {
    if (!profissional || !unitCode) return;
    setLoadingHist(true);
    try {
      const hist = await fetchProfessionalHistory(unitCode, profissional.nome || '', 200, selectedPeriod);
      setHistory(hist || []);
    } catch (err) {
      console.error('Erro ao carregar histórico:', err);
      setHistory([]);
    } finally {
      setLoadingHist(false);
    }
  };

  const loadPosVendaMetrics = async () => {
    if (!profissional || !unitCode) return;
    try {
      const m = await fetchProfessionalPosVendaMetrics(unitCode, profissional.nome || '');
      setMetrics(m || { geral: null, comercial: null, residencial: null });
    } catch (err) {
      console.error('Erro ao carregar métricas pós-venda:', err);
      setMetrics({ geral: null, comercial: null, residencial: null });
    }
  };

  const handleOpenDetail = async (recordId: number) => {
    try {
      const rec = await fetchDataRecordById(String(recordId));
      setDetailRecord(rec);
      setDetailOpen(true);
    } catch (err) {
      console.error('Erro ao abrir detalhe:', err);
    }
  };

  const handleAutoSaveObservacao = async () => {
    // Auto-save apenas para profissionais existentes
    if (!profissional || isCreating) return;
    // Evita salvar quando não houve mudança
    if (formData.observacao === prevObservacaoRef.current) return;
    if (autoSavingObs) return;

    setAutoSavingObs(true);
    setAutoSaveObsMsg(null);

    try {
      await updateProfissional(profissional.id, { observacao: formData.observacao });
      prevObservacaoRef.current = formData.observacao;
      setAutoSaveObsMsg('Observação salva');
      setTimeout(() => setAutoSaveObsMsg(null), 2000);
    } catch (e) {
      setAutoSaveObsMsg('Falha ao salvar');
      setTimeout(() => setAutoSaveObsMsg(null), 2500);
    } finally {
      setAutoSavingObs(false);
    }
  };

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.nome.trim()) {
      setError('Nome é obrigatório');
      return;
    }

    setIsSaving(true);
    setError('');

    try {
      // Prepara o payload sanitizando datas vazias
      const payload: any = { ...formData };
      if (!payload.data_nasc) payload.data_nasc = null;
      if (!payload.assinatura) payload.assinatura = null;


      if (isCreating) {
        // Criar nova profissional
        const newProfissional = {
          ...payload,
          status: 'Ativa',
          unit_id: selectedUnit && selectedUnit.unit_code !== 'ALL' ? (selectedUnit as any).id : null,
        };

        await createProfissional(newProfissional);
      } else {
        // Atualizar profissional existente
        if (!profissional?.id) {
          throw new Error('ID da profissional não encontrado');
        }

        await updateProfissional(profissional.id, payload);

        // Desativa o modo de edição após salvar com sucesso
        setEditMode(false);
      }

      onSave();

      // Só fecha o modal se estiver criando uma nova profissional
      if (isCreating) {
        onClose();
      }
    } catch (err: any) {
      console.error('Erro ao salvar profissional:', err);
      setError(err.message || 'Erro ao salvar alterações');
    } finally {
      setIsSaving(false);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!profissional || isCreating) return;

    setFormData(prev => ({ ...prev, status: newStatus }));

    try {
      await updateProfissional(profissional.id, { status: newStatus });
      // Atualiza localmente sem recarregar
    } catch (err) {
      console.error('Erro ao atualizar status:', err);
      // Reverte em caso de erro
      setFormData(prev => ({ ...prev, status: profissional.status || 'Ativa' }));
    }
  };

  // Funções para geração de documentos
  const generateTemplateDocument = (templateHtml: string, filename: string) => {
    setDocumentName(filename);
    setPreviewHtml(templateHtml);
    setPreviewOpen(true);
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
    const cleanFilename = `${documentName}_${(formData.nome || profissional?.nome || 'sem_nome').replace(/\s+/g, '_')}.pdf`;
    pdf.save(cleanFilename);
  };

  const generatePdf = () => {
    const titulo = `Ficha - ${formData.nome || profissional?.nome || 'Sem nome'}`;
    const now = new Date();
    const dateStr = now.toLocaleString('pt-BR');
    const accent = '#010d32';

    const hexToRgb = (hex: string) => {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
      } : { r: 0, g: 0, b: 0 };
    };

    const getContrast = (hex: string) => {
      const { r, g, b } = hexToRgb(hex);
      const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
      return yiq >= 128 ? '#000000' : '#ffffff';
    };

    const { r, g, b } = hexToRgb(accent);
    const accentText = getContrast(accent);
    const accentLight = `rgba(${r}, ${g}, ${b}, 0.12)`;

    const val = (v: any) => {
      if (v === null || v === undefined || v === '') return '-';
      return String(v).trim() || '-';
    };

    const yesNo = (v: string) => {
      if (!v || v === '') return 'Não informado';
      return v === 'Sim' ? 'Sim' : v === 'Não' ? 'Não' : v;
    };

    const nomeDisplay = val(formData.nome || profissional?.nome);
    const tipoDisplay = formData.tipo ? String(formData.tipo).toUpperCase() : '';

    const html = `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <title>${titulo}</title>
    <style>
      @page { size: A4; margin: 16mm; }
      * { box-sizing: border-box; }
      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
        color: #111827; background: #f7f9fb; line-height: 1.4;
      }
      h1 { margin: 0; }
      .container { width: 100%; }
      .page { padding: 16mm; }
      .header {
        background: ${accent}; color: ${accentText};
        padding: 18px; border-radius: 14px; margin-bottom: 18px;
        box-shadow: 0 6px 18px rgba(0,0,0,0.08);
        text-align: center;
      }
      .header h1 { font-size: 24px; font-weight: 800; letter-spacing: 0.2px; }
      .header p { font-size: 14px; opacity: 0.95; margin-top: 4px; }
      .section-title {
        font-size: 18px; font-weight: 700; color: #1f2937; margin: 16px 0 10px;
        padding-bottom: 6px; border-bottom: 2px solid ${accent};
      }
      .grid { display: grid; gap: 10px; }
      .grid-3 { grid-template-columns: repeat(3, 1fr); }
      .grid-2 { grid-template-columns: repeat(2, 1fr); }
      .grid-1 { grid-template-columns: 1fr; }
      .card {
        background: #ffffff; border-radius: 12px; padding: 12px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.06); border: 1px solid ${accentLight};
      }
      .label { font-size: 11px; font-weight: 700; color: #6b7280; text-transform: uppercase; }
      .value { font-size: 14px; font-weight: 600; color: #111827; word-break: break-word; }
      .address { padding: 12px; background: #ffffff; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.06); border: 1px solid ${accentLight}; }
      .two-col { display: grid; grid-template-columns: 1fr; gap: 12px; }
      .exp-colors-res { border: 1px solid ${accentLight}; }
      .exp-colors-com { border: 1px solid rgba(251,146,60,0.18); }
      .exp-title-res { color: ${accent}; }
      .exp-title-com { color: #9a3412; }
      .footer { margin-top: 18px; font-size: 12px; color: #6b7280; text-align: center; }
      .avoid-break { page-break-inside: avoid; }
      @media (min-width: 900px) {
        .grid-3 { grid-template-columns: repeat(3, 1fr); }
        .grid-2 { grid-template-columns: repeat(2, 1fr); }
        .two-col { grid-template-columns: 1fr 1fr; }
      }
    </style>
  </head>
  <body>
    <div class="container"><div class="page">
      <header class="header">
        <h1>${nomeDisplay}</h1>
        <p>Ficha de Cadastro Detalhada • Gerado em ${dateStr}</p>
      </header>

      <section class="avoid-break">
        <h2 class="section-title">Informações Pessoais</h2>
        <div class="grid grid-3">
          <div class="card"><div class="label">Data de Nascimento</div><div class="value">${val(formData.data_nasc)}</div></div>
          <div class="card"><div class="label">WhatsApp</div><div class="value">${val(formData.whatsapp)}</div></div>
          <div class="card"><div class="label">RG</div><div class="value">${val(formData.rg)}</div></div>
          <div class="card"><div class="label">CPF</div><div class="value">${val(formData.cpf)}</div></div>
          <div class="card"><div class="label">Estado Civil</div><div class="value">${val(formData.estado_civil)}</div></div>
          <div class="card"><div class="label">Fumante</div><div class="value">${yesNo(formData.fumante)}</div></div>
        </div>
        <div style="margin-top:12px">
          <div class="label" style="margin-bottom:6px">Endereço</div>
          <div class="address">${val(formData.endereco)}</div>
        </div>
      </section>

      <section class="avoid-break">
        <h2 class="section-title">Situação Familiar</h2>
        <div class="grid grid-3">
          <div class="card"><div class="label">Tem Filhos?</div><div class="value">${yesNo(formData.filhos)}</div></div>
          <div class="card"><div class="label">Quantidade de Filhos</div><div class="value">${val(formData.qto_filhos)}</div></div>
          <div class="card"><div class="label">Preferência</div><div class="value">${val(formData.preferencia)}</div></div>
        </div>
      </section>

      <section class="avoid-break">
        <h2 class="section-title">Informações Profissionais e Disponibilidade</h2>
        <div class="two-col">
          <div class="card">
            <div class="label">Situação Atual</div>
            <div class="value" style="font-size:16px; font-weight:800; margin:4px 0 8px;">${val(formData.sit_atual)}</div>
            <div class="label">Motivo do Cadastro</div>
            <div class="value">${val(formData.motivo_cadastro)}</div>
          </div>
          <div class="card">
            <div class="label">Dias da Semana</div>
            <div class="value" style="margin-bottom:6px">${val(formData.dias_semana)}</div>
            <div class="label">Dias Livres (Folga)</div>
            <div class="value" style="margin-bottom:6px">${val(formData.dias_livres)}</div>
            <div class="label">Transporte</div>
            <div class="value">${val(formData.transporte)}</div>
          </div>
        </div>
      </section>

      <section class="avoid-break">
        <h2 class="section-title">Experiências e Referências</h2>
        <div class="two-col">
          <div class="card exp-colors-res">
            <div style="font-size:16px; font-weight:800; margin-bottom:6px" class="exp-title-res">Residencial</div>
            <div class="label">Possui Experiência?</div>
            <div class="value" style="margin-bottom:6px">${val(formData.exp_residencial)}</div>
            <div class="label">Referência / Detalhes</div>
            <div class="value" style="font-style: italic">${val(formData.ref_residencial)}</div>
          </div>
          <div class="card exp-colors-com">
            <div style="font-size:16px; font-weight:800; margin-bottom:6px" class="exp-title-com">Comercial</div>
            <div class="label">Possui Experiência?</div>
            <div class="value" style="margin-bottom:6px">${val(formData.exp_comercial)}</div>
            <div class="label">Referência / Detalhes</div>
            <div class="value" style="font-style: italic">${val(formData.ref_comercial)}</div>
          </div>
        </div>
      </section>

      ${formData.observacao ? `
      <section class="avoid-break">
        <h2 class="section-title">Observações</h2>
        <div class="address">${val(formData.observacao)}</div>
      </section>` : ''}

      <footer class="footer">
        <div>DromeFlow${tipoDisplay ? ` • ${tipoDisplay}` : ''}${selectedUnit && (selectedUnit as any).name ? ` • ${(selectedUnit as any).name}` : ''}</div>
        <div>Documento gerado por IA</div>
      </footer>
    </div></div>
  </body>
</html>`;

    setPreviewOpen(true);
    setTimeout(() => {
      if (previewRef.current) {
        previewRef.current.innerHTML = html;
      }
    }, 0);
  };


  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4" onClick={onClose}>
        <div className="w-full max-w-4xl rounded-xl bg-bg-secondary shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
          {/* Header compacto com gradiente */}
          <div className="relative bg-gradient-to-r from-accent-primary/5 to-brand-cyan/5 border-b border-border-secondary px-5 py-3.5">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <div
                  className="h-4 w-4 rounded-full border-2 border-white shadow-md"
                  style={{ backgroundColor: '#4ade80' }}
                />
                <h2 className="text-lg font-bold text-text-primary">
                  {isCreating ? 'Nova Profissional' : (formData.nome || 'Profissional')}
                </h2>
                <div className="flex items-center gap-1.5 text-xs text-text-secondary">
                  <Icon name="building" className="w-3.5 h-3.5" />
                  <span>{unidade}</span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {/* Status ao lado do botão fechar */}
                {!isCreating && (
                  <label className="flex flex-col gap-1.5 min-w-[150px]">
                    <span className="text-xs font-medium text-text-secondary">Status</span>
                    <select
                      value={formData.status}
                      onChange={(e) => handleStatusChange(e.target.value)}
                      className="rounded-lg border border-border-secondary bg-bg-tertiary px-3 py-1.5 text-sm text-text-primary focus:border-accent-primary focus:outline-none focus:ring-2 focus:ring-accent-primary/20 transition-all"
                    >
                      <option value="Ativa">Ativa</option>
                      <option value="Inativa">Inativa</option>
                      <option value="Pendente">Pendente</option>
                    </select>
                  </label>
                )}

                <button
                  onClick={onClose}
                  className="text-text-secondary hover:text-text-primary hover:bg-bg-tertiary rounded-lg p-1.5 transition-colors mt-5"
                  aria-label="Fechar"
                  disabled={isSaving}
                >
                  <Icon name="X" className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>

          {/* Tabs - apenas no modo edição */}
          {!isCreating && (
            <div className="border-b border-border-secondary bg-bg-tertiary/30">
              <div className="flex items-center px-5">
                <button
                  onClick={() => setActiveTab('dados')}
                  className={`px-3 py-2.5 text-sm font-medium transition-colors ${activeTab === 'dados'
                    ? 'text-accent-primary border-b-2 border-accent-primary'
                    : 'text-text-secondary hover:text-text-primary'
                    }`}
                >
                  Dados
                </button>
                <button
                  onClick={() => setActiveTab('atendimentos')}
                  className={`px-3 py-2.5 text-sm font-medium transition-colors ${activeTab === 'atendimentos'
                    ? 'text-accent-primary border-b-2 border-accent-primary'
                    : 'text-text-secondary hover:text-text-primary'
                    }`}
                >
                  Atendimentos
                </button>
                <button
                  onClick={() => setActiveTab('observacao')}
                  className={`px-3 py-2.5 text-sm font-medium transition-colors ${activeTab === 'observacao'
                    ? 'text-accent-primary border-b-2 border-accent-primary'
                    : 'text-text-secondary hover:text-text-primary'
                    }`}
                >
                  Observação
                </button>
                <button
                  onClick={() => setActiveTab('documentos')}
                  className={`px-3 py-2.5 text-sm font-medium transition-colors ${activeTab === 'documentos'
                    ? 'text-accent-primary border-b-2 border-accent-primary'
                    : 'text-text-secondary hover:text-text-primary'
                    }`}
                >
                  Documentos
                </button>
                <button
                  onClick={() => setActiveTab('posvendas')}
                  className={`px-3 py-2.5 text-sm font-medium transition-colors ${activeTab === 'posvendas'
                    ? 'text-accent-primary border-b-2 border-accent-primary'
                    : 'text-text-secondary hover:text-text-primary'
                    }`}
                >
                  Pós-Venda
                </button>

                {/* Navegação de período para aba Atendimentos */}
                {activeTab === 'atendimentos' && (
                  <div className="ml-auto flex items-center gap-2">
                    <button
                      type="button"
                      className="rounded-md p-1.5 text-text-secondary hover:bg-bg-tertiary transition-colors"
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
                    >
                      <Icon name="ChevronLeft" className="w-4 h-4" />
                    </button>
                    <span className="text-xs text-text-secondary min-w-[140px] text-center font-medium">
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
                      className="rounded-md p-1.5 text-text-secondary hover:bg-bg-tertiary transition-colors"
                      title="Próximo mês"
                      onClick={() => {
                        if (!selectedPeriod || !/^\d{4}-\d{2}$/.test(selectedPeriod)) return;
                        const [y, m] = selectedPeriod.split('-').map(Number);
                        const d = new Date(Date.UTC(y, m - 1, 1));
                        d.setUTCMonth(d.getUTCMonth() + 1);
                        const ny = d.getUTCFullYear();
                        const nm = d.getUTCMonth() + 1;
                        const now = new Date();
                        const currentPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
                        const next = `${ny}-${String(nm).padStart(2, '0')}`;
                        if (next > currentPeriod) return;
                        setSelectedPeriod(next);
                      }}
                    >
                      <Icon name="ChevronRight" className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Body com scroll */}
          <div className="max-h-[65vh] overflow-y-auto px-5 py-3">
            {error && (
              <div className="mb-3 rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 flex items-start gap-2">
                <Icon name="alert" className="w-4 h-4 text-danger flex-shrink-0 mt-0.5" />
                <span className="text-xs text-danger">{error}</span>
              </div>
            )}

            {/* ABA DADOS */}
            {activeTab === 'dados' && (
              <div className="space-y-3">
                {/* Linha 1: Nome (4) | Data Nasc (3) | WhatsApp (3) */}
                <div className="grid grid-cols-1 md:grid-cols-10 gap-3">
                  <div className="md:col-span-4">
                    <label className="block text-xs font-medium text-text-secondary mb-1">
                      Nome <span className="text-danger">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.nome}
                      onChange={(e) => handleChange('nome', e.target.value)}
                      className="w-full rounded-md border border-border-secondary bg-bg-tertiary/50 px-3 py-1.5 text-sm text-text-primary focus:border-accent-primary focus:outline-none focus:ring-1 focus:ring-accent-primary/20 transition-all"
                      placeholder="Nome completo"
                      required
                      disabled={isSaving || (!isCreating && !editMode)}
                      readOnly={!isCreating && !editMode}
                    />
                  </div>
                  <div className="md:col-span-3">
                    <label className="block text-xs font-medium text-text-secondary mb-1">Data Nascimento</label>
                    <input
                      type="date"
                      value={formData.data_nasc}
                      onChange={(e) => handleChange('data_nasc', e.target.value)}
                      className="w-full rounded-md border border-border-secondary bg-bg-tertiary/50 px-3 py-1.5 text-sm text-text-primary focus:border-accent-primary focus:outline-none focus:ring-1 focus:ring-accent-primary/20 transition-all"
                      disabled={isSaving || (!isCreating && !editMode)}
                      readOnly={!isCreating && !editMode}
                    />
                  </div>
                  <div className="md:col-span-3">
                    <label className="block text-xs font-medium text-text-secondary mb-1">WhatsApp</label>
                    <input
                      type="text"
                      value={formData.whatsapp}
                      onChange={(e) => handleChange('whatsapp', e.target.value)}
                      className="w-full rounded-md border border-border-secondary bg-bg-tertiary/50 px-3 py-1.5 text-sm text-text-primary focus:border-accent-primary focus:outline-none focus:ring-1 focus:ring-accent-primary/20 transition-all"
                      placeholder="(00) 00000-0000"
                      disabled={isSaving || (!isCreating && !editMode)}
                      readOnly={!isCreating && !editMode}
                    />
                  </div>
                </div>

                {/* Linha 2: RG | CPF | Estado Civil | Tipo */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-text-secondary mb-1">RG</label>
                    <input
                      type="text"
                      value={formData.rg}
                      onChange={(e) => handleChange('rg', e.target.value)}
                      className="w-full rounded-md border border-border-secondary bg-bg-tertiary/50 px-3 py-1.5 text-sm text-text-primary focus:border-accent-primary focus:outline-none focus:ring-1 focus:ring-accent-primary/20 transition-all"
                      disabled={isSaving || (!isCreating && !editMode)}
                      readOnly={!isCreating && !editMode}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-text-secondary mb-1">CPF</label>
                    <input
                      type="text"
                      value={formData.cpf}
                      onChange={(e) => handleChange('cpf', e.target.value)}
                      className="w-full rounded-md border border-border-secondary bg-bg-tertiary/50 px-3 py-1.5 text-sm text-text-primary focus:border-accent-primary focus:outline-none focus:ring-1 focus:ring-accent-primary/20 transition-all"
                      placeholder="000.000.000-00"
                      disabled={isSaving || (!isCreating && !editMode)}
                      readOnly={!isCreating && !editMode}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-text-secondary mb-1">Estado Civil</label>
                    <input
                      type="text"
                      value={formData.estado_civil}
                      onChange={(e) => handleChange('estado_civil', e.target.value)}
                      className="w-full rounded-md border border-border-secondary bg-bg-tertiary/50 px-3 py-1.5 text-sm text-text-primary focus:border-accent-primary focus:outline-none focus:ring-1 focus:ring-accent-primary/20 transition-all"
                      disabled={isSaving || (!isCreating && !editMode)}
                      readOnly={!isCreating && !editMode}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-text-secondary mb-1">Tipo</label>
                    <input
                      type="text"
                      value={formData.tipo}
                      onChange={(e) => handleChange('tipo', e.target.value)}
                      className="w-full rounded-md border border-border-secondary bg-bg-tertiary/50 px-3 py-1.5 text-sm text-text-primary focus:border-accent-primary focus:outline-none focus:ring-1 focus:ring-accent-primary/20 transition-all"
                      disabled={isSaving || (!isCreating && !editMode)}
                      readOnly={!isCreating && !editMode}
                    />
                  </div>
                </div>

                {/* Linha 3: Endereço */}
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">Endereço</label>
                  <input
                    type="text"
                    value={formData.endereco}
                    onChange={(e) => handleChange('endereco', e.target.value)}
                    className="w-full rounded-md border border-border-secondary bg-bg-tertiary/50 px-3 py-1.5 text-sm text-text-primary focus:border-accent-primary focus:outline-none focus:ring-1 focus:ring-accent-primary/20 transition-all"
                    placeholder="Rua, número, bairro, cidade"
                    disabled={isSaving || (!isCreating && !editMode)}
                    readOnly={!isCreating && !editMode}
                  />
                </div>

                {/* Linha 4: Recado */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-text-secondary mb-1">Nome Recado</label>
                    <input
                      type="text"
                      value={formData.nome_recado}
                      onChange={(e) => handleChange('nome_recado', e.target.value)}
                      className="w-full rounded-md border border-border-secondary bg-bg-tertiary/50 px-3 py-1.5 text-sm text-text-primary focus:border-accent-primary focus:outline-none focus:ring-1 focus:ring-accent-primary/20 transition-all"
                      disabled={isSaving || (!isCreating && !editMode)}
                      readOnly={!isCreating && !editMode}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-text-secondary mb-1">Tel Recado</label>
                    <input
                      type="text"
                      value={formData.tel_recado}
                      onChange={(e) => handleChange('tel_recado', e.target.value)}
                      className="w-full rounded-md border border-border-secondary bg-bg-tertiary/50 px-3 py-1.5 text-sm text-text-primary focus:border-accent-primary focus:outline-none focus:ring-1 focus:ring-accent-primary/20 transition-all"
                      disabled={isSaving || (!isCreating && !editMode)}
                      readOnly={!isCreating && !editMode}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* ABA ATENDIMENTOS */}
            {activeTab === 'atendimentos' && (
              <div className="space-y-3">
                {loadingHist ? (
                  <div className="flex items-center justify-center py-6 text-text-secondary text-sm">
                    <Icon name="Loader2" className="w-4 h-4 animate-spin mr-2" />
                    Carregando…
                  </div>
                ) : history.length === 0 ? (
                  <div className="text-center py-6 text-text-secondary text-sm">
                    Nenhum atendimento neste período
                  </div>
                ) : (
                  <div className="overflow-auto border border-border-secondary rounded-md">
                    <table className="min-w-full text-sm">
                      <thead className="bg-bg-tertiary text-text-secondary">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-medium">ID</th>
                          <th className="px-3 py-2 text-left text-xs font-medium">Data</th>
                          <th className="px-3 py-2 text-left text-xs font-medium">Dia</th>
                          <th className="px-3 py-2 text-left text-xs font-medium">Cliente</th>
                          <th className="px-3 py-2 text-left text-xs font-medium">Período</th>
                          <th className="px-3 py-2 text-left text-xs font-medium">Pós-venda</th>
                        </tr>
                      </thead>
                      <tbody>
                        {history.map((h, idx) => {
                          const periodo = (h as any)['PERÍODO'] || (h as any)['PERIODO'];

                          return (
                            <tr
                              key={h.id || idx}
                              className="border-t border-border-secondary hover:bg-bg-tertiary/50 cursor-pointer transition-colors"
                              onDoubleClick={() => {
                                if (h.id) {
                                  handleOpenDetail(h.id);
                                }
                              }}
                              title="Duplo clique para ver detalhes"
                            >
                              <td className="px-3 py-2 text-text-primary font-mono text-xs">{h.ATENDIMENTO_ID || '-'}</td>
                              <td className="px-3 py-2 text-text-primary">
                                {h.DATA ? new Date(h.DATA + 'T00:00:00').toLocaleDateString('pt-BR') : '-'}
                              </td>
                              <td className="px-3 py-2 text-text-secondary">{h.DIA || '-'}</td>
                              <td className="px-3 py-2 text-text-primary">{h.CLIENTE || '-'}</td>
                              <td className="px-3 py-2 text-text-secondary">{periodo ? `${periodo} horas` : '-'}</td>
                              <td className="px-3 py-2">
                                <span className={`inline-block px-2 py-0.5 rounded text-xs ${(h['pos vendas'] || '').toLowerCase() === 'contatado' ? 'bg-success-color/20 text-success-color' :
                                  (h['pos vendas'] || '').toLowerCase() === 'pendente' ? 'bg-yellow-500/20 text-yellow-500' :
                                    (h['pos vendas'] || '').toLowerCase() === 'sim' ? 'bg-success-color/20 text-success-color' :
                                      (h['pos vendas'] || '').toLowerCase() === 'não' ? 'bg-danger/20 text-danger' :
                                        'text-text-tertiary'
                                  }`}>
                                  {h['pos vendas'] || '-'}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* ABA PÓS-VENDA */}
            {activeTab === 'posvendas' && (
              <div className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="p-3 bg-bg-tertiary rounded-lg border border-border-secondary text-center">
                    <div className="text-2xl font-bold text-text-primary">
                      {metrics.geral !== null ? `${(metrics.geral * 100).toFixed(0)}%` : '-'}
                    </div>
                    <div className="text-xs text-text-secondary mt-1">Geral</div>
                  </div>
                  <div className="p-3 bg-bg-tertiary rounded-lg border border-border-secondary text-center">
                    <div className="text-2xl font-bold text-text-primary">
                      {metrics.comercial !== null ? `${(metrics.comercial * 100).toFixed(0)}%` : '-'}
                    </div>
                    <div className="text-xs text-text-secondary mt-1">Comercial</div>
                  </div>
                  <div className="p-3 bg-bg-tertiary rounded-lg border border-border-secondary text-center">
                    <div className="text-2xl font-bold text-text-primary">
                      {metrics.residencial !== null ? `${(metrics.residencial * 100).toFixed(0)}%` : '-'}
                    </div>
                    <div className="text-xs text-text-secondary mt-1">Residencial</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 justify-center text-xs text-text-secondary">
                  <Icon name="info" className="w-3 h-3" />
                  <span>Percentual de clientes que responderam "SIM" no pós-venda</span>
                </div>
              </div>
            )}

            {/* ABA OBSERVAÇÃO */}
            {activeTab === 'observacao' && (
              <div className="space-y-3">
                {/* Contato de Recado */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-text-secondary mb-1 block">Nome Recado</label>
                    <input
                      type="text"
                      value={formData.nome_recado}
                      onChange={(e) => handleChange('nome_recado', e.target.value)}
                      className="w-full rounded-md border border-border-secondary bg-bg-tertiary/50 px-3 py-1.5 text-sm text-text-primary placeholder:text-text-tertiary focus:border-accent-primary focus:outline-none focus:ring-1 focus:ring-accent-primary/20 transition-all"
                      disabled={isSaving || (!isCreating && !editMode)}
                      readOnly={!isCreating && !editMode}
                      placeholder="Nome do contato para recados"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-text-secondary mb-1 block">Tel Recado</label>
                    <input
                      type="text"
                      value={formData.tel_recado}
                      onChange={(e) => handleChange('tel_recado', e.target.value)}
                      className="w-full rounded-md border border-border-secondary bg-bg-tertiary/50 px-3 py-1.5 text-sm text-text-primary placeholder:text-text-tertiary focus:border-accent-primary focus:outline-none focus:ring-1 focus:ring-accent-primary/20 transition-all"
                      disabled={isSaving || (!isCreating && !editMode)}
                      readOnly={!isCreating && !editMode}
                      placeholder="(00) 00000-0000"
                    />
                  </div>
                </div>

                {/* Observações */}
                <div>
                  <label className="text-xs font-medium text-text-secondary mb-1 block">Observações Gerais</label>
                  <textarea
                    value={formData.observacao}
                    onChange={(e) => handleChange('observacao', e.target.value)}
                    onBlur={handleAutoSaveObservacao}
                    rows={10}
                    className="w-full rounded-md border border-border-secondary bg-bg-tertiary/50 px-3 py-1.5 text-sm text-text-primary placeholder:text-text-tertiary focus:border-accent-primary focus:outline-none focus:ring-1 focus:ring-accent-primary/20 transition-all resize-none"
                    disabled={isSaving || autoSavingObs || (!isCreating && !editMode)}
                    readOnly={!isCreating && !editMode}
                    placeholder="Anotações importantes sobre a profissional..."
                  />
                </div>

                {autoSaveObsMsg && (
                  <div className={`flex items-center gap-2 text-xs ${autoSaveObsMsg.includes('Falha') ? 'text-danger' : 'text-success'}`}>
                    <Icon name={autoSaveObsMsg.includes('Falha') ? 'AlertCircle' : 'CheckCircle'} className="w-3 h-3" />
                    <span>{autoSaveObsMsg}</span>
                  </div>
                )}

                <div className="flex items-center gap-2 text-xs text-text-secondary">
                  <Icon name="info" className="w-3 h-3" />
                  <span>As alterações nas observações são salvas automaticamente ao sair do campo</span>
                </div>
              </div>
            )}

            {/* ABA DOCUMENTOS */}
            {activeTab === 'documentos' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-4 p-3 bg-bg-tertiary rounded-lg border border-border-secondary">
                  <div className="text-sm text-text-secondary">
                    Data de assinatura do contrato agenciamento:
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      value={formData.assinatura}
                      onChange={(e) => handleChange('assinatura', e.target.value)}
                      disabled={!editMode && !isCreating}
                      className="px-3 py-1.5 rounded bg-bg-secondary text-text-primary border border-border-secondary focus:outline-none text-sm disabled:opacity-50"
                    />
                  </div>
                </div>

                <div className="flex gap-3 overflow-x-auto pb-4 scrollbar-hide">

                  {/* Contrato de Agenciamento */}
                  <button
                    onClick={async () => {
                      if (!selectedUnit || (selectedUnit as any).id === 'ALL') {
                        alert('Por favor, selecione uma unidade específica.');
                        return;
                      }
                      const unit = selectedUnit as Unit;
                      const documentData = {
                        profissional: {
                          nome: formData.nome || '',
                          cpf: formData.cpf || '',
                          rg: formData.rg || '',
                          dataNascimento: formData.data_nasc || '',
                          estadoCivil: formData.estado_civil || '',
                          endereco: formData.endereco || '',
                          whatsapp: formData.whatsapp || '',
                          assinatura: formData.assinatura || '',
                        },
                        unidade: {
                          razaoSocial: unit.razao_social || '',
                          cnpj: unit.cnpj || '',
                          endereco: unit.endereco || (unit as any).address || '',
                          unitName: unit.unit_name || '',
                          unitCode: unit.unit_code || '',
                          responsavel: unit.responsavel || '',
                          contato: unit.contato || '',
                          email: unit.email || '',
                          uniformValue: (unit as any).uniform_value || (unit as any).uniformValue,
                        },
                        contrato: {
                          percentualProfissional: 55,
                          dataAssinatura: formData.assinatura ? new Date(formData.assinatura + 'T12:00:00').toLocaleDateString('pt-BR') : new Date().toLocaleDateString('pt-BR'),
                        },
                      };
                      try {
                        const html = await getDocumentTemplate(unit.id, 'contrato', documentData);
                        generateTemplateDocument(html, 'Contrato_Agenciamento');
                      } catch (error) {
                        console.error('[Contrato] Error loading template:', error);
                        const html = generateContratoHTML(documentData);
                        generateTemplateDocument(html, 'Contrato_Agenciamento');
                      }
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
                    onClick={async () => {
                      if (!selectedUnit || (selectedUnit as any).id === 'ALL') {
                        alert('Por favor, selecione uma unidade específica.');
                        return;
                      }
                      const unit = selectedUnit as Unit;
                      const documentData = {
                        profissional: {
                          nome: formData.nome || '',
                          cpf: formData.cpf || '',
                          rg: formData.rg || '',
                          dataNascimento: formData.data_nasc || '',
                          estadoCivil: formData.estado_civil || '',
                          endereco: formData.endereco || '',
                          whatsapp: formData.whatsapp || '',
                          assinatura: formData.assinatura || '',
                        },
                        unidade: {
                          razaoSocial: unit.razao_social || '',
                          cnpj: unit.cnpj || '',
                          endereco: unit.endereco || (unit as any).address || '',
                          unitName: unit.unit_name || '',
                          unitCode: unit.unit_code || '',
                          responsavel: unit.responsavel || '',
                          contato: unit.contato || '',
                          email: unit.email || '',
                          uniformValue: (unit as any).uniform_value || (unit as any).uniformValue,
                        },
                        contrato: {
                          percentualProfissional: 55,
                          dataAssinatura: formData.assinatura ? new Date(formData.assinatura + 'T12:00:00').toLocaleDateString('pt-BR') : new Date().toLocaleDateString('pt-BR'),
                        },
                      };
                      try {
                        const html = await getDocumentTemplate(unit.id, 'aditamento', documentData);
                        generateTemplateDocument(html, `Aditamento_${(formData.nome || 'sem_nome').replace(/\s+/g, '_')}`);
                      } catch (error) {
                        console.error('[Aditamento] Error loading template:', error);
                        const html = generateAditamentoHTML(documentData);
                        generateTemplateDocument(html, `Aditamento_${(formData.nome || 'sem_nome').replace(/\s+/g, '_')}`);
                      }
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
                    onClick={async () => {
                      if (!selectedUnit || (selectedUnit as any).id === 'ALL') {
                        alert('Por favor, selecione uma unidade específica.');
                        return;
                      }
                      const unit = selectedUnit as Unit;
                      const documentData = {
                        profissional: {
                          nome: formData.nome || '',
                          cpf: formData.cpf || '',
                          rg: formData.rg || '',
                          dataNascimento: formData.data_nasc || '',
                          estadoCivil: formData.estado_civil || '',
                          endereco: formData.endereco || '',
                          whatsapp: formData.whatsapp || '',
                          assinatura: formData.assinatura || '',
                        },
                        unidade: {
                          razaoSocial: unit.razao_social || '',
                          cnpj: unit.cnpj || '',
                          endereco: unit.endereco || (unit as any).address || '',
                          unitName: unit.unit_name || '',
                          unitCode: unit.unit_code || '',
                          responsavel: unit.responsavel || '',
                          contato: unit.contato || '',
                          email: unit.email || '',
                          uniformValue: (unit as any).uniform_value || (unit as any).uniformValue,
                        },
                      };
                      try {
                        const html = await getDocumentTemplate(unit.id, 'termo', documentData);
                        generateTemplateDocument(html, 'Termo_Confidencialidade');
                      } catch (error) {
                        console.error('[Termo] Error loading template:', error);
                        const html = generateTermoHTML(documentData);
                        generateTemplateDocument(html, 'Termo_Confidencialidade');
                      }
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
                    onClick={async () => {
                      if (!selectedUnit || (selectedUnit as any).id === 'ALL') {
                        alert('Por favor, selecione uma unidade específica.');
                        return;
                      }
                      const unit = selectedUnit as Unit;
                      const documentData = {
                        profissional: {
                          nome: formData.nome || '',
                          cpf: formData.cpf || '',
                          rg: formData.rg || '',
                          dataNascimento: formData.data_nasc || '',
                          estadoCivil: formData.estado_civil || '',
                          endereco: formData.endereco || '',
                          whatsapp: formData.whatsapp || '',
                          assinatura: formData.assinatura || '',
                        },
                        unidade: {
                          razaoSocial: unit.razao_social || '',
                          cnpj: unit.cnpj || '',
                          endereco: unit.endereco || (unit as any).address || '',
                          unitName: unit.unit_name || '',
                          unitCode: unit.unit_code || '',
                          responsavel: unit.responsavel || '',
                          contato: unit.contato || '',
                          email: unit.email || '',
                          uniformValue: (unit as any).uniform_value || (unit as any).uniformValue,
                        },
                      };
                      try {
                        const html = await getDocumentTemplate(unit.id, 'notificacao', documentData);
                        generateTemplateDocument(html, 'Notificacao_Rescisao');
                      } catch (error) {
                        console.error('[Notificação] Error loading template:', error);
                        const html = generateNotificacaoHTML(documentData);
                        generateTemplateDocument(html, 'Notificacao_Rescisao');
                      }
                    }}
                    className="flex-shrink-0 flex flex-col items-center gap-2 p-4 border border-border-secondary rounded-lg hover:bg-bg-tertiary hover:border-accent-primary/50 transition-all group min-w-[140px]"
                  >
                    <div className="w-12 h-12 rounded-lg bg-orange-500/10 flex items-center justify-center group-hover:bg-orange-500/20 transition-colors">
                      <Icon name="FileText" className="w-6 h-6 text-orange-500" />
                    </div>
                    <div className="text-sm font-medium text-text-primary text-center">Notificação</div>
                    <div className="text-xs text-text-secondary text-center">Rescisão</div>
                  </button>

                  {/* Distrato */}
                  <button
                    onClick={async () => {
                      if (!selectedUnit || (selectedUnit as any).id === 'ALL') {
                        alert('Por favor, selecione uma unidade específica.');
                        return;
                      }
                      const unit = selectedUnit as Unit;
                      const documentData = {
                        profissional: {
                          nome: formData.nome || '',
                          cpf: formData.cpf || '',
                          rg: formData.rg || '',
                          dataNascimento: formData.data_nasc || '',
                          estadoCivil: formData.estado_civil || '',
                          endereco: formData.endereco || '',
                          whatsapp: formData.whatsapp || '',
                        },
                        unidade: {
                          razaoSocial: unit.razao_social || '',
                          cnpj: unit.cnpj || '',
                          endereco: unit.endereco || (unit as any).address || '',
                          unitName: unit.unit_name || '',
                        },
                        contrato: {
                          dataAssinatura: formData.assinatura ? new Date(formData.assinatura + 'T12:00:00').toLocaleDateString('pt-BR') : new Date().toLocaleDateString('pt-BR'),
                        }
                      };
                      try {
                        const html = await getDocumentTemplate(unit.id, 'distrato', documentData);
                        generateTemplateDocument(html, 'Distrato_Parceria');
                      } catch (error) {
                        console.error('[Distrato] Error loading template:', error);
                        const html = generateDistratoHTML(documentData);
                        generateTemplateDocument(html, 'Distrato_Parceria');
                      }
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

          </div>

          {/* Footer compacto */}
          <div className="flex items-center justify-between border-t border-border-secondary bg-bg-tertiary px-5 py-3">
            <div className="flex items-center gap-1 text-xs text-text-secondary">
              <Icon name="info" className="w-3 h-3" />
              <span>
                {activeTab === 'dados' ? '* Obrigatório' : ''}
                {activeTab === 'atendimentos' ? 'Duplo clique para detalhes' : ''}
              </span>
            </div>

            {activeTab === 'dados' && (
              <button
                type="button"
                onClick={() => {
                  if (!isCreating && !editMode) {
                    setEditMode(true);
                  } else {
                    handleSubmit(new Event('submit') as any);
                  }
                }}
                disabled={isSaving || (editMode && !formData.nome.trim())}
                className="rounded-lg bg-accent-primary p-2.5 text-white hover:bg-accent-primary/90 focus:outline-none focus:ring-2 focus:ring-accent-primary transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-accent-primary/20"
                title={isSaving ? "Salvando..." : (!isCreating && !editMode) ? "Editar" : "Salvar"}
              >
                {isSaving ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                ) : (
                  <Icon name={(!isCreating && !editMode) ? "edit" : "Check"} className="w-4 h-4" />
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Modal de detalhe do atendimento */}
      {detailOpen && detailRecord && (
        <DataDetailModal
          isOpen={detailOpen}
          onClose={() => {
            setDetailOpen(false);
            setDetailRecord(null);
          }}
          record={detailRecord}
        />
      )}

      {/* Modal de Preview (A4) */}
      {previewOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 px-4" onClick={() => setPreviewOpen(false)}>
          <div className="bg-white rounded-lg shadow-xl w-full max-w-5xl h-[90vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-3 py-2 border-b">
              <div className="font-semibold text-sm">Pré-visualização (A4)</div>
              <div className="flex items-center gap-2">
                <button
                  onClick={printPreview}
                  className="p-2 rounded border border-border-secondary text-text-secondary hover:bg-bg-tertiary hover:text-text-primary transition-colors"
                  title="Imprimir"
                >
                  <Icon name="Printer" className="w-4 h-4" />
                </button>
                <button
                  onClick={downloadPreviewPdf}
                  className="px-3 py-1.5 rounded border border-border-secondary text-text-secondary hover:bg-bg-tertiary hover:text-text-primary text-sm font-medium transition-colors"
                  title="Baixar PDF"
                >
                  Baixar PDF
                </button>
                <button
                  onClick={() => setPreviewOpen(false)}
                  className="p-2 rounded border border-border-secondary text-text-secondary hover:bg-bg-tertiary hover:text-text-primary transition-colors"
                  title="Fechar"
                >
                  <Icon name="close" className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="flex-1 min-h-0 overflow-auto bg-gray-100">
              <div className="mx-auto my-4 bg-white shadow-sm" style={{ width: '210mm', minHeight: '297mm' }}>
                <div
                  ref={previewRef}
                  className="p-0"
                  dangerouslySetInnerHTML={{
                    __html: (previewHtml && previewHtml.includes('<!doctype html>'))
                      ? (() => {
                        const bodyMatch = previewHtml.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
                        const styleMatch = previewHtml.match(/<style[^>]*>([\s\S]*?)<\/style>/gi);
                        const styles = styleMatch ? styleMatch.join('\n') : '';
                        return styles + (bodyMatch ? bodyMatch[1] : previewHtml);
                      })()
                      : previewHtml
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
