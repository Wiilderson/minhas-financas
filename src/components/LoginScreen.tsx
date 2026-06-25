import { getClientId } from '../lib/config'

interface LoginScreenProps {
  onLogin: () => void
  isLoading: boolean
  error: string | null
}

export function LoginScreen({ onLogin, isLoading, error }: LoginScreenProps) {
  const hasClientId = !!getClientId()

  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="login-icon">R$</div>
        <h1>Minhas Finanças</h1>
        <p className="login-subtitle">
          Lance entradas e despesas de forma rápida. Tudo salvo na sua planilha do Google Sheets.
        </p>

        {!hasClientId && (
          <div className="alert alert-warning">
            Configure o arquivo <code>.env</code> com seu <code>VITE_GOOGLE_CLIENT_ID</code> antes de
            usar.
          </div>
        )}

        {error && <div className="alert alert-error">{error}</div>}

        <button
          type="button"
          className="btn btn-google"
          onClick={onLogin}
          disabled={isLoading || !hasClientId}
        >
          {isLoading ? 'Conectando…' : 'Entrar com Google'}
        </button>
      </div>
    </div>
  )
}
