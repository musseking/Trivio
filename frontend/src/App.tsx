import { Navigate, Route, Routes } from 'react-router-dom';
import { OwnerSetupGate } from './components/OwnerSetupGate';
import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { OwnerRoute } from './components/OwnerRoute';
import { RouteEffects } from './components/RouteEffects';
import HomePage from './pages/HomePage';
import CatalogPage from './pages/CatalogPage';
import VehicleDetailPage from './pages/VehicleDetailPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import OrdersPage from './pages/OrdersPage';
import NotFoundPage from './pages/NotFoundPage';
import OwnerVehiclesPage from './pages/owner/OwnerVehiclesPage';
import OwnerVehicleFormPage from './pages/owner/OwnerVehicleFormPage';
import OwnerUsersPage from './pages/owner/OwnerUsersPage';

export default function App() {
  return <>
    <RouteEffects />
    <OwnerSetupGate>
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="automobili" element={<CatalogPage />} />
        <Route path="automobili/:id" element={<VehicleDetailPage />} />
        <Route path="prijava" element={<LoginPage />} />
        <Route path="registracija" element={<RegisterPage />} />
        <Route path="postavljanje" element={<Navigate to="/" replace />} />
        <Route element={<ProtectedRoute />}>
          <Route path="porudzbine" element={<OrdersPage />} />
          <Route element={<OwnerRoute />}>
            <Route path="owner" element={<Navigate to="/owner/automobili" replace />} />
            <Route path="owner/korisnici" element={<OwnerUsersPage />} />
            <Route path="owner/automobili" element={<OwnerVehiclesPage />} />
            <Route path="owner/automobili/novi" element={<OwnerVehicleFormPage />} />
            <Route path="owner/automobili/:id/uredi" element={<OwnerVehicleFormPage />} />
          </Route>
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
    </OwnerSetupGate>
  </>;
}
