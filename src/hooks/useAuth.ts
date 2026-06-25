import { useCallback, useEffect, useState } from 'react'
import {
  getAccessToken,
  hasStoredSession,
  signIn,
  signOut,
  tryRestoreSession,
} from '../lib/googleAuth'
import { getClientId } from '../lib/config'

export function useAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState(
    () => hasStoredSession() || !!getAccessToken(),
  )
  const [isBootstrapping, setIsBootstrapping] = useState(true)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!getClientId()) {
      setError('Configure VITE_GOOGLE_CLIENT_ID no arquivo .env')
      setIsBootstrapping(false)
      return
    }

    let cancelled = false

    async function bootstrap() {
      if (hasStoredSession() || getAccessToken()) {
        if (!cancelled) {
          setIsAuthenticated(true)
          setIsBootstrapping(false)
        }
        return
      }

      const token = await tryRestoreSession()
      if (!cancelled) {
        setIsAuthenticated(!!token)
        setIsBootstrapping(false)
      }
    }

    void bootstrap()
    return () => {
      cancelled = true
    }
  }, [])

  const login = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      await signIn()
      setIsAuthenticated(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao entrar')
      setIsAuthenticated(false)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const logout = useCallback(() => {
    signOut()
    setIsAuthenticated(false)
  }, [])

  return {
    isAuthenticated,
    isBootstrapping,
    isLoading,
    error,
    login,
    logout,
    setError,
  }
}
