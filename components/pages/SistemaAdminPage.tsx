import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../contexts/AuthContext';
import { sistemaService } from '../../services/sistema/sistema.service';
import { fetchAllModules } from '../../services/modules/modules.service';
import { SystemManual, Module } from '../../types';
import { Icon } from '../ui/Icon';
import { 
    Layout, 
    Save, 
    Image as ImageIcon, 
    Type, 
    ExternalLink, 
    AlertCircle, 
    Edit, 
    Plus,
    Maximize,
    Sidebar,
    BookOpen,
    HelpCircle,
    ChevronUp,
    ChevronDown,
    Trash2,
    FolderPlus
} from 'lucide-react';
import { updateModulesOrder, createModule, deleteModule } from '../../services/modules/modules.service';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

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
            // Filtra módulos inativos e módulos exclusivos de super_admin
            const filteredModules = modulesData.filter(m => {
                if (!m.is_active) return false;
                const isOnlySuperAdmin = m.allowed_profiles?.length === 1 && m.allowed_profiles[0] === 'super_admin';
                return !isOnlySuperAdmin;
            }).sort((a, b) => (a.position || 0) - (b.position || 0));
            
            setModules(filteredModules);

            if (filteredModules.length > 0 && !selectedModuleId) {
                const firstModule = filteredModules[0];
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
        try {
            const manualsData = await sistemaService.getManualsByModuleId(moduleId);
            setManuals(manualsData);

            if (manualsData.length > 0) {
                handleSelectManual(manualsData[0]);
            } else {
                setSelectedManualId(null);
                setTitle('Geral');
                setContent('');
                setImageUrl('');
                setPosition(0);
            }
        } catch (err) {
            console.error('[SistemaAdminPage] Erro ao carregar manuais do módulo:', err);
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
            setManuals(manualsData.sort((a, b) => (a.position || 0) - (b.position || 0)));
            if (manualsData.length > 0) {
                handleSelectManual(manualsData[0]);
            } else {
                handleNewManual();
            }
        } catch (err: any) {
            setError(err.message || 'Erro ao excluir manual');
        }
    };

    const handleMoveModule = async (index: number, direction: 'up' | 'down') => {
        const newModules = [...modules];
        const targetIndex = direction === 'up' ? index - 1 : index + 1;
        
        if (targetIndex < 0 || targetIndex >= newModules.length) return;
        
        [newModules[index], newModules[targetIndex]] = [newModules[targetIndex], newModules[index]];
        
        // Atualiza positions localmente
        const updatedModules = newModules.map((m, i) => ({ ...m, position: i + 1 }));
        setModules(updatedModules);
        
        try {
            await updateModulesOrder(updatedModules.map(m => ({ 
                id: m.id, 
                position: m.position!, 
                parent_id: m.parent_id || null 
            })));
        } catch (err) {
            console.error('Erro ao salvar nova ordem dos módulos:', err);
            loadData(); // Reverte em caso de erro
        }
    };

    const handleMoveManual = async (index: number, direction: 'up' | 'down') => {
        const newManuals = [...manuals];
        const targetIndex = direction === 'up' ? index - 1 : index + 1;
        
        if (targetIndex < 0 || targetIndex >= newManuals.length) return;
        
        [newManuals[index], newManuals[targetIndex]] = [newManuals[targetIndex], newManuals[index]];
        
        // Atualiza positions localmente
        const updatedManuals = newManuals.map((m, i) => ({ ...m, position: i + 1 }));
        setManuals(updatedManuals);
        
        try {
            await sistemaService.updateManualsOrder(updatedManuals.map(m => ({ id: m.id, position: m.position! })));
        } catch (err) {
            console.error('Erro ao salvar nova ordem dos manuais:', err);
            handleSelectModule(selectedModuleId); // Reverte em caso de erro
        }
    };

    const handleCreateCategory = async () => {
        const name = prompt('Digite o nome da nova categoria de tutorial:');
        if (!name) return;

        try {
            const code = `tutorial_${name.toLowerCase().replace(/\s+/g, '_').normalize('NFD').replace(/[\u0300-\u036f]/g, '')}`;
            await createModule({
                name,
                code,
                icon_name: 'BookOpen',
                is_active: true,
                allowed_profiles: ['super_admin', 'admin', 'user'],
                webhook_url: 'internal://tutorial',
                position: modules.length + 1
            } as any);
            
            await loadData();
            alert('Categoria criada com sucesso!');
        } catch (err: any) {
            alert(`Erro ao criar categoria: ${err.message}`);
        }
    };

    const handleDeleteCategory = async (module: Module) => {
        if (!confirm(`Tem certeza que deseja excluir a categoria "${module.name}"? Isso removerá todos os tutoriais vinculados a ela.`)) return;
        
        try {
            // Se for um módulo de tutorial (criado por nós), podemos deletar o módulo
            if (module.webhook_url === 'internal://tutorial') {
                await deleteModule(module.id);
                loadData();
            } else {
                alert('Módulos do sistema não podem ser excluídos por aqui, apenas categorias personalizadas.');
            }
        } catch (err: any) {
            alert(`Erro ao excluir categoria: ${err.message}`);
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
        <div className="flex flex-col h-full bg-bg-primary pt-1">
            <div className="flex flex-1 min-h-0 overflow-hidden rounded-lg border border-border-primary bg-bg-secondary shadow-sm">
                <div className="w-64 flex flex-col border-r border-border-primary bg-bg-tertiary">
                    <div className="p-4 border-b border-border-primary bg-bg-secondary flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Layout className="w-5 h-5 text-accent-primary" />
                            <span className="font-bold text-text-primary">Módulos</span>
                        </div>
                        <button
                            onClick={handleCreateCategory}
                            className="p-1.5 hover:bg-accent-primary/10 text-accent-primary rounded-lg transition-colors border border-accent-primary/20"
                            title="Nova Categoria Independente"
                        >
                            <FolderPlus className="w-4 h-4" />
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-3 space-y-1">
                        {modules.map((module, idx) => (
                            <motion.div
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: idx * 0.05 }}
                                key={module.id}
                                className="group relative"
                            >
                                <button
                                    onClick={() => handleSelectModule(module.id)}
                                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all ${selectedModuleId === module.id ? 'bg-white text-accent-primary shadow-sm border border-accent-primary/20' : 'text-text-secondary hover:bg-bg-secondary hover:text-text-primary'}`}
                                >
                                    <div className={`p-1.5 rounded-lg ${selectedModuleId === module.id ? 'bg-accent-primary/10' : 'bg-white/50'}`}>
                                        {module.icon_name ? (
                                            <Icon name={module.icon_name as any} className="w-4 h-4" />
                                        ) : (
                                            <BookOpen className="w-4 h-4" />
                                        )}
                                    </div>
                                    <span className="truncate flex-1 text-left">{module.name}</span>
                                    
                                    {/* Controles de Reordenamento Mobile/Hover */}
                                    <div className="flex flex-col opacity-0 group-hover:opacity-100 transition-opacity pr-1">
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); handleMoveModule(idx, 'up'); }}
                                            disabled={idx === 0}
                                            className="hover:text-accent-primary disabled:opacity-20"
                                        >
                                            <ChevronUp className="w-3 h-3" />
                                        </button>
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); handleMoveModule(idx, 'down'); }}
                                            disabled={idx === modules.length - 1}
                                            className="hover:text-accent-primary disabled:opacity-20"
                                        >
                                            <ChevronDown className="w-3 h-3" />
                                        </button>
                                    </div>
                                    
                                    {module.webhook_url === 'internal://tutorial' && (
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleDeleteCategory(module); }}
                                            className="p-1 text-danger opacity-0 group-hover:opacity-100 hover:bg-danger/10 rounded-md transition-all ml-1"
                                            title="Excluir Categoria"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    )}
                                </button>
                            </motion.div>
                        ))}
                    </div>

                    {selectedModuleId && (
                        <div className="flex-1 border-t border-border-primary overflow-y-auto p-3 space-y-1 bg-bg-primary/30">
                            <div className="px-3 py-2 flex items-center justify-between">
                                <span className="text-xs font-black text-text-secondary uppercase tracking-widest">Funções / Telas</span>
                                <button
                                    onClick={handleNewManual}
                                    className="p-1 hover:bg-accent-primary/10 text-accent-primary rounded-md transition-colors"
                                    title="Adicionar Nova Função"
                                >
                                    <Plus className="w-4 h-4" />
                                </button>
                            </div>
                            {manuals.map((manual, mIdx) => (
                                <div key={manual.id} className="group relative flex items-center">
                                    <button
                                        onClick={() => handleSelectManual(manual)}
                                        className={`flex-1 text-left px-2 py-1.5 rounded-md text-xs font-bold transition-all ${selectedManualId === manual.id ? 'text-accent-primary bg-accent-primary/5' : 'text-text-secondary hover:text-text-primary hover:bg-bg-secondary'}`}
                                    >
                                        <span className="truncate pr-12 block">{manual.title}</span>
                                    </button>
                                    
                                    {/* Controles de Reordenamento Manual */}
                                    <div className="absolute right-8 flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); handleMoveManual(mIdx, 'up'); }}
                                            disabled={mIdx === 0}
                                            className="p-0.5 hover:text-accent-primary disabled:opacity-20"
                                        >
                                            <ChevronUp className="w-3.5 h-3.5" />
                                        </button>
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); handleMoveManual(mIdx, 'down'); }}
                                            disabled={mIdx === manuals.length - 1}
                                            className="p-0.5 hover:text-accent-primary disabled:opacity-20"
                                        >
                                            <ChevronDown className="w-3.5 h-3.5" />
                                        </button>
                                    </div>

                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleDelete(manual.id); }}
                                        className="absolute right-2 p-1 text-danger opacity-0 group-hover:opacity-100 hover:bg-danger/10 rounded-md transition-all"
                                    >
                                        <AlertCircle className="w-3 h-3" />
                                    </button>
                                </div>
                            ))}
                            {manuals.length === 0 && (
                                <p className="px-3 text-xs text-text-secondary italic">Nenhuma função cadastrada.</p>
                            )}
                        </div>
                    )}
                </div>

                <div className="flex-1 flex flex-col min-w-0">
                    <AnimatePresence>
                        {selectedModuleId ? (
                            <motion.div
                                key={selectedModuleId}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                className="flex-1 flex flex-col min-w-0"
                            >
                                <div className="p-4 border-b border-border-primary bg-bg-secondary flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-xl bg-accent-primary/10 flex items-center justify-center border border-accent-primary/20">
                                            <Edit className="w-6 h-6 text-accent-primary" />
                                        </div>
                                        <div>
                                            <h2 className="font-bold text-text-primary text-lg">Editando: {selectedModule?.name}</h2>
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs text-text-secondary uppercase tracking-widest font-black">ID: {selectedModule?.code}</span>
                                                <span className="text-xs text-accent-primary font-black">•</span>
                                                <span className="text-xs text-accent-primary uppercase tracking-widest font-black">{selectedManualId ? `Função: ${title}` : 'Nova Função'}</span>
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

                                <div className="flex-1 overflow-y-auto p-8 space-y-6">
                                    <div className="max-w-7xl mx-auto space-y-8">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                            <div className="space-y-6">
                                                <div className="space-y-4">
                                                    <div className="space-y-2">
                                                        <label className="text-sm font-black text-text-secondary uppercase tracking-widest flex items-center gap-2">
                                                            <Type className="w-4 h-4 text-accent-primary" />
                                                            Título da Função / Tela
                                                        </label>
                                                        <input
                                                            type="text"
                                                            value={title}
                                                            onChange={(e) => setTitle(e.target.value)}
                                                            placeholder="Ex: Como Visualizar Faturas"
                                                            className="w-full px-4 py-3 bg-bg-tertiary border border-border-primary rounded-xl focus:ring-4 focus:ring-accent-primary/10 focus:border-accent-primary outline-none transition-all text-base placeholder:text-text-secondary/30 hover:bg-white"
                                                        />
                                                    </div>

                                                    <div className="space-y-2">
                                                        <label className="text-sm font-black text-text-secondary uppercase tracking-widest flex items-center gap-2">
                                                            <ImageIcon className="w-4 h-4 text-accent-primary" />
                                                            URL da Imagem Ilustrativa
                                                        </label>
                                                        <div className="relative">
                                                            <input
                                                                type="text"
                                                                value={imageUrl}
                                                                onChange={(e) => setImageUrl(e.target.value)}
                                                                placeholder="https://exemplo.com/imagem.png"
                                                                className="w-full px-4 py-3 bg-bg-tertiary border border-border-primary rounded-xl focus:ring-4 focus:ring-accent-primary/10 focus:border-accent-primary outline-none transition-all text-sm placeholder:text-text-secondary/30 hover:bg-white"
                                                            />
                                                            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary/30">
                                                                <ExternalLink className="w-4 h-4" />
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-4">
                                                        <div className="space-y-2">
                                                            <label className="text-sm font-black text-text-secondary uppercase tracking-widest flex items-center gap-2">
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
                                                            <label className="text-sm font-black text-text-secondary uppercase tracking-widest flex items-center gap-2">
                                                                <Maximize className="w-4 h-4 text-accent-primary" />
                                                                Tamanho
                                                            </label>
                                                            <select
                                                                value={imageSize}
                                                                onChange={(e) => setImageSize(e.target.value as any)}
                                                                className="w-full px-4 py-3 bg-bg-tertiary border border-border-primary rounded-xl focus:ring-4 focus:ring-accent-primary/10 focus:border-accent-primary outline-none transition-all text-sm hover:bg-white"
                                                            >
                                                                <option value="small">Pequeno (14px)</option>
                                                                <option value="medium">Médio (16px)</option>
                                                                <option value="large">Grande (18px)</option>
                                                                <option value="full">Logotipo / Full</option>
                                                            </select>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="space-y-2">
                                                    <label className="text-sm font-black text-text-secondary uppercase tracking-widest flex items-center gap-2">
                                                        <BookOpen className="w-4 h-4 text-accent-primary" />
                                                        Conteúdo do Passo a Passo
                                                    </label>
                                                    <textarea
                                                        value={content}
                                                        onChange={(e) => setContent(e.target.value)}
                                                        placeholder="Descreva detalhadamente como o usuário deve operar este módulo..."
                                                        className="w-full h-80 px-4 py-4 bg-bg-tertiary border border-border-primary rounded-2xl focus:ring-4 focus:ring-accent-primary/10 focus:border-accent-primary outline-none transition-all text-base resize-none hover:bg-white leading-relaxed"
                                                    />
                                                    <div className="flex justify-between items-center px-1">
                                                        <div className="flex items-center gap-3">
                                                            <div className="group relative">
                                                                <button className="text-[10px] text-accent-primary flex items-center gap-1 font-bold hover:underline">
                                                                    <HelpCircle className="w-3 h-3" />
                                                                    Dicas de Markdown
                                                                </button>
                                                                <div className="absolute bottom-full left-0 mb-2 w-64 p-3 bg-bg-secondary border border-border-primary rounded-xl shadow-xl opacity-0 group-hover:opacity-100 transition-opacity z-50 pointer-events-none text-[10px] text-text-primary">
                                                                    <p className="font-bold mb-1">Guia Rápido:</p>
                                                                    <p># Título 1</p>
                                                                    <p>## Título 2</p>
                                                                    <p>**Negrito**</p>
                                                                    <p>- Lista de Tópicos</p>
                                                                    <p>{'>'} Citação</p>
                                                                    <p>`código`</p>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <p className="text-[10px] font-bold text-accent-primary">{content.length} caracteres</p>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex flex-col h-full">
                                                <div className="flex items-center gap-2 mb-4">
                                                    <Layout className="w-4 h-4 text-text-secondary" />
                                                    <h3 className="text-sm font-black text-text-secondary uppercase tracking-widest">Visualização Final</h3>
                                                </div>
                                                <div className="flex-1 bg-white rounded-3xl border border-border-primary shadow-2xl p-8 overflow-y-auto max-h-[600px] custom-scrollbar">
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
                                                                <h1 className="text-2xl font-bold text-text-primary mb-4">{title || 'Título do Tutorial'}</h1>
                                                                {content ? (
                                                                    <div className="text-text-primary text-xl leading-relaxed markdown-content">
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
                                                                                )
                                                                            }}
                                                                        >
                                                                            {content}
                                                                        </ReactMarkdown>
                                                                    </div>
                                                                ) : (
                                                                    <div className="flex flex-col items-center justify-center p-12 text-text-secondary/40 italic">
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
                            </motion.div>
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center bg-bg-tertiary/20">
                                <div className="w-20 h-20 bg-white rounded-3xl shadow-xl flex items-center justify-center mb-6">
                                    <Sidebar className="w-10 h-10 text-accent-primary/20" />
                                </div>
                                <p className="text-text-secondary font-bold">Selecione um módulo para começar a configurar</p>
                            </div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </div>
    );
};

export default SistemaAdminPage;
