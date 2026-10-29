import { useState, useCallback, useEffect } from 'react';
import { supabase } from '../../../services/supabaseClient';
import {
   getProfissionaisLivres,
   getDisponibilidades
} from '../../../services/agenda/agenda.service';
import { fetchAppointmentsRange } from '../../../services/data/dataTable.service';
import { getUnitServices } from '../../../services/units/unitServices.service';
import { formatLocalISO } from '../helpers';
import { UnitService } from '../../../types';

export const useAgendaData = (
   selectedUnit: any,
   selectedDate: Date,
   activeTab: 'gestao' | 'configuracoes'
) => {
   const [loading, setLoading] = useState(false);
   const [error, setError] = useState<string | null>(null);

   // Configurações
   const [configSettings, setConfigSettings] = useState<any>(null);
   const [unitServicesList, setUnitServicesList] = useState<UnitService[]>([]);

   // Dados Brutos
   const [todasProfissionais, setTodasProfissionais] = useState<any[]>([]);
   const [todasDisponibilidades, setTodasDisponibilidades] = useState<any[]>([]);
   const [profissionaisLivres, setProfissionaisLivres] = useState<any[]>([]);
   const [atendimentosSemana, setAtendimentosSemana] = useState<any[]>([]);
   const [atendimentosDia, setAtendimentosDia] = useState<any[]>([]);
   const [dispSemanaCount, setDispSemanaCount] = useState<number>(0);

   const loadSettings = useCallback(async () => {
      if (!selectedUnit?.id) return;
      try {
         const { data: settings, error: settingsError } = await supabase
            .from('agenda_settings')
            .select('*')
            .eq('unit_id', selectedUnit.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

         if (settingsError) throw settingsError;

         if (settings) {
            setConfigSettings(settings);
         } else {
            setConfigSettings({ dias_liberados: [], periodos_cadastrados: [], is_link_active: false });
         }
      } catch (err) {
         // Silencioso se não houver config, usa o padrão
      }
   }, [selectedUnit]);

   const loadUnitServices = useCallback(async () => {
      if (!selectedUnit?.id) return;
      try {
         const services = await getUnitServices(selectedUnit.id);
         setUnitServicesList(services);
      } catch (err) {
         console.error('Erro ao buscar unit services', err);
      }
   }, [selectedUnit]);

   const loadProfissionaisConfig = useCallback(async () => {
      if (!selectedUnit?.id) return;
      try {
         const { data: profsData, error: profsError } = await supabase
            .from('profissionais')
            .select('id, nome, whatsapp, habilidade, status')
            .eq('unit_id', selectedUnit.id)
            .or('status.ilike.ativo,status.ilike.ativa,status.is.null')
            .order('nome');

         if (profsError) throw profsError;

         const { data: dispData, error: dispError } = await supabase
            .from('agenda_disponibilidade')
            .select('*')
            .eq('unit_id', selectedUnit.id);

         if (dispError) throw dispError;

         setTodasProfissionais(profsData || []);
         setTodasDisponibilidades(dispData || []);
      } catch (err) {
         console.error('Erro ao buscar metadados de profissionais das configs', err);
      }
   }, [selectedUnit]);

   const loadGestaoData = useCallback(async () => {
      if (!selectedUnit?.id) return;
      setLoading(true);
      setError(null);
      
      try {
         const dataFormatada = formatLocalISO(selectedDate);
         const startOfWeekDate = new Date(selectedDate);
         startOfWeekDate.setDate(selectedDate.getDate() - selectedDate.getDay());
         const endOfWeekDate = new Date(selectedDate);
         endOfWeekDate.setDate(selectedDate.getDate() - selectedDate.getDay() + 6);

         const startISO = formatLocalISO(startOfWeekDate);
         const endISO = formatLocalISO(endOfWeekDate);

         const [livres, weekApts, weekDisps] = await Promise.all([
            getProfissionaisLivres(selectedUnit.id, dataFormatada),
            fetchAppointmentsRange(selectedUnit.unit_code, startISO, endISO),
            getDisponibilidades(selectedUnit.id, startISO, endISO)
         ]);

         setProfissionaisLivres(livres || []);
         setAtendimentosSemana(weekApts || []);
         
         // No Contexto do AgendaPage original, loadGestaoData definia TODAS as disponibilidades via weekDisps, 
         // o que difere ligeiramente do loadProfissionaisConfig, 
         // mas vamos manter para Gestao local.
         setTodasDisponibilidades(weekDisps || []);

         const aptsDia = (weekApts || []).filter(a => {
            const aDate = typeof a.DATA === 'string' && a.DATA.includes('T') ? a.DATA.split('T')[0] : a.DATA;
            return aDate === dataFormatada;
         });
         setAtendimentosDia(aptsDia);

         const contagemSemana = (weekDisps || []).filter((d: any) =>
            d.status_manha === 'LIVRE' || d.status_tarde === 'LIVRE'
         ).length;
         setDispSemanaCount(contagemSemana);

      } catch (err: any) {
         console.error('Erro ao carregar dados da agenda (gestão)', err);
         setError(err.message || 'Erro ao carregar dados');
      } finally {
         setLoading(false);
      }
   }, [selectedUnit, selectedDate]);

   // Carregamento Inicial Controlado (substitui logic effects do AgendaPage)
   useEffect(() => {
      if (selectedUnit?.id && selectedUnit.id !== 'ALL') {
         if (activeTab === 'configuracoes') {
            loadSettings();
            loadUnitServices();
            loadProfissionaisConfig();
         } else {
            loadProfissionaisConfig();
            loadGestaoData();
         }
      }
   }, [selectedUnit, activeTab, selectedDate, loadSettings, loadUnitServices, loadProfissionaisConfig, loadGestaoData]);

   // Realtime listener
   useEffect(() => {
      if (selectedUnit?.id && selectedUnit.id !== 'ALL') {
         const channel = supabase
            .channel('schema-db-changes')
            .on(
               'postgres_changes',
               { event: '*', schema: 'public', table: 'agenda_disponibilidade', filter: `unit_id=eq.${selectedUnit.id}` },
               () => {
                  if (activeTab === 'configuracoes') {
                     loadSettings();
                     loadProfissionaisConfig();
                  } else {
                     loadGestaoData();
                     loadProfissionaisConfig();
                  }
               }
            )
            .subscribe();

         return () => {
            supabase.removeChannel(channel);
         };
      }
   }, [selectedUnit, activeTab, loadSettings, loadProfissionaisConfig, loadGestaoData]);

   return {
      loading,
      error,
      configSettings,
      setConfigSettings,
      unitServicesList,
      todasProfissionais,
      todasDisponibilidades,
      profissionaisLivres,
      atendimentosSemana,
      atendimentosDia,
      dispSemanaCount,
      reloadGestaoData: loadGestaoData,
      reloadProfissionaisConfig: loadProfissionaisConfig
   };
};
