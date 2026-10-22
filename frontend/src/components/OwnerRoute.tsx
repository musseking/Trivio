import { useCallback } from 'react';
import { Link, Outlet } from 'react-router-dom';
import { getMe } from '../api/auth';
import { ApiError, getErrorMessage } from '../api/client';
import { useAuth } from '../auth/useAuth';
import { useAsyncResource } from '../hooks/useAsyncResource';
import { AsyncState } from './AsyncState';

/** Recheck the live server identity on panel entry; every write is also authorized server-side. */
export function OwnerRoute() {
  const { accessToken } = useAuth();
  const verify = useCallback((signal: AbortSignal) => accessToken
    ? getMe(accessToken, signal)
    : Promise.reject(new ApiError(401, 'Prijavi se da nastaviš.')), [accessToken]);
  const { data: identity, isLoading, error, retry } = useAsyncResource(verify);

  if (isLoading) return <div className="container page-space"><AsyncState kind="loading" title="Proveravamo pristup panelu…" /></div>;
  if (error) return <div className="container page-space"><AsyncState kind="error" title="Pristup panelu nije potvrđen" description={getErrorMessage(error)} onRetry={retry} /></div>;
  if (identity?.role !== 'OWNER') return <div className="container page-space"><AsyncState kind="error" title="Ovaj panel je dostupan samo OWNER nalogu" description="Tvoja postojeća prava pristupa ostaju nepromenjena. Za Control panel potreban je OWNER nalog." action={<Link className="button button-primary" to="/automobili">Nazad na automobile</Link>} /></div>;
  return <Outlet />;
}
