/**
 * upload.service.ts — Ingestão de XLSX e limpeza/sincronização
 * Mantém a mesma lógica e assinaturas que existiam no mockApi.
 */
import { supabase } from '../supabaseClient';
import { syncUnitClientsFromProcessed } from '../data/clientsDirectory.service';
import { DataRecord, UploadMetrics } from '../../types';

// Fix: Create a helper type to corretamente tipar dados brutos do XLSX onde REPASSE pode ser string.
// Removido 'orcamento' e 'NÚMERO' - agora usa apenas ATENDIMENTO_ID
export type RawDataRecordForUpload = Omit<DataRecord, 'REPASSE' | 'orcamento' | 'NÚMERO'> & { REPASSE: string | number };

// Função auxiliar: Processa valores de repasse corretamente
const processRepasseValues = (repasseOriginal: any, profissionaisCount: number): number[] => {
	let repasseValues: number[] = [];
	if (typeof repasseOriginal === 'string' && repasseOriginal.includes(' ')) {
		repasseValues = repasseOriginal
			.split(' ')
			.map((val) => val.trim())
			.filter((val) => val.length > 0)
			.map((val) => parseFloat(val.replace(',', '.')) || 0);
	} else {
		const valorNumerico =
			typeof repasseOriginal === 'number'
				? repasseOriginal
				: parseFloat(String(repasseOriginal).replace(',', '.') || '0');
		const repasseDividido = profissionaisCount > 1 ? valorNumerico / profissionaisCount : valorNumerico;
		repasseValues = Array(profissionaisCount).fill(repasseDividido);
	}
	if (repasseValues.length !== profissionaisCount) {
		if (repasseValues.length === 1) {
			const valorUnico = repasseValues[0];
			repasseValues = Array(profissionaisCount).fill(valorUnico);
		} else if (repasseValues.length > profissionaisCount) {
			repasseValues = repasseValues.slice(0, profissionaisCount);
		} else {
			while (repasseValues.length < profissionaisCount) repasseValues.push(0);
		}
	}
	return repasseValues;
};

// Expansão multi-profissional e normalização
// ATENDIMENTO_ID agora recebe sufixos (_1, _2...) para registros derivados
const processMultipleProfessionalsRecords = (records: RawDataRecordForUpload[]): DataRecord[] => {
	const finalRecords: DataRecord[] = [];
	records.forEach((record) => {
		const originalAtendimentoId = String(record.ATENDIMENTO_ID || '').trim();
		// Preserva null quando PROFISSIONAL é null (não converte para string vazia)
		const professionalValue = record.PROFISSIONAL;
		const professionalString = professionalValue === null ? '' : String(professionalValue).trim();
		if (professionalString.includes(';')) {
			const professionals = professionalString
				.split(';')
				.map((p) => p.trim())
				.filter(Boolean);
			const repasses = processRepasseValues(record.REPASSE, professionals.length);
			if (professionals.length > 0) {
				professionals.forEach((professional, index) => {
					const isFirst = index === 0;
					finalRecords.push({
						...record,
						PROFISSIONAL: professional,
						REPASSE: repasses[index] || 0,
						VALOR: isFirst ? record.VALOR : 0,
						// ATENDIMENTO_ID com sufixo para derivados (ex: 12345_1, 12345_2)
						ATENDIMENTO_ID: isFirst ? originalAtendimentoId : `${originalAtendimentoId}_${index}`,
						IS_DIVISAO: isFirst ? 'NAO' : 'SIM',
					});
				});
			} else {
				finalRecords.push({
					...record,
					PROFISSIONAL: professionalString || null, // Mantém null se vazio
					REPASSE: parseFloat(String(record.REPASSE).replace(',', '.')) || 0,
					ATENDIMENTO_ID: originalAtendimentoId,
					IS_DIVISAO: 'NAO',
				});
			}
		} else {
			finalRecords.push({
				...record,
				PROFISSIONAL: professionalString || null, // Mantém null se vazio
				REPASSE: parseFloat(String(record.REPASSE).replace(',', '.')) || 0,
				ATENDIMENTO_ID: originalAtendimentoId,
				IS_DIVISAO: 'NAO',
			});
		}
	});
	return finalRecords;
};

