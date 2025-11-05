import { supabase } from '../supabaseClient';
import { DataRecord } from '../../types';

export interface ClientHistoryRecord extends DataRecord {
    // Adiciona campos específicos se necessário
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
            .ilike('CLIENTE', `%${normalizedName}%`) // Busca parcial case-insensitive (mesmo padrão do ClientDetailModal)
            .order('DATA', { ascending: false })
            .order('HORARIO', { ascending: false })
            .limit(limit);

        // Filtro por período (mês/ano)
        if (period && /^\d{4}-\d{2}$/.test(period)) {
            const [year, month] = period.split('-').map(Number);
            const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
            const endDate = new Date(Date.UTC(year, month, 0)).toISOString().split('T')[0];
            console.log('[ClientHistory] Filtrando por período:', { startDate, endDate });
            query = query.gte('DATA', startDate).lte('DATA', endDate);
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

        console.log(`[ClientHistory] Histórico encontrado para "${normalizedName}":`, data?.length || 0, 'registros', data);
        
        // Buscar notas do pós-venda para cada registro
        if (data && data.length > 0) {
            const atendimentoIds = data
                .map(rec => rec.ATENDIMENTO_ID)
                .filter(id => id && !id.includes('_')); // Excluir derivados (_1, _2, etc)
            
            if (atendimentoIds.length > 0) {
                const { data: posVendasData } = await supabase
                    .from('pos_vendas')
                    .select('ATENDIMENTO_ID, nota')
                    .in('ATENDIMENTO_ID', atendimentoIds);
                
                console.log('[ClientHistory] Notas pós-venda encontradas:', posVendasData);
                
                // Criar um mapa de notas por ATENDIMENTO_ID
                const notasMap = new Map<string, string>();
                if (posVendasData) {
                    posVendasData.forEach((pv: any) => {
                        if (pv.ATENDIMENTO_ID && pv.nota) {
                            notasMap.set(pv.ATENDIMENTO_ID, pv.nota);
                        }
                    });
                }
                
                // Adicionar as notas aos registros
                return data.map(rec => ({
                    ...rec,
                    pos_vendas_nota: notasMap.get(rec.ATENDIMENTO_ID) || null
                }));
            }
        }
        
        return data || [];
    } catch (error) {
        console.error('[ClientHistory] Erro ao buscar histórico do cliente:', error);
        throw error;
    }
}
