import { useState, useCallback } from 'react';
import { supabase } from '../../../services/supabaseClient';
import { formatLocalISO } from '../helpers';

export const useAgendaMetrics = (selectedUnit: any) => {
   const [profMetricas, setProfMetricas] = useState<Record<string, any>>({});
   const [unitMetrics, setUnitMetrics] = useState<any>(null);

   const loadProfissionalMetrics = useCallback(async (profId: string, profNome: string) => {
      if (!selectedUnit?.unit_code) return;
      try {
         const now = new Date();
         const dataHoje = formatLocalISO(now);

         const sevenDaysAgo = new Date();
         sevenDaysAgo.setDate(now.getDate() - 7);
         const data7 = formatLocalISO(sevenDaysAgo);

         const thirtyDaysAgo = new Date();
         thirtyDaysAgo.setDate(now.getDate() - 30);
         const data30 = formatLocalISO(thirtyDaysAgo);

         // 1. Histórico de disponibilidades da profissional
         const { data: dispData, error: dispError } = await supabase
            .from('agenda_disponibilidade')
            .select('data, status_manha, status_tarde')
            .eq('profissional_id', profId);

         if (dispError) throw dispError;

         // 2. Histórico de atendimentos do profissional
         const { data: atdData, error: atdError } = await supabase
            .from('processed_data')
            .select('DATA, TIPO, "SERVIÇO"')
            .eq('unidade_code', selectedUnit.unit_code)
            .ilike('PROFISSIONAL', profNome)
            .lte('DATA', dataHoje);

         if (atdError) throw atdError;

         const calculatePeriodMetrics = (dData: any[], aData: any[], minDate?: string) => {
            const dispPeriod = minDate ? dData.filter(d => d.data >= minDate && d.data <= dataHoje) : dData.filter(d => d.data <= dataHoje);
            const atdPeriod = minDate ? aData.filter(a => {
               const atD = typeof a.DATA === 'string' && a.DATA.includes('T') ? a.DATA.split('T')[0] : a.DATA;
               return atD >= minDate && atD <= dataHoje;
            }) : aData.filter(a => {
               const atD = typeof a.DATA === 'string' && a.DATA.includes('T') ? a.DATA.split('T')[0] : a.DATA;
               return atD <= dataHoje;
            });

            // ÍNDICE DE CONFIANÇA
            let CountCancelou = 0, CountLivre = 0, CountFaltou = 0, CountNao = 0;

            dispPeriod.forEach(d => {
               if (d.status_manha === 'CANCELOU') CountCancelou++;
               if (d.status_tarde === 'CANCELOU') CountCancelou++;

               if (d.status_manha === 'LIVRE') CountLivre++;
               if (d.status_tarde === 'LIVRE') CountLivre++;

               if (d.status_manha === 'FALTOU') CountFaltou++;
               if (d.status_tarde === 'FALTOU') CountFaltou++;

               // A string pode ser não e isso causava duplicidade no código original, ajustado aqui.
               if (d.status_manha === 'NÃO') CountNao++;
               if (d.status_tarde === 'NÃO') CountNao++;
            });

            const CountCliente = atdPeriod.length;

            const totalConfianca = CountLivre + CountCliente + CountCancelou;
            const txConf = totalConfianca > 0 ? ((CountCancelou / totalConfianca) * 100).toFixed(0) : '0';

            // FALTAS
            const totalFaltasRef = CountCliente + CountFaltou;
            const txFalta = totalFaltasRef > 0 ? ((CountFaltou / totalFaltasRef) * 100).toFixed(0) : '0';

            // PERFIL
            let resCount = 0, comCount = 0;
            atdPeriod.forEach(a => {
               const isRes = a.TIPO?.toUpperCase().includes('RESIDENCIAL') || a['SERVIÇO']?.toUpperCase().includes('RESIDENCIAL');
               const isCom = a.TIPO?.toUpperCase().includes('COMERCIAL') || a['SERVIÇO']?.toUpperCase().includes('COMERCIAL');
               if (isRes) resCount++;
               if (isCom) comCount++;
            });

            let perfilDesc = 'Não definido';
            if (resCount > comCount) perfilDesc = 'Residencial';
            else if (comCount > resCount) perfilDesc = 'Comercial';
            else if (resCount > 0 && resCount === comCount) perfilDesc = 'Misto';

            return {
               conf: { tx: txConf, canc: CountCancelou, liv: CountLivre, cli: CountCliente, nao: CountNao },
               falta: { tx: txFalta, qtd: CountFaltou },
               perf: { desc: perfilDesc, res: resCount, com: comCount }
            };
         };

         setProfMetricas(prev => ({
            ...prev,
            [profId]: {
               geral: calculatePeriodMetrics(dispData || [], atdData || []),
               d30: calculatePeriodMetrics(dispData || [], atdData || [], data30),
               d7: calculatePeriodMetrics(dispData || [], atdData || [], data7)
            }
         }));

      } catch (err) {
         console.error('Erro ao carregar métricas da profissional:', err);
      }
   }, [selectedUnit]);

   const loadUnitMetrics = useCallback(async () => {
      if (!selectedUnit?.unit_code) return;
      try {
         const now = new Date();
         const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
         const dataInicio = formatLocalISO(firstDayOfMonth);
         const dataFim = formatLocalISO(now);

         const { data, error } = await supabase
            .from('processed_data')
            .select('DATA, TIPO, SERVIÇO')
            .eq('unidade_code', selectedUnit.unit_code)
            .gte('DATA', dataInicio)
            .lte('DATA', dataFim);

         if (error) throw error;
         const rows = data as any[];
         if (rows) {
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(now.getDate() - 7);
            const dataSemana = formatLocalISO(sevenDaysAgo);
            const todayStr = formatLocalISO(now);

            setUnitMetrics({
               mes: rows.length,
               semana: rows.filter(a => a.DATA >= dataSemana).length,
               hoje: rows.filter(a => a.DATA === todayStr).length
            });
         }
      } catch (err) {
         console.error('Erro ao carregar métricas da unidade:', err);
      }
   }, [selectedUnit]);

   return {
      profMetricas,
      unitMetrics,
      loadProfissionalMetrics,
      loadUnitMetrics
   };
};
