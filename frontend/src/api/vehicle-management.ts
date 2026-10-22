import { ApiError, request } from './client'
import type { Vehicle, VehiclePhoto, VehicleRequest } from './types'

export async function listManagedVehicles(accessToken: string, signal?: AbortSignal): Promise<Vehicle[]> {
  const vehicles = await request<Vehicle[]>('/vehicles/manage', { accessToken, signal })
  if (!Array.isArray(vehicles)) throw new ApiError(502, 'Server je vratio neočekivan odgovor liste vozila.')
  return vehicles
}

export async function getManagedVehicle(accessToken: string, id: number, signal?: AbortSignal): Promise<Vehicle> {
  const vehicles = await listManagedVehicles(accessToken, signal)
  const vehicle = vehicles.find((item) => item.id === id)
  if (!vehicle) throw new ApiError(404, 'Vozilo nije pronađeno u tvojoj ponudi.')
  return vehicle
}

export function createVehicle(accessToken: string, data: VehicleRequest, signal?: AbortSignal): Promise<Vehicle> {
  return request('/vehicles', { method: 'POST', body: data, accessToken, signal })
}

export function updateVehicle(accessToken: string, id: number, data: VehicleRequest, signal?: AbortSignal): Promise<Vehicle> {
  return request(`/vehicles/${id}`, { method: 'PUT', body: data, accessToken, signal })
}

export function archiveVehicle(accessToken: string, id: number, signal?: AbortSignal): Promise<Vehicle> {
  return request(`/vehicles/${id}/archive`, { method: 'POST', accessToken, signal })
}

export function restoreVehicle(accessToken: string, id: number, signal?: AbortSignal): Promise<Vehicle> {
  return request(`/vehicles/${id}/restore`, { method: 'POST', accessToken, signal })
}

async function photoRequest(path: string, options: Parameters<typeof request>[1]): Promise<VehiclePhoto[]> {
  const photos = await request<VehiclePhoto[]>(path, options)
  if (!Array.isArray(photos)) throw new ApiError(502, 'Server je vratio neočekivan odgovor galerije.')
  return photos
}

export function listVehiclePhotos(id: number, signal?: AbortSignal): Promise<VehiclePhoto[]> {
  return photoRequest(`/vehicles/${id}/photos`, { signal })
}

export function uploadVehiclePhotos(accessToken: string, id: number, files: File[], signal?: AbortSignal): Promise<VehiclePhoto[]> {
  const body = new FormData()
  for (const file of files) body.append('files', file)
  return photoRequest(`/vehicles/${id}/photos`, { method: 'POST', body, accessToken, signal, timeoutMs: 60_000 })
}

export function replaceVehiclePhoto(accessToken: string, id: number, photoId: number, file: File, signal?: AbortSignal): Promise<VehiclePhoto[]> {
  const body = new FormData()
  body.append('file', file)
  return photoRequest(`/vehicles/${id}/photos/${photoId}`, { method: 'PUT', body, accessToken, signal, timeoutMs: 60_000 })
}

export function deleteVehiclePhoto(accessToken: string, id: number, photoId: number, signal?: AbortSignal): Promise<VehiclePhoto[]> {
  return photoRequest(`/vehicles/${id}/photos/${photoId}`, { method: 'DELETE', accessToken, signal })
}

export function saveVehiclePhotoOrder(accessToken: string, id: number, data: {
  photoIds: number[]; coverPhotoId: number
}, signal?: AbortSignal): Promise<VehiclePhoto[]> {
  return photoRequest(`/vehicles/${id}/photos/order`, { method: 'PUT', body: data, accessToken, signal })
}
