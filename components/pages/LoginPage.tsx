import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';

const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
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
              width="180"
              height="60"
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
                  className="block w-full rounded-xl border border-white/10 bg-white/15 px-4 py-3 text-white placeholder-white/40 outline-none transition focus:border-[#fd24a0] focus:ring-2 focus:ring-[#fd24a0]"
                  placeholder="Digite seu e-mail"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="password" className="block mb-2 text-sm font-medium text-white/90">
                  Senha
                </label>
                <div className="relative">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    required
                    className="block w-full rounded-xl border border-white/10 bg-white/15 px-4 py-3 pr-12 text-white placeholder-white/40 outline-none transition focus:border-[#fd24a0] focus:ring-2 focus:ring-[#fd24a0]"
                    placeholder="Digite sua senha"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className={`absolute right-3 top-1/2 -translate-y-1/2 transition ${
                      password ? 'text-[#010d32] hover:text-[#0A1A4A]' : 'text-white/60 hover:text-white/90'
                    }`}
                    aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  >
                    {showPassword ? (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z" clipRule="evenodd" />
                        <path d="M12.454 16.697L9.75 13.992a4 4 0 01-3.742-3.741L2.335 6.578A9.98 9.98 0 00.458 10c1.274 4.057 5.065 7 9.542 7 .847 0 1.669-.105 2.454-.303z" />
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                        <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </button>
                </div>
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