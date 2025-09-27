/** Utilitários de data/períodos para filtros de métricas */

// Retorna o início do dia local (00:00:00) como ISO (UTC)
export function startOfTodayISO(): string {
	const now = new Date();
	const d = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
	return d.toISOString();
}

// Semana começando na segunda-feira
export function startOfWeekISO(): string {
	const now = new Date();
	const day = now.getDay(); // 0(dom) .. 6(sab)
	const diffToMonday = (day === 0 ? -6 : 1 - day); // seg=1
	const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diffToMonday, 0, 0, 0, 0);
	return monday.toISOString();
}

export function startOfMonthISO(): string {
	const now = new Date();
	const first = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
	return first.toISOString();
}

export type Period = 'today' | 'week' | 'month';
