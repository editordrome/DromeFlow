import { v4 as uuidv4 } from 'uuid';
import { supabase } from './supabaseClient';
import { User, Profile, UserRole, Unit, Module, DataRecord, DashboardMetrics, UploadMetrics, AccessCredential, ServiceAnalysisRecord, ClientAnalysisData, RepasseAnalysisRecord } from '../types';

// Fase 1: reexports para manter uma única fonte de verdade das funções migradas
export {
    fetchAllUnits,
    createUnit,
    updateUnit,
    deleteUnit,
} from './index';
export {
    fetchAllModules,
    createModule,
    updateModule,
    deleteModule,
    toggleModuleStatus,
    updateModulesOrder,
} from './index';
export {
    fetchAllAccessCredentials,
    createAccessCredential,
    updateAccessCredential,
    deleteAccessCredential,
} from './index';
export { fetchWebhookContent } from './index';

// --- User Management & Auth ---
type FullUser = User & Profile;
type UserDataPayload = Partial<FullUser> & {
    password?: string;
    unit_ids?: string[];
    module_ids?: string[];
};

export const fetchAllUsers = async (): Promise<FullUser[]> => {
    const { data, error } = await supabase.from('profiles').select('*, user_email:email');
    if (error) throw error;

    // A small hack to match the FullUser type which expects 'email' not 'user_email'
    return data.map(({ user_email, ...rest }) => ({ ...rest, email: user_email }));
};

// Lista usuários vinculados a qualquer unidade que o admin possua (interseção via user_units)
export const fetchUsersForAdminUnits = async (adminUserId: string): Promise<FullUser[]> => {
    // 1. Buscar unidades do admin
    const { data: adminUnits, error: adminUnitsError } = await supabase
        .from('user_units')
        .select('unit_id')
        .eq('user_id', adminUserId);
    if (adminUnitsError) throw adminUnitsError;
    const unitIds = (adminUnits || []).map(u => u.unit_id);
    if (unitIds.length === 0) return [];

    // 2. Buscar user_ids ligados a essas unidades
    const { data: links, error: linksError } = await supabase
        .from('user_units')
        .select('user_id, unit_id')
        .in('unit_id', unitIds);
    if (linksError) throw linksError;
    const userIds = Array.from(new Set((links || []).map(l => l.user_id)));
    if (userIds.length === 0) return [];

    // 3. Buscar perfis correspondentes
    const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('*, user_email:email')
        .in('id', userIds);
    if (profilesError) throw profilesError;

    return (profilesData || []).map(({ user_email, ...rest }) => ({ ...rest, email: user_email }));
};

export const fetchUserAssignments = async (userId: string): Promise<{ unit_ids: string[], module_ids: string[] }> => {
    const [unitsRes, modulesRes] = await Promise.all([
        supabase.from('user_units').select('unit_id').eq('user_id', userId),
        supabase.from('user_modules').select('module_id').eq('user_id', userId)
    ]);
    if (unitsRes.error) throw unitsRes.error;
    if (modulesRes.error) throw modulesRes.error;

    return {
        unit_ids: unitsRes.data?.map(u => u.unit_id) || [],
        module_ids: modulesRes.data?.map(m => m.module_id) || [],
    };
};

export const createUser = async (userData: UserDataPayload & { auto_unit_id?: string }): Promise<void> => {
    if (!userData.email || !userData.password) throw new Error("Email e senha são obrigatórios.");
    
    // Verifica se já existe profile com este email (defensivo para futura migração com auth.users trigger)
    const { data: existing, error: existingError } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', userData.email)
        .limit(1);
    if (existingError) throw existingError;

    let userId = existing && existing.length > 0 ? existing[0].id : uuidv4();

    if (!existing || existing.length === 0) {
        // Cria novo profile
        const { error: profileError } = await supabase.from('profiles').insert({
            id: userId,
            full_name: userData.full_name,
            email: userData.email,
            role: userData.role || 'user',
            password: userData.password // Plain text (MVP). Futuro: substituir por hash.
        });
        if (profileError) {
            // Código 23505 = unique_violation
            if ((profileError as any).code === '23505') {
                throw new Error('Já existe um usuário com este e-mail.');
            }
            throw profileError;
        }
    } else {
        // Atualiza campos básicos se usuário já existia (não sobrescreve senha se não fornecida)
        const updatePayload: any = {
            full_name: userData.full_name,
            role: userData.role,
        };
        if (userData.password) updatePayload.password = userData.password;
        const { error: updErr } = await supabase
            .from('profiles')
            .update(updatePayload)
            .eq('id', userId);
        if (updErr) throw updErr;
    }

    // Atribuições (limpa e recria)
    let unitIds = userData.unit_ids || [];
    if (unitIds.length === 0 && userData.auto_unit_id) {
        unitIds = [userData.auto_unit_id];
    }
    await updateUserAssignments(userId, unitIds, userData.module_ids || []);
};

export const updateUser = async (userId: string, userData: UserDataPayload): Promise<void> => {
    const profileUpdate: Partial<Profile> & { password?: string } = {
        full_name: userData.full_name,
        role: userData.role,
        email: userData.email
    };

    // Add password to the update payload if it exists
    if (userData.password) {
        profileUpdate.password = userData.password;
    }

    // Update profile (and password if provided)
    const { error: profileError } = await supabase.from('profiles')
        .update(profileUpdate)
        .eq('id', userId);
        
    if (profileError) throw profileError;
    
    // Update assignments
    await updateUserAssignments(userId, userData.unit_ids || [], userData.module_ids || []);
};


const updateUserAssignments = async (userId: string, unitIds: string[], moduleIds: string[]) => {
    // Clear existing assignments
    await Promise.all([
        supabase.from('user_units').delete().eq('user_id', userId),
        supabase.from('user_modules').delete().eq('user_id', userId),
    ]);
    
    // Insert new assignments
    if (unitIds.length > 0) {
        const unitAssignments = unitIds.map(unit_id => ({ user_id: userId, unit_id }));
        const { error } = await supabase.from('user_units').insert(unitAssignments);
        if (error) throw error;
    }
    if (moduleIds.length > 0) {
        const moduleAssignments = moduleIds.map(module_id => ({ user_id: userId, module_id }));
        const { error } = await supabase.from('user_modules').insert(moduleAssignments);
        if (error) throw error;
    }
}


export const deleteUser = async (userId: string): Promise<void> => {
    // This is highly insecure client-side. An Edge Function with the service_role key is required.
    // The RLS policies will prevent this from working unless the user is deleting themselves.
    // For this app, we'll assume an RPC `delete_app_user` exists.
    const { error } = await supabase.rpc('delete_app_user', { user_id_to_delete: userId });
    if (error) throw error;
};

// Lista usuários vinculados a uma unidade específica (via tabela de junção user_units)
export const fetchUsersForUnit = async (unitId: string): Promise<{ id: string; full_name: string; email: string; role: string }[]> => {
    // 1. Busca user_ids ligados à unidade
    const { data: links, error: linkError } = await supabase
        .from('user_units')
        .select('user_id')
        .eq('unit_id', unitId);
    if (linkError) throw linkError;

    const userIds = (links || []).map(l => l.user_id).filter(Boolean);
    if (userIds.length === 0) return [];

    // 2. Busca perfis correspondentes
    const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, email, role')
        .in('id', userIds);
    if (profilesError) throw profilesError;

    return (profilesData || []).map(p => ({
        id: p.id as string,
        full_name: (p as any).full_name || '',
        email: (p as any).email || '',
        role: (p as any).role || 'user'
    }));
};

// --- Units & Modules ---

