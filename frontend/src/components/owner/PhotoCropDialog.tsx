import { useEffect, useId, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from 'react'
import { Icon } from '../Icon'
import { cropPhotoFile } from '../../lib/photo-crop-file'
import { cropForAspect, isFullPhoto, moveCrop, resizeCrop, zoomCrop } from '../../lib/photo-crop'
import type { CropAspect, PhotoCrop } from '../../lib/photo-crop'
import './photo-crop.css'

type DragState = { mode: 'move' | 'resize'; x: number; y: number; crop: PhotoCrop }

export function PhotoCropDialog({ file, photoNumber, totalPhotos, onApply, onCancel }: {
  file: File; photoNumber: number; totalPhotos: number
  onApply: (file: File) => void; onCancel: () => void
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const imageBoxRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<DragState | null>(null)
  const headingId = useId()
  const helpId = useId()
  const [imageUrl, setImageUrl] = useState('')
  const [size, setSize] = useState({ width: 0, height: 0 })
  const [aspect, setAspect] = useState<CropAspect>('free')
  const [crop, setCrop] = useState<PhotoCrop>({ x: 0, y: 0, width: 1, height: 1 })
  const [working, setWorking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const baseCrop = useMemo(() => cropForAspect(aspect, size.width, size.height), [aspect, size])
  const zoom = Math.max(0, Math.min(100, Math.round((1 - crop.width / baseCrop.width) / .0085)))

  useEffect(() => {
    const dialog = dialogRef.current
    dialog?.showModal()
    return () => { if (dialog?.open) dialog.close() }
  }, [])

  useEffect(() => {
    const url = URL.createObjectURL(file)
    setImageUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  function selectAspect(next: CropAspect) {
    if (working) return
    setAspect(next)
    setCrop(cropForAspect(next, size.width, size.height))
  }

  function startDrag(mode: DragState['mode'], event: ReactPointerEvent<HTMLElement>) {
    if (working || !size.width || !imageBoxRef.current) return
    event.preventDefault()
    event.stopPropagation()
    dragRef.current = { mode, x: event.clientX, y: event.clientY, crop }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function drag(event: ReactPointerEvent<HTMLElement>) {
    const current = dragRef.current
    const bounds = imageBoxRef.current?.getBoundingClientRect()
    if (!current || !bounds?.width || !bounds.height) return
    const dx = (event.clientX - current.x) / bounds.width
    const dy = (event.clientY - current.y) / bounds.height
    setCrop(current.mode === 'move'
      ? moveCrop(current.crop, dx, dy)
      : resizeCrop(current.crop, dx, dy, aspect, size.width, size.height))
  }

  function stopDrag() { dragRef.current = null }

  function moveByKeyboard(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (working) return
    const step = event.shiftKey ? .025 : .0075
    let dx = 0; let dy = 0
    if (event.key === 'ArrowLeft') dx = -step
    else if (event.key === 'ArrowRight') dx = step
    else if (event.key === 'ArrowUp') dy = -step
    else if (event.key === 'ArrowDown') dy = step
    else return
    event.preventDefault()
    setCrop((current) => event.altKey
      ? resizeCrop(current, dx, dy, aspect, size.width, size.height)
      : moveCrop(current, dx, dy))
  }

  async function apply() {
    if (working || !size.width) return
    setWorking(true)
    setError(null)
    try {
      onApply(isFullPhoto(crop) ? file : await cropPhotoFile(file, crop))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Fotografija nije mogla da bude obrađena.')
      setWorking(false)
    }
  }

  return <dialog className="owner-dialog photo-crop-dialog" ref={dialogRef} aria-labelledby={headingId} aria-describedby={helpId}
    onCancel={(event) => { event.preventDefault(); if (!working) onCancel() }}>
    <div className="photo-crop-heading">
      <div>
        <p className="eyebrow">UREĐIVANJE FOTOGRAFIJE {photoNumber}/{totalPhotos}</p>
        <h2 id={headingId}>Izaberi deo fotografije</h2>
      </div>
      <div className="photo-crop-heading-icon"><Icon name="car" size={22} /></div>
    </div>
    <p id={helpId} className="photo-crop-help">Prevuci označeni okvir da pomeriš kadar, a donji desni ugao da promeniš njegovu veličinu. Sačuvaće se samo označeni deo fotografije.</p>
    <div className="photo-crop-stage">
      {imageUrl && <div className="photo-crop-image-box" ref={imageBoxRef}>
        <img src={imageUrl} alt="Originalna fotografija za kadriranje" draggable={false}
          onLoad={(event) => {
            const { naturalWidth, naturalHeight } = event.currentTarget
            if (naturalWidth * naturalHeight > 20_000_000) {
              setError('Fotografija premašuje dozvoljenih 20 megapiksela.')
            } else if (naturalWidth && naturalHeight) {
              setSize({ width: naturalWidth, height: naturalHeight })
            }
          }}
          onError={() => setError('Fotografija nije mogla da se otvori. Izaberi drugu datoteku.')} />
        {size.width > 0 && <div className="photo-crop-selection"
          style={{ left: `${crop.x * 100}%`, top: `${crop.y * 100}%`, width: `${crop.width * 100}%`, height: `${crop.height * 100}%` }}>
          <div className="photo-crop-move" role="button" tabIndex={0} aria-label="Pomeri kadar strelicama ili prevlačenjem"
            onPointerDown={(event) => startDrag('move', event)} onPointerMove={drag} onPointerUp={stopDrag} onPointerCancel={stopDrag}
            onLostPointerCapture={stopDrag} onKeyDown={moveByKeyboard}>
            <span className="photo-crop-grid" aria-hidden="true" />
          </div>
          <button type="button" className="photo-crop-resize" aria-label="Promeni veličinu kadra prevlačenjem"
            title="Prevuci da promeniš veličinu kadra" disabled={working}
            onPointerDown={(event) => startDrag('resize', event)} onPointerMove={drag} onPointerUp={stopDrag}
            onPointerCancel={stopDrag} onLostPointerCapture={stopDrag} />
        </div>}
      </div>}
    </div>
    <div className="photo-crop-controls">
      <label className="photo-crop-aspect">Format kadra
        <select value={aspect} disabled={working || !size.width} onChange={(event) => selectAspect(event.target.value as CropAspect)}>
          <option value="free">Slobodan</option>
          <option value="4:3">4:3 — fotografija</option>
          <option value="16:9">16:9 — široki kadar</option>
          <option value="1:1">1:1 — kvadrat</option>
        </select>
      </label>
      <label className="photo-crop-zoom">Uvećanje kadra: {zoom}%
        <input type="range" min="0" max="100" step="1" value={zoom} disabled={working || !size.width}
          onChange={(event) => setCrop((current) => zoomCrop(current, baseCrop, Number(event.target.value)))} />
      </label>
      <button type="button" className="button button-ghost button-small" disabled={working || !size.width} onClick={() => { setCrop(baseCrop); setError(null) }}>Resetuj kadar</button>
    </div>
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="photo-crop-actions">
      <button type="button" className="button button-secondary" disabled={working} onClick={onCancel}>Odustani</button>
      <button type="button" className="button button-ghost" disabled={working || !size.width} onClick={() => onApply(file)}>Bez sečenja</button>
      <button type="button" className="button button-primary" disabled={working || !size.width || Boolean(error)} onClick={() => void apply()}>{working ? 'Obrada…' : photoNumber < totalPhotos ? 'Sačuvaj i nastavi' : 'Sačuvaj kadar'}</button>
    </div>
  </dialog>
}
