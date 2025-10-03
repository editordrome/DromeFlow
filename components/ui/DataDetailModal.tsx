import React, { useEffect, useMemo, useRef, useState } from 'react';
import { DataRecord } from '../../types';
import { Icon } from './Icon';
import { updateDataRecord } from '../../services/data/dataTable.service';
import { useAppContext } from '../../contexts/AppContext';
import { fetchProfissionais, Profissional } from '../../services/profissionais/profissionais.service';

interface DataDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    record: DataRecord | null;
    onEdit?: (record: DataRecord) => void;
    onDelete?: (record: DataRecord) => void;
}

const DataDetailModal: React.FC<DataDetailModalProps> = ({ isOpen, onClose, record, onEdit, onDelete }) => {
    if (!isOpen || !record) return null;

    const { selectedUnit } = useAppContext();
    const [isEditing, setIsEditing] = useState(false);
    const [profissionais, setProfissionais] = useState<Profissional[]>([]);
    const [profissionalSel, setProfissionalSel] = useState<string>(record.PROFISSIONAL || '');
    const [statusSel, setStatusSel] = useState<string>(String((record as any).status ?? (record as any).STATUS ?? '') || '');
    const [savingHeader, setSavingHeader] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
    const hasHeaderChanges = useMemo(() => {
        const recStatus = String((record as any).status ?? (record as any).STATUS ?? '') || '';
        return (
            profissionalSel !== (record.PROFISSIONAL || '') ||
            statusSel !== recStatus
        );
    }, [profissionalSel, statusSel, record]);

    useEffect(() => {
        // Carrega profissionais da unidade atual
        const load = async () => {
            try {
                const unitId = (selectedUnit as any)?.id;
                const list = await fetchProfissionais(unitId);
                setProfissionais(list || []);
            } catch (e) {
                console.error('Falha ao carregar profissionais:', e);
                setProfissionais([]);
            }
        };
        load();
    }, [selectedUnit]);

    // ressincroniza valores ao trocar de registro/abrir
    useEffect(() => {
        if (record) {
            setProfissionalSel(record.PROFISSIONAL || '');
            setStatusSel(String((record as any).status ?? (record as any).STATUS ?? '') || '');
            setIsEditing(false);
            setSavingHeader('idle');
        }
    }, [record]);

    const renderDetail = (label: string, value: any) => {
        let displayValue = value;
        if (value === null || value === undefined || value === '') {
            displayValue = <span className="text-gray-400">N/A</span>;
        } else if (typeof value === 'boolean') {
            displayValue = value ? 'Sim' : 'Não';
        } else if (label.toLowerCase().includes('valor') || label.toLowerCase().includes('repasse')) {
             displayValue = Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        } else if ((label === 'Data' || label === 'Data de Cadastro') && typeof value === 'string' && value.includes('-')) {
            const parts = value.split('-');
            if (parts.length === 3) {
                displayValue = `${parts[2]}/${parts[1]}/${parts[0]}`;
            }
        } else if (label === 'Horário') {
            displayValue = formatTimeHM(value);
        }

        return (
            <div key={label} className="py-2">
                <p className="text-xs font-semibold uppercase text-text-secondary tracking-wider">{label}</p>
                <p className="text-md text-text-primary">{displayValue}</p>
            </div>
        );
    };
    
    const fieldMap: { key: keyof DataRecord; label: string }[] = [
        { key: 'ATENDIMENTO_ID', label: 'ID do Atendimento' },
        { key: 'DATA', label: 'Data' },
        { key: 'HORARIO', label: 'Horário' },
    { key: 'MOMENTO', label: 'Momento' },
        { key: 'DIA', label: 'Dia da Semana' },
        { key: 'TIPO', label: 'Tipo' },
        { key: 'VALOR', label: 'Valor (R$)' },
        { key: 'REPASSE', label: 'Repasse (R$)' },
        { key: 'CLIENTE', label: 'Cliente' },
        { key: 'whatscliente', label: 'WhatsApp Cliente' },
        { key: 'PROFISSIONAL', label: 'Profissional' },
        { key: 'ENDEREÇO', label: 'Endereço' },
        { key: 'ORIGEM', label: 'Origem' },
        { key: 'CUPOM', label: 'Cupom' },
        { key: 'CADASTRO', label: 'Data de Cadastro' },
        { key: 'unidade', label: 'Unidade' },
        { key: 'status', label: 'Status' },
    ];

    // Estados locais para campos editáveis com auto-save
    const [obs, setObs] = useState<string>('');
    const [coment, setComent] = useState<string>('');
    const [savingObs, setSavingObs] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
    const [savingComent, setSavingComent] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
    const obsTimer = useRef<any>(null);
    const comentTimer = useRef<any>(null);

    // Sincroniza valores iniciais ao abrir/trocar de registro
    useEffect(() => {
        if (record) {
            setObs(record.observacao || '');
            setComent(record.comentario || '');
            setSavingObs('idle');
            setSavingComent('idle');
        }
    }, [record]);

    const canPersist = useMemo(() => Boolean(record && record.id != null), [record]);

    const persistField = async (field: 'observacao' | 'comentario', value: string) => {
        if (!canPersist) return;
        try {
            if (field === 'observacao') setSavingObs('saving');
            else setSavingComent('saving');
            const updated = await updateDataRecord(String(record!.id), { [field]: value } as any);
            // Atualiza estado com retorno (robustez)
            if (field === 'observacao') {
                setObs(updated.observacao || '');
                setSavingObs('saved');
            } else {
                setComent(updated.comentario || '');
                setSavingComent('saved');
            }
        } catch (e) {
            if (field === 'observacao') setSavingObs('error');
            else setSavingComent('error');
            console.error('Falha ao salvar', field, e);
        }
    };

    const scheduleSave = (field: 'observacao' | 'comentario', value: string) => {
        const setter = field === 'observacao' ? setObs : setComent;
        const timerRef = field === 'observacao' ? obsTimer : comentTimer;
        const setSaving = field === 'observacao' ? setSavingObs : setSavingComent;
        setter(value);
        setSaving('idle');
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
            persistField(field, value);
        }, 800);
    };

    // --- Cópia de mensagens ---
    const [copied, setCopied] = useState(false);
    const [copiedClient, setCopiedClient] = useState(false);
    const formatBRDate = (iso: string | null | undefined) => {
        if (!iso) return '-';
        const parts = String(iso).split('-');
        if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
        return iso;
    };
    const formatTimeHM = (value: string | number | null | undefined) => {
        if (value === null || value === undefined) return '-';
        const str = String(value).trim();
        if (!str) return '-';
        // HH:MM:SS -> HH:MM
        const m1 = str.match(/^(\d{1,2}):(\d{2}):(\d{2})$/);
        if (m1) return `${m1[1].padStart(2, '0')}:${m1[2]}`;
        // HH:MM -> HH:MM
        const m2 = str.match(/^(\d{1,2}):(\d{2})$/);
        if (m2) return `${m2[1].padStart(2, '0')}:${m2[2]}`;
        // HHMMSS or HHMM -> HH:MM
        const m3 = str.match(/^(\d{2})(\d{2})(\d{2})$/);
        if (m3) return `${m3[1]}:${m3[2]}`;
        const m4 = str.match(/^(\d{2})(\d{2})$/);
        if (m4) return `${m4[1]}:${m4[2]}`;
        return str; // fallback
    };
    const firstName = (full: string | null | undefined) => {
        if (!full) return '-';
        const t = full.trim();
        if (!t) return '-';
        return t.split(/\s+/)[0];
    };
    const buildCopyText = (rec: DataRecord) => {
        const prof = firstName(rec.PROFISSIONAL);
        const data = formatBRDate(rec.DATA || null);
        const dia = rec.DIA || '-';
    const inicio = formatTimeHM(rec.HORARIO);
        const cliente = rec.CLIENTE || '-';
        const servico = (rec as any)['SERVIÇO'] || (rec as any)['SERVICO'] || (rec as any).TIPO || '-';
        const periodo = (rec as any)['PERÍODO'] || (rec as any)['PERIODO'] || (rec as any).MOMENTO || '-';
        const local = (rec as any)['ENDEREÇO'] || '-';
        return (
`Olá ${prof}, segue as informações do seu próximo atendimento:

*DATA* - ${data}   ${dia}
*INICIO* - ${inicio}
*CLIENTE* - ${cliente}
*SERVIÇO* - ${servico}
*PERIODO* - ${periodo} horas
*LOCAL* - ${local}

Favor confirme o seu atendimento a baixo.

1️⃣ *ACEITO*
2️⃣ *NÃO ACEITO*

Digite o *número* da resposta desejada.`
        );
    };

    // Texto para confirmação ao cliente (ícone no título)
    const buildClientCopyText = (rec: DataRecord) => {
        const data = formatBRDate(rec.DATA || null);
        const dia = rec.DIA || '-';
        const servico = (rec as any)['SERVIÇO'] || (rec as any)['SERVICO'] || (rec as any).TIPO || '-';
    const inicio = formatTimeHM(rec.HORARIO);
        const periodo = (rec as any)['PERÍODO'] || (rec as any)['PERIODO'] || (rec as any).MOMENTO || '-';
        const prof = rec.PROFISSIONAL || '-';
        return (
`🧽*CONFIRMAÇÃO DE AGENDAMENTO* 🧹

*DATA:* ${data} - ${dia}
*SERVICO:* ${servico}
*HORÁRIO:* ${inicio}
*PERIODO:* ${periodo} horas
*AGENCIADA:*  ${prof}

Obrigada e tenha um ótimo atendimento😊`
        );
    };
    const handleCopy = async () => {
        try {
            const text = buildCopyText(record);
            if (navigator?.clipboard?.writeText) {
                await navigator.clipboard.writeText(text);
            } else {
                // Fallback
                const ta = document.createElement('textarea');
                ta.value = text;
                document.body.appendChild(ta);
                ta.select();
                document.execCommand('copy');
                document.body.removeChild(ta);
            }
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (e) {
            console.error('Falha ao copiar mensagem:', e);
        }
    };

    const handleCopyClient = async () => {
        try {
            const text = buildClientCopyText(record);
            if (navigator?.clipboard?.writeText) {
                await navigator.clipboard.writeText(text);
            } else {
                const ta = document.createElement('textarea');
                ta.value = text;
                document.body.appendChild(ta);
                ta.select();
                document.execCommand('copy');
                document.body.removeChild(ta);
            }
            setCopiedClient(true);
            setTimeout(() => setCopiedClient(false), 2000);
        } catch (e) {
            console.error('Falha ao copiar confirmação do cliente:', e);
        }
    };


    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60" aria-modal="true" role="dialog" onClick={onClose}>
                        <div className="w-full max-w-2xl p-6 mx-4 bg-bg-secondary rounded-lg shadow-lg max-h-[90vh] flex flex-col" onClick={(e)=>e.stopPropagation()}>
                <div className="flex items-center justify-between pb-3 border-b border-border-primary flex-shrink-0">
                    <div className="flex items-center gap-2 min-w-0">
                        <h2 className="text-xl font-bold text-text-primary truncate" title={`${record.ATENDIMENTO_ID ? `ID ${record.ATENDIMENTO_ID} - ` : ''}${record.CLIENTE || 'Detalhes do Atendimento'}`}>
                            {record.ATENDIMENTO_ID ? (
                                <>
                                  <span className="text-text-secondary mr-2">ID {record.ATENDIMENTO_ID}</span>
                                  <span className="text-text-primary">- {record.CLIENTE || 'Detalhes do Atendimento'}</span>
                                </>
                            ) : (
                                <>{record.CLIENTE && record.CLIENTE.trim() !== '' ? record.CLIENTE : 'Detalhes do Atendimento'}</>
                            )}
                        </h2>
                        {/* Botão copiar confirmação para cliente */}
                        <button
                            type="button"
                            onClick={handleCopyClient}
                            className="p-1.5 text-text-secondary hover:bg-bg-tertiary flex-shrink-0"
                            aria-label="Copiar confirmação"
                            title="Copiar confirmação"
                        >
                            <Icon name="copy" className="w-4 h-4" />
                        </button>
                        {copiedClient && (
                            <span className="text-[11px] text-text-tertiary">Copiado!</span>
                        )}
                    </div>
                    <button onClick={onClose} className="p-1 rounded-full text-text-secondary hover:bg-bg-tertiary">
                        <Icon name="close" />
                    </button>
                </div>
                <div className="mt-6 space-y-4 pr-2 overflow-y-auto">
                {/* Linha 1: DATA, HORÁRIO, DIA DA SEMANA, VALOR, STATUS */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-x-6">
                    {renderDetail('Data', record.DATA)}
                    {renderDetail('Horário', record.HORARIO)}
                    {renderDetail('Dia da Semana', record.DIA)}
                    {renderDetail('Valor (R$)', record.VALOR)}
                    <div className="py-2">
                        <p className="text-xs font-semibold uppercase text-text-secondary tracking-wider flex items-center justify-between">
                            Status
                            <span className="text-[11px] text-text-tertiary">{savingHeader === 'saving' ? 'salvando…' : savingHeader === 'saved' ? 'salvo' : savingHeader === 'error' ? 'erro' : ''}</span>
                        </p>
                        <select
                            className="mt-1 w-full rounded-md border border-border-secondary bg-bg-tertiary p-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-primary/60"
                            value={statusSel}
                            onChange={(e) => setStatusSel(e.target.value)}
                        >
                            <option value="">Selecione</option>
                            <option value="PENDENTE">PENDENTE</option>
                            <option value="AGUARDANDO">AGUARDANDO</option>
                            <option value="CONFIRMADO">CONFIRMADO</option>
                            <option value="RECUSADO">RECUSADO</option>
                            <option value="CONCLUIDO">CONCLUIDO</option>
                        </select>
                    </div>
                </div>

                {/* Linha 2: ENDEREÇO (full) */}
                <div className="grid grid-cols-1 gap-x-6">
                    {renderDetail('Endereço', (record as any)['ENDEREÇO'])}
                </div>

                                {/* Linha 3: PROFISSIONAL, REPASSE, TIPO, PERÍODO */}
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-x-6">
                                        <div className="py-2">
                                            <p className="text-xs font-semibold uppercase text-text-secondary tracking-wider flex items-center justify-between">
                                                Profissional
                                                <span className="text-[11px] text-text-tertiary">{savingHeader === 'saving' ? 'salvando…' : savingHeader === 'saved' ? 'salvo' : savingHeader === 'error' ? 'erro' : ''}</span>
                                            </p>
                                            <select
                                                className="mt-1 w-full rounded-md border border-border-secondary bg-bg-tertiary p-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-primary/60"
                                                value={profissionalSel}
                                                onChange={(e) => setProfissionalSel(e.target.value)}
                                            >
                                                <option value="">Selecione</option>
                                                {profissionais.map(p => (
                                                    <option key={p.id} value={p.nome || ''}>{p.nome}</option>
                                                ))}
                                            </select>
                                        </div>
                                        {renderDetail('Repasse (R$)', record.REPASSE)}
                                        {renderDetail('Tipo', record.TIPO)}
                                        {(() => {
                                            const periodoRaw = (record as any)['PERÍODO'] ?? (record as any)['PERIODO'] ?? '';
                                            const display = periodoRaw ? `${periodoRaw} horas` : '-';
                                            return renderDetail('Período', display);
                                        })()}
                                </div>

                                {/* Linha 4 removida (Data de Cadastro, Cupom, Origem) */}
                                     {/* Campos editáveis */}
                                     <div className="grid grid-cols-1 gap-4 mt-2">
                                            <div>
                                                <div className="flex items-center justify-between">
                                                    <p className="text-xs font-semibold uppercase text-text-secondary tracking-wider">Observação</p>
                                                    <span className="text-[11px] text-text-tertiary">
                                                        {savingObs === 'saving' ? 'salvando…' : savingObs === 'saved' ? 'salvo' : savingObs === 'error' ? 'erro ao salvar' : ''}
                                                    </span>
                                                </div>
                                                <textarea
                                                    className="mt-1 w-full min-h-[90px] rounded-md border border-border-secondary bg-bg-tertiary p-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-primary/60"
                                                    placeholder="Adicionar observações..."
                                                    value={obs}
                                                    onChange={(e) => scheduleSave('observacao', e.target.value)}
                                                />
                                            </div>
                                            <div>
                                                <div className="flex items-center justify-between">
                                                    <p className="text-xs font-semibold uppercase text-text-secondary tracking-wider">Comentário</p>
                                                    <span className="text-[11px] text-text-tertiary">
                                                        {savingComent === 'saving' ? 'salvando…' : savingComent === 'saved' ? 'salvo' : savingComent === 'error' ? 'erro ao salvar' : ''}
                                                    </span>
                                                </div>
                                                <textarea
                                                    className="mt-1 w-full min-h-[90px] rounded-md border border-border-secondary bg-bg-tertiary p-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-primary/60"
                                                    placeholder="Adicionar comentários..."
                                                    value={coment}
                                                    onChange={(e) => scheduleSave('comentario', e.target.value)}
                                                />
                                            </div>
                                     </div>
                </div>
                 <div className="flex items-center justify-end gap-2 pt-4 mt-auto flex-shrink-0">
                    <button
                        type="button"
                        onClick={handleCopy}
                        className="p-2 text-sm font-medium rounded-md border border-border-secondary text-text-secondary hover:bg-bg-tertiary"
                        aria-label="Copiar"
                        title="Copiar"
                    >
                        <Icon name="copy" className="w-5 h-5" />
                    </button>
                    {copied && (
                        <span className="text-[11px] text-text-tertiary mr-2">Copiado!</span>
                    )}
                    <button
                        type="button"
                        onClick={() => onDelete && onDelete(record)}
                        className="p-2 text-sm font-medium text-white transition-colors bg-danger rounded-md hover:bg-red-700"
                        aria-label="Excluir"
                        title="Excluir"
                    >
                        <Icon name="delete" className="w-5 h-5" />
                    </button>
                    <button
                        type="button"
                        onClick={async () => {
                            // Se houver mudanças em Profissional ou Status, salvar imediatamente
                            if (hasHeaderChanges) {
                                try {
                                    setSavingHeader('saving');
                                    const payload: any = {};
                                    if (profissionalSel !== (record.PROFISSIONAL || '')) payload['PROFISSIONAL'] = profissionalSel;
                                    const recStatus = String((record as any).status ?? (record as any).STATUS ?? '') || '';
                                    if (statusSel !== recStatus) payload['STATUS'] = statusSel;
                                    if (Object.keys(payload).length > 0) {
                                        const updated = await updateDataRecord(String(record.id), payload);
                                        const merged: any = { ...record, ...payload };
                                        if (onEdit) onEdit(merged as DataRecord);
                                    }
                                    setSavingHeader('saved');
                                    if (isEditing) setIsEditing(false);
                                } catch (e) {
                                    console.error('Falha ao salvar cabeçalho:', e);
                                    setSavingHeader('error');
                                }
                                return;
                            }
                            // Caso contrário, alterna modo de edição para Observação/Comentário
                            setIsEditing(prev => !prev);
                        }}
                        className={`p-2 text-sm font-medium text-white transition-colors border border-transparent rounded-md ${(isEditing || hasHeaderChanges) ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-accent-primary hover:bg-accent-secondary'}`}
                        aria-label={(isEditing || hasHeaderChanges) ? 'Salvar' : 'Editar'}
                        title={(isEditing || hasHeaderChanges) ? 'Salvar' : 'Editar'}
                    >
                        <Icon name={(isEditing || hasHeaderChanges) ? 'check' : 'edit'} className="w-5 h-5" />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DataDetailModal;