// Aplica lógica de STATUS "esperar" para atendimentos do período "Tarde"
// quando a mesma profissional tem múltiplos atendimentos no mesmo dia
const applyWaitStatusForAfternoonShifts = (records: DataRecord[]): DataRecord[] => {
	// Agrupar registros por (PROFISSIONAL + DATA)
	const groupedByProfessionalDate = new Map<string, DataRecord[]>();
	
	records.forEach((record) => {
		if (!record.PROFISSIONAL || !record.DATA) return;
		
		const key = `${record.PROFISSIONAL}|${record.DATA}`;
		if (!groupedByProfessionalDate.has(key)) {
			groupedByProfessionalDate.set(key, []);
		}
		groupedByProfessionalDate.get(key)!.push(record);
	});
	
	// Aplicar regra: Se profissional tem múltiplos atendimentos no dia,
	// marcar atendimentos do período "Tarde" com STATUS = "esperar"
	groupedByProfessionalDate.forEach((recordsGroup) => {
		if (recordsGroup.length > 1) {
			// Profissional tem múltiplos atendimentos no mesmo dia
			recordsGroup.forEach((record) => {
				// Verificar se MOMENTO contém "Tarde"
				const momento = String(record.MOMENTO || '').toLowerCase();
				if (momento.includes('tarde')) {
					record.STATUS = 'esperar';
				}
			});
		}
	});
	
	return records;
};

// Remove registros obsoletos usando 'ATENDIMENTO_ID' base como chave lógica
// Agora extrai a base do ATENDIMENTO_ID (remove sufixos _1, _2 dos derivados)
const removeObsoleteRecords = async (
	unitCode: string,
	startDate: string,
	endDate: string,
	baseAtendimentosInFile: Set<string>
): Promise<number> => {
	const { data: existingRecords, error: fetchError } = await supabase
		.from('processed_data')
		.select('ATENDIMENTO_ID, IS_DIVISAO')
		.eq('unidade_code', unitCode)
		.gte('DATA', startDate)
		.lte('DATA', endDate);
	if (fetchError) return 0;
	if (!existingRecords || existingRecords.length === 0) return 0;

	// Extrai o ID base do ATENDIMENTO_ID (remove sufixos _1, _2, _3...)
	const baseFromAtendimento = (atendId: any): string => {
		const str = String(atendId || '').trim();
		const match = str.match(/^(.+)_\d+$/);
		return match ? match[1] : str;
	};

	const existingBaseAtendimentos = new Set<string>();
	const recordsWithBase: { ATENDIMENTO_ID: string; base: string }[] = [];
	(existingRecords || []).forEach((r: any) => {
		const base = baseFromAtendimento(r.ATENDIMENTO_ID);
		recordsWithBase.push({ ATENDIMENTO_ID: r.ATENDIMENTO_ID, base });
		if (r.IS_DIVISAO !== 'SIM') existingBaseAtendimentos.add(base);
	});

	const basesToRemove = Array.from(existingBaseAtendimentos).filter((b) => !baseAtendimentosInFile.has(b));
	if (basesToRemove.length === 0) return 0;

	const atendimentosParaRemoverSet = new Set<string>();
	recordsWithBase.forEach((r) => {
		if (basesToRemove.includes(r.base)) atendimentosParaRemoverSet.add(r.ATENDIMENTO_ID);
	});
	const atendimentosParaRemover = Array.from(atendimentosParaRemoverSet).filter(Boolean);
	if (atendimentosParaRemover.length === 0) return 0;

	const { error: deleteError, count } = await supabase
		.from('processed_data')
		.delete({ count: 'exact' })
		.eq('unidade_code', unitCode)
		.in('ATENDIMENTO_ID', atendimentosParaRemover);
	if (deleteError) return 0;
	return count || 0;
};