export const fetchAllUnits = async (): Promise<Unit[]> => {
    const { data, error } = await supabase.from('units').select('*').order('unit_name');
    if (error) throw error;
    return data || [];
};
export const createUnit = async (unitData: Partial<Unit>) => {
    const payload = {
        id: (unitData as any).id, // se houver default no DB, pode ser omitido
        unit_name: unitData.unit_name?.trim(),
        // Removido toUpperCase para preservar capitalização informada pelo usuário
        unit_code: unitData.unit_code?.trim(),
    };
    if (!payload.unit_name || !payload.unit_code) {
        throw new Error('Nome e código da unidade são obrigatórios.');
    }
    const { error } = await supabase.from('units').insert(payload);
    if (error) {
        console.error('Erro ao criar unidade:', error);
        if ((error as any).code === '23505') {
            throw new Error('Código de unidade já existe.');
        }
        throw new Error(`Falha ao criar unidade: ${error.message}`);
    }
};
export const updateUnit = async (unitId: string, unitData: Partial<Unit>) => {
    const payload = {
        unit_name: unitData.unit_name?.trim(),
        // Removido toUpperCase para preservar capitalização informada pelo usuário
        unit_code: unitData.unit_code?.trim(),
    };
    if (!payload.unit_name || !payload.unit_code) {
        throw new Error('Nome e código da unidade são obrigatórios.');
    }
    const { error } = await supabase.from('units').update(payload).eq('id', unitId);
    if (error) {
        console.error('Erro ao atualizar unidade:', error);
        if ((error as any).code === '23505') {
            throw new Error('Código de unidade já existe.');
        }
        throw new Error(`Falha ao atualizar unidade: ${error.message}`);
    }
};
export const deleteUnit = async (unitId: string) => {
    const { error } = await supabase.from('units').delete().eq('id', unitId);
    if (error) throw error;
};

export const fetchAllModules = async (): Promise<Module[]> => {
    const { data, error } = await supabase
        .from('modules')
        .select('*')
        .order('position', { ascending: true })
        .order('name', { ascending: true });
    if (error) throw error;
    return data || [];
};
export const createModule = async (moduleData: Partial<Module>) => {
    // Busca maior posição atual para inserir no final
    const { data: maxData } = await supabase
        .from('modules')
        .select('position')
        .order('position', { ascending: false })
        .limit(1);
    const nextPosition = (maxData && maxData[0]?.position ? maxData[0].position : 0) + 1;

    const dataToInsert = {
        ...moduleData,
        allowed_profiles: moduleData.allowed_profiles || ['super_admin'],
        position: moduleData.position ?? nextPosition,
    };
    const { error } = await supabase.from('modules').insert(dataToInsert);
    if (error) throw error;
};
export const updateModule = async (moduleId: string, moduleData: Partial<Module>) => {
    // Garante que allowed_profiles seja um array, mesmo que venha nulo ou indefinido
    const dataToUpdate = {
        ...moduleData,
        allowed_profiles: moduleData.allowed_profiles || ['super_admin'],
    };
    const { error } = await supabase.from('modules').update(dataToUpdate).eq('id', moduleId);
    if (error) throw error;
};
export const deleteModule = async (moduleId: string) => {
    const { error } = await supabase.from('modules').delete().eq('id', moduleId);
    if (error) throw error;
};
export const toggleModuleStatus = async (moduleId: string, newStatus: boolean) => {
    const { error } = await supabase.from('modules').update({ is_active: newStatus }).eq('id', moduleId);
    if (error) throw error;
};

// Atualiza ordem de múltiplos módulos
export const updateModulesOrder = async (ordered: { id: string; position: number }[]) => {
    // Implementação simples: múltiplas updates paralelas.
    // Para otimização futura: criar RPC (plpgsql) que receba JSONB e atualize em lote.
    const updates = ordered.map(item =>
        supabase.from('modules').update({ position: item.position }).eq('id', item.id)
    );
    const results = await Promise.all(updates);
    const firstError = results.find(r => r.error)?.error;
    if (firstError) throw firstError;
};


// --- Access Credentials ---
export const fetchAllAccessCredentials = async (): Promise<AccessCredential[]> => {
    const { data, error } = await supabase.from('access_credentials').select('*').order('name');
    if (error) throw error;
    return data || [];
};
export const createAccessCredential = async (credData: Partial<AccessCredential>) => {
    const { error } = await supabase.from('access_credentials').insert(credData);
    if (error) throw error;
};
export const updateAccessCredential = async (credId: string, credData: Partial<AccessCredential>) => {
    const { error } = await supabase.from('access_credentials').update(credData).eq('id', credId);
    if (error) throw error;
};
export const deleteAccessCredential = async (credId: string) => {
    const { error } = await supabase.from('access_credentials').delete().eq('id', credId);
    if (error) throw error;
};


// --- User-Specific Units & Modules ---

export const fetchUserUnits = async (userId: string): Promise<Unit[]> => {
    try {
        const { data, error } = await supabase.rpc('get_user_units', { p_user_id: userId });
        if (error) throw error;
        return data || [];
    } catch (rpcErr) {
        console.warn('[fetchUserUnits] Falha RPC get_user_units, aplicando fallback manual:', rpcErr);
        // Fallback manual: user_units join units
        const { data: linkData, error: linkError } = await supabase
            .from('user_units')
            .select('unit_id')
            .eq('user_id', userId);
        if (linkError) {
            console.error('[fetchUserUnits] Erro fallback user_units:', linkError);
            return [];
        }
        const unitIds = (linkData || []).map(r => r.unit_id);
        if (unitIds.length === 0) return [];
        const { data: unitsData, error: unitsError } = await supabase
            .from('units')
            .select('*')
            .in('id', unitIds);
        if (unitsError) {
            console.error('[fetchUserUnits] Erro buscando units no fallback:', unitsError);
            return [];
        }
        return unitsData || [];
    }
};

export const fetchUserModules = async (userId: string): Promise<Module[]> => {
    const { data, error } = await supabase.rpc('get_user_modules', { p_user_id: userId });
    if (error) throw error;
    return data || [];
};


// --- Content ---

export const fetchWebhookContent = async (url: string, unitCode: string): Promise<string> => {
    if (url.startsWith('internal://')) {
        return `<p>Conteúdo interno para ${url.replace('internal://', '')} e unidade ${unitCode}.</p>`;
    }
    // In a real app, you might fetch this, but for now, it's a placeholder.
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        return await response.text();
    } catch (error) {
        console.error("Failed to fetch webhook content:", error);
        return `<div class="text-danger">Falha ao carregar conteúdo de ${url}.</div>`;
    }
};

// --- Data Table & Dashboard ---

export const fetchDataTable = async (
  unitCode: string,
  page: number,
  pageSize: number,
  searchTerm?: string,
  searchColumn?: 'cliente' | 'orcamento',
  period?: string
): Promise<{ data: DataRecord[], count: number }> => {
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabase
        .from('processed_data')
        .select('*', { count: 'exact' })
        .eq('unidade_code', unitCode);

    if (period && period.match(/^\d{4}-\d{2}$/)) {
        const [year, month] = period.split('-').map(Number);
        const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
        const endDate = new Date(Date.UTC(year, month, 0)).toISOString().split('T')[0];
        query = query.gte('DATA', startDate).lte('DATA', endDate);
    }

    if (searchTerm && searchColumn) {
        const columnName = searchColumn === 'cliente' ? 'CLIENTE' : 'orcamento';
        query = query.ilike(columnName, `%${searchTerm}%`);
    }

    query = query
        .order('DATA', { ascending: false })
        .range(from, to);

    const { data, error, count } = await query;

    if (error) {
      console.error("Error in fetchDataTable:", error);
      throw error;
    }
    return { data: (data as DataRecord[]) || [], count: count || 0 };
};

