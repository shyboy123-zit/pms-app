import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { DataProvider } from './context/DataContext';
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
import GovernmentSupport from './pages/GovernmentSupport';
import Payroll from './pages/Payroll';

const ProtectedRoute = () => {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  return user ? <Outlet /> : <Navigate to="/login" replace />;
};

function App() {
  return (
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
                <Route index element={<Dashboard />} />
                <Route path="molds" element={<Molds />} />
                <Route path="materials" element={<Materials />} />
                <Route path="delivery" element={<InventoryInOut />} />
                <Route path="quality" element={<Quality />} />
                <Route path="sales" element={<Sales />} />
                <Route path="employees" element={<Employees />} />
                <Route path="equipments" element={<Equipments />} />
                <Route path="products" element={<Products />} />
                <Route path="work-orders" element={<WorkOrders />} />
                <Route path="daily-production" element={<DailyProduction />} />
                <Route path="work-history" element={<WorkHistory />} />
                <Route path="injection-conditions" element={<InjectionConditions />} />
                <Route path="suppliers" element={<Suppliers />} />
                <Route path="purchase" element={<Purchase />} />
                <Route path="board" element={<Board />} />
                <Route path="government-support" element={<GovernmentSupport />} />
                <Route path="payroll" element={<Payroll />} />
              </Route>
            </Route>

            {/* Catch all */}
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </Router>
      </DataProvider>
    </AuthProvider>
  );
}

export default App;
// Last Deployed: 2026-01-31 14:15
