import React, { useEffect, useState } from 'react';
import type { ComercialAdminCard, Plan } from '../../types';
import { supabase } from '../../services/supabaseClient';
import { activityLogger } from '../../services/utils/activityLogger.service';
import { useAuth } from '../../contexts/AuthContext';
import { useAppContext } from '../../contexts/AppContext';
import { Icon } from './Icon';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onSaved: () => void;
    defaultStatus: string;
    unitId?: string;
    initialCard?: ComercialAdminCard | null;
    onDelete?: (id: string) => Promise<void>;
    onCreate?: (payload: Partial<ComercialAdminCard>) => Promise<void>;
    onUpdate?: (id: string, payload: Partial<ComercialAdminCard>) => Promise<void>;
}

const STATUS_OPTIONS = [
    { value: 'leads', label: 'Leads' },
    { value: 'andamento', label: 'Em Andamento' },
    { value: 'ganhos', label: 'Ganhos' },
    { value: 'perdidos', label: 'Perdidos' },
];

const ORIGEM_OPTIONS = ['Whatsapp', 'Ligação', 'E-mail', 'Indicação', 'Site', 'Outros'];

const ComercialAdminCardModal: React.FC<Props> = ({
    isOpen,
    onClose,
    onSaved,
    defaultStatus,
    unitId,
    initialCard,
    onDelete,
    onCreate,
    onUpdate,
}) => {
    const { profile } = useAuth();
    const { selectedUnit } = useAppContext();

    // Form State
    const [nome, setNome] = useState('');
    const [endereco, setEndereco] = useState('');
    const [contato, setContato] = useState('');
    const [origem, setOrigem] = useState('');
    const [status, setStatus] = useState(defaultStatus);
    const [observacao, setObservacao] = useState('');

    // New Admin Fields
    const [planoId, setPlanoId] = useState<string>('');
    const [dataInicioTeste, setDataInicioTeste] = useState('');
    const [dataFimTeste, setDataFimTeste] = useState('');

    // Data State
    const [plans, setPlans] = useState<Plan[]>([]);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isEditing, setIsEditing] = useState(false);

    // Load Plans
    useEffect(() => {
        const fetchPlans = async () => {
            const { data } = await supabase
                .from('plans')
                .select('*')
                .eq('status', true)
                .order('value', { ascending: true });
            if (data) setPlans(data as Plan[]);
        };
        if (isOpen) fetchPlans();
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) return;
        setError(null);
        setSaving(false);
        setIsEditing(!initialCard);

        if (initialCard) {
            setNome(initialCard.nome || '');
            setEndereco(initialCard.endereco || '');
            setContato(initialCard.contato || '');
            setOrigem(initialCard.origem || '');
            setStatus(initialCard.status || defaultStatus);
            setObservacao(initialCard.observacao || '');
            setPlanoId(initialCard.plano_id || '');
            setDataInicioTeste(initialCard.data_inicio_teste || '');
            setDataFimTeste(initialCard.data_fim_teste || '');
        } else {
            resetForm();
        }
    }, [isOpen, initialCard, defaultStatus]);

    const resetForm = () => {
        setNome('');
        setEndereco('');
        setContato('');
        setOrigem('');
        setStatus(defaultStatus);
        setObservacao('');
        setPlanoId('');
        setDataInicioTeste('');
        setDataFimTeste('');
    };

    // Auto-save handlers
    const handleAutoSave = async (field: keyof ComercialAdminCard, value: any) => {
        if (initialCard && onUpdate) {
            try {
                await onUpdate(initialCard.id, { [field]: value });
            } catch (e: any) {
                console.error(`Falha ao salvar ${field}:`, e);
            }
        }
    };

    const handleSave = async () => {
        if (!nome.trim()) {
            setError('Informe o nome do cliente.');
            return;
        }

        // Validate dates
        if (dataInicioTeste && dataFimTeste && dataFimTeste < dataInicioTeste) {
            setError('A data final do teste deve ser maior ou igual à data inicial.');
            return;
        }

        if (saving) return;
        setSaving(true);
        setError(null);

        try {
            const payload: Partial<ComercialAdminCard> = {
                nome: nome.trim(),
                endereco: endereco.trim() || null,
                contato: contato.trim() || null,
                origem: origem.trim() || null,
                status,
                observacao: observacao.trim() || null,
                plano_id: planoId || null,
                data_inicio_teste: dataInicioTeste || null,
                data_fim_teste: dataFimTeste || null,
            };

            if (initialCard && onUpdate) {
                await onUpdate(initialCard.id, payload);
                setIsEditing(false);
            } else if (!initialCard && onCreate) {
                if (!unitId) throw new Error('Unit ID missing');
                payload.unit_id = unitId;
                await onCreate(payload);

                // Log creation
                if (profile && selectedUnit) {
                    activityLogger.logComercialCreate(
                        profile.email || profile.full_name,
                        selectedUnit?.unit_name || 'Unit',
                        'success'
                    );
                }
            }

            onSaved();
            if (!initialCard) onClose();
        } catch (e: any) {
            setError(e.message || 'Falha ao salvar.');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!initialCard || !onDelete || saving) return;
        if (!confirm('Excluir este card permanentemente?')) return;

        setSaving(true);
        try {
            await onDelete(initialCard.id);
            onSaved();
            onClose();
        } catch (e: any) {
            setError(e.message);
        } finally {
            setSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
            <div className="w-full max-w-2xl rounded-xl bg-bg-secondary shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="bg-gradient-to-r from-accent-primary/10 to-brand-cyan/5 border-b border-border-secondary px-5 py-4 shrink-0">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-bold text-text-primary flex items-center gap-2">
                            <Icon name="Building2" className="w-5 h-5 text-accent-primary" />
                            {initialCard ? 'Cliente B2B' : 'Novo Cliente B2B'}
                        </h2>
                        <div className="flex items-center gap-3">
                            <select
                                value={status}
                                onChange={e => {
                                    setStatus(e.target.value);
                                    handleAutoSave('status', e.target.value);
                                }}
                                className="rounded-lg border border-border-secondary bg-bg-tertiary px-3 py-1.5 text-sm text-text-primary focus:border-accent-primary focus:outline-none"
                            >
                                {STATUS_OPTIONS.map(opt => (
                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                ))}
                            </select>
                            <button onClick={onClose} className="text-text-secondary hover:text-text-primary p-1">
                                <Icon name="close" className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto px-6 py-6 space-y-5">
                    {error && (
                        <div className="rounded-lg border border-danger/40 bg-danger/10 p-3 text-sm text-danger flex items-center gap-2">
                            <Icon name="alert" className="w-4 h-4" />
                            {error}
                        </div>
                    )}

                    {/* Dados Principais */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="md:col-span-2">
                            <label className="block text-xs font-medium text-text-secondary mb-1">
                                Nome do Cliente <span className="text-danger">*</span>
                            </label>
                            {isEditing ? (
                                <input
                                    value={nome}
                                    onChange={e => setNome(e.target.value)}
                                    className="w-full rounded-lg border border-border-secondary bg-bg-tertiary px-3 py-2 text-sm text-text-primary focus:border-accent-primary focus:outline-none"
                                    placeholder="Ex: Empresa LTDA"
                                    autoFocus
                                />
                            ) : (
                                <p className="text-base font-semibold text-text-primary">{nome}</p>
                            )}
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-text-secondary mb-1">Contato</label>
                            {isEditing ? (
                                <input
                                    value={contato}
                                    onChange={e => setContato(e.target.value)}
                                    className="w-full rounded-lg border border-border-secondary bg-bg-tertiary px-3 py-2 text-sm text-text-primary focus:border-accent-primary focus:outline-none"
                                    placeholder="Telefone / Whatsapp"
                                />
                            ) : (
                                <p className="text-sm text-text-primary">{contato || '-'}</p>
                            )}
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-text-secondary mb-1">Origem</label>
                            <div className="relative">
                                <select
                                    value={origem}
                                    onChange={e => {
                                        setOrigem(e.target.value);
                                        if (!isEditing) handleAutoSave('origem', e.target.value);
                                    }}
                                    className="w-full appearance-none rounded-lg border border-border-secondary bg-bg-tertiary px-3 py-2 text-sm text-text-primary focus:border-accent-primary focus:outline-none"
                                >
                                    <option value="">Selecione...</option>
                                    {ORIGEM_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                </select>
                                <Icon name="ChevronDown" className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary pointer-events-none" />
                            </div>
                        </div>

                        <div className="md:col-span-2">
                            <label className="block text-xs font-medium text-text-secondary mb-1">Endereço</label>
                            {isEditing ? (
                                <input
                                    value={endereco}
                                    onChange={e => setEndereco(e.target.value)}
                                    className="w-full rounded-lg border border-border-secondary bg-bg-tertiary px-3 py-2 text-sm text-text-primary focus:border-accent-primary focus:outline-none"
                                    placeholder="Endereço completo"
                                />
                            ) : (
                                <p className="text-sm text-text-primary">{endereco || '-'}</p>
                            )}
                        </div>
                    </div>

                    <div className="h-px bg-border-secondary" />

                    {/* Dados Comerciais (Plano & Teste) */}
                    <div>
                        <h3 className="text-sm font-semibold text-text-primary mb-3">Plano & Teste</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="md:col-span-2">
                                <label className="block text-xs font-medium text-text-secondary mb-1">Plano Selecionado</label>
                                <div className="relative">
                                    <select
                                        value={planoId}
                                        onChange={e => {
                                            setPlanoId(e.target.value);
                                            if (!isEditing) handleAutoSave('plano_id', e.target.value || null);
                                        }}
                                        className="w-full appearance-none rounded-lg border border-border-secondary bg-bg-tertiary px-3 py-2 text-sm text-text-primary focus:border-accent-primary focus:outline-none"
                                    >
                                        <option value="">Sem plano selecionado</option>
                                        {plans.map(plan => (
                                            <option key={plan.id} value={plan.id}>
                                                {plan.name} - R$ {plan.value}/{plan.cycle === 'monthly' ? 'mês' : 'ano'}
                                            </option>
                                        ))}
                                    </select>
                                    <Icon name="ChevronDown" className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary pointer-events-none" />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-text-secondary mb-1">Início do Teste</label>
                                <input
                                    type="date"
                                    value={dataInicioTeste}
                                    onChange={e => {
                                        setDataInicioTeste(e.target.value);
                                        if (!isEditing) handleAutoSave('data_inicio_teste', e.target.value || null);
                                    }}
                                    className="w-full rounded-lg border border-border-secondary bg-bg-tertiary px-3 py-2 text-sm text-text-primary focus:border-accent-primary focus:outline-none"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-text-secondary mb-1">Fim do Teste</label>
                                <input
                                    type="date"
                                    value={dataFimTeste}
                                    onChange={e => {
                                        setDataFimTeste(e.target.value);
                                        if (!isEditing) handleAutoSave('data_fim_teste', e.target.value || null);
                                    }}
                                    className="w-full rounded-lg border border-border-secondary bg-bg-tertiary px-3 py-2 text-sm text-text-primary focus:border-accent-primary focus:outline-none"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="h-px bg-border-secondary" />

                    {/* Observações */}
                    <div>
                        <label className="block text-xs font-medium text-text-secondary mb-1">Observações</label>
                        <textarea
                            value={observacao}
                            onChange={e => {
                                setObservacao(e.target.value);
                                if (!isEditing) handleAutoSave('observacao', e.target.value);
                            }}
                            rows={3}
                            className="w-full rounded-lg border border-border-secondary bg-bg-tertiary px-3 py-2 text-sm text-text-primary focus:border-accent-primary focus:outline-none resize-none"
                            placeholder="Anotações internas..."
                        />
                    </div>
                </div>

                {/* Footer */}
                <div className="border-t border-border-secondary bg-bg-tertiary px-6 py-4 shrink-0 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        {initialCard && onDelete && (
                            <button
                                type="button"
                                onClick={handleDelete}
                                disabled={saving}
                                className="p-2 text-danger hover:bg-danger/10 rounded-lg transition-colors"
                                title="Excluir"
                            >
                                <Icon name="Trash2" className="w-5 h-5" />
                            </button>
                        )}
                    </div>
                    <button
                        type="button"
                        onClick={() => isEditing ? handleSave() : setIsEditing(true)}
                        disabled={saving}
                        className="flex items-center gap-2 bg-accent-primary text-text-on-accent px-5 py-2 rounded-lg hover:bg-accent-primary/90 transition-colors shadow-lg shadow-accent-primary/20"
                    >
                        {saving ? (
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                            <>
                                <Icon name={isEditing ? "Check" : "Pencil"} className="w-4 h-4" />
                                <span>{isEditing ? 'Salvar' : 'Editar'}</span>
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ComercialAdminCardModal;