// --- Appointments (Agendamentos) ---
export const fetchAppointments = async (unitCode: string, date: string): Promise<DataRecord[]> => {
    // Espera formato YYYY-MM-DD
    if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(date)) return [];
    const { data, error } = await supabase
        .from('processed_data')
        .select('*')
        .eq('unidade_code', unitCode)
        .eq('DATA', date)
        .order('HORARIO', { ascending: true });
    if (error) {
        console.error('Erro ao buscar agendamentos:', error);
        throw error;
    }
    return (data as DataRecord[]) || [];
};


// Fix: Create a helper type to correctly type raw data from XLSX where REPASSE can be a string.
export type RawDataRecordForUpload = Omit<DataRecord, 'REPASSE'> & { REPASSE: string | number };

// *** FUNÇÃO ATUALIZADA: Processa atendimentos com múltiplas profissionais seguindo as novas regras ***
const processMultipleProfessionalsRecords = (records: RawDataRecordForUpload[]): DataRecord[] => {
    const finalRecords: DataRecord[] = [];

    records.forEach(record => {
        const originalOrcamento = String(record.orcamento || record.NÚMERO || '').trim();
        const professionalString = String(record.PROFISSIONAL || '').trim();

        // Rule: Check if 'Profissional' contains a semicolon, indicating multiple professionals.
        if (professionalString.includes(';')) {
            // "Lógica de Expansão" for multiple professionals.
            const professionals = professionalString.split(';').map(p => p.trim()).filter(Boolean);
            
            // *** CORREÇÃO: Utiliza a função auxiliar para processar o repasse corretamente ***
            // Esta função lida tanto com valores únicos (para divisão) quanto com múltiplos valores separados por espaço.
            const repasses = processRepasseValues(record.REPASSE, professionals.length);

            if (professionals.length > 0) {
                professionals.forEach((professional, index) => {
                    const isFirst = index === 0;

                    // Based on the provided example:
                    // - The first record keeps the original 'orcamento'.
                    // - Subsequent records get a suffix: 'orcamento_1', 'orcamento_2', etc.
                    const newOrcamento = isFirst ? originalOrcamento : `${originalOrcamento}_${index}`;
                    
                    finalRecords.push({
                        ...record,
                        PROFISSIONAL: professional,
                        REPASSE: repasses[index] || 0, // Usa o valor de repasse correto para este profissional
                        orcamento: newOrcamento,
                        // The original 'VALOR' is kept for the first professional, and is 0 for the others.
                        VALOR: isFirst ? record.VALOR : 0,
                        // Maintain helper columns for dashboard/charts based on the new structure
                        ATENDIMENTO_ID: originalOrcamento,
                        IS_DIVISAO: isFirst ? 'NAO' : 'SIM',
                    });
                });
            } else {
                 // Edge case for empty splits, treat as a single record.
                 finalRecords.push({
                    ...record,
                    orcamento: originalOrcamento,
                    // Converte o repasse para número, preservando decimais
                    REPASSE: parseFloat(String(record.REPASSE).replace(',', '.')) || 0,
                    ATENDIMENTO_ID: originalOrcamento,
                    IS_DIVISAO: 'NAO',
                });
            }
        } else {
            // Single professional: based on the example, the record is kept as is.
            finalRecords.push({
                ...record,
                orcamento: originalOrcamento,
                 // Converte o repasse para número, preservando decimais
                REPASSE: parseFloat(String(record.REPASSE).replace(',', '.')) || 0,
                // Add helper columns for consistency.
                ATENDIMENTO_ID: originalOrcamento,
                IS_DIVISAO: 'NAO',
            });
        }
    });

    return finalRecords;
};

// *** FUNÇÃO ATUALIZADA: Remove registros obsoletos usando 'orcamento' como chave lógica de análise ***
// Estratégia:
// 1. Buscar todos os registros do período (orcamento, IS_DIVISAO) para a unidade.
// 2. Considerar como "base" apenas registros originais (IS_DIVISAO = 'NAO').
// 3. Calcular diferença entre orçamentos base existentes e orçamentos base presentes no arquivo.
// 4. Remover todos os registros (originais + divididos) cujo orcamento base não está mais no arquivo.
//    Para identificar derivados, usamos a convenção de sufixo _N (ex: ORC123_1) OU a flag IS_DIVISAO.
const removeObsoleteRecords = async (unitCode: string, startDate: string, endDate: string, baseBudgetsInFile: Set<string>): Promise<number> => {
    try {
        console.log(`\n🧹 INICIANDO LIMPEZA DE REGISTROS OBSOLETOS (base: orcamento)`);
        console.log(`Unidade: ${unitCode}, Período: ${startDate} a ${endDate}`);

        const { data: existingRecords, error: fetchError } = await supabase
            .from('processed_data')
            .select('orcamento, IS_DIVISAO')
            .eq('unidade_code', unitCode)
            .gte('DATA', startDate)
            .lte('DATA', endDate);

        if (fetchError) {
            console.error('❌ Erro ao buscar registros existentes:', fetchError);
            return 0;
        }
        if (!existingRecords || existingRecords.length === 0) {
            console.log('ℹ️ Nenhum registro existente encontrado no período. Limpeza não necessária.');
            return 0;
        }

        // Mapa orcamentoAtual -> orcamentoBase
        const baseFromOrcamento = (orc: any, isDivisao: any): string => {
            if (isDivisao === 'SIM' && typeof orc === 'string') {
                const match = orc.match(/^(.*)_\d+$/);
                if (match) return match[1];
            }
            return String(orc || '').trim();
        };

        const existingBaseBudgets = new Set<string>();
        const recordsWithBase: { orcamento: string; base: string }[] = [];
        (existingRecords || []).forEach(r => {
            const orc = (r as any).orcamento;
            const isDiv = (r as any).IS_DIVISAO;
            const base = baseFromOrcamento(orc, isDiv);
            recordsWithBase.push({ orcamento: orc, base });
            if (isDiv !== 'SIM') {
                existingBaseBudgets.add(base);
            }
        });

        // Quais bases remover (existem no DB mas não no arquivo atual)
        const basesToRemove = Array.from(existingBaseBudgets).filter(b => !baseBudgetsInFile.has(b));
        if (basesToRemove.length === 0) {
            console.log('✅ Todos os orçamentos base existentes estão presentes no arquivo. Nenhuma remoção necessária.');
            return 0;
        }

        // Coletar todos os orçamentos (originais + derivados) cujas bases devem sair
        const orcamentosParaRemoverSet = new Set<string>();
        recordsWithBase.forEach(r => {
            if (basesToRemove.includes(r.base)) {
                orcamentosParaRemoverSet.add(r.orcamento);
            }
        });
        const orcamentosParaRemover = Array.from(orcamentosParaRemoverSet).filter(o => o);

        console.log(`🗑️ Bases a remover: ${basesToRemove.length}`);
        console.log(`🗑️ Total de registros (incluindo divisões) a remover: ${orcamentosParaRemover.length}`);
        console.log('🗑️ Exemplos de bases:', basesToRemove.slice(0, 10));

        if (orcamentosParaRemover.length === 0) {
            console.log('⚠️ Nenhum orcamento concreto coletado para remoção (possível inconsistência).');
            return 0;
        }

        const { error: deleteError, count } = await supabase
            .from('processed_data')
            .delete({ count: 'exact' })
            .eq('unidade_code', unitCode)
            .in('orcamento', orcamentosParaRemover);

        if (deleteError) {
            console.error('Erro ao remover registros obsoletos:', deleteError);
            return 0;
        }

        const deletedCount = count || 0;
        console.log(`\n✅ LIMPEZA CONCLUÍDA (base orcamento): ${deletedCount} registros removidos.`);
        return deletedCount;
    } catch (error) {
        console.error('Erro geral durante a limpeza de registros obsoletos (base orcamento):', error);
        return 0;
    }
};

