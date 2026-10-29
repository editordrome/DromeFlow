import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, TrendingUp, Users, CheckCircle, Calendar, AlertCircle } from 'lucide-react';
import {
    getAllVersions,
    getVersionStats,
    deleteVersion,
    type AppVersion,
    type VersionStats,
} from '@/services/versions/versions.service';
import { VersionFormModal } from '@/components/ui/VersionFormModal';
import { UserUpdatesModal } from '@/components/ui/UserUpdatesModal';

export const ManageVersionsPage = () => {
    const [versions, setVersions] = useState<AppVersion[]>([]);
    const [stats, setStats] = useState<VersionStats[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingVersion, setEditingVersion] = useState<AppVersion | null>(null);
    const [showUserUpdates, setShowUserUpdates] = useState(false);
    const [selectedVersionForUpdates, setSelectedVersionForUpdates] = useState<{ id: string; version: string } | null>(null);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            console.log('[ManageVersionsPage] Carregando dados...');

            const [versionsData, statsData] = await Promise.all([
                getAllVersions(),
                getVersionStats(),
            ]);

            setVersions(versionsData);
            setStats(statsData);

            console.log('[ManageVersionsPage] Dados carregados:', {
                versions: versionsData.length,
                stats: statsData.length,
            });
        } catch (error) {
            console.error('[ManageVersionsPage] Erro ao carregar dados:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Tem certeza que deseja deletar esta versão?')) return;

        try {
            console.log('[ManageVersionsPage] Deletando versão:', id);
            await deleteVersion(id);
            await loadData();
            console.log('[ManageVersionsPage] Versão deletada com sucesso');
        } catch (error) {
            console.error('[ManageVersionsPage] Erro ao deletar versão:', error);
            alert('Erro ao deletar versão');
        }
    };

    const handleEdit = (version: AppVersion) => {
        setEditingVersion(version);
        setIsModalOpen(true);
    };

    const handleCreate = () => {
        setEditingVersion(null);
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingVersion(null);
        loadData();
    };

    // Calcula KPIs gerais
    const latestVersion = versions[0];
    const latestStats = stats[0];
    const totalUsers = latestStats?.total_users || 0;
    const updatedUsers = latestStats?.updated_users || 0;
    const adoptionRate = latestStats?.adoption_rate || 0;

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-gray-500">Carregando...</div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">
                        Gerenciar Versões
                    </h1>
                    <p className="text-sm text-gray-600 mt-1">
                        Configure notificações de atualização e acompanhe adoção
                    </p>
                </div>
                <button
                    onClick={handleCreate}
                    className="px-4 py-2 bg-accent-primary text-white rounded-lg hover:bg-accent-primary/90 transition-colors flex items-center gap-2"
                >
                    <Plus className="w-4 h-4" />
                    Nova Versão
                </button>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white rounded-lg shadow p-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-100 rounded-lg">
                            <TrendingUp className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-600">Versão Atual</p>
                            <p className="text-xl font-bold text-gray-900">
                                {latestVersion?.version || '-'}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-lg shadow p-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-green-100 rounded-lg">
                            <CheckCircle className="w-5 h-5 text-green-600" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-600">Taxa de Adoção</p>
                            <p className="text-xl font-bold text-gray-900">
                                {adoptionRate.toFixed(1)}%
                            </p>
                        </div>
                    </div>
                </div>


                <button
                    onClick={() => {
                        if (latestVersion?.id) {
                            setSelectedVersionForUpdates({
                                id: latestVersion.id,
                                version: latestVersion.version
                            });
                            setShowUserUpdates(true);
                        }
                    }}
                    className="bg-white rounded-lg shadow p-4 hover:shadow-lg transition-shadow cursor-pointer text-left w-full"
                >
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-purple-100 rounded-lg">
                            <Users className="w-5 h-5 text-purple-600" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-600">Usuários Atualizados</p>
                            <p className="text-xl font-bold text-gray-900">
                                {updatedUsers} / {totalUsers}
                            </p>
                        </div>
                    </div>
                </button>

                <div className="bg-white rounded-lg shadow p-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-orange-100 rounded-lg">
                            <Calendar className="w-5 h-5 text-orange-600" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-600">Total de Versões</p>
                            <p className="text-xl font-bold text-gray-900">
                                {versions.length}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Tabela de Versões */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Versão
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Título
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Data
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Status
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Adoção
                                </th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Ações
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {versions.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                                        <AlertCircle className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                                        <p className="text-sm">Nenhuma versão cadastrada</p>
                                        <p className="text-xs text-gray-400 mt-1">
                                            Clique em "Nova Versão" para começar
                                        </p>
                                    </td>
                                </tr>
                            ) : (
                                versions.map((version) => {
                                    const stat = stats.find((s) => s.id === version.id);
                                    return (
                                        <tr key={version.id} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded">
                                                    v{version.version}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="text-sm font-medium text-gray-900">
                                                    {version.title}
                                                </div>
                                                <div className="text-sm text-gray-500 truncate max-w-md">
                                                    {version.message}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                {new Date(version.release_date!).toLocaleDateString('pt-BR')}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex gap-2">
                                                    {version.is_active && (
                                                        <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded">
                                                            Ativa
                                                        </span>
                                                    )}
                                                    {version.is_mandatory && (
                                                        <span className="px-2 py-1 bg-red-100 text-red-800 text-xs rounded">
                                                            Obrigatória
                                                        </span>
                                                    )}
                                                    {!version.is_active && (
                                                        <span className="px-2 py-1 bg-gray-100 text-gray-800 text-xs rounded">
                                                            Inativa
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="text-sm text-gray-900">
                                                    {stat?.updated_users || 0} / {stat?.total_users || 0}
                                                </div>
                                                <div className="text-xs text-gray-500">
                                                    {stat?.adoption_rate?.toFixed(1) || 0}%
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                <button
                                                    onClick={() => handleEdit(version)}
                                                    className="text-blue-600 hover:text-blue-900 mr-3"
                                                    title="Editar"
                                                >
                                                    <Edit className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(version.id!)}
                                                    className="text-red-600 hover:text-red-900"
                                                    title="Deletar"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal */}
            {isModalOpen && (
                <VersionFormModal
                    version={editingVersion}
                    onClose={handleCloseModal}
                />
            )}

            {/* User Updates Modal */}
            {showUserUpdates && selectedVersionForUpdates && (
                <UserUpdatesModal
                    versionId={selectedVersionForUpdates.id}
                    versionNumber={selectedVersionForUpdates.version}
                    onClose={() => {
                        setShowUserUpdates(false);
                        setSelectedVersionForUpdates(null);
                    }}
                />
            )}
        </div>
    );
};

export default ManageVersionsPage;
