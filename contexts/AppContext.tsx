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

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppContextProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { userModules, userUnits, loading } = useAuth();
  const [selectedUnit, setSelectedUnitState] = useState<Unit | null | { id: 'ALL'; unit_name: string; unit_code: 'ALL' }>(null);
  // Inicializa diretamente no dashboard conforme solicitação.
  const [activeView, setActiveView] = useState<PageView>('dashboard');
  const [activeModule, setActiveModule] = useState<Module | null>(null);

  // Persiste seleção de unidade
  const setSelectedUnit = (unit: Unit | null | { id: 'ALL'; unit_name: string; unit_code: 'ALL' }) => {
    setSelectedUnitState(unit as any);
    try {
      if (!unit) {
        localStorage.removeItem('df_selected_unit_id');
      } else if ((unit as any).id === 'ALL') {
        localStorage.setItem('df_selected_unit_id', 'ALL');
      } else {
        localStorage.setItem('df_selected_unit_id', (unit as Unit).id);
      }
    } catch {}
  };

  // Persiste view/módulo
  const setView = (view: PageView, module: Module | null = null) => {
    setActiveView(view);
    setActiveModule(module);
    try {
      localStorage.setItem('df_active_view', view);
      if (view === 'module' && module?.id) {
        localStorage.setItem('df_active_module_id', module.id);
      } else {
        localStorage.removeItem('df_active_module_id');
      }
    } catch {}
  };

  // Restaura seleção a partir do localStorage após Auth carregar
  useEffect(() => {
    if (loading) return;
    // Restaurar Unidade
    try {
      const storedUnitId = localStorage.getItem('df_selected_unit_id');
      if (!selectedUnit) {
        if (storedUnitId) {
          if (storedUnitId === 'ALL') {
            setSelectedUnit({ id: 'ALL', unit_name: 'Todas as Unidades', unit_code: 'ALL' } as any);
          } else {
            const foundUnit = userUnits.find(u => u.id === storedUnitId);
            if (foundUnit) setSelectedUnit(foundUnit);
          }
        }
        // Sem cache ou não encontrado: se houver unidades disponíveis (e não for ALL), seleciona a primeira por padrão
        if (!storedUnitId && userUnits.length > 0) {
          setSelectedUnit(userUnits[0]);
        }
      }
    } catch {}

    // Restaurar View/Módulo
    try {
      const storedView = (localStorage.getItem('df_active_view') as PageView | null) || null;
      const storedModuleId = localStorage.getItem('df_active_module_id');
      if (storedView === 'module' && storedModuleId) {
        const foundModule = userModules.find(m => m.id === storedModuleId) || null;
        if (foundModule) {
          setActiveView('module');
          setActiveModule(foundModule);
          return; // já restaurou módulo
        }
      }
      if (storedView && storedView !== 'module') {
        setView(storedView);
      }
    } catch {}
  }, [loading, userUnits, userModules, selectedUnit]);

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
