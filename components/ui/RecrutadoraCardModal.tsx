import React, { useEffect, useMemo, useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { RecrutadoraCard, Unit } from '../../types';
import { Icon } from './Icon';
import { useAppContext } from '../../contexts/AppContext';
import { generateAditamentoHTML } from '../documents/utils/generateAditamentoHTML';
import { generateContratoHTML } from '../documents/utils/generateContratoHTML';
import { generateDistratoHTML } from '../documents/utils/generateDistratoHTML';
import { generateTermoHTML } from '../documents/utils/generateTermoHTML';
import { generateNotificacaoHTML } from '../documents/utils/generateNotificacaoHTML';
import { getDocumentTemplate } from '../documents/utils/templateHelpers';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  unidade: string;
  defaultStatus?: string; // usado na criação
  initialCard?: RecrutadoraCard | null; // se presente, edição
  onDelete?: (id: number) => Promise<void>;
  onCreate?: (payload: Partial<RecrutadoraCard>) => Promise<void>;
  onUpdate?: (id: number, payload: Partial<RecrutadoraCard>) => Promise<void>;
}

const RecrutadoraCardModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onSaved,
  unidade,
  defaultStatus,
  initialCard,
  onDelete,
  onCreate,
  onUpdate,
}) => {
  const isEditing = !!initialCard;
  const { selectedUnit } = useAppContext();
  const [editMode, setEditMode] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'pessoal' | 'profissional' | 'observacao' | 'documentos'>('pessoal');
  const colorInputRef = useRef<HTMLInputElement>(null);
  // campos básicos/visuais
  const [nome, setNome] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [color, setColor] = useState<string | null>('#4ade80');
  const [statusLabel, setStatusLabel] = useState<string | undefined>(undefined);
  // Pessoais
  const [dataNascimento, setDataNascimento] = useState<string>(''); // UI; envia em data_nasc
  const [fumante, setFumante] = useState<boolean | null>(null);
  const [estadoCivil, setEstadoCivil] = useState<string>('');
  const [filhos, setFilhos] = useState<boolean | null>(null);
  const [qtosFilhos, setQtosFilhos] = useState<number | ''>(''); // UI; envia em qto_filhos
  const [rotinaFilhos, setRotinaFilhos] = useState<string>('');
  const [endereco, setEndereco] = useState<string>(''); // UI; envia em endereço
  const [rg, setRg] = useState<string>('');
  const [cpf, setCpf] = useState<string>('');
  // Profissionais
  const [diasLivres, setDiasLivres] = useState<string>('');
  const [diasSemana, setDiasSemana] = useState<string>('');
  const [expResidencial, setExpResidencial] = useState<string>('');
  const [refResidencial, setRefResidencial] = useState<string>(''); // UI; envia em ref_residencial
  const [expComercial, setExpComercial] = useState<string>('');
  const [refComercial, setRefComercial] = useState<string>('');
  const [sitAtual, setSitAtual] = useState<string>('');
  const [motivoCadastro, setMotivoCadastro] = useState<string>(''); // UI; envia em motivo_cadastro
  const [transporte, setTransporte] = useState<string>('');
  const [assinatura, setAssinatura] = useState<string>(''); // Data de assinatura do contrato
  // Observação
  const [observacao, setObservacao] = useState<string>('');
  // Histórico removido
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  // Auto-save observação
  const [autoSavingObs, setAutoSavingObs] = useState(false);
  const [autoSaveObsMsg, setAutoSaveObsMsg] = useState<string | null>(null);
  const prevObservacaoRef = useRef<string>('');
  const [previewOpen, setPreviewOpen] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);
  const [documentName, setDocumentName] = useState<string>('Ficha');
  const [previewHtml, setPreviewHtml] = useState<string>('');
  // Document Editor Modal
  const [editorModalOpen, setEditorModalOpen] = useState(false);
  const [editorTemplateName, setEditorTemplateName] = useState<'aditamento' | 'contrato' | 'termo'>('aditamento');
  // Auto-save de Status
  const [autoSavingStatus, setAutoSavingStatus] = useState(false);
  const [autoSaveStatusMsg, setAutoSaveStatusMsg] = useState<string | null>(null);
  // Disponibilidade de documentos
  const [availableDocuments, setAvailableDocuments] = useState<Set<string>>(new Set(['aditamento', 'contrato', 'termo', 'notificacao', 'distrato']));

  useEffect(() => {
    if (!isOpen) return;
    setErr(null);
    setSaving(false);
    setActiveTab('pessoal');
    setStatusLabel(initialCard ? initialCard.status : defaultStatus);
    setEditMode(initialCard ? false : true);
    if (initialCard) {
      setNome(initialCard.nome || '');
      setWhatsapp(initialCard.whatsapp || '');
      setColor(initialCard.color_card || '#4ade80');
      // pessoais
      setDataNascimento(initialCard.data_nasc || initialCard.data_nascimento || '');
      setFumante(initialCard.fumante ?? null);
      setEstadoCivil(initialCard.estado_civil || '');
      setFilhos(initialCard.filhos ?? null);
      {
        const raw = (initialCard.qto_filhos ?? (initialCard as any).qtos_filhos) as any;
        if (raw === null || raw === undefined || raw === '') {
          setQtosFilhos('');
        } else {
          const n = Number(raw);
          setQtosFilhos(isNaN(n) ? '' : n);
        }
      }
      setRotinaFilhos(initialCard.rotina_filhos || '');
      setEndereco((initialCard.endereco as any) || (initialCard['endereço'] as any) || '');
      setRg(initialCard.rg || '');
      setCpf(initialCard.cpf || '');
      // profissionais
      setDiasLivres(initialCard.dias_livres || '');
      setDiasSemana(initialCard.dias_semana || '');
      setExpResidencial(initialCard.exp_residencial || '');
      setRefResidencial(initialCard.ref_residencial || (initialCard as any).ref_redidencial || '');
      setExpComercial(initialCard.exp_comercial || '');
      setRefComercial(initialCard.ref_comercial || '');
      setSitAtual(initialCard.sit_atual || '');
      setMotivoCadastro(initialCard.motivo_cadastro || (initialCard as any).motivo_cadstro || '');
      setTransporte(initialCard.transporte || '');
      setAssinatura(initialCard.assinatura || '');
      // observação
      setObservacao(initialCard.observacao || '');
      prevObservacaoRef.current = initialCard.observacao || '';
      // histórico removido
    } else {
      setNome('');
      setWhatsapp('');
      setColor('#4ade80');
      setDataNascimento('');
      setFumante(null);
      setEstadoCivil('');
      setFilhos(null);
      setQtosFilhos('');
      setRotinaFilhos('');
      setEndereco('');
      setRg('');
      setCpf('');
      setDiasLivres('');
      setDiasSemana('');
      setExpResidencial('');
      setRefResidencial('');
      setExpComercial('');
      setRefComercial('');
      setSitAtual('');
      setMotivoCadastro('');
      setTransporte('');
      setObservacao('');
      prevObservacaoRef.current = '';
      // histórico removido
    }
  }, [isOpen, initialCard, defaultStatus]);

  // Auto-save debounced para observação
  useEffect(() => {
    if (!initialCard || !onUpdate || !isOpen) return;
    if (observacao === prevObservacaoRef.current) return;

    const timeoutId = setTimeout(() => {
      handleAutoSaveObservacao();
    }, 1200);

    return () => clearTimeout(timeoutId);
  }, [observacao, initialCard, onUpdate, isOpen]);

  // Carrega disponibilidade de documentos
  useEffect(() => {
    if (!isOpen || !selectedUnit || typeof selectedUnit === 'string' || selectedUnit.id === 'ALL') return;

    const loadDocumentAvailability = async () => {
      try {
        const { documentTemplatesService } = await import('../../services/documentTemplates.service');
        const templates = ['aditamento', 'contrato', 'termo', 'notificacao', 'distrato'] as const;
        const available = new Set<string>();

        for (const templateName of templates) {
          try {
            const template = await documentTemplatesService.getTemplate(selectedUnit.id, templateName);
            // Verifica se o template está disponível para recrutadora
            if (template && template.available_in && template.available_in.includes('recrutadora')) {
              available.add(templateName);
            } else if (template && !template.available_in) {
              // Se não tem available_in, assume que está disponível (backward compatibility)
              available.add(templateName);
            }
          } catch (error) {
            // Se não encontrar template, assume que está disponível (usará fallback)
            available.add(templateName);
          }
        }

        setAvailableDocuments(available);
        console.log('[RecrutadoraCardModal] Available documents for recrutadora:', Array.from(available));
      } catch (error) {
        console.error('[RecrutadoraCardModal] Error loading document availability:', error);
        // Em caso de erro, mantém todos disponíveis
        setAvailableDocuments(new Set(['aditamento', 'contrato', 'termo', 'notificacao', 'distrato']));
      }
    };

    loadDocumentAvailability();
  }, [isOpen, selectedUnit]);

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    setErr(null);
    try {
      const payload: Partial<RecrutadoraCard> = {
        nome,
        whatsapp,
        color_card: color,
        data_nasc: dataNascimento || null,
        fumante: fumante === null ? null : (fumante ? 'sim' : 'nao') as any,
        estado_civil: estadoCivil || null,
        filhos: filhos === null ? null : (filhos ? 'sim' : 'nao') as any,
        qto_filhos: qtosFilhos === '' ? null : Number(qtosFilhos),
        rotina_filhos: rotinaFilhos || null,
        ['endereço']: endereco || null as any,
        rg: rg || null,
        cpf: cpf || null,
        dias_livres: diasLivres || null,
        dias_semana: diasSemana || null,
        exp_residencial: expResidencial || null,
        ref_residencial: refResidencial || null,
        exp_comercial: expComercial || null,
        ref_comercial: refComercial || null,
        sit_atual: sitAtual || null,
        motivo_cadastro: motivoCadastro || null,
        transporte: transporte || null,
        assinatura: assinatura || null,
        observacao: observacao || null,
        status: (statusLabel as any) || undefined,
      };
      if (isEditing && initialCard && onUpdate) {
        await onUpdate(initialCard.id, payload);
      } else if (!isEditing && onCreate && defaultStatus) {
        await onCreate({ ...payload, status: (statusLabel as any) || defaultStatus, unidade });
      }
      onSaved();
      onClose();
    } catch (e: any) {
      setErr(e.message || 'Falha ao salvar');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!isEditing || !initialCard || !onDelete || saving) return;
    if (!confirm('Excluir este card?')) return;
    setSaving(true);
    setErr(null);
    try {
      await onDelete(initialCard.id);
      onSaved();
      onClose();
    } catch (e: any) {
      setErr(e.message || 'Falha ao excluir');
    } finally {
      setSaving(false);
    }
  };

  const handleAutoSaveObservacao = async () => {
    // Auto-save apenas para cards existentes (evita criar registro ao sair do campo)
    if (!initialCard || !onUpdate) return;
    // Evita salvar quando não houve mudança
    if (observacao === prevObservacaoRef.current) return;
    if (autoSavingObs) return;
    setAutoSavingObs(true);
    setAutoSaveObsMsg(null);
    try {
      await onUpdate(initialCard.id, { observacao });
      prevObservacaoRef.current = observacao;
      setAutoSaveObsMsg('Observação salva');
      // Notifica o pai para atualizar o Kanban (que mostra a primeira linha da obs)
      onSaved();
      setTimeout(() => setAutoSaveObsMsg(null), 2000);
    } catch (e) {
      // feedback discreto sem bloquear o usuário
      setAutoSaveObsMsg('Falha ao salvar');
      setTimeout(() => setAutoSaveObsMsg(null), 2500);
    } finally {
      setAutoSavingObs(false);
    }
  };

  const handleStatusChange = async (value: string) => {
    const newStatus = value || '';
    setStatusLabel(newStatus || undefined);
    // Auto-save somente para cards existentes
    if (!initialCard || !onUpdate) return;
    if (autoSavingStatus) return;
    setAutoSavingStatus(true);
    setAutoSaveStatusMsg(null);
    try {
      await onUpdate(initialCard.id, { status: (newStatus || null) as any });
      setAutoSaveStatusMsg('Status salvo');
      // Notifica o pai para recarregar (mover coluna no Kanban, etc.)
      onSaved();
      setTimeout(() => setAutoSaveStatusMsg(null), 2000);
    } catch (e) {
      setAutoSaveStatusMsg('Falha ao salvar status');
      setTimeout(() => setAutoSaveStatusMsg(null), 2500);
    } finally {
      setAutoSavingStatus(false);
    }
  };

  const handleColorDotClick = () => {
    if (!colorInputRef.current) return;
    // Se estiver visualizando um card existente, ativar modo edição antes de escolher a cor
    if (!editMode && initialCard) {
      setEditMode(true);
      // aguarda próxima pintura para garantir que input exista e então dispara o click
      requestAnimationFrame(() => colorInputRef.current?.click());
    } else {
      colorInputRef.current.click();
    }
  };

  const toDisplay = (v: any) => {
    if (v === null || v === undefined) return '-';
    const s = String(v).trim();
    return s === '' ? '-' : s;
  };

  // Função para gerar PDF de templates HTML usando o modal de preview (igual à Ficha)
  const generateTemplateDocument = (templateHtml: string, filename: string) => {
    // Define o nome do documento para o download
    setDocumentName(filename);
    // Armazena o HTML completo no estado para o preview e para as funções de impressão/PDF
    setPreviewHtml(templateHtml);
    // Abre o modal de pré-visualização
    setPreviewOpen(true);
  };

  const generatePdf = () => {
    setDocumentName('Ficha'); // Define nome do documento
    const titulo = `Ficha - ${nome || initialCard?.nome || 'Sem nome'}`;
    const now = new Date();
    const dateStr = now.toLocaleString('pt-BR');
    // Força o PDF a usar o azul escuro do Sidebar, independente da cor do card
    const accent = '#010d32';

    // Helpers de cor para contraste e variações claras
    const hexToRgb = (hex: string) => {
      const h = hex.replace('#', '');
      const bigint = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
      const r = (bigint >> 16) & 255;
      const g = (bigint >> 8) & 255;
      const b = bigint & 255;
      return { r, g, b };
    };
    const getContrast = (hex: string) => {
      const { r, g, b } = hexToRgb(hex);
      // YIQ luma
      const yiq = (r * 299 + g * 587 + b * 114) / 1000;
      return yiq >= 140 ? '#111827' : '#ffffff';
    };
    const { r, g, b } = hexToRgb(accent);
    const accentText = getContrast(accent);
    const accentLight = `rgba(${r}, ${g}, ${b}, 0.12)`;

    const val = (v: any) => {
      if (v === null || v === undefined) return 'Não informado';
      const s = String(v).trim();
      return s === '' ? 'Não informado' : s;
    };
    const yesNo = (v: boolean | null) => v === null ? 'Não informado' : (v ? 'Sim' : 'Não');
    const filhosQtde = qtosFilhos === '' ? 'Não informado' : String(qtosFilhos);

    const nomeDisplay = val(nome || initialCard?.nome);
    const statusDisplay = statusLabel ? String(statusLabel).toUpperCase() : '';

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

      /* Quebra de página segura */
      .avoid-break { page-break-inside: avoid; }

      /* Responsivo para impressão/preview no navegador */
      @media (min-width: 900px) {
        .grid-3 { grid-template-columns: repeat(3, 1fr); }
        .grid-2 { grid-template-columns: repeat(2, 1fr); }
        .two-col { grid-template-columns: 1fr 1fr; }
      }
    </style>
  </head>
  <body>
  <div class="container"><div class="page">
      <!-- Cabeçalho -->
      <header class="header">
        <h1>${nomeDisplay}</h1>
        <p>Ficha de Cadastro Detalhada • Gerado em ${dateStr}</p>
      </header>

      <!-- Informações Pessoais -->
      <section class="avoid-break">
        <h2 class="section-title">Informações Pessoais</h2>
        <div class="grid grid-3">
          <div class="card"><div class="label">Data de Nascimento</div><div class="value">${val(dataNascimento)}</div></div>
          <div class="card"><div class="label">WhatsApp</div><div class="value">${val(whatsapp)}</div></div>
          <div class="card"><div class="label">RG</div><div class="value">${val(rg)}</div></div>
          <div class="card"><div class="label">CPF</div><div class="value">${val(cpf)}</div></div>
          <div class="card"><div class="label">Estado Civil</div><div class="value">${val(estadoCivil)}</div></div>
          <div class="card"><div class="label">Fumante</div><div class="value">${yesNo(fumante)}</div></div>
        </div>
        <div style="margin-top:12px">
          <div class="label" style="margin-bottom:6px">Endereço</div>
          <div class="address">${val(endereco)}</div>
        </div>
      </section>

      <!-- Situação Familiar -->
      <section class="avoid-break">
        <h2 class="section-title">Situação Familiar</h2>
        <div class="grid grid-3">
          <div class="card"><div class="label">Tem Filhos?</div><div class="value">${yesNo(filhos)}</div></div>
          <div class="card"><div class="label">Quantidade de Filhos</div><div class="value">${filhosQtde}</div></div>
          <div class="card"><div class="label">Rotina dos Filhos</div><div class="value">${val(rotinaFilhos)}</div></div>
        </div>
      </section>

      <!-- Profissional e Disponibilidade -->
      <section class="avoid-break">
        <h2 class="section-title">Informações Profissionais e Disponibilidade</h2>
        <div class="two-col">
          <div class="card">
            <div class="label">Status Atual</div>
            <div class="value" style="font-size:16px; font-weight:800; margin:4px 0 8px;">${val(sitAtual)}</div>
            <div class="label">Motivo do Cadastro</div>
            <div class="value">${val(motivoCadastro)}</div>
          </div>
          <div class="card">
            <div class="label">Dias da Semana</div>
            <div class="value" style="margin-bottom:6px">${val(diasSemana)}</div>
            <div class="label">Dias Livres (Folga)</div>
            <div class="value" style="margin-bottom:6px">${val(diasLivres)}</div>
            <div class="label">Transporte</div>
            <div class="value">${val(transporte)}</div>
          </div>
        </div>
      </section>

      <!-- Experiências e Referências -->
      <section class="avoid-break">
        <h2 class="section-title">Experiências e Referências</h2>
        <div class="two-col">
          <div class="card exp-colors-res">
            <div style="font-size:16px; font-weight:800; margin-bottom:6px" class="exp-title-res">Residencial</div>
            <div class="label">Possui Experiência?</div>
            <div class="value" style="margin-bottom:6px">${val(expResidencial)}</div>
            <div class="label">Referência / Detalhes</div>
            <div class="value" style="font-style: italic">${val(refResidencial)}</div>
          </div>
          <div class="card exp-colors-com">
            <div style="font-size:16px; font-weight:800; margin-bottom:6px" class="exp-title-com">Comercial</div>
            <div class="label">Possui Experiência?</div>
            <div class="value" style="margin-bottom:6px">${val(expComercial)}</div>
            <div class="label">Referência / Detalhes</div>
            <div class="value" style="font-style: italic">${val(refComercial)}</div>
          </div>
        </div>
      </section>

      <!-- Rodapé -->
      <footer class="footer">
        <div>DromeFlow${statusDisplay ? ` • ${statusDisplay}` : ''}${unidade ? ` • ${unidade}` : ''}</div>
        <div>Documento gerado por IA</div>
      </footer>
    </div></div>
  </body>
</html>`;

    // Abre o modal de pré-visualização e injeta o HTML
    setPreviewOpen(true);
    setTimeout(() => {
      const el = previewRef.current;
      if (el) el.innerHTML = html;
    }, 0);
  };

  const printPreview = () => {
    if (!previewRef.current) return;
    // Abre uma janela temporária para imprimir o conteúdo do preview mantendo estilos inline
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
    const target = container as HTMLElement;

    // A4 em px a 96 DPI ~= 794 x 1123, mas usaremos jsPDF para A4 mm
    const canvas = await html2canvas(target as HTMLElement, {
      scale: window.devicePixelRatio || 2,
      useCORS: true,
      backgroundColor: '#ffffff'
    });
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    // Calcula dimensões mantendo proporção
    const imgWidth = pageWidth;
    const imgHeight = canvas.height * (imgWidth / canvas.width);
    let y = 0;
    if (imgHeight <= pageHeight) {
      pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight, undefined, 'FAST');
    } else {
      // Quebra em páginas
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
    const filename = `${documentName}_${(nome || initialCard?.nome || 'sem_nome').replace(/\s+/g, '_')}.pdf`;
    pdf.save(filename);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4" onClick={onClose}>
      <div className="w-full max-w-3xl rounded-xl bg-bg-secondary shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {/* Header compacto com gradiente */}
        <div className="relative bg-gradient-to-r from-accent-primary/5 to-brand-cyan/5 border-b border-border-secondary px-5 py-3.5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleColorDotClick}
                disabled={saving}
                className="inline-block h-4 w-4 rounded-full border-2 border-white shadow-md cursor-pointer hover:scale-110 transition-transform"
                style={{ backgroundColor: (color || initialCard?.color_card || '#4ade80') as string }}
                aria-label="Alterar cor do card"
                title="Alterar cor do card"
              />
              <h2 className="text-lg font-bold text-text-primary">
                {isEditing ? (nome || 'Recrutadora') : 'Nova Recrutadora'}
              </h2>
              <div className="flex items-center gap-1.5 text-xs text-text-secondary">
                <Icon name="building" className="w-3.5 h-3.5" />
                <span>{unidade}</span>
              </div>
              {isEditing && initialCard && (
                <div className="flex items-center gap-1.5 text-xs text-text-secondary">
                  <Icon name="hash" className="w-3.5 h-3.5" />
                  <span>ID: {initialCard.id}</span>
                </div>
              )}
              {/* Input color oculto */}
              <input
                ref={colorInputRef}
                type="color"
                value={color || '#4ade80'}
                onChange={(e) => setColor(e.target.value)}
                className="sr-only"
                aria-hidden="true"
                tabIndex={-1}
              />
            </div>

            <div className="flex items-center gap-3">
              {/* Status ao lado do botão fechar */}
              <label className="flex flex-col gap-1.5 min-w-[180px]">
                <span className="text-xs font-medium text-text-secondary">Status</span>
                <select
                  value={statusLabel || ''}
                  onChange={(e) => handleStatusChange(e.target.value)}
                  className="rounded-lg border border-border-secondary bg-bg-tertiary px-3 py-1.5 text-sm text-text-primary focus:border-accent-primary focus:outline-none focus:ring-2 focus:ring-accent-primary/20 transition-all"
                >
                  <option value="">-</option>
                  <option value="qualificadas">Qualificadas</option>
                  <option value="contato">Contato</option>
                  <option value="envio_doc">Envio dos Documentos</option>
                  <option value="truora">Truora</option>
                  <option value="treinamento">Treinamento</option>
                  <option value="ativo">Ativo</option>
                  <option value="finalizado">Finalizado</option>
                  <option value="nao_aprovadas">Não Aprovadas</option>
                  <option value="desistentes">Desistentes</option>
                </select>
              </label>

              <button
                onClick={onClose}
                className="text-text-secondary hover:text-text-primary hover:bg-bg-tertiary rounded-lg p-1.5 transition-colors mt-5"
                aria-label="Fechar"
                disabled={saving}
              >
                <Icon name="X" className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-border-secondary bg-bg-tertiary/30">
          <div className="flex items-center px-5">
            <button
              onClick={() => setActiveTab('pessoal')}
              className={`px-3 py-2.5 text-sm font-medium transition-colors ${activeTab === 'pessoal'
                ? 'text-accent-primary border-b-2 border-accent-primary'
                : 'text-text-secondary hover:text-text-primary'
                }`}
            >
              Dados Pessoais
            </button>
            <button
              onClick={() => setActiveTab('profissional')}
              className={`px-3 py-2.5 text-sm font-medium transition-colors ${activeTab === 'profissional'
                ? 'text-accent-primary border-b-2 border-accent-primary'
                : 'text-text-secondary hover:text-text-primary'
                }`}
            >
              Profissional
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
          </div>
        </div>

        {/* Body com scroll */}
        <div className="max-h-[55vh] overflow-y-auto px-5 py-3">
          {err && (
            <div className="mb-3 rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 flex items-start gap-2">
              <Icon name="alert" className="w-4 h-4 text-danger flex-shrink-0 mt-0.5" />
              <span className="text-xs text-danger">{err}</span>
            </div>
          )}

          {/* Conteúdo das abas */}
          {activeTab === 'pessoal' && (
            <div className="space-y-2.5">
              {!editMode ? (
                <>
                  {/* Linha 1: Nome | Data Nascimento | WhatsApp */}
                  <div className="grid grid-cols-1 md:grid-cols-10 gap-2.5">
                    <div className="md:col-span-4">
                      <div className="text-xs text-text-secondary mb-1">Nome</div>
                      <div className="border border-border-secondary rounded-md p-2 bg-bg-tertiary/30 text-sm text-text-primary">{nome || '-'}</div>
                    </div>
                    <div className="md:col-span-3">
                      <div className="text-xs text-text-secondary mb-1">Data Nascimento</div>
                      <div className="border border-border-secondary rounded-md p-2 bg-bg-tertiary/30 text-sm text-text-primary">{dataNascimento || '-'}</div>
                    </div>
                    <div className="md:col-span-3">
                      <div className="text-xs text-text-secondary mb-1">WhatsApp</div>
                      <div className="border border-border-secondary rounded-md p-2 bg-bg-tertiary/30 text-sm text-text-primary">{whatsapp || '-'}</div>
                    </div>
                  </div>
                  {/* Linha 2: RG | CPF | Estado Civil | Fumante */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-2.5">
                    <div>
                      <div className="text-xs text-text-secondary mb-1">RG</div>
                      <div className="border border-border-secondary rounded-md p-2 bg-bg-tertiary/30 text-sm text-text-primary">{rg || '-'}</div>
                    </div>
                    <div>
                      <div className="text-xs text-text-secondary mb-1">CPF</div>
                      <div className="border border-border-secondary rounded-md p-2 bg-bg-tertiary/30 text-sm text-text-primary">{cpf || '-'}</div>
                    </div>
                    <div>
                      <div className="text-xs text-text-secondary mb-1">Estado Civil</div>
                      <div className="border border-border-secondary rounded-md p-2 bg-bg-tertiary/30 text-sm text-text-primary">{estadoCivil || '-'}</div>
                    </div>
                    <div>
                      <div className="text-xs text-text-secondary mb-1">Fumante</div>
                      <div className="border border-border-secondary rounded-md p-2 bg-bg-tertiary/30 text-sm text-text-primary">{fumante === null ? '-' : (fumante ? 'Sim' : 'Não')}</div>
                    </div>
                  </div>
                  {/* Linha 3: Endereço (terceira linha) */}
                  <div>
                    <div className="text-xs text-text-secondary mb-1">Endereço</div>
                    <div className="border border-border-secondary rounded-md p-2 bg-bg-tertiary/30 text-sm text-text-primary">{endereco || '-'}</div>
                  </div>
                  {/* Linha 4: Tem filhos? | Qtde. filhos | Rotina filhos */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                    <div>
                      <div className="text-xs text-text-secondary mb-1">Tem filhos?</div>
                      <div className="border border-border-secondary rounded-md p-2 bg-bg-tertiary/30 text-sm text-text-primary">{filhos === null ? '-' : (filhos ? 'Sim' : 'Não')}</div>
                    </div>
                    <div>
                      <div className="text-xs text-text-secondary mb-1">Qtde. filhos</div>
                      <div className="border border-border-secondary rounded-md p-2 bg-bg-tertiary/30 text-sm text-text-primary">{qtosFilhos === '' ? '-' : qtosFilhos}</div>
                    </div>
                    <div>
                      <div className="text-xs text-text-secondary mb-1">Rotina filhos</div>
                      <div className="border border-border-secondary rounded-md p-2 bg-bg-tertiary/30 text-sm text-text-primary">{rotinaFilhos || '-'}</div>
                    </div>
                  </div>
                  {/* Cor do Card removido: edição via dot no título */}
                </>
              ) : (
                <>
                  {/* Linha 1: Nome | Data Nascimento | WhatsApp */}
                  <div className="grid grid-cols-1 md:grid-cols-10 gap-2.5">
                    <div className="md:col-span-4">
                      <label className="block text-sm mb-1 text-text-secondary">Nome</label>
                      <input type="text" value={nome} onChange={(e) => setNome(e.target.value)} className="w-full px-3 py-1.5 rounded bg-bg-tertiary text-text-primary border border-border-secondary focus:outline-none" placeholder="Nome da candidata(o)" />
                    </div>
                    <div className="md:col-span-3">
                      <label className="block text-sm mb-1 text-text-secondary">Data Nascimento</label>
                      <input type="date" value={dataNascimento} onChange={(e) => setDataNascimento(e.target.value)} className="w-full px-3 py-1.5 rounded bg-bg-tertiary text-text-primary border border-border-secondary focus:outline-none" />
                    </div>
                    <div className="md:col-span-3">
                      <label className="block text-sm mb-1 text-text-secondary">WhatsApp</label>
                      <input type="text" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} className="w-full px-3 py-1.5 rounded bg-bg-tertiary text-text-primary border border-border-secondary focus:outline-none" placeholder="55999990000" />
                    </div>
                  </div>
                  {/* Linha 2: RG | CPF | Estado Civil | Fumante */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-2.5">
                    <div>
                      <label className="block text-sm mb-1 text-text-secondary">RG</label>
                      <input type="text" value={rg} onChange={(e) => setRg(e.target.value)} className="w-full px-3 py-1.5 rounded bg-bg-tertiary text-text-primary border border-border-secondary focus:outline-none" />
                    </div>
                    <div>
                      <label className="block text-sm mb-1 text-text-secondary">CPF</label>
                      <input type="text" value={cpf} onChange={(e) => setCpf(e.target.value)} className="w-full px-3 py-1.5 rounded bg-bg-tertiary text-text-primary border border-border-secondary focus:outline-none" />
                    </div>
                    <div>
                      <label className="block text-sm mb-1 text-text-secondary">Estado Civil</label>
                      <input type="text" value={estadoCivil} onChange={(e) => setEstadoCivil(e.target.value)} className="w-full px-3 py-1.5 rounded bg-bg-tertiary text-text-primary border border-border-secondary focus:outline-none" placeholder="Solteira(o), Casada(o), ..." />
                    </div>
                    <div>
                      <label className="block text-sm mb-1 text-text-secondary">Fumante</label>
                      <select value={fumante === null ? '' : fumante ? 'sim' : 'nao'} onChange={(e) => setFumante(e.target.value === '' ? null : e.target.value === 'sim')} className="w-full px-3 py-1.5 rounded bg-bg-tertiary text-text-primary border border-border-secondary focus:outline-none">
                        <option value="">-</option>
                        <option value="sim">Sim</option>
                        <option value="nao">Não</option>
                      </select>
                    </div>
                  </div>
                  {/* Linha 3: Endereço (terceira linha) */}
                  <div>
                    <label className="block text-sm mb-1 text-text-secondary">Endereço</label>
                    <input type="text" value={endereco} onChange={(e) => setEndereco(e.target.value)} className="w-full px-3 py-1.5 rounded bg-bg-tertiary text-text-primary border border-border-secondary focus:outline-none" placeholder="Rua, número, bairro, cidade" />
                  </div>
                  {/* Linha 4: Tem filhos? | Qtde. filhos | Rotina filhos */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                    <div>
                      <label className="block text-sm mb-1 text-text-secondary">Tem filhos?</label>
                      <select value={filhos === null ? '' : filhos ? 'sim' : 'nao'} onChange={(e) => setFilhos(e.target.value === '' ? null : e.target.value === 'sim')} className="w-full px-3 py-1.5 rounded bg-bg-tertiary text-text-primary border border-border-secondary focus:outline-none">
                        <option value="">-</option>
                        <option value="sim">Sim</option>
                        <option value="nao">Não</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm mb-1 text-text-secondary">Qtde. filhos</label>
                      <input type="number" min={0} value={qtosFilhos} onChange={(e) => setQtosFilhos(e.target.value === '' ? '' : Number(e.target.value))} className="w-full px-3 py-1.5 rounded bg-bg-tertiary text-text-primary border border-border-secondary focus:outline-none" />
                    </div>
                    <div>
                      <label className="block text-sm mb-1 text-text-secondary">Rotina filhos</label>
                      <input type="text" value={rotinaFilhos} onChange={(e) => setRotinaFilhos(e.target.value)} className="w-full px-3 py-1.5 rounded bg-bg-tertiary text-text-primary border border-border-secondary focus:outline-none" placeholder="Escola, horários, responsáveis..." />
                    </div>
                  </div>
                  {/* Cor do Card removido: edição via dot no título */}
                </>
              )}
            </div>
          )}

          {activeTab === 'profissional' && (
            <div className="space-y-2.5">
              {!editMode ? (
                <div className="space-y-2.5">
                  {/* Linha 1: Situação, Dias Livres, Dias Semana */}
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-2.5">
                    <div className="md:col-span-1">
                      <div className="text-xs text-text-secondary mb-1">Situação Atual</div>
                      <div className="border border-border-secondary rounded-md p-2 bg-bg-tertiary/30 text-sm text-text-primary">{sitAtual || '-'}</div>
                    </div>
                    <div className="md:col-span-1">
                      <div className="text-xs text-text-secondary mb-1">Dias Livres</div>
                      <div className="border border-border-secondary rounded-md p-2 bg-bg-tertiary/30 text-sm text-text-primary">{diasLivres || '-'}</div>
                    </div>
                    <div className="md:col-span-3">
                      <div className="text-xs text-text-secondary mb-1">Dias Semana</div>
                      <div className="border border-border-secondary rounded-md p-2 bg-bg-tertiary/30 text-sm text-text-primary">
                        {diasSemana ? diasSemana.replace(/-feira/gi, '').replace(/-Feira/gi, '') : '-'}
                      </div>
                    </div>
                  </div>

                  {/* Linha 2: Exp. Residencial, Ref. Residencial, Exp. Comercial, Ref. Comercial, Transporte */}
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5">
                    <div className="md:col-span-2">
                      <div className="text-xs text-text-secondary mb-1">Exp. Residencial</div>
                      <div className="border border-border-secondary rounded-md p-2 bg-bg-tertiary/30 text-sm text-text-primary">{expResidencial || '-'}</div>
                    </div>
                    <div className="md:col-span-2">
                      <div className="text-xs text-text-secondary mb-1">Ref. Residencial</div>
                      <div className="border border-border-secondary rounded-md p-2 bg-bg-tertiary/30 text-sm text-text-primary">{refResidencial || '-'}</div>
                    </div>
                    <div className="md:col-span-2">
                      <div className="text-xs text-text-secondary mb-1">Exp. Comercial</div>
                      <div className="border border-border-secondary rounded-md p-2 bg-bg-tertiary/30 text-sm text-text-primary">{expComercial || '-'}</div>
                    </div>
                    <div className="md:col-span-2">
                      <div className="text-xs text-text-secondary mb-1">Ref. Comercial</div>
                      <div className="border border-border-secondary rounded-md p-2 bg-bg-tertiary/30 text-sm text-text-primary">{refComercial || '-'}</div>
                    </div>
                    <div className="md:col-span-4">
                      <div className="text-xs text-text-secondary mb-1">Transporte</div>
                      <div className="border border-border-secondary rounded-md p-2 bg-bg-tertiary/30 text-sm text-text-primary">{transporte || '-'}</div>
                    </div>
                  </div>

                  {/* Linha 3: Motivo Cadastro */}
                  <div>
                    <div className="text-xs text-text-secondary mb-1">Motivo do Cadastro</div>
                    <div className="border border-border-secondary rounded-md p-2 bg-bg-tertiary/30 text-sm text-text-primary">{motivoCadastro || '-'}</div>
                  </div>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {/* Linha 1: Situação, Dias Livres, Dias Semana */}
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-2.5">
                    <div className="md:col-span-1">
                      <label className="block text-sm mb-1 text-text-secondary">Situação Atual</label>
                      <input type="text" value={sitAtual} onChange={(e) => setSitAtual(e.target.value)} className="w-full px-3 py-1.5 rounded bg-bg-tertiary text-text-primary border border-border-secondary focus:outline-none" />
                    </div>
                    <div className="md:col-span-1">
                      <label className="block text-sm mb-1 text-text-secondary">Dias Livres</label>
                      <input type="text" value={diasLivres} onChange={(e) => setDiasLivres(e.target.value)} className="w-full px-3 py-1.5 rounded bg-bg-tertiary text-text-primary border border-border-secondary focus:outline-none" placeholder="Ex.: Seg, Qua, Sex" />
                    </div>
                    <div className="md:col-span-3">
                      <label className="block text-sm mb-1 text-text-secondary">Dias Semana</label>
                      <input type="text" value={diasSemana} onChange={(e) => setDiasSemana(e.target.value)} className="w-full px-3 py-1.5 rounded bg-bg-tertiary text-text-primary border border-border-secondary focus:outline-none" placeholder="Ex.: Segunda a Sábado" />
                    </div>
                  </div>

                  {/* Linha 2: Exp. Residencial, Ref. Residencial, Exp. Comercial, Ref. Comercial, Transporte */}
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5">
                    <div className="md:col-span-2">
                      <label className="block text-sm mb-1 text-text-secondary">Exp. Residencial</label>
                      <input type="text" value={expResidencial} onChange={(e) => setExpResidencial(e.target.value)} className="w-full px-3 py-1.5 rounded bg-bg-tertiary text-text-primary border border-border-secondary focus:outline-none" />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm mb-1 text-text-secondary">Ref. Residencial</label>
                      <input type="text" value={refResidencial} onChange={(e) => setRefResidencial(e.target.value)} className="w-full px-3 py-1.5 rounded bg-bg-tertiary text-text-primary border border-border-secondary focus:outline-none" />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm mb-1 text-text-secondary">Exp. Comercial</label>
                      <input type="text" value={expComercial} onChange={(e) => setExpComercial(e.target.value)} className="w-full px-3 py-1.5 rounded bg-bg-tertiary text-text-primary border border-border-secondary focus:outline-none" />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm mb-1 text-text-secondary">Ref. Comercial</label>
                      <input type="text" value={refComercial} onChange={(e) => setRefComercial(e.target.value)} className="w-full px-3 py-1.5 rounded bg-bg-tertiary text-text-primary border border-border-secondary focus:outline-none" />
                    </div>
                    <div className="md:col-span-4">
                      <label className="block text-sm mb-1 text-text-secondary">Transporte</label>
                      <input type="text" value={transporte} onChange={(e) => setTransporte(e.target.value)} className="w-full px-3 py-1.5 rounded bg-bg-tertiary text-text-primary border border-border-secondary focus:outline-none" placeholder="Ex.: Próprio, Aplicativo, Ônibus" />
                    </div>
                  </div>

                  {/* Linha 3: Motivo Cadastro */}
                  <div>
                    <label className="block text-sm mb-1 text-text-secondary">Motivo do Cadastro</label>
                    <input type="text" value={motivoCadastro} onChange={(e) => setMotivoCadastro(e.target.value)} className="w-full px-3 py-1.5 rounded bg-bg-tertiary text-text-primary border border-border-secondary focus:outline-none" />
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'observacao' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-medium text-text-secondary">Observações Gerais</label>
                <div className="flex items-center gap-1.5 text-[10px] text-accent-primary/60 font-medium uppercase tracking-wider">
                  <div className={`w-1.5 h-1.5 rounded-full ${autoSavingObs ? 'bg-accent-primary animate-pulse' : 'bg-green-500'}`}></div>
                  {autoSavingObs ? 'Salvando...' : (autoSaveObsMsg || 'Salvo automaticamente')}
                </div>
              </div>
              <textarea
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
                onBlur={handleAutoSaveObservacao}
                rows={8}
                className="w-full px-4 py-3 rounded-lg bg-bg-tertiary text-text-primary border border-border-secondary focus:border-accent-primary focus:ring-2 focus:ring-accent-primary/10 transition-all outline-none resize-none text-sm leading-relaxed"
                placeholder="Digite aqui as observações sobre esta candidata... O salvamento é automático."
              />
            </div>
          )}

          {activeTab === "documentos" && (
            <div className="space-y-3">
              {/* Linha com informação e campo de assinatura */}
              <div className="flex items-center justify-between gap-4">
                <div className="text-sm text-text-secondary">
                  Selecione um documento para visualizar ou baixar em PDF
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-sm text-text-secondary whitespace-nowrap">Data Assinatura:</label>
                  <input
                    type="date"
                    value={assinatura}
                    onChange={(e) => setAssinatura(e.target.value)}
                    className="px-3 py-1.5 rounded bg-bg-tertiary text-text-primary border border-border-secondary focus:outline-none text-sm"
                  />
                </div>
              </div>

              {/* Grid de documentos - agora Flex Scroll */}
              <div className="flex gap-3 overflow-x-auto pb-4 scrollbar-hide">
                {/* Ficha - PDF existente */}
                <button
                  onClick={generatePdf}
                  className="flex-shrink-0 flex flex-col items-center gap-2 p-4 border border-border-secondary rounded-lg hover:bg-bg-tertiary hover:border-accent-primary/50 transition-all group min-w-[140px]"
                >
                  <div className="w-12 h-12 rounded-lg bg-accent-primary/10 flex items-center justify-center group-hover:bg-accent-primary/20 transition-colors">
                    <Icon name="FileText" className="w-6 h-6 text-accent-primary" />
                  </div>
                  <div className="text-sm font-medium text-text-primary text-center">Ficha</div>
                  <div className="text-xs text-text-secondary text-center">Cadastro completo</div>
                </button>

                {/* Aditamento Contratual */}
                {availableDocuments.has('aditamento') && (
                  <button
                    onClick={async () => {
                      if (!selectedUnit || selectedUnit.id === 'ALL') {
                        alert('Por favor, selecione uma unidade específica.');
                        return;
                      }

                      const unit = selectedUnit as import('../../types').Unit;
                      const documentData = {
                        profissional: {
                          nome: nome || '',
                          cpf: cpf || '',
                          rg: rg || '',
                          dataNascimento: dataNascimento || '',
                          estadoCivil: estadoCivil || '',
                          endereco: endereco || '',
                          whatsapp: whatsapp || '',
                          fumante: fumante || false,
                          filhos: filhos || false,
                          qtosFilhos: qtosFilhos ? parseInt(String(qtosFilhos)) : 0,
                          rotinaFilhos: rotinaFilhos || '',
                          diasLivres: diasLivres || '',
                          diasSemana: diasSemana || '',
                          expResidencial: expResidencial || '',
                          refResidencial: refResidencial || '',
                          expComercial: expComercial || '',
                          refComercial: refComercial || '',
                          sitAtual: sitAtual || '',
                          motivoCadastro: motivoCadastro || '',
                          transporte: transporte || '',
                          assinatura: assinatura || '',
                        },
                        unidade: {
                          razaoSocial: unit.razao_social || '',
                          cnpj: unit.cnpj || '',
                          endereco: unit.endereco || unit.address || '',
                          responsavel: unit.responsavel || '',
                          contato: unit.contato || '',
                          email: unit.email || '',
                          unitName: unit.unit_name || '',
                          unitCode: unit.unit_code || '',
                          uniformValue: (unit as any).uniform_value,
                        },
                        contrato: {
                          dataAssinatura: new Date().toLocaleDateString('pt-BR'),
                          percentualProfissional: 55,
                        },
                      };

                      try {
                        const html = await getDocumentTemplate(unit.id, 'aditamento', documentData, 'recrutadora');
                        generateTemplateDocument(html, `Aditamento_${nome || 'sem_nome'}.pdf`);
                      } catch (error) {
                        console.error('[Aditamento] Error loading template:', error);
                        const html = generateAditamentoHTML(documentData);
                        generateTemplateDocument(html, `Aditamento_${nome || 'sem_nome'}.pdf`);
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
                )}

                {/* Contrato de Agenciamento */}
                {availableDocuments.has('contrato') && (
                  <button
                    onClick={async () => {
                      if (!selectedUnit || typeof selectedUnit === 'string' || selectedUnit.id === 'ALL') {
                        alert('Por favor, selecione uma unidade específica para gerar o documento.');
                        return;
                      }
                      const documentData = {
                        profissional: {
                          nome,
                          cpf,
                          rg,
                          dataNascimento,
                          estadoCivil,
                          endereco,
                          whatsapp,
                        },
                        unidade: {
                          razaoSocial: (selectedUnit as Unit).razao_social,
                          cnpj: (selectedUnit as Unit).cnpj,
                          endereco: (selectedUnit as Unit).endereco,
                          unitName: (selectedUnit as Unit).unit_name,
                          uniformValue: (selectedUnit as Unit).uniform_value,
                        },
                        contrato: {
                          percentualProfissional: 55,
                        },
                      };
                      try {
                        const html = await getDocumentTemplate((selectedUnit as Unit).id, 'contrato', documentData, 'recrutadora');
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
                )}

                {/* Termo de Confidencialidade */}
                {availableDocuments.has('termo') && (
                  <button
                    onClick={async () => {
                      if (!selectedUnit || typeof selectedUnit === 'string' || selectedUnit.id === 'ALL') {
                        alert('Por favor, selecione uma unidade específica para gerar o documento.');
                        return;
                      }
                      const documentData = {
                        profissional: {
                          nome,
                          cpf,
                          rg,
                          dataNascimento,
                          estadoCivil,
                          endereco,
                          whatsapp,
                        },
                        unidade: {
                          razaoSocial: (selectedUnit as Unit).razao_social,
                          cnpj: (selectedUnit as Unit).cnpj,
                          endereco: (selectedUnit as Unit).endereco,
                          unitName: (selectedUnit as Unit).unit_name,
                        },
                      };
                      try {
                        const html = await getDocumentTemplate((selectedUnit as Unit).id, 'termo', documentData, 'recrutadora');
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
                )}

                {/* Notificação Extrajudicial */}
                {availableDocuments.has('notificacao') && (
                  <button
                    onClick={async () => {
                      if (!selectedUnit || typeof selectedUnit === 'string' || selectedUnit.id === 'ALL') {
                        alert('Por favor, selecione uma unidade específica para gerar o documento.');
                        return;
                      }
                      const documentData = {
                        profissional: {
                          nome,
                          cpf,
                          rg,
                          dataNascimento,
                          estadoCivil,
                          endereco,
                          whatsapp,
                        },
                        unidade: {
                          razaoSocial: (selectedUnit as Unit).razao_social,
                          cnpj: (selectedUnit as Unit).cnpj,
                          endereco: (selectedUnit as Unit).endereco,
                          unitName: (selectedUnit as Unit).unit_name,
                        },
                      };
                      try {
                        const html = await getDocumentTemplate((selectedUnit as Unit).id, 'notificacao', documentData, 'recrutadora');
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
                )}

                {/* Distrato */}
                {availableDocuments.has('distrato') && (
                  <button
                    onClick={async () => {
                      if (!selectedUnit || typeof selectedUnit === 'string' || selectedUnit.id === 'ALL') {
                        alert('Por favor, selecione uma unidade específica para gerar o documento.');
                        return;
                      }
                      const documentData = {
                        profissional: {
                          nome,
                          cpf,
                          rg,
                          dataNascimento,
                          estadoCivil,
                          endereco,
                          whatsapp,
                        },
                        unidade: {
                          razaoSocial: (selectedUnit as Unit).razao_social,
                          cnpj: (selectedUnit as Unit).cnpj,
                          endereco: (selectedUnit as Unit).endereco,
                          unitName: (selectedUnit as Unit).unit_name,
                        },
                      };
                      try {
                        const html = await getDocumentTemplate((selectedUnit as Unit).id, 'distrato', documentData, 'recrutadora');
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
                )}
              </div>
            </div>
          )}
          {err && <div className="text-sm text-danger bg-danger/10 p-2 rounded mt-3">{err}</div>}
        </div>

        {/* Footer compacto */}
        <div className="flex items-center justify-between border-t border-border-secondary bg-bg-tertiary px-5 py-3">
          <div className="flex items-center gap-1 text-xs text-text-secondary">
            <Icon name="info" className="w-3 h-3" />
            <span>{activeTab === 'pessoal' && editMode ? '* Obrigatório' : ''}</span>
          </div>

          <div className="flex items-center gap-2">
            {isEditing && onDelete && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={saving}
                className="rounded-lg p-2 text-danger hover:bg-danger/10 border border-danger/30 focus:outline-none focus:ring-2 focus:ring-danger/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                title="Excluir"
              >
                <Icon name="delete" className="w-5 h-5" />
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                if (!isEditing || !editMode) {
                  setEditMode(true);
                } else {
                  handleSave();
                }
              }}
              disabled={saving}
              className="rounded-lg bg-accent-primary p-2.5 text-white hover:bg-accent-primary/90 focus:outline-none focus:ring-2 focus:ring-accent-primary transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-accent-primary/20"
              title={saving ? "Salvando..." : (!isEditing || !editMode) ? "Editar" : "Salvar"}
            >
              {saving ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : (
                <Icon name={(!isEditing || !editMode) ? "edit" : "Check"} className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
      </div>
      {/* Modal de Preview A4 */}
      {previewOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60" onClick={() => setPreviewOpen(false)}>
          <div className="bg-white rounded-lg shadow-xl w-[90vw] h-[90vh] max-w-5xl flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
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
                {/* Conteúdo HTML injetado (A4) */}
                <div
                  ref={previewRef}
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
    </div>
  );
};

export default RecrutadoraCardModal;
