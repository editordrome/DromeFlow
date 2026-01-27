import React, { useEffect, useState } from 'react';
import { useAppContext } from '../../contexts/AppContext';
import { Icon } from '../ui/Icon';
import { getUnitConfig, updateUnitConfig } from '../../services/units/unitConfig.service';
import { getUnitServices, createUnitService, deleteUnitService, updateUnitService } from '../../services/units/unitServices.service';
import { Unit, UnitService } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import ManageUsersPage from './ManageUsersPage';
import { DocumentsSettingsPage } from './DocumentsSettingsPage';

const SERVICE_OPTIONS = [
    '2 horas', '3 horas', '4 horas', '5 horas', '6 horas',
    '7 horas', '8 horas', '9 horas', '10 horas', '11 horas', '12 horas',
    'Passadoria'
];

const ConfiguracoesPage: React.FC = () => {
    const { selectedUnit } = useAppContext();
    const { profile } = useAuth();
    const [activeTab, setActiveTab] = useState<'company' | 'services' | 'users' | 'documents'>('company');

    // Form Data da Empresa
    const [formData, setFormData] = useState({
        razao_social: '',
        cnpj: '',
        endereco: '',
        contato: '',
        email: '',
        responsavel: '',
        uniform_value: '0'
    });

    // Serviços Data
    const [services, setServices] = useState<UnitService[]>([]);
    const [newService, setNewService] = useState<Omit<UnitService, 'id' | 'created_at' | 'uniform_value'>>({
        unit_id: selectedUnit?.id || '',
        name: '2 horas',
        repasse_value: '',
        active: true
    });

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
                // Carregar Configurações da Empresa
                const configData = await getUnitConfig(selectedUnit.id);
                if (configData) {
                    setFormData({
                        razao_social: configData.razao_social || '',
                        cnpj: configData.cnpj || '',
                        endereco: configData.endereco || '',
                        contato: configData.contato || '',
                        email: configData.email || '',
                        responsavel: configData.responsavel || '',
                        uniform_value: configData.uniform_value
                            ? String(configData.uniform_value).replace('.', ',')
                            : '0,00'
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

        setIsSaving(true);
        try {
            // Converter vírgula para ponto no valor do uniforme
            const uniformValue = formData.uniform_value
                ? parseFloat(formData.uniform_value.replace(',', '.'))
                : 0;

            const result = await updateUnitConfig(selectedUnit.id, {
                ...formData,
                uniform_value: uniformValue
            });

            if (result.success) {
                setSaveMessage({ type: 'success', text: 'Dados salvos com sucesso!' });
                setTimeout(() => setSaveMessage(null), 3000);
            } else {
                setSaveMessage({ type: 'error', text: result.error || 'Erro ao salvar' });
            }
        } catch (error) {
            console.error(error);
            setSaveMessage({ type: 'error', text: 'Erro ao salvar dados' });
        } finally {
            setIsSaving(false);
        }
    };

    // Gerenciar Serviços
    const handleAddService = async () => {
        if (!selectedUnit || selectedUnit.id === 'ALL') return;

        if (!newService.repasse_value || newService.repasse_value.trim() === '') {
            alert('Informe o valor do repasse');
            return;
        }

        const repasseValue = parseFloat(newService.repasse_value.replace(',', '.'));

        if (isNaN(repasseValue)) {
            alert('Valor de repasse inválido');
            return;
        }

        const existingService = services.find(s => s.name === newService.name);

        setIsSaving(true);
        try {
            if (existingService) {
                const updated = await updateUnitService(existingService.id, {
                    repasse_value: repasseValue.toString(),
                    active: true
                });
                setServices(prev => prev.map(s => s.id === updated.id ? updated : s));
            } else {
                const created = await createUnitService({
                    unit_id: selectedUnit.id,
                    name: newService.name,
                    repasse_value: repasseValue.toString(),
                    active: true
                });
                setServices(prev => [...prev, created]);
            }
            setNewService(prev => ({ ...prev, repasse_value: '' }));
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

    const hasUnitSelected = selectedUnit && selectedUnit.id !== 'ALL';

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
                <h1 className="text-2xl font-bold text-text-primary mb-2">Configurações</h1>
                <p className="text-text-secondary">
                    Gerencie os dados da unidade, serviços e usuários
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
                {(profile?.role === 'super_admin' || profile?.role === 'admin') && (
                    <button
                        className={`px-4 py-2 font-medium text-sm transition-colors relative ${activeTab === 'users'
                            ? 'text-accent-primary'
                            : 'text-text-secondary hover:text-text-primary'
                            }`}
                        onClick={() => setActiveTab('users')}
                    >
                        Usuários
                        {activeTab === 'users' && (
                            <div className="absolute bottom-0 left-0 w-full h-0.5 bg-accent-primary"></div>
                        )}
                    </button>
                )}
                <button
                    className={`px-4 py-2 font-medium text-sm transition-colors relative ${activeTab === 'documents'
                        ? 'text-accent-primary'
                        : 'text-text-secondary hover:text-text-primary'
                        }`}
                    onClick={() => setActiveTab('documents')}
                >
                    Documentos
                    {activeTab === 'documents' && (
                        <div className="absolute bottom-0 left-0 w-full h-0.5 bg-accent-primary"></div>
                    )}
                </button>
            </div>

            <div className="flex-1 overflow-y-auto">
                {activeTab === 'company' ? (
                    !hasUnitSelected ? (
                        <div className="flex items-center justify-center h-64 border border-dashed border-border-secondary rounded-lg">
                            <div className="text-center">
                                <Icon name="AlertCircle" className="w-10 h-10 text-text-secondary mx-auto mb-3" />
                                <p className="text-text-secondary text-sm">Selecione uma unidade para configurar os dados da empresa</p>
                            </div>
                        </div>
                    ) : (
                        <div className="bg-bg-secondary rounded-lg border border-border-secondary p-6">
                            <div className="flex items-center justify-between mb-6">
                                <div className="flex items-center gap-2">
                                    <Icon name="Building2" className="w-5 h-5 text-accent-primary" />
                                    <h2 className="text-lg font-semibold text-text-primary">Dados da Empresa</h2>
                                </div>
                                <div className="flex items-center gap-4">
                                    <div className="w-24">
                                        <label className="block text-xs font-medium text-text-secondary mb-1">
                                            Uniforme (R$)
                                        </label>
                                        <input
                                            type="text"
                                            value={
                                                formData.uniform_value && formData.uniform_value !== '0'
                                                    ? formatCurrency(parseFloat(formData.uniform_value.toString().replace(',', '.'))).replace('R$', '').trim()
                                                    : '0,00'
                                            }
                                            onChange={(e) => {
                                                const val = e.target.value.replace(/[^0-9,.]/g, '');
                                                handleChange('uniform_value', val);
                                            }}
                                            className="w-full px-2 py-2 bg-bg-primary border border-border-secondary rounded-md text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-primary text-sm"
                                            placeholder="0,00"
                                        />
                                    </div>
                                    <button
                                        onClick={handleSaveCompany}
                                        disabled={isSaving}
                                        className="p-2 bg-accent-primary hover:bg-accent-primary/90 text-white rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                        title="Salvar Alterações"
                                    >
                                        {isSaving ? (
                                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                                        ) : (
                                            <Icon name="Save" className="w-5 h-5" />
                                        )}
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-4">
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

                            {saveMessage && (
                                <div className={`mt-4 p-3 rounded-md flex items-center gap-2 ${saveMessage.type === 'success' ? 'bg-green-500/10 text-green-500 border border-green-500/20' : 'bg-red-500/10 text-red-500 border border-red-500/20'}`}>
                                    <Icon name={saveMessage.type === 'success' ? 'CheckCircle' : 'AlertCircle'} className="w-5 h-5" />
                                    <span className="text-sm">{saveMessage.text}</span>
                                </div>
                            )}
                        </div>
                    )
                ) : activeTab === 'services' ? (
                    !hasUnitSelected ? (
                        <div className="flex items-center justify-center h-64 border border-dashed border-border-secondary rounded-lg">
                            <div className="text-center">
                                <Icon name="AlertCircle" className="w-10 h-10 text-text-secondary mx-auto mb-3" />
                                <p className="text-text-secondary text-sm">Selecione uma unidade para gerenciar serviços e repasses</p>
                            </div>
                        </div>
                    ) : (
                        <div className="bg-bg-secondary rounded-lg border border-border-secondary p-6">
                            <div className="flex items-center justify-between mb-6 pb-6 border-b border-border-secondary">
                                <div className="flex items-center gap-2">
                                    <Icon name="Briefcase" className="w-5 h-5 text-accent-primary" />
                                    <h2 className="text-lg font-semibold text-text-primary whitespace-nowrap">Gestão de Serviços</h2>
                                </div>

                                <div className="flex items-center gap-3">
                                    <select
                                        value={newService.name}
                                        onChange={(e) => setNewService(prev => ({ ...prev, name: e.target.value }))}
                                        className="px-3 py-2 bg-bg-primary border border-border-secondary rounded-md text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-primary text-sm h-[38px]"
                                    >
                                        {SERVICE_OPTIONS.map(opt => (
                                            <option key={opt} value={opt}>{opt}</option>
                                        ))}
                                    </select>

                                    <input
                                        type="text"
                                        value={newService.repasse_value}
                                        onChange={(e) => {
                                            const val = e.target.value.replace(/[^0-9]/g, '');
                                            if (val.length > 2) {
                                                const formatted = val.slice(0, -2) + ',' + val.slice(-2);
                                                setNewService(prev => ({ ...prev, repasse_value: formatted }));
                                            } else if (val.length > 0) {
                                                setNewService(prev => ({ ...prev, repasse_value: val }));
                                            } else {
                                                setNewService(prev => ({ ...prev, repasse_value: '' }));
                                            }
                                        }}
                                        className="w-28 px-3 py-2 bg-bg-primary border border-border-secondary rounded-md text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-primary text-sm h-[38px]"
                                        placeholder="100,00"
                                    />

                                    <button
                                        onClick={handleAddService}
                                        disabled={isSaving}
                                        className="p-2 bg-accent-primary hover:bg-accent-primary/90 text-white rounded-md disabled:opacity-50 transition-colors h-[38px] w-[38px] flex items-center justify-center"
                                        title="Adicionar Serviço"
                                    >
                                        <Icon name="Plus" className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>

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
                    )
                ) : activeTab === 'users' ? (
                    <ManageUsersPage />
                ) : activeTab === 'documents' ? (
                    <DocumentsSettingsPage />
                ) : null}
            </div>
        </div>
    );
};

export default ConfiguracoesPage;
