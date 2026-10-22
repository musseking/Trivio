import { useEffect, useId, useRef, useState } from 'react'
import type { VehiclePhoto } from '../../api/types'
import { getErrorMessage, isAbortError } from '../../api/client'
import { deleteVehiclePhoto, listVehiclePhotos, replaceVehiclePhoto, saveVehiclePhotoOrder, uploadVehiclePhotos } from '../../api/vehicle-management'
import { Icon } from '../Icon'
import { ConfirmDialog } from './ConfirmDialog'
import { PhotoCropDialog } from './PhotoCropDialog'

export interface StagedPhoto { key: string; file: File }
type UploadSelection = { kind: 'add'; files: File[] } | { kind: 'replace'; photoId: number; files: [File] }
type CropQueue = { kind: 'add'; files: File[]; index: number; prepared: File[] }
  | { kind: 'replace'; photoId: number; files: [File]; index: number; prepared: File[] }
  | { kind: 'replacePending'; pendingKey: string; files: [File]; index: number; prepared: File[] }
const MAX_PHOTOS = 10
const MAX_BYTES = 5 * 1024 * 1024

export function validatePhotoFiles(files: File[], currentCount: number): string | null {
  if (files.length + currentCount > MAX_PHOTOS) return 'Vozilo može imati najviše 10 fotografija.'
  for (const file of files) {
    if (!['image/jpeg', 'image/png'].includes(file.type)) return 'Dodaj samo JPEG ili PNG fotografije.'
    if (file.size === 0 || file.size > MAX_BYTES) return 'Svaka fotografija mora biti neprazna i imati najviše 5 MiB.'
  }
  return null
}

