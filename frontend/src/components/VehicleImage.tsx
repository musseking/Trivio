import { useState } from 'react';
import type { VehiclePhoto } from '../api/types';
import { VehicleVisual } from './VehicleVisual';
import { vehicleMediaUrl } from '../lib/vehicle-photos';
export { coverPhoto, vehicleMediaUrl } from '../lib/vehicle-photos';

export function VehicleImage({ photo, alt, large = false, eager = false }: {
  photo?: VehiclePhoto; alt: string; large?: boolean; eager?: boolean;
}) {
  const main = vehicleMediaUrl(photo?.url);
  const thumbnail = vehicleMediaUrl(photo?.thumbnailUrl);
  const source = large ? main ?? thumbnail : thumbnail ?? main;
  const [failed, setFailed] = useState<string | null>(null);
  if (!source || source === failed) return <VehicleVisual large={large} />;
  return <div className={`vehicle-photo ${large ? 'vehicle-photo-large' : ''}`}>
    <img src={source} alt={alt} loading={eager ? 'eager' : 'lazy'} decoding="async"
      srcSet={main && thumbnail ? `${thumbnail} 640w, ${main} 1800w` : undefined}
      sizes={large ? '(max-width: 920px) 100vw, 820px' : '(max-width: 650px) 100vw, (max-width: 920px) 50vw, 420px'}
      onError={() => setFailed(source)} />
  </div>;
}
