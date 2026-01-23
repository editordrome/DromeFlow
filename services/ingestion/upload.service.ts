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

// Aplica lógica de STATUS baseada em ordem cronológica (HORARIO)
// Quando a mesma profissional tem 2+ atendimentos no mesmo dia:
// - Primeiro atendimento (por HORARIO) → STATUS = "PENDENTE"
// - Demais atendimentos → STATUS = "ESPERAR"
const applyWaitStatusByOrder = (records: DataRecord[]): DataRecord[] => {
	console.log('[applyWaitStatusByOrder] Processing', records.length, 'records');

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

	console.log('[applyWaitStatusByOrder] Grouped into', groupedByProfessionalDate.size, 'professional-date combinations');

	// Aplicar regra: Se profissional tem 2+ atendimentos no dia,
	// ordenar por HORARIO e marcar primeiro como PENDENTE, demais como ESPERAR
	let statusChangedCount = 0;
	groupedByProfessionalDate.forEach((recordsGroup, key) => {
		if (recordsGroup.length > 1) {
			// Profissional tem múltiplos atendimentos no mesmo dia
			// Ordenar por HORARIO (crescente) - normaliza para comparação
			recordsGroup.sort((a, b) => {
				const horarioA = String(a.HORARIO || '00:00').trim();
				const horarioB = String(b.HORARIO || '00:00').trim();
				return horarioA.localeCompare(horarioB);
			});

			console.log(`[applyWaitStatusByOrder] Processing ${recordsGroup.length} appointments for ${key}`);

			// Aplicar STATUS baseado na posição
			recordsGroup.forEach((record, index) => {
				if (index === 0) {
					// Primeiro atendimento do dia
					(record as any).STATUS = 'PENDENTE';
					console.log(`  → [${record.HORARIO}] ${record.ATENDIMENTO_ID}: PENDENTE (1º)`);
				} else {
					// Demais atendimentos
					(record as any).STATUS = 'ESPERAR';
					statusChangedCount++;
					console.log(`  → [${record.HORARIO}] ${record.ATENDIMENTO_ID}: ESPERAR (${index + 1}º)`);
				}
			});
		}
	});

	console.log('[applyWaitStatusByOrder] Changed STATUS to "ESPERAR" for', statusChangedCount, 'records');
	return records;
};

// Remove registros obsoletos usando 'ATENDIMENTO_ID' base como chave lógica
// Extrai a base do ATENDIMENTO_ID (remove sufixos _1, _2 dos derivados)
// Remove TODOS os registros (original + derivados) quando o ID base não está mais no arquivo
const removeObsoleteRecords = async (
	unitCode: string,
	startDate: string,
	endDate: string,
	baseAtendimentosInFile: Set<string>
): Promise<number> => {
	console.log('[removeObsoleteRecords] Checking for obsolete records in range:', startDate, 'to', endDate);
	console.log('[removeObsoleteRecords] Base IDs in file:', baseAtendimentosInFile.size);

	const { data: existingRecords, error: fetchError } = await supabase
		.from('processed_data')
		.select('ATENDIMENTO_ID, IS_DIVISAO')
		.eq('unidade_code', unitCode)
		.gte('DATA', startDate)
		.lte('DATA', endDate);

	if (fetchError) {
		console.error('[removeObsoleteRecords] Error fetching existing records:', fetchError);
		return 0;
	}
	if (!existingRecords || existingRecords.length === 0) {
		console.log('[removeObsoleteRecords] No existing records found in date range');
		return 0;
	}

	console.log('[removeObsoleteRecords] Found', existingRecords.length, 'existing records in database');

	// Extrai o ID base do ATENDIMENTO_ID (remove sufixos _1, _2, _3...)
	const baseFromAtendimento = (atendId: any): string => {
		const str = String(atendId || '').trim();
		// Match pattern: anything followed by underscore and digits (e.g., "12345_1" -> "12345")
		const match = str.match(/^(.+)_(\d+)$/);
		return match ? match[1] : str;
	};

	// Build map of base IDs to all their ATENDIMENTO_IDs (original + derivados)
	const baseToAtendimentosMap = new Map<string, string[]>();

	existingRecords.forEach((r: any) => {
		const atendimentoId = String(r.ATENDIMENTO_ID || '').trim();
		if (!atendimentoId) return;

		const base = baseFromAtendimento(atendimentoId);

		if (!baseToAtendimentosMap.has(base)) {
			baseToAtendimentosMap.set(base, []);
		}
		baseToAtendimentosMap.get(base)!.push(atendimentoId);
	});

	console.log('[removeObsoleteRecords] Unique base IDs in database:', baseToAtendimentosMap.size);

	// Find base IDs that exist in DB but NOT in the uploaded file
	const basesToRemove: string[] = [];
	baseToAtendimentosMap.forEach((atendimentos, base) => {
		if (!baseAtendimentosInFile.has(base)) {
			basesToRemove.push(base);
		}
	});

	if (basesToRemove.length === 0) {
		console.log('[removeObsoleteRecords] No obsolete records to remove');
		return 0;
	}

	console.log('[removeObsoleteRecords] Found', basesToRemove.length, 'obsolete base IDs:', basesToRemove.slice(0, 5), '...');

	// Collect ALL ATENDIMENTO_IDs to remove (original + all derivados)
	const atendimentosToRemove: string[] = [];
	basesToRemove.forEach((base) => {
		const ids = baseToAtendimentosMap.get(base) || [];
		atendimentosToRemove.push(...ids);
	});

	console.log('[removeObsoleteRecords] Total records to delete (including derivados):', atendimentosToRemove.length);

	if (atendimentosToRemove.length === 0) return 0;

	// Delete all records (original + derivados) in one operation
	const { error: deleteError, count } = await supabase
		.from('processed_data')
		.delete({ count: 'exact' })
		.eq('unidade_code', unitCode)
		.in('ATENDIMENTO_ID', atendimentosToRemove);

	if (deleteError) {
		console.error('[removeObsoleteRecords] Error deleting records:', deleteError);
		return 0;
	}

	const deletedCount = count || 0;
	console.log('[removeObsoleteRecords] Successfully deleted', deletedCount, 'records');
	return deletedCount;
};

// API pública: Upload de XLSX com sincronização
export const uploadXlsxData = async (
	unitCode: string,
	records: RawDataRecordForUpload[]
): Promise<UploadMetrics> => {
	if (records.length === 0) {
		return { total: 0, inserted: 0, updated: 0, ignored: 0, deleted: 0 };
	}

	console.log('[uploadXlsxData] Starting upload for unit:', unitCode, 'with', records.length, 'raw records');

	// Processar multi-profissionais e aplicar sufixos
	let processedRecords = processMultipleProfessionalsRecords(records);
	console.log('[uploadXlsxData] After multi-professional expansion:', processedRecords.length, 'records');

	// Aplicar lógica de STATUS baseada em ordem cronológica (HORARIO)
	// Primeiro atendimento do dia → PENDENTE, demais → ESPERAR
	processedRecords = applyWaitStatusByOrder(processedRecords);

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
				// Prioriza STATUS (uppercase) definido pela lógica de esperar
				STATUS: (r as any).STATUS || 'PENDENTE'
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
