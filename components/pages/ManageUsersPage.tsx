import React, { useState, useEffect, useCallback } from 'react';
import { 
  fetchAllUsers, 
  createUser, 
  updateUser, 
  deleteUser, 
  fetchAllUnits, 
  fetchAllModules,
  fetchUserAssignments,
  fetchUsersForAdminUnits
} from '../../services/mockApi';
import { useAuth } from '../../contexts/AuthContext';
import { useAppContext } from '../../contexts/AppContext';
import { User, Profile, UserRole, Unit, Module } from '../../types';
import { Icon } from '../ui/Icon';

type FullUser = User & Profile;

type UserDataPayload = Partial<FullUser> & { 
    password?: string;
    unit_ids?: string[];
    module_ids?: string[];
};

const UserFormModal: React.FC<{
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
  const [selectedUnits, setSelectedUnits] = useState<Set<string>>(new Set());
  const [selectedModules, setSelectedModules] = useState<Set<string>>(new Set());
  const [isLoadingAssignments, setIsLoadingAssignments] = useState(false);
  const [readOnlyModuleIds, setReadOnlyModuleIds] = useState<Set<string>>(new Set());


  useEffect(() => {
    const loadPrerequisites = async () => {
        if (isOpen) {
            setIsLoadingAssignments(true);
            setError('');
            try {
        const [units, modules] = await Promise.all([
          fetchAllUnits(),
          fetchAllModules(),
        ]);

                // Se o usuário logado (currentAdminProfile) for admin, filtra as unidades para mostrar somente as dele
                if (currentAdminProfile && currentAdminProfile.role === 'admin') {
                    try {
                        // Buscar unidades do admin via user_units (reutiliza fetchUsersForAdminUnits para pegar universo de usuários e extrair units?)
                        // Otimização: idealmente uma RPC, aqui simplificamos fazendo uma query direta similar à fetchUsersForAdminUnits.
                        // Para evitar adicionar nova função agora, aproveitamos a lista completa e filtramos por interseção com user_units do admin.
                        // Consulta direta:
                        // (Decidimos inline para não expandir mockApi.)
                        const res = await (await import('../../services/supabaseClient')).supabase
                          .from('user_units')
                          .select('unit_id')
                          .eq('user_id', currentAdminProfile.id);
                        if (!res.error) {
                          const adminUnitIds = new Set((res.data || []).map((r: any) => r.unit_id));
                          const filteredUnits = units.filter(u => adminUnitIds.has(u.id));
                          setAllUnits(filteredUnits);
                        } else {
                          setAllUnits(units); // fallback
                        }
                    } catch {
                        setAllUnits(units); // fallback em caso de erro
                    }
                } else {
                  setAllUnits(units);
                }
                // Filtragem de módulos para admin: mostra somente os que o admin possui explicitamente (user_modules)
                if (currentAdminProfile && currentAdminProfile.role === 'admin') {
                  try {
                    const resMods = await (await import('../../services/supabaseClient')).supabase
                      .from('user_modules')
                      .select('module_id')
                      .eq('user_id', currentAdminProfile.id);
                    if (!resMods.error) {
                      const adminModuleIds = new Set((resMods.data || []).map((r: any) => r.module_id));
                      const filteredModules = modules.filter(m => adminModuleIds.has(m.id));
                      setAllModules(filteredModules);
                    } else {
                      setAllModules(modules); // fallback
                    }
                  } catch {
                    setAllModules(modules); // fallback
                  }
                } else {
                  setAllModules(modules);
                }

                if (user) {
                  const { unit_ids, module_ids } = await fetchUserAssignments(user.id);
                  setSelectedUnits(new Set(unit_ids));
                  setSelectedModules(new Set(module_ids));

                  // Se o admin logado não tiver alguns módulos que o usuário editado possui,
                  // queremos exibi-los como somente leitura (checked + disabled)
                  if (currentAdminProfile && currentAdminProfile.role === 'admin') {
                    const currentVisibleIds = new Set((currentAdminProfile.role === 'admin') ? (await (await import('../../services/supabaseClient')).supabase
                      .from('user_modules')
                      .select('module_id')
                      .eq('user_id', currentAdminProfile.id)).data?.map((r: any) => r.module_id) : []);
                    const readOnly = module_ids.filter(id => !currentVisibleIds.has(id));
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
        }
    };

    if (user) {
      setFormData({
        full_name: user.full_name,
        email: user.email,
        password: '',
        role: user.role,
      });
    } else {
      setFormData({
        full_name: '',
        email: '',
        password: '',
        role: UserRole.USER,
      });
    }
    loadPrerequisites();
  }, [user, isOpen]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value as UserRole }));
  };

  const handleUnitToggle = (unitId: string) => {
    setSelectedUnits(prev => {
        const newSet = new Set(prev);
        if (newSet.has(unitId)) newSet.delete(unitId);
        else newSet.add(unitId);
        return newSet;
    });
  };

  const handleModuleToggle = (moduleId: string) => {
      setSelectedModules(prev => {
          const newSet = new Set(prev);
          if (newSet.has(moduleId)) newSet.delete(moduleId);
          else newSet.add(moduleId);
          return newSet;
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
    if (user) {
        dataToSave.id = user.id;
    }
    if (!formData.password) {
        delete dataToSave.password;
    }
    onSave(dataToSave);
  };

  if (!isOpen) return null;
  
  const isSuperAdmin = formData.role === UserRole.SUPER_ADMIN;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60" aria-modal="true" role="dialog">
      <div className="w-full max-w-lg p-6 mx-4 bg-bg-secondary rounded-lg shadow-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-3 border-b border-border-primary">
          <h2 className="text-xl font-bold text-text-primary">{user ? 'Editar Usuário' : 'Adicionar Novo Usuário'}</h2>
          <button onClick={onClose} className="p-1 rounded-full text-text-secondary hover:bg-bg-tertiary">
            <Icon name="close" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {error && <p className="text-sm text-center text-danger bg-danger/10 p-2 rounded-md">{error}</p>}
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
                <option value={UserRole.SUPER_ADMIN}>Super Admin</option>
                <option value={UserRole.ADMIN}>Admin</option>
                <option value={UserRole.USER}>Usuário</option>
              </select>
            </div>
            
            <div className="pt-2">
              <h3 className="block text-sm font-medium text-text-secondary">Unidades Atribuídas</h3>
              {isSuperAdmin && <p className="text-xs text-text-secondary mt-1">Super Admins têm acesso a todas as unidades.</p>}
              {isLoadingAssignments ? <div className="mt-2 text-sm text-text-secondary">Carregando...</div> : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2 p-3 border rounded-md max-h-32 overflow-y-auto bg-bg-tertiary">
                  {allUnits.map(unit => (
                    <label key={unit.id} className={`flex items-center space-x-2 text-sm text-text-primary ${isSuperAdmin ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'}`}>
                      <input 
                        type="checkbox" 
                        checked={isSuperAdmin || selectedUnits.has(unit.id)} 
                        onChange={() => handleUnitToggle(unit.id)} 
                        disabled={isSuperAdmin}
                        className="w-4 h-4 rounded text-accent-primary focus:ring-accent-primary disabled:bg-gray-300 disabled:border-gray-400" 
                      />
                      <span>{unit.unit_name}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
            <div>
              <h3 className="block text-sm font-medium text-text-secondary">Módulos Atribuídos</h3>
              {isSuperAdmin && <p className="text-xs text-text-secondary mt-1">Super Admins têm acesso a todos os módulos.</p>}
              {isLoadingAssignments ? <div className="mt-2 text-sm text-text-secondary">Carregando...</div> : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2 p-3 border rounded-md max-h-32 overflow-y-auto bg-bg-tertiary">
                  {allModules.map(module => {
                    const isReadOnly = readOnlyModuleIds.has(module.id);
                    const disabled = isSuperAdmin || isReadOnly;
                    return (
                      <label key={module.id} className={`flex items-center space-x-2 text-sm text-text-primary ${disabled ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'}`}>
                        <input 
                          type="checkbox" 
                          checked={isSuperAdmin || selectedModules.has(module.id) || isReadOnly} 
                          onChange={() => !disabled && handleModuleToggle(module.id)} 
                          disabled={disabled}
                          className="w-4 h-4 rounded text-accent-primary focus:ring-accent-primary disabled:bg-gray-300 disabled:border-gray-400"
                        />
                        <span>{module.name}{isReadOnly && ' (somente leitura)'}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex justify-end pt-4 space-x-3">
              <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium border rounded-md text-text-secondary border-border-secondary hover:bg-bg-tertiary">Cancelar</button>
              <button type="submit" className="px-4 py-2 text-sm font-medium text-white border border-transparent rounded-md bg-accent-primary hover:bg-accent-secondary">Salvar</button>
            </div>
        </form>
      </div>
    </div>
  );
};

const ManageUsersPage: React.FC = () => {
  const { profile, user } = useAuth();
  const { selectedUnit } = useAppContext();
  const [users, setUsers] = useState<FullUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<FullUser | null>(null);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);

  const loadUsers = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      if (!profile || !user) {
        setUsers([]);
        return;
      }
      if (profile.role === 'super_admin') {
        const fetchedUsers = await fetchAllUsers();
        setUsers(fetchedUsers);
      } else if (profile.role === 'admin') {
        const fetched = await fetchUsersForAdminUnits(user.id);
        // Se houver unidade selecionada, filtra somente usuários ligados àquela unidade
        if (selectedUnit) {
          // Para saber quais usuários pertencem à unidade selecionada precisamos buscar assignments de cada um (custo O(n)).
          // Otimização futura: criar RPC que já retorne filtrado.
          const filtered: FullUser[] = [];
          for (const u of fetched) {
            try {
              const { unit_ids } = await fetchUserAssignments(u.id);
              if (unit_ids.includes(selectedUnit.id)) filtered.push(u as FullUser);
            } catch { /* ignora usuário problemático */ }
          }
          setUsers(filtered);
        } else {
          setUsers(fetched);
        }
      } else {
        // Usuário comum não deve ver nada aqui (ou apenas ele mesmo?)
        setUsers([]);
      }
    } catch (err: any) {
      setError('Falha ao carregar usuários.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const handleOpenModal = (user: FullUser | null = null) => {
    setEditingUser(user);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingUser(null);
  };

  const handleSaveUser = async (data: UserDataPayload) => {
    try {
      if (!profile || !user) throw new Error('Sem perfil carregado.');
      const isSuperAdmin = profile.role === 'super_admin';
      const isAdmin = profile.role === 'admin';
      // Impede admin de criar usuário sem unidade associada
      if (isAdmin && !editingUser && (!selectedUnit && (!data.unit_ids || data.unit_ids.length === 0))) {
        throw new Error('Selecione uma unidade antes de criar um usuário.');
      }
      if (editingUser) {
        // Valida que admin só pode editar usuários de suas unidades
        if (isAdmin) {
          const { unit_ids } = await fetchUserAssignments(editingUser.id);
          const adminUnits = await fetchUsersForAdminUnits(user.id); // reuso para obter universo (poderia ser otimizado)
          // Simplificação: apenas garante que há interseção já que usuário está na lista carregada
          if (!users.find(u => u.id === editingUser.id)) {
            throw new Error('Você não pode editar este usuário.');
          }
        }
        await updateUser(editingUser.id, data);
      } else {
        // Criação
        if (isAdmin) {
          await createUser({ ...data, auto_unit_id: selectedUnit?.id });
        } else {
          await createUser(data);
        }
      }
      handleCloseModal();
      await loadUsers();
    } catch (err: any) {
      alert(`Erro: ${err.message}`);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (window.confirm('Tem certeza que deseja excluir este usuário?')) {
      try {
        if (!profile || !user) throw new Error('Sem perfil.');
        if (profile.role === 'admin') {
          // Admin só pode deletar se usuário estiver listado
            if (!users.find(u => u.id === userId)) {
              throw new Error('Você não pode excluir este usuário.');
            }
        } else if (profile.role !== 'super_admin') {
          throw new Error('Sem permissão para excluir.');
        }
        setDeletingUserId(userId);
        await deleteUser(userId);
        await loadUsers();
      } catch (err: any) {
        alert(`Erro: ${err.message}`);
      } finally {
        setDeletingUserId(null);
      }
    }
  };

  return (
    <div className="p-6 bg-bg-secondary rounded-lg shadow-md">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-text-primary">Usuários</h1>
        {profile?.role !== 'user' && (
        <button onClick={() => handleOpenModal()} className="flex items-center px-4 py-2 text-sm font-medium text-white rounded-md bg-accent-primary hover:bg-accent-secondary">
          <Icon name="add" className="w-5 h-5 mr-2" />
          Adicionar Usuário
        </button>) }
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
                <th scope="col" className="px-6 py-3 text-xs font-medium tracking-wider text-left uppercase text-text-secondary">Nome</th>
                <th scope="col" className="px-6 py-3 text-xs font-medium tracking-wider text-left uppercase text-text-secondary">Email</th>
                <th scope="col" className="px-6 py-3 text-xs font-medium tracking-wider text-left uppercase text-text-secondary">Função</th>
                <th scope="col" className="px-6 py-3 text-xs font-medium tracking-wider text-right uppercase text-text-secondary">Ações</th>
              </tr>
            </thead>
            <tbody className="bg-bg-secondary divide-y divide-border-primary">
              {users.map((user) => (
                <tr 
                  key={user.id} 
                  onDoubleClick={() => handleOpenModal(user)}
                  className="transition-colors cursor-pointer hover:bg-bg-tertiary"
                >
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-text-primary">{user.full_name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-text-secondary">{user.email}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-text-secondary">{user.role.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}</td>
                  <td className="px-6 py-4 text-sm font-medium text-right whitespace-nowrap">
                    <div className="flex items-center justify-end space-x-1">
                      {profile?.role !== 'user' && (
                        <>
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleOpenModal(user); }} 
                          className="p-2 rounded-md text-accent-primary hover:bg-accent-primary/10 transition-colors"
                          title="Editar Usuário"
                        >
                          <Icon name="edit" className="w-5 h-5" />
                        </button>
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleDeleteUser(user.id); }} 
                          disabled={!!deletingUserId}
                          className={`p-2 rounded-md transition-colors ${deletingUserId ? 'opacity-50 cursor-not-allowed' : 'text-danger hover:bg-danger/10'} `}
                          title={deletingUserId ? 'Processando...' : 'Excluir Usuário'}
                        >
                          {deletingUserId === user.id ? (
                            <span className="w-5 h-5 inline-block border-2 border-danger border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <Icon name="delete" className="w-5 h-5" />
                          )}
                        </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <UserFormModal 
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onSave={handleSaveUser}
        user={editingUser}
        currentAdminProfile={profile}
      />
    </div>
  );
};

export default ManageUsersPage;