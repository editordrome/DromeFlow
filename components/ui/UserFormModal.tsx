import React, { useState, useEffect } from 'react';
import { fetchAllUnits } from '../../services/units/units.service';
import { fetchAllModules } from '../../services/modules/modules.service';
import { fetchUserAssignments } from '../../services/auth/users.service';
import { User, Profile, UserRole, Unit, Module } from '../../types';
import { Icon } from './Icon';

export type FullUser = User & Profile;

type UserDataPayload = Partial<FullUser> & {
  password?: string;
  unit_ids?: string[];
  module_ids?: string[];
};

export const UserFormModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onSave: (user: UserDataPayload) => void;
  user: FullUser | null;
  currentAdminProfile?: Profile | null;
}> = ({ isOpen, onClose, onSave, user, currentAdminProfile }) => {
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    password: '',
    role: UserRole.USER,
  });
  const [error, setError] = useState('');
  const [allUnits, setAllUnits] = useState<Unit[]>([]);
  const [allModules, setAllModules] = useState<Module[]>([]);
  const [adminModuleIds, setAdminModuleIds] = useState<Set<string>>(new Set());
  const [selectedUnits, setSelectedUnits] = useState<Set<string>>(new Set());
  const [selectedModules, setSelectedModules] = useState<Set<string>>(new Set());
  const [isLoadingAssignments, setIsLoadingAssignments] = useState(false);
  const [readOnlyModuleIds, setReadOnlyModuleIds] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<'dados' | 'units' | 'modules'>('dados');
  const [allModulesCache, setAllModulesCache] = useState<Module[]>([]);
  const [selectedUnitForModules, setSelectedUnitForModules] = useState<string>(''); // Unidade selecionada na aba Módulos
  const [modulesByUnit, setModulesByUnit] = useState<Map<string, Set<string>>>(new Map()); // Map: unitId -> Set<moduleId>

  // Carrega dados iniciais (unidades e módulos completos)
  useEffect(() => {
    const loadPrerequisites = async () => {
      if (!isOpen) return;
      setIsLoadingAssignments(true);
      setError('');
      try {
        const [units, modules] = await Promise.all([
          fetchAllUnits(),
          fetchAllModules(),
        ]);

        // Armazena todos os módulos para filtro dinâmico
        setAllModulesCache(modules);

        // Carrega as atribuições do usuário sendo editado (se existir)
        if (user) {
          const { unit_ids, module_ids } = await fetchUserAssignments(user.id);
          setSelectedUnits(new Set(unit_ids));
          setSelectedModules(new Set(module_ids));
        } else {
          setSelectedUnits(new Set());
          setSelectedModules(new Set());
        }

        // Admin: filtra apenas as unidades permitidas
        if (currentAdminProfile && currentAdminProfile.role === 'admin') {
          try {
            const res = await (await import('../../services/supabaseClient')).supabase
              .from('user_units')
              .select('unit_id')
              .eq('user_id', currentAdminProfile.id);
            if (!res.error) {
              const adminUnitIds = new Set((res.data || []).map((r: any) => r.unit_id));
              setAllUnits(units.filter(u => adminUnitIds.has(u.id)));
            } else {
              setAllUnits(units);
            }
          } catch {
            setAllUnits(units);
          }
        } else {
          // Super admin vê todas as unidades
          setAllUnits(units);
        }

      } catch (e) {
        setError('Falha ao carregar dados para o formulário.');
      } finally {
        setIsLoadingAssignments(false);
      }
    };

    if (user) {
      // Se um admin está tentando editar um super_admin, força o role para admin
      const roleToSet = (currentAdminProfile?.role === 'admin' && user.role === UserRole.SUPER_ADMIN)
        ? UserRole.ADMIN
        : user.role;

      setFormData({
        full_name: user.full_name,
        email: user.email,
        password: '',
        role: roleToSet,
      });
    } else {
      setFormData({ full_name: '', email: '', password: '', role: UserRole.USER });
    }
    loadPrerequisites();
  }, [user, isOpen]);

  // Carrega módulos do usuário (sem relação unit_id, apenas para pré-selecionar checkboxes)
  useEffect(() => {
    const loadUserModules = async () => {
      if (!isOpen || !user) return;

      try {
        const { module_ids } = await fetchUserAssignments(user.id);
        console.log('[UserFormModal] Módulos carregados do usuário:', module_ids);
        setSelectedModules(new Set(module_ids));

        // Distribui módulos do usuário entre as unidades dele
        // (apenas para exibição, user_modules não tem unit_id)
        const newMap = new Map<string, Set<string>>();
        selectedUnits.forEach(unitId => {
          // Para cada unidade, atribui TODOS os módulos do usuário
          newMap.set(unitId, new Set(module_ids));
        });
        setModulesByUnit(newMap);
        console.log('[UserFormModal] modulesByUnit inicializado:', newMap);
      } catch (err) {
        console.error('Erro ao carregar módulos do usuário:', err);
      }
    };

    if (selectedUnits.size > 0 && allModulesCache.length > 0) {
      loadUserModules();
    }
  }, [user, isOpen, selectedUnits, allModulesCache]);

  // Atualiza lista de módulos baseado na unidade selecionada na aba Módulos
  useEffect(() => {
    const updateAvailableModules = async () => {
      if (!isOpen || allModulesCache.length === 0 || !selectedUnitForModules) {
        setAllModules([]);
        return;
      }

      try {
        const { fetchUnitModuleIds } = await import('../../services/units/unitModules.service');
        const unitModuleIds = await fetchUnitModuleIds(selectedUnitForModules);

        // Filtra módulos disponíveis para esta unidade
        // Exclui módulos exclusivos de super_admin
        const availableModules = allModulesCache
          .filter(m => unitModuleIds.includes(m.id))
          .filter(m => {
            const profiles = m.allowed_profiles || [];
            const hasSuperAdmin = profiles.includes('super_admin');
            const hasAdminOrUser = profiles.includes('admin') || profiles.includes('user');
            return !hasSuperAdmin || hasAdminOrUser;
          });
        setAllModules(availableModules);
        setAdminModuleIds(new Set(unitModuleIds));
      } catch (err) {
        console.error('Erro ao carregar módulos da unidade:', err);
        setAllModules([]);
      }
    };

    updateAvailableModules();
  }, [selectedUnitForModules, allModulesCache, isOpen]);

  // Define unidade padrão quando abre a aba Módulos
  useEffect(() => {
    if (activeTab === 'modules' && selectedUnits.size > 0 && !selectedUnitForModules) {
      const firstUnit = Array.from(selectedUnits)[0];
      setSelectedUnitForModules(firstUnit);
    }
  }, [activeTab, selectedUnits, selectedUnitForModules]);

  // Inicializa modulesByUnit para unidades que ainda não têm entrada
  useEffect(() => {
    if (!isOpen || selectedUnits.size === 0) return;

    setModulesByUnit(prev => {
      const newMap = new Map(prev);
      selectedUnits.forEach(unitId => {
        if (!newMap.has(unitId)) {
          newMap.set(unitId, new Set());
        }
      });
      return newMap;
    });
  }, [selectedUnits, isOpen]);

  useEffect(() => {
    if (user) {
      // Se um admin está tentando editar um super_admin, força o role para admin
      const roleToSet = (currentAdminProfile?.role === 'admin' && user.role === UserRole.SUPER_ADMIN)
        ? UserRole.ADMIN
        : user.role;

      setFormData({
        full_name: user.full_name,
        email: user.email,
        password: '',
        role: roleToSet,
      });
    } else {
      setFormData({ full_name: '', email: '', password: '', role: UserRole.USER });
    }
  }, [user, isOpen, currentAdminProfile]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value as UserRole }));
  };

  const handleUnitToggle = (unitId: string) => {
    setSelectedUnits(prev => {
      const s = new Set(prev);
      if (s.has(unitId)) s.delete(unitId); else s.add(unitId);
      return s;
    });
  };

  const handleModuleToggle = (moduleId: string) => {
    if (!selectedUnitForModules) return;

    console.log('[handleModuleToggle] Toggling module:', moduleId, 'for unit:', selectedUnitForModules);

    setModulesByUnit(prev => {
      const newMap = new Map(prev);
      const currentUnitModules = (newMap.get(selectedUnitForModules) as Set<string>) || new Set<string>();

      // Cria um NOVO Set (não modifica o existente)
      const updatedUnitModules = new Set<string>(currentUnitModules);

      if (updatedUnitModules.has(moduleId)) {
        console.log('[handleModuleToggle] Removendo módulo:', moduleId);
        updatedUnitModules.delete(moduleId);
      } else {
        console.log('[handleModuleToggle] Adicionando módulo:', moduleId);
        updatedUnitModules.add(moduleId);
      }

      newMap.set(selectedUnitForModules, updatedUnitModules);
      console.log('[handleModuleToggle] Nova lista de módulos para unidade:', Array.from(updatedUnitModules));
      return newMap;
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.full_name || !formData.email || (!user && !formData.password)) {
      setError('Por favor, preencha todos os campos obrigatórios.');
      return;
    }
    const isSuperAdmin = formData.role === UserRole.SUPER_ADMIN;

    // Agrupa todos os módulos de todas as unidades
    const allModuleIds = new Set<string>();
    modulesByUnit.forEach((moduleSet, unitId) => {
      console.log(`[UserFormModal] Unidade ${unitId}:`, Array.from(moduleSet));
      moduleSet.forEach(moduleId => allModuleIds.add(moduleId));
    });

    console.log('[UserFormModal] Total de módulos a salvar:', Array.from(allModuleIds));
    console.log('[UserFormModal] Unidades selecionadas:', Array.from(selectedUnits));

    const dataToSave: UserDataPayload = {
      ...formData,
      unit_ids: isSuperAdmin ? [] : Array.from(selectedUnits),
      module_ids: isSuperAdmin ? [] : Array.from(allModuleIds),
    };

    console.log('[UserFormModal] Data to save:', dataToSave);

    if (user) dataToSave.id = user.id;
    if (!formData.password) delete dataToSave.password;
    onSave(dataToSave);
  };

  if (!isOpen) return null;

  const isSuperAdmin = formData.role === UserRole.SUPER_ADMIN;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60" aria-modal="true" role="dialog" onMouseDown={onClose}>
      <div className="w-full max-w-lg h-[80vh] mx-4 bg-bg-secondary rounded-lg shadow-lg flex flex-col" onMouseDown={(e) => e.stopPropagation()}>
        <div className="p-6 pb-3 border-b border-border-primary shrink-0">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-text-primary">{user ? 'Editar Usuário' : 'Adicionar Novo Usuário'}</h2>
            <button onClick={onClose} className="p-1 rounded-full text-text-secondary hover:bg-bg-tertiary">
              <Icon name="close" />
            </button>
          </div>
          <div className="mt-3">
            <div className="inline-flex rounded-md border border-border-secondary overflow-hidden">
              <button type="button" onClick={() => setActiveTab('dados')} className={`px-3 py-1.5 text-xs ${activeTab === 'dados' ? 'bg-accent-primary text-white' : 'bg-bg-tertiary text-text-secondary hover:bg-bg-secondary'}`}>Dados</button>
              <button type="button" onClick={() => setActiveTab('units')} className={`px-3 py-1.5 text-xs ${activeTab === 'units' ? 'bg-accent-primary text-white' : 'bg-bg-tertiary text-text-secondary hover:bg-bg-secondary'}`}>Unidades</button>
              <button type="button" onClick={() => setActiveTab('modules')} className={`px-3 py-1.5 text-xs ${activeTab === 'modules' ? 'bg-accent-primary text-white' : 'bg-bg-tertiary text-text-secondary hover:bg-bg-secondary'}`}>Módulos</button>
            </div>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="p-6 pt-4 space-y-4 overflow-y-auto flex-1">
          {error && <p className="text-sm text-center text-danger bg-danger/10 p-2 rounded-md">{error}</p>}
          {activeTab === 'dados' && (
            <div className="p-4 border rounded-md bg-bg-tertiary">
              <h3 className="text-sm font-medium text-text-secondary mb-3">Dados do Usuário</h3>
              <div className="space-y-4">
                <div>
                  <label htmlFor="full_name" className="block text-sm font-medium text-text-secondary">Nome Completo</label>
                  <input type="text" name="full_name" id="full_name" value={formData.full_name} onChange={handleChange} required className="w-full px-3 py-2 mt-1 border rounded-md bg-bg-secondary border-border-secondary focus:ring-accent-primary focus:border-accent-primary" />
                </div>
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-text-secondary">Email</label>
                  <input type="email" name="email" id="email" value={formData.email} onChange={handleChange} required autoComplete="off" className="w-full px-3 py-2 mt-1 border rounded-md bg-bg-secondary border-border-secondary focus:ring-accent-primary focus:border-accent-primary" />
                </div>
                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-text-secondary">Senha</label>
                  <input type="password" name="password" id="password" value={formData.password} onChange={handleChange} placeholder={user ? 'Deixe em branco para não alterar' : ''} required={!user} autoComplete="new-password" className="w-full px-3 py-2 mt-1 border rounded-md bg-bg-secondary border-border-secondary focus:ring-accent-primary focus:border-accent-primary" />
                </div>
                <div>
                  <label htmlFor="role" className="block text-sm font-medium text-text-secondary">Função</label>
                  <select name="role" id="role" value={formData.role} onChange={handleChange} className="w-full px-3 py-2 mt-1 border rounded-md bg-bg-secondary border-border-secondary focus:ring-accent-primary focus:border-accent-primary">
                    {currentAdminProfile?.role === 'super_admin' && (
                      <option value={UserRole.SUPER_ADMIN}>Super Admin</option>
                    )}
                    <option value={UserRole.ADMIN}>Admin</option>
                    <option value={UserRole.USER}>Usuário</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {(activeTab === 'units' || activeTab === 'modules') && (
            <div className="p-4 border rounded-md bg-bg-tertiary">
              {activeTab === 'units' && (
                <div className="pt-2">
                  <h3 className="block text-sm font-medium text-text-secondary">Unidades Atribuídas</h3>
                  {formData.role === UserRole.SUPER_ADMIN && <p className="text-xs text-text-secondary mt-1">Super Admins têm acesso a todas as unidades.</p>}
                  {isLoadingAssignments ? <div className="mt-2 text-sm text-text-secondary">Carregando...</div> : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2 max-h-32 overflow-y-auto">
                      {allUnits.map(unit => (
                        <label key={unit.id} className={`flex items-center space-x-2 text-sm text-text-primary ${formData.role === UserRole.SUPER_ADMIN ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'}`}>
                          <input
                            type="checkbox"
                            checked={formData.role === UserRole.SUPER_ADMIN || selectedUnits.has(unit.id)}
                            onChange={() => handleUnitToggle(unit.id)}
                            disabled={formData.role === UserRole.SUPER_ADMIN}
                            className="w-4 h-4 rounded text-accent-primary focus:ring-accent-primary disabled:bg-gray-300 disabled:border-gray-400"
                          />
                          <span>{unit.unit_name}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'modules' && (
                <div>
                  <h3 className="block text-sm font-medium text-text-secondary mb-2">Módulos Atribuídos por Unidade</h3>
                  {formData.role === UserRole.SUPER_ADMIN && <p className="text-xs text-text-secondary mt-1 mb-3">Super Admins têm acesso a todos os módulos.</p>}

                  {formData.role !== UserRole.SUPER_ADMIN && selectedUnits.size === 0 && (
                    <p className="text-xs text-text-secondary bg-bg-tertiary p-2 rounded-md border border-border-secondary">
                      <Icon name="info" className="inline w-4 h-4 mr-1" />
                      Atribua unidades na aba "Unidades" primeiro.
                    </p>
                  )}

                  {formData.role !== UserRole.SUPER_ADMIN && selectedUnits.size > 0 && (
                    <>
                      {/* Seletor de Unidade */}
                      <div className="mb-3">
                        <label htmlFor="unit-selector" className="block text-xs font-medium text-text-secondary mb-1">
                          Selecione a unidade para gerenciar módulos:
                        </label>
                        <select
                          value={selectedUnitForModules || ''}
                          onChange={(e) => setSelectedUnitForModules(e.target.value)}
                          className="w-full px-3 py-2 text-sm border rounded-md bg-bg-secondary border-border-secondary focus:ring-accent-primary focus:border-accent-primary"
                        >
                          <option value="">-- Escolha uma unidade --</option>
                          {Array.from(selectedUnits)
                            .map(unitId => allUnits.find(u => u.id === unitId))
                            .filter((unit): unit is NonNullable<typeof unit> => unit !== undefined)
                            .map(unit => (
                              <option key={unit.id} value={unit.id}>
                                {unit.unit_name}
                              </option>
                            ))}
                        </select>
                      </div>

                      {/* Lista de Módulos */}
                      {selectedUnitForModules && (
                        <div key={selectedUnitForModules}>
                          <p className="text-xs text-text-secondary mb-2">
                            Módulos disponíveis para: <strong>{allUnits.find(u => u.id === selectedUnitForModules)?.unit_name}</strong>
                          </p>
                          {isLoadingAssignments ? (
                            <div className="mt-2 text-sm text-text-secondary">Carregando...</div>
                          ) : allModules.length === 0 ? (
                            <p className="text-xs text-text-secondary bg-bg-tertiary p-2 rounded-md border border-border-secondary">
                              <Icon name="alert-circle" className="inline w-4 h-4 mr-1" />
                              Esta unidade não possui módulos atribuídos.
                            </p>
                          ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto p-2 bg-bg-tertiary rounded-md border border-border-secondary">
                              {allModules
                                .filter(m => Array.isArray(m.allowed_profiles) && m.allowed_profiles.includes(formData.role))
                                .map(module => {
                                  const currentUnitModules = modulesByUnit.get(selectedUnitForModules) || new Set();
                                  const isChecked = currentUnitModules.has(module.id);
                                  const disabled = formData.role === UserRole.SUPER_ADMIN;

                                  // Log para debug
                                  if (module.name === 'Dashboard' || module.name === 'Atendimentos') {
                                    console.log(`[Render checkbox ${module.name}] isChecked:`, isChecked, 'currentUnitModules:', Array.from(currentUnitModules));
                                  }

                                  return (
                                    <label
                                      key={module.id}
                                      className={`flex items-center space-x-2 text-sm text-text-primary ${disabled ? 'cursor-not-allowed opacity-70' : 'cursor-pointer hover:bg-bg-secondary'} p-1 rounded`}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={isChecked}
                                        onChange={() => handleModuleToggle(module.id)}
                                        disabled={disabled}
                                        className="w-4 h-4 rounded text-accent-primary focus:ring-accent-primary disabled:bg-gray-300 disabled:border-gray-400"
                                      />
                                      <span className="text-xs">{module.name}</span>
                                    </label>
                                  );
                                })}
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end pt-2 space-x-3 sticky bottom-0 bg-bg-secondary">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium border rounded-md text-text-secondary border-border-secondary hover:bg-bg-tertiary">Cancelar</button>
            <button type="submit" className="px-4 py-2 text-sm font-medium text-white border border-transparent rounded-md bg-accent-primary hover:bg-accent-secondary">Salvar</button>
          </div>
        </form>
      </div>
    </div>
  );
};
