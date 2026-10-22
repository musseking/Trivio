import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ApiError, getErrorMessage, isAbortError } from '../../api/client'
import type { Vehicle } from '../../api/types'
import { archiveVehicle, listManagedVehicles, restoreVehicle } from '../../api/vehicle-management'
import { useAuth } from '../../auth/useAuth'
import { AsyncState } from '../../components/AsyncState'
import { Icon } from '../../components/Icon'
import { StatusBadge } from '../../components/StatusBadge'
import { ConfirmDialog } from '../../components/owner/ConfirmDialog'
import { useAsyncResource } from '../../hooks/useAsyncResource'
import { formatFuel, formatMileage, formatPrice } from '../../lib/format'

export default function OwnerVehiclesPage() {
  const { accessToken, user } = useAuth()
  const loadVehicles = useCallback((signal: AbortSignal) => {
    if (!accessToken || user?.role !== 'OWNER') return Promise.reject(new ApiError(403, 'Ovaj deo je dostupan samo vlasniku ponude.'))
    return listManagedVehicles(accessToken, signal)
  }, [accessToken, user?.role])
  const { data: vehicles, isLoading, error, retry } = useAsyncResource(loadVehicles)
  const [params, setParams] = useSearchParams()
  const [confirming, setConfirming] = useState<Vehicle | null>(null)
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const mountedRef = useRef(true)
  const requestRef = useRef<AbortController | null>(null)
  const busyRef = useRef(false)
  const query = params.get('q') ?? ''
  const brand = params.get('brand') ?? ''
  const status = params.get('status') ?? ''
  const visibility = params.get('visibility') ?? ''
  const sort = params.get('sort') ?? 'newest'
  const brands = [...new Set((vehicles ?? []).map((vehicle) => vehicle.brand))].sort((a, b) => a.localeCompare(b))
  const normalizedQuery = query.trim().toLocaleLowerCase('sr-Latn')
  const filtered = (vehicles ?? []).filter((vehicle) => (!brand || vehicle.brand === brand)
    && (!status || vehicle.status === status)
    && (!visibility || (visibility === 'archived' ? vehicle.archived : !vehicle.archived))
    && `${vehicle.brand} ${vehicle.model} ${vehicle.year} #${vehicle.id}`.toLocaleLowerCase('sr-Latn').includes(normalizedQuery))
    .sort((a, b) => sort === 'price-asc' ? a.price - b.price : sort === 'price-desc' ? b.price - a.price : sort === 'year-desc' ? b.year - a.year : b.id - a.id)
  const hasFilters = Boolean(query || brand || status || visibility)

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false; requestRef.current?.abort() }
  }, [])

  function updateFilter(name: string, value: string) {
    setParams((current) => { const next = new URLSearchParams(current); if (value) next.set(name, value); else next.delete(name); return next }, { replace: true })
  }

  async function changeVisibility() {
    if (!confirming || !accessToken || busyRef.current) return
    busyRef.current = true; setBusy(true); setActionError(null)
    const controller = new AbortController()
    requestRef.current = controller
    try {
      if (confirming.archived) await restoreVehicle(accessToken, confirming.id, controller.signal)
      else await archiveVehicle(accessToken, confirming.id, controller.signal)
      if (!mountedRef.current) return
      setNotice(confirming.archived ? 'Vozilo je vraćeno u ponudu. Njegov poslovni status je sačuvan.' : 'Vozilo je povučeno iz ponude. Podaci i istorija ostaju sačuvani.')
      setConfirming(null); retry()
    } catch (caught) {
      if (mountedRef.current && !isAbortError(caught)) setActionError(caught instanceof ApiError && caught.status === 409
        ? 'Status vozila se promenio ili je vozilo rezervisano. Osveži listu pre sledeće izmene.'
        : `${getErrorMessage(caught)} Posle prekida veze proveri listu pre ponavljanja akcije.`)
    } finally {
      busyRef.current = false
      if (mountedRef.current) setBusy(false)
    }
  }

  return <section className="container owner-page page-space">
    <nav className="breadcrumbs" aria-label="Putanja"><Link to="/">Početna</Link><Icon name="chevron-right" size={14} /><span aria-current="page">Upravljanje ponudom</span></nav>
    <div className="owner-page-heading"><div><p className="eyebrow">TRIVIO / VLASNIČKI PANEL</p><h1 className="page-title">Tvoja ponuda. Pod kontrolom.</h1><p className="page-description">Dodaj automobile, uredi detalje i fotografije ili povuci vozilo iz ponude.</p></div>
      <Link className="button button-primary" to="/owner/automobili/novi">Dodaj automobil<Icon name="arrow-right" size={18} /></Link></div>
    {notice && <p className="form-notice" role="status"><Icon name="check" size={18} />{notice}</p>}
    {!isLoading && !error && vehicles && <div className="owner-summary" aria-label="Pregled ponude">
      <div><Icon name="car" size={24} /><span>Ukupno automobila<strong>{vehicles.length}</strong></span></div>
      <div><Icon name="eye" size={24} /><span>U javnoj ponudi<strong>{vehicles.filter((vehicle) => !vehicle.archived).length}</strong></span></div>
      <div><Icon name="eye-off" size={24} /><span>Povučeno iz ponude<strong>{vehicles.filter((vehicle) => vehicle.archived).length}</strong></span></div>
      <div><Icon name="check-circle" size={24} /><span>Prodato<strong>{vehicles.filter((vehicle) => vehicle.status === 'SOLD').length}</strong></span></div>
    </div>}
    <div className="owner-filters">
      <div className="owner-search"><Icon name="search" size={19} /><input type="search" value={query} onChange={(event) => updateFilter('q', event.target.value)} placeholder="Marka, model, godište ili ID…" aria-label="Pretraži svoju ponudu" maxLength={120} /></div>
      <div><label htmlFor="owner-brand">Marka</label><select id="owner-brand" value={brand} onChange={(event) => updateFilter('brand', event.target.value)}><option value="">Sve marke</option>{brand && !brands.includes(brand) && <option value={brand}>{brand}</option>}{brands.map((item) => <option key={item}>{item}</option>)}</select></div>
      <div><label htmlFor="owner-status">Status vozila</label><select id="owner-status" value={status} onChange={(event) => updateFilter('status', event.target.value)}><option value="">Svi statusi</option><option value="AVAILABLE">Dostupno</option><option value="RESERVED">Rezervisano</option><option value="SOLD">Prodato</option></select></div>
      <div><label htmlFor="owner-visibility">Vidljivost</label><select id="owner-visibility" value={visibility} onChange={(event) => updateFilter('visibility', event.target.value)}><option value="">Sva vozila</option><option value="visible">U ponudi</option><option value="archived">Povučeno</option></select></div>
    </div>
    <div className="owner-results-bar"><p aria-live="polite">{isLoading ? 'Učitavamo ponudu…' : error ? 'Ponuda nije učitana' : <><strong>{filtered.length}</strong> {filtered.length === 1 ? 'automobil' : 'automobila'}</>}{hasFilters && <button type="button" className="text-link" onClick={() => setParams({})}>Poništi filtere<Icon name="close" size={14} /></button>}</p><div><label htmlFor="owner-sort">Poređaj:</label><select id="owner-sort" value={sort} onChange={(event) => updateFilter('sort', event.target.value)}><option value="newest">Najnovije dodato</option><option value="price-asc">Cena: rastuće</option><option value="price-desc">Cena: opadajuće</option><option value="year-desc">Novije godište</option></select></div></div>
    {isLoading ? <AsyncState kind="loading" title="Učitavamo tvoju ponudu…" />
      : error ? <AsyncState kind="error" title="Ponuda nije učitana" description={getErrorMessage(error)} onRetry={retry} />
        : filtered.length === 0 ? <AsyncState kind="empty" title={hasFilters ? 'Nema automobila za ove kriterijume' : 'Prvi automobil čeka svoje mesto'} description={hasFilters ? 'Promeni filtere ili pretragu.' : 'Dodaj podatke i fotografije svog prvog automobila.'} action={hasFilters ? <button type="button" className="button button-secondary" onClick={() => setParams({})}>Prikaži sva vozila</button> : <Link className="button button-primary" to="/owner/automobili/novi">Dodaj automobil<Icon name="arrow-right" size={17} /></Link>} />
          : <div className="owner-vehicle-list">{filtered.map((vehicle) => {
            const cover = vehicle.photos?.find((photo) => photo.cover) ?? vehicle.photos?.[0]
            return <article className="owner-vehicle-row" key={vehicle.id}>
              <Link className="owner-vehicle-thumb" to={`/automobili/${vehicle.id}`} aria-label={`Pogledaj ${vehicle.brand} ${vehicle.model}`}><Icon name="car" size={42} />{cover && <img src={cover.thumbnailUrl || cover.url} alt={`${vehicle.brand} ${vehicle.model}`} loading="lazy" onError={(event) => { event.currentTarget.style.display = 'none' }} />}</Link>
              <div className="owner-vehicle-info"><span className="eyebrow">VOZILO #{vehicle.id}</span><h2><Link to={`/automobili/${vehicle.id}`}>{vehicle.brand} {vehicle.model}</Link></h2><p>{vehicle.year}<span>·</span>{formatMileage(vehicle.mileage)}<span>·</span>{formatFuel(vehicle.fuelType)}</p><div className="owner-row-badges"><StatusBadge status={vehicle.status} /><span className={`owner-visibility ${vehicle.archived ? 'is-archived' : ''}`}><Icon name={vehicle.archived ? 'eye-off' : 'eye'} size={13} />{vehicle.archived ? 'Povučeno' : 'U ponudi'}</span></div></div>
              <strong className="owner-vehicle-price">{formatPrice(vehicle.price)}</strong>
              <div className="owner-row-actions"><Link className="button button-secondary button-small" to={`/owner/automobili/${vehicle.id}/uredi`}>{vehicle.status === 'AVAILABLE' ? 'Uredi vozilo' : 'Fotografije'}<Icon name="arrow-right" size={15} /></Link><button type="button" className="button button-ghost button-small" disabled={vehicle.status === 'RESERVED'} onClick={() => { setActionError(null); setConfirming(vehicle) }} title={vehicle.status === 'RESERVED' ? 'Rezervisano vozilo ne može menjati vidljivost.' : undefined}><Icon name={vehicle.archived ? 'eye' : 'eye-off'} size={15} />{vehicle.archived ? 'Vrati u ponudu' : 'Povuci iz ponude'}</button></div>
            </article>
          })}</div>}
    <p className="session-note"><Icon name="shield" size={16} /> Povlačenje čuva vozilo, fotografije i istoriju. Status rezervacije i prodaje određuje postojeći tok porudžbina.</p>
    {confirming && <ConfirmDialog title={confirming.archived ? 'Vrati automobil u ponudu?' : 'Povuci automobil iz ponude?'} description={confirming.archived ? `${confirming.brand} ${confirming.model} ponovo će biti vidljiv u katalogu. Postojeći status vozila i istorija ostaju sačuvani.` : `${confirming.brand} ${confirming.model} više neće biti prikazan u katalogu. Podaci, fotografije i istorija porudžbina ostaju sačuvani.`} confirmLabel={confirming.archived ? 'Vrati u ponudu' : 'Povuci iz ponude'} busy={busy} error={actionError} onCancel={() => { setConfirming(null); setActionError(null) }} onConfirm={() => { void changeVisibility() }} />}
  </section>
}
