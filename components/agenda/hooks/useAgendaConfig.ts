import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../services/supabaseClient';
import { saveAgendaSettings } from '../../../services/agenda/agenda.service';

export const useAgendaConfig = (selectedUnit: any) => {
   const [configSettings, setConfigSettings] = useState<any>({
      dias_liberados: [],
      periodos_cadastrados: [],
      is_link_active: false
   });
   const [todasProfissionais, setTodasProfissionais] = useState<any[]>([]);
   const [todasDisponibilidades, setTodasDisponibilidades] = useState<any[]>([]);
   const [isSavingConfig, setIsSavingConfig] = useState(false);
   const [hasSynced, setHasSynced] = useState(false);

   // Métricas e Estados Visuais de Configuração
   const [profMetricas, setProfMetricas] = useState<Record<string, any>>({});
   const [profWithMetrics, setProfWithMetrics] = useState<string | null>(null);
   const [activeFilter, setActiveFilter] = useState('TODOS');
   const [profSearchTerm, setProfSearchTerm] = useState('');
   const [calendarViewDate, setCalendarViewDate] = useState(new Date());

   const loadConfigData = useCallback(async () => {
      if (!selectedUnit?.id || selectedUnit.id === 'ALL') return;
      try {
         // Tenta buscar os registros mais recentes para encontrar o último válido (com dias)
         const { data: settingsList } = await supabase
            .from('agenda_settings')
            .select('*')
            .eq('unit_id', selectedUnit.id)
            .order('created_at', { ascending: false })
            .limit(10);

         if (settingsList && settingsList.length > 0) {
            // O registro absoluto mais recente (mesmo que vazio) para manter as configurações de sistema
            const mostRecent = settingsList[0];
            
            // O registro mais recente que de fato POSSUI dias liberados
            const lastWithDays = settingsList.find(s => s.dias_liberados && s.dias_liberados.length > 0);

            if (lastWithDays) {
               // Priorizamos o registro com dias para o calendário, mas mantemos o ID do mais recente para UPSERTS se necessário
               // Na verdade, como o save cria novo, usamos o lastWithDays como referência de visualização
               setConfigSettings(lastWithDays);
            } else {
               setConfigSettings(mostRecent);
            }
         }

         // Profissionais para Config
         const { data: profsData } = await supabase
            .from('profissionais')
            .select('id, nome, whatsapp, habilidade, status')
            .eq('unit_id', selectedUnit.id)
            .or('status.ilike.ativo,status.ilike.ativa,status.is.null')
            .order('nome');

         // Disponibilidades para Config (Filtra pela versão atual para evitar fantasmas de versões antigas)
         let dispQuery = supabase
            .from('agenda_disponibilidade')
            .select('*')
            .eq('unit_id', selectedUnit.id);

         const { data: dispData } = await dispQuery;

         setTodasProfissionais(profsData || []);
         setTodasDisponibilidades(dispData || []);
         setHasSynced(true);
      } catch (err) {
         console.error('Erro ao buscar metadados de configuração', err);
      }
   }, [selectedUnit]);

   const handleStatusUpdate = async (profId: string, status: string, periodo: 'M' | 'T', dateStr: string) => {
      if (!selectedUnit?.id) return;
      try {
         const updateData: any = {
            unit_id: selectedUnit.id,
            profissional_id: profId,
            data: dateStr,
            settings_id: configSettings?.id 
         };

         // Detectamos se o profissional nesse dia é de jornada integral (8h ou 6h)
         const currentDisp = todasDisponibilidades.find(d => d.profissional_id === profId && d.data.includes(dateStr));
         const isFullDay = currentDisp?.periodos?.some((p: string) => p === '8 horas' || p === '6 horas');

         // Preservamos os períodos existentes por padrão, a menos que o status seja uma nova carga horária
         updateData.periodos = currentDisp?.periodos || [];

         if (status === 'LIMPAR') {
            // Limpeza profunda: Remove status e a própria jornada de trabalho
            updateData.status_manha = null;
            updateData.status_tarde = null;
            updateData.periodos = [];
            updateData.is_manual = false; // Permite ser reconfigurado do zero (volta para '—')
         } else if (status === '8 horas' || status === '6 horas' || (isFullDay && ['RESERVA', 'CANCELOU', 'FALTOU', 'LIVRE', 'NÃO'].includes(status))) {
            // Cargas horárias integrais OU status manuais em profissionais de dia inteiro ocupam ambos os períodos
            updateData.status_manha = status === 'LIVRE' ? 'LIVRE' : status;
            updateData.status_tarde = status === 'LIVRE' ? 'LIVRE' : status;
            
            // Se o status for a carga horária em si, atualizamos a coluna periodos
            if (status === '8 horas' || status === '6 horas') {
               updateData.periodos = [status];
            }
         } else if (status === '4 horas manhã') {
            updateData.status_manha = status;
            updateData.periodos = ['4 horas manhã'];
         } else if (status === '4 horas tarde') {
            updateData.status_tarde = status;
            updateData.periodos = ['4 horas tarde'];
         } else {
            updateData[periodo === 'M' ? 'status_manha' : 'status_tarde'] = status;
         }

         // Sempre que houver uma intervenção manual, limpamos o alerta de conflito visual (Atenção!) 
         // e marcamos como manual para evitar que o sync automático sobrescreva.
         updateData.conflito = false;
         updateData.is_manual = true;

         const { error } = await supabase
            .from('agenda_disponibilidade')
            .upsert(updateData, { onConflict: 'settings_id, profissional_id, data' });

         if (error) throw error;
         loadConfigData();
      } catch (err) {
         console.error('Erro ao atualizar status profissional na config:', err);
      }
   };

   const loadProfissionalMetrics = async (profId: string, profNome: string) => {
      try {
         const response = await fetch(`${window.location.origin}/api/metrics/professional?id=${profId}&nome=${encodeURIComponent(profNome)}&unit_id=${selectedUnit.id}`);
         if (!response.ok) throw new Error('Falha ao carregar métricas');
         const data = await response.json();
         setProfMetricas(prev => ({ ...prev, [profId]: data }));
      } catch (err) {
         console.error('Erro ao carregar métricas do profissional:', err);
      }
   };

   const handleSaveSettings = async (newSettings: any) => {
      if (!selectedUnit?.id) return;
      setIsSavingConfig(true);
      try {
         await saveAgendaSettings(selectedUnit.id, newSettings);
         setConfigSettings(newSettings);
      } catch (err) {
         console.error('Erro ao salvar as configurações da agenda', err);
         alert('Erro ao salvar as configurações.');
      } finally {
         setIsSavingConfig(false);
      }
   };

   useEffect(() => {
      loadConfigData();
   }, [loadConfigData]);

   // Realtime listener for availability changes in config
   useEffect(() => {
      if (!selectedUnit?.id || selectedUnit.id === 'ALL') return;
      const channel = supabase
         .channel('agenda_config_changes')
         .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'agenda_disponibilidade', filter: `unit_id=eq.${selectedUnit.id}` },
            () => loadConfigData()
         )
         .subscribe();
      return () => { supabase.removeChannel(channel); };
   }, [selectedUnit, loadConfigData]);

   return {
      configSettings, setConfigSettings,
      todasProfissionais,
      todasDisponibilidades,
      isSavingConfig,
      hasSynced,
      profMetricas,
      profWithMetrics, setProfWithMetrics,
      activeFilter, setActiveFilter,
      profSearchTerm, setProfSearchTerm,
      calendarViewDate, setCalendarViewDate,
      handleStatusUpdate,
      handleSaveSettings,
      refreshConfig: loadConfigData
   };
};
