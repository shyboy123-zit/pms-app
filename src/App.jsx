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
import Delivery from './pages/Delivery';
import Quality from './pages/Quality';
import Sales from './pages/Sales';
import Employees from './pages/Employees';
import Equipments from './pages/Equipments';

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
                <Route path="delivery" element={<Delivery />} />
                <Route path="quality" element={<Quality />} />
                <Route path="sales" element={<Sales />} />
                <Route path="employees" element={<Employees />} />
                <Route path="equipments" element={<Equipments />} />
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
