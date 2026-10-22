import { useState } from 'react';
import type { VehiclePhoto } from '../api/types';
import { VehicleImage, coverPhoto, vehicleMediaUrl } from './VehicleImage';

export function VehicleGallery({ photos, name }: { photos: VehiclePhoto[] | undefined; name: string }) {
  const ordered = photos?.slice().sort((a, b) => a.position - b.position) ?? [];
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const current = ordered.find((photo) => photo.id === selectedId) ?? coverPhoto(ordered);
  return <div className="vehicle-gallery">
    <div className="detail-image"><VehicleImage photo={current} alt={name} large eager />
      {ordered.length > 1 && <span className="gallery-count">{ordered.findIndex((photo) => photo.id === current?.id) + 1} / {ordered.length}</span>}
    </div>
    {ordered.length > 1 && <div className="gallery-thumbnails" aria-label="Fotografije automobila">
      {ordered.map((photo, index) => <button key={photo.id} type="button" className={photo.id === current?.id ? 'is-selected' : ''}
        aria-label={`Prikaži fotografiju ${index + 1} za ${name}`} aria-pressed={photo.id === current?.id} onClick={() => setSelectedId(photo.id)}>
        {vehicleMediaUrl(photo.thumbnailUrl) ? <img src={vehicleMediaUrl(photo.thumbnailUrl)} loading="lazy" decoding="async" alt="" /> : <span>{index + 1}</span>}
      </button>)}
    </div>}
  </div>;
}
