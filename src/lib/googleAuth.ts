import { SCOPES, getClientId } from './config'

type TokenClient = {
  requestAccessToken: (options?: { prompt?: string }) => void
}

type TokenResponse = {
  access_token?: string
  expires_in?: number
  error?: string
}

type GsiWindow = Window & {
  google?: {
    accounts: {
      oauth2: {
        initTokenClient: (config: {
          client_id: string
          scope: string
          callback: (response: TokenResponse) => void
        }) => TokenClient
        revoke: (token: string, callback: () => void) => void
      }
    }
  }
}

const TOKEN_KEY = 'financas_access_token'
const TOKEN_EXPIRY_KEY = 'financas_token_expiry'

let accessToken: string | null = null
let tokenClient: TokenClient | null = null
let pendingResolve: ((token: string) => void) | null = null
let pendingReject: ((error: Error) => void) | null = null

function saveToken(token: string, expiresInSeconds = 3600): void {
  const expiresAt = Date.now() + expiresInSeconds * 1000 - 60_000
  sessionStorage.setItem(TOKEN_KEY, token)
  sessionStorage.setItem(TOKEN_EXPIRY_KEY, String(expiresAt))
}

export function loadStoredToken(): string | null {
  const token = sessionStorage.getItem(TOKEN_KEY)
  const expiry = sessionStorage.getItem(TOKEN_EXPIRY_KEY)
  if (!token || !expiry) return null
  if (Date.now() >= Number(expiry)) {
    clearStoredToken()
    return null
  }
  return token
}

function clearStoredToken(): void {
  sessionStorage.removeItem(TOKEN_KEY)
  sessionStorage.removeItem(TOKEN_EXPIRY_KEY)
}

function applyToken(token: string, expiresInSeconds = 3600): string {
  accessToken = token
  saveToken(token, expiresInSeconds)
  return token
}

accessToken = loadStoredToken()

function getGsi(): NonNullable<GsiWindow['google']> {
  const gsi = (window as GsiWindow).google
  if (!gsi) {
    throw new Error('Google Identity Services ainda não carregou. Recarregue a página.')
  }
  return gsi
}

function initTokenClient(): TokenClient {
  const clientId = getClientId()
  if (!clientId) {
    throw new Error('Configure VITE_GOOGLE_CLIENT_ID no arquivo .env')
  }

  return getGsi().accounts.oauth2.initTokenClient({
    client_id: clientId,
    scope: SCOPES,
    callback: (response) => {
      if (response.error || !response.access_token) {
        pendingReject?.(new Error(response.error ?? 'Falha ao autenticar'))
        pendingResolve = null
        pendingReject = null
        return
      }

      applyToken(response.access_token, response.expires_in ?? 3600)
      pendingResolve?.(response.access_token)
      pendingResolve = null
      pendingReject = null
    },
  })
}

function waitForGsi(timeoutMs = 8000): Promise<void> {
  return new Promise((resolve, reject) => {
    if ((window as GsiWindow).google?.accounts?.oauth2) {
      resolve()
      return
    }

    const started = Date.now()
    const interval = setInterval(() => {
      if ((window as GsiWindow).google?.accounts?.oauth2) {
        clearInterval(interval)
        resolve()
        return
      }
      if (Date.now() - started > timeoutMs) {
        clearInterval(interval)
        reject(new Error('Não foi possível carregar o login do Google.'))
      }
    }, 100)
  })
}

function requestToken(prompt: '' | 'none' | 'consent'): Promise<string> {
  if (!tokenClient) {
    tokenClient = initTokenClient()
  }

  return new Promise((resolve, reject) => {
    pendingResolve = resolve
    pendingReject = reject
    tokenClient!.requestAccessToken({ prompt })
  })
}

/** Tenta restaurar sessão sem popup (refresh da página). */
export async function tryRestoreSession(): Promise<string | null> {
  const stored = loadStoredToken()
  if (stored) {
    accessToken = stored
    return stored
  }

  if (!getClientId()) return null

  try {
    await waitForGsi()
    return await requestToken('none')
  } catch {
    return null
  }
}

/** Login explícito: silencioso primeiro; consentimento só se necessário. */
export async function signIn(): Promise<string> {
  await waitForGsi()

  const stored = loadStoredToken()
  if (stored) {
    accessToken = stored
    return stored
  }

  try {
    return await requestToken('')
  } catch {
    return await requestToken('consent')
  }
}

export function getAccessToken(): string | null {
  return accessToken ?? loadStoredToken()
}

export function signOut(): void {
  const token = accessToken
  accessToken = null
  tokenClient = null
  clearStoredToken()

  if (token) {
    try {
      const gsi = (window as GsiWindow).google
      gsi?.accounts.oauth2.revoke(token, () => undefined)
    } catch {
      // ignore revoke errors
    }
  }
}

export async function ensureAccessToken(): Promise<string> {
  const stored = loadStoredToken()
  if (stored) {
    accessToken = stored
    return stored
  }

  if (accessToken) return accessToken

  const restored = await tryRestoreSession()
  if (restored) return restored

  return signIn()
}

export function hasStoredSession(): boolean {
  return !!loadStoredToken()
}
