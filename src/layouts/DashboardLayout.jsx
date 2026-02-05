import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';

const DashboardLayout = () => {
    const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
    const navigate = useNavigate();
    const location = useLocation();

    // 새 세션(브라우저 재시작)일 때 대시보드로 리다이렉트
    useEffect(() => {
        const hasVisited = sessionStorage.getItem('hasVisited');

        if (!hasVisited && location.pathname !== '/') {
            // 새 세션이고 대시보드가 아닌 페이지에 있으면 대시보드로
            navigate('/', { replace: true });
        }

        // 세션에 방문 기록 저장
        sessionStorage.setItem('hasVisited', 'true');
    }, [navigate, location.pathname]);

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
