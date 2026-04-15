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
  const [isFirstLoad, setIsFirstLoad] = useState(true);
  
  // Resolve qual view deve ser exibida para um determinado módulo
  const resolveTargetView = (module: Module): { view: PageView, mod: Module | null } => {
    const viewIdNorm = (module.view_id || '').toLowerCase().replace(/-/g, '_');
    const url = (module.webhook_url || '').toLowerCase();
    const internalView = url.startsWith('internal://') ? url.slice('internal://'.length).replace(/-/g, '_') : '';
    const target = viewIdNorm || internalView;

    if (target) {
      return { view: target as PageView, mod: null };
    }
    return { view: 'module', mod: module };
  };

  // Encontra o melhor módulo para ser a página inicial
  const findBestInitialModule = (modules: Module[]): Module | undefined => {
    if (modules.length === 0) return undefined;
    // 1. Dashboards
    const dashboard = modules.find(m =>
      (m.code || '').toLowerCase().includes('dashboard') ||
      m.name.toLowerCase().includes('dashboard') ||
      m.name.toLowerCase().includes('indicadores')
    );
    if (dashboard) return dashboard;
    // 2. Não configurações
    const nonConfig = modules.find(m =>
      !m.code?.toLowerCase().includes('settings') &&
      !m.code?.toLowerCase().includes('config') &&
      !m.name.toLowerCase().includes('configura')
    );
    if (nonConfig) return nonConfig;
    // 3. Primeiro da lista
    return modules[0];
  };


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
              const { view, mod } = resolveTargetView(foundModule);
              setActiveView(view);
              setActiveModule(mod);
              setHasInitialized(true);
              setIsFirstLoad(false);
              return;
            } else {
              // Pode ser uma view interna direto na URL (ex: /dashboard)
              const internalView = urlModuleCode.replace(/-/g, '_');
              const foundByViewId = activeModulesForUnit.find(m => (m.view_id || '').toLowerCase().replace(/-/g, '_') === internalView);

              if (foundByViewId) {
                setActiveView(internalView as PageView);
                setActiveModule(foundByViewId);
                setHasInitialized(true);
                setIsFirstLoad(false);
                return;
              }
            }
          }

          // 2. Se há módulo no localStorage e ele existe na unidade atual, restaura
          if (storedView === 'module' && storedModuleId) {
            const foundModule = activeModulesForUnit.find(m => m.id === storedModuleId);
            if (foundModule) {
              const { view, mod } = resolveTargetView(foundModule);
              setActiveView(view);
              setActiveModule(mod);
              setHasInitialized(true);
              setIsFirstLoad(false);
              return;
            }
          }

          // Se há view no localStorage e não é módulo, restaura (ex: dashboard, data)
          if (storedView && storedView !== 'module') {
            setView(storedView);
            setHasInitialized(true);
            setIsFirstLoad(false);
            return;
          }

          // Caso contrário, carrega o MELHOR módulo inicial ativo da unidade
          const bestModule = findBestInitialModule(activeModulesForUnit);
          if (bestModule) {
            console.log('[AppContext] Selecionando melhor módulo inicial:', selectedUnit, bestModule.name);
            const { view, mod } = resolveTargetView(bestModule);
            setActiveView(view);
            setActiveModule(mod);
          } else {
            setView('welcome');
          }
          setHasInitialized(true);
          setIsFirstLoad(false);
        } else {
          // Se não há módulos ativos na unidade, vai para welcome
          console.log('[AppContext] Nenhum módulo ativo para unidade:', selectedUnit);
          setView('welcome');
          setHasInitialized(true);
          setIsFirstLoad(false);
        }
      } catch (err) {
        console.error('[AppContext] Erro ao carregar módulos da unidade:', err);
        setView('welcome');
        setHasInitialized(true);
        setIsFirstLoad(false);
      }
    };

    loadFirstModuleForUnit();
  }, [loading, selectedUnit, hasInitialized, getModulesForUnit]);

  // Quando mudar de unidade (após inicialização MANUAL), recarrega o primeiro módulo
  useEffect(() => {
    // Se for a primeira carga ou estiver carregando, não sobrescreve a restauração
    if (!hasInitialized || loading || isFirstLoad) return;

    const reloadFirstModuleForUnit = async () => {
      if (!selectedUnit) return;

      try {
        const modulesForUnit = await getModulesForUnit(selectedUnit.id);
        const activeModulesForUnit = modulesForUnit.filter(m => m.is_active);

        if (activeModulesForUnit.length > 0) {
          const bestModule = findBestInitialModule(activeModulesForUnit);
          if (bestModule) {
            console.log('[AppContext] Mudança de unidade - carregando melhor módulo:', bestModule.name);
            const { view, mod } = resolveTargetView(bestModule);
            setActiveView(view);
            setActiveModule(mod);
          } else {
            setView('welcome');
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
  }, [selectedUnit?.id, hasInitialized, isFirstLoad]);
 // Observa apenas mudanças no ID da unidade

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
