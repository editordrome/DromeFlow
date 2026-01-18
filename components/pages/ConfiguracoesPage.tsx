import React, { useEffect, useState } from 'react';
import { useAppContext } from '../../contexts/AppContext';
import { Icon } from '../ui/Icon';
import { getUnitConfig, updateUnitConfig } from '../../services/units/unitConfig.service';
import { getUnitServices, createUnitService, deleteUnitService, updateUnitService } from '../../services/units/unitServices.service';
import { Unit, UnitService } from '../../types';

const SERVICE_OPTIONS = [
    '2 horas', '3 horas', '4 horas', '5 horas', '6 horas',
    '7 horas', '8 horas', '9 horas', '10 horas', '11 horas', '12 horas',
    'Passadoria'
];

const ConfiguracoesPage: React.FC = () => {
    const { selectedUnit } = useAppContext();
    const [activeTab, setActiveTab] = useState<'company' | 'services'>('company');

    // Form Data da Empresa
    const [formData, setFormData] = useState<Partial<Unit>>({
        razao_social: '',
        cnpj: '',
        endereco: '',
        contato: '',
        email: '',
        responsavel: '',
    });

    // Serviços Data
    const [services, setServices] = useState<UnitService[]>([]);
    const [newService, setNewService] = useState({ name: '4 horas', repasse_value: '' });

    // States de UI
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    // Carregar dados da unidade e serviços
    useEffect(() => {
        const loadData = async () => {
            if (!selectedUnit || selectedUnit.id === 'ALL') {
                setIsLoading(false);
                return;
            }

            setIsLoading(true);
            try {
                // Carregar Configurações
                const configData = await getUnitConfig(selectedUnit.id);
                if (configData) {
                    setFormData({
                        razao_social: configData.razao_social || '',
                        cnpj: configData.cnpj || '',
                        endereco: configData.endereco || '',
                        contato: configData.contato || '',
                        email: configData.email || '',
                        responsavel: configData.responsavel || '',
                    });
                }

                // Carregar Serviços
                const servicesData = await getUnitServices(selectedUnit.id);
                setServices(servicesData);

            } catch (error) {
                console.error('Erro ao carregar dados:', error);
            } finally {
                setIsLoading(false);
            }
        };

        loadData();
    }, [selectedUnit]);

    const handleChange = (field: keyof typeof formData, value: string) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        setSaveMessage(null);
    };

    const formatCNPJ = (value: string): string => {
        const numbers = value.replace(/\D/g, '');
        if (numbers.length <= 14) {
            return numbers
                .replace(/(\d{2})(\d)/, '$1.$2')
                .replace(/(\d{3})(\d)/, '$1.$2')
                .replace(/(\d{3})(\d)/, '$1/$2')
                .replace(/(\d{4})(\d)/, '$1-$2');
        }
        return value;
    };

    const handleCNPJChange = (value: string) => {
        const formatted = formatCNPJ(value);
        handleChange('cnpj', formatted);
    };

    // Salvar Dados da Empresa
    const handleSaveCompany = async () => {
        if (!selectedUnit || selectedUnit.id === 'ALL') return;

        if (!formData.razao_social?.trim()) {
            setSaveMessage({ type: 'error', text: 'Razão Social é obrigatória' });
            return;
        }

        setIsSaving(true);
        setSaveMessage(null);

        const result = await updateUnitConfig(selectedUnit.id, formData);

        if (result.success) {
            setSaveMessage({ type: 'success', text: 'Configurações salvas com sucesso!' });
        } else {
            setSaveMessage({ type: 'error', text: result.error || 'Erro ao salvar configurações' });
        }

        setIsSaving(false);
    };

    // Gerenciar Serviços
    const handleAddService = async () => {
        if (!selectedUnit || selectedUnit.id === 'ALL') return;
        if (!newService.repasse_value) {
            alert('Informe o valor do repasse');
            return;
        }

        const value = parseFloat(newService.repasse_value.replace(',', '.'));
        if (isNaN(value)) {
            alert('Valor inválido');
            return;
        }

        // Verificar se serviço já existe e atualizar, ou criar novo
        const existingService = services.find(s => s.name === newService.name);

        setIsSaving(true);
        try {
            if (existingService) {
                // Update
                const updated = await updateUnitService(existingService.id, { repasse_value: value, active: true });
                setServices(prev => prev.map(s => s.id === updated.id ? updated : s));
            } else {
                // Create
                console.log('Adding service for unit:', selectedUnit);
                const created = await createUnitService({
                    unit_id: selectedUnit.id,
                    name: newService.name,
                    repasse_value: value,
                    active: true
                });
                setServices(prev => [...prev, created]);
            }
            setNewService(prev => ({ ...prev, repasse_value: '' })); // Limpar valor
        } catch (error) {
            console.error(error);
            alert('Erro ao salvar serviço');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteService = async (id: string) => {
        if (!confirm('Tem certeza que deseja remover este serviço?')) return;

        try {
            await deleteUnitService(id);
            setServices(prev => prev.filter(s => s.id !== id));
        } catch (error) {
            console.error(error);
            alert('Erro ao excluir serviço');
        }
    };

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
    };

    if (!selectedUnit || selectedUnit.id === 'ALL') {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="text-center">
                    <Icon name="AlertCircle" className="w-12 h-12 text-text-secondary mx-auto mb-4" />
                    <p className="text-text-secondary">Selecione uma unidade específica para configurar</p>
                </div>
            </div>
        );
    }

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent-primary mx-auto mb-4"></div>
                    <p className="text-text-secondary">Carregando configurações...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="p-6 max-w-4xl mx-auto h-full flex flex-col">
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-text-primary mb-2">Configurações da Unidade</h1>
                <p className="text-text-secondary">
                    Gerencie os dados da unidade e valores de serviços
                </p>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-border-secondary mb-6">
                <button
                    className={`px-4 py-2 font-medium text-sm transition-colors relative ${activeTab === 'company'
                        ? 'text-accent-primary'
                        : 'text-text-secondary hover:text-text-primary'
                        }`}
                    onClick={() => setActiveTab('company')}
                >
                    Dados da Empresa
                    {activeTab === 'company' && (
                        <div className="absolute bottom-0 left-0 w-full h-0.5 bg-accent-primary"></div>
                    )}
                </button>
                <button
                    className={`px-4 py-2 font-medium text-sm transition-colors relative ${activeTab === 'services'
                        ? 'text-accent-primary'
                        : 'text-text-secondary hover:text-text-primary'
                        }`}
                    onClick={() => setActiveTab('services')}
                >
                    Serviços e Repasses
                    {activeTab === 'services' && (
                        <div className="absolute bottom-0 left-0 w-full h-0.5 bg-accent-primary"></div>
                    )}
                </button>
            </div>

            <div className="flex-1 overflow-y-auto">
                {activeTab === 'company' ? (
                    <div className="bg-bg-secondary rounded-lg border border-border-secondary p-6">
                        <div className="flex items-center gap-2 mb-6">
                            <Icon name="Building2" className="w-5 h-5 text-accent-primary" />
                            <h2 className="text-lg font-semibold text-text-primary">Dados da Empresa</h2>
                        </div>

                        <div className="space-y-4">
                            {/* Linha 1: Razão Social e CNPJ */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium text-text-primary mb-1">
                                        Razão Social <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.razao_social || ''}
                                        onChange={(e) => handleChange('razao_social', e.target.value)}
                                        className="w-full px-3 py-2 bg-bg-primary border border-border-secondary rounded-md text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-primary"
                                        placeholder="Nome da empresa"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-text-primary mb-1">
                                        CNPJ
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.cnpj || ''}
                                        onChange={(e) => handleCNPJChange(e.target.value)}
                                        maxLength={18}
                                        className="w-full px-3 py-2 bg-bg-primary border border-border-secondary rounded-md text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-primary"
                                        placeholder="00.000.000/0000-00"
                                    />
                                </div>
                            </div>

                            {/* Linha 2: Endereço */}
                            <div>
                                <label className="block text-sm font-medium text-text-primary mb-1">
                                    Endereço Completo
                                </label>
                                <textarea
                                    value={formData.endereco || ''}
                                    onChange={(e) => handleChange('endereco', e.target.value)}
                                    rows={2}
                                    className="w-full px-3 py-2 bg-bg-primary border border-border-secondary rounded-md text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-primary resize-none"
                                    placeholder="Rua, número, complemento, bairro, cidade - UF, CEP"
                                />
                            </div>

                            {/* Linha 3: Telefone, Email e Responsável */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-text-primary mb-1">
                                        Telefone de Contato
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.contato || ''}
                                        onChange={(e) => handleChange('contato', e.target.value)}
                                        className="w-full px-3 py-2 bg-bg-primary border border-border-secondary rounded-md text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-primary"
                                        placeholder="(00) 00000-0000"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-text-primary mb-1">
                                        Email de Contato
                                    </label>
                                    <input
                                        type="email"
                                        value={formData.email || ''}
                                        onChange={(e) => handleChange('email', e.target.value)}
                                        className="w-full px-3 py-2 bg-bg-primary border border-border-secondary rounded-md text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-primary"
                                        placeholder="contato@empresa.com"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-text-primary mb-1">
                                        Responsável
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.responsavel || ''}
                                        onChange={(e) => handleChange('responsavel', e.target.value)}
                                        className="w-full px-3 py-2 bg-bg-primary border border-border-secondary rounded-md text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-primary"
                                        placeholder="Nome do responsável"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Mensagem de Feedback */}
                        {saveMessage && (
                            <div
                                className={`mt-4 p-3 rounded-md flex items-center gap-2 ${saveMessage.type === 'success'
                                    ? 'bg-green-500/10 text-green-500 border border-green-500/20'
                                    : 'bg-red-500/10 text-red-500 border border-red-500/20'
                                    }`}
                            >
                                <Icon
                                    name={saveMessage.type === 'success' ? 'CheckCircle' : 'AlertCircle'}
                                    className="w-5 h-5"
                                />
                                <span className="text-sm">{saveMessage.text}</span>
                            </div>
                        )}

                        {/* Botão Salvar */}
                        <div className="mt-6 flex items-center justify-between">
                            <div className="text-xs text-text-secondary flex items-center gap-1">
                                <Icon name="Info" className="w-4 h-4" />
                                <span>Estes dados serão usados nos documentos PDF gerados</span>
                            </div>
                            <button
                                onClick={handleSaveCompany}
                                disabled={isSaving}
                                className="px-6 py-2 bg-accent-primary hover:bg-accent-primary/90 text-white rounded-md font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                            >
                                {isSaving ? (
                                    <>
                                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                        Salvando...
                                    </>
                                ) : (
                                    <>
                                        <Icon name="Save" className="w-4 h-4" />
                                        Salvar Alterações
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {/* Formulário de Adição */}
                        <div className="bg-bg-secondary rounded-lg border border-border-secondary p-6">
                            <div className="flex items-center gap-2 mb-6">
                                <Icon name="Briefcase" className="w-5 h-5 text-accent-primary" />
                                <h2 className="text-lg font-semibold text-text-primary">Adicionar Serviço</h2>
                            </div>

                            <div className="flex gap-4 items-end">
                                <div className="flex-1">
                                    <label className="block text-sm font-medium text-text-primary mb-1">
                                        Tipo de Serviço
                                    </label>
                                    <select
                                        value={newService.name}
                                        onChange={(e) => setNewService(prev => ({ ...prev, name: e.target.value }))}
                                        className="w-full px-3 py-2 bg-bg-primary border border-border-secondary rounded-md text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-primary"
                                    >
                                        {SERVICE_OPTIONS.map(opt => (
                                            <option key={opt} value={opt}>{opt}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="w-40">
                                    <label className="block text-sm font-medium text-text-primary mb-1">
                                        Valor Repasse (R$)
                                    </label>
                                    <input
                                        type="text"
                                        value={newService.repasse_value}
                                        onChange={(e) => {
                                            // Allow only numbers and comma/dot
                                            const val = e.target.value.replace(/[^0-9,.]/g, '');
                                            setNewService(prev => ({ ...prev, repasse_value: val }));
                                        }}
                                        className="w-full px-3 py-2 bg-bg-primary border border-border-secondary rounded-md text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-primary"
                                        placeholder="0,00"
                                    />
                                </div>

                                <button
                                    onClick={handleAddService}
                                    disabled={isSaving}
                                    className="px-4 py-2 bg-accent-primary hover:bg-accent-primary/90 text-white rounded-md font-medium disabled:opacity-50 h-[42px] flex items-center gap-2"
                                >
                                    <Icon name="Plus" className="w-4 h-4" />
                                    Adicionar
                                </button>
                            </div>
                        </div>

                        {/* Lista de Serviços */}
                        <div className="bg-bg-secondary rounded-lg border border-border-secondary p-6">
                            <h3 className="text-lg font-semibold text-text-primary mb-4">Serviços Ativos</h3>

                            {services.length === 0 ? (
                                <p className="text-text-secondary text-center py-8">Nenhum serviço cadastrado.</p>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full">
                                        <thead>
                                            <tr className="border-b border-border-secondary">
                                                <th className="text-left py-3 px-4 text-sm font-medium text-text-secondary">Serviço</th>
                                                <th className="text-left py-3 px-4 text-sm font-medium text-text-secondary">Valor Repasse</th>
                                                <th className="text-right py-3 px-4 text-sm font-medium text-text-secondary">Ações</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {services.map(service => (
                                                <tr key={service.id} className="border-b border-border-secondary last:border-0 hover:bg-white/5">
                                                    <td className="py-3 px-4 text-text-primary">{service.name}</td>
                                                    <td className="py-3 px-4 text-text-primary font-medium">
                                                        {formatCurrency(service.repasse_value)}
                                                    </td>
                                                    <td className="py-3 px-4 text-right">
                                                        <button
                                                            onClick={() => handleDeleteService(service.id)}
                                                            className="text-red-500 hover:text-red-400 p-1 rounded hover:bg-red-500/10 transition-colors"
                                                            title="Excluir serviço"
                                                        >
                                                            <Icon name="Trash2" className="w-4 h-4" />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div >
    );
};

export default ConfiguracoesPage;
