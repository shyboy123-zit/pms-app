import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';

const DashboardLayout = () => {
    const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

    const toggleMobileSidebar = () => {
        setIsMobileSidebarOpen(!isMobileSidebarOpen);
    };

    const closeMobileSidebar = () => {
        setIsMobileSidebarOpen(false);
    };

    return (
        <div style={{ display: 'flex', minHeight: '100vh', background: '#f1f5f9' }}>
            <Sidebar
                isMobileOpen={isMobileSidebarOpen}
                onClose={closeMobileSidebar}
            />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <Header onToggleSidebar={toggleMobileSidebar} />
                <main style={{
                    flex: 1,
                    margin: '1rem 1rem 1rem 0',
                    overflowY: 'auto',
                    borderRadius: '1rem'
                }}>
                    <Outlet />
                </main>
            </div>
        </div>
    );
};

export default DashboardLayout;
