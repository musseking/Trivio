import { request } from './client'
import type { User } from './types'

export function listUsers(accessToken: string, signal?: AbortSignal): Promise<User[]> {
  return request<User[]>('/auth/admin/users', { accessToken, signal })
}

export function setUserEnabled(accessToken: string, id: number, enabled: boolean, signal?: AbortSignal): Promise<User> {
  return request<User>(`/auth/admin/users/${id}/enabled`, { method: 'PUT', accessToken, body: { enabled }, signal })
}

export function deleteUser(accessToken: string, id: number, signal?: AbortSignal): Promise<void> {
  return request<void>(`/auth/admin/users/${id}`, { method: 'DELETE', accessToken, signal })
}