export function PhotoEditor({ accessToken, vehicleId, photos, onPhotosChange, pending, onPendingChange,
  pendingCoverKey, onPendingCoverChange, disabled = false, onBusyChange }: {
  accessToken: string; vehicleId: number | null; photos: VehiclePhoto[]
  onPhotosChange: (photos: VehiclePhoto[]) => void
  pending: StagedPhoto[]; onPendingChange: (photos: StagedPhoto[]) => void
  pendingCoverKey: string | null; onPendingCoverChange: (key: string | null) => void
  disabled?: boolean; onBusyChange?: (busy: boolean) => void
}) {
  const inputId = useId()
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [removing, setRemoving] = useState<VehiclePhoto | null>(null)
  const [uploadSelection, setUploadSelection] = useState<UploadSelection | null>(null)
  const [cropQueue, setCropQueue] = useState<CropQueue | null>(null)
  const [uploadPreviews, setUploadPreviews] = useState<string[]>([])
  const mountedRef = useRef(true)
  const busyRef = useRef(false)
  const requestRef = useRef<AbortController | null>(null)
  const sequence = useRef(0)
  const ordered = [...photos].sort((a, b) => a.position - b.position)
  const blocked = busy || disabled
  const count = vehicleId === null ? pending.length : photos.length

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false; requestRef.current?.abort() }
  }, [])

  useEffect(() => {
    const urls: Record<string, string> = {}
    for (const photo of pending) urls[photo.key] = URL.createObjectURL(photo.file)
    setPreviewUrls(urls)
    return () => { for (const url of Object.values(urls)) URL.revokeObjectURL(url) }
  }, [pending])

  useEffect(() => {
    const urls = uploadSelection?.files.map((file) => URL.createObjectURL(file)) ?? []
    setUploadPreviews(urls)
    return () => { for (const url of urls) URL.revokeObjectURL(url) }
  }, [uploadSelection])

  async function mutate(action: (signal: AbortSignal) => Promise<VehiclePhoto[]>, message: string) {
    if (busyRef.current || disabled) return
    busyRef.current = true
    setBusy(true); onBusyChange?.(true); setError(null); setNotice(null)
    const controller = new AbortController()
    requestRef.current = controller
    try {
      const next = await action(controller.signal)
      if (!mountedRef.current) return
      onPhotosChange(next)
      setNotice(message)
      setRemoving(null)
      setUploadSelection(null)
    } catch (caught) {
      if (mountedRef.current && !isAbortError(caught)) setError(`${getErrorMessage(caught)} Ako je veza prekinuta, osveži podatke pre ponavljanja izmene.`)
    } finally {
      busyRef.current = false
      if (mountedRef.current) { setBusy(false); onBusyChange?.(false) }
    }
  }

  function add(files: File[]) {
    const invalid = validatePhotoFiles(files, count)
    setError(invalid); setNotice(null)
    if (invalid || files.length === 0) return
    setCropQueue({ kind: 'add', files, index: 0, prepared: [] })
  }

  function replace(photoId: number, file: File | undefined) {
    if (!file || vehicleId === null) return
    const invalid = validatePhotoFiles([file], 0)
    setError(invalid); setNotice(null)
    if (!invalid) setCropQueue({ kind: 'replace', photoId, files: [file], index: 0, prepared: [] })
  }

  function replacePending(pendingKey: string, file: File | undefined) {
    if (!file) return
    const invalid = validatePhotoFiles([file], 0)
    setError(invalid); setNotice(null)
    if (!invalid) setCropQueue({ kind: 'replacePending', pendingKey, files: [file], index: 0, prepared: [] })
  }

  function acceptCrop(file: File) {
    if (!cropQueue) return
    const prepared = [...cropQueue.prepared, file]
    if (cropQueue.index + 1 < cropQueue.files.length) {
      setCropQueue({ ...cropQueue, index: cropQueue.index + 1, prepared })
      return
    }
    setCropQueue(null)
    const invalid = validatePhotoFiles(prepared, cropQueue.kind === 'add' ? count : 0)
    if (invalid) { setError(invalid); return }
    if (cropQueue.kind === 'add') {
      if (vehicleId !== null) setUploadSelection({ kind: 'add', files: prepared })
      else {
        const added = prepared.map((item) => ({ file: item, key: `photo-${Date.now()}-${++sequence.current}` }))
        onPendingChange([...pending, ...added])
        if (!pendingCoverKey) onPendingCoverChange(added[0].key)
      }
    } else if (cropQueue.kind === 'replace') {
      setUploadSelection({ kind: 'replace', photoId: cropQueue.photoId, files: [file] })
    } else {
      onPendingChange(pending.map((photo) => photo.key === cropQueue.pendingKey ? { ...photo, file } : photo))
    }
  }

  function confirmUpload() {
    if (!uploadSelection || vehicleId === null) return
    const selection = uploadSelection
    if (selection.kind === 'add') void mutate((signal) => uploadVehiclePhotos(accessToken, vehicleId, selection.files, signal), 'Fotografije su dodate.')
    else void mutate((signal) => replaceVehiclePhoto(accessToken, vehicleId, selection.photoId, selection.files[0], signal), 'Fotografija je zamenjena.')
  }

  function move(index: number, offset: number) {
    if (blocked) return
    const target = index + offset
    if (target < 0 || target >= count) return
    if (vehicleId === null) {
      const next = [...pending]
      ;[next[index], next[target]] = [next[target], next[index]]
      onPendingChange(next)
    } else {
      const next = [...ordered]
      ;[next[index], next[target]] = [next[target], next[index]]
      const cover = ordered.find((photo) => photo.cover) ?? ordered[0]
      void mutate((signal) => saveVehiclePhotoOrder(accessToken, vehicleId, { photoIds: next.map((photo) => photo.id), coverPhotoId: cover.id }, signal), 'Redosled fotografija je sačuvan.')
    }
  }

  function cover(photo: VehiclePhoto) {
    if (vehicleId === null) return
    void mutate((signal) => saveVehiclePhotoOrder(accessToken, vehicleId, { photoIds: ordered.map((item) => item.id), coverPhotoId: photo.id }, signal), 'Naslovna fotografija je sačuvana.')
  }

  return <section className="owner-panel owner-photo-editor" aria-labelledby={`${inputId}-heading`} aria-busy={busy}>
    <div className="owner-panel-heading"><div><p className="eyebrow">GALERIJA VOZILA</p><h2 id={`${inputId}-heading`}>Fotografije koje prave razliku</h2></div><div className="owner-photo-heading-actions">{vehicleId !== null && <button type="button" className="icon-button" disabled={blocked} aria-label="Ponovo učitaj galeriju" title="Ponovo učitaj galeriju" onClick={() => { void mutate((signal) => listVehiclePhotos(vehicleId, signal), 'Galerija je osvežena.') }}><Icon name="refresh" size={17} /></button>}<span className="owner-count">{count}/10</span></div></div>
    <p className="owner-help">{vehicleId === null ? 'Dodaj fotografije pre čuvanja vozila. Biće poslate tek kada sačuvaš podatke.' : 'Pre dodavanja i zamene biraš kadar, pregledaš fotografije i potvrđuješ slanje. Izmene galerije čuvaju se zasebno od podataka u formi.'} Izaberi naslovnu i redosled prikazivanja.</p>
    <div className="owner-upload-area">
      <Icon name="car" size={30} /><div><strong>Prikaži automobil iz najboljeg ugla</strong><span>JPEG ili PNG · do 5 MiB po slici · najviše 10 fotografija · do 20 megapiksela</span></div>
      <label className={`button button-secondary button-small ${blocked || count >= 10 ? 'owner-disabled' : ''}`} htmlFor={inputId}>Dodaj fotografije</label>
      <input id={inputId} className="sr-only" type="file" accept="image/jpeg,image/png" multiple disabled={blocked || count >= 10}
        onChange={(event) => { const files = Array.from(event.target.files ?? []); event.target.value = ''; add(files) }} />
    </div>
    {error && !removing && !uploadSelection && <p className="form-error" role="alert"><Icon name="alert" size={18} />{error}</p>}
    {notice && <p className="form-notice" role="status"><Icon name="check" size={18} />{notice}</p>}
    {busy && <p className="owner-help" role="status">Čuvamo izmene fotografija…</p>}
    <div className="owner-photo-grid">
      {vehicleId === null ? pending.map((photo, index) => <article className="owner-photo-card" key={photo.key}>
        <div className="owner-photo-preview">{previewUrls[photo.key] && <img src={previewUrls[photo.key]} alt={`Pregled odabrane fotografije ${index + 1}`} />}
          {pendingCoverKey === photo.key && <span className="owner-cover-label">Naslovna</span>}</div>
        <p className="owner-photo-name" title={photo.file.name}>{photo.file.name}</p>
        <div className="owner-photo-actions"><button className="button button-ghost button-small" type="button" disabled={blocked || pendingCoverKey === photo.key} onClick={() => onPendingCoverChange(photo.key)}>Postavi za naslovnu</button>
          <div className="owner-photo-secondary"><label className={`text-link ${blocked ? 'owner-disabled' : ''}`} htmlFor={`${inputId}-pending-${photo.key}`}>Zameni<span className="sr-only"> odabranu fotografiju {index + 1}</span></label><input id={`${inputId}-pending-${photo.key}`} className="sr-only" type="file" accept="image/jpeg,image/png" disabled={blocked} onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ''; replacePending(photo.key, file) }} />
            <button className="owner-remove" type="button" disabled={blocked} onClick={() => { const next = pending.filter((item) => item.key !== photo.key); onPendingChange(next); if (pendingCoverKey === photo.key) onPendingCoverChange(next[0]?.key ?? null) }} aria-label={`Ukloni odabranu fotografiju ${index + 1}`}><Icon name="close" size={16} /> Ukloni</button></div></div>
        <div className="owner-photo-order"><span>Fotografija {index + 1}</span><div><button type="button" className="icon-button" disabled={blocked || index === 0} aria-label={`Pomeri fotografiju ${index + 1} ranije`} onClick={() => move(index, -1)}><Icon name="arrow-left" size={15} /></button><button type="button" className="icon-button" disabled={blocked || index === pending.length - 1} aria-label={`Pomeri fotografiju ${index + 1} kasnije`} onClick={() => move(index, 1)}><Icon name="arrow-right" size={15} /></button></div></div>
      </article>) : ordered.map((photo, index) => <article className="owner-photo-card" key={photo.id}>
        <div className="owner-photo-preview"><img src={photo.thumbnailUrl || photo.url} alt={`Fotografija vozila ${index + 1}`} loading="lazy" />{photo.cover && <span className="owner-cover-label">Naslovna</span>}</div>
        <div className="owner-photo-actions"><button className="button button-ghost button-small" type="button" disabled={blocked || photo.cover} onClick={() => cover(photo)}>Postavi za naslovnu</button>
          <div className="owner-photo-secondary"><label className={`text-link ${blocked ? 'owner-disabled' : ''}`} htmlFor={`${inputId}-replace-${photo.id}`}>Zameni<span className="sr-only"> fotografiju {index + 1}</span></label><input id={`${inputId}-replace-${photo.id}`} className="sr-only" type="file" accept="image/jpeg,image/png" disabled={blocked} onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ''; replace(photo.id, file) }} />
            <button className="owner-remove" type="button" disabled={blocked} aria-label={`Ukloni fotografiju ${index + 1}`} onClick={() => { setError(null); setRemoving(photo) }}><Icon name="close" size={15} />Ukloni</button></div></div>
        <div className="owner-photo-order"><span>Fotografija {index + 1}</span><div><button type="button" className="icon-button" disabled={blocked || index === 0} aria-label={`Pomeri fotografiju ${index + 1} ranije`} onClick={() => move(index, -1)}><Icon name="arrow-left" size={15} /></button><button type="button" className="icon-button" disabled={blocked || index === ordered.length - 1} aria-label={`Pomeri fotografiju ${index + 1} kasnije`} onClick={() => move(index, 1)}><Icon name="arrow-right" size={15} /></button></div></div>
      </article>)}
    </div>
    {count === 0 && <p className="owner-empty-photos">Još nema fotografija. Možeš ih dodati i kasnije.</p>}
    {removing && vehicleId !== null && <ConfirmDialog title="Ukloni ovu fotografiju?" description="Fotografija će biti uklonjena iz galerije. Podaci o vozilu i istorija porudžbina ostaju sačuvani."
      confirmLabel="Ukloni fotografiju" busy={busy} error={error} onCancel={() => { setRemoving(null); setError(null) }} onConfirm={() => { void mutate((signal) => deleteVehiclePhoto(accessToken, vehicleId, removing.id, signal), 'Fotografija je uklonjena.') }} />}
    {cropQueue && <PhotoCropDialog key={`${cropQueue.kind}-${cropQueue.index}-${cropQueue.files[cropQueue.index].name}`}
      file={cropQueue.files[cropQueue.index]} photoNumber={cropQueue.index + 1} totalPhotos={cropQueue.files.length}
      onApply={acceptCrop} onCancel={() => setCropQueue(null)} />}
    {uploadSelection && vehicleId !== null && <ConfirmDialog title={uploadSelection.kind === 'add' ? 'Pregled novih fotografija' : 'Pregled zamenske fotografije'} description={uploadSelection.kind === 'add' ? 'Proveri odabrane fotografije. Biće dodate u galeriju tek kada potvrdiš slanje.' : 'Nova fotografija zameniće postojeću tek nakon potvrde. Redosled i izbor naslovne ostaju sačuvani.'}
      confirmLabel={uploadSelection.kind === 'add' ? 'Postavi fotografije' : 'Zameni fotografiju'} busy={busy} error={error} onCancel={() => { setUploadSelection(null); setError(null) }} onConfirm={confirmUpload}>
      <div className="owner-upload-preview-grid">{uploadSelection.files.map((file, index) => <figure key={index}>{uploadPreviews[index] && <img src={uploadPreviews[index]} alt={`Pregled fotografije za slanje ${index + 1}`} />}<figcaption title={file.name}>{file.name}</figcaption></figure>)}</div>
    </ConfirmDialog>}
  </section>
}
