import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { ApiError, getErrorMessage, isAbortError } from '../api/client'
import type { RegisterRequest } from '../api/types'
import { useAuth } from '../auth/useAuth'
import { Icon } from '../components/Icon'

type Field = keyof RegisterRequest | 'confirmPassword'
type FieldErrors = Partial<Record<Field, string>>

const invalidField: Record<keyof RegisterRequest, string> = {
  firstName: 'Unesi ime do 80 znakova.',
  lastName: 'Unesi prezime do 80 znakova.',
  email: 'Unesi ispravnu email adresu do 254 znaka.',
  password: 'Lozinka mora imati između 12 i 128 znakova.',
}

export default function RegisterPage() {
  const { register, isAuthenticated, isLoading } = useAuth()
  const navigate = useNavigate()
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isLoading) return
    setError(null)
    const errors: FieldErrors = {}
    if (!firstName.trim() || firstName.trim().length > 80) errors.firstName = invalidField.firstName
    if (!lastName.trim() || lastName.trim().length > 80) errors.lastName = invalidField.lastName
    if (!/^[^\s@]+@[^\s@]+$/.test(email.trim()) || email.trim().length > 254) errors.email = invalidField.email
    if (!password.trim() || password.length < 12 || password.length > 128) errors.password = invalidField.password
    if (!confirmPassword || confirmPassword !== password) errors.confirmPassword = 'Unete lozinke se ne podudaraju.'
    setFieldErrors(errors)
    if (Object.keys(errors).length) {
      const firstInvalid = event.currentTarget.elements.namedItem(Object.keys(errors)[0])
      if (firstInvalid instanceof HTMLElement) firstInvalid.focus()
      return
    }
    try {
      await register({ firstName: firstName.trim(), lastName: lastName.trim(), email: email.trim(), password })
      if (!mountedRef.current) return
      setPassword('')
      setConfirmPassword('')
      navigate('/prijava', { replace: true, state: { notice: 'Nalog je kreiran. Prijavi se da nastaviš.' } })
    } catch (caught) {
      if (mountedRef.current && !isAbortError(caught)) {
        setError(getErrorMessage(caught))
        if (caught instanceof ApiError && caught.fieldErrors.length) {
          const serverErrors: FieldErrors = {}
          for (const field of caught.fieldErrors) {
            if (field in invalidField) serverErrors[field as keyof RegisterRequest] = invalidField[field as keyof RegisterRequest]
          }
          setFieldErrors(serverErrors)
        }
      }
    }
  }

  if (isAuthenticated) return <Navigate to="/porudzbine" replace />

  return (
    <section className="auth-layout">
      <aside className="auth-aside">
        <div className="auth-aside-content">
          <p className="eyebrow">DOBRO DOŠAO U TRIVIO</p>
          <h1>Svaka dobra vožnja<br />počinje izborom.</h1>
          <p>Kreiraj svoj nalog i napravi prvi korak ka sledećem automobilu.</p>
          <div className="auth-visual" aria-hidden="true"><Icon name="car" size={180} /></div>
          <ul className="auth-points">
            <li><Icon name="check" size={18} /> Jednostavna registracija</li>
            <li><Icon name="check" size={18} /> Pregled i praćenje porudžbina</li>
            <li><Icon name="shield" size={18} /> Tvoji podaci na tvom nalogu</li>
          </ul>
        </div>
      </aside>

      <div className="auth-card">
        <Link className="text-link" to="/automobili"><Icon name="arrow-left" size={16} /> Nazad na automobile</Link>
        <div className="auth-heading">
          <p className="eyebrow">NOVO POGLAVLJE</p>
          <h2>Kreiraj nalog</h2>
          <p className="muted">Nekoliko podataka i tvoj nalog je spreman za Trivio.</p>
        </div>
        {error && <p className="form-error" role="alert"><Icon name="alert" size={18} />{error}</p>}

        <form onSubmit={handleSubmit} noValidate aria-label="Kreiranje Trivio naloga" aria-busy={isLoading}>
          <div className="form-grid">
            <div className="form-field">
              <label htmlFor="register-first-name">Ime</label>
              <input id="register-first-name" name="firstName" autoComplete="given-name" required maxLength={80}
                value={firstName} disabled={isLoading} onChange={(event) => setFirstName(event.target.value)}
                aria-invalid={!!fieldErrors.firstName} aria-describedby={fieldErrors.firstName ? 'register-first-name-error' : undefined} />
              {fieldErrors.firstName && <p id="register-first-name-error" className="field-error">{fieldErrors.firstName}</p>}
            </div>
            <div className="form-field">
              <label htmlFor="register-last-name">Prezime</label>
              <input id="register-last-name" name="lastName" autoComplete="family-name" required maxLength={80}
                value={lastName} disabled={isLoading} onChange={(event) => setLastName(event.target.value)}
                aria-invalid={!!fieldErrors.lastName} aria-describedby={fieldErrors.lastName ? 'register-last-name-error' : undefined} />
              {fieldErrors.lastName && <p id="register-last-name-error" className="field-error">{fieldErrors.lastName}</p>}
            </div>
          </div>
          <div className="form-field">
            <label htmlFor="register-email">Email adresa</label>
            <input id="register-email" name="email" type="email" autoComplete="email" inputMode="email"
              placeholder="ime@primer.rs" required maxLength={254} value={email} disabled={isLoading}
              onChange={(event) => setEmail(event.target.value)} aria-invalid={!!fieldErrors.email}
              aria-describedby={fieldErrors.email ? 'register-email-error' : undefined} />
            {fieldErrors.email && <p id="register-email-error" className="field-error">{fieldErrors.email}</p>}
          </div>
          <div className="form-field">
            <label htmlFor="register-password">Lozinka</label>
            <div className="password-field">
              <input id="register-password" name="password" type={showPassword ? 'text' : 'password'} autoComplete="new-password"
                required minLength={12} maxLength={128} value={password} disabled={isLoading}
                onChange={(event) => setPassword(event.target.value)} aria-invalid={!!fieldErrors.password}
                aria-describedby={fieldErrors.password ? 'register-password-error' : 'register-password-hint'} />
              <button type="button" className="password-toggle" onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Sakrij lozinku' : 'Prikaži lozinku'} aria-pressed={showPassword} aria-controls="register-password register-confirm-password">
                <Icon name={showPassword ? 'eye-off' : 'eye'} size={19} />
              </button>
            </div>
            {fieldErrors.password
              ? <p id="register-password-error" className="field-error">{fieldErrors.password}</p>
              : <p id="register-password-hint" className="field-hint">Od 12 do 128 znakova. Koristi jedinstvenu lozinku.</p>}
          </div>
          <div className="form-field">
            <label htmlFor="register-confirm-password">Potvrdi lozinku</label>
            <input id="register-confirm-password" name="confirmPassword" type={showPassword ? 'text' : 'password'}
              autoComplete="new-password" required minLength={12} maxLength={128} value={confirmPassword} disabled={isLoading}
              onChange={(event) => setConfirmPassword(event.target.value)} aria-invalid={!!fieldErrors.confirmPassword}
              aria-describedby={fieldErrors.confirmPassword ? 'register-confirm-password-error' : undefined} />
            {fieldErrors.confirmPassword && <p id="register-confirm-password-error" className="field-error">{fieldErrors.confirmPassword}</p>}
          </div>
          <button type="submit" className="button button-primary button-full" disabled={isLoading}>
            {isLoading ? 'Kreiranje naloga…' : 'Kreiraj nalog'}<Icon name="arrow-right" size={18} />
          </button>
        </form>

        <p className="auth-switch">Već imaš nalog? <Link className="text-link" to="/prijava">Prijavi se</Link></p>
        <p className="session-note"><Icon name="shield" size={16} /> Nakon registracije prijavi se da pristupiš porudžbinama.</p>
      </div>
    </section>
  )
}
