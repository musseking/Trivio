import { useEffect, useState } from 'react';
import type { VehiclePhoto } from '../api/types';
import { VehicleImage, coverPhoto, vehicleMediaUrl } from './VehicleImage';
import { Icon } from './Icon';
import photoCredits from '../data/catalog-photo-credits.json';

type PhotoCredit = { title: string; author: string; source: string; license: string; licenseUrl: string; changes: string };

export function VehicleGallery({ photos, name }: { photos: VehiclePhoto[] | undefined; name: string }) {
  const ordered = photos?.slice().sort((a, b) => a.position - b.position) ?? [];
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const current = ordered.find((photo) => photo.id === selectedId) ?? coverPhoto(ordered);
  const currentIndex = ordered.findIndex((photo) => photo.id === current?.id);
  const [creditState, setCreditState] = useState<{ url: string; credit: PhotoCredit | undefined } | null>(null);
  const currentUrl = vehicleMediaUrl(current?.url);
  // Attribute the actual licensed image bytes, so OWNER replacements never inherit an old credit.
  // Content hashes also keep installation-specific database IDs and media UUIDs out of source files.
  useEffect(() => {
    if (!currentUrl) return;
    const controller = new AbortController();
    void fetch(currentUrl, { signal: controller.signal, credentials: 'omit', redirect: 'error' })
      .then(async (response) => {
        if (!response.ok) return;
        const hash = await crypto.subtle.digest('SHA-256', await response.arrayBuffer());
        if (controller.signal.aborted) return;
        const key = Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, '0')).join('');
        setCreditState({ url: currentUrl, credit: (photoCredits as Record<string, PhotoCredit>)[key] });
      }).catch(() => { /* Photo rendering remains independent of optional attribution lookup. */ });
    return () => controller.abort();
  }, [currentUrl]);
  const credit = creditState?.url === currentUrl ? creditState?.credit : undefined;
  const move = (offset: number) => setSelectedId(ordered[(currentIndex + offset + ordered.length) % ordered.length].id);
  return <div className="vehicle-gallery">
    <div className="detail-image" role="region" aria-label={`Galerija: ${name}`} tabIndex={ordered.length > 1 ? 0 : undefined}
      onKeyDown={(event) => { if (ordered.length > 1 && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) { event.preventDefault(); move(event.key === 'ArrowLeft' ? -1 : 1); } }}>
      <VehicleImage photo={current} alt={`${name}${ordered.length ? ` — fotografija ${currentIndex + 1}` : ''}`} large eager />
      {ordered.length > 1 && <>
        <button className="gallery-arrow gallery-previous" type="button" aria-label="Prethodna fotografija" onClick={() => move(-1)}><Icon name="arrow-left" size={20} /></button>
        <button className="gallery-arrow gallery-next" type="button" aria-label="Sledeća fotografija" onClick={() => move(1)}><Icon name="chevron-right" size={20} /></button>
        <span className="gallery-count" aria-live="polite">{currentIndex + 1} / {ordered.length}</span>
      </>}
    </div>
    {ordered.length > 1 && <div className="gallery-thumbnails" aria-label="Fotografije automobila">
      {ordered.map((photo, index) => <button key={photo.id} type="button" className={photo.id === current?.id ? 'is-selected' : ''}
        aria-label={`Prikaži fotografiju ${index + 1} za ${name}`} aria-pressed={photo.id === current?.id} onClick={() => setSelectedId(photo.id)}>
        {vehicleMediaUrl(photo.thumbnailUrl) ? <img src={vehicleMediaUrl(photo.thumbnailUrl)} loading="lazy" decoding="async" alt="" /> : <span>{index + 1}</span>}
      </button>)}
    </div>}
    {credit && <details className="gallery-credit"><summary>Izvor i licenca fotografije</summary><p>
      <a href={credit.source} target="_blank" rel="noreferrer">{credit.title}</a> — {credit.author}.{' '}
      <a href={credit.licenseUrl} target="_blank" rel="noreferrer">{credit.license}</a>. {credit.changes}
    </p><p>Ilustracija modela u demonstracionoj ponudi; prikazana oprema i boja mogu se razlikovati između kadrova.</p></details>}
  </div>;
}
