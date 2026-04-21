import { useCallback } from 'react';
import { updateDataRecord } from '../../../services/data/dataTable.service';
import { syncProfissionalAvailability } from '../../../services/agenda/agenda.service';
import { checkPeriodCompatibility, formatLocalISO, matchName } from '../helpers';
import { supabase } from '../../../services/supabaseClient';

export const useAgendaDnd = (selectedUnit: any, agenda: any) => {
   const { selectedDate, atendimentosDia, setAtendimentosDia, refreshData } = agenda;

   const handleDragStartProfissional = (e: React.DragEvent, profissional: any) => {
      e.dataTransfer.setData('application/json', JSON.stringify({
         type: 'profissional',
         nome: profissional.profissional?.nome,
         periodos: profissional.periodos ?? []
      }));
   };

   const handleDragStartRemoveProfissional = (e: React.DragEvent, atendimento: any) => {
      e.dataTransfer.setData('application/json', JSON.stringify({
         type: 'remove_profissional',
         atendimentoId: atendimento.id || atendimento.ATENDIMENTO_ID
      }));
   };

   const handleDragOver = (e: React.DragEvent) => {
      e.preventDefault();
   };

   const handleDropOnAtendimento = useCallback(async (e: React.DragEvent, atendimento: any) => {
      e.preventDefault();
      try {
         const dataStr = e.dataTransfer.getData('application/json');
         if (!dataStr) return;
         const data = JSON.parse(dataStr);

         if (data.type === 'profissional' && data.nome) {
            const recordId = atendimento.id || atendimento.ATENDIMENTO_ID;
            if (!recordId) return;

            const periodoAtendimento = parseFloat(atendimento['PERÍODO'] || '0');
            const periodosProf: string[] = data.periodos ?? [];

            if (periodosProf.length > 0 && periodoAtendimento > 0) {
               const { compativel, motivo } = checkPeriodCompatibility(periodoAtendimento, periodosProf);
               if (!compativel) {
                  alert(`⚠️ Período incompatível\n\n${motivo}`);
                  return;
               }
            }

            await updateDataRecord(recordId.toString(), { PROFISSIONAL: data.nome });

            setAtendimentosDia((prev: any[]) => prev.map(a =>
               (a.id === atendimento.id || a.ATENDIMENTO_ID === atendimento.ATENDIMENTO_ID)
                  ? { ...a, PROFISSIONAL: data.nome }
                  : a
            ));

            const { data: profData } = await supabase
               .from('profissionais')
               .select('id, nome')
               .eq('unit_id', selectedUnit.id)
               .ilike('nome', data.nome)
               .maybeSingle();

            if (profData) {
               await syncProfissionalAvailability(
                  selectedUnit.id,
                  profData.id,
                  data.nome,
                  formatLocalISO(selectedDate)
               );
               await refreshData();
            }
         }
      } catch (err) {
         console.error('Erro no Drop:', err);
      }
   }, [selectedUnit, selectedDate, setAtendimentosDia, refreshData]);

   const handleDropToProfissionais = useCallback(async (e: React.DragEvent) => {
      e.preventDefault();
      try {
         const dataStr = e.dataTransfer.getData('application/json');
         if (!dataStr) return;
         const data = JSON.parse(dataStr);

         if (data.type === 'remove_profissional' && data.atendimentoId) {
            await updateDataRecord(data.atendimentoId.toString(), { PROFISSIONAL: null });

            setAtendimentosDia((prev: any[]) => prev.map(a =>
               (a.id === data.atendimentoId || a.ATENDIMENTO_ID === data.atendimentoId)
                  ? { ...a, PROFISSIONAL: null }
                  : a
            ));

            const atendimentoOriginal = atendimentosDia.find((a: any) => (a.id === data.atendimentoId || a.ATENDIMENTO_ID === data.atendimentoId));
            if (atendimentoOriginal?.PROFISSIONAL) {
               const { data: profData } = await supabase
                  .from('profissionais')
                  .select('id, nome')
                  .eq('unit_id', selectedUnit.id)
                  .ilike('nome', atendimentoOriginal.PROFISSIONAL)
                  .maybeSingle();

               if (profData) {
                  await syncProfissionalAvailability(
                     selectedUnit.id,
                     profData.id,
                     atendimentoOriginal.PROFISSIONAL,
                     formatLocalISO(selectedDate)
                  );
                  await refreshData();
               }
            }
         }
      } catch (err) {
         console.error('Erro no Drop para remover:', err);
      }
   }, [selectedUnit, selectedDate, atendimentosDia, setAtendimentosDia, refreshData]);

   return {
      handleDragStartProfissional,
      handleDragStartRemoveProfissional,
      handleDragOver,
      handleDropOnAtendimento,
      handleDropToProfissionais
   };
};
