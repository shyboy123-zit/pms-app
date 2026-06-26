import React, { useState, useEffect, Suspense } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';

// 페이지(코드 분리) 로딩 중 내용 영역에만 표시되는 가벼운 로더 — 사이드바/헤더는 유지
const PageFallback = () => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: '#94a3b8', fontSize: '0.9rem' }}>
        <div className="page-spinner" style={{ width: 28, height: 28, border: '3px solid #e2e8f0', borderTopColor: '#6366f1', borderRadius: '50%', marginRight: 12, animation: 'pmsspin 0.7s linear infinite' }} />
        불러오는 중…
        <style>{`@keyframes pmsspin{to{transform:rotate(360deg)}}`}</style>
    </div>
);

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
                    <Suspense fallback={<PageFallback />}>
                        <Outlet />
                    </Suspense>
                </main>
            </div>
        </div>
    );
};

export default DashboardLayout;
