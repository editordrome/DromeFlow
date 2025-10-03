import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';

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

  return (
    <div
      className="min-h-screen w-full flex items-center justify-center px-4"
      style={{ background: 'linear-gradient(135deg, #010d32, #0A1A4A)' }}
    >
      <div
        className="w-full max-w-[360px] rounded-2xl shadow-2xl border border-white/10 backdrop-blur-md"
        style={{ backgroundColor: 'rgba(1, 13, 50, 0.9)' }}
      >
        <div className="p-8 md:p-10">
          <h2 className="mb-10 text-center">
            <img
              src="https://iili.io/3IVuaEb.png"
              alt="Logo DromeFlow"
              className="mx-auto max-w-[50%] h-auto"
            />
          </h2>
          <form className="space-y-6" onSubmit={handleLogin}>
            <div className="space-y-5">
              <div>
                <label htmlFor="email-address" className="block mb-2 text-sm font-medium text-white/90">
                  E-mail
                </label>
                <input
                  id="email-address"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  className="block w-full rounded-xl border border-white/10 bg-white/15 px-4 py-3 text-white placeholder-white/60 outline-none transition focus:border-[#fd24a0] focus:ring-2 focus:ring-[#fd24a0]"
                  placeholder="Digite seu e-mail"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="password" className="block mb-2 text-sm font-medium text-white/90">
                  Senha
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  className="block w-full rounded-xl border border-white/10 bg-white/15 px-4 py-3 text-white placeholder-white/60 outline-none transition focus:border-[#fd24a0] focus:ring-2 focus:ring-[#fd24a0]"
                  placeholder="Digite sua senha"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            {error && (
              <p className="text-sm mt-2 text-[#FF6B6B] text-center">{error}</p>
            )}

            <div>
              <button
                type="submit"
                disabled={loading}
                className="relative w-full rounded-xl border-0 bg-[#fd24a0] px-4 py-3 text-base font-semibold text-[#010d32] transition hover:-translate-y-0.5 hover:bg-[#E01F8C] hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-[#fd24a0] disabled:opacity-70"
              >
                {loading ? 'Entrando...' : 'Entrar'}
              </button>
            </div>
          </form>


        </div>
      </div>
    </div>
  );
};

export default LoginPage;