import React from 'react';
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
  Settings as EquipmentsIcon
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const Sidebar = () => {
  const { logout, user } = useAuth();

  // Define all modules key map
  const allNavItems = [
    { icon: LayoutDashboard, label: '대시보드', path: '/', key: 'dashboard' },
    { icon: Layers, label: '금형관리', path: '/molds', key: 'molds' },
    { icon: Box, label: '원재료관리', path: '/materials', key: 'materials' },
    { icon: Truck, label: '납품관리', path: '/delivery', key: 'delivery' },
    { icon: ClipboardCheck, label: '품질관리', path: '/quality', key: 'quality' },
    { icon: DollarSign, label: '매입매출', path: '/sales', key: 'sales' },
    { icon: EquipmentsIcon, label: '설비관리', path: '/equipments', key: 'equipments' },
    { icon: Users, label: '직원관리', path: '/employees', key: 'employees' },
  ];

  // Filter items based on permissions
  // If user has no permissions object (legacy), show all
  const navItems = allNavItems.filter(item => {
    if (!user || !user.permissions) return true;
    // If permission is strictly false, hide it. Otherwise show.
    // Dashboard is usually always visible or handled safely.
    return user.permissions[item.key] !== false;
  });

  return (
    <aside className="sidebar glass-panel">
      <div className="sidebar-header">
        <div className="logo-icon">P</div>
        <h2 className="logo-text">PMS App</h2>
      </div>

      <nav className="sidebar-nav">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          >
            <item.icon size={20} />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        <button onClick={logout} className="logout-btn">
          <LogOut size={18} />
          <span>로그아웃</span>
        </button>
      </div>

      <style>{`
        .sidebar {
          width: 260px;
          height: calc(100vh - 2rem);
          margin: 1rem;
          display: flex;
          flex-direction: column;
          background: rgba(255, 255, 255, 0.9);
        }

        .sidebar-header {
          padding: 2rem 1.5rem;
          display: flex;
          align-items: center;
          gap: 0.75rem;
          border-bottom: 1px solid rgba(0,0,0,0.05);
        }

        .logo-icon {
          width: 32px;
          height: 32px;
          background: var(--primary);
          color: white;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: bold;
          font-size: 1.2rem;
        }

        .logo-text {
          font-size: 1.25rem;
          font-weight: 700;
          color: var(--text-main);
        }

        .sidebar-nav {
          flex: 1;
          padding: 1.5rem 1rem;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .nav-item {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.875rem 1rem;
          color: var(--text-muted);
          border-radius: var(--radius-md);
          font-weight: 500;
          transition: all 0.2s;
        }

        .nav-item:hover {
          background: rgba(79, 70, 229, 0.05);
          color: var(--primary);
        }

        .nav-item.active {
          background: var(--primary);
          color: white;
          box-shadow: 0 4px 12px rgba(79, 70, 229, 0.25);
        }

        .sidebar-footer {
          padding: 1.5rem;
          border-top: 1px solid rgba(0,0,0,0.05);
        }

        .logout-btn {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.75rem 1rem;
          width: 100%;
          color: var(--danger);
          font-weight: 500;
          border-radius: var(--radius-md);
          transition: all 0.2s;
        }

        .logout-btn:hover {
          background: rgba(239, 68, 68, 0.1);
        }
      `}</style>
    </aside>
  );
};

export default Sidebar;
