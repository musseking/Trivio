import { useCallback } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { getVehicle } from '../api/vehicles';
import { ApiError, getErrorMessage } from '../api/client';
import { useAuth } from '../auth/useAuth';
import { useAsyncResource } from '../hooks/useAsyncResource';
import { formatFuel, formatMileage, formatPrice } from '../lib/format';
import { AsyncState } from '../components/AsyncState';
import { Icon } from '../components/Icon';
import { StatusBadge } from '../components/StatusBadge';
import { VehicleGallery } from '../components/VehicleGallery';

export default function VehicleDetailPage() {
  const { id = '' } = useParams();
  const location = useLocation();
  const returnTo = (location.state as { catalogReturnTo?: unknown } | null)?.catalogReturnTo;
  const catalogLink = typeof returnTo === 'string' && /^\/automobili(?:\?[^#]*)?$/.test(returnTo) ? returnTo : '/automobili';
  const { isAuthenticated } = useAuth();
  const loader = useCallback((signal: AbortSignal) => {
    if (!/^[1-9]\d*$/.test(id)) return Promise.reject(new ApiError(404, 'Automobil nije pronađen.'));
    return getVehicle(id, signal);
  }, [id]);
  const { data: vehicle, isLoading, error, retry } = useAsyncResource(loader);

  return <div className="container detail-page page-space">
    <Link className="detail-return" to={catalogLink} aria-label="Nazad na listu automobila" title="Nazad na listu automobila"><Icon name="arrow-left" size={22} /><span>Nazad na ponudu</span></Link>
    <nav className="breadcrumbs" aria-label="Putanja"><Link to="/">Početna</Link><Icon name="chevron-right" size={14} /><Link to={catalogLink}>Automobili</Link><Icon name="chevron-right" size={14} /><span aria-current="page">{vehicle ? `${vehicle.brand} ${vehicle.model}` : 'Detalji vozila'}</span></nav>
    {isLoading ? <AsyncState kind="loading" title="Učitavamo detalje automobila…" />
      : error ? <AsyncState kind="error" title={error instanceof ApiError && error.status === 404 ? 'Ovaj automobil nije pronađen' : 'Detalji trenutno nisu dostupni'} description={getErrorMessage(error)} onRetry={error instanceof ApiError && error.status === 404 ? undefined : retry} action={<Link className="button button-secondary" to="/automobili"><Icon name="arrow-left" size={17} />Nazad na ponudu</Link>} />
      : vehicle && <>
        <div className="detail-heading"><div><span className="eyebrow">{vehicle.brand}</span><h1 className="page-title">{vehicle.brand} {vehicle.model}</h1><p className="detail-subtitle">{vehicle.year}. <span>·</span> {formatMileage(vehicle.mileage)} <span>·</span> {formatFuel(vehicle.fuelType)}</p></div><div className="detail-badges"><StatusBadge status={vehicle.status} />{vehicle.archived && <span className="status-badge status-withdrawn">Povučeno iz ponude</span>}</div></div>
        {vehicle.archived && <p className="withdrawn-notice"><Icon name="info" size={19} />Ovaj automobil je povučen iz javne ponude. Detalji su sačuvani radi pregleda prethodnih porudžbina.</p>}
        <div className="detail-grid"><div className="detail-primary">
          <VehicleGallery photos={vehicle.photos} name={`${vehicle.brand} ${vehicle.model}`} />
          <section className="vehicle-facts" aria-labelledby="vehicle-facts-title"><span className="eyebrow">UPOZNAJ AUTOMOBIL</span><h2 id="vehicle-facts-title">Dobar izbor počinje detaljima.</h2>
            <dl className="facts-grid">
              <div><Icon name="car" size={22} /><dt>Marka</dt><dd>{vehicle.brand}</dd></div>
              <div><Icon name="car" size={22} /><dt>Model</dt><dd>{vehicle.model}</dd></div>
              <div><Icon name="calendar" size={22} /><dt>Godište</dt><dd>{vehicle.year}.</dd></div>
              <div><Icon name="gauge" size={22} /><dt>Kilometraža</dt><dd>{formatMileage(vehicle.mileage)}</dd></div>
              <div><Icon name="fuel" size={22} /><dt>Vrsta goriva</dt><dd>{formatFuel(vehicle.fuelType)}</dd></div>
              {vehicle.transmission && <div><Icon name="grid" size={22} /><dt>Menjač</dt><dd>{vehicle.transmission}</dd></div>}
              {vehicle.enginePowerHp != null && <div><Icon name="gauge" size={22} /><dt>Snaga motora</dt><dd>{vehicle.enginePowerHp} KS</dd></div>}
              {vehicle.color && <div><Icon name="car" size={22} /><dt>Boja</dt><dd>{vehicle.color}</dd></div>}
              <div><Icon name="grid" size={22} /><dt>Oznaka vozila</dt><dd>#{vehicle.id}</dd></div>
            </dl>
          </section>
          {vehicle.description && <section className="vehicle-description" aria-labelledby="vehicle-description-title"><span className="eyebrow">VIŠE O AUTOMOBILU</span><h2 id="vehicle-description-title">Opis automobila</h2><p>{vehicle.description}</p></section>}
        </div><aside className="detail-sidebar">
          <div className="price-card"><span className="eyebrow">CENA AUTOMOBILA</span><p className="detail-price">{formatPrice(vehicle.price)}</p><div className="price-card-divider" /><div className="availability-note"><Icon name={!vehicle.archived && vehicle.status === 'AVAILABLE' ? 'check-circle' : 'clock'} size={22} /><div><strong>{vehicle.archived ? 'Povučen iz ponude' : vehicle.status === 'AVAILABLE' ? 'Dostupan u ponudi' : vehicle.status === 'RESERVED' ? 'Automobil je rezervisan' : 'Automobil je prodat'}</strong><p>{!vehicle.archived && vehicle.status === 'AVAILABLE' ? 'Pogledaj sve karakteristike pre svog izbora.' : 'Pogledaj i ostale automobile iz naše ponude.'}</p></div></div><Link className="button button-primary button-full" to="/automobili">Istraži ostale automobile<Icon name="arrow-right" size={18} /></Link></div>
          <div className="account-callout"><span className="account-callout-icon"><Icon name="user" size={23} /></span><h3>Tvoj prostor za pregled.</h3><p>Prati postojeće porudžbine i njihove statuse na svom Trivio nalogu.</p><Link className="text-link" to={isAuthenticated ? '/porudzbine' : '/prijava'}>{isAuthenticated ? 'Moje porudžbine' : 'Prijavi se'}<Icon name="arrow-right" size={17} /></Link></div>
        </aside></div>
        <Link className="text-link detail-back" to={catalogLink}><Icon name="arrow-left" size={18} />Nazad na sve automobile</Link>
      </>}
  </div>;
}