export const uploadXlsxData = async (unitCode: string, records: RawDataRecordForUpload[]): Promise<UploadMetrics> => {
    console.log(`=== INICIANDO SINCRONIZAÇÃO E UPLOAD ===`);
    if (records.length === 0) {
        console.warn('⚠️ Nenhum registro para processar');
        return { total: 0, inserted: 0, updated: 0, ignored: 0, deleted: 0 };
    }

    // Fix: Cast the input to the appropriate raw data type for processing.
    const processedRecords = processMultipleProfessionalsRecords(records);
    console.log(`Total de registros processados (após expansão): ${processedRecords.length}`);

    // *** LÓGICA DE SINCRONIZAÇÃO E LIMPEZA ***
    let deletedCount = 0;
    let minDate: Date | null = null;
    let maxDate: Date | null = null;

    processedRecords.forEach(record => {
        if (record.DATA) {
            const [year, month, day] = record.DATA.split('-').map(Number);
            const currentDate = new Date(year, month - 1, day);
            if (!isNaN(currentDate.getTime())) {
                if (!minDate || currentDate < minDate) minDate = currentDate;
                if (!maxDate || currentDate > maxDate) maxDate = currentDate;
            }
        }
    });

    if (minDate && maxDate) {
        // Conjunto de orçamentos base presentes no arquivo (registros originais, IS_DIVISAO = 'NAO')
        const baseBudgetsInFile = new Set(
            processedRecords
                .filter(r => r.IS_DIVISAO === 'NAO')
                .map(r => r.orcamento)
                .filter(Boolean)
        );
        const startDate = minDate.toISOString().split('T')[0];
        const endDate = maxDate.toISOString().split('T')[0];
        deletedCount = await removeObsoleteRecords(unitCode, startDate, endDate, baseBudgetsInFile);
    } else {
        console.warn('⚠️ Nenhuma data válida encontrada nos registros. Pulando etapa de limpeza.');
    }
    // *** FIM DA LÓGICA DE SINCRONIZAÇÃO ***

    // ================= Estratégia de Upload com Fallback =================
    // 1. Tenta usar a RPC existente (mais rápida e centraliza regras de negócio do lado do banco).
    // 2. Se o erro for especificamente a coluna "profissional" inexistente (case mismatch), ativa fallback manual.

    const sanitizeRecord = (r: any) => {
        const { status, profissional, ...rest } = r; // remove campos não persistidos
        return rest;
    };

    const tryRpcUpload = async (): Promise<UploadMetrics> => {
        const aggregatedMetrics = { total: 0, inserted: 0, updated: 0, ignored: 0 };
        const uploadBatchSize = 500;
        for (let i = 0; i < processedRecords.length; i += uploadBatchSize) {
            const batch = processedRecords.slice(i, i + uploadBatchSize);
            console.log(`🚀 Enviando lote ${i / uploadBatchSize + 1}... (${i + batch.length}/${processedRecords.length})`);
            // Duplicamos campo em minúsculas para compatibilidade.
            const batchForRpc = batch.map(r => ({
                ...sanitizeRecord(r),
                profissional: (r as any).PROFISSIONAL ?? '' // compatibilidade se versão antiga da função precisar
            }));
            const { data, error } = await supabase.rpc('process_xlsx_upload', {
                unit_code_arg: unitCode,
                records_arg: batchForRpc,
            });
            if (error) {
                console.error(`❌ Erro no lote ${i / uploadBatchSize + 1}:`, error);
                throw new Error(`O servidor retornou um erro durante o upload do lote: ${error.message}`);
            }
            const batchMetrics = data as Omit<UploadMetrics, 'deleted'>;
            aggregatedMetrics.total += batchMetrics.total;
            aggregatedMetrics.inserted += batchMetrics.inserted;
            aggregatedMetrics.updated += batchMetrics.updated;
            aggregatedMetrics.ignored += batchMetrics.ignored;
        }
        return { ...aggregatedMetrics, deleted: deletedCount };
    };

    const manualFallbackUpload = async (): Promise<UploadMetrics> => {
        console.warn('⚠️ Ativando fallback manual (sem RPC) devido a erro de coluna profissional.');
        const existingMap = new Map<string, { id: string }>();
        if (minDate && maxDate) {
            const startDate = minDate.toISOString().split('T')[0];
            const endDate = maxDate.toISOString().split('T')[0];
            const { data: existing, error: exErr } = await supabase
                .from('processed_data')
                .select('id, orcamento')
                .eq('unidade_code', unitCode)
                .gte('DATA', startDate)
                .lte('DATA', endDate);
            if (exErr) {
                console.error('Erro ao buscar registros existentes para fallback:', exErr);
            } else {
                (existing || []).forEach(r => { if ((r as any).orcamento) existingMap.set((r as any).orcamento, { id: (r as any).id }); });
            }
        }
        const toInsert: any[] = [];
        const toUpdate: any[] = [];
        processedRecords.forEach(r => {
            const clean = sanitizeRecord(r);
            if (clean.orcamento && existingMap.has(clean.orcamento)) toUpdate.push(clean); else toInsert.push(clean);
        });
        let inserted = 0, updated = 0, ignored = 0;
        // Inserções
        const insertBatchSize = 500;
        for (let i = 0; i < toInsert.length; i += insertBatchSize) {
            const slice = toInsert.slice(i, i + insertBatchSize).map(r => ({ ...sanitizeRecord(r), unidade_code: unitCode }));
            const { error: insErr } = await supabase.from('processed_data').insert(slice);
            if (insErr) {
                console.error('Erro em inserção batch fallback:', insErr);
                throw new Error(`Falha na inserção fallback: ${insErr.message}`);
            }
            inserted += slice.length;
        }
        // Updates
        for (const r of toUpdate) {
            const updPayload: any = {
                DATA: r.DATA,
                CLIENTE: r.CLIENTE,
                VALOR: r.VALOR,
                REPASSE: r.REPASSE,
                IS_DIVISAO: r.IS_DIVISAO,
                PROFISSIONAL: (r as any).PROFISSIONAL,
            };
            const { error: upErr } = await supabase
                .from('processed_data')
                .update(updPayload)
                .eq('unidade_code', unitCode)
                .eq('orcamento', r.orcamento);
            if (upErr) {
                console.error('Erro em update fallback:', upErr);
                throw new Error(`Falha no update fallback: ${upErr.message}`);
            }
            updated += 1;
        }
        const total = processedRecords.length;
        return { total, inserted, updated, ignored, deleted: deletedCount };
    };

    let finalMetrics: UploadMetrics;
    try {
        finalMetrics = await tryRpcUpload();
        console.log('✅ Upload via RPC concluído.');
    } catch (e: any) {
        const msg = String(e?.message || '').toLowerCase();
        if (msg.includes('column "profissional" does not exist')) {
            console.warn('Detectado erro de coluna profissional na RPC. Iniciando fallback manual.');
            finalMetrics = await manualFallbackUpload();
        } else {
            console.error('Erro não coberto no upload:', e);
            throw e;
        }
    }

    console.log(`=== SINCRONIZAÇÃO FINALIZADA ===`);
    console.log('📊 Métricas Finais:', finalMetrics);
    return finalMetrics;
};

