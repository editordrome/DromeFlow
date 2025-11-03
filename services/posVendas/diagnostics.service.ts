import { supabase } from '../supabaseClient';

/**
 * Funções de diagnóstico para comparar dados entre pos_vendas e processed_data
 */

export const diagnosticCompareTables = async (unitId?: string) => {
  console.log('[DIAGNOSTIC] Iniciando comparação entre tabelas...');
  
  try {
    // 1. Contar total de registros em pos_vendas
    let posVendasQuery = supabase
      .from('pos_vendas')
      .select('*', { count: 'exact', head: false });
    
    if (unitId && unitId !== 'ALL') {
      posVendasQuery = posVendasQuery.eq('unit_id', unitId);
    }
    
    const { data: posVendasData, count: posVendasCount, error: posVendasError } = await posVendasQuery;
    
    if (posVendasError) {
      console.error('[DIAGNOSTIC] Erro ao buscar pos_vendas:', posVendasError);
    } else {
      console.log('[DIAGNOSTIC] pos_vendas:', {
        total: posVendasCount,
        registros_retornados: posVendasData?.length,
        status_distribution: posVendasData?.reduce((acc: any, r: any) => {
          acc[r.status || 'null'] = (acc[r.status || 'null'] || 0) + 1;
          return acc;
        }, {})
      });
    }
    
    // 2. Contar registros em processed_data
    let processedDataQuery = supabase
      .from('processed_data')
      .select('*', { count: 'exact', head: false });
    
    if (unitId && unitId !== 'ALL') {
      // Buscar unit_code da unidade
      const { data: unitData } = await supabase
        .from('units')
        .select('unit_code')
        .eq('id', unitId)
        .single();
      
      if (unitData?.unit_code) {
        processedDataQuery = processedDataQuery.eq('unidade_code', unitData.unit_code);
      }
    }
    
    const { data: processedData, count: processedCount, error: processedError } = await processedDataQuery;
    
    if (processedError) {
      console.error('[DIAGNOSTIC] Erro ao buscar processed_data:', processedError);
    } else {
      console.log('[DIAGNOSTIC] processed_data:', {
        total: processedCount,
        registros_retornados: processedData?.length,
        pos_vendas_column_distribution: processedData?.reduce((acc: any, r: any) => {
          const status = r['pos vendas'] || 'null';
          acc[status] = (acc[status] || 0) + 1;
          return acc;
        }, {})
      });
    }
    
    // 3. Comparar ATENDIMENTO_IDs únicos
    if (posVendasData && processedData) {
      const posVendasIds = new Set(posVendasData.map(r => r.ATENDIMENTO_ID).filter(Boolean));
      const processedDataIds = new Set(processedData.map(r => r.ATENDIMENTO_ID).filter(Boolean));
      
      const onlyInPosVendas = [...posVendasIds].filter(id => !processedDataIds.has(id));
      const onlyInProcessedData = [...processedDataIds].filter(id => !posVendasIds.has(id));
      
      console.log('[DIAGNOSTIC] Comparação de IDs:', {
        total_pos_vendas: posVendasIds.size,
        total_processed_data: processedDataIds.size,
        somente_em_pos_vendas: onlyInPosVendas.length,
        somente_em_processed_data: onlyInProcessedData.length,
        exemplos_pos_vendas: onlyInPosVendas.slice(0, 5),
        exemplos_processed_data: onlyInProcessedData.slice(0, 5)
      });
    }
    
    return {
      posVendas: { count: posVendasCount, data: posVendasData },
      processedData: { count: processedCount, data: processedData }
    };
    
  } catch (error) {
    console.error('[DIAGNOSTIC] Erro geral:', error);
    throw error;
  }
};

/**
 * Verifica se há registros órfãos (em pos_vendas mas não em processed_data)
 */
export const findOrphanRecords = async (unitId?: string) => {
  console.log('[DIAGNOSTIC] Buscando registros órfãos...');
  
  try {
    // Buscar todos ATENDIMENTO_IDs de pos_vendas
    let posVendasQuery = supabase
      .from('pos_vendas')
      .select('ATENDIMENTO_ID, nome, data, status');
    
    if (unitId && unitId !== 'ALL') {
      posVendasQuery = posVendasQuery.eq('unit_id', unitId);
    }
    
    const { data: posVendasRecords } = await posVendasQuery;
    
    if (!posVendasRecords) return [];
    
    const orphans = [];
    
    // Para cada registro, verificar se existe em processed_data
    for (const record of posVendasRecords.slice(0, 100)) { // Limitar a 100 para não sobrecarregar
      if (!record.ATENDIMENTO_ID) continue;
      
      const { data: processedRecord } = await supabase
        .from('processed_data')
        .select('ATENDIMENTO_ID, CLIENTE, DATA')
        .eq('ATENDIMENTO_ID', record.ATENDIMENTO_ID)
        .single();
      
      if (!processedRecord) {
        orphans.push(record);
      }
    }
    
    console.log('[DIAGNOSTIC] Registros órfãos encontrados:', orphans.length);
    if (orphans.length > 0) {
      console.log('[DIAGNOSTIC] Exemplos de órfãos:', orphans.slice(0, 5));
    }
    
    return orphans;
    
  } catch (error) {
    console.error('[DIAGNOSTIC] Erro ao buscar órfãos:', error);
    return [];
  }
};
