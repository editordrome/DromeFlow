import { supabase } from '../supabaseClient';

export interface ColumnInfo {
  column_name: string;
  data_type: string;
  is_nullable: string;
}

/**
 * Busca todas as colunas editáveis da tabela unit_keys
 * Exclui colunas de sistema (id, unit_id, created_at, updated_at)
 */
export async function fetchUnitKeysColumns(): Promise<ColumnInfo[]> {
  try {
    // Buscar um registro qualquer para descobrir as colunas
    const { data, error } = await supabase
      .from('unit_keys')
      .select('*')
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('[fetchUnitKeysColumns] Erro ao buscar registro:', error);
      return getFallbackColumns();
    }

    // Se não houver dados, usar fallback
    if (!data) {
      console.log('[fetchUnitKeysColumns] Nenhum registro encontrado, usando fallback');
      return getFallbackColumns();
    }

    // Extrair colunas do objeto retornado
    const columnNames = Object.keys(data).filter(
      col => !['id', 'unit_id', 'created_at', 'updated_at'].includes(col)
    );

    console.log('[fetchUnitKeysColumns] Colunas encontradas:', columnNames);

    // Converter para formato ColumnInfo
    const columns: ColumnInfo[] = columnNames.map(col => ({
      column_name: col,
      data_type: typeof data[col] === 'boolean' ? 'boolean' : 'text',
      is_nullable: 'YES'
    }));

    // Garantir que is_active seja boolean
    const isActiveCol = columns.find(c => c.column_name === 'is_active');
    if (isActiveCol) {
      isActiveCol.data_type = 'boolean';
      isActiveCol.is_nullable = 'NO';
    }

    return columns;
  } catch (err) {
    console.error('[fetchUnitKeysColumns] Exceção:', err);
    return getFallbackColumns();
  }
}

/**
 * Retorna colunas conhecidas como fallback
 */
function getFallbackColumns(): ColumnInfo[] {
  return [
    { column_name: 'codigo', data_type: 'text', is_nullable: 'YES' },
    { column_name: 'istancia', data_type: 'text', is_nullable: 'YES' },
    { column_name: 'recrutadora', data_type: 'text', is_nullable: 'YES' },
    { column_name: 'botID', data_type: 'text', is_nullable: 'YES' },
    { column_name: 'triggerName', data_type: 'text', is_nullable: 'YES' },
    { column_name: 'organizationID', data_type: 'text', is_nullable: 'YES' },
    { column_name: 'contato_profissionais', data_type: 'text', is_nullable: 'YES' },
    { column_name: 'umbler', data_type: 'text', is_nullable: 'YES' },
    { column_name: 'contato_atend', data_type: 'text', is_nullable: 'YES' },
    { column_name: 'pos_vendas', data_type: 'text', is_nullable: 'YES' },
    { column_name: 'conexao', data_type: 'text', is_nullable: 'YES' },
    { column_name: 'id_recruta', data_type: 'text', is_nullable: 'YES' },
    { column_name: 'is_active', data_type: 'boolean', is_nullable: 'NO' },
  ];
}

/**
 * Mapeamento de nomes de colunas para labels amigáveis
 */
export function getColumnLabel(columnName: string): string {
  const labels: Record<string, string> = {
    'codigo': 'Código',
    'istancia': 'Instância',
    'recrutadora': 'Recrutadora',
    'botID': 'Bot ID',
    'triggerName': 'Trigger Name',
    'organizationID': 'Organization ID',
    'contato_profissionais': 'Contato Profissionais',
    'umbler': 'Umbler',
    'contato_atend': 'Contato Atendimento',
    'pos_vendas': 'Pós Vendas',
    'conexao': 'Conexão',
    'id_recruta': 'ID Recruta',
    'is_active': 'Ativo',
  };

  return labels[columnName] || columnName
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Mapeamento de nomes de colunas para ícones
 */
export function getColumnIcon(columnName: string): string {
  const icons: Record<string, string> = {
    'codigo': 'Hash',
    'istancia': 'Database',
    'recrutadora': 'UserSearch',
    'botID': 'Bot',
    'triggerName': 'Zap',
    'organizationID': 'Building2',
    'contato_profissionais': 'MessageSquare',
    'umbler': 'Server',
    'contato_atend': 'MessageCircle',
    'pos_vendas': 'ShoppingBag',
    'conexao': 'Link',
    'id_recruta': 'UserPlus',
    'is_active': 'ToggleLeft',
  };

  return icons[columnName] || 'Settings';
}
