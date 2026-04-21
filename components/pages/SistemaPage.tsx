import React, { useState, useEffect, lazy, Suspense } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useAppContext } from '../../contexts/AppContext';
import { sistemaService } from '../../services/sistema/sistema.service';
import { SystemManual, Module } from '../../types';
import { Icon } from '../ui/Icon';
import { BookOpen, History, Info, ChevronRight, Layout, Sparkles } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const SistemaPage: React.FC = () => {
    const { profile, getModulesForUnit } = useAuth();
    const { selectedUnit: appUnit, setView } = useAppContext();
    const [isEditMode, setIsEditMode] = useState(false);

    // Lazy load admin page within the component
    const SistemaAdminPage = lazy(() => import('./SistemaAdminPage'));
    const [modules, setModules] = useState<Module[]>([]);
    const [manuals, setManuals] = useState<SystemManual[]>([]);
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
            
            // Desenvolvedor/Super Admin deve ver todos os módulos para poder configurar manuais
            if (profile?.role === 'super_admin') {
                const { fetchAllModules } = await import('../../services/modules/modules.service');
                unitModules = await fetchAllModules();
            } else {
                unitModules = await getModulesForUnit(appUnit?.id || null);
            }

            const manualsData = await sistemaService.getAllManuals();

            // Filtra módulos inativos e módulos exclusivos de super_admin
            const filteredModules = unitModules.filter(m => {
                if (!m.is_active) return false;
                const isOnlySuperAdmin = m.allowed_profiles?.length === 1 && m.allowed_profiles[0] === 'super_admin';
                return !isOnlySuperAdmin;
            }).sort((a, b) => (a.position || 0) - (b.position || 0));

            // Ordena manuais por posição
            const sortedManuals = manualsData.sort((a, b) => (a.position || 0) - (b.position || 0));

            setModules(filteredModules);
            setManuals(sortedManuals);

            if (filteredModules.length > 0 && !selectedModuleId) {
                const firstModuleId = filteredModules[0].id;
                setSelectedModuleId(firstModuleId);

                // Seleciona o primeiro manual deste módulo
                const firstManual = sortedManuals.find(m => m.module_id === firstModuleId);
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
                            Tutoriais
                        </h2>
                    </div>

                    <div className="flex-1 overflow-y-auto p-3 space-y-4">
                        {/* Module List */}
                        <div className="pt-2">
                            <p className="px-3 text-xs font-black text-text-secondary uppercase tracking-widest mb-3 text-center">Como usar: Módulos</p>
                                <div className="space-y-1">
                                    {modules.map(module => (
                                        <div key={module.id} className="space-y-1">
                                            <button
                                                onClick={() => handleSelectModule(module.id)}
                                                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all ${selectedModuleId === module.id ? 'bg-white text-accent-primary shadow-sm border border-accent-primary/20' : 'text-text-secondary hover:bg-bg-secondary hover:text-text-primary'}`}
                                            >
                                                <div className={`p-1.5 rounded-lg ${selectedModuleId === module.id ? 'bg-accent-primary/10' : 'bg-white/50'}`}>
                                                    {module.icon_name ? <Icon name={module.icon_name as any} className="w-4 h-4" /> : <BookOpen className="w-4 h-4" />}
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
                                                            className={`w-full text-left px-2 py-1.5 rounded-md text-xs font-bold transition-all ${selectedManualId === manual.id ? 'text-accent-primary bg-accent-primary/5' : 'text-text-secondary hover:text-text-primary hover:bg-bg-secondary'}`}
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
                    </div>

                    {/* Admin Shortcut */}
                    {profile?.role === 'super_admin' && (
                        <div className="p-3 border-t border-border-primary bg-white/30 text-center">
                            <button
                                onClick={() => setIsEditMode(true)}
                                className="text-xs font-black text-accent-primary hover:underline flex items-center justify-center gap-2 mx-auto"
                            >
                                <Sparkles className="w-4 h-4" />
                                CONFIGURAR TUTORIAIS
                            </button>
                        </div>
                    )}
                </div>

                {/* Right Content Area */}
                <div className="flex-1 flex flex-col min-w-0 bg-bg-secondary">
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
                                    <p className="text-base text-text-secondary ml-11">
                                        {selectedManual?.title
                                            ? `Documentação da função em ${selectedModule.name}`
                                            : 'Aprenda a utilizar as funcionalidades deste módulo passo a passo.'}
                                    </p>
                                </div>
                                <div className="flex-1 overflow-y-auto px-4 py-8 md:px-10 max-w-7xl mx-auto w-full">
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
                                                    <div className="markdown-content">
                                                        <ReactMarkdown 
                                                            remarkPlugins={[remarkGfm]}
                                                            components={{
                                                                h1: ({node, ...props}) => <h1 className="text-3xl font-black text-text-primary mb-6 pt-4 border-b border-border-primary/30 pb-2" {...props} />,
                                                                h2: ({node, ...props}) => <h2 className="text-2xl font-bold text-text-primary mt-8 mb-4 flex items-center gap-2" {...props} />,
                                                                h3: ({node, ...props}) => <h3 className="text-xl font-bold text-accent-primary mt-6 mb-3" {...props} />,
                                                                p: ({node, ...props}) => <p className="text-lg leading-relaxed text-text-primary/90 mb-4" {...props} />,
                                                                ul: ({node, ...props}) => <ul className="list-none space-y-3 mb-6 ml-4" {...props} />,
                                                                li: ({node, ...props}) => (
                                                                    <li className="flex items-start gap-3 text-lg text-text-primary/80 group" {...props}>
                                                                        <div className="mt-1.5 w-2 h-2 rounded-full bg-accent-primary shrink-0 group-hover:scale-125 transition-transform" />
                                                                        <span>{props.children}</span>
                                                                    </li>
                                                                ),
                                                                strong: ({node, ...props}) => <strong className="font-black text-accent-primary" {...props} />,
                                                                code: ({node, ...props}) => <code className="bg-bg-tertiary px-1.5 py-0.5 rounded text-accent-primary font-mono text-sm border border-border-primary/50" {...props} />,
                                                                blockquote: ({node, ...props}) => (
                                                                    <blockquote className="border-l-4 border-accent-primary bg-accent-primary/5 p-4 rounded-r-xl my-6 italic text-text-secondary" {...props} />
                                                                ),
                                                            }}
                                                        >
                                                            {selectedManual.content}
                                                        </ReactMarkdown>
                                                    </div>
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
                </div>
            </div>
        </div>
    );
};

export default SistemaPage;
