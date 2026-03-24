import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { AppContextProvider } from './contexts/AppContext';
import LoginPage from './components/pages/LoginPage';
import DashboardPage from './components/pages/DashboardPage';
import { UpdatePrompt } from './components/UpdatePrompt';

// Lazy loading da página externa para não pesar o bundle principal
const AgendaExternaPage = React.lazy(() => import('./components/pages/AgendaExternaPage'));

const App: React.FC = () => {
  const [isPublicRoute, setIsPublicRoute] = useState(false);

  useEffect(() => {
    const { pathname, hostname } = window.location;
    // Verifica se é o subdomínio dedicado ou se tem os prefixos legados
    const isAgendaSubdomain = hostname.startsWith('agenda.');
    const hasAgendaPrefix = pathname.startsWith('/p/agenda/') || pathname.startsWith('/agenda/');
    
    if (isAgendaSubdomain || hasAgendaPrefix) {
      setIsPublicRoute(true);
    }
  }, []);

  if (isPublicRoute) {
    return (
      <React.Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-[#0B0F19] text-white">Carregando...</div>}>
         <AgendaExternaPage />
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
