import React, { useEffect, useMemo, useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { RecrutadoraCard } from '../../types';
import { Icon } from './Icon';

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
  // Auto-save de Status
  const [autoSavingStatus, setAutoSavingStatus] = useState(false);
  const [autoSaveStatusMsg, setAutoSaveStatusMsg] = useState<string | null>(null);

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
  qto_filhos: qtosFilhos === '' ? null : String(qtosFilhos),
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

  const generatePdf = () => {
    const titulo = `Ficha - ${nome || initialCard?.nome || 'Sem nome'}`;
    const now = new Date();
    const dateStr = now.toLocaleString('pt-BR');
    const colorHex = (color || initialCard?.color_card || '#4ade80') as string;

    const pessoaisRows = [
      ['Nome', toDisplay(nome)],
      ['Data Nascimento', toDisplay(dataNascimento)],
      ['WhatsApp', toDisplay(whatsapp)],
      ['RG', toDisplay(rg)],
      ['CPF', toDisplay(cpf)],
      ['Estado Civil', toDisplay(estadoCivil)],
      ['Fumante', fumante === null ? '-' : (fumante ? 'Sim' : 'Não')],
      ['Endereço', toDisplay(endereco)],
      ['Tem filhos?', filhos === null ? '-' : (filhos ? 'Sim' : 'Não')],
      ['Qtde. filhos', qtosFilhos === '' ? '-' : String(qtosFilhos)],
      ['Rotina filhos', toDisplay(rotinaFilhos)],
    ];

    const profRows = [
      ['Dias Livres', toDisplay(diasLivres)],
      ['Dias Semana', toDisplay(diasSemana)],
      ['Exp. Residencial', toDisplay(expResidencial)],
      ['Ref. Residencial', toDisplay(refResidencial)],
      ['Exp. Comercial', toDisplay(expComercial)],
      ['Ref. Comercial', toDisplay(refComercial)],
      ['Situação Atual', toDisplay(sitAtual)],
      ['Motivo do Cadastro', toDisplay(motivoCadastro)],
      ['Transporte', toDisplay(transporte)],
    ];

    const tableRowsHtml = (rows: string[][]) => rows.map(([k, v]) => `
      <tr>
        <th>${k}</th>
        <td>${v}</td>
      </tr>
    `).join('');

    const html = `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <title>${titulo}</title>
    <style>
      @page { size: A4; margin: 16mm; }
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', 'Liberation Sans', sans-serif; color: #111827; }
      .header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
      .title { display: flex; align-items: center; gap: 8px; font-size: 20px; font-weight: 700; }
      .dot { width: 10px; height: 10px; border-radius: 999px; border: 1px solid #d1d5db; display: inline-block; }
      .meta { color: #6b7280; font-size: 12px; }
      h2 { font-size: 14px; margin: 18px 0 8px; color: #111827; }
      table { width: 100%; border-collapse: collapse; }
      th { text-align: left; width: 32%; padding: 6px 8px; background: #f3f4f6; border-bottom: 1px solid #e5e7eb; font-weight: 600; font-size: 12px; color: #374151; }
      td { padding: 6px 8px; border-bottom: 1px solid #e5e7eb; font-size: 12px; color: #111827; }
      .section { page-break-inside: avoid; }
      .footer { margin-top: 16px; font-size: 11px; color: #6b7280; }
    </style>
  </head>
  <body>
    <div class="header">
      <div class="title">
        <span class="dot" style="background:${colorHex}"></span>
        <span>${toDisplay(nome || initialCard?.nome)}</span>
      </div>
      <div class="meta">Gerado em ${dateStr}</div>
    </div>

    <div class="section">
      <h2>Informações Pessoais</h2>
      <table>
        <tbody>
          ${tableRowsHtml(pessoaisRows)}
        </tbody>
      </table>
    </div>

    <div class="section">
      <h2>Profissional</h2>
      <table>
        <tbody>
          ${tableRowsHtml(profRows)}
        </tbody>
      </table>
    </div>

    <div class="footer">DromeFlow • ${toDisplay(statusLabel)}${unidade ? ` • ${unidade}` : ''}</div>
  </body>
 </html>`;

    // Em vez de abrir em nova aba, renderizamos no modal de preview em A4
    setPreviewOpen(true);
    // Renderizamos o HTML dentro do container quando o modal abrir
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
    try { w.print(); } catch {}
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
    const filename = `Ficha_${(nome || initialCard?.nome || 'sem_nome').replace(/\s+/g,'_')}.pdf`;
    pdf.save(filename);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60" aria-modal="true" role="dialog" onClick={onClose}>
  <div className="w-full max-w-[45rem] p-5 mx-3 bg-bg-secondary rounded-lg shadow-lg max-h-[90vh] flex flex-col" onClick={(e)=>e.stopPropagation()}>
        <div className="flex items-center justify-between pb-3 border-b border-border-primary">
          <h2 className="text-xl font-bold text-text-primary flex items-center gap-2">
            <button
              type="button"
              onClick={handleColorDotClick}
              disabled={saving}
              className="inline-block h-3 w-3 rounded-full border border-border-secondary cursor-pointer"
              style={{ backgroundColor: (color || initialCard?.color_card || '#4ade80') as string }}
              aria-label="Alterar cor do card"
              title="Alterar cor do card"
            />
            {isEditing ? (nome || initialCard?.nome || 'Editar Card') : 'Novo Card'}
            {/* input color oculto para editar a cor ao clicar no dot */}
            <input
              ref={colorInputRef}
              type="color"
              value={color || '#4ade80'}
              onChange={(e)=>setColor(e.target.value)}
              className="sr-only"
              aria-hidden="true"
              tabIndex={-1}
            />
          </h2>
          <div className="flex items-center gap-2">
            {/* Seletor de Status */}
            <div>
              <label className="sr-only">Status</label>
              <select
                value={statusLabel || ''}
                onChange={(e)=> handleStatusChange(e.target.value)}
                className="px-2 py-1 rounded-md border border-border-secondary bg-bg-tertiary text-sm text-text-primary focus:outline-none"
                title="Status"
              >
                <option value="">-</option>
                <option value="qualificadas">QUALIFICADAS</option>
                <option value="contato">CONTATO</option>
                <option value="envio_doc">ENVIO DOS DOCUMENTOS</option>
                <option value="truora">TRUORA</option>
                <option value="treinamento">TREINAMENTO</option>
                <option value="ativo">ATIVO</option>
                <option value="finalizado">FINALIZADO</option>
                <option value="nao_aprovadas">NÃO APROVADAS</option>
                <option value="desistentes">DESISTENTES</option>
              </select>
              <div className="text-[11px] text-text-secondary mt-0.5 h-4">{autoSavingStatus ? 'Salvando…' : (autoSaveStatusMsg || '')}</div>
            </div>
            {initialCard && !editMode && (
              <button onClick={() => setEditMode(true)} className="px-3 py-1.5 text-sm font-medium rounded-md border border-border-secondary text-text-primary hover:bg-bg-tertiary">Editar</button>
            )}
            {initialCard && editMode && (
              <button onClick={() => setEditMode(false)} className="px-3 py-1.5 text-sm font-medium rounded-md border border-border-secondary text-text-secondary hover:bg-bg-tertiary" disabled={saving}>Cancelar edição</button>
            )}
            <button onClick={onClose} className="p-1 rounded-full text-text-secondary hover:bg-bg-tertiary" disabled={saving}>
              <Icon name="close" />
            </button>
          </div>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto pr-1">
          {/* Header removido por solicitação: linha 'Coluna: ...' e aviso de modo visualização */}

          {/* Tabs */}
          <div className="flex gap-2 border-b border-border-secondary mb-3 overflow-x-auto">
            <button className={`px-3 py-1.5 text-xs md:text-sm rounded-t-md ${activeTab==='pessoal' ? 'bg-bg-tertiary text-text-primary border border-border-secondary border-b-0' : 'text-text-secondary hover:text-text-primary'}`} onClick={()=>setActiveTab('pessoal')}>
              <span className="inline-flex items-center gap-1"><Icon name="User" className="w-4 h-4"/> Informações Pessoais</span>
            </button>
            <button className={`px-3 py-1.5 text-xs md:text-sm rounded-t-md ${activeTab==='profissional' ? 'bg-bg-tertiary text-text-primary border border-border-secondary border-b-0' : 'text-text-secondary hover:text-text-primary'}`} onClick={()=>setActiveTab('profissional')}>
              <span className="inline-flex items-center gap-1"><Icon name="Briefcase" className="w-4 h-4"/> Profissional</span>
            </button>
            <button className={`px-3 py-1.5 text-xs md:text-sm rounded-t-md ${activeTab==='observacao' ? 'bg-bg-tertiary text-text-primary border border-border-secondary border-b-0' : 'text-text-secondary hover:text-text-primary'}`} onClick={()=>setActiveTab('observacao')}>
              <span className="inline-flex items-center gap-1"><Icon name="NotebookText" className="w-4 h-4"/> Observação</span>
            </button>
            <button className={`px-3 py-1.5 text-xs md:text-sm rounded-t-md ${activeTab==='documentos' ? 'bg-bg-tertiary text-text-primary border border-border-secondary border-b-0' : 'text-text-secondary hover:text-text-primary'}`} onClick={()=>setActiveTab('documentos')}>
              <span className="inline-flex items-center gap-1"><Icon name="Folder" className="w-4 h-4"/> Documentos</span>
            </button>
          </div>

          {/* Conteúdo das abas */}
          {activeTab === 'pessoal' && (
            <div className="space-y-3">
              {!editMode ? (
                <>
                  {/* Linha 1: Nome | Data Nascimento | WhatsApp */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <div className="text-xs text-text-secondary">Nome</div>
                      <div className="text-sm text-text-primary">{nome || '-'}</div>
                    </div>
                    <div>
                      <div className="text-xs text-text-secondary">Data Nascimento</div>
                      <div className="text-sm text-text-primary">{dataNascimento || '-'}</div>
                    </div>
                    <div>
                      <div className="text-xs text-text-secondary">WhatsApp</div>
                      <div className="text-sm text-text-primary">{whatsapp || '-'}</div>
                    </div>
                  </div>
                  {/* Linha 2: RG | CPF | Estado Civil | Fumante */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <div>
                      <div className="text-xs text-text-secondary">RG</div>
                      <div className="text-sm text-text-primary">{rg || '-'}</div>
                    </div>
                    <div>
                      <div className="text-xs text-text-secondary">CPF</div>
                      <div className="text-sm text-text-primary">{cpf || '-'}</div>
                    </div>
                    <div>
                      <div className="text-xs text-text-secondary">Estado Civil</div>
                      <div className="text-sm text-text-primary">{estadoCivil || '-'}</div>
                    </div>
                    <div>
                      <div className="text-xs text-text-secondary">Fumante</div>
                      <div className="text-sm text-text-primary">{fumante === null ? '-' : (fumante ? 'Sim' : 'Não')}</div>
                    </div>
                  </div>
                  {/* Linha 3: Endereço (terceira linha) */}
                  <div>
                    <div className="text-xs text-text-secondary">Endereço</div>
                    <div className="text-sm text-text-primary">{endereco || '-'}</div>
                  </div>
                  {/* Linha 4: Tem filhos? | Qtde. filhos | Rotina filhos */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <div className="text-xs text-text-secondary">Tem filhos?</div>
                      <div className="text-sm text-text-primary">{filhos === null ? '-' : (filhos ? 'Sim' : 'Não')}</div>
                    </div>
                    <div>
                      <div className="text-xs text-text-secondary">Qtde. filhos</div>
                      <div className="text-sm text-text-primary">{qtosFilhos === '' ? '-' : qtosFilhos}</div>
                    </div>
                    <div>
                      <div className="text-xs text-text-secondary">Rotina filhos</div>
                      <div className="text-sm text-text-primary">{rotinaFilhos || '-'}</div>
                    </div>
                  </div>
                  {/* Cor do Card removido: edição via dot no título */}
                </>
              ) : (
                <>
                  {/* Linha 1: Nome | Data Nascimento | WhatsApp */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-sm mb-1 text-text-secondary">Nome</label>
                      <input type="text" value={nome} onChange={(e)=>setNome(e.target.value)} className="w-full px-3 py-1.5 rounded bg-bg-tertiary text-text-primary border border-border-secondary focus:outline-none" placeholder="Nome da candidata(o)"/>
                    </div>
                    <div>
                      <label className="block text-sm mb-1 text-text-secondary">Data Nascimento</label>
                      <input type="date" value={dataNascimento} onChange={(e)=>setDataNascimento(e.target.value)} className="w-full px-3 py-1.5 rounded bg-bg-tertiary text-text-primary border border-border-secondary focus:outline-none"/>
                    </div>
                    <div>
                      <label className="block text-sm mb-1 text-text-secondary">WhatsApp</label>
                      <input type="text" value={whatsapp} onChange={(e)=>setWhatsapp(e.target.value)} className="w-full px-3 py-1.5 rounded bg-bg-tertiary text-text-primary border border-border-secondary focus:outline-none" placeholder="55999990000"/>
                    </div>
                  </div>
                  {/* Linha 2: RG | CPF | Estado Civil | Fumante */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-sm mb-1 text-text-secondary">RG</label>
                      <input type="text" value={rg} onChange={(e)=>setRg(e.target.value)} className="w-full px-3 py-1.5 rounded bg-bg-tertiary text-text-primary border border-border-secondary focus:outline-none"/>
                    </div>
                    <div>
                      <label className="block text-sm mb-1 text-text-secondary">CPF</label>
                      <input type="text" value={cpf} onChange={(e)=>setCpf(e.target.value)} className="w-full px-3 py-1.5 rounded bg-bg-tertiary text-text-primary border border-border-secondary focus:outline-none"/>
                    </div>
                    <div>
                      <label className="block text-sm mb-1 text-text-secondary">Estado Civil</label>
                      <input type="text" value={estadoCivil} onChange={(e)=>setEstadoCivil(e.target.value)} className="w-full px-3 py-1.5 rounded bg-bg-tertiary text-text-primary border border-border-secondary focus:outline-none" placeholder="Solteira(o), Casada(o), ..."/>
                    </div>
                    <div>
                      <label className="block text-sm mb-1 text-text-secondary">Fumante</label>
                      <select value={fumante===null?'' : fumante? 'sim':'nao'} onChange={(e)=>setFumante(e.target.value===''? null : e.target.value==='sim')} className="w-full px-3 py-1.5 rounded bg-bg-tertiary text-text-primary border border-border-secondary focus:outline-none">
                        <option value="">-</option>
                        <option value="sim">Sim</option>
                        <option value="nao">Não</option>
                      </select>
                    </div>
                  </div>
                  {/* Linha 3: Endereço (terceira linha) */}
                  <div>
                    <label className="block text-sm mb-1 text-text-secondary">Endereço</label>
                    <input type="text" value={endereco} onChange={(e)=>setEndereco(e.target.value)} className="w-full px-3 py-1.5 rounded bg-bg-tertiary text-text-primary border border-border-secondary focus:outline-none" placeholder="Rua, número, bairro, cidade"/>
                  </div>
                  {/* Linha 4: Tem filhos? | Qtde. filhos | Rotina filhos */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-sm mb-1 text-text-secondary">Tem filhos?</label>
                      <select value={filhos===null?'' : filhos? 'sim':'nao'} onChange={(e)=>setFilhos(e.target.value===''? null : e.target.value==='sim')} className="w-full px-3 py-1.5 rounded bg-bg-tertiary text-text-primary border border-border-secondary focus:outline-none">
                        <option value="">-</option>
                        <option value="sim">Sim</option>
                        <option value="nao">Não</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm mb-1 text-text-secondary">Qtde. filhos</label>
                      <input type="number" min={0} value={qtosFilhos} onChange={(e)=>setQtosFilhos(e.target.value===''? '' : Number(e.target.value))} className="w-full px-3 py-1.5 rounded bg-bg-tertiary text-text-primary border border-border-secondary focus:outline-none"/>
                    </div>
                    <div>
                      <label className="block text-sm mb-1 text-text-secondary">Rotina filhos</label>
                      <input type="text" value={rotinaFilhos} onChange={(e)=>setRotinaFilhos(e.target.value)} className="w-full px-3 py-1.5 rounded bg-bg-tertiary text-text-primary border border-border-secondary focus:outline-none" placeholder="Escola, horários, responsáveis..."/>
                    </div>
                  </div>
                  {/* Cor do Card removido: edição via dot no título */}
                </>
              )}
            </div>
          )}

          {activeTab === 'profissional' && (
            <div className="space-y-3">
              {!editMode ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <div className="text-xs text-text-secondary">Dias Livres</div>
                    <div className="text-sm text-text-primary">{diasLivres || '-'}</div>
                  </div>
                  <div>
                    <div className="text-xs text-text-secondary">Dias Semana</div>
                    <div className="text-sm text-text-primary">{diasSemana || '-'}</div>
                  </div>
                  <div>
                    <div className="text-xs text-text-secondary">Exp. Residencial</div>
                    <div className="text-sm text-text-primary">{expResidencial || '-'}</div>
                  </div>
                  <div>
                    <div className="text-xs text-text-secondary">Ref. Residencial</div>
                    <div className="text-sm text-text-primary">{refResidencial || '-'}</div>
                  </div>
                  <div>
                    <div className="text-xs text-text-secondary">Exp. Comercial</div>
                    <div className="text-sm text-text-primary">{expComercial || '-'}</div>
                  </div>
                  <div>
                    <div className="text-xs text-text-secondary">Ref. Comercial</div>
                    <div className="text-sm text-text-primary">{refComercial || '-'}</div>
                  </div>
                  <div>
                    <div className="text-xs text-text-secondary">Situação Atual</div>
                    <div className="text-sm text-text-primary">{sitAtual || '-'}</div>
                  </div>
                  <div>
                    <div className="text-xs text-text-secondary">Motivo do Cadastro</div>
                    <div className="text-sm text-text-primary">{motivoCadastro || '-'}</div>
                  </div>
                  <div className="md:col-span-2">
                    <div className="text-xs text-text-secondary">Transporte</div>
                    <div className="text-sm text-text-primary">{transporte || '-'}</div>
                  </div>
                </div>
              ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm mb-1 text-text-secondary">Dias Livres</label>
                  <input type="text" value={diasLivres} onChange={(e)=>setDiasLivres(e.target.value)} className="w-full px-3 py-1.5 rounded bg-bg-tertiary text-text-primary border border-border-secondary focus:outline-none" placeholder="Ex.: Seg, Qua, Sex"/>
                </div>
                <div>
                  <label className="block text-sm mb-1 text-text-secondary">Dias Semana</label>
                  <input type="text" value={diasSemana} onChange={(e)=>setDiasSemana(e.target.value)} className="w-full px-3 py-1.5 rounded bg-bg-tertiary text-text-primary border border-border-secondary focus:outline-none" placeholder="Ex.: Segunda a Sábado"/>
                </div>
                <div>
                  <label className="block text-sm mb-1 text-text-secondary">Exp. Residencial</label>
                  <input type="text" value={expResidencial} onChange={(e)=>setExpResidencial(e.target.value)} className="w-full px-3 py-1.5 rounded bg-bg-tertiary text-text-primary border border-border-secondary focus:outline-none"/>
                </div>
                <div>
                  <label className="block text-sm mb-1 text-text-secondary">Ref. Residencial</label>
                  <input type="text" value={refResidencial} onChange={(e)=>setRefResidencial(e.target.value)} className="w-full px-3 py-1.5 rounded bg-bg-tertiary text-text-primary border border-border-secondary focus:outline-none"/>
                </div>
                <div>
                  <label className="block text-sm mb-1 text-text-secondary">Exp. Comercial</label>
                  <input type="text" value={expComercial} onChange={(e)=>setExpComercial(e.target.value)} className="w-full px-3 py-1.5 rounded bg-bg-tertiary text-text-primary border border-border-secondary focus:outline-none"/>
                </div>
                <div>
                  <label className="block text-sm mb-1 text-text-secondary">Ref. Comercial</label>
                  <input type="text" value={refComercial} onChange={(e)=>setRefComercial(e.target.value)} className="w-full px-3 py-1.5 rounded bg-bg-tertiary text-text-primary border border-border-secondary focus:outline-none"/>
                </div>
                <div>
                  <label className="block text-sm mb-1 text-text-secondary">Situação Atual</label>
                  <input type="text" value={sitAtual} onChange={(e)=>setSitAtual(e.target.value)} className="w-full px-3 py-1.5 rounded bg-bg-tertiary text-text-primary border border-border-secondary focus:outline-none"/>
                </div>
                <div>
                  <label className="block text-sm mb-1 text-text-secondary">Motivo do Cadastro</label>
                  <input type="text" value={motivoCadastro} onChange={(e)=>setMotivoCadastro(e.target.value)} className="w-full px-3 py-1.5 rounded bg-bg-tertiary text-text-primary border border-border-secondary focus:outline-none"/>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm mb-1 text-text-secondary">Transporte</label>
                  <input type="text" value={transporte} onChange={(e)=>setTransporte(e.target.value)} className="w-full px-3 py-1.5 rounded bg-bg-tertiary text-text-primary border border-border-secondary focus:outline-none" placeholder="Ex.: Próprio, Aplicativo, Ônibus"/>
                </div>
              </div>
              )}
            </div>
          )}

          {activeTab === 'observacao' && (
            <div className="space-y-3">
              <div>
                <label className="block text-sm mb-1 text-text-secondary">Observação</label>
                <textarea
                  value={observacao}
                  onChange={(e)=>setObservacao(e.target.value)}
                  onBlur={handleAutoSaveObservacao}
                  rows={4}
                  className="w-full px-3 py-1.5 rounded bg-bg-tertiary text-text-primary border border-border-secondary focus:outline-none"
                  placeholder="Adicione observações relevantes..."
                />
                <div className="mt-1 h-5 text-xs text-text-secondary">
                  {autoSavingObs ? 'Salvando…' : (autoSaveObsMsg || '')}
                </div>
              </div>
            </div>
          )}

          {activeTab === "documentos" && (
            <div className="space-y-3">
              <div className="text-sm text-text-secondary">Em breve: upload e visualização de documentos associados ao cadastro.</div>
              {!editMode ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <div className="text-xs text-text-secondary">RG</div>
                    <div className="text-sm text-text-primary">{rg || '-'}</div>
                  </div>
                  <div>
                    <div className="text-xs text-text-secondary">CPF</div>
                    <div className="text-sm text-text-primary">{cpf || '-'}</div>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm mb-1 text-text-secondary">RG</label>
                    <input type="text" value={rg} onChange={(e)=>setRg(e.target.value)} className="w-full px-3 py-1.5 rounded bg-bg-tertiary text-text-primary border border-border-secondary focus:outline-none"/>
                  </div>
                  <div>
                    <label className="block text-sm mb-1 text-text-secondary">CPF</label>
                    <input type="text" value={cpf} onChange={(e)=>setCpf(e.target.value)} className="w-full px-3 py-1.5 rounded bg-bg-tertiary text-text-primary border border-border-secondary focus:outline-none"/>
                  </div>
                </div>
              )}
            </div>
          )}
          {err && <div className="text-sm text-danger bg-danger/10 p-2 rounded mt-3">{err}</div>}
        </div>

  <div className="flex justify-between items-center pt-6 mt-6 border-t border-border-primary">
          {isEditing && editMode ? (
            <button
              type="button"
              onClick={handleDelete}
              disabled={saving}
              className="px-3 py-2 text-sm font-medium text-danger border border-danger/50 rounded hover:bg-danger/10 disabled:opacity-50"
            >
              Excluir
            </button>
          ) : <span />}
          <div className="space-x-3">
            <button
              type="button"
              onClick={generatePdf}
              disabled={saving}
              className="p-2 text-sm font-medium border rounded-md text-text-primary border-border-secondary hover:bg-bg-tertiary disabled:opacity-50 inline-flex items-center"
              title="Visualizar PDF"
              aria-label="Visualizar PDF"
            >
              <Icon name="Printer" />
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 text-sm font-medium border rounded-md text-text-secondary border-border-secondary hover:bg-bg-tertiary disabled:opacity-50"
            >
              Cancelar
            </button>
            {editMode && (
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 text-sm font-medium text-white border border-transparent rounded-md bg-accent-primary hover:bg-accent-secondary disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
            )}
          </div>
        </div>
      </div>
      {/* Modal de Preview A4 */}
      {previewOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60" onClick={()=>setPreviewOpen(false)}>
          <div className="bg-white rounded-lg shadow-xl w-[90vw] h-[90vh] max-w-5xl flex flex-col overflow-hidden" onClick={(e)=>e.stopPropagation()}>
            <div className="flex items-center justify-between px-3 py-2 border-b">
              <div className="font-semibold text-sm">Pré-visualização (A4)</div>
              <div className="flex items-center gap-2">
                <button onClick={printPreview} className="p-2 rounded border hover:bg-gray-50" title="Imprimir"><Icon name="Printer" /></button>
                <button onClick={downloadPreviewPdf} className="px-3 py-1.5 rounded border hover:bg-gray-50 text-sm" title="Baixar PDF">Baixar PDF</button>
                <button onClick={()=>setPreviewOpen(false)} className="p-2 rounded border hover:bg-gray-50" title="Fechar"><Icon name="close" /></button>
              </div>
            </div>
            <div className="flex-1 min-h-0 overflow-auto bg-gray-100">
              <div className="mx-auto my-4 bg-white shadow-sm" style={{ width: '210mm', minHeight: '297mm' }}>
                {/* Conteúdo HTML injetado (A4) */}
                <div ref={previewRef} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RecrutadoraCardModal;
