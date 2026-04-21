import { X, User, Calendar, Clock, Monitor } from 'lucide-react';
import { useEffect, useState } from 'react';
import { supabase } from '@/services/supabaseClient';

interface UserUpdateDetail {
    id: string;
    user_id: string;
    user_name: string;
    user_email: string;
    unit_name: string;
    updated_at: string;
    user_agent: string;
    dismissed: boolean;
}

interface UserUpdatesModalProps {
    versionId: string;
    versionNumber: string;
    onClose: () => void;
}

export const UserUpdatesModal = ({ versionId, versionNumber, onClose }: UserUpdatesModalProps) => {
    const [updates, setUpdates] = useState<UserUpdateDetail[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadUpdates();
    }, [versionId]);

    const loadUpdates = async () => {
        setLoading(true);
        try {
            console.log('[UserUpdatesModal] Carregando atualizações para versão:', versionId);

            const { data, error } = await supabase
                .from('user_version_updates')
                .select(`
          id,
          user_id,
          updated_at,
          user_agent,
          dismissed,
          profiles!inner(
            full_name,
            email
          )
        `)
                .eq('version_id', versionId)
                .eq('dismissed', false)
                .order('updated_at', { ascending: false });

            if (error) throw error;

            // Buscar unidades dos usuários
            const userIds = data?.map(u => u.user_id) || [];
            const { data: userUnits, error: unitsError } = await supabase
                .from('user_units')
                .select(`
          user_id,
          units!inner(
            unit_name
          )
        `)
                .in('user_id', userIds);

            if (unitsError) console.error('Erro ao buscar unidades:', unitsError);

            // Mapear dados
            const mapped: UserUpdateDetail[] = (data || []).map((update: any) => {
                const userUnit = userUnits?.find(uu => uu.user_id === update.user_id);
                return {
                    id: update.id,
                    user_id: update.user_id,
                    user_name: update.profiles?.full_name || 'N/A',
                    user_email: update.profiles?.email || 'N/A',
                    unit_name: (userUnit as any)?.units?.unit_name || 'N/A',
                    updated_at: update.updated_at,
                    user_agent: update.user_agent || 'N/A',
                    dismissed: update.dismissed,
                };
            });

            setUpdates(mapped);
            console.log('[UserUpdatesModal] Atualizações carregadas:', mapped.length);
        } catch (error) {
            console.error('[UserUpdatesModal] Erro ao carregar atualizações:', error);
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
        });
    };

    const formatTime = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleTimeString('pt-BR', {
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const getBrowserName = (userAgent: string) => {
        if (userAgent.includes('Chrome')) return 'Chrome';
        if (userAgent.includes('Firefox')) return 'Firefox';
        if (userAgent.includes('Safari')) return 'Safari';
        if (userAgent.includes('Edge')) return 'Edge';
        return 'Outro';
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900">
                            Usuários que Atualizaram
                        </h2>
                        <p className="text-sm text-gray-600 mt-1">
                            Versão {versionNumber} • {updates.length} {updates.length === 1 ? 'usuário' : 'usuários'}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1 hover:bg-gray-100 rounded transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {loading ? (
                        <div className="flex items-center justify-center h-64">
                            <div className="text-gray-500">Carregando...</div>
                        </div>
                    ) : updates.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                            <User className="w-12 h-12 mb-3 text-gray-400" />
                            <p className="text-sm">Nenhum usuário atualizou ainda</p>
                        </div>
                    ) : (
                        <div className="space-y-1">
                            {/* Table Header (Optional but good for compact view) */}
                            <div className="flex items-center gap-4 px-4 py-2 text-[10px] font-semibold text-gray-400 uppercase tracking-wider hidden md:flex border-b border-gray-50">
                                <div className="flex-1">Usuário</div>
                                <div className="w-32">Unidade</div>
                                <div className="w-32">Data/Hora</div>
                                <div className="w-24">Navegador</div>
                            </div>

                            {updates.map((update) => (
                                <div
                                    key={update.id}
                                    className="bg-white border-b border-gray-50 flex flex-col md:flex-row md:items-center gap-2 md:gap-4 p-3 hover:bg-gray-50 transition-colors"
                                >
                                    {/* User Info */}
                                    <div className="flex-1 flex items-center gap-3 min-w-0">
                                        <div className="p-1.5 bg-blue-50 rounded flex-shrink-0">
                                            <User className="w-4 h-4 text-blue-500" />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-sm font-medium text-gray-900 truncate">
                                                {update.user_name}
                                            </p>
                                            <p className="text-[11px] text-gray-500 truncate">
                                                {update.user_email}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Unit */}
                                    <div className="w-full md:w-32 flex items-center gap-1.5 text-xs text-gray-600">
                                        <Monitor className="w-3.5 h-3.5 text-gray-400 md:hidden" />
                                        <span className="truncate">{update.unit_name}</span>
                                    </div>

                                    {/* Date & Time */}
                                    <div className="w-full md:w-32 flex items-center gap-1.5 text-xs text-gray-500">
                                        <Calendar className="w-3.5 h-3.5 text-gray-400 md:hidden" />
                                        <span className="whitespace-nowrap">
                                            {formatDate(update.updated_at)} <span className="text-gray-400 ml-1">{formatTime(update.updated_at)}</span>
                                        </span>
                                    </div>

                                    {/* Browser */}
                                    <div className="w-full md:w-24 flex items-center gap-1.5 text-xs text-gray-500">
                                        <Monitor className="w-3.5 h-3.5 text-gray-400" />
                                        <span>{getBrowserName(update.user_agent)}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex justify-end p-6 border-t bg-gray-50">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                    >
                        Fechar
                    </button>
                </div>
            </div>
        </div>
    );
};
