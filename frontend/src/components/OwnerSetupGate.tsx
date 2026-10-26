import { useCallback, useEffect, useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import { getOwnerSetupStatus } from '../api/auth'
import { getErrorMessage, isAbortError } from '../api/client'
import { Brand, SiteFooter } from './Layout'
import { ThemeToggle } from '../theme/ThemeToggle'
import { Icon } from './Icon'
import OwnerSetupPage from '../pages/OwnerSetupPage'

type SetupState = 'checking' | 'available' | 'complete' | 'error'

/** Never show regular registration until the server confirms setup is complete. */
export function OwnerSetupGate({ children }: { children: ReactNode }) {
  const { pathname } = useLocation()
  const [state, setState] = useState<SetupState>('checking')
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const retry = useCallback(() => setAttempt((value) => value + 1), [])

  useEffect(() => {
    const controller = new AbortController()
    let active = true
    getOwnerSetupStatus(controller.signal).then((result) => {
      if (active) setState(result.setupAvailable ? 'available' : 'complete')
    }).catch((caught: unknown) => {
      if (active && !isAbortError(caught)) {
        setError(getErrorMessage(caught))
        setState('error')
      }
    })
    return () => { active = false; controller.abort() }
  }, [attempt])

  useEffect(() => {
    if (state === 'available') document.title = 'Prvo podešavanje vlasnika | Trivio'
    else if (state === 'error') document.title = 'Povezivanje sa serverom | Trivio'
  }, [state])

  if (state === 'complete') return <>{children}</>
  if (state === 'available' && pathname !== '/postavljanje') return <Navigate to="/postavljanje" replace />

  return <div className="app-shell setup-shell">
    <a className="skip-link" href="#main-content">Pređi na sadržaj</a>
    <header className="site-header"><div className="container header-inner setup-header">
      <Brand /><ThemeToggle />
    </div></header>
    <main id="main-content" tabIndex={-1}>
      {state === 'available'
        ? <OwnerSetupPage onComplete={() => setState('complete')} onAlreadySetUp={retry} />
        : <section className="container setup-state" aria-live="polite">
            <div className="setup-state-icon"><Icon name={state === 'error' ? 'alert' : 'refresh'} size={28} /></div>
            <p className="eyebrow">TRIVIO · PRVO PODEŠAVANJE</p>
            <h1>{state === 'error' ? 'Nije moguće proveriti instalaciju' : 'Proveravamo instalaciju…'}</h1>
            <p>{state === 'error' ? `${error} Bez potvrde servera ne otvaramo registraciju.` : 'Sačekaj trenutak dok proverimo da li je vlasnički nalog već kreiran.'}</p>
            {state === 'error' && <button type="button" className="button button-primary" onClick={() => { setState('checking'); retry() }}>
              <Icon name="refresh" size={18} />Pokušaj ponovo
            </button>}
          </section>}
    </main>
    <SiteFooter />
  </div>
}
