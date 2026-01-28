import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { sistemaService } from '../../services/sistema/sistema.service';
import { fetchAllModules } from '../../services/modules/modules.service';
import { SystemManual, Module } from '../../types';
import { Icon } from '../ui/Icon';
import { Save, AlertCircle, Edit, Image as ImageIcon, Layout, BookOpen, ExternalLink, ChevronRight, Maximize } from 'lucide-react';

const SistemaAdminPage: React.FC = () => {
    const [modules, setModules] = useState<Module[]>([]);
    const [manuals, setManuals] = useState<SystemManual[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedModuleId, setSelectedModuleId] = useState<string>('');
    const [selectedManualId, setSelectedManualId] = useState<string | null>(null);
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [imageUrl, setImageUrl] = useState('');
    const [imagePosition, setImagePosition] = useState<'top' | 'bottom' | 'left' | 'right'>('top');
    const [imageSize, setImageSize] = useState<'small' | 'medium' | 'large' | 'full'>('full');
    const [position, setPosition] = useState(0);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const modulesData = await fetchAllModules();
            const activeModules = modulesData.filter(m => m.is_active);
            setModules(activeModules);

            if (activeModules.length > 0) {
                const firstModule = activeModules[0];
                handleSelectModule(firstModule.id);
            }
        } catch (error) {
            console.error('[SistemaAdminPage] Erro:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSelectModule = async (moduleId: string) => {
        setSelectedModuleId(moduleId);
        setLoading(true); // Loading local para carregar manuais
        try {
            const manualsData = await sistemaService.getManualsByModuleId(moduleId);
            setManuals(manualsData);

            if (manualsData.length > 0) {
                handleSelectManual(manualsData[0]);
            } else {
                // Se não houver manuais, limpa campos
                setSelectedManualId(null);
                setTitle('Geral');
                setContent('');
                setImageUrl('');
                setPosition(0);
            }
        } catch (err) {
            console.error('[SistemaAdminPage] Erro ao carregar manuais do módulo:', err);
        } finally {
            setLoading(false);
        }
        setError(null);
    };

    const handleSelectManual = (manual: SystemManual) => {
        setSelectedManualId(manual.id);
        setTitle(manual.title);
        setContent(manual.content || '');
        setImageUrl(manual.image_url || '');
        setImagePosition((manual.image_position as any) === 'side' ? 'left' : (manual.image_position as any) || 'top');
        setImageSize(manual.image_size || 'full');
        setPosition(manual.position || 0);
        setError(null);
    };

    const handleNewManual = () => {
        setSelectedManualId(null);
        setTitle('');
        setContent('');
        setImageUrl('');
        setImagePosition('top');
        setImageSize('full');
        setPosition(manuals.length);
        setError(null);
    };

    const handleSave = async () => {
        if (!selectedModuleId || !title) {
            setError('O título da função é obrigatório');
            return;
        }
        setIsSaving(true);
        setError(null);
        try {
            const saved = await sistemaService.upsertManual({
                id: selectedManualId || undefined,
                module_id: selectedModuleId,
                title,
                content,
                image_url: imageUrl,
                image_position: imagePosition,
                image_size: imageSize,
                position
            });

            // Recarregar manuais do módulo para garantir ordem e dados frescos
            const manualsData = await sistemaService.getManualsByModuleId(selectedModuleId);
            setManuals(manualsData);
            setSelectedManualId(saved.id);

            alert('Manual salvo com sucesso!');
        } catch (err: any) {
            setError(err.message || 'Erro ao salvar manual');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Tem certeza que deseja excluir este manual?')) return;
        try {
            await sistemaService.deleteManual(id);
            const manualsData = await sistemaService.getManualsByModuleId(selectedModuleId);
            setManuals(manualsData);
            if (manualsData.length > 0) {
                handleSelectManual(manualsData[0]);
            } else {
                handleNewManual();
            }
        } catch (err: any) {
            setError(err.message || 'Erro ao excluir manual');
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full min-h-[400px]">
                <div className="w-12 h-12 border-4 border-t-4 border-gray-200 rounded-full animate-spin border-t-accent-primary"></div>
            </div>
        );
    }

    const selectedModule = modules.find(m => m.id === selectedModuleId);

    return (
        <div className="flex flex-col h-full bg-bg-primary">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-text-primary">Configuração de Manuais</h1>
                    <p className="text-text-secondary text-sm">Gerencie o conteúdo de ajuda disponível para cada módulo do sistema.</p>
                </div>
            </div>

            <div className="flex flex-1 min-h-0 overflow-hidden rounded-2xl border border-border-primary bg-bg-secondary shadow-lg">

                {/* Lateral Navigation - Module Selector */}
                <div className="w-72 flex flex-col border-r border-border-primary bg-bg-tertiary">
                    <div className="p-4 border-b border-border-primary bg-bg-secondary flex items-center gap-2">
                        <Layout className="w-5 h-5 text-accent-primary" />
                        <span className="font-bold text-text-primary">Lista de Módulos</span>
                    </div>

                    <div className="flex-1 overflow-y-auto p-3 space-y-1">
                        {modules.map(module => (
                            <button
                                key={module.id}
                                onClick={() => handleSelectModule(module.id)}
                                className={`w-full flex items-center justify-between p-3 rounded-xl text-sm font-medium transition-all group ${selectedModuleId === module.id ? 'bg-accent-primary text-white shadow-md' : 'text-text-primary hover:bg-bg-secondary border border-transparent hover:border-border-primary'}`}
                            >
                                <div className="flex items-center gap-3 truncate">
                                    <div className={`p-1.5 rounded-lg transition-colors ${selectedModuleId === module.id ? 'bg-white/20' : 'bg-bg-tertiary group-hover:bg-white'}`}>
                                        <Icon name={module.icon_name as any} className={`w-4 h-4 ${selectedModuleId === module.id ? 'text-white' : 'text-accent-primary'}`} />
                                    </div>
                                    <span className="truncate">{module.name}</span>
                                </div>
                                {selectedModuleId === module.id && <ChevronRight className="w-4 h-4 text-white/50" />}
                            </button>
                        ))}
                    </div>

                    {/* Sub-navigation for Functions/Manuals */}
                    {selectedModuleId && (
                        <div className="flex-1 border-t border-border-primary overflow-y-auto p-3 space-y-1 bg-bg-primary/30">
                            <div className="px-3 py-2 flex items-center justify-between">
                                <span className="text-[10px] font-black text-text-secondary uppercase tracking-widest">Funções / Telas</span>
                                <button
                                    onClick={handleNewManual}
                                    className="p-1 hover:bg-accent-primary/10 text-accent-primary rounded-md transition-colors"
                                    title="Adicionar Nova Função"
                                >
                                    <Save className="w-3.5 h-3.5" /> {/* Use plus icon if available, but Save works conceptually here as "create" */}
                                </button>
                            </div>
                            {manuals.map(manual => (
                                <div key={manual.id} className="group relative">
                                    <button
                                        onClick={() => handleSelectManual(manual)}
                                        className={`w-full flex items-center justify-between p-2.5 rounded-lg text-xs font-medium transition-all ${selectedManualId === manual.id ? 'bg-white text-accent-primary shadow-sm' : 'text-text-secondary hover:bg-white hover:text-text-primary'}`}
                                    >
                                        <span className="truncate pr-6">{manual.title}</span>
                                    </button>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleDelete(manual.id); }}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-danger opacity-0 group-hover:opacity-100 hover:bg-danger/10 rounded-md transition-all"
                                    >
                                        <AlertCircle className="w-3 h-3" />
                                    </button>
                                </div>
                            ))}
                            {manuals.length === 0 && (
                                <p className="px-3 text-[10px] text-text-secondary italic">Nenhuma função cadastrada.</p>
                            )}
                        </div>
                    )}
                </div>

                {/* Editor Area */}
                <div className="flex-1 flex flex-col min-w-0">
                    <div className="p-4 border-b border-border-primary bg-bg-tertiary/30 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="p-2.5 rounded-xl bg-white shadow-sm border border-border-primary text-accent-primary">
                                <Edit className="w-5 h-5" />
                            </div>
                            <div>
                                <h2 className="font-bold text-text-primary text-lg">Editando: {selectedModule?.name}</h2>
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] text-text-secondary uppercase tracking-widest font-black">ID: {selectedModule?.code}</span>
                                    <span className="text-[10px] text-accent-primary font-black">•</span>
                                    <span className="text-[10px] text-accent-primary uppercase tracking-widest font-black">{selectedManualId ? `Função: ${title}` : 'Nova Função'}</span>
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={handleSave}
                                disabled={isSaving || !selectedModuleId}
                                className="flex items-center px-6 py-2.5 bg-accent-primary text-white rounded-xl text-sm font-bold hover:bg-accent-primary/90 disabled:opacity-50 transition-all shadow-md active:scale-95"
                            >
                                {isSaving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                                Salvar Manual
                            </button>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-8 max-w-5xl mx-auto w-full">
                        {error && (
                            <div className="mb-6 p-4 bg-danger/10 border-l-4 border-danger text-danger text-sm font-medium rounded-r-xl flex items-center gap-3">
                                <AlertCircle className="w-5 h-5" />
                                {error}
                            </div>
                        )}

                        <div className="grid grid-cols-1 gap-8">
                            {/* Input Fields */}
                            <div className="space-y-6">
                                <div className="grid grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-xs font-black text-text-secondary uppercase tracking-widest flex items-center gap-2">
                                            <Edit className="w-4 h-4 text-accent-primary" />
                                            Título da Função
                                        </label>
                                        <input
                                            type="text"
                                            value={title}
                                            onChange={(e) => setTitle(e.target.value)}
                                            placeholder="Ex: Como Visualizar Cards"
                                            className="w-full px-4 py-3 bg-bg-tertiary border border-border-primary rounded-xl focus:ring-4 focus:ring-accent-primary/10 focus:border-accent-primary outline-none transition-all text-sm placeholder:text-text-secondary/50 hover:bg-white"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-black text-text-secondary uppercase tracking-widest flex items-center gap-2">
                                            <Layout className="w-4 h-4 text-accent-primary" />
                                            Ordem (Position)
                                        </label>
                                        <input
                                            type="number"
                                            value={position}
                                            onChange={(e) => setPosition(parseInt(e.target.value) || 0)}
                                            className="w-full px-4 py-3 bg-bg-tertiary border border-border-primary rounded-xl focus:ring-4 focus:ring-accent-primary/10 focus:border-accent-primary outline-none transition-all text-sm hover:bg-white"
                                        />
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-xs font-black text-text-secondary uppercase tracking-widest flex items-center gap-2">
                                            <ImageIcon className="w-4 h-4 text-accent-primary" />
                                            URL da Imagem Ilustrativa
                                        </label>
                                        <div className="relative group">
                                            <input
                                                type="text"
                                                value={imageUrl}
                                                onChange={(e) => setImageUrl(e.target.value)}
                                                placeholder="Ex: https://dominio.com/tutorial.png"
                                                className="w-full px-4 py-3 bg-bg-tertiary border border-border-primary rounded-xl focus:ring-4 focus:ring-accent-primary/10 focus:border-accent-primary outline-none transition-all text-sm placeholder:text-text-secondary/50 group-hover:bg-white"
                                            />
                                            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary/30">
                                                <ExternalLink className="w-4 h-4" />
                                            </div>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-xs font-black text-text-secondary uppercase tracking-widest flex items-center gap-2">
                                                <Layout className="w-4 h-4 text-accent-primary" />
                                                Posição
                                            </label>
                                            <select
                                                value={imagePosition}
                                                onChange={(e) => setImagePosition(e.target.value as any)}
                                                className="w-full px-4 py-3 bg-bg-tertiary border border-border-primary rounded-xl focus:ring-4 focus:ring-accent-primary/10 focus:border-accent-primary outline-none transition-all text-sm hover:bg-white"
                                            >
                                                <option value="top">Topo</option>
                                                <option value="bottom">Fundo</option>
                                                <option value="left">Esquerda</option>
                                                <option value="right">Direita</option>
                                            </select>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-xs font-black text-text-secondary uppercase tracking-widest flex items-center gap-2">
                                                <Maximize className="w-4 h-4 text-accent-primary" />
                                                Tamanho
                                            </label>
                                            <select
                                                value={imageSize}
                                                onChange={(e) => setImageSize(e.target.value as any)}
                                                className="w-full px-4 py-3 bg-bg-tertiary border border-border-primary rounded-xl focus:ring-4 focus:ring-accent-primary/10 focus:border-accent-primary outline-none transition-all text-sm hover:bg-white"
                                            >
                                                <option value="small">Pequeno</option>
                                                <option value="medium">Médio</option>
                                                <option value="large">Grande</option>
                                                <option value="full">Logotipo / Full</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-xs font-black text-text-secondary uppercase tracking-widest flex items-center gap-2">
                                        <BookOpen className="w-4 h-4 text-accent-primary" />
                                        Conteúdo do Passo a Passo
                                    </label>
                                    <textarea
                                        value={content}
                                        onChange={(e) => setContent(e.target.value)}
                                        placeholder="Descreva detalhadamente como o usuário deve operar este módulo..."
                                        className="w-full h-80 px-4 py-4 bg-bg-tertiary border border-border-primary rounded-2xl focus:ring-4 focus:ring-accent-primary/10 focus:border-accent-primary outline-none transition-all text-sm resize-none group-hover:bg-white leading-relaxed"
                                    />
                                    <div className="flex justify-between items-center px-1">
                                        <p className="text-[10px] text-text-secondary/70">Dica: Use quebras de linha para separar os passos.</p>
                                        <p className="text-[10px] font-bold text-accent-primary">{content.length} caracteres</p>
                                    </div>
                                </div>
                            </div>

                            {/* Preview Section */}
                            <div className="pt-8 border-t border-border-primary space-y-4">
                                <div className="flex items-center gap-2 mb-2">
                                    <Layout className="w-4 h-4 text-text-secondary" />
                                    <h3 className="text-xs font-black text-text-secondary uppercase tracking-widest">Pré-visualização do Usuário</h3>
                                </div>
                                <div className="bg-bg-tertiary/30 rounded-3xl border border-dashed border-border-primary p-8 min-h-[400px]">
                                    <div className={`flex flex-col ${imagePosition === 'left' ? 'md:flex-row gap-8' : imagePosition === 'right' ? 'md:flex-row-reverse gap-8' : 'gap-8'} ${imagePosition === 'bottom' ? 'flex-col-reverse' : ''}`}>
                                        {imageUrl && (
                                            <div className={`relative rounded-2xl overflow-hidden shadow-2xl border border-border-primary flex-shrink-0 ${imageSize === 'small' ? 'md:w-1/4 h-fit' :
                                                imageSize === 'medium' ? 'md:w-1/2 h-fit' :
                                                    imageSize === 'large' ? 'md:w-3/4 h-fit' : 'w-full'
                                                }`}>
                                                <img
                                                    src={imageUrl}
                                                    alt="Preview"
                                                    className="w-full h-auto object-contain"
                                                />
                                            </div>
                                        )}
                                        <div className="flex-1 min-w-0">
                                            <div className="prose prose-slate max-w-none">
                                                {content ? (
                                                    <div
                                                        className="text-text-primary text-base leading-relaxed"
                                                        dangerouslySetInnerHTML={{ __html: content.replace(/\n/g, '<br/>') }}
                                                    />
                                                ) : (
                                                    <div className="flex flex-col items-center justify-center p-12 text-text-secondary/40 italic">
                                                        <div className="w-16 h-16 bg-bg-tertiary rounded-full flex items-center justify-center mb-4">
                                                            <BookOpen className="w-8 h-8 opacity-20" />
                                                        </div>
                                                        <p>O conteúdo do manual aparecerá aqui.</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SistemaAdminPage;
