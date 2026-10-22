import { ApiError, request } from './client'
import type { LoginRequest, OwnerSetupRequest, OwnerSetupStatus, RegisterRequest, TokenResponse, User } from './types'

/** Fail closed if the setup endpoint is down or returns an unknown response. */
export async function getOwnerSetupStatus(signal?: AbortSignal): Promise<OwnerSetupStatus> {
  const status = await request<OwnerSetupStatus>('/auth/setup/status', { signal, timeoutMs: 10_000 })
  if (!status || typeof status.setupAvailable !== 'boolean') {
    throw new ApiError(502, 'Server je vratio neispravan status početnog podešavanja.')
  }
  return status
}

export async function createFirstOwner(data: OwnerSetupRequest, signal?: AbortSignal): Promise<User> {
  const owner = await request<User>('/auth/setup/owner', { method: 'POST', body: data, signal })
  if (!owner || owner.role !== 'OWNER' || owner.enabled !== true || !Number.isSafeInteger(owner.id) || owner.id <= 0) {
    throw new ApiError(502, 'Server nije potvrdio kreiranje vlasničkog naloga.')
  }
  return owner
}

export function registerAccount(data: RegisterRequest, signal?: AbortSignal): Promise<User> {
  return request<User>('/auth/register', { method: 'POST', body: data, signal })
}

export async function loginAccount(data: LoginRequest, signal?: AbortSignal): Promise<TokenResponse> {
  const token = await request<TokenResponse>('/auth/login', { method: 'POST', body: data, signal })
  if (!token || typeof token.accessToken !== 'string' || !token.accessToken
    || typeof token.tokenType !== 'string' || token.tokenType.toLowerCase() !== 'bearer'
    || !Number.isFinite(token.expiresIn) || token.expiresIn <= 0) {
    throw new ApiError(502, 'Server je vratio neispravan odgovor za prijavu.')
  }
  return token
}

export async function getMe(accessToken: string, signal?: AbortSignal): Promise<User> {
  const user = await request<User>('/auth/me', { accessToken, signal })
  if (!user || !Number.isSafeInteger(user.id) || user.id <= 0
    || typeof user.firstName !== 'string' || typeof user.lastName !== 'string'
    || typeof user.email !== 'string' || !['CUSTOMER', 'ADMIN', 'OWNER'].includes(user.role)
    || user.enabled !== true) {
    throw new ApiError(502, 'Nije moguće potvrditi identitet prijavljenog korisnika.')
  }
  return user
}
