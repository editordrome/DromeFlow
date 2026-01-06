import React, { useState, useEffect, useMemo } from 'react';
import { fetchAllPlans, createPlan, updatePlan, deletePlan } from '../../services/plans/plans.service';
import { Plan } from '../../types';
import { Icon } from '../ui/Icon';
import { useAuth } from '../../contexts/AuthContext';

const ManagePlansPage: React.FC = () => {
    const { profile } = useAuth();
    const [plans, setPlans] = useState<Plan[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
    const [planToDelete, setPlanToDelete] = useState<Plan | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

    // Form state
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        value: '',
        cycle: 'monthly' as 'monthly' | 'annual',
        status: true,
        payment_link: ''
    });

    // Load plans
    const loadPlans = async () => {
        try {
            setIsLoading(true);
            const data = await fetchAllPlans();
            setPlans(data);
            setError(null);
        } catch (err: any) {
            console.error('Erro ao carregar planos:', err);
            setError('Falha ao carregar planos');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadPlans();
    }, []);

    // Filtered plans
    const filteredPlans = useMemo(() => {
        const term = searchTerm.trim().toLowerCase();

        return plans.filter((p) => {
            const matchesSearch = !term ||
                (p.name || '').toLowerCase().includes(term) ||
                (p.description || '').toLowerCase().includes(term);

            const matchesStatus =
                statusFilter === 'all' ? true :
                    statusFilter === 'active' ? p.status === true :
                        p.status === false;

            return matchesSearch && matchesStatus;
        });
    }, [plans, searchTerm, statusFilter]);

    // Open modal
    const handleOpenModal = (plan?: Plan) => {
        if (plan) {
            setEditingPlan(plan);
            setFormData({
                name: plan.name,
                description: plan.description || '',
                value: plan.value.toString(),
                cycle: plan.cycle,
                status: plan.status,
                payment_link: plan.payment_link || ''
            });
        } else {
            setEditingPlan(null);
            setFormData({
                name: '',
                description: '',
                value: '',
                cycle: 'monthly',
                status: true,
                payment_link: ''
            });
        }
        setIsModalOpen(true);
    };

    // Close modal
    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingPlan(null);
        setFormData({
            name: '',
            description: '',
            value: '',
            cycle: 'monthly',
            status: true,
            payment_link: ''
        });
    };

    // Save plan
    const handleSave = async () => {
        try {
            const planData = {
                name: formData.name,
                description: formData.description,
                value: parseFloat(formData.value),
                cycle: formData.cycle,
                status: formData.status,
                payment_link: formData.payment_link
            };

            if (editingPlan) {
                await updatePlan(editingPlan.id, planData);
            } else {
                await createPlan(planData);
            }

            await loadPlans();
            handleCloseModal();
        } catch (err: any) {
            console.error('Erro ao salvar plano:', err);
            alert(err.message || 'Falha ao salvar plano');
        }
    };

    // Delete plan
    const handleDelete = async () => {
        if (!planToDelete) return;

        try {
            await deletePlan(planToDelete.id);
            await loadPlans();
            setPlanToDelete(null);
        } catch (err: any) {
            console.error('Erro ao deletar plano:', err);
            alert(err.message || 'Falha ao deletar plano');
        }
    };

    // Copy link
    const handleCopyLink = (link: string | null) => {
        if (!link) return;
        navigator.clipboard.writeText(link);
        // TODO: Add toast notification
    };

    // Format currency
    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        }).format(value);
    };

    // Verify super admin
    if (profile?.role !== 'super_admin') {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="text-center p-8 bg-bg-secondary rounded-lg border border-border-primary">
                    <Icon name="ShieldAlert" className="w-12 h-12 mx-auto mb-4 text-danger" />
                    <h3 className="text-lg font-bold text-text-primary mb-2">Acesso Restrito</h3>
                    <p className="text-text-secondary">
                        Este módulo é exclusivo para Super Administradores.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col gap-4 p-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-text-primary">Gerenciar Planos</h1>
                <button
                    onClick={() => handleOpenModal()}
                    className="flex items-center gap-2 px-4 py-2 bg-accent-primary text-white rounded-lg hover:bg-accent-secondary transition-colors"
                >
                    <Icon name="Plus" className="w-5 h-5" />
                    Adicionar Plano
                </button>
            </div>

            {/* Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3 rounded-lg border bg-bg-secondary border-border-primary">
                    <div className="flex items-center gap-2">
                        <Icon name="CreditCard" className="w-5 h-5 text-accent-primary" />
                        <span className="text-sm font-medium text-text-secondary">Total de Planos</span>
                        <span className="ml-auto text-lg font-bold text-text-primary">{plans.length}</span>
                    </div>
                </div>

                <div className="p-3 rounded-lg border bg-bg-secondary border-border-primary">
                    <div className="flex items-center gap-2">
                        <Icon name="CheckCircle" className="w-5 h-5 text-success" />
                        <span className="text-sm font-medium text-text-secondary">Planos Ativos</span>
                        <span className="ml-auto text-lg font-bold text-success">
                            {plans.filter(p => p.status === true).length}
                        </span>
                    </div>
                </div>

                <div className="p-3 rounded-lg border bg-bg-secondary border-border-primary">
                    <div className="flex items-center gap-2">
                        <Icon name="XCircle" className="w-5 h-5 text-danger" />
                        <span className="text-sm font-medium text-text-secondary">Planos Inativos</span>
                        <span className="ml-auto text-lg font-bold text-danger">
                            {plans.filter(p => p.status === false).length}
                        </span>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="flex gap-2">
                <div className="relative flex-1">
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Buscar planos..."
                        className="w-full pl-9 pr-4 py-2 text-sm border rounded-md bg-white border-border-secondary focus:ring-accent-primary focus:border-accent-primary"
                    />
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-secondary">
                        <Icon name="Search" className="w-4 h-4" />
                    </span>
                </div>
                <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'inactive')}
                    className="px-3 py-2 text-sm border rounded-md bg-white border-border-secondary focus:ring-accent-primary focus:border-accent-primary"
                >
                    <option value="all">Todos</option>
                    <option value="active">Ativos</option>
                    <option value="inactive">Inativos</option>
                </select>
            </div>

            {/* Table */}
            <div className="flex-1 bg-bg-secondary rounded-lg shadow-md overflow-hidden">
                {isLoading ? (
                    <div className="flex items-center justify-center h-full">
                        <Icon name="Loader2" className="w-8 h-8 animate-spin text-accent-primary" />
                    </div>
                ) : error ? (
                    <div className="p-4 text-danger">{error}</div>
                ) : filteredPlans.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-text-secondary">
                        Nenhum plano encontrado
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-bg-tertiary border-b border-border-secondary">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary uppercase">Nome</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary uppercase">Valor</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary uppercase">Ciclo</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary uppercase">Status</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary uppercase">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border-secondary">
                                {filteredPlans.map((plan) => (
                                    <tr key={plan.id} className="hover:bg-bg-tertiary transition-colors">
                                        <td className="px-4 py-3">
                                            <div className="text-sm font-medium text-text-primary">{plan.name}</div>
                                            {plan.description && (
                                                <div className="text-xs text-text-secondary line-clamp-1">{plan.description}</div>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-sm font-semibold text-text-primary">
                                            {formatCurrency(plan.value)}
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={`px-2 py-1 text-xs font-medium rounded ${plan.cycle === 'monthly'
                                                    ? 'bg-blue-100 text-blue-800'
                                                    : 'bg-purple-100 text-purple-800'
                                                }`}>
                                                {plan.cycle === 'monthly' ? 'Mensal' : 'Anual'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={`px-2 py-1 text-xs font-medium rounded ${plan.status
                                                    ? 'bg-green-100 text-green-800'
                                                    : 'bg-red-100 text-red-800'
                                                }`}>
                                                {plan.status ? 'Ativo' : 'Inativo'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-2">
                                                {plan.payment_link && (
                                                    <button
                                                        onClick={() => handleCopyLink(plan.payment_link)}
                                                        className="p-1.5 hover:bg-bg-tertiary rounded transition-colors"
                                                        title="Copiar link"
                                                    >
                                                        <Icon name="Link" className="w-4 h-4 text-text-secondary" />
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => handleOpenModal(plan)}
                                                    className="p-1.5 hover:bg-bg-tertiary rounded transition-colors"
                                                    title="Editar"
                                                >
                                                    <Icon name="Edit" className="w-4 h-4 text-accent-primary" />
                                                </button>
                                                <button
                                                    onClick={() => setPlanToDelete(plan)}
                                                    className="p-1.5 hover:bg-bg-tertiary rounded transition-colors"
                                                    title="Deletar"
                                                >
                                                    <Icon name="Trash2" className="w-4 h-4 text-danger" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Modal Add/Edit */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                        <div className="px-6 py-4 border-b border-border-secondary flex items-center justify-between">
                            <h2 className="text-xl font-bold text-text-primary">
                                {editingPlan ? 'Editar Plano' : 'Adicionar Novo Plano'}
                            </h2>
                            <button
                                onClick={handleCloseModal}
                                className="p-1 hover:bg-bg-tertiary rounded transition-colors"
                            >
                                <Icon name="X" className="w-5 h-5 text-text-secondary" />
                            </button>
                        </div>

                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-text-primary mb-1">
                                    Nome *
                                </label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full px-3 py-2 border rounded-md focus:ring-accent-primary focus:border-accent-primary"
                                    placeholder="Ex: Plano Premium"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-text-primary mb-1">
                                    Descrição
                                </label>
                                <textarea
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    className="w-full px-3 py-2 border rounded-md focus:ring-accent-primary focus:border-accent-primary"
                                    placeholder="Descrição do plano"
                                    rows={3}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-text-primary mb-1">
                                        Valor (R$) *
                                    </label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={formData.value}
                                        onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                                        className="w-full px-3 py-2 border rounded-md focus:ring-accent-primary focus:border-accent-primary"
                                        placeholder="0.00"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-text-primary mb-1">
                                        Ciclo *
                                    </label>
                                    <select
                                        value={formData.cycle}
                                        onChange={(e) => setFormData({ ...formData, cycle: e.target.value as 'monthly' | 'annual' })}
                                        className="w-full px-3 py-2 border rounded-md focus:ring-accent-primary focus:border-accent-primary"
                                    >
                                        <option value="monthly">Mensal</option>
                                        <option value="annual">Anual</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-text-primary mb-1">
                                    Link de Pagamento
                                </label>
                                <input
                                    type="url"
                                    value={formData.payment_link}
                                    onChange={(e) => setFormData({ ...formData, payment_link: e.target.value })}
                                    className="w-full px-3 py-2 border rounded-md focus:ring-accent-primary focus:border-accent-primary"
                                    placeholder="https://..."
                                />
                            </div>

                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    id="status"
                                    checked={formData.status}
                                    onChange={(e) => setFormData({ ...formData, status: e.target.checked })}
                                    className="w-4 h-4 text-accent-primary rounded focus:ring-accent-primary"
                                />
                                <label htmlFor="status" className="text-sm font-medium text-text-primary">
                                    Plano Ativo
                                </label>
                            </div>
                        </div>

                        <div className="px-6 py-4 border-t border-border-secondary flex justify-end gap-2">
                            <button
                                onClick={handleCloseModal}
                                className="px-4 py-2 border border-border-secondary rounded-lg hover:bg-bg-tertiary transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleSave}
                                className="px-4 py-2 bg-accent-primary text-white rounded-lg hover:bg-accent-secondary transition-colors"
                            >
                                {editingPlan ? 'Salvar Alterações' : 'Adicionar Plano'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Delete Confirmation */}
            {planToDelete && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
                        <h3 className="text-lg font-bold text-text-primary mb-4">Confirmar Exclusão</h3>
                        <p className="text-text-secondary mb-6">
                            Tem certeza que deseja excluir o plano <strong>{planToDelete.name}</strong>?
                            Esta ação não pode ser desfeita.
                        </p>
                        <div className="flex justify-end gap-2">
                            <button
                                onClick={() => setPlanToDelete(null)}
                                className="px-4 py-2 border border-border-secondary rounded-lg hover:bg-bg-tertiary transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleDelete}
                                className="px-4 py-2 bg-danger text-white rounded-lg hover:bg-red-700 transition-colors"
                            >
                                Excluir
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ManagePlansPage;
