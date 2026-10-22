import { ApiError, request } from './client'
import type { Vehicle } from './types'

export async function listVehicles(signal?: AbortSignal): Promise<Vehicle[]> {
  const vehicles = await request<Vehicle[]>('/vehicles', { signal })
  if (!Array.isArray(vehicles)) throw new ApiError(502, 'Server je vratio neočekivan odgovor kataloga.')
  return vehicles
}

export function getVehicle(id: string | number, signal?: AbortSignal): Promise<Vehicle> {
  return request<Vehicle>(`/vehicles/${encodeURIComponent(String(id))}`, { signal })
}
