import React, { useState, useEffect } from 'react';
import { supabase } from '../../../services/supabaseClient';
import { Icon } from '../../ui/Icon';

interface Category {
    id: string;
    parent_id: string | null;
    unit_id: string;
    name: string;
    type: 'receita' | 'despesa' | 'resultado';
    classification: string | null;
    is_operational: boolean;
    show_in_dre: boolean;
    active: boolean;
    code: string | null;
    children?: Category[];
}

interface CategoriesManagerProps {
    unitId: string;
}

const CLASSIFICATION_OPTIONS = {
    receita: [
        'Receita Operacional',
        'Receita não Operacional',
        '(-) Deduções da Receita'
    ],
    despesa: [
        'Custo Fixo',
        'Custo Variável',
        'Despesa Fixa',
        'Despesa Variável',
        '(+) Outras deduções'
    ],
    resultado: [
        'Impostos sobre lucro',
        'Resultado',
        'Contas do passivo',
        'Contas do ativo'
    ]
};

export const CategoriesManager: React.FC<CategoriesManagerProps> = ({ unitId }) => {
    const [categories, setCategories] = useState<Category[]>([]);
    const [allCategories, setAllCategories] = useState<Category[]>([]); // Flat list for dropdown
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'receitas' | 'despesas' | 'resultado'>('receitas');
    const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

    // Form State
    const [isAdding, setIsAdding] = useState(false);
    const [editingCategory, setEditingCategory] = useState<Category | null>(null);
    const [formData, setFormData] = useState({
        name: '',
        parent_id: '' as string | null,
        classification: '',
        is_operational: true,
        show_in_dre: true,
        active: true
    });

    useEffect(() => {
        if (unitId) fetchCategories();
    }, [unitId]);

    const fetchCategories = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('financial_categories')
                .select('*')
                .eq('unit_id', unitId)
                .order('name', { ascending: true });

            if (error) throw error;

            const rawCategories = (data || []) as Category[];
            setAllCategories(rawCategories); // Store raw flat list
            setCategories(buildTree(rawCategories));
        } catch (error) {
            console.error('Error fetching categories:', error);
            alert('Erro ao carregar categorias.');
        } finally {
            setLoading(false);
        }
    };

    const buildTree = (items: Category[]): Category[] => {
        const itemMap = new Map<string, Category>();
        const roots: Category[] = [];

        // Clone items
        items.forEach(item => itemMap.set(item.id, { ...item, children: [] }));

        items.forEach(item => {
            const node = itemMap.get(item.id)!;
            if (item.parent_id) {
                const parent = itemMap.get(item.parent_id);
                if (parent) {
                    parent.children?.push(node);
                } else {
                    roots.push(node);
                }
            } else {
                roots.push(node);
            }
        });

        const sortNodes = (nodes: Category[]) => {
            nodes.sort((a, b) => (a.code || a.name).localeCompare(b.code || b.name));
            nodes.forEach(node => {
                if (node.children) sortNodes(node.children);
            });
        };
        sortNodes(roots);

        return roots;
    };

    const toggleExpand = (id: string) => {
        const newExpanded = new Set(expandedCategories);
        if (newExpanded.has(id)) {
            newExpanded.delete(id);
        } else {
            newExpanded.add(id);
        }
        setExpandedCategories(newExpanded);
    };

    const getTypeFromTab = () => {
        switch (activeTab) {
            case 'receitas': return 'receita';
            case 'despesas': return 'despesa';
            case 'resultado': return 'resultado';
            default: return 'receita';
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name.trim()) return;

        try {
            const payload = {
                unit_id: unitId,
                name: formData.name.trim(),
                type: getTypeFromTab(),
                parent_id: formData.parent_id || null,
                classification: formData.classification || null,
                is_operational: formData.is_operational,
                show_in_dre: formData.show_in_dre,
                active: formData.active
            };

            let error;
            if (editingCategory) {
                const { error: updError } = await supabase
                    .from('financial_categories')
                    .update(payload)
                    .eq('id', editingCategory.id);
                error = updError;
            } else {
                const { error: insError } = await supabase
                    .from('financial_categories')
                    .insert(payload);
                error = insError;
            }

            if (error) throw error;

            resetForm();
            fetchCategories();
        } catch (error) {
            console.error('Error saving category:', error);
            alert('Erro ao salvar categoria.');
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Tem certeza? Subcategorias também serão excluídas.')) return;
        try {
            const { error } = await supabase.from('financial_categories').delete().eq('id', id);
            if (error) throw error;
            fetchCategories();
        } catch (error) {
            console.error('Error deleting category:', error);
            alert('Erro ao excluir categoria.');
        }
    };

    const resetForm = () => {
        setEditingCategory(null);
        setFormData({
            name: '',
            parent_id: null,
            classification: '',
            is_operational: true,
            show_in_dre: true,
            active: true
        });
        setIsAdding(false);
    };

    const openAddModal = (parentId: string | null = null) => {
        resetForm();
        setFormData(prev => ({ ...prev, parent_id: parentId }));
        setIsAdding(true);
        if (parentId) {
            const newExpanded = new Set(expandedCategories);
            newExpanded.add(parentId);
            setExpandedCategories(newExpanded);
        }
    };

    const openEditModal = (category: Category) => {
        setEditingCategory(category);
        setFormData({
            name: category.name,
            parent_id: category.parent_id,
            classification: category.classification || '',
            is_operational: category.is_operational,
            show_in_dre: category.show_in_dre,
            active: category.active
        });
        setIsAdding(true);
    };

    const renderRow = (category: Category, level: number = 0) => {
        const hasChildren = category.children && category.children.length > 0;
        const isExpanded = expandedCategories.has(category.id);
        const typeLabel = category.type === 'receita' ? 'Receita' : 'Despesa';

        return (
            <React.Fragment key={category.id}>
                <div className={`grid grid-cols-12 gap-4 items-center p-3 border-b border-border-secondary hover:bg-bg-tertiary transition-colors ${level > 0 ? 'bg-bg-secondary/50' : ''}`}>
                    <div className="col-span-5 flex items-center gap-2" style={{ paddingLeft: `${level * 20}px` }}>
                        {hasChildren ? (
                            <button onClick={() => toggleExpand(category.id)} className="p-1 rounded hover:bg-bg-tertiary text-text-secondary">
                                <Icon name={isExpanded ? 'ChevronDown' : 'ChevronRight'} className="w-4 h-4" />
                            </button>
                        ) : (
                            <div className="w-6" /> // Spacer
                        )}
                        <span className={`text-sm ${level === 0 ? 'font-semibold text-text-primary' : 'text-text-secondary'}`}>
                            {category.code ? `${category.code} - ` : ''}{category.name}
                        </span>
                    </div>
                    <div className="col-span-3 text-xs text-text-secondary">
                        {category.classification || '-'}
                    </div>
                    <div className="col-span-2 text-xs text-text-secondary">
                        {category.show_in_dre ? 'Sim' : 'Não'}
                    </div>
                    <div className="col-span-2 flex items-center justify-end gap-2">
                        <span className={`px-2 py-0.5 text-[10px] uppercase font-bold rounded-full ${category.active ? 'bg-green-500/20 text-green-500' : 'bg-red-500/20 text-red-500'}`}>
                            {category.active ? 'Habilitado' : 'Desabilitado'}
                        </span>
                        <div className="flex items-center gap-1">
                            <button onClick={() => openEditModal(category)} className="p-1.5 text-text-tertiary hover:text-accent-primary transition-colors" title="Editar">
                                <Icon name="Edit2" className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => openAddModal(category.id)} className="p-1.5 text-text-tertiary hover:text-accent-primary transition-colors" title="Adicionar Subcategoria">
                                <Icon name="Plus" className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => handleDelete(category.id)} className="p-1.5 text-text-tertiary hover:text-red-500 transition-colors" title="Excluir">
                                <Icon name="Trash2" className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    </div>
                </div>
                {hasChildren && isExpanded && (
                    <div className="">
                        {category.children!.map(child => renderRow(child, level + 1))}
                    </div>
                )}
            </React.Fragment>
        );
    };

    const currentType = getTypeFromTab();
    const filteredRoots = categories.filter(c => c.type === currentType);

    // Get options safely
    const classificationOptions = activeTab === 'receitas'
        ? CLASSIFICATION_OPTIONS.receita
        : activeTab === 'despesas'
            ? CLASSIFICATION_OPTIONS.despesa
            : activeTab === 'resultado'
                ? CLASSIFICATION_OPTIONS.resultado
                : [];

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header / Tabs */}
            <div className="flex flex-col gap-6">
                <div>
                    <h2 className="text-2xl font-bold text-text-primary mb-1">Categorias</h2>
                </div>

                <div className="border-b border-border-secondary">
                    <div className="flex gap-6">
                        {(['receitas', 'despesas', 'resultado'] as const).map(tab => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`pb-3 text-sm font-medium transition-colors relative ${activeTab === tab
                                    ? 'text-accent-primary'
                                    : 'text-text-secondary hover:text-text-primary'
                                    }`}
                            >
                                {tab.charAt(0).toUpperCase() + tab.slice(1)}
                                {activeTab === tab && (
                                    <div className="absolute bottom-0 left-0 w-full h-0.5 bg-accent-primary rounded-t-full" />
                                )}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Content Actions */}
            <div className="flex justify-between items-center bg-bg-secondary p-4 rounded-xl border border-border-secondary shadow-sm">
                <h3 className="font-semibold text-text-primary text-lg capitalize">{activeTab}</h3>
                <div className="flex gap-3">
                    <button className="px-4 py-2 bg-bg-tertiary border border-border-secondary rounded-lg text-text-secondary text-sm font-medium hover:text-text-primary transition-colors flex items-center gap-2">
                        <Icon name="Filter" className="w-4 h-4" />
                        Filtros
                        <Icon name="ChevronDown" className="w-3 h-3 ml-1" />
                    </button>
                    <button
                        onClick={() => openAddModal()}
                        className="px-4 py-2 bg-accent-primary text-white rounded-lg text-sm font-medium hover:bg-accent-primary/90 transition-colors flex items-center gap-2"
                    >
                        <Icon name="Plus" className="w-4 h-4" />
                        Adicionar categoria
                    </button>
                </div>
            </div>

            {/* List Header */}
            <div className="bg-bg-secondary rounded-xl border border-border-secondary overflow-hidden">
                <div className="grid grid-cols-12 gap-4 p-4 border-b border-border-secondary bg-bg-tertiary/30 text-xs font-semibold text-text-tertiary uppercase tracking-wider">
                    <div className="col-span-5">Nome</div>
                    <div className="col-span-3">Classificação</div>
                    <div className="col-span-2">Mostrar no DRE</div>
                    <div className="col-span-2 text-right">Situação</div>
                </div>
                <div>
                    {loading ? (
                        <div className="p-8 text-center text-text-tertiary">Carregando...</div>
                    ) : filteredRoots.length === 0 ? (
                        <div className="p-8 text-center text-text-tertiary">Nenhuma categoria encontrada.</div>
                    ) : (
                        filteredRoots.map(cat => renderRow(cat))
                    )}
                </div>
            </div>

            {/* Add/Edit Modal */}
            {isAdding && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-bg-secondary w-full max-w-md rounded-xl shadow-2xl border border-border-secondary animate-in fade-in zoom-in duration-200">
                        <div className="p-6 border-b border-border-secondary flex justify-between items-center">
                            <h3 className="text-lg font-bold text-text-primary">
                                {editingCategory ? 'Editar Categoria' : `Nova categoria de ${activeTab.slice(0, -1)}`}
                            </h3>
                            <button onClick={resetForm} className="text-text-tertiary hover:text-text-primary">
                                <Icon name="X" className="w-5 h-5" />
                            </button>
                        </div>
                        <form onSubmit={handleSave} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-text-secondary mb-1">Nome da conta</label>
                                <input
                                    type="text"
                                    required
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full bg-bg-tertiary border border-border-secondary rounded-lg px-3 py-2 text-text-primary focus:border-accent-primary outline-none"
                                    placeholder="Digite aqui o nome da conta"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-text-secondary mb-1">Tipo de classificação:</label>
                                <div className="relative">
                                    <select
                                        value={formData.classification || ''}
                                        onChange={e => setFormData({ ...formData, classification: e.target.value })}
                                        className="w-full bg-bg-tertiary border border-border-secondary rounded-lg px-3 py-2 text-text-primary focus:border-accent-primary outline-none appearance-none"
                                    >
                                        <option value="">Selecione a classificação da conta</option>
                                        {classificationOptions.map(opt => (
                                            <option key={opt} value={opt}>{opt}</option>
                                        ))}
                                    </select>
                                    <Icon name="ChevronDown" className="w-4 h-4 text-text-secondary absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                                </div>
                            </div>

                            {(activeTab === 'receitas' || activeTab === 'despesas') && (
                                <div>
                                    <label className="block text-sm font-medium text-text-secondary mb-1">Categoria Pai (Opcional)</label>
                                    <div className="relative">
                                        <select
                                            value={formData.parent_id || ''}
                                            onChange={e => setFormData({ ...formData, parent_id: e.target.value || null })}
                                            className="w-full bg-bg-tertiary border border-border-secondary rounded-lg px-3 py-2 text-text-primary focus:border-accent-primary outline-none appearance-none"
                                        >
                                            <option value="">Nenhuma (Raiz)</option>
                                            {allCategories
                                                .filter(c => c.type === currentType && (!editingCategory || c.id !== editingCategory.id))
                                                .map(c => (
                                                    <option key={c.id} value={c.id}>{c.name}</option>
                                                ))
                                            }
                                        </select>
                                        <Icon name="ChevronDown" className="w-4 h-4 text-text-secondary absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                                    </div>
                                </div>
                            )}

                            <div className="flex items-center justify-between p-3 bg-bg-tertiary rounded-lg border border-border-secondary">
                                <span className="text-sm font-medium text-text-primary">Mostrar no DRE?</span>
                                <button
                                    type="button"
                                    onClick={() => setFormData({ ...formData, show_in_dre: !formData.show_in_dre })}
                                    className={`w-11 h-6 flex items-center rounded-full transition-colors ${formData.show_in_dre ? 'bg-accent-primary' : 'bg-gray-600'}`}
                                >
                                    <div className={`w-4 h-4 bg-white rounded-full shadow transform transition-transform ${formData.show_in_dre ? 'translate-x-6' : 'translate-x-1'}`} />
                                </button>
                            </div>

                            <div className="flex items-center justify-between p-3 bg-bg-tertiary rounded-lg border border-border-secondary">
                                <span className="text-sm font-medium text-text-primary">Habilitado</span>
                                <button
                                    type="button"
                                    onClick={() => setFormData({ ...formData, active: !formData.active })}
                                    className={`w-11 h-6 flex items-center rounded-full transition-colors ${formData.active ? 'bg-green-500' : 'bg-gray-600'}`}
                                >
                                    <div className={`w-4 h-4 bg-white rounded-full shadow transform transition-transform ${formData.active ? 'translate-x-6' : 'translate-x-1'}`} />
                                </button>
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={resetForm}
                                    className="flex-1 px-4 py-2 border border-border-secondary rounded-lg text-text-secondary font-medium hover:bg-bg-tertiary transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 px-4 py-2 bg-accent-primary text-white rounded-lg font-medium hover:bg-accent-primary/90 transition-colors"
                                >
                                    Salvar
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
