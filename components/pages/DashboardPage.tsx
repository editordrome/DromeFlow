import React, { useState } from 'react';
import Sidebar from '../layout/Sidebar';
import ContentArea from '../layout/ContentArea';

const DashboardPage: React.FC = () => {
    const [sidebarOpen, setSidebarOpen] = useState(false);

    return (
        <div className="flex h-screen bg-bg-primary overflow-x-hidden">
            <Sidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
            <div className="flex flex-col flex-1 min-h-0 w-0">
                <header className="relative z-10 flex items-center justify-between px-4 py-3 bg-bg-secondary border-b border-border-primary lg:hidden">
                    <h1 className="text-xl font-semibold text-text-primary">Painel</h1>
                    <button
                        onClick={() => setSidebarOpen(true)}
                        className="text-text-secondary focus:outline-none focus:text-text-primary"
                    >
                        <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M4 6H20M4 12H20M4 18H11V16H4V18Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                    </button>
                </header>
                <main className="flex-1 p-4 lg:p-6 overflow-x-hidden overflow-y-auto min-h-0">
                    <ContentArea />
                </main>
            </div>
        </div>
    );
};

export default DashboardPage;