// API pública: Upload de XLSX com sincronização
export const uploadXlsxData = async (
	unitCode: string,
	records: RawDataRecordForUpload[]
): Promise<UploadMetrics> => {
	if (records.length === 0) {
		return { total: 0, inserted: 0, updated: 0, ignored: 0, deleted: 0 };
	}

	// Processar multi-profissionais e aplicar sufixos
	let processedRecords = processMultipleProfessionalsRecords(records);
	
	// Aplicar lógica de STATUS "esperar" para atendimentos da Tarde
	// quando a mesma profissional tem múltiplos atendimentos no dia
	processedRecords = applyWaitStatusForAfternoonShifts(processedRecords);

	let deletedCount = 0;
	let minDate: Date | null = null;
	let maxDate: Date | null = null;
	processedRecords.forEach((record) => {
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
		const baseAtendimentosInFile = new Set(
			processedRecords.filter((r) => r.IS_DIVISAO === 'NAO').map((r) => r.ATENDIMENTO_ID).filter(Boolean)
		);
		const startDate = minDate.toISOString().split('T')[0];
		const endDate = maxDate.toISOString().split('T')[0];
		deletedCount = await removeObsoleteRecords(unitCode, startDate, endDate, baseAtendimentosInFile);
	}

	const sanitizeRecord = (r: any) => {
		const { status, profissional, ...rest } = r;
		return rest;
	};

	const tryRpcUpload = async (): Promise<UploadMetrics> => {
		const aggregatedMetrics = { total: 0, inserted: 0, updated: 0, ignored: 0 };
		const uploadBatchSize = 500;
		for (let i = 0; i < processedRecords.length; i += uploadBatchSize) {
			const batch = processedRecords.slice(i, i + uploadBatchSize);
			const batchForRpc = batch.map((r) => ({
				...sanitizeRecord(r),
				profissional: (r as any).PROFISSIONAL ?? '',
			}));
			const { data, error } = await supabase.rpc('process_xlsx_upload', {
				unit_code_arg: unitCode,
				records_arg: batchForRpc,
			});
			if (error) {
				throw new Error(`Erro durante upload do lote: ${error.message}`);
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
		const existingMap = new Map<string, { id: string }>();
		if (minDate && maxDate) {
			const startDate = minDate.toISOString().split('T')[0];
			const endDate = maxDate.toISOString().split('T')[0];
			const { data: existing } = await supabase
				.from('processed_data')
				.select('id, ATENDIMENTO_ID')
				.eq('unidade_code', unitCode)
				.gte('DATA', startDate)
				.lte('DATA', endDate);
			(existing || []).forEach((r: any) => {
				if (r.ATENDIMENTO_ID) existingMap.set(r.ATENDIMENTO_ID, { id: r.id });
			});
		}
		const toInsert: any[] = [];
		const toUpdate: any[] = [];
		processedRecords.forEach((r) => {
			const clean = sanitizeRecord(r);
			if (clean.ATENDIMENTO_ID && existingMap.has(clean.ATENDIMENTO_ID)) toUpdate.push(clean);
			else toInsert.push(clean);
		});
		let inserted = 0,
			updated = 0,
			ignored = 0;
		const insertBatchSize = 500;
		for (let i = 0; i < toInsert.length; i += insertBatchSize) {
			const slice = toInsert
				.slice(i, i + insertBatchSize)
				.map((r) => ({ ...sanitizeRecord(r), unidade_code: unitCode }));
			const { error: insErr } = await supabase.from('processed_data').insert(slice);
			if (insErr) throw new Error(`Falha na inserção fallback: ${insErr.message}`);
			inserted += slice.length;
		}
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
			.eq('ATENDIMENTO_ID', r.ATENDIMENTO_ID);
			if (upErr) throw new Error(`Falha no update fallback: ${upErr.message}`);
			updated += 1;
		}
		const total = processedRecords.length;
		return { total, inserted, updated, ignored, deleted: deletedCount };
	};

	try {
			const result = await tryRpcUpload();
			// Sincroniza base de clientes a partir do processed_data para a unidade
			try { await syncUnitClientsFromProcessed(unitCode); } catch (e) { console.warn('[upload] syncUnitClients warning:', e); }
			return result;
	} catch (e: any) {
		const msg = String(e?.message || '').toLowerCase();
		if (msg.includes('column "profissional" does not exist')) {
					const res = await manualFallbackUpload();
					try { await syncUnitClientsFromProcessed(unitCode); } catch (e) { console.warn('[upload] syncUnitClients warning:', e); }
					return res;
		}
		throw e;
	}
};

export { processMultipleProfessionalsRecords, processRepasseValues, removeObsoleteRecords };
