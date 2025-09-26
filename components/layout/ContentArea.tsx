import React, { useEffect, useState, useCallback } from 'react';
import { useAppContext } from '../../contexts/AppContext';
import { fetchWebhookContent } from '../../services/mockApi';
import WelcomePage from '../pages/WelcomePage';
import ManageUsersPage from '../pages/ManageUsersPage';
import ManageModulesPage from '../pages/ManageModulesPage';
import ManageUnitsPage from '../pages/ManageUnitsPage';
import ManageAccessPage from '../pages/ManageAccessPage';
import DataPage from '../pages/DataPage';
import DashboardMetricsPage from '../pages/DashboardMetricsPage';
import AppointmentsPage from '../pages/AppointmentsPage';
import ClientsPage from '../pages/ClientsPage';

const ContentArea: React.FC = () => {
    const { activeView, activeModule, selectedUnit } = useAppContext();
    const [content, setContent] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const loadContent = useCallback(async () => {
        if (activeView !== 'module' || !activeModule || !selectedUnit) {
            setContent('');
            return;
        }

        setIsLoading(true);
        setError(null);
        try {
            const htmlContent = await fetchWebhookContent(activeModule.webhook_url, selectedUnit.unit_code);
            setContent(htmlContent);
        } catch (err: any) {
            setError(err.message || 'Falha ao carregar o conteúdo.');
            setContent('');
        } finally {
            setIsLoading(false);
        }
    }, [activeView, activeModule, selectedUnit]);

    useEffect(() => {
        loadContent();
    }, [loadContent]);

    if (activeView === 'welcome') {
        return <WelcomePage />;
    }
    if (activeView === 'dashboard') {
        return <DashboardMetricsPage />;
    }
    if (activeView === 'manage_users') {
        return <ManageUsersPage />;
    }
    if (activeView === 'manage_modules') {
        return <ManageModulesPage />;
    }
    if (activeView === 'manage_units') {
        return <ManageUnitsPage />;
    }
    if (activeView === 'manage_access') {
        return <ManageAccessPage />;
    }
    if (activeView === 'data') {
        return <DataPage />;
    }
    if (activeView === 'appointments' || activeView === 'agenda') {
        return <AppointmentsPage />;
    }
        if (activeView === 'clients') {
            return <ClientsPage />;
        }
    
    // Default to module view
    return (
        <div className="p-4 bg-bg-secondary rounded-lg shadow-md h-full">
            {isLoading && (
                <div className="flex items-center justify-center h-full">
                    <div className="w-16 h-16 border-4 border-t-4 border-gray-200 rounded-full animate-spin border-t-accent-primary"></div>
                </div>
            )}
            {error && <div className="p-4 text-danger bg-danger/10 border border-danger/30 rounded-md">{error}</div>}
            
            {!isLoading && !error && (
                <div>
                    <h1 className="text-2xl font-bold text-text-primary mb-4">{activeModule?.name}</h1>
                    <div
                        className="prose max-w-none"
                        // Segurança: evita injetar HTML externo não confiável.
                        // Permite apenas conteúdo com esquema internal://. Caso contrário, mostra aviso seguro.
                        dangerouslySetInnerHTML={{ __html: activeModule?.webhook_url?.startsWith('internal://') ? content : '<p>Conteúdo externo bloqueado por segurança.</p>' }}
                    />
                </div>
            )}
        </div>
    );
};

export default ContentArea;