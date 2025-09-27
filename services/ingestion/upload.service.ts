/**
 * upload.service.ts — Ingestão de XLSX e limpeza/sincronização
 * Mantém a mesma lógica e assinaturas que existiam no mockApi.
 */
import { supabase } from '../supabaseClient';
import { DataRecord, UploadMetrics } from '../../types';

// Fix: Create a helper type to corretamente tipar dados brutos do XLSX onde REPASSE pode ser string.
export type RawDataRecordForUpload = Omit<DataRecord, 'REPASSE'> & { REPASSE: string | number };

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
const processMultipleProfessionalsRecords = (records: RawDataRecordForUpload[]): DataRecord[] => {
	const finalRecords: DataRecord[] = [];
	records.forEach((record) => {
		const originalOrcamento = String(record.orcamento || record.NÚMERO || '').trim();
		const professionalString = String(record.PROFISSIONAL || '').trim();
		if (professionalString.includes(';')) {
			const professionals = professionalString
				.split(';')
				.map((p) => p.trim())
				.filter(Boolean);
			const repasses = processRepasseValues(record.REPASSE, professionals.length);
			if (professionals.length > 0) {
				professionals.forEach((professional, index) => {
					const isFirst = index === 0;
					const newOrcamento = isFirst ? originalOrcamento : `${originalOrcamento}_${index}`;
					finalRecords.push({
						...record,
						PROFISSIONAL: professional,
						REPASSE: repasses[index] || 0,
						orcamento: newOrcamento,
						VALOR: isFirst ? record.VALOR : 0,
						ATENDIMENTO_ID: originalOrcamento,
						IS_DIVISAO: isFirst ? 'NAO' : 'SIM',
					});
				});
			} else {
				finalRecords.push({
					...record,
					orcamento: originalOrcamento,
					REPASSE: parseFloat(String(record.REPASSE).replace(',', '.')) || 0,
					ATENDIMENTO_ID: originalOrcamento,
					IS_DIVISAO: 'NAO',
				});
			}
		} else {
			finalRecords.push({
				...record,
				orcamento: originalOrcamento,
				REPASSE: parseFloat(String(record.REPASSE).replace(',', '.')) || 0,
				ATENDIMENTO_ID: originalOrcamento,
				IS_DIVISAO: 'NAO',
			});
		}
	});
	return finalRecords;
};

// Remove registros obsoletos usando 'orcamento' base como chave lógica
const removeObsoleteRecords = async (
	unitCode: string,
	startDate: string,
	endDate: string,
	baseBudgetsInFile: Set<string>
): Promise<number> => {
	const { data: existingRecords, error: fetchError } = await supabase
		.from('processed_data')
		.select('orcamento, IS_DIVISAO')
		.eq('unidade_code', unitCode)
		.gte('DATA', startDate)
		.lte('DATA', endDate);
	if (fetchError) return 0;
	if (!existingRecords || existingRecords.length === 0) return 0;

	const baseFromOrcamento = (orc: any, isDivisao: any): string => {
		if (isDivisao === 'SIM' && typeof orc === 'string') {
			const match = orc.match(/^(.*)_\d+$/);
			if (match) return match[1];
		}
		return String(orc || '').trim();
	};

	const existingBaseBudgets = new Set<string>();
	const recordsWithBase: { orcamento: string; base: string }[] = [];
	(existingRecords || []).forEach((r: any) => {
		const base = baseFromOrcamento(r.orcamento, r.IS_DIVISAO);
		recordsWithBase.push({ orcamento: r.orcamento, base });
		if (r.IS_DIVISAO !== 'SIM') existingBaseBudgets.add(base);
	});

	const basesToRemove = Array.from(existingBaseBudgets).filter((b) => !baseBudgetsInFile.has(b));
	if (basesToRemove.length === 0) return 0;

	const orcamentosParaRemoverSet = new Set<string>();
	recordsWithBase.forEach((r) => {
		if (basesToRemove.includes(r.base)) orcamentosParaRemoverSet.add(r.orcamento);
	});
	const orcamentosParaRemover = Array.from(orcamentosParaRemoverSet).filter(Boolean);
	if (orcamentosParaRemover.length === 0) return 0;

	const { error: deleteError, count } = await supabase
		.from('processed_data')
		.delete({ count: 'exact' })
		.eq('unidade_code', unitCode)
		.in('orcamento', orcamentosParaRemover);
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

	const processedRecords = processMultipleProfessionalsRecords(records);

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
		const baseBudgetsInFile = new Set(
			processedRecords.filter((r) => r.IS_DIVISAO === 'NAO').map((r) => r.orcamento).filter(Boolean)
		);
		const startDate = minDate.toISOString().split('T')[0];
		const endDate = maxDate.toISOString().split('T')[0];
		deletedCount = await removeObsoleteRecords(unitCode, startDate, endDate, baseBudgetsInFile);
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
				.select('id, orcamento')
				.eq('unidade_code', unitCode)
				.gte('DATA', startDate)
				.lte('DATA', endDate);
			(existing || []).forEach((r: any) => {
				if (r.orcamento) existingMap.set(r.orcamento, { id: r.id });
			});
		}
		const toInsert: any[] = [];
		const toUpdate: any[] = [];
		processedRecords.forEach((r) => {
			const clean = sanitizeRecord(r);
			if (clean.orcamento && existingMap.has(clean.orcamento)) toUpdate.push(clean);
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
				.eq('orcamento', r.orcamento);
			if (upErr) throw new Error(`Falha no update fallback: ${upErr.message}`);
			updated += 1;
		}
		const total = processedRecords.length;
		return { total, inserted, updated, ignored, deleted: deletedCount };
	};

	try {
		return await tryRpcUpload();
	} catch (e: any) {
		const msg = String(e?.message || '').toLowerCase();
		if (msg.includes('column "profissional" does not exist')) {
			return await manualFallbackUpload();
		}
		throw e;
	}
};

export { processMultipleProfessionalsRecords, processRepasseValues, removeObsoleteRecords };
