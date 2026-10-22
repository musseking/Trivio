import { useCallback, useEffect, useRef, useState } from 'react'
import type { ChangeEvent, FormEvent, ReactNode } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { ApiError, getErrorMessage, isAbortError } from '../../api/client'
import type { Vehicle, VehiclePhoto, VehicleRequest } from '../../api/types'
import { archiveVehicle, createVehicle, getManagedVehicle, restoreVehicle, saveVehiclePhotoOrder, updateVehicle, uploadVehiclePhotos } from '../../api/vehicle-management'
import { useAuth } from '../../auth/useAuth'
import { AsyncState } from '../../components/AsyncState'
import { Icon } from '../../components/Icon'
import { StatusBadge } from '../../components/StatusBadge'
import { ConfirmDialog } from '../../components/owner/ConfirmDialog'
import { PhotoEditor } from '../../components/owner/PhotoEditor'
import type { StagedPhoto } from '../../components/owner/PhotoEditor'
import { useAsyncResource } from '../../hooks/useAsyncResource'

interface Draft {
  brand: string; model: string; year: string; price: string; mileage: string; fuelType: string
  transmission: string; enginePowerHp: string; color: string; description: string
}
type FieldErrors = Partial<Record<keyof Draft, string>>
const emptyDraft: Draft = { brand: '', model: '', year: '', price: '', mileage: '', fuelType: '', transmission: '', enginePowerHp: '', color: '', description: '' }

function toDraft(vehicle: Vehicle): Draft {
  return { brand: vehicle.brand, model: vehicle.model, year: String(vehicle.year), price: String(vehicle.price), mileage: String(vehicle.mileage), fuelType: vehicle.fuelType,
    transmission: vehicle.transmission ?? '', enginePowerHp: vehicle.enginePowerHp === null || vehicle.enginePowerHp === undefined ? '' : String(vehicle.enginePowerHp), color: vehicle.color ?? '', description: vehicle.description ?? '' }
}

function toRequest(draft: Draft): VehicleRequest {
  return { brand: draft.brand.trim(), model: draft.model.trim(), year: Number(draft.year), price: Number(draft.price.replace(',', '.')), mileage: Number(draft.mileage), fuelType: draft.fuelType.trim(),
    transmission: draft.transmission.trim() || null, enginePowerHp: draft.enginePowerHp.trim() ? Number(draft.enginePowerHp) : null, color: draft.color.trim() || null, description: draft.description.trim() || null }
}

function validate(draft: Draft): FieldErrors {
  const errors: FieldErrors = {}
  if (!draft.brand.trim() || draft.brand.trim().length > 120) errors.brand = 'Unesi marku do 120 znakova.'
  if (!draft.model.trim() || draft.model.trim().length > 120) errors.model = 'Unesi model do 120 znakova.'
  if (!/^\d{4}$/.test(draft.year) || Number(draft.year) < 1950 || Number(draft.year) > 2100) errors.year = 'Godište mora biti između 1950. i 2100.'
  if (!/^\d{1,10}(?:[.,]\d{1,2})?$/.test(draft.price) || Number(draft.price.replace(',', '.')) <= 0 || Number(draft.price.replace(',', '.')) > 9999999999.99) errors.price = 'Unesi pozitivnu cenu u EUR, do 9.999.999.999,99 i najviše dve decimale.'
  if (!/^\d+$/.test(draft.mileage) || Number(draft.mileage) > 10000000) errors.mileage = 'Kilometraža mora biti ceo broj od 0 do 10.000.000.'
  if (!draft.fuelType.trim() || draft.fuelType.trim().length > 80) errors.fuelType = 'Unesi vrstu goriva do 80 znakova.'
  if (draft.transmission.trim().length > 40) errors.transmission = 'Tip menjača može imati najviše 40 znakova.'
  if (draft.enginePowerHp.trim() && (!/^\d+$/.test(draft.enginePowerHp) || Number(draft.enginePowerHp) < 1 || Number(draft.enginePowerHp) > 3000)) errors.enginePowerHp = 'Snaga mora biti ceo broj od 1 do 3.000 KS.'
  if (draft.color.trim().length > 80) errors.color = 'Boja može imati najviše 80 znakova.'
  if (draft.description.length > 6000) errors.description = 'Opis može imati najviše 6.000 znakova.'
  return errors
}

