import React, { useState, useEffect } from 'react';
import { Plan, UnitPlan, UnitPayment, Unit } from '../../types';
import { fetchAllPlans } from '../../services/plans/plans.service';
import { fetchAllUnits } from '../../services/units/units.service';
import {
    fetchUnitPlan,
    upsertUnitPlan,
    fetchUnitPayments,
    upsertUnitPayment,
    generatePaymentsForPeriod
} from '../../services/units/unitPlans.service';
import { Icon } from './Icon';

interface UnitPlanManagerProps {
    unitId: string;
}

export const UnitPlanManager: React.FC<UnitPlanManagerProps> = ({ unitId }) => {
    const [allPlans, setAllPlans] = useState<Plan[]>([]);
    const [unitPlan, setUnitPlan] = useState<UnitPlan | null>(null);
    const [unitPayments, setUnitPayments] = useState<UnitPayment[]>([]);
    const [plansLoading, setPlansLoading] = useState(false);
    const [savingPlan, setSavingPlan] = useState(false);
    const [availableUnits, setAvailableUnits] = useState<Unit[]>([]);
    const [configType, setConfigType] = useState<'individual' | 'linked'>('individual');
    const [planFormData, setPlanFormData] = useState({
        plan_id: '',
        start_date: '',
        end_date: '',
        status: 'active',
        due_day: 1,
        payment_type: 'pix',
        parent_unit_id: ''
    });
    const [isEditing, setIsEditing] = useState(false);

    useEffect(() => {
        let mounted = true;
        const loadData = async () => {
            if (!unitId) return;
            try {
                setPlansLoading(true);
                const [plans, currentPlan, units] = await Promise.all([
                    fetchAllPlans(),
                    fetchUnitPlan(unitId),
                    fetchAllUnits()
                ]);

                if (mounted) {
                    setAllPlans(plans);
                    setAvailableUnits(units.filter(u => u.id !== unitId));
                    setUnitPlan(currentPlan);

                    if (currentPlan) {
                        setPlanFormData({
                            plan_id: currentPlan.plan_id,
                            start_date: currentPlan.start_date,
                            end_date: currentPlan.end_date || '',
                            status: currentPlan.status,
                            due_day: currentPlan.due_day || 1,
                            payment_type: (currentPlan.payment_type || 'pix') as any,
                            parent_unit_id: currentPlan.parent_unit_id || ''
                        });

                        if (currentPlan.parent_unit_id) {
                            setConfigType('linked');
                        } else {
                            setConfigType('individual');
                        }

                        const payments = await fetchUnitPayments(currentPlan.id);
                        if (mounted) setUnitPayments(payments);
                    }
                }
            } catch (e) {
                console.error('Erro ao carregar dados do plano:', e);
            } finally {
                if (mounted) setPlansLoading(false);
            }
        };

        loadData();
        return () => { mounted = false; };
    }, [unitId]);

    const handleSavePlan = async () => {
        try {
            setSavingPlan(true);

            let payload: any = {
                unit_id: unitId,
                status: planFormData.status
            };

            if (configType === 'linked') {
                if (!planFormData.parent_unit_id || !planFormData.start_date) {
                    alert('Selecione a unidade pai e a data de início.');
                    setSavingPlan(false);
                    return;
                }

                // Fetch parent plan details to copy
                const parentPlan = await fetchUnitPlan(planFormData.parent_unit_id);
                if (!parentPlan || parentPlan.status !== 'active') {
                    throw new Error('A unidade selecionada não possui um plano ativo.');
                }

                payload = {
                    ...payload,
                    plan_id: parentPlan.plan_id,
                    parent_unit_id: planFormData.parent_unit_id,
                    start_date: planFormData.start_date,
                    end_date: null,
                    payment_type: null,
                    due_day: null
                };

            } else {
                if (!planFormData.plan_id || !planFormData.start_date) return;

                payload = {
                    ...payload,
                    plan_id: planFormData.plan_id,
                    start_date: planFormData.start_date,
                    end_date: planFormData.end_date || null,
                    due_day: Number(planFormData.due_day),
                    payment_type: planFormData.payment_type,
                    parent_unit_id: null
                };
            }

            if (unitPlan?.id) {
                payload.id = unitPlan.id;
            }

            const saved = await upsertUnitPlan(payload);
            setUnitPlan(saved);

            // Gerar pagamentos APENAS se for Individual
            if (configType === 'individual') {
                const plan = allPlans.find(p => p.id === planFormData.plan_id);
                if (plan) {
                    await generatePaymentsForPeriod(
                        saved.id,
                        plan.value,
                        planFormData.start_date,
                        planFormData.end_date || null,
                        Number(planFormData.due_day)
                    );
                }
            } else {
                // If switching to linked, maybe we should clear future pending payments?
                // For now, let's leave that logic to the user or later refinement.
            }

            // Refresh payments list
            const list = await fetchUnitPayments(saved.id);
            setUnitPayments(list);

            alert('Plano salvo com sucesso!');
            setIsEditing(false);
        } catch (e: any) {
            alert(e.message || 'Erro ao salvar plano');
        } finally {
            setSavingPlan(false);
        }
    };

    const updatePayment = async (id: string, updates: Partial<UnitPayment>) => {
        try {
            await upsertUnitPayment({ id, ...updates } as any);
            setUnitPayments(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
        } catch (e) {
            alert('Erro ao atualizar pagamento');
        }
    };

    if (plansLoading) {
        return (
            <div className="flex justify-center p-8">
                <Icon name="loader" className="w-6 h-6 animate-spin text-accent-primary" />
            </div>
        );
    }

    const currentPlanDetails = allPlans.find(p => p.id === planFormData.plan_id);

    return (
        <div className="space-y-6">
            {/* View Mode: Info Card */}
            {unitPlan && !isEditing && (
                <div className="bg-bg-tertiary/30 p-4 rounded-lg border border-border-secondary flex items-center gap-4">
                    <div className="flex-1 flex justify-around items-center">
                        <div className="text-center">
                            <p className="text-xs font-medium text-text-secondary mb-1">Plano Atual</p>
                            <div className="flex flex-col items-center">
                                <p className="text-sm font-semibold text-text-primary">{currentPlanDetails?.name || 'Plano Desconhecido'}</p>
                                {unitPlan.parent_unit_id && (
                                    <span className="text-xs text-accent-primary bg-accent-primary/10 px-1.5 py-0.5 rounded-full w-fit mt-1">
                                        Vinculado via: {availableUnits.find(u => u.id === unitPlan.parent_unit_id)?.unit_name || '...'}
                                    </span>
                                )}
                            </div>
                        </div>
                        <div className="text-center">
                            <p className="text-xs font-medium text-text-secondary mb-1">Data Início</p>
                            <p className="text-sm text-text-primary">
                                {planFormData.start_date.split('-').reverse().join('/')}
                            </p>
                        </div>
                        {planFormData.end_date && (
                            <div className="text-center">
                                <p className="text-xs font-medium text-text-secondary mb-1">Data Fim</p>
                                <p className="text-sm text-text-primary">
                                    {planFormData.end_date.split('-').reverse().join('/')}
                                </p>
                            </div>
                        )}
                        {!unitPlan.parent_unit_id && (
                            <>
                                <div className="text-center">
                                    <p className="text-xs font-medium text-text-secondary mb-1">Dia Venc.</p>
                                    <p className="text-sm text-text-primary">{planFormData.due_day}</p>
                                </div>
                                <div className="text-center">
                                    <p className="text-xs font-medium text-text-secondary mb-1">Pagamento</p>
                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-accent-primary/10 text-accent-primary uppercase">
                                        {planFormData.payment_type === 'credit_card' ? 'Cartão' : planFormData.payment_type}
                                    </span>
                                </div>
                            </>
                        )}
                    </div>
                    <button
                        onClick={() => setIsEditing(true)}
                        className="p-2 text-text-secondary hover:text-accent-primary hover:bg-accent-primary/10 rounded-full transition-colors"
                        title="Editar Plano"
                    >
                        <Icon name="edit" className="w-4 h-4" />
                    </button>
                </div>
            )}

            {/* Edit/Create Mode: Form */}
            {(!unitPlan || isEditing) && (
                <div className="bg-bg-tertiary/30 p-4 rounded-lg border border-border-secondary space-y-4">
                    <h4 className="text-sm font-semibold text-text-primary flex items-center gap-2">
                        <Icon name="CreditCard" className="w-4 h-4 text-accent-primary" />
                        {unitPlan ? 'Editar Plano' : 'Configurar Plano'}
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                        <div className="md:col-span-12 mb-2">
                            <div className="flex gap-4">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="radio"
                                        name="configType"
                                        value="individual"
                                        checked={configType === 'individual'}
                                        onChange={() => setConfigType('individual')}
                                        className="text-accent-primary focus:ring-accent-primary"
                                    />
                                    <span className="text-sm text-text-primary">Plano Individual</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="radio"
                                        name="configType"
                                        value="linked"
                                        checked={configType === 'linked'}
                                        onChange={() => setConfigType('linked')}
                                        className="text-accent-primary focus:ring-accent-primary"
                                    />
                                    <span className="text-sm text-text-primary">Vincular a outra Unidade</span>
                                </label>
                            </div>
                        </div>

                        {configType === 'individual' ? (
                            <>
                                <div className="md:col-span-3 lg:col-span-4">
                                    <label className="block text-xs font-medium text-text-secondary mb-1">Selecione o Plano</label>
                                    <select
                                        value={planFormData.plan_id}
                                        onChange={(e) => setPlanFormData(prev => ({ ...prev, plan_id: e.target.value }))}
                                        className="w-full px-3 py-2 text-sm rounded-md border border-border-secondary bg-bg-secondary focus:ring-2 focus:ring-accent-primary/20 focus:border-accent-primary"
                                    >
                                        <option value="">Selecione...</option>
                                        {allPlans.map(p => (
                                            <option key={p.id} value={p.id}>
                                                {p.name} - R$ {p.value.toFixed(2)}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-xs font-medium text-text-secondary mb-1">Data Início</label>
                                    <input
                                        type="date"
                                        value={planFormData.start_date}
                                        onChange={(e) => setPlanFormData(prev => ({ ...prev, start_date: e.target.value }))}
                                        className="w-full px-3 py-2 text-sm rounded-md border border-border-secondary bg-bg-secondary focus:ring-2 focus:ring-accent-primary/20 focus:border-accent-primary"
                                    />
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-xs font-medium text-text-secondary mb-1">Data Fim</label>
                                    <input
                                        type="date"
                                        value={planFormData.end_date}
                                        onChange={(e) => setPlanFormData(prev => ({ ...prev, end_date: e.target.value }))}
                                        className="w-full px-3 py-2 text-sm rounded-md border border-border-secondary bg-bg-secondary focus:ring-2 focus:ring-accent-primary/20 focus:border-accent-primary"
                                    />
                                </div>
                                <div className="md:col-span-1">
                                    <label className="block text-xs font-medium text-text-secondary mb-1">Dia Venc.</label>
                                    <input
                                        type="number"
                                        min="1"
                                        max="31"
                                        value={planFormData.due_day}
                                        onChange={(e) => setPlanFormData(prev => ({ ...prev, due_day: parseInt(e.target.value) }))}
                                        className="w-full px-3 py-2 text-sm rounded-md border border-border-secondary bg-bg-secondary focus:ring-2 focus:ring-accent-primary/20 focus:border-accent-primary"
                                    />
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-xs font-medium text-text-secondary mb-1">Pagamento</label>
                                    <select
                                        value={planFormData.payment_type}
                                        onChange={(e) => setPlanFormData(prev => ({ ...prev, payment_type: e.target.value }))}
                                        className="w-full px-3 py-2 text-sm rounded-md border border-border-secondary bg-bg-secondary focus:ring-2 focus:ring-accent-primary/20 focus:border-accent-primary"
                                    >
                                        <option value="pix">PIX</option>
                                        <option value="credit_card">Cartão</option>
                                    </select>
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="md:col-span-5">
                                    <label className="block text-xs font-medium text-text-secondary mb-1">Unidade Pagadora (Pai)</label>
                                    <select
                                        value={planFormData.parent_unit_id}
                                        onChange={(e) => setPlanFormData(prev => ({ ...prev, parent_unit_id: e.target.value }))}
                                        className="w-full px-3 py-2 text-sm rounded-md border border-border-secondary bg-bg-secondary focus:ring-2 focus:ring-accent-primary/20 focus:border-accent-primary"
                                    >
                                        <option value="">Selecione uma unidade...</option>
                                        {availableUnits.map(u => (
                                            <option key={u.id} value={u.id}>
                                                {u.unit_name} ({u.unit_code})
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="md:col-span-3">
                                    <label className="block text-xs font-medium text-text-secondary mb-1">Data Início do Vínculo</label>
                                    <input
                                        type="date"
                                        value={planFormData.start_date}
                                        onChange={(e) => setPlanFormData(prev => ({ ...prev, start_date: e.target.value }))}
                                        className="w-full px-3 py-2 text-sm rounded-md border border-border-secondary bg-bg-secondary focus:ring-2 focus:ring-accent-primary/20 focus:border-accent-primary"
                                    />
                                </div>
                                <div className="md:col-span-4 p-2 bg-blue-500/10 rounded border border-blue-500/20 text-xs text-blue-200">
                                    <p>Esta unidade herdará o plano da unidade selecionada. Nenhuma cobrança será gerada para esta unidade.</p>
                                </div>
                            </>
                        )}

                        <div className="md:col-span-2 lg:col-span-1">
                            <label className="block text-xs font-medium text-text-secondary mb-1">Status</label>
                            <select
                                value={planFormData.status}
                                onChange={(e) => setPlanFormData(prev => ({ ...prev, status: e.target.value }))}
                                className="w-full px-3 py-2 text-sm rounded-md border border-border-secondary bg-bg-secondary focus:ring-2 focus:ring-accent-primary/20 focus:border-accent-primary"
                            >
                                <option value="active">Ativo</option>
                                <option value="inactive">Inativo</option>
                                <option value="cancelled">Cancelado</option>
                            </select>
                        </div>
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                        {isEditing && (
                            <button
                                type="button"
                                onClick={() => setIsEditing(false)}
                                className="px-4 py-2 text-sm font-medium text-text-primary bg-transparent border border-border-primary rounded-md hover:bg-bg-tertiary transition-colors"
                            >
                                Cancelar
                            </button>
                        )}
                        <button
                            type="button"
                            disabled={savingPlan || !planFormData.plan_id || !planFormData.start_date}
                            onClick={handleSavePlan}
                            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-accent-primary rounded-md hover:bg-accent-secondary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            {savingPlan ? (
                                <>
                                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    Salvando...
                                </>
                            ) : (
                                <>
                                    <Icon name="save" className="w-4 h-4" />
                                    Salvar Vínculo
                                </>
                            )}
                        </button>
                    </div>
                </div>
            )}

            {/* Histórico de Pagamentos */}
            {unitPlan && !unitPlan.parent_unit_id && (
                <div className="space-y-3">
                    <h4 className="text-sm font-semibold text-text-primary flex items-center gap-2">
                        <Icon name="DollarSign" className="w-4 h-4 text-success" />
                        Histórico de Pagamentos
                    </h4>
                    <div className="border border-border-secondary rounded-lg overflow-hidden bg-white">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-bg-tertiary border-b border-border-secondary">
                                    <tr>
                                        <th className="px-4 py-3 font-medium text-text-secondary whitespace-nowrap">Competência</th>
                                        <th className="px-4 py-3 font-medium text-text-secondary whitespace-nowrap">Valor</th>
                                        <th className="px-4 py-3 font-medium text-text-secondary whitespace-nowrap">Status</th>
                                        <th className="px-4 py-3 font-medium text-text-secondary whitespace-nowrap">Data Pagto</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border-secondary">
                                    {unitPayments.map(pay => (
                                        <tr key={pay.id} className="hover:bg-bg-tertiary/30 transition-colors">
                                            <td className="px-4 py-3 text-text-primary capitalize whitespace-nowrap">
                                                {(() => {
                                                    const parts = pay.reference_date.split('-');
                                                    if (parts.length === 3) {
                                                        const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
                                                        return `${months[parseInt(parts[1], 10) - 1]} ${parts[0]}`;
                                                    }
                                                    return pay.reference_date;
                                                })()}
                                            </td>
                                            <td className="px-4 py-3 text-text-primary whitespace-nowrap font-mono">
                                                R$ {Number(pay.amount).toFixed(2)}
                                            </td>
                                            <td className="px-4 py-3">
                                                <select
                                                    value={pay.status}
                                                    onChange={(e) => updatePayment(pay.id, { status: e.target.value as any })}
                                                    className={`px-2 py-1 text-xs rounded-full border cursor-pointer focus:outline-none focus:ring-2 focus:ring-offset-1 ${pay.status === 'paid' ? 'bg-success/10 text-success border-success/30 focus:ring-success' :
                                                        pay.status === 'overdue' ? 'bg-danger/10 text-danger border-danger/30 focus:ring-danger' :
                                                            'bg-warning/10 text-warning border-warning/30 focus:ring-warning'
                                                        }`}
                                                >
                                                    <option value="pending">Pendente</option>
                                                    <option value="paid">Pago</option>
                                                    <option value="overdue">Atrasado</option>
                                                    <option value="cancelled">Cancelado</option>
                                                </select>
                                            </td>
                                            <td className="px-4 py-3 text-text-secondary">
                                                <input
                                                    type="date"
                                                    className="bg-transparent border-none text-xs p-0 focus:ring-0 text-text-secondary hover:text-text-primary cursor-pointer w-[110px]"
                                                    value={pay.payment_date || ''}
                                                    onChange={(e) => updatePayment(pay.id, { payment_date: e.target.value || null })}
                                                />
                                            </td>
                                        </tr>
                                    ))}
                                    {unitPayments.length === 0 && (
                                        <tr>
                                            <td colSpan={4} className="p-8 text-center text-text-secondary">
                                                <p className="text-sm">Nenhum pagamento gerado para este plano.</p>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
