import React, { createContext, useState, useContext, ReactNode, useEffect } from 'react';
import { Unit, Module, PageView } from '../types';
import { useAuth } from './AuthContext';

interface AppContextType {
  selectedUnit: Unit | null | { id: 'ALL'; unit_name: string; unit_code: 'ALL' };
  setSelectedUnit: (unit: Unit | null | { id: 'ALL'; unit_name: string; unit_code: 'ALL' }) => void;
  activeView: PageView;
  activeModule: Module | null;
  setView: (view: PageView, module?: Module | null) => void;
}

import { parseUnitAndModule, buildUnitModuleUrl, updateBrowserPath } from '../services/utils/urlUtils';

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppContextProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { userModules, userUnits, loading, getModulesForUnit } = useAuth();
  const [selectedUnit, setSelectedUnitState] = useState<Unit | null | { id: 'ALL'; unit_name: string; unit_code: 'ALL' }>(null);
  // Inicializa como 'welcome' temporariamente até carregar módulos
  const [activeView, setActiveView] = useState<PageView>('welcome');
  const [activeModule, setActiveModule] = useState<Module | null>(null);
  const [hasInitialized, setHasInitialized] = useState(false);


  // Persiste seleção de unidade
  const setSelectedUnit = (unit: Unit | null | { id: 'ALL'; unit_name: string; unit_code: 'ALL' }) => {
    const prevUnit = selectedUnit;
    setSelectedUnitState(unit as any);

    try {
      if (!unit) {
        localStorage.removeItem('df_selected_unit_id');
      } else if ((unit as any).id === 'ALL') {
        localStorage.setItem('df_selected_unit_id', 'ALL');
      } else {
        localStorage.setItem('df_selected_unit_id', (unit as Unit).id);

        // Se a unidade mudou e tem slug, verifica se precisa mudar o subdomínio
        const unitObj = unit as Unit;
        if (unitObj.slug && (!prevUnit || (prevUnit as Unit).slug !== unitObj.slug)) {
          const newUrl = buildUnitModuleUrl(unitObj.slug);
          if (new URL(newUrl).hostname !== window.location.hostname) {
            window.location.href = newUrl; // Redireciona para o novo subdomínio
          }
        }
      }
    } catch { }
  };

  // Persiste view/módulo
  const setView = (view: PageView, module: Module | null = null) => {
    setActiveView(view);
    setActiveModule(module);
    try {
      localStorage.setItem('df_active_view', view);
      if (view === 'module' && module?.id) {
        localStorage.setItem('df_active_module_id', module.id);
        updateBrowserPath(module.code || view);
      } else {
        localStorage.removeItem('df_active_module_id');
        if (view !== 'welcome') {
          updateBrowserPath(view);
        } else {
          updateBrowserPath(null);
        }
      }
    } catch { }
  };

  // Restaura seleção a partir do localStorage após Auth carregar
  useEffect(() => {
    if (loading) return;
    // Restaurar Unidade
    try {
      const { unitSlug } = parseUnitAndModule();
      const storedUnitId = localStorage.getItem('df_selected_unit_id');

      if (!selectedUnit) {
        // 1. Tenta pelo Subdomínio/URL (Prioridade máxima)
        if (unitSlug) {
          const foundUnit = userUnits.find(u => u.slug === unitSlug);
          if (foundUnit) {
            setSelectedUnit(foundUnit);
            return;
          }
        }

        // 2. Fallback para localStorage
        if (storedUnitId) {
          if (storedUnitId === 'ALL') {
            setSelectedUnit({ id: 'ALL', unit_name: 'Todas as Unidades', unit_code: 'ALL' } as any);
          } else {
            const foundUnit = userUnits.find(u => u.id === storedUnitId);
            if (foundUnit) setSelectedUnit(foundUnit);
          }
        }
        // 3. Sem cache ou não encontrado: se houver unidades disponíveis, seleciona a primeira
        if (!selectedUnit && !unitSlug && !storedUnitId && userUnits.length > 0) {
          setSelectedUnit(userUnits[0]);
        }
      }
    } catch { }
  }, [loading, userUnits, selectedUnit]);

  // Listener para evento de mudança de unidade (disparado pelo toggleAdminView)
  useEffect(() => {
    const handleUnitChange = (event: CustomEvent) => {
      const unit = event.detail;
      if (unit && unit.id) {
        console.log('[AppContext] Evento de mudança de unidade recebido:', unit);
        setSelectedUnit(unit);
        setHasInitialized(false); // Reset para recarregar módulos
      }
    };

    window.addEventListener('df_unit_changed', handleUnitChange as EventListener);
    return () => {
      window.removeEventListener('df_unit_changed', handleUnitChange as EventListener);
    };
  }, []);

  // Carrega o primeiro módulo disponível para a unidade selecionada
  useEffect(() => {
    const loadFirstModuleForUnit = async () => {
      if (loading || !selectedUnit || hasInitialized) return;

      try {
        // Busca módulos para a unidade selecionada
        const modulesForUnit = await getModulesForUnit(selectedUnit.id);
        const activeModulesForUnit = modulesForUnit.filter(m => m.is_active);

        if (activeModulesForUnit.length > 0) {
          // Tenta restaurar view da URL ou localStorage
          const { moduleCode: urlModuleCode } = parseUnitAndModule();
          const storedView = (localStorage.getItem('df_active_view') as PageView | null) || null;
          const storedModuleId = localStorage.getItem('df_active_module_id');

          // 1. Tenta restaurar módulo pela URL (path)
          if (urlModuleCode) {
            const foundModule = activeModulesForUnit.find(m => m.code === urlModuleCode);
            if (foundModule) {
              setActiveView('module');
              setActiveModule(foundModule);
              setHasInitialized(true);
              return;
            } else {
              // Pode ser uma view interna direto na URL (ex: /dashboard)
              const internalView = urlModuleCode.replace(/-/g, '_');
              const foundByViewId = activeModulesForUnit.find(m => (m.view_id || '').toLowerCase().replace(/-/g, '_') === internalView);

              if (foundByViewId) {
                setActiveView(internalView as PageView);
                setActiveModule(foundByViewId);
                setHasInitialized(true);
                return;
              }
            }
          }

          // 2. Se há módulo no localStorage e ele existe na unidade atual, restaura
          if (storedView === 'module' && storedModuleId) {
            const foundModule = activeModulesForUnit.find(m => m.id === storedModuleId);
            if (foundModule) {
              setActiveView('module');
              setActiveModule(foundModule);
              setHasInitialized(true);
              return;
            }
          }

          // Se há view no localStorage e não é módulo, restaura (ex: dashboard, data)
          if (storedView && storedView !== 'module') {
            setView(storedView);
            setHasInitialized(true);
            return;
          }

          // Caso contrário, carrega o PRIMEIRO módulo ativo da unidade
          const firstModule = activeModulesForUnit[0];
          console.log('[AppContext] Carregando primeiro módulo para unidade:', selectedUnit, firstModule.name);

          // Se o módulo tem view_id, usa diretamente
          const viewIdNorm = (firstModule.view_id || '').toLowerCase().replace(/-/g, '_');
          const url = (firstModule.webhook_url || '').toLowerCase();
          const internalView = url.startsWith('internal://') ? url.slice('internal://'.length).replace(/-/g, '_') : '';
          const target = viewIdNorm || internalView;

          if (target) {
            setView(target as PageView, null);
          } else {
            setActiveView('module');
            setActiveModule(firstModule);
          }
          setHasInitialized(true);
        } else {
          // Se não há módulos ativos na unidade, vai para welcome
          console.log('[AppContext] Nenhum módulo ativo para unidade:', selectedUnit);
          setView('welcome');
          setHasInitialized(true);
        }
      } catch (err) {
        console.error('[AppContext] Erro ao carregar módulos da unidade:', err);
        setView('welcome');
        setHasInitialized(true);
      }
    };

    loadFirstModuleForUnit();
  }, [loading, selectedUnit, hasInitialized, getModulesForUnit]);

  // Quando mudar de unidade (após inicialização), recarrega o primeiro módulo
  useEffect(() => {
    if (!hasInitialized || loading) return;

    const reloadFirstModuleForUnit = async () => {
      if (!selectedUnit) return;

      try {
        const modulesForUnit = await getModulesForUnit(selectedUnit.id);
        const activeModulesForUnit = modulesForUnit.filter(m => m.is_active);

        if (activeModulesForUnit.length > 0) {
          const firstModule = activeModulesForUnit[0];
          console.log('[AppContext] Mudança de unidade - carregando primeiro módulo:', firstModule.name);

          // Se o módulo tem view_id, usa diretamente
          const viewIdNorm = (firstModule.view_id || '').toLowerCase().replace(/-/g, '_');
          const url = (firstModule.webhook_url || '').toLowerCase();
          const internalView = url.startsWith('internal://') ? url.slice('internal://'.length).replace(/-/g, '_') : '';
          const target = viewIdNorm || internalView;

          if (target) {
            setView(target as PageView, null);
          } else {
            setActiveView('module');
            setActiveModule(firstModule);
          }
        } else {
          console.log('[AppContext] Unidade sem módulos ativos');
          setView('welcome');
        }
      } catch (err) {
        console.error('[AppContext] Erro ao recarregar módulos da unidade:', err);
      }
    };

    reloadFirstModuleForUnit();
  }, [selectedUnit?.id]); // Observa apenas mudanças no ID da unidade

  return (
    <AppContext.Provider value={{ selectedUnit, setSelectedUnit, activeView, activeModule, setView }}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = (): AppContextType => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within an AppContextProvider');
  }
  return context;
};
