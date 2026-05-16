import React, { useState, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { Bell, Search, User, Menu, X, Check, Trash2 } from 'lucide-react';
import { useLocation } from 'react-router-dom';

const Header = ({ onToggleSidebar }) => {
    const { user } = useAuth();
    const { notifications, markNotificationAsRead, markAllNotificationsAsRead, deleteNotification } = useData();
    const location = useLocation();
    const [showNotifications, setShowNotifications] = useState(false);

    // 현재 사용자의 알림만 필터
    const userNotifications = useMemo(() => {
        if (!user?.id) return [];
        return notifications.filter(n => n.user_id === user.id);
    }, [notifications, user]);

    // 안 읽은 알림 개수
    const unreadCount = useMemo(() => {
        return userNotifications.filter(n => !n.is_read).length;
    }, [userNotifications]);

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
            case '/injection-conditions': return '사출조건표';
            default: return 'PMS App';
        }
    };

    const handleNotificationClick = (notification) => {
        if (!notification.is_read) {
            markNotificationAsRead(notification.id);
        }
    };

    const handleMarkAllAsRead = () => {
        if (user?.id) {
            markAllNotificationsAsRead(user.id);
        }
    };

    const getNotificationIcon = (type) => {
        switch (type) {
            case 'production': return '📊';
            case 'completion': return '✅';
            case 'equipment': return '🔧';
            case 'quality': return '📋';
            default: return '🔔';
        }
    };

    const formatTimeAgo = (dateString) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);

        if (diffMins < 1) return '방금 전';
        if (diffMins < 60) return `${diffMins}분 전`;
        const diffHours = Math.floor(diffMins / 60);
        if (diffHours < 24) return `${diffHours}시간 전`;
        const diffDays = Math.floor(diffHours / 24);
        if (diffDays < 7) return `${diffDays}일 전`;
        return date.toLocaleDateString('ko-KR');
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

                <div className="action-btn notification-btn" onClick={() => setShowNotifications(!showNotifications)}>
                    <Bell size={20} />
                    {unreadCount > 0 && (
                        <span className="badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
                    )}
                </div>

                {/* 알림 모달 */}
                {showNotifications && (
                    <div className="notification-modal">
                        <div className="notification-header">
                            <h3>알림</h3>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                {unreadCount > 0 && (
                                    <button className="mark-all-read-btn" onClick={handleMarkAllAsRead}>
                                        <Check size={16} />
                                        모두 읽음
                                    </button>
                                )}
                                <button className="close-btn" onClick={() => setShowNotifications(false)}>
                                    <X size={18} />
                                </button>
                            </div>
                        </div>
                        <div className="notification-list">
                            {userNotifications.length > 0 ? (
                                userNotifications.slice(0, 10).map(notif => (
                                    <div
                                        key={notif.id}
                                        className={`notification-item ${notif.is_read ? 'read' : 'unread'}`}
                                        onClick={() => handleNotificationClick(notif)}
                                    >
                                        <div className="notif-icon">{getNotificationIcon(notif.type)}</div>
                                        <div className="notif-content">
                                            <div className="notif-title">{notif.title}</div>
                                            <div className="notif-message">{notif.message}</div>
                                            <div className="notif-time">{formatTimeAgo(notif.created_at)}</div>
                                        </div>
                                        <button
                                            className="notif-delete"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                deleteNotification(notif.id);
                                            }}
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                ))
                            ) : (
                                <div className="no-notifications">
                                    알림이 없습니다
                                </div>
                            )}
                        </div>
                    </div>
                )}

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
                    top: 2px;
                    right: 2px;
                    min-width: 18px;
                    height: 18px;
                    padding: 0 5px;
                    background: var(--danger);
                    color: white;
                    font-size: 0.7rem;
                    font-weight: 700;
                    border-radius: 9px;
                    border: 2px solid white;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    line-height: 1;
                    box-sizing: border-box;
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

                    .notification-modal {
                        right: 0;
                        width: 90vw;
                        max-width: 320px;
                    }
                }

                /* 알림 모달 스타일 */
                .notification-btn {
                    cursor: pointer;
                }

                .notification-modal {
                    position: absolute;
                    top: calc(100% + 10px);
                    right: -1rem;
                    width: 380px;
                    max-height: 500px;
                    background: white;
                    border-radius: 12px;
                    box-shadow: 0 8px 24px rgba(0,0,0,0.15);
                    z-index: 1000;
                    display: flex;
                    flex-direction: column;
                }

                .notification-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 1rem;
                    border-bottom: 1px solid var(--border);
                }

                .notification-header h3 {
                    margin: 0;
                    font-size: 1.1rem;
                }

                .mark-all-read-btn, .close-btn {
                    border: none;
                    background: none;
                    cursor: pointer;
                    padding: 0.25rem;
                    display: flex;
                    align-items: center;
                    gap: 0.25rem;
                    color: var(--primary);
                    font-size: 0.9rem;
                }

                .mark-all-read-btn:hover, .close-btn:hover {
                    opacity: 0.7;
                }

                .notification-list {
                    overflow-y: auto;
                    max-height: 420px;
                }

                .notification-item {
                    display: flex;
                    gap: 0.75rem;
                    padding: 1rem;
                    border-bottom: 1px solid var(--border);
                    cursor: pointer;
                    transition: background 0.2s;
                }

                .notification-item:hover {
                    background: rgba(79, 70, 229, 0.05);
                }

                .notification-item.unread {
                    background: rgba(79, 70, 229, 0.08);
                }

                .notif-icon {
                    font-size: 1.5rem;
                    flex-shrink: 0;
                }

                .notif-content {
                    flex: 1;
                    min-width: 0;
                }

                .notif-title {
                    font-weight: 600;
                    margin-bottom: 0.25rem;
                    color: var(--text-main);
                }

                .notif-message {
                    font-size: 0.9rem;
                    color: var(--text-muted);
                    margin-bottom: 0.25rem;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    display: -webkit-box;
                    -webkit-line-clamp: 2;
                    -webkit-box-orient: vertical;
                }

                .notif-time {
                    font-size: 0.75rem;
                    color: var(--text-muted);
                }

                .notif-delete {
                    flex-shrink: 0;
                    border: none;
                    background: none;
                    cursor: pointer;
                    color: var(--text-muted);
                    padding: 0.25rem;
                }

                .notif-delete:hover {
                    color: #ef4444;
                }

                .no-notifications {
                    padding: 3rem 1rem;
                    text-align: center;
                    color: var(--text-muted);
                }
            `}</style>
        </header>
    );
};

export default Header;
