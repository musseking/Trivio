import { useEffect, useId, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import type { UpdateProfileRequest, User } from '../api/types'
import { getErrorMessage, isAbortError } from '../api/client'
import { useAuth } from '../auth/useAuth'
import { Icon } from './Icon'
import './profile-dialog.css'
import { Avatar } from './Avatar'
import { PhotoCropDialog } from './owner/PhotoCropDialog'
import { useDialogDismiss } from '../hooks/useDialogDismiss'

export function ProfileDialog({ user, onClose }: { user: User; onClose: () => void }) {
  const { updateProfile, updatePhoto } = useAuth()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const requestRef = useRef<AbortController | null>(null)
  const id = useId()
  const [values, setValues] = useState<UpdateProfileRequest>({ firstName: user.firstName, lastName: user.lastName, email: user.email })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [cropFile, setCropFile] = useState<File | null>(null)
  const [photoNotice, setPhotoNotice] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const dismiss = useDialogDismiss(onClose)

  useEffect(() => {
    const dialog = dialogRef.current
    dialog?.showModal()
    return () => {
      requestRef.current?.abort()
      if (dialog?.open) dialog.close()
    }
  }, [])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (requestRef.current) return
    setError(null)
    setSaved(false)
    const data = { firstName: values.firstName.trim(), lastName: values.lastName.trim(), email: values.email.trim() }
    if (!data.firstName || !data.lastName) {
      setError('Ime i prezime ne mogu biti prazni.')
      const field = event.currentTarget.elements.namedItem(!data.firstName ? 'firstName' : 'lastName')
      if (field instanceof HTMLElement) field.focus()
      return
    }
    const controller = new AbortController()
    requestRef.current = controller
    setBusy(true)
    try {
      await updateProfile(data, controller.signal)
      if (!controller.signal.aborted) {
        setValues({ ...data, email: data.email.toLowerCase() })
        setSaved(true)
      }
    } catch (caught) {
      if (!controller.signal.aborted && !isAbortError(caught)) setError(getErrorMessage(caught))
    } finally {
      if (requestRef.current === controller) requestRef.current = null
      if (!controller.signal.aborted) setBusy(false)
    }
  }

  function change(field: keyof UpdateProfileRequest, value: string) {
    setValues(previous => ({ ...previous, [field]: value }))
    setSaved(false)
    setError(null)
  }

  function choosePhoto(file?: File) {
    if (!file || busy) return
    setError(null)
    setPhotoNotice(null)
    if (!['image/jpeg', 'image/png'].includes(file.type)) { setError('Izaberi JPEG ili PNG fotografiju.'); return }
    if (!file.size || file.size > 5 * 1024 * 1024) { setError('Fotografija mora biti manja od 5 MiB.'); return }
    setCropFile(file)
  }

  async function savePhoto(file: File | null) {
    if (requestRef.current) return
    const controller = new AbortController()
    requestRef.current = controller
    setBusy(true)
    setSaved(false)
    setError(null)
    setPhotoNotice(null)
    try {
      await updatePhoto(file, controller.signal)
      if (!controller.signal.aborted) setPhotoNotice(file ? 'Profilna slika je sačuvana.' : 'Profilna slika je uklonjena.')
    } catch (caught) {
      if (!controller.signal.aborted && !isAbortError(caught)) setError(getErrorMessage(caught))
    } finally {
      if (requestRef.current === controller) requestRef.current = null
      if (!controller.signal.aborted) setBusy(false)
    }
  }

  return <dialog ref={dialogRef} className="profile-dialog" aria-labelledby={`${id}-title`} aria-describedby={`${id}-description`} {...dismiss}>
    <div className="profile-dialog-heading">
      <div><p className="eyebrow">MOJ NALOG</p><h2 id={`${id}-title`}>Uredi profil</h2></div>
      <button type="button" className="icon-button" onClick={onClose} disabled={busy} aria-label="Zatvori profil"><Icon name="close" size={20} /></button>
    </div>
    <p id={`${id}-description`} className="muted">Ažuriraj svoje lične podatke i email adresu.</p>
    <form onSubmit={handleSubmit} aria-busy={busy}>
      <div className="profile-photo-editor">
        <Avatar user={user} large />
        <div><strong>Profilna slika</strong><p>JPEG ili PNG · do 5 MiB · do 20 megapiksela</p>
          <div className="profile-photo-actions"><button type="button" className="button button-secondary button-small" disabled={busy} onClick={() => fileRef.current?.click()}>{user.profilePhotoVersion ? 'Promeni sliku' : 'Dodaj sliku'}</button>
            {user.profilePhotoVersion && <button type="button" className="button button-ghost button-small" disabled={busy} onClick={() => { void savePhoto(null) }}>Ukloni sliku</button>}</div>
          <p>Izaberi kadar pre slanja. Slika se čuva zasebno od ostalih podataka.</p>
        </div>
        <input ref={fileRef} className="sr-only" type="file" accept="image/jpeg,image/png" aria-label="Izaberi profilnu sliku" disabled={busy}
          onChange={event => { choosePhoto(event.target.files?.[0]); event.target.value = '' }} />
      </div>
      <div className="form-grid">
        <div className="form-field">
          <label htmlFor={`${id}-firstName`}>Ime</label>
          <input id={`${id}-firstName`} name="firstName" autoComplete="given-name" required maxLength={80} autoFocus
            value={values.firstName} onChange={event => change('firstName', event.target.value)} disabled={busy} />
        </div>
        <div className="form-field">
          <label htmlFor={`${id}-lastName`}>Prezime</label>
          <input id={`${id}-lastName`} name="lastName" autoComplete="family-name" required maxLength={80}
            value={values.lastName} onChange={event => change('lastName', event.target.value)} disabled={busy} />
        </div>
      </div>
      <div className="form-field">
        <label htmlFor={`${id}-email`}>Email adresa</label>
        <input id={`${id}-email`} name="email" type="email" autoComplete="email" required maxLength={254}
          value={values.email} onChange={event => change('email', event.target.value)} disabled={busy} />
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      {saved && <p className="form-notice" role="status">Profil je uspešno sačuvan.</p>}
      {photoNotice && <p className="form-notice" role="status">{photoNotice}</p>}
      <div className="profile-dialog-actions">
        <button type="button" className="button button-secondary" onClick={onClose} disabled={busy}>{saved ? 'Zatvori' : 'Odustani'}</button>
        <button type="submit" className="button button-primary" disabled={busy}>{busy ? 'Čuvanje…' : 'Sačuvaj izmene'}</button>
      </div>
    </form>
    {cropFile && <PhotoCropDialog file={cropFile} photoNumber={1} totalPhotos={1} profile onCancel={() => setCropFile(null)}
      onApply={file => { setCropFile(null); void savePhoto(file) }} />}
  </dialog>
}
