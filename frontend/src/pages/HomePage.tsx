import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, createSearchParams, useNavigate } from 'react-router-dom';
import { listVehicles } from '../api/vehicles';
import { getErrorMessage } from '../api/client';
import { useAsyncResource } from '../hooks/useAsyncResource';
import { AsyncState } from '../components/AsyncState';
import { Icon } from '../components/Icon';
import { VehicleCard } from '../components/VehicleCard';

export default function HomePage() {
  const { data: vehicles, isLoading, error, retry } = useAsyncResource(listVehicles);
  const [brand, setBrand] = useState('');
  const [query, setQuery] = useState('');
  const navigate = useNavigate();
  const brands = [...new Set(vehicles?.map((vehicle) => vehicle.brand) ?? [])].sort((a, b) => a.localeCompare(b));
  const available = vehicles?.filter((vehicle) => vehicle.status === 'AVAILABLE') ?? [];
  const featured = (available.length > 0 ? available : vehicles ?? []).slice(0, 3);
  const search = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const params: Record<string, string> = {};
    if (brand) params.brand = brand;
    if (query.trim()) params.q = query.trim();
    navigate({ pathname: '/automobili', search: createSearchParams(params).toString() });
  };

  return <>
    <section className="home-hero container" aria-labelledby="hero-title">
      <div className="hero-scene">
        <img className="hero-image" src="/images/hero-drive.jpg" width="1672" height="941" alt="" fetchPriority="high" />
        <div className="hero-shade" />
        <div className="hero-content">
          <span className="eyebrow hero-eyebrow"><span />DOBRO DOŠLI U TRIVIO</span>
          <h1 id="hero-title">Sledeće poglavlje.<br /><span>Novi kilometri.</span></h1>
          <p>Pronađi automobil koji prati tvoj ritam.<br className="desktop-break" /> Od prvog pogleda do novih puteva.</p>
          <Link className="button button-light" to="/automobili">Istraži automobile<Icon name="arrow-up-right" size={20} /></Link>
        </div>
        <div className="hero-bottom"><span><Icon name="road" size={17} />Tvoj put počinje ovde.</span><small>Dekorativna ilustracija</small></div>
        <span className="hero-corner" aria-hidden="true">01 / TRIVIO</span>
      </div>
      <form className="home-search" onSubmit={search} aria-label="Pretraga automobila">
        <div className="home-search-intro"><span className="search-symbol"><Icon name="search" size={22} /></span><div><strong>Šta te pokreće?</strong><span>Pronađi svoj sledeći automobil.</span></div></div>
        <div className="home-search-field"><label htmlFor="home-brand">Marka automobila</label><select id="home-brand" value={brand} onChange={(event) => setBrand(event.target.value)}><option value="">Sve marke</option>{brands.map((item) => <option key={item}>{item}</option>)}</select></div>
        <div className="home-search-field"><label htmlFor="home-query">Model ili ključna reč</label><input id="home-query" placeholder="Šta želiš da voziš?" value={query} onChange={(event) => setQuery(event.target.value)} maxLength={100} /></div>
        <button className="button button-primary" type="submit">Pretraži ponudu<Icon name="arrow-right" size={19} /></button>
      </form>
    </section>

    <section className="container section-block" aria-labelledby="featured-title">
      <div className="section-heading"><div><span className="eyebrow">TVOJ SLEDEĆI IZBOR</span><h2 id="featured-title">Vredi ih pogledati.</h2></div><Link className="text-link" to="/automobili">Pogledaj celu ponudu<Icon name="arrow-right" size={18} /></Link></div>
      {isLoading ? <AsyncState kind="loading" title="Pripremamo ponudu…" description="Još trenutak do tvog sledećeg izbora." />
        : error ? <AsyncState kind="error" title="Ponuda trenutno nije dostupna" description={getErrorMessage(error)} onRetry={retry} />
        : featured.length === 0 ? <AsyncState kind="empty" title="Novi automobili su na putu" description="Trenutno nema vozila u ponudi. Svrati ponovo kasnije." />
        : <div className="vehicle-grid">{featured.map((vehicle) => <VehicleCard key={vehicle.id} vehicle={vehicle} />)}</div>}
    </section>

    <section className="journey-section"><div className="container">
      <div className="section-heading"><div><span className="eyebrow">JEDNOSTAVNO. PREGLEDNO. TVOJE.</span><h2>Sve počinje dobrim izborom.</h2></div><p className="section-description">Manje traganja, više mogućnosti.<br />Na jednom mestu, u tvom ritmu.</p></div>
      <div className="journey-grid">
        <article><span className="journey-icon"><Icon name="search" size={25} /></span><span className="step-number">01</span><h3>Istraži ponudu</h3><p>Pretraži automobile po marki, ceni i karakteristikama koje su tebi važne.</p></article>
        <article><span className="journey-icon"><Icon name="car" size={25} /></span><span className="step-number">02</span><h3>Upoznaj svaki detalj</h3><p>Uporedi godište, kilometražu, gorivo i cenu. Napravi izbor sa svim podacima pred sobom.</p></article>
        <article><span className="journey-icon"><Icon name="package" size={25} /></span><span className="step-number">03</span><h3>Ostani u toku</h3><p>Prijavi se i prati status svojih porudžbina u ličnom pregledu.</p></article>
      </div>
    </div></section>
    <section className="container home-cta"><div><span className="eyebrow">ZA PUTEVE KOJI DOLAZE</span><h2>Tvoj sledeći automobil<br />je dobar početak.</h2></div><Link className="button button-light" to="/automobili">Pronađi svoj automobil<Icon name="arrow-up-right" size={20} /></Link><Icon name="road" size={210} className="cta-road" /></section>
  </>;
}
