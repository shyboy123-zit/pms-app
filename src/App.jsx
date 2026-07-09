import { lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { DataProvider } from './context/DataContext';
import { ThemeProvider } from './context/ThemeContext';
import Login from './pages/Login';
import Signup from './pages/Signup';
import DashboardLayout from './layouts/DashboardLayout';
import AuthLayout from './layouts/AuthLayout';
import LoadingScreen from './components/LoadingScreen';

// 새 배포로 청크(코드 조각) 파일명이 바뀌면, 열려 있던 옛 탭이 사라진 옛 청크를 불러오려다
// "Failed to fetch dynamically imported module" 오류가 난다. 이때 1회 자동 새로고침으로
// 최신 버전을 받아 스스로 복구한다. (sessionStorage 플래그로 무한 새로고침 방지)
function lazyWithReload(importFn) {
    return lazy(async () => {
        try {
            const mod = await importFn();
            sessionStorage.removeItem('chunkReloaded'); // 성공 시 플래그 해제 → 다음 배포에도 복구 가능
            return mod;
        } catch (err) {
            const msg = String((err && err.message) || err);
            const isChunkError = /dynamically imported module|Importing a module script failed|Loading chunk|error loading dynamically/i.test(msg);
            if (isChunkError && !sessionStorage.getItem('chunkReloaded')) {
                sessionStorage.setItem('chunkReloaded', '1');
                window.location.reload();
                return new Promise(() => {}); // 새로고침 진행 중 — 렌더 보류
            }
            throw err;
        }
    });
}

// 페이지를 코드 분리(lazy) — 접속 시 현재 페이지만 받아오고, PDF/엑셀/차트는 해당 페이지 들어갈 때만 로딩
const Dashboard = lazyWithReload(() => import('./pages/Dashboard'));
const Molds = lazyWithReload(() => import('./pages/Molds'));
const Materials = lazyWithReload(() => import('./pages/Materials'));
const InventoryInOut = lazyWithReload(() => import('./pages/InventoryInOut'));
const Quality = lazyWithReload(() => import('./pages/Quality'));
const Sales = lazyWithReload(() => import('./pages/Sales'));
const Employees = lazyWithReload(() => import('./pages/Employees'));
const Equipments = lazyWithReload(() => import('./pages/Equipments'));
const Products = lazyWithReload(() => import('./pages/Products'));
const WorkOrders = lazyWithReload(() => import('./pages/WorkOrders'));
const DailyProduction = lazyWithReload(() => import('./pages/DailyProduction'));
const WorkHistory = lazyWithReload(() => import('./pages/WorkHistory'));
const InjectionConditions = lazyWithReload(() => import('./pages/InjectionConditions'));
const Suppliers = lazyWithReload(() => import('./pages/Suppliers'));
const Purchase = lazyWithReload(() => import('./pages/Purchase'));
const Board = lazyWithReload(() => import('./pages/Board'));
const Chat = lazyWithReload(() => import('./pages/Chat'));
const GovernmentSupport = lazyWithReload(() => import('./pages/GovernmentSupport'));
const Payroll = lazyWithReload(() => import('./pages/Payroll'));
const Expenses = lazyWithReload(() => import('./pages/Expenses'));
const AuditLog = lazyWithReload(() => import('./pages/AuditLog'));
const PackagingStandards = lazyWithReload(() => import('./pages/PackagingStandards'));

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
                <Route path="packaging-standards" element={<PermissionGate permissionKey="packaging_standards"><PackagingStandards /></PermissionGate>} />
                <Route path="purchase" element={<PermissionGate permissionKey="purchase"><Purchase /></PermissionGate>} />
                <Route path="board" element={<PermissionGate permissionKey="board"><Board /></PermissionGate>} />
                <Route path="chat" element={<PermissionGate permissionKey="chat"><Chat /></PermissionGate>} />
                <Route path="government-support" element={<PermissionGate permissionKey="government_support"><GovernmentSupport /></PermissionGate>} />
                <Route path="payroll" element={<PermissionGate permissionKey="payroll"><Payroll /></PermissionGate>} />
                <Route path="expenses" element={<PermissionGate permissionKey="expenses"><Expenses /></PermissionGate>} />
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
