export type ActiveTab = 'gestao' | 'configuracoes';
export type StatusPeriod = 'M' | 'T';
export type FilterType = 'TODOS' | 'CLIENTE' | 'LIVRE' | 'NÃO' | 'FALTOU' | 'CANCELOU';
export type StatusOption = 'LIVRE' | 'NÃO' | 'CANCELOU' | 'FALTOU' | 'RESERVA' | 'LIMPAR';

// Mapeamento fiel ao app externo (AgendaExternaPage)
export const PERIODOS_MANHA = ['8 horas', '6 horas', '4 horas manhã'];
export const PERIODOS_TARDE = ['8 horas', '6 horas', '4 horas tarde'];
export const PERIODOS_NAO = ['NÃO DISPONIVEL', 'NÃO DISPONÍVEL', 'NÃO', 'NAO'];

export const MOBILE_STATUS_OPTIONS = [
   '8 horas',
   '6 horas',
   '4 horas manhã',
   '4 horas tarde',
   'NÃO DISPONIVEL'
];

export const STATUS_LABELS: Record<StatusOption, { label: string; color: string; bgColor?: string }> = {
   LIVRE: { label: 'LIVRE', color: 'text-brand-cyan' },
   'NÃO': { label: 'NÃO', color: 'text-text-tertiary' },
   RESERVA: { label: 'RESERVA', color: 'text-black', bgColor: 'bg-yellow-400' },
   CANCELOU: { label: 'CANCELOU', color: 'text-rose-500' },
   FALTOU: { label: 'FALTOU', color: 'text-orange-500' },
   LIMPAR: { label: 'LIMPAR STATUS', color: 'text-text-tertiary' },
};

export const STATUS_OPTIONS: StatusOption[] = ['LIVRE', 'NÃO', 'RESERVA', 'CANCELOU', 'FALTOU', 'LIMPAR'];
