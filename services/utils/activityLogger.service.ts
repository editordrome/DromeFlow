import { supabase } from '../supabaseClient';

interface LogActivityParams {
  unitCode: string | null;
  unitId?: string | null;
  actionCode: string;
  userIdentifier: string;
  status: 'success' | 'error';
  atendId?: string | null;
  moduleName?: string | null;
  metadata?: {
    user_role?: string;
    records_count?: number;
    error_message?: string;
    module_name?: string;
    [key: string]: any;
  };
}

/**
 * Serviço para registro de atividades dos usuários no sistema
 * Alimenta a tabela activity_logs para monitoramento em tempo real
 */
export const activityLogger = {
  /**
   * Registra uma atividade do usuário no sistema
   */
  async logActivity({
    unitCode,
    unitId = null,
    actionCode,
    userIdentifier,
    status,
    atendId = null,
    moduleName = null,
    metadata = {}
  }: LogActivityParams): Promise<void> {
    try {
      const { error } = await supabase
        .from('activity_logs')
        .insert({
          unit_code: unitCode,
          unit_id: unitId || null,
          workflow: null, // Não vem de N8N
          action_code: actionCode,
          atend_id: atendId,
          user_identifier: userIdentifier,
          status,
          horario: new Date().toISOString(),
          metadata: {
            ...metadata,
            ...(moduleName && { module_name: moduleName })
          }
        });

      if (error) {
        console.error('[ActivityLogger] Erro ao registrar atividade:', error);
      }
    } catch (err) {
      // Fail silently - logging não deve quebrar a aplicação
      console.error('[ActivityLogger] Exceção ao registrar atividade:', err);
    }
  },

  // Atalhos para ações comuns
  logLogin(userIdentifier: string, unitCode: string | null, userRole: string, moduleName?: string) {
    return this.logActivity({
      unitCode,
      actionCode: 'user_login',
      userIdentifier,
      status: 'success',
      moduleName,
      metadata: { user_role: userRole }
    });
  },

  logLogout(userIdentifier: string, unitCode: string | null, moduleName?: string) {
    return this.logActivity({
      unitCode,
      actionCode: 'user_logout',
      userIdentifier,
      status: 'success',
      moduleName
    });
  },

  logUpload(userIdentifier: string, unitCode: string, recordsCount: number, status: 'success' | 'error', errorMessage?: string, moduleName?: string) {
    return this.logActivity({
      unitCode,
      actionCode: 'upload_xlsx',
      userIdentifier,
      status,
      moduleName,
      metadata: { 
        records_count: recordsCount,
        ...(errorMessage && { error_message: errorMessage })
      }
    });
  },

  logAtendimentoCreate(userIdentifier: string, unitCode: string, atendId: string, status: 'success' | 'error', moduleName?: string) {
    return this.logActivity({
      unitCode,
      actionCode: 'create_atend',
      userIdentifier,
      status,
      atendId,
      moduleName
    });
  },

  logAtendimentoUpdate(userIdentifier: string, unitCode: string, atendId: string, status: 'success' | 'error', moduleName?: string) {
    return this.logActivity({
      unitCode,
      actionCode: 'update_atend',
      userIdentifier,
      status,
      atendId,
      moduleName
    });
  },

  logAtendimentoDelete(userIdentifier: string, unitCode: string, atendId: string, status: 'success' | 'error', moduleName?: string) {
    return this.logActivity({
      unitCode,
      actionCode: 'delete_atend',
      userIdentifier,
      status,
      atendId,
      moduleName
    });
  },

  logComercialCreate(userIdentifier: string, unitCode: string, status: 'success' | 'error', moduleName?: string) {
    return this.logActivity({
      unitCode,
      actionCode: 'create_comercial',
      userIdentifier,
      status,
      moduleName
    });
  },

  logComercialUpdate(userIdentifier: string, unitCode: string, status: 'success' | 'error', moduleName?: string) {
    return this.logActivity({
      unitCode,
      actionCode: 'update_comercial',
      userIdentifier,
      status,
      moduleName
    });
  },

  logPosVendasCreate(userIdentifier: string, unitCode: string, status: 'success' | 'error', moduleName?: string) {
    return this.logActivity({
      unitCode,
      actionCode: 'create_posvendas',
      userIdentifier,
      status,
      moduleName
    });
  },

  logPosVendasUpdate(userIdentifier: string, unitCode: string, status: 'success' | 'error', moduleName?: string) {
    return this.logActivity({
      unitCode,
      actionCode: 'update_posvendas',
      userIdentifier,
      status,
      moduleName
    });
  },

  logUserCreate(userIdentifier: string, adminUnitCode: string, status: 'success' | 'error', moduleName?: string) {
    return this.logActivity({
      unitCode: adminUnitCode,
      actionCode: 'create_user',
      userIdentifier,
      status,
      moduleName
    });
  },

  logUserUpdate(userIdentifier: string, adminUnitCode: string, status: 'success' | 'error', moduleName?: string) {
    return this.logActivity({
      unitCode: adminUnitCode,
      actionCode: 'update_user',
      userIdentifier,
      status,
      moduleName
    });
  },

  logUserDelete(userIdentifier: string, adminUnitCode: string, status: 'success' | 'error', moduleName?: string) {
    return this.logActivity({
      unitCode: adminUnitCode,
      actionCode: 'delete_user',
      userIdentifier,
      status,
      moduleName
    });
  },

  logUnitCreate(userIdentifier: string, status: 'success' | 'error', moduleName?: string) {
    return this.logActivity({
      unitCode: null, // Operação global
      actionCode: 'create_unit',
      userIdentifier,
      status,
      moduleName
    });
  },

  logUnitUpdate(userIdentifier: string, unitCode: string, status: 'success' | 'error', moduleName?: string) {
    return this.logActivity({
      unitCode,
      actionCode: 'update_unit',
      userIdentifier,
      status,
      moduleName
    });
  },

  /**
   * Registra acesso a um módulo do sistema
   * @param userIdentifier Email ou nome do usuário
   * @param unitCode Código da unidade
   * @param moduleCode Código do módulo acessado
   * @param moduleName Nome do módulo acessado
   */
  logModuleAccess(userIdentifier: string, unitCode: string | null, moduleCode: string, moduleName: string) {
    // Gera o action_code específico do módulo (mesmo padrão do banco)
    const moduleActionCode = 'access_module_' + moduleCode.toLowerCase().replace(/-/g, '_').replace(/ /g, '_');
    
    return this.logActivity({
      unitCode,
      actionCode: moduleActionCode,
      userIdentifier,
      status: 'success',
      moduleName,
      metadata: {
        module_code: moduleCode,
        module_name: moduleName
      }
    });
  }
};