export const fetchDashboardMetrics = async (unitCode: string, period: string): Promise<DashboardMetrics> => {
    const endOfMonthUtc = (year: number, month01to12: number) => new Date(Date.UTC(year, month01to12, 0)).toISOString().split('T')[0];

    let startDate: string | null = null;
    let endDate: string | null = null;

    if (period && period.length === 4) {
        const year = parseInt(period, 10);
        startDate = `${year}-01-01`;
        endDate = `${year}-12-31`;
    } else if (period && /^\d{4}-\d{2}$/.test(period)) {
        const [yearStr, monthStr] = period.split('-');
        const year = parseInt(yearStr, 10);
        const month = parseInt(monthStr, 10);
        startDate = `${year}-${String(month).padStart(2, '0')}-01`;
        endDate = endOfMonthUtc(year, month);
    }

    // Se não houver período, a lógica para buscar todos os dados pode ser complexa.
    // Por enquanto, vamos focar em corrigir a lógica COM período.
    if (!startDate || !endDate) {
        // Fallback para a versão JSON sem período, ciente de que o repasse pode estar incorreto.
        const { data: allData, error: rpcError } = await supabase.rpc('get_dashboard_metrics', { p_unit_code: unitCode });
        if (rpcError) throw rpcError;
        return allData || { totalRevenue: 0, totalServices: 0, uniqueClients: 0, averageTicket: 0, totalRepasse: 0 };
    }

    // Estratégia revisada: substituir dependência de total_attendances e average_ticket vindos da RPC
    // e recalcular serviços e ticket médio usando apenas registros originais (IS_DIVISAO = 'NAO').
    // Receita total: soma de VALOR dos registros originais.
    // Serviços: quantidade de orçamentos originais únicos.
    // Ticket médio: receita / serviços.
    // Repasse: soma de REPASSE de TODOS os registros (originais + divididos).

    const { data: periodRecords, error: periodError } = await supabase
        .from('processed_data')
        .select('VALOR, CLIENTE, REPASSE, IS_DIVISAO, orcamento')
        .eq('unidade_code', unitCode)
        .gte('DATA', startDate)
        .lte('DATA', endDate);
    if (periodError) throw periodError;

    const allRecords = periodRecords || [];
    const originalRecords = allRecords.filter(r => r.IS_DIVISAO !== 'SIM');

    // Serviços = orçamentos base únicos (originais não têm sufixo)
    const uniqueBudgets = new Set(originalRecords.map(r => r.orcamento).filter(Boolean));
    const totalServices = uniqueBudgets.size;

    // Receita = soma do VALOR dos originais
    const totalRevenue = originalRecords.reduce((sum, r: any) => sum + (r.VALOR || 0), 0);

    // Clientes únicos (originais)
    const uniqueClients = new Set(originalRecords.map(r => r.CLIENTE).filter(Boolean)).size;

    const averageTicket = totalServices > 0 ? totalRevenue / totalServices : 0;

    // Repasse soma TODOS os registros
    const totalRepasse = allRecords.reduce((sum, r: any) => sum + (r.REPASSE || 0), 0);

    return {
        totalRevenue,
        totalServices,
        uniqueClients,
        averageTicket,
        totalRepasse,
    };
};

// Agregação multi-unidade: soma das métricas de várias unidades reutilizando a função existente.
export const fetchDashboardMetricsMulti = async (unitCodes: string[], period: string): Promise<DashboardMetrics> => {
    if (unitCodes.length === 0) return { totalRevenue: 0, totalServices: 0, uniqueClients: 0, averageTicket: 0, totalRepasse: 0 };
    let totalRevenue = 0;
    let totalServices = 0;
    let totalRepasse = 0;
    const allClients = new Set<string>();
    const allBudgets = new Set<string>();
    for (const code of unitCodes) {
        const m = await fetchDashboardMetrics(code, period);
        totalRevenue += m.totalRevenue;
        totalServices += m.totalServices; // serviços já base únicos por unidade
        totalRepasse += m.totalRepasse;
        // Para garantir unicidade de clientes e evitar contagem duplicada se mesmo cliente aparece em múltiplas unidades, precisamos buscar clientes originais.
        // Reaproveitamos a consulta direta similar à existente.
        // Otimização simples: realizar uma query manual agregada.
    }
    // Recalcular averageTicket global
    const averageTicket = totalServices > 0 ? totalRevenue / totalServices : 0;
    // Para clientes únicos e serviços base cross-unidades precisamos nova consulta agregada.
    // Simples: fazer uma query por todas as unidades de uma vez (única), similar ao bloco interno da função principal.
    // (Versão otimizada para evitar N queries adicionais de clientes/budgets.)
    // Implementação agregada:
    const { data: multiRecords, error: multiErr } = await supabase
        .from('processed_data')
        .select('CLIENTE, IS_DIVISAO, orcamento, unidade_code')
        .in('unidade_code', unitCodes);
    if (!multiErr && multiRecords) {
        multiRecords.filter(r => r.IS_DIVISAO !== 'SIM').forEach(r => {
            if (r.orcamento) allBudgets.add(r.orcamento);
            if (r.CLIENTE) allClients.add(r.CLIENTE);
        });
    }
    // Ajusta totalServices global para número de orçamentos base únicos somando entre unidades (evita duplicar mesmo orçamento se repetido entre unidades — raro, mas seguro)
    totalServices = allBudgets.size || totalServices;
    const uniqueClients = allClients.size;
    return { totalRevenue, totalServices, uniqueClients, averageTicket, totalRepasse };
};

// --- Data Record Management ---
export const updateDataRecord = async (recordId: string, updatedData: Partial<DataRecord>): Promise<DataRecord> => {
    console.log(`Atualizando registro ${recordId} com dados:`, updatedData);

    // Prepara os dados para atualização, removendo campos que não devem ser atualizados
    const updatePayload: { [key: string]: any } = {
        DATA: updatedData.DATA,
        CLIENTE: updatedData.CLIENTE,
        VALOR: updatedData.VALOR,
        status: updatedData.status,
        orcamento: updatedData.orcamento,
    };

    const { data, error } = await supabase
        .from('processed_data')
        .update(updatePayload)
        .eq('id', recordId)
        .select()
        .single();

    if (error) {
        console.error('Erro ao atualizar registro:', error);
        throw error;
    }

    console.log('Registro atualizado com sucesso:', data);
    return data;
};

export const deleteDataRecord = async (recordId: string): Promise<void> => {
    console.log(`Deletando registro ${recordId}`);

    const { error } = await supabase
        .from('processed_data')
        .delete()
        .eq('id', recordId);

    if (error) {
        console.error('Erro ao deletar registro:', error);
        throw error;
    }

    console.log(`Registro ${recordId} deletado com sucesso`);
};

// --- Monthly Chart Data ---
export interface MonthlyChartData {
    month: string;
    monthName: string;
    totalRevenue: number;
    totalServices: number;
    uniqueClients: number;
    averageTicket: number;
    totalRepasse: number;
}

