import React from 'react';
import { useAuth } from '../context/AuthContext';
import { Bell, Search, User, Menu } from 'lucide-react';
import { useLocation } from 'react-router-dom';

const Header = ({ onToggleSidebar }) => {
    const { user } = useAuth();
    const location = useLocation();

    const getPageTitle = () => {
        switch (location.pathname) {
            case '/': return '대시보드';
            case '/molds': return '금형관리';
            case '/materials': return '원재료관리';
            case '/delivery': return '납품관리';
            case '/quality': return '품질관리';
            case '/sales': return '매입매출관리';
            case '/employees': return '직원관리';
            case '/equipments': return '설비관리';
            case '/products': return '제품관리';
            case '/work-orders': return '작업지시';
            case '/daily-production': return '일일작업현황';
            case '/work-history': return '작업이력';
            default: return 'PMS App';
        }
    };

    return (
        <header className="header glass-panel">
            {/* 햄버거 메뉴 버튼 (모바일만) */}
            <button className="hamburger-menu-btn" onClick={onToggleSidebar}>
                <Menu size={22} />
            </button>

            <h1 className="page-title">{getPageTitle()}</h1>

            <div className="header-actions">
                <div className="search-bar">
                    <Search size={18} className="search-icon" />
                    <input type="text" placeholder="검색..." />
                </div>

                <div className="action-btn">
                    <Bell size={20} />
                    <span className="badge"></span>
                </div>

                <div className="user-profile">
                    <div className="avatar">
                        <User size={20} />
                    </div>
                    <div className="user-info">
                        <span className="user-name">{user?.name}</span>
                        <span className="user-role">관리자</span>
                    </div>
                </div>
            </div>

            <style>{`
                .header {
                    height: 80px;
                    margin: 1rem 1rem 0 0;
                    padding: 0 2rem;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    position: relative;
                }

                /* 햄버거 메뉴 버튼 */
                .hamburger-menu-btn {
                    display: none; /* 기본적으로 숨김 */
                    align-items: center;
                    justify-content: center;
                    background: var(--primary);
                    color: white;
                    width: 40px;
                    height: 40px;
                    border-radius: 8px;
                    box-shadow: 0 2px 8px rgba(79, 70, 229, 0.2);
                    transition: all 0.2s;
                    position: absolute;
                    left: 1rem;
                }

                .hamburger-menu-btn:hover {
                    background: var(--primary-hover);
                    transform: scale(1.05);
                }

                .hamburger-menu-btn:active {
                    transform: scale(0.95);
                }

                .page-title {
                    font-size: 1.5rem;
                    font-weight: 700;
                    color: var(--text-main);
                }

                .header-actions {
                    display: flex;
                    align-items: center;
                    gap: 1.5rem;
                }

                .search-bar {
                    position: relative;
                }

                .search-bar input {
                    padding: 0.5rem 1rem 0.5rem 2.5rem;
                    border-radius: 20px;
                    border: 1px solid var(--border);
                    background: rgba(255,255,255,0.5);
                    width: 200px;
                    transition: all 0.2s;
                }

                .search-bar input:focus {
                    outline: none;
                    width: 250px;
                    border-color: var(--primary);
                    background: white;
                }

                .search-icon {
                    position: absolute;
                    left: 0.75rem;
                    top: 50%;
                    transform: translateY(-50%);
                    color: var(--text-muted);
                }

                .action-btn {
                    position: relative;
                    width: 40px;
                    height: 40px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border-radius: 50%;
                    background: white;
                    color: var(--text-muted);
                    cursor: pointer;
                    transition: all 0.2s;
                }

                .action-btn:hover {
                    background: var(--bg-main);
                    color: var(--primary);
                }

                .badge {
                    position: absolute;
                    top: 10px;
                    right: 10px;
                    width: 8px;
                    height: 8px;
                    background: var(--danger);
                    border-radius: 50%;
                    border: 1px solid white;
                }

                .user-profile {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                }

                .avatar {
                    width: 40px;
                    height: 40px;
                    border-radius: 50%;
                    background: linear-gradient(135deg, var(--primary) 0%, #6366f1 100%);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: white;
                }

                .user-info {
                    display: flex;
                    flex-direction: column;
                }

                .user-name {
                    font-weight: 600;
                    font-size: 0.9rem;
                }

                .user-role {
                    font-size: 0.75rem;
                    color: var(--text-muted);
                }

                /* 모바일 반응형 */
                @media (max-width: 768px) {
                    .hamburger-menu-btn {
                        display: flex; /* 모바일에서만 표시 */
                    }

                    .header {
                        height: 60px;
                        margin: 0;
                        padding: 0 1rem 0 3.5rem; /* 햄버거 버튼 공간 */
                    }

                    .page-title {
                        font-size: 1.1rem;
                    }

                    .search-bar {
                        display: none;
                    }

                    .action-btn {
                        width: 34px;
                        height: 34px;
                    }

                    .header-actions {
                        gap: 0.75rem;
                    }

                    .user-info {
                        display: none;
                    }

                    .avatar {
                        width: 34px;
                        height: 34px;
                    }
                }
            `}</style>
        </header>
    );
};

export default Header;
