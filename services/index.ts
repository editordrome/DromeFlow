/**
 * index.ts — Barrel temporário de serviços.
 * Objetivo: reexportar serviços segmentados para manter compatibilidade durante a migração.
 */

// Fase 1: reexports de baixo risco
export * from './units/units.service';
export * from './modules/modules.service';
export * from './access/accessCredentials.service';
export * from './content/content.service';

// Próximas fases (manter comentado até migrar)
export * from './auth/users.service';
export * from './data/dataTable.service';
export * from './analytics/dashboard.service';
export * from './analytics/clients.service';
export * from './analytics/repasse.service';
export * from './analytics/serviceAnalysis.service';
// export * from './analytics/dashboard.service';
// export * from './analytics/clients.service';
// export * from './analytics/repasse.service';
// export * from './analytics/serviceAnalysis.service';
export * from './ingestion/upload.service';
export * from './profissionais/profissionais.service';
export * from './analytics/prestadoras.service';