export const fetchMonthlyChartData = async (unitCode: string, year: number): Promise<MonthlyChartData[]> => {
    console.log(`[CHART] Buscando dados mensais para unidade ${unitCode} do ano ${year}`);
    
    // Primeiro, vamos verificar se há dados para esta unidade
    const { data: checkData, error: checkError } = await supabase
        .from('processed_data')
        .select('*')
        .eq('unidade_code', unitCode)
        .limit(3);
    
    if (!checkError && checkData) {
        console.log(`[CHART] Verificação inicial - ${checkData.length} registros encontrados`);
        console.log(`[CHART] Exemplo de estrutura dos dados:`, checkData[0]);
        if (checkData[0]) {
            console.log(`[CHART] Colunas disponíveis:`, Object.keys(checkData[0]));
        }
    } else {
        console.error(`[CHART] Erro na verificação inicial:`, checkError);
    }

    const months = [
        { value: '01', name: 'Jan' },
        { value: '02', name: 'Fev' },
        { value: '03', name: 'Mar' },
        { value: '04', name: 'Abr' },
        { value: '05', name: 'Mai' },
        { value: '06', name: 'Jun' },
        { value: '07', name: 'Jul' },
        { value: '08', name: 'Ago' },
        { value: '09', name: 'Set' },
        { value: '10', name: 'Out' },
        { value: '11', name: 'Nov' },
        { value: '12', name: 'Dez' }
    ];

    const monthlyData: MonthlyChartData[] = [];

    for (const month of months) {
        try {
            // Calcula as datas de início e fim do mês
            const startDate = `${year}-${month.value}-01`;
            const nextMonth = month.value === '12' ? '01' : String(parseInt(month.value) + 1).padStart(2, '0');
            const nextYear = month.value === '12' ? year + 1 : year;
            const endDate = `${nextYear}-${nextMonth}-01`;

            console.log(`[CHART] Buscando ${month.name}/${year}: ${startDate} até ${endDate}`);

            // *** NOVA LÓGICA: Busca dados do mês específico incluindo campos de divisão ***
            const { data, error } = await supabase
                .from('processed_data')
                .select('VALOR, CLIENTE, DATA, IS_DIVISAO, REPASSE, PROFISSIONAL, orcamento')
                .eq('unidade_code', unitCode)
                .gte('DATA', startDate)
                .lt('DATA', endDate);

            if (error) {
                console.error(`[CHART] Erro ao buscar dados para ${month.name}/${year}:`, error);
                // Continua com dados zerados para este mês
                monthlyData.push({
                    month: month.value,
                    monthName: month.name,
                    totalRevenue: 0,
                    totalServices: 0,
                    uniqueClients: 0,
                    averageTicket: 0,
                    totalRepasse: 0
                });
                continue;
            }

            console.log(`[CHART] ${month.name}/${year}: Encontrados ${data?.length || 0} registros`);
            
            // *** NOVA LÓGICA: Filtra apenas registros originais para métricas principais ***
            const allRecords = data || [];
            const originalRecords = allRecords.filter(record => record.IS_DIVISAO !== 'SIM');
            console.log(`[CHART] ${month.name}/${year}: ${originalRecords.length} originais de ${allRecords.length} totais`);

            // *** CORREÇÃO APRIMORADA: Agrupa por orçamento único e pega apenas UM registro por orçamento ***
            const orcamentoGroups = new Map<string, any[]>();
            
            // Agrupa todos os registros por orçamento
            originalRecords.forEach(record => {
                // Agora a chave é diretamente o orcamento (registros originais não possuem sufixo)
                const orcamentoKey = record.orcamento || 'unknown';
                if (!orcamentoGroups.has(orcamentoKey)) {
                    orcamentoGroups.set(orcamentoKey, []);
                }
                orcamentoGroups.get(orcamentoKey)!.push(record);
            });
            
            console.log(`[CHART] ${month.name}/${year}: ${orcamentoGroups.size} orçamentos únicos`);
            
            // Para cada orçamento, pega apenas o primeiro registro (evita duplicação)
            const uniqueRecords: any[] = [];
            const revenueByOrcamento = new Map<string, number>();
            
            orcamentoGroups.forEach((records, orcamentoKey) => {
                const firstRecord = records[0]; // Pega apenas o primeiro registro do grupo
                uniqueRecords.push(firstRecord);
                revenueByOrcamento.set(orcamentoKey, firstRecord.VALOR || 0);
                
                if (records.length > 1) {
                    console.log(`[CHART] ⚠️ Orçamento ${orcamentoKey}: ${records.length} registros, usando apenas o primeiro`);
                }
            });

            // Calcula métricas para o mês usando registros únicos por orçamento
            const totalRevenue = Array.from(revenueByOrcamento.values()).reduce((sum, valor) => sum + valor, 0);
            const totalServices = orcamentoGroups.size; // Conta orçamentos únicos
            const uniqueClients = new Set(uniqueRecords.map(record => record.CLIENTE)).size;
            const averageTicket = totalServices > 0 ? totalRevenue / totalServices : 0;
            
            // *** REPASSE: Soma TODOS os registros (originais + divididos) ***
            const totalRepasse = allRecords.reduce((sum, record) => sum + (record.REPASSE || 0), 0);

            monthlyData.push({
                month: month.value,
                monthName: month.name,
                totalRevenue,
                totalServices,
                uniqueClients,
                averageTicket,
                totalRepasse
            });

            console.log(`[CHART] Dados de ${month.name}/${year}: ${totalServices} serviços, R$ ${totalRevenue}`);
        } catch (error) {
            console.error(`Erro ao processar dados de ${month.name}/${year}:`, error);
            // Adiciona dados zerados em caso de erro
            monthlyData.push({
                month: month.value,
                monthName: month.name,
                totalRevenue: 0,
                totalServices: 0,
                uniqueClients: 0,
                averageTicket: 0,
                totalRepasse: 0
            });
        }
    }

    console.log(`[CHART] Dados mensais processados para ${year}:`, monthlyData);
    console.log(`[CHART] Total de meses processados: ${monthlyData.length}`);
    return monthlyData;
};


export const fetchServiceAnalysisData = async (
  unitCode: string,
  period: string
): Promise<ServiceAnalysisRecord[]> => {
  if (!period.match(/^\d{4}-\d{2}$/)) {
    return [];
  }
  const [year, month] = period.split('-').map(Number);
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = new Date(Date.UTC(year, month, 0)).toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('processed_data')
    .select('CADASTRO, DATA, DIA, ATENDIMENTO_ID')
    .eq('unidade_code', unitCode)
    .gte('DATA', startDate)
    .lte('DATA', endDate);

  if (error) {
    console.error("Error fetching service analysis data:", error);
    throw error;
  }

  return data as ServiceAnalysisRecord[];
};

export const fetchClientAnalysisData = async (
  unitCode: string,
  period: string
): Promise<ClientAnalysisData> => {
  if (!period.match(/^\d{4}-\d{2}$/)) {
    throw new Error("Invalid period format. Expected YYYY-MM.");
  }
  const [year, month] = period.split('-').map(Number);
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = new Date(Date.UTC(year, month, 0)).toISOString().split('T')[0];

  const [currentPeriodDetailsRes, previousClientsRes] = await Promise.all([
    supabase
      .from('processed_data')
      .select('CLIENTE, TIPO')
      .eq('unidade_code', unitCode)
      .gte('DATA', startDate)
      .lte('DATA', endDate),
    supabase
      .from('processed_data')
      .select('CLIENTE')
      .eq('unidade_code', unitCode)
      .lt('DATA', startDate)
  ]);

  if (currentPeriodDetailsRes.error) throw currentPeriodDetailsRes.error;
  if (previousClientsRes.error) throw previousClientsRes.error;

  const clientDetails = (currentPeriodDetailsRes.data as { CLIENTE: string; TIPO: string }[] || []);
  
  const currentMonthClients = new Set(clientDetails.map(r => r.CLIENTE).filter(Boolean));
// FIX: Type 'Set<unknown>' is not assignable to type 'Set<string>'.
// Supabase query can return null or other types for `CLIENTE`. Using a type guard filter
// ensures the array is of type string[] before creating the Set.
const allPreviousClients = new Set(
    (previousClientsRes.data?.map(r => r.CLIENTE) || []).filter((c): c is string => typeof c === 'string' && c.trim() !== '')
  );
  
  return { currentMonthClients, allPreviousClients, clientDetails };
};

