import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import { supabase } from '../services/supabaseClient';
import { activityLogger } from '../services/utils/activityLogger.service';
import { User, Profile, Module, Unit } from '../types';
import { fetchUnitModuleIds } from '../services/units/unitModules.service';

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  userModules: Module[];
  userUnits: Unit[];
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  loading: boolean;
  getModulesForUnit: (unitId: string | null) => Promise<Module[]>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [userModules, setUserModules] = useState<Module[]>([]);
  const [userUnits, setUserUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);

  // Nota: Agora centralizamos também as unidades do usuário aqui para:
  // 1. Evitar múltiplos fetches redundantes em componentes (Sidebar, Dashboard, etc.)
  // 2. Permitir derivar a agregação 'ALL' (Todas as Unidades) dinamicamente usando todos os unit_code disponíveis
  // 3. Futuras otimizações: poderemos cachear/invalidar quando atribuições forem alteradas (ex: após salvar ManageUsersPage)

  useEffect(() => {
    const checkStoredUser = async () => {
      const storedProfile = localStorage.getItem('userProfile');
      if (storedProfile) {
        const parsedProfile: Profile = JSON.parse(storedProfile);
        setProfile(parsedProfile);
        setUser({ id: parsedProfile.id, email: parsedProfile.email || '' });
        await Promise.all([
          fetchUserModules(parsedProfile),
          fetchUnitsForUser(parsedProfile)
        ]);
      }
      setLoading(false);
    };
    checkStoredUser();
  }, []);

  // Busca módulos disponíveis ao usuário:
  // super_admin: todos os módulos cujo allowed_profiles contém 'super_admin' e ativos
  // demais roles: somente módulos explicitamente atribuídos via user_modules
  //               E cujo allowed_profiles contenha o role do usuário; também ativos.
  const fetchUserModules = async (profile: Profile) => {
    if (profile.role === 'super_admin') {
      // Super admin agora vê SOMENTE módulos cujo allowed_profiles inclui 'super_admin' e que estejam ativos
      // (não herda mais módulos 'admin' ou públicos)
      const { data, error } = await supabase
        .from('modules')
        .select('*')
        .eq('is_active', true)
        .contains('allowed_profiles', ['super_admin']);
      if (error) {
        console.error('Error fetching super_admin scoped modules:', error.message);
        setUserModules([]);
      } else {
        const ordered = (data || []).sort((a: any, b: any) => {
          const posA = a.position ?? 0; const posB = b.position ?? 0; if (posA !== posB) return posA - posB; return a.name.localeCompare(b.name);
        });
        setUserModules(ordered as Module[]);
      }
    } else {
      // 1) Busca ids dos módulos atribuídos ao usuário
      const { data: userModulesData, error: userModulesError } = await supabase
        .from('user_modules')
        .select('module_id')
        .eq('user_id', profile.id);
      if (userModulesError) {
        console.error('Error fetching user modules:', userModulesError.message);
      }
      const moduleIds = (userModulesData || []).map(um => um.module_id);

      // 2) Se não há atribuições, não há módulos a exibir
      if (!moduleIds.length) {
        setUserModules([]);
        return;
      }

      // 3) Busca apenas os módulos atribuídos, ativos e cujo allowed_profiles contenha o role do usuário
      const { data: modules, error: modulesError } = await supabase
        .from('modules')
        .select('*')
        .in('id', moduleIds)
        .eq('is_active', true)
        .contains('allowed_profiles', [profile.role]);
      if (modulesError) {
        console.error('Error fetching assigned+allowed modules:', modulesError.message);
        setUserModules([]);
        return;
      }

      const list = (modules || []) as Module[];
      // 4) Ordena por position e nome para consistência
      const ordered = list.sort((a, b) => {
        const posA = a.position ?? 0;
        const posB = b.position ?? 0;
        if (posA !== posB) return posA - posB;
        return a.name.localeCompare(b.name);
      });
      setUserModules(ordered);
    }
  };

  // Carrega unidades do usuário. Para super_admin, agora carrega TODAS as unidades ativas para permitir a "Visão Admin".
  const fetchUnitsForUser = async (profile: Profile) => {
    if (profile.role === 'super_admin') {
      try {
        const { data, error } = await supabase
          .from('units')
          .select('*')
          .eq('is_active', true)
          .order('unit_name');

        if (error) throw error;

        const mappedUnits: Unit[] = (data || []).map(u => ({
          id: u.id,
          unit_name: u.unit_name,
          unit_code: u.unit_code,
          slug: u.slug || '', // Inclui slug vindo do banco
          is_active: u.is_active,
          created_at: u.created_at
        }));

        setUserUnits(mappedUnits);
      } catch (err) {
        console.error('[AuthContext] Erro ao carregar todas as unidades para super_admin:', err);
        setUserUnits([]);
      }
      return;
    }
    try {
      // Usa serviço segmentado com fallback (RPC get_user_units -> fallback join manual)
      const { fetchUserUnits } = await import('../services/auth/users.service');
      const units = await fetchUserUnits(profile.id as string);
      console.log('[AuthContext] Units retornadas de fetchUserUnits:', units);
      console.log('[AuthContext] Primeira unidade tem is_active?', units[0]?.is_active);
      // Ordena por nome para consistência
      const ordered = [...units].sort((a, b) => a.unit_name.localeCompare(b.unit_name));
      setUserUnits(ordered);
    } catch (err) {
      console.error('Erro ao carregar unidades do usuário:', err);
      setUserUnits([]);
    }
  };

  /**
   * Filtra módulos disponíveis para uma unidade específica
   * Hierarquia de permissões (maior prioridade primeiro):
   * 1. super_admin: Vê apenas módulos com 'super_admin' em allowed_profiles (ignora unit_modules)
   * 2. admin: Acessa TODOS os módulos atribuídos à unidade (unit_modules)
   * 3. user: Acessa apenas módulos atribuídos individualmente (user_modules) ∩ módulos da unidade (unit_modules)
   * 
   * @param unitId - ID da unidade (null = modo "ALL", retorna userModules sem filtro)
   * @returns Array de módulos permitidos para a unidade
   */
  const getModulesForUnit = async (unitId: string | null): Promise<Module[]> => {
    // Modo "ALL" (Todas as Unidades) ou sem unidade selecionada
    if (!unitId || unitId === 'ALL') {
      return userModules;
    }

    // Se não há perfil carregado, retorna vazio
    if (!profile) {
      return [];
    }

    try {
      // 0. Para SUPER_ADMIN: se houver unitId e não for 'ALL', retorna os módulos daquela unidade (Modo Admin View)
      // Se não houver unitId ou for ALL, o comportamento padrão já retorna userModules (módulos de sistema)
      if (profile.role === 'super_admin') {
        if (!unitId || unitId === 'ALL') {
          return userModules;
        }

        const unitModuleIds = await fetchUnitModuleIds(unitId);
        if (unitModuleIds.length === 0) return [];

        const { data: superAdminUnitModules, error } = await supabase
          .from('modules')
          .select('*')
          .in('id', unitModuleIds)
          .eq('is_active', true);

        if (error) {
          console.error('[AuthContext] Erro ao buscar módulos da unidade (super_admin view):', error);
          return userModules;
        }

        const list = (superAdminUnitModules || []) as Module[];
        return list.sort((a, b) => {
          const posA = a.position ?? 0;
          const posB = b.position ?? 0;
          if (posA !== posB) return posA - posB;
          return a.name.localeCompare(b.name);
        });
      }

      // 1. Busca módulos atribuídos à unidade
      const unitModuleIds = await fetchUnitModuleIds(unitId);

      // Se a unidade não tem módulos atribuídos, retorna vazio
      if (unitModuleIds.length === 0) {
        return [];
      }

      // 2. Para ADMIN: retorna TODOS os módulos da unidade (não precisa de user_modules)
      if (profile.role === 'admin') {
        const { data: adminModules, error } = await supabase
          .from('modules')
          .select('*')
          .in('id', unitModuleIds)
          .eq('is_active', true);

        if (error) {
          console.error('[AuthContext] Erro ao buscar módulos da unidade (admin):', error);
          return userModules; // Fallback
        }

        const list = (adminModules || []) as Module[];
        // Ordena por position e nome
        return list.sort((a, b) => {
          const posA = a.position ?? 0;
          const posB = b.position ?? 0;
          if (posA !== posB) return posA - posB;
          return a.name.localeCompare(b.name);
        });
      }

      // 3. Para USER: interseção entre user_modules e unit_modules
      // Busca módulos atribuídos ao usuário
      const { data: userModulesData, error: userModulesError } = await supabase
        .from('user_modules')
        .select('module_id')
        .eq('user_id', profile.id);

      if (userModulesError) {
        console.error('[AuthContext] Erro ao buscar user_modules:', userModulesError);
        return [];
      }

      const userModuleIds = (userModulesData || []).map(um => um.module_id);

      // Interseção: módulos que estão tanto em user_modules quanto em unit_modules
      const allowedModuleIds = unitModuleIds.filter(id => userModuleIds.includes(id));

      if (allowedModuleIds.length === 0) {
        return []; // Usuário não tem permissão para nenhum módulo desta unidade
      }

      const { data: userUnitModules, error: modulesError } = await supabase
        .from('modules')
        .select('*')
        .in('id', allowedModuleIds)
        .eq('is_active', true);

      if (modulesError) {
        console.error('[AuthContext] Erro ao buscar módulos do usuário na unidade:', modulesError);
        return [];
      }

      const list = (userUnitModules || []) as Module[];
      return list.sort((a, b) => {
        const posA = a.position ?? 0;
        const posB = b.position ?? 0;
        if (posA !== posB) return posA - posB;
        return a.name.localeCompare(b.name);
      });

    } catch (err) {
      console.error('[AuthContext] Erro ao filtrar módulos por unidade:', err);
      return userModules; // Fallback
    }
  };

  const login = async (email: string, password: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('email', email)
      .eq('password', password)
      .single();

    if (error || !data) {
      throw new Error('Credenciais inválidas');
    }

    setProfile(data);
    setUser({ id: data.id, email: data.email || '' });
    localStorage.setItem('userProfile', JSON.stringify(data));
    await Promise.all([
      fetchUserModules(data),
      fetchUnitsForUser(data)
    ]);

    // Registrar login no activity_logs
    const unitCode = data.units?.[0]?.code || null;
    activityLogger.logLogin(data.email || data.name, unitCode, data.role);
  };

  const logout = () => {
    // Registrar logout antes de limpar o estado
    if (profile) {
      const unitCode = profile.units?.[0]?.code || null;
      activityLogger.logLogout(profile.email || profile.name, unitCode);
    }

    setUser(null);
    setProfile(null);
    setUserModules([]);
    setUserUnits([]);
    localStorage.removeItem('userProfile');
    // Limpa cache local de seleção persistida
    try {
      localStorage.removeItem('df_selected_unit_id');
      localStorage.removeItem('df_active_view');
      localStorage.removeItem('df_active_module_id');
    } catch { }
  };

  const value = {
    user,
    profile,
    userModules,
    userUnits,
    login,
    logout,
    loading,
    getModulesForUnit,
  };

  return <AuthContext.Provider value={value}>{!loading && children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
