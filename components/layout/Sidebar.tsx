import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useAppContext } from '../../contexts/AppContext';
import { supabase } from '../../services/supabaseClient';
import { Unit, Module, PageView } from '../../types';
import { Icon } from '../ui/Icon';
import ProfileModal from '../ui/ProfileModal';

interface SidebarProps {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ sidebarOpen, setSidebarOpen }) => {
  const { user, profile, logout, userModules, userUnits } = useAuth();
  const { selectedUnit, setSelectedUnit, setView, activeView, activeModule } = useAppContext();
  const [isCollapsed, setIsCollapsed] = useState(true); // inicia recolhido por padrão
  // Unidades agora vêm centralizadas do AuthContext (userUnits).
  // Isso garante que a opção 'Todos' (ALL) agregue dinamicamente todos os unit_code disponíveis
  // sem necessidade de estado duplicado ou múltiplos fetches locais.
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  // Lista final de módulos já vem consolidada do AuthContext: união de
  // (a) módulos explicitamente atribuídos ao usuário e (b) módulos permitidos por allowed_profiles.
  // Aqui apenas filtramos por is_active.
  const filteredModules = userModules.filter(module => module.is_active);

  useEffect(() => {
    if (!user || !profile) return;
    // Se AppContext já restaurou (via localStorage), não sobrescreve
    if (selectedUnit) return;

    // Se existe cache salvo, deixa o AppContext restaurar
    const cachedUnitId = (() => {
      try { return localStorage.getItem('df_selected_unit_id'); } catch { return null; }
    })();
    if (cachedUnitId) return;

    if (profile.role === 'super_admin') {
      // Para super_admin, define ALL por padrão para que páginas funcionem em modo agregado
      setSelectedUnit({ id: 'ALL', unit_name: 'Todas as Unidades', unit_code: 'ALL' } as any);
      return;
    }
    if (userUnits.length > 0) {
      // Inicializa na primeira unidade (apenas quando não há cache)
      setSelectedUnit(userUnits[0]);
    }
  }, [user, profile, userUnits, selectedUnit, setSelectedUnit]);