export const fetchRepasseAnalysisData = async (
  unitCode: string,
  period: string
): Promise<RepasseAnalysisRecord[]> => {
  if (!period.match(/^\d{4}-\d{2}$/)) {
    return [];
  }
  const [year, month] = period.split('-').map(Number);
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const endDate = new Date(year, month, 0).toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('processed_data')
    .select('PROFISSIONAL, REPASSE')
    .eq('unidade_code', unitCode)
    .gte('DATA', startDate)
    .lte('DATA', endDate);

  if (error) {
    console.error("Error fetching repasse analysis data:", error);
    throw error;
  }

  // Filter out records with no professional name to ensure data integrity for ranking
  return (data as RepasseAnalysisRecord[]).filter(r => r.PROFISSIONAL && r.PROFISSIONAL.trim() !== '');
};

// --- Clients Module ---
// Nova versão: deriva lista de clientes diretamente de processed_data (sem tabela clientes)
// Regras:
// - Um registro por CLIENTE.
// - Tipo: prioriza último TIPO observado (pela DATA mais recente) dentro de todo histórico.
// - endereços/whatsapp indisponíveis (retorna null) pois eram campos da tabela removida.
export const fetchClients = async ({ unitCode, search, period }: { unitCode: string; search?: string; period: string }): Promise<any[]> => {
    if (!unitCode) return [];
    if (!period.match(/^[0-9]{4}-[0-9]{2}$/)) return [];
    const [year, month] = period.split('-').map(Number);
    const startDate = `${year}-${String(month).padStart(2,'0')}-01`;
    const endDate = new Date(Date.UTC(year, month, 0)).toISOString().split('T')[0];
    const currentFirst = new Date(Date.UTC(year, month - 1, 1));
    const prevFirst = new Date(currentFirst.getTime());
    prevFirst.setUTCMonth(prevFirst.getUTCMonth() - 1);
    const prevYear = prevFirst.getUTCFullYear();
    const prevMonth = prevFirst.getUTCMonth() + 1;
    const prevStart = `${prevYear}-${String(prevMonth).padStart(2,'0')}-01`;
    const prevEnd = new Date(Date.UTC(prevYear, prevMonth, 0)).toISOString().split('T')[0];
        // Mês -2
        const prev2First = new Date(prevFirst.getTime());
        prev2First.setUTCMonth(prev2First.getUTCMonth() - 1);
        const prev2Year = prev2First.getUTCFullYear();
        const prev2Month = prev2First.getUTCMonth() + 1;
        const prev2Start = `${prev2Year}-${String(prev2Month).padStart(2,'0')}-01`;
        const prev2End = new Date(Date.UTC(prev2Year, prev2Month, 0)).toISOString().split('T')[0];

    // Duas consultas separadas (paridade com dashboard)
        const [currentRes, prevRes, prev2Res] = await Promise.all([
        supabase.from('processed_data')
            .select('CLIENTE, TIPO, DATA')
            .eq('unidade_code', unitCode)
            .gte('DATA', startDate)
            .lte('DATA', endDate),
        supabase.from('processed_data')
            .select('CLIENTE, TIPO, DATA')
            .eq('unidade_code', unitCode)
            .gte('DATA', prevStart)
                .lte('DATA', prevEnd),
            supabase.from('processed_data')
                .select('CLIENTE, TIPO, DATA')
                .eq('unidade_code', unitCode)
                .gte('DATA', prev2Start)
                .lte('DATA', prev2End)
    ]);
    if (currentRes.error) { console.error('[fetchClients] current error', currentRes.error.message); return []; }
    if (prevRes.error) { console.error('[fetchClients] prev error', prevRes.error.message); return []; }
        if (prev2Res.error) { console.error('[fetchClients] prev2 error', prev2Res.error.message); return []; }

    interface Row { CLIENTE: string; TIPO?: string | null; DATA: string; }
        const currentRows = (currentRes.data as Row[] || []).filter(r => r.CLIENTE && r.CLIENTE.trim());
        const prevRows = (prevRes.data as Row[] || []).filter(r => r.CLIENTE && r.CLIENTE.trim());
        const prev2Rows = (prev2Res.data as Row[] || []).filter(r => r.CLIENTE && r.CLIENTE.trim());

    const latestCurrent = new Map<string, Row>();
    for (const r of currentRows) {
        const raw = r.CLIENTE;
        const existing = latestCurrent.get(raw);
        if (!existing || existing.DATA < r.DATA) latestCurrent.set(raw, r);
    }
    const currentSet = new Set(currentRows.map(r => r.CLIENTE));
        const prevSet = new Set(prevRows.map(r => r.CLIENTE));
        const prev2Set = new Set(prev2Rows.map(r => r.CLIENTE));

    // Lista principal: somente clientes do mês atual
    let list = Array.from(latestCurrent.values()).map(r => {
        const raw = r.CLIENTE;
        const inPrev = prevSet.has(raw);
        const categoria = inPrev ? 'recorrente' : 'outro';
        return {
            id: raw,
            nome: raw.trim() || raw,
            tipo: r.TIPO || null,
            lastAttendance: r.DATA,
            categoria
        };
    });

    if (search && search.trim()) {
        const s = search.trim().toLowerCase();
        list = list.filter(c => c.nome.toLowerCase().includes(s));
    }
    list.sort((a,b) => a.nome.localeCompare(b.nome));

    // Construir lista de atenção (clientes que estavam no mês anterior e não retornaram) com último atendimento e tipo
      const latestPrev = new Map<string, Row>();
    for (const r of prevRows) {
        const existing = latestPrev.get(r.CLIENTE);
        if (!existing || existing.DATA < r.DATA) latestPrev.set(r.CLIENTE, r);
    }
      // Map de contagens por mês
      const buildCountMap = (rows: Row[]) => {
          const m = new Map<string, number>();
          for (const r of rows) {
              const k = r.CLIENTE;
              m.set(k, (m.get(k) || 0) + 1);
          }
          return m;
      };
      const currentCountMap = buildCountMap(currentRows);
      const prevCountMap = buildCountMap(prevRows);
      const prev2CountMap = buildCountMap(prev2Rows);

      const currentPeriodKey = `${year}-${String(month).padStart(2,'0')}`;
      const prevPeriodKey = `${prevYear}-${String(prevMonth).padStart(2,'0')}`;
      const prev2PeriodKey = `${prev2Year}-${String(prev2Month).padStart(2,'0')}`;

      const atencaoObjects = Array.from(prevSet)
        .filter(c => !currentSet.has(c))
        .map(c => {
            const row = latestPrev.get(c);
              const monthlyCounts: Record<string, number> = {
                  [prev2PeriodKey]: prev2CountMap.get(c) || 0,
                  [prevPeriodKey]: prevCountMap.get(c) || 0,
                  [currentPeriodKey]: currentCountMap.get(c) || 0,
              };
            return {
                id: c,
                nome: c.trim() || c,
                tipo: row?.TIPO || null,
                lastAttendance: row?.DATA || null,
                  categoria: 'atencao',
                  monthlyCounts
            };
        })
        .sort((a,b) => a.nome.localeCompare(b.nome));
    (list as any)._atencaoSource = atencaoObjects;
    return list;
};

