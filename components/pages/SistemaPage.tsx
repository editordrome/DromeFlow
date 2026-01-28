import React, { useState, useEffect, lazy, Suspense } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useAppContext } from '../../contexts/AppContext';
import { sistemaService } from '../../services/sistema/sistema.service';
import { SystemManual, Module } from '../../types';
import { Icon } from '../ui/Icon';
import { BookOpen, History, Info, ChevronRight, Layout, Sparkles } from 'lucide-react';

const SistemaPage: React.FC = () => {
    const { profile, getModulesForUnit } = useAuth();
    const { selectedUnit: appUnit, setView } = useAppContext();
    const [isEditMode, setIsEditMode] = useState(false);

    // Lazy load admin page within the component
    const SistemaAdminPage = lazy(() => import('./SistemaAdminPage'));
    const [activeTab, setActiveTab] = useState<'manual' | 'history'>('manual');
    const [modules, setModules] = useState<Module[]>([]);
    const [manuals, setManuals] = useState<SystemManual[]>([]);
    const [versions, setVersions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null);
    const [selectedManualId, setSelectedManualId] = useState<string | null>(null);

    useEffect(() => {
        loadData();
    }, [appUnit]);

    const loadData = async () => {
        setLoading(true);
        try {
            let unitModules: Module[] = [];
            if (appUnit && appUnit.id !== 'ALL') {
                unitModules = await getModulesForUnit(appUnit.id);
            } else if (appUnit?.id === 'ALL') {
                const { fetchAllModules } = await import('../../services/modules/modules.service');
                unitModules = await fetchAllModules();
            }

            const [manualsData, versionsData] = await Promise.all([
                sistemaService.getAllManuals(),
                sistemaService.getAppVersions()
            ]);

            const activeModules = unitModules.filter(m => m.is_active);
            setModules(activeModules);
            setManuals(manualsData);
            setVersions(versionsData);

            if (activeModules.length > 0 && !selectedModuleId) {
                const firstModuleId = activeModules[0].id;
                setSelectedModuleId(firstModuleId);

                // Seleciona o primeiro manual deste módulo
                const firstManual = manualsData.find(m => m.module_id === firstModuleId);
                if (firstManual) {
                    setSelectedManualId(firstManual.id);
                }
            }
        } catch (error) {
            console.error('[SistemaPage] Erro ao carregar dados:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSelectModule = (moduleId: string) => {
        setSelectedModuleId(moduleId);
        // Ao trocar de módulo, seleciona o primeiro manual disponível
        const firstManual = manuals.find(m => m.module_id === moduleId);
        if (firstManual) {
            setSelectedManualId(firstManual.id);
        } else {
            setSelectedManualId(null);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full min-h-[400px]">
                <div className="w-12 h-12 border-4 border-t-4 border-gray-200 rounded-full animate-spin border-t-accent-primary"></div>
            </div>
        );
    }

    if (isEditMode && profile?.role === 'super_admin') {
        return (
            <div className="h-full flex flex-col">
                <div className="mb-4 flex items-center justify-between bg-accent-primary/5 p-3 rounded-xl border border-accent-primary/20">
                    <div className="flex items-center gap-2 text-accent-primary">
                        <Sparkles className="w-4 h-4" />
                        <span className="text-sm font-bold">Modo de Edição Ativo</span>
                    </div>
                    <button
                        onClick={() => setIsEditMode(false)}
                        className="px-4 py-1.5 bg-accent-primary text-white rounded-lg text-xs font-bold shadow-md hover:bg-accent-primary/90 transition-all"
                    >
                        Voltar para Visualização
                    </button>
                </div>
                <Suspense fallback={
                    <div className="flex items-center justify-center h-full">
                        <div className="w-10 h-10 border-4 border-t-4 border-gray-200 rounded-full animate-spin border-t-accent-primary"></div>
                    </div>
                }>
                    <SistemaAdminPage />
                </Suspense>
            </div>
        );
    }

    const selectedModule = modules.find(m => m.id === selectedModuleId);
    const moduleManuals = manuals.filter(m => m.module_id === selectedModuleId);
    const selectedManual = selectedManualId
        ? manuals.find(m => m.id === selectedManualId)
        : moduleManuals[0];

    return (
        <div className="flex flex-col h-full bg-bg-primary">
            {/* Main Layout Container */}
            <div className="flex flex-1 min-h-0 overflow-hidden rounded-xl border border-border-primary bg-bg-secondary shadow-sm">

                {/* Left Sidebar - Internal Navigation */}
                <div className="w-64 flex flex-col border-r border-border-primary bg-bg-tertiary">
                    <div className="p-4 border-b border-border-primary bg-bg-secondary">
                        <h2 className="text-lg font-bold text-text-primary flex items-center gap-2">
                            <Layout className="w-5 h-5 text-accent-primary" />
                            Sistema
                        </h2>
                    </div>

                    <div className="flex-1 overflow-y-auto p-3 space-y-4">
                        {/* Tab Switchers */}
                        <div className="space-y-1">
                            <button
                                onClick={() => setActiveTab('manual')}
                                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${activeTab === 'manual' ? 'bg-accent-primary text-white shadow-md' : 'text-text-secondary hover:bg-bg-secondary hover:text-text-primary'}`}
                            >
                                <BookOpen className={`w-4 h-4 ${activeTab === 'manual' ? 'text-white' : 'text-accent-primary'}`} />
                                Como usar
                            </button>
                            <button
                                onClick={() => setActiveTab('history')}
                                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${activeTab === 'history' ? 'bg-accent-primary text-white shadow-md' : 'text-text-secondary hover:bg-bg-secondary hover:text-text-primary'}`}
                            >
                                <History className={`w-4 h-4 ${activeTab === 'history' ? 'text-white' : 'text-accent-primary'}`} />
                                Histórico
                            </button>
                        </div>

                        {/* Module List (only in manual tab) */}
                        {activeTab === 'manual' && (
                            <div className="pt-4 border-t border-border-primary">
                                <p className="px-3 text-[10px] font-bold text-text-secondary uppercase tracking-widest mb-2">Módulos</p>
                                <div className="space-y-1">
                                    {modules.map(module => (
                                        <div key={module.id} className="space-y-1">
                                            <button
                                                onClick={() => handleSelectModule(module.id)}
                                                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-all ${selectedModuleId === module.id ? 'bg-white text-accent-primary shadow-sm border border-accent-primary/20' : 'text-text-secondary hover:bg-bg-secondary hover:text-text-primary'}`}
                                            >
                                                <div className={`p-1 rounded ${selectedModuleId === module.id ? 'bg-accent-primary/10' : 'bg-white/50'}`}>
                                                    {module.icon_name ? <Icon name={module.icon_name as any} className="w-3.5 h-3.5" /> : <BookOpen className="w-3.5 h-3.5" />}
                                                </div>
                                                <span className="truncate">{module.name}</span>
                                            </button>

                                            {/* Sub-manuals / Functions */}
                                            {selectedModuleId === module.id && moduleManuals.length > 1 && (
                                                <div className="ml-8 space-y-1 border-l border-border-primary pl-2 py-1">
                                                    {moduleManuals.map(manual => (
                                                        <button
                                                            key={manual.id}
                                                            onClick={() => setSelectedManualId(manual.id)}
                                                            className={`w-full text-left px-2 py-1 rounded-md text-[10px] font-bold transition-all ${selectedManualId === manual.id ? 'text-accent-primary bg-accent-primary/5' : 'text-text-secondary hover:text-text-primary hover:bg-bg-secondary'}`}
                                                        >
                                                            {manual.title}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                    {modules.length === 0 && (
                                        <p className="px-3 text-xs text-text-secondary italic">Nenhum módulo ativo.</p>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Admin Shortcut */}
                    {profile?.role === 'super_admin' && (
                        <div className="p-3 border-t border-border-primary bg-white/30 text-center">
                            <button
                                onClick={() => setIsEditMode(true)}
                                className="text-[10px] font-bold text-accent-primary hover:underline flex items-center justify-center gap-1 mx-auto"
                            >
                                <Sparkles className="w-3 h-3" />
                                CONFIGURAR MANUAIS
                            </button>
                        </div>
                    )}
                </div>

                {/* Right Content Area */}
                <div className="flex-1 flex flex-col min-w-0 bg-bg-secondary">
                    {activeTab === 'manual' ? (
                        <div className="h-full flex flex-col">
                            {selectedModule ? (
                                <>
                                    <div className="p-6 border-b border-border-primary bg-bg-tertiary/30">
                                        <div className="flex items-center gap-3 mb-1">
                                            <div className="p-2 rounded-lg bg-accent-primary/10 text-accent-primary">
                                                {selectedModule.icon_name ? <Icon name={selectedModule.icon_name as any} className="w-6 h-6" /> : <BookOpen className="w-6 h-6" />}
                                            </div>
                                            <h2 className="text-xl font-bold text-text-primary">
                                                {selectedManual?.title ? `${selectedManual.title}` : `Instruções: ${selectedModule.name}`}
                                            </h2>
                                        </div>
                                        <p className="text-sm text-text-secondary ml-11">
                                            {selectedManual?.title
                                                ? `Documentação da função em ${selectedModule.name}`
                                                : 'Aprenda a utilizar as funcionalidades deste módulo passo a passo.'}
                                        </p>
                                    </div>
                                    <div className="flex-1 overflow-y-auto p-8 max-w-5xl mx-auto w-full">
                                        <div className={`flex flex-col ${selectedManual?.image_position === 'left' ? 'md:flex-row gap-8' : selectedManual?.image_position === 'right' ? 'md:flex-row-reverse gap-8' : 'gap-8'} ${selectedManual?.image_position === 'bottom' ? 'flex-col-reverse' : ''}`}>
                                            {selectedManual?.image_url && (
                                                <div className={`relative rounded-3xl overflow-hidden shadow-2xl border border-white/20 flex-shrink-0 ${selectedManual.image_size === 'small' ? 'md:w-1/4 h-fit' :
                                                    selectedManual.image_size === 'medium' ? 'md:w-1/2 h-fit' :
                                                        selectedManual.image_size === 'large' ? 'md:w-3/4 h-fit' : 'w-full'
                                                    }`}>
                                                    <img
                                                        src={selectedManual.image_url}
                                                        alt={selectedManual.title}
                                                        className="w-full h-auto object-contain transition-transform duration-500 hover:scale-105"
                                                    />
                                                </div>
                                            )}
                                            <div className="flex-1 min-w-0">
                                                <div className="prose prose-slate max-w-none text-text-primary">
                                                    {selectedManual?.content ? (
                                                        <div
                                                            className="leading-relaxed text-lg"
                                                            dangerouslySetInnerHTML={{ __html: selectedManual.content.replace(/\n/g, '<br/>') }}
                                                        />
                                                    ) : (
                                                        <div className="flex flex-col items-center justify-center p-20 text-text-secondary bg-bg-tertiary/50 rounded-2xl border border-dashed border-border-primary">
                                                            <Info className="w-12 h-12 mb-4 opacity-20" />
                                                            <p className="italic">Nenhuma instrução detalhada disponível para este módulo.</p>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <div className="flex-1 flex flex-col items-center justify-center p-20 text-text-secondary">
                                    <Info className="w-12 h-12 mb-4 opacity-20" />
                                    <p>Selecione um módulo na lateral para ver as orientações.</p>
                                </div>
                            )}
                        </div>
                    ) : (
                        /* Histórico - Timeline Layout */
                        <div className="h-full flex flex-col">
                            <div className="p-6 border-b border-border-primary bg-bg-tertiary/30">
                                <div className="flex items-center gap-3 mb-1">
                                    <div className="p-2 rounded-lg bg-accent-primary/10 text-accent-primary">
                                        <History className="w-6 h-6" />
                                    </div>
                                    <h2 className="text-xl font-bold text-text-primary">Histórico de Atualizações</h2>
                                </div>
                                <p className="text-sm text-text-secondary ml-11">Acompanhe as melhorias e correções feitas no sistema ao longo do tempo.</p>
                            </div>
                            <div className="flex-1 overflow-y-auto p-10 max-w-4xl mx-auto w-full">
                                <div className="relative border-l-2 border-accent-primary/20 ml-4 space-y-12 pb-10">
                                    {versions.map((v) => (
                                        <div key={v.id} className="relative pl-10">
                                            {/* Dot and Line Connector */}
                                            <div className={`absolute -left-[11px] top-1 w-5 h-5 rounded-full border-4 border-white shadow-sm ${v.is_active ? 'bg-accent-primary ring-4 ring-accent-primary/10' : 'bg-text-secondary'}`} />

                                            <div className="bg-white rounded-2xl p-6 border border-border-primary shadow-sm hover:shadow-md transition-all">
                                                <div className="flex items-center justify-between mb-4">
                                                    <div className="flex items-center gap-3">
                                                        <span className="text-2xl font-black text-accent-primary leading-none">v{v.version}</span>
                                                        {v.is_active && (
                                                            <span className="px-2 py-0.5 bg-success text-white text-[10px] font-bold uppercase rounded-full tracking-wider animate-pulse">Atual</span>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-1.5 text-xs text-text-secondary font-semibold bg-bg-tertiary px-3 py-1 rounded-full">
                                                        <Icon name="calendar" className="w-3.5 h-3.5" />
                                                        {v.release_date ? new Date(v.release_date).toLocaleDateString('pt-BR') : '-'}
                                                    </div>
                                                </div>

                                                <h3 className="text-lg font-bold text-text-primary mb-2">{v.title}</h3>
                                                <p className="text-text-secondary text-base leading-relaxed mb-6">{v.message}</p>

                                                {v.changelog && (
                                                    <div className="bg-bg-tertiary rounded-xl p-5 border border-border-primary/50 relative overflow-hidden group">
                                                        <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                                                            <Sparkles className="w-20 h-20" />
                                                        </div>
                                                        <h4 className="text-[10px] font-black text-text-secondary uppercase tracking-[0.2em] mb-3 flex items-center gap-2">
                                                            <div className="w-1 h-3 bg-accent-primary rounded-full"></div>
                                                            Notas de Lançamento
                                                        </h4>
                                                        <div
                                                            className="text-sm text-text-primary leading-relaxed whitespace-pre-line"
                                                            dangerouslySetInnerHTML={{ __html: v.changelog.replace(/\n/g, '<br/>') }}
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                    {versions.length === 0 && (
                                        <div className="flex flex-col items-center justify-center py-20 text-text-secondary text-center">
                                            <Info className="w-16 h-16 opacity-10 mb-4" />
                                            <p className="text-lg font-medium">O log de atualizações está vazio.</p>
                                            <p className="text-sm">Fique atento para as próximas novidades do sistema.</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SistemaPage;
