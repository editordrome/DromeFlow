import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { UserRole } from '../../types';

const WelcomePage: React.FC = () => {
  const { profile } = useAuth();

  return (
    <div className="flex items-center justify-center h-full p-4 bg-bg-secondary rounded-lg shadow-md">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-text-primary">Bem-vindo(a), {profile?.full_name}!</h1>
        <p className="mt-4 text-lg text-text-secondary">
          {profile?.role === UserRole.SUPER_ADMIN
            ? 'Use os links de administração na barra lateral para gerenciar o sistema.'
            : 'Por favor, selecione uma unidade e um módulo na barra lateral para começar.'}
        </p>
      </div>
    </div>
  );
};

export default WelcomePage;
