import React, { useEffect, useState } from 'react';
import type { ComercialAdminCard, Plan, Unit } from '../../types';
import { supabase } from '../../services/supabaseClient';
import { activityLogger } from '../../services/utils/activityLogger.service';
import { useAuth } from '../../contexts/AuthContext';
import { useAppContext } from '../../contexts/AppContext';
import { Icon } from './Icon';
import { triggerUmblerOrgWebhook } from '../../services/comercial-admin/comercial-admin.service';

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

const PRODUCAO_STATUS_OPTIONS = ['Pendente', 'Em Produção', 'Aguardando Cliente', 'Finalizado', 'Entregue'];

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
    const [contato, setContato] = useState('');
    const [origem, setOrigem] = useState('');
    const [status, setStatus] = useState(defaultStatus);
    const [observacao, setObservacao] = useState('');
    const [unidadePrincipal, setUnidadePrincipal] = useState('Cliente B2B');

    // Admin Fields
    const [planoId, setPlanoId] = useState<string>('');
    const [linkedUnitId, setLinkedUnitId] = useState<string>('');

    // Checklist & Production
    const [checkCadastroUnidade, setCheckCadastroUnidade] = useState(false);
    const [checkStatusPagamento, setCheckStatusPagamento] = useState(false);
    const [checkRecrutadora, setCheckRecrutadora] = useState(false);
    const [checkUmbler, setCheckUmbler] = useState(false);
    const [producaoStatus, setProducaoStatus] = useState('Pendente');

    // Data State
    const [plans, setPlans] = useState<Plan[]>([]);
    const [allUnits, setAllUnits] = useState<Unit[]>([]);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [isTriggering, setIsTriggering] = useState(false);
    const [showOrigemSuggestions, setShowOrigemSuggestions] = useState(false);
    const [filteredOrigemOptions, setFilteredOrigemOptions] = useState<string[]>(ORIGEM_OPTIONS);

    // Load Plans and Units
    useEffect(() => {
        const fetchData = async () => {
            const [plansRes, unitsRes] = await Promise.all([
                supabase.from('plans').select('*').eq('status', true).order('value', { ascending: true }),
                supabase.from('units').select('id, unit_name').eq('is_active', true).order('unit_name', { ascending: true })
            ]);
            
            if (plansRes.data) setPlans(plansRes.data as Plan[]);
            if (unitsRes.data) setAllUnits(unitsRes.data as Unit[]);
        };
        if (isOpen) fetchData();
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) return;
        setError(null);
        setSaving(false);
        setIsEditing(!initialCard);

        if (initialCard) {
            setNome(initialCard.nome || '');
            setContato(initialCard.contato || '');
            setOrigem(initialCard.origem || '');
            setStatus(initialCard.status || defaultStatus);
            setPlanoId(initialCard.plano_id || '');
            setLinkedUnitId(initialCard.linked_unit_id || '');
            
            // Production State
            setCheckCadastroUnidade(initialCard.check_cadastro_unidade || false);
            setCheckStatusPagamento(initialCard.check_status_pagamento || false);
            setCheckRecrutadora(initialCard.check_recrutadora || false);
            setCheckUmbler(initialCard.check_umbler || false);
            setProducaoStatus(initialCard.producao_status || 'Pendente');

            let initialObs = initialCard.observacao || '';
            let parsedTitle = 'Cliente B2B';

            if (initialCard.nome_unidade) {
                const parts = initialCard.nome_unidade.split(',').map(s => s.trim()).filter(Boolean);
                if (parts.length > 0) {
                    parsedTitle = parts[0];
                }
                if (parts.length > 1) {
                    const extras = parts.slice(1).join(', ');
                    const extrasMsg = `Outras unidades: ${extras}`;
                    if (!initialObs.includes(extrasMsg)) {
                        initialObs = initialObs ? `${initialObs}\n\n${extrasMsg}` : extrasMsg;
                    }
                }
            }
            
            setObservacao(initialObs);
            setUnidadePrincipal(parsedTitle);
        } else {
            resetForm();
        }
    }, [isOpen, initialCard, defaultStatus]);

    const resetForm = () => {
        setNome('');
        setContato('');
        setOrigem('');
        setStatus(defaultStatus);
        setObservacao('');
        setUnidadePrincipal('Cliente B2B');
        setPlanoId('');
        setLinkedUnitId('');
        setCheckCadastroUnidade(false);
        setCheckStatusPagamento(false);
        setCheckRecrutadora(false);
        setCheckUmbler(false);
        setProducaoStatus('Pendente');
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

        if (saving) return;
        setSaving(true);
        setError(null);

        try {
            const payload: Partial<ComercialAdminCard> = {
                nome: nome.trim(),
                contato: contato.trim() || null,
                origem: origem.trim() || null,
                status,
                observacao: observacao.trim() || null,
                plano_id: planoId || null,
                linked_unit_id: linkedUnitId || null,
                check_cadastro_unidade: checkCadastroUnidade,
                check_status_pagamento: checkStatusPagamento,
                check_recrutadora: checkRecrutadora,
                check_umbler: checkUmbler,
                producao_status: producaoStatus,
            };

            if (initialCard && onUpdate) {
                await onUpdate(initialCard.id, payload);
                setIsEditing(false);
            } else if (!initialCard && onCreate) {
                payload.unit_id = unitId || null;
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

    const handleTriggerWebhook = async () => {
        if (!initialCard) return;
        if (isTriggering) return;

        setIsTriggering(true);
        setError(null);

        try {
            await triggerUmblerOrgWebhook({
                ...initialCard,
                nome,
                contato,
                origem,
                status,
                plano_id: planoId,
                linked_unit_id: linkedUnitId,
                check_cadastro_unidade: checkCadastroUnidade,
                check_status_pagamento: checkStatusPagamento,
                check_recrutadora: checkRecrutadora,
                check_umbler: checkUmbler,
                producao_status: producaoStatus
            });
            alert('Dados enviados para Umbler com sucesso!');
        } catch (e: any) {
            setError(`Erro ao enviar para Umbler: ${e.message}`);
        } finally {
            setIsTriggering(false);
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4" onClick={onClose}>
            <div className="w-full max-w-2xl rounded-xl bg-bg-secondary shadow-2xl overflow-hidden flex flex-col max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div className="bg-gradient-to-r from-accent-primary/10 to-brand-cyan/5 border-b border-border-secondary px-5 py-4 shrink-0">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-bold text-text-primary flex items-center gap-2">
                            <Icon name="Building2" className="w-5 h-5 text-accent-primary" />
                            {initialCard ? unidadePrincipal : 'Novo Cliente B2B'}
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
                                <input
                                    type="text"
                                    value={origem}
                                    onChange={e => {
                                        const value = e.target.value;
                                        setOrigem(value);
                                        const filtered = ORIGEM_OPTIONS.filter(opt =>
                                            opt.toLowerCase().includes(value.toLowerCase())
                                        );
                                        setFilteredOrigemOptions(filtered);
                                        setShowOrigemSuggestions(true);
                                        if (!isEditing) handleAutoSave('origem', value);
                                    }}
                                    onFocus={() => {
                                        setFilteredOrigemOptions(ORIGEM_OPTIONS);
                                        setShowOrigemSuggestions(true);
                                    }}
                                    onBlur={() => {
                                        setTimeout(() => setShowOrigemSuggestions(false), 200);
                                    }}
                                    className="w-full rounded-lg border border-border-secondary bg-bg-tertiary px-3 py-2 text-sm text-text-primary focus:border-accent-primary focus:outline-none"
                                    placeholder="Digite ou selecione a origem"
                                />
                                {showOrigemSuggestions && filteredOrigemOptions.length > 0 && (
                                    <div className="absolute z-50 w-full mt-1 bg-bg-secondary border border-border-secondary rounded-lg shadow-lg max-h-48 overflow-y-auto">
                                        {filteredOrigemOptions.map(opt => (
                                            <button
                                                key={opt}
                                                type="button"
                                                onClick={() => {
                                                    setOrigem(opt);
                                                    setShowOrigemSuggestions(false);
                                                    if (!isEditing) handleAutoSave('origem', opt);
                                                }}
                                                className="w-full text-left px-3 py-2 text-sm text-text-primary hover:bg-accent-primary/10 transition-colors"
                                            >
                                                {opt}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="h-px bg-border-secondary" />

                    {/* Controle de Produção */}
                    <div>
                        <h3 className="text-sm font-semibold text-text-primary mb-4 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Icon name="Settings" className="w-4 h-4 text-accent-primary" />
                                Controle de Produção
                            </div>

                            {status === 'ganhos' && initialCard && (
                                <button
                                    onClick={handleTriggerWebhook}
                                    disabled={isTriggering}
                                    className={`
                                        flex items-center gap-1.5 px-3 py-1 rounded-lg text-[10px] font-bold uppercase transition-all
                                        ${isTriggering 
                                            ? 'bg-bg-tertiary text-text-tertiary cursor-wait' 
                                            : 'bg-brand-cyan/10 text-brand-cyan hover:bg-brand-cyan hover:text-bg-primary border border-brand-cyan/20'}
                                    `}
                                >
                                    {isTriggering ? (
                                        <div className="w-3 h-3 border-2 border-text-tertiary/30 border-t-text-tertiary rounded-full animate-spin" />
                                    ) : (
                                        <Icon name="Rocket" className="w-3 h-3" />
                                    )}
                                    <span>{isTriggering ? 'Enviando...' : 'Enviar p/ Umbler'}</span>
                                </button>
                            )}
                        </h3>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-bg-tertiary/50 p-4 rounded-xl border border-border-secondary/50">
                            {/* Checklist */}
                            <div className="space-y-3">
                                <label className="block text-[10px] font-bold text-text-tertiary uppercase tracking-widest mb-2">Checklist de Implantação</label>
                                {[
                                    { label: 'Cadastro Unidade', state: checkCadastroUnidade, set: setCheckCadastroUnidade, key: 'check_cadastro_unidade' },
                                    { label: 'Status Pagamento', state: checkStatusPagamento, set: setCheckStatusPagamento, key: 'check_status_pagamento' },
                                    { label: 'Recrutadora', state: checkRecrutadora, set: setCheckRecrutadora, key: 'check_recrutadora' },
                                    { label: 'Umbler', state: checkUmbler, set: setCheckUmbler, key: 'check_umbler' },
                                ].map((item) => (
                                    <label key={item.key} className="flex items-center gap-3 cursor-pointer group">
                                        <div 
                                            onClick={(e) => {
                                                e.preventDefault();
                                                const newVal = !item.state;
                                                item.set(newVal);
                                                if (!isEditing) handleAutoSave(item.key as any, newVal);
                                            }}
                                            className={`
                                                w-5 h-5 rounded border transition-all flex items-center justify-center
                                                ${item.state 
                                                    ? 'bg-brand-cyan border-brand-cyan shadow-sm shadow-brand-cyan/20' 
                                                    : 'bg-bg-tertiary border-border-secondary group-hover:border-text-tertiary'}
                                            `}
                                        >
                                            {item.state && <Icon name="Check" className="w-3.5 h-3.5 text-bg-primary" />}
                                        </div>
                                        <span className={`text-sm transition-colors ${item.state ? 'text-text-primary font-medium' : 'text-text-secondary group-hover:text-text-primary'}`}>
                                            {item.label}
                                        </span>
                                    </label>
                                ))}
                            </div>

                            {/* Status de Produção */}
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-[10px] font-bold text-text-tertiary uppercase tracking-widest mb-2">Status da Produção</label>
                                    <div className="relative">
                                        <select
                                            value={producaoStatus}
                                            onChange={e => {
                                                setProducaoStatus(e.target.value);
                                                if (!isEditing) handleAutoSave('producao_status' as any, e.target.value);
                                            }}
                                            className="w-full appearance-none rounded-lg border border-border-secondary bg-bg-tertiary px-3 py-2 text-sm text-text-primary focus:border-accent-primary focus:outline-none"
                                        >
                                            {PRODUCAO_STATUS_OPTIONS.map(st => (
                                                <option key={st} value={st}>{st}</option>
                                            ))}
                                        </select>
                                        <Icon name="ChevronDown" className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary pointer-events-none" />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-[10px] font-bold text-text-tertiary uppercase tracking-widest mb-2">Plano Selecionado</label>
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
                            </div>
                        </div>
                    </div>

                    <div className="h-px bg-border-secondary" />

                    {/* Vínculo de Unidade */}
                    <div>
                        <h3 className="text-sm font-semibold text-text-primary mb-4">Vínculo com Unidade</h3>
                        <div>
                            <label className="block text-xs font-medium text-text-secondary mb-1">Unidade Responsável</label>
                            <div className="relative">
                                <select
                                    value={linkedUnitId}
                                    onChange={e => {
                                        setLinkedUnitId(e.target.value);
                                        if (!isEditing) handleAutoSave('linked_unit_id', e.target.value || null);
                                    }}
                                    className="w-full appearance-none rounded-lg border border-border-secondary bg-bg-tertiary px-3 py-2 text-sm text-text-primary focus:border-accent-primary focus:outline-none"
                                >
                                    <option value="">Nenhuma unidade vinculada</option>
                                    {allUnits.map(unit => (
                                        <option key={unit.id} value={unit.id}>
                                            {unit.unit_name}
                                        </option>
                                    ))}
                                </select>
                                <Icon name="ChevronDown" className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary pointer-events-none" />
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
