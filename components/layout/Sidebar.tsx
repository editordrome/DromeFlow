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
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [appVersion, setAppVersion] = useState<string>('2.0.0');

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

  // Carregar versão ativa do sistema
  useEffect(() => {
    const loadAppVersion = async () => {
      try {
        const { data, error } = await supabase
          .from('app_versions')
          .select('version')
          .eq('is_active', true)
          .order('release_date', { ascending: false })
          .limit(1)
          .single();

        if (!error && data) {
          setAppVersion(data.version);
        }
      } catch (err) {
        console.error('[Sidebar] Erro ao carregar versão:', err);
      }
    };
    loadAppVersion();
  }, []);

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

  // Fechar menu do usuário ao clicar fora
  useEffect(() => {
    if (!isUserMenuOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('[data-user-menu]')) {
        setIsUserMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isUserMenuOpen]);

  const handleUnitChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (val === 'ALL') {
      setSelectedUnit({ id: 'ALL', unit_name: 'Sistema (Global)', unit_code: 'ALL' });
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

    // Filtra módulos redundantes que já estão no menu do usuário
    const filteredForRedundancy = sorted.filter(m =>
      m.code !== 'configuracoes' &&
      m.code !== 'manage_users' &&
      m.code !== 'sistema'
    );

    const parents = filteredForRedundancy.filter(m => !m.parent_id);
    const normalizeView = (v?: string | null) => (v || '').replace(/-/g, '_');
    const childrenMap = new Map<string, Module[]>();
    for (const m of filteredForRedundancy) {
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
      <div className={`z-30 bg-brand-dark-blue text-brand-snow-white flex flex-col transition-all duration-300 relative ${isCollapsed ? 'w-20' : 'w-64'}`}>
        {/* Toggle Button - Agora no topo, invisível até hover */}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className={`absolute left-0 top-0 z-50 p-4 transition-opacity duration-200 opacity-0 hover:opacity-100 flex items-center justify-center ${isCollapsed ? 'w-20' : 'w-full'} h-16 bg-transparent text-white hidden lg:flex`}
          title={isCollapsed ? "Expandir menu" : "Recolher menu"}
        >
          <Icon name={isCollapsed ? 'ChevronRight' : 'ChevronLeft'} className="w-5 h-5" />
        </button>

        <div className="flex items-center justify-between p-4 border-b border-white/10 h-16">
          <div className="flex items-center min-w-0 w-full">
            <img src="https://iili.io/3RBGZox.png" alt="DromeFlow Logo" className={`flex-shrink-0 transition-all duration-300 ${isCollapsed ? 'mx-auto w-10 h-10' : 'w-8 h-8'}`} />
            {!isCollapsed && <span className="ml-2 text-xl font-bold truncate">DromeFlow</span>}
          </div>
        </div>

        <div className="flex-1 p-4 space-y-4 overflow-y-auto">
          {/* Seletor de Modo/Unidade para Super Admin */}
          {profile?.role === 'super_admin' && !isCollapsed ? (
            <div className="space-y-3">
              <div className="flex bg-bg-tertiary rounded-lg p-1 border border-white/10">
                <button
                  onClick={() => setSelectedUnit({ id: 'ALL', unit_name: 'Sistema (Global)', unit_code: 'ALL' })}
                  className={`flex-1 py-1.5 text-[10px] uppercase font-bold rounded transition-all ${selectedUnit?.id === 'ALL' ? 'bg-accent-primary text-white shadow-sm' : 'text-gray-400 hover:text-white'}`}
                >
                  Sistema
                </button>
                <button
                  onClick={() => {
                    const firstUnit = userUnits.find(u => u.id !== 'ALL');
                    if (firstUnit) setSelectedUnit(firstUnit);
                  }}
                  className={`flex-1 py-1.5 text-[10px] uppercase font-bold rounded transition-all ${selectedUnit?.id !== 'ALL' ? 'bg-accent-primary text-white shadow-sm' : 'text-gray-400 hover:text-white'}`}
                >
                  Unidades
                </button>
              </div>

              {selectedUnit?.id !== 'ALL' && userUnits.length > 0 && (
                <div className="animate-in fade-in slide-in-from-top-1 duration-200">
                  <label htmlFor="unit-select-admin" className="block text-[10px] font-medium text-gray-500 mb-1 uppercase">
                    Selecionar Unidade
                  </label>
                  <select
                    id="unit-select-admin"
                    value={selectedUnit?.id || ''}
                    onChange={handleUnitChange}
                    className="block w-full rounded-md border-gray-600 bg-bg-secondary py-1.5 pl-2 pr-8 text-xs text-text-primary focus:border-accent-primary focus:outline-none focus:ring-accent-primary"
                  >
                    {userUnits.map(unit => (
                      <option key={unit.id} value={unit.id}>
                        {unit.unit_name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          ) : (
            /* Seletor de Unidade para Admin/User padrão */
            userUnits.length > 0 && !isCollapsed && (
              <div>
                <label htmlFor="unit-select-top" className="block text-xs font-medium text-gray-400 mb-1">
                  Unidade
                </label>
                {userUnits.filter(u => u.is_active !== false).length === 1 ? (
                  <div className="block w-full rounded-md border border-gray-600 bg-bg-tertiary py-1.5 pl-2 pr-2 text-xs text-text-primary">
                    {userUnits.find(u => u.is_active !== false)?.unit_name}
                  </div>
                ) : (
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
            )
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
              {renderModulesTree()}
            </ul>
          </nav>

          {/* Item de Sistema Fixo - Respeita permissões para Admin/User, sempre visível para Super Admin */}
          {(profile?.role === 'super_admin' || filteredModules.some(m => m.code === 'sistema')) && (
            <div className="mt-2 pt-2 border-t border-gray-700">
              <button
                onClick={() => { setView('sistema'); setSidebarOpen(false); }}
                className={`flex items-center w-full px-3 py-2 rounded-lg transition-all duration-200 group ${activeView === 'sistema' ? 'bg-accent-primary text-white shadow-md' : 'text-gray-400 hover:bg-bg-tertiary hover:text-white'}`}
                title="Manual e Histórico"
              >
                <div className={`transition-transform duration-200 ${!isCollapsed ? 'mr-3' : 'mx-auto'} group-hover:scale-110`}>
                  <Icon name="Info" className={`w-5 h-5 ${activeView === 'sistema' ? 'text-white' : 'text-gray-400 group-hover:text-accent-primary'}`} />
                </div>
                {!isCollapsed && <span className="text-sm font-medium truncate">Sistema</span>}
              </button>
            </div>
          )}
        </div>

        <div className="border-t border-gray-700 p-3 relative" data-user-menu>
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
              className={`flex items-center group text-left rounded-md focus:outline-none focus:ring-2 focus:ring-accent-primary focus:ring-offset-2 focus:ring-offset-brand-dark-blue hover:bg-white/10 transition-colors px-2 py-1.5 w-full ${isCollapsed ? 'justify-center' : ''}`}
              aria-label="Menu do usuário"
            >
              <img
                className="h-8 w-8 rounded-full flex-shrink-0 ring-1 ring-white/10 group-hover:ring-accent-primary transition"
                src={`https://ui-avatars.com/api/?name=${user?.email}&background=0D8ABC&color=fff`}
                alt="Avatar"
              />
              {!isCollapsed && (
                <>
                  <div className="ml-2 min-w-0 flex-1">
                    <p className="text-xs font-medium text-brand-snow-white truncate group-hover:text-white leading-tight">{profile?.full_name || 'Usuário'}</p>
                    <p className="text-[10px] text-gray-400 truncate leading-tight">v{appVersion}</p>
                  </div>
                  <Icon name={isUserMenuOpen ? 'ChevronUp' : 'ChevronDown'} className="w-4 h-4 text-gray-400 flex-shrink-0" />
                </>
              )}
            </button>

            {/* Dropdown Menu - Ajustado para funcionar tanto expandido quanto recolhido */}
            {isUserMenuOpen && (
              <div className={`absolute bottom-full mb-2 bg-bg-secondary border border-gray-600 rounded-lg shadow-lg overflow-hidden min-w-[160px] z-50 ${isCollapsed ? 'left-14' : 'left-0 right-0'}`}>
                <div className="py-1">
                  {/* Configurações */}
                  {profile && (profile.role === 'admin' || profile.role === 'user') && (
                    <button
                      onClick={() => {
                        setView('configuracoes', null);
                        setIsUserMenuOpen(false);
                        setSidebarOpen(false);
                      }}
                      className="w-full flex items-center gap-2 px-4 py-2 text-sm text-text-primary hover:bg-white/10 transition-colors"
                    >
                      <Icon name="Settings" className="w-4 h-4" />
                      <span>Configurações</span>
                    </button>
                  )}



                  {/* Perfil */}
                  <button
                    onClick={() => {
                      setIsProfileModalOpen(true);
                      setIsUserMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-2 px-4 py-2 text-sm text-text-primary hover:bg-white/10 transition-colors"
                  >
                    <Icon name="User" className="w-4 h-4" />
                    <span>Perfil</span>
                  </button>

                  {/* Divider */}
                  <div className="border-t border-gray-600 my-1"></div>

                  {/* Sair */}
                  <button
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      logout();
                    }}
                    className="w-full flex items-center gap-2 px-4 py-2 text-sm text-danger hover:bg-danger/10 transition-colors"
                  >
                    <Icon name="logout" className="w-4 h-4" />
                    <span>Sair</span>
                  </button>
                </div>
              </div>
            )}
          </div>
          {isCollapsed && <p className="text-[9px] text-gray-400 text-center mt-1">v{appVersion}</p>}
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