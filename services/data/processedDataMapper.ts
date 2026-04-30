import { DataRecord } from '../../types';

/**
 * Mapeamento bidirecional simplificado.
 * Como o banco e a UI agora utilizam snake_case, este mapper serve apenas como
 * uma camada de segurança e pass-through.
 */
export const toSnakeCasePayload = (frontendData: Partial<DataRecord>): Record<string, any> => {
  // Como as propriedades já estão em snake_case no frontendData (interface DataRecord),
  // apenas retornamos o que não for undefined.
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

  // Pass-through direto, já que o banco agora é a fonte da verdade em snake_case
  return {
    ...dbRecord
  } as unknown as DataRecord;
};
