import { useEffect, useId, useRef, useState } from 'react'
import type { User } from '../api/types'
import { getProfilePhoto } from '../api/profile-photo'
import { getErrorMessage, isAbortError } from '../api/client'
import { useAuth } from '../auth/useAuth'
import { Icon } from './Icon'
import './avatar.css'
import { useDialogDismiss } from '../hooks/useDialogDismiss'

export function Avatar({ user, large = false, onEmptyClick }: { user: User; large?: boolean; onEmptyClick?: () => void }) {
  const { accessToken } = useAuth()
  const [photo, setPhoto] = useState<{ key: string; url: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [viewing, setViewing] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const key = `${user.id}:${user.profilePhotoVersion ?? ''}`
  const url = photo?.key === key ? photo.url : null
  useEffect(() => {
    setPhoto(null)
    setError(null)
    if (!user.profilePhotoVersion || !accessToken) return
    const controller = new AbortController()
    let objectUrl: string | undefined
    getProfilePhoto(accessToken, user.id, controller.signal).then(blob => {
      if (controller.signal.aborted) return
      objectUrl = URL.createObjectURL(blob)
      setPhoto({ key, url: objectUrl })
    }).catch(caught => { if (!controller.signal.aborted && !isAbortError(caught)) setError(getErrorMessage(caught)) })
    return () => { controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl) }
  }, [accessToken, user.id, user.profilePhotoVersion, key, attempt])

  const content = url ? <img src={url} alt="" draggable={false} /> : <>{user.firstName.slice(0, 1)}{user.lastName.slice(0, 1)}</>
  const name = `${user.firstName} ${user.lastName}`
  const clickable = Boolean(user.profilePhotoVersion) || Boolean(onEmptyClick)
  return <>
    {clickable ? <button type="button" className={`avatar avatar-button ${large ? 'avatar-large' : ''}`}
      aria-label={user.profilePhotoVersion ? `Otvori profilnu sliku: ${name}` : 'Uredi profil'} aria-haspopup="dialog"
      onClick={() => { if (user.profilePhotoVersion) setViewing(true); else onEmptyClick?.() }}>{content}</button>
      : <span className={`avatar ${large ? 'avatar-large' : ''}`} aria-hidden="true">{content}</span>}
    {viewing && <ProfilePhotoViewer name={name} url={url} error={error} onRetry={() => setAttempt(value => value + 1)} onClose={() => setViewing(false)} />}
  </>
}

function ProfilePhotoViewer({ name, url, error, onRetry, onClose }: {
  name: string; url: string | null; error: string | null; onRetry: () => void; onClose: () => void
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const title = useId()
  const dismiss = useDialogDismiss(onClose)
  useEffect(() => {
    const dialog = ref.current
    dialog?.showModal()
    return () => { if (dialog?.open) dialog.close() }
  }, [])
  return <dialog ref={ref} className="profile-photo-viewer" aria-labelledby={title} {...dismiss}>
    <div className="profile-photo-viewer-heading"><h2 id={title}>{name}</h2><button type="button" className="icon-button" aria-label="Zatvori sliku" onClick={onClose} autoFocus><Icon name="close" size={22} /></button></div>
    {url ? <img className="profile-photo-full" src={url} alt={`Profilna slika: ${name}`} draggable={false} />
      : error ? <div role="alert"><p className="form-error">{error}</p><button type="button" className="button button-secondary" onClick={onRetry}>Pokušaj ponovo</button></div>
        : <p role="status">Učitavanje slike…</p>}
  </dialog>
}
