import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { createFirstOwner } from '../api/auth'
import { ApiError, getErrorMessage, isAbortError } from '../api/client'
import { Icon } from '../components/Icon'
import type { OwnerSetupRequest } from '../api/types'

interface Props {
  onComplete: () => void
  onAlreadySetUp: () => void
}

type ErrorField = keyof OwnerSetupRequest | 'confirmPassword'
const messages: Record<ErrorField, string> = {
  firstName: 'Unesi ime (do 80 znakova).',
  lastName: 'Unesi prezime (do 80 znakova).',
  email: 'Unesi ispravnu email adresu.',
  password: 'Lozinka mora imati 12–128 znakova.',
  confirmPassword: 'Lozinke se ne podudaraju.',
  setupKey: 'Unesi instalacioni ključ iz lokalnog .env fajla.',
}

export default function OwnerSetupPage({ onComplete, onAlreadySetUp }: Props) {
  const [values, setValues] = useState({ firstName: '', lastName: '', email: '', password: '', confirmPassword: '', setupKey: '' })
  const [visible, setVisible] = useState(false)
  const [errors, setErrors] = useState<Partial<Record<ErrorField, string>>>({})
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const mounted = useRef(true)
  const navigate = useNavigate()

  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])

  function change(field: keyof typeof values, value: string) {
    setValues((old) => ({ ...old, [field]: value }))
    setErrors((old) => ({ ...old, [field]: undefined }))
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    setError(null)
    const e: Partial<Record<ErrorField, string>> = {}
    if (!values.firstName.trim() || values.firstName.trim().length > 80) e.firstName = messages.firstName
    if (!values.lastName.trim() || values.lastName.trim().length > 80) e.lastName = messages.lastName
    if (!/^[^\s@]+@[^\s@]+$/.test(values.email.trim()) || values.email.trim().length > 254) e.email = messages.email
    if (values.password.length < 12 || values.password.length > 128) e.password = messages.password
    if (values.confirmPassword !== values.password) e.confirmPassword = messages.confirmPassword
    if (!values.setupKey.trim()) e.setupKey = messages.setupKey
    setErrors(e)
    if (Object.keys(e).length) {
      const invalid = event.currentTarget.elements.namedItem(Object.keys(e)[0])
      if (invalid instanceof HTMLElement) invalid.focus()
      return
    }

    setBusy(true)
    try {
      await createFirstOwner({
        firstName: values.firstName.trim(), lastName: values.lastName.trim(),
        email: values.email.trim(), password: values.password, setupKey: values.setupKey.trim(),
      })
      if (!mounted.current) return
      setValues((old) => ({ ...old, password: '', confirmPassword: '', setupKey: '' }))
      onComplete()
      navigate('/prijava', { replace: true, state: { notice: 'Vlasnički nalog je kreiran. Prijavi se svojim podacima.' } })
    } catch (caught) {
      if (!mounted.current || isAbortError(caught)) return
      setError(getErrorMessage(caught))
      if (caught instanceof ApiError) {
        const fields: Partial<Record<ErrorField, string>> = {}
        for (const field of caught.fieldErrors) {
          if (field in messages) fields[field as ErrorField] = messages[field as ErrorField]
        }
        setErrors(fields)
        // Another installer may have claimed ownership while this form was open.
        if (caught.status === 409) onAlreadySetUp()
      }
    } finally {
      if (mounted.current) setBusy(false)
    }
  }

  return <section className="auth-layout setup-layout">
    <aside className="auth-aside setup-aside"><div className="auth-aside-content">
      <p className="eyebrow">DOBRO DOŠAO U TRIVIO</p>
      <h1>Nova garaža.<br />Tvoja pravila.</h1>
      <p>Postavi vlasnički nalog za svoju instalaciju Trivija. Nakon toga je sistem spreman za prve korisnike i automobile.</p>
      <div className="auth-visual" aria-hidden="true"><Icon name="car" size={180} /></div>
      <ul className="auth-points">
        <li><Icon name="check" size={18} />Jedan vlasnik po instalaciji</li>
        <li><Icon name="shield" size={18} />Instalacioni ključ ostaje na serveru</li>
        <li><Icon name="lock" size={18} />Podešavanje se trajno zaključava</li>
      </ul>
    </div></aside>
    <div className="auth-card setup-card">
      <div className="auth-heading">
        <p className="eyebrow">PRVO POKRETANJE</p>
        <h2>Kreiraj OWNER nalog</h2>
        <p className="muted">Ovaj korak se pojavljuje samo dok instalacija nema vlasnika.</p>
      </div>
      {error && <p className="form-error" role="alert"><Icon name="alert" size={18}/>{error}</p>}
      <form onSubmit={submit} noValidate aria-label="Prvo podešavanje Trivio vlasnika" aria-busy={busy}>
        <div className="form-grid">
          {(['firstName', 'lastName'] as const).map((field) => <div className="form-field" key={field}>
            <label htmlFor={`setup-${field}`}>{field === 'firstName' ? 'Ime' : 'Prezime'}</label>
            <input id={`setup-${field}`} name={field} autoComplete={field === 'firstName' ? 'given-name' : 'family-name'} required maxLength={80}
              value={values[field]} disabled={busy} onChange={(event) => change(field, event.target.value)}
              aria-invalid={!!errors[field]} aria-describedby={errors[field] ? `setup-${field}-error` : undefined} />
            {errors[field] && <p className="field-error" id={`setup-${field}-error`}>{errors[field]}</p>}
          </div>)}
        </div>
        <div className="form-field">
          <label htmlFor="setup-email">Email adresa</label>
          <input id="setup-email" name="email" type="email" autoComplete="email" inputMode="email" maxLength={254} required
            value={values.email} disabled={busy} onChange={(event) => change('email', event.target.value)}
            aria-invalid={!!errors.email} aria-describedby={errors.email ? 'setup-email-error' : undefined} />
          {errors.email && <p id="setup-email-error" className="field-error">{errors.email}</p>}
        </div>
        <div className="form-field">
          <label htmlFor="setup-password">Lozinka</label>
          <div className="password-field">
            <input id="setup-password" name="password" type={visible ? 'text' : 'password'} autoComplete="new-password" minLength={12} maxLength={128} required
              value={values.password} disabled={busy} onChange={(event) => change('password', event.target.value)}
              aria-invalid={!!errors.password} aria-describedby={errors.password ? 'setup-password-error' : 'setup-password-hint'} />
            <button type="button" className="password-toggle" onClick={() => setVisible((old) => !old)}
              aria-label={visible ? 'Sakrij lozinke' : 'Prikaži lozinke'} aria-pressed={visible} aria-controls="setup-password setup-confirmPassword">
              <Icon name={visible ? 'eye-off' : 'eye'} size={19}/>
            </button>
          </div>
          {errors.password ? <p id="setup-password-error" className="field-error">{errors.password}</p>
            : <p id="setup-password-hint" className="field-hint">12–128 znakova. Sačuvaj je na bezbednom mestu.</p>}
        </div>
        <div className="form-field">
          <label htmlFor="setup-confirmPassword">Potvrdi lozinku</label>
          <input id="setup-confirmPassword" name="confirmPassword" type={visible ? 'text' : 'password'} autoComplete="new-password" required
            value={values.confirmPassword} disabled={busy} onChange={(event) => change('confirmPassword', event.target.value)}
            aria-invalid={!!errors.confirmPassword} aria-describedby={errors.confirmPassword ? 'setup-confirmPassword-error' : undefined} />
          {errors.confirmPassword && <p className="field-error" id="setup-confirmPassword-error">{errors.confirmPassword}</p>}
        </div>
        <div className="form-field">
          <label htmlFor="setup-setupKey">Instalacioni ključ</label>
          <input id="setup-setupKey" name="setupKey" type="password" autoComplete="off" spellCheck={false} required
            value={values.setupKey} disabled={busy} onChange={(event) => change('setupKey', event.target.value)}
            aria-invalid={!!errors.setupKey} aria-describedby={errors.setupKey ? 'setup-setupKey-error' : 'setup-setupKey-hint'} />
          {errors.setupKey ? <p id="setup-setupKey-error" className="field-error">{errors.setupKey}</p>
            : <p id="setup-setupKey-hint" className="field-hint">Vrednost TRIVIO_OWNER_SETUP_KEY iz lokalnog .env fajla. Ne šalji je drugima.</p>}
        </div>
        <button type="submit" className="button button-primary button-full" disabled={busy}>
          {busy ? 'Kreiranje vlasnika…' : 'Kreiraj OWNER nalog'}<Icon name="arrow-right" size={18}/>
        </button>
      </form>
      <p className="session-note"><Icon name="shield" size={16}/>Ključ se koristi samo za ovaj zahtev i ne čuva se u browseru.</p>
    </div>
  </section>
}
