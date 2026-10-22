import { Link, useSearchParams } from 'react-router-dom';
import { listVehicles } from '../api/vehicles';
import { getErrorMessage } from '../api/client';
import { useAsyncResource } from '../hooks/useAsyncResource';
import { AsyncState } from '../components/AsyncState';
import { Icon } from '../components/Icon';
import { VehicleCard } from '../components/VehicleCard';

export default function CatalogPage() {
  const { data: vehicles, isLoading, error, retry } = useAsyncResource(listVehicles);
  const [params, setParams] = useSearchParams();
  const query = params.get('q') ?? '';
  const brand = params.get('brand') ?? '';
  const status = params.get('status') ?? '';
  const sort = params.get('sort') ?? 'newest';
  const brands = [...new Set(vehicles?.map((vehicle) => vehicle.brand) ?? [])].sort((a, b) => a.localeCompare(b));
  const update = (name: string, value: string) => {
    setParams((current) => { const next = new URLSearchParams(current); if (value) next.set(name, value); else next.delete(name); return next; }, { replace: true });
  };
  const normalizedQuery = query.trim().toLocaleLowerCase('sr-Latn');
  const filtered = (vehicles ?? []).filter((vehicle) =>
    (!brand || vehicle.brand === brand) && (!status || vehicle.status === status)
    && `${vehicle.brand} ${vehicle.model} ${vehicle.year} ${vehicle.fuelType}`.toLocaleLowerCase('sr-Latn').includes(normalizedQuery),
  ).sort((a, b) => sort === 'price-asc' ? a.price - b.price : sort === 'price-desc' ? b.price - a.price : sort === 'year-desc' ? b.year - a.year : b.id - a.id);
  const hasFilters = Boolean(query || brand || status);

  return <div className="container catalog-page page-space">
    <nav className="breadcrumbs" aria-label="Putanja"><Link to="/">Početna</Link><Icon name="chevron-right" size={14} /><span aria-current="page">Automobili</span></nav>
    <div className="page-intro catalog-intro"><span className="eyebrow">TRIVIO PONUDA</span><h1 className="page-title">Koji je tvoj sledeći?</h1><p className="page-description">Od svakodnevnih vožnji do velikih planova.<br />Pronađi automobil koji se uklapa u tvoj život.</p></div>
    <div className="catalog-toolbar">
      <div className="catalog-search"><Icon name="search" size={20} /><input type="search" aria-label="Pretraži marku ili model" placeholder="Pretraži marku, model ili godište…" value={query} onChange={(event) => update('q', event.target.value)} maxLength={100} /></div>
      <div className="catalog-filter"><label htmlFor="catalog-brand">Marka</label><select id="catalog-brand" value={brand} onChange={(event) => update('brand', event.target.value)}><option value="">Sve marke</option>{brand && !brands.includes(brand) && <option value={brand}>{brand}</option>}{brands.map((item) => <option key={item}>{item}</option>)}</select></div>
      <div className="catalog-filter"><label htmlFor="catalog-status">Dostupnost</label><select id="catalog-status" value={status} onChange={(event) => update('status', event.target.value)}><option value="">Svi automobili</option><option value="AVAILABLE">Dostupno</option><option value="RESERVED">Rezervisano</option><option value="SOLD">Prodato</option></select></div>
    </div>
    <div className="catalog-results-bar"><p aria-live="polite">{isLoading ? 'Učitavamo ponudu…' : error ? 'Ponuda nije učitana' : <><strong>{filtered.length}</strong> {filtered.length === 1 ? 'automobil u ponudi' : 'automobila u ponudi'}</>}{hasFilters && <button className="clear-filters" type="button" onClick={() => setParams({})}>Poništi filtere<Icon name="close" size={14} /></button>}</p><div className="sort-control"><label htmlFor="catalog-sort">Poređaj:</label><select id="catalog-sort" value={sort} onChange={(event) => update('sort', event.target.value)}><option value="newest">Najnovije dodato</option><option value="price-asc">Cena: rastuće</option><option value="price-desc">Cena: opadajuće</option><option value="year-desc">Novije godište</option></select></div></div>
    {isLoading ? <AsyncState kind="loading" title="Tražimo tvoju sledeću vožnju…" description="Učitavamo aktuelnu ponudu automobila." />
      : error ? <AsyncState kind="error" title="Nismo uspeli da učitamo automobile" description={getErrorMessage(error)} onRetry={retry} />
      : filtered.length === 0 ? <AsyncState kind="empty" title={hasFilters ? 'Još nema tog savršenog spoja' : 'Ponuda je trenutno prazna'} description={hasFilters ? 'Promeni kriterijume i pogledaj ostale automobile iz ponude.' : 'Novi automobili će se pojaviti ovde kada budu dodati.'} action={hasFilters ? <button className="button button-secondary" type="button" onClick={() => setParams({})}>Prikaži sve automobile<Icon name="arrow-right" size={17} /></button> : undefined} />
      : <div className="vehicle-grid">{filtered.map((vehicle) => <VehicleCard vehicle={vehicle} key={vehicle.id} />)}</div>}
    <div className="catalog-footnote"><Icon name="info" size={17} /><span>Dostupnost svakog automobila prikazana je uz njegovu ponudu.</span></div>
  </div>;
}
