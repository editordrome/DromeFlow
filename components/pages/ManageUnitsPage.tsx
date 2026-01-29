import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { fetchAllUnits, createUnit, updateUnit, deleteUnit, toggleUnitStatus } from '../../services/units/units.service';
import { fetchUsersForUnit, updateUser, createUser } from '../../services/auth/users.service';
import { activityLogger } from '../../services/utils/activityLogger.service';
import { Unit, UnitKey, Module } from '../../types';
import { Icon } from '../ui/Icon';
import { useAuth } from '../../contexts/AuthContext';
import { useAppContext } from '../../contexts/AppContext';
import { fetchUnitKeys, createUnitKey, updateUnitKey, deleteUnitKey, upsertUnitKeyValue } from '../../services/units/unitKeys.service';
import { listUnitKeysColumns, ColumnInfo } from '../../services/units/unitKeysAdmin.service';
import { User as UserType, Profile as ProfileType } from '../../types';
import { UserFormModal } from '../ui/UserFormModal';
import { fetchUnitModuleIds, assignModulesToUnit } from '../../services/units/unitModules.service';
import { fetchAllModules } from '../../services/modules/modules.service';
import { supabase } from '../../services/supabaseClient';
import { UnitPlanManager } from '../ui/UnitPlanManager';
import { UnitIntegrationsManager } from '../ui/UnitIntegrationsManager';


type UnitDataPayload = Partial<Unit>;

const UnitFormModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onSave: (unit: UnitDataPayload) => void;
  unit: Unit | null;
  onDelete: (unitId: string) => void;
}> = ({ isOpen, onClose, onSave, unit, onDelete }) => {
  const { profile } = useAuth();
  const [formData, setFormData] = useState({
    unit_name: '',
    unit_code: '',
    razao_social: '',
    cnpj: '',
    endereco: '',
    responsavel: '',
    contato: '',
    email: '',
  });
  const [error, setError] = useState('');
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [unitUsers, setUnitUsers] = useState<{ id: string; full_name: string; email: string; role: string }[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cnpjLoading, setCnpjLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'dados' | 'usuarios' | 'modulos' | 'keys' | 'planos' | 'integracoes'>('dados');
  const [keys, setKeys] = useState<UnitKey[]>([]);
  // Estado para abrir modal Editar Usuário reaproveitando o componente compartilhado
  const [editingUser, setEditingUser] = useState<(UserType & ProfileType) | null>(null);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);

  const handleOpenUserModal = (u?: { id: string; full_name: string; email: string; role: string }) => {
    setEditingUser((u as any) || null);
    setIsUserModalOpen(true);
  };
  const handleCloseUserModal = () => {
    setIsUserModalOpen(false);
    setEditingUser(null);
  };

  // Função para formatar CNPJ para exibição
  const formatCNPJ = (cnpj: string | null | undefined): string => {
    if (!cnpj) return '';
    const numbers = cnpj.replace(/\D/g, '');
    if (numbers.length !== 14) return cnpj;
    return numbers.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
  };

  // Função para converter texto para Title Case
  const toTitleCase = (str: string | null | undefined): string => {
    if (!str) return '';
    return str.toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
  };

  // Função para buscar dados do CNPJ via BrasilAPI
  const handleCnpjLookup = async (cnpj: string) => {
    const cleanCnpj = cnpj.replace(/\D/g, '');
    if (cleanCnpj.length !== 14) return;

    setCnpjLoading(true);
    setError('');

    try {
      const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cleanCnpj}`);
      if (!response.ok) throw new Error('CNPJ não encontrado');

      const data = await response.json();
      const enderecoPartes = [
        toTitleCase(data.descricao_tipo_de_logradouro),
        toTitleCase(data.logradouro),
        data.numero,
        toTitleCase(data.complemento),
        toTitleCase(data.bairro),
        toTitleCase(data.municipio),
        data.uf?.toUpperCase(),
        data.cep
      ].filter(Boolean);
      const endereco = enderecoPartes.join(', ');

      setFormData(prev => ({
        ...prev,
        razao_social: toTitleCase(data.razao_social) || prev.razao_social,
        endereco: endereco || prev.endereco,
      }));
    } catch (err) {
      console.error('Erro ao buscar CNPJ:', err);
      setError('Não foi possível buscar os dados do CNPJ.');
    } finally {
      setCnpjLoading(false);
    }
  };

  const handleCnpjChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const numbersOnly = value.replace(/\D/g, '');
    const formatted = formatCNPJ(numbersOnly);
    setFormData(prev => ({ ...prev, cnpj: formatted }));
    if (error && error.includes('CNPJ')) setError('');
    if (numbersOnly.length === 14) handleCnpjLookup(numbersOnly);
  };

  const handleSaveUserFromUnit = async (payload: Partial<UserType & ProfileType>) => {
    try {
      if (editingUser) {
        await updateUser(editingUser.id, payload as any);
      } else {
        // criação: vincula à unidade atual
        await createUser({ ...(payload as any), auto_unit_id: unit?.id });
      }
      if (unit) {
        const users = await fetchUsersForUnit(unit.id);
        setUnitUsers(users);
      }
      handleCloseUserModal();
    } catch (e: any) {
      alert(e?.message || 'Falha ao salvar usuário');
    }
  };
  const [keysLoading, setKeysLoading] = useState(false);
  const [keysError, setKeysError] = useState<string | null>(null);
  const [showInactive, setShowInactive] = useState(false);
  const [isCreatingKey, setIsCreatingKey] = useState(false);
  const [expandedKeyId, setExpandedKeyId] = useState<string | null>(null);
  const [expandedFocusField, setExpandedFocusField] = useState<string | null>(null);
  const [createdKeyHints, setCreatedKeyHints] = useState<Record<string, string>>({});
  const [isTypePickerOpen, setIsTypePickerOpen] = useState(false);
  const [selectedKeyType, setSelectedKeyType] = useState<string>('umbler');
  const [keyTypeOptions, setKeyTypeOptions] = useState<Array<{ value: string; label: string; hint?: string }>>([]);
  const [keyTypeLoading, setKeyTypeLoading] = useState(false);
  const [keyTypeError, setKeyTypeError] = useState<string | null>(null);
  // Colunas dinâmicas disponíveis na tabela unit_keys (sem colunas de sistema)
  const [keyColumns, setKeyColumns] = useState<ColumnInfo[]>([]);
  const [keyColumnsLoading, setKeyColumnsLoading] = useState(false);
  const [keyColumnsError, setKeyColumnsError] = useState<string | null>(null);
  // Modal antigo removido; agora salvamento é automático na própria aba
  const [keyEdits, setKeyEdits] = useState<Record<string, string>>({});
  const [savingKeyIds, setSavingKeyIds] = useState<Record<string, boolean>>({});

  // Estados para a aba Módulos
  const [allModules, setAllModules] = useState<Module[]>([]);
  const [selectedModuleIds, setSelectedModuleIds] = useState<string[]>([]);
  const [modulesLoading, setModulesLoading] = useState(false);
  const [modulesError, setModulesError] = useState<string | null>(null);
  const [savingModules, setSavingModules] = useState(false);
  const [modulesSaved, setModulesSaved] = useState(false);



  useEffect(() => {
    // Reset form
    if (unit) {
      setFormData({
        unit_name: unit.unit_name,
        unit_code: unit.unit_code,
        razao_social: unit.razao_social || '',
        cnpj: unit.cnpj || '',
        endereco: unit.endereco || '',
        responsavel: unit.responsavel || '',
        contato: unit.contato || '',
        email: unit.email || '',
      });
    } else {
      setFormData({
        unit_name: '',
        unit_code: '',
        razao_social: '',
        cnpj: '',
        endereco: '',
        responsavel: '',
        contato: '',
        email: '',
      });
    }
    setError('');
    setUsersError(null);
    setUnitUsers([]);
    setActiveTab('dados');
    setKeys([]);
    setKeysError(null);
    // Carrega usuários vinculados (somente em edição)
    if (unit && isOpen) {
      (async () => {
        try {
          setUsersLoading(true);
          const users = await fetchUsersForUnit(unit.id);
          setUnitUsers(users);
        } catch (err: any) {
          setUsersError('Falha ao carregar usuários vinculados.');
        } finally {
          setUsersLoading(false);
        }
      })();
      // Carrega keys (somente em edição)
      (async () => {
        try {
          setKeysLoading(true);
          const list = await fetchUnitKeys(unit.id);
          setKeys(list);
        } catch (err: any) {
          setKeysError('Falha ao carregar keys da unidade.');
        } finally {
          setKeysLoading(false);
        }
      })();
      // Carrega colunas disponíveis de unit_keys (dinâmico)
      (async () => {
        try {
          setKeyColumnsError(null);
          setKeyColumnsLoading(true);
          const cols: ColumnInfo[] = await listUnitKeysColumns(false);
          // filtro de segurança caso o RPC retorne colunas de sistema
          const system = new Set(['id', 'unit_id', 'is_active', 'created_at', 'updated_at']);
          const filtered = cols.filter(c => !system.has(c.column_name));
          setKeyColumns(filtered);
        } catch (e: any) {
          setKeyColumnsError(e?.message || 'Falha ao carregar colunas de unit_keys.');
          setKeyColumns([]);
        } finally {
          setKeyColumnsLoading(false);
        }
      })();
      // Carrega módulos disponíveis e módulos já atribuídos à unidade
      (async () => {
        try {
          setModulesError(null);
          setModulesLoading(true);
          // Busca todos os módulos disponíveis
          const modules = await fetchAllModules();
          setAllModules(modules.filter(m => m.is_active)); // Apenas ativos
          // Busca IDs dos módulos já atribuídos a esta unidade
          const assignedIds = await fetchUnitModuleIds(unit.id);
          setSelectedModuleIds(assignedIds);
        } catch (e: any) {
          setModulesError(e?.message || 'Falha ao carregar módulos.');
          setAllModules([]);
          setSelectedModuleIds([]);
        } finally {
          setModulesLoading(false);
        }
      })();


    }
  }, [unit, isOpen, profile]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.unit_name || !formData.unit_code) {
      setError('Por favor, preencha todos os campos.');
      return;
    }
    setIsSubmitting(true);
    setError('');
    try {
      const dataToSave: UnitDataPayload = { ...formData };
      if (unit) dataToSave.id = unit.id;
      await onSave(dataToSave);
    } catch (err: any) {
      setError(err.message || 'Falha ao salvar.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60" aria-modal="true" role="dialog" onMouseDown={onClose}>
      <div className="w-full max-w-3xl mx-4 bg-bg-secondary rounded-lg shadow-lg overflow-hidden" onMouseDown={(e) => e.stopPropagation()}>
        {/* Header com fundo cinza e abas na mesma linha */}
        <div className="bg-bg-tertiary px-5 py-3.5 flex items-center justify-between border-b border-border-secondary">
          <div className="flex items-center gap-6">
            <h2 className="text-lg font-bold text-text-primary">{unit ? (unit.unit_name || 'Editar Unidade') : 'Adicionar Nova Unidade'}</h2>

            {/* Abas (somente em edição) */}
            {unit && (
              <div className="flex gap-2">
                <button type="button" className={`px-3 py-1.5 text-sm rounded-md transition-colors ${activeTab === 'dados' ? 'bg-accent-primary text-white' : 'text-text-secondary hover:text-text-primary hover:bg-bg-tertiary/50'}`} onClick={() => setActiveTab('dados')}>Dados</button>
                <button type="button" className={`px-3 py-1.5 text-sm rounded-md transition-colors ${activeTab === 'usuarios' ? 'bg-accent-primary text-white' : 'text-text-secondary hover:text-text-primary hover:bg-bg-tertiary/50'}`} onClick={() => setActiveTab('usuarios')}>Usuários</button>
                <button type="button" className={`px-3 py-1.5 text-sm rounded-md transition-colors ${activeTab === 'modulos' ? 'bg-accent-primary text-white' : 'text-text-secondary hover:text-text-primary hover:bg-bg-tertiary/50'}`} onClick={() => setActiveTab('modulos')}>Módulos</button>
                {profile?.role === 'super_admin' && (
                  <>
                    <button type="button" className={`px-3 py-1.5 text-sm rounded-md transition-colors ${activeTab === 'keys' ? 'bg-accent-primary text-white' : 'text-text-secondary hover:text-text-primary hover:bg-bg-tertiary/50'}`} onClick={() => setActiveTab('keys')}>Keys</button>
                    <button type="button" className={`px-3 py-1.5 text-sm rounded-md transition-colors ${activeTab === 'integracoes' ? 'bg-accent-primary text-white' : 'text-text-secondary hover:text-text-primary hover:bg-bg-tertiary/50'}`} onClick={() => setActiveTab('integracoes')}>Integrações</button>
                    <button type="button" className={`px-3 py-1.5 text-sm rounded-md transition-colors ${activeTab === 'planos' ? 'bg-accent-primary text-white' : 'text-text-secondary hover:text-text-primary hover:bg-bg-tertiary/50'}`} onClick={() => setActiveTab('planos')}>Planos</button>
                  </>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            {profile?.role === 'super_admin' && activeTab === 'keys' && (
              <button
                type="button"
                disabled={isCreatingKey}
                className={`ml-auto px-3 py-1.5 text-sm font-medium text-white rounded-md ${isCreatingKey ? 'opacity-60 cursor-not-allowed bg-accent-primary' : 'bg-accent-primary hover:bg-accent-secondary'}`}
                onClick={async () => {
                  if (!unit) return;
                  try {
                    setKeyTypeError(null);
                    setKeyTypeLoading(true);
                    const cols: ColumnInfo[] = await listUnitKeysColumns(false);
                    // Mapeia colunas para opções; usa título amigável
                    const toTitle = (name: string) => name
                      .split('_')
                      .map(s => s.charAt(0).toUpperCase() + s.slice(1))
                      .join(' ');
                    const knownHints: Record<string, string> = {
                      umbler: 'Bearer/Token',
                    };
                    const opts = cols
                      .sort((a, b) => a.ordinal_position - b.ordinal_position)
                      .map(c => ({ value: c.column_name, label: toTitle(c.column_name), hint: knownHints[c.column_name] }));
                    setKeyTypeOptions(opts);
                    if (opts.length > 0) setSelectedKeyType(opts[0].value);
                    setIsTypePickerOpen(true);
                  } catch (e: any) {
                    setKeyTypeError(e?.message || 'Falha ao carregar colunas de unit_keys.');
                    alert(e?.message || 'Falha ao carregar colunas de unit_keys.');
                  } finally {
                    setKeyTypeLoading(false);
                  }
                }}
              >
                <Icon name="add" className="w-4 h-4 mr-1 inline" />
                {isCreatingKey ? 'Criando…' : 'Adicionar Key'}
              </button>
            )}
            <button onClick={onClose} className="p-1.5 rounded-md text-text-secondary hover:bg-bg-tertiary/50 mt-5">
              <Icon name="close" className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Conteúdo das abas */}
        {activeTab === 'dados' && (
          <>
            <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
              {error && <p className="text-sm text-center text-danger bg-danger/10 p-2 rounded-md">{error}</p>}

              {/* Seção: Dados Básicos */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-text-primary border-b border-border-secondary pb-2">Dados Básicos</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="unit_name" className="block text-xs font-medium text-text-secondary mb-1">Nome da Unidade *</label>
                    <input type="text" name="unit_name" id="unit_name" value={formData.unit_name} onChange={handleChange} required className="w-full px-3 py-2 border rounded-lg bg-bg-tertiary border-border-secondary text-sm focus:ring-2 focus:ring-accent-primary/20 focus:border-accent-primary" />
                  </div>
                  <div>
                    <label htmlFor="unit_code" className="block text-xs font-medium text-text-secondary mb-1">Código da Unidade *</label>
                    <input type="text" name="unit_code" id="unit_code" value={formData.unit_code} onChange={handleChange} required className="w-full px-3 py-2 border rounded-lg bg-bg-tertiary border-border-secondary text-sm focus:ring-2 focus:ring-accent-primary/20 focus:border-accent-primary" />
                  </div>
                </div>
              </div>

              {/* Seção: Informações da Empresa */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-text-primary border-b border-border-secondary pb-2">Informações da Empresa</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="razao_social" className="block text-xs font-medium text-text-secondary mb-1">Razão Social</label>
                    <input type="text" name="razao_social" id="razao_social" value={formData.razao_social} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg bg-bg-tertiary border-border-secondary text-sm focus:ring-2 focus:ring-accent-primary/20 focus:border-accent-primary" />
                  </div>
                  <div>
                    <label htmlFor="cnpj" className="block text-xs font-medium text-text-secondary mb-1">
                      CNPJ
                      {cnpjLoading && <span className="ml-2 text-accent-primary">buscando...</span>}
                    </label>
                    <input
                      type="text"
                      name="cnpj"
                      id="cnpj"
                      value={formData.cnpj}
                      onChange={handleCnpjChange}
                      placeholder="00.000.000/0000-00"
                      maxLength={18}
                      disabled={cnpjLoading}
                      className={`w-full px-3 py-2 border rounded-lg bg-bg-tertiary border-border-secondary text-sm focus:ring-2 focus:ring-accent-primary/20 focus:border-accent-primary ${cnpjLoading ? 'opacity-50 cursor-wait' : ''}`}
                    />
                    <p className="text-xs text-text-tertiary mt-1">Preenche automaticamente razão social e endereço</p>
                  </div>
                  <div className="col-span-2">
                    <label htmlFor="endereco" className="block text-xs font-medium text-text-secondary mb-1">Endereço</label>
                    <input type="text" name="endereco" id="endereco" value={formData.endereco} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg bg-bg-tertiary border-border-secondary text-sm focus:ring-2 focus:ring-accent-primary/20 focus:border-accent-primary" />
                  </div>
                </div>
              </div>

              {/* Seção: Contato */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-text-primary border-b border-border-secondary pb-2">Contato</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="responsavel" className="block text-xs font-medium text-text-secondary mb-1">Responsável</label>
                    <input type="text" name="responsavel" id="responsavel" value={formData.responsavel} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg bg-bg-tertiary border-border-secondary text-sm focus:ring-2 focus:ring-accent-primary/20 focus:border-accent-primary" />
                  </div>
                  <div>
                    <label htmlFor="contato" className="block text-xs font-medium text-text-secondary mb-1">Telefone</label>
                    <input type="text" name="contato" id="contato" value={formData.contato} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg bg-bg-tertiary border-border-secondary text-sm focus:ring-2 focus:ring-accent-primary/20 focus:border-accent-primary" />
                  </div>
                  <div className="col-span-2">
                    <label htmlFor="email" className="block text-xs font-medium text-text-secondary mb-1">E-mail</label>
                    <input type="email" name="email" id="email" value={formData.email} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg bg-bg-tertiary border-border-secondary text-sm focus:ring-2 focus:ring-accent-primary/20 focus:border-accent-primary" />
                  </div>
                </div>
              </div>
            </form>

            {/* Footer da aba dados */}
            <div className="px-5 py-3 bg-bg-tertiary border-t border-border-secondary flex items-center justify-between">
              <div>
                {unit && (
                  <button
                    type="button"
                    onClick={() => onDelete(unit.id)}
                    className="p-2 rounded-md border border-danger/30 text-danger hover:bg-danger/10 transition-colors"
                    title="Excluir unidade"
                  >
                    <Icon name="delete" className="w-4 h-4" />
                  </button>
                )}
              </div>
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="p-2 rounded-md text-white bg-accent-primary hover:bg-accent-secondary disabled:opacity-60 transition-colors"
                title="Salvar"
              >
                {isSubmitting ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Icon name="check" className="w-4 h-4" />
                )}
              </button>
            </div>
          </>
        )}

        {unit && activeTab === 'usuarios' && (
          <div className="px-5 py-4 space-y-4">
            <div className="flex items-center justify-between">
              <button onClick={() => handleOpenUserModal()} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-md bg-accent-primary hover:bg-accent-secondary">
                <Icon name="add" className="w-4 h-4" />
                Adicionar Usuário
              </button>
            </div>
            {usersLoading && (
              <div className="flex items-center space-x-2 text-text-secondary text-sm"><span className="w-4 h-4 border-2 border-t-accent-primary border-border-secondary rounded-full animate-spin" /> <span>Carregando...</span></div>
            )}
            {usersError && <div className="text-sm text-danger bg-danger/10 p-2 rounded-md">{usersError}</div>}
            {!usersLoading && !usersError && unitUsers.length === 0 && (
              <div className="text-xs italic text-text-secondary">Nenhum usuário vinculado.</div>
            )}
            {!usersLoading && unitUsers.length > 0 && (
              <ul className="divide-y divide-border-secondary border border-border-secondary rounded-md overflow-hidden">
                {unitUsers.map(u => (
                  <li key={u.id} className="px-3 py-2 text-sm flex flex-col sm:flex-row sm:items-center sm:justify-between bg-bg-tertiary/30 hover:bg-bg-tertiary transition-colors" onDoubleClick={() => handleOpenUserModal(u)}>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-text-primary truncate">{u.full_name || '(Sem nome)'}</p>
                      <p className="text-xs text-text-secondary truncate font-mono">{u.email}</p>
                    </div>
                    <span className="mt-1 sm:mt-0 inline-flex items-center px-2 py-0.5 rounded text-xs bg-accent-primary/10 text-accent-primary font-medium uppercase tracking-wide">{u.role}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {unit && activeTab === 'modulos' && (
          <div className="px-5 py-4 space-y-4">
            <p className="text-xs text-text-secondary">Selecione os módulos que os usuários desta unidade poderão acessar.</p>

            {modulesLoading && (
              <div className="flex items-center justify-center py-8 space-x-2 text-text-secondary text-sm">
                <span className="w-4 h-4 border-2 border-t-accent-primary border-border-secondary rounded-full animate-spin" />
                <span>Carregando módulos...</span>
              </div>
            )}

            {modulesError && (
              <div className="text-sm text-danger bg-danger/10 p-3 rounded-md flex items-start gap-2">
                <Icon name="alert-triangle" className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>{modulesError}</span>
              </div>
            )}

            {!modulesLoading && !modulesError && allModules.length === 0 && (
              <div className="text-center py-8 text-text-secondary text-sm">
                <Icon name="inbox" className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>Nenhum módulo disponível no sistema.</p>
              </div>
            )}

            {!modulesLoading && !modulesError && allModules.length > 0 && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[400px] overflow-y-auto p-1">
                  {allModules
                    .filter(module => {
                      // Filtra módulos exclusivos de super_admin
                      // Só mostra se o módulo também está disponível para admin ou user
                      const profiles = module.allowed_profiles || [];
                      const hasSuperAdmin = profiles.includes('super_admin');
                      const hasAdminOrUser = profiles.includes('admin') || profiles.includes('user');

                      // Se tem super_admin E (admin OU user), mostra
                      // Se não tem super_admin, mostra
                      // Se tem APENAS super_admin, NÃO mostra
                      return !hasSuperAdmin || hasAdminOrUser;
                    })
                    .map(module => {
                      const isSelected = selectedModuleIds.includes(module.id);
                      return (
                        <label
                          key={module.id}
                          className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${isSelected
                            ? 'border-accent-primary bg-accent-primary/5'
                            : 'border-border-secondary bg-bg-tertiary/30 hover:border-border-primary hover:bg-bg-tertiary'
                            }`}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedModuleIds(prev => [...prev, module.id]);
                              } else {
                                setSelectedModuleIds(prev => prev.filter(id => id !== module.id));
                              }
                            }}
                            className="mt-1 w-4 h-4 rounded border-border-secondary text-accent-primary focus:ring-2 focus:ring-accent-primary/20 checked:bg-accent-primary checked:border-transparent"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <Icon name={module.icon_name || 'box'} className="w-4 h-4 text-accent-primary flex-shrink-0" />
                              <span className="font-medium text-sm text-text-primary truncate">{module.name}</span>
                            </div>
                            {module.description && (
                              <p className="text-xs text-text-secondary line-clamp-2">{module.description}</p>
                            )}
                          </div>
                        </label>
                      );
                    })}
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-border-secondary">
                  <div className="text-xs text-text-secondary">
                    <Icon name="info" className="inline w-3.5 h-3.5 mr-1" />
                    {selectedModuleIds.length} de {allModules.length} módulos selecionados
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      if (!unit) return;
                      try {
                        setSavingModules(true);
                        setModulesError(null);
                        setModulesSaved(false);
                        await assignModulesToUnit(unit.id, selectedModuleIds);
                        // Feedback visual via estado
                        setModulesSaved(true);
                        setTimeout(() => {
                          setModulesSaved(false);
                        }, 2000);
                      } catch (e: any) {
                        const errorMsg = e?.message || e?.error?.message || e?.details || 'Falha ao salvar módulos.';
                        setModulesError(errorMsg);
                      } finally {
                        setSavingModules(false);
                      }
                    }}
                    disabled={savingModules}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-md bg-accent-primary hover:bg-accent-secondary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {modulesSaved ? (
                      <>
                        <Icon name="check" className="w-4 h-4" />
                        Salvo!
                      </>
                    ) : savingModules ? (
                      <>
                        <span className="w-4 h-4 border-2 border-t-white border-white/30 rounded-full animate-spin" />
                        Salvando...
                      </>
                    ) : (
                      <>
                        <Icon name="save" className="w-4 h-4" />
                        Salvar Módulos
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {unit && profile?.role === 'super_admin' && activeTab === 'keys' && (
          <div className="px-5 py-4 space-y-4">
            {keysLoading ? (
              <div className="flex items-center justify-center py-8 space-x-2 text-text-secondary text-sm">
                <span className="w-5 h-5 border-2 border-t-accent-primary border-border-secondary rounded-full animate-spin" />
                <span>Carregando keys...</span>
              </div>
            ) : keysError ? (
              <div className="text-sm text-danger bg-danger/10 border border-danger/30 p-3 rounded-lg flex items-start gap-2">
                <Icon name="alert" className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{keysError}</span>
              </div>
            ) : (
              <div className="space-y-4">
                {keys.length === 0 && (
                  <div className="text-center py-12 bg-bg-tertiary/20 border-2 border-dashed border-border-secondary rounded-lg">
                    <Icon name="key" className="w-12 h-12 mx-auto mb-3 text-text-tertiary opacity-50" />
                    <p className="text-sm text-text-secondary">Nenhuma key cadastrada para esta unidade.</p>
                    <p className="text-xs text-text-tertiary mt-1">Clique em "Adicionar Key" para começar</p>
                  </div>
                )}

                {keys.length > 1 && (
                  <div className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 flex items-start gap-2">
                    <Icon name="alert" className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <div>
                      <strong>Aviso:</strong> Foram encontradas <strong>{keys.length}</strong> linhas de keys para esta unidade.
                      O modelo atual consolida tudo em uma única linha. Considere remover registros extras após migrar valores.
                    </div>
                  </div>
                )}

                {keys.length > 0 && (
                  <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                    {keys.map((item) => {
                      const id = String(item.id);

                      const handleFieldChange = (fieldName: string, value: string) => {
                        setKeyEdits(prev => ({ ...prev, [`${id}_${fieldName}`]: value }));
                      };

                      const persistField = async (fieldName: string) => {
                        const editKey = `${id}_${fieldName}`;
                        const value = keyEdits[editKey];
                        if (value === undefined) return;

                        try {
                          setSavingKeyIds(prev => ({ ...prev, [editKey]: true }));
                          await updateUnitKey(String(item.id), { [fieldName]: value } as any);
                          const list = await fetchUnitKeys(unit!.id);
                          setKeys(list);
                          setKeyEdits(prev => {
                            const n = { ...prev };
                            delete n[editKey];
                            return n;
                          });
                        } finally {
                          setSavingKeyIds(prev => { const n = { ...prev }; delete n[editKey]; return n; });
                        }
                      };

                      const handleDelete = async () => {
                        if (!confirm('Remover esta key?')) return;
                        await deleteUnitKey(String(item.id));
                        const list = await fetchUnitKeys(unit!.id);
                        setKeys(list);
                      };

                      return (
                        <div
                          key={id}
                          className="bg-bg-secondary border border-border-secondary rounded-lg p-4 hover:border-accent-primary/50 transition-all space-y-3"
                        >
                          {/* Header do Card */}
                          <div className="flex items-start justify-between gap-3 pb-3 border-b border-border-secondary/50">
                            <div className="flex items-center gap-2">
                              <Icon name="key" className="w-4 h-4 text-accent-primary" />
                              <span className="text-xs font-medium text-text-secondary uppercase tracking-wide">
                                Configuração {keys.length > 1 ? `#${keys.indexOf(item) + 1}` : ''}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${item.is_active
                                ? 'bg-success/10 text-success border border-success/30'
                                : 'bg-danger/10 text-danger border border-danger/30'
                                }`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${item.is_active ? 'bg-success' : 'bg-danger'}`} />
                                {item.is_active ? 'Ativo' : 'Inativo'}
                              </span>
                              <button
                                onClick={handleDelete}
                                className="p-1.5 rounded-md text-danger hover:bg-danger/10 transition-colors"
                                title="Excluir esta key"
                              >
                                <Icon name="delete" className="w-4 h-4" />
                              </button>
                            </div>
                          </div>

                          {/* Grid de Campos */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {keyColumns.map(col => {
                              const fieldName = col.column_name;
                              const editKey = `${id}_${fieldName}`;
                              const currentValue = (item as any)[fieldName];
                              const displayValue = keyEdits[editKey] !== undefined ? keyEdits[editKey] : (currentValue || '');

                              const label = col.column_name
                                .split('_')
                                .map(s => s.charAt(0).toUpperCase() + s.slice(1))
                                .join(' ');

                              const knownHints: Record<string, string> = {
                                codigo: 'Código da unidade',
                                istancia: 'Nome da instância',
                                recrutadora: 'Key da recrutadora',
                                botID: 'ID do bot',
                                triggerName: 'Nome do trigger',
                                organizationID: 'ID da organização',
                                contato_profissionais: 'Contato'
                              };

                              return (
                                <div key={fieldName} className="space-y-1.5">
                                  <label className="text-xs font-medium text-text-secondary flex items-center gap-1">
                                    {label}
                                    {savingKeyIds[editKey] && (
                                      <span className="text-[10px] text-accent-primary animate-pulse">salvando...</span>
                                    )}
                                  </label>
                                  <input
                                    type="text"
                                    value={displayValue}
                                    onChange={(e) => handleFieldChange(fieldName, e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        e.preventDefault();
                                        persistField(fieldName);
                                      }
                                    }}
                                    onBlur={() => persistField(fieldName)}
                                    placeholder={knownHints[fieldName] || `Digite ${label.toLowerCase()}...`}
                                    className="w-full px-3 py-2 text-sm font-mono border rounded-lg bg-bg-tertiary border-border-secondary text-text-primary placeholder:text-text-tertiary focus:ring-2 focus:ring-accent-primary/20 focus:border-accent-primary transition-all"
                                  />
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {unit && profile?.role === 'super_admin' && activeTab === 'planos' && (
          <div className="px-5 py-4 max-h-[600px] overflow-y-auto">
            <UnitPlanManager unitId={unit.id} />
          </div>
        )}

        {unit && profile?.role === 'super_admin' && activeTab === 'integracoes' && (
          <div className="px-5 py-4 max-h-[600px] overflow-y-auto">
            <UnitIntegrationsManager unitId={unit.id} />
          </div>
        )}

        {isTypePickerOpen && unit && (
          <KeyTypePickerModal
            isOpen={isTypePickerOpen}
            options={keyTypeOptions}
            loading={keyTypeLoading}
            selected={selectedKeyType}
            onSelect={setSelectedKeyType}
            onCancel={() => setIsTypePickerOpen(false)}
            onConfirm={async (chosenKey: string, typedValue: string) => {
              if (!unit || isCreatingKey) return;
              try {
                setKeysError(null);
                setIsCreatingKey(true);
                // Se já existe linha e a coluna escolhida possui valor, confirmar overwrite
                const existing = keys[0];
                if (existing && (existing as any)[chosenKey] && String((existing as any)[chosenKey]).length > 0) {
                  const proceed = confirm('Esta coluna já possui um valor. Substituir?');
                  if (!proceed) return; // aborta sem fechar o modal
                }
                const updated = await upsertUnitKeyValue(unit.id, chosenKey, typedValue || '', true);
                const list = await fetchUnitKeys(unit.id);
                setKeys(list);
                setExpandedKeyId(String(updated.id));
                setExpandedFocusField(chosenKey);
                const selectedOpt = keyTypeOptions.find(o => o.value === chosenKey);
                setCreatedKeyHints(prev => ({ ...prev, [String(updated.id)]: selectedOpt?.label || chosenKey }));
              } catch (e: any) {
                const msg = e?.message || 'Falha ao salvar key.';
                setKeysError(msg);
              } finally {
                setIsCreatingKey(false);
                setIsTypePickerOpen(false);
              }
            }}
          />
        )}
        {/* Modal reutilizado para editar usuário */}
        <UserFormModal
          isOpen={isUserModalOpen}
          onClose={handleCloseUserModal}
          onSave={handleSaveUserFromUnit}
          user={editingUser}
          currentAdminProfile={profile}
        />
      </div>
    </div>
  );
};
const FieldRow: React.FC<{ label: string; value?: string | null }> = ({ label, value }) => {
  if (!value) return null;
  return (
    <div className="text-xs">
      <span className="text-text-secondary mr-1">{label}:</span>
      <span className="text-text-primary break-all font-mono">{value}</span>
    </div>
  );
};

const KeyListItem: React.FC<{
  unitId: string;
  item: UnitKey;
  expanded?: boolean;
  autoFocusField?: string;
  hintLabel?: string;
  onUpdated: () => void | Promise<void>;
  onDeleted: () => void | Promise<void>;
}> = ({ unitId, item, expanded: expandedProp = false, autoFocusField, hintLabel, onUpdated, onDeleted }) => {
  const [expanded, setExpanded] = useState(expandedProp);
  useEffect(() => { setExpanded(expandedProp); }, [expandedProp]);
  const anyValue = !!(item.umbler || item.whats_profi || item.whats_client || item.botID || item.organizationID || item.trigger || item.description);
  return (
    <div className="border border-border-secondary rounded-md bg-bg-secondary/60">
      <div className="p-3 flex items-start justify-between gap-3">
        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-2">
          {!anyValue && hintLabel && (
            <div className="col-span-1 md:col-span-2 text-xs italic text-text-secondary">Nova key: {hintLabel}</div>
          )}
          <FieldRow label="umbler" value={item.umbler || undefined} />
          <FieldRow label="whats_profi" value={item.whats_profi || undefined} />
          <FieldRow label="whats_client" value={item.whats_client || undefined} />
          <FieldRow label="botID" value={item.botID || undefined} />
          <FieldRow label="organizationID" value={item.organizationID || undefined} />
          <FieldRow label="trigger" value={item.trigger || undefined} />
          {/* Campo 'description' removido da UI enquanto a coluna não existir no schema */}
        </div>
        <div className="shrink-0 flex items-center gap-2">
          <span className={`text-[10px] px-2 py-0.5 rounded ${item.is_active ? 'bg-emerald-500/10 text-emerald-400' : 'bg-gray-500/10 text-gray-400'}`}>{item.is_active ? 'ATIVA' : 'INATIVA'}</span>
          <button
            type="button"
            className="px-2 py-1 text-xs rounded-md border border-border-secondary hover:bg-bg-tertiary"
            onClick={() => setExpanded(v => !v)}
          >{expanded ? 'Fechar' : 'Editar'}</button>
          <button
            type="button"
            className="px-2 py-1 text-xs rounded-md text-white bg-danger hover:bg-red-700"
            onClick={async () => {
              if (confirm('Remover esta key?')) {
                await deleteUnitKey(String(item.id));
                await onDeleted();
              }
            }}
          >Remover</button>
        </div>
      </div>
      {expanded && (
        <div className="border-t border-border-secondary p-4">
          <KeyItemForm
            initial={item}
            autoFocusField={autoFocusField}
            onSubmit={async (payload) => { await updateUnitKey(String(item.id), payload as any); await onUpdated(); }}
            onDelete={async () => { if (confirm('Remover esta key?')) { await deleteUnitKey(String(item.id)); await onDeleted(); } }}
          />
        </div>
      )}
    </div>
  );
};

const KeyTypePickerModal: React.FC<{
  isOpen: boolean;
  options: Array<{ value: string; label: string; hint?: string }>;
  loading?: boolean;
  selected: string;
  onSelect: (v: string) => void;
  onCancel: () => void;
  onConfirm: (selected: string, value: string) => void | Promise<void>;
}> = ({ isOpen, options, loading = false, selected, onSelect, onCancel, onConfirm }) => {
  const [typedValue, setTypedValue] = useState('');
  useEffect(() => { setTypedValue(''); }, [isOpen]);
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" role="dialog" aria-modal="true">
      <div className="w-full max-w-md mx-4 bg-bg-secondary rounded-lg shadow-lg p-5">
        <div className="flex items-center justify-between pb-3 border-b border-border-primary">
          <h3 className="text-sm font-semibold text-text-primary">Selecionar tipo de Key</h3>
          <button onClick={onCancel} className="p-1 rounded-md text-text-secondary hover:bg-bg-tertiary" aria-label="Fechar">
            <Icon name="close" />
          </button>
        </div>
        <div className="mt-4 space-y-3">
          {loading ? (
            <div className="text-xs text-text-secondary">Carregando opções…</div>
          ) : options.length === 0 ? (
            <div className="text-xs text-text-secondary">Sem colunas disponíveis.</div>
          ) : (
            <>
              <label className="block text-sm font-medium text-text-secondary">Tipo</label>
              <select
                className="w-full px-3 py-2 border rounded-md bg-bg-secondary border-border-secondary focus:ring-accent-primary focus:border-accent-primary"
                value={selected}
                onChange={e => onSelect(e.target.value)}
              >
                {options.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              {(() => {
                const hint = options.find(o => o.value === selected)?.hint;
                return hint ? <div className="text-xs text-text-secondary">{hint}</div> : null;
              })()}
              <div>
                <label className="block text-sm font-medium text-text-secondary">Valor</label>
                <input
                  className="w-full px-3 py-2 mt-1 border rounded-md bg-bg-secondary border-border-secondary focus:ring-accent-primary focus:border-accent-primary"
                  placeholder="Digite o valor..."
                  value={typedValue}
                  onChange={e => setTypedValue(e.target.value)}
                />
              </div>
            </>
          )}
        </div>
        <div className="flex justify-end gap-2 pt-4">
          <button onClick={onCancel} className="px-3 py-1.5 text-sm border rounded-md text-text-secondary border-border-secondary hover:bg-bg-tertiary">Cancelar</button>
          <button disabled={loading || options.length === 0} onClick={() => onConfirm(selected, typedValue)} className={`px-3 py-1.5 text-sm rounded-md text-white ${loading || options.length === 0 ? 'opacity-60 cursor-not-allowed bg-accent-primary' : 'bg-accent-primary hover:bg-accent-secondary'}`}>Confirmar</button>
        </div>
      </div>
    </div>
  );
};

const KeyItemForm: React.FC<{
  initial: UnitKey | null;
  autoFocusField?: string;
  onSubmit: (payload: Partial<UnitKey>) => void | Promise<void>;
  onDelete: () => void | Promise<void>;
}> = ({ initial, autoFocusField, onSubmit, onDelete }) => {
  const formEl = useRef<HTMLFormElement | null>(null);
  const [form, setForm] = useState<Partial<UnitKey>>({
    umbler: initial?.umbler ?? '',
    whats_profi: initial?.whats_profi ?? '',
    whats_client: initial?.whats_client ?? '',
    botID: initial?.botID ?? '',
    organizationID: initial?.organizationID ?? '',
    trigger: initial?.trigger ?? '',
    description: initial?.description ?? '',
    is_active: initial?.is_active ?? true,
  });
  const [error, setError] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [snapshot, setSnapshot] = useState<string>(JSON.stringify(form));
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type, checked } = e.target as any;
    setForm(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };
  useEffect(() => {
    const next = {
      umbler: initial?.umbler ?? '',
      whats_profi: initial?.whats_profi ?? '',
      whats_client: initial?.whats_client ?? '',
      botID: initial?.botID ?? '',
      organizationID: initial?.organizationID ?? '',
      trigger: initial?.trigger ?? '',
      description: initial?.description ?? '',
      is_active: initial?.is_active ?? true,
    };
    setForm(next);
    setSnapshot(JSON.stringify(next));
  }, [initial?.umbler, initial?.whats_profi, initial?.whats_client, initial?.botID, initial?.organizationID, initial?.trigger, initial?.description, initial?.is_active]);

  useEffect(() => {
    const current = JSON.stringify(form);
    if (current === snapshot) return;
    setIsSaving(true);
    setError('');
    const t = setTimeout(async () => {
      try {
        await onSubmit(form);
        setSnapshot(JSON.stringify(form));
        setLastSavedAt(Date.now());
      } catch (e: any) {
        setError(e?.message || 'Falha ao salvar');
      } finally {
        setIsSaving(false);
      }
    }, 600);
    return () => clearTimeout(t);
  }, [form, snapshot, onSubmit]);

  useEffect(() => {
    if (autoFocusField && formEl.current) {
      const el = formEl.current.querySelector(`input[name="${autoFocusField}"]`) as HTMLInputElement | null;
      if (el) el.focus();
    }
  }, [autoFocusField]);
  return (
    <form ref={formEl} className="space-y-4" onSubmit={async (e) => { e.preventDefault(); setError(''); await onSubmit(form); }}>
      {error && <div className="text-sm text-danger bg-danger/10 p-2 rounded-md">{error}</div>}
      <div className="text-xs text-text-secondary">
        {isSaving ? 'Salvando...' : lastSavedAt ? `Auto-salvo às ${new Date(lastSavedAt).toLocaleTimeString()}` : 'Edições serão salvas automaticamente'}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-text-secondary">umbler</label>
          <input name="umbler" value={form.umbler as string} onChange={handleChange} className="w-full px-3 py-2 mt-1 border rounded-md bg-bg-secondary border-border-secondary focus:ring-accent-primary focus:border-accent-primary" />
        </div>
        <div>
          <label className="block text-sm font-medium text-text-secondary">whats_profi</label>
          <input name="whats_profi" value={form.whats_profi as string} onChange={handleChange} className="w-full px-3 py-2 mt-1 border rounded-md bg-bg-secondary border-border-secondary focus:ring-accent-primary focus:border-accent-primary" />
        </div>
        <div>
          <label className="block text-sm font-medium text-text-secondary">whats_client</label>
          <input name="whats_client" value={form.whats_client as string} onChange={handleChange} className="w-full px-3 py-2 mt-1 border rounded-md bg-bg-secondary border-border-secondary focus:ring-accent-primary focus:border-accent-primary" />
        </div>
        <div>
          <label className="block text-sm font-medium text-text-secondary">botID</label>
          <input name="botID" value={form.botID as string} onChange={handleChange} className="w-full px-3 py-2 mt-1 border rounded-md bg-bg-secondary border-border-secondary focus:ring-accent-primary focus:border-accent-primary" />
        </div>
        <div>
          <label className="block text-sm font-medium text-text-secondary">organizationID</label>
          <input name="organizationID" value={form.organizationID as string} onChange={handleChange} className="w-full px-3 py-2 mt-1 border rounded-md bg-bg-secondary border-border-secondary focus:ring-accent-primary focus:border-accent-primary" />
        </div>
        <div>
          <label className="block text-sm font-medium text-text-secondary">trigger</label>
          <input name="trigger" value={form.trigger as string} onChange={handleChange} className="w-full px-3 py-2 mt-1 border rounded-md bg-bg-secondary border-border-secondary focus:ring-accent-primary focus:border-accent-primary" />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-text-secondary">Descrição</label>
        <textarea name="description" value={(form.description as string) || ''} onChange={handleChange} rows={2} className="w-full px-3 py-2 mt-1 border rounded-md bg-bg-secondary border-border-secondary focus:ring-accent-primary focus:border-accent-primary" />
      </div>
      <label className="inline-flex items-center gap-2 text-sm text-text-secondary">
        <input type="checkbox" name="is_active" checked={!!form.is_active} onChange={handleChange} />
        Ativo
      </label>
      <div className="flex justify-end gap-2 pt-2">
        {initial && (
          <button type="button" onClick={() => onDelete()} className="px-4 py-2 text-sm font-medium text-white rounded-md bg-danger hover:bg-red-700">Remover</button>
        )}
      </div>
    </form>
  );
};

// Modal para Edição de Keys (Dinâmico)
const KeyFormModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Partial<UnitKey>) => Promise<void>;
  onDelete?: () => void;
  keyData: UnitKey | null;
}> = ({ isOpen, onClose, onSave, onDelete, keyData }) => {
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [columns, setColumns] = useState<Array<{ name: string; label: string; icon: string }>>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingColumns, setIsLoadingColumns] = useState(true);

  // Buscar colunas da tabela ao abrir o modal
  useEffect(() => {
    if (!isOpen) return;

    const loadColumns = async () => {
      setIsLoadingColumns(true);
      try {
        const { fetchUnitKeysColumns, getColumnLabel, getColumnIcon } = await import('../../services/units/unitKeysColumns.service');

        // Buscar colunas diretamente da tabela
        const columnsData = await fetchUnitKeysColumns();

        const mappedCols = columnsData.map(col => ({
          name: col.column_name,
          label: getColumnLabel(col.column_name),
          icon: getColumnIcon(col.column_name),
        }));

        setColumns(mappedCols);
        console.log('[KeyFormModal] Colunas carregadas dinamicamente:', mappedCols.map(c => c.name));
      } catch (error) {
        console.error('Erro ao carregar colunas:', error);
      } finally {
        setIsLoadingColumns(false);
      }
    };

    loadColumns();
  }, [isOpen]);

  // Preencher formData com base na keyData ou valores vazios
  useEffect(() => {
    if (!isOpen) return;

    const initialData: Record<string, any> = {};
    columns.forEach(col => {
      if (col.name === 'is_active') {
        initialData[col.name] = keyData?.is_active ?? true;
      } else {
        initialData[col.name] = keyData?.[col.name as keyof UnitKey] || '';
      }
    });

    setFormData(initialData);
  }, [keyData, columns, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      // Remove campos vazios
      const cleanData: any = {};
      Object.entries(formData).forEach(([key, value]) => {
        if (key === 'is_active') {
          cleanData[key] = value;
        } else if (value && String(value).trim() !== '') {
          cleanData[key] = value;
        }
      });
      await onSave(cleanData);
      onClose();
    } catch (err) {
      console.error('Erro ao salvar:', err);
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-2xl mx-4 bg-bg-secondary rounded-lg shadow-xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-5 py-3.5 bg-gradient-to-r from-accent-primary/5 to-brand-cyan/5 border-b border-border-secondary flex items-center justify-between">
          <h2 className="text-lg font-bold text-text-primary">
            {keyData ? 'Editar Keys' : 'Adicionar Keys'}
          </h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-bg-tertiary text-text-secondary">
            <Icon name="X" className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        {isLoadingColumns ? (
          <div className="flex items-center justify-center p-12">
            <div className="w-8 h-8 border-4 border-t-4 border-gray-200 rounded-full animate-spin border-t-accent-primary"></div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-5 py-4">
            <div className="grid grid-cols-2 gap-3">
              {columns.filter(col => col.name !== 'is_active').map((col) => (
                <div key={col.name}>
                  <label className="text-xs font-medium text-text-secondary flex items-center gap-1 mb-1">
                    <Icon name={col.icon as any} className="w-3 h-3" />
                    {col.label}
                  </label>
                  <input
                    type="text"
                    value={formData[col.name] || ''}
                    onChange={(e) => setFormData({ ...formData, [col.name]: e.target.value })}
                    className="w-full rounded-lg border border-border-secondary bg-bg-tertiary px-3 py-2 text-sm focus:border-accent-primary focus:ring-2 focus:ring-accent-primary/20"
                    placeholder={col.label}
                  />
                </div>
              ))}

              {/* Status */}
              <div className="col-span-2 flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={formData.is_active ?? true}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="w-4 h-4 rounded border-border-secondary text-accent-primary focus:ring-2 focus:ring-accent-primary/20"
                />
                <label htmlFor="is_active" className="text-sm font-medium text-text-primary cursor-pointer">
                  Configuração Ativa
                </label>
              </div>
            </div>
          </form>
        )}

        {/* Footer */}
        <div className="px-5 py-3 bg-bg-tertiary border-t border-border-secondary flex items-center justify-between">
          <div className="text-xs text-text-tertiary flex items-center gap-1">
            <Icon name="Info" className="w-3 h-3" />
            <span>Deixe vazio os campos não utilizados</span>
          </div>
          <div className="flex gap-2">
            {onDelete && (
              <button
                type="button"
                onClick={onDelete}
                className="p-2 rounded border border-danger/30 text-danger hover:bg-danger/10 transition-colors"
                title="Excluir"
              >
                <Icon name="Trash2" className="w-4 h-4" />
              </button>
            )}
            <button
              type="submit"
              onClick={handleSubmit}
              disabled={isSaving}
              className="p-2 rounded bg-accent-primary text-white hover:bg-accent-secondary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Salvar"
            >
              {isSaving ? (
                <Icon name="Loader2" className="w-4 h-4 animate-spin" />
              ) : (
                <Icon name="Check" className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const DeleteConfirmationModal: React.FC<{
  unit: Unit | null;
  onClose: () => void;
  onConfirm: (unitId: string) => void;
}> = ({ unit, onClose, onConfirm }) => {
  if (!unit) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60" aria-modal="true" role="dialog">
      <div className="w-full max-w-md p-6 mx-4 bg-bg-secondary rounded-lg shadow-lg">
        <h2 className="text-xl font-bold text-text-primary">Confirmar Exclusão</h2>
        <p className="mt-4 text-text-secondary">
          Tem certeza que deseja excluir a unidade <strong className="text-text-primary">{unit.unit_name}</strong>?
        </p>
        <p className="mt-2 text-sm text-danger">Esta ação é irreversível e removerá as permissões de todos os usuários associados a esta unidade.</p>
        <div className="flex justify-end pt-6 mt-4 space-x-3">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium border rounded-md text-text-secondary border-border-secondary hover:bg-bg-tertiary">
            Cancelar
          </button>
          <button onClick={() => onConfirm(unit.id)} className="px-4 py-2 text-sm font-medium text-white border border-transparent rounded-md bg-danger hover:bg-red-700">
            Excluir
          </button>
        </div>
      </div>
    </div>
  );
};


const ITEMS_PER_PAGE = 12;

const ManageUnitsPage: React.FC = () => {
  const { profile } = useAuth();
  const { selectedUnit: contextSelectedUnit, setSelectedUnit: setContextSelectedUnit } = useAppContext();
  const [units, setUnits] = useState<Unit[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState<Unit | null>(null);
  const [unitToDelete, setUnitToDelete] = useState<Unit | null>(null);
  const [unitUserCounts, setUnitUserCounts] = useState<Record<string, number>>({});
  const [unitModuleCounts, setUnitModuleCounts] = useState<Record<string, number>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [copiedValue, setCopiedValue] = useState<string | null>(null);
  const [selectedUnit, setSelectedUnit] = useState<Unit | null>(null);
  const [activeDetailTab, setActiveDetailTab] = useState<'info' | 'users' | 'keys' | 'modules' | 'plans'>('info');
  const [unitKeys, setUnitKeys] = useState<UnitKey[]>([]);
  const [unitUsers, setUnitUsers] = useState<{ id: string; full_name: string; email: string; role: string }[]>([]);
  const [userLoginStatus, setUserLoginStatus] = useState<Record<string, { isOnline: boolean; lastActivity: string | null }>>({});
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<(UserType & ProfileType) | null>(null);
  const [allModules, setAllModules] = useState<Module[]>([]);
  const [unitModuleIds, setUnitModuleIds] = useState<string[]>([]);
  const [savingModules, setSavingModules] = useState(false);
  const [isKeyModalOpen, setIsKeyModalOpen] = useState(false);
  const [editingKey, setEditingKey] = useState<UnitKey | null>(null);
  const [expandedKeyId, setExpandedKeyId] = useState<string | null>(null);

  const handleCopyToClipboard = async (value: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(value);
      setCopiedValue(value);
      setTimeout(() => setCopiedValue(null), 2000);
    } catch (err) {
      console.error('Falha ao copiar:', err);
    }
  };

  // Função para formatar CNPJ para exibição
  const formatCNPJ = (cnpj: string | null | undefined): string => {
    if (!cnpj) return '';
    const numbers = cnpj.replace(/\D/g, '');
    if (numbers.length !== 14) return cnpj;
    return numbers.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
  };

  // Handler para ativar/inativar unidade
  const handleToggleUnitStatus = async (unitId: string, currentStatus: boolean) => {
    try {
      await toggleUnitStatus(unitId, !currentStatus);
      // Atualiza a lista de unidades
      await loadUnits();
      // Atualiza a unidade selecionada se for a mesma
      if (selectedUnit?.id === unitId) {
        setSelectedUnit(prev => prev ? { ...prev, is_active: !currentStatus } : null);
      }
      // Atualiza também no AppContext para refletir no Sidebar
      if (contextSelectedUnit?.id === unitId && contextSelectedUnit.id !== 'ALL' && 'is_active' in contextSelectedUnit) {
        setContextSelectedUnit({ ...contextSelectedUnit, is_active: !currentStatus });
      }
    } catch (err) {
      console.error('Erro ao atualizar status:', err);
      setError('Falha ao atualizar status da unidade.');
    }
  };

  // Buscar status de login dos usuários (últimos 5 minutos = online)
  const fetchUserLoginStatus = async (userIds: string[]) => {
    if (userIds.length === 0) return;
    try {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from('activity_logs')
        .select('user_identifier, horario')
        .in('user_identifier', userIds)
        .order('horario', { ascending: false });

      if (error) throw error;

      const statusMap: Record<string, { isOnline: boolean; lastActivity: string | null }> = {};
      userIds.forEach(userId => {
        const userActivities = data?.filter(log => log.user_identifier === userId) || [];
        const lastActivity = userActivities[0]?.horario || null;
        const isOnline = lastActivity ? lastActivity > fiveMinutesAgo : false;
        statusMap[userId] = { isOnline, lastActivity };
      });

      setUserLoginStatus(statusMap);
    } catch (err) {
      console.error('Erro ao buscar status de login:', err);
    }
  };

  // Carregar keys, usuários e módulos quando seleciona unidade
  useEffect(() => {
    const loadUnitData = async () => {
      if (!selectedUnit) {
        setUnitKeys([]);
        setUnitUsers([]);
        setUserLoginStatus({});
        setUnitModuleIds([]);
        return;
      }
      try {
        const [keys, users, moduleIds] = await Promise.all([
          fetchUnitKeys(selectedUnit.id),
          fetchUsersForUnit(selectedUnit.id),
          fetchUnitModuleIds(selectedUnit.id)
        ]);
        setUnitKeys(keys);
        setUnitUsers(users);
        setUnitModuleIds(moduleIds);

        // Buscar status de login dos usuários
        if (users.length > 0) {
          await fetchUserLoginStatus(users.map(u => u.id));
        }
      } catch (err) {
        console.error('Erro ao carregar dados da unidade:', err);
        setUnitKeys([]);
        setUnitUsers([]);
        setUserLoginStatus({});
        setUnitModuleIds([]);
      }
    };
    loadUnitData();
  }, [selectedUnit]);

  const handleOpenUserModal = (user?: typeof unitUsers[0]) => {
    setEditingUser((user as any) || null);
    setIsUserModalOpen(true);
  };

  const handleCloseUserModal = () => {
    setIsUserModalOpen(false);
    setEditingUser(null);
  };

  const handleSaveUser = async (payload: Partial<UserType & ProfileType>) => {
    try {
      if (editingUser) {
        await updateUser(editingUser.id, payload as any);
      } else {
        await createUser({ ...(payload as any), auto_unit_id: selectedUnit?.id });
      }

      // Recarregar lista de usuários
      if (selectedUnit) {
        const users = await fetchUsersForUnit(selectedUnit.id);
        setUnitUsers(users);
        if (users.length > 0) {
          await fetchUserLoginStatus(users.map(u => u.id));
        }
      }

      handleCloseUserModal();
    } catch (e: any) {
      alert(e?.message || 'Falha ao salvar usuário');
      throw e;
    }
  };

  const handleToggleModule = async (moduleId: string) => {
    if (!selectedUnit) return;

    const newModuleIds = unitModuleIds.includes(moduleId)
      ? unitModuleIds.filter(id => id !== moduleId)
      : [...unitModuleIds, moduleId];

    setUnitModuleIds(newModuleIds);

    try {
      setSavingModules(true);
      await assignModulesToUnit(selectedUnit.id, newModuleIds);

      // Atualizar contagem de módulos
      const moduleCounts = { ...unitModuleCounts };
      moduleCounts[selectedUnit.id] = newModuleIds.length;
      setUnitModuleCounts(moduleCounts);
    } catch (err) {
      console.error('Erro ao salvar módulos:', err);
      // Reverter em caso de erro
      setUnitModuleIds(unitModuleIds);
      alert('Erro ao atualizar módulos');
    } finally {
      setSavingModules(false);
    }
  };

  const handleOpenKeyModal = (key?: UnitKey | null) => {
    // Se não foi passada uma key específica, pegar a primeira key da unidade
    if (key === undefined && unitKeys.length > 0) {
      setEditingKey(unitKeys[0]);
    } else {
      setEditingKey(key || null);
    }
    setIsKeyModalOpen(true);
  };

  const handleCloseKeyModal = () => {
    setIsKeyModalOpen(false);
    setEditingKey(null);
  };

  const handleSaveKey = async (keyData: Partial<UnitKey>) => {
    if (!selectedUnit) return;

    try {
      if (editingKey) {
        await updateUnitKey(editingKey.id, keyData);
      } else {
        await createUnitKey(selectedUnit.id, keyData);
      }

      // Recarregar keys
      const keys = await fetchUnitKeys(selectedUnit.id);
      setUnitKeys(keys);
      handleCloseKeyModal();
    } catch (err: any) {
      alert(err?.message || 'Erro ao salvar key');
    }
  };

  const handleDeleteKey = async (keyId: string) => {
    if (!confirm('Deseja realmente excluir esta key?')) return;

    try {
      await deleteUnitKey(keyId);

      // Recarregar keys
      if (selectedUnit) {
        const keys = await fetchUnitKeys(selectedUnit.id);
        setUnitKeys(keys);
      }
      handleCloseKeyModal();
    } catch (err: any) {
      alert(err?.message || 'Erro ao excluir key');
    }
  };

  const loadUnits = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const fetchedUnits = await fetchAllUnits();
      setUnits(fetchedUnits);

      // Carrega contagem de usuários e módulos para cada unidade
      const userCounts: Record<string, number> = {};
      const moduleCounts: Record<string, number> = {};
      await Promise.all(
        fetchedUnits.map(async (unit) => {
          const [users, moduleIds] = await Promise.all([
            fetchUsersForUnit(unit.id),
            fetchUnitModuleIds(unit.id)
          ]);
          userCounts[unit.id] = users.length;
          moduleCounts[unit.id] = moduleIds.length;
        })
      );
      setUnitUserCounts(userCounts);
      setUnitModuleCounts(moduleCounts);
    } catch (err: any) {
      setError('Falha ao carregar as unidades.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUnits();
    // Carregar lista de todos os módulos disponíveis
    fetchAllModules().then(modules => {
      setAllModules(modules.filter(m => m.is_active));
    }).catch(err => {
      console.error('Erro ao carregar módulos:', err);
    });
  }, [loadUnits]);

  const filteredUnits = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    return units.filter((u) => {
      // Search filter
      const matchesSearch = !term ||
        (u.unit_name || '').toLowerCase().includes(term) ||
        (u.unit_code || '').toLowerCase().includes(term);

      // Status filter
      const matchesStatus =
        statusFilter === 'all' ? true :
          statusFilter === 'active' ? u.is_active !== false :
            u.is_active === false;

      return matchesSearch && matchesStatus;
    });
  }, [units, searchTerm, statusFilter]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredUnits.length / ITEMS_PER_PAGE));

  useEffect(() => {
    setCurrentPage((prev) => {
      if (prev > totalPages) return totalPages;
      if (prev < 1) return 1;
      return prev;
    });
  }, [totalPages]);

  const paginatedUnits = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredUnits.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredUnits, currentPage]);

  const pageStart = filteredUnits.length === 0 ? 0 : (currentPage - 1) * ITEMS_PER_PAGE + 1;
  const pageEnd = filteredUnits.length === 0 ? 0 : Math.min(filteredUnits.length, (currentPage - 1) * ITEMS_PER_PAGE + paginatedUnits.length);

  // Após carregar unidades, buscar contagem de usuários por unidade em uma única consulta
  useEffect(() => {
    const run = async () => {
      try {
        const ids = units.map(u => u.id);
        if (!ids.length) { setUnitUserCounts({}); return; }
        const supabase = (await import('../../services/supabaseClient')).supabase;
        const { data, error } = await supabase
          .from('user_units')
          .select('unit_id')
          .in('unit_id', ids);
        if (error) { setUnitUserCounts({}); return; }
        const map: Record<string, number> = {};
        (data || []).forEach((row: any) => {
          const id = row?.unit_id as string | undefined;
          if (!id) return;
          map[id] = (map[id] || 0) + 1;
        });
        setUnitUserCounts(map);
      } catch {
        setUnitUserCounts({});
      }
    };
    run();
  }, [units]);

  const handleOpenModal = (unit: Unit | null = null) => {
    setEditingUnit(unit);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingUnit(null);
  };

  const handleOpenDeleteConfirm = (unit: Unit) => {
    setUnitToDelete(unit);
  };

  const handleCloseDeleteConfirm = () => {
    setUnitToDelete(null);
  };

  const handleSaveUnit = async (data: UnitDataPayload) => {
    if (editingUnit) {
      await updateUnit(editingUnit.id, data);

      // Registrar atualização de unidade
      if (profile) {
        activityLogger.logUnitUpdate(
          profile.email || profile.full_name,
          editingUnit.unit_code,
          'success'
        );
      }

      handleCloseModal();
      await loadUnits();
      return;
    }
    await createUnit(data);

    // Registrar criação de unidade
    if (profile && data.unit_code) {
      activityLogger.logUnitCreate(
        profile.email || profile.full_name,
        'success'
      );
    }

    handleCloseModal();
    await loadUnits();
  };

  const handleDeleteUnit = async (unitId: string) => {
    try {
      await deleteUnit(unitId);
      handleCloseDeleteConfirm();
      await loadUnits();
    } catch (err: any) {
      alert(`Erro: ${err.message}`);
    }
  };

  const handleDeleteFromModal = (unitId: string) => {
    const unit = units.find(u => u.id === unitId);
    if (unit) {
      handleCloseModal();
      handleOpenDeleteConfirm(unit);
    }
  };

  return (
    <div className="flex flex-col h-full space-y-6">
      {/* Cabeçalho com Título e Ações */}
      <div className="flex-shrink-0 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-text-primary">Unidades</h1>
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative max-w-xs w-[260px]">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar unidade"
              className="w-full pl-9 pr-8 py-2 text-sm border rounded-md bg-bg-secondary border-border-secondary focus:ring-accent-primary focus:border-accent-primary"
            />
            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-text-secondary">
              <Icon name="search" className="w-4 h-4" />
            </span>
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-bg-tertiary text-text-secondary"
                aria-label="Limpar busca"
              >
                <Icon name="close" className="w-4 h-4" />
              </button>
            )}
          </div>
          <button onClick={() => handleOpenModal()} className="flex items-center px-4 py-2 text-sm font-medium text-white rounded-md bg-accent-primary hover:bg-accent-secondary">
            <Icon name="add" className="w-5 h-5 mr-2" />
            Adicionar Unidade
          </button>
        </div>
      </div>

      {/* Cards de Métricas */}
      <div className="flex-shrink-0 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-3 rounded-lg border bg-bg-secondary border-border-primary">
          <div className="flex items-center gap-2">
            <Icon name="Business" className="w-5 h-5 text-accent-primary" />
            <span className="text-sm font-medium text-text-secondary">Total de Unidades</span>
            <span className="ml-auto text-lg font-bold text-text-primary">{units.length}</span>
          </div>
        </div>

        <div className="p-3 rounded-lg border bg-bg-secondary border-border-primary">
          <div className="flex items-center gap-2">
            <Icon name="CheckCircle" className="w-5 h-5 text-success" />
            <span className="text-sm font-medium text-text-secondary">Unidades Ativas</span>
            <span className="ml-auto text-lg font-bold text-success">{units.filter(u => u.is_active !== false).length}</span>
          </div>
        </div>

        <div className="p-3 rounded-lg border bg-bg-secondary border-border-primary">
          <div className="flex items-center gap-2">
            <Icon name="XCircle" className="w-5 h-5 text-danger" />
            <span className="text-sm font-medium text-text-secondary">Unidades Inativas</span>
            <span className="ml-auto text-lg font-bold text-danger">{units.filter(u => u.is_active === false).length}</span>
          </div>
        </div>
      </div>

      {/* Área de Conteúdo - Layout Master-Detail */}
      <div className="flex-1 flex gap-4 overflow-hidden">
        {/* Coluna 1: Lista de Unidades */}
        <div className="w-1/4 bg-bg-secondary rounded-lg shadow-md overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-border-secondary bg-accent-primary">
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-white whitespace-nowrap">Unidades</h2>
              </div>
              <div className="flex gap-2">
                {/* Search Bar */}
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Buscar..."
                    className="w-full pl-9 pr-8 py-2 text-sm border rounded-md bg-white border-border-secondary focus:ring-accent-primary focus:border-accent-primary"
                  />
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-secondary">
                    <Icon name="Search" className="w-4 h-4" />
                  </span>
                  {searchTerm && (
                    <button
                      type="button"
                      onClick={() => setSearchTerm('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-bg-secondary text-text-secondary"
                      aria-label="Limpar busca"
                    >
                      <Icon name="X" className="w-4 h-4" />
                    </button>
                  )}
                </div>
                {/* Status Filter */}
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'inactive')}
                  className="px-3 py-2 text-sm border rounded-md bg-white border-border-secondary focus:ring-accent-primary focus:border-accent-primary"
                >
                  <option value="all">Todas</option>
                  <option value="active">Ativas</option>
                  <option value="inactive">Inativas</option>
                </select>
              </div>
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center flex-1">
              <div className="w-12 h-12 border-4 border-t-4 border-gray-200 rounded-full animate-spin border-t-accent-primary"></div>
            </div>
          ) : error ? (
            <div className="p-4 m-4 text-danger bg-danger/10 border border-danger/30 rounded-md">{error}</div>
          ) : (
            <div className="flex-1 overflow-y-auto">
              <div className="divide-y divide-border-primary">
                {filteredUnits.length === 0 ? (
                  <div className="px-4 py-8 text-center text-sm text-text-secondary">
                    Nenhuma unidade encontrada.
                  </div>
                ) : (
                  filteredUnits.map((unit) => (
                    <div
                      key={unit.id}
                      onClick={() => setSelectedUnit(unit)}
                      className={`px-4 py-3 cursor-pointer transition-all ${selectedUnit?.id === unit.id
                        ? 'bg-gradient-to-r from-brand-purple/20 to-brand-purple/10 border-l-4 border-l-brand-purple font-bold shadow-lg text-brand-purple transform scale-[1.02]'
                        : 'hover:bg-bg-tertiary border-l-4 border-l-transparent hover:border-l-brand-purple/30'
                        }`}
                    >
                      <p className="text-sm">{unit.unit_name}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Coluna 2: Painel de Detalhes */}
        <div className="w-3/4 bg-bg-secondary rounded-lg shadow-md overflow-hidden">
          {!selectedUnit ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-8">
              <Icon name="MousePointerClick" className="w-16 h-16 mb-4 text-text-tertiary" />
              <h3 className="text-lg font-bold text-text-primary mb-2">Selecione uma Unidade</h3>
              <p className="text-sm text-text-secondary">
                Clique em uma unidade na lista ao lado para ver os detalhes
              </p>
            </div>
          ) : (
            <div className="h-full flex flex-col">
              {/* Header do Painel */}
              <div className="px-5 py-3.5 border-b border-border-secondary bg-bg-tertiary">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon name="Building2" className="w-5 h-5 text-brand-pink" />
                    <h2 className="text-lg font-bold text-text-primary">
                      {selectedUnit.unit_name}
                    </h2>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleOpenKeyModal()}
                      className="p-2 text-accent-primary hover:bg-accent-primary/10 rounded-md transition-colors"
                      title="Gerenciar Keys"
                    >
                      <Icon name="Key" className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleOpenUserModal()}
                      className="p-2 text-brand-cyan hover:bg-brand-cyan/10 rounded-md transition-colors"
                      title="Adicionar Usuário"
                    >
                      <Icon name="UserPlus" className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleOpenModal(selectedUnit)}
                      className="p-2 text-accent-primary hover:bg-accent-primary/10 rounded-md transition-colors"
                      title="Editar Unidade"
                    >
                      <Icon name="Edit" className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleOpenDeleteConfirm(selectedUnit)}
                      className="p-2 text-danger hover:bg-danger/10 rounded-md transition-colors"
                      title="Excluir Unidade"
                    >
                      <Icon name="Trash2" className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Tabs */}
              <div className="border-b border-border-secondary bg-bg-secondary">
                <nav className="flex px-4">
                  <button
                    onClick={() => setActiveDetailTab('info')}
                    className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${activeDetailTab === 'info'
                      ? 'text-accent-primary border-accent-primary'
                      : 'text-text-secondary border-transparent hover:text-text-primary hover:border-border-secondary'
                      }`}
                  >
                    <Icon name="Info" className="inline w-4 h-4 mr-1.5" />
                    Informações
                  </button>
                  <button
                    onClick={() => setActiveDetailTab('users')}
                    className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${activeDetailTab === 'users'
                      ? 'text-accent-primary border-accent-primary'
                      : 'text-text-secondary border-transparent hover:text-text-primary hover:border-border-secondary'
                      }`}
                  >
                    <Icon name="Users" className="inline w-4 h-4 mr-1.5" />
                    Usuários
                  </button>
                  <button
                    onClick={() => setActiveDetailTab('keys')}
                    className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${activeDetailTab === 'keys'
                      ? 'text-accent-primary border-accent-primary'
                      : 'text-text-secondary border-transparent hover:text-text-primary hover:border-border-secondary'
                      }`}
                  >
                    <Icon name="Key" className="inline w-4 h-4 mr-1.5" />
                    Keys
                  </button>
                  <button
                    onClick={() => setActiveDetailTab('modules')}
                    className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${activeDetailTab === 'modules'
                      ? 'text-accent-primary border-accent-primary'
                      : 'text-text-secondary border-transparent hover:text-text-primary hover:border-border-secondary'
                      }`}
                  >
                    <Icon name="Package" className="inline w-4 h-4 mr-1.5" />
                    Módulos
                  </button>
                  {profile?.role === 'super_admin' && (
                    <button
                      onClick={() => setActiveDetailTab('plans')}
                      className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${activeDetailTab === 'plans'
                        ? 'text-accent-primary border-accent-primary'
                        : 'text-text-secondary border-transparent hover:text-text-primary hover:border-border-secondary'
                        }`}
                    >
                      <Icon name="CreditCard" className="inline w-4 h-4 mr-1.5" />
                      Planos
                    </button>
                  )}
                </nav>
              </div>

              {/* Conteúdo das Tabs */}
              <div className="flex-1 overflow-y-auto p-4">

                {/* Tab: Informações */}
                {activeDetailTab === 'info' && (
                  <div>
                    {/* Card: Dados da Unidade */}
                    <div className="bg-white border border-border-secondary rounded-lg overflow-hidden">
                      <div className="px-3 py-2 bg-bg-tertiary border-b border-border-secondary flex items-center justify-between">
                        <h3 className="text-xs font-bold text-text-primary flex items-center gap-2">
                          <Icon name="Info" className="w-3.5 h-3.5 text-accent-primary" />
                          Dados da Unidade
                        </h3>
                        {/* Toggle Ativar/Inativar */}
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-medium ${selectedUnit.is_active ? 'text-success' : 'text-text-tertiary'}`}>
                            {selectedUnit.is_active ? 'Ativa' : 'Inativa'}
                          </span>
                          <button
                            onClick={() => handleToggleUnitStatus(selectedUnit.id, selectedUnit.is_active)}
                            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-accent-primary focus:ring-offset-2 ${selectedUnit.is_active ? 'bg-success' : 'bg-border-secondary'
                              }`}
                            role="switch"
                            aria-checked={selectedUnit.is_active}
                          >
                            <span
                              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${selectedUnit.is_active ? 'translate-x-5' : 'translate-x-0.5'
                                }`}
                            />
                          </button>
                        </div>
                      </div>
                      <div className="p-4">
                        {/* Seção: Identificação */}
                        <div className="mb-4">
                          <h4 className="text-xs font-bold text-text-secondary uppercase tracking-wide mb-2 pb-1 border-b border-border-secondary">Identificação</h4>
                          <div className="grid grid-cols-3 gap-3 mb-2">
                            <div>
                              <span className="text-xs font-medium text-text-tertiary block mb-0.5">Nome</span>
                              <span className="text-sm text-text-primary font-semibold">{selectedUnit.unit_name}</span>
                            </div>
                            <div>
                              <span className="text-xs font-medium text-text-tertiary block mb-0.5">Código</span>
                              <div
                                onClick={() => handleCopyToClipboard(selectedUnit.unit_code, {} as any)}
                                className="relative inline-flex items-center gap-1.5 px-2 py-0.5 transition-colors rounded cursor-pointer bg-bg-tertiary hover:bg-accent-primary/10 group/code"
                                title="Clique para copiar"
                              >
                                <span className="text-sm font-mono text-accent-primary font-semibold">{selectedUnit.unit_code}</span>
                                <Icon name="Copy" className="w-3 h-3 text-text-tertiary group-hover/code:text-accent-primary transition-colors" />
                                {copiedValue === selectedUnit.unit_code && (
                                  <span className="absolute -top-8 right-0 bg-success text-white text-xs px-2 py-1 rounded shadow-lg whitespace-nowrap z-10">
                                    Copiado!
                                  </span>
                                )}
                              </div>
                            </div>
                            <div>
                              <span className="text-xs font-medium text-text-tertiary block mb-0.5">Unit ID</span>
                              <div
                                onClick={(e) => handleCopyToClipboard(selectedUnit.id, e)}
                                className="relative inline-flex items-center gap-1.5 px-2 py-0.5 transition-colors rounded cursor-pointer bg-bg-tertiary hover:bg-accent-primary/10 group/id border border-transparent hover:border-accent-primary/20"
                                title="Clique para copiar Unit ID"
                              >
                                <span className="text-xs font-mono text-text-primary font-medium truncate select-all max-w-[120px]">
                                  {selectedUnit.id}
                                </span>
                                <Icon name="Copy" className="w-3 h-3 text-text-tertiary group-hover/id:text-accent-primary transition-colors flex-shrink-0" />
                                {copiedValue === selectedUnit.id && (
                                  <span className="absolute -top-8 right-0 bg-success text-white text-xs px-2 py-1 rounded shadow-lg whitespace-nowrap z-10">
                                    Copiado!
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Seção: Informações da Empresa */}
                        <div className="mb-4">
                          <h4 className="text-xs font-bold text-text-secondary uppercase tracking-wide mb-2 pb-1 border-b border-border-secondary">Informações da Empresa</h4>
                          <div className="space-y-2.5">
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <span className="text-xs font-medium text-text-tertiary block mb-0.5">Razão Social</span>
                                <span className="text-sm text-text-primary font-semibold">{selectedUnit.razao_social || '-'}</span>
                              </div>
                              <div>
                                <span className="text-xs font-medium text-text-tertiary block mb-0.5">CNPJ</span>
                                <span className="text-sm text-text-primary font-semibold font-mono">{formatCNPJ(selectedUnit.cnpj) || '-'}</span>
                              </div>
                            </div>
                            <div>
                              <span className="text-xs font-medium text-text-tertiary block mb-0.5">Endereço</span>
                              <span className="text-sm text-text-primary">{selectedUnit.endereco || '-'}</span>
                            </div>
                          </div>
                        </div>

                        {/* Seção: Contato */}
                        <div>
                          <h4 className="text-xs font-bold text-text-secondary uppercase tracking-wide mb-2 pb-1 border-b border-border-secondary">Contato</h4>
                          <div className="grid grid-cols-3 gap-3">
                            <div>
                              <span className="text-xs font-medium text-text-tertiary block mb-0.5">Responsável</span>
                              <span className="text-sm text-text-primary font-semibold">{selectedUnit.responsavel || '-'}</span>
                            </div>
                            <div>
                              <span className="text-xs font-medium text-text-tertiary block mb-0.5">Telefone</span>
                              <span className="text-sm text-text-primary font-semibold">{selectedUnit.contato || '-'}</span>
                            </div>
                            <div>
                              <span className="text-xs font-medium text-text-tertiary block mb-0.5">E-mail</span>
                              <span className="text-sm text-text-primary">{selectedUnit.email || '-'}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                  </div>
                )}

                {/* Tab: Usuários */}
                {activeDetailTab === 'users' && (
                  <div className="bg-white border border-border-secondary rounded-lg overflow-hidden">
                    <div className="px-3 py-2 bg-bg-tertiary border-b border-border-secondary flex items-center justify-between">
                      <h3 className="text-xs font-bold text-text-primary flex items-center gap-2">
                        <Icon name="Users" className="w-3.5 h-3.5 text-brand-cyan" />
                        Usuários ({unitUsers.length})
                      </h3>
                    </div>
                    <div className="p-3">
                      {unitUsers.length === 0 ? (
                        <div className="text-center py-6 text-text-secondary text-xs">
                          <Icon name="Users" className="w-8 h-8 mx-auto mb-2 text-text-tertiary" />
                          <p>Nenhum usuário cadastrado nesta unidade</p>
                        </div>
                      ) : (
                        <div className="space-y-2 max-h-[400px] overflow-y-auto">
                          {unitUsers.map((user) => {
                            const loginStatus = userLoginStatus[user.id];
                            const isOnline = loginStatus?.isOnline || false;

                            return (
                              <div
                                key={user.id}
                                onClick={() => handleOpenUserModal(user)}
                                className="flex items-center gap-3 p-2 border border-border-secondary rounded-lg hover:border-brand-cyan/30 hover:bg-brand-cyan/5 transition-colors cursor-pointer group"
                              >
                                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-brand-cyan/10 flex items-center justify-center">
                                  <Icon name="User" className="w-4 h-4 text-brand-cyan" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-semibold text-text-primary truncate">{user.full_name}</p>
                                  <p className="text-xs text-text-secondary truncate">{user.email}</p>
                                </div>
                                <div className="flex-shrink-0 flex items-center gap-2">
                                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${user.role === 'admin' ? 'bg-accent-primary/10 text-accent-primary' :
                                    user.role === 'super_admin' ? 'bg-purple-100 text-purple-700' :
                                      'bg-bg-tertiary text-text-secondary'
                                    }`}>
                                    {user.role === 'super_admin' ? 'Super Admin' : user.role === 'admin' ? 'Admin' : 'User'}
                                  </span>
                                  <div className="flex items-center gap-1">
                                    <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-success' : 'bg-text-tertiary'}`} />
                                    <span className="text-xs font-medium" style={{ color: isOnline ? 'var(--success)' : 'var(--text-tertiary)' }}>
                                      {isOnline ? 'Online' : 'Offline'}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Tab: Keys */}
                {activeDetailTab === 'keys' && (
                  <div className="space-y-4">
                    {unitKeys.length === 0 ? (
                      <div className="bg-white border border-border-secondary rounded-lg p-8 flex flex-col items-center justify-center text-center">
                        <div className="w-12 h-12 rounded-full bg-bg-tertiary flex items-center justify-center mb-3">
                          <Icon name="KeyRound" className="w-6 h-6 text-text-tertiary" />
                        </div>
                        <h3 className="text-sm font-medium text-text-primary mb-1">Nenhuma chave configurada</h3>
                        <p className="text-xs text-text-secondary max-w-[250px]">
                          Adicione as chaves de integração para conectar esta unidade aos serviços externos.
                        </p>
                        <button
                          onClick={() => handleOpenKeyModal()}
                          className="mt-4 px-4 py-2 text-xs font-medium text-white bg-accent-primary rounded-md hover:bg-accent-secondary transition-colors flex items-center gap-2"
                        >
                          <Icon name="Plus" className="w-3.5 h-3.5" />
                          Configurar Chaves
                        </button>
                      </div>
                    ) : (
                      unitKeys.map((keySet) => {
                        // Definição de todos os campos para exibir em grid
                        const keyFields = [
                          { label: 'Código', value: keySet.codigo, icon: 'Hash', fullWidth: false },
                          { label: 'Instância', value: keySet.istancia, icon: 'Database', fullWidth: false },
                          { label: 'Recrutadora', value: keySet.recrutadora, icon: 'UserSearch', fullWidth: false },
                          { label: 'Bot ID', value: keySet.botID, icon: 'Bot', fullWidth: false },
                          { label: 'Trigger Name', value: keySet.triggerName, icon: 'Zap', fullWidth: false },
                          { label: 'Organization ID', value: keySet.organizationID, icon: 'Building2', fullWidth: false },
                          { label: 'Contato Profissionais', value: keySet.contato_profissionais, icon: 'MessageSquare', fullWidth: true },
                          { label: 'Umbler', value: keySet.umbler, icon: 'Server', fullWidth: true },
                          { label: 'Contato Atendimento', value: keySet.contato_atend, icon: 'MessageCircle', fullWidth: true },
                          { label: 'Pós Vendas', value: keySet.pos_vendas, icon: 'ShoppingBag', fullWidth: true },
                          { label: 'Conexão', value: keySet.conexao, icon: 'Link', fullWidth: true },
                          { label: 'ID Recruta', value: keySet.id_recruta, icon: 'UserPlus', fullWidth: false },
                        ];

                        return (
                          <div
                            key={keySet.id}
                            className="bg-white border border-border-secondary rounded-lg overflow-hidden shadow-sm"
                          >
                            {/* Header da Chave */}
                            <div className="px-4 py-3 bg-bg-tertiary border-b border-border-secondary flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="p-1.5 rounded bg-accent-primary/10">
                                  <Icon name="Key" className="w-4 h-4 text-accent-primary" />
                                </div>
                                <div>
                                  <h3 className="text-sm font-bold text-text-primary">Configuração de Integração</h3>
                                  <p className="text-[10px] text-text-tertiary font-mono">ID: {keySet.id}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-full ${keySet.is_active
                                  ? 'bg-success/10 text-success border border-success/20'
                                  : 'bg-text-tertiary/10 text-text-tertiary border border-text-tertiary/20'
                                  }`}>
                                  {keySet.is_active ? 'Ativa' : 'Inativa'}
                                </span>
                                <button
                                  onClick={() => handleOpenKeyModal(keySet)}
                                  className="p-1.5 text-text-secondary hover:text-accent-primary hover:bg-accent-primary/10 rounded transition-colors"
                                  title="Editar Chaves"
                                >
                                  <Icon name="Edit" className="w-4 h-4" />
                                </button>
                              </div>
                            </div>

                            {/* Grid de Campos */}
                            <div className="p-4">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {keyFields.map((field, idx) => (
                                  <div
                                    key={idx}
                                    className={`relative group ${field.fullWidth ? 'md:col-span-2' : ''}`}
                                  >
                                    <label className="block text-[10px] font-semibold text-text-secondary uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                                      <Icon name={field.icon as any} className="w-3 h-3" />
                                      {field.label}
                                    </label>
                                    <div className="relative flex items-center">
                                      <div className="w-full px-3 py-2 text-xs font-mono bg-bg-tertiary/50 border border-border-secondary rounded-md text-text-primary min-h-[34px] flex items-center">
                                        {field.value || <span className="text-text-tertiary italic opacity-50">Não configurado</span>}
                                      </div>
                                      {field.value && (
                                        <button
                                          onClick={(e) => handleCopyToClipboard(String(field.value), e)}
                                          className="absolute right-1 p-1.5 text-text-tertiary hover:text-accent-primary hover:bg-accent-primary/10 rounded transition-colors opacity-0 group-hover:opacity-100"
                                          title="Copiar valor"
                                        >
                                          <Icon name="Copy" className="w-3.5 h-3.5" />
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>

                              {/* Footer com Datas */}
                              <div className="flex items-center justify-end gap-4 mt-4 pt-3 border-t border-border-secondary text-[10px] text-text-tertiary">
                                <span className="flex items-center gap-1">
                                  <Icon name="Clock" className="w-3 h-3" />
                                  Criado em: {new Date(keySet.created_at).toLocaleDateString('pt-BR')}
                                </span>
                                {keySet.updated_at && (
                                  <span className="flex items-center gap-1">
                                    <Icon name="RefreshCw" className="w-3 h-3" />
                                    Atualizado: {new Date(keySet.updated_at).toLocaleDateString('pt-BR')}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}

                {/* Tab: Módulos */}
                {activeDetailTab === 'modules' && (
                  <div className="space-y-3">
                    <div className="bg-white border border-border-secondary rounded-lg overflow-hidden">
                      <div className="px-3 py-2 bg-bg-tertiary border-b border-border-secondary flex items-center justify-between">
                        <h3 className="text-xs font-bold text-text-primary flex items-center gap-2">
                          <Icon name="Layers" className="w-3.5 h-3.5 text-brand-purple" />
                          Módulos da Unidade ({unitModuleIds.length}/{allModules.filter(m => {
                            const profiles = m.allowed_profiles || [];
                            return profiles.includes('admin') || profiles.includes('user') || profiles.length === 0;
                          }).length})
                        </h3>
                        {savingModules && (
                          <span className="text-xs text-brand-purple flex items-center gap-1">
                            <Icon name="Loader2" className="w-3 h-3 animate-spin" />
                            Salvando...
                          </span>
                        )}
                      </div>
                      <div className="p-3">
                        {allModules.filter(m => {
                          const profiles = m.allowed_profiles || [];
                          // Mostra se tiver 'admin' OU 'user' permitido
                          // Ou se não tiver restrição de perfil definida (assumindo público/padrão)
                          return profiles.includes('admin') || profiles.includes('user') || profiles.length === 0;
                        }).length === 0 ? (
                          <div className="text-center py-6 text-text-secondary text-xs">
                            <Icon name="Layers" className="w-8 h-8 mx-auto mb-2 text-text-tertiary" />
                            <p>Nenhum módulo disponível para esta unidade</p>
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            {allModules
                              .filter(m => {
                                const profiles = m.allowed_profiles || [];
                                return profiles.includes('admin') || profiles.includes('user') || profiles.length === 0;
                              })
                              .map((module) => {
                                const isActive = unitModuleIds.includes(module.id);
                                return (
                                  <div
                                    key={module.id}
                                    className={`p-3 border rounded-lg bg-white transition-colors ${isActive
                                      ? 'border-accent-primary/50 bg-accent-primary/5'
                                      : 'border-border-secondary hover:border-accent-primary/20'
                                      }`}
                                  >
                                    <div className="flex items-center justify-between gap-3">
                                      <div className="flex items-center gap-3 flex-1 min-w-0">
                                        <Icon
                                          name={module.icon_name || 'Box'}
                                          className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-accent-primary' : 'text-text-tertiary'}`}
                                        />
                                        <div className="flex-1 min-w-0">
                                          <p className={`text-sm font-semibold truncate ${isActive ? 'text-accent-primary' : 'text-text-primary'}`}>
                                            {module.name}
                                          </p>
                                          {module.description && (
                                            <p className="text-xs text-text-tertiary line-clamp-1 mt-0.5">
                                              {module.description}
                                            </p>
                                          )}
                                        </div>
                                      </div>
                                      <button
                                        onClick={() => handleToggleModule(module.id)}
                                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-accent-primary focus:ring-offset-2 ${isActive ? 'bg-accent-primary' : 'bg-gray-200'
                                          }`}
                                        disabled={savingModules}
                                      >
                                        <span
                                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isActive ? 'translate-x-6' : 'translate-x-1'
                                            }`}
                                        />
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Tab: Planos (Somente Super Admin) */}
                {activeDetailTab === 'plans' && selectedUnit && profile?.role === 'super_admin' && (
                  <div className="bg-white border border-border-secondary rounded-lg overflow-hidden">
                    <div className="px-3 py-2 bg-bg-tertiary border-b border-border-secondary flex items-center justify-between">
                      <h3 className="text-xs font-bold text-text-primary flex items-center gap-2">
                        <Icon name="CreditCard" className="w-3.5 h-3.5 text-accent-primary" />
                        Gestão de Planos da Unidade
                      </h3>
                    </div>
                    <div className="p-4">
                      <UnitPlanManager unitId={selectedUnit.id} />
                    </div>
                  </div>
                )}



              </div>
            </div>
          )}
        </div>
      </div>

      <UnitFormModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onSave={handleSaveUnit}
        unit={editingUnit}
        onDelete={handleDeleteFromModal}
      />

      <UserFormModal
        isOpen={isUserModalOpen}
        onClose={handleCloseUserModal}
        onSave={handleSaveUser}
        user={editingUser}
        forceUnitId={selectedUnit?.id}
      />

      {/* Modal de Edição de Key */}
      {
        isKeyModalOpen && (
          <KeyFormModal
            isOpen={isKeyModalOpen}
            onClose={handleCloseKeyModal}
            onSave={handleSaveKey}
            onDelete={editingKey ? () => handleDeleteKey(editingKey.id) : undefined}
            keyData={editingKey}
          />
        )
      }

      <DeleteConfirmationModal
        unit={unitToDelete}
        onClose={handleCloseDeleteConfirm}
        onConfirm={handleDeleteUnit}
      />
    </div >
  );
};

export default ManageUnitsPage;