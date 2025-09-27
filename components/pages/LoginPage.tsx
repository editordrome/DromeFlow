import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { createUser } from '../../services/auth/users.service';
import { UserRole } from '../../types';

const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('super@admin.com');
  const [password, setPassword] = useState('password123');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
    } catch (err: any) {
      setError(err.message || 'Falha no login');
    } finally {
      setLoading(false);
    }
  };

  const handleClearSession = async () => {
    try {
      setError('');
      setLoading(true);
      // Faz signOut para limpar sessão no Supabase
      await (await import('../../services/supabaseClient')).supabase.auth.signOut();
      // Limpa chaves locais do Supabase (sb-*) caso tenham ficado corrompidas
      Object.keys(localStorage)
        .filter((k) => k.startsWith('sb-'))
        .forEach((k) => localStorage.removeItem(k));
      sessionStorage.clear();
    } catch (err: any) {
      console.error('Falha ao limpar sessão:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAdminDev = async () => {
    try {
      setError('');
      setLoading(true);
      await createUser({
        email,
        password,
        full_name: 'Admin',
        role: UserRole.SUPER_ADMIN,
        unit_ids: [],
        module_ids: []
      });
      await login(email, password);
    } catch (err: any) {
      setError(err.message || 'Falha ao criar usuário admin');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-bg-primary">
      <div className="w-full max-w-md p-8 space-y-8 bg-bg-secondary rounded-lg shadow-lg">
        <div className="text-center">
          <h2 className="text-3xl font-extrabold text-text-primary">Acesse sua conta</h2>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleLogin}>
          <div className="space-y-4 rounded-md">
            <div>
              <label htmlFor="email-address" className="sr-only">Endereço de e-mail</label>
              <input
                id="email-address"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="relative block w-full px-3 py-2 placeholder-text-secondary border border-border-secondary rounded-md appearance-none text-text-primary bg-bg-secondary focus:outline-none focus:ring-accent-primary focus:border-accent-primary focus:z-10 sm:text-sm"
                placeholder="Endereço de e-mail"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="password" className="sr-only">Senha</label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="relative block w-full px-3 py-2 placeholder-text-secondary border border-border-secondary rounded-md appearance-none text-text-primary bg-bg-secondary focus:outline-none focus:ring-accent-primary focus:border-accent-primary focus:z-10 sm:text-sm"
                placeholder="Senha"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          {error && <p className="text-sm text-danger">{error}</p>}

          <div>
            <button
              type="submit"
              disabled={loading}
              className="relative flex justify-center w-full px-4 py-2 text-sm font-medium border border-transparent rounded-md group bg-accent-primary text-text-on-accent hover:bg-accent-secondary focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-accent-primary disabled:bg-accent-primary/60"
            >
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </div>
        </form>
        {import.meta.env.DEV && (
          <div className="mt-4">
            <button
              type="button"
              onClick={handleCreateAdminDev}
              disabled={loading}
              className="w-full text-sm text-text-primary underline hover:text-accent-primary disabled:text-text-secondary"
            >
              Criar usuário admin (dev)
            </button>
            <p className="mt-2 text-xs text-text-secondary">Usa auto-confirmação e cria perfil com papel super_admin.</p>
            <button
              type="button"
              onClick={handleClearSession}
              disabled={loading}
              className="mt-3 w-full text-sm text-text-primary underline hover:text-accent-primary disabled:text-text-secondary"
            >
              Limpar sessão/token local
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default LoginPage;