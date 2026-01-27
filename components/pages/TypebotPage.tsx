import React, { useState, useRef, useEffect } from 'react';
import {
    Upload,
    Download,
    Rocket,
    FileJson,
    AlertCircle,
    CheckCircle2,
    RefreshCcw,
    Settings2,
    Grid,
    Layout,
    ChevronDown,
    ChevronUp,
    Store,
    Activity
} from 'lucide-react';
import { supabase } from '../../services/supabaseClient';
import { Unit, UnitService } from '../../types';
import { TYPEBOT_TEMPLATES } from '../../constants/typebotTemplates';
import { Icon } from '../ui/Icon';


// ==========================================
// CONFIGURAÇÃO DOS IDs DE VARIÁVEIS NO TYPEBOT
// ==========================================
const VAR_IDS = {
    'unidade': 'jmopscci3oquo7m8430ne4wm',
    'unit_id': 'vruw1oe91zewv56vljsf9mag5',
    'color_card': 'vagoecflae99h2zujhewnxdpy',
    'valor_4h': 'vfvvnkzyhkn0sbafj69s4efjr',
    'valor_6h': 'vf6gchx73bboqxowpgfvmq1f2',
    'valor_8h': 'vmrngnaxxz3xre4mf322vfiyq'
};

const MENU_BLOCK_ID = 'jligv1oxrjpag2e8bvu7rzgr';

interface DetectedUnit {
    index: number;
    itemId?: string;
    groupId?: string;
    currentLabel: string;
    defaults: Record<string, string>;
}

