import React, { useEffect, useMemo, useRef, useState } from 'react';
import { DataRecord } from '../../types';
import { Icon } from './Icon';
import { updateDataRecord } from '../../services/data/dataTable.service';
import { useAppContext } from '../../contexts/AppContext';
import { ProfessionalAutocomplete } from './ProfessionalAutocomplete';
import { fetchClientHistory, ClientHistoryRecord } from '../../services/data/clientHistory.service';

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
    const [activeTab, setActiveTab] = useState<'info' | 'posvenda' | 'historico'>('info');

    const [clientHistory, setClientHistory] = useState<ClientHistoryRecord[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 5;
    const [selectedPeriod, setSelectedPeriod] = useState<string>(() => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    });
    const [profissionalSel, setProfissionalSel] = useState<string>(record.PROFISSIONAL || '');
    const [statusSel, setStatusSel] = useState<string>(String((record as any).status ?? (record as any).STATUS ?? '') || '');
    const [savingHeader, setSavingHeader] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

    // Estados para campos editáveis
    const [editData, setEditData] = useState<string>(record.DATA || '');
    const [editHorario, setEditHorario] = useState<string>(record.HORARIO || '');
    const [editCliente, setEditCliente] = useState<string>(record.CLIENTE || '');
    const [editEndereco, setEditEndereco] = useState<string>((record as any)['ENDEREÇO'] || '');
    const [editTipo, setEditTipo] = useState<string>(record.TIPO || '');
    const [editPeriodo, setEditPeriodo] = useState<string>((record as any)['PERÍODO'] || (record as any)['PERIODO'] || '');
    const [editValor, setEditValor] = useState<string>(String(record.VALOR || ''));
    const [editRepasse, setEditRepasse] = useState<string>(String(record.REPASSE || ''));
    const hasHeaderChanges = useMemo(() => {
        // STATUS e PROFISSIONAL agora têm auto-save, não entram aqui
        return (
            editData !== (record.DATA || '') ||
            editHorario !== (record.HORARIO || '') ||
            editCliente !== (record.CLIENTE || '') ||
            editEndereco !== ((record as any)['ENDEREÇO'] || '') ||
            editTipo !== (record.TIPO || '') ||
            editPeriodo !== ((record as any)['PERÍODO'] || (record as any)['PERIODO'] || '') ||
            editValor !== String(record.VALOR || '') ||
            editRepasse !== String(record.REPASSE || '')
        );
    }, [editData, editHorario, editCliente, editEndereco, editTipo, editPeriodo, editValor, editRepasse, record]);



    // Carrega histórico do cliente quando a aba historico é ativada ou o período muda
    useEffect(() => {
        if (activeTab === 'historico' && record && record.CLIENTE && selectedUnit) {
            setCurrentPage(1); // Reset página ao mudar período
            const loadHistory = async () => {
                setLoadingHistory(true);
                try {
                    const unitCode = (selectedUnit as any)?.unit_code || '';
                    console.log('Carregando histórico para:', { cliente: record.CLIENTE, unitCode, period: selectedPeriod });
                    const history = await fetchClientHistory(
                        record.CLIENTE,
                        unitCode,
                        record.id,
                        200,
                        selectedPeriod
                    );
                    setClientHistory(history);
                } catch (e) {
                    console.error('Erro ao carregar histórico:', e);
                    setClientHistory([]);
                } finally {
                    setLoadingHistory(false);
                }
            };
            loadHistory();
        }
    }, [activeTab, record, selectedUnit, selectedPeriod]);

    // ressincroniza valores ao trocar de registro/abrir
    useEffect(() => {
        if (record) {
            setProfissionalSel(record.PROFISSIONAL || '');
            setStatusSel(String((record as any).status ?? (record as any).STATUS ?? '') || '');
            setEditData(record.DATA || '');
            setEditHorario(record.HORARIO || '');
            setEditCliente(record.CLIENTE || '');
            setEditEndereco((record as any)['ENDEREÇO'] || '');
            setEditTipo(record.TIPO || '');
            setEditPeriodo((record as any)['PERÍODO'] || (record as any)['PERIODO'] || '');
            setEditValor(String(record.VALOR || ''));
            setEditRepasse(String(record.REPASSE || ''));
            setIsEditing(false);
            setSavingHeader('idle');
        }
    }, [record]);

    // Auto-save para STATUS e PROFISSIONAL
    const handleAutoSave = async (field: 'STATUS' | 'PROFISSIONAL', newValue: string) => {
        try {
            setSavingHeader('saving');
            const payload: any = {};
            payload[field] = newValue;

            await updateDataRecord(String(record.id), payload);
            const merged: any = { ...record, [field]: newValue };
            if (onEdit) onEdit(merged as DataRecord);

            setSavingHeader('saved');
            setTimeout(() => setSavingHeader('idle'), 2000);
        } catch (e) {
            console.error('Erro ao salvar:', e);
            setSavingHeader('error');
            setTimeout(() => setSavingHeader('idle'), 3000);
        }
    };

    const renderDetail = (label: string, value: any) => {
        let displayValue = value;
        if (value === null || value === undefined || value === '') {
            displayValue = <span className="text-text-tertiary">-</span>;
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
                <p className="text-xs font-medium text-text-secondary mb-1.5">{label}</p>
                <p className="text-sm text-text-primary">{displayValue}</p>
            </div>
        );
    };

    const renderEditableField = (label: string, value: string, onChange: (val: string) => void, type: 'text' | 'date' | 'time' | 'number' = 'text') => {
        if (!isEditing) {
            // Modo somente leitura
            let displayValue: any = value;
            if (!value || value === '') {
                displayValue = <span className="text-text-tertiary">-</span>;
            } else if (label.toLowerCase().includes('valor') || label.toLowerCase().includes('repasse')) {
                displayValue = Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
            } else if (label === 'Data' && type === 'date' && value.includes('-')) {
                const parts = value.split('-');
                if (parts.length === 3) {
                    displayValue = `${parts[2]}/${parts[1]}/${parts[0]}`;
                }
            } else if (label === 'Horário' && type === 'time') {
                displayValue = formatTimeHM(value);
            } else if (label === 'Período') {
                displayValue = value ? `${value} horas` : '-';
            }
            return (
                <div className="py-2">
                    <p className="text-xs font-medium text-text-secondary mb-1.5">{label}</p>
                    <p className="text-sm text-text-primary">{displayValue}</p>
                </div>
            );
        }

        // Modo edição
        return (
            <div className="py-2">
                <p className="text-xs font-medium text-text-secondary mb-1.5">{label}</p>
                <input
                    type={type}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    className="w-full rounded-lg border border-border-secondary bg-bg-tertiary px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:border-accent-primary focus:outline-none focus:ring-2 focus:ring-accent-primary/20 transition-all"
                    placeholder={label}
                />
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
    const [posVenda, setPosVenda] = useState<string>('');
    const [savingPosVenda, setSavingPosVenda] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
    const [reagendou, setReagendou] = useState<boolean>(false);
    const [savingReagendou, setSavingReagendou] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
    const obsTimer = useRef<any>(null);
    const comentTimer = useRef<any>(null);

    // Sincroniza valores iniciais ao abrir/trocar de registro
    useEffect(() => {
        if (record) {
            setObs(record.observacao || '');
            setComent(record.comentario || '');
            const pv = (record as any)['pos vendas'] ?? '';
            setPosVenda(pv ? String(pv) : '');
            setReagendou((record as any).reagendou === true || (record as any).reagendou === 'true');
            setSavingObs('idle');
            setSavingComent('idle');
            setSavingPosVenda('idle');
            setSavingReagendou('idle');
            setActiveTab('info');
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

    const persistPosVenda = async (value: string) => {
        if (!record || record.id == null) return;
        try {
            setSavingPosVenda('saving');
            const payload: any = { ['pos vendas']: value || null };
            const updated = await updateDataRecord(String(record.id), payload);
            setPosVenda((updated as any)['pos vendas'] ? String((updated as any)['pos vendas']) : '');
            setSavingPosVenda('saved');
        } catch (e) {
            console.error('Falha ao salvar pos vendas:', e);
            setSavingPosVenda('error');
        }
    };

    const persistReagendou = async (value: boolean) => {
        if (!record || record.id == null) return;
        try {
            setSavingReagendou('saving');
            const payload: any = { reagendou: value };
            const updated = await updateDataRecord(String(record.id), payload);
            setReagendou((updated as any).reagendou === true || (updated as any).reagendou === 'true');
            setSavingReagendou('saved');
            setTimeout(() => setSavingReagendou('idle'), 2000);
        } catch (e) {
            console.error('Falha ao salvar reagendou:', e);
            setSavingReagendou('error');
            setTimeout(() => setSavingReagendou('idle'), 3000);
        }
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4" aria-modal="true" role="dialog" onClick={onClose}>
            <div className="w-full max-w-2xl rounded-xl bg-bg-secondary shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
                {/* Header compacto com gradiente */}
                <div className="relative bg-gradient-to-r from-accent-primary/5 to-brand-cyan/5 border-b border-border-secondary px-5 py-3.5">
                    <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-2">
                            <h2 className="text-lg font-bold text-text-primary truncate" title={`${record.ATENDIMENTO_ID ? `ID ${record.ATENDIMENTO_ID} - ` : ''}${record.CLIENTE || 'Detalhes do Atendimento'}`}>
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
                                className="p-1.5 text-text-secondary hover:bg-bg-tertiary rounded-lg flex-shrink-0 transition-colors"
                                aria-label="Copiar confirmação"
                                title="Copiar confirmação"
                            >
                                <Icon name="copy" className="w-3.5 h-3.5" />
                            </button>
                            {copiedClient && (
                                <span className="text-[11px] text-text-tertiary">Copiado!</span>
                            )}
                        </div>

                        <button
                            onClick={onClose}
                            className="text-text-secondary hover:text-text-primary hover:bg-bg-tertiary rounded-lg p-1.5 transition-colors"
                            aria-label="Fechar"
                        >
                            <Icon name="close" className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Tabs com Status e Profissional */}
                <div className="flex items-center gap-4 border-b border-border-secondary px-5">
                    {/* Abas */}
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            className={`px-3 py-2 text-sm transition-colors ${activeTab === 'info' ? 'border-b-2 border-accent-primary text-text-primary' : 'text-text-secondary hover:text-text-primary'}`}
                            onClick={() => setActiveTab('info')}
                        >
                            Detalhes
                        </button>
                        <button
                            type="button"
                            className={`px-3 py-2 text-sm transition-colors ${activeTab === 'posvenda' ? 'border-b-2 border-accent-primary text-text-primary' : 'text-text-secondary hover:text-text-primary'}`}
                            onClick={() => setActiveTab('posvenda')}
                        >
                            Pós-venda
                        </button>
                        <button
                            type="button"
                            className={`px-3 py-2 text-sm transition-colors ${activeTab === 'historico' ? 'border-b-2 border-accent-primary text-text-primary' : 'text-text-secondary hover:text-text-primary'}`}
                            onClick={() => setActiveTab('historico')}
                        >
                            Histórico
                        </button>
                    </div>

                    {/* Status e Profissional - apenas na aba Detalhes */}
                    {activeTab === 'info' && (
                        <div className="ml-auto flex items-center gap-3 py-2">
                            {/* Indicador de salvamento */}
                            {savingHeader !== 'idle' && (
                                <span className="text-[11px] text-text-tertiary min-w-[60px] text-right">
                                    {savingHeader === 'saving' ? 'salvando…' : savingHeader === 'saved' ? '✓ salvo' : '✗ erro'}
                                </span>
                            )}

                            {/* Profissional - ocupa espaço disponível com tamanho fixo controlado */}
                            <div className="flex items-center gap-1 flex-1 max-w-[240px]">
                                <ProfessionalAutocomplete
                                    unitId={(selectedUnit as any)?.id || ''}
                                    value={profissionalSel}
                                    onChange={(nome) => {
                                        setProfissionalSel(nome);
                                        handleAutoSave('PROFISSIONAL', nome);
                                    }}
                                    className="flex-1"
                                    appointmentData={{
                                        data: record.DATA,
                                        horario: record.HORARIO,
                                        periodo: (record as any)['PERÍODO'],
                                        atendimentoId: record.ATENDIMENTO_ID
                                    }}
                                />
                            </div>

                            {/* Status */}
                            <select
                                value={statusSel}
                                onChange={(e) => {
                                    const newValue = e.target.value;
                                    setStatusSel(newValue);
                                    handleAutoSave('STATUS', newValue);
                                }}
                                className="rounded-lg border border-border-secondary bg-bg-tertiary px-3 py-1.5 text-sm text-text-primary focus:border-accent-primary focus:outline-none focus:ring-2 focus:ring-accent-primary/20 transition-all min-w-[120px]"
                            >
                                <option value="">Status</option>
                                <option value="CONFIRMADO">Confirmado</option>
                                <option value="PENDENTE">Pendente</option>
                                <option value="RECUSADO">Recusado</option>
                                <option value="AGUARDANDO">Aguardando</option>
                                <option value="ESPERAR">Esperar</option>
                            </select>
                        </div>
                    )}

                    {/* Navegação de período - apenas na aba Histórico */}
                    {activeTab === 'historico' && (
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
                            <span className="text-xs text-text-secondary min-w-[100px] text-center">
                                {(() => {
                                    if (!selectedPeriod || !/^\d{4}-\d{2}$/.test(selectedPeriod)) return '-';
                                    const [yy, mm] = selectedPeriod.split('-').map(Number);
                                    const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
                                    return `${meses[Math.max(1, Math.min(12, mm)) - 1]}/${yy}`;
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
                                    setSelectedPeriod(`${ny}-${String(nm).padStart(2, '0')}`);
                                }}
                            >›</button>
                        </div>
                    )}
                </div>

                {/* Body com scroll */}
                <div className="max-h-[65vh] overflow-y-auto px-5 py-4">
                    {activeTab === 'info' && (
                        <>
                            {/* Linha 1: DATA, HORÁRIO, DIA DA SEMANA, PERÍODO, TIPO, VALOR */}
                            <div className="grid grid-cols-6 gap-3 mb-3">
                                {renderEditableField('Data', editData, setEditData, 'date')}
                                {renderEditableField('Horário', editHorario, setEditHorario, 'time')}
                                {renderDetail('Dia da Semana', record.DIA)}
                                {renderEditableField('Período', editPeriodo, setEditPeriodo, 'number')}
                                {renderEditableField('Tipo', editTipo, setEditTipo, 'text')}
                                {renderEditableField('Valor (R$)', editValor, setEditValor, 'number')}
                            </div>

                            {/* Linha 2: ENDEREÇO (full width) */}
                            <div className="mb-3">
                                {renderEditableField('Endereço', editEndereco, setEditEndereco, 'text')}
                            </div>

                            {/* Linha 3: OBSERVAÇÃO (full width - auto-save) */}
                            <div className="mb-3">
                                <div className="flex items-center justify-between mb-1.5">
                                    <p className="text-xs font-medium text-text-secondary">Observação</p>
                                    {savingObs !== 'idle' && (
                                        <span className="text-[10px] text-text-tertiary">
                                            {savingObs === 'saving' ? 'salvando…' : savingObs === 'saved' ? '✓ salvo' : '✗ erro'}
                                        </span>
                                    )}
                                </div>
                                <textarea
                                    value={obs}
                                    onChange={(e) => scheduleSave('observacao', e.target.value)}
                                    placeholder="Adicionar observações..."
                                    rows={3}
                                    className="w-full rounded-lg border border-border-secondary bg-bg-tertiary px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:border-accent-primary focus:outline-none focus:ring-2 focus:ring-accent-primary/20 transition-all resize-none"
                                />
                            </div>

                        </>
                    )}

                    {activeTab === 'posvenda' && (
                        <>
                            <div className="space-y-3">
                                {/* Avaliação por Estrelas */}
                                <div>
                                    <div className="flex items-center justify-between mb-1.5">
                                        <label className="text-xs font-medium text-text-secondary">Pós-venda</label>
                                        {savingPosVenda && (
                                            <span className="text-[11px] text-text-tertiary">
                                                {savingPosVenda === 'saving' && 'salvando…'}
                                                {savingPosVenda === 'saved' && 'salvo'}
                                                {savingPosVenda === 'error' && 'erro ao salvar'}
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-6">
                                        {/* Estrelas */}
                                        <div className="flex items-center gap-2">
                                            {[1, 2, 3, 4, 5].map((star) => {
                                                const isSelected = star <= parseInt(posVenda || '0');
                                                return (
                                                    <button
                                                        key={star}
                                                        type="button"
                                                        onClick={() => {
                                                            const newValue = star === parseInt(posVenda) ? '' : String(star);
                                                            setPosVenda(newValue);
                                                            persistPosVenda(newValue);
                                                        }}
                                                        className="group transition-all hover:scale-110 focus:outline-none"
                                                        title={`${star} estrela${star > 1 ? 's' : ''}`}
                                                    >
                                                        <svg
                                                            className={`w-7 h-7 transition-all ${isSelected
                                                                ? 'fill-amber-400 text-amber-400'
                                                                : 'fill-none text-border-secondary group-hover:text-amber-300'
                                                                }`}
                                                            viewBox="0 0 24 24"
                                                            stroke="currentColor"
                                                            strokeWidth="1.5"
                                                            strokeLinecap="round"
                                                            strokeLinejoin="round"
                                                        >
                                                            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                                                        </svg>
                                                    </button>
                                                );
                                            })}
                                        </div>

                                        {/* Reagendou Select */}
                                        <div className="flex items-center gap-2">
                                            <label className="text-sm text-text-secondary whitespace-nowrap">
                                                Reagendou:
                                            </label>
                                            <select
                                                value={reagendou ? 'sim' : 'nao'}
                                                onChange={(e) => {
                                                    const novoValor = e.target.value === 'sim';
                                                    setReagendou(novoValor);
                                                    persistReagendou(novoValor);
                                                }}
                                                className="rounded-lg border border-border-secondary bg-bg-tertiary px-3 py-1.5 text-sm text-text-primary focus:border-accent-primary focus:outline-none focus:ring-2 focus:ring-accent-primary/20 transition-all"
                                            >
                                                <option value="nao">Não</option>
                                                <option value="sim">Sim</option>
                                            </select>
                                            {savingReagendou !== 'idle' && (
                                                <span className="text-[11px] text-text-tertiary">
                                                    {savingReagendou === 'saving' && 'salvando…'}
                                                    {savingReagendou === 'saved' && '✓'}
                                                    {savingReagendou === 'error' && '✗'}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Comentário */}
                                <div>
                                    <div className="flex items-center justify-between mb-1.5">
                                        <label className="text-xs font-medium text-text-secondary">Comentário</label>
                                        {savingComent && (
                                            <span className="text-[11px] text-text-tertiary">
                                                {savingComent === 'saving' && 'salvando…'}
                                                {savingComent === 'saved' && 'salvo'}
                                                {savingComent === 'error' && 'erro ao salvar'}
                                            </span>
                                        )}
                                    </div>
                                    <textarea
                                        value={coment}
                                        onChange={(e) => scheduleSave('comentario', e.target.value)}
                                        placeholder="Adicionar comentários..."
                                        rows={3}
                                        className="w-full rounded-lg border border-border-secondary bg-bg-tertiary px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:border-accent-primary focus:outline-none focus:ring-2 focus:ring-accent-primary/20 transition-all resize-none"
                                    />
                                </div>
                            </div>
                        </>
                    )}

                    {activeTab === 'historico' && (
                        <div className="space-y-3">
                            {loadingHistory ? (
                                <div className="flex items-center justify-center py-8 text-text-secondary text-sm">
                                    <Icon name="Loader2" className="w-4 h-4 animate-spin mr-2" />
                                    Carregando…
                                </div>
                            ) : (
                                <>
                                    <div className="overflow-auto border border-border-secondary rounded-lg">
                                        <table className="min-w-full text-sm">
                                            <thead className="bg-bg-tertiary text-text-secondary">
                                                <tr>
                                                    <th className="px-3 py-2 text-left text-xs font-medium">ID</th>
                                                    <th className="px-3 py-2 text-left text-xs font-medium">Data</th>
                                                    <th className="px-3 py-2 text-left text-xs font-medium">Dia</th>
                                                    <th className="px-3 py-2 text-left text-xs font-medium">Profissional</th>
                                                    <th className="px-3 py-2 text-left text-xs font-medium">Período</th>
                                                    <th className="px-3 py-2 text-left text-xs font-medium">Pós-venda</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {clientHistory.length === 0 ? (
                                                    <tr>
                                                        <td colSpan={6} className="px-3 py-8 text-center text-text-secondary text-sm">
                                                            Sem atendimentos registrados.
                                                        </td>
                                                    </tr>
                                                ) : (
                                                    (() => {
                                                        const startIndex = (currentPage - 1) * itemsPerPage;
                                                        const endIndex = startIndex + itemsPerPage;
                                                        const paginatedHistory = clientHistory.slice(startIndex, endIndex);

                                                        return paginatedHistory.map((histRecord, idx) => {
                                                            const periodo = (histRecord as any)['PERÍODO'] || (histRecord as any)['PERIODO'];
                                                            const posVendaNota = (histRecord as any).pos_vendas_nota || (histRecord as any)['pos vendas'] || '-';

                                                            return (
                                                                <tr
                                                                    key={histRecord.id || idx}
                                                                    className="border-t border-border-secondary/50 hover:bg-accent-primary/5 cursor-pointer transition-colors"
                                                                >
                                                                    <td className="px-3 py-2 text-text-primary font-mono text-xs">{histRecord.ATENDIMENTO_ID || '-'}</td>
                                                                    <td className="px-3 py-2 text-text-primary">
                                                                        {histRecord.DATA ? new Date(histRecord.DATA + 'T00:00:00').toLocaleDateString('pt-BR') : '-'}
                                                                    </td>
                                                                    <td className="px-3 py-2 text-text-secondary">{histRecord.DIA || '-'}</td>
                                                                    <td className="px-3 py-2 text-text-primary">{histRecord.PROFISSIONAL || '-'}</td>
                                                                    <td className="px-3 py-2 text-text-secondary">{periodo ? `${periodo} horas` : '-'}</td>
                                                                    <td className="px-3 py-2">
                                                                        <span className={`inline-block px-2 py-0.5 rounded text-xs ${posVendaNota === 'contatado' ? 'bg-success-color/20 text-success-color' :
                                                                            posVendaNota === 'pendente' ? 'bg-yellow-500/20 text-yellow-500' :
                                                                                'text-text-tertiary'
                                                                            }`}>
                                                                            {posVendaNota}
                                                                        </span>
                                                                    </td>
                                                                </tr>
                                                            );
                                                        });
                                                    })()
                                                )}
                                            </tbody>
                                        </table>
                                    </div>

                                    {/* Paginação */}
                                    {clientHistory.length > itemsPerPage && (
                                        <div className="flex items-center justify-between px-2">
                                            <p className="text-xs text-text-secondary">
                                                Mostrando {Math.min((currentPage - 1) * itemsPerPage + 1, clientHistory.length)} - {Math.min(currentPage * itemsPerPage, clientHistory.length)} de {clientHistory.length} atendimentos
                                            </p>
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                                    disabled={currentPage === 1}
                                                    className="px-3 py-1.5 rounded-lg border border-border-secondary bg-bg-tertiary text-text-secondary hover:bg-bg-secondary disabled:opacity-50 disabled:cursor-not-allowed transition-all text-sm"
                                                >
                                                    Anterior
                                                </button>
                                                <span className="text-sm text-text-secondary">
                                                    Página {currentPage} de {Math.ceil(clientHistory.length / itemsPerPage)}
                                                </span>
                                                <button
                                                    onClick={() => setCurrentPage(p => Math.min(Math.ceil(clientHistory.length / itemsPerPage), p + 1))}
                                                    disabled={currentPage >= Math.ceil(clientHistory.length / itemsPerPage)}
                                                    className="px-3 py-1.5 rounded-lg border border-border-secondary bg-bg-tertiary text-text-secondary hover:bg-bg-secondary disabled:opacity-50 disabled:cursor-not-allowed transition-all text-sm"
                                                >
                                                    Próxima
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer compacto */}
                <div className="flex items-center justify-between border-t border-border-secondary bg-bg-tertiary px-5 py-3">
                    {/* Botões de copiar à esquerda */}
                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={handleCopy}
                            className="flex items-center gap-2 rounded-lg px-3 py-2 border border-border-secondary text-text-secondary hover:bg-bg-secondary focus:outline-none focus:ring-2 focus:ring-accent-primary/20 transition-all"
                            title="Copiar mensagem para profissional"
                        >
                            <Icon name="copy" className="w-4 h-4" />
                            <span className="text-xs font-medium">Profissional</span>
                        </button>
                        {copied && (
                            <span className="text-xs text-success-color font-medium">✓ Copiado!</span>
                        )}

                        <button
                            type="button"
                            onClick={handleCopyClient}
                            className="flex items-center gap-2 rounded-lg px-3 py-2 border border-border-secondary text-text-secondary hover:bg-bg-secondary focus:outline-none focus:ring-2 focus:ring-accent-primary/20 transition-all"
                            title="Copiar mensagem para cliente"
                        >
                            <Icon name="copy" className="w-4 h-4" />
                            <span className="text-xs font-medium">Cliente</span>
                        </button>
                        {copiedClient && (
                            <span className="text-xs text-success-color font-medium">✓ Copiado!</span>
                        )}
                    </div>

                    {/* Botões de ação à direita */}
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => onDelete && onDelete(record)}
                            className="rounded-lg p-2 text-danger hover:bg-danger/10 border border-danger/30 focus:outline-none focus:ring-2 focus:ring-danger/40 transition-all"
                            aria-label="Excluir"
                            title="Excluir atendimento"
                        >
                            <Icon name="delete" className="w-5 h-5" />
                        </button>
                        <button
                            type="button"
                            onClick={async () => {
                                // Se não está em modo edição, ativa o modo
                                if (!isEditing && !hasHeaderChanges) {
                                    setIsEditing(true);
                                    return;
                                }

                                // Se está em modo edição ou há mudanças, salvar
                                if (hasHeaderChanges) {
                                    try {
                                        setSavingHeader('saving');
                                        const payload: any = {};

                                        // Campos básicos (STATUS e PROFISSIONAL agora têm auto-save)
                                        if (editData !== (record.DATA || '')) payload['DATA'] = editData;
                                        if (editHorario !== (record.HORARIO || '')) payload['HORARIO'] = editHorario;
                                        if (editCliente !== (record.CLIENTE || '')) payload['CLIENTE'] = editCliente;
                                        if (editEndereco !== ((record as any)['ENDEREÇO'] || '')) payload['ENDEREÇO'] = editEndereco;
                                        if (editTipo !== (record.TIPO || '')) payload['TIPO'] = editTipo;
                                        if (editPeriodo !== ((record as any)['PERÍODO'] || (record as any)['PERIODO'] || '')) payload['PERÍODO'] = editPeriodo;
                                        if (editValor !== String(record.VALOR || '')) payload['VALOR'] = parseFloat(editValor) || 0;
                                        if (editRepasse !== String(record.REPASSE || '')) payload['REPASSE'] = parseFloat(editRepasse) || 0;

                                        if (Object.keys(payload).length > 0) {
                                            const updated = await updateDataRecord(String(record.id), payload);
                                            const merged: any = { ...record, ...payload };
                                            if (onEdit) onEdit(merged as DataRecord);
                                        }
                                        setSavingHeader('saved');
                                        setIsEditing(false);

                                        // Limpa o status "salvo" após 2 segundos
                                        setTimeout(() => setSavingHeader('idle'), 2000);
                                    } catch (e) {
                                        console.error('Falha ao salvar:', e);
                                        setSavingHeader('error');
                                    }
                                    return;
                                }

                                // Se não há mudanças, apenas desativa o modo edição
                                setIsEditing(false);
                            }}
                            className="rounded-lg bg-accent-primary p-2.5 text-white hover:bg-accent-primary/90 focus:outline-none focus:ring-2 focus:ring-accent-primary transition-all shadow-lg shadow-accent-primary/20"
                            aria-label={(isEditing || hasHeaderChanges) ? 'Salvar' : 'Editar'}
                            title={(isEditing || hasHeaderChanges) ? 'Salvar' : 'Editar'}
                        >
                            {savingHeader === 'saving' ? (
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                            ) : (
                                <Icon name={(isEditing || hasHeaderChanges) ? 'check' : 'edit'} className="w-4 h-4" />
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DataDetailModal;