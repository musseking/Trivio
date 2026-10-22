import { useCallback, useEffect, useState } from 'react';
import { isAbortError } from '../api/client';

/** Loaders must be stable (module function or useCallback). Old requests cannot overwrite a new page. */
export function useAsyncResource<T>(loader: (signal: AbortSignal) => Promise<T>) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{ data: T | null; isLoading: boolean; error: unknown | null }>({
    data: null, isLoading: true, error: null,
  });
  const retry = useCallback(() => setAttempt((current) => current + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setState({ data: null, isLoading: true, error: null });
    loader(controller.signal).then((data) => {
      if (active) setState({ data, isLoading: false, error: null });
    }).catch((error: unknown) => {
      if (active && !isAbortError(error)) setState({ data: null, isLoading: false, error });
    });
    return () => { active = false; controller.abort(); };
  }, [loader, attempt]);

  return { ...state, retry };
}
