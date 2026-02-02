import React from 'react';
import { useAuth } from '../context/AuthContext';
import { Bell, Search, User } from 'lucide-react';
import { useLocation } from 'react-router-dom';

const Header = () => {
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
            default: return 'PMS App';
        }
    };

    return (
        <header className="header glass-panel">
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
                    .header {
                        height: 60px;
                        margin: 0;
                        padding: 0 1rem 0 4rem; /* 햄버거 버튼 공간 확보 */
                    }

                    .page-title {
                        font-size: 1.1rem;
                    }

                    .search-bar {
                        display: none; /* 모바일에서 검색창 숨김 */
                    }

                    .action-btn {
                        width: 34px;
                        height: 34px;
                    }

                    .header-actions {
                        gap: 0.75rem;
                    }

                    .user-info {
                        display: none; /* 모바일에서 사용자 정보 텍스트 숨김 */
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
