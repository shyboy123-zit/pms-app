import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';

const DashboardLayout = () => {
    return (
        <div style={{ display: 'flex', minHeight: '100vh', background: '#f1f5f9' }}>
            <Sidebar />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <Header />
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
