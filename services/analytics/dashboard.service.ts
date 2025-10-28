import { supabase } from '../supabaseClient';
import { DashboardMetrics } from '../../types';

export interface MonthlyChartData {
  month: string;
  monthName: string;
  totalRevenue: number;
  totalServices: number;
  uniqueClients: number;
  averageTicket: number;
  totalRepasse: number;
}

export const fetchDashboardMetrics = async (
  unitCode: string,
  period: string
): Promise<DashboardMetrics> => {
  const endOfMonthUtc = (year: number, month01to12: number) =>
    new Date(Date.UTC(year, month01to12, 0)).toISOString().split('T')[0];

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

  if (!startDate || !endDate) {
    const { data: allData, error: rpcError } = await supabase.rpc(
      'get_dashboard_metrics',
      { p_unit_code: unitCode }
    );
    if (rpcError) throw rpcError;
    return (
      (allData as DashboardMetrics) || {
        totalRevenue: 0,
        totalServices: 0,
        uniqueClients: 0,
        averageTicket: 0,
        totalRepasse: 0,
      }
    );
  }

  const { data: periodRecords, error: periodError } = await supabase
    .from('processed_data')
    .select('VALOR, CLIENTE, REPASSE, IS_DIVISAO, orcamento')
    .eq('unidade_code', unitCode)
    .gte('DATA', startDate)
    .lte('DATA', endDate);
  if (periodError) throw periodError;

  const allRecords = periodRecords || [];
  const originalRecords = allRecords.filter((r: any) => r.IS_DIVISAO !== 'SIM');

  const uniqueBudgets = new Set(
    originalRecords.map((r: any) => r.orcamento).filter(Boolean)
  );
  const totalServices = uniqueBudgets.size;
  const totalRevenue = originalRecords.reduce(
    (sum: number, r: any) => sum + (r.VALOR || 0),
    0
  );
  const uniqueClients = new Set(
    originalRecords.map((r: any) => r.CLIENTE).filter(Boolean)
  ).size;
  const averageTicket = totalServices > 0 ? totalRevenue / totalServices : 0;
  const totalRepasse = allRecords.reduce(
    (sum: number, r: any) => sum + (r.REPASSE || 0),
    0
  );

  return {
    totalRevenue,
    totalServices,
    uniqueClients,
    averageTicket,
    totalRepasse,
  };
};

export const fetchDashboardMetricsMulti = async (
  unitCodes: string[],
  period: string
): Promise<DashboardMetrics> => {
  if (unitCodes.length === 0)
    return {
      totalRevenue: 0,
      totalServices: 0,
      uniqueClients: 0,
      averageTicket: 0,
      totalRepasse: 0,
    };
  // Determina início/fim do período (mês ou ano)
  let startDate: string | null = null;
  let endDate: string | null = null;
  const endOfMonthUtc = (year: number, month01to12: number) =>
    new Date(Date.UTC(year, month01to12, 0)).toISOString().split('T')[0];
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
  let totalRevenue = 0;
  let totalServices = 0;
  let totalRepasse = 0;
  // Soma receitas/repasse por unidade usando a função de single-unit (respeita período)
  for (const code of unitCodes) {
    const m = await fetchDashboardMetrics(code, period);
    totalRevenue += m.totalRevenue;
    totalRepasse += m.totalRepasse;
  }
  // Para serviços únicos (orcamentos originais) e clientes únicos, calcula no conjunto combinado com filtro do período
  let query = supabase
    .from('processed_data')
    .select('CLIENTE, IS_DIVISAO, orcamento, unidade_code', { head: false })
    .in('unidade_code', unitCodes);
  if (startDate && endDate) {
    query = query.gte('DATA', startDate).lte('DATA', endDate);
  }
  const { data: multiRecords, error: multiErr } = await query;
  const allClients = new Set<string>();
  const allBudgets = new Set<string>();
  if (multiErr) {
    // Em caso de erro, mantém valores baseados na soma por unidade
    const averageTicket = totalServices > 0 ? totalRevenue / totalServices : 0;
    return { totalRevenue, totalServices, uniqueClients: 0, averageTicket, totalRepasse };
  }
  const combined = (multiRecords as any[]) || [];
  combined
    .filter((r) => r.IS_DIVISAO !== 'SIM')
    .forEach((r: any) => {
      if (r.orcamento) allBudgets.add(r.orcamento);
      if (r.CLIENTE) allClients.add(r.CLIENTE);
    });
  totalServices = allBudgets.size;
  const uniqueClients = allClients.size;
  const averageTicket = totalServices > 0 ? totalRevenue / totalServices : 0;
  return { totalRevenue, totalServices, uniqueClients, averageTicket, totalRepasse };
};

