import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { AsyncState } from './AsyncState';

export function ProtectedRoute() {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();
  if (isLoading) return <AsyncState kind="loading" title="Proveravamo prijavu…" />;
  if (!isAuthenticated) return <Navigate to="/prijava" replace state={{
    from: location.pathname + location.search,
    notice: 'Prijavi se da pogledaš svoje porudžbine. Ako je sesija istekla, prijavi se ponovo.',
  }} />;
  return <Outlet />;
}
