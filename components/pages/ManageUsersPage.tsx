import React, { useState, useEffect, useCallback } from 'react';
import { 
  fetchAllUsers, 
  createUser, 
  updateUser, 
  deleteUser, 
  fetchUserAssignments,
  fetchUsersForAdminUnits,
  removeUserFromUnit
} from '../../services/auth/users.service';
import { fetchAllUnits } from '../../services/units/units.service';
import { fetchAllModules } from '../../services/modules/modules.service';
import { useAuth } from '../../contexts/AuthContext';
import { useAppContext } from '../../contexts/AppContext';
import { User, Profile, UserRole, Unit, Module } from '../../types';
import { Icon } from '../ui/Icon';
import { UserFormModal } from '../ui/UserFormModal';

type FullUser = User & Profile;

type UserDataPayload = Partial<FullUser> & { 
    password?: string;
    unit_ids?: string[];
    module_ids?: string[];
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
  const [searchQuery, setSearchQuery] = useState('');
  const [unitsByUser, setUnitsByUser] = useState<Record<string, string[]>>({});
  const ITEMS_PER_PAGE = 10;
  const [currentPage, setCurrentPage] = useState(1);

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

  // Resetar para a primeira página quando a busca muda
  useEffect(() => { setCurrentPage(1); }, [searchQuery]);

  // Carrega nomes das unidades para todos os usuários listados em uma única consulta
  useEffect(() => {
    const fetchUnitsForUsers = async () => {
      try {
        const ids = users.map(u => u.id);
        if (!ids.length) { setUnitsByUser({}); return; }
        const supabase = (await import('../../services/supabaseClient')).supabase;
        const { data, error } = await supabase
          .from('user_units')
          .select('user_id, units:unit_id ( unit_name )')
          .in('user_id', ids);
        if (error) { setUnitsByUser({}); return; }
        const map: Record<string, string[]> = {};
        (data || []).forEach((row: any) => {
          const name = row?.units?.unit_name as string | undefined;
          const uid = row?.user_id as string | undefined;
          if (!uid || !name) return;
          if (!map[uid]) map[uid] = [];
          map[uid].push(name);
        });
        setUnitsByUser(map);
      } catch {
        setUnitsByUser({});
      }
    };
    fetchUnitsForUsers();
  }, [users]);

  const filteredUsers = users.filter(u => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    const byName = (u.full_name || '').toLowerCase().includes(q);
    const byEmail = (u.email || '').toLowerCase().includes(q);
    const unitNames = (unitsByUser[u.id] || []).join(' ').toLowerCase();
    const byUnit = unitNames.includes(q);
    return byName || byEmail || byUnit;
  });

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / ITEMS_PER_PAGE));
  const pageIndex = Math.min(currentPage, totalPages) - 1;
  const start = pageIndex * ITEMS_PER_PAGE;
  const end = start + ITEMS_PER_PAGE;
  const paginatedUsers = filteredUsers.slice(start, end);

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
        setDeletingUserId(userId);
        if (profile.role === 'super_admin') {
          await deleteUser(userId);
        } else if (profile.role === 'admin') {
          if (!users.find(u => u.id === userId)) {
            throw new Error('Você não pode excluir este usuário.');
          }
          if (!selectedUnit) {
            throw new Error('Selecione uma unidade ativa para remover o usuário.');
          }
          await removeUserFromUnit(userId, selectedUnit.id, profile.id);
        } else {
          throw new Error('Sem permissão para excluir.');
        }
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
      <div className="flex items-center justify-between gap-3 mb-6">
        <h1 className="text-2xl font-bold text-text-primary">Usuários</h1>
        <div className="flex items-center gap-3 ml-auto">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por nome ou email"
            className="w-44 sm:w-56 md:w-64 px-3 py-2 text-sm border rounded-md bg-bg-secondary border-border-secondary focus:ring-accent-primary focus:border-accent-primary"
          />
          {profile?.role !== 'user' && (
            <button onClick={() => handleOpenModal()} className="flex items-center px-4 py-2 text-sm font-medium text-white rounded-md bg-accent-primary hover:bg-accent-secondary">
              <Icon name="add" className="w-5 h-5 mr-2" />
              Adicionar Usuário
            </button>
          )}
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
          <table className="min-w-full table-fixed divide-y divide-border-primary">
            <thead className="bg-bg-tertiary">
              <tr>
                <th scope="col" className="px-6 py-2 text-xs font-medium tracking-wider text-left uppercase text-text-secondary w-[22%]">Nome</th>
                <th scope="col" className="px-6 py-2 text-xs font-medium tracking-wider text-left uppercase text-text-secondary w-[26%]">Email</th>
                <th scope="col" className="px-6 py-2 text-xs font-medium tracking-wider text-left uppercase text-text-secondary w-[32%]">Unidade</th>
                <th scope="col" className="px-6 py-2 text-xs font-medium tracking-wider text-left uppercase text-text-secondary w-[12%] whitespace-nowrap">Função</th>
                <th scope="col" className="px-6 py-2 text-xs font-medium tracking-wider text-right uppercase text-text-secondary w-[8%] whitespace-nowrap">Ações</th>
              </tr>
            </thead>
            <tbody className="bg-bg-secondary divide-y divide-border-primary">
              {paginatedUsers.length === 0 && (
                <tr>
                  <td className="px-6 py-4 text-sm text-text-secondary" colSpan={5}>Nenhum usuário encontrado.</td>
                </tr>
              )}
              {paginatedUsers.map((user) => (
                <tr 
                  key={user.id} 
                  onDoubleClick={() => handleOpenModal(user)}
                  className="transition-colors cursor-pointer hover:bg-bg-tertiary"
                >
                  <td className="px-6 py-2 text-sm font-medium text-text-primary truncate">{user.full_name}</td>
                  <td className="px-6 py-2 text-sm text-text-secondary truncate">{user.email}</td>
                  <td className="px-6 py-2 text-sm text-text-secondary truncate" title={(unitsByUser[user.id] && unitsByUser[user.id].length > 0) ? unitsByUser[user.id].join(', ') : '-' }>
                    {(() => {
                      const list = unitsByUser[user.id] || [];
                      if (list.length === 0) return '-';
                      const shown = list.slice(0, 2).join(', ');
                      const extra = list.length - 2;
                      return extra > 0 ? `${shown} +${extra}` : shown;
                    })()}
                  </td>
                  <td className="px-6 py-2 whitespace-nowrap text-sm text-text-secondary">{user.role.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}</td>
                  <td className="px-6 py-2 text-sm font-medium text-right whitespace-nowrap">
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
          {/* Paginação */}
          <div className="flex items-center justify-between mt-4">
            <p className="text-xs text-text-secondary">
              Mostrando {filteredUsers.length === 0 ? 0 : start + 1}–{Math.min(end, filteredUsers.length)} de {filteredUsers.length}
            </p>
            <div className="flex items-center gap-2">
              <button
                className="px-3 py-1 text-sm border rounded-md disabled:opacity-50"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
              >Anterior</button>
              <span className="text-sm text-text-secondary">Página {currentPage} de {totalPages}</span>
              <button
                className="px-3 py-1 text-sm border rounded-md disabled:opacity-50"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
              >Próxima</button>
            </div>
          </div>
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