export const fetchMonthlyChartData = async (
  unitCode: string,
  year: number
): Promise<MonthlyChartData[]> => {
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
    { value: '12', name: 'Dez' },
  ];

  try {
    // 🚀 OTIMIZAÇÃO: Uma única query para todo o ano
    const startDate = `${year}-01-01`;
    const endDate = `${year + 1}-01-01`;

    const { data, error } = await supabase
      .from('processed_data')
      .select('VALOR, CLIENTE, DATA, IS_DIVISAO, REPASSE, orcamento')
      .eq('unidade_code', unitCode)
      .gte('DATA', startDate)
      .lt('DATA', endDate);

    if (error) {
      console.error('[fetchMonthlyChartData] Erro na query:', error);
      return months.map(month => ({
        month: month.value,
        monthName: month.name,
        totalRevenue: 0,
        totalServices: 0,
        uniqueClients: 0,
        averageTicket: 0,
        totalRepasse: 0,
      }));
    }

    const allRecords = (data as any[]) || [];

    // Agrupar registros por mês
    const recordsByMonth = new Map<string, any[]>();
    months.forEach(m => recordsByMonth.set(m.value, []));

    allRecords.forEach(record => {
      if (record.DATA) {
        const month = record.DATA.substring(5, 7); // Extrai 'MM' de 'YYYY-MM-DD'
        if (recordsByMonth.has(month)) {
          recordsByMonth.get(month)!.push(record);
        }
      }
    });

    // Processar cada mês
    const monthlyData: MonthlyChartData[] = months.map(month => {
      const monthRecords = recordsByMonth.get(month.value) || [];
      
      if (monthRecords.length === 0) {
        return {
          month: month.value,
          monthName: month.name,
          totalRevenue: 0,
          totalServices: 0,
          uniqueClients: 0,
          averageTicket: 0,
          totalRepasse: 0,
        };
      }

      // Filtrar apenas registros originais
      const originalRecords = monthRecords.filter(record => record.IS_DIVISAO !== 'SIM');

      // Agrupar por orçamento base
      const orcamentoGroups = new Map<string, any[]>();
      originalRecords.forEach(record => {
        const orcamentoKey = record.orcamento || 'unknown';
        if (!orcamentoGroups.has(orcamentoKey)) {
          orcamentoGroups.set(orcamentoKey, []);
        }
        orcamentoGroups.get(orcamentoKey)!.push(record);
      });

      // Calcular receita (apenas primeiro registro de cada orçamento)
      const revenueByOrcamento = new Map<string, number>();
      const clientsSet = new Set<string>();
      
      orcamentoGroups.forEach((records, orcamentoKey) => {
        const firstRecord = records[0];
        revenueByOrcamento.set(orcamentoKey, firstRecord.VALOR || 0);
        if (firstRecord.CLIENTE) {
          clientsSet.add(firstRecord.CLIENTE);
        }
      });

      const totalRevenue = Array.from(revenueByOrcamento.values()).reduce(
        (sum, valor) => sum + valor,
        0
      );
      const totalServices = orcamentoGroups.size;
      const uniqueClients = clientsSet.size;
      const averageTicket = totalServices > 0 ? totalRevenue / totalServices : 0;
      
      // Repasse soma TODOS os registros (originais + derivados)
      const totalRepasse = monthRecords.reduce(
        (sum, record) => sum + (record.REPASSE || 0),
        0
      );

      return {
        month: month.value,
        monthName: month.name,
        totalRevenue,
        totalServices,
        uniqueClients,
        averageTicket,
        totalRepasse,
      };
    });

    return monthlyData;
  } catch (err) {
    console.error('[fetchMonthlyChartData] Erro inesperado:', err);
    return months.map(month => ({
      month: month.value,
      monthName: month.name,
      totalRevenue: 0,
      totalServices: 0,
      uniqueClients: 0,
      averageTicket: 0,
      totalRepasse: 0,
    }));
  }
};
/**
 * dashboard.service.ts
 * Esqueleto de serviço para métricas do dashboard.
 */

// TODO: migrar funções: fetchDashboardMetrics, fetchDashboardMetricsMulti, fetchMonthlyChartData

export {};
