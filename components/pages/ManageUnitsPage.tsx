import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { fetchAllUnits, createUnit, updateUnit, deleteUnit } from '../../services/units/units.service';
import { fetchUsersForUnit, updateUser, createUser } from '../../services/auth/users.service';
import { activityLogger } from '../../services/utils/activityLogger.service';
import { Unit, UnitKey, Module } from '../../types';
import { Icon } from '../ui/Icon';
import { useAuth } from '../../contexts/AuthContext';
import { fetchUnitKeys, createUnitKey, updateUnitKey, deleteUnitKey, upsertUnitKeyValue } from '../../services/units/unitKeys.service';
import { listUnitKeysColumns, ColumnInfo } from '../../services/units/unitKeysAdmin.service';
import { User as UserType, Profile as ProfileType } from '../../types';
import { UserFormModal } from '../ui/UserFormModal';
import { fetchUnitModuleIds, assignModulesToUnit } from '../../services/units/unitModules.service';
import { fetchAllModules } from '../../services/modules/modules.service';

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
  });
  const [error, setError] = useState('');
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [unitUsers, setUnitUsers] = useState<{ id: string; full_name: string; email: string; role: string }[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<'dados' | 'usuarios' | 'modulos' | 'keys'>('dados');
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
      setFormData({ unit_name: unit.unit_name, unit_code: unit.unit_code });
    } else {
      setFormData({ unit_name: '', unit_code: '' });
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
          const system = new Set(['id','unit_id','is_active','created_at','updated_at']);
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
  }, [unit, isOpen]);

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
      <div className="w-full max-w-3xl p-6 mx-4 bg-bg-secondary rounded-lg shadow-lg" onMouseDown={(e)=>e.stopPropagation()}>
        <div className="flex items-center justify-between pb-3 border-b border-border-primary">
          <h2 className="text-xl font-bold text-text-primary">{unit ? (unit.unit_name || 'Editar Unidade') : 'Adicionar Nova Unidade'}</h2>
          <button onClick={onClose} className="p-1 rounded-full text-text-secondary hover:bg-bg-tertiary">
            <Icon name="close" />
          </button>
        </div>
        {/* Abas (somente em edição e para super_admin exibe Keys) */}
        {unit && (
          <div className="mt-4 border-b border-border-secondary flex items-center justify-between">
            <div className="flex gap-2">
              <button type="button" className={`px-3 py-2 text-sm rounded-t-md ${activeTab==='dados'?'bg-bg-tertiary text-text-primary':'text-text-secondary hover:text-text-primary'}`} onClick={()=>setActiveTab('dados')}>Dados</button>
              <button type="button" className={`px-3 py-2 text-sm rounded-t-md ${activeTab==='usuarios'?'bg-bg-tertiary text-text-primary':'text-text-secondary hover:text-text-primary'}`} onClick={()=>setActiveTab('usuarios')}>Usuários</button>
              <button type="button" className={`px-3 py-2 text-sm rounded-t-md ${activeTab==='modulos'?'bg-bg-tertiary text-text-primary':'text-text-secondary hover:text-text-primary'}`} onClick={()=>setActiveTab('modulos')}>Módulos</button>
              {profile?.role === 'super_admin' && (
                <button type="button" className={`px-3 py-2 text-sm rounded-t-md ${activeTab==='keys'?'bg-bg-tertiary text-text-primary':'text-text-secondary hover:text-text-primary'}`} onClick={()=>setActiveTab('keys')}>Keys</button>
              )}
            </div>
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
                      .sort((a,b)=> a.ordinal_position - b.ordinal_position)
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
                <Icon name="add" className="w-5 h-5 mr-1 inline" />
                {isCreatingKey ? 'Criando…' : 'Adicionar Key'}
              </button>
            )}
          </div>
        )}

        {activeTab === 'dados' && (
          <form onSubmit={handleSubmit} className="mt-4 space-y-6">
            {error && <p className="text-sm text-center text-danger bg-danger/10 p-2 rounded-md">{error}</p>}
            <div>
              <label htmlFor="unit_name" className="block text-sm font-medium text-text-secondary">Nome da Unidade</label>
              <input type="text" name="unit_name" id="unit_name" value={formData.unit_name} onChange={handleChange} required className="w-full px-3 py-2 mt-1 border rounded-md bg-bg-secondary border-border-secondary focus:ring-accent-primary focus:border-accent-primary" />
            </div>
            <div>
              <label htmlFor="unit_code" className="block text-sm font-medium text-text-secondary">Código da Unidade</label>
              <input type="text" name="unit_code" id="unit_code" value={formData.unit_code} onChange={handleChange} required className="w-full px-3 py-2 mt-1 border rounded-md bg-bg-secondary border-border-secondary focus:ring-accent-primary focus:border-accent-primary" />
            </div>
            <div className="flex items-center justify-between pt-4">
              <div>
                {unit && (
                  <button
                    type="button"
                    onClick={() => onDelete(unit.id)}
                    className="flex items-center px-4 py-2 text-sm font-medium text-white transition-colors bg-danger rounded-md hover:bg-red-700"
                  >
                    <Icon name="delete" className="w-5 h-5 mr-2" />
                    Excluir
                  </button>
                )}
              </div>
              <div className="flex space-x-3">
                <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium border rounded-md text-text-secondary border-border-secondary hover:bg-bg-tertiary">Cancelar</button>
                <button type="submit" disabled={isSubmitting} className="px-4 py-2 text-sm font-medium text-white border border-transparent rounded-md bg-accent-primary hover:bg-accent-secondary disabled:opacity-50 disabled:cursor-not-allowed">
                  {isSubmitting ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </div>
          </form>
        )}

        {unit && activeTab === 'usuarios' && (
          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-text-primary flex items-center">Usuários Vinculados</h3>
              <button onClick={() => handleOpenUserModal()} className="flex items-center px-4 py-2 text-sm font-medium text-white rounded-md bg-accent-primary hover:bg-accent-secondary">
                <Icon name="add" className="w-5 h-5 mr-2" />
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
                  <li key={u.id} className="px-3 py-2 text-sm flex flex-col sm:flex-row sm:items-center sm:justify-between bg-bg-tertiary/30 hover:bg-bg-tertiary transition-colors" onDoubleClick={()=>handleOpenUserModal(u)}>
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
          <div className="mt-4">
            <div className="mb-4">
              <h3 className="text-sm font-semibold text-text-primary mb-1">Módulos Disponíveis para esta Unidade</h3>
              <p className="text-xs text-text-secondary">Selecione os módulos que os usuários desta unidade poderão acessar.</p>
            </div>
            
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[400px] overflow-y-auto p-1">
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
                        className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                          isSelected
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
                          className="mt-1 w-4 h-4 rounded border-border-secondary text-accent-primary focus:ring-2 focus:ring-accent-primary/20"
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
          <div className="mt-4 space-y-4">
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
                              <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${
                                item.is_active 
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
            onClick={async ()=>{
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
            onSubmit={async (payload)=>{ await updateUnitKey(String(item.id), payload as any); await onUpdated(); }}
            onDelete={async ()=>{ if (confirm('Remover esta key?')) { await deleteUnitKey(String(item.id)); await onDeleted(); } }}
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
          <button disabled={loading || options.length===0} onClick={() => onConfirm(selected, typedValue)} className={`px-3 py-1.5 text-sm rounded-md text-white ${loading || options.length===0 ? 'opacity-60 cursor-not-allowed bg-accent-primary' : 'bg-accent-primary hover:bg-accent-secondary'}`}>Confirmar</button>
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
    <form ref={formEl} className="space-y-4" onSubmit={async (e)=>{ e.preventDefault(); setError(''); await onSubmit(form); }}>
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


const ITEMS_PER_PAGE = 10;

const ManageUnitsPage: React.FC = () => {
  const [units, setUnits] = useState<Unit[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState<Unit | null>(null);
  const [unitToDelete, setUnitToDelete] = useState<Unit | null>(null);
  const [unitUserCounts, setUnitUserCounts] = useState<Record<string, number>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [copiedValue, setCopiedValue] = useState<string | null>(null);

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

  const loadUnits = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const fetchedUnits = await fetchAllUnits();
      setUnits(fetchedUnits);
    } catch (err: any) {
      setError('Falha ao carregar as unidades.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUnits();
  }, [loadUnits]);

  const filteredUnits = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return units;
    return units.filter((u) => {
      const name = (u.unit_name || '').toLowerCase();
      const code = (u.unit_code || '').toLowerCase();
      return name.includes(term) || code.includes(term);
    });
  }, [units, searchTerm]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

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
          profile.email || profile.name,
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
        profile.email || profile.name,
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
    if(unit) {
      handleCloseModal();
      handleOpenDeleteConfirm(unit);
    }
  };

  return (
    <div className="p-6 bg-bg-secondary rounded-lg shadow-md">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-text-primary">Unidades</h1>
        <div className="flex items-center gap-3">
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
      
      {isLoading ? (
         <div className="flex items-center justify-center h-64">
             <div className="w-16 h-16 border-4 border-t-4 border-gray-200 rounded-full animate-spin border-t-accent-primary"></div>
         </div>
      ) : error ? (
        <div className="p-4 text-danger bg-danger/10 border border-danger/30 rounded-md">{error}</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-border-primary">
            <thead className="bg-bg-tertiary">
              <tr>
                <th scope="col" className="px-6 py-2 text-xs font-medium tracking-wider text-left uppercase text-text-secondary">Nome da Unidade</th>
                <th scope="col" className="px-6 py-2 text-xs font-medium tracking-wider text-left uppercase text-text-secondary">Código</th>
                <th scope="col" className="px-6 py-2 text-xs font-medium tracking-wider text-left uppercase text-text-secondary">Unit ID</th>
                <th scope="col" className="px-6 py-2 text-xs font-medium tracking-wider text-left uppercase text-text-secondary">Usuários</th>
                <th scope="col" className="px-6 py-2 text-xs font-medium tracking-wider text-right uppercase text-text-secondary">Ações</th>
              </tr>
            </thead>
            <tbody className="bg-bg-secondary divide-y divide-border-primary">
              {filteredUnits.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-6 text-center text-sm text-text-secondary">Nenhuma unidade encontrada.</td>
                </tr>
              )}
              {paginatedUnits.map((unit) => (
                <tr 
                  key={unit.id}
                  onDoubleClick={() => handleOpenModal(unit)}
                  className="transition-colors cursor-pointer hover:bg-bg-tertiary"
                >
                  <td className="px-6 py-2 whitespace-nowrap text-sm font-medium text-text-primary">{unit.unit_name}</td>
                  <td 
                    className="px-6 py-2 whitespace-nowrap text-sm text-text-secondary font-mono cursor-pointer hover:bg-accent-primary/10 transition-colors relative group"
                    onClick={(e) => handleCopyToClipboard(unit.unit_code, e)}
                    title="Clique para copiar"
                  >
                    {unit.unit_code}
                    {copiedValue === unit.unit_code && (
                      <span className="absolute -top-8 left-1/2 -translate-x-1/2 bg-success text-white text-xs px-2 py-1 rounded shadow-lg whitespace-nowrap">
                        Copiado!
                      </span>
                    )}
                  </td>
                  <td 
                    className="px-6 py-2 whitespace-nowrap text-xs text-text-tertiary font-mono cursor-pointer hover:bg-accent-primary/10 transition-colors relative group"
                    onClick={(e) => handleCopyToClipboard(unit.id, e)}
                    title="Clique para copiar"
                  >
                    {unit.id}
                    {copiedValue === unit.id && (
                      <span className="absolute -top-8 left-1/2 -translate-x-1/2 bg-success text-white text-xs px-2 py-1 rounded shadow-lg whitespace-nowrap">
                        Copiado!
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-2 whitespace-nowrap text-sm text-text-secondary">{unitUserCounts[unit.id] ?? 0}</td>
                  <td className="px-6 py-2 text-sm font-medium text-right whitespace-nowrap">
                    <div className="flex items-center justify-end space-x-1">
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleOpenModal(unit); }} 
                        className="p-2 rounded-md text-accent-primary hover:bg-accent-primary/10 transition-colors"
                        title="Editar Unidade"
                      >
                        <Icon name="edit" className="w-5 h-5" />
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleOpenDeleteConfirm(unit); }} 
                        className="p-2 rounded-md text-danger hover:bg-danger/10 transition-colors"
                        title="Excluir Unidade"
                      >
                        <Icon name="delete" className="w-5 h-5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredUnits.length > 0 && (
            <div className="flex flex-col items-center justify-between gap-3 mt-4 text-sm text-text-secondary sm:flex-row">
              <span>Mostrando {pageStart}–{pageEnd} de {filteredUnits.length}</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 text-sm font-medium border rounded-md text-text-secondary border-border-secondary disabled:opacity-50 disabled:cursor-not-allowed hover:bg-bg-tertiary"
                >
                  Anterior
                </button>
                <span>Página {currentPage} de {totalPages}</span>
                <button
                  type="button"
                  onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages || filteredUnits.length === 0}
                  className="px-3 py-1.5 text-sm font-medium border rounded-md text-text-secondary border-border-secondary disabled:opacity-50 disabled:cursor-not-allowed hover:bg-bg-tertiary"
                >
                  Próxima
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <UnitFormModal 
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onSave={handleSaveUnit}
        unit={editingUnit}
        onDelete={handleDeleteFromModal}
      />

      <DeleteConfirmationModal
        unit={unitToDelete}
        onClose={handleCloseDeleteConfirm}
        onConfirm={handleDeleteUnit}
      />
    </div>
  );
};

export default ManageUnitsPage;