export class ApiError extends Error {
  readonly status: number
  readonly fieldErrors: string[]

  constructor(status: number, message: string, fieldErrors: string[] = []) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.fieldErrors = fieldErrors
  }
}

type UnauthorizedListener = (accessToken: string) => void
const unauthorizedListeners = new Set<UnauthorizedListener>()

/** Only token-authenticated requests can invalidate that exact in-memory session. */
export function subscribeToUnauthorized(listener: UnauthorizedListener): () => void {
  unauthorizedListeners.add(listener)
  return () => { unauthorizedListeners.delete(listener) }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  body?: unknown
  accessToken?: string
  signal?: AbortSignal
  timeoutMs?: number
}

function errorMessage(status: number, path: string): string {
  switch (status) {
    case 400: return 'Proveri unete podatke i pokušaj ponovo.'
    case 401:
      return path === '/auth/login'
        ? 'Email adresa ili lozinka nisu ispravni.'
        : 'Sesija je istekla ili više nije važeća. Prijavi se ponovo.'
    case 403: return path === '/auth/setup/owner'
      ? 'Instalacioni ključ nije ispravan.'
      : 'Nemaš dozvolu za pristup ovoj stranici.'
    case 404: return 'Traženi podatak nije pronađen.'
    case 409:
      if (path === '/auth/setup/owner') return 'Vlasnički nalog već postoji ili je ova email adresa zauzeta. Proveri stanje podešavanja.'
      return path === '/auth/register'
        ? 'Nalog sa ovom email adresom već postoji.'
        : 'Zahtev nije moguće izvršiti zbog trenutnog stanja podataka.'
    case 413: return 'Datoteka ili ukupan zahtev je prevelik. Svaka fotografija može imati najviše 5 MiB.'
    case 415: return 'Format nije podržan. Dodaj ispravnu JPEG ili PNG fotografiju.'
    case 422: return 'Fotografiju nije moguće obraditi. Izaberi ispravan JPEG ili PNG do 20 megapiksela.'
    case 429: return 'Previše zahteva. Sačekaj trenutak pa pokušaj ponovo.'
    case 502:
    case 503:
    case 504: return 'Server trenutno nije dostupan. Pokušaj ponovo kasnije.'
    default: return 'Zahtev nije uspeo. Pokušaj ponovo.'
  }
}

function validationFields(payload: unknown): string[] {
  if (typeof payload !== 'object' || payload === null || !('fields' in payload)) return []
  const fields = payload.fields
  if (!Array.isArray(fields)) return []
  const allowed = new Set(['firstName', 'lastName', 'email', 'password', 'brand', 'model', 'year', 'price',
    'mileage', 'fuelType', 'transmission', 'enginePowerHp', 'color', 'description', 'version',
    'files', 'file', 'photoIds', 'coverPhotoId', 'setupKey'])
  return fields.filter((field): field is string => typeof field === 'string' && allowed.has(field))
}

export function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError'
}

export function getErrorMessage(error: unknown): string {
  return error instanceof ApiError ? error.message : 'Došlo je do greške. Pokušaj ponovo.'
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' }
  const multipart = typeof FormData !== 'undefined' && options.body instanceof FormData
  // The browser must generate the multipart boundary for photo uploads.
  if (options.body !== undefined && !multipart) headers['Content-Type'] = 'application/json'
  if (options.accessToken) headers.Authorization = `Bearer ${options.accessToken}`

  let response: Response
  let text: string
  const controller = new AbortController()
  let timedOut = false
  const abort = () => controller.abort(options.signal?.reason)
  if (options.signal?.aborted) abort()
  else options.signal?.addEventListener('abort', abort, { once: true })
  const timeout = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, Math.min(60_000, Math.max(1, options.timeoutMs ?? 15_000)))
  try {
    response = await fetch(`/api${path}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.body === undefined ? undefined : multipart ? options.body as FormData : JSON.stringify(options.body),
      credentials: 'omit',
      signal: controller.signal,
    })
    text = await response.text()
  } catch (error) {
    if (timedOut) throw new ApiError(504, 'Server nije odgovorio na vreme. Pokušaj ponovo.')
    if (isAbortError(error)) throw error
    // Never attach request bodies, credentials, bearer headers or raw network errors.
    throw new ApiError(0, 'Nije moguće povezivanje sa serverom. Pokušaj ponovo za trenutak.')
  } finally {
    clearTimeout(timeout)
    options.signal?.removeEventListener('abort', abort)
  }

  let payload: unknown
  if (text.trim()) {
    try { payload = JSON.parse(text) as unknown } catch {
      if (response.ok) throw new ApiError(502, 'Server je vratio neočekivan odgovor. Pokušaj ponovo kasnije.')
    }
  }

  if (!response.ok) {
    if (response.status === 401 && options.accessToken) {
      for (const listener of unauthorizedListeners) listener(options.accessToken)
    }
    // Backend or proxy HTML/text is deliberately never reflected into the UI.
    throw new ApiError(response.status, errorMessage(response.status, path), validationFields(payload))
  }

  if (response.status !== 204 && payload === undefined) {
    throw new ApiError(502, 'Server je vratio prazan odgovor. Pokušaj ponovo kasnije.')
  }
  return payload as T
}
