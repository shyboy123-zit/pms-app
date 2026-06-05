import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { DataProvider } from './context/DataContext';
import { ThemeProvider } from './context/ThemeContext';
import Login from './pages/Login';
import Signup from './pages/Signup';
import DashboardLayout from './layouts/DashboardLayout';
import AuthLayout from './layouts/AuthLayout';
import LoadingScreen from './components/LoadingScreen';

import Dashboard from './pages/Dashboard';
import Molds from './pages/Molds';
import Materials from './pages/Materials';
import InventoryInOut from './pages/InventoryInOut';
import Quality from './pages/Quality';
import Sales from './pages/Sales';
import Employees from './pages/Employees';
import Equipments from './pages/Equipments';
import Products from './pages/Products';
import WorkOrders from './pages/WorkOrders';
import DailyProduction from './pages/DailyProduction';
import WorkHistory from './pages/WorkHistory';
import InjectionConditions from './pages/InjectionConditions';
import Suppliers from './pages/Suppliers';
import Purchase from './pages/Purchase';
import Board from './pages/Board';
import Chat from './pages/Chat';
import GovernmentSupport from './pages/GovernmentSupport';
import Payroll from './pages/Payroll';
import AuditLog from './pages/AuditLog';

const ProtectedRoute = () => {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  return user ? <Outlet /> : <Navigate to="/login" replace />;
};

/**
 * 권한 게이트 — 특정 권한 키가 user.permissions[key] === false면 대시보드로 리다이렉트
 * 관리자(position === '관리자')는 모든 권한 패스
 * 권한 데이터가 없으면 기본 허용 (기존 호환성)
 */
const PermissionGate = ({ permissionKey, children }) => {
  const { user } = useAuth();
  // 관리자는 항상 허용
  if (user?.position === '관리자') return children;
  // 권한 객체 없으면 허용 (기존 호환)
  if (!user?.permissions) return children;
  // 명시적으로 false인 경우만 차단
  if (user.permissions[permissionKey] === false) {
    return <Navigate to="/" replace />;
  }
  return children;
};

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <DataProvider>
          <Router>
          <Routes>
            {/* Auth Routes */}
            <Route element={<AuthLayout />}>
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
            </Route>

            {/* Protected Dashboard Routes */}
            <Route element={<ProtectedRoute />}>
              <Route path="/" element={<DashboardLayout />}>
                <Route index element={<PermissionGate permissionKey="dashboard"><Dashboard /></PermissionGate>} />
                <Route path="molds" element={<PermissionGate permissionKey="molds"><Molds /></PermissionGate>} />
                <Route path="materials" element={<PermissionGate permissionKey="materials"><Materials /></PermissionGate>} />
                <Route path="delivery" element={<PermissionGate permissionKey="delivery"><InventoryInOut /></PermissionGate>} />
                <Route path="quality" element={<PermissionGate permissionKey="quality"><Quality /></PermissionGate>} />
                <Route path="sales" element={<PermissionGate permissionKey="sales"><Sales /></PermissionGate>} />
                <Route path="employees" element={<PermissionGate permissionKey="employees"><Employees /></PermissionGate>} />
                <Route path="equipments" element={<PermissionGate permissionKey="equipments"><Equipments /></PermissionGate>} />
                <Route path="products" element={<PermissionGate permissionKey="products"><Products /></PermissionGate>} />
                <Route path="work-orders" element={<PermissionGate permissionKey="work_orders"><WorkOrders /></PermissionGate>} />
                <Route path="daily-production" element={<PermissionGate permissionKey="daily_production"><DailyProduction /></PermissionGate>} />
                <Route path="work-history" element={<PermissionGate permissionKey="work_history"><WorkHistory /></PermissionGate>} />
                <Route path="injection-conditions" element={<PermissionGate permissionKey="injection_conditions"><InjectionConditions /></PermissionGate>} />
                <Route path="suppliers" element={<PermissionGate permissionKey="suppliers"><Suppliers /></PermissionGate>} />
                <Route path="purchase" element={<PermissionGate permissionKey="purchase"><Purchase /></PermissionGate>} />
                <Route path="board" element={<PermissionGate permissionKey="board"><Board /></PermissionGate>} />
                <Route path="chat" element={<PermissionGate permissionKey="chat"><Chat /></PermissionGate>} />
                <Route path="government-support" element={<PermissionGate permissionKey="government_support"><GovernmentSupport /></PermissionGate>} />
                <Route path="payroll" element={<PermissionGate permissionKey="payroll"><Payroll /></PermissionGate>} />
                <Route path="audit-log" element={<PermissionGate permissionKey="audit_log"><AuditLog /></PermissionGate>} />
              </Route>
            </Route>

            {/* Catch all */}
            <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>
          </Router>
        </DataProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
// Last Deployed: 2026-01-31 14:15