function FormField({ name, label, error, children, hint }: { name: keyof Draft; label: string; error?: string; children: ReactNode; hint?: string }) {
  return <div className="form-field"><label htmlFor={`vehicle-${name}`}>{label}</label>{children}{error ? <p className="field-error" id={`vehicle-${name}-error`}>{error}</p> : hint && <p className="field-hint" id={`vehicle-${name}-hint`}>{hint}</p>}</div>
}

export default function OwnerVehicleFormPage() {
  const { id } = useParams<{ id: string }>()
  const isNew = id === undefined
  const numericId = id && /^\d+$/.test(id) && Number.isSafeInteger(Number(id)) ? Number(id) : null
  const { accessToken, user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const routeNotice = (location.state as { notice?: unknown } | null)?.notice
  const partialSave = (location.state as { partial?: unknown } | null)?.partial === true
  const loader = useCallback((signal: AbortSignal): Promise<Vehicle | null> => {
    if (!accessToken || user?.role !== 'OWNER') return Promise.reject(new ApiError(403, 'Ovaj deo je dostupan samo vlasniku ponude.'))
    if (isNew) return Promise.resolve(null)
    if (!numericId || numericId <= 0) return Promise.reject(new ApiError(404, 'Vozilo nije pronađeno.'))
    return getManagedVehicle(accessToken, numericId, signal)
  }, [accessToken, user?.role, isNew, numericId])
  const { data, isLoading, error: loadError, retry } = useAsyncResource(loader)
  const [vehicle, setVehicle] = useState<Vehicle | null>(null)
  const [draft, setDraft] = useState<Draft>(emptyDraft)
  const [visibility, setVisibility] = useState<'visible' | 'archived'>('visible')
  const [pending, setPending] = useState<StagedPhoto[]>([])
  const [pendingCoverKey, setPendingCoverKey] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveStage, setSaveStage] = useState('')
  const [photoBusy, setPhotoBusy] = useState(false)
  const [confirmVisibility, setConfirmVisibility] = useState(false)
  const [createUncertain, setCreateUncertain] = useState(false)
  const [conflict, setConflict] = useState(false)
  const mountedRef = useRef(true)
  const busyRef = useRef(false)
  const requestRef = useRef<AbortController | null>(null)
  const formRef = useRef<HTMLFormElement>(null)
  const editable = vehicle === null || vehicle.status === 'AVAILABLE'
  const blocked = saving || photoBusy || createUncertain

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false; requestRef.current?.abort() }
  }, [])

  useEffect(() => {
    if (data && data.id === numericId) {
      setVehicle(data); setDraft(toDraft(data)); setVisibility(data.archived ? 'archived' : 'visible')
      setPending([]); setPendingCoverKey(null); setFieldErrors({}); setConflict(false)
    } else if (isNew) {
      setVehicle(null); setDraft(emptyDraft); setVisibility('visible'); setPending([]); setPendingCoverKey(null)
      setFieldErrors({}); setError(null); setNotice(null); setCreateUncertain(false); setConflict(false)
    }
  }, [data, isNew, numericId])

  function fieldProps(name: keyof Draft) {
    return { id: `vehicle-${name}`, name, value: draft[name], onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setDraft((current) => ({ ...current, [name]: event.target.value })),
      'aria-invalid': !!fieldErrors[name], 'aria-describedby': fieldErrors[name] ? `vehicle-${name}-error` : undefined }
  }

  function validateForm(): boolean {
    const errors = editable ? validate(draft) : {}
    setFieldErrors(errors)
    const first = Object.keys(errors)[0]
    if (first) {
      const input = formRef.current?.elements.namedItem(first)
      if (input instanceof HTMLElement) input.focus()
      return false
    }
    return true
  }

  async function saveChanges() {
    if (!accessToken || busyRef.current || blocked || !validateForm()) return
    busyRef.current = true; setSaving(true); setError(null); setNotice(null); setConflict(false)
    const controller = new AbortController()
    requestRef.current = controller
    let saved = vehicle
    let created = false
    const ensureActive = () => { if (!mountedRef.current || controller.signal.aborted) throw new DOMException('Zahtev je otkazan.', 'AbortError') }
    try {
      setSaveStage('Čuvamo podatke o vozilu…')
      if (saved === null) {
        saved = await createVehicle(accessToken, toRequest(draft), controller.signal)
        created = true
        ensureActive()
        // Remember the committed ID before any optional operation can fail.
        setVehicle(saved); setDraft(toDraft(saved))
      } else if (editable && JSON.stringify(toRequest(draft)) !== JSON.stringify(toRequest(toDraft(saved)))) {
        saved = await updateVehicle(accessToken, saved.id, { ...toRequest(draft), version: saved.version }, controller.signal)
        ensureActive()
        setVehicle(saved); setDraft(toDraft(saved))
      }
      if (created && pending.length) {
        setSaveStage('Dodajemo fotografije…')
        let photos = await uploadVehiclePhotos(accessToken, saved.id, pending.map((photo) => photo.file), controller.signal)
        ensureActive()
        photos = [...photos].sort((a, b) => a.position - b.position)
        const coverIndex = Math.max(0, pending.findIndex((photo) => photo.key === pendingCoverKey))
        const coverPhoto = photos[coverIndex]
        if (coverPhoto && !coverPhoto.cover) {
          photos = await saveVehiclePhotoOrder(accessToken, saved.id, { photoIds: photos.map((photo) => photo.id), coverPhotoId: coverPhoto.id }, controller.signal)
          ensureActive()
        }
        saved = { ...saved, photos }; setVehicle(saved); setPending([]); setPendingCoverKey(null)
      }
      const shouldArchive = visibility === 'archived'
      if (shouldArchive !== saved.archived) {
        setSaveStage(shouldArchive ? 'Povlačimo vozilo iz ponude…' : 'Vraćamo vozilo u ponudu…')
        saved = await (shouldArchive ? archiveVehicle(accessToken, saved.id, controller.signal) : restoreVehicle(accessToken, saved.id, controller.signal))
        ensureActive()
      }
      setVehicle(saved); setDraft(toDraft(saved)); setVisibility(saved.archived ? 'archived' : 'visible'); setConfirmVisibility(false)
      const success = created ? 'Automobil je kreiran. Podatke i galeriju možeš dalje uređivati ovde.' : 'Izmene su sačuvane.'
      setNotice(success)
      if (created) navigate(`/owner/automobili/${saved.id}/uredi`, { replace: true, state: { notice: success } })
    } catch (caught) {
      if (!mountedRef.current || isAbortError(caught)) return
      if (created && saved) {
        // A photo or visibility failure must never cause a second create request.
        navigate(`/owner/automobili/${saved.id}/uredi`, { replace: true, state: { partial: true, notice: `Vozilo #${saved.id} je kreirano, ali sve dodatne izmene nisu potvrđene. ${getErrorMessage(caught)} Proveri fotografije i vidljivost pre ponavljanja tih izmena.` } })
      } else {
        if (!saved && caught instanceof ApiError && (caught.status === 0 || caught.status >= 500)) setCreateUncertain(true)
        if (caught instanceof ApiError && caught.status === 409) { setConflict(true); setError('Podaci ili status vozila su se promenili. Ponovo učitaj vozilo i proveri izmene pre čuvanja.') }
        else setError(!saved && caught instanceof ApiError && (caught.status === 0 || caught.status >= 500)
          ? 'Nije potvrđeno da li je vozilo kreirano. Proveri listu automobila pre novog pokušaja, da ne napraviš duplikat.'
          : `${getErrorMessage(caught)} Već sačuvani podaci ostaju sačuvani. Proveri trenutno stanje pre ponavljanja izmene.`)
        if (caught instanceof ApiError && caught.fieldErrors.length) {
          const errors: FieldErrors = {}
          for (const name of caught.fieldErrors) if (name in emptyDraft) errors[name as keyof Draft] = 'Proveri vrednost ovog polja.'
          setFieldErrors(errors)
        }
      }
    } finally {
      busyRef.current = false
      if (mountedRef.current) { setSaving(false); setSaveStage('') }
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (blocked || !validateForm()) return
    if ((visibility === 'archived') !== Boolean(vehicle?.archived)) setConfirmVisibility(true)
    else void saveChanges()
  }

  function updatePhotos(photos: VehiclePhoto[]) {
    setVehicle((current) => current ? { ...current, photos } : current)
  }

  if (isLoading || (!isNew && !loadError && (!vehicle || vehicle.id !== numericId))) return <section className="container owner-page page-space"><AsyncState kind="loading" title="Pripremamo podatke o vozilu…" /></section>
  if (loadError) return <section className="container owner-page page-space"><AsyncState kind="error" title="Vozilo nije učitano" description={getErrorMessage(loadError)} onRetry={retry} action={<Link className="text-link" to="/owner/automobili">Nazad na ponudu</Link>} /></section>
  if (!accessToken || user?.role !== 'OWNER') return <section className="container owner-page page-space"><AsyncState kind="error" title="Pristup nije dozvoljen" description="Ovaj deo je dostupan samo vlasniku ponude." /></section>

  return <section className="container owner-page owner-editor-page page-space">
    <nav className="breadcrumbs" aria-label="Putanja"><Link to="/owner/automobili">Upravljanje ponudom</Link><Icon name="chevron-right" size={14} /><span aria-current="page">{vehicle ? `${vehicle.brand} ${vehicle.model}` : 'Novi automobil'}</span></nav>
    <div className="owner-page-heading"><div><p className="eyebrow">TRIVIO / {vehicle ? `VOZILO #${vehicle.id}` : 'NOVI AUTOMOBIL'}</p><h1 className="page-title">{vehicle ? editable ? 'Uredi priču ovog automobila.' : 'Detalji i fotografije vozila.' : 'Nova prilika za dobru vožnju.'}</h1><p className="page-description">{vehicle ? 'Podaci, fotografije i vidljivost na jednom mestu.' : 'Dodaj automobil u svoju ponudu. Fotografije možeš dodati sada ili kasnije.'}</p></div><Link className="button button-secondary" to="/owner/automobili"><Icon name="arrow-left" size={17} />Nazad na ponudu</Link></div>
    {(notice || typeof routeNotice === 'string') && <p className={partialSave && !notice ? 'form-error' : 'form-notice'} role={partialSave && !notice ? 'alert' : 'status'}><Icon name={partialSave && !notice ? 'alert' : 'check'} size={18} />{notice || String(routeNotice)}</p>}
    {error && <div className="form-error" role="alert"><Icon name="alert" size={18} /><div>{error}{createUncertain && <p><Link className="text-link" to="/owner/automobili">Proveri listu automobila<Icon name="arrow-right" size={15} /></Link></p>}{conflict && <p><button className="text-link owner-inline-button" type="button" disabled={saving} onClick={() => { setError(null); setConfirmVisibility(false); retry() }}>Ponovo učitaj i odbaci lokalne izmene<Icon name="refresh" size={15} /></button></p>}</div></div>}
    <div className="owner-editor-grid"><div className="owner-editor-main">
      <form ref={formRef} id="owner-vehicle-form" className="owner-panel" onSubmit={handleSubmit} noValidate aria-busy={saving}>
        <div className="owner-panel-heading"><div><p className="eyebrow">OSNOVNI PODACI</p><h2>Predstavi automobil</h2></div><Icon name="car" size={27} /></div>
        {!editable && <p className="form-notice"><Icon name="lock" size={18} />Osnovni podaci rezervisanog ili prodatog vozila su zaključani. Fotografije možeš održavati zasebno.</p>}
        <fieldset disabled={saving || !editable || createUncertain} className="owner-fieldset"><div className="form-grid">
          <FormField name="brand" label="Marka *" error={fieldErrors.brand}><input {...fieldProps('brand')} required maxLength={120} placeholder="Unesi marku" autoComplete="off" /></FormField>
          <FormField name="model" label="Model *" error={fieldErrors.model}><input {...fieldProps('model')} required maxLength={120} placeholder="Unesi model" autoComplete="off" /></FormField>
          <FormField name="year" label="Godište *" error={fieldErrors.year}><input {...fieldProps('year')} type="number" min={1950} max={2100} step={1} required placeholder="npr. 2021" /></FormField>
          <FormField name="price" label="Cena (EUR) *" error={fieldErrors.price}><input {...fieldProps('price')} inputMode="decimal" required placeholder="npr. 18500,00" /></FormField>
          <FormField name="mileage" label="Kilometraža (km) *" error={fieldErrors.mileage}><input {...fieldProps('mileage')} type="number" min={0} max={10000000} step={1} required placeholder="npr. 45000" /></FormField>
          <FormField name="fuelType" label="Gorivo *" error={fieldErrors.fuelType}><input {...fieldProps('fuelType')} list="owner-fuel-options" required maxLength={80} placeholder="Unesi ili izaberi vrstu goriva" /><datalist id="owner-fuel-options"><option value="Benzin" /><option value="Dizel" /><option value="Hibrid" /><option value="Električni" /><option value="TNG" /></datalist></FormField>
          <FormField name="transmission" label="Menjač" error={fieldErrors.transmission}><input {...fieldProps('transmission')} list="owner-transmission-options" maxLength={40} placeholder="Unesi ili izaberi menjač" /><datalist id="owner-transmission-options"><option value="Manuelni" /><option value="Automatski" /></datalist></FormField>
          <FormField name="enginePowerHp" label="Snaga motora (KS)" error={fieldErrors.enginePowerHp}><input {...fieldProps('enginePowerHp')} type="number" min={1} max={3000} step={1} placeholder="npr. 150" /></FormField>
          <FormField name="color" label="Boja" error={fieldErrors.color}><input {...fieldProps('color')} maxLength={80} placeholder="npr. Tamnosiva metalik" /></FormField>
        </div><FormField name="description" label="Opis automobila" error={fieldErrors.description}><textarea {...fieldProps('description')} rows={6} maxLength={6000} placeholder="Oprema, održavanje i detalji koji će kupcu značiti…" /></FormField><p className="owner-character-count">{draft.description.length}/6.000 znakova</p><p className="owner-help">* Obavezna polja. Marku i model unosiš slobodno, bez ograničavanja na unapred izabrane automobile.</p></fieldset>
      </form>
      <PhotoEditor accessToken={accessToken} vehicleId={vehicle?.id ?? null} photos={vehicle?.photos ?? []} onPhotosChange={updatePhotos} pending={pending} onPendingChange={setPending} pendingCoverKey={pendingCoverKey} onPendingCoverChange={setPendingCoverKey} disabled={saving || createUncertain} onBusyChange={setPhotoBusy} />
    </div><aside className="owner-editor-sidebar"><section className="owner-panel owner-publish-panel"><p className="eyebrow">STATUS I VIDLJIVOST</p><h2>Spremno za ponudu?</h2>
      <div className="owner-current-status"><span>Status vozila</span>{vehicle ? <StatusBadge status={vehicle.status} /> : <span className="status-badge status-available">Novo vozilo</span>}</div>
      <p className="owner-help">Rezervaciju i prodaju vodi tok porudžbina. Ovde uređuješ samo vidljivost u katalogu.</p>
      <div className="form-field"><label htmlFor="vehicle-visibility">Dostupnost u ponudi</label><select id="vehicle-visibility" form="owner-vehicle-form" value={visibility} disabled={blocked || vehicle?.status === 'RESERVED'} onChange={(event) => setVisibility(event.target.value as 'visible' | 'archived')}><option value="visible">Dostupno u ponudi</option><option value="archived">Povučeno iz ponude</option></select></div>
      <p className="owner-help">{vehicle?.status === 'RESERVED' ? 'Vidljivost rezervisanog vozila je zaključana.' : visibility === 'archived' ? 'Vozilo neće biti prikazano u katalogu. Podaci, fotografije i istorija ostaju sačuvani.' : 'Vozilo je vidljivo u javnom katalogu, uz svoj stvarni status.'}</p>
      <button className="button button-primary button-full" type="submit" form="owner-vehicle-form" disabled={blocked}>{saving ? 'Čuvanje…' : vehicle ? 'Sačuvaj izmene' : 'Sačuvaj automobil'}<Icon name="check" size={17} /></button>
      {saveStage && <p className="owner-save-stage" role="status">{saveStage}</p>}
      <Link className="button button-ghost button-full" to="/owner/automobili">Nazad na ponudu</Link>
      {vehicle && <Link className="text-link" to={`/automobili/${vehicle.id}`}>Pogledaj stranicu vozila<Icon name="arrow-up-right" size={15} /></Link>}
    </section><div className="owner-guidance"><Icon name="shield" size={21} /><div><strong>Svaki detalj ostaje sačuvan.</strong><p>Povlačenje vozila čuva istoriju i omogućava kasnije vraćanje u ponudu.</p></div></div></aside></div>
    {confirmVisibility && <ConfirmDialog title={visibility === 'archived' ? 'Sačuvaj vozilo povučeno iz ponude?' : 'Vrati vozilo u javnu ponudu?'} description={visibility === 'archived' ? 'Vozilo neće biti vidljivo u katalogu. Podaci, fotografije, poslovni status i istorija porudžbina ostaju sačuvani.' : 'Vozilo će ponovo biti vidljivo u katalogu. Njegov postojeći poslovni status ostaje sačuvan.'} confirmLabel="Sačuvaj izmene" busy={saving} error={error} onCancel={() => setConfirmVisibility(false)} onConfirm={() => { void saveChanges() }} />}
  </section>
}
