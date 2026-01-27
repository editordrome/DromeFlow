import React, { useState, useEffect, useRef } from 'react';
import { Icon } from './Icon';
import { documentTemplatesService, DocumentTemplate } from '@/services/documentTemplates.service';

interface DocumentEditorModalProps {
    isOpen: boolean;
    onClose: () => void;
    unitId: string;
    unitName: string;
    templateName: 'aditamento' | 'contrato' | 'termo';
    onSave?: () => void;
}

const TEMPLATE_LABELS = {
    aditamento: 'Aditamento Contratual',
    contrato: 'Contrato de Agenciamento',
    termo: 'Termo de Confidencialidade'
};

/**
 * Modal para edição de templates de documentos
 * Layout: Split view com editor HTML à esquerda e preview à direita
 */
export const DocumentEditorModal: React.FC<DocumentEditorModalProps> = ({
    isOpen,
    onClose,
    unitId,
    unitName,
    templateName,
    onSave
}) => {
    const [template, setTemplate] = useState<DocumentTemplate | null>(null);
    const [content, setContent] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [isCustom, setIsCustom] = useState(false);
    const previewRef = useRef<HTMLDivElement>(null);

    // Carrega template ao abrir modal
    useEffect(() => {
        if (isOpen) {
            loadTemplate();
        }
    }, [isOpen, unitId, templateName]);

    // Atualiza preview em tempo real
    useEffect(() => {
        if (previewRef.current && content) {
            previewRef.current.innerHTML = content;
        }
    }, [content]);

    const loadTemplate = async () => {
        try {
            setLoading(true);
            setError('');

            const tmpl = await documentTemplatesService.getTemplate(unitId, templateName);

            if (!tmpl) {
                setError('Template não encontrado');
                return;
            }

            setTemplate(tmpl);
            setContent(tmpl.content);
            setIsCustom(tmpl.unit_id === unitId);
        } catch (err) {
            console.error('[DocumentEditorModal] Error loading template:', err);
            setError('Erro ao carregar template');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        try {
            setSaving(true);
            setError('');

            await documentTemplatesService.saveCustomTemplate(unitId, templateName, content);

            setIsCustom(true);
            onSave?.();

            // Feedback visual
            const successMsg = document.createElement('div');
            successMsg.className = 'fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-[70] animate-fade-in';
            successMsg.textContent = '✓ Template salvo com sucesso!';
            document.body.appendChild(successMsg);

            setTimeout(() => {
                successMsg.remove();
            }, 3000);

        } catch (err) {
            console.error('[DocumentEditorModal] Error saving template:', err);
            setError('Erro ao salvar template');
        } finally {
            setSaving(false);
        }
    };

    const handleRestore = async () => {
        if (!confirm('Deseja restaurar o template original? Isso irá remover todas as customizações desta unidade.')) {
            return;
        }

        try {
            setSaving(true);
            setError('');

            await documentTemplatesService.deleteCustomTemplate(unitId, templateName);

            // Recarrega template global
            await loadTemplate();

            onSave?.();

            // Feedback visual
            const successMsg = document.createElement('div');
            successMsg.className = 'fixed top-4 right-4 bg-blue-500 text-white px-4 py-2 rounded-lg shadow-lg z-[70] animate-fade-in';
            successMsg.textContent = '✓ Template restaurado para o original!';
            document.body.appendChild(successMsg);

            setTimeout(() => {
                successMsg.remove();
            }, 3000);

        } catch (err) {
            console.error('[DocumentEditorModal] Error restoring template:', err);
            setError('Erro ao restaurar template');
        } finally {
            setSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
            onClick={onClose}
        >
            <div
                className="w-full h-[90vh] max-w-[95vw] rounded-xl bg-bg-secondary shadow-2xl overflow-hidden flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between border-b border-border-secondary bg-bg-tertiary px-5 py-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-accent-primary/10 flex items-center justify-center">
                            <Icon name="FileText" className="w-5 h-5 text-accent-primary" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-text-primary">
                                Configurar: {TEMPLATE_LABELS[templateName]}
                            </h2>
                            <p className="text-sm text-text-secondary">
                                {unitName} {isCustom && <span className="text-accent-primary">• Customizado</span>}
                            </p>
                        </div>
                    </div>

                    <button
                        onClick={onClose}
                        className="text-text-secondary hover:text-text-primary hover:bg-bg-tertiary rounded-lg p-2 transition-colors"
                        aria-label="Fechar"
                    >
                        <Icon name="X" className="w-5 h-5" />
                    </button>
                </div>

                {/* Body - Split View */}
                {loading ? (
                    <div className="flex-1 flex items-center justify-center">
                        <div className="flex flex-col items-center gap-3">
                            <div className="w-8 h-8 border-4 border-accent-primary/30 border-t-accent-primary rounded-full animate-spin" />
                            <p className="text-sm text-text-secondary">Carregando template...</p>
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 flex overflow-hidden">
                        {/* Editor - Esquerda */}
                        <div className="w-1/2 flex flex-col border-r border-border-secondary">
                            <div className="px-4 py-3 bg-bg-tertiary border-b border-border-secondary">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-sm font-semibold text-text-primary">Editor HTML</h3>
                                    <div className="flex items-center gap-2 text-xs text-text-secondary">
                                        <Icon name="Code" className="w-3.5 h-3.5" />
                                        <span>Variáveis: {`{{nome}}, {{cpf}}, {{razaoSocial}}`}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex-1 overflow-hidden">
                                <textarea
                                    value={content}
                                    onChange={(e) => setContent(e.target.value)}
                                    className="w-full h-full px-4 py-3 bg-bg-primary text-text-primary font-mono text-xs leading-relaxed resize-none focus:outline-none"
                                    placeholder="Cole aqui o HTML do template..."
                                    spellCheck={false}
                                />
                            </div>
                        </div>

                        {/* Preview - Direita */}
                        <div className="w-1/2 flex flex-col bg-gray-100">
                            <div className="px-4 py-3 bg-bg-tertiary border-b border-border-secondary">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-sm font-semibold text-text-primary">Preview em Tempo Real</h3>
                                    <div className="flex items-center gap-1.5 text-xs text-text-secondary">
                                        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                                        <span>Atualização automática</span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex-1 overflow-auto p-4">
                                <div className="bg-white shadow-sm mx-auto" style={{ width: '210mm', minHeight: '297mm' }}>
                                    <div ref={previewRef} className="p-4" />
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Error Message */}
                {error && (
                    <div className="px-5 py-3 bg-danger/10 border-t border-danger/20">
                        <div className="flex items-center gap-2 text-danger text-sm">
                            <Icon name="alert" className="w-4 h-4" />
                            <span>{error}</span>
                        </div>
                    </div>
                )}

                {/* Footer */}
                <div className="flex items-center justify-between border-t border-border-secondary bg-bg-tertiary px-5 py-4">
                    <div className="flex items-center gap-2">
                        {isCustom && (
                            <button
                                onClick={handleRestore}
                                disabled={saving}
                                className="px-4 py-2 rounded-lg border border-border-secondary text-text-secondary hover:bg-bg-primary hover:text-text-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                            >
                                <Icon name="RotateCcw" className="w-4 h-4" />
                                <span className="text-sm font-medium">Restaurar Original</span>
                            </button>
                        )}
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={onClose}
                            disabled={saving}
                            className="px-4 py-2 rounded-lg border border-border-secondary text-text-secondary hover:bg-bg-primary transition-colors disabled:opacity-50"
                        >
                            Cancelar
                        </button>

                        <button
                            onClick={handleSave}
                            disabled={saving || !content}
                            className="px-4 py-2 rounded-lg bg-accent-primary text-white hover:bg-accent-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg shadow-accent-primary/20"
                        >
                            {saving ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    <span className="text-sm font-medium">Salvando...</span>
                                </>
                            ) : (
                                <>
                                    <Icon name="Check" className="w-4 h-4" />
                                    <span className="text-sm font-medium">Salvar Customização</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
