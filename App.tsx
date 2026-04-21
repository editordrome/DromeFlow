import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { AppContextProvider } from './contexts/AppContext';
import LoginPage from './components/pages/LoginPage';
import DashboardPage from './components/pages/DashboardPage';
import { UpdatePrompt } from './components/UpdatePrompt';

// Lazy loading da página externa para não pesar o bundle principal
const AgendaExternaPage = React.lazy(() => import('./components/pages/AgendaExternaPage'));
const OnboardingPage = React.lazy(() => import('./components/pages/OnboardingPage'));
const RegistrationPage = React.lazy(() => import('./components/pages/RegistrationPage'));

const App: React.FC = () => {
  const [publicView, setPublicView] = useState<'agenda' | 'onboarding' | 'registration' | null>(null);

  useEffect(() => {
    const { pathname, hostname } = window.location;

    // Roteamento Cadastro/Venda
    const isRegistrationSubdomain = hostname.startsWith('cadastro.');
    if (isRegistrationSubdomain) {
      setPublicView('registration');
      return;
    }

    // Roteamento Landing Page / Onboarding
    const isOnboardingSubdomain = hostname.startsWith('landpage.') || hostname.startsWith('onboarding.');
    const hasOnboardingPrefix = pathname.startsWith('/onboarding') || pathname.startsWith('/lp');

    if (isOnboardingSubdomain || hasOnboardingPrefix) {
      setPublicView('onboarding');
      return;
    }

    // Roteamento Agenda
    const isAgendaSubdomain = hostname.startsWith('agenda.');
    const hasAgendaPrefix = pathname.startsWith('/p/agenda/') || pathname.startsWith('/agenda/');

    if (isAgendaSubdomain || hasAgendaPrefix) {
      setPublicView('agenda');
      return;
    }
  }, []);

  if (publicView === 'agenda') {
    return (
      <React.Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-[#0B0F19] text-white">Carregando...</div>}>
        <AgendaExternaPage />
      </React.Suspense>
    );
  }

  if (publicView === 'onboarding') {
    return (
      <React.Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-[#0B0F19] text-white">Carregando...</div>}>
        <OnboardingPage />
      </React.Suspense>
    );
  }

  if (publicView === 'registration') {
    return (
      <React.Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-[#0B0F19] text-white">Carregando...</div>}>
        <RegistrationPage />
      </React.Suspense>
    );
  }

  return (
    <AuthProvider>
      <UpdatePrompt />
      <Main />
    </AuthProvider>
  );
};


const Main: React.FC = () => {
  const { user } = useAuth();

  if (!user) {
    return <LoginPage />;
  }

  return (
    <AppContextProvider>
      <UpdatePrompt />
      <DashboardPage />
    </AppContextProvider>
  );
};

export default App;
