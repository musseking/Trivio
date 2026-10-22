import { useEffect, useId, useRef } from 'react'
import type { ReactNode } from 'react'
import { Icon } from '../Icon'

export function ConfirmDialog({ title, description, confirmLabel, onConfirm, onCancel, busy = false, error, children }: {
  title: string; description: string; confirmLabel: string; onConfirm: () => void; onCancel: () => void
  busy?: boolean; error?: string | null; children?: ReactNode
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const descriptionId = useId()
  useEffect(() => {
    const dialog = dialogRef.current
    dialog?.showModal()
    return () => { if (dialog?.open) dialog.close() }
  }, [])

  return <dialog className="owner-dialog" ref={dialogRef} aria-labelledby={titleId} aria-describedby={descriptionId}
    onCancel={(event) => { event.preventDefault(); if (!busy) onCancel() }}>
    <div className="owner-dialog-icon"><Icon name="shield" size={25} /></div>
    <h2 id={titleId}>{title}</h2><p id={descriptionId}>{description}</p>
    {children}
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="owner-dialog-actions">
      <button className="button button-secondary" type="button" onClick={onCancel} disabled={busy} autoFocus>Odustani</button>
      <button className="button button-primary" type="button" onClick={onConfirm} disabled={busy}>{busy ? 'Čuvanje…' : confirmLabel}</button>
    </div>
  </dialog>
}
