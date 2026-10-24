import { ApiError, request } from './client'
import type { User } from './types'

export function uploadProfilePhoto(accessToken: string, file: File, signal?: AbortSignal): Promise<User> {
  const body = new FormData()
  body.append('file', file)
  return request<User>('/auth/me/photo', { method: 'PUT', accessToken, body, signal })
}

export function removeProfilePhoto(accessToken: string, signal?: AbortSignal): Promise<User> {
  return request<User>('/auth/me/photo', { method: 'DELETE', accessToken, signal })
}

export async function getProfilePhoto(accessToken: string, id: number, signal?: AbortSignal): Promise<Blob> {
  const blob = await request<Blob>(`/auth/users/${id}/photo`, { accessToken, signal, responseType: 'blob' })
  if (blob.type !== 'image/jpeg' || !blob.size || blob.size > 1024 * 1024) {
    throw new ApiError(502, 'Profilna slika trenutno nije dostupna.')
  }
  return blob
}