export const fetchClientMetrics = async (unitCode: string, period: string): Promise<{
    total: number; comercial: number; residencial: number; recorrente: number; atencao: number; inativos: number;
} | null> => {
    if (!unitCode || !period) return null;
    const { data, error } = await supabase
        .rpc('get_client_metrics', { p_unidade_code: unitCode, p_period: period });
    if (error) {
        console.error('[fetchClientMetrics] erro:', error.message);
        return null;
    }
    // Supabase RPC pode retornar: array com 1 registro, array vazio ou objeto simples (dependendo de versão / definição)
    if (!data) return { total:0, comercial:0, residencial:0, recorrente:0, atencao:0, inativos:0 };
    const normalized = Array.isArray(data) ? data[0] : data;
    if (!normalized) return { total:0, comercial:0, residencial:0, recorrente:0, atencao:0, inativos:0 };
    return {
        total: normalized.total ?? 0,
        comercial: normalized.comercial ?? 0,
        residencial: normalized.residencial ?? 0,
        recorrente: normalized.recorrente ?? 0,
        atencao: normalized.atencao ?? 0,
        inativos: normalized.inativos ?? 0
    };
};

// Versão que calcula métricas diretamente da processed_data (sem depender de RPC)
// Regras assumidas (ajustar se necessário):
// - total: número de clientes únicos com pelo menos 1 atendimento histórico (até fim do período)
// - comercial: clientes únicos com TIPO = 'COMERCIAL' em qualquer atendimento histórico até fim do período
// - residencial: clientes únicos com TIPO = 'RESIDENCIAL'
// - recorrente: clientes que tiveram > 1 atendimento no período selecionado (ou presença também em períodos anteriores) -> aqui adotamos >1 atendimento no período
// - atencao: clientes ativos no período anterior (>=1 atendimento antes do início do período) que não têm atendimento no período atual (potencial churn) -> 'Atenção'
// - inativos: clientes sem atendimento há 90 dias a partir do fim do período (último atendimento < (endDate - 90 dias))
// NOVA VERSÃO (escopo reduzido para o mês corrente):
//  - total: clientes únicos com atendimento no mês atual
//  - recorrente: cliente que esteve no mês anterior e também no mês atual
//  - atencao: cliente que esteve no mês anterior e não esteve no mês atual
//  - outros: clientes do mês atual que NÃO são recorrentes (ou seja, não estavam no mês anterior)
export const fetchClientMetricsFromProcessed = async (unitCode: string, period: string): Promise<{
    total: number; recorrente: number; atencao: number; outros: number; churnRatePercent: string;
}> => {
    if (!unitCode || !period.match(/^[0-9]{4}-[0-9]{2}$/)) {
        return { total:0, recorrente:0, atencao:0, outros:0, churnRatePercent:'0.0%' };
    }
    const [year, month] = period.split('-').map(Number);
    const startDate = `${year}-${String(month).padStart(2,'0')}-01`;
    const endDate = new Date(Date.UTC(year, month, 0)).toISOString().split('T')[0];
    // Mês anterior correto
    // Determina início e fim do mês anterior de forma direta
    const currentFirst = new Date(Date.UTC(year, month - 1, 1));
    const prevFirst = new Date(currentFirst.getTime());
    prevFirst.setUTCMonth(prevFirst.getUTCMonth() - 1);
    const prevYear = prevFirst.getUTCFullYear();
    const prevMonthNum = prevFirst.getUTCMonth() + 1;
    const prevStart = `${prevYear}-${String(prevMonthNum).padStart(2,'0')}-01`;
    const prevEnd = new Date(Date.UTC(prevYear, prevMonthNum, 0)).toISOString().split('T')[0];

    // Realiza duas consultas separadas – replica exatamente a abordagem conceitual do dashboard
    const [currentRes, prevRes] = await Promise.all([
        supabase
            .from('processed_data')
            .select('CLIENTE')
            .eq('unidade_code', unitCode)
            .gte('DATA', startDate)
            .lte('DATA', endDate),
        supabase
            .from('processed_data')
            .select('CLIENTE')
            .eq('unidade_code', unitCode)
            .gte('DATA', prevStart)
            .lte('DATA', prevEnd)
    ]);
    if (currentRes.error) {
        console.error('[fetchClientMetricsFromProcessed] current error', currentRes.error.message);
        return { total:0, recorrente:0, atencao:0, outros:0, churnRatePercent:'0.0%' };
    }
    if (prevRes.error) {
        console.error('[fetchClientMetricsFromProcessed] prev error', prevRes.error.message);
        return { total:0, recorrente:0, atencao:0, outros:0, churnRatePercent:'0.0%' };
    }
    const currentMonthClients = new Set(
        (currentRes.data || [])
            .map(r => r.CLIENTE)
            .filter((c): c is string => typeof c === 'string' && c.trim() !== '')
    );
    const prevMonthClients = new Set(
        (prevRes.data || [])
            .map(r => r.CLIENTE)
            .filter((c): c is string => typeof c === 'string' && c.trim() !== '')
    );

    const total = currentMonthClients.size;
    // recorrente = interseção direta
    let recorrente = 0;
    currentMonthClients.forEach(c => { if (prevMonthClients.has(c)) recorrente++; });
    // atencao = clientes que estavam no mês anterior e sumiram neste
    let atencao = 0;
    prevMonthClients.forEach(c => { if (!currentMonthClients.has(c)) atencao++; });
    // outros = clientes do mês atual que não são recorrentes
    const outros = total - recorrente;

    const churnRatePercent = prevMonthClients.size > 0 ? ((atencao / prevMonthClients.size) * 100).toFixed(1) + '%' : '0.0%';
    return { total, recorrente, atencao, outros, churnRatePercent };
};


// *** FUNÇÃO AUXILIAR: Processa valores de repasse corretamente ***
const processRepasseValues = (repasseOriginal: any, profissionaisCount: number): number[] => {
    console.log(`   💰 Processando repasse: "${repasseOriginal}" (${typeof repasseOriginal}) para ${profissionaisCount} profissionais`);
    
    let repasseValues: number[] = [];
    
    if (typeof repasseOriginal === 'string' && repasseOriginal.includes(' ')) {
        // Caso: "90.00 90.00" - valores individuais para cada profissional
        repasseValues = repasseOriginal.split(' ')
            .map(val => val.trim())
            .filter(val => val.length > 0)
            .map(val => parseFloat(val.replace(',', '.')) || 0);
        
        console.log(`   ✅ Valores individuais detectados: "${repasseOriginal}" → [${repasseValues.join(', ')}]`);
    } else {
        // Caso: valor único - dividir igualmente entre profissionais
        const valorNumerico = typeof repasseOriginal === 'number' ? repasseOriginal : parseFloat(String(repasseOriginal).replace(',', '.') || '0');
        const repasseDividido = profissionaisCount > 1 ? (valorNumerico / profissionaisCount) : valorNumerico;
        repasseValues = Array(profissionaisCount).fill(repasseDividido);
        
        console.log(`   ➗ Valor único dividido: R$ ${valorNumerico} ÷ ${profissionaisCount} = R$ ${repasseDividido.toFixed(2)} cada`);
    }
    
    // Ajusta array se necessário
    if (repasseValues.length !== profissionaisCount) {
        console.warn(`   ⚠️ Ajustando: ${repasseValues.length} valores para ${profissionaisCount} profissionais`);
        
        if (repasseValues.length === 1) {
            const valorUnico = repasseValues[0];
            repasseValues = Array(profissionaisCount).fill(valorUnico);
        } else if (repasseValues.length > profissionaisCount) {
            repasseValues = repasseValues.slice(0, profissionaisCount);
        } else {
            while (repasseValues.length < profissionaisCount) {
                repasseValues.push(0);
            }
        }
    }
    
    return repasseValues;
};