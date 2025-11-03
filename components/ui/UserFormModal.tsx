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
        // Admin: filtra unidades e módulos permitidos
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
          try {
            const resMods = await (await import('../../services/supabaseClient')).supabase
              .from('user_modules')
              .select('module_id')
              .eq('user_id', currentAdminProfile.id);
            if (!resMods.error) {
              const ids = new Set((resMods.data || []).map((r: any) => r.module_id));
              setAdminModuleIds(ids);
            } else {
              setAdminModuleIds(new Set());
            }
          } catch {
            setAdminModuleIds(new Set());
          }
          setAllModules(modules);
        } else {
          setAllUnits(units);
          setAllModules(modules);
        }

        if (user) {
          const { unit_ids, module_ids } = await fetchUserAssignments(user.id);
          setSelectedUnits(new Set(unit_ids));
          setSelectedModules(new Set(module_ids));
          if (currentAdminProfile && currentAdminProfile.role === 'admin') {
            const readOnly = module_ids.filter(id => !adminModuleIds.has(id));
            setReadOnlyModuleIds(new Set(readOnly));
          } else {
            setReadOnlyModuleIds(new Set());
          }
        } else {
          setSelectedUnits(new Set());
          setSelectedModules(new Set());
          setReadOnlyModuleIds(new Set());
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
    setSelectedModules(prev => {
      const s = new Set(prev);
      if (s.has(moduleId)) s.delete(moduleId); else s.add(moduleId);
      return s;
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.full_name || !formData.email || (!user && !formData.password)) {
      setError('Por favor, preencha todos os campos obrigatórios.');
      return;
    }
    const isSuperAdmin = formData.role === UserRole.SUPER_ADMIN;
    const dataToSave: UserDataPayload = {
      ...formData,
      unit_ids: isSuperAdmin ? [] : Array.from(selectedUnits),
      module_ids: isSuperAdmin ? [] : Array.from(selectedModules),
    };
    if (user) dataToSave.id = user.id;
    if (!formData.password) delete dataToSave.password;
    onSave(dataToSave);
  };

  if (!isOpen) return null;

  const isSuperAdmin = formData.role === UserRole.SUPER_ADMIN;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60" aria-modal="true" role="dialog" onMouseDown={onClose}>
      <div className="w-full max-w-lg h-[80vh] mx-4 bg-bg-secondary rounded-lg shadow-lg flex flex-col" onMouseDown={(e)=>e.stopPropagation()}>
        <div className="p-6 pb-3 border-b border-border-primary shrink-0">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-text-primary">{user ? 'Editar Usuário' : 'Adicionar Novo Usuário'}</h2>
            <button onClick={onClose} className="p-1 rounded-full text-text-secondary hover:bg-bg-tertiary">
              <Icon name="close" />
            </button>
          </div>
          <div className="mt-3">
            <div className="inline-flex rounded-md border border-border-secondary overflow-hidden">
              <button type="button" onClick={()=>setActiveTab('dados')} className={`px-3 py-1.5 text-xs ${activeTab==='dados' ? 'bg-accent-primary text-white' : 'bg-bg-tertiary text-text-secondary hover:bg-bg-secondary'}`}>Dados</button>
              <button type="button" onClick={()=>setActiveTab('units')} className={`px-3 py-1.5 text-xs ${activeTab==='units' ? 'bg-accent-primary text-white' : 'bg-bg-tertiary text-text-secondary hover:bg-bg-secondary'}`}>Unidades</button>
              <button type="button" onClick={()=>setActiveTab('modules')} className={`px-3 py-1.5 text-xs ${activeTab==='modules' ? 'bg-accent-primary text-white' : 'bg-bg-tertiary text-text-secondary hover:bg-bg-secondary'}`}>Módulos</button>
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
                  <input type="email" name="email" id="email" value={formData.email} onChange={handleChange} required className="w-full px-3 py-2 mt-1 border rounded-md bg-bg-secondary border-border-secondary focus:ring-accent-primary focus:border-accent-primary" />
                </div>
                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-text-secondary">Senha</label>
                  <input type="password" name="password" id="password" value={formData.password} onChange={handleChange} placeholder={user ? 'Deixe em branco para não alterar' : ''} required={!user} className="w-full px-3 py-2 mt-1 border rounded-md bg-bg-secondary border-border-secondary focus:ring-accent-primary focus:border-accent-primary" />
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
                  <h3 className="block text-sm font-medium text-text-secondary">Módulos Atribuídos</h3>
                  {formData.role === UserRole.SUPER_ADMIN && <p className="text-xs text-text-secondary mt-1">Super Admins têm acesso a todos os módulos.</p>}
                  {isLoadingAssignments ? <div className="mt-2 text-sm text-text-secondary">Carregando...</div> : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2 max-h-32 overflow-y-auto">
                      {allModules
                        .filter(m => Array.isArray(m.allowed_profiles) && m.allowed_profiles.includes(formData.role))
                        .map(module => {
                          const isReadOnly = readOnlyModuleIds.has(module.id);
                          const adminLocked = (currentAdminProfile?.role === 'admin') && !adminModuleIds.has(module.id);
                          const disabled = formData.role === UserRole.SUPER_ADMIN || isReadOnly || adminLocked;
                          return (
                            <label key={module.id} className={`flex items-center space-x-2 text-sm text-text-primary ${disabled ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'}`}>
                              <input 
                                type="checkbox" 
                                checked={formData.role === UserRole.SUPER_ADMIN || selectedModules.has(module.id) || isReadOnly} 
                                onChange={() => !disabled && handleModuleToggle(module.id)} 
                                disabled={disabled}
                                className="w-4 h-4 rounded text-accent-primary focus:ring-accent-primary disabled:bg-gray-300 disabled:border-gray-400"
                              />
                              <span>{module.name}{isReadOnly ? ' (somente leitura)' : adminLocked ? ' (restrito)' : ''}</span>
                            </label>
                          );
                        })}
                    </div>
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
