import React, { useState, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { useTheme } from '../context/ThemeContext';
import { Bell, Search, User, Menu, X, Check, Trash2, Sun, Moon, KeyRound, Lock } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import Modal from './Modal';
import { supabase } from '../lib/supabase';

const Header = ({ onToggleSidebar }) => {
    const { user } = useAuth();
    const { notifications, markNotificationAsRead, markAllNotificationsAsRead, deleteNotification } = useData();
    const { theme, toggleTheme } = useTheme();
    const location = useLocation();
    const navigate = useNavigate();
    const [showNotifications, setShowNotifications] = useState(false);

    // 비밀번호 변경 모달
    const [pwModalOpen, setPwModalOpen] = useState(false);
    const [curPw, setCurPw] = useState('');
    const [newPw, setNewPw] = useState('');
    const [newPw2, setNewPw2] = useState('');
    const [pwSaving, setPwSaving] = useState(false);
    const [pwError, setPwError] = useState('');

    const openPwModal = () => {
        setCurPw(''); setNewPw(''); setNewPw2(''); setPwError(''); setPwModalOpen(true);
    };

    const handleChangePassword = async (e) => {
        e.preventDefault();
        setPwError('');
        if (!curPw || !newPw || !newPw2) { setPwError('모든 항목을 입력하세요.'); return; }
        if (newPw.length < 6) { setPwError('새 비밀번호는 6자 이상이어야 합니다.'); return; }
        if (newPw !== newPw2) { setPwError('새 비밀번호가 일치하지 않습니다.'); return; }
        if (newPw === curPw) { setPwError('현재 비밀번호와 다른 비밀번호를 입력하세요.'); return; }
        setPwSaving(true);
        try {
            // 1) 현재 비밀번호 재확인 (본인 확인)
            const { error: verifyErr } = await supabase.auth.signInWithPassword({
                email: user?.email, password: curPw,
            });
            if (verifyErr) { setPwError('현재 비밀번호가 올바르지 않습니다.'); setPwSaving(false); return; }
            // 2) 새 비밀번호로 변경
            const { error: updateErr } = await supabase.auth.updateUser({ password: newPw });
            if (updateErr) { setPwError('변경 실패: ' + updateErr.message); setPwSaving(false); return; }
            setPwModalOpen(false);
            alert('✅ 비밀번호가 변경되었습니다.');
        } catch (err) {
            setPwError('오류: ' + err.message);
        } finally {
            setPwSaving(false);
        }
    };

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
            case '/delivery': return '입출고관리';
            case '/quality': return '품질관리';
            case '/sales': return '매입매출';
            case '/employees': return '직원관리';
            case '/equipments': return '설비관리';
            case '/products': return '제품관리';
            case '/work-orders': return '작업지시';
            case '/daily-production': return '일일작업현황';
            case '/work-history': return '작업이력';
            case '/injection-conditions': return '사출조건표';
            case '/suppliers': return '거래처관리';
            case '/purchase': return '구매관리';
            case '/board': return '게시판';
            case '/government-support': return '국가지원사업';
            case '/payroll': return '급여관리';
            case '/audit-log': return '감사 로그';
            default: return 'PMS App';
        }
    };

    /**
     * 알림 클릭 → 읽음 처리 + 관련 페이지로 이동
     * 알림 title 또는 type을 기반으로 적절한 페이지 추정
     */
    const handleNotificationClick = (notification) => {
        if (!notification.is_read) {
            markNotificationAsRead(notification.id);
        }
        // 자동 알림([AUTO] prefix) 라우팅 매핑
        const title = notification.title || '';
        const type = notification.type || '';
        let destination = null;
        if (title.includes('원재료') || title.includes('안전재고')) destination = '/materials';
        else if (title.includes('작업지시')) destination = '/work-orders';
        else if (title.includes('금형')) destination = '/molds';
        else if (title.includes('설비')) destination = '/equipments';
        else if (title.includes('품질') || type === 'quality') destination = '/quality';
        else if (type === 'production') destination = '/daily-production';
        else if (type === 'equipment') destination = '/equipments';

        if (destination) {
            setShowNotifications(false);
            navigate(destination);
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

                <button
                    className="action-btn theme-toggle"
                    onClick={toggleTheme}
                    title={theme === 'light' ? '다크 모드로 전환' : '라이트 모드로 전환'}
                    aria-label="테마 전환"
                >
                    {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
                </button>

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

                <div className="user-profile" onClick={openPwModal} title="비밀번호 변경" style={{ cursor: 'pointer' }}>
                    <div className="avatar">
                        <User size={20} />
                    </div>
                    <div className="user-info">
                        <span className="user-name">{user?.name}</span>
                        <span className="user-role">{user?.position || '직원'}</span>
                    </div>
                </div>
            </div>

            {/* 비밀번호 변경 모달 */}
            <Modal title="🔑 비밀번호 변경" isOpen={pwModalOpen} onClose={() => setPwModalOpen(false)}>
                <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <div className="input-group">
                        <Lock size={20} className="input-icon" />
                        <input type="password" placeholder="현재 비밀번호" value={curPw}
                            onChange={(e) => setCurPw(e.target.value)} className="glass-input" autoComplete="current-password" />
                    </div>
                    <div className="input-group">
                        <KeyRound size={20} className="input-icon" />
                        <input type="password" placeholder="새 비밀번호 (6자 이상)" value={newPw}
                            onChange={(e) => setNewPw(e.target.value)} className="glass-input" autoComplete="new-password" />
                    </div>
                    <div className="input-group">
                        <KeyRound size={20} className="input-icon" />
                        <input type="password" placeholder="새 비밀번호 확인" value={newPw2}
                            onChange={(e) => setNewPw2(e.target.value)} className="glass-input" autoComplete="new-password" />
                    </div>
                    {pwError && <div className="error-message">{pwError}</div>}
                    <div className="modal-actions" style={{ marginTop: '0.25rem' }}>
                        <button type="button" className="btn-cancel" onClick={() => setPwModalOpen(false)}>취소</button>
                        <button type="submit" className="btn-submit" disabled={pwSaving}>
                            {pwSaving ? '변경 중...' : '비밀번호 변경'}
                        </button>
                    </div>
                </form>
            </Modal>

            <style>{`
                .header {
                    height: 80px;
                    margin: 1rem 1rem 0 0;
                    padding: 0 2rem;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    position: relative;
                    background: var(--glass-bg);
                    backdrop-filter: blur(16px) saturate(160%);
                    -webkit-backdrop-filter: blur(16px) saturate(160%);
                    border: 1px solid var(--border);
                    border-radius: var(--radius-lg);
                    box-shadow: var(--shadow-sm);
                }

                .theme-toggle {
                    color: var(--text-muted);
                    border: 1px solid var(--border);
                }
                .theme-toggle:hover {
                    color: var(--primary);
                    background: var(--primary-soft);
                    border-color: transparent;
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
                    background: var(--bg-subtle);
                    color: var(--text-main);
                    width: 200px;
                    transition: all var(--transition-base);
                }

                .search-bar input:focus {
                    outline: none;
                    width: 250px;
                    border-color: var(--primary);
                    background: var(--bg-elevated);
                    box-shadow: var(--shadow-focus);
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
                    background: var(--bg-card);
                    color: var(--text-muted);
                    cursor: pointer;
                    transition: all var(--transition-base);
                    box-shadow: var(--shadow-xs);
                }

                .action-btn:hover {
                    background: var(--primary-soft);
                    color: var(--primary);
                    transform: translateY(-1px);
                    box-shadow: var(--shadow-sm);
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
                    background: var(--gradient-primary);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: var(--primary-text);
                    box-shadow: var(--shadow-md);
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
                    background: var(--bg-card);
                    color: var(--text-main);
                    border: 1px solid var(--border);
                    border-radius: var(--radius-lg);
                    box-shadow: var(--shadow-xl);
                    z-index: 1000;
                    display: flex;
                    flex-direction: column;
                    overflow: hidden;
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