  const handleUnitChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (val === 'ALL') {
      setSelectedUnit({ id: 'ALL', unit_name: 'Todas as Unidades', unit_code: 'ALL' });
      return;
    }
    const unit = userUnits.find(u => u.id === val) || null;
    setSelectedUnit(unit);
  };
  
  const handleModuleClick = (module: Module) => {
    const viewIdNorm = (module.view_id || '').toLowerCase().replace(/-/g, '_');
    const url = (module.webhook_url || '').toLowerCase();
    const internalView = url.startsWith('internal://') ? url.slice('internal://'.length).replace(/-/g, '_') : '';
    const target = viewIdNorm || internalView;
    if (target) {
      setView(target as PageView, null);
    } else {
      setView('module', module);
    }
    setSidebarOpen(false);
  };
  
  const handleProfileUpdate = async (data: { email?: string; password?: string; full_name?: string }) => {
    if (!profile) return;

    const updates: { email?: string; password?: string; full_name?: string } = {};
  if (data.email && data.email !== (user?.email || null)) updates.email = data.email;
    if (data.password) updates.password = data.password;
    if (data.full_name && data.full_name !== (profile as any).full_name) updates.full_name = data.full_name;

    if (Object.keys(updates).length === 0) {
      setIsProfileModalOpen(false);
      return;
    }

    const { data: updatedProfiles, error } = await supabase
      .from('profiles')
      .update(updates)
  .eq('id', profile.id)
      .select('*')
      .single();

    if (error) {
      alert(`Falha ao atualizar o perfil: ${error.message}`);
      return;
    }

    // Atualiza armazenamento local e força re-render imediato do Sidebar
    try {
      const storedProfile = localStorage.getItem('userProfile');
      if (storedProfile) {
        const parsed = JSON.parse(storedProfile);
        const merged = { ...parsed, ...updates };
        localStorage.setItem('userProfile', JSON.stringify(merged));
      } else if (updatedProfiles) {
        localStorage.setItem('userProfile', JSON.stringify(updatedProfiles));
      }
    } catch (e) {
      console.warn('Falha ao sincronizar localStorage após update de perfil', e);
    }

    // Força refresh local do objeto profile via hack simples: disparo de evento custom
    window.dispatchEvent(new Event('profile-updated')); // Pode ser usado futuramente para listeners globais

    // Fechar modal
    setIsProfileModalOpen(false);
  };

  const NavLink: React.FC<{
    icon: string;
    label: string;
    isActive: boolean;
    onClick: () => void;
    className?: string;
    rightSlot?: React.ReactNode;
  }> = ({ icon, label, isActive, onClick, className, rightSlot }) => (
    <li>
      <button
        onClick={onClick}
        // Quando recolhido, mostrar o nome do módulo como tooltip nativo
        title={isCollapsed ? label : undefined}
        aria-label={isCollapsed ? label : undefined}
        className={`flex items-center w-full px-4 py-2.5 text-sm rounded-lg transition-colors duration-200 ${
          isActive
            ? 'bg-accent-primary text-text-on-accent'
            : 'text-gray-300 hover:bg-white/10 hover:text-brand-snow-white'
        } ${className || ''}`}
      >
        <Icon name={icon} />
        {!isCollapsed && (
          <>
            <span className="ml-4">{label}</span>
            {rightSlot && <span className="ml-auto pl-2 flex items-center">{rightSlot}</span>}
          </>
        )}
      </button>
    </li>
  );

  // Estado de expansão por módulo pai
  const [expandedParents, setExpandedParents] = useState<Record<string, boolean>>({});

  const toggleParent = (parentId: string) => {
    setExpandedParents(prev => ({ ...prev, [parentId]: !prev[parentId] }));
  };

  const renderModulesTree = () => {
    const sorted = [...filteredModules].sort((a, b) => {
      const posA = a.position ?? 0;
      const posB = b.position ?? 0;
      if (posA !== posB) return posA - posB;
      return a.name.localeCompare(b.name);
    });

  const parents = sorted.filter(m => !m.parent_id);
  const normalizeView = (v?: string | null) => (v || '').replace(/-/g, '_');
    const childrenMap = new Map<string, Module[]>();
    for (const m of sorted) {
      if (m.parent_id) {
        const list = childrenMap.get(m.parent_id) || [];
        list.push(m);
        childrenMap.set(m.parent_id, list);
      }
    }
    // Ordena filhos por position/name
    for (const [k, arr] of childrenMap.entries()) {
      arr.sort((a, b) => {
        const posA = a.position ?? 0;
        const posB = b.position ?? 0;
        if (posA !== posB) return posA - posB;
        return a.name.localeCompare(b.name);
      });
      childrenMap.set(k, arr);
    }

    return parents.map(parent => {
      const children = childrenMap.get(parent.id) || [];
      const isActiveParent =
        (activeView === 'module' && activeModule?.id === parent.id) ||
        (parent.view_id && activeView === normalizeView(parent.view_id));
  const isExpanded = expandedParents[parent.id] ?? false; // por padrão RECOLHIDO

      return (
        <React.Fragment key={parent.id}>
          {/* Linha do pai; chevron vai ao final do nome como rightSlot */}
          <NavLink
            icon={parent.icon}
            label={parent.name}
            isActive={isActiveParent}
            onClick={() => handleModuleClick(parent)}
            rightSlot={
              children.length > 0 && !isCollapsed ? (
                <span
                  role="button"
                  tabIndex={0}
                  aria-label={isExpanded ? 'Recolher' : 'Expandir'}
                  title={isExpanded ? 'Recolher' : 'Expandir'}
                  onClick={(e) => { e.stopPropagation(); toggleParent(parent.id); }}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); toggleParent(parent.id); } }}
                  className="p-1 rounded hover:bg-white/10 text-gray-300 cursor-pointer"
                >
                  <Icon name={isExpanded ? 'ChevronDown' : 'ChevronRight'} />
                </span>
              ) : null
            }
          />

          {/* Filhos indentados */}
          {children.length > 0 && isExpanded && (
            <ul className="list-none m-0 p-0">
              {children.map(child => (
                <NavLink
                  key={child.id}
                  icon={child.icon}
                  label={child.name}
                  isActive={
                    (activeView === 'module' && activeModule?.id === child.id) ||
                    (child.view_id && activeView === normalizeView(child.view_id))
                  }
                  onClick={() => handleModuleClick(child)}
                  className={`${isCollapsed ? '' : 'pl-6'}`}
                />
              ))}
            </ul>
          )}
        </React.Fragment>
      );
    });
  };

  const sidebarContent = (
    <>
  <div className={`z-30 bg-brand-dark-blue text-brand-snow-white flex flex-col transition-all duration-300 ${isCollapsed ? 'w-20' : 'w-64'}`}>
      <div className="flex items-center justify-between p-4 border-b border-white/10">
        <div className="flex items-center min-w-0">
          <img src="https://iili.io/3RBGZox.png" alt="DromeFlow Logo" className="w-8 h-8 flex-shrink-0" />
          {!isCollapsed && <span className="ml-2 text-xl font-bold truncate">DromeFlow</span>}
        </div>
        <button onClick={() => setIsCollapsed(!isCollapsed)} className="p-1 rounded-full hover:bg-white/10">
          <Icon name={isCollapsed ? 'menu-unfold' : 'menu-fold'} />
        </button>
      </div>

      <div className="flex-1 p-4 space-y-4 overflow-y-auto">
        {profile?.role !== 'super_admin' && userUnits.length > 0 && (
          <div>
            <label htmlFor="unit-select-top" className="block text-xs font-medium text-gray-400 mb-1">
              Unidade
            </label>
            <select
              id="unit-select-top"
              value={selectedUnit?.id || ''}
              onChange={handleUnitChange}
              className="block w-full rounded-md border-gray-600 bg-bg-secondary py-1.5 pl-2 pr-8 text-xs text-text-primary focus:border-accent-primary focus:outline-none focus:ring-accent-primary"
            >
              <option value="ALL">Todos</option>
              {userUnits.map(unit => (
                <option key={unit.id} value={unit.id}>
                  {unit.unit_name}
                </option>
              ))}
            </select>
          </div>
        )}
        <nav className="space-y-2 pt-2">
          <ul className="list-none m-0 p-0">
            {/* Renderiza os módulos agrupados por pai/filho */}
            {renderModulesTree()}
            {/* Removido fallback de Agendamentos para evitar exibir módulo não autorizado */}
          </ul>
        </nav>
      </div>

      <div className="border-t border-gray-700 p-3">
        {isCollapsed ? (
          <div className="flex flex-col items-center gap-3">
            <button
              type="button"
              onClick={() => setIsProfileModalOpen(true)}
              className="relative group focus:outline-none focus:ring-2 focus:ring-accent-primary focus:ring-offset-2 focus:ring-offset-brand-dark-blue"
              aria-label="Abrir perfil do usuário"
              title={profile?.full_name || user?.email || 'Perfil'}
            >
              <img
                className="h-9 w-9 rounded-full ring-1 ring-white/10 group-hover:ring-accent-primary transition"
                src={`https://ui-avatars.com/api/?name=${user?.email}&background=0D8ABC&color=fff`}
                alt="Avatar"
              />
            </button>
            <button
              onClick={logout}
              aria-label="Sair"
              title="Sair"
              className="flex items-center justify-center w-9 h-9 rounded-md bg-danger/80 text-brand-snow-white hover:bg-danger focus:outline-none focus:ring-2 focus:ring-danger focus:ring-offset-2 focus:ring-offset-brand-dark-blue"
            >
              <Icon name="logout" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 mt-1">
            <button
              type="button"
              onClick={() => setIsProfileModalOpen(true)}
              className="flex items-center group text-left rounded-md focus:outline-none focus:ring-2 focus:ring-accent-primary focus:ring-offset-2 focus:ring-offset-brand-dark-blue hover:bg-white/10 transition-colors px-2 py-1 flex-1"
              aria-label="Abrir perfil do usuário"
            >
              <img
                className="h-8 w-8 rounded-full flex-shrink-0 ring-1 ring-white/10 group-hover:ring-accent-primary transition"
                src={`https://ui-avatars.com/api/?name=${user?.email}&background=0D8ABC&color=fff`}
                alt="Avatar"
              />
              <div className="ml-2 min-w-0">
                <p className="text-xs font-medium text-brand-snow-white truncate group-hover:text-white leading-tight">{profile?.full_name || 'Usuário'}</p>
                <p className="text-[10px] text-gray-400 truncate leading-tight">{user?.email}</p>
              </div>
            </button>
            <button
              onClick={logout}
              className="flex items-center justify-center rounded-md bg-danger/80 px-3 py-2 text-xs font-medium text-brand-snow-white hover:bg-danger focus:outline-none focus:ring-2 focus:ring-danger focus:ring-offset-2 focus:ring-offset-brand-dark-blue"
              aria-label="Sair"
              title="Sair"
            >
              <Icon name="logout" />
            </button>
          </div>
        )}
      </div>
    </div>
    
    <ProfileModal
      isOpen={isProfileModalOpen}
      onClose={() => setIsProfileModalOpen(false)}
      onSave={handleProfileUpdate}
      user={user}
      fullNameInitial={(profile as any)?.full_name}
    />
    </>
  );

  return (
    <>
      {/* Mobile Sidebar */}
      <div className={`fixed inset-0 z-30 bg-black bg-opacity-50 transition-opacity lg:hidden ${sidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} onClick={() => setSidebarOpen(false)}></div>
      <div className={`fixed inset-y-0 left-0 z-40 transform lg:hidden ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} transition-transform duration-300`}>
        {sidebarContent}
      </div>

      {/* Desktop Sidebar */}
      <div className="hidden lg:flex">
        {sidebarContent}
      </div>
    </>
  );
};

export default Sidebar;