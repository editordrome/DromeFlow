import { supabase } from '../supabaseClient';
import { DataRecord } from '../../types';
import { toFrontendRecord } from './processedDataMapper';

export interface ClientHistoryRecord extends DataRecord {
    pos_vendas_nota?: string | number | null;
}

/**
 * Busca o histórico de atendimentos de um cliente específico
 * @param clientName Nome do cliente (campo CLIENTE)
 * @param unitCode Código da unidade para filtrar
 * @param currentRecordId ID do registro atual para excluir da lista
 * @param limit Limite de registros a retornar (padrão: 200)
 * @param period Período no formato YYYY-MM (opcional)
 * @returns Lista de atendimentos ordenados por data (mais recente primeiro)
 */
export async function fetchClientHistory(
    clientName: string,
    unitCode: string,
    currentRecordId?: number,
    limit: number = 200,
    period?: string
): Promise<ClientHistoryRecord[]> {
    try {
        if (!clientName || !clientName.trim() || !unitCode) {
            console.warn('[ClientHistory] Nome do cliente ou código da unidade vazio, retornando lista vazia');
            return [];
        }

        // Remove espaços extras
        const normalizedName = clientName.trim();
        
        console.log('[ClientHistory] Buscando histórico:', {
            cliente: normalizedName,
            unitCode,
            period,
            currentRecordId
        });
        
        let query = supabase
            .from('processed_data')
            .select('*')
            .eq('unidade_code', unitCode)
            .ilike('cliente', `%${normalizedName}%`) // Busca parcial case-insensitive
            .order('data', { ascending: false })
            .order('horario', { ascending: false })
            .limit(limit);

        // Filtro por período (mês/ano)
        if (period && /^\d{4}-\d{2}$/.test(period)) {
            const [year, month] = period.split('-').map(Number);
            const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
            const endDate = new Date(Date.UTC(year, month, 0)).toISOString().split('T')[0];
            console.log('[ClientHistory] Filtrando por período:', { startDate, endDate });
            query = query.gte('data', startDate).lte('data', endDate);
        }

        // Excluir o registro atual
        if (currentRecordId) {
            query = query.neq('id', currentRecordId);
        }

        const { data, error } = await query;

        if (error) {
            console.error('[ClientHistory] Erro ao buscar histórico do cliente:', error);
            throw error;
        }

        console.log(`[ClientHistory] Histórico encontrado para "${normalizedName}":`, data?.length || 0, 'registros');
        
        // Buscar notas do pós-venda para cada registro
        if (data && data.length > 0) {
            const mappedData = data.map(toFrontendRecord);
            const atendimentoIds = mappedData
                .map(rec => rec.atendimento_id)
                .filter(id => id && !id.includes('_')); // Excluir derivados (_1, _2, etc)
            
            if (atendimentoIds.length > 0) {
                const { data: posVendasData } = await supabase
                    .from('pos_vendas')
                    .select('atendimento_id, nota')
                    .in('atendimento_id', atendimentoIds);
                
                console.log('[ClientHistory] Notas pós-venda encontradas:', posVendasData);
                
                // Criar um mapa de notas por atendimento_id
                const notasMap = new Map<string, any>();
                if (posVendasData) {
                    posVendasData.forEach((pv: any) => {
                        if (pv.atendimento_id && pv.nota) {
                            notasMap.set(pv.atendimento_id, pv.nota);
                        }
                    });
                }
                
                // Adicionar as notas aos registros
                return mappedData.map(rec => ({
                    ...rec,
                    pos_vendas_nota: rec.atendimento_id ? notasMap.get(rec.atendimento_id) : null
                }));
            }
            return mappedData;
        }
        
        return [];
    } catch (error) {
        console.error('[ClientHistory] Erro ao buscar histórico do cliente:', error);
        throw error;
    }
}

