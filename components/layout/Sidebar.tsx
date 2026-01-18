import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useAppContext } from '../../contexts/AppContext';
import { supabase } from '../../services/supabaseClient';
import { activityLogger } from '../../services/utils/activityLogger.service';
import { Unit, Module, PageView } from '../../types';
import { Icon } from '../ui/Icon';
import ProfileModal from '../ui/ProfileModal';

interface SidebarProps {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ sidebarOpen, setSidebarOpen }) => {
  const { user, profile, logout, userModules, userUnits, getModulesForUnit } = useAuth();
  const { selectedUnit, setSelectedUnit, setView, activeView, activeModule } = useAppContext();
  const [isCollapsed, setIsCollapsed] = useState(true); // inicia recolhido por padrão
  // Unidades agora vêm centralizadas do AuthContext (userUnits).
  // Isso garante que a opção 'Todos' (ALL) agregue dinamicamente todos os unit_code disponíveis
  // sem necessidade de estado duplicado ou múltiplos fetches locais.
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  // Módulos filtrados pela unidade selecionada
  const [filteredModules, setFilteredModules] = useState<Module[]>([]);
  const [loadingModules, setLoadingModules] = useState(false);

  // Carrega módulos quando a unidade selecionada muda
  useEffect(() => {
    const loadModulesForUnit = async () => {
      if (!selectedUnit) {
        setFilteredModules(userModules.filter(m => m.is_active));
        return;
      }

      // Debug: verificar se is_active está presente
      console.log('[Sidebar] selectedUnit:', selectedUnit);
      console.log('[Sidebar] is_active:', selectedUnit.id !== 'ALL' && 'is_active' in selectedUnit ? selectedUnit.is_active : 'N/A');

      // Se a unidade estiver inativa, não mostra nenhum módulo
      if (selectedUnit.id !== 'ALL' && 'is_active' in selectedUnit && selectedUnit.is_active === false) {
        console.log('[Sidebar] Unidade inativa detectada, ocultando módulos');
        setFilteredModules([]);
        return;
      }

      setLoadingModules(true);
      try {
        const modules = await getModulesForUnit(selectedUnit.id);
        setFilteredModules(modules.filter(m => m.is_active));
      } catch (err) {
        console.error('[Sidebar] Erro ao carregar módulos da unidade:', err);
        setFilteredModules(userModules.filter(m => m.is_active));
      } finally {
        setLoadingModules(false);
      }
    };

    loadModulesForUnit();
  }, [selectedUnit, userModules, getModulesForUnit]);

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

  // Verifica se a unidade selecionada foi desativada e redireciona para uma ativa
  useEffect(() => {
    if (!selectedUnit || selectedUnit.id === 'ALL') return;
    if (!('is_active' in selectedUnit)) return;

    // Se a unidade selecionada está inativa, redireciona para a primeira unidade ativa
    if (selectedUnit.is_active === false) {
      console.log('[Sidebar] Unidade selecionada está inativa, redirecionando...');
      const firstActiveUnit = userUnits.find(u => u.is_active !== false);
      if (firstActiveUnit) {
        setSelectedUnit(firstActiveUnit);
      } else if (profile?.role === 'super_admin') {
        setSelectedUnit({ id: 'ALL', unit_name: 'Todas as Unidades', unit_code: 'ALL' } as any);
      }
    }
  }, [selectedUnit, userUnits, setSelectedUnit, profile]);

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
    // Registrar acesso ao módulo
    if (profile && selectedUnit) {
      const userIdentifier = profile.email || profile.full_name;
      const unitCode = selectedUnit.unit_code === 'ALL' ? null : selectedUnit.unit_code;

      activityLogger.logModuleAccess(
        userIdentifier,
        unitCode,
        module.code,
        module.name
      );
    }

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
        className={`flex items-center ${isCollapsed ? 'justify-center' : ''} w-full px-4 py-2.5 text-sm rounded-lg transition-colors duration-200 ${isActive
          ? 'bg-accent-primary text-text-on-accent'
          : 'text-gray-300 hover:bg-white/10 hover:text-brand-snow-white'
          } ${className || ''}`}
      >
        <Icon name={icon} className={isCollapsed ? 'w-6 h-6' : 'w-5 h-5'} />
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
                  <Icon name={isExpanded ? 'ChevronDown' : 'ChevronRight'} className="w-4 h-4" />
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
            <Icon name={isCollapsed ? 'menu-unfold' : 'menu-fold'} className={isCollapsed ? 'w-8 h-8' : 'w-5 h-5'} />
          </button>
        </div>

        {/* Badge de Modo Admin View para Super Admin */}


        <div className="flex-1 p-4 space-y-4 overflow-y-auto">
          {/* Seletor de Unidade - só aparece para não-super_admin OU super_admin em modo admin view */}
          {userUnits.length > 0 && (
            <div>
              <label htmlFor="unit-select-top" className="block text-xs font-medium text-gray-400 mb-1">
                Unidade
              </label>
              {userUnits.filter(u => u.is_active !== false).length === 1 ? (
                // Apenas uma unidade ativa: exibir como texto fixo
                <div className="block w-full rounded-md border border-gray-600 bg-bg-tertiary py-1.5 pl-2 pr-2 text-xs text-text-primary">
                  {userUnits.find(u => u.is_active !== false)?.unit_name}
                </div>
              ) : (
                // Múltiplas unidades: exibir dropdown (apenas unidades ativas)
                <select
                  id="unit-select-top"
                  value={selectedUnit?.id || ''}
                  onChange={handleUnitChange}
                  className="block w-full rounded-md border-gray-600 bg-bg-secondary py-1.5 pl-2 pr-8 text-xs text-text-primary focus:border-accent-primary focus:outline-none focus:ring-accent-primary"
                >
                  <option value="ALL">Todos</option>
                  {userUnits.filter(unit => unit.is_active !== false).map(unit => (
                    <option key={unit.id} value={unit.id}>
                      {unit.unit_name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}
          <nav className="space-y-2 pt-2">
            {/* Mensagem quando unidade está inativa */}
            {selectedUnit && selectedUnit.id !== 'ALL' && 'is_active' in selectedUnit && selectedUnit.is_active === false && !isCollapsed && (
              <div className="px-4 py-3 bg-danger/10 border border-danger/30 rounded-lg">
                <div className="flex items-start gap-2">
                  <Icon name="alert-circle" className="w-4 h-4 text-danger flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-semibold text-danger">Unidade Inativa</p>
                    <p className="text-xs text-danger/80 mt-0.5">Esta unidade está desativada. Nenhum módulo está disponível.</p>
                  </div>
                </div>
              </div>
            )}
            <ul className="list-none m-0 p-0">
              {/* Renderiza os módulos agrupados por pai/filho */}
              {renderModulesTree()}

              {/* Item fixo: Configurações (apenas para admin e user) */}
              {profile && (profile.role === 'admin' || profile.role === 'user') && (
                <NavLink
                  icon="Settings"
                  label="Configurações"
                  isActive={activeView === 'configuracoes'}
                  onClick={() => {
                    setView('configuracoes', null);
                    setSidebarOpen(false);
                  }}
                />
              )}
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
                className="flex items-center justify-center w-12 h-12 rounded-md bg-danger/80 text-brand-snow-white hover:bg-danger focus:outline-none focus:ring-2 focus:ring-danger focus:ring-offset-2 focus:ring-offset-brand-dark-blue"
              >
                <Icon name="logout" className="w-7 h-7" />
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
                <Icon name="logout" className="w-5 h-5" />
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