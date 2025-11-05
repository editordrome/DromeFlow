import React, { useEffect, useMemo, useRef, useState } from 'react';
import { DataRecord } from '../../types';
import { Icon } from './Icon';
import { updateDataRecord } from '../../services/data/dataTable.service';
import { useAppContext } from '../../contexts/AppContext';
import { fetchProfissionais, Profissional } from '../../services/profissionais/profissionais.service';
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
    const [profissionais, setProfissionais] = useState<Profissional[]>([]);
    const [clientHistory, setClientHistory] = useState<ClientHistoryRecord[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(false);
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
        const recStatus = String((record as any).status ?? (record as any).STATUS ?? '') || '';
        return (
            profissionalSel !== (record.PROFISSIONAL || '') ||
            statusSel !== recStatus ||
            editData !== (record.DATA || '') ||
            editHorario !== (record.HORARIO || '') ||
            editCliente !== (record.CLIENTE || '') ||
            editEndereco !== ((record as any)['ENDEREÇO'] || '') ||
            editTipo !== (record.TIPO || '') ||
            editPeriodo !== ((record as any)['PERÍODO'] || (record as any)['PERIODO'] || '') ||
            editValor !== String(record.VALOR || '') ||
            editRepasse !== String(record.REPASSE || '')
        );
    }, [profissionalSel, statusSel, editData, editHorario, editCliente, editEndereco, editTipo, editPeriodo, editValor, editRepasse, record]);

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

    // Carrega histórico do cliente quando a aba historico é ativada ou o período muda
    useEffect(() => {
        if (activeTab === 'historico' && record && record.CLIENTE && selectedUnit) {
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

    const renderEditableField = (label: string, value: string, onChange: (val: string) => void, type: 'text' | 'date' | 'time' | 'number' = 'text') => {
        if (!isEditing) {
            // Modo somente leitura
            let displayValue: any = value;
            if (!value || value === '') {
                displayValue = <span className="text-gray-400">N/A</span>;
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
                    <p className="text-xs font-semibold uppercase text-text-secondary tracking-wider">{label}</p>
                    <p className="text-md text-text-primary">{displayValue}</p>
                </div>
            );
        }

        // Modo edição
        return (
            <div className="py-2">
                <p className="text-xs font-semibold uppercase text-text-secondary tracking-wider">{label}</p>
                <input
                    type={type}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    className="mt-1 w-full rounded-md border border-border-secondary bg-bg-tertiary p-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-primary/60"
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
    const obsTimer = useRef<any>(null);
    const comentTimer = useRef<any>(null);

    // Sincroniza valores iniciais ao abrir/trocar de registro
    useEffect(() => {
        if (record) {
            setObs(record.observacao || '');
            setComent(record.comentario || '');
            const pv = (record as any)['pos vendas'] ?? '';
            setPosVenda(pv ? String(pv) : '');
            setSavingObs('idle');
            setSavingComent('idle');
            setSavingPosVenda('idle');
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
                {/* Tabs */}
                <div className="mt-4 flex items-center gap-2 border-b border-border-secondary">
                    <button
                        type="button"
                        className={`px-3 py-2 text-sm ${activeTab==='info' ? 'border-b-2 border-accent-primary text-text-primary' : 'text-text-secondary hover:text-text-primary'}`}
                        onClick={() => setActiveTab('info')}
                    >
                        Detalhes
                    </button>
                    <button
                        type="button"
                        className={`px-3 py-2 text-sm ${activeTab==='posvenda' ? 'border-b-2 border-accent-primary text-text-primary' : 'text-text-secondary hover:text-text-primary'}`}
                        onClick={() => setActiveTab('posvenda')}
                    >
                        Pós-venda
                    </button>
                    <button
                        type="button"
                        className={`px-3 py-2 text-sm ${activeTab==='historico' ? 'border-b-2 border-accent-primary text-text-primary' : 'text-text-secondary hover:text-text-primary'}`}
                        onClick={() => setActiveTab('historico')}
                    >
                        Histórico
                    </button>
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
                            <span className="text-xs text-text-secondary min-w-[140px] text-center">
                                {(() => {
                                    if (!selectedPeriod || !/^\d{4}-\d{2}$/.test(selectedPeriod)) return '-';
                                    const [yy, mm] = selectedPeriod.split('-').map(Number);
                                    const meses = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
                                    return `${meses[Math.max(1, Math.min(12, mm)) - 1]} ${yy}`;
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

                <div className="mt-4 space-y-4 pr-2 overflow-y-auto">
                {activeTab === 'info' && (
                <>
                {/* Linha 1: DATA, HORÁRIO, DIA DA SEMANA, VALOR, STATUS */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-x-6">
                    {renderEditableField('Data', editData, setEditData, 'date')}
                    {renderEditableField('Horário', editHorario, setEditHorario, 'time')}
                    {renderDetail('Dia da Semana', record.DIA)}
                    {renderEditableField('Valor (R$)', editValor, setEditValor, 'number')}
                    <div className="py-2">
                        <p className="text-xs font-semibold uppercase text-text-secondary tracking-wider flex items-center justify-between">
                            Status
                            <span className="text-[11px] text-text-tertiary">{savingHeader === 'saving' ? 'salvando…' : savingHeader === 'saved' ? 'salvo' : savingHeader === 'error' ? 'erro' : ''}</span>
                        </p>
                        <select
                            className="mt-1 w-full rounded-md border border-border-secondary bg-bg-tertiary p-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-primary/60"
                            value={statusSel}
                            onChange={(e) => setStatusSel(e.target.value)}
                            disabled={!isEditing}
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

                {/* Linha 2: CLIENTE e ENDEREÇO */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
                    {renderEditableField('Cliente', editCliente, setEditCliente, 'text')}
                    {renderEditableField('Endereço', editEndereco, setEditEndereco, 'text')}
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
                                                disabled={!isEditing}
                                            >
                                                <option value="">Selecione</option>
                                                {profissionais.map(p => (
                                                    <option key={p.id} value={p.nome || ''}>{p.nome}</option>
                                                ))}
                                            </select>
                                        </div>
                                        {renderEditableField('Repasse (R$)', editRepasse, setEditRepasse, 'number')}
                                        {renderEditableField('Tipo', editTipo, setEditTipo, 'text')}
                                        {renderEditableField('Período', editPeriodo, setEditPeriodo, 'number')}
                                </div>

                                {/* Linha 4 removida (Data de Cadastro, Cupom, Origem) */}
                                                                         {/* Campos editáveis (Observação apenas nesta aba) */}
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
                                     </div>
                                </>
                                )}

                                {activeTab === 'posvenda' && (
                                    <>
                                        <div className="grid grid-cols-1 gap-4 mt-2">
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
                                            <div>
                                                <div className="flex items-center justify-between">
                                                    <p className="text-xs font-semibold uppercase text-text-secondary tracking-wider">Pós-venda</p>
                                                    <span className="text-[11px] text-text-tertiary">
                                                        {savingPosVenda === 'saving' ? 'salvando…' : savingPosVenda === 'saved' ? 'salvo' : savingPosVenda === 'error' ? 'erro ao salvar' : ''}
                                                    </span>
                                                </div>
                                                <select
                                                    className="mt-1 w-full rounded-md border border-border-secondary bg-bg-tertiary p-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-primary/60"
                                                    value={posVenda}
                                                    onChange={(e) => { setPosVenda(e.target.value); persistPosVenda(e.target.value); }}
                                                >
                                                    <option value="">Selecione</option>
                                                    <option value="1">1</option>
                                                    <option value="2">2</option>
                                                    <option value="3">3</option>
                                                    <option value="4">4</option>
                                                    <option value="5">5</option>
                                                </select>
                                            </div>
                                        </div>
                                    </>
                                )}

                                {activeTab === 'historico' && (
                                    <div className="mt-2">
                                        {loadingHistory ? (
                                            <div className="flex items-center justify-center py-8">
                                                <div className="w-8 h-8 border-4 border-gray-200 border-t-accent-primary rounded-full animate-spin" />
                                            </div>
                                        ) : (
                                            <div className="overflow-auto border border-white/10 rounded-md">
                                                <table className="min-w-full text-sm">
                                                    <thead className="bg-bg-tertiary text-text-secondary">
                                                        <tr>
                                                            <th className="px-3 py-2 text-left">ID</th>
                                                            <th className="px-3 py-2 text-left">Data</th>
                                                            <th className="px-3 py-2 text-left">Dia</th>
                                                            <th className="px-3 py-2 text-left">Período</th>
                                                            <th className="px-3 py-2 text-left">Pós-venda</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {clientHistory.length === 0 ? (
                                                            <tr>
                                                                <td colSpan={5} className="px-3 py-4 text-center text-text-secondary">
                                                                    Sem atendimentos registrados.
                                                                </td>
                                                            </tr>
                                                        ) : (
                                                            clientHistory.map((histRecord, idx) => {
                                                                const periodo = (histRecord as any)['PERÍODO'] || (histRecord as any)['PERIODO'];
                                                                const posVendaNota = (histRecord as any).pos_vendas_nota || (histRecord as any)['pos vendas'] || '-';
                                                                
                                                                return (
                                                                    <tr 
                                                                        key={histRecord.id || idx} 
                                                                        className="border-t border-white/5 hover:bg-white/5 cursor-pointer"
                                                                    >
                                                                        <td className="px-3 py-2 text-text-primary">{histRecord.ATENDIMENTO_ID || '-'}</td>
                                                                        <td className="px-3 py-2">
                                                                            {histRecord.DATA ? new Date(histRecord.DATA + 'T00:00:00').toLocaleDateString('pt-BR') : '-'}
                                                                        </td>
                                                                        <td className="px-3 py-2">{histRecord.DIA || '-'}</td>
                                                                        <td className="px-3 py-2">{periodo ? `${periodo} horas` : '-'}</td>
                                                                        <td className="px-3 py-2">{posVendaNota}</td>
                                                                    </tr>
                                                                );
                                                            })
                                                        )}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}
                                    </div>
                                )}
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
                                    
                                    // Campos básicos
                                    if (editData !== (record.DATA || '')) payload['DATA'] = editData;
                                    if (editHorario !== (record.HORARIO || '')) payload['HORARIO'] = editHorario;
                                    if (editCliente !== (record.CLIENTE || '')) payload['CLIENTE'] = editCliente;
                                    if (editEndereco !== ((record as any)['ENDEREÇO'] || '')) payload['ENDEREÇO'] = editEndereco;
                                    if (editTipo !== (record.TIPO || '')) payload['TIPO'] = editTipo;
                                    if (editPeriodo !== ((record as any)['PERÍODO'] || (record as any)['PERIODO'] || '')) payload['PERÍODO'] = editPeriodo;
                                    if (editValor !== String(record.VALOR || '')) payload['VALOR'] = parseFloat(editValor) || 0;
                                    if (editRepasse !== String(record.REPASSE || '')) payload['REPASSE'] = parseFloat(editRepasse) || 0;
                                    if (profissionalSel !== (record.PROFISSIONAL || '')) payload['PROFISSIONAL'] = profissionalSel;
                                    
                                    const recStatus = String((record as any).status ?? (record as any).STATUS ?? '') || '';
                                    if (statusSel !== recStatus) payload['STATUS'] = statusSel;
                                    
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