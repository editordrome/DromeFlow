import { useState, useEffect, ChangeEvent, FormEvent } from 'react';
import { X, Save } from 'lucide-react';
import {
    createVersion,
    updateVersion,
    deactivateAllVersions,
    type AppVersion,
} from '@/services/versions/versions.service';

interface VersionFormModalProps {
    version: AppVersion | null;
    onClose: () => void;
}

export const VersionFormModal = ({ version, onClose }: VersionFormModalProps) => {
    const [formData, setFormData] = useState<AppVersion>({
        version: '',
        title: '',
        message: '',
        is_active: true,
        is_mandatory: false,
        changelog: '',
    });
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (version) {
            setFormData(version);
        }
    }, [version]);

    const handleChange = (
        e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
    ) => {
        const { name, value, type } = e.target;
        const checked = (e.target as HTMLInputElement).checked;

        setFormData((prev) => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value,
        }));
    };

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setSaving(true);

        try {
            console.log('[VersionFormModal] Salvando versão:', formData);

            // Se marcar como ativa, desativa todas as outras primeiro
            if (formData.is_active) {
                await deactivateAllVersions();
            }

            if (version?.id) {
                // Atualizar versão existente
                await updateVersion(version.id, formData);
                console.log('[VersionFormModal] Versão atualizada');
            } else {
                // Criar nova versão
                await createVersion(formData);
                console.log('[VersionFormModal] Versão criada');
            }

            onClose();
        } catch (error) {
            console.error('[VersionFormModal] Erro ao salvar:', error);
            alert('Erro ao salvar versão');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b">
                    <h2 className="text-xl font-bold text-gray-900">
                        {version ? 'Editar Versão' : 'Nova Versão'}
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-1 hover:bg-gray-100 rounded transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {/* Versão */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Número da Versão *
                        </label>
                        <input
                            type="text"
                            name="version"
                            value={formData.version}
                            onChange={handleChange}
                            placeholder="Ex: 2.1.0"
                            required
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-accent-primary focus:border-transparent"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                            Use versionamento semântico (ex: 2.1.0)
                        </p>
                    </div>

                    {/* Título */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Título da Notificação *
                        </label>
                        <input
                            type="text"
                            name="title"
                            value={formData.title}
                            onChange={handleChange}
                            placeholder="Ex: Nova versão disponível! 🎉"
                            required
                            maxLength={100}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-accent-primary focus:border-transparent"
                        />
                    </div>

                    {/* Mensagem */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Mensagem do Toast *
                        </label>
                        <textarea
                            name="message"
                            value={formData.message}
                            onChange={handleChange}
                            placeholder="Atualize agora para ter acesso às últimas melhorias..."
                            required
                            rows={3}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-accent-primary focus:border-transparent resize-none"
                        />
                    </div>

                    {/* Changelog */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Notas de Versão (Markdown)
                        </label>
                        <textarea
                            name="changelog"
                            value={formData.changelog || ''}
                            onChange={handleChange}
                            placeholder="# Novidades&#10;&#10;- Feature 1&#10;- Feature 2&#10;&#10;# Correções&#10;&#10;- Bug fix 1"
                            rows={6}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-accent-primary focus:border-transparent resize-none font-mono text-sm"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                            Suporta Markdown para formatação
                        </p>
                    </div>

                    {/* Checkboxes */}
                    <div className="space-y-3 pt-2">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                name="is_active"
                                checked={formData.is_active}
                                onChange={handleChange}
                                className="w-4 h-4 text-accent-primary border-gray-300 rounded focus:ring-accent-primary"
                            />
                            <span className="text-sm text-gray-700">
                                Ativar notificação (desativa outras versões automaticamente)
                            </span>
                        </label>

                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                name="is_mandatory"
                                checked={formData.is_mandatory}
                                onChange={handleChange}
                                className="w-4 h-4 text-accent-primary border-gray-300 rounded focus:ring-accent-primary"
                            />
                            <span className="text-sm text-gray-700">
                                Atualização obrigatória (usuários não podem dispensar)
                            </span>
                        </label>
                    </div>

                    {/* Buttons */}
                    <div className="flex gap-3 pt-4">
                        <button
                            type="submit"
                            disabled={saving}
                            className="flex-1 px-4 py-2 bg-accent-primary text-white rounded-lg hover:bg-accent-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            <Save className="w-4 h-4" />
                            {saving ? 'Salvando...' : 'Salvar Versão'}
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={saving}
                            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors disabled:opacity-50"
                        >
                            Cancelar
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
