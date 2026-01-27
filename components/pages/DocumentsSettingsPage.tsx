import React, { useState, useEffect, useRef } from 'react';
import { Icon } from '../ui/Icon';
import { useAppContext } from '../../contexts/AppContext';
import { documentTemplatesService, DocumentTemplate } from '../../services/documentTemplates.service';

const TEMPLATE_INFO = {
    aditamento: {
        name: 'Aditamento Contratual',
        icon: 'FileText',
        color: 'blue'
    },
    contrato: {
        name: 'Contrato de Agenciamento',
        icon: 'FileText',
        color: 'green'
    },
    termo: {
        name: 'Termo de Confidencialidade',
        icon: 'FileText',
        color: 'purple'
    },
    notificacao: {
        name: 'Notificação',
        icon: 'FileText',
        color: 'orange'
    },
    distrato: {
        name: 'Distrato',
        icon: 'FileText',
        color: 'red'
    }
};

/**
 * Página de configuração de templates de documentos
 * Layout: Full-width com seletor de documento no header
 */
export const DocumentsSettingsPage: React.FC = () => {
    const { selectedUnit } = useAppContext();
    const [selectedTemplate, setSelectedTemplate] = useState<'aditamento' | 'contrato' | 'termo' | 'notificacao' | 'distrato'>('aditamento');
    const [template, setTemplate] = useState<DocumentTemplate | null>(null);
    const [content, setContent] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [isCustom, setIsCustom] = useState(false);
    const [showDropdown, setShowDropdown] = useState(false);
    const editorRef = useRef<HTMLDivElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (selectedUnit && selectedUnit.id !== 'ALL') {
            loadTemplate();
        }
    }, [selectedUnit, selectedTemplate]);

    // Fecha dropdown ao clicar fora
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setShowDropdown(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const loadTemplate = async () => {
        console.log('[DocumentsSettingsPage] loadTemplate called', {
            selectedUnit: selectedUnit?.id,
            selectedTemplate
        });

        if (!selectedUnit || selectedUnit.id === 'ALL') {
            console.log('[DocumentsSettingsPage] No valid unit selected');
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            setError('');

            console.log('[DocumentsSettingsPage] Fetching template...');
            const tmpl = await documentTemplatesService.getTemplate(selectedUnit.id, selectedTemplate);

            console.log('[DocumentsSettingsPage] Template fetched:', {
                found: !!tmpl,
                hasContent: !!tmpl?.content,
                contentLength: tmpl?.content?.length,
                unitId: tmpl?.unit_id,
                isCustom: tmpl?.unit_id === selectedUnit.id
            });

            if (!tmpl) {
                console.error('[DocumentsSettingsPage] Template not found');
                setError('Template não encontrado');
                return;
            }

            if (!tmpl.content) {
                console.error('[DocumentsSettingsPage] Template has no content');
                setError('Template sem conteúdo');
                return;
            }

            setTemplate(tmpl);
            setContent(tmpl.content);
            setIsCustom(tmpl.unit_id === selectedUnit.id);

            console.log('[DocumentsSettingsPage] Template loaded successfully');
        } catch (err) {
            console.error('[DocumentsSettingsPage] Error loading template:', err);
            setError('Erro ao carregar template');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!selectedUnit || selectedUnit.id === 'ALL' || !editorRef.current) return;

        try {
            setSaving(true);
            setError('');

            let updatedContent = editorRef.current.innerHTML;

            // Se o template original tinha estrutura HTML completa (DOCTYPE, head, etc),
            // tentamos preservar isso ao salvar a versão customizada.
            if (template && template.content && template.content.includes('<!DOCTYPE html>')) {
                const originalHtml = template.content;

                // Extrair as partes que ficam antes e depois do conteúdo que o browser remove
                // quando injetamos em uma div contentEditable.
                // Geralmente o conteúdo real começa em <div class="container"><div class="page">
                const structureMatch = originalHtml.match(/^([\s\S]*?<div class="container"><div class="page">)([\s\S]*?)(<\/div><\/div>[\s\S]*?<\/body>\s*<\/html>)$/i);

                if (structureMatch) {
                    const [_, prefix, __, suffix] = structureMatch;

                    // Se o browser removeu o container e a page do innerHTML (depende de como foi injetado),
                    // precisamos verificar se o updatedContent já contém eles.
                    // No nosso caso, o editor div NÃO inclui o container/page no seu innerHTML se eles foram as divs raiz injetadas.
                    // Na verdade, dangerouslySetInnerHTML injeta TUDO dentro da div.

                    // Se o updatedContent já começa com o container, não limpamos.
                    // Mas geralmente o browser limpa as tags head/body.

                    // Para garantir a preservação total mantendo os estilos do head:
                    const headMatch = originalHtml.match(/^([\s\S]*?<body[^>]*>)([\s\S]*?)(<\/body>[\s\S]*?)$/i);
                    if (headMatch) {
                        const [___, headPart, ____, footerPart] = headMatch;
                        updatedContent = `${headPart}${updatedContent}${footerPart}`;
                    }
                }
            }

            await documentTemplatesService.saveCustomTemplate(selectedUnit.id, selectedTemplate, updatedContent);

            setContent(updatedContent);
            setIsCustom(true);

            // Feedback visual
            const successMsg = document.createElement('div');
            successMsg.className = 'fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-[70] animate-fade-in flex items-center gap-2';
            successMsg.innerHTML = `
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
        </svg>
        <span>Template salvo com sucesso!</span>
      `;
            document.body.appendChild(successMsg);

            setTimeout(() => {
                successMsg.remove();
            }, 3000);

        } catch (err) {
            console.error('[DocumentsSettingsPage] Error saving template:', err);
            setError('Erro ao salvar template');
        } finally {
            setSaving(false);
        }
    };

    const handleRestore = async () => {
        if (!confirm('Deseja restaurar o template original? Isso irá remover todas as customizações desta unidade.')) {
            return;
        }

        if (!selectedUnit || selectedUnit.id === 'ALL') return;

        try {
            setSaving(true);
            setError('');

            await documentTemplatesService.deleteCustomTemplate(selectedUnit.id, selectedTemplate);

            // Recarrega template global
            await loadTemplate();

            // Feedback visual
            const successMsg = document.createElement('div');
            successMsg.className = 'fixed top-4 right-4 bg-blue-500 text-white px-4 py-2 rounded-lg shadow-lg z-[70] animate-fade-in flex items-center gap-2';
            successMsg.innerHTML = `
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
        </svg>
        <span>Template restaurado para o original!</span>
      `;
            document.body.appendChild(successMsg);

            setTimeout(() => {
                successMsg.remove();
            }, 3000);

        } catch (err) {
            console.error('[DocumentsSettingsPage] Error restoring template:', err);
            setError('Erro ao restaurar template');
        } finally {
            setSaving(false);
        }
    };

    if (!selectedUnit || selectedUnit.id === 'ALL') {
        return (
            <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
                <div className="w-16 h-16 rounded-full bg-accent-primary/10 flex items-center justify-center">
                    <Icon name="Building" className="w-8 h-8 text-accent-primary" />
                </div>
                <div className="text-center">
                    <h3 className="text-lg font-semibold text-text-primary mb-2">
                        Selecione uma Unidade
                    </h3>
                    <p className="text-sm text-text-secondary max-w-md">
                        Para configurar os documentos, selecione uma unidade específica no menu superior.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-bg-primary">
            {/* Header com seletor de documento */}
            <div className="flex items-center justify-between border-b border-border-secondary bg-bg-secondary px-6 py-4 flex-shrink-0">
                <div className="flex items-center gap-4">
                    {/* Dropdown Seletor de Documento */}
                    <div className="relative" ref={dropdownRef}>
                        <button
                            onClick={() => setShowDropdown(!showDropdown)}
                            className="flex items-center gap-3 px-4 py-2.5 bg-bg-primary border border-border-secondary rounded-lg hover:bg-bg-tertiary transition-colors min-w-[280px]"
                        >
                            <Icon name={TEMPLATE_INFO[selectedTemplate].icon as any} className="w-5 h-5 text-accent-primary" />
                            <div className="flex-1 text-left">
                                <div className="text-sm font-semibold text-text-primary">
                                    {TEMPLATE_INFO[selectedTemplate].name}
                                </div>
                                {isCustom && (
                                    <div className="text-xs text-accent-primary">Customizado</div>
                                )}
                            </div>
                            <Icon name="ChevronDown" className={`w-4 h-4 text-text-secondary transition-transform ${showDropdown ? 'rotate-180' : ''}`} />
                        </button>

                        {/* Dropdown Menu */}
                        {showDropdown && (
                            <div className="absolute top-full left-0 mt-2 w-full bg-bg-primary border border-border-secondary rounded-lg shadow-xl z-50 overflow-hidden">
                                {Object.entries(TEMPLATE_INFO).map(([key, info]) => {
                                    const templateName = key as 'aditamento' | 'contrato' | 'termo';
                                    const isSelected = selectedTemplate === templateName;

                                    return (
                                        <button
                                            key={key}
                                            onClick={() => {
                                                setSelectedTemplate(templateName);
                                                setShowDropdown(false);
                                            }}
                                            className={`w-full flex items-center gap-3 px-4 py-3 transition-colors ${isSelected
                                                ? 'bg-accent-primary/10 text-accent-primary'
                                                : 'text-text-primary hover:bg-bg-tertiary'
                                                }`}
                                        >
                                            <Icon name={info.icon as any} className="w-5 h-5" />
                                            <div className="flex-1 text-left">
                                                <div className="text-sm font-medium">{info.name}</div>
                                            </div>
                                            {isSelected && (
                                                <Icon name="Check" className="w-4 h-4" />
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {isCustom && (
                        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-accent-primary/10 rounded-md">
                            <Icon name="Star" className="w-3.5 h-3.5 text-accent-primary" />
                            <span className="text-xs font-semibold text-accent-primary uppercase tracking-wide">
                                Customizado
                            </span>
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    {isCustom && (
                        <button
                            onClick={handleRestore}
                            disabled={saving}
                            className="px-4 py-2 rounded-lg border border-border-secondary text-text-secondary hover:bg-bg-primary hover:text-text-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            <Icon name="RotateCcw" className="w-4 h-4" />
                            <span>Restaurar Original</span>
                        </button>
                    )}

                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="px-5 py-2 rounded-lg bg-accent-primary text-white hover:bg-accent-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg shadow-accent-primary/20"
                    >
                        {saving ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                <span className="font-medium">Salvando...</span>
                            </>
                        ) : (
                            <>
                                <Icon name="Save" className="w-4 h-4" />
                                <span className="font-medium">Salvar</span>
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Documento Preview/Editor - Full Width */}
            <div className="flex-1 overflow-auto bg-gray-100">
                {loading ? (
                    <div className="flex items-center justify-center h-full">
                        <div className="flex flex-col items-center gap-3">
                            <div className="w-8 h-8 border-4 border-accent-primary/30 border-t-accent-primary rounded-full animate-spin" />
                            <p className="text-sm text-text-secondary">Carregando template...</p>
                        </div>
                    </div>
                ) : error ? (
                    <div className="flex items-center justify-center h-full p-4">
                        <div className="bg-danger/10 border border-danger/20 rounded-lg p-4 max-w-md">
                            <div className="flex items-center gap-2 text-danger">
                                <Icon name="AlertCircle" className="w-5 h-5" />
                                <span className="text-sm font-medium">{error}</span>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="h-full">
                        <div className="bg-white shadow-2xl h-full" style={{ minHeight: '297mm' }}>
                            <div
                                ref={editorRef}
                                contentEditable={true}
                                suppressContentEditableWarning={true}
                                dangerouslySetInnerHTML={{ __html: content }}
                                className="focus:outline-none focus:ring-2 focus:ring-accent-primary/20"
                                style={{
                                    minHeight: '297mm',
                                    padding: '8mm 16mm',
                                    fontSize: '11pt',
                                    lineHeight: '1.6',
                                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                                    color: '#111827'
                                }}
                                onInput={(e) => {
                                    // Previne edição de variáveis {{}}
                                    const selection = window.getSelection();
                                    if (selection && selection.rangeCount > 0) {
                                        const range = selection.getRangeAt(0);
                                        const container = range.commonAncestorContainer;
                                        const text = container.textContent || '';

                                        // Se está tentando editar dentro de {{}}
                                        if (text.includes('{{') || text.includes('}}')) {
                                            const cursorPos = range.startOffset;
                                            const beforeCursor = text.substring(0, cursorPos);

                                            // Verifica se cursor está dentro de variável
                                            const openBrackets = (beforeCursor.match(/\{\{/g) || []).length;
                                            const closeBrackets = (beforeCursor.match(/\}\}/g) || []).length;

                                            if (openBrackets > closeBrackets) {
                                                // Está dentro de variável, cancela edição
                                                e.preventDefault();
                                                return;
                                            }
                                        }
                                    }
                                }}
                                onKeyDown={(e) => {
                                    // Previne deletar imagens
                                    if (e.key === 'Backspace' || e.key === 'Delete') {
                                        const selection = window.getSelection();
                                        if (selection && selection.rangeCount > 0) {
                                            const range = selection.getRangeAt(0);
                                            const container = range.commonAncestorContainer;

                                            // Se seleção contém imagem, cancela
                                            if (container.nodeType === Node.ELEMENT_NODE) {
                                                const element = container as HTMLElement;
                                                if (element.tagName === 'IMG' || element.querySelector('img')) {
                                                    e.preventDefault();
                                                    return;
                                                }
                                            }
                                        }
                                    }
                                }}
                            />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