const TypebotPage: React.FC = () => {
    // State for JSON processing
    const [originalJson, setOriginalJson] = useState<any>(null);
    const [appMode, setAppMode] = useState<'single' | 'multi' | ''>('');
    const [detectedUnits, setDetectedUnits] = useState<DetectedUnit[]>([]);

    // State for Database data
    const [units, setUnits] = useState<Unit[]>([]);
    const [isLoadingData, setIsLoadingData] = useState(false);

    // State for UI/API
    const [apiConfig, setApiConfig] = useState({
        baseUrl: "https://type.seucadastrodigital.com.br",
        token: "p2YTRkTsun5gSVicuIa1BLLq",
        workspaceId: "cmkomijmn0000pi1bds3bzfhs"
    });
    const [showApiConfig, setShowApiConfig] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [isApiModalOpen, setIsApiModalOpen] = useState(false);


    // Initial load: Fetch units
    useEffect(() => {
        const fetchUnits = async () => {
            setIsLoadingData(true);
            try {
                const { data, error } = await supabase
                    .from('units')
                    .select('*')
                    .eq('is_active', true)
                    .order('unit_name', { ascending: true });

                if (error) throw error;
                setUnits(data || []);
            } catch (err) {
                console.error('Erro ao buscar unidades:', err);
            } finally {
                setIsLoadingData(false);
            }
        };
        fetchUnits();
    }, []);

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const json = JSON.parse(event.target?.result as string);
                setOriginalJson(json);
                analyzeStructure(json);
                setStatusMessage(null);
            } catch (err) {
                console.error(err);
                setStatusMessage({ type: 'error', text: 'Erro ao ler JSON. Verifique o arquivo.' });
            }
        };
        reader.readAsText(file);
    };

    const handleTemplateSelect = (templateData: any) => {
        setOriginalJson(templateData);
        analyzeStructure(templateData);
        setStatusMessage(null);
    };

    const analyzeStructure = (json: any) => {
        let detected: DetectedUnit[] = [];
        let menuBlock: any = null;

        if (json.groups) {
            json.groups.forEach((group: any) => {
                if (group.blocks) {
                    const found = group.blocks.find((b: any) => b.id === MENU_BLOCK_ID);
                    if (found) menuBlock = found;
                }
            });
        }

        if (menuBlock && menuBlock.items && menuBlock.items.length > 0) {
            setAppMode('multi');
            menuBlock.items.forEach((item: any, index: number) => {
                const edgeId = item.outgoingEdgeId;
                const edge = json.edges.find((e: any) => e.id === edgeId);
                if (edge && edge.to && edge.to.groupId) {
                    detected.push({
                        index: index + 1,
                        itemId: item.id,
                        groupId: edge.to.groupId,
                        currentLabel: item.content,
                        defaults: extractValues(json, edge.to.groupId)
                    });
                }
            });
        } else {
            setAppMode('single');
            detected.push({
                index: 1,
                currentLabel: "Configuração Geral",
                defaults: extractValuesGlobal(json)
            });
        }
        setDetectedUnits(detected);
    };

    const extractValues = (json: any, groupId: string) => {
        const group = json.groups.find((g: any) => g.id === groupId);
        const values: Record<string, string> = {};
        if (group && group.blocks) {
            group.blocks.forEach((block: any) => {
                if (block.type === 'Set variable' && block.options) {
                    for (const [key, id] of Object.entries(VAR_IDS)) {
                        if (block.options.variableId === id) values[key] = block.options.expressionToEvaluate;
                    }
                }
            });
        }
        return values;
    };

    const extractValuesGlobal = (json: any) => {
        const values: Record<string, string> = {};
        if (json.groups) {
            json.groups.forEach((group: any) => {
                if (group.blocks) {
                    group.blocks.forEach((block: any) => {
                        if (block.type === 'Set variable' && block.options) {
                            for (const [key, id] of Object.entries(VAR_IDS)) {
                                if (block.options.variableId === id && !values[key]) {
                                    values[key] = block.options.expressionToEvaluate;
                                }
                            }
                        }
                    });
                }
            });
        }
        return values;
    };

    const handleUnitSelect = async (idx: number, unitId: string) => {
        if (!unitId) return;

        const selectedUnit = units.find(u => u.id === unitId);
        if (!selectedUnit) return;

        setStatusMessage(null);

        const updatedUnits = [...detectedUnits];
        updatedUnits[idx].defaults = {
            ...updatedUnits[idx].defaults,
            'unidade': selectedUnit.unit_name,
            'unit_id': selectedUnit.id
        };

        // Fetch services for this unit
        try {
            const { data: services, error } = await supabase
                .from('unit_services')
                .select('*')
                .eq('unit_id', unitId)
                .eq('active', true);

            if (error) throw error;

            if (services) {
                // Map values based on name
                const v4 = services.find(s => s.name.toLowerCase().includes('4 horas'))?.repasse_value || '';
                const v6 = services.find(s => s.name.toLowerCase().includes('6 horas'))?.repasse_value || '';
                const v8 = services.find(s => s.name.toLowerCase().includes('8 horas'))?.repasse_value || '';

                updatedUnits[idx].defaults['valor_4h'] = String(v4);
                updatedUnits[idx].defaults['valor_6h'] = String(v6);
                updatedUnits[idx].defaults['valor_8h'] = String(v8);
            }
        } catch (err) {
            console.error('Erro ao buscar serviços da unidade:', err);
        }

        setDetectedUnits(updatedUnits);
    };

    const handleManualChange = (idx: number, key: string, value: string) => {
        const updatedUnits = [...detectedUnits];
        updatedUnits[idx].defaults[key] = value;
        setDetectedUnits(updatedUnits);
    };

    const runAction = async (type: 'download' | 'api') => {
        if (!originalJson) return;

        setIsProcessing(true);
        setStatusMessage(null);

        try {
            const json = JSON.parse(JSON.stringify(originalJson));

            detectedUnits.forEach((unit) => {
                const data = unit.defaults;
                if (appMode === 'multi') {
                    // Update menu button
                    json.groups.forEach((g: any) => {
                        if (g.blocks) {
                            const menu = g.blocks.find((b: any) => b.id === MENU_BLOCK_ID);
                            if (menu) {
                                const item = menu.items.find((i: any) => i.id === unit.itemId);
                                if (item && data.unidade) item.content = data.unidade.toUpperCase();
                            }
                        }
                    });
                    this_updateVariables(json, data, unit.groupId || null);
                } else {
                    this_updateVariables(json, data, null);
                }
            });

            const suffix = appMode === 'multi' ? 'MULTI' : 'UNICO';
            json.name = `RECRUTADORA - ${suffix} (${new Date().toLocaleDateString()})`;
            delete json.id;

            if (type === 'download') {
                const blob = new Blob([JSON.stringify(json, null, 2)], { type: "application/json" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `typebot-${appMode}-${Date.now()}.json`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                setStatusMessage({ type: 'success', text: 'Arquivo configurado e baixado com sucesso!' });
            } else {
                await uploadToTypebot(json);
            }
        } catch (err: any) {
            setStatusMessage({ type: 'error', text: `Erro: ${err.message}` });
        } finally {
            setIsProcessing(false);
        }
    };

    const this_updateVariables = (json: any, data: Record<string, string>, groupId: string | null) => {
        json.groups.forEach((group: any) => {
            if (groupId && group.id !== groupId) return;
            if (group.blocks) {
                group.blocks.forEach((block: any) => {
                    if (block.type === 'Set variable' && block.options) {
                        for (const [key, varId] of Object.entries(VAR_IDS)) {
                            if (block.options.variableId === varId && data[key]) {
                                block.options.expressionToEvaluate = data[key];
                            }
                        }
                    }
                });
            }
        });
    };

    const uploadToTypebot = async (json: any) => {
        try {
            // 1. Create Typebot via Proxy
            const { data: createResult, error: createError } = await supabase.functions.invoke('typebot-proxy', {
                body: {
                    url: `${apiConfig.baseUrl}/api/v1/typebots`,
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${apiConfig.token}`
                    },
                    body: {
                        workspaceId: apiConfig.workspaceId,
                        typebot: json
                    }
                }
            });

            if (createError || !createResult?.typebot) {
                throw new Error(createResult?.message || createError?.message || "Erro ao criar o Typebot via proxy");
            }

            const typebotId = createResult.typebot.id;

            // 2. Publish Typebot via Proxy
            const { data: publishResult, error: publishError } = await supabase.functions.invoke('typebot-proxy', {
                body: {
                    url: `${apiConfig.baseUrl}/api/v1/typebots/${typebotId}/publish`,
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${apiConfig.token}`
                    }
                }
            });

            if (!publishError) {
                setStatusMessage({
                    type: 'success',
                    text: `Fluxo '${createResult.typebot.name}' criado e PUBLICADO com sucesso via Proxy!`
                });
            } else {
                setStatusMessage({
                    type: 'success',
                    text: `Fluxo criado, mas erro ao publicar via proxy: ${publishResult?.message || publishError?.message || 'Erro desconhecido'}`
                });
            }
        } catch (err: any) {
            setStatusMessage({ type: 'error', text: `Erro no deploy (Proxy): ${err.message}` });
        }
    };

    // Internal Modal Component for API Config (Standard System Style)
    const ApiConfigModal: React.FC = () => {
        if (!isApiModalOpen) return null;
        return (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => setIsApiModalOpen(false)}>
                <div className="w-full max-w-md p-6 mx-4 bg-bg-secondary rounded-lg shadow-lg border border-border-primary animate-in zoom-in-95 duration-300" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center justify-between pb-3 border-b border-border-primary">
                        <h2 className="text-xl font-bold text-text-primary">Conexão Typebot</h2>
                        <button onClick={() => setIsApiModalOpen(false)} className="p-1 rounded-full text-text-secondary hover:bg-bg-tertiary">
                            <Icon name="close" />
                        </button>
                    </div>

                    <form className="mt-6 space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-text-secondary">Workspace ID</label>
                            <input
                                type="text"
                                value={apiConfig.workspaceId}
                                onChange={(e) => setApiConfig({ ...apiConfig, workspaceId: e.target.value })}
                                className="w-full px-3 py-2 mt-1 border rounded-md bg-bg-secondary border-border-secondary focus:ring-accent-primary focus:border-accent-primary font-mono text-sm"
                                placeholder="ID do Espaço de Trabalho"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-text-secondary">Bearer Token</label>
                            <input
                                type="password"
                                value={apiConfig.token}
                                onChange={(e) => setApiConfig({ ...apiConfig, token: e.target.value })}
                                className="w-full px-3 py-2 mt-1 border rounded-md bg-bg-secondary border-border-secondary focus:ring-accent-primary focus:border-accent-primary font-mono text-sm"
                                placeholder="Token de acesso API"
                            />
                        </div>

                        <div className="flex justify-end pt-4">
                            <button
                                type="button"
                                onClick={() => setIsApiModalOpen(false)}
                                className="px-4 py-2 text-sm font-medium text-white border border-transparent rounded-md bg-accent-primary hover:bg-accent-secondary shadow-sm"
                            >
                                Salvar Configurações
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        );
    };

    return (
        <div className="p-6 bg-bg-secondary rounded-lg shadow-md min-h-full">
            <ApiConfigModal />

            {/* Standard System Header */}
            <div className="flex flex-col gap-4 mb-6 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                    <h1 className="text-2xl font-bold text-text-primary">Typebot</h1>
                    {originalJson && (
                        <button
                            onClick={() => setOriginalJson(null)}
                            className="text-[10px] font-bold bg-danger/10 text-danger px-2.5 py-1 rounded-full uppercase tracking-wider border border-danger/20 hover:bg-danger hover:text-white transition-all"
                        >
                            Trocar Template
                        </button>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setIsApiModalOpen(true)}
                        className="flex items-center px-4 py-2 text-sm font-medium text-text-secondary border border-border-secondary rounded-md hover:bg-bg-tertiary transition-all"
                    >
                        <Settings2 className="w-4 h-4 mr-2" />
                        Configurar API
                    </button>

                    {originalJson && (
                        <>
                            <div className="w-px h-6 bg-border-primary mx-1" />
                            <button
                                onClick={() => runAction('download')}
                                disabled={isProcessing}
                                className="flex items-center px-4 py-2 text-sm font-medium text-emerald-600 bg-emerald-500/10 rounded-md hover:bg-emerald-500 hover:text-white transition-all disabled:opacity-50"
                            >
                                <Download className="w-4 h-4 mr-2" />
                                Exportar
                            </button>
                            <button
                                onClick={() => runAction('api')}
                                disabled={isProcessing}
                                className="flex items-center px-4 py-2 text-sm font-medium text-white bg-accent-primary rounded-md hover:bg-accent-secondary shadow-sm transition-all disabled:opacity-50"
                            >
                                {isProcessing ? <RefreshCcw className="w-4 h-4 mr-2 animate-spin" /> : <Rocket className="w-4 h-4 mr-2" />}
                                Publicar
                            </button>
                        </>
                    )}
                </div>
            </div>

            {originalJson ? (
                <div className="space-y-6 animate-in fade-in duration-500">
                    {statusMessage && (
                        <div className={`p-4 rounded-lg border flex items-start gap-3 ${statusMessage.type === 'success'
                            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-700'
                            : 'bg-danger/10 border-danger/20 text-danger'
                            }`}>
                            {statusMessage.type === 'success' ? <CheckCircle2 className="w-5 h-5 flex-shrink-0" /> : <AlertCircle className="w-5 h-5 flex-shrink-0" />}
                            <p className="text-sm font-medium">{statusMessage.text}</p>
                            <button onClick={() => setStatusMessage(null)} className="ml-auto opacity-50 hover:opacity-100 transition-opacity">
                                <Icon name="close" className="w-4 h-4" />
                            </button>
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-12">
                        {detectedUnits.map((unit, idx) => (
                            <div key={idx} className="bg-bg-secondary p-6 rounded-2xl border border-border-primary shadow-sm hover:shadow-md transition-all group relative overflow-hidden flex flex-col h-full">
                                <div className="relative flex flex-col h-full">
                                    <div className="flex items-center justify-between mb-6">
                                        <div className="flex items-center gap-2">
                                            <div className="w-8 h-8 bg-accent-primary/10 rounded-lg flex items-center justify-center text-accent-primary font-bold text-sm">
                                                {unit.index}
                                            </div>
                                            <h3 className="font-bold text-text-primary tracking-tight">
                                                {appMode === 'multi' ? unit.currentLabel : 'Configuração'}
                                            </h3>
                                        </div>
                                    </div>

                                    <div className="space-y-4 flex-1">
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider ml-1">Unidade</label>
                                            <div className="relative">
                                                <select
                                                    onChange={(e) => handleUnitSelect(idx, e.target.value)}
                                                    className="w-full bg-bg-tertiary border border-border-primary rounded-xl px-4 py-2 text-sm font-medium text-text-primary appearance-none cursor-pointer focus:ring-2 focus:ring-accent-primary/20 transition-all shadow-sm"
                                                    value={units.find(u => u.unit_name === unit.defaults.unidade)?.id || ""}
                                                >
                                                    <option value="">-- Selecione --</option>
                                                    {units.map(u => (
                                                        <option key={u.id} value={u.id}>{u.unit_name}</option>
                                                    ))}
                                                </select>
                                                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary pointer-events-none" />
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider ml-1">Cor Card</label>
                                                <div className="flex gap-2 items-center bg-bg-tertiary rounded-xl px-3 py-1.5 border border-border-primary shadow-sm">
                                                    <input
                                                        type="color"
                                                        value={unit.defaults.color_card || '#ac009e'}
                                                        onChange={(e) => handleManualChange(idx, 'color_card', e.target.value)}
                                                        className="w-6 h-6 p-0 rounded-md border-none cursor-pointer"
                                                    />
                                                    <span className="text-[10px] font-mono text-text-primary uppercase">{unit.defaults.color_card || '#--'}</span>
                                                </div>
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider ml-1">Unit ID</label>
                                                <div className="bg-bg-tertiary/50 border border-border-primary/50 text-text-tertiary rounded-xl px-3 py-2 text-[9px] font-mono truncate h-9 flex items-center">
                                                    {unit.defaults.unit_id?.slice(0, 12) || '---'}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="bg-bg-tertiary/30 p-4 rounded-xl border border-border-primary/50 space-y-3">
                                            <div className="grid grid-cols-3 gap-2">
                                                <div className="space-y-1 text-center">
                                                    <p className="text-[8px] font-bold text-text-tertiary uppercase">4H</p>
                                                    <input
                                                        type="text"
                                                        value={unit.defaults.valor_4h || ''}
                                                        onChange={(e) => handleManualChange(idx, 'valor_4h', e.target.value)}
                                                        className="w-full bg-white border border-border-primary rounded-lg py-2 text-center text-xs font-bold text-accent-primary focus:ring-2 focus:ring-accent-primary/20 outline-none"
                                                    />
                                                </div>
                                                <div className="space-y-1 text-center">
                                                    <p className="text-[8px] font-bold text-text-tertiary uppercase">6H</p>
                                                    <input
                                                        type="text"
                                                        value={unit.defaults.valor_6h || ''}
                                                        onChange={(e) => handleManualChange(idx, 'valor_6h', e.target.value)}
                                                        className="w-full bg-white border border-border-primary rounded-lg py-2 text-center text-xs font-bold text-accent-primary focus:ring-2 focus:ring-accent-primary/20 outline-none"
                                                    />
                                                </div>
                                                <div className="space-y-1 text-center">
                                                    <p className="text-[8px] font-bold text-text-tertiary uppercase">8H</p>
                                                    <input
                                                        type="text"
                                                        value={unit.defaults.valor_8h || ''}
                                                        onChange={(e) => handleManualChange(idx, 'valor_8h', e.target.value)}
                                                        className="w-full bg-white border border-border-primary rounded-lg py-2 text-center text-xs font-bold text-accent-primary focus:ring-2 focus:ring-accent-primary/20 outline-none"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ) : (
                <div className="animate-in fade-in slide-in-from-top-2 duration-500">
                    <div className="text-center mb-8">
                        <div className="inline-flex items-center gap-2 bg-accent-primary/5 text-accent-primary px-3 py-1 rounded-full font-bold text-[10px] uppercase tracking-widest border border-accent-primary/10 mb-4">
                            Módulo de Automação
                        </div>
                        <h2 className="text-3xl font-bold text-text-primary tracking-tight">Prepare seu fluxo automático</h2>
                        <p className="text-text-secondary text-base max-w-xl mx-auto mt-2">
                            Escolha um dos modelos pré-configurados para automatizar o seu Typebot.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
                        {TYPEBOT_TEMPLATES.map((tmpl) => (
                            <button
                                key={tmpl.id}
                                onClick={() => handleTemplateSelect(tmpl.data)}
                                className="group relative bg-bg-secondary p-8 rounded-2xl border border-border-primary shadow-sm hover:shadow-md hover:border-accent-primary transition-all duration-300 text-left flex flex-col h-full"
                            >
                                <div className="relative space-y-4 flex-1">
                                    <div className="w-12 h-12 bg-bg-tertiary rounded-xl flex items-center justify-center text-accent-primary group-hover:bg-accent-primary group-hover:text-white transition-all duration-300 shadow-inner">
                                        {tmpl.id === 'unico' ? <Activity className="w-6 h-6" /> : tmpl.id === 'multi-2-unidades' ? <Grid className="w-6 h-6" /> : <Layout className="w-6 h-6" />}
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-bold text-text-primary mb-2 tracking-tight">{tmpl.name}</h3>
                                        <p className="text-text-secondary text-sm leading-relaxed opacity-80">{tmpl.description}</p>
                                    </div>
                                </div>
                                <div className="mt-6 flex items-center gap-2 text-accent-primary font-bold text-xs uppercase tracking-widest">
                                    Configurar Fluxo
                                    <Rocket className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                </div>
                            </button>
                        ))}
                    </div>

                    {isLoadingData && (
                        <div className="flex items-center justify-center py-12">
                            <RefreshCcw className="w-6 h-6 animate-spin text-accent-primary mr-3" />
                            <span className="text-sm font-medium text-text-secondary uppercase tracking-widest">Sincronizando...</span>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default TypebotPage;
