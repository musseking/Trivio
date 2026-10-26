import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { getErrorMessage, isAbortError } from '../api/client'
import { useAuth } from '../auth/useAuth'
import { Icon } from '../components/Icon'

function redirectTarget(value: unknown): string {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')
    || /[\\\u0000-\u0020\u007f]/.test(value)
    || /^\/(prijava|registracija)(?:[/?#]|$)/.test(value)) return '/porudzbine'
  return value
}

export default function LoginPage() {
  const { login, isAuthenticated, isLoading } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const state = location.state as { from?: unknown; notice?: unknown } | null
  const target = redirectTarget(state?.from)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({})
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isLoading) return
    setError(null)
    const errors: typeof fieldErrors = {}
    if (!email.trim() || !/^[^\s@]+@[^\s@]+$/.test(email.trim())) errors.email = 'Unesi ispravnu email adresu.'
    if (!password) errors.password = 'Unesi lozinku.'
    setFieldErrors(errors)
    if (Object.keys(errors).length) {
      const firstInvalid = event.currentTarget.elements.namedItem(Object.keys(errors)[0])
      if (firstInvalid instanceof HTMLElement) firstInvalid.focus()
      return
    }
    try {
      await login({ email: email.trim(), password })
      if (!mountedRef.current) return
      setPassword('')
      navigate(target, { replace: true })
    } catch (caught) {
      if (mountedRef.current && !isAbortError(caught)) setError(getErrorMessage(caught))
    }
  }

  if (isAuthenticated) return <Navigate to={target} replace />

  return (
    <section className="auth-layout">
      <aside className="auth-aside">
        <div className="auth-aside-content">
          <p className="eyebrow">TVOJ SLEDEĆI KORAK</p>
          <h1>Pravi automobil.<br />Tvoja nova priča.</h1>
          <p>Vrati se svom Trivio nalogu i prati porudžbine na jednom mestu.</p>
          <div className="auth-visual" aria-hidden="true"><Icon name="car" size={180} /></div>
          <ul className="auth-points">
            <li><Icon name="check" size={18} /> Pregledan katalog automobila</li>
            <li><Icon name="check" size={18} /> Tvoje porudžbine na jednom mestu</li>
            <li><Icon name="shield" size={18} /> Pristup vezan za tvoj korisnički nalog</li>
          </ul>
        </div>
      </aside>

      <div className="auth-card">
        <Link className="text-link" to="/automobili"><Icon name="arrow-left" size={16} /> Nazad na automobile</Link>
        <div className="auth-heading">
          <p className="eyebrow">DOBRO DOŠAO NAZAD</p>
          <h2>Prijavi se</h2>
          <p className="muted">Unesi podatke svog Trivio naloga.</p>
        </div>
        {typeof state?.notice === 'string' && <p className="form-notice" role="status"><Icon name="check" size={18} />{state.notice}</p>}
        {error && <p className="form-error" role="alert"><Icon name="alert" size={18} />{error}</p>}

        <form onSubmit={handleSubmit} noValidate aria-label="Prijava na Trivio" aria-busy={isLoading}>
          <div className="form-field">
            <label htmlFor="login-email">Email adresa</label>
            <input id="login-email" name="email" type="email" autoComplete="email" inputMode="email"
              placeholder="ime@primer.rs" required maxLength={254} value={email} disabled={isLoading}
              onChange={(event) => setEmail(event.target.value)} aria-invalid={!!fieldErrors.email}
              aria-describedby={fieldErrors.email ? 'login-email-error' : undefined} />
            {fieldErrors.email && <p id="login-email-error" className="field-error">{fieldErrors.email}</p>}
          </div>
          <div className="form-field">
            <label htmlFor="login-password">Lozinka</label>
            <div className="password-field">
              <input id="login-password" name="password" type={showPassword ? 'text' : 'password'}
                autoComplete="current-password" required value={password} disabled={isLoading}
                onChange={(event) => setPassword(event.target.value)} aria-invalid={!!fieldErrors.password}
                aria-describedby={fieldErrors.password ? 'login-password-error' : undefined} />
              <button type="button" className="password-toggle" onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Sakrij lozinku' : 'Prikaži lozinku'} aria-pressed={showPassword} aria-controls="login-password">
                <Icon name={showPassword ? 'eye-off' : 'eye'} size={19} />
              </button>
            </div>
            {fieldErrors.password && <p id="login-password-error" className="field-error">{fieldErrors.password}</p>}
          </div>
          <button type="submit" className="button button-primary button-full" disabled={isLoading}>
            {isLoading ? 'Prijavljivanje…' : 'Prijavi se'}<Icon name="arrow-right" size={18} />
          </button>
        </form>

        <p className="auth-switch">Nemaš nalog? <Link className="text-link" to="/registracija">Kreiraj nalog</Link></p>
        <p className="session-note"><Icon name="shield" size={16} /> Prijava ostaje aktivna pri osvežavanju stranice, do odjave, isteka sesije ili zatvaranja taba.</p>
      </div>
    </section>
  )
}
