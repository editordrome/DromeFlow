import { DataRecord } from '../../types';

/**
 * Mapeamento bidirecional.
 * O banco usa snake_case, mas a UI da Agenda espera UPPERCASE.
 * Este mapper converte os campos do banco para o formato esperado pela UI.
 */
export const toSnakeCasePayload = (frontendData: Partial<DataRecord>): Record<string, any> => {
  const payload: Record<string, any> = {};
  for (const [key, value] of Object.entries(frontendData)) {
    if (value !== undefined) {
      payload[key] = value;
    }
  }
  return payload;
};

export const toFrontendRecord = (dbRecord: Record<string, any>): DataRecord => {
  if (!dbRecord) return dbRecord as any;

  // Mapeia campos snake_case do banco para UPPERCASE esperado pela UI da Agenda
  const mapped: Record<string, any> = { ...dbRecord };

  // Campos principais usados pela UI da Agenda
  if (dbRecord.data !== undefined) mapped.DATA = dbRecord.data;
  if (dbRecord.horario !== undefined) mapped.HORARIO = dbRecord.horario;
  if (dbRecord.profissional !== undefined) mapped.PROFISSIONAL = dbRecord.profissional;
  if (dbRecord.cliente !== undefined) mapped.CLIENTE = dbRecord.cliente;
  if (dbRecord.servico !== undefined) mapped.SERVICO = dbRecord.servico;
  if (dbRecord.tipo !== undefined) mapped.TIPO = dbRecord.tipo;
  if (dbRecord.periodo !== undefined) mapped.PERIODO = dbRecord.periodo;
  if (dbRecord.valor !== undefined) mapped.VALOR = dbRecord.valor;
  if (dbRecord.status !== undefined) mapped.STATUS = dbRecord.status;
  if (dbRecord.unidade !== undefined) mapped.UNIDADE = dbRecord.unidade;
  if (dbRecord.unidade_code !== undefined) mapped.UNIDADE_CODE = dbRecord.unidade_code;
  if (dbRecord.atendimento_id !== undefined) mapped.ATENDIMENTO_ID = dbRecord.atendimento_id;
  if (dbRecord.origem !== undefined) mapped.ORIGEM = dbRecord.origem;
  if (dbRecord.observacao !== undefined) mapped.OBSERVACAO = dbRecord.observacao;
  if (dbRecord.reagendou !== undefined) mapped.REAGENDOU = dbRecord.reagendou;
  if (dbRecord.whatscliente !== undefined) mapped.WHATSCLIENTE = dbRecord.whatscliente;
  if (dbRecord.momento !== undefined) mapped.MOMENTO = dbRecord.momento;
  if (dbRecord.is_divisao !== undefined) mapped.IS_DIVISAO = dbRecord.is_divisao;
  if (dbRecord.cadastro !== undefined) mapped.CADASTRO = dbRecord.cadastro;
  if (dbRecord.acao !== undefined) mapped.ACAO = dbRecord.acao;
  if (dbRecord.confirmacao !== undefined) mapped.CONFIRMACAO = dbRecord.confirmacao;
  if (dbRecord.cupom !== undefined) mapped.CUPOM = dbRecord.cupom;
  if (dbRecord.repasse !== undefined) mapped.REPASSE = dbRecord.repasse;
  if (dbRecord.pagto !== undefined) mapped.PAGTO = dbRecord.pagto;

  return mapped as DataRecord;
};
