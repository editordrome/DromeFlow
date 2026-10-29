import { supabase } from '../supabaseClient';

/**
 * Interface para Versão da Aplicação
 */
export interface AppVersion {
    id?: string;
    version: string;
    title: string;
    message: string;
    is_active?: boolean;
    is_mandatory?: boolean;
    changelog?: string;
    release_date?: string;
    created_at?: string;
    updated_at?: string;
}

/**
 * Interface para Estatísticas de Adoção
 */
export interface VersionStats {
    id: string;
    version: string;
    title: string;
    release_date: string;
    is_active: boolean;
    is_mandatory: boolean;
    updated_users: number;
    dismissed_users: number;
    total_users: number;
    adoption_rate: number;
}

/**
 * Interface para Atualização de Usuário
 */
export interface UserVersionUpdate {
    id?: string;
    user_id: string;
    version_id: string;
    updated_at?: string;
    user_agent?: string;
    dismissed?: boolean;
}

/**
 * Cria uma nova versão da aplicação
 */
export const createVersion = async (version: AppVersion): Promise<AppVersion> => {
    console.log('[versions.service] Criando versão:', version);

    // Sanitize input
    const { id: _id, created_at: _c, updated_at: _u, ...cleanVersion } = version as any;

    const { data, error } = await supabase
        .from('app_versions')
        .insert([cleanVersion])
        .select()
        .maybeSingle();

    if (error) {
        console.error('[versions.service] Erro ao criar versão:', error);
        throw error;
    }

    if (!data) {
        throw new Error('Erro ao confirmar criação do registro (RLS?)');
    }

    console.log('[versions.service] Versão criada:', data);
    return data;
};

/**
 * Atualiza uma versão existente
 */
export const updateVersion = async (
    id: string,
    updates: Partial<AppVersion>
): Promise<AppVersion> => {
    console.log('[versions.service] Atualizando versão:', id, updates);

    // Sanitize updates: remove protected fields
    const { id: _id, created_at: _c, updated_at: _u, ...cleanUpdates } = updates as any;

    const { data, error } = await supabase
        .from('app_versions')
        .update(cleanUpdates)
        .eq('id', id)
        .select()
        .maybeSingle();

    if (error) {
        console.error('[versions.service] Erro ao atualizar versão:', error);
        throw error;
    }

    if (!data) {
        // Se returnou nulo, indica que 0 linhas foram afetadas (provavelmente RLS)
        console.error('[versions.service] Update falhou ao afetar linhas. Verifique RLS.');
        throw new Error('Não foi possível salvar as alterações. Verifique se você tem permissões de Super Admin.');
    }

    console.log('[versions.service] Versão atualizada:', data);
    return data;
};

/**
 * Deleta uma versão
 */
export const deleteVersion = async (id: string): Promise<void> => {
    console.log('[versions.service] Deletando versão:', id);

    const { error } = await supabase
        .from('app_versions')
        .delete()
        .eq('id', id);

    if (error) {
        console.error('[versions.service] Erro ao deletar versão:', error);
        throw error;
    }

    console.log('[versions.service] Versão deletada');
};

/**
 * Busca todas as versões
 */
export const getAllVersions = async (): Promise<AppVersion[]> => {
    console.log('[versions.service] Buscando todas as versões');

    const { data, error } = await supabase
        .from('app_versions')
        .select('*')
        .order('release_date', { ascending: false });

    if (error) {
        console.error('[versions.service] Erro ao buscar versões:', error);
        throw error;
    }

    console.log('[versions.service] Versões encontradas:', data?.length);
    return data || [];
};

/**
 * Busca a versão ativa mais recente
 */
export const getActiveVersion = async (): Promise<AppVersion | null> => {
    console.log('[versions.service] Buscando versão ativa');

    const { data, error } = await supabase
        .from('app_versions')
        .select('*')
        .eq('is_active', true)
        .order('release_date', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (error) {
        console.error('[versions.service] Erro ao buscar versão ativa:', error);
        throw error;
    }

    console.log('[versions.service] Versão ativa:', data?.version || 'nenhuma');
    return data;
};

/**
 * Verifica se usuário já atualizou para uma versão
 */
export const checkUserUpdate = async (
    userId: string,
    versionId: string
): Promise<UserVersionUpdate | null> => {
    console.log('[versions.service] Verificando atualização do usuário:', userId, versionId);

    const { data, error } = await supabase
        .from('user_version_updates')
        .select('*')
        .eq('user_id', userId)
        .eq('version_id', versionId)
        .maybeSingle();

    if (error) {
        console.error('[versions.service] Erro ao verificar atualização:', error);
        throw error;
    }

    console.log('[versions.service] Status da atualização:', data ? 'atualizado' : 'pendente');
    return data;
};

/**
 * Registra que usuário atualizou para uma versão
 */
export const recordUserUpdate = async (
    userId: string,
    versionId: string,
    dismissed: boolean = false
): Promise<void> => {
    console.log('[versions.service] Registrando atualização:', { userId, versionId, dismissed });

    const { error } = await supabase
        .from('user_version_updates')
        .upsert(
            {
                user_id: userId,
                version_id: versionId,
                user_agent: navigator.userAgent,
                dismissed,
            },
            {
                onConflict: 'user_id,version_id',
            }
        );

    if (error) {
        console.error('[versions.service] Erro ao registrar atualização:', error);
        throw error;
    }

    console.log('[versions.service] Atualização registrada');
};

/**
 * Busca estatísticas de adoção de versões
 */
export const getVersionStats = async (): Promise<VersionStats[]> => {
    console.log('[versions.service] Buscando estatísticas de adoção');

    const { data, error } = await supabase
        .from('version_adoption_stats')
        .select('*');

    if (error) {
        console.error('[versions.service] Erro ao buscar estatísticas:', error);
        throw error;
    }

    console.log('[versions.service] Estatísticas encontradas:', data?.length);
    return data || [];
};

/**
 * Desativa todas as versões ativas (útil antes de ativar uma nova)
 */
export const deactivateAllVersions = async (): Promise<void> => {
    console.log('[versions.service] Desativando todas as versões');

    const { error } = await supabase
        .from('app_versions')
        .update({ is_active: false })
        .eq('is_active', true);

    if (error) {
        console.error('[versions.service] Erro ao desativar versões:', error);
        throw error;
    }

    console.log('[versions.service] Versões desativadas');
};
