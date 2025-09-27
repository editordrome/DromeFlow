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
export { fetchAllUsers } from './index';

// Lista usuários vinculados a qualquer unidade que o admin possua (interseção via user_units)
export { fetchUsersForAdminUnits } from './index';

export { fetchUserAssignments } from './index';

export { createUser } from './index';

export { updateUser } from './index';


// updateUserAssignments agora está encapsulada no serviço de usuários


export { deleteUser } from './index';

// Lista usuários vinculados a uma unidade específica (via tabela de junção user_units)
export { fetchUsersForUnit } from './index';

// --- Units & Modules ---

// Fase 1b: implementações de Units migradas para services/units/units.service.ts

// Fase 1b: implementações de Modules migradas para services/modules/modules.service.ts


// --- Access Credentials ---
// Fase 1b: implementações de AccessCredentials migradas para services/access/accessCredentials.service.ts


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

// Fase 1b: implementação de Content migrada para services/content/content.service.ts

// --- Data Table & Dashboard ---
export { fetchDataTable } from './index';

// --- Appointments (Agendamentos) ---
export { fetchAppointments } from './index';


// Fix: Create a helper type to correctly type raw data from XLSX where REPASSE can be a string.
export type { RawDataRecordForUpload } from './index';

// *** FUNÇÃO ATUALIZADA: Processa atendimentos com múltiplas profissionais seguindo as novas regras ***
export { processMultipleProfessionalsRecords } from './index';

// *** FUNÇÃO ATUALIZADA: Remove registros obsoletos usando 'orcamento' como chave lógica de análise ***
// Estratégia:
// 1. Buscar todos os registros do período (orcamento, IS_DIVISAO) para a unidade.
// 2. Considerar como "base" apenas registros originais (IS_DIVISAO = 'NAO').
// 3. Calcular diferença entre orçamentos base existentes e orçamentos base presentes no arquivo.
// 4. Remover todos os registros (originais + divididos) cujo orcamento base não está mais no arquivo.
//    Para identificar derivados, usamos a convenção de sufixo _N (ex: ORC123_1) OU a flag IS_DIVISAO.
export { removeObsoleteRecords } from './index';

export { uploadXlsxData } from './index';

export { fetchDashboardMetrics } from './index';

// Agregação multi-unidade: soma das métricas de várias unidades reutilizando a função existente.
export { fetchDashboardMetricsMulti } from './index';

// --- Data Record Management ---
export { updateDataRecord, deleteDataRecord } from './index';

// --- Monthly Chart Data ---
export { fetchMonthlyChartData } from './index';


export { fetchServiceAnalysisData } from './index';

export { fetchClientAnalysisData } from './index';

export { fetchRepasseAnalysisData } from './index';

// --- Clients Module ---
// Nova versão: deriva lista de clientes diretamente de processed_data (sem tabela clientes)
// Regras:
// - Um registro por CLIENTE.
// - Tipo: prioriza último TIPO observado (pela DATA mais recente) dentro de todo histórico.
// - endereços/whatsapp indisponíveis (retorna null) pois eram campos da tabela removida.
export { fetchClients } from './index';

export { fetchClientMetrics } from './index';

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
export { fetchClientMetricsFromProcessed } from './index';
export type { MonthlyChartData } from './index';


// *** FUNÇÃO AUXILIAR: Processa valores de repasse corretamente ***
export { processRepasseValues } from './index';