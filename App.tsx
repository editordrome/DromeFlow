

import React from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { AppContextProvider } from './contexts/AppContext';
import LoginPage from './components/pages/LoginPage';
import DashboardPage from './components/pages/DashboardPage';
import { UpdatePrompt } from './components/UpdatePrompt';

const App: React.FC = () => {
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
