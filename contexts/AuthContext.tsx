import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import { supabase } from '../services/supabaseClient';
import { User, Profile, Module, Unit } from '../types';

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  userModules: Module[];
  userUnits: Unit[];
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  loading: boolean;
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

  // Carrega unidades do usuário (não centralizado antes). Para super_admin mantemos comportamento atual: nenhuma unidade listada.
  const fetchUnitsForUser = async (profile: Profile) => {
    if (profile.role === 'super_admin') {
      setUserUnits([]);
      return;
    }
    try {
  // Usa serviço segmentado com fallback (RPC get_user_units -> fallback join manual)
  const { fetchUserUnits } = await import('../services/auth/users.service');
      const units = await fetchUserUnits(profile.id as string);
      // Ordena por nome para consistência
      const ordered = [...units].sort((a,b)=> a.unit_name.localeCompare(b.unit_name));
      setUserUnits(ordered);
    } catch (err) {
      console.error('Erro ao carregar unidades do usuário:', err);
      setUserUnits([]);
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
  };

  const logout = () => {
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
    } catch {}
  };

  const value = {
    user,
    profile,
    userModules,
    userUnits,
    login,
    logout,
    loading,
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
