import type { VehiclePhoto } from '../api/types';

export function vehicleMediaUrl(value: string | undefined): string | undefined {
  // Never load an OWNER-supplied external URL or arbitrary private API endpoint as an image.
  return value && /^\/api\/vehicles\/media\/[0-9a-f-]{36}(?:-thumb)?\.jpg$/.test(value) ? value : undefined;
}

export function coverPhoto(photos: VehiclePhoto[] | undefined): VehiclePhoto | undefined {
  return photos?.find((photo) => photo.cover) ?? photos?.slice().sort((a, b) => a.position - b.position)[0];
}
