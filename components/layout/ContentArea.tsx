import React, { useEffect, useState, useCallback, lazy, Suspense } from 'react';
import { useAppContext } from '../../contexts/AppContext';
import { fetchWebhookContent } from '../../services/content/content.service';

// Lazy loading das páginas
const WelcomePage = lazy(() => import('../pages/WelcomePage'));
const ManageUsersPage = lazy(() => import('../pages/ManageUsersPage'));
const ManageModulesPage = lazy(() => import('../pages/ManageModulesPage'));
const ManageUnitsPage = lazy(() => import('../pages/ManageUnitsPage'));
const ManageAccessPage = lazy(() => import('../pages/ManageAccessPage'));
const DataPage = lazy(() => import('../pages/DataPage'));
const DashboardMetricsPage = lazy(() => import('../pages/DashboardMetricsPage'));
const AppointmentsPage = lazy(() => import('../pages/AppointmentsPage'));
const ClientsPage = lazy(() => import('../pages/ClientsPage'));
const ClientsBasePage = lazy(() => import('../pages/ClientsBasePage'));
const RecrutadoraPage = lazy(() => import('../pages/RecrutadoraPage'));
const ProfissionaisPage = lazy(() => import('../pages/ProfissionaisPage'));
const PrestadorasPage = lazy(() => import('../pages/PrestadorasPage'));
const UnitKeysPage = lazy(() => import('../pages/UnitKeysPage'));
const ComercialPage = lazy(() => import('../pages/ComercialPage'));

// Loading component
const PageLoader = () => (
    <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="w-16 h-16 border-4 border-t-4 border-gray-200 rounded-full animate-spin border-t-accent-primary"></div>
    </div>
);

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

    // Envolver cada página com Suspense para lazy loading
    if (activeView === 'welcome') {
        return <Suspense fallback={<PageLoader />}><WelcomePage /></Suspense>;
    }
    if (activeView === 'dashboard') {
        return <Suspense fallback={<PageLoader />}><DashboardMetricsPage /></Suspense>;
    }
    if (activeView === 'manage_users') {
        return <Suspense fallback={<PageLoader />}><ManageUsersPage /></Suspense>;
    }
    if (activeView === 'manage_modules') {
        return <Suspense fallback={<PageLoader />}><ManageModulesPage /></Suspense>;
    }
    if (activeView === 'manage_units') {
        return <Suspense fallback={<PageLoader />}><ManageUnitsPage /></Suspense>;
    }
    if (activeView === 'manage_access') {
        return <Suspense fallback={<PageLoader />}><ManageAccessPage /></Suspense>;
    }
    if (activeView === 'data') {
        return <Suspense fallback={<PageLoader />}><DataPage /></Suspense>;
    }
    if (activeView === 'appointments' || activeView === 'agenda') {
        return <Suspense fallback={<PageLoader />}><AppointmentsPage /></Suspense>;
    }
    if (activeView === 'clients') {
        return <Suspense fallback={<PageLoader />}><ClientsPage /></Suspense>;
    }
    if (activeView === 'clients_base') {
        return <Suspense fallback={<PageLoader />}><ClientsBasePage /></Suspense>;
    }
    if (activeView === 'recrutadora') {
        return <Suspense fallback={<PageLoader />}><RecrutadoraPage /></Suspense>;
    }
    if (activeView === 'profissionais') {
        return <Suspense fallback={<PageLoader />}><ProfissionaisPage /></Suspense>;
    }
    if (activeView === 'prestadoras') {
        return <Suspense fallback={<PageLoader />}><PrestadorasPage /></Suspense>;
    }
    if (activeView === 'unit_keys') {
        return <Suspense fallback={<PageLoader />}><UnitKeysPage /></Suspense>;
    }
    if (activeView === 'comercial') {
        return <Suspense fallback={<PageLoader />}><ComercialPage /></Suspense>;
    }
    
    // Default to module view
    return (
        <div className="h-full w-full bg-bg-secondary rounded-lg shadow-md overflow-hidden flex flex-col">
            {!activeModule && (
                <div className="flex items-center justify-center h-full">
                    <p className="text-text-secondary text-center px-4">Selecione um módulo na barra lateral para começar.</p>
                </div>
            )}
            
            {activeModule && isLoading && (
                <div className="flex items-center justify-center h-full min-h-[400px]">
                    <div className="w-16 h-16 border-4 border-t-4 border-gray-200 rounded-full animate-spin border-t-accent-primary"></div>
                </div>
            )}
            
            {activeModule && error && (
                <div className="p-4 text-danger bg-danger/10 border border-danger/30 rounded-md m-4">{error}</div>
            )}
            
            {activeModule && !isLoading && !error && (
                <div className="flex-1 overflow-y-auto overflow-x-hidden p-4">
                    <div
                        className="prose max-w-none break-words"
                        dangerouslySetInnerHTML={{ __html: activeModule?.webhook_url?.startsWith('internal://') ? content : '<p>Conteúdo externo bloqueado por segurança.</p>' }}
                    />
                </div>
            )}
        </div>
    );
};

export default ContentArea;