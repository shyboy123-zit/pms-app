
import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Box,
  Layers,
  Truck,
  ClipboardCheck,
  DollarSign,
  LogOut,
  Users,
  Settings,
  Cog as EquipmentsIcon,
  Package,
  ClipboardList,
  Calendar,
  ChevronDown,
  ChevronRight,
  X
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const Sidebar = ({ isMobileOpen, onClose }) => {
  const { logout, user } = useAuth();
  const [expandedCategories, setExpandedCategories] = useState({
    production: true,
    salesLogistics: false,
    quality: false,
    hr: false
  });

  // 카테고리 정의
  const categories = [
    {
      id: 'dashboard',
      label: '대시보드',
      icon: LayoutDashboard,
      path: '/',
      key: 'dashboard',
      standalone: true // 카테고리 없이 단독 표시
    },
    {
      id: 'production',
      label: '생산 관리',
      icon: EquipmentsIcon,
      items: [
        { icon: Layers, label: '금형관리', path: '/molds', key: 'molds' },
        { icon: Box, label: '원재료관리', path: '/materials', key: 'materials' },
        { icon: EquipmentsIcon, label: '설비관리', path: '/equipments', key: 'equipments' },
        { icon: ClipboardList, label: '작업지시', path: '/work-orders', key: 'work_orders' },
        { icon: Calendar, label: '일일작업현황', path: '/daily-production', key: 'daily_production' },
        { icon: Calendar, label: '작업이력', path: '/work-history', key: 'work_history' },
        { icon: Settings, label: '사출조건표', path: '/injection-conditions', key: 'injection_conditions' },
        { icon: Package, label: '제품관리', path: '/products', key: 'products' }
      ]
    },
    {
      id: 'salesLogistics',
      label: '영업/물류',
      icon: Truck,
      items: [
        { icon: Truck, label: '입출고관리', path: '/delivery', key: 'delivery' },
        { icon: DollarSign, label: '매입매출', path: '/sales', key: 'sales' }
      ]
    },
    {
      id: 'quality',
      label: '품질 관리',
      icon: ClipboardCheck,
      items: [
        { icon: ClipboardCheck, label: '품질관리', path: '/quality', key: 'quality' }
      ]
    },
    {
      id: 'hr',
      label: '인사 관리',
      icon: Users,
      items: [
        { icon: Users, label: '직원관리', path: '/employees', key: 'employees' }
      ]
    }
  ];

  const toggleCategory = (categoryId) => {
    setExpandedCategories(prev => ({
      ...prev,
      [categoryId]: !prev[categoryId]
    }));
  };

  // 권한 체크
  const hasPermission = (key) => {
    // 권한이 없으면 모든 메뉴 보이기 (기본값)
    if (!user || !user.permissions) return true;

    // 권한이 설정되어 있으면 해당 키의 권한 확인
    // permissions[key]가 명시적으로 true인 경우만 허용
    return user.permissions[key] === true;
  };

  return (
    <>
      {/* 오버레이 (모바일만) */}
      {isMobileOpen && (
        <div className="sidebar-overlay" onClick={onClose} />
      )}

      {/* 사이드바 */}
      <aside className={`sidebar glass - panel ${isMobileOpen ? 'mobile-open' : ''} `}>
        {/* 모바일 닫기 버튼 */}
        <button className="mobile-close-btn" onClick={onClose}>
          <X size={24} />
        </button>

        <div className="sidebar-header">
          <div className="logo-icon">P</div>
          <h2 className="logo-text">PMS App</h2>
        </div>

        <nav className="sidebar-nav">
          {categories.map((category) => {
            // 단독 항목 (대시보드)
            if (category.standalone) {
              if (!hasPermission(category.key)) return null;
              return (
                <NavLink
                  key={category.path}
                  to={category.path}
                  className={({ isActive }) => `nav - item ${isActive ? 'active' : ''} `}
                  onClick={onClose}
                >
                  <category.icon size={20} />
                  <span>{category.label}</span>
                </NavLink>
              );
            }

            // 카테고리의 모든 하위 항목이 권한 없으면 숨김
            const visibleItems = category.items.filter(item => hasPermission(item.key));
            if (visibleItems.length === 0) return null;

            const isExpanded = expandedCategories[category.id];

            return (
              <div key={category.id} className="nav-category">
                <div
                  className="category-header"
                  onClick={() => toggleCategory(category.id)}
                >
                  <div className="category-label">
                    <category.icon size={18} />
                    <span>{category.label}</span>
                  </div>
                  {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </div>

                <div className={`category - items ${isExpanded ? 'expanded' : ''} `}>
                  {visibleItems.map((item) => (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      className={({ isActive }) => `nav - item sub - item ${isActive ? 'active' : ''} `}
                      onClick={onClose}
                    >
                      <item.icon size={18} />
                      <span>{item.label}</span>
                    </NavLink>
                  ))}
                </div>
              </div>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          {user && (
            <div className="user-profile">
              <div className="user-avatar">
                {(user.name && user.name[0]) || (user.email && user.email[0]) || 'U'}
              </div>
              <div className="user-info">
                <span className="user-name">{user.name || user.email || '직원'}</span>
                <span className="user-role">{user.position || '미지정'}</span>
              </div>
            </div>
          )}
          <button onClick={logout} className="logout-btn">
            <LogOut size={18} />
            <span>로그아웃</span>
          </button>
        </div>

        <style>{`
  /* 모바일 닫기 버튼 */
  .mobile - close - btn {
  display: none;
  position: absolute;
  top: 1.5rem;
  right: 1.5rem;
  z - index: 10;
  color: var(--text - muted);
  padding: 0.25rem;
  transition: all 0.2s;
}

          .mobile - close - btn:hover {
  color: var(--text - main);
}

          /* 사이드바 오버레이 (모바일만) */
          .sidebar - overlay {
  display: none;
}

          .sidebar {
  width: 260px;
  height: calc(100vh - 2rem);
  margin: 1rem;
  display: flex;
  flex - direction: column;
  background: rgba(255, 255, 255, 0.95);
  backdrop - filter: blur(10px);
  transition: transform 0.3s ease -in -out;
}

          .sidebar - header {
  padding: 2rem 1.5rem 1.5rem;
  display: flex;
  align - items: center;
  gap: 0.75rem;
  border - bottom: 1px solid rgba(0, 0, 0, 0.05);
}

          .logo - icon {
  width: 32px;
  height: 32px;
  background: var(--primary);
  color: white;
  border - radius: 8px;
  display: flex;
  align - items: center;
  justify - content: center;
  font - weight: bold;
  font - size: 1.2rem;
}

          .logo - text {
  font - size: 1.25rem;
  font - weight: 700;
  color: var(--text - main);
}

          .sidebar - nav {
  flex: 1;
  padding: 1rem;
  display: flex;
  flex - direction: column;
  gap: 0.25rem;
  overflow - y: auto;
}

          /* 카테고리 */
          .nav - category {
  margin - bottom: 0.5rem;
}

          .category - header {
  display: flex;
  align - items: center;
  justify - content: space - between;
  padding: 0.75rem 1rem;
  color: var(--text - main);
  font - weight: 600;
  font - size: 0.85rem;
  cursor: pointer;
  border - radius: 8px;
  transition: all 0.2s;
  user - select: none;
}

          .category - header:hover {
  background: rgba(79, 70, 229, 0.05);
}

          .category - label {
  display: flex;
  align - items: center;
  gap: 0.75rem;
}

          .category - items {
  max - height: 0;
  overflow: hidden;
  transition: max - height 0.3s ease -in -out;
}

          .category - items.expanded {
  max - height: 500px;
}

          /* 네비게이션 아이템 */
          .nav - item {
  display: flex;
  align - items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  color: var(--text - muted);
  border - radius: 8px;
  font - weight: 500;
  font - size: 0.95rem;
  transition: all 0.2s;
}

          .nav - item.sub - item {
  padding - left: 2.75rem;
  font - size: 0.9rem;
}

          .nav - item:hover {
  background: rgba(79, 70, 229, 0.05);
  color: var(--primary);
  transform: translateX(2px);
}

          .nav - item.active {
  background: var(--primary);
  color: white;
  box - shadow: 0 4px 12px rgba(79, 70, 229, 0.25);
}

          .sidebar - footer {
  padding: 1rem 1.5rem 1.5rem;
  border - top: 1px solid rgba(0, 0, 0, 0.05);
}

          .user - profile {
  display: flex;
  align - items: center;
  gap: 0.75rem;
  margin - bottom: 1rem;
  padding: 0.75rem;
  background: rgba(0, 0, 0, 0.03);
  border - radius: 8px;
}
          
          .user - avatar {
  width: 32px;
  height: 32px;
  background: var(--primary);
  color: white;
  border - radius: 50 %;
  display: flex;
  align - items: center;
  justify - content: center;
  font - weight: 600;
  font - size: 0.9rem;
  flex - shrink: 0;
}

          .user - info {
  display: flex;
  flex - direction: column;
  min - width: 0;
}

          .user - name {
  font - weight: 600;
  font - size: 0.9rem;
  white - space: nowrap;
  overflow: hidden;
  text - overflow: ellipsis;
}

          .user - role {
  font - size: 0.75rem;
  color: var(--primary);
  font - weight: 500;
}

          .logout - btn {
  display: flex;
  align - items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  width: 100 %;
  color: var(--danger);
  font - weight: 500;
  border - radius: 8px;
  transition: all 0.2s;
}

          .logout - btn:hover {
  background: rgba(239, 68, 68, 0.1);
}

/* 모바일 반응형 */
@media(max - width: 768px) {
            .mobile - close - btn {
    display: block;
  }

            .sidebar - overlay {
    display: block;
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    z - index: 999;
    animation: fadeIn 0.3s;
  }

  @keyframes fadeIn {
              from { opacity: 0; }
              to { opacity: 1; }
  }

            .sidebar {
    position: fixed;
    top: 0;
    left: 0;
    bottom: 0;
    margin: 0;
    height: 100vh;
    z - index: 1000;
    transform: translateX(-100 %);
    box - shadow: 2px 0 8px rgba(0, 0, 0, 0.15);
  }

            .sidebar.mobile - open {
    transform: translateX(0);
  }

            /* 모바일에서 사용자 정보 간소화 */
            .user - profile {
    padding: 0.5rem;
  }

            .user - avatar {
    width: 28px;
    height: 28px;
    font - size: 0.85rem;
  }

            .user - name {
    font - size: 0.85rem;
  }

            .user - role {
    font - size: 0.7rem;
  }
}
`}</style>
      </aside>
    </>
  );
};

export default Sidebar